/**
 * useGatewayPreflight — owns the gateway.preflight call lifecycle.
 *
 * Plan 05-02 (D-43): pre-flight reject (-32030 GatewayPreflightFailed)
 * surfaces the error inline above [ Re-run pre-flight ] in destructive
 * font-code text — NO toast, because pre-flight failures are tab-scoped.
 *
 * On Plan 05-01's GatewayScreen mount, the hook fires one
 * callDaemon("gateway.preflight", null). It does NOT subscribe to any
 * event stream — pre-flight is a synchronous one-shot in the daemon's
 * RPC contract.
 *
 * Refetch is the ONLY way to re-run; we do NOT auto-refresh on
 * status.event because pre-flight is stable for a daemon process
 * lifetime (capabilities and binary presence don't change without an
 * external action). Plan 05-03 calls refetch() after gateway.disable
 * so the panel returns to the pre-flight-passing state.
 *
 * W1 invariant preserved — zero new Tauri-side subscriptions in this file.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { callDaemon } from "@/lib/rpc";
import { useDaemonState } from "@/hooks/use-daemon-state";
import type { GatewayPreflightResult, RpcError } from "@/lib/rpc-types";

export interface UseGatewayPreflightResult {
  result: GatewayPreflightResult | null;
  loading: boolean;
  error: RpcError | null;
  refetch: () => Promise<void>;
}

export function useGatewayPreflight(): UseGatewayPreflightResult {
  const { snapshot } = useDaemonState();
  const [result, setResult] = useState<GatewayPreflightResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<RpcError | null>(null);
  const inFlightRef = useRef<boolean>(false);

  const fetchPreflight = useCallback(async () => {
    if (inFlightRef.current === true) return;
    inFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await callDaemon("gateway.preflight", null);
      setResult(res);
    } catch (e) {
      // RpcError shape from rpc.ts; preserve verbatim for inline render
      setError(e as RpcError);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  // One-shot on mount when the daemon is running. If the daemon is not
  // running, the hook stays { result: null, loading: false } — the
  // GatewayScreen then defers to LimitedModeBanner-style copy from
  // existing Phase 1 chrome.
  useEffect(() => {
    if (snapshot.state === "running" && result === null && loading === false) {
      void fetchPreflight();
    }
    // Intentionally narrow deps — only re-run on state transitions to running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.state]);

  return { result, loading, error, refetch: fetchPreflight };
}
