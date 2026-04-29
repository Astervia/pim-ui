/**
 * <PeerListPanel /> — Dashboard's peer list.
 *
 * Post-redesign: column header dropped (rows are self-describing — each
 * peer's row tells its own story via the 4-zone grid in PeerRow). The
 * panel is now structured as:
 *
 *   ┌─── PEERS ─────────────────────────────[N connected]┐
 *   │ ◆ active    9efa1720…  static    tcp · …  7ms · 0s │
 *   │ ◈ relayed   abc1…  client-c      via …   12ms · 4s │
 *   │                                                     │
 *   │ ────                                                 │
 *   │ [ + Add peer ]   [ Invite peer ]                    │
 *   └─────────────────────────────────────────────────────┘
 *
 * Empty state (zero peers connected) renders the locked-copy
 * <TeachingEmptyState /> with the cycling discovery indicator —
 * teaches what the daemon is doing without violating P5 solo-mode.
 *
 * D-30 limited mode: panel dims to opacity-60 and the count badge
 * variant flips to muted.
 */

import type { PeerSummary } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { TeachingEmptyState } from "@/components/brand/teaching-empty-state";
import { Button } from "@/components/ui/button";
import { PeerRow } from "./peer-row";
import { useAddPeer } from "@/hooks/use-add-peer";
import { EMPTY_PEERS_HEADLINE, EMPTY_PEERS_NEXT } from "@/lib/copy";
import { cn } from "@/lib/utils";

const EMPTY_PEERS_CYCLE = ["udp", "ble", "wfd"] as const;

export interface PeerListPanelProps {
  peers: PeerSummary[];
  onPeerSelect?: (peer: PeerSummary) => void;
  onInvitePeer?: () => void;
  limitedMode?: boolean;
  revealDelay?: number | null;
}

export function PeerListPanel({
  peers,
  onPeerSelect,
  onInvitePeer,
  limitedMode = false,
  revealDelay = 0,
}: PeerListPanelProps) {
  const { openSheet: openAddPeer } = useAddPeer();
  const connectedCount = peers.filter(
    (p) => p.state === "active" || p.state === "relayed",
  ).length;

  const totalPeers = peers.length;
  const labelText =
    totalPeers === 0
      ? "0 connected"
      : connectedCount === totalPeers
        ? `${connectedCount} connected`
        : `${connectedCount}/${totalPeers} connected`;

  const badge = limitedMode === true
    ? { label: labelText.toUpperCase(), variant: "muted" as const }
    : { label: labelText.toUpperCase(), variant: "default" as const };

  return (
    <CliPanel
      title="peers"
      status={badge}
      revealDelay={revealDelay}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {peers.length === 0 ? (
        <TeachingEmptyState
          headline={EMPTY_PEERS_HEADLINE}
          next={EMPTY_PEERS_NEXT}
          cycle={EMPTY_PEERS_CYCLE}
        />
      ) : (
        <ul role="list" className="flex flex-col divide-y divide-border/30">
          {peers.map((peer) => (
            <li key={peer.node_id}>
              <PeerRow peer={peer} onSelect={onPeerSelect} />
            </li>
          ))}
        </ul>
      )}

      {/*
        Action row — `[ + add peer ]` (manual static peer via TOML
        fragment) sits next to `[ invite peer ]` (remote pim:// link).
        Add is the primary path on a dashboard with zero or few peers;
        Invite is the secondary path. Both stay reachable in limited
        mode but the Add button itself disables (the daemon can't
        write to TOML while it's not running).
      */}
      <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-3 px-4">
        <Button
          variant="default"
          aria-label="add static peer"
          disabled={limitedMode}
          title={limitedMode === true ? "Reconnect to add peers." : undefined}
          onClick={openAddPeer}
        >
          [ + Add peer ]
        </Button>
        <Button
          variant="secondary"
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
