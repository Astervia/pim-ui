/**
 * <MobileTopBar /> — sticky top chrome that replaces the sidebar on
 * viewports below md (768px).
 *
 * Anatomy:
 *
 *   ┌────────────────────────────────────────┐
 *   │  [ ≡ ]    █ PIM                ◆       │   h-14, sticky
 *   │           RUNNING                      │
 *   ├────────────────────────────────────────┤
 *
 *   - left:  bracketed [ ≡ ] hamburger toggling the drawer (× when open).
 *            Bigger touch target than the previous compact icon and
 *            visually anchored with brand brackets so it reads as a
 *            real terminal action, not a generic icon button.
 *   - centre: stacked wordmark + daemon-state caption mirroring the
 *            desktop SidebarWordmark grammar (phosphor block + uppercase
 *            state caption that re-tints with daemon.state).
 *   - right: daemon state glyph (◆ active / ◐ transient / ✗ error)
 *            so the user sees liveness without opening the drawer.
 *
 * Sticky placement keeps the bar visible while scrolling long screens
 * (Logs, Settings); the desktop equivalent is the SidebarWordmark and
 * doesn't move because the sidebar is its own scroll context.
 *
 * Brand absolutes — bracketed mono actions, zero radius, tokens only.
 */

import { useDaemonState } from "@/hooks/use-daemon-state";
import { useSidebarOpen } from "@/hooks/use-sidebar-open";
import { cn } from "@/lib/utils";
import type { DaemonState } from "@/lib/daemon-state";

interface StateTokens {
  block: string;
  caption: string;
  glyph: string;
  glyphClass: string;
}

function tokensForState(state: DaemonState): StateTokens {
  switch (state) {
    case "running":
      return {
        block: "text-primary phosphor",
        caption: "text-primary",
        glyph: "◆",
        glyphClass: "text-primary phosphor",
      };
    case "starting":
    case "reconnecting":
      return {
        block: "text-accent phosphor-pulse",
        caption: "text-accent phosphor-pulse",
        glyph: "◐",
        glyphClass: "text-accent phosphor-pulse",
      };
    case "error":
      return {
        block: "text-destructive",
        caption: "text-destructive",
        glyph: "✗",
        glyphClass: "text-destructive",
      };
    case "stopped":
    default:
      return {
        block: "text-muted-foreground",
        caption: "text-muted-foreground",
        glyph: "○",
        glyphClass: "text-muted-foreground",
      };
  }
}

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

export function MobileTopBar() {
  const { open, toggle } = useSidebarOpen();
  const { snapshot } = useDaemonState();
  const tokens = tokensForState(snapshot.state);
  const caption = captionForState(snapshot.state);

  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-30",
        "flex items-center justify-between gap-4",
        // h-24 (96px) is tall enough that the macOS traffic lights at
        // y=12–28 can never visually collide with the centred content
        // row (which sits around y=48). Also gives the hero wordmark
        // real presence — phones treat this bar as the page header.
        "h-24 px-4 sm:px-5",
        "bg-card border-b border-border",
      )}
    >
      {/* Left — hamburger as a bracketed terminal action. h-14 / px-4 →
          a 56px-tall touch target with comfortable side-padding so a
          thumb tap lands reliably without overshooting. */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open === true ? "close navigation" : "open navigation"}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "h-14 px-4 min-w-[60px]",
          "font-mono text-base uppercase tracking-wider",
          "text-foreground border border-border",
          "hover:border-primary hover:text-primary",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
          "active:translate-y-[1px]",
          "transition-colors duration-100 ease-linear",
        )}
      >
        <span className="font-mono text-text-secondary text-lg leading-none">[</span>
        <span aria-hidden className="text-2xl leading-none">
          {open === true ? "×" : "≡"}
        </span>
        <span className="font-mono text-text-secondary text-lg leading-none">]</span>
      </button>

      {/* Centre — hero wordmark + state caption. text-3xl makes the
          mark unmistakable on phone screens; the caption gets generous
          0.25em tracking so the daemon-state word reads as a banner
          rather than a subtitle whisper. */}
      <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
        <div className="flex items-baseline gap-[0.4ch] font-mono text-3xl leading-none tracking-tight">
          <span className={tokens.block} aria-hidden="true">
            █
          </span>
          <span className="text-foreground">pim</span>
        </div>
        <div
          key={caption}
          className={cn(
            "font-mono text-xs uppercase tracking-[0.25em] leading-none",
            tokens.caption,
          )}
        >
          {caption}
        </div>
      </div>

      {/* Right — single state glyph at hero size (text-3xl) so daemon
          liveness is unmistakable from across the room. */}
      <span
        aria-hidden="true"
        className={cn(
          "font-mono text-3xl leading-none shrink-0",
          tokens.glyphClass,
        )}
      >
        {tokens.glyph}
      </span>
    </header>
  );
}
