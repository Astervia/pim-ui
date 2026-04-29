/**
 * <NetworkInsightsPanel /> — the periphery KV grid that replaces the
 * single-line MetricsPanel on the Dashboard.
 *
 * Shows four pairs in a tight 2-column key/value grid:
 *   forwarded   → "{bytes} / {pkts} pkts"
 *   dropped     → "{n}" or "{n} ({reason})" (text-destructive when > 0)
 *   routes      → "{n} active"
 *   egress      → "{short_id}" or "local"
 *
 * Uses CliPanel density="compact" so the panel reads as a quiet readout
 * at the bottom of the dashboard rather than competing with peers.
 */

import type { Status } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { ScanLoader } from "@/components/brand/scan-loader";
import { formatBytes, formatCount, formatShortId } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NetworkInsightsPanelProps {
  status: Status | null;
  limitedMode?: boolean;
  /** Phase 2/5 — staggered reveal delay forwarded to CliPanel. */
  revealDelay?: number | null;
}

interface Row {
  label: string;
  value: string;
  emphasis?: "destructive" | "primary" | "default";
}

export function NetworkInsightsPanel({
  status,
  limitedMode = false,
  revealDelay = 0,
}: NetworkInsightsPanelProps) {
  if (status === null) {
    return (
      <CliPanel
        title="network"
        status={{ label: "WAITING", variant: "muted" }}
        density="compact"
        revealDelay={revealDelay}
        className={cn(limitedMode === true && "opacity-60")}
      >
        <ScanLoader label="loading network" />
      </CliPanel>
    );
  }

  const { stats, routes } = status;

  const egress =
    routes.selected_gateway === null
      ? "local"
      : formatShortId(routes.selected_gateway);

  const droppedValue =
    stats.dropped === 0
      ? "0"
      : stats.dropped_reason === null
        ? `${stats.dropped}`
        : `${stats.dropped} (${stats.dropped_reason})`;

  const rows: readonly Row[] = [
    {
      label: "forwarded",
      value: `${formatBytes(stats.forwarded_bytes)} / ${formatCount(stats.forwarded_packets)} pkts`,
    },
    {
      label: "dropped",
      value: droppedValue,
      emphasis: stats.dropped > 0 ? "destructive" : "default",
    },
    {
      label: "routes",
      value: `${routes.active} active`,
    },
    {
      label: "egress",
      value: egress,
      emphasis: routes.selected_gateway === null ? "default" : "primary",
    },
  ];

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : { label: "LIVE", variant: "muted" as const };

  return (
    <CliPanel
      title="network"
      status={badge}
      density="compact"
      revealDelay={revealDelay}
      className={cn(limitedMode === true && "opacity-60")}
    >
      <dl className="grid grid-cols-[10ch_1fr] gap-x-4 gap-y-1.5 font-code text-sm">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground self-center">
              {r.label}
            </dt>
            <dd
              className={cn(
                "font-code",
                r.emphasis === "destructive" && "text-destructive",
                r.emphasis === "primary" && "text-primary",
                (r.emphasis === undefined || r.emphasis === "default") &&
                  "text-foreground",
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </CliPanel>
  );
}
