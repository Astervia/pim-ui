/**
 * <ThroughputPanel /> — narrow CliPanel showing current bytes/sec
 * forwarded by the local node, plus a 60-sample sparkline showing
 * the last minute of traffic.
 *
 * Honest rendering contract:
 *   - The number IS the per-second rate computed from the daemon's
 *     cumulative `forwarded_bytes` counter (see useThroughputHistory).
 *     We never fabricate samples while events are stale.
 *   - The sparkline scale auto-fits the visible window; a flat low-
 *     traffic period reads as a flat row, not as zero (which would
 *     mis-imply nothing happening).
 *   - When no samples have landed yet, the sparkline shows a muted
 *     placeholder line so the layout doesn't shift on first sample.
 *   - In limited mode the panel dims and the rate flips to "—" rather
 *     than a stale number.
 */

import { CliPanel } from "@/components/brand/cli-panel";
import { Sparkline } from "@/components/brand/sparkline";
import { ScanLoader } from "@/components/brand/scan-loader";
import { useThroughputHistory } from "@/hooks/use-throughput-history";
import { useStatus } from "@/hooks/use-status";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ThroughputPanelProps {
  limitedMode?: boolean;
  /** Phase 2/5 — staggered reveal delay forwarded to CliPanel. */
  revealDelay?: number | null;
}

const SAMPLE_WINDOW = 60;

export function ThroughputPanel({
  limitedMode = false,
  revealDelay = 0,
}: ThroughputPanelProps) {
  const status = useStatus();
  const { rates, latestBytesPerSec } = useThroughputHistory(SAMPLE_WINDOW);

  if (status === null) {
    return (
      <CliPanel
        title="throughput"
        status={{ label: "WAITING", variant: "muted" }}
        density="compact"
        revealDelay={revealDelay}
        className={cn(limitedMode === true && "opacity-60")}
      >
        <ScanLoader label="loading throughput" />
      </CliPanel>
    );
  }

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : { label: `${rates.length}/${SAMPLE_WINDOW}s`, variant: "muted" as const };

  const rateLabel =
    limitedMode === true ? "—" : `${formatBytes(Math.round(latestBytesPerSec))}/s`;

  return (
    <CliPanel
      title="throughput"
      status={badge}
      density="compact"
      revealDelay={revealDelay}
      className={cn(limitedMode === true && "opacity-60")}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-code text-text-secondary text-xs uppercase tracking-wider">
            forwarded
          </span>
          <span
            className={cn(
              "font-code text-lg leading-none",
              limitedMode === true ? "text-text-secondary" : "text-primary",
            )}
          >
            {rateLabel}
          </span>
        </div>
        <Sparkline
          samples={rates}
          width={SAMPLE_WINDOW}
          ariaLabel="forwarded bytes per second over last 60 seconds"
          className="text-base"
        />
      </div>
    </CliPanel>
  );
}
