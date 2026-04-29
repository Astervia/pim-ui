/**
 * <SidebarRowBadge /> — Phase 4 P1.5 — small bracketed badge rendered
 * between a sidebar nav row's label and its keyboard shortcut.
 *
 * Composes the existing <Badge> primitive at size="sm" (extended in this
 * phase) so the bracketing + brand discipline (rounded-none, tokens only,
 * monospace, uppercase + tracking-wider) is inherited verbatim. Three
 * tones are exposed:
 *
 *   tone="info"  → variant="muted"        — neutral counts (e.g. `[2 nearby]`)
 *   tone="warn"  → variant="destructive"  — failure counts (e.g. `[3 err]`)
 *   tone="on"    → variant="outline"      — boolean state (e.g. `[active]`)
 *
 * Copy is lowercase code-style for terseness — the Badge primitive itself
 * uppercases via `tracking-wider` + `uppercase` so the rendered output
 * matches the rest of the sidebar's chrome rhythm.
 */

import { Badge } from "@/components/ui/badge";

export type SidebarRowBadgeTone = "info" | "warn" | "on";

const TONE_TO_VARIANT = {
  info: "muted",
  warn: "destructive",
  on: "outline",
} as const;

export interface SidebarRowBadgeProps {
  tone?: SidebarRowBadgeTone;
  children: string;
}

export function SidebarRowBadge({
  tone = "info",
  children,
}: SidebarRowBadgeProps) {
  return (
    <Badge variant={TONE_TO_VARIANT[tone]} size="sm">
      {children}
    </Badge>
  );
}
