/**
 * useLogFilters — Phase 3 03-03 client-side log filter atoms.
 *
 * Owns the search-text + time-range state for the Logs tab. Level / peer /
 * source filters live on the use-logs-stream module-level atoms (Phase 3
 * 03-03 refactor) and are reachable from non-hook callers via
 * `setLevelAtom` / `setPeerAtom` / `setSourceAtom`. This hook adds two
 * additional client-only filters on top of those:
 *
 *   - searchText: case-insensitive substring match across
 *       (LogEvent.message + LogEvent.source + LogEvent.peer_id) per D-21.
 *       Debounced 300 ms — `searchText` (live) updates every keystroke
 *       so the input value stays responsive; `searchTextDebounced`
 *       updates 300 ms after the last keystroke and is what feeds the
 *       filter chain in `useFilteredLogs` (see below).
 *   - timeRange: discriminated union of preset labels (last_5m /
 *       last_15m / last_1h / all / custom) and a custom { from, to }
 *       ISO range per D-22.
 *
 * The filter chain order applied in `useFilteredLogs`:
 *   1. level [server-side via use-logs-stream]
 *   2. peer  [client-side via use-logs-stream]
 *   3. source [client-side via use-logs-stream]
 *   4. searchTextDebounced [client-side, here]
 *   5. timeRange [client-side, here]
 *
 * `applyLogsFilter()` is a non-hook module function so [Show in Logs →]
 * toast actions can route a user to a pre-filtered Logs surface without
 * pulling a hook into their event handler. It writes to this atom for
 * search/text and delegates level / peer / source to the use-logs-stream
 * module-level setters. Callers pair this with
 * `setActive("logs")` from use-active-screen to navigate.
 *
 * Design rationale (mirrors use-active-screen.ts + use-logs-stream.ts
 * Phase 3 refactor): module-level atom + useSyncExternalStore so multiple
 * consumers (LogSearchInput, LogTimeRangeSelect, CustomTimeRangeDialog,
 * useFilteredLogs, DebugSnapshotButton) all read identical state.
 *
 * Bang-free per project policy — every negation as `=== null` /
 * `=== undefined` / `=== false`.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  setLevelAtom,
  setPeerAtom,
  setSourceAtom,
  useLogsStream,
} from "./use-logs-stream";
import type { LogEvent, LogLevel } from "@/lib/rpc-types";

export type TimeRangePreset =
  | "last_5m"
  | "last_15m"
  | "last_1h"
  | "all"
  | "custom";

export type LogTimeRange =
  | { kind: "preset"; preset: TimeRangePreset }
  | { kind: "custom"; from: string; to: string };

export interface LogsFilterPreset {
  source?: string;
  level?: LogLevel;
  peer_id?: string | null;
  text?: string;
}

// ─── Module-level atom ─────────────────────────────────────────────────

let searchTextLive = "";
let searchTextDebounced = "";
let timeRange: LogTimeRange = { kind: "preset", preset: "all" };
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => cb());
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSearchLive(): string {
  return searchTextLive;
}
function getSearchDebounced(): string {
  return searchTextDebounced;
}
function getTimeRange(): LogTimeRange {
  return timeRange;
}

/**
 * Non-hook module function for [Show in Logs →] toast actions
 * (checker Warning 5). Updates filter atoms but does NOT navigate —
 * callers pair this with `setActive("logs")` from use-active-screen
 * to complete the routing.
 *
 * Writes:
 *   - text → searchText (live + debounced both)
 *   - level → setLevelAtom (server-side resubscribe via the hook
 *     instance currently mounted)
 *   - peer_id → setPeerAtom (client-side filter)
 *   - source → setSourceAtom (client-side filter)
 *
 * Each field is independent — passing `{ source: "config" }` updates
 * source only; everything else stays untouched.
 */
export function applyLogsFilter(preset: LogsFilterPreset): void {
  let touchedSearch = false;
  if (preset.text !== undefined) {
    searchTextLive = preset.text;
    searchTextDebounced = preset.text;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    touchedSearch = true;
  }
  if (preset.level !== undefined) {
    setLevelAtom(preset.level);
  }
  if (preset.peer_id !== undefined) {
    setPeerAtom(preset.peer_id);
  }
  if (preset.source !== undefined) {
    setSourceAtom(preset.source);
  }
  if (touchedSearch === true) {
    notify();
  }
}

