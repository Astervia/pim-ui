/**
 * Phase 4 D-17: KNOWN GATEWAYS panel for the Routing screen (04-03).
 *
 * Columns: short_id · via · hops · score · selected
 *
 * Selected gateway row (gateway.selected === true) gets a leading ◆
 * glyph + `text-primary` on the short_id cell so the eye lands on it
 * (D-17 mockup). The "selected" column renders the literal word
 * `selected` on that row and an empty cell on the others — the column
 * header is the source of truth for what the glyph means.
 *
 * `short_id` is rendered as a 4+4 ellipsis (`a3c2…7f8e`) per the D-17
 * mockup convention. Daemon emits 64-char hex node_id; the prefix
 * convention used elsewhere (`PeerSummary.node_id_short`) is 8 chars,
 * but the routing screen explicitly wants the 4-then-4 form so the user
 * can spot-match start AND end of the node id when comparing log lines
 * to the routing table.
 *
 * D-30 limited mode: dims to opacity-60, flips badge to `[STALE]`.
 *
 * Empty-state copy is locked verbatim from `src/lib/copy.ts`
 * (`KNOWN_GATEWAYS_EMPTY`).
 *
 * Bang-free per D-36 — every conditional uses `=== true` / `=== null` /
 * `=== false`. Brand absolutes (no border-radius classes, no fade-blends,
 * no literal palette colors) are enforced by the audit grep gate.
 *
 * W1 contract: this component owns ZERO Tauri event subscriptions.
 */

import type { KnownGateway } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { KNOWN_GATEWAYS_EMPTY } from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface KnownGatewaysPanelProps {
  gateways: KnownGateway[];
  limitedMode?: boolean;
}

/**
 * Render an 8-char short id as `aaaa…bbbb` (D-17 mockup). When the
 * input is shorter than 8 chars, return it verbatim — defensive only;
 * the daemon never emits short ids, only 64-char node_ids.
 */
function shortId(node_id: string): string {
  if (node_id.length <= 8) return node_id;
  return `${node_id.slice(0, 4)}…${node_id.slice(-4)}`;
}

export function KnownGatewaysPanel({
  gateways,
  limitedMode = false,
}: KnownGatewaysPanelProps) {
  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : { label: `${gateways.length} GATEWAYS`, variant: "default" as const };

  return (
    <CliPanel
      title="KNOWN GATEWAYS"
      status={badge}
      className={cn(limitedMode === true && "opacity-60")}
    >
      {/* Column header — muted, uppercase, monospace, 2ch leading slot
          for the ◆ glyph on the selected row. */}
      <div
        role="presentation"
        className={cn(
          "grid grid-cols-[2ch_12ch_14ch_6ch_8ch_1fr]",
          "gap-x-2 px-4 pb-1 mb-1 border-b border-border",
          "font-mono text-xs uppercase tracking-widest text-muted-foreground",
        )}
      >
        <span></span>
        <span>short_id</span>
        <span>via</span>
        <span>hops</span>
        <span>score</span>
        <span>selected</span>
      </div>

      {gateways.length === 0 ? (
        <p className="px-4 py-2 text-muted-foreground font-code text-sm">
          {KNOWN_GATEWAYS_EMPTY}
        </p>
      ) : (
        <ul role="list" className="divide-y divide-border/30">
          {gateways.map((g) => (
            <li
              key={g.node_id}
              className={cn(
                "grid grid-cols-[2ch_12ch_14ch_6ch_8ch_1fr]",
                "gap-x-2 px-4 py-1 font-code text-sm",
              )}
            >
              <span
                className={
                  g.selected === true
                    ? "text-primary phosphor"
                    : "text-muted-foreground"
                }
                aria-label={
                  g.selected === true ? "selected gateway" : undefined
                }
              >
                {g.selected === true ? "◆" : ""}
              </span>
              <span
                className={
                  g.selected === true ? "text-primary" : "text-foreground"
                }
              >
                {shortId(g.node_id)}
              </span>
              <span className="text-muted-foreground">
                {g.via === "" ? "(direct)" : g.via}
              </span>
              <span className="text-muted-foreground">{g.hops}</span>
              <span className="text-muted-foreground">{g.score.toFixed(2)}</span>
              <span className="text-muted-foreground">
                {g.selected === true ? "selected" : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CliPanel>
  );
}
