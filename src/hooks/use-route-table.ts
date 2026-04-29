/**
 * Phase 4 D-18: useRouteTable — one-shot fetch + status.event-driven
 * refetch.
 *
 * W1 contract: this hook DOES NOT register a Tauri event subscription.
 * It joins the existing fan-out via `useDaemonState().actions.subscribe`,
 * which the W1 owner (`use-daemon-state.ts`) routes through its single
 * `eventHandlers` map. After this file lands:
 *   - `rpc.ts` still owns zero Tauri subscriptions
 *   - `use-daemon-state.ts` still owns exactly two
 *   - `use-route-table.ts` itself owns zero (no `lis` + `ten(` calls)
 *
 * Refetch trigger kinds (D-19): `route_on`, `route_off`,
 * `gateway_selected`, `gateway_lost`, `kill_switch`. `peers.event` is
 * intentionally excluded — peer flap does not change the routing table
 * from the daemon's POV until route advertisements catch up, which
 * produces a `gateway_*` / `route_*` event of its own.
 *
 * D-20 escape hatch: `refetch()` is exported so a consumer (the
 * Routing tab's RouteTable panel header in 04-03) can render a
 * `[ refresh ]` button when the daemon misses an event.
 *
 * Refcount + shared module-level state mirror `usePeerTroubleshootLog`
 * (Phase 2 02-04): only one subscription is held regardless of how
 * many components mount the hook; the last consumer to unmount tears
 * down. RPC errors land in `sharedError`; the consumer renders an
 * inline `couldn't load routes · {message}` row and calls `refetch()`
 * to retry.
 *
 * Bang-free per D-36 — every conditional uses `=== false` / `=== null`.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useDaemonState } from "./use-daemon-state";
import { callDaemon, type DaemonSubscription } from "@/lib/rpc";
import type {
  RouteTableResult,
  RpcError,
  StatusEvent,
  StatusEventKind,
} from "@/lib/rpc-types";

export interface UseRouteTableResult {
  /** Last-known route table; null until the first fetch resolves. */
  table: RouteTableResult | null;
  /** True while a fetch is in flight (initial mount or a refetch). */
  loading: boolean;
  /** Last RPC error from `route.table`; null after a successful fetch. */
  error: RpcError | null;
  /** Force a re-fetch of `route.table`. Used by the [ refresh ] escape hatch (D-20). */
  refetch: () => Promise<void>;
}

// ─── Module-level shared state (refcounted, mirrors usePeerTroubleshootLog) ──

let refcount = 0;
let unsubscribe: (() => Promise<void>) | null = null;
// Tracks the in-flight subscribe Promise. Without this, a cleanup that fires
// before the subscribe resolves (StrictMode dev double-mount, fast remount)
// would leave the wrapped handler in `eventHandlers` permanently — every
// subsequent status.event then calls a leaked handler, which calls doFetch,
// which calls notifyAll, which forces a re-render, which (combined with the
// stable-actions fix) used to re-fire this effect and stack ANOTHER leak.
// Stable actions stops the re-fire loop; this flag plugs the residual leak.
let pendingSubscribe: Promise<DaemonSubscription> | null = null;
let sharedTable: RouteTableResult | null = null;
let sharedError: RpcError | null = null;
let sharedLoading = false;
const subscribers = new Set<() => void>();

function notifyAll(): void {
  subscribers.forEach((fn) => fn());
}

/**
 * D-19: only these kinds force a refetch. Other status.event kinds
 * (`interface_up`, `interface_down`, `role_changed`) are ignored.
 */
const REFETCH_KINDS: ReadonlySet<StatusEventKind> = new Set<StatusEventKind>([
  "route_on",
  "route_off",
  "gateway_selected",
  "gateway_lost",
  "kill_switch",
]);

function normaliseRpcError(e: unknown): RpcError {
  if (e !== null && typeof e === "object" && "code" in e && "message" in e) {
    return e as RpcError;
  }
  return {
    code: -32603, // InternalError
    message: e instanceof Error ? e.message : String(e),
  };
}

async function doFetch(): Promise<void> {
  sharedLoading = true;
  sharedError = null;
  notifyAll();
  try {
    const t = await callDaemon("route.table", null);
    sharedTable = t;
    sharedLoading = false;
    notifyAll();
  } catch (e) {
    sharedError = normaliseRpcError(e);
    sharedLoading = false;
    notifyAll();
  }
}

// ─── Public hook ────────────────────────────────────────────────────

/**
 * D-18: subscribe to the route table. Call from any component that
 * needs `RouteTableResult`; the module-level refcount guarantees a
 * single fetch + a single fan-out handler regardless of consumer count.
 */
export function useRouteTable(): UseRouteTableResult {
  const { actions } = useDaemonState();
  const [, force] = useState(0);
  const tickRef = useRef(0);

  useEffect(() => {
    const sub = (): void => {
      tickRef.current = tickRef.current + 1;
      force((n) => n + 1);
    };
    subscribers.add(sub);
    refcount = refcount + 1;
    if (refcount === 1) {
      // First consumer: fetch and subscribe (joins W1 fan-out).
      void doFetch();
      const p = actions.subscribe("status.event", (evt: StatusEvent) => {
        if (REFETCH_KINDS.has(evt.kind) === true) {
          void doFetch();
        }
      });
      pendingSubscribe = p;
      void p
        .then((s) => {
          if (pendingSubscribe === p) {
            // Still the most recent subscribe — promote to module-level handle.
            unsubscribe = s.unsubscribe;
            pendingSubscribe = null;
          } else {
            // A newer subscribe took over (StrictMode or fast remount race) —
            // tear THIS one down so the handler set doesn't grow.
            void s.unsubscribe().catch(() => {});
          }
        })
        .catch((e) => {
          if (pendingSubscribe === p) pendingSubscribe = null;
          // Subscribe failure is recoverable: route.table still works,
          // refetch via [ refresh ] button is the escape hatch (D-20).
          // Surface as a warning; do not poison sharedError because the
          // consumer's error UI is for route.table failures only.
          console.warn("useRouteTable subscribe failed:", e);
        });
    }
    return () => {
      subscribers.delete(sub);
      refcount = refcount - 1;
      if (refcount === 0) {
        if (unsubscribe !== null) {
          const u = unsubscribe;
          unsubscribe = null;
          u().catch(() => {});
        } else if (pendingSubscribe !== null) {
          // Subscribe still in flight when the last consumer left — chain
          // the unsubscribe onto its resolution so the wrapped handler
          // doesn't leak in `eventHandlers`.
          const p = pendingSubscribe;
          pendingSubscribe = null;
          void p.then((s) => s.unsubscribe()).catch(() => {});
        }
        sharedTable = null;
        sharedError = null;
        sharedLoading = false;
      }
    };
  }, [actions]);

  const refetch = useCallback(() => doFetch(), []);

  return {
    table: sharedTable,
    loading: sharedLoading,
    error: sharedError,
    refetch,
  };
}

/** Exposed for tests to reset module state between cases. */
export const __test_resetRouteTable = (): void => {
  refcount = 0;
  unsubscribe = null;
  pendingSubscribe = null;
  sharedTable = null;
  sharedError = null;
  sharedLoading = false;
  subscribers.clear();
};
