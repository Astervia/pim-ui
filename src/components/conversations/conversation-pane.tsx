/**
 * <ConversationPane /> — right side of the Conversations screen.
 *
 * Shows the active thread for the selected peer, plus the composer.
 * Auto-scrolls to bottom whenever the message list grows. The empty
 * states are honest: no peer selected → guidance; peer selected but no
 * x25519 known yet → composer disabled with a banner explaining why.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { useMessageHistory } from "@/hooks/use-message-history";
import { Composer } from "./composer";
import { MessageRow } from "./message-row";
import { callDaemon } from "@/lib/rpc";
import { injectOptimisticSend } from "@/hooks/use-message-history";
import { refreshConversations } from "@/hooks/use-conversations";
import type { ConversationSummary, MessageRecord } from "@/lib/rpc-types";

export interface ConversationPaneProps {
  conversation: ConversationSummary | null;
}

export function ConversationPane({ conversation }: ConversationPaneProps) {
  const peerId = conversation?.peer_node_id ?? null;
  const messages = useMessageHistory(peerId);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el === null) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, peerId]);

  // Mark received messages as read when the user is viewing the conversation
  // and there are unread items.
  useEffect(() => {
    if (conversation === null) return;
    if (conversation.unread_count <= 0) return;
    const upTo = Date.now();
    void callDaemon("messages.mark_read", {
      peer_node_id: conversation.peer_node_id,
      up_to_ts_ms: upTo,
    }).then(
      () => {
        void refreshConversations();
      },
      (e) => console.warn("messages.mark_read failed:", e),
    );
  }, [conversation?.peer_node_id, conversation?.unread_count, conversation]);

  const onSend = useCallback(
    async (body: string) => {
      if (peerId === null) return;
      // Optimistic insert so the user sees their message instantly.
      const optimistic: MessageRecord = {
        id: `optimistic-${Math.random().toString(36).slice(2)}`,
        peer_node_id: peerId,
        direction: "sent",
        body,
        timestamp_ms: Date.now(),
        status: "pending",
        failure_reason: null,
        delivered_at_ms: null,
        read_at_ms: null,
      };
      injectOptimisticSend(optimistic);

      try {
        const result = await callDaemon("messages.send", {
          peer_node_id: peerId,
          body,
        });
        // Replace the optimistic row with the canonical record.
        injectOptimisticSend({
          ...optimistic,
          id: result.id,
          timestamp_ms: result.timestamp_ms,
          status: result.status,
        });
        void refreshConversations();
      } catch (e) {
        injectOptimisticSend({
          ...optimistic,
          status: "failed",
          failure_reason: String(e),
        });
        throw e;
      }
    },
    [peerId],
  );

  const composerNotice = useMemo(() => {
    if (conversation === null) return null;
    if (conversation.is_connected === false) {
      return `${conversation.name} is offline · message will queue`;
    }
    return null;
  }, [conversation]);

  if (conversation === null) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground font-code">
          ── select a peer on the left, or invite someone from the dashboard ──
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <header className="px-4 py-2 border-b border-border bg-popover/40 font-code">
        <div className="flex items-center gap-2 text-sm">
          <span aria-hidden>
            {conversation.is_connected === true ? "◆" : "○"}
          </span>
          <span className="font-medium">{conversation.name}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            · {conversation.peer_node_id_short}
          </span>
        </div>
        <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
          {conversation.is_connected === true
            ? "direct · noise + ecies e2e"
            : "offline · last message queued · ecies e2e"}
        </p>
      </header>
      <div
        ref={scrollerRef}
        className={cn(
          "flex-1 overflow-y-auto",
          "bg-popover/10",
          "py-2 flex flex-col",
        )}
      >
        {messages.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground font-code">
            ── no messages with {conversation.name} yet · type below to start ──
          </p>
        ) : (
          messages.map((m) => <MessageRow key={m.id} message={m} />)
        )}
      </div>
      <Composer
        disabled={false}
        notice={composerNotice}
        onSend={onSend}
      />
    </div>
  );
}
