/**
 * <SidebarWordmark /> — Phase 4 P1.5 — live status surface for the
 * sidebar header. Replaces the static `█ pim` div in <Sidebar /> with a
 * glyph + wordmark whose color tier reflects the current daemon state.
 *
 * Color mapping (state → token):
 *   running                  → text-primary  + .phosphor (steady glow)
 *   starting / reconnecting  → text-accent   + .phosphor-pulse (transient)
 *   error                    → text-destructive (no glow)
 *   stopped                  → text-muted-foreground (no glow)
 *
 * The block glyph U+2588 is the visual signal — the "pim" wordmark
 * inherits the same hue but renders one tier lower in saturation
 * (text-foreground muted vs text-primary glowing) so the block stays
 * the focal element. Per the master plan, the cursor-blink animation
 * is reserved for the splash logo only — sidebar wordmark stays a
 * static text glyph (no `.logo-hero` class).
 *
 * W1 invariant preserved — this component reads `useDaemonState`
 * (existing hook) and never opens a new Tauri listener.
 */

import { useDaemonState } from "@/hooks/use-daemon-state";
import { cn } from "@/lib/utils";
import type { DaemonState } from "@/lib/daemon-state";

interface WordmarkTokens {
  /** Class for the U+2588 block glyph — color + optional glow utility. */
  block: string;
  /** Class for the lowercase "pim" letters — slightly desaturated tier. */
  text: string;
  /** Class for the daemon-state caption rendered under the wordmark. */
  caption: string;
}

function tokensForState(state: DaemonState): WordmarkTokens {
  switch (state) {
    case "running":
      return {
        block: "text-primary phosphor",
        text: "text-foreground",
        caption: "text-primary",
      };
    case "starting":
    case "reconnecting":
      return {
        block: "text-accent phosphor-pulse",
        text: "text-foreground",
        caption: "text-accent phosphor-pulse",
      };
    case "error":
      return {
        block: "text-destructive",
        text: "text-muted-foreground",
        caption: "text-destructive",
      };
    case "stopped":
    default:
      return {
        block: "text-muted-foreground",
        text: "text-muted-foreground",
        caption: "text-muted-foreground",
      };
  }
}

/**
 * Daemon-state caption rendered as a thin lowercase tag below the
 * wordmark. Provides instant context ("running", "stopped", etc.)
 * without enlarging the wordmark itself. Empty string for the very
 * first paint before the snapshot resolves.
 */
function captionForState(state: DaemonState): string {
  switch (state) {
    case "running":
      return "running";
    case "starting":
      return "starting…";
    case "reconnecting":
      return "reconnecting…";
    case "error":
      return "error";
    case "stopped":
    default:
      return "stopped";
  }
}

export function SidebarWordmark() {
  const { snapshot } = useDaemonState();
  const tokens = tokensForState(snapshot.state);
  const caption = captionForState(snapshot.state);

  return (
    <div
      // Top padding clears the macOS traffic-light triplet (≈12px from
      // the window top, ≈70px wide). `pt-12 px-6` parks the wordmark
      // safely below them with breathing room. Bottom padding leaves a
      // generous gap before the box-drawing rule and the nav cluster.
      className="pt-12 pb-3 px-6 font-mono leading-[1.1]"
    >
      <div className="flex items-baseline gap-[0.5ch] text-3xl tracking-tight">
        <span className={tokens.block} aria-hidden="true">
          █
        </span>
        <span className={tokens.text}>pim</span>
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[10px] uppercase tracking-[0.2em]",
          tokens.caption,
        )}
        aria-live="polite"
      >
        {caption}
      </div>
    </div>
  );
}
