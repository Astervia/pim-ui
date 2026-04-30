/**
 * useDaemonState — React hook wrapping the Rust daemon bridge.
 *
 * Owns: DaemonSnapshot (state + hello + status + lastError + peerCount +
 * baselineTimestamp + discovered[] + subscriptionError).
 * Inputs: Tauri events EVT_STATE_CHANGED + EVT_RPC_EVENT (src/lib/rpc.ts DaemonEvents).
 * Outputs: a stable snapshot React can render, plus imperative actions.
 *
 * W1 listener-dedup: this module is the SOLE owner of the two Tauri
 * event subscriptions. subscribeDaemon() (src/lib/rpc.ts) only invokes
 * the Rust daemon_subscribe command and returns the subscription_id —
 * the fan-out to per-event subscribers happens here via `eventHandlers`.
 * There must be exactly TWO `listen(DaemonEvents.*)` calls in the whole app.
 * Do NOT add a third — every new subscription goes through
 * `actions.subscribe(event, handler)` which registers against
 * `eventHandlers` and asks Rust to start forwarding via
 * `subscribeDaemon(event)`.
 *
 * Phase 2 Plan 01 additions:
 *   - Auto-seed `status` + `peers.discovered` on first `running` transition.
 *   - Auto-subscribe to `status.event` + `peers.event` on `running`; tear
 *     down on leaving `running`.
 *   - Merge `status.event` into `snapshot.status` per D-06 (interface_up/down,
 *     gateway_selected/lost, route_on/off, role_changed); `kill_switch` is
 *     intentionally deferred to Phase 4.
 *   - Phase 4 D-31: kill_switch handler upgraded — defensively sets
 *     selected_gateway=null on snapshot.routes (so KillSwitchBanner's
 *     derived condition fires) AND emits a sonner toast. W1 invariant
 *     preserved (no new Tauri-side subscription).
 *   - Merge `peers.event { connected | disconnected | state_changed }` into
 *     `snapshot.status.peers` (new array ref); push `discovered` events onto
 *     `snapshot.discovered` with dedupe by (address + mechanism).
 *   - D-31 retry-once: wrap subscribe() calls in `safeSubscribe` — on second
 *     failure, store `{ stream, error }` on `snapshot.subscriptionError` for
 *     Plan 02-06 to render a toast.
 *
 * Design: single hook instance per app — import it wherever daemon state is
 * needed. Internally uses a module-level atom + useSyncExternalStore so
 * multiple consumers share one subscription (no duplicate Tauri listeners).
 *
 * Consumed by: Plan 04 dashboard, Plan 03 brand surfaces (status chip,
 * toggle, banner, stop-confirm dialog), Plan 02-03..06 dashboard panels.
 */

import { useEffect, useSyncExternalStore } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  DaemonEvents,
  attachDaemonIfRunning,
  lastDaemonError,
  startDaemon,
  stopDaemon,
  subscribeDaemon,
  unsubscribeDaemon,
  type DaemonSubscription,
} from "@/lib/rpc";
import { callDaemon } from "@/lib/rpc";
import { KILL_SWITCH_TOAST } from "@/lib/copy";
import type {
  NodeRole,
  PeerDiscovered,
  PeerEvent,
  PeerSummary,
  RpcError,
  RpcEventMap,
  RpcEventName,
  Status,
  StatusEvent,
} from "@/lib/rpc-types";
import {
  INITIAL_SNAPSHOT,
  type DaemonSnapshot,
  type DaemonStateChange,
} from "@/lib/daemon-state";

// ─── Module-level atom ─────────────────────────────────────────────
// useSyncExternalStore pattern so every component re-renders from one source.

let snapshot: DaemonSnapshot = INITIAL_SNAPSHOT;
let stopConfirmOpen = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function setSnapshot(next: DaemonSnapshot) {
  snapshot = next;
  notify();
}

function setStopConfirm(open: boolean) {
  stopConfirmOpen = open;
  notify();
}

