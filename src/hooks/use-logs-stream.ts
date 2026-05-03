/**
 * useLogsStream — Logs tab subscription lifecycle + in-memory ring buffer
 * + filter state.
 *
 * Subscription lifecycle (02-CONTEXT §D-25):
 *   - On daemon `running`: register a fan-out handler via
 *     `actions.subscribe("logs.event", …)` — that path's `registerHandler`
 *     (use-daemon-state.ts) already calls `daemon_subscribe →
 *     logs.subscribe` on the daemon. A second explicit subscribe used to
 *     live here and caused every log line to arrive twice; do not add
 *     it back without also fixing the daemon's `logs.unsubscribe`
 *     (currently a no-op, so duplicate subscriptions leak).
 *   - Each incoming LogEvent prepends onto a module-local ring buffer
 *     capped at MAX_ENTRIES (2000, drop-oldest).
 *   - On daemon leaving `running`: tear down the fan-out via
 *     `sub.unsubscribe()` — this routes through `daemon_unsubscribe`
 *     and (eventually) `logs.unsubscribe` on the daemon.
 *
 * Filter semantics (02-CONTEXT §D-26 + 03-CONTEXT §D-21/D-22):
 *   - Level filter (trace/debug/info/warn/error) is SERVER-SIDE — changing
 *     it unsubscribes the old stream and resubscribes with the new
 *     min_level. The daemon honours min_level as a `>=` gate.
 *   - Peer filter is CLIENT-SIDE — the daemon's `sources` parameter is
 *     module-based (e.g. "transport", "discovery"), not peer-based. We
 *     filter `event.peer_id === peerFilter` on the buffer before return.
 *   - Source filter is CLIENT-SIDE — applied alongside peer filter.
 *     Phase 3 introduces this for cross-plan [Show in Logs →] toast
 *     routing (D-32); the daemon's `sources` list could narrow this
 *     server-side later, but client-side keeps the existing single
 *     subscription stable across source-filter changes.
 *   - Search text + time range are also CLIENT-SIDE — applied via the
 *     useLogFilters atom (Phase 3 03-03 D-21 / D-22). Filter chain order:
 *     level [server-side] → peer [client] → source [client] → search
 *     [client 300ms debounced] → time range [client].
 *
 * Module-level atoms (Phase 3 03-03):
 *   - level / peerFilter / sourceFilter live at module scope so
 *     `applyLogsFilter()` (use-log-filters.ts) can write them without
 *     holding a React hook reference. Mirrors the useActiveScreen +
 *     useDaemonState pattern: useSyncExternalStore on read, exported
 *     setters (setLevelAtom / setPeerAtom / setSourceAtom) on write.
 *
 * Retry-once on subscribe failure (02-CONTEXT §D-31):
 *   - First failure → wait 500 ms → retry.
 *   - Second failure → store errorMessage on the hook state for the
 *     caller to surface (02-06 wires the toast). Status flips to "idle".
 *
 * Ring-buffer design rationale:
 *   - At high log rates a naive React state update per event would
 *     trigger 2000+ re-renders per burst. We store the buffer in a ref
 *     and bump a counter via setState to force a re-render exactly once
 *     per event — React batches these inside a burst, so realistic
 *     render rate is one per animation frame, not per event.
 *   - Buffer stored newest-first. The list component reverses it for
 *     oldest-top / newest-bottom display (terminal convention).
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useDaemonState } from "./use-daemon-state";
import { type DaemonSubscription } from "@/lib/rpc";
import type { LogEvent, LogLevel } from "@/lib/rpc-types";

export type StreamStatus = "streaming" | "paused" | "reconnecting" | "idle";

export interface UseLogsStreamResult {
  /** Visible slice after applying levels + crates + peer + source filters. */
  events: LogEvent[];
  /** Full ring buffer (capped at MAX_ENTRIES, newest-first). */
  allEvents: LogEvent[];
  /** Multi-select level filter. Empty Set = show NOTHING; populate to
   *  whitelist specific levels. Default is all five levels selected. */
  levels: ReadonlySet<LogLevel>;
  /** Replace the levels Set wholesale. */
  setLevels: (next: ReadonlySet<LogLevel>) => void;
  /** Toggle a single level on/off in the levels Set. */
  toggleLevel: (l: LogLevel) => void;
  /** Multi-select crate (source-prefix) filter. Empty Set = show ALL
   *  crates; populate to whitelist specific ones. Crates are
   *  auto-discovered from events as they arrive. */
  crates: ReadonlySet<string>;
  /** Replace the crates Set wholesale. */
  setCrates: (next: ReadonlySet<string>) => void;
  /** Toggle a single crate on/off in the crates Set. */
  toggleCrate: (c: string) => void;
  /** Every crate name observed in the event stream so far, sorted.
   *  Drives the dropdown options for the crate multi-select. */
  discoveredCrates: readonly string[];
  /** Back-compat shim — reads the highest-rank level still selected.
   *  Kept so `applyLogsFilter` and existing screens don't break. */
  level: LogLevel;
  /** Back-compat shim — clears `levels` to the single chosen level
   *  plus everything above it (mimics old `min_level` semantics). */
  setLevel: (l: LogLevel) => void;
  /** node_id to filter by, or null for "(all)". */
  peerFilter: string | null;
  setPeerFilter: (p: string | null) => void;
  /** Single source-name filter used by the `[Show in Logs →]` toast
   *  routing (Phase 3 03-03 D-22). Distinct from `crates` which is the
   *  user-driven multi-select; this is a one-shot programmatic narrow. */
  sourceFilter: string | null;
  setSourceFilter: (s: string | null) => void;
  status: StreamStatus;
  /** D-31 error message; non-null when retry-once exhausted. */
  errorMessage: string | null;
  /** D-31 stream label, surfaced for the toast that Plan 02-06 renders. */
  errorStream: "logs" | null;
}

