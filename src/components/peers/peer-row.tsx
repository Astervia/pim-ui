/**
 * <PeerRow /> — a single connected-peer row on the Dashboard Peers
 * panel (02-UI-SPEC §Peers panel, 02-CONTEXT D-11/D-12).
 *
 * Honesty contract (ROADMAP §Phase 2 success criterion 3 — non-negotiable):
 *   - state === "active"     → ◆ glyph + word; word stays text-foreground,
 *                              glyph is the signal-green + phosphor via
 *                              StatusIndicator.
 *   - state === "relayed"    → ◈ glyph + word; BOTH render text-accent.
 *                              Never the signal-green primary token, never ◆.
 *   - state === "connecting" → ○ glyph + word; both text-muted-foreground.
 *   - state === "failed"     → ✗ glyph + word; both text-destructive.
 *
 * Row shape (UI-SPEC verbatim):
 *   {short_id}  {label ?? "—"}  {mesh_ip}  via {transport}
 *   {glyph} {state}  {hops>1 ? "(N hops)" : ""}
 *   {latency_ms ? "{n}ms" : ""}  {last_seen_s}s
 *
 * Interaction:
 *   - Entire row is a real <button> (role="button", tabIndex=0, aria-label)
 *     so keyboard users can open the Peer Detail slide-over from the
 *     Peers panel (Plan 02-04 wires the onSelect callback).
 *   - Enter/Space trigger the click path.
 *   - Hover adds a subtle left-edge border and bumps the short_id to
 *     the signal-green token (UI-SPEC §Interaction §Peer row).
 *   - Focus-visible ring is inset 2px signal-green (UI-SPEC §Focus-ring
 *     policy for large click targets).
 *
 * NO border-radius, NO gradients, NO literal Tailwind palette colors.
 */

import type { PeerSummary } from "@/lib/rpc-types";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { cn } from "@/lib/utils";

export interface PeerRowProps {
  peer: PeerSummary;
  /** Wired by Plan 02-04 to open the Peer Detail slide-over; default no-op. */
  onSelect?: (peer: PeerSummary) => void;
}

// Honesty-contract colour mapping for the state word.
// Mirrors the glyph colours encoded inside <StatusIndicator />.
const STATE_WORD_CLASS: Record<PeerSummary["state"], string> = {
  active: "text-foreground",
  relayed: "text-accent",
  connecting: "text-muted-foreground",
  failed: "text-destructive",
};

export function PeerRow({ peer, onSelect }: PeerRowProps) {
  const label = peer.label === null ? "—" : peer.label;
  const hopsText = peer.route_hops > 1 ? `(${peer.route_hops} hops)` : "";
  const latencyText =
    peer.latency_ms === null ? "" : `${peer.latency_ms}ms`;

  const handleActivate = () => {
    if (onSelect === undefined) return;
    onSelect(peer);
  };

  return (
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
        "w-full grid grid-cols-[8ch_16ch_18ch_11ch_1fr_auto_auto_auto]",
        "items-center gap-x-2 px-4 py-1",
        "font-code text-sm leading-[1.5] text-left",
        "text-foreground",
        "hover:bg-popover/60 hover:border-l-2 hover:border-border-active",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
        "active:translate-y-[1px]",
        "transition-colors duration-100 ease-linear",
      )}
    >
      {/* short_id — signal-green per UI-SPEC §Interaction §Peer row */}
      <span className="text-primary">{peer.node_id_short}</span>

      <span>{label}</span>
      <span>{peer.mesh_ip}</span>
      <span className="text-muted-foreground">via {peer.transport}</span>

      {/* state glyph + word — honesty contract lives here */}
      <span className="flex items-center gap-1">
        <StatusIndicator state={peer.state} />
        <span className={STATE_WORD_CLASS[peer.state]}>{peer.state}</span>
      </span>

      <span className="text-muted-foreground">{hopsText}</span>
      <span className="text-muted-foreground">{latencyText}</span>
      <span className="text-muted-foreground">{peer.last_seen_s}s</span>
    </button>
  );
}
