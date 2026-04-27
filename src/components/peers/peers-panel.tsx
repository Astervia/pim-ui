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
 *   - Empty state copy verbatim per 03-UI-SPEC §Empty states:
 *       `no static peers · discovered peers appear above`
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
import { PeerRow } from "./peer-row";
import { AddPeerActionRow } from "./add-peer-action-row";
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
          "gap-x-2 px-4 pb-1 mb-1 border-b border-border",
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
        <p className="px-4 py-2 text-muted-foreground">
          no static peers · discovered peers appear above
        </p>
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
                Task 2 (PEER-03) injects <PeerRemoveButton peer={peer} />
                here, gated on `peer.static === true` per D-20.
              */}
            </li>
          ))}
        </ul>
      )}
    </CliPanel>
  );
}
