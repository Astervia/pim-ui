/**
 * LogList — virtualized log list with grouping, density, expand-on-click,
 * row selection (Ctrl/Shift) + Ctrl+C copy, and Slack-style auto-scroll
 * + jump-to-bottom pill.
 *
 * Spec: UI-SPEC §S5, §Jump-to-bottom pill.
 * Decision: D-27 (react-window virtualization), D-28 (40 px sticky threshold).
 *
 * Features:
 *
 *   1. **Consecutive-duplicate grouping** — adjacent events sharing
 *      level + source + peer_id + message collapse into one row with a
 *      `× N` count chip. The expanded panel reveals each timestamp.
 *
 *   2. **Density toggle** (compact / comfortable). Compact mode pins
 *      every row to a single 33 px line with truncated message + tooltip.
 *      Comfortable mode allows up to 3 wrapped lines via line-clamp.
 *
 *   3. **Smart timestamp deduping** — adjacent groups sharing
 *      `HH:mm:ss` show only the first row's timestamp. Tooltip on the
 *      visible timestamp still shows ms precision.
 *
 *   4. **Multi-row selection** — click selects (single), Cmd/Ctrl+click
 *      adds to selection, Shift+click range-selects from the anchor.
 *      A floating selection bar surfaces in the bottom-left when any
 *      row is selected with `[ N selected · ⌘C copy · clear ]`.
 *
 *   5. **Ctrl+C / Cmd+C copy** — when the keyboard focus is anywhere
 *      inside this list (not in an input), the standard copy chord
 *      writes the selected rows to the clipboard, formatted as one
 *      newline-separated record per occurrence:
 *
 *        2026-04-29T01:47:42.001Z INFO  pim_daemon::app peer=9efa1720 daemon starting
 *        2026-04-29T01:47:42.018Z WARN  pim_discovery::service - broadcast failed
 *
 *      Grouped duplicates expand into N records, one per occurrence,
 *      so the clipboard reflects what actually happened on the wire.
 *
 *   6. **Pause auto-scroll** — pausing flips off auto-tail. New events
 *      still land in the buffer; the `[ N new · jump to bottom ]` pill
 *      becomes the only path to catch up until the user un-pauses.
 *
 *   7. **Jump-to-bottom pill** with new-event counter + paused tag.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { toast } from "sonner";
import type { LogEvent } from "@/lib/rpc-types";
import type { LogDensity } from "./log-toolbar";
import { LogRow } from "./log-row";
import { cn } from "@/lib/utils";

const LIST_HEIGHT = 480;

const STICKY_THRESHOLD_PX = 40;

// Row geometry — must mirror log-row.tsx exactly.
const LINE_PX = 20;
const ROW_PADDING_Y = 12;
const ROW_BORDER_BOTTOM = 1;
const ONE_LINE_HEIGHT = ROW_PADDING_Y + LINE_PX + ROW_BORDER_BOTTOM; // = 33

const ROW_HEIGHT_COMPACT = ONE_LINE_HEIGHT;
const COMFORT_MAX_LINES = 3;

const EXPANDED_PANEL_PX = 220 + 8;

const CHAR_WIDTH = 7.8;

interface LogGroup {
  key: string;
  events: LogEvent[];
  rep: LogEvent;
  hideTimestamp: boolean;
}

function groupKey(e: LogEvent): string {
  const peer = e.peer_id ?? "";
  return `${e.level}|${e.source}|${peer}|${e.message}`;
}

function groupConsecutive(events: readonly LogEvent[]): LogGroup[] {
  const out: LogGroup[] = [];
  let prevTimeBucket = "";
  for (let i = 0; i < events.length; i += 1) {
    const evt = events[i];
    if (evt === undefined) continue;
    const last = out[out.length - 1];
    if (last !== undefined && groupKey(last.rep) === groupKey(evt)) {
      last.events.push(evt);
      last.rep = evt;
      continue;
    }
    const repTime = evt.ts.slice(11, 19);
    out.push({
      key: `${i}|${evt.ts}|${groupKey(evt)}`,
      events: [evt],
      rep: evt,
      hideTimestamp: repTime === prevTimeBucket,
    });
    prevTimeBucket = repTime;
  }
  return out;
}

const APPROX_NON_MESSAGE_PX = 16 + 72 + 12 + 36 + 12 + 96 + 12 + 56 + 12 + 16;
function estimateMessageLines(msg: string, listWidth: number): number {
  if (listWidth <= 0) return 1;
  const messageWidth = Math.max(80, listWidth - APPROX_NON_MESSAGE_PX);
  const charsPerLine = Math.max(20, Math.floor(messageWidth / CHAR_WIDTH));
  if (msg.length === 0) return 1;
  const segs = msg.split("\n");
  let lines = 0;
  for (const seg of segs) {
    lines += Math.max(1, Math.ceil(seg.length / charsPerLine));
  }
  return Math.max(1, lines);
}

/**
 * Format a single LogEvent as a clipboard-ready line. ISO timestamp +
 * level + source + (peer if present) + message, joined by single
 * spaces. The level is right-padded to 5 chars so a column of mixed
 * INFO/WARN/ERROR pasted into a text editor lines up cleanly.
 */
