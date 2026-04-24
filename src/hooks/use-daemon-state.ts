/**
 * useDaemonState — React hook wrapping the Rust daemon bridge.
 *
 * Owns: DaemonSnapshot (state + hello + status + lastError + peerCount + baselineTimestamp).
 * Inputs: Tauri events EVT_STATE_CHANGED + EVT_RPC_EVENT (src/lib/rpc.ts DaemonEvents).
 * Outputs: a stable snapshot React can render, plus imperative actions.
 *
 * W1 listener-dedup: this module is the SOLE owner of the two Tauri
 * event subscriptions. subscribeDaemon() (src/lib/rpc.ts) only invokes
 * the Rust daemon_subscribe command and returns the subscription_id —
 * the fan-out to per-event subscribers happens here via `eventHandlers`.
 * There must be exactly TWO `listen(DaemonEvents.*)` calls in the whole app.
 *
 * Design: single hook instance per app — import it wherever daemon state is
 * needed. Internally uses a module-level atom + useSyncExternalStore so
 * multiple consumers share one subscription (no duplicate Tauri listeners).
 *
 * Consumed by: Plan 04 dashboard, Plan 03 brand surfaces (status chip,
 * toggle, banner, stop-confirm dialog).
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  DaemonEvents,
  lastDaemonError,
  startDaemon,
  stopDaemon,
  subscribeDaemon,
  unsubscribeDaemon,
  type DaemonSubscription,
} from "@/lib/rpc";
import type {
  RpcEventMap,
  RpcEventName,
  Status,
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
}

function releaseListeners() {
  activeConsumers--;
  if (activeConsumers > 0) return;
  unlistenState?.();
  unlistenState = null;
  unlistenRpcEvent?.();
  unlistenRpcEvent = null;
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

  const start = useCallback(async () => {
    await startDaemon();
  }, []);
  const stop = useCallback(async () => {
    if (snapshot.peerCount > 0) {
      setStopConfirm(true);
      return;
    }
    await stopDaemon();
  }, []);
  const confirmStop = useCallback(async () => {
    setStopConfirm(false);
    await stopDaemon();
  }, []);
  const dismissStopConfirm = useCallback(() => setStopConfirm(false), []);

  const subscribe = useCallback(async function <E extends RpcEventName>(
    event: E,
    handler: (p: RpcEventMap[E]) => void,
  ): Promise<DaemonSubscription> {
    // Register local handler in the fan-out map.
    let set = eventHandlers.get(event);
    if (!set) {
      set = new Set();
      eventHandlers.set(event, set);
    }
    const wrapped = (p: unknown) => handler(p as RpcEventMap[E]);
    set.add(wrapped);
    // Ask Rust to start forwarding the stream and get a subscription_id back.
    // subscribeDaemon does NOT own a Tauri event subscription (W1) — we do, above.
    const remote = await subscribeDaemon(event);
    return {
      id: remote.id,
      unsubscribe: async () => {
        set?.delete(wrapped);
        // Also tear down the fan-out map entry if empty, so the next subscriber
        // gets a fresh Set.
        if (set && set.size === 0) eventHandlers.delete(event);
        await unsubscribeDaemon(remote.id);
      },
    };
  }, []);

  return {
    snapshot: snap,
    stopConfirmOpen: scoOpen,
    actions: { start, stop, confirmStop, dismissStopConfirm, subscribe },
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
};
