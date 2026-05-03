/**
 * <MyIdentityCard /> — modal showing the local node's identity for
 * out-of-band sharing. Sibling of `<PeerIdentityCard />` but reads
 * from `useDaemonState().snapshot.status` instead of a peer/
 * conversation pair.
 *
 * The "[ COPY IDENTITY CARD ]" output uses the same canonical
 * `buildIdentityCardText` format as peer-shared cards, so a recipient
 * pasting it into a pim chat sees the structured `<IdentityCardMessage />`
 * with an [ Import ] button.
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
import { buildIdentityCardText } from "@/lib/conversations/identity-card";
import { useDaemonState } from "@/hooks/use-daemon-state";

export interface MyIdentityCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MyIdentityCard({ open, onOpenChange }: MyIdentityCardProps) {
  const { snapshot } = useDaemonState();
  const status = snapshot.status;

  const card = useMemo(() => {
    if (status === undefined || status === null) return null;
    return buildIdentityCardText({
      name: status.node,
      nodeId: status.node_id,
      meshIp: status.mesh_ip,
      x25519Pubkey: status.x25519_pubkey,
    });
  }, [status]);

  const onCopy = useCallback(() => {
    if (card === null) return;
    if (typeof navigator === "undefined") return;
    if (navigator.clipboard === undefined) return;
    void navigator.clipboard.writeText(card).catch(() => {});
  }, [card]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>my identity</DialogTitle>
          <DialogDescription>
            this is the card other peers need to message you across the mesh.
            share it out-of-band (signal, email, qr) so they can paste it
            into a chat — their daemon will [ import ] it and route to you.
          </DialogDescription>
        </DialogHeader>

        {status === undefined || status === null ? (
          <p className="font-code text-sm text-text-secondary py-2">
            ── daemon not connected ──
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 py-1">
            <KvRow label="name" value={status.node} />
            <KvRow
              label="node_id"
              value={status.node_id}
              copyable
              valueClassName="break-all"
            />
            <KvRow label="mesh_ip" value={status.mesh_ip} copyable />
            <KvRow
              label="x25519"
              value={status.x25519_pubkey}
              copyable
              valueClassName="break-all"
            />
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              close
            </Button>
          </DialogClose>
          <Button type="button" onClick={onCopy} disabled={card === null}>
            copy identity card
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
