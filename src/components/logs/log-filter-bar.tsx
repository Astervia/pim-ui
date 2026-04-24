/**
 * LogFilterBar — level segmented control + peer Select for the Logs tab.
 *
 * Spec: UI-SPEC §S5 Logs tab, §Logs tab labels + copy.
 *
 * Layout:
 *   level: [ trace ] [ debug ] [ info ] [ warn ] [ error ]
 *   peer:  ( all )            (Select dropdown)
 *
 * Level filter is a segmented-button group implemented as a
 * role="radiogroup" so arrow-keys navigate between levels and the
 * active level carries aria-checked="true". Changing the level calls
 * onLevelChange which (in the consumer) triggers a daemon-side
 * re-subscribe with the new min_level (D-26).
 *
 * Peer filter is a Select dropdown listing "( all )" plus each
 * currently-connected peer by label-or-short-id. The filter is applied
 * client-side in useLogsStream (D-26).
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

const LEVELS: LogLevel[] = ["trace", "debug", "info", "warn", "error"];

const ALL_SENTINEL = "__all__";

export interface LogFilterBarProps {
  level: LogLevel;
  onLevelChange: (level: LogLevel) => void;
  peerFilter: string | null;
  onPeerFilterChange: (peerId: string | null) => void;
}

export function LogFilterBar({
  level,
  onLevelChange,
  peerFilter,
  onPeerFilterChange,
}: LogFilterBarProps) {
  const peers = usePeers();

  const selectValue = peerFilter === null ? ALL_SENTINEL : peerFilter;
  const handlePeerChange = (value: string) => {
    onPeerFilterChange(value === ALL_SENTINEL ? null : value);
  };

  return (
    <div className="border-b border-border pb-3 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-4">
      {/* Level filter — segmented buttons (role=radiogroup for arrow-key nav) */}
      <div
        className="flex items-center gap-2"
        role="radiogroup"
        aria-label="log level"
      >
        <span className="font-code text-sm text-muted-foreground">level:</span>
        {LEVELS.map((lvl) => {
          const active = lvl === level;
          return (
            <button
              key={lvl}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onLevelChange(lvl)}
              className={cn(
                "font-mono text-xs uppercase tracking-wider px-3 py-1",
                "border transition-colors duration-100 ease-linear",
                "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
                active === true
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-transparent text-foreground border-border hover:border-primary hover:text-primary",
              )}
            >
              [ {lvl} ]
            </button>
          );
        })}
      </div>

      {/* Peer filter — Select dropdown (client-side filter per D-26). */}
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
    </div>
  );
}