function subscribeLocal(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// ─── One-time Tauri event subscriptions ───────────────────────────
// Initialized on first hook mount; torn down when the last consumer unmounts.
//
// W1: exactly two listen(...) calls in this file — stateChanged + rpcEvent.
// Per-subscription fan-out lives in `eventHandlers` below.

let unlistenState: UnlistenFn | null = null;
let unlistenRpcEvent: UnlistenFn | null = null;
let activeConsumers = 0;
// Wrapped handlers registered via actions.subscribe(). One global listener
// invokes every handler matching the incoming payload.event.
const eventHandlers = new Map<RpcEventName, Set<(p: unknown) => void>>();

// ─── Phase 2 Plan 01 — reactive-spine module state ────────────────────
//
// `hasSeeded` flips to true on the first `running` transition and back to
// false whenever `state !== "running"`, so a reconnect re-seeds. The two
// subscription handles let us tear down cleanly when daemon leaves
// `running` (e.g. user clicks stop, or socket drops into reconnecting).

let hasSeeded = false;
let statusSub: DaemonSubscription | null = null;
let peersSub: DaemonSubscription | null = null;

// Live-tick: re-fetch status + peers.discovered every 1s while daemon is
// running so uptime, peer last_seen_s, discovered first_seen_s and any
// other timestamp-derived fields keep ticking in the UI without manual
// refresh. Subscriptions still drive instant updates on significant
// events; this is the freshness pulse for time-derived values.
const POLL_INTERVAL_MS = 1000;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let pollInFlight = false;

async function pollSnapshot(): Promise<void> {
  if (pollInFlight === true) return;
  if (snapshot.state !== "running") return;
  pollInFlight = true;
  try {
    const [status, discovered] = await Promise.all([
      callDaemon("status", null),
      callDaemon("peers.discovered", null),
    ]);
    setSnapshot({
      ...snapshot,
      status,
      discovered,
      peerCount: status.peers.filter((p) => p.state === "active").length,
    });
  } catch (e) {
    // Failure leaves the existing snapshot intact (D-30 honest last-state).
    console.warn("poll (status+peers.discovered) failed:", e);
  } finally {
    pollInFlight = false;
  }
}

/**
 * Register a local fan-out handler and ensure Rust forwards the stream.
 * Used by both the public `actions.subscribe` and the internal reactive
 * spine (seedAndSubscribe) — NEVER allocates a Tauri subscription; W1
 * contract preserved.
 */
async function registerHandler<E extends RpcEventName>(
  event: E,
  handler: (params: RpcEventMap[E]) => void,
): Promise<DaemonSubscription> {
  let set = eventHandlers.get(event);
  if (!set) {
    set = new Set();
    eventHandlers.set(event, set);
  }
  const wrapped = (p: unknown) => handler(p as RpcEventMap[E]);
  set.add(wrapped);
  const remote = await subscribeDaemon(event);
  return {
    id: remote.id,
    unsubscribe: async () => {
      set?.delete(wrapped);
      if (set && set.size === 0) eventHandlers.delete(event);
      await unsubscribeDaemon(remote.id);
    },
  };
}

/**
 * D-31: retry-once with 500ms backoff. On second failure, store the
 * error on snapshot.subscriptionError for Plan 02-06's toast renderer
 * to pick up. Success clears any prior error for that stream.
 */
async function safeSubscribe<E extends RpcEventName>(
  event: E,
  handler: (params: RpcEventMap[E]) => void,
): Promise<DaemonSubscription | null> {
  try {
    const sub = await registerHandler(event, handler);
    // Clear any prior subscriptionError that was scoped to this stream.
    if (snapshot.subscriptionError?.stream === event) {
      setSnapshot({ ...snapshot, subscriptionError: null });
    }
    return sub;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const sub = await registerHandler(event, handler);
      if (snapshot.subscriptionError?.stream === event) {
        setSnapshot({ ...snapshot, subscriptionError: null });
      }
      return sub;
    } catch (e2) {
      const rpcErr: RpcError = normaliseRpcError(e2);
      setSnapshot({
        ...snapshot,
        subscriptionError: { stream: event, error: rpcErr },
      });
      return null;
    }
  }
}

/** Best-effort coercion of an unknown thrown value into an RpcError. */
function normaliseRpcError(e: unknown): RpcError {
  if (e && typeof e === "object" && "code" in e && "message" in e) {
    // Already matches the RpcError shape.
    return e as RpcError;
  }
  return {
    code: -32603, // InternalError
    message: e instanceof Error ? e.message : String(e),
  };
}

