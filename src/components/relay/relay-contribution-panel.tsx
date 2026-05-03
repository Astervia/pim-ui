/**
 * <RelayContributionPanel /> — Phase 6 Plan 06-02.
 *
 * Periphery panel on the Dashboard that surfaces THIS node's relay
 * contribution honestly:
 *   - When `Status.role` includes "relay": shows packets / bytes
 *     forwarded plus the count of peers whose next-hop is us.
 *   - When the role is `client` only: still renders, with a quiet
 *     "client only · not forwarding" line so the user knows the
 *     trade-off they accepted in the RelayOffConfirmAlertDialog
 *     (Plan 06-01) is in effect.
 *   - When status is still loading (pre-handshake): spinner.
 *
 * Style mirrors `<NetworkInsightsPanel />` (compact density, KV grid)
 * so the dashboard reads as a coherent periphery row.
 *
 * Brand: no exclamation, primitives explicit on first reveal
 * ("relay+client (0x03)" / "client only (0x01)") in collapsed annotations
 * if necessary; here the body uses Aria-friendly phrasing per
 * docs/COPY.md §2.
 */

import { CliPanel } from "@/components/brand/cli-panel";
import { ScanLoader } from "@/components/brand/scan-loader";
import {
  formatRoleLabel,
  useRelayContribution,
} from "@/hooks/use-relay-contribution";
import { formatBytes, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface RelayContributionPanelProps {
  limitedMode?: boolean;
  /** Phase 2/5 — staggered reveal delay forwarded to CliPanel. */
  revealDelay?: number | null;
}

interface Row {
  label: string;
  value: string;
  emphasis?: "primary" | "default";
}

export function RelayContributionPanel({
  limitedMode = false,
  revealDelay = 0,
}: RelayContributionPanelProps) {
  const contribution = useRelayContribution();

  if (contribution.loading === true) {
    return (
      <CliPanel
        title="relay"
        status={{ label: "WAITING", variant: "muted" }}
        density="compact"
        revealDelay={revealDelay}
        className={cn(limitedMode === true && "opacity-60")}
      >
        <ScanLoader label="loading relay role" />
      </CliPanel>
    );
  }

  // Client-only branch — honest "you opted out" surface so the user
  // is never surprised that the mesh isn't carrying their traffic.
  if (contribution.active === false) {
    return (
      <CliPanel
        title="relay"
        status={{ label: "OFF", variant: "muted" }}
        density="compact"
        revealDelay={revealDelay}
        className={cn(limitedMode === true && "opacity-60")}
      >
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          client only (0x01)
        </p>
        <p className="font-code text-sm text-muted-foreground mt-2 leading-relaxed">
          this device does not forward traffic for other peers. turn
          relay on in Settings to strengthen the mesh.
        </p>
      </CliPanel>
    );
  }

  const peersValue =
    contribution.peersViaMe === 0
      ? "0 · ready to help"
      : `${formatCount(contribution.peersViaMe)} via this node`;

  const rows: readonly Row[] = [
    {
      label: "role",
      value: formatRoleLabel(contribution.role),
      emphasis: "primary",
    },
    {
      label: "peers",
      value: peersValue,
      emphasis: contribution.peersViaMe > 0 ? "primary" : "default",
    },
    {
      label: "forwarded",
      value: `${formatBytes(contribution.bytesForwarded)} / ${formatCount(contribution.packetsForwarded)} pkts`,
    },
  ];

  const badge =
    limitedMode === true
      ? { label: "STALE", variant: "muted" as const }
      : { label: "LIVE", variant: "muted" as const };

  return (
    <CliPanel
      title="relay"
      status={badge}
      density="compact"
      revealDelay={revealDelay}
      className={cn(limitedMode === true && "opacity-60")}
    >
      <dl className="grid grid-cols-[10ch_1fr] gap-x-4 gap-y-1.5 font-code text-sm">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="font-mono text-xs uppercase tracking-wider text-muted-foreground self-center">
              {r.label}
            </dt>
            <dd
              className={cn(
                "font-code",
                r.emphasis === "primary" && "text-primary",
                (r.emphasis === undefined || r.emphasis === "default") &&
                  "text-foreground",
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </CliPanel>
  );
}
