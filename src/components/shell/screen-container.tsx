/**
 * <ScreenContainer /> — single source of truth for screen content width
 * and vertical rhythm. Replaces the ad-hoc max-w-3xl/4xl/5xl drift that
 * varied per screen.
 *
 * Width is content-measured (ch) so it tracks the active monospace font
 * — readable at any viewport. Pair with the AppShell's <main className="px-8 py-8">.
 *
 *   density="default" → 72ch — Dashboard / Peers / Routing / Settings
 *   density="wide"    → 96ch — Logs / Gateway (wider tables)
 *
 * `gap` defaults to 6 (24px) but is overridable per screen for the
 * Phase-5 hero/periphery rhythm where the Dashboard wants tight clusters
 * (gap-3) between Identity/RouteToggle and generous separations
 * (gap-8) before PeerList and before Metrics.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScreenContainerProps {
  density?: "default" | "wide";
  children: ReactNode;
  className?: string;
}

export function ScreenContainer({
  density = "default",
  children,
  className,
}: ScreenContainerProps) {
  return (
    <div
      className={cn(
        density === "wide" ? "max-w-[96ch]" : "max-w-[72ch]",
        "flex flex-col gap-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