/** D-06 `status.event` → merge into snapshot.status with a new object ref. */
function handleStatusEvent(evt: StatusEvent): void {
  const current = snapshot.status;
  if (!current) return; // seed hasn't landed yet; ignore
  const next: Status = { ...current };
  switch (evt.kind) {
    case "interface_up":
      next.interface = { ...current.interface, up: true };
      break;
    case "interface_down":
      next.interface = { ...current.interface, up: false };
      break;
    case "gateway_selected": {
      const nodeId = (evt.detail as { node_id?: string } | undefined)?.node_id;
      next.routes = {
        ...current.routes,
        selected_gateway: typeof nodeId === "string" ? nodeId : current.routes.selected_gateway,
      };
      break;
    }
    case "gateway_lost":
      next.routes = { ...current.routes, selected_gateway: null };
      break;
    case "route_on":
      next.route_on = true;
      break;
    case "route_off":
      next.route_on = false;
      break;
    case "role_changed": {
      const role = (evt.detail as { role?: unknown } | undefined)?.role;
      if (Array.isArray(role)) next.role = role as NodeRole[];
      break;
    }
    case "kill_switch": {
      // Phase 4 D-23 + D-31: defensive snapshot mutation. The daemon SHOULD
      // emit gateway_lost before kill_switch (clearing selected_gateway
      // already), but we cannot rely on that. Re-set null here so the
      // KillSwitchBanner derived condition (route_on===true &&
      // selected_gateway===null) is reliably satisfied even when
      // kill_switch arrives standalone.
      next.routes = { ...current.routes, selected_gateway: null };
      // Phase 2 D-31 — sonner Toaster is mounted at AppShell. One-shot
      // toast keeps the kill-switch arrival visible across screens.
      void toast.error(KILL_SWITCH_TOAST, { duration: 6000 });
      break;
    }
    default:
      // Unknown kind — no-op, do not produce a new snapshot reference.
      return;
  }
  setSnapshot({ ...snapshot, status: next });
}

/** D-06 `peers.event` → peers[] in-place merge or discovered[] append. */
function handlePeersEvent(evt: PeerEvent): void {
  // `discovered` is the only kind whose peer payload is PeerDiscovered;
  // every other kind carries a PeerSummary. Narrow on the wire `kind`.
  if (evt.kind === "discovered") {
    const peer = evt.peer as PeerDiscovered;
    const current = snapshot.discovered;
    const existingIdx = current.findIndex(
      (d) => d.address === peer.address && d.mechanism === peer.mechanism,
    );
    let nextDiscovered: PeerDiscovered[];
    if (existingIdx >= 0) {
      const prior = current[existingIdx]!;
      nextDiscovered = [...current];
      nextDiscovered[existingIdx] = {
        ...prior,
        last_seen_s: peer.last_seen_s,
        // keep first_seen_s sticky, pick up any label/id update
        label_announced: peer.label_announced ?? prior.label_announced,
        node_id: peer.node_id ?? prior.node_id,
      };
    } else {
      nextDiscovered = [...current, peer];
    }
    setSnapshot({ ...snapshot, discovered: nextDiscovered });
    return;
  }

  if (evt.kind === "pair_failed") {
    // Plan 02-04's useTroubleshootLog owns the per-peer buffer; snapshot.peers
    // is unchanged here because the daemon already emits the state_changed
    // transition alongside pair_failed.
    return;
  }

  // connected | disconnected | state_changed — peer is a PeerSummary.
  const peer = evt.peer as PeerSummary;
  const current = snapshot.status;
  if (!current) return; // seed hasn't landed; defer to next seed cycle
  const existing = current.peers;
  let nextPeers: PeerSummary[];
  if (evt.kind === "disconnected") {
    nextPeers = existing.filter((p) => p.node_id !== peer.node_id);
  } else {
    // connected | state_changed — replace-by-id, append if not present.
    const idx = existing.findIndex((p) => p.node_id === peer.node_id);
    if (idx >= 0) {
      nextPeers = [...existing];
      nextPeers[idx] = peer;
    } else {
      nextPeers = [...existing, peer];
    }
  }
  const nextStatus: Status = { ...current, peers: nextPeers };
  const nextPeerCount = nextPeers.filter((p) => p.state === "active").length;
  setSnapshot({ ...snapshot, status: nextStatus, peerCount: nextPeerCount });
}

/**
 * Seed snapshot.status (if not already populated) and snapshot.discovered
 * via parallel RPC calls, then auto-subscribe to status.event + peers.event
 * so future mutations flow through the handlers above.
 *
 * Called on the first `running` transition and on every reconnect that
 * re-enters `running` after leaving it.
 */
async function seedAndSubscribe(): Promise<void> {
  try {
    const [status, discovered] = await Promise.all([
      callDaemon("status", null),
      callDaemon("peers.discovered", null),
    ]);
    setSnapshot({
      ...snapshot,
      status,
      discovered,
      peerCount: status.peers.filter((p) => p.state === "active").length,
    });
  } catch (e) {
    // Seed failure does not clear existing last-known state (D-30 honest
    // last-state). Log for diagnostics; subscription attempts still go.
    console.warn("seed (status+peers.discovered) failed:", e);
  }
  statusSub = await safeSubscribe("status.event", handleStatusEvent);
  peersSub = await safeSubscribe("peers.event", handlePeersEvent);
}

