/**
 * useLogsStream — Logs tab subscription lifecycle + in-memory ring buffer
 * + filter state.
 *
 * Subscription lifecycle (02-CONTEXT §D-25):
 *   - On mount: callDaemon("logs.subscribe", { min_level, sources: [] })
 *     to request server-side forwarding, store subscription_id, then
 *     register a fan-out handler on useDaemonState.actions.subscribe for
 *     event name "logs.event" (no new Tauri listener — W1 preserved).
 *   - Each incoming LogEvent prepends onto a module-local ring buffer
 *     capped at MAX_ENTRIES (2000, drop-oldest).
 *   - On unmount: callDaemon("logs.unsubscribe", { subscription_id }) and
 *     remove the fan-out handler.
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
import { callDaemon, type DaemonSubscription } from "@/lib/rpc";
import type { LogEvent, LogLevel } from "@/lib/rpc-types";

export type StreamStatus = "streaming" | "paused" | "reconnecting" | "idle";

export interface UseLogsStreamResult {
  /** Visible slice after applying peer + source filters (level is server-side). */
  events: LogEvent[];
  /** Full ring buffer (capped at MAX_ENTRIES, newest-first). */
  allEvents: LogEvent[];
  level: LogLevel;
  /** Triggers server-side re-subscribe with the new min_level. */
  setLevel: (l: LogLevel) => void;
  /** node_id to filter by, or null for "(all)". */
  peerFilter: string | null;
  setPeerFilter: (p: string | null) => void;
  /** Phase 3: source module name (e.g. "config") or null for "(all)". */
  sourceFilter: string | null;
  setSourceFilter: (s: string | null) => void;
  status: StreamStatus;
  /** D-31 error message; non-null when retry-once exhausted. */
  errorMessage: string | null;
  /** D-31 stream label, surfaced for the toast that Plan 02-06 renders. */
  errorStream: "logs" | null;
}

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

