/**
 * <CliPanel /> — the terminal-output panel.
 *
 * First-class brand imagery (see .design/branding/pim/identity/imagery-style.md).
 * Box-drawing header with ASCII title bar. Monospace code content.
 * This is the visual hero of the pim UI — every status view should feel
 * like reading a well-designed CLI output, not a SaaS dashboard.
 *
 * Phase 2 motion: every panel applies the .crt-on-stagger animation on
 * first paint. Consumers can control the per-panel delay by passing
 * `revealDelay` (ms). The animation honors prefers-reduced-motion via
 * the global rule in globals.css.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

export interface CliPanelProps {
  title: string;
  status?: { label: string; variant?: BadgeVariant };
  children: ReactNode;
  className?: string;
  /**
   * Vertical rhythm preset (Phase 1 Task 1.4):
   *   - "default"  — 16px body padding (most panels).
   *   - "compact"  — 12px body padding (single-line panels like metrics).
   *   - "spacious" — 24px body padding (hero panels like identity).
   *
   * Header padding stays uniform at `px-4 py-2` across densities so the
   * box-drawing top edge reads consistently across the panel stack.
   */
  density?: "default" | "compact" | "spacious";
  /**
   * Phase 5 visual emphasis: when true, replaces the standard 1px left
   * border with a 2px primary-coloured edge to outrank neighbouring
   * panels. Used for the Dashboard `[ ON ]` route-toggle state.
   */
  emphasis?: boolean;
  /**
   * Phase 2 motion: per-panel reveal delay in milliseconds, fed into
   * the CSS variable that drives .crt-on-stagger. Default 0 — set per
   * panel by consumers (Dashboard staggers panels at 0/60/120/180ms).
   * When omitted, the panel still animates but with no delay; pass
   * `revealDelay={null}` to opt out of the animation entirely.
   */
  revealDelay?: number | null;
}

export function CliPanel({
  title,
  status,
  children,
  className,
  density = "default",
  emphasis = false,
  revealDelay = 0,
}: CliPanelProps) {
  const bodyPadding =
    density === "compact"
      ? "px-4 py-3"
      : density === "spacious"
        ? "px-5 py-6"
        : "px-5 py-4";

  const revealClass = revealDelay === null ? "" : "crt-on-stagger";
  const revealStyle =
    revealDelay === null
      ? undefined
      : ({ ["--crt-on-delay" as never]: `${revealDelay}ms` } as React.CSSProperties);

  return (
    <section
      style={revealStyle}
      className={cn(
        "@container/cli-panel",
        "bg-popover border border-border text-foreground",
        "font-code text-sm leading-[1.7]",
        emphasis === true && "border-l-2 border-l-primary",
        revealClass,
        className,
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-4",
          "px-4 py-2 border-b border-border",
          "font-mono text-xs uppercase tracking-widest",
          "text-muted-foreground",
        )}
      >
        <span>┌─── {title.toUpperCase()} ───┐</span>
        {status && <Badge variant={status.variant ?? "default"}>[{status.label}]</Badge>}
      </header>
      <div className={cn(bodyPadding, "overflow-hidden")}>{children}</div>
    </section>
  );
}