function formatEventForCopy(e: LogEvent): string {
  const lvl = e.level.toUpperCase().padEnd(5);
  const peer =
    e.peer_id === undefined || e.peer_id === null || e.peer_id === ""
      ? ""
      : ` peer=${e.peer_id}`;
  return `${e.ts} ${lvl} ${e.source}${peer} ${e.message}`;
}

export interface LogListProps {
  events: LogEvent[];
  density: LogDensity;
  paused: boolean;
}

export function LogList({ events, density, paused }: LogListProps) {
  const groups = useMemo<LogGroup[]>(() => {
    const ordered = [...events].reverse();
    return groupConsecutive(ordered);
  }, [events]);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VariableSizeList>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isSticky, setIsSticky] = useState<boolean>(true);
  const [newCount, setNewCount] = useState<number>(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const prevLength = useRef<number>(groups.length);

  // Selection state — set of group keys + last-clicked anchor for shift.
  const [selection, setSelection] = useState<ReadonlySet<string>>(new Set());
  const [anchorKey, setAnchorKey] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el === null) return;
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    listRef.current?.resetAfterIndex(0, false);
  }, [containerWidth, groups, expanded, density]);

  const rowHeight = (idx: number): number => {
    const g = groups[idx];
    if (g === undefined) return ROW_HEIGHT_COMPACT;

    let topH: number;
    if (density === "compact") {
      topH = ROW_HEIGHT_COMPACT;
    } else {
      const lines = Math.min(
        COMFORT_MAX_LINES,
        Math.max(1, estimateMessageLines(g.rep.message, containerWidth)),
      );
      topH = ROW_PADDING_Y + lines * LINE_PX + ROW_BORDER_BOTTOM;
    }

    if (expanded.has(g.key)) return topH + EXPANDED_PANEL_PX;
    return topH;
  };

  const totalHeight = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < groups.length; i += 1) sum += rowHeight(i);
    return sum;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, expanded, density, containerWidth]);

  useEffect(() => {
    const delta = groups.length - prevLength.current;
    prevLength.current = groups.length;
    if (delta > 0) {
      const ref = listRef.current;
      if (paused === false && isSticky === true && ref !== null) {
        ref.scrollToItem(groups.length - 1, "end");
      } else {
        setNewCount((n) => n + delta);
      }
    }
  }, [groups.length, isSticky, paused]);

  const onScroll = ({
    scrollOffset,
    scrollUpdateWasRequested,
  }: {
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }) => {
    if (scrollUpdateWasRequested === true) return;
    const atBottom =
      scrollOffset >= totalHeight - LIST_HEIGHT - STICKY_THRESHOLD_PX;
    setIsSticky(atBottom);
    if (atBottom === true) setNewCount(0);
  };

  const jumpToBottom = () => {
    setIsSticky(true);
    setNewCount(0);
    listRef.current?.scrollToItem(groups.length - 1, "end");
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectRow = useCallback(
    (key: string, idx: number, modifier: "single" | "toggle" | "range") => {
      if (modifier === "range" && anchorKey !== null) {
        const anchorIdx = groups.findIndex((g) => g.key === anchorKey);
        if (anchorIdx === -1) {
          setSelection(new Set([key]));
          setAnchorKey(key);
          return;
        }
        const from = Math.min(anchorIdx, idx);
        const to = Math.max(anchorIdx, idx);
        const next = new Set<string>();
        for (let i = from; i <= to; i += 1) {
          const g = groups[i];
          if (g !== undefined) next.add(g.key);
        }
        setSelection(next);
        return;
      }
      if (modifier === "toggle") {
        setSelection((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
        setAnchorKey(key);
        return;
      }
      // "single" — replace selection with just this row, OR clear if it
      // was already the sole selected row.
      setSelection((prev) => {
        if (prev.size === 1 && prev.has(key)) return new Set();
        return new Set([key]);
      });
      setAnchorKey(key);
    },
    [groups, anchorKey],
  );

  const clearSelection = useCallback(() => {
    setSelection(new Set());
    setAnchorKey(null);
  }, []);

  const copySelection = useCallback(async (): Promise<void> => {
    if (selection.size === 0) return;
    const lines: string[] = [];
    for (const g of groups) {
      if (selection.has(g.key) === false) continue;
      // Each occurrence inside a grouped duplicate becomes its own line
      // — the clipboard mirrors what actually happened on the wire,
      // not the deduped UI presentation.
      for (const e of g.events) lines.push(formatEventForCopy(e));
    }
    if (lines.length === 0) return;
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      const groupCount = selection.size;
      const lineCount = lines.length;
      const summary =
        groupCount === lineCount
          ? `${groupCount} row${groupCount === 1 ? "" : "s"}`
          : `${groupCount} group${groupCount === 1 ? "" : "s"} · ${lineCount} lines`;
      toast.success(`copied ${summary}`, { duration: 2000 });
    } catch (e) {
      toast.error(
        `copy failed — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [groups, selection]);

  // Global Cmd/Ctrl+C handler — only intercepts when nothing else is
  // editing text. The clipboard call is async; the keydown handler
  // doesn't await it (toasts arrive on resolution).
  useEffect(() => {
    if (selection.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey === false && e.ctrlKey === false) || e.key !== "c") return;
      const target = e.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          target.isContentEditable === true
        ) {
          // Let the native copy do its thing inside the focused field.
          return;
        }
      }
      e.preventDefault();
      void copySelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection.size, copySelection]);

  // Escape clears the selection.
  useEffect(() => {
    if (selection.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const target = e.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
      }
      e.preventDefault();
      clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection.size, clearSelection]);

  const Row = ({ index, style }: ListChildComponentProps) => {
    const g = groups[index];
    if (g === undefined) return null;
    return (
      <div style={style}>
        <LogRow
          event={g.rep}
          events={g.events}
          count={g.events.length}
          density={density}
          expanded={expanded.has(g.key)}
          onToggleExpand={() => toggleExpand(g.key)}
          hideTimestamp={g.hideTimestamp}
          selected={selection.has(g.key)}
          onSelect={(modifier) => selectRow(g.key, index, modifier)}
        />
      </div>
    );
  };

  if (groups.length === 0) {
    return (
      <div
        ref={containerRef}
        role="log"
        aria-live="off"
        className="flex flex-col items-center justify-center gap-2"
        style={{ height: LIST_HEIGHT }}
      >
        <pre
          aria-hidden
          className="font-code text-muted-foreground text-[11px] leading-tight m-0"
        >
{`     ┌──────────────┐
     │  ··· silence ·│
     └──────────────┘`}
        </pre>
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          no log rows match these filters
        </span>
        <span className="font-code text-[11px] text-text-secondary">
          try widening the level rail or clearing the search
        </span>
      </div>
    );
  }

  const pillVisible = isSticky === false || newCount > 0;
  const pillLabel =
    paused === true && newCount > 0
      ? `[ paused · ${newCount} new · jump to bottom ]`
      : newCount > 0
        ? `[ ${newCount} new · jump to bottom ]`
        : "[ jump to bottom ]";

  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  const copyChord = isMac === true ? "⌘C" : "Ctrl+C";
  const selectionLabel =
    selection.size === 1
      ? `1 row selected · ${copyChord} copy · esc clears`
      : `${selection.size} rows selected · ${copyChord} copy · esc clears`;

  return (
    <div
      ref={containerRef}
      className="relative"
      role="log"
      aria-live={isSticky === true && paused === false ? "polite" : "off"}
    >
      <VariableSizeList
        ref={listRef}
        height={LIST_HEIGHT}
        itemCount={groups.length}
        itemSize={rowHeight}
        estimatedItemSize={ROW_HEIGHT_COMPACT}
        width="100%"
        onScroll={onScroll}
      >
        {Row}
      </VariableSizeList>

      {/* Selection toolbar — bottom-left, mirrors the jump pill on the right. */}
      {selection.size > 0 && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "absolute bottom-3 left-4 inline-flex items-center gap-2",
            "bg-popover border border-primary text-foreground",
            "px-2 py-1 font-mono text-[11px] uppercase tracking-wider",
          )}
        >
          <span className="text-primary">▮</span>
          <span>{selectionLabel}</span>
          <button
            type="button"
            onClick={() => void copySelection()}
            className={cn(
              "px-2 py-0.5 border border-border bg-transparent text-text-secondary",
              "hover:border-primary hover:text-primary",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
              "transition-colors duration-100 ease-linear",
            )}
            title={`copy as text · ${copyChord}`}
          >
            ⎘ copy
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className={cn(
              "px-2 py-0.5 border border-transparent text-text-secondary",
              "hover:text-primary",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
              "transition-colors duration-100 ease-linear",
            )}
            title="clear selection · esc"
          >
            × clear
          </button>
        </div>
      )}

      {pillVisible === true && (
        <button
          type="button"
          onClick={jumpToBottom}
          className={cn(
            "absolute bottom-3 right-4",
            paused === true
              ? "bg-accent text-accent-foreground border border-accent"
              : "bg-primary text-primary-foreground border border-primary",
            paused === true
              ? "hover:bg-background hover:text-accent"
              : "hover:bg-background hover:text-primary",
            "px-3 py-1 font-mono text-xs uppercase tracking-wider",
            "transition-colors duration-100 ease-linear",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
          )}
        >
          {pillLabel}
        </button>
      )}
    </div>
  );
}
