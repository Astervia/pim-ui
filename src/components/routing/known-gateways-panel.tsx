/**
 * <KnownGatewaysPanel /> — gateways the daemon learned via routing
 * advertisements, on the Routing screen.
 *
 * Post-redesign — single-line rows with a 4+4-truncated id, score
 * rendered as a horizontal block-glyph bar gauge, and a `[selected]`
 * tag inline rather than a dedicated column. Latency is enriched from
 * `usePeers()` when the gateway happens to also be a directly
 * connected peer (multi-hop gateways have no latency to surface).
 *
 *   ┌─── GATEWAYS ─────────────────[2 known]──┐
 *   │ gateway     reach        score    age   │
 *   │ ───────────────────────────────────     │
 *   │ ◆ 9efa…2bd7 direct · 6ms ████████░░ 0.85│
 *   │             [selected]                  │
 *   │   abc1…ef23 via relay 2h ██████░░░░ 0.62│
 *   └─────────────────────────────────────────┘
 *
 * The panel surfaces the score as a visualisation (BarGauge) AND a
 * numeric value so a researcher can compare against the kernel's
 * gateway-selection heuristic without losing the at-a-glance read.
 *
 * D-30 limited mode preserved.
 */

import type { KnownGateway } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { BarGauge } from "@/components/brand/bar-gauge";
import { TeachingEmptyState } from "@/components/brand/teaching-empty-state";
import { usePeers } from "@/hooks/use-peers";
import { formatNodeIdEllipsis } from "@/lib/format";
import { EMPTY_GATEWAYS_NEXT, KNOWN_GATEWAYS_EMPTY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface KnownGatewaysPanelProps {
  gateways: KnownGateway[];
  limitedMode?: boolean;
}

export function KnownGatewaysPanel({
  gateways,
  limitedMode = false,
}: KnownGatewaysPanelProps) {
  const peers = usePeers();

  const enriched = gateways.map((g) => {
    const peer = peers.find((p) => p.node_id === g.node_id);
    return {
      ...g,
      latencyMs: peer?.latency_ms ?? null,
    };
  });

  // Sort: selected first, then by score descending.
  const sorted = [...enriched].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected === true ? -1 : 1;
    return b.score - a.score;
  });

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : {
        label: gateways.length === 1 ? "1 KNOWN" : `${gateways.length} KNOWN`,
        variant: "muted" as const,
      };

  return (
    <CliPanel
      title="gateways"
      status={badge}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {sorted.length === 0 ? (
        <TeachingEmptyState
          headline={KNOWN_GATEWAYS_EMPTY}
          next={EMPTY_GATEWAYS_NEXT}
        />
      ) : (
        <>
          {/* Column header */}
          <div
            role="presentation"
            className={cn(
              "grid grid-cols-[2ch_14ch_minmax(0,1fr)_minmax(14ch,18ch)]",
              "gap-x-3 px-4 pb-2 mb-1 border-b border-border",
              "font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground",
            )}
          >
            <span></span>
            <span>gateway</span>
            <span>reach</span>
            <span>score</span>
          </div>

          <ul role="list" className="flex flex-col divide-y divide-border/30">
            {sorted.map((g) => {
              const reachLabel =
                g.hops <= 1
                  ? g.latencyMs === null
                    ? "direct"
                    : `direct · ${g.latencyMs}ms`
                  : `via relay · ${g.hops} hops`;
              return (
                <li
                  key={g.node_id}
                  className={cn(
                    "grid grid-cols-[2ch_14ch_minmax(0,1fr)_minmax(14ch,18ch)]",
                    "gap-x-3 px-4 py-2 font-code text-sm items-center",
                  )}
                >
                  <span
                    className={cn(
                      "text-center",
                      g.selected === true
                        ? "text-primary phosphor"
                        : "text-text-secondary",
                    )}
                    aria-label={
                      g.selected === true ? "selected gateway" : undefined
                    }
                  >
                    {g.selected === true ? "◆" : ""}
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "truncate",
                        g.selected === true ? "text-primary" : "text-foreground",
                      )}
                    >
                      {formatNodeIdEllipsis(g.node_id)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 min-w-0 text-text-secondary">
                    <span className="truncate">{reachLabel}</span>
                    {g.selected === true ? (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-primary border border-primary/60 px-1 py-px shrink-0">
                        selected
                      </span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2 justify-end">
                    <BarGauge
                      value={g.score}
                      max={1}
                      cells={8}
                      tone={g.selected === true ? "primary" : "muted"}
                      ariaLabel={`gateway score ${g.score.toFixed(2)}`}
                    />
                    <span className="text-text-secondary tabular-nums w-[4ch] text-right">
                      {g.score.toFixed(2)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </CliPanel>
  );
}
