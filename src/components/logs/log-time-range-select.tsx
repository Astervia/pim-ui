/**
 * LogTimeRangeSelect — Phase 3 03-03 row-3 time-range filter (D-22).
 *
 * Spec: 03-UI-SPEC §S6 row 3 + §Logs tab completion copy + §S7
 * Custom Time-Range Dialog.
 *
 * Five preset options verbatim per 03-UI-SPEC:
 *   - Last 5 min       → preset "last_5m"
 *   - Last 15 min      → preset "last_15m"
 *   - Last 1 hour      → preset "last_1h"
 *   - All session      → preset "all"
 *   - Custom…          → opens CustomTimeRangeDialog
 *
 * On Custom… selection, the dialog opens; the select's display
 * trigger shows `Custom (HH:mm – HH:mm)` once the user applies a
 * range.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useLogFilters,
  type LogTimeRange,
  type TimeRangePreset,
} from "@/hooks/use-log-filters";
import { CustomTimeRangeDialog } from "./custom-time-range-dialog";

export type { TimeRangePreset } from "@/hooks/use-log-filters";

export const TIME_RANGE_PRESETS: Record<TimeRangePreset, string> = {
  last_5m: "Last 5 min",
  last_15m: "Last 15 min",
  last_1h: "Last 1 hour",
  all: "All session",
  custom: "Custom…",
};

function rangeDisplay(r: LogTimeRange): string {
  if (r.kind === "preset") return TIME_RANGE_PRESETS[r.preset];
  const fmt = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()) === true) return "—";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  return `Custom (${fmt(r.from)} – ${fmt(r.to)})`;
}

export function LogTimeRangeSelect() {
  const { timeRange, setTimeRange } = useLogFilters();
  const [customOpen, setCustomOpen] = useState<boolean>(false);

  const onChange = (val: string): void => {
    if (val === "custom") {
      setCustomOpen(true);
      return;
    }
    setTimeRange({ kind: "preset", preset: val as TimeRangePreset });
  };

  const triggerValue =
    timeRange.kind === "preset" ? timeRange.preset : "custom";

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="font-code text-sm text-muted-foreground">time:</span>
        <Select value={triggerValue} onValueChange={onChange}>
          <SelectTrigger className="font-mono text-sm min-w-[160px]" aria-label="time range">
            <SelectValue>{rangeDisplay(timeRange)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_5m">Last 5 min</SelectItem>
            <SelectItem value="last_15m">Last 15 min</SelectItem>
            <SelectItem value="last_1h">Last 1 hour</SelectItem>
            <SelectItem value="all">All session</SelectItem>
            <SelectItem value="custom">Custom…</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <CustomTimeRangeDialog open={customOpen} onOpenChange={setCustomOpen} />
    </>
  );
}
