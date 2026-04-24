/**
 * <MetricsPanel /> — the bottom CliPanel on the Dashboard (02-UI-SPEC §S2,
 * 02-CONTEXT D-23/D-24).
 *
 * Renders one dense metrics line:
 *   `peers {n} · forwarded {bytes} / {packets} pkts · dropped {count}[reason] · egress {short_id|local}`
 *
 * Honest rendering contract (D-23):
 *   - Zero dropped renders `dropped 0` — NO parenthesised reason clause.
 *   - No gateway (`routes.selected_gateway === null`) renders `egress local` —
 *     never the string that implies failure. "local" honestly names the
 *     local-only state.
 *   - Connected peer count = peers in state `active` OR `relayed`
 *     (same definition the Peers panel uses for its badge).
 *   - Numeric formatting goes through `formatBytes` / `formatCount` /
 *     `formatShortId` from `src/lib/format.ts` — no ad-hoc math.
 *
 * D-30 limited mode: panel dims to opacity-60; badge flips to `[STALE]`.
 *
 * Loading (status === null, D-07): single muted "Loading metrics…" line —
 * no placeholder zeros.
 */

import type { Status } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { formatBytes, formatCount, formatShortId } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MetricsPanelProps {
  status: Status | null;
  /** D-30: daemon not in `running` state — dim to 60% + flip badge to STALE. */
  limitedMode?: boolean;
}

export function MetricsPanel({ status, limitedMode = false }: MetricsPanelProps) {
  // Loading: honest placeholder, not zeros (D-07).
  if (status === null) {
    return (
      <CliPanel
        title="metrics"
        status={{ label: "WAITING", variant: "muted" }}
        className={cn(limitedMode === true && "opacity-60")}
      >
        <p className="text-muted-foreground">Loading metrics…</p>
      </CliPanel>
    );
  }

  const { peers, stats, routes } = status;

  const connectedCount = peers.filter(
    (p) => p.state === "active" || p.state === "relayed",
  ).length;

  // D-23 no-gateway: render `local`, NEVER `none`.
  const egress =
    routes.selected_gateway === null
      ? "local"
      : formatShortId(routes.selected_gateway);

  // D-23 zero-dropped: NO parenthesised reason clause.
  const droppedSegment =
    stats.dropped === 0
      ? "dropped 0"
      : stats.dropped_reason === null
        ? `dropped ${stats.dropped}`
        : `dropped ${stats.dropped} (${stats.dropped_reason})`;

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : { label: "LIVE", variant: "default" as const };

  return (
    <CliPanel
      title="metrics"
      status={badge}
      className={cn(limitedMode === true && "opacity-60")}
    >
      <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm">
        <span>peers {connectedCount}</span>
        <span className="text-muted-foreground">·</span>
        <span>
          forwarded {formatBytes(stats.forwarded_bytes)} /{" "}
          {formatCount(stats.forwarded_packets)} pkts
        </span>
        <span className="text-muted-foreground">·</span>
        <span>{droppedSegment}</span>
        <span className="text-muted-foreground">·</span>
        <span>egress {egress}</span>
      </div>
    </CliPanel>
  );
}
