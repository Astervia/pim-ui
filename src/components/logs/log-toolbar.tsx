/**
 * LogToolbar — primary control surface for the Logs tab.
 *
 * Three horizontal bands, each with consistent control heights so the
 * row reads as a single grid rather than a flow-wrap of mismatched
 * widgets. Every interactive control is h-8 (32 px) — search input,
 * pause toggle, density group, export, source picker, peer select,
 * time select, clear. Visual weight is reserved for the search input
 * (the workspace hero) and the severity rail (the most-used filter);
 * everything else is secondary outline grammar so the eye lands on
 * the data, not the chrome.
 *
 *   ┌── search.................................. [▶ live] [▤▦] [export] ─┐
 *   │ level [trace 0] [debug 0] [info 1.1k] [warn 208] [error 0]         │
 *   │ source 11/11 ▾    peer all ▾    time all session ▾    [clear]      │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import type { LogEvent, LogLevel } from "@/lib/rpc-types";
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
import { LogSeverityRail } from "./log-severity-rail";
import { LogSourcePicker } from "./log-source-picker";
import { DebugSnapshotButton } from "./debug-snapshot-button";

const ALL_PEER_SENTINEL = "__all__";

export type LogDensity = "compact" | "comfortable";

export interface LogToolbarProps {
  levels: ReadonlySet<LogLevel>;
  onToggleLevel: (l: LogLevel) => void;
  crates: ReadonlySet<string>;
  onToggleCrate: (c: string) => void;
  onSetCrates: (next: ReadonlySet<string>) => void;
  discoveredCrates: readonly string[];
  peerFilter: string | null;
  onPeerFilterChange: (peerId: string | null) => void;
  events: readonly LogEvent[];
  density: LogDensity;
  onDensityChange: (next: LogDensity) => void;
  paused: boolean;
  onPausedChange: (next: boolean) => void;
  filtersDirty: boolean;
  onClearFilters: () => void;
}

/**
 * Shared button shape for every secondary control on the toolbar so
 * the row aligns rigidly. h-8 (32 px), 1 px border, font-mono [11px]
 * uppercase tracking-wider, transparent background that flips to a
 * primary outline on hover.
 */
const SECONDARY_BTN = cn(
  "inline-flex items-center gap-1.5 h-8 px-3",
  "font-mono text-[11px] uppercase tracking-wider",
  "border bg-transparent",
  "transition-colors duration-100 ease-linear",
  "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
);

export function LogToolbar({
  levels,
  onToggleLevel,
  crates,
  onToggleCrate,
  onSetCrates,
  discoveredCrates,
  peerFilter,
  onPeerFilterChange,
  events,
  density,
  onDensityChange,
  paused,
  onPausedChange,
  filtersDirty,
  onClearFilters,
}: LogToolbarProps) {
  const peers = usePeers();
  const peerSelectValue = peerFilter === null ? ALL_PEER_SENTINEL : peerFilter;
  const handlePeerChange = (value: string) => {
    onPeerFilterChange(value === ALL_PEER_SENTINEL ? null : value);
  };

  const peerLabel =
    peerFilter === null
      ? "all"
      : (peers.find((p) => p.node_id === peerFilter)?.label ??
        peers.find((p) => p.node_id === peerFilter)?.node_id_short ??
        peerFilter.slice(0, 8));

  return (
    <div className="flex flex-col gap-2.5 border-b border-border pb-3 px-4 pt-3">
      {/* Band 1 — search hero + utility cluster, all h-8 aligned */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <LogSearchInput />
        </div>

        <button
          type="button"
          onClick={() => onPausedChange(paused === false)}
          aria-pressed={paused}
          className={cn(
            SECONDARY_BTN,
            paused === true
              ? "bg-accent text-accent-foreground border-accent"
              : "border-border text-text-secondary hover:border-primary hover:text-primary",
          )}
          title={
            paused === true
              ? "auto-scroll paused — new lines collect at the bottom"
              : "click to pause auto-scroll"
          }
        >
          <span aria-hidden>{paused === true ? "■" : "▶"}</span>
          <span>{paused === true ? "paused" : "live"}</span>
        </button>

        <DensityToggle density={density} onChange={onDensityChange} />

        <DebugSnapshotButton />
      </div>

      {/* Band 2 — severity rail */}
      <LogSeverityRail
        levels={levels}
        onToggle={onToggleLevel}
        events={events}
      />

      {/* Band 3 — source · peer · time · clear, also h-8 aligned */}
      <div className="flex items-center gap-2 flex-wrap">
        <LogSourcePicker
          selected={crates}
          onToggle={onToggleCrate}
          onSetAll={onSetCrates}
          discovered={discoveredCrates}
        />

        <Select value={peerSelectValue} onValueChange={handlePeerChange}>
          <SelectTrigger
            className="h-8 px-3 py-0 font-mono text-[11px] uppercase tracking-wider min-w-[140px]"
            aria-label="peer filter"
          >
            <SelectValue>
              <span className="text-muted-foreground">peer</span>
              <span aria-hidden> · </span>
              <span>{peerLabel}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PEER_SENTINEL}>( all peers )</SelectItem>
            {peers.map((p) => (
              <SelectItem key={p.node_id} value={p.node_id}>
                {p.label === null || p.label === undefined || p.label === ""
                  ? p.node_id_short
                  : p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <LogTimeRangeSelect />

        {filtersDirty === true && (
          <button
            type="button"
            onClick={onClearFilters}
            className={cn(
              SECONDARY_BTN,
              "ml-auto border-transparent text-text-secondary hover:text-primary",
            )}
          >
            <span aria-hidden>×</span>
            <span>clear filters</span>
          </button>
        )}
      </div>
    </div>
  );
}

interface DensityToggleProps {
  density: LogDensity;
  onChange: (next: LogDensity) => void;
}

function DensityToggle({ density, onChange }: DensityToggleProps) {
  return (
    <div
      role="group"
      aria-label="row density"
      className="inline-flex h-8 border border-border"
    >
      {(["compact", "comfortable"] as const).map((d) => {
        const active = density === d;
        return (
          <button
            key={d}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(d)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5",
              "h-full px-2.5",
              "font-mono text-[11px] uppercase tracking-wider",
              "transition-colors duration-100 ease-linear",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
              active === true
                ? "bg-foreground text-background"
                : "bg-transparent text-text-secondary hover:text-primary",
            )}
            title={d === "compact" ? "single-line rows" : "wrapped rows"}
          >
            <span aria-hidden>{d === "compact" ? "▤" : "▦"}</span>
            <span>{d === "compact" ? "tight" : "wrap"}</span>
          </button>
        );
      })}
    </div>
  );
}
