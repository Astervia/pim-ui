/**
 * use-sidebar-counts — Phase 4 P1.5 selector hooks for the live sidebar.
 *
 * Three tiny selectors derived from existing snapshot atoms:
 *
 *   useNearbyCount()      — discovered peers NOT yet in connected list.
 *                           Mirrors Dashboard's filter: a discovered entry
 *                           with `node_id === null` always counts; a
 *                           discovered entry whose node_id matches a
 *                           connected peer is filtered out (same peer is
 *                           advertised post-pair so it would otherwise
 *                           double-count).
 *   useFailedPeerCount()  — count of connected peers whose state is
 *                           "failed". Sidebar surfaces this as `[N err]`
 *                           on the peers row, outranking `[N nearby]`.
 *   useGatewayActive()    — boolean: is THIS node currently running as a
 *                           gateway? Read from `Status.role` (NodeRole[])
 *                           which already lives in the snapshot — no
 *                           gateway.status RPC poll, no new subscription,
 *                           so the macOS poll-cost concern flagged in the
 *                           Phase 4 brief does not apply.
 *
 * W1 invariant preserved — every selector composes existing daemon-state
 * hooks. Zero new `listen(...)` calls, zero new RPC methods.
 */

import { useDiscovered } from "@/hooks/use-discovered";
import { usePeers } from "@/hooks/use-peers";
import { useStatus } from "@/hooks/use-status";

export function useNearbyCount(): number {
  const discovered = useDiscovered();
  const peers = usePeers();
  if (discovered.length === 0) return 0;
  // Same predicate as Dashboard's `nearby` useMemo — keep the count
  // honest with what the Nearby panel itself would render.
  let count = 0;
  for (const d of discovered) {
    if (d.node_id === null) {
      count++;
      continue;
    }
    const matched = peers.some((p) => p.node_id === d.node_id);
    if (matched === false) count++;
  }
  return count;
}

export function useFailedPeerCount(): number {
  const peers = usePeers();
  if (peers.length === 0) return 0;
  let count = 0;
  for (const p of peers) {
    if (p.state === "failed") count++;
  }
  return count;
}

export function useGatewayActive(): boolean {
  const status = useStatus();
  if (status === null) return false;
  // `role` is a NodeRole[] (e.g. ["client", "gateway"]) — the node can
  // be both a client and a gateway simultaneously. We only care whether
  // the gateway role is in the set.
  return status.role.includes("gateway");
}
