/**
 * <PeersScreen /> — dedicated Peers tab (⌘2) introduced by Plan 03-02
 * (PEER-02, PEER-03; 03-CONTEXT D-02 ends Phase 2's "peers aliases
 * Dashboard" compromise).
 *
 * Composition (03-UI-SPEC §S2):
 *   1. <PeersPanel />            — CONNECTED peer list with the new
 *                                  AddPeerActionRow + (Task 2) per-row
 *                                  Remove affordance on static peers.
 *   2. <NearbyPanel />           — Phase 2 component, reused unchanged.
 *   3. <AddPeerSheet />          — right-edge slide-over Add form
 *                                  (PEER-02, this plan Task 1).
 *   4. <RemovePeerAlertDialog /> — destructive AlertDialog (Task 2).
 *
 * Layout: matches the Dashboard column shape (`max-w-4xl` flex column,
 * gap-6) so the visual grammar is consistent across ⌘1 / ⌘2 (Phase 2
 * locked-in pattern). The two overlay surfaces are siblings of the
 * panels so they survive tab switches at shell-level should this screen
 * ever be unmounted; they are mounted here too so PeersScreen is the
 * single owner of its overlays per the plan.
 *
 * Data sources:
 *   - usePeers()      — D-13 sorted snapshot of connected peers.
 *   - useDiscovered() — Phase 2 atom for nearby/unpaired peers.
 *   - useDaemonState() — limitedMode flag (state !== "running").
 *
 * Peer-row click → opens the Phase 2 PeerDetailSheet via usePeerDetail
 * (already mounted at shell level by ActiveScreen). The Remove button
 * stops propagation so its click does NOT also open the slide-over
 * (Task 2 / 03-UI-SPEC §S2).
 *
 * W1 contract: this screen invokes NO listen(...) calls — peer mutations
 * surface through the daemon's existing peers.event subscription owned
 * by use-daemon-state.ts. PEER-02 and PEER-03 are request/response RPCs.
 *
 * Brand rules: zero radius, no gradient, no literal palette colors, no
 * `!` prefix on values, no exclamation marks in copy.
 */

import { useDaemonState } from "@/hooks/use-daemon-state";
import { usePeers } from "@/hooks/use-peers";
import { useDiscovered } from "@/hooks/use-discovered";
import { usePeerDetail } from "@/hooks/use-peer-detail";
import { usePairApproval } from "@/hooks/use-pair-approval";
import { PeersPanel } from "@/components/peers/peers-panel";
import { NearbyPanel } from "@/components/peers/nearby-panel";
import { AddPeerSheet } from "@/components/peers/add-peer-sheet";
import { RemovePeerAlertDialog } from "@/components/peers/remove-peer-alert-dialog";
import type { PeerDiscovered, PeerSummary } from "@/lib/rpc-types";

export function PeersScreen() {
  const { snapshot } = useDaemonState();
  const peers = usePeers();
  const discovered = useDiscovered();
  const { select } = usePeerDetail();
  const { requestOutbound } = usePairApproval();

  const limitedMode = snapshot.state === "running" ? false : true;

  const onPeerSelect = (p: PeerSummary) => select(p);
  const onNearbyPair = (d: PeerDiscovered) => requestOutbound(d);

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <PeersPanel
        peers={peers}
        onPeerSelect={onPeerSelect}
        limitedMode={limitedMode}
      />
      <NearbyPanel
        discovered={discovered}
        onPair={onNearbyPair}
        limitedMode={limitedMode}
      />
      {/* Overlays — siblings of the panels so they overlay any peer
          row interaction. AddPeerSheet (PEER-02) + RemovePeerAlertDialog
          (PEER-03). */}
      <AddPeerSheet />
      <RemovePeerAlertDialog />
    </div>
  );
}
