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
}

function tokensForState(state: DaemonState): WordmarkTokens {
  switch (state) {
    case "running":
      return {
        block: "text-primary phosphor",
        text: "text-foreground",
      };
    case "starting":
    case "reconnecting":
      return {
        block: "text-accent phosphor-pulse",
        text: "text-foreground",
      };
    case "error":
      return {
        block: "text-destructive",
        text: "text-muted-foreground",
      };
    case "stopped":
    default:
      return {
        block: "text-muted-foreground",
        text: "text-muted-foreground",
      };
  }
}

export function SidebarWordmark() {
  const { snapshot } = useDaemonState();
  const tokens = tokensForState(snapshot.state);

  return (
    <div
      // Same outer rhythm as the previous static div — keeps the sidebar
      // header height stable across daemon-state transitions so nothing
      // below shifts when the block glyph re-tints.
      className="px-4 py-6 font-mono text-xl tracking-tight leading-[1.4]"
    >
      <span className={cn("inline-flex items-baseline gap-[0.5ch]")}>
        <span className={tokens.block} aria-hidden="true">
          █
        </span>
        <span className={tokens.text}>pim</span>
      </span>
    </div>
  );
}
