/**
 * <MessageRow /> — a single line in the conversation pane.
 *
 * Sent and received variants share the same row but flip alignment +
 * prefix glyph (`>` for outbound, `<` for inbound). Status glyph for
 * outbound messages indicates lifecycle (·, ›, ✓, ✓✓, ✗).
 */

import { cn } from "@/lib/utils";
import { formatTimeOfDay, statusGlyph } from "@/lib/conversations/format";
import type { MessageRecord } from "@/lib/rpc-types";

export interface MessageRowProps {
  message: MessageRecord;
}

export function MessageRow({ message }: MessageRowProps) {
  const isOutbound = message.direction === "sent";
  const failed = message.status === "failed";
  const pending = message.status === "pending";
  const glyph = isOutbound ? ">" : "<";
  const status = isOutbound ? statusGlyph(message.status) : "";

  return (
    <div
      className={cn(
        "flex flex-col font-code text-sm leading-[1.6]",
        "px-2 py-1",
        isOutbound === true ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "max-w-[80%] flex flex-col",
          "border border-border bg-popover px-3 py-2",
          isOutbound === true && "border-l-2 border-l-primary",
          failed === true && "border-l-2 border-l-destructive",
          pending === true && "opacity-60",
        )}
      >
        <span className="whitespace-pre-wrap break-words">
          <span aria-hidden className="opacity-60 mr-1 select-none">
            {glyph}
          </span>
          {message.body}
        </span>
        <span className="mt-1 flex items-center gap-2 text-[0.65rem] tabular-nums text-muted-foreground">
          <span>{formatTimeOfDay(message.timestamp_ms)}</span>
          {status !== "" ? (
            <span
              className={cn(
                "uppercase",
                failed === true && "text-destructive",
              )}
              aria-label={`status: ${message.status}`}
            >
              {status}
            </span>
          ) : null}
          {failed === true && message.failure_reason !== null ? (
            <span className="text-destructive">{message.failure_reason}</span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
