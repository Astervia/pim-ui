/**
 * useBroadcast — wrapper around the `peers.broadcast_*` RPCs that
 * keeps a reactive copy of `BroadcastState` for the Messages-screen
 * control panel.
 *
 * Polling cadence is intentionally slow (10s) — broadcast is a coarse
 * signal and we don't yet have a dedicated event channel for it. The
 * `now()` and `update()` actions force-refresh the state so the
 * panel feels responsive after a user-initiated change.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callDaemon } from "@/lib/rpc";
import type {
  BroadcastState,
  PeersSetBroadcastConfigParams,
} from "@/lib/rpc-types";

const POLL_INTERVAL_MS = 10_000;

export interface UseBroadcastResult {
  state: BroadcastState | null;
  /** True while the very first state fetch is pending. */
  loading: boolean;
  /** Last error (RPC failure, etc.). Cleared on the next successful fetch. */
  error: string | null;
  /** Fire one immediate broadcast cycle; returns recipient count. */
  now: () => Promise<number>;
  /** Apply a partial config update; resolves with the new state. */
  update: (patch: PeersSetBroadcastConfigParams) => Promise<BroadcastState>;
  /** Force a re-fetch (used after the user opens the panel). */
  refresh: () => Promise<void>;
}

export function useBroadcast(): UseBroadcastResult {
  const [state, setState] = useState<BroadcastState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await callDaemon("peers.get_broadcast_state", null);
      if (!mountedRef.current) return;
      setState(next);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mountedRef.current === true) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [refresh]);

  const now = useCallback(async (): Promise<number> => {
    const r = await callDaemon("peers.broadcast_identity_now", null);
    void refresh();
    return r.recipients;
  }, [refresh]);

  const update = useCallback(
    async (patch: PeersSetBroadcastConfigParams): Promise<BroadcastState> => {
      const next = await callDaemon("peers.set_broadcast_config", patch);
      if (mountedRef.current === true) {
        setState(next);
        setError(null);
      }
      return next;
    },
    [],
  );

  return useMemo(
    () => ({ state, loading, error, now, update, refresh }),
    [state, loading, error, now, update, refresh],
  );
}