// ─── Public hook ───────────────────────────────────────────────────────

export interface UseLogFiltersReturn {
  /** Live value bound to the input — re-renders on every keystroke. */
  searchText: string;
  /** Debounced value (300 ms) fed to the filter chain. */
  searchTextDebounced: string;
  setSearchText: (s: string) => void;
  timeRange: LogTimeRange;
  setTimeRange: (r: LogTimeRange) => void;
}

export function useLogFilters(): UseLogFiltersReturn {
  const live = useSyncExternalStore(subscribe, getSearchLive, getSearchLive);
  const debounced = useSyncExternalStore(
    subscribe,
    getSearchDebounced,
    getSearchDebounced,
  );
  const range = useSyncExternalStore(subscribe, getTimeRange, getTimeRange);

  const setSearchText = useCallback((s: string) => {
    searchTextLive = s;
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchTextDebounced = s;
      debounceTimer = null;
      notify();
    }, 300);
    notify(); // fire once immediately so the input value updates live
  }, []);

  const setTR = useCallback((r: LogTimeRange) => {
    timeRange = r;
    notify();
  }, []);

  return {
    searchText: live,
    searchTextDebounced: debounced,
    setSearchText,
    timeRange: range,
    setTimeRange: setTR,
  };
}

// ─── Filter chain helper ───────────────────────────────────────────────
//
// Composes the three filter sources (use-logs-stream events already
// filtered by level + peer + source, plus this atom's debounced search +
// time range) into the final visible row list. Used by both LogList
// (rendering) and DebugSnapshotButton (filters_applied metadata).

export interface UseFilteredLogsReturn {
  rows: LogEvent[];
  searchTextDebounced: string;
  timeRange: LogTimeRange;
  level: LogLevel;
  peerFilter: string | null;
  sourceFilter: string | null;
}

/**
 * Apply the search + time-range client filters on top of the
 * level/peer/source-filtered `events` from use-logs-stream. Returns the
 * narrowed buffer plus the filter values that produced it (so callers
 * like DebugSnapshotButton can record filters_applied verbatim).
 *
 * Memoized over the underlying buffer reference + the four filter
 * values. The buffer is mutated in place by use-logs-stream (newest
 * unshifted at index 0); identity changes only on each ring-buffer
 * bump, which is exactly when re-filtering needs to happen.
 */
export function useFilteredLogs(): UseFilteredLogsReturn {
  const stream = useLogsStream();
  const filters = useLogFilters();

  const rows = useMemo(() => {
    const text = filters.searchTextDebounced.toLowerCase();
    const range = filters.timeRange;
    return stream.events.filter((evt) => {
      if (text.length > 0) {
        const haystack = (
          evt.message +
          " " +
          evt.source +
          " " +
          (evt.peer_id === undefined || evt.peer_id === null ? "" : evt.peer_id)
        ).toLowerCase();
        if (haystack.includes(text) === false) return false;
      }
      if (range.kind === "preset" && range.preset !== "all") {
        const lower = lowerBoundFor(range.preset);
        const ts = Date.parse(evt.ts);
        if (Number.isNaN(ts) === true) return true;
        if (ts < lower) return false;
      }
      if (range.kind === "custom") {
        const ts = Date.parse(evt.ts);
        const from = Date.parse(range.from);
        const to = Date.parse(range.to);
        if (Number.isNaN(ts) === true) return true;
        if (ts < from || ts > to) return false;
      }
      return true;
    });
  }, [stream.events, filters.searchTextDebounced, filters.timeRange]);

  return {
    rows,
    searchTextDebounced: filters.searchTextDebounced,
    timeRange: filters.timeRange,
    level: stream.level,
    peerFilter: stream.peerFilter,
    sourceFilter: stream.sourceFilter,
  };
}

function lowerBoundFor(preset: TimeRangePreset): number {
  const now = Date.now();
  if (preset === "last_5m") return now - 5 * 60 * 1000;
  if (preset === "last_15m") return now - 15 * 60 * 1000;
  if (preset === "last_1h") return now - 60 * 60 * 1000;
  // "all" / "custom" handled by callers; "custom" never reaches here.
  return 0;
}
