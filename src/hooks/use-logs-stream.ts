/**
 * useLogsStream — Logs tab subscription lifecycle + in-memory ring buffer
 * + level/peer filter state.
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
 * Filter semantics (02-CONTEXT §D-26):
 *   - Level filter (trace/debug/info/warn/error) is SERVER-SIDE — changing
 *     it unsubscribes the old stream and resubscribes with the new
 *     min_level. The daemon honours min_level as a `>=` gate.
 *   - Peer filter is CLIENT-SIDE — the daemon's `sources` parameter is
 *     module-based (e.g. "transport", "discovery"), not peer-based. We
 *     filter `event.peer_id === peerFilter` on the buffer before return.
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

import { useCallback, useEffect, useRef, useState } from "react";
import { useDaemonState } from "./use-daemon-state";
import { callDaemon, type DaemonSubscription } from "@/lib/rpc";
import type { LogEvent, LogLevel } from "@/lib/rpc-types";

export type StreamStatus = "streaming" | "paused" | "reconnecting" | "idle";

export interface UseLogsStreamResult {
  /** Visible slice after applying the peer filter (level is server-side). */
  events: LogEvent[];
  /** Full ring buffer (capped at MAX_ENTRIES, newest-first). */
  allEvents: LogEvent[];
  level: LogLevel;
  /** Triggers server-side re-subscribe with the new min_level. */
  setLevel: (l: LogLevel) => void;
  /** node_id to filter by, or null for "(all)". */
  peerFilter: string | null;
  setPeerFilter: (p: string | null) => void;
  status: StreamStatus;
  /** D-31 error message; non-null when retry-once exhausted. */
  errorMessage: string | null;
  /** D-31 stream label, surfaced for the toast that Plan 02-06 renders. */
  errorStream: "logs" | null;
}

const MAX_ENTRIES = 2000;

