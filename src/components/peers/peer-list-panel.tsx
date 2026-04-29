/**
 * <PeerListPanel /> — the Peers CliPanel on the Dashboard (02-UI-SPEC §Peers
 * panel, 02-CONTEXT D-08/D-11/D-13/D-14).
 *
 * Wraps the D-13-sorted peer list (via usePeers from Plan 02-01) with:
 *   - A muted column-header row matching the UI-SPEC layout.
 *   - One PeerRow per peer.
 *   - Empty state renders <TeachingEmptyState /> with the
 *     EMPTY_PEERS_HEADLINE / EMPTY_PEERS_NEXT locked copy from
 *     src/lib/copy.ts and a cycling [udp · ble · wfd] discovery
 *     indicator. Never the chipper onboarding-style exhortation we
 *     refuse by contract (P5 solo-mode, STYLE.md §Voice).
 *   - Two enabled ActionRow buttons below the list, visible regardless
 *     of whether the list is empty: `[ + Add peer nearby ]` and
 *     `[ Invite peer ]`. Click handlers come from the parent (Dashboard)
 *     via onAddPeerNearby / onInvitePeer props (Phase 4 D-06). The
 *     Phase-2 placeholder tooltip is gone now that Phase 4 ships the
 *     pairing affordances; aria-label replaces title=.
 *
 * D-30 limited mode: dims to opacity-60 and flips the connected-count
 * badge variant to muted.
 *
 * The panel emits `onPeerSelect(peer)` upward; Plan 02-04 wires this
 * callback to open the Peer Detail slide-over. Default behaviour is a
 * no-op (callback absent) so the component renders cleanly in Phase 2
 * without the slide-over plumbing yet.
 */

import type { PeerSummary } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { TeachingEmptyState } from "@/components/brand/teaching-empty-state";
import { Button } from "@/components/ui/button";
import { PeerRow } from "./peer-row";
import { EMPTY_PEERS_HEADLINE, EMPTY_PEERS_NEXT } from "@/lib/copy";
import { cn } from "@/lib/utils";

const EMPTY_PEERS_CYCLE = ["udp", "ble", "wfd"] as const;

export interface PeerListPanelProps {
  peers: PeerSummary[];
  onPeerSelect?: (peer: PeerSummary) => void;
  /** Phase 4 D-06/D-08: open the InvitePeerSheet. */
  onInvitePeer?: () => void;
  limitedMode?: boolean;
  /** Phase 2/5 — staggered reveal delay forwarded to CliPanel. */
  revealDelay?: number | null;
}

export function PeerListPanel({
  peers,
  onPeerSelect,
  onInvitePeer,
  limitedMode = false,
  revealDelay = 0,
}: PeerListPanelProps) {
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
      revealDelay={revealDelay}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {/* Column header — muted, uppercase (UI-SPEC §Peers panel). */}
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
        <TeachingEmptyState
          headline={EMPTY_PEERS_HEADLINE}
          next={EMPTY_PEERS_NEXT}
          cycle={EMPTY_PEERS_CYCLE}
        />
      ) : (
        <ul role="list" className="divide-y divide-border/30">
          {peers.map((peer) => (
            <li key={peer.node_id}>
              <PeerRow peer={peer} onSelect={onPeerSelect} />
            </li>
          ))}
        </ul>
      )}

      {/* ActionRow — only [ Invite peer ] remains. The previous
          [ + Add peer nearby ] button merely scrolled to the NearbyPanel
          rendered directly below; redundant on dashboards where both
          panels are visible at once, so it has been removed. */}
      <div className="mt-4 pt-3 border-t border-border flex gap-4 px-4">
        <Button
          variant="default"
          aria-label="invite peer"
          onClick={() => {
            if (onInvitePeer !== undefined) onInvitePeer();
          }}
        >
          [ Invite peer ]
        </Button>
      </div>
    </CliPanel>
  );
}
