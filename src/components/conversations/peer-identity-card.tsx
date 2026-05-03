/**
 * <PeerIdentityCard /> — modal showing the active peer's identifiers, with
 * a one-shot "copy identity card" action for out-of-band sharing.
 *
 * Stepping-stone for v1.1 multi-hop messaging: until the daemon exposes
 * x25519 pubkeys and a peers.import_identity RPC, two parties can already
 * exchange node_id + mesh_ip via Signal/email/QR through this card.
 *
 * For peers without a live PeerSummary (offline / known-only conversations)
 * the card falls back to ConversationSummary fields and renders the
 * unavailable rows as "—".
 */

import { useCallback, useMemo } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KvRow } from "@/components/peers/kv-row";
import { formatDuration } from "@/lib/format";
import { buildIdentityCardText } from "@/lib/conversations/identity-card";
import type { ConversationSummary, PeerSummary } from "@/lib/rpc-types";

export interface PeerIdentityCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ConversationSummary;
  peer: PeerSummary | null;
}

function buildShareableCard(
  conversation: ConversationSummary,
  peer: PeerSummary | null,
): string {
  return buildIdentityCardText({
    name: peer?.label ?? conversation.name,
    nodeId: conversation.peer_node_id,
    meshIp: peer?.mesh_ip ?? null,
    x25519Pubkey: peer?.x25519_pubkey ?? conversation.x25519_pubkey ?? null,
  });
}

export function PeerIdentityCard({
  open,
  onOpenChange,
  conversation,
  peer,
}: PeerIdentityCardProps) {
  const card = useMemo(
    () => buildShareableCard(conversation, peer),
    [conversation, peer],
  );

  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined") return;
    if (navigator.clipboard === undefined) return;
    void navigator.clipboard.writeText(card).catch(() => {});
  }, [card]);

  const displayName = peer?.label ?? conversation.name;
  const meshIpValue = peer === null ? "—" : peer.mesh_ip;
  const hopsValue = peer === null ? "—" : String(peer.route_hops);
  const lastSeenValue =
    peer === null ? "—" : `${formatDuration(peer.last_seen_s)} ago`;
  const transportValue = peer === null ? "—" : peer.transport;
  const x25519Value =
    peer?.x25519_pubkey ?? conversation.x25519_pubkey ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>peer identity</DialogTitle>
          <DialogDescription>
            share these values out-of-band (signal, email, qr) so your peer
            can reach you across the mesh once daemon-side identity import
            lands.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 py-1">
          <KvRow label="name" value={displayName} />
          <KvRow
            label="node_id"
            value={conversation.peer_node_id}
            copyable
            valueClassName="break-all"
          />
          <KvRow
            label="mesh_ip"
            value={meshIpValue}
            copyable={peer !== null}
          />
          <KvRow label="hops" value={hopsValue} />
          <KvRow label="transport" value={transportValue} />
          <KvRow label="last_seen" value={lastSeenValue} />
          {x25519Value !== null ? (
            <KvRow
              label="x25519"
              value={x25519Value}
              copyable
              valueClassName="break-all"
            />
          ) : (
            <KvRow
              label="x25519"
              value="not yet learned · peer must come online or import out-of-band"
              valueClassName="text-text-secondary"
            />
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              close
            </Button>
          </DialogClose>
          <Button type="button" onClick={onCopy}>
            copy identity card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
