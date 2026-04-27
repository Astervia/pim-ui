/**
 * <PeerRemoveButton /> — ghost [ Remove ] affordance on a static peer
 * row inside <PeersPanel /> (PEER-03, 03-UI-SPEC §S2 + §Interaction
 * states §Peer remove button).
 *
 * Visibility (D-20): rendered ONLY for peers with `peer.static === true`.
 * The render-side gate lives in <PeersPanel />; this button does not
 * re-check `peer.static` so it stays general-purpose if a future plan
 * needs to invoke the same flow elsewhere.
 *
 * Click handler: calls e.stopPropagation() so the enclosing peer row
 * does NOT also open the Phase-2 PeerDetailSheet (03-UI-SPEC §S2 row
 * interaction). Then dispatches `requestRemove(peer)` against the
 * use-remove-peer atom, which causes <RemovePeerAlertDialog /> to open.
 *
 * Limited mode (D-32): disabled with the verbatim "Reconnect to remove
 * peers." title hint; the AlertDialog primary action is also disabled
 * when limited so even a stale-state click can't fire peers.remove.
 *
 * Visual: ghost variant + border so it reads as an inline button (not
 * an ornament) per 03-UI-SPEC §S2 row mockup; hover flips the border to
 * destructive — NOT a full destructive fill (that's the AlertDialog's
 * job at confirmation time).
 *
 * Brand rules: zero radius (Button primitive enforces), monospace
 * everywhere, no lucide icons, no `!` prefix on values.
 */

import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useRemovePeer } from "@/hooks/use-remove-peer";
import type { PeerSummary } from "@/lib/rpc-types";

export interface PeerRemoveButtonProps {
  peer: PeerSummary;
}

export function PeerRemoveButton({ peer }: PeerRemoveButtonProps) {
  const { requestRemove } = useRemovePeer();
  const { snapshot } = useDaemonState();
  const limited = snapshot.state === "running" ? false : true;

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // Row-click protection per 03-UI-SPEC §S2: clicking [ Remove ] must
    // NOT also open the Peer Detail slide-over.
    e.stopPropagation();
    if (limited === true) return;
    requestRemove(peer);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="border border-border hover:border-destructive hover:text-destructive hover:bg-transparent"
      disabled={limited}
      onClick={onClick}
      title={limited === true ? "Reconnect to remove peers." : undefined}
      aria-label={`remove peer ${peer.label === null ? peer.node_id_short : peer.label}`}
    >
      [ Remove ]
    </Button>
  );
}
