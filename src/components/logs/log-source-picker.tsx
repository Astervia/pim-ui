/**
 * LogSourcePicker — terminal-flavoured multi-select replacing the
 * previous wall of crate buttons.
 *
 * The crate filter on the Logs tab discovers crates dynamically from
 * the event stream — a fresh daemon can produce 10-20 distinct crate
 * prefixes inside the first few seconds. Rendering them as a flow-
 * wrapping row of buttons exploded the filter bar into 4-5 visual rows
 * and pushed the actual log list below the fold. This component
 * collapses that into a single trigger that opens an inline panel:
 *
 *   ┌─ source ──────────────── 11 of 11 ▾ ─┐
 *   │ [ x ] pim_bluetooth::service          │
 *   │ [ x ] pim_daemon::app                 │
 *   │ ...                                   │
 *   │ ───────────────────────────────────── │
 *   │ [ select all ]   [ clear ]            │
 *   └───────────────────────────────────────┘
 *
 * The trigger label is honest about the current state — "all 11 shown"
 * vs "4 of 11 shown" — so the user can read the filter at a glance
 * without opening the panel.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface LogSourcePickerProps {
  selected: ReadonlySet<string>;
  onToggle: (c: string) => void;
  onSetAll: (next: ReadonlySet<string>) => void;
  discovered: readonly string[];
}

export function LogSourcePicker({
  selected,
  onToggle,
  onSetAll,
  discovered,
}: LogSourcePickerProps) {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape.
  useEffect(() => {
    if (open === false) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current === null) return;
      if (ref.current.contains(e.target as Node) === false) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const total = discovered.length;
  const activeCount = selected.size === 0 ? total : selected.size;
  const isAllShown = selected.size === 0;
  const triggerLabel =
    total === 0
      ? "no sources yet"
      : isAllShown === true
        ? `all ${total} shown`
        : `${activeCount} of ${total} shown`;

  const selectAll = () => onSetAll(new Set<string>());
  const clearAll = () => onSetAll(new Set<string>(discovered));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={total === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2",
          "font-mono text-xs uppercase tracking-wider",
          "px-3 py-1.5 border bg-transparent",
          "transition-colors duration-100 ease-linear",
          "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
          total === 0
            ? "border-border text-muted-foreground opacity-50 cursor-default"
            : "border-border text-foreground hover:border-primary hover:text-primary",
        )}
      >
        <span className="text-muted-foreground">source</span>
        <span aria-hidden>·</span>
        <span>{triggerLabel}</span>
        <span aria-hidden className="ml-1 select-none">
          {open === true ? "▾" : "▸"}
        </span>
      </button>

      {open === true && total > 0 && (
        <div
          role="listbox"
          aria-label="select log sources"
          className={cn(
            "absolute z-30 mt-1 left-0 min-w-[300px] max-w-[460px]",
            "bg-popover border border-border",
            "font-code text-xs",
          )}
        >
          <div className="max-h-[260px] overflow-y-auto">
            {discovered.map((c) => {
              const active = selected.size === 0 || selected.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => onToggle(c)}
                  className={cn(
                    "w-full text-left px-3 py-1.5",
                    "flex items-center gap-2",
                    "hover:bg-muted/40",
                    "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
                  )}
                  title={c}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "font-mono select-none",
                      active === true ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    [{active === true ? "x" : " "}]
                  </span>
                  <span
                    className={cn(
                      "truncate",
                      active === true ? "text-foreground" : "text-text-secondary",
                    )}
                  >
                    {c}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-border px-3 py-2 gap-3">
            <button
              type="button"
              onClick={selectAll}
              className="font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:text-primary"
            >
              [ select all ]
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-[11px] uppercase tracking-wider text-text-secondary hover:text-primary"
            >
              [ clear ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
