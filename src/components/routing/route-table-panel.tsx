/**
 * Phase 4 D-17: ROUTING TABLE panel for the Routing screen (04-03).
 *
 * Columns: destination · via · hops · learned_from · age
 *
 * Selected route — i.e. the route whose `via` matches the daemon's
 * `routes.selected_gateway`, or whose destination is "internet" — gets a
 * leading ◆ glyph and `text-primary` on the destination cell so the eye
 * lands on it (D-17 mockup).
 *
 * D-20 escape hatch: a `[ refresh ]` action sits at the top of the panel
 * body (CliPanel does not currently expose a `headerActions` slot, so
 * the button is rendered inline above the column header — without
 * mutating CliPanel's API). The button calls the `onRefresh` prop which
 * the consumer wires to `useRouteTable().refetch`.
 *
 * D-30 limited mode: when the daemon is not `running`, the panel dims
 * to opacity-60 and the badge flips to `[STALE]` (mirrors the Phase-2
 * convention used by IdentityPanel / PeerListPanel).
 *
 * Empty-state copy is locked verbatim from `src/lib/copy.ts`
 * (`ROUTE_TABLE_EMPTY`). The `[ refresh ]` label is also imported from
 * copy.ts (`ROUTE_TABLE_REFRESH`).
 *
 * Bang-free per D-36: every conditional uses `=== false` / `=== null` /
 * `=== true` instead of the JS negation operator. Brand absolutes (no
 * border-radius classes, no fade-blends, no literal palette colors) are
 * enforced by the audit grep gate; all signal lives in brand tokens
 * (`text-primary`, `text-muted-foreground`).
 *
 * W1 contract: this component owns ZERO Tauri event subscriptions. Data
 * is supplied via props by the parent screen (`<RouteScreen />`), which
 * reads from `useRouteTable` (a W1 fan-out joiner that registers no new
 * Tauri-side subscription).
 */

import type { RouteEntry } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { ROUTE_TABLE_EMPTY, ROUTE_TABLE_REFRESH } from "@/lib/copy";
import { useSelectedGateway } from "@/hooks/use-routing";
import { cn } from "@/lib/utils";

export interface RouteTablePanelProps {
  routes: RouteEntry[];
  onRefresh: () => void;
  loading?: boolean;
  limitedMode?: boolean;
}

export function RouteTablePanel({
  routes,
  onRefresh,
  loading = false,
  limitedMode = false,
}: RouteTablePanelProps) {
  const { id: selectedGatewayId } = useSelectedGateway();

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : { label: `${routes.length} ROUTES`, variant: "default" as const };

  return (
    <CliPanel
      title="ROUTING TABLE"
      status={badge}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {/* D-20 [ refresh ] escape hatch — rendered inline above the
          column header because CliPanel does not (currently) expose a
          headerActions slot. */}
      <div className="flex justify-end px-4 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          aria-label="refresh routing table"
          aria-disabled={loading === true ? true : undefined}
        >
          {ROUTE_TABLE_REFRESH}
        </Button>
      </div>

      {/* Column header — muted, uppercase, monospace, 2ch leading slot
          for the ◆ glyph on the selected row. */}
      <div
        role="presentation"
        className={cn(
          "grid grid-cols-[2ch_18ch_14ch_6ch_14ch_1fr]",
          "gap-x-2 px-4 pb-1 mb-1 border-b border-border",
          "font-mono text-xs uppercase tracking-widest text-muted-foreground",
        )}
      >
        <span></span>
        <span>destination</span>
        <span>via</span>
        <span>hops</span>
        <span>learned_from</span>
        <span>age</span>
      </div>

      {routes.length === 0 ? (
        <p className="px-4 py-2 text-muted-foreground font-code text-sm">
          {ROUTE_TABLE_EMPTY}
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border/30">
          {routes.map((r, i) => {
            const isSelected =
              selectedGatewayId !== null &&
              (r.via === selectedGatewayId || r.destination === "internet");
            return (
              <li
                key={`${r.destination}-${i}`}
                className={cn(
                  "grid grid-cols-[2ch_18ch_14ch_6ch_14ch_1fr]",
                  "gap-x-2 px-4 py-1 font-code text-sm",
                )}
              >
                <span
                  className={
                    isSelected === true
                      ? "text-primary phosphor"
                      : "text-muted-foreground"
                  }
                  aria-label={isSelected === true ? "selected route" : undefined}
                >
                  {isSelected === true ? "◆" : ""}
                </span>
                <span
                  className={
                    isSelected === true ? "text-primary" : "text-foreground"
                  }
                >
                  {r.destination}
                </span>
                <span className="text-muted-foreground">{r.via}</span>
                <span className="text-muted-foreground">{r.hops}</span>
                <span className="text-muted-foreground">
                  {r.learned_from === "" ? "—" : r.learned_from}
                </span>
                <span className="text-muted-foreground">
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
