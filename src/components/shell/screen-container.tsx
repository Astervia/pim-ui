/**
 * <ScreenContainer /> — single source of truth for screen content
 * layout and vertical rhythm.
 *
 * Width policy: every screen fills the available content area
 * (`w-full`). Content is bounded by the parent <main> padding rather
 * than an internal cap so panels stretch edge-to-edge on wide monitors
 * and shrink fluidly on phone-portrait viewports.
 *
 * `density` is preserved as a hook for future per-screen tweaks
 * (e.g. a far-future settings page might want a narrower max for
 * long-form prose), but defaults to no cap so the dashboard, peers,
 * routing, gateway, logs, and settings all read at the full content
 * width on whatever viewport is active.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ScreenContainerProps {
  /**
   * Reserved for per-screen overrides. Currently both presets render
   * full-width — the prop stays in the API so callers don't have to
   * change when a future preset wants a constrained width.
   */
  density?: "default" | "wide";
  children: ReactNode;
  className?: string;
}

export function ScreenContainer({
  density: _density = "default",
  children,
  className,
}: ScreenContainerProps) {
  return (
    <div className={cn("w-full flex flex-col gap-6", className)}>
      {children}
    </div>
  );
}
