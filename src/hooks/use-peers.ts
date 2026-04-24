/**
 * usePeers — selector over `useDaemonState().snapshot.status.peers` with
 * the D-13 sort order applied:
 *
 *   1. gateway peers first (`is_gateway: true`)
 *   2. then by state: active → relayed → connecting → failed
 *   3. then by `label ?? node_id_short` lexical (stable secondary sort)
 *
 * This order is deterministic and user-predictable — NOT `last_seen`-
 * sorted, because that would reshuffle the list on every peers.event
 * heartbeat (D-13 rationale).
 *
 * Returns a fresh array each render (we call `[...peers].sort(...)`).
 * React 19's compiler will memoize downstream consumers; if Phase-3
 * profiling shows a perf hotspot we can swap to a manual identity cache
 * keyed off `snapshot.status.peers` reference equality — the input array
 * reference is already stable across non-peer events thanks to the
 * in-place-merge contract in useDaemonState.
 */

import type { PeerState, PeerSummary } from "@/lib/rpc-types";
import { useDaemonState } from "./use-daemon-state";

const STATE_ORDER: Record<PeerState, number> = {
  active: 0,
  relayed: 1,
  connecting: 2,
  failed: 3,
};

export function usePeers(): PeerSummary[] {
  const peers = useDaemonState().snapshot.status?.peers;
  if (!peers || peers.length === 0) return [];
  return [...peers].sort((a, b) => {
    if (a.is_gateway !== b.is_gateway) return a.is_gateway ? -1 : 1;
    if (a.state !== b.state) return STATE_ORDER[a.state] - STATE_ORDER[b.state];
    return (a.label ?? a.node_id_short).localeCompare(b.label ?? b.node_id_short);
  });
}
