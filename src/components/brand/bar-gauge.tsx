/**
 * <BarGauge /> — terminal-native horizontal bar gauge.
 *
 * Renders a fixed-width row of monospace block-element glyphs filled
 * proportionally to `value / max`. Uses U+2588 FULL BLOCK for filled
 * cells and U+2591 LIGHT SHADE for empty cells so the gauge reads as
 * a real terminal progress bar without needing CSS bars or SVG.
 *
 *   ████████░░ 0.85
 *
 * The gauge is purely presentational — the consumer is responsible
 * for rendering the numeric label alongside if desired.
 */

import { cn } from "@/lib/utils";

export interface BarGaugeProps {
  /** Current value, expressed in the same unit as `max`. */
  value: number;
  /** Maximum value the gauge represents. Defaults to 1 (ratio mode). */
  max?: number;
  /** Number of cells in the gauge. Defaults to 10. */
  cells?: number;
  /**
   * Token color used for the filled portion. Defaults to "primary"
   * (signal green). Pass "accent" / "destructive" for warning / error
   * gauges.
   */
  tone?: "primary" | "accent" | "destructive" | "muted";
  className?: string;
  ariaLabel?: string;
}

const TONE_CLASS = {
  primary: "text-primary",
  accent: "text-accent",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
} as const;

const FILLED = "█";
const EMPTY = "░";

export function BarGauge({
  value,
  max = 1,
  cells = 10,
  tone = "primary",
  className,
  ariaLabel,
}: BarGaugeProps) {
  const ratio =
    max <= 0 ? 0 : value <= 0 ? 0 : value >= max ? 1 : value / max;
  const filledCount = Math.round(ratio * cells);
  const emptyCount = cells - filledCount;

  return (
    <span
      role={ariaLabel === undefined ? undefined : "img"}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex font-code leading-none tracking-[-0.05em]",
        className,
      )}
    >
      <span className={TONE_CLASS[tone]}>{FILLED.repeat(filledCount)}</span>
      <span className="text-muted-foreground">{EMPTY.repeat(emptyCount)}</span>
    </span>
  );
}
