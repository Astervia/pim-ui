/**
 * <TeachingEmptyState /> — empty state that teaches the interface.
 *
 * The brand contract requires honest, non-condescending empty states
 * (P5 solo-mode, STYLE.md voice rules). This primitive keeps the
 * locked headline copy verbatim and adds an optional teaching `next`
 * line plus an optional cycling indicator that tells the user what
 * the daemon is doing right now (e.g., "scanning udp · ble · wfd").
 *
 * Locked-copy contract: `headline` and `next` strings MUST be sourced
 * from `src/lib/copy.ts`. `cycle` strings are runtime values from the
 * daemon (transport names, mechanism labels) — they are not user-
 * facing copy in the locked sense.
 *
 * The cycle indicator advances every `cycleInterval` ms. It is purely
 * decorative — semantic state lives in the headline copy. Reduced
 * motion preference pins the cycle to the first item.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TeachingEmptyStateProps {
  /** Verbatim headline copy from src/lib/copy.ts. */
  headline: string;
  /** Optional teaching microcopy line — also from src/lib/copy.ts. */
  next?: string;
  /** Optional cycling tokens (e.g. ["udp", "ble", "wfd"]). */
  cycle?: readonly string[];
  /** Cycle interval in ms. Default 1800. */
  cycleInterval?: number;
  /** Optional prefix glyph; default ◐ (U+25D0). */
  glyph?: string;
  className?: string;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function TeachingEmptyState({
  headline,
  next,
  cycle,
  cycleInterval = 1800,
  glyph = "◐",
  className,
}: TeachingEmptyStateProps) {
  const [index, setIndex] = useState<number>(0);

  // Detect reduced-motion preference once at mount; pin the cycle to
  // index 0 if the user opted out of motion.
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (cycle === undefined) return;
    if (cycle.length === 0) return;
    if (reducedMotion === true) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % cycle.length),
      cycleInterval,
    );
    return () => clearInterval(id);
  }, [cycle, cycleInterval, reducedMotion]);

  const cycleToken =
    cycle === undefined || cycle.length === 0 ? null : cycle[index];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-2 px-4 py-3 font-code text-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-text-secondary">
        <span aria-hidden="true" className="phosphor-pulse text-primary">
          {glyph}
        </span>
        <span>{headline}</span>
        {cycleToken === null ? null : (
          <span className="text-primary tracking-wider uppercase text-xs">
            · {cycleToken}
          </span>
        )}
      </div>
      {next === undefined ? null : (
        <p className="font-mono text-xs text-text-secondary pl-7">{next}</p>
      )}
    </div>
  );
}
