/**
 * SettingsClusterDivider — typographic separator between domain clusters
 * on the Settings page.
 *
 * Pure visual rhythm. No interaction, no toggle, no skill-tier label —
 * the divider just frames a thematic group with a lowercase title and a
 * one-line tagline so the user can read the page as a small set of
 * domains rather than a flat wall of 13 panels.
 *
 *   ──── core ──── who I am · where my data lives ──────────────────
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { cn } from "@/lib/utils";

export interface SettingsClusterDividerProps {
  /** Short lowercase title — e.g. "reach", "traffic". */
  title: string;
  /** Plain-language framing of the cluster. */
  tagline: string;
  /** id used to anchor scroll-to-cluster from the nav. */
  anchor: string;
  /** When the cluster has fewer-than-all sections matching the active
   *  search query, surface a small `n/m match` badge so the user can
   *  see at a glance which clusters were narrowed. */
  matchCount?: { matched: number; total: number };
  className?: string;
}

export function SettingsClusterDivider({
  title,
  tagline,
  anchor,
  matchCount,
  className,
}: SettingsClusterDividerProps) {
  const showMatch =
    matchCount !== undefined && matchCount.matched !== matchCount.total;
  return (
    <div
      id={anchor}
      role="presentation"
      className={cn(
        "flex items-baseline gap-3 pt-3 pb-1",
        // First cluster sits flush with the top of the content column;
        // subsequent ones get a hairline rule above for cadence.
        "first:pt-0",
        "[&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/50 [&:not(:first-child)]:mt-2",
        className,
      )}
    >
      <span
        aria-hidden
        className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground select-none"
      >
        ────
      </span>
      <h2 className="font-mono text-xs uppercase tracking-[0.22em] text-foreground">
        {title}
      </h2>
      <span aria-hidden className="font-mono text-[10px] text-muted-foreground">
        ────
      </span>
      <p className="font-code text-[11px] text-text-secondary leading-tight truncate">
        {tagline}
      </p>
      {showMatch === true && (
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-accent">
          {matchCount.matched}/{matchCount.total} match
        </span>
      )}
    </div>
  );
}
