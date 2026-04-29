/**
 * <RouteTablePanel /> — the routing table on the Routing screen.
 *
 * Post-redesign — node ids truncate to 4+4 ellipsis (`9efa…2bd7`) so
 * they fit fixed columns; the routing table reads cleanly without the
 * full 64-char hex blowing past the column boundary. Default routes
 * (destination === "internet" or `0.0.0.0/0`) get a `[default]` tag so
 * they're easy to spot.
 *
 * Columns (4-zone, single-line per route):
 *
 *   destination               via             hops    age
 *   ───────────────────────────────────────────────────────
 *   ◆ 10.77.0.1               9efa…2bd7       1       12s
 *   ◆ 0.0.0.0/0  [default]    9efa…2bd7       1       8s
 *
 * Selected route — i.e. the route whose `via` matches the daemon's
 * `routes.selected_gateway`, OR whose destination is "internet" /
 * "0.0.0.0/0" — gets a leading ◆ glyph and `text-primary` on the
 * destination cell.
 *
 * Refresh button removed: the route table refetches automatically on
 * route_on / route_off / gateway_selected / gateway_lost / kill_switch
 * status events (use-route-table.ts owns the fan-out join). A manual
 * refresh affordance is no longer needed at the panel chrome.
 *
 * Empty state via TeachingEmptyState (Phase 3) — locked copy.
 *
 * D-30 limited mode preserved.
 */

import type { RouteEntry } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { TeachingEmptyState } from "@/components/brand/teaching-empty-state";
import { formatDuration, formatNodeIdEllipsis } from "@/lib/format";
import { EMPTY_ROUTES_NEXT, ROUTE_TABLE_EMPTY } from "@/lib/copy";
import { useSelectedGateway } from "@/hooks/use-routing";
import { cn } from "@/lib/utils";

export interface RouteTablePanelProps {
  routes: RouteEntry[];
  /** Kept for prop compatibility; refresh affordance no longer rendered. */
  onRefresh?: () => void;
  loading?: boolean;
  limitedMode?: boolean;
}

const DEFAULT_ROUTE_DESTINATIONS = new Set([
  "0.0.0.0/0",
  "::/0",
  "internet",
  "default",
]);

function isDefaultRoute(r: RouteEntry): boolean {
  return DEFAULT_ROUTE_DESTINATIONS.has(r.destination);
}

export function RouteTablePanel({
  routes,
  limitedMode = false,
}: RouteTablePanelProps) {
  const { id: selectedGatewayId } = useSelectedGateway();

  // Sort: default routes first, then by destination alphabetical.
  const sorted = [...routes].sort((a, b) => {
    const aDefault = isDefaultRoute(a);
    const bDefault = isDefaultRoute(b);
    if (aDefault === bDefault) return a.destination.localeCompare(b.destination);
    return aDefault === true ? -1 : 1;
  });

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : {
        label: routes.length === 1 ? "1 ROUTE" : `${routes.length} ROUTES`,
        variant: "muted" as const,
      };

  return (
    <CliPanel
      title="routing table"
      status={badge}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {/* Column header — uppercase muted, monospace. Fixed widths so
          truncated ids align across rows. */}
      <div
        role="presentation"
        className={cn(
          "grid grid-cols-[2ch_minmax(20ch,1fr)_14ch_5ch_8ch]",
          "gap-x-3 px-4 pb-2 mb-1 border-b border-border",
          "font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground",
        )}
      >
        <span></span>
        <span>destination</span>
        <span>via</span>
        <span>hops</span>
        <span>age</span>
      </div>

      {sorted.length === 0 ? (
        <TeachingEmptyState
          headline={ROUTE_TABLE_EMPTY}
          next={EMPTY_ROUTES_NEXT}
        />
      ) : (
        <ul role="list" className="flex flex-col divide-y divide-border/30">
          {sorted.map((r, i) => {
            const isDefault = isDefaultRoute(r);
            const isSelected =
              selectedGatewayId !== null &&
              (r.via === selectedGatewayId || isDefault === true);
            return (
              <li
                key={`${r.destination}-${i}`}
                className={cn(
                  "grid grid-cols-[2ch_minmax(20ch,1fr)_14ch_5ch_8ch]",
                  "gap-x-3 px-4 py-2 font-code text-sm items-center",
                )}
              >
                <span
                  className={cn(
                    "text-center",
                    isSelected === true
                      ? "text-primary phosphor"
                      : "text-text-secondary",
                  )}
                  aria-label={isSelected === true ? "selected route" : undefined}
                >
                  {isSelected === true ? "◆" : ""}
                </span>
                <span className="flex items-center gap-2 min-w-0 truncate">
                  <span
                    className={cn(
                      "truncate",
                      isSelected === true ? "text-primary" : "text-foreground",
                    )}
                  >
                    {r.destination}
                  </span>
                  {isDefault === true ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-secondary border border-border px-1 py-px shrink-0">
                      default
                    </span>
                  ) : null}
                </span>
                <span className="text-text-secondary truncate">
                  {formatNodeIdEllipsis(r.via)}
                </span>
                <span className="text-text-secondary tabular-nums">
                  {r.hops}
                </span>
                <span className="text-text-secondary tabular-nums">
                  {formatDuration(r.age_s)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </CliPanel>
  );
}
