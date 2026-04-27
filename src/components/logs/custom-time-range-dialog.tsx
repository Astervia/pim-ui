/**
 * CustomTimeRangeDialog — Phase 3 03-03 §S7 (D-22).
 *
 * Spec: 03-UI-SPEC §S7 Custom Time-Range Dialog.
 *
 * Reuses the brand-overridden Dialog primitive (Radix Dialog, NOT
 * AlertDialog — this is a non-destructive filter choice). The body
 * carries two `<input type="time">` controls (From / To) seeded from
 * the oldest / newest entries in the in-memory ring buffer (D-22).
 *
 * Apply commits the chosen range as { kind: "custom", from, to } ISO
 * strings (anchored to the current calendar day). Cancel reverts the
 * outer time-range select to whatever preset the user was on before
 * opening the dialog (checker Info 1) — no ghost state left behind.
 *
 * Buttons render with verbatim labels:
 *   - Primary `[ Apply ]` — disabled when From / To empty
 *   - Secondary `[ Cancel ]` — ghost variant
 * The brand Button primitive auto-brackets bare strings, so passing
 * the literal `[ Apply ]` and `[ Cancel ]` keeps the source-text grep
 * (`grep -q "\[ Apply \]"`) honest.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLogFilters } from "@/hooks/use-log-filters";
import { getLogsBuffer } from "@/hooks/use-logs-stream";

type RevertablePreset = "last_5m" | "last_15m" | "last_1h" | "all";

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isoForToday(time: string): string {
  // time is "HH:mm" — anchor to the current day so absolute Date math
  // works against the LogEvent.ts ISO strings (which carry the full
  // day on the wire).
  const parts = time.split(":");
  const h = Number(parts[0] ?? "0");
  const m = Number(parts[1] ?? "0");
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export interface CustomTimeRangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomTimeRangeDialog({
  open,
  onOpenChange,
}: CustomTimeRangeDialogProps) {
  const { timeRange, setTimeRange } = useLogFilters();
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  // Remember the preset the user was on before opening Custom… so
  // Cancel can revert (checker Info 1). If they were already on a
  // custom range, revert to "all".
  const [previousPreset, setPreviousPreset] =
    useState<RevertablePreset>("all");

  useEffect(() => {
    if (open === false) return;

    // Capture revert target on open so Cancel restores the prior state.
    if (timeRange.kind === "preset" && timeRange.preset !== "custom") {
      setPreviousPreset(timeRange.preset as RevertablePreset);
    } else {
      setPreviousPreset("all");
    }

    // Seed From/To from the oldest/newest entries in the ring buffer
    // (D-22). Buffer is newest-first per use-logs-stream convention.
    const buf = getLogsBuffer();
    if (buf.length === 0) {
      setFrom("");
      setTo("");
      return;
    }
    const newestEvt = buf[0];
    const oldestEvt = buf[buf.length - 1];
    const newest =
      newestEvt === undefined ? null : new Date(newestEvt.ts);
    const oldest =
      oldestEvt === undefined ? null : new Date(oldestEvt.ts);
    if (
      newest === null ||
      oldest === null ||
      Number.isNaN(newest.getTime()) === true ||
      Number.isNaN(oldest.getTime()) === true
    ) {
      setFrom("");
      setTo("");
      return;
    }
    setFrom(hhmm(oldest));
    setTo(hhmm(newest));
  }, [open, timeRange]);

  const apply = (): void => {
    if (from === "" || to === "") return;
    setTimeRange({
      kind: "custom",
      from: isoForToday(from),
      to: isoForToday(to),
    });
    onOpenChange(false);
  };

  const cancel = (): void => {
    setTimeRange({ kind: "preset", preset: previousPreset });
    onOpenChange(false);
  };

  const applyDisabled = from === "" || to === "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter by time range</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <label className="flex flex-col gap-2 font-mono text-sm">
            <span className="uppercase tracking-widest text-muted-foreground text-xs">
              From
            </span>
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="bg-transparent border border-border text-foreground font-code text-sm px-3 py-2 rounded-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2"
              aria-label="from time"
            />
          </label>
          <label className="flex flex-col gap-2 font-mono text-sm">
            <span className="uppercase tracking-widest text-muted-foreground text-xs">
              To
            </span>
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="bg-transparent border border-border text-foreground font-code text-sm px-3 py-2 rounded-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2"
              aria-label="to time"
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={cancel}>
            [ Cancel ]
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={apply}
            disabled={applyDisabled}
          >
            [ Apply ]
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