/** Order matters: index = rank used by `level >= min_level` comparisons
 *  in the back-compat `setLevel` shim. */
const LEVEL_ORDER: readonly LogLevel[] = ["trace", "debug", "info", "warn", "error"];

const MAX_ENTRIES = 2000;

// ─── Module-level state (Phase 3 03-03) ────────────────────────────────
//
// level / peerFilter / sourceFilter live here so non-React callers
// (applyLogsFilter from use-log-filters.ts, used by [Show in Logs →]
// toast actions per D-32) can update them without a hook reference.
// Reads go through useSyncExternalStore inside the hook.
//
// The ring buffer also lives at module scope so a single subscription
// drives all consumers — multiple components that mount useLogsStream
// (e.g. LogsScreen + CustomTimeRangeDialog reading the buffer for
// default From/To) share one daemon subscription without spawning
// duplicates. The mount/unmount lifecycle is reference-counted.

/** Multi-select level filter. Default = all five levels selected so
 *  the user sees everything until they explicitly narrow. */
let levelsAtom: ReadonlySet<LogLevel> = new Set<LogLevel>([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
]);
/** Multi-select crate filter. Empty = show all crates. */
let cratesAtom: ReadonlySet<string> = new Set<string>();
/** Auto-collected from observed events. Sorted on read for stable
 *  dropdown ordering. */
const discoveredCratesAtom = new Set<string>();
let peerAtom: string | null = null;
let sourceAtom: string | null = null;
const filterListeners = new Set<() => void>();

const buffer: LogEvent[] = [];
const bufferListeners = new Set<() => void>();

function notifyFilters() {
  filterListeners.forEach((cb) => cb());
}
function subscribeFilters(cb: () => void): () => void {
  filterListeners.add(cb);
  return () => {
    filterListeners.delete(cb);
  };
}
function notifyBuffer() {
  bufferListeners.forEach((cb) => cb());
}
function subscribeBuffer(cb: () => void): () => void {
  bufferListeners.add(cb);
  return () => {
    bufferListeners.delete(cb);
  };
}
function getLevelsAtom(): ReadonlySet<LogLevel> {
  return levelsAtom;
}
function getCratesAtom(): ReadonlySet<string> {
  return cratesAtom;
}
/** Snapshot of discovered crates as a sorted array. Identity-stable
 *  per filterListeners notification — we re-allocate the array only
 *  when the underlying Set changed. */
let discoveredCratesSnapshot: readonly string[] = [];
function getDiscoveredCratesSnapshot(): readonly string[] {
  return discoveredCratesSnapshot;
}
function getPeerAtom(): string | null {
  return peerAtom;
}
function getSourceAtom(): string | null {
  return sourceAtom;
}
/** Back-compat shim — return the highest-rank level still in `levelsAtom`,
 *  or `"trace"` if the set is empty (so callers always see a valid level). */
function getLevelAtom(): LogLevel {
  for (let i = LEVEL_ORDER.length - 1; i >= 0; i -= 1) {
    const lvl = LEVEL_ORDER[i];
    if (lvl !== undefined && levelsAtom.has(lvl)) return lvl;
  }
  return "trace";
}

