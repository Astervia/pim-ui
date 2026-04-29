/**
 * <CliPanel /> — the terminal-output panel.
 *
 * First-class brand imagery (see .design/branding/pim/identity/imagery-style.md).
 * Box-drawing header with ASCII title bar. Monospace code content.
 * This is the visual hero of the pim UI — every status view should feel
 * like reading a well-designed CLI output, not a SaaS dashboard.
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
}

export function CliPanel({
  title,
  status,
  children,
  className,
  density = "default",
  emphasis = false,
}: CliPanelProps) {
  const bodyPadding =
    density === "compact"
      ? "px-4 py-3"
      : density === "spacious"
        ? "px-5 py-6"
        : "px-5 py-4";

  return (
    <section
      className={cn(
        "bg-popover border border-border text-foreground",
        "font-code text-sm leading-[1.7]",
        emphasis === true && "border-l-2 border-l-primary",
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
      <div className={cn(bodyPadding, "overflow-x-auto")}>{children}</div>
    </section>
  );
}