/** Unsubscribe both reactive-spine streams and clear handles. */
async function teardownReactive(): Promise<void> {
  const pending: Array<Promise<void>> = [];
  if (statusSub) pending.push(statusSub.unsubscribe().catch(() => {}));
  if (peersSub) pending.push(peersSub.unsubscribe().catch(() => {}));
  statusSub = null;
  peersSub = null;
  await Promise.all(pending);
}

async function ensureListeners() {
  if (activeConsumers > 0) {
    activeConsumers++;
    return;
  }
  activeConsumers++;

  // EVT_STATE_CHANGED — drives DaemonSnapshot.state / hello / status / lastError.
  unlistenState = await listen<DaemonStateChange>(
    DaemonEvents.stateChanged,
    ({ payload }) => {
      const baselineTimestamp =
        payload.state === "running" && payload.status
          ? Date.now()
          : snapshot.baselineTimestamp;
      const nextStatus: Status | null =
        (payload.status as Status | undefined) ?? snapshot.status;
      setSnapshot({
        ...snapshot,
        state: payload.state,
        hello: payload.hello ?? snapshot.hello,
        status: nextStatus,
        lastError:
          payload.error ??
          (payload.state === "error" ? snapshot.lastError : null),
        baselineTimestamp,
        peerCount:
          nextStatus?.peers?.filter((p) => p.state === "active").length ?? 0,
      });

      // Phase 2 Plan 01 reactive-spine gates (D-07 auto-seed, D-04/D-05
      // auto-subscribe). Detect the transition EDGE — enter-running or
      // leave-running — so we seed exactly once per `running` window and
      // tear down cleanly when the daemon leaves that state. This fires
      // off async work without awaiting because the listener callback
      // signature is synchronous; errors are handled inside the helpers.
      if (payload.state === "running" && !hasSeeded) {
        hasSeeded = true;
        seedAndSubscribe().catch((e) =>
          console.warn("seedAndSubscribe failed:", e),
        );
      } else if (payload.state !== "running" && hasSeeded) {
        hasSeeded = false;
        teardownReactive().catch((e) =>
          console.warn("teardownReactive failed:", e),
        );
      }
    },
  );

  // EVT_RPC_EVENT — THE ONE AND ONLY rpc-event subscription in the app (W1).
  // Fans out to per-event handler sets registered via actions.subscribe().
  unlistenRpcEvent = await listen<{ event: RpcEventName; params: unknown }>(
    DaemonEvents.rpcEvent,
    ({ payload }) => {
      const set = eventHandlers.get(payload.event);
      if (!set) return;
      set.forEach((h) => {
        try {
          h(payload.params);
        } catch (e) {
          console.warn("rpc-event handler threw:", e);
        }
      });
    },
  );

  // Hydrate lastError in case the UI booted after the Rust side already errored.
  try {
    const err = await lastDaemonError();
    if (err) setSnapshot({ ...snapshot, lastError: err });
  } catch (e) {
    console.warn("lastDaemonError hydrate failed:", e);
  }

  // Reload / fresh-launch with daemon already running: probe the socket
  // and if a daemon is answering, kick the Rust state machine into
  // Starting → Running without spawning. Listeners are already armed
  // above, so the resulting state-changed events flow into the snapshot
  // and the seedAndSubscribe gate fires the moment running lands.
  // No-op (false) when no daemon is up; the user can still click
  // [TURN ON] to spawn fresh.
  try {
    await attachDaemonIfRunning();
  } catch (e) {
    console.warn("attachDaemonIfRunning failed:", e);
  }

  // Start the 1s freshness pulse. pollSnapshot self-gates on
  // snapshot.state === "running" so it costs ~nothing while the daemon
  // is stopped.
  if (pollInterval === null) {
    pollInterval = setInterval(() => {
      void pollSnapshot();
    }, POLL_INTERVAL_MS);
  }
}

