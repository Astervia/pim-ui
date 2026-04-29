/**
 * <SimpleHero /> — oversized brand mark for the simple-mode screen.
 *
 * Renders "█ pim" at hero scale, statically. The only animation is the
 * block-cursor blink on the leading "█" (the brand's signature beat).
 * No floating wrapper, no drop-shadow halo, no scanline overlay — the
 * green glow lives ONLY in the `phosphor` text-shadow on the block,
 * tightly around the character.
 *
 * The typing-in animation from the original `<Logo animated />` is
 * intentionally NOT used here: at hero sizes the `width: 3ch` keyframe
 * end-state can clip the trailing "m" depending on font metrics. A
 * static glyph + blinking cursor delivers the same brand cadence
 * without that bug.
 */

import { cn } from "@/lib/utils";

export interface SimpleHeroProps {
  /** Quiet line shown below the logo. Omit for logo-only hero. */
  tagline?: string;
  className?: string;
}

export function SimpleHero({ tagline, className }: SimpleHeroProps) {
  return (
    <div
      aria-label="pim"
      className={cn(
        "flex flex-col items-center gap-4 select-none",
        className,
      )}
    >
      <span
        className={cn(
          "font-mono font-semibold inline-flex items-baseline gap-[0.4ch]",
          "text-6xl sm:text-7xl md:text-8xl",
        )}
      >
        <span aria-hidden="true" className="text-primary phosphor cursor-blink">
          █
        </span>
        <span aria-hidden="true" className="text-foreground">
          pim
        </span>
      </span>
      {tagline !== undefined ? (
        <p className="font-mono text-xs sm:text-sm uppercase tracking-[0.45em] text-text-secondary">
          {tagline}
        </p>
      ) : null}
    </div>
  );
}
