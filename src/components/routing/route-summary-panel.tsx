/**
 * <RouteSummaryPanel /> — at-a-glance summary above the routing table.
 *
 * Aggregates the data the daemon already publishes through `status` +
 * `route.table`:
 *
 *   - egress    : the selected gateway (or "local" when route_on is off
 *                 / no gateway selected)
 *   - reach     : direct vs via-relay, with hops count
 *   - routes    : active / expired breakdown
 *   - known gws : how many gateway candidates the daemon learned
 *
 * Renders as a compact KV grid so the panel reads as a quiet readout
 * rather than competing with the routing table itself.
 */

import type { KnownGateway, RouteEntry, Status } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { ScanLoader } from "@/components/brand/scan-loader";
import { formatNodeIdEllipsis } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RouteSummaryPanelProps {
  status: Status | null;
  gateways: readonly KnownGateway[];
  routes: readonly RouteEntry[];
  limitedMode?: boolean;
}

interface Row {
  label: string;
  value: React.ReactNode;
  emphasis?: "primary" | "destructive" | "default";
}

export function RouteSummaryPanel({
  status,
  gateways,
  routes,
  limitedMode = false,
}: RouteSummaryPanelProps) {
  if (status === null) {
    return (
      <CliPanel
        title="route summary"
        status={{ label: "WAITING", variant: "muted" }}
        density="compact"
        className={cn(limitedMode === true && "opacity-60")}
      >
        <ScanLoader label="loading routing summary" />
      </CliPanel>
    );
  }

  const selectedGw = gateways.find((g) => g.selected === true) ?? null;
  const routeOn = status.route_on === true;
  const selectedId = status.routes.selected_gateway;

  // Egress label — the canonical "where is my traffic going?" answer.
  let egressNode: React.ReactNode;
  let egressEmphasis: Row["emphasis"];
  if (routeOn === false) {
    egressNode = "local (mesh routing off)";
    egressEmphasis = "default";
  } else if (selectedId === null) {
    egressNode = "blocked (no gateway · kill-switch)";
    egressEmphasis = "destructive";
  } else {
    egressNode = (
      <>
        {formatNodeIdEllipsis(selectedId)}
        <span className="text-text-secondary"> · internet</span>
      </>
    );
    egressEmphasis = "primary";
  }

  const reachLabel =
    selectedGw === null
      ? "—"
      : selectedGw.hops <= 1
        ? "direct"
        : `via relay · ${selectedGw.hops} hops`;

  const expired = status.routes.expired ?? 0;
  const active = status.routes.active ?? routes.length;
  const routeCountValue =
    expired > 0 ? `${active} active · ${expired} expired` : `${active} active`;

  const gatewaysValue =
    gateways.length === 0
      ? "none"
      : gateways.length === 1
        ? "1 known"
        : `${gateways.length} known`;

  const rows: readonly Row[] = [
    { label: "egress", value: egressNode, emphasis: egressEmphasis },
    { label: "reach", value: reachLabel },
    {
      label: "routes",
      value: routeCountValue,
      emphasis: expired > 0 ? "destructive" : "default",
    },
    { label: "gateways", value: gatewaysValue },
  ];

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : routeOn === true && selectedId !== null
      ? { label: "ROUTING", variant: "default" as const }
      : { label: "IDLE", variant: "muted" as const };

  return (
    <CliPanel
      title="route summary"
      status={badge}
      density="compact"
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
