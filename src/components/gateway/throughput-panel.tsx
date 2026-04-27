/**
 * <ThroughputPanel /> — gateway throughput per 05-CONTEXT D-13 +
 * RESEARCH §9b.
 *
 * Renders:
 *   throughput
 *   in   {formatBitrate(in_bps)}   out  {formatBitrate(out_bps)}
 *   total {formatDuration(elapsed_s)}    in   {formatBytes(in_total_bytes)}    out  {formatBytes(out_total_bytes)}
 */

import { formatBitrate, formatBytes, formatDuration } from "@/lib/format";

export interface ThroughputPanelProps {
  in_bps: number;
  out_bps: number;
  in_total_bytes: number;
  out_total_bytes: number;
  /** Computed parent-side from enabled_at + now. */
  elapsed_s: number;
}

export function ThroughputPanel({
  in_bps,
  out_bps,
  in_total_bytes,
  out_total_bytes,
  elapsed_s,
}: ThroughputPanelProps) {
  return (
    <section
      className="font-code text-sm leading-[1.7]"
      aria-label="throughput"
    >
      <p className="text-foreground">throughput</p>
      <p className="text-foreground">
        {`in   ${formatBitrate(in_bps)}   out  ${formatBitrate(out_bps)}`}
      </p>
      <p className="text-muted-foreground">
        {`total ${formatDuration(elapsed_s)}    in   ${formatBytes(in_total_bytes)}    out  ${formatBytes(out_total_bytes)}`}
      </p>
    </section>
  );
}
