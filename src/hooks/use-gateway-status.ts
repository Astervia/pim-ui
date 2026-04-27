/**
 * useGatewayStatus — owns the gateway.status RPC + gateway.event subscription.
 *
 * 05-CONTEXT D-16: subscription wires through actions.subscribe('gateway.event',
 * handler) — same fan-out pattern as status.event / peers.event / logs.event.
 * ZERO new Tauri-side subscriptions in this file (W1 invariant per STATE.md row 7).
 *
 * RESEARCH §5e fallback: if the kernel rejects the speculative gateway.event
 * stream, this hook ships a TBD-RPC-FALLBACK polling path (1Hz callDaemon)
 * gated by a const flag. The path is OFF by default; flipping the flag is a
 * one-line change. Polling is tab-scoped (active only while the Gateway tab
 * is mounted), so it does not violate the daemon-as-source-of-truth-via-events
 * principle app-wide.
 *
 * Plan 05-07 audit grep-counts the TBD-RPC-FALLBACK marker.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { callDaemon, type DaemonSubscription } from "@/lib/rpc";
import { useDaemonState } from "@/hooks/use-daemon-state";
import type {
  GatewayStatusResult,
  GatewayEvent,
  RpcError,
} from "@/lib/rpc-types";

// TBD-RPC-FALLBACK (RESEARCH §5e): set to true if the kernel rejects
// gateway.event. Tab-scoped 1Hz polling becomes the data source.
// Plan 05-07 audit grep-counts this marker.
//
// Annotated as `boolean` (not narrowed to `false`) so the dead-branch
// fallback path still typechecks — flipping the literal flips behavior
// without touching this annotation. One-line change per RESEARCH §5e.
const POLLING_FALLBACK: boolean = false;
const POLLING_INTERVAL_MS = 1000;

export interface UseGatewayStatusOptions {
  /** Gate the hook (e.g. only mount when platform === 'linux'). Default true. */
  enabled?: boolean;
}

export interface UseGatewayStatusResult {
  status: GatewayStatusResult | null;
  loading: boolean;
  error: RpcError | null;
  refetch: () => Promise<void>;
  /** [ Turn off gateway mode ] click handler — calls gateway.disable then refetches. */
  disable: () => Promise<void>;
}

export function useGatewayStatus(
  opts: UseGatewayStatusOptions = {},
): UseGatewayStatusResult {
  const enabled = opts.enabled === false ? false : true; // default true
  const { snapshot, actions } = useDaemonState();
  const [status, setStatus] = useState<GatewayStatusResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<RpcError | null>(null);
  const subRef = useRef<DaemonSubscription | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    if (snapshot.state === "running") {
      setLoading(true);
      setError(null);
      try {
        const res = await callDaemon("gateway.status", null);
        setStatus(res);
      } catch (e) {
        setError(e as RpcError);
      } finally {
        setLoading(false);
      }
    }
  }, [snapshot.state]);

  const disable = useCallback(async () => {
    try {
      await callDaemon("gateway.disable", null);
      // Re-fetch — daemon now reports active: false; the parent screen
      // returns to pre-flight via Plan 05-02 branches.
      await fetchStatus();
    } catch (e) {
      setError(e as RpcError);
    }
  }, [fetchStatus]);

  // Mount: one-shot fetch + subscribe (or polling fallback)
  useEffect(() => {
    if (enabled === false) return;
    if (snapshot.state === "running") {
      // `alive` is mutated by the cleanup closure below. The `unknown` cast
      // on the comparison sidesteps TS's narrowing of the initial `true`
      // literal so the runtime cleanup-guard typechecks.
      let alive = true;
      let localSub: DaemonSubscription | null = null;

      (async () => {
        await fetchStatus();
        if ((alive as boolean) === false) return;

        if (POLLING_FALLBACK === true) {
          // TBD-RPC-FALLBACK: 1Hz polling while the tab is mounted.
          pollTimerRef.current = setInterval(() => {
            void fetchStatus();
          }, POLLING_INTERVAL_MS);
        } else {
          // W1 fan-out subscription — no new Tauri-side subscription here;
          // actions.subscribe registers in the existing fan-out map and asks
          // Rust to forward the stream via subscribeDaemon.
          localSub = await actions.subscribe<"gateway.event">(
            "gateway.event",
            (evt: GatewayEvent) => {
              // On any gateway.event, re-fetch the canonical status.
              // We could merge per-kind, but a fresh fetch keeps the UI
              // honest with daemon-as-source-of-truth (P3) and avoids
              // local merge bugs at this stage.
              void fetchStatus();
              // throughput_sample carries the sample inline; we still re-fetch
              // because the event payload is best-effort and the canonical
              // numerator/denominator pair lives on the status RPC.
              void evt;
            },
          );
          subRef.current = localSub;
        }
      })().catch((e) => {
        setError(e as RpcError);
      });

      return () => {
        alive = false;
        if (pollTimerRef.current === null) {
          // no-op
        } else {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        if (localSub === null) {
          // no-op
        } else {
          void localSub.unsubscribe().catch(() => {});
        }
        subRef.current = null;
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, snapshot.state]);

  return { status, loading, error, refetch: fetchStatus, disable };
}
