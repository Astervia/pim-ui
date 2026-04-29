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
 * Phase 4 D-24: when peer.state === "failed", a second sub-line appears
 * below the standard row. Sub-line content is the verbatim
 * HANDSHAKE_FAIL_SUBLINE constant rendered as a single nested <button>
 * that calls the Tauri shell.open with SECURITY_DOCS_URL. The nested
 * button stops event propagation so the row's primary click (open
 * Peer Detail) does not fire when the user clicks the docs link. The
 * outer element is a <div className="flex flex-col"> so the primary
 * row <button> + the sub-line <button> stack vertically without
 * breaking the primary row's CSS grid.
 *
 * Phase 6 (UI/UX P1.8 + P2.14): touch-target lift + hover progressive
 * disclosure.
 *   - Padding bumped from `px-4 py-1` to `px-4 py-2.5` so the primary
 *     row clears the ≥44px tap target threshold for pointer + touch.
 *   - On hover OR focus-visible, a secondary line slides into view
 *     below the primary content showing transport detail
 *     `via {transport} · {mesh_ip} · last seen {n}s ago`.
 *   - Per brand motion rule, height transitions go through
 *     `grid-template-rows` (collapsed `[grid-template-rows:1fr_0fr]`
 *     → expanded `[grid-template-rows:1fr_1fr]`), 100ms linear. The
 *     secondary cell uses `overflow-hidden` so its content is clipped
 *     while the row is collapsed.
 *   - The hover sub-line coexists with the existing failed-peer
 *     handshake sub-line (D-24): they carry different content
 *     (transport detail vs error guidance) and the failed sub-line
 *     stays unconditionally visible while the hover line is
 *     progressively disclosed.
 *
 * NO border-radius, NO gradients, NO literal Tailwind palette colors.
 */

import type { PeerSummary } from "@/lib/rpc-types";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { HANDSHAKE_FAIL_SUBLINE, SECURITY_DOCS_URL } from "@/lib/copy";
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
    <div className="flex flex-col">
      {/*
        Phase 6 — hover/focus progressive-disclosure wrapper.
        Two-row CSS grid where the second row collapses to 0fr by
        default and expands to 1fr on hover/focus-within. Per brand
        motion rule the height change is driven by grid-template-rows
        (not max-height / height), 100ms linear. The `group` lets the
        primary <button> and the disclosure cell share state via
        group-hover / group-focus-within.
      */}
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
            "w-full grid grid-cols-[8ch_16ch_18ch_11ch_1fr_auto_auto_auto]",
            "items-center gap-x-2 px-4 py-2.5",
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
        {/*
          Hover-disclosure cell — collapsed at 0fr until the wrapper is
          hovered or contains focus. overflow-hidden clips the content
          while collapsed; the inner padding ramps in once expanded.
          Content uses real PeerSummary fields (no invented data):
          transport, mesh_ip, last_seen_s.
        */}
        <div
          aria-hidden="true"
          className={cn(
            "overflow-hidden",
            "font-code text-xs text-muted-foreground",
            "px-4",
            "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            "transition-opacity duration-100 ease-linear",
          )}
        >
          <span>via {peer.transport}</span>
          <span> · </span>
          <span>{peer.mesh_ip}</span>
          <span> · </span>
          <span>last seen {peer.last_seen_s}s ago</span>
        </div>
      </div>
      {/* Phase 4 D-24: handshake-fail sub-line. Single implementation
          pattern — when state==="failed" the row gets a second nested
          <button> below it carrying HANDSHAKE_FAIL_SUBLINE and opening
          SECURITY_DOCS_URL via Tauri shell.open. event.stopPropagation
          on click + keydown so the row's primary onClick (open Peer
          Detail) does not fire when the user clicks the docs link. Tab
          order: primary row button THEN docs-link button. */}
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
            "px-4 pb-1 text-left",
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