/**
 * Non-hook accessor for the current buffer snapshot. Used by the
 * Custom Time-Range Dialog to seed default From/To from the oldest /
 * newest entries without spawning a 2nd hook instance (which would
 * mean a 2nd daemon subscription).
 */
export function getLogsBuffer(): readonly LogEvent[] {
  return buffer;
}

/**
 * Module-level setter for the log-level atom. Exported so
 * `applyLogsFilter()` (use-log-filters.ts) can route a `[Show in Logs →]`
 * toast click to a specific level WITHOUT holding a hook reference.
 *
 * The hook's setLevel callback (returned from useLogsStream()) writes
 * here AND triggers a daemon-side re-subscribe with the new min_level —
 * that path stays inside the hook because it depends on the React
 * lifecycle (mountedRef, subscribeWithRetry). External callers that
 * write through this setter will only update the atom; the hook
 * instance currently mounted observes the change via useSyncExternalStore
 * and re-runs the effect that resubscribes (see useEffect below).
 */
/** Multi-select setter — replace the entire `levels` set. Notifies
 *  on identity change OR contents change (we always notify, callers
 *  filter via useSyncExternalStore identity). */
export function setLevelsAtom(next: ReadonlySet<LogLevel>): void {
  levelsAtom = new Set(next);
  notifyFilters();
}

/** Multi-select setter — replace the entire `crates` set. */
export function setCratesAtom(next: ReadonlySet<string>): void {
  cratesAtom = new Set(next);
  notifyFilters();
}

/** Back-compat shim — set `levels` to {chosen, ...everything-above}. */
export function setLevelAtom(next: LogLevel): void {
  const idx = LEVEL_ORDER.indexOf(next);
  if (idx === -1) return;
  setLevelsAtom(new Set(LEVEL_ORDER.slice(idx)));
}

/** Module-level setter for the peer atom (client-side filter). */
export function setPeerAtom(next: string | null): void {
  if (next === peerAtom) return;
  peerAtom = next;
  notifyFilters();
}

/** Module-level setter for the source atom (client-side filter). */
export function setSourceAtom(next: string | null): void {
  if (next === sourceAtom) return;
  sourceAtom = next;
  notifyFilters();
}

// ─── Module-level subscription lifecycle ───────────────────────────────
//
// App-lifetime singletons: the subscription is created once when the
// daemon enters the "running" state (driven by useLogsSubscription-
// Lifecycle, mounted at AppShell level) and survives every consumer
// hook mount/unmount. Opening / closing the Logs tab incurs no extra
// daemon round-trips.

let fanOutSub: DaemonSubscription | null = null;
let streamStatus: StreamStatus = "idle";
let streamErrorMessage: string | null = null;
let streamErrorStream: "logs" | null = null;
const statusListeners = new Set<() => void>();

function notifyStatus(): void {
  statusListeners.forEach((cb) => cb());
}
function subscribeStatus(cb: () => void): () => void {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}
function getStatus(): StreamStatus {
  return streamStatus;
}
function getErrorMessage(): string | null {
  return streamErrorMessage;
}
function getErrorStream(): "logs" | null {
  return streamErrorStream;
}

function setStatus(next: StreamStatus): void {
  if (next === streamStatus) return;
  streamStatus = next;
  notifyStatus();
}
function setError(message: string | null, stream: "logs" | null): void {
  streamErrorMessage = message;
  streamErrorStream = stream;
  notifyStatus();
}

/**
 * Best-effort error stringification. RpcError travels across the Tauri
 * invoke bridge as a plain `{code, message, data}` object — `String(e)`
 * on that produces "[object Object]", which is exactly the user-facing
 * gibberish we want to avoid. Prefer `.message` when present.
 */
function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e !== null && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    const msg = obj.message;
    if (typeof msg === "string" && msg.length > 0) return msg;
    try {
      return JSON.stringify(e);
    } catch {
      // fall through to String(e) below
    }
  }
  return String(e);
}

function pushEvent(evt: LogEvent): void {
  buffer.unshift(evt);
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES;
  // Discover new crates as events arrive — drives the multi-select
  // dropdown options without requiring a hard-coded list.
  const src = evt.source;
  if (typeof src === "string" && src.length > 0 && !discoveredCratesAtom.has(src)) {
    discoveredCratesAtom.add(src);
    discoveredCratesSnapshot = Array.from(discoveredCratesAtom).sort();
    notifyFilters();
  }
  notifyBuffer();
}

