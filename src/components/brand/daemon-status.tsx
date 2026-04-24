/**
 * <DaemonStatusIndicator /> — glyph + label chip, reflects live daemon state.
 *
 * Spec: .planning/phases/01-rpc-bridge-daemon-lifecycle/01-UI-SPEC.md §Surface 1
 *
 * W3 checker fix: component takes (baselineSeconds, baselineTimestamp) and
 * ticks internally at 1Hz while state=running — NOT a pre-computed
 * uptimeSeconds prop. This keeps the hero uptime live even when no parent
 * state change occurs. The interval is cleared on unmount AND on state
 * change away from "running".
 *
 * Non-negotiables:
 *  - Glyph ∈ { ○ ◐ ● ✗ } per state, Unicode not lucide
 *  - Label: lowercase Geist Mono 14px (matches "pim0 · up" convention)
 *  - Uptime suffix on running only
 *  - aria-live="polite" on label; role="img" on glyph
 *  - Respects prefers-reduced-motion via existing .cursor-blink rule in globals.css
 */

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { DaemonState } from "@/lib/daemon-state";
import { formatUptime } from "./uptime-counter";

export interface DaemonStatusIndicatorProps {
  state: DaemonState;
  /** W3: seconds from status.uptime_s at the moment the RPC arrived. */
  baselineSeconds?: number;
  /** W3: Date.now() when baselineSeconds was set. */
  baselineTimestamp?: number;
  errorMessage?: string;
  className?: string;
  style?: CSSProperties;
}

interface Visual {
  glyph: string;
  textClass: string;
  animationClass: string;
  ariaLabel: string;
}

const VISUALS: Record<DaemonState, Visual> = {
  stopped: {
    glyph: "○",
    textClass: "text-muted-foreground",
    animationClass: "",
    ariaLabel: "stopped",
  },
  starting: {
    glyph: "◐",
    textClass: "text-accent",
    animationClass: "cursor-blink",
    ariaLabel: "starting",
  },
  running: {
    glyph: "●",
    textClass: "text-primary phosphor",
    animationClass: "",
    ariaLabel: "running",
  },
  reconnecting: {
    glyph: "◐",
    textClass: "text-accent",
    animationClass: "cursor-blink",
    ariaLabel: "reconnecting",
  },
  error: {
    glyph: "✗",
    textClass: "text-destructive",
    animationClass: "",
    ariaLabel: "error",
  },
};

export function DaemonStatusIndicator({
  state,
  baselineSeconds,
  baselineTimestamp,
  errorMessage,
  className,
  style,
}: DaemonStatusIndicatorProps) {
  const v = VISUALS[state];

  // W3: internal tick — force re-render every 1s while running so the
  // uptime label ticks. No-op (no timer armed) in every other state.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  const liveUptime =
    state === "running" &&
    typeof baselineSeconds === "number" &&
    typeof baselineTimestamp === "number"
      ? Math.max(
          0,
          baselineSeconds + Math.floor((Date.now() - baselineTimestamp) / 1000),
        )
      : undefined;

  const label =
    state === "running" && typeof liveUptime === "number"
      ? `running · ${formatUptime(liveUptime)}`
      : state === "starting"
        ? "starting…"
        : state === "reconnecting"
          ? "reconnecting…"
          : state === "error"
            ? errorMessage
              ? `error — ${errorMessage}`
              : "error"
            : "stopped";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-sm lowercase",
        className,
      )}
      style={style}
    >
      <span
        role="img"
        aria-label={v.ariaLabel}
        className={cn("font-mono", v.textClass, v.animationClass)}
      >
        {v.glyph}
      </span>
      <span className={cn(v.textClass)} aria-live="polite">
        {label}
      </span>
    </span>
  );
}
