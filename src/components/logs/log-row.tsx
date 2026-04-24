/**
 * LogRow — single log entry rendered as a 5-column monospace grid.
 *
 * Spec: UI-SPEC §S5 Logs tab, §Log row template, §Level-badge color map.
 *
 * Columns (UI-SPEC §S5 grid template):
 *   [100px]  timestamp (HH:mm:ss)
 *   [60px]   level word — color per level, width padded to 5 chars
 *   [1fr]    source module (e.g. transport, discovery)
 *   [120px]  peer short_id (first 8 chars) or em-dash for log entries
 *            that do not scope to a peer
 *   [1fr]    message body
 *
 * Level color map (UI-SPEC §Level-badge color map — rendered as plain
 * text, not Badge, to keep row density terminal-native):
 *   trace / debug → text-muted-foreground
 *   info          → text-foreground
 *   warn          → text-accent
 *   error         → text-destructive
 *
 * Brand rules: zero border radius, no shadows, no literal palette colors,
 * no exclamation marks in any string.
 */

import type { LogEvent, LogLevel } from "@/lib/rpc-types";
import { cn } from "@/lib/utils";

const levelColor: Record<LogLevel, string> = {
  trace: "text-muted-foreground",
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-accent",
  error: "text-destructive",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toTimeString().slice(0, 8);
}

export interface LogRowProps {
  event: LogEvent;
}

export function LogRow({ event }: LogRowProps) {
  const peerShort =
    event.peer_id === undefined || event.peer_id === null || event.peer_id === ""
      ? "—"
      : event.peer_id.slice(0, 8);

  return (
    <div
      role="listitem"
      tabIndex={0}
      className={cn(
        "grid grid-cols-[100px_60px_1fr_120px_1fr]",
        "items-center gap-x-2 px-4 py-0.5",
        "font-code text-sm leading-[1.5]",
        "hover:bg-popover/60",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
      )}
    >
      <span className="text-muted-foreground">{formatTime(event.ts)}</span>
      <span className={cn(levelColor[event.level], "uppercase")}>
        {event.level.padEnd(5)}
      </span>
      <span className="text-muted-foreground">{event.source}</span>
      <span className="text-muted-foreground">{peerShort}</span>
      <span className="text-foreground">{event.message}</span>
    </div>
  );
}
