/**
 * <PeerRow /> — single connected-peer row on the Dashboard.
 *
 * Honesty contract (ROADMAP §Phase 2 success criterion 3 — non-negotiable):
 *   - active     → ◆ + green + "active"     (text-foreground word)
 *   - relayed    → ◈ + amber + "relayed"    (text-accent word)
 *   - connecting → ○ + muted + "connecting" (text-muted-foreground word)
 *   - failed     → ✗ + red   + "failed"     (text-destructive word)
 *
 * Layout (post-redesign — 4 logical zones, single line, no column header):
 *
 *   ◆ active   9efa1720…  static       tcp · 192.168.0.137:9100   7ms · 0s
 *   ◈ relayed  abc12345…  client-c     via relay-b · 2 hops      12ms · 4s
 *   ○ connect… d4f5…                   tcp · 10.77.0.5             — · 1s
 *   ✗ failed   def56789…  pair_failed                              — · 8s
 *
 * Zones:
 *   1. State badge   — glyph + word, ~14ch
 *   2. Identity      — short_id + label or static/unpaired tag, ~24ch
 *   3. Route         — transport + address OR `via {relay} · {n} hops`
 *   4. Metrics       — latency (or `—`) · last_seen (right-aligned)
 *
 * Hover progressive disclosure is preserved — a secondary line slides
 * down with the full mesh_ip + node_id when the row is hovered or
 * focused. Failed peers ALSO render the unconditional D-24 sub-line
 * with a docs link (handshake-fail guidance).
 *
 * Click anywhere on the primary row → opens the Peer Detail slide-over
 * via onSelect.
 *
 * Brand absolutes preserved: zero radius, tokens only, no shadows.
 */

import type { PeerSummary } from "@/lib/rpc-types";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { HANDSHAKE_FAIL_SUBLINE, SECURITY_DOCS_URL } from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface PeerRowProps {
  peer: PeerSummary;
  onSelect?: (peer: PeerSummary) => void;
}

const STATE_WORD_CLASS: Record<PeerSummary["state"], string> = {
  active: "text-foreground",
  relayed: "text-accent",
  connecting: "text-muted-foreground",
  failed: "text-destructive",
};

/** Best-effort label resolver. Static peers without a label render as
 *  `[ static ]` so they're visually anchored without inventing identity. */
function resolveTag(peer: PeerSummary): { kind: "label" | "static" | "tag"; value: string } {
  if (peer.label !== null && peer.label.length > 0) {
    return { kind: "label", value: peer.label };
  }
  if (peer.static === true) return { kind: "static", value: "static" };
  if (peer.state === "failed") return { kind: "tag", value: "pair_failed" };
  if (peer.state === "connecting") return { kind: "tag", value: "pairing…" };
  return { kind: "tag", value: "" };
}

/** Route summary — direct path vs via-relay. */
function resolveRoute(peer: PeerSummary): string {
  if (peer.state === "failed") return "";
  if (peer.route_hops > 1) {
    return `via relay · ${peer.route_hops} hops`;
  }
  return `${peer.transport} · ${peer.mesh_ip}`;
}

export function PeerRow({ peer, onSelect }: PeerRowProps) {
  const tag = resolveTag(peer);
  const route = resolveRoute(peer);
  const latencyText = peer.latency_ms === null ? "—" : `${peer.latency_ms}ms`;
  const lastSeenText = `${peer.last_seen_s}s`;

  const handleActivate = () => {
    if (onSelect === undefined) return;
    onSelect(peer);
  };

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "group grid grid-cols-1 [grid-template-rows:1fr_0fr]",
          "hover:[grid-template-rows:1fr_1fr]",
          "focus-within:[grid-template-rows:1fr_1fr]",
          "transition-[grid-template-rows] duration-100 ease-linear",
        )}
      >
        <button
          type="button"
          role="button"
          tabIndex={0}
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleActivate();
            }
          }}
          aria-label={`peer detail: ${peer.label === null ? peer.node_id_short : peer.label}`}
          className={cn(
            "w-full grid items-center gap-x-4 px-4 py-2.5 text-left",
            // 4-zone grid: state · identity · route · metrics
            "grid-cols-[14ch_minmax(18ch,24ch)_minmax(0,1fr)_auto]",
            "@max-[64ch]/cli-panel:grid-cols-[14ch_minmax(0,1fr)_auto]",
            "font-code text-sm leading-[1.4]",
            "text-foreground",
            "border-l-2 border-transparent",
            "hover:bg-popover/60 hover:border-l-border-active",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
            "active:translate-y-[1px]",
            "transition-colors duration-100 ease-linear",
          )}
        >
          {/* Zone 1 — state glyph + word */}
          <span className="flex items-center gap-2">
            <StatusIndicator state={peer.state} />
            <span className={STATE_WORD_CLASS[peer.state]}>{peer.state}</span>
          </span>

          {/* Zone 2 — identity (short_id + label/tag) */}
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-primary truncate">{peer.node_id_short}</span>
            {tag.value === "" ? null : (
              <span
                className={cn(
                  "truncate",
                  tag.kind === "label" && "text-foreground",
                  tag.kind === "static" &&
                    "font-mono text-[10px] uppercase tracking-wider text-text-secondary border border-border px-1 py-px",
                  tag.kind === "tag" && "text-text-secondary italic",
                )}
              >
                {tag.value}
              </span>
            )}
            {peer.is_gateway === true ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary border border-primary/60 px-1 py-px shrink-0">
                gateway
              </span>
            ) : null}
          </span>

          {/* Zone 3 — route (collapsed at narrow CliPanel width) */}
          <span className="text-text-secondary truncate @max-[64ch]/cli-panel:hidden">
            {route}
          </span>

          {/* Zone 4 — metrics, right-aligned */}
          <span className="flex items-baseline gap-2 justify-end text-text-secondary tabular-nums">
            <span>{latencyText}</span>
            <span>·</span>
            <span>{lastSeenText}</span>
          </span>
        </button>

        {/* Hover-disclosure cell — full address + node_id reveal. */}
        <div
          aria-hidden="true"
          className={cn(
            "overflow-hidden",
            "font-code text-xs text-text-secondary",
            "px-4 pl-[16px]",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            "transition-opacity duration-100 ease-linear",
          )}
        >
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 pb-1">
            <span>node_id {peer.node_id}</span>
            {peer.route_hops > 1 ? (
              <>
                <span>·</span>
                <span>address {peer.mesh_ip}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Phase 4 D-24 — handshake-fail sub-line for failed peers. */}
      {peer.state === "failed" ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void shellOpen(SECURITY_DOCS_URL);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              void shellOpen(SECURITY_DOCS_URL);
            }
          }}
          className={cn(
            "px-4 pb-1.5 text-left",
            "font-code text-xs text-destructive",
            "hover:text-foreground",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
            "transition-colors duration-100 ease-linear",
          )}
          aria-label="open security docs section 3.2"
        >
          {HANDSHAKE_FAIL_SUBLINE}
        </button>
      ) : null}
    </div>
  );
}
