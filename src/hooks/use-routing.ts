/**
 * Phase 4 D-30: Routing selector hooks.
 *
 * Three thin selectors over `useDaemonState`. NO new snapshot fields,
 * NO subscription churn — every Phase 4 routing surface derives its
 * UI state from existing `snapshot.status` fields exclusively.
 *
 * Pattern mirrors `useStatus` / `usePeers` / `useDiscovered` (Phase 2
 * Plan 01): one-line selector, returns nullable, no `useMemo`. React
 * 19's compiler handles downstream memoization.
 *
 * Bang-free per D-36: every conditional uses `=== false` / `=== null`
 * instead of the JS negation operator. The hook does not subscribe to
 * any Tauri event; W1 invariants in `rpc.ts` (zero subscriptions) and
 * `use-daemon-state.ts` (the two owned subscriptions) are unaffected
 * by this file.
 */

import type { PeerSummary } from "@/lib/rpc-types";
import { useDaemonState } from "./use-daemon-state";

/**
 * D-30: `route_on` selector. True when the daemon snapshot reports
 * split-default routing is active. Returns false until the first
 * snapshot lands (Phase-1 Plan 03 invariant — no placeholder data).
 */
export function useRouteOn(): boolean {
  const s = useDaemonState().snapshot.status;
  if (s === null) return false;
  return s.route_on === true;
}

/**
 * Selected gateway lookup result.
 *
 * - `id` — the daemon's `routes.selected_gateway` (peer node_id), or null
 *   when no gateway is selected (or status not yet loaded).
 * - `peer` — the matching `PeerSummary` from `status.peers` if the gateway
 *   is in the local peer list. May be null when the gateway is multi-hop
 *   and not directly connected.
 */
export interface SelectedGatewayResult {
  id: string | null;
  peer: PeerSummary | null;
}

/**
 * D-30: selected-gateway selector. Returns the node_id and peer record
 * (when locally known) for the gateway the daemon currently routes
 * through. The peer may be null when the gateway is reachable through
 * a relay but is not itself a direct peer.
 */
export function useSelectedGateway(): SelectedGatewayResult {
  const s = useDaemonState().snapshot.status;
  if (s === null) return { id: null, peer: null };
  const id = s.routes.selected_gateway;
  if (id === null) return { id: null, peer: null };
  const peer = s.peers.find((p) => p.node_id === id) ?? null;
  return { id, peer };
}

/**
 * D-30 + D-21: kill-switch derived state. True when split-default
 * routing is on AND the daemon has no selected gateway — i.e. pim is
 * actively blocking internet because the gateway is unreachable.
 *
 * This is purely derived; the `kill_switch` `status.event` (handled by
 * `useDaemonState` per D-31) is defensive — it ensures
 * `selected_gateway === null`, so this selector picks up the truth on
 * the same render.
 */
export function useKillSwitch(): boolean {
  const s = useDaemonState().snapshot.status;
  if (s === null) return false;
  if (s.route_on === false) return false;
  return s.routes.selected_gateway === null;
}
