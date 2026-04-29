/**
 * LogSeverityRail — five severity toggles with live counts derived from
 * the full ring buffer.
 *
 * Replaces the old uniform-green level-buttons row. Each toggle is now
 * colour-coded by its semantic level so the rail reads as a histogram:
 *
 *   level [ x trace 12 ] [ x debug 84 ] [ x info 412 ] [ x warn 3 ] [ x error 0 ]
 *
 * Counts come from the FULL buffer (not the post-filter rows) so the
 * label tells the user "this is what was logged at this level so far",
 * independent of search / time / peer / source filters. Toggling a
 * level still narrows the visible list client-side.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import type { LogEvent, LogLevel } from "@/lib/rpc-types";
import { cn } from "@/lib/utils";

const LEVELS: readonly LogLevel[] = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
];

const ACTIVE_BY_LEVEL: Record<LogLevel, string> = {
  trace: "bg-muted text-foreground border-muted",
  debug: "bg-muted text-foreground border-muted",
  info: "bg-primary text-primary-foreground border-primary",
  warn: "bg-accent text-accent-foreground border-accent",
  error: "bg-destructive text-destructive-foreground border-destructive",
};

const TEXT_BY_LEVEL: Record<LogLevel, string> = {
  trace: "text-text-secondary",
  debug: "text-text-secondary",
  info: "text-foreground",
  warn: "text-accent",
  error: "text-destructive",
};

export interface LogSeverityRailProps {
  levels: ReadonlySet<LogLevel>;
  onToggle: (l: LogLevel) => void;
  /** Full buffer (newest-first). Counts derive from this. */
  events: readonly LogEvent[];
}

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function LogSeverityRail({
  levels,
  onToggle,
  events,
}: LogSeverityRailProps) {
  const counts: Record<LogLevel, number> = {
    trace: 0,
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };
  for (const evt of events) counts[evt.level] += 1;

  return (
    <div
      className="flex items-center gap-2 flex-wrap"
      role="group"
      aria-label="log levels"
    >
      <span className="font-code text-xs uppercase tracking-widest text-muted-foreground">
        level
      </span>
      {LEVELS.map((lvl) => {
        const active = levels.has(lvl);
        const count = counts[lvl];
        const empty = count === 0;
        return (
          <button
            key={lvl}
            type="button"
            role="checkbox"
            aria-checked={active}
            onClick={() => onToggle(lvl)}
            disabled={empty}
            className={cn(
              "font-mono text-[11px] uppercase tracking-wider",
              "px-2 py-1 border",
              "transition-colors duration-100 ease-linear",
              "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
              empty === true && "opacity-40 cursor-default",
              empty === false &&
                (active === true
                  ? ACTIVE_BY_LEVEL[lvl]
                  : cn(
                      "bg-transparent border-border hover:border-primary",
                      TEXT_BY_LEVEL[lvl],
                    )),
              empty === true && "bg-transparent border-border text-muted-foreground",
            )}
          >
            <span className="select-none">[ </span>
            <span aria-hidden className="select-none">
              {active === true && empty === false ? "x" : " "}
            </span>
            <span className="select-none"> </span>
            <span>{lvl}</span>
            <span className="opacity-60"> {formatCount(count)}</span>
            <span className="select-none"> ]</span>
          </button>
        );
      })}
    </div>
  );
}
