/**
 * <GatewayActivePanel /> — Linux gateway-active body per
 * 05-CONTEXT D-15 + §specifics §2b ASCII mockup target.
 *
 * Top row: "◆ gateway active · {nat_interface} · {uptime}"
 * Sub-row: "advertised: 0.0.0.0/0"
 * Sub-section: <ConntrackGauge />
 * Sub-section: <ThroughputPanel />
 * Sub-section: <PeersThroughMeList />
 * Action:     [ Turn off gateway mode ]
 *             — when peers_through_me > 0, append advisory:
 *               · {n} peers will be cut over to another gateway
 *
 * D-15: NO confirmation dialog. Turning off is recoverable. The advisory
 * is in-line text adjacent to the button, not a modal.
 */

import { useEffect, useState } from "react";
import type { GatewayStatusResult } from "@/lib/rpc-types";
import { ConntrackGauge } from "./conntrack-gauge";
import { ThroughputPanel } from "./throughput-panel";
import { PeersThroughMeList } from "./peers-through-me-list";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface GatewayActivePanelProps {
  status: GatewayStatusResult;
  onDisable: () => void;
  disabling?: boolean;
}

export function GatewayActivePanel({
  status,
  onDisable,
  disabling,
}: GatewayActivePanelProps) {
  // Compute uptime from enabled_at — tick once per second so the label
  // doesn't desync across long-lived sessions. Self-tick pattern from
  // Phase 1 D-uptime (UptimeCounter) — keeps parent re-renders cheap.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const enabledMs = new Date(status.enabled_at).getTime();
  const elapsedSec = Math.max(0, Math.floor((now - enabledMs) / 1000));

  const advisoryText =
    status.peers_through_me > 0
      ? ` · ${status.peers_through_me} peers will be cut over to another gateway`
      : "";

  const natIfaceLabel = status.nat_interface === null ? "—" : status.nat_interface;
  const disabled = disabling === true;

  return (
    <div className="flex flex-col gap-4 font-code text-sm leading-[1.7]">
      <div className="flex flex-wrap items-baseline gap-2">
        <StatusIndicator state="active" />
        <span className="text-foreground">
          {`gateway active · ${natIfaceLabel} · ${formatDuration(elapsedSec)}`}
        </span>
      </div>
      <p className="text-muted-foreground">advertised: 0.0.0.0/0</p>

      <ConntrackGauge
        used={status.conntrack.used}
        max={status.conntrack.max}
      />

      <ThroughputPanel
        in_bps={status.throughput.in_bps}
        out_bps={status.throughput.out_bps}
        in_total_bytes={status.throughput.in_total_bytes}
        out_total_bytes={status.throughput.out_total_bytes}
        elapsed_s={elapsedSec}
      />

      <PeersThroughMeList
        peerIds={status.peers_through_me_ids ?? []}
        countFallback={status.peers_through_me}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDisable}
          disabled={disabled}
          className={cn(
            "px-3 py-1",
            "border border-border bg-transparent text-foreground",
            "hover:border-primary hover:text-primary",
            "font-mono text-xs uppercase tracking-wider",
            "focus-visible:outline focus-visible:outline-1 focus-visible:outline-ring focus-visible:outline-offset-2",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          )}
        >
          [ Turn off gateway mode ]
        </button>
        {advisoryText === "" ? null : (
          <span className="text-muted-foreground">{advisoryText}</span>
        )}
      </div>
    </div>
  );
}