// Subscription is now driven solely by `actions.subscribe("logs.event", …)`
// in `useLogsSubscriptionLifecycle` — that hook's `registerHandler`
// (use-daemon-state.ts) already calls `daemon_subscribe → logs.subscribe`
// on the daemon, so a separate `callDaemon("logs.subscribe", …)` here
// caused the daemon to spawn TWO subscription tasks per UI session,
// each replaying history + forwarding live events to the same
// connection's writer — every log line arrived twice. The daemon's
// `logs.unsubscribe` is a no-op (rpc.rs §5.6), so the redundant
// subscriptions also leak for the connection's lifetime.

// ─── App-level subscription lifecycle ─────────────────────────────────
//
// `useLogsSubscriptionLifecycle()` mounts ONCE at AppShell level and
// owns the JSON-RPC `logs.subscribe` + fan-out lifecycle. It is no
// longer driven by the LogsScreen mount — opening / closing the Logs
// tab now incurs zero round-trips to the daemon. The buffer keeps
// filling in the background regardless of which tab is active, so
// crash diagnostics survive even if the user never opens Logs.
//
// Daemon-state coupling (D-25 honesty): the subscription only makes
// sense while `daemon.state === "running"`. Transitions:
//
//   stopped     → no subscription. status = "idle".
//   starting    → wait — daemon-state will flip to "running" or "error".
//   running     → ensureSubscribed() — replays buffer once, then live.
//   reconnecting→ leave the existing subscription as-is; daemon-state
//                  manages the underlying socket retry.
//   error       → drop subscription markers, status = "idle".

let isLifecycleAttached = false;

export function useLogsSubscriptionLifecycle(): void {
  const { actions, snapshot } = useDaemonState();
  const daemonState = snapshot.state;

  useEffect(() => {
    // Single-instance guard — paranoia. AppShell mounts this hook once,
    // but if a future change accidentally remounts it, we don't want
    // duplicate subscriptions piling up. The lifecycle is global state.
    if (isLifecycleAttached === true) return;
    isLifecycleAttached = true;
    return () => {
      isLifecycleAttached = false;
    };
  }, []);

  useEffect(() => {
    if (daemonState !== "running") {
      // Daemon is not in a state where logs.subscribe makes sense. Try
      // to be polite about server-side cleanup if the socket is still
      // reachable (state === "reconnecting" can briefly co-exist with
      // a live socket); when the daemon is fully gone, the call simply
      // fails silently. Then drop refs so the next "running" transition
      // triggers a fresh fan-out attach.
      const staleFan = fanOutSub;
      fanOutSub = null;
      if (staleFan !== null) {
        staleFan.unsubscribe().catch(() => {});
      }
      setStatus("idle");
      return;
    }

    // Daemon is running — ensure subscribe + fan-out attach. We use a
    // local cancelled flag so an awaiting attach call doesn't write to
    // module state if the daemon flips away from "running" mid-flight.
    // `isCancelled` is a function (rather than `cancelled.current`) so
    // TS doesn't narrow the flag to the false-literal across awaits.
    const cancelled: { current: boolean } = { current: false };
    const isCancelled = (): boolean => cancelled.current;
    setStatus("reconnecting");
    (async () => {
      const attempt = (): Promise<DaemonSubscription> =>
        actions.subscribe("logs.event", pushEvent);
      try {
        const sub = await attempt();
        if (isCancelled()) {
          await sub.unsubscribe().catch(() => {});
          return;
        }
        fanOutSub = sub;
        setStatus("streaming");
        setError(null, null);
      } catch (e1) {
        if (isCancelled()) return;
        await new Promise((r) => setTimeout(r, 500));
        if (isCancelled()) return;
        try {
          const sub = await attempt();
          if (isCancelled()) {
            await sub.unsubscribe().catch(() => {});
            return;
          }
          fanOutSub = sub;
          setStatus("streaming");
          setError(null, null);
        } catch (e2) {
          if (isCancelled()) return;
          console.warn("logs.event fan-out subscribe failed:", e2);
          setStatus("idle");
          setError(describeError(e2), "logs");
        }
      }
    })().catch((e) => {
      console.warn("useLogsSubscriptionLifecycle attach failed:", e);
    });

    return () => {
      // Daemon state changed away from "running" — flip the cancelled
      // flag so any in-flight subscribe-attach noops. The teardown of
      // the existing subscription happens in the daemonState !== "running"
      // branch above when the next effect runs with the new state.
      cancelled.current = true;
    };
  }, [daemonState, actions]);
}

