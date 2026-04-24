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
 *   - Wrapped in react-window FixedSizeList for bounded DOM cost at
 *     2000 rows. Row height is a fixed 22 px (font-code text-sm
 *     leading-[1.5] + py-0.5 renders at approximately this density).
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

import { useEffect, useMemo, useRef, useState } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import type { LogEvent } from "@/lib/rpc-types";
import { LogRow } from "./log-row";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 22;
const LIST_HEIGHT = 400;
// D-28 — Slack/terminal pattern.
const STICKY_THRESHOLD_PX = 40;

export interface LogListProps {
  /** Newest-first buffer from useLogsStream. */
  events: LogEvent[];
}

export function LogList({ events }: LogListProps) {
  // Reverse to oldest-top / newest-bottom for the terminal convention.
  const display = useMemo(() => [...events].reverse(), [events]);
  const listRef = useRef<FixedSizeList>(null);
  const [isSticky, setIsSticky] = useState<boolean>(true);
  const [newCount, setNewCount] = useState<number>(0);
  const prevLength = useRef<number>(display.length);

  // When new entries arrive, either scroll to the bottom (sticky) or
  // bump newCount so the pill surfaces the number of unseen entries.
  useEffect(() => {
    const delta = display.length - prevLength.current;
    prevLength.current = display.length;
    if (delta > 0) {
      const ref = listRef.current;
      const canScroll = ref === null ? false : true;
      if (isSticky === true && canScroll === true) {
        (ref as FixedSizeList).scrollToItem(display.length - 1, "end");
      } else {
        setNewCount((n) => n + delta);
      }
    }
  }, [display.length, isSticky]);

  // react-window surfaces scrollOffset in the onScroll callback; compute
  // whether the user is within the sticky threshold of the bottom.
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
    const contentHeight = display.length * ROW_HEIGHT;
    const atBottom =
      scrollOffset >= contentHeight - LIST_HEIGHT - STICKY_THRESHOLD_PX;
    setIsSticky(atBottom);
    if (atBottom === true) setNewCount(0);
  };

  const jumpToBottom = () => {
    setIsSticky(true);
    setNewCount(0);
    const ref = listRef.current;
    if (ref === null ? false : true) {
      (ref as FixedSizeList).scrollToItem(display.length - 1, "end");
    }
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

  return (
    <div
      className="relative"
      role="log"
      aria-live={isSticky === true ? "polite" : "off"}
    >
      <FixedSizeList
        ref={listRef}
        height={LIST_HEIGHT}
        itemCount={display.length}
        itemSize={ROW_HEIGHT}
        width="100%"
        onScroll={onScroll}
      >
        {Row}
      </FixedSizeList>

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