function releaseListeners() {
  activeConsumers--;
  if (activeConsumers > 0) return;
  unlistenState?.();
  unlistenState = null;
  unlistenRpcEvent?.();
  unlistenRpcEvent = null;
  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ─── Public API ────────────────────────────────────────────────────

export interface DaemonActions {
  start(): Promise<void>;
  stop(): Promise<void>;
  confirmStop(): Promise<void>;
  dismissStopConfirm(): void;
  /**
   * Register a handler for one of the three event streams. The hook owns
   * the single global Tauri event subscription (W1); this method adds the
   * handler to the internal fan-out map AND tells Rust to start forwarding
   * the stream via subscribeDaemon (which invokes daemon_subscribe and
   * returns the subscription_id).
   */
  subscribe<E extends RpcEventName>(
    event: E,
    handler: (params: RpcEventMap[E]) => void,
  ): Promise<DaemonSubscription>;
  /**
   * Force a fresh `status` + `peers.discovered` RPC roundtrip and
   * replace the corresponding snapshot fields. Called by per-screen
   * `[ refresh ]` buttons. Does NOT touch the active subscriptions —
   * live status.event / peers.event continue flowing through.
   *
   * Failure paths log to the console and leave the existing snapshot
   * intact (D-30 honest last-state — refusing to clear what we know).
   */
  reseed(): Promise<void>;
}

export interface DaemonStateHookResult {
  snapshot: DaemonSnapshot;
  actions: DaemonActions;
  stopConfirmOpen: boolean;
}

function getSnapshot(): DaemonSnapshot {
  return snapshot;
}
function getStopConfirmOpen(): boolean {
  return stopConfirmOpen;
}

// Module-level singleton: every action reads/writes only module-level state
// (snapshot, stopConfirmOpen, eventHandlers, etc.), so there's no closure to
// capture from the React render context. Returning a stable reference is
// load-bearing — if `actions` is a fresh object literal per render, every
// downstream `useEffect([actions])` (useRouteTable, usePairApproval,
// usePendingRestart, usePeerTroubleshootLog, useSectionSave, useRawTomlSave)
// re-fires on every snapshot change. Each re-fire unsubscribes + re-subscribes
// + refetches over the Unix socket; combined with the 1 s pollSnapshot tick
// and React StrictMode's effect double-invocation in dev, this floods the
// Tauri bridge and saturates the renderer (perceived as the WebView freezing
// when the user clicks `[ CONFIRM TURN ON ]`). With a stable singleton,
// `[actions]` deps stop oscillating and the loop closes.
const STABLE_ACTIONS: DaemonActions = {
  start: () => startDaemon(),
  stop: async () => {
    if (snapshot.peerCount > 0) {
      setStopConfirm(true);
      return;
    }
    await stopDaemon();
  },
  confirmStop: async () => {
    setStopConfirm(false);
    await stopDaemon();
  },
  dismissStopConfirm: () => setStopConfirm(false),
  // Delegates to the module-level helper so external subscribers and the
  // reactive-spine path share one implementation. W1 preserved —
  // registerHandler never allocates a Tauri subscription; it only registers
  // in `eventHandlers` and asks Rust (via subscribeDaemon / invoke) to start
  // forwarding the stream.
  subscribe: registerHandler,
  reseed: async () => {
    try {
      const [status, discovered] = await Promise.all([
        callDaemon("status", null),
        callDaemon("peers.discovered", null),
      ]);
      setSnapshot({
        ...snapshot,
        status,
        discovered,
        peerCount: status.peers.filter((p) => p.state === "active").length,
      });
    } catch (e) {
      // Reseed failure does not clear existing last-known state. The user
      // will see a stale snapshot; the next live event or successful retry
      // corrects it.
      console.warn("reseed (status+peers.discovered) failed:", e);
    }
  },
};

export function useDaemonState(): DaemonStateHookResult {
  const snap = useSyncExternalStore(subscribeLocal, getSnapshot, getSnapshot);
  const scoOpen = useSyncExternalStore(
    subscribeLocal,
    getStopConfirmOpen,
    getStopConfirmOpen,
  );

  useEffect(() => {
    ensureListeners().catch((e) => console.warn("ensureListeners:", e));
    return () => releaseListeners();
  }, []);

  return {
    snapshot: snap,
    stopConfirmOpen: scoOpen,
    actions: STABLE_ACTIONS,
  };
}

// Exposed for tests to reset module state between cases.
export const __test_resetDaemonStateAtom = () => {
  snapshot = INITIAL_SNAPSHOT;
  stopConfirmOpen = false;
  listeners.clear();
  eventHandlers.clear();
  activeConsumers = 0;
  unlistenState?.();
  unlistenState = null;
  unlistenRpcEvent?.();
  unlistenRpcEvent = null;
  // Phase 2 Plan 01 reactive-spine module state.
  hasSeeded = false;
  statusSub = null;
  peersSub = null;
  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  pollInFlight = false;
};
