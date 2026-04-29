/**
 * useRelayContribution — Phase 6 Plan 06-02.
 *
 * Selector that combines `useStatus()` (for role + cumulative forwarding
 * counters) with `useRouteTable()` (to derive how many peers use this
 * node as a next-hop relay) into a single shape consumable by the
 * Dashboard `<RelayContributionPanel />` and the simple-mode "you're a
 * relay · helping N" line.
 *
 * Why client-side derivation: the daemon's `Status.stats.forwarded_*`
 * counters are cumulative bytes/packets but do NOT expose a "peers
 * routing through me" metric directly. Until the kernel adds a
 * `peers_via_me` field to `Status`, we count distinct destinations in
 * `route.table` whose `via` is our own `node_id`. Behaviour matches:
 * each peer that learned a path through this node contributes exactly
 * one route entry with `via === our.node_id`.
 *
 * W1 invariant: this hook only reads from `useStatus` and
 * `useRouteTable`, both of which join the existing W1 fan-out via
 * `useDaemonState().actions.subscribe`. No new `listen()` is added.
 */

import type { RouteTableResult, Status } from "@/lib/rpc-types";
import { useStatus } from "@/hooks/use-status";
import { useRouteTable } from "@/hooks/use-route-table";

export interface RelayContribution {
  /** True when `Status.role` includes `"relay"`. */
  active: boolean;
  /** Distinct destinations whose next-hop is this node's `node_id`. */
  peersViaMe: number;
  /** Cumulative forwarded packet count (Status.stats.forwarded_packets). */
  packetsForwarded: number;
  /** Cumulative forwarded byte count (Status.stats.forwarded_bytes). */
  bytesForwarded: number;
  /** True until the first status round-trip completes. */
  loading: boolean;
}

/**
 * Pure derivation of `RelayContribution` from the two RPC slices.
 * Exported so tests can pin the behaviour without spinning up the React
 * renderer / atom plumbing. The component path goes through the hook
 * below, which is just a thin selector over `useStatus + useRouteTable`.
 */
export function computeRelayContribution(
  status: Status | null,
  table: RouteTableResult | null,
): RelayContribution {
  if (status === null) {
    return {
      active: false,
      peersViaMe: 0,
      packetsForwarded: 0,
      bytesForwarded: 0,
      loading: true,
    };
  }

  const active = status.role.includes("relay");

  const peersViaMe =
    table === null
      ? 0
      : new Set(
          table.routes
            .filter((r) => r.via === status.node_id)
            .map((r) => r.destination),
        ).size;

  return {
    active,
    peersViaMe,
    packetsForwarded: status.stats.forwarded_packets,
    bytesForwarded: status.stats.forwarded_bytes,
    loading: false,
  };
}

export function useRelayContribution(): RelayContribution {
  const status = useStatus();
  const { table } = useRouteTable();
  return computeRelayContribution(status, table);
}
