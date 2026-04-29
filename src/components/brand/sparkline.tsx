/**
 * <Sparkline /> — terminal-native ASCII sparkline.
 *
 * Renders a series of monospace block-glyphs that map a numeric history
 * to the 8-step Unicode block-element scale (▁▂▃▄▅▆▇█). Width is the
 * number of samples; vertical resolution is fixed at 8 rows.
 *
 * Used wherever a panel wants to show a trend at a glance — throughput,
 * peer count, drop rate. Honors the brand: no SVG, no canvas, no
 * gradients — just monospace glyphs in a single token color.
 *
 * Empty/insufficient history renders an empty placeholder of `width`
 * spaces so the layout doesn't shift when samples land.
 */

import { cn } from "@/lib/utils";

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

export interface SparklineProps {
  /** History samples — older first, newest last. */
  samples: readonly number[];
  /** Optional explicit width (default: samples.length). */
  width?: number;
  /** Optional className for the wrapper. */
  className?: string;
  /** Optional ARIA label describing the metric. */
  ariaLabel?: string;
}

export function Sparkline({
  samples,
  width,
  className,
  ariaLabel,
}: SparklineProps) {
  const cells = width === undefined ? samples.length : width;
  if (cells <= 0) return null;

  // Empty state — render a single muted bottom-row across `cells` so
  // the surrounding layout stays stable while waiting for data.
  if (samples.length === 0) {
    return (
      <span
        aria-hidden={ariaLabel === undefined ? true : undefined}
        aria-label={ariaLabel}
        className={cn(
          "inline-block font-code text-text-secondary",
          className,
        )}
      >
        {"▁".repeat(cells)}
      </span>
    );
  }

  // If we have fewer samples than cells, left-pad with empty space so
  // the trend is right-aligned (newest at the right edge).
  const trailing = samples.slice(-cells);
  const max = trailing.reduce((m, v) => (v > m ? v : m), 0);
  const min = trailing.reduce((m, v) => (v < m ? v : m), trailing[0] ?? 0);
  const range = max - min;
  const safeRange = range === 0 ? 1 : range;

  const padCount = cells - trailing.length;
  const padding = padCount > 0 ? " ".repeat(padCount) : "";
  const glyphs = trailing
    .map((v) => {
      const norm = (v - min) / safeRange;
      const idx = Math.round(norm * (BLOCKS.length - 1));
      const safe = idx < 0 ? 0 : idx >= BLOCKS.length ? BLOCKS.length - 1 : idx;
      return BLOCKS[safe];
    })
    .join("");

  return (
    <span
      role={ariaLabel === undefined ? undefined : "img"}
      aria-label={ariaLabel}
      className={cn(
        "inline-block font-code text-primary leading-none tracking-[-0.02em]",
        className,
      )}
    >
      {padding}
      {glyphs}
    </span>
  );
}