let levelAtom: LogLevel = "info";
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
function getLevelAtom(): LogLevel {
  return levelAtom;
}
function getPeerAtom(): string | null {
  return peerAtom;
}
function getSourceAtom(): string | null {
  return sourceAtom;
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
export function setLevelAtom(next: LogLevel): void {
  if (next === levelAtom) return;
  levelAtom = next;
  notifyFilters();
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
// Reference-counted: the daemon-side logs.subscribe runs once on the
// first hook mount (or first non-hook call to acquireSubscription) and
// tears down on the last unmount. This lets multiple components mount
// useLogsStream simultaneously without spawning duplicate subscriptions.

let mountCount = 0;
let subscriptionId: string | null = null;
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

function pushEvent(evt: LogEvent): void {
  buffer.unshift(evt);
  if (buffer.length > MAX_ENTRIES) buffer.length = MAX_ENTRIES;
  notifyBuffer();
}

/**
 * D-25 subscribe helper with D-31 retry-once. Unsubscribes any existing
 * daemon subscription first (level-change path), then attempts a fresh
 * logs.subscribe. On first failure waits 500 ms and retries. On second
 * failure stores errorMessage + status="idle" on the module atoms; the
 * caller's error surface (Plan 02-06 toast) reads them via the hook.
 */
async function resubscribeLogs(lvl: LogLevel): Promise<void> {
  setStatus("reconnecting");

  const prior = subscriptionId;
  if (prior !== null) {
    subscriptionId = null;
    try {
      await callDaemon("logs.unsubscribe", { subscription_id: prior });
    } catch (e) {
      console.warn("logs.unsubscribe (prior) failed:", e);
    }
  }

  const attempt = async (): Promise<void> => {
    const res = await callDaemon("logs.subscribe", {
      min_level: lvl,
      sources: [],
    });
    subscriptionId = res.subscription_id;
  };

  try {
    await attempt();
    if (mountCount === 0) {
      // Last consumer unmounted while we were subscribing; clean up.
      const id = subscriptionId;
      subscriptionId = null;
      if (id !== null) {
        callDaemon("logs.unsubscribe", { subscription_id: id }).catch((e) =>
          console.warn("logs.unsubscribe (late) failed:", e),
        );
      }
      return;
    }
    setStatus("streaming");
    setError(null, null);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    if (mountCount === 0) return;
    try {
      await attempt();
      if (mountCount === 0) {
        const id = subscriptionId;
        subscriptionId = null;
        if (id !== null) {
          callDaemon("logs.unsubscribe", { subscription_id: id }).catch((e) =>
            console.warn("logs.unsubscribe (late) failed:", e),
          );
        }
        return;
      }
      setStatus("streaming");
      setError(null, null);
    } catch (e2) {
      setStatus("idle");
      setError(e2 instanceof Error ? e2.message : String(e2), "logs");
    }
  }
}

// React when level atom changes — resubscribe daemon-side. This watcher
// runs at module scope so mid-life level changes (from setLevelAtom
// called by applyLogsFilter, or from the hook's setLevel) both end up
// here. The watcher is registered exactly once via the first mount.
let levelWatcherUnsub: (() => void) | null = null;
let lastSubscribedLevel: LogLevel | null = null;

function ensureLevelWatcher(): void {
  if (levelWatcherUnsub !== null) return;
  lastSubscribedLevel = levelAtom;
  levelWatcherUnsub = subscribeFilters(() => {
    if (mountCount === 0) return;
    if (levelAtom === lastSubscribedLevel) return;
    lastSubscribedLevel = levelAtom;
    void resubscribeLogs(levelAtom);
  });
}

// ─── Hook ──────────────────────────────────────────────────────────────

export function useLogsStream(): UseLogsStreamResult {
  const { actions } = useDaemonState();
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

  // Mount/unmount: reference-count the daemon subscription. First mount
  // subscribes daemon-side, registers fan-out handler on "logs.event",
  // and starts the level watcher. Last unmount tears everything down.
  useEffect(() => {
    mountCount += 1;
    let didMount = true;

    if (mountCount === 1) {
      ensureLevelWatcher();
      void resubscribeLogs(levelAtom);
      (async () => {
        try {
          fanOutSub = await actions.subscribe("logs.event", pushEvent);
          // mountCount is mutated by other hook instances' cleanup
          // callbacks while this async closure awaits — read it through
          // a cast so TS doesn't narrow it to the literal `1` from the
          // enclosing branch.
          const liveCount = mountCount as number;
          if (liveCount === 0 && fanOutSub !== null) {
            const sub = fanOutSub;
            fanOutSub = null;
            sub.unsubscribe().catch(() => {});
          }
        } catch (e) {
          console.warn("logs.event fan-out subscribe failed:", e);
          setStatus("idle");
          setError(e instanceof Error ? e.message : String(e), "logs");
        }
      })().catch((e) => {
        console.warn("useLogsStream mount failed:", e);
      });
    }

    return () => {
      if (didMount === false) return;
      didMount = false;
      mountCount -= 1;
      if (mountCount === 0) {
        const fan = fanOutSub;
        fanOutSub = null;
        if (fan !== null) {
          fan.unsubscribe().catch((e) =>
            console.warn("logs fan-out unsubscribe failed:", e),
          );
        }
        const id = subscriptionId;
        subscriptionId = null;
        if (id !== null) {
          callDaemon("logs.unsubscribe", { subscription_id: id }).catch((e) =>
            console.warn("logs.unsubscribe (unmount) failed:", e),
          );
        }
        if (levelWatcherUnsub !== null) {
          levelWatcherUnsub();
          levelWatcherUnsub = null;
        }
        lastSubscribedLevel = null;
        setStatus("idle");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * D-26 level-change path: re-subscribe daemon-side so `min_level`
   * reflects the new choice. Peer + source filters are client-side and
   * do NOT touch the subscription.
   */
  const setLevel = useCallback((lvl: LogLevel) => {
    setLevelAtom(lvl);
  }, []);
  const setPeerFilter = useCallback((p: string | null) => {
    setPeerAtom(p);
  }, []);
  const setSourceFilter = useCallback((s: string | null) => {
    setSourceAtom(s);
  }, []);

  // D-26 + Phase 3: peer + source filters applied client-side on each
  // consumer render. Search + time range filters live in
  // useFilteredLogs (use-log-filters.ts) — those consume `events` and
  // apply their own filter chain so this hook stays focused on the
  // server-side level + peer/source client filter.
  const filteredEvents: LogEvent[] = buffer.filter((e) => {
    if (peerFilter !== null && e.peer_id !== peerFilter) return false;
    if (sourceFilter !== null && e.source !== sourceFilter) return false;
    return true;
  });

  return {
    events: filteredEvents,
    allEvents: buffer,
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