export function useLogsStream(): UseLogsStreamResult {
  const { actions } = useDaemonState();
  const [level, setLevelState] = useState<LogLevel>("info");
  const [peerFilter, setPeerFilter] = useState<string | null>(null);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorStream, setErrorStream] = useState<"logs" | null>(null);

  // Mutable ring buffer — avoids React state churn on high-volume events.
  // Consumers get a stable reference via `bufferRef.current`; we bump
  // `bumpCounter` to trigger a re-render per event so useSyncExternalStore-
  // free consumers (including this hook itself) pick up the change.
  const bufferRef = useRef<LogEvent[]>([]);
  const [, setBumpCounter] = useState(0);
  const bumpRender = useCallback(() => {
    setBumpCounter((n) => n + 1);
  }, []);

  const subscriptionIdRef = useRef<string | null>(null);
  const fanOutSubRef = useRef<DaemonSubscription | null>(null);
  // Wrap in a { value } object so TS doesn't narrow the ref's current
  // field to a literal `true` / `false` inside async closures.
  const mountedRef = useRef<{ value: boolean }>({ value: false });
  const isMounted = () => mountedRef.current.value;

  /**
   * D-25 subscribe helper with D-31 retry-once. Unsubscribes any
   * existing subscription first (level-change path), then attempts a
   * fresh logs.subscribe. On first failure waits 500 ms and retries.
   * On second failure sets errorMessage + status="idle"; the caller's
   * error surface (Plan 02-06 toast) reads errorMessage / errorStream.
   */
  const subscribeWithRetry = useCallback(
    async (lvl: LogLevel) => {
      if (isMounted() === false) return;
      setStatus("reconnecting");

      // Tear down prior daemon subscription (level-change path only).
      const prior = subscriptionIdRef.current;
      if (prior !== null) {
        subscriptionIdRef.current = null;
        try {
          await callDaemon("logs.unsubscribe", { subscription_id: prior });
        } catch (e) {
          // Non-fatal — daemon may have already cleared state.
          console.warn("logs.unsubscribe (prior) failed:", e);
        }
      }

      if (isMounted() === false) return;

      const attempt = async (): Promise<void> => {
        const res = await callDaemon("logs.subscribe", {
          min_level: lvl,
          sources: [],
        });
        subscriptionIdRef.current = res.subscription_id;
      };

      try {
        await attempt();
        if (isMounted() === false) {
          // Component unmounted mid-flight — tidy up.
          const id = subscriptionIdRef.current;
          subscriptionIdRef.current = null;
          if (id !== null) {
            callDaemon("logs.unsubscribe", { subscription_id: id }).catch(
              (e) => console.warn("logs.unsubscribe (late) failed:", e),
            );
          }
          return;
        }
        setStatus("streaming");
        setErrorMessage(null);
        setErrorStream(null);
      } catch {
        // D-31 retry-once: 500 ms backoff, single retry.
        await new Promise((r) => setTimeout(r, 500));
        if (isMounted() === false) return;
        try {
          await attempt();
          if (isMounted() === false) {
            const id = subscriptionIdRef.current;
            subscriptionIdRef.current = null;
            if (id !== null) {
              callDaemon("logs.unsubscribe", { subscription_id: id }).catch(
                (e) => console.warn("logs.unsubscribe (late) failed:", e),
              );
            }
            return;
          }
          setStatus("streaming");
          setErrorMessage(null);
          setErrorStream(null);
        } catch (e2) {
          setStatus("idle");
          setErrorMessage(e2 instanceof Error ? e2.message : String(e2));
          setErrorStream("logs");
        }
      }
    },
    [],
  );

  // Mount: subscribe daemon-side, register fan-out handler on
  // "logs.event". Unmount: unsubscribe both.
  useEffect(() => {
    mountedRef.current.value = true;
    let localSub: DaemonSubscription | null = null;

    const handler = (evt: LogEvent): void => {
      const buf = bufferRef.current;
      buf.unshift(evt);
      if (buf.length > MAX_ENTRIES) buf.length = MAX_ENTRIES;
      bumpRender();
    };

    (async () => {
      await subscribeWithRetry(level);
      if (isMounted() === false) return;
      try {
        localSub = await actions.subscribe("logs.event", handler);
        if (isMounted() === false) {
          localSub.unsubscribe().catch(() => {});
          localSub = null;
          return;
        }
        fanOutSubRef.current = localSub;
      } catch (e) {
        console.warn("logs.event fan-out subscribe failed:", e);
        // Fan-out failure still surfaces as a subscription error so the
        // caller can render the same toast path.
        setStatus("idle");
        setErrorMessage(e instanceof Error ? e.message : String(e));
        setErrorStream("logs");
      }
    })().catch((e) => {
      console.warn("useLogsStream mount failed:", e);
    });

    return () => {
      mountedRef.current.value = false;
      const fan = fanOutSubRef.current;
      fanOutSubRef.current = null;
      if (fan !== null) {
        fan.unsubscribe().catch((e) =>
          console.warn("logs fan-out unsubscribe failed:", e),
        );
      }
      const id = subscriptionIdRef.current;
      subscriptionIdRef.current = null;
      if (id !== null) {
        callDaemon("logs.unsubscribe", { subscription_id: id }).catch((e) =>
          console.warn("logs.unsubscribe (unmount) failed:", e),
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * D-26 level-change path: re-subscribe daemon-side so `min_level`
   * reflects the new choice. Peer filter is client-side and does NOT
   * touch the subscription.
   */
  const setLevel = useCallback(
    (lvl: LogLevel) => {
      setLevelState(lvl);
      void subscribeWithRetry(lvl);
    },
    [subscribeWithRetry],
  );

  // D-26 peer filter applied client-side on each consumer render.
  const filteredEvents: LogEvent[] =
    peerFilter === null
      ? bufferRef.current
      : bufferRef.current.filter((e) => e.peer_id === peerFilter);

  return {
    events: filteredEvents,
    allEvents: bufferRef.current,
    level,
    setLevel,
    peerFilter,
    setPeerFilter,
    status,
    errorMessage,
    errorStream,
  };
}
