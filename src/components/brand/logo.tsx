/**
 * <Logo /> — the pim brand mark.
 *
 * Primary direction: Wordmark + Signal Pulse (█ pim).
 * See .design/branding/pim/identity/logo-directions.md for the full spec.
 *
 * Animated variant (hero only):
 *   - Block cursor blinks perpetually (1.1s step-end infinite)
 *   - "pim" types out character-by-character on load (steps(3, end), 0.5s delay)
 *   - prefers-reduced-motion: static render, no animation
 */

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "default" | "lg" | "hero";

const sizeClasses: Record<LogoSize, string> = {
  sm: "text-lg",
  default: "text-2xl",
  lg: "text-4xl",
  hero: "text-5xl md:text-6xl lg:text-7xl",
};

export interface LogoProps {
  size?: LogoSize;
  animated?: boolean;
  className?: string;
}

export function Logo({
  size = "default",
  animated = false,
  className,
}: LogoProps) {
  if (animated) {
    return (
      <span
        aria-label="pim"
        className={cn(
          "logo-hero font-mono font-semibold",
          sizeClasses[size],
          className,
        )}
      >
        <span className="logo-block text-primary phosphor">█</span>
        <span
          aria-hidden
          className="logo-typed text-foreground"
        >
          pim
        </span>
      </span>
    );
  }

  return (
    <span
      aria-label="pim"
      className={cn(
        "font-mono font-semibold inline-flex items-baseline",
        sizeClasses[size],
        className,
      )}
    >
      <span className="text-primary phosphor">█</span>
      <span className="text-foreground ml-[0.5ch] tracking-tight">pim</span>
    </span>
  );
}
