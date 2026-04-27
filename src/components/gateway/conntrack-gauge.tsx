/**
 * <ConntrackGauge /> — ASCII bar gauge per 05-CONTEXT D-12 + RESEARCH §9a.
 *
 * Renders:
 *   conntrack
 *   [████████████░░░░░░░░░░░░░░░░░░░░] 1,247 / 4,096 (30%)
 *
 * 32-char bar (each char ≈ 3.125%). Filled char █ U+2588 FULL BLOCK,
 * empty char ░ U+2591 LIGHT SHADE. Square brackets ASCII (matching the
 * existing [STATUS] badge bracket idiom).
 *
 * Color thresholds applied to the FILLED portion only (the empty portion
 * stays text-muted-foreground to keep the rail visible at low utilization):
 *   < 80%   → text-foreground
 *   ≥ 80%   → text-accent     (amber)
 *   ≥ 95%   → text-destructive (red) AND parent badge flips [NEAR LIMIT]
 *
 * Accessibility: WCAG 4.1.2 — wraps in role="meter" with aria-valuenow /
 * aria-valuemin / aria-valuemax / aria-label.
 */

import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";

const BAR_WIDTH = 32;
const FILLED = "█"; // U+2588
const EMPTY = "░"; // U+2591

export interface ConntrackGaugeProps {
  used: number;
  max: number;
}

export function ConntrackGauge({ used, max }: ConntrackGaugeProps) {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, used / safeMax));
  const filledChars = Math.floor(ratio * BAR_WIDTH);
  const emptyChars = BAR_WIDTH - filledChars;
  const pct = Math.floor(ratio * 100);

  const fillColor =
    pct >= 95
      ? "text-destructive"
      : pct >= 80
        ? "text-accent"
        : "text-foreground";

  return (
    <div
      role="meter"
      aria-valuenow={used}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label="conntrack utilization"
      className="font-code text-sm leading-[1.7]"
    >
      <p className="text-foreground">conntrack</p>
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">[</span>
        <span className={cn(fillColor)}>{FILLED.repeat(filledChars)}</span>
        <span className="text-muted-foreground">{EMPTY.repeat(emptyChars)}</span>
        <span className="text-muted-foreground">]</span>
        <span className="text-foreground">
          {`${formatCount(used)} / ${formatCount(max)} (${pct}%)`}
        </span>
      </div>
    </div>
  );
}

/**
 * gaugeBadgeLabel — exposed so the parent CliPanel can flip [ACTIVE] →
 * [NEAR LIMIT] at ≥ 95% utilization per D-12.
 */
export function gaugeBadgeLabel(used: number, max: number): "ACTIVE" | "NEAR LIMIT" {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.floor((used / safeMax) * 100);
  return pct >= 95 ? "NEAR LIMIT" : "ACTIVE";
}
