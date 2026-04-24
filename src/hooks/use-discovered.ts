/**
 * useDiscovered — thin selector over `useDaemonState().snapshot.discovered`.
 *
 * Returns the list of nearby-but-unpaired peers (the `NEARBY — NOT PAIRED`
 * panel data per D-19 + D-20). The underlying list is seeded on daemon
 * `running` via `callDaemon("peers.discovered", null)` and updated by
 * `peers.event { kind: "discovered" }`.
 *
 * No sort is applied at this layer — the Nearby panel sorts locally if
 * it needs to; the authoritative order is the daemon's arrival order
 * (first_seen_s ascending).
 */

import type { PeerDiscovered } from "@/lib/rpc-types";
import { useDaemonState } from "./use-daemon-state";

export function useDiscovered(): PeerDiscovered[] {
  return useDaemonState().snapshot.discovered;
}
