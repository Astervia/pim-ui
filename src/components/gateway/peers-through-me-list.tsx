/**
 * <PeersThroughMeList /> — peers whose egress is THIS node per
 * 05-CONTEXT D-14 + RESEARCH §9c.
 *
 * REUSES the existing Phase 2 <PeerRow /> primitive (filtered render).
 * No new peer-row component for honesty consistency — the same row
 * format Aria sees on the Dashboard.
 *
 * Empty state copy: "no peers routing through this node yet ·
 * advertising 0.0.0.0/0" — non-infantilizing per P5 (UX-PLAN §1).
 */

import { useDaemonState } from "@/hooks/use-daemon-state";
import { PeerRow } from "@/components/peers/peer-row";

export interface PeersThroughMeListProps {
  /** From GatewayStatusResult.peers_through_me_ids. */
  peerIds: readonly string[];
  /** GatewayStatusResult.peers_through_me — used for the heading count
   *  even when peerIds is empty/undefined (RESEARCH §5a). */
  countFallback: number;
}

export function PeersThroughMeList({
  peerIds,
  countFallback,
}: PeersThroughMeListProps) {
  const { snapshot } = useDaemonState();
  const allPeers = snapshot.status?.peers ?? [];
  const filtered =
    peerIds.length > 0
      ? allPeers.filter((p) => peerIds.includes(p.node_id))
      : [];

  // Cardinality reconciliation: the daemon reports a count even when
  // the ID list is truncated (RESEARCH §5a). Use the count for the heading,
  // render whatever IDs we have.
  const headingCount = countFallback;

  return (
    <section
      className="font-code text-sm leading-[1.7]"
      aria-label="peers routing through this node"
    >
      <p className="text-foreground">{`peers routing through this node (${headingCount})`}</p>
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">
          no peers routing through this node yet · advertising 0.0.0.0/0
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {filtered.map((peer) => (
            <PeerRow key={peer.node_id} peer={peer} />
          ))}
        </div>
      )}
    </section>
  );
}
