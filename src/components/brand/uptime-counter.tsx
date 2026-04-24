/**
 * <UptimeCounter /> — seconds-level uptime display.
 *
 * Spec: 01-UI-SPEC.md §Surface 4.
 *
 * Source of truth: daemon's `status.uptime_s`. On mount we compute
 *    displayed = baselineSeconds + floor((Date.now() - baselineTimestamp) / 1000)
 * and re-render every 1s. When a fresh status RPC arrives the parent passes
 * a new baseline and we reset. We NEVER persist to localStorage — success
 * criterion 6 requires surviving window close/reopen by re-reading from
 * the daemon, not by caching in the UI.
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function formatUptime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

export interface UptimeCounterProps {
  baselineSeconds: number;
  baselineTimestamp: number;
  startedAt?: string | null;
  className?: string;
}

export function UptimeCounter({
  baselineSeconds,
  baselineTimestamp,
  startedAt,
  className,
}: UptimeCounterProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.floor((now - baselineTimestamp) / 1000);
  const displayed = Math.max(0, baselineSeconds + elapsed);

  const body = (
    <span
      className={cn(
        "font-code text-sm text-foreground",
        "[font-variant-numeric:tabular-nums]",
        className,
      )}
      aria-live="off"
    >
      {formatUptime(displayed)}
    </span>
  );

  if (startedAt) {
    return <time dateTime={startedAt}>{body}</time>;
  }
  return body;
}
