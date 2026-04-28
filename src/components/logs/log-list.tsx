/**
 * LogList — virtualized log list with Slack-style auto-scroll + jump-to-bottom
 * pill.
 *
 * Spec: UI-SPEC §S5, §Jump-to-bottom pill.
 * Decision: D-27 (react-window virtualization), D-28 (40 px sticky threshold).
 *
 * Rendering:
 *   - Input is the newest-first ring buffer from useLogsStream. This
 *     component reverses it so the DOM order is oldest-top / newest-bottom,
 *     matching the terminal convention in UI-SPEC §S5.
 *   - Wrapped in react-window VariableSizeList for bounded DOM cost at
 *     2000 rows. Each row's height is computed from the message length
 *     and the measured container width so long messages wrap onto
 *     additional lines (LINE_HEIGHT each) instead of being truncated.
 *
 * Auto-scroll behavior (D-28):
 *   - Sticky-to-bottom while the user is within 40 px of the bottom;
 *     new events trigger scrollToItem(lastIndex, "end").
 *   - User scrolls up → disengage auto-scroll, accumulate newCount.
 *   - Pill appears bottom-right with one of two copies:
 *       [ {N} new · jump to bottom ]   when newCount > 0
 *       [ paused · jump to bottom ]    when newCount === 0 but scrolled up
 *   - Clicking the pill re-engages auto-scroll + scrolls to bottom.
 *
 * Accessibility:
 *   - role="log" + aria-live that toggles between polite (auto-scroll on)
 *     and off (scrolled up — screen reader should stop narrating every
 *     incoming entry until the user re-engages). UI-SPEC §Logs list ARIA.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import type { LogEvent } from "@/lib/rpc-types";
import { LogRow } from "./log-row";
import { cn } from "@/lib/utils";

// Geometry of the LogRow grid (must stay in sync with log-row.tsx).
const LINE_HEIGHT = 22;
const LIST_HEIGHT = 400;
// JetBrains Mono at text-sm (14px) renders ~8.4px per char.
const CHAR_WIDTH = 8.4;
// Fixed columns: timestamp 100 + level 60 + peer 120.
const FIXED_COLS_PX = 100 + 60 + 120;
// gap-x-2 (8px) × 4 gaps between 5 columns.
const GAP_TOTAL_PX = 8 * 4;
// px-4 left + right.
const ROW_PADDING_X_PX = 32;
// D-28 — Slack/terminal pattern.
const STICKY_THRESHOLD_PX = 40;

function computeRowHeight(message: string, listWidth: number): number {
  if (listWidth <= 0) return LINE_HEIGHT;
  const remaining =
    listWidth - ROW_PADDING_X_PX - FIXED_COLS_PX - GAP_TOTAL_PX;
  // grid: source minmax(0,1fr) + message minmax(0,2fr) — message gets 2/3.
  const messageWidth = Math.max(0, (remaining * 2) / 3);
  const charsPerLine = Math.max(1, Math.floor(messageWidth / CHAR_WIDTH));
  // Count explicit newlines too — log messages occasionally embed them.
  const segments = message.length === 0 ? [""] : message.split("\n");
  let lines = 0;
  for (const seg of segments) {
    lines += Math.max(1, Math.ceil(seg.length / charsPerLine));
  }
  return Math.max(1, lines) * LINE_HEIGHT;
}

export interface LogListProps {
  /** Newest-first buffer from useLogsStream. */
  events: LogEvent[];
}

export function LogList({ events }: LogListProps) {
  // Reverse to oldest-top / newest-bottom for the terminal convention.
  const display = useMemo(() => [...events].reverse(), [events]);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VariableSizeList>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isSticky, setIsSticky] = useState<boolean>(true);
  const [newCount, setNewCount] = useState<number>(0);
  const prevLength = useRef<number>(display.length);

  // Track container width via ResizeObserver so row heights recompute on
  // window resize, panel resize, etc.
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

  // Reset VariableSizeList's height cache whenever the inputs that feed
  // computeRowHeight change. Without this the list keeps stale sizes.
  useLayoutEffect(() => {
    listRef.current?.resetAfterIndex(0, false);
  }, [containerWidth, display]);

  // Total height — needed to detect "at bottom" with variable sizes.
  const totalHeight = useMemo(() => {
    let sum = 0;
    for (const evt of display) sum += computeRowHeight(evt.message, containerWidth);
    return sum;
  }, [display, containerWidth]);

  // When new entries arrive, either scroll to the bottom (sticky) or
  // bump newCount so the pill surfaces the number of unseen entries.
  useEffect(() => {
    const delta = display.length - prevLength.current;
    prevLength.current = display.length;
    if (delta > 0) {
      const ref = listRef.current;
      if (isSticky === true && ref !== null) {
        ref.scrollToItem(display.length - 1, "end");
      } else {
        setNewCount((n) => n + delta);
      }
    }
  }, [display.length, isSticky]);

  const onScroll = ({
    scrollOffset,
    scrollUpdateWasRequested,
  }: {
    scrollOffset: number;
    scrollUpdateWasRequested: boolean;
  }) => {
    // Ignore programmatic scrolls (e.g. scrollToItem) — we only react to
    // user-driven wheel / keyboard / pointer scrolling.
    if (scrollUpdateWasRequested === true) return;
    const atBottom =
      scrollOffset >= totalHeight - LIST_HEIGHT - STICKY_THRESHOLD_PX;
    setIsSticky(atBottom);
    if (atBottom === true) setNewCount(0);
  };

  const jumpToBottom = () => {
    setIsSticky(true);
    setNewCount(0);
    listRef.current?.scrollToItem(display.length - 1, "end");
  };

  const getItemSize = (index: number): number => {
    const evt = display[index];
    if (evt === undefined) return LINE_HEIGHT;
    return computeRowHeight(evt.message, containerWidth);
  };

  const Row = ({ index, style }: ListChildComponentProps) => {
    const evt = display[index];
    if (evt === undefined) return null;
    return (
      <div style={style}>
        <LogRow event={evt} />
      </div>
    );
  };

  const pillVisible = isSticky === false || newCount > 0;
  const pillLabel =
    newCount > 0
      ? `[ ${newCount} new · jump to bottom ]`
      : "[ paused · jump to bottom ]";

  // 03-03 Phase 3: empty-state line when combined filters produce zero
  // rows. Verbatim copy per 03-UI-SPEC §Empty states. Replaces the
  // virtualized list (rendering with itemCount=0 produces a blank
  // rectangle which is both semantically wrong and visually odd —
  // single centered line is the intended Layer-2 affordance).
  if (display.length === 0) {
    return (
      <div
        ref={containerRef}
        role="log"
        aria-live="off"
        className="flex items-center justify-center"
        style={{ height: LIST_HEIGHT }}
      >
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          no log rows match these filters
        </span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      role="log"
      aria-live={isSticky === true ? "polite" : "off"}
    >
      <VariableSizeList
        ref={listRef}
        height={LIST_HEIGHT}
        itemCount={display.length}
        itemSize={getItemSize}
        estimatedItemSize={LINE_HEIGHT}
        width="100%"
        onScroll={onScroll}
      >
        {Row}
      </VariableSizeList>

      {pillVisible === true && (
        <button
          type="button"
          onClick={jumpToBottom}
          className={cn(
            "absolute bottom-4 right-4",
            "bg-primary text-primary-foreground border border-primary",
            "hover:bg-background hover:text-primary",
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
