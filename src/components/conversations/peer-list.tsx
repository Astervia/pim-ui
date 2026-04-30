/**
 * <PeerList /> — left sidebar of the Conversations screen.
 *
 * Two visually-distinct sections:
 *   - "active"  — peers currently connected (◆ marker)
 *   - "known"   — peers we have a cached identity for but no live session (○)
 *
 * Each row renders short id + name + unread badge + last-message
 * timestamp. Brand-faithful (no rounded corners, no shadows, all box-drawing).
 */

import { cn } from "@/lib/utils";
import { formatRelativeDate, truncatePreview } from "@/lib/conversations/format";
import type { ConversationSummary } from "@/lib/rpc-types";

export interface PeerListProps {
  conversations: ConversationSummary[];
  selected: string | null;
  onSelect: (peerNodeId: string) => void;
}

export function PeerList({
  conversations,
  selected,
  onSelect,
}: PeerListProps) {
  const active = conversations.filter((c) => c.is_connected === true);
  const known = conversations.filter((c) => c.is_connected === false);

  return (
    <nav
      aria-label="conversation peers"
      className={cn(
        "font-code text-sm leading-[1.7]",
        "border-r border-border bg-popover/40",
        "min-w-[14rem] max-w-[18rem] flex flex-col",
      )}
    >
      <Section title="active" count={active.length}>
        {active.length === 0 ? (
          <Empty hint="no peers online" />
        ) : (
          active.map((c) => (
            <Row
              key={c.peer_node_id}
              conversation={c}
              selected={selected === c.peer_node_id}
              onSelect={onSelect}
              connected
            />
          ))
        )}
      </Section>
      <Section title="known" count={known.length}>
        {known.length === 0 ? (
          <Empty hint="no past conversations" />
        ) : (
          known.map((c) => (
            <Row
              key={c.peer_node_id}
              conversation={c}
              selected={selected === c.peer_node_id}
              onSelect={onSelect}
              connected={false}
            />
          ))
        )}
      </Section>
    </nav>
  );
}

interface SectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

function Section({ title, count, children }: SectionProps) {
  return (
    <div className="flex flex-col">
      <div className="px-3 py-1 text-[0.7rem] uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
        {`── ${title} ${count > 0 ? `(${count})` : ""}`}
      </div>
      <ul className="flex flex-col">{children}</ul>
    </div>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <li className="px-3 py-3 text-muted-foreground text-xs">{hint}</li>
  );
}

interface RowProps {
  conversation: ConversationSummary;
  selected: boolean;
  connected: boolean;
  onSelect: (peerNodeId: string) => void;
}

function Row({ conversation, selected, connected, onSelect }: RowProps) {
  const marker = connected === true ? "◆" : "○";
  const unreadVisible = conversation.unread_count > 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation.peer_node_id)}
        className={cn(
          "w-full text-left px-3 py-2",
          "flex flex-col gap-1",
          "border-b border-border/40",
          "transition-colors duration-75",
          selected === true
            ? "bg-primary text-primary-foreground"
            : "hover:bg-popover",
        )}
        aria-current={selected === true ? "true" : undefined}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <span aria-hidden className="shrink-0">
              {marker}
            </span>
            <span className="truncate font-medium">{conversation.name}</span>
          </span>
          <span className="text-[0.65rem] tabular-nums text-muted-foreground shrink-0">
            {formatRelativeDate(conversation.last_message_ts_ms)}
          </span>
        </span>
        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {truncatePreview(conversation.last_message_preview) || (
              <span className="opacity-60">no messages yet</span>
            )}
          </span>
          {unreadVisible === true ? (
            <span
              className={cn(
                "shrink-0 px-1 text-[0.65rem] tabular-nums",
                selected === true
                  ? "bg-primary-foreground text-primary"
                  : "bg-primary text-primary-foreground",
              )}
              aria-label={`${conversation.unread_count} unread`}
            >
              {conversation.unread_count}
            </span>
          ) : null}
        </span>
        <span className="text-[0.6rem] tabular-nums text-muted-foreground/80 truncate">
          {conversation.peer_node_id_short}
        </span>
      </button>
    </li>
  );
}