// ─── Hook (consumer-only) ─────────────────────────────────────────────
//
// LogsScreen + any other consumer reads filters + buffer + status from
// here. Mount/unmount NO LONGER drives the daemon subscription — that
// lives in `useLogsSubscriptionLifecycle()` above. Opening or closing
// the Logs tab is now free.

export function useLogsStream(): UseLogsStreamResult {
  const levels = useSyncExternalStore(
    subscribeFilters,
    getLevelsAtom,
    getLevelsAtom,
  );
  const crates = useSyncExternalStore(
    subscribeFilters,
    getCratesAtom,
    getCratesAtom,
  );
  const discoveredCrates = useSyncExternalStore(
    subscribeFilters,
    getDiscoveredCratesSnapshot,
    getDiscoveredCratesSnapshot,
  );
  const level = useSyncExternalStore(
    subscribeFilters,
    getLevelAtom,
    getLevelAtom,
  );
  const peerFilter = useSyncExternalStore(
    subscribeFilters,
    getPeerAtom,
    getPeerAtom,
  );
  const sourceFilter = useSyncExternalStore(
    subscribeFilters,
    getSourceAtom,
    getSourceAtom,
  );

  const status = useSyncExternalStore(subscribeStatus, getStatus, getStatus);
  const errorMessage = useSyncExternalStore(
    subscribeStatus,
    getErrorMessage,
    getErrorMessage,
  );
  const errorStream = useSyncExternalStore(
    subscribeStatus,
    getErrorStream,
    getErrorStream,
  );

  // useSyncExternalStore over the module-level buffer — re-renders this
  // consumer on every push without React state churn elsewhere.
  // The store returns the buffer reference itself; we rely on
  // notifyBuffer firing per-push to trigger re-renders. Since the
  // buffer is mutated in place, we return a snapshot count via the
  // selector to satisfy useSyncExternalStore's identity-stability rule.
  useSyncExternalStore(
    subscribeBuffer,
    () => buffer.length,
    () => buffer.length,
  );

  // Subscription lifecycle no longer lives here — it moved to
  // `useLogsSubscriptionLifecycle()` (mounted once at AppShell level)
  // so opening / closing the Logs tab is a zero-cost transition.

  // All filters are client-side — the daemon receives ALL events
  // (subscribed with min_level=trace + sources=[]) and the UI narrows
  // on render. This makes filter changes instant and avoids re-subscribe
  // churn that would otherwise replay the daemon history buffer on
  // every level toggle.
  const setLevels = useCallback((next: ReadonlySet<LogLevel>) => {
    setLevelsAtom(next);
  }, []);
  const toggleLevel = useCallback((l: LogLevel) => {
    const cur = new Set(levelsAtom);
    if (cur.has(l)) {
      cur.delete(l);
    } else {
      cur.add(l);
    }
    setLevelsAtom(cur);
  }, []);
  const setCrates = useCallback((next: ReadonlySet<string>) => {
    setCratesAtom(next);
  }, []);
  const toggleCrate = useCallback((c: string) => {
    const cur = new Set(cratesAtom);
    if (cur.has(c)) {
      cur.delete(c);
    } else {
      cur.add(c);
    }
    setCratesAtom(cur);
  }, []);
  const setLevel = useCallback((lvl: LogLevel) => {
    setLevelAtom(lvl);
  }, []);
  const setPeerFilter = useCallback((p: string | null) => {
    setPeerAtom(p);
  }, []);
  const setSourceFilter = useCallback((s: string | null) => {
    setSourceAtom(s);
  }, []);

  // Filter chain: levels (multi) → crates (multi) → peer → source (single,
  // for [Show in Logs →] toast routing). Search + time range live in
  // useFilteredLogs and consume `events` from here.
  const filteredEvents: LogEvent[] = buffer.filter((e) => {
    if (!levels.has(e.level)) return false;
    if (crates.size > 0) {
      const matches = Array.from(crates).some((prefix) =>
        e.source.startsWith(prefix),
      );
      if (!matches) return false;
    }
    if (peerFilter !== null && e.peer_id !== peerFilter) return false;
    if (sourceFilter !== null && e.source !== sourceFilter) return false;
    return true;
  });

  return {
    events: filteredEvents,
    allEvents: buffer,
    levels,
    setLevels,
    toggleLevel,
    crates,
    setCrates,
    toggleCrate,
    discoveredCrates,
    level,
    setLevel,
    peerFilter,
    setPeerFilter,
    sourceFilter,
    setSourceFilter,
    status,
    errorMessage,
    errorStream,
  };
}
