/**
 * LogFilterBar — multi-select level + multi-select crate + search +
 * peer + time-range + export bar for the Logs tab.
 *
 * Rows (top→bottom):
 *   Row 1 — level: [✓ trace] [✓ debug] [✓ info] [✓ warn] [✓ error]
 *           Each level button toggles independently. Empty selection
 *           hides everything client-side (the daemon still streams
 *           every event; the UI just hides them on render).
 *   Row 2 — crate: dynamically-discovered crate prefixes from observed
 *           events. Multi-select with the same toggle pattern.
 *   Row 3 — search: text input
 *   Row 4 — peer + time-range + export
 *
 * Filtering is 100% client-side (the daemon ships every event with
 * `min_level=trace, sources=[]`). Toggling a level or crate is
 * instant — no daemon round-trip, no history-replay duplicates.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import type { LogLevel } from "@/lib/rpc-types";
import { usePeers } from "@/hooks/use-peers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LogSearchInput } from "./log-search-input";
import { LogTimeRangeSelect } from "./log-time-range-select";
import { DebugSnapshotButton } from "./debug-snapshot-button";

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error"];

const ALL_SENTINEL = "__all__";

export interface LogFilterBarProps {
  levels: ReadonlySet<LogLevel>;
  onToggleLevel: (l: LogLevel) => void;
  crates: ReadonlySet<string>;
  onToggleCrate: (c: string) => void;
  discoveredCrates: readonly string[];
  peerFilter: string | null;
  onPeerFilterChange: (peerId: string | null) => void;
}

export function LogFilterBar({
  levels,
  onToggleLevel,
  crates,
  onToggleCrate,
  discoveredCrates,
  peerFilter,
  onPeerFilterChange,
}: LogFilterBarProps) {
  const peers = usePeers();

  const selectValue = peerFilter === null ? ALL_SENTINEL : peerFilter;
  const handlePeerChange = (value: string) => {
    onPeerFilterChange(value === ALL_SENTINEL ? null : value);
  };

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-3 mb-3 px-4">
      {/* Row 1 — multi-select level toggles. */}
      <div
        className="flex items-center gap-2 flex-wrap"
        role="group"
        aria-label="log levels"
      >
        <span className="font-code text-sm text-muted-foreground">level:</span>
        {LEVELS.map((lvl) => {
          const active = levels.has(lvl);
          return (
            <button
              key={lvl}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => onToggleLevel(lvl)}
              className={cn(
                "font-mono text-xs uppercase tracking-wider px-3 py-1",
                "border transition-colors duration-100 ease-linear",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
                active === true
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-foreground border-border hover:border-primary hover:text-primary",
              )}
            >
              [ {active === true ? "x" : " "} {lvl} ]
            </button>
          );
        })}
      </div>

      {/* Row 2 — multi-select crate toggles, auto-discovered. */}
      <div
        className="flex items-center gap-2 flex-wrap"
        role="group"
        aria-label="log crate filter"
      >
        <span className="font-code text-sm text-muted-foreground">crate:</span>
        {discoveredCrates.length === 0 ? (
          <span className="font-code text-xs text-muted-foreground">
            (none discovered yet — toggles appear as events arrive)
          </span>
        ) : (
          discoveredCrates.map((c) => {
            const active = crates.has(c);
            return (
              <button
                key={c}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => onToggleCrate(c)}
                className={cn(
                  "font-mono text-xs px-3 py-1",
                  "border transition-colors duration-100 ease-linear",
                  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
                  active === true
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-foreground border-border hover:border-primary hover:text-primary",
                )}
                title={
                  crates.size === 0
                    ? "all crates shown — click to narrow to this one"
                    : active === true
                      ? `unselect ${c}`
                      : `also include ${c}`
                }
              >
                [ {active === true ? "x" : " "} {c} ]
              </button>
            );
          })
        )}
        {crates.size > 0 ? (
          <span className="font-code text-xs text-muted-foreground ml-2">
            (showing {crates.size} of {discoveredCrates.length})
          </span>
        ) : (
          <span className="font-code text-xs text-muted-foreground ml-2">
            (all {discoveredCrates.length} shown)
          </span>
        )}
      </div>

      {/* Row 3 — text-search input (D-21). */}
      <LogSearchInput />

      {/* Row 4 — peer + time-range + export. */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-code text-sm text-muted-foreground">peer:</span>
          <Select value={selectValue} onValueChange={handlePeerChange}>
            <SelectTrigger className="font-mono text-sm min-w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SENTINEL}>( all )</SelectItem>
              {peers.map((p) => (
                <SelectItem key={p.node_id} value={p.node_id}>
                  {p.label === null || p.label === undefined || p.label === ""
                    ? p.node_id_short
                    : p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <LogTimeRangeSelect />
        <DebugSnapshotButton className="ml-auto" />
      </div>
    </div>
  );
}
