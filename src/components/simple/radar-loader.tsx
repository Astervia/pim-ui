/**
 * <RadarLoader /> — radar animation for simple mode.
 *
 * Three concentric pulsing rings with staggered delays, a faint axis
 * cross (in the muted palette), and a center dot representing "you".
 * When `peerFound` is true, a second dot appears at ~70% of the
 * radius with the `peer-blip` animation.
 *
 * No external dependencies — inline SVG + CSS keyframes from
 * globals.css. Honors prefers-reduced-motion via global overrides.
 */

import { cn } from "@/lib/utils";

export interface RadarLoaderProps {
  size?: number;
  /** When true, show a pulsing peer dot on the outer ring. */
  peerFound?: boolean;
  className?: string;
}

export function RadarLoader({
  size = 220,
  peerFound = false,
  className,
}: RadarLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={peerFound === true ? "someone is nearby" : "looking for a peer"}
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* Pulsing rings — three layers with staggered delay so there's
          always a ring leaving the center. Each layer is a square div
          covering 100% of the container; `radar-pulse` scales 0.2 → 1
          and fades. */}
      <span aria-hidden="true" className="radar-pulse" />
      <span
        aria-hidden="true"
        className="radar-pulse"
        style={{ animationDelay: "1s" }}
      />
      <span
        aria-hidden="true"
        className="radar-pulse"
        style={{ animationDelay: "2s" }}
      />

      {/* Radar SVG — thin axis cross, low-opacity guide circles, sweep
          arm, center "you" dot, conditional peer dot. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="absolute inset-0"
      >
        {/* Axes */}
        <line
          x1="50"
          y1="2"
          x2="50"
          y2="98"
          stroke="var(--color-border)"
          strokeWidth="0.4"
        />
        <line
          x1="2"
          y1="50"
          x2="98"
          y2="50"
          stroke="var(--color-border)"
          strokeWidth="0.4"
        />
        {/* Guide rings */}
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="0.3"
          strokeDasharray="1 2"
        />
        <circle
          cx="50"
          cy="50"
          r="35"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="0.3"
          strokeDasharray="1 2"
        />
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="0.3"
          strokeDasharray="1 2"
        />

        {/* Sweep arm (gradient simulated via short adjacent lines) */}
        <g className="radar-sweep" style={{ transformOrigin: "50px 50px" }}>
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="2"
            stroke="var(--color-primary)"
            strokeWidth="0.5"
            opacity="0.85"
          />
          <line
            x1="50"
            y1="50"
            x2="62"
            y2="6"
            stroke="var(--color-primary)"
            strokeWidth="0.4"
            opacity="0.45"
          />
          <line
            x1="50"
            y1="50"
            x2="74"
            y2="12"
            stroke="var(--color-primary)"
            strokeWidth="0.3"
            opacity="0.2"
          />
        </g>

        {/* Center dot — you */}
        <circle
          cx="50"
          cy="50"
          r="2"
          fill="var(--color-primary)"
          className="phosphor"
        />
        <circle
          cx="50"
          cy="50"
          r="3.6"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="0.4"
          opacity="0.6"
        />

        {/* Peer dot animates with peer-blip at 35° from north,
            radius ~35. Position: (50 + 35·sin35°, 50 − 35·cos35°). */}
        {peerFound === true ? (
          <g className="peer-blip" style={{ transformOrigin: "70.07px 21.34px" }}>
            <circle
              cx="70.07"
              cy="21.34"
              r="2.4"
              fill="var(--color-accent)"
            />
            <circle
              cx="70.07"
              cy="21.34"
              r="4.4"
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="0.4"
              opacity="0.5"
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}
