/**
 * <PeersPanel /> — connected-peer panel for the dedicated Peers tab
 * (03-02, 03-UI-SPEC §S2).
 *
 * Composition:
 *   - CliPanel title "peers" (auto-uppercased to PEERS), badge `[N CONNECTED]`
 *   - <AddPeerActionRow /> at the top (Plan 03-02 Task 1, PEER-02)
 *   - Phase 2 column header row (matches the Dashboard's PeerListPanel)
 *   - One <PeerRow /> per peer (sorted via usePeers, D-13)
 *     - Task 2 (PEER-03): peers with `peer.static === true` get a
 *       trailing <PeerRemoveButton peer={peer} />, right-aligned. Rows
 *       with `peer.static === false` do NOT render Remove (D-20).
 *   - Empty state renders <TeachingEmptyState /> with the
 *     EMPTY_STATIC_PEERS_HEADLINE / EMPTY_STATIC_PEERS_NEXT locked
 *     copy from src/lib/copy.ts (no cycling indicator — there is no
 *     scanning concept on the static-peer surface).
 *
 * Why a NEW panel instead of reusing PeerListPanel verbatim:
 *   - PeerListPanel renders two disabled "phase 4" action rows (Add peer
 *     nearby + Invite peer) that are out of scope here.
 *   - Phase 3's Peers tab needs the inline Remove affordance per row,
 *     and the AddPeerActionRow above the list — not below it.
 *   - The PeerRow primitive itself is reused unchanged.
 *
 * Limited mode (D-30 from Phase 2): dim the panel to opacity-60 and
 * flip the badge to `muted`. Same grammar as PeerListPanel.
 *
 * D-30 (Plan 03-02 / 03-CONTEXT): peer add/remove already triggers
 * refetchSettingsConfig() via the use-add-peer / use-remove-peer hooks;
 * the live peer list updates via the existing peers.event subscription.
 *
 * Brand rules: zero radius, no gradient, no literal palette colors, no
 * `!` prefix on values, no exclamation marks in copy.
 */

import type { PeerSummary } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { TeachingEmptyState } from "@/components/brand/teaching-empty-state";
import { PeerRow } from "./peer-row";
import { AddPeerActionRow } from "./add-peer-action-row";
import { PeerRemoveButton } from "./peer-remove-button";
import {
  EMPTY_STATIC_PEERS_HEADLINE,
  EMPTY_STATIC_PEERS_NEXT,
} from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface PeersPanelProps {
  peers: PeerSummary[];
  onPeerSelect?: (peer: PeerSummary) => void;
  limitedMode?: boolean;
}

export function PeersPanel({
  peers,
  onPeerSelect,
  limitedMode = false,
}: PeersPanelProps) {
  const connectedCount = peers.filter(
    (p) => p.state === "active" || p.state === "relayed",
  ).length;

  const badge = limitedMode === true
    ? { label: `${connectedCount} CONNECTED`, variant: "muted" as const }
    : { label: `${connectedCount} CONNECTED`, variant: "default" as const };

  return (
    <CliPanel
      title="peers"
      status={badge}
      className={cn(limitedMode === true && "opacity-60")}
    >
      <AddPeerActionRow />

      {/* Column header — matches Dashboard PeerListPanel grammar. */}
      <div
        role="presentation"
        className={cn(
          "grid grid-cols-[8ch_16ch_18ch_11ch_1fr_auto_auto_auto]",
          "gap-x-2 px-4 pb-2 mb-1 border-b border-border",
          "font-mono text-xs uppercase tracking-widest text-muted-foreground",
        )}
      >
        <span>short id</span>
        <span>label</span>
        <span>mesh ip</span>
        <span>transport</span>
        <span>state</span>
        <span>hops</span>
        <span>latency</span>
        <span>last seen</span>
      </div>

      {peers.length === 0 ? (
        <TeachingEmptyState
          headline={EMPTY_STATIC_PEERS_HEADLINE}
          next={EMPTY_STATIC_PEERS_NEXT}
        />
      ) : (
        <ul role="list" className="divide-y divide-border/30">
          {peers.map((peer) => (
            <li
              key={peer.node_id}
              className="flex items-center"
            >
              <div className="flex-1 min-w-0">
                <PeerRow peer={peer} onSelect={onPeerSelect} />
              </div>
              {/*
                D-20: ONLY peers with peer.static === true get the
                inline [ Remove ] affordance. Discovered/paired peers
                (peer.static === false) have no remove flow in Phase 3
                — peers.unpair doesn't exist on the v1 wire yet.
              */}
              {peer.static === true ? (
                <div className="pr-4 shrink-0">
                  <PeerRemoveButton peer={peer} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </CliPanel>
  );
}
