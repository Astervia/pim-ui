/**
 * <ScanLoader /> — terminal-native loading affordance.
 *
 * Renders an ASCII track with a phosphor-green sweep that runs
 * left-to-right at 1.6s per cycle. Replaces the previous "Loading X…"
 * plain-text loaders, which were honest but joyless.
 *
 * The track itself is rendered as 10 monospace cells (`──────────`)
 * so the box-drawing aesthetic stays consistent with the rest of the
 * brand. The sweep is the only intentional gradient in the codebase —
 * it lives strictly inside the `.scan-loader-track::before` pseudo
 * element and is documented as the single brand-allowed exception.
 *
 * Honors prefers-reduced-motion: the sweep degrades to a static full
 * track (signalling "loading" via presence rather than motion).
 */

import { cn } from "@/lib/utils";

export interface ScanLoaderProps {
  /** Optional inline label, e.g. "Loading status…". */
  label?: string;
  /** Number of monospace cells in the track. Default 10. */
  cells?: number;
  /** Optional className for the wrapper. */
  className?: string;
}

export function ScanLoader({
  label,
  cells = 10,
  className,
}: ScanLoaderProps) {
  // Build a track of `cells` U+2500 BOX DRAWINGS LIGHT HORIZONTAL.
  const track = "─".repeat(cells);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? "loading"}
      className={cn(
        "inline-flex items-center gap-3 font-code text-sm text-muted-foreground",
        className,
      )}
    >
      <span
        className="scan-loader-track"
        style={{ ["--scan-loader-cells" as never]: String(cells) }}
        aria-hidden="true"
      >
        {track}
      </span>
      {label === undefined ? null : <span>{label}</span>}
    </span>
  );
}
