/**
 * LogRow — single (or grouped) log entry rendered as a terminal row.
 *
 * Redesign — what changed from the original:
 *
 *   1. A 2 px coloured rail on the leftmost edge encodes severity at a
 *      glance. trace/debug → muted, info → border-active, warn → accent,
 *      error → destructive. Reading the rail down the page tells you
 *      where the noise sits before you read a single character.
 *
 *   2. The level cell is rendered as a 3-letter chip — `INF`, `DBG`,
 *      `WRN`, `ERR`, `TRC` — with a coloured outline that mirrors the
 *      rail. Padding-stable so columns line up regardless of severity.
 *
 *   3. The source/crate cell uses smart middle-truncation — for a long
 *      name like `pim_daemon::app::discovery_tasks` it shows
 *      `pim_daemon::…::discovery_tasks` so the head AND tail stay
 *      readable. Full name on title hover and inside the expanded view.
 *
 *   4. The peer cell collapses to nothing when peer_id is missing —
 *      no more 120px column of em-dashes wasting horizontal space.
 *      When present, peer renders as a chip showing the 8-char short
 *      id.
 *
 *   5. Grouped consecutive duplicates (LogList computes the grouping)
 *      surface as `× N` in an accent chip on the trailing edge of the
 *      message. Clicking the row reveals the underlying timestamps and
 *      the (shared) message body in a structured key/value block.
 *
 *   6. Density-aware: in `compact` mode the message is single-line
 *      truncated with a tooltip; in `comfortable` mode it wraps onto
 *      multiple lines naturally.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { useState } from "react";
import type { LogEvent, LogLevel } from "@/lib/rpc-types";
import type { LogDensity } from "./log-toolbar";
import { cn } from "@/lib/utils";

const LEVEL_RAIL: Record<LogLevel, string> = {
  trace: "bg-muted",
  debug: "bg-muted",
  info: "bg-border-active",
  warn: "bg-accent",
  error: "bg-destructive",
};

const LEVEL_TEXT: Record<LogLevel, string> = {
  trace: "text-text-secondary",
  debug: "text-text-secondary",
  info: "text-foreground",
  warn: "text-accent",
  error: "text-destructive",
};

const LEVEL_BORDER: Record<LogLevel, string> = {
  trace: "border-border",
  debug: "border-border",
  info: "border-border-active",
  warn: "border-accent",
  error: "border-destructive",
};

const LEVEL_ABBR: Record<LogLevel, string> = {
  trace: "TRC",
  debug: "DBG",
  info: "INF",
  warn: "WRN",
  error: "ERR",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toTimeString().slice(0, 8);
}

function formatTimeMs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--.---";
  const time = d.toTimeString().slice(0, 8);
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${time}.${ms}`;
}

/**
 * Smart middle-truncate. Long crate names like
 * `pim_daemon::app::discovery_tasks` get clipped in the middle so both
 * the crate root and the leaf module stay readable.
 */
function smartTruncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${s.slice(0, head)}…${s.slice(s.length - tail)}`;
}

/** Click intent emitted by the row when the user presses on the body
 *  (everything outside the chevron / expanded panel). LogList interprets
 *  these against the current selection state to handle Ctrl/Cmd toggle
 *  and Shift range-select. */
export type RowSelectModifier = "single" | "toggle" | "range";

export interface LogRowProps {
  /** Newest event in the group (or the only event when count=1). */
  event: LogEvent;
  /** All events in this group, oldest-to-newest. count = events.length. */
  events: readonly LogEvent[];
  /** Group cardinality — count > 1 means consecutive duplicates collapsed. */
  count: number;
  density: LogDensity;
  expanded: boolean;
  onToggleExpand: () => void;
  /** Hide the timestamp when this row shares the second with the row above. */
  hideTimestamp: boolean;
  /** True when this row is part of the LogList's current selection. */
  selected: boolean;
  /** Fired when the user clicks the row body. The modifier flag tells
   *  LogList how to interpret the click against the current selection. */
  onSelect: (modifier: RowSelectModifier) => void;
}

const SOURCE_MAX_COMPACT = 28;
const SOURCE_MAX_COMFORT = 40;

export function LogRow({
  event,
  events,
  count,
  density,
  expanded,
  onToggleExpand,
  hideTimestamp,
  selected,
  onSelect,
}: LogRowProps) {
  const [copyOk, setCopyOk] = useState<boolean>(false);
  const peerShort =
    event.peer_id === undefined || event.peer_id === null || event.peer_id === ""
      ? null
      : event.peer_id.slice(0, 8);

  const sourceMax =
    density === "compact" ? SOURCE_MAX_COMPACT : SOURCE_MAX_COMFORT;
  const sourceDisplay = smartTruncate(event.source, sourceMax);

  const fields = event.fields;
  const hasFields =
    fields !== undefined && fields !== null && Object.keys(fields).length > 0;
  const expandable = hasFields === true || count > 1 || event.message.length > 80;

  const onRowClick = (e: React.MouseEvent) => {
    // Modifier-aware row click. Ctrl (Win/Linux) / Cmd (macOS) → toggle
    // in multi-selection. Shift → range-select from the LogList anchor.
    // Plain click → single-select (or deselect if it's the sole one).
    if (e.shiftKey === true) {
      onSelect("range");
      return;
    }
    if (e.metaKey === true || e.ctrlKey === true) {
      onSelect("toggle");
      return;
    }
    onSelect("single");
  };

  const onRowDoubleClick = (e: React.MouseEvent) => {
    if (expandable === false) return;
    // Don't let the dblclick bubble to native text-selection range
    // expansion when our explicit affordance is the chevron.
    e.preventDefault();
    onToggleExpand();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      // Enter expands the focused row when there's something to reveal.
      if (expandable === true) {
        e.preventDefault();
        onToggleExpand();
      }
      return;
    }
    if (e.key === " ") {
      // Space toggles the row in the selection.
      e.preventDefault();
      onSelect(e.shiftKey === true ? "range" : "toggle");
    }
  };

  const onChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand();
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${formatTimeMs(event.ts)} ${event.level.toUpperCase()} ${event.source}${
          peerShort === null ? "" : ` peer=${peerShort}`
        } ${event.message}`,
      );
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 1200);
    } catch {
      setCopyOk(false);
    }
  };

  return (
    <div
      role="listitem"
      tabIndex={0}
      onClick={onRowClick}
      onDoubleClick={onRowDoubleClick}
      onKeyDown={onKey}
      aria-expanded={expandable === true ? expanded : undefined}
      aria-selected={selected}
      data-selected={selected === true ? true : undefined}
      className={cn(
        "group relative h-full",
        "font-code text-[13px] leading-[20px]",
        "border-b border-border/40",
        // Clip any sub-pixel overflow so the row never bleeds into its
        // neighbour even if the height estimate is imperfect.
        "overflow-hidden",
        "cursor-pointer select-none",
        // Selection wins over hover — bg-primary/10 reads as a steady
        // green tint without losing the severity rail's color cue.
        selected === true
          ? "bg-primary/[0.10] hover:bg-primary/[0.14]"
          : "hover:bg-popover/60",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
      )}
    >
      {/* Severity rail — full-height vertical stripe on the left. */}
      <span
        aria-hidden
        className={cn("absolute left-0 top-0 bottom-0 w-[2px]", LEVEL_RAIL[event.level])}
      />

      <div
        className={cn(
          "flex gap-3 pl-4 pr-4 py-1.5",
          density === "compact" ? "items-center" : "items-start",
        )}
      >
        {/* Timestamp — muted, hidden when consecutive same-second to reduce noise. */}
        <span
          className={cn(
            "shrink-0 w-[72px] tabular-nums",
            hideTimestamp === true ? "text-transparent" : "text-muted-foreground",
          )}
          title={formatTimeMs(event.ts)}
        >
          {formatTime(event.ts)}
        </span>

        {/* Level chip — 3 letters, colored outline. */}
        <span
          className={cn(
            "shrink-0 px-1.5 py-0 border text-[10px] tracking-widest font-mono",
            LEVEL_BORDER[event.level],
            LEVEL_TEXT[event.level],
          )}
        >
          {LEVEL_ABBR[event.level]}
        </span>

        {/* Source chip — smart middle-truncated by JS, then CSS-truncated
         *  as a safety net so the chip can never bleed onto the message
         *  column even if the text width exceeds the box width by a few
         *  pixels. inline-block + overflow-hidden is what makes the
         *  max-width ceiling enforceable on a span inside a flex row. */}
        <span
          className={cn(
            "shrink-0 inline-block align-bottom",
            "px-2 py-0",
            "border border-border/60 bg-muted/30",
            "text-text-secondary",
            "overflow-hidden text-ellipsis whitespace-nowrap",
            density === "compact" ? "max-w-[26ch]" : "max-w-[38ch]",
          )}
          title={event.source}
        >
          {sourceDisplay}
        </span>

        {/* Peer chip — only renders when present, no wasted column. */}
        {peerShort !== null && (
          <span
            className={cn(
              "shrink-0 inline-block align-bottom",
              "px-2 py-0 border border-border/60 text-text-secondary",
              "overflow-hidden text-ellipsis whitespace-nowrap",
            )}
            title={event.peer_id ?? ""}
          >
            peer·{peerShort}
          </span>
        )}

        {/* Message body — primary content. Bounded line count per density:
         *  compact = 1 line truncated, comfortable = up to 3 lines via
         *  line-clamp. The expanded panel reveals the full message. The
         *  bounded line-count keeps row heights deterministic which is
         *  what the virtualized list needs. */}
        <span
          className={cn(
            "flex-1 min-w-0 text-foreground break-words",
            density === "compact"
              ? "truncate whitespace-nowrap"
              : "whitespace-pre-wrap line-clamp-3",
          )}
          title={event.message}
        >
          {event.message}
        </span>

        {/* Group count — accent chip when consecutive duplicates collapsed. */}
        {count > 1 && (
          <span
            className="shrink-0 px-1.5 py-0 border border-accent text-accent font-mono text-[11px] tracking-wider"
            title={`${count} consecutive identical events`}
          >
            × {count}
          </span>
        )}

        {/* Expand chevron — only shown when there's something extra to
         *  reveal. Owns its own onClick + stopPropagation so a click on
         *  the chevron expands without also triggering row selection. */}
        {expandable === true ? (
          <button
            type="button"
            onClick={onChevronClick}
            aria-label={expanded === true ? "collapse details" : "expand details"}
            className={cn(
              "shrink-0 w-4 h-4 inline-flex items-center justify-center",
              "select-none bg-transparent border-none p-0",
              "text-muted-foreground hover:text-primary",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
              "transition-colors duration-100 ease-linear",
            )}
          >
            <span aria-hidden>{expanded === true ? "▾" : "▸"}</span>
          </button>
        ) : (
          <span aria-hidden className="shrink-0 w-4" />
        )}
      </div>

      {/* Expanded panel — fields, full source/peer, copy. Capped at
       *  EXPANDED_PANEL_MAX_PX with internal scroll so the row's total
       *  height stays predictable for the virtualized list. */}
      {expanded === true && expandable === true && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "ml-4 mr-4 mb-2 border-l border-border-active",
            "bg-popover/40",
            "max-h-[220px] overflow-y-auto",
          )}
        >
          <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-1 px-3 py-2 text-[12px]">
            <dt className="text-muted-foreground uppercase tracking-widest text-[10px]">
              timestamp
            </dt>
            <dd className="text-foreground tabular-nums">{formatTimeMs(event.ts)}</dd>

            <dt className="text-muted-foreground uppercase tracking-widest text-[10px]">
              source
            </dt>
            <dd className="text-foreground break-all">{event.source}</dd>

            {peerShort !== null && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest text-[10px]">
                  peer
                </dt>
                <dd className="text-foreground break-all">{event.peer_id}</dd>
              </>
            )}

            <dt className="text-muted-foreground uppercase tracking-widest text-[10px]">
              message
            </dt>
            <dd className="text-foreground whitespace-pre-wrap break-words">
              {event.message}
            </dd>

            {hasFields === true && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest text-[10px]">
                  fields
                </dt>
                <dd className="text-foreground">
                  <pre className="whitespace-pre-wrap break-words text-[12px] leading-[18px] m-0">
                    {JSON.stringify(fields, null, 2)}
                  </pre>
                </dd>
              </>
            )}

            {count > 1 && (
              <>
                <dt className="text-muted-foreground uppercase tracking-widest text-[10px]">
                  occurrences
                </dt>
                <dd className="text-foreground">
                  <ol className="m-0 list-none p-0 space-y-0.5">
                    {events.map((e, i) => (
                      <li
                        key={`${e.ts}-${i}`}
                        className="text-text-secondary tabular-nums"
                      >
                        {formatTimeMs(e.ts)}
                      </li>
                    ))}
                  </ol>
                </dd>
              </>
            )}
          </dl>
          <div className="flex items-center gap-2 px-3 pb-2">
            <button
              type="button"
              onClick={onCopy}
              className={cn(
                "font-mono text-[11px] uppercase tracking-wider px-2 py-1 border",
                "transition-colors duration-100 ease-linear",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
                copyOk === true
                  ? "border-primary text-primary"
                  : "border-border text-text-secondary hover:border-primary hover:text-primary",
              )}
            >
              [ {copyOk === true ? "copied" : "copy line"} ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
