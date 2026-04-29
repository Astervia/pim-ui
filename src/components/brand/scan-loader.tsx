/**
 * <ScanLoader /> — sine-wave loading indicator.
 *
 * Renders a row of `█` block-glyph cells, each bouncing vertically
 * with a phase-shifted delay so the row reads as a smooth sine wave
 * travelling left-to-right. Cycle is 2.4s with ease-in-out timing —
 * slow and soft enough not to nag the user during loading branches.
 *
 * Honors prefers-reduced-motion: cells freeze at a partial scale so
 * the loader is still visible as "something is loading" without any
 * motion firing.
 *
 * Brand: monospace, signal-green, no SVG, no gradients beyond the
 * implied vertical scale of the block character itself.
 */

import { cn } from "@/lib/utils";

export interface ScanLoaderProps {
  /** Optional inline label, e.g. "Loading status…". */
  label?: string;
  /** Number of cells in the wave. Default 14. */
  cells?: number;
  /** Optional className for the wrapper. */
  className?: string;
}

const CYCLE_MS = 2400;

export function ScanLoader({ label, cells = 14, className }: ScanLoaderProps) {
  // Stagger each cell by an even fraction of the full cycle so the
  // peaks chase across the row at constant speed.
  const step = CYCLE_MS / cells;
  const indices = Array.from({ length: cells }, (_, i) => i);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? "loading"}
      className={cn(
        "inline-flex items-center gap-3",
        "font-code text-sm text-text-secondary",
        className,
      )}
    >
      <span className="sine-loader" aria-hidden>
        {indices.map((i) => (
          <span
            key={i}
            className="sine-loader-cell text-primary"
            style={{ animationDelay: `${i * step}ms` }}
          >
            █
          </span>
        ))}
      </span>
      {label === undefined ? null : <span>{label}</span>}
    </span>
  );
}
