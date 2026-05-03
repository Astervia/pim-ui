/**
 * <SharePeerDialog /> — peer-picker that forwards another peer's
 * identity card into the active conversation as a regular text
 * message.
 *
 * Sources:
 *   - `usePeers()`              → currently-active sessions, full PeerSummary
 *   - `useConversations()`      → known peers (may be offline) with
 *                                cached x25519
 *
 * Merged & deduped by node_id; PeerSummary wins when both sources have
 * the peer (richer fields). The current conversation peer is excluded
 * (sharing themselves to themselves is meaningless). Peers without a
 * cached x25519 are still listed but flagged "no x25519 yet" — the
 * share still works as plain identity disclosure but the recipient
 * cannot import without the key.
 */

import { useCallback, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { callDaemon } from "@/lib/rpc";
import { usePeers } from "@/hooks/use-peers";
import { useConversations } from "@/hooks/use-conversations";
import { refreshConversations } from "@/hooks/use-conversations";
import { buildIdentityCardText } from "@/lib/conversations/identity-card";
import { injectOptimisticSend } from "@/hooks/use-message-history";
import type {
  ConversationSummary,
  MessageRecord,
  PeerSummary,
} from "@/lib/rpc-types";

export interface SharePeerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Conversation peer that will receive the shared card as a message. */
  recipient: ConversationSummary;
}

interface ShareCandidate {
  nodeId: string;
  nodeIdShort: string;
  name: string;
  meshIp: string | null;
  x25519Pubkey: string | null;
  /** True when we currently have a live session with this peer. */
  online: boolean;
}

function fromPeerSummary(p: PeerSummary): ShareCandidate {
  return {
    nodeId: p.node_id,
    nodeIdShort: p.node_id_short,
    name: p.label ?? p.node_id_short,
    meshIp: p.mesh_ip || null,
    x25519Pubkey: p.x25519_pubkey,
    online: p.state === "active" || p.state === "relayed",
  };
}

function fromConversation(c: ConversationSummary): ShareCandidate {
  return {
    nodeId: c.peer_node_id,
    nodeIdShort: c.peer_node_id_short,
    name: c.name,
    meshIp: null,
    x25519Pubkey: c.x25519_pubkey,
    online: c.is_connected,
  };
}

export function SharePeerDialog({
  open,
  onOpenChange,
  recipient,
}: SharePeerDialogProps) {
  const peers = usePeers();
  const conversations = useConversations();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const candidates: ShareCandidate[] = useMemo(() => {
    const byNodeId = new Map<string, ShareCandidate>();
    // Conversations first (lower priority), then peers (so PeerSummary wins).
    for (const c of conversations) {
      if (c.peer_node_id === recipient.peer_node_id) continue;
      byNodeId.set(c.peer_node_id, fromConversation(c));
    }
    for (const p of peers) {
      if (p.node_id === recipient.peer_node_id) continue;
      byNodeId.set(p.node_id, fromPeerSummary(p));
    }
    return [...byNodeId.values()].sort((a, b) => {
      // Online first, then peers with x25519, then alphabetical name.
      if (a.online !== b.online) return a.online ? -1 : 1;
      const aHas = a.x25519Pubkey !== null;
      const bHas = b.x25519Pubkey !== null;
      if (aHas !== bHas) return aHas ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [peers, conversations, recipient.peer_node_id]);

  const selected = useMemo(
    () => candidates.find((c) => c.nodeId === selectedNodeId) ?? null,
    [candidates, selectedNodeId],
  );

  const onSend = useCallback(async () => {
    if (selected === null) return;
    setSending(true);
    setError(null);
    const body = buildIdentityCardText({
      name: selected.name,
      nodeId: selected.nodeId,
      meshIp: selected.meshIp,
      x25519Pubkey: selected.x25519Pubkey,
    });
    const optimisticId = `optimistic-${Math.random().toString(36).slice(2)}`;
    const now = Date.now();
    const optimistic: MessageRecord = {
      id: optimisticId,
      peer_node_id: recipient.peer_node_id,
      direction: "sent",
      body,
      timestamp_ms: now,
      status: "pending",
      failure_reason: null,
      delivered_at_ms: null,
      read_at_ms: null,
    };
    injectOptimisticSend(optimistic);
    try {
      const result = await callDaemon("messages.send", {
        peer_node_id: recipient.peer_node_id,
        body,
      });
      injectOptimisticSend(
        {
          ...optimistic,
          id: result.id,
          timestamp_ms: result.timestamp_ms,
          status: result.status,
        },
        optimisticId,
      );
      void refreshConversations();
      setSending(false);
      setSelectedNodeId(null);
      onOpenChange(false);
    } catch (e) {
      injectOptimisticSend({
        ...optimistic,
        status: "failed",
        failure_reason: String(e),
      });
      setError(e instanceof Error ? e.message : String(e));
      setSending(false);
    }
  }, [selected, recipient.peer_node_id, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>share peer identity</DialogTitle>
          <DialogDescription>
            forward another peer's node_id + x25519 to{" "}
            <span className="text-foreground">{recipient.name}</span> as a
            chat message. they can [ import ] it to message that peer
            directly across the mesh.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col font-code text-sm border border-border max-h-[24rem] overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="px-3 py-4 text-text-secondary">
              ── no other peers to share ──
            </p>
          ) : (
            <ul role="listbox" aria-label="peers to share">
              {candidates.map((c) => {
                const isSelected = selectedNodeId === c.nodeId;
                const noKey = c.x25519Pubkey === null;
                return (
                  <li key={c.nodeId}>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(c.nodeId)}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "w-full text-left px-3 py-2",
                        "flex flex-col gap-0.5",
                        "border-b border-border/40 transition-colors duration-75",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-popover",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="shrink-0">
                          {c.online ? "◆" : "○"}
                        </span>
                        <span className="font-medium truncate">{c.name}</span>
                        <span
                          className={cn(
                            "text-[0.65rem] tabular-nums",
                            isSelected
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground",
                          )}
                        >
                          · {c.nodeIdShort}
                        </span>
                        {noKey ? (
                          <span
                            className={cn(
                              "ml-auto text-[0.6rem] uppercase tracking-wider px-1 py-px border",
                              isSelected
                                ? "border-primary-foreground/60 text-primary-foreground/80"
                                : "border-border text-text-secondary",
                            )}
                          >
                            no x25519
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error !== null ? (
          <p className="font-code text-xs text-destructive break-all">
            ✗ {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={sending}>
              cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={onSend}
            disabled={selected === null || sending}
          >
            {sending ? "sending…" : "send card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
