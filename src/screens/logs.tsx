/**
 * LogsScreen — ⌘5 Logs tab composition.
 *
 * Spec: UI-SPEC §S5 Logs tab, §Logs tab [STATUS] badge states.
 *
 * Composes:
 *   - CliPanel title "logs" (auto-uppercased to LOGS by the primitive)
 *   - [STATUS] badge reflecting useLogsStream().status:
 *       streaming    → [STREAMING]   (default variant, signal green)
 *       reconnecting → [RECONNECTING] (muted — short-lived retry state)
 *       idle         → [IDLE]         (muted — retry exhausted)
 *     Note: "paused" is a LogList-level scroll state (UI-SPEC §S5 pill),
 *     not a CliPanel badge state — the pill copy surfaces that state.
 *   - LogFilterBar bound to hook state
 *   - LogList rendering filtered events
 *
 * Error surface: when useLogsStream reports errorMessage (post-D-31
 * retry exhaustion), render an inline destructive note instead of the
 * list. Plan 02-06 wires the dedicated toast — this inline copy is the
 * local honest-surfacing fallback until then.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { CliPanel } from "@/components/brand/cli-panel";
import { LogFilterBar } from "@/components/logs/log-filter-bar";
import { LogList } from "@/components/logs/log-list";
import { useLogsStream, type StreamStatus } from "@/hooks/use-logs-stream";
import { useFilteredLogs } from "@/hooks/use-log-filters";
import type { BadgeVariant } from "@/components/ui/badge";

interface BadgeSpec {
  label: string;
  variant: BadgeVariant;
}

function badgeFor(status: StreamStatus): BadgeSpec {
  if (status === "reconnecting") return { label: "RECONNECTING", variant: "muted" };
  if (status === "idle") return { label: "IDLE", variant: "muted" };
  // "streaming" or "paused" — CliPanel shows STREAMING; the paused scroll
  // state is communicated by the LogList pill, not the panel badge.
  return { label: "STREAMING", variant: "default" };
}

export function LogsScreen() {
  const {
    levels,
    toggleLevel,
    crates,
    toggleCrate,
    discoveredCrates,
    peerFilter,
    setPeerFilter,
    status,
    errorMessage,
  } = useLogsStream();
  // events arrive pre-filtered by levels + crates + peer + source
  // (all client-side) from useLogsStream; useFilteredLogs adds the
  // search-text + time-range filters on top per D-21 / D-22.
  const { rows } = useFilteredLogs();

  const badge = badgeFor(status);
  const hasError =
    errorMessage === null || errorMessage === undefined ? false : true;

  return (
    <div className="max-w-5xl">
      <CliPanel title="logs" status={badge}>
        <LogFilterBar
          levels={levels}
          onToggleLevel={toggleLevel}
          crates={crates}
          onToggleCrate={toggleCrate}
          discoveredCrates={discoveredCrates}
          peerFilter={peerFilter}
          onPeerFilterChange={setPeerFilter}
        />
        {hasError === true ? (
          <p className="font-code text-sm text-destructive px-4">
            Couldn't subscribe to logs.event. {errorMessage}
          </p>
        ) : (
          <LogList events={rows} />
        )}
      </CliPanel>
    </div>
  );
}
