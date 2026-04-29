/**
 * <IdentityPanel /> — the top CliPanel on the Dashboard (02-UI-SPEC §S2,
 * 02-CONTEXT D-08/D-09/D-30).
 *
 * Honest rendering contract:
 *   - Hero line: `█ pim · {node.name}` — the block + wordmark get the
 *     `.phosphor` glow, the middle-dot separator is `·` (U+00B7), and
 *     the node name stays plain foreground.
 *   - Detail line: `mesh: {mesh_ip} · interface {iface.name} · {up|down}
 *     · {formatDuration(uptime_s)}` — lowercase, `·` separators. When the
 *     interface is down, the `down` token renders `text-destructive` and
 *     the line appends a `· show why →` affordance (routed by Plan 02-06).
 *   - Limited mode (D-30): panel dims to opacity-60 and the detail line
 *     appends a relative `last seen: {N ago}` line derived from the
 *     snapshot's baselineTimestamp.
 *   - Status badge: `[LIVE]` in normal operation, `[STALE]` in limited
 *     mode (UI-SPEC §Identity panel).
 *   - Loading (status === null, D-07): a <ScanLoader /> with the
 *     "loading status" label inside the panel body — no placeholder
 *     zeros, no plain-text "Loading…" line (Phase 3 of the UI/UX
 *     overhaul).
 *
 * Copy rules (enforced by checker):
 *   - `█ pim` verbatim — block character U+2588 + ASCII space + "pim".
 *   - Separator `·` U+00B7, never `.` / `*` / `•`.
 *   - No exclamation marks anywhere.
 *   - No border-radius, no gradients, no literal Tailwind palette colors
 *     (e.g. numeric-variant tokens) — brand tokens only.
 */

import type { Status } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { ScanLoader } from "@/components/brand/scan-loader";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { DaemonToggle } from "@/components/brand/daemon-toggle";
import {
  TopologyDiagram,
  type TopologyHop,
} from "@/components/brand/topology-diagram";
import { formatDuration } from "@/lib/format";
import { useActiveScreen } from "@/hooks/use-active-screen";
import { cn } from "@/lib/utils";

/**
 * Build the topology hop list from the daemon snapshot. The selected
 * gateway is always the last hop before "internet"; intermediate
 * relays are inferred when the gateway peer reports route_hops > 1.
 */
function buildHops(status: Status | null): readonly TopologyHop[] {
  if (status === null) return [];
  const gatewayId = status.routes.selected_gateway;
  if (gatewayId === null) return [];
  const peer = status.peers.find((p) => p.node_id === gatewayId);
  if (peer === undefined) {
    return [{ label: gatewayId.slice(0, 8), latencyMs: null }];
  }
  const hops: TopologyHop[] = [];
  if (peer.route_hops > 1) {
    hops.push({ label: `relay (${peer.route_hops}h)`, latencyMs: null });
  }
  hops.push({
    label: peer.label === null ? peer.node_id_short : peer.label,
    latencyMs: peer.latency_ms,
  });
  return hops;
}

export interface IdentityPanelProps {
  status: Status | null;
  /** D-30: daemon not in `running` state — dim to 60% + show last-seen hint. */
  limitedMode?: boolean;
  /** D-30: `DaemonSnapshot.baselineTimestamp` (ms since epoch) for the
   *  last-seen hint. Ignored when `limitedMode` is false. */
  lastSeenTimestamp?: number | null;
  /**
   * Phase 5 — when true, render <DaemonToggle /> as a bottom-right action
   * inside the panel body so the daemon-lifecycle action ships with the
   * identity hero rather than floating in a competing header strip.
   * Default false so other surfaces (e.g. tray popover) can render
   * IdentityPanel without the toggle.
   */
  showDaemonToggle?: boolean;
  /**
   * Phase 2/5 — staggered reveal delay in ms. Forwarded to CliPanel.
   */
  revealDelay?: number | null;
}

export function IdentityPanel({
  status,
  limitedMode = false,
  lastSeenTimestamp = null,
  showDaemonToggle = false,
  revealDelay = 0,
}: IdentityPanelProps) {
  const { setActive } = useActiveScreen();

  // Loading / pre-seed: honest placeholder, not zeros (D-07).
  if (status === null) {
    return (
      <CliPanel
        title="identity"
        status={{ label: "WAITING", variant: "muted" }}
        density="spacious"
        revealDelay={revealDelay}
        className={cn(limitedMode === true && "opacity-60")}
      >
        <ScanLoader label="loading status" />
        {showDaemonToggle === true ? (
          <div className="mt-6 flex justify-end">
            <DaemonToggle />
          </div>
        ) : null}
      </CliPanel>
    );
  }

  const ifaceUp = status.interface.up;
  const indicatorState = ifaceUp === true ? "active" : "failed";

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : { label: "LIVE", variant: "default" as const };

  // D-30 last-seen hint: relative duration from baselineTimestamp to now.
  const hasBaseline =
    lastSeenTimestamp === null || lastSeenTimestamp === undefined
      ? false
      : true;
  const lastSeenLine =
    limitedMode === true && hasBaseline === true
      ? formatDuration(
          Math.floor((Date.now() - (lastSeenTimestamp as number)) / 1000),
        )
      : null;

  const hops = buildHops(status);
  const routing = status.route_on === true;

  return (
    <CliPanel
      title="identity"
      status={badge}
      density="spacious"
      revealDelay={revealDelay}
      className={cn(limitedMode === true && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-mono text-2xl sm:text-3xl tracking-tight leading-[1.2] break-words min-w-0">
          <span className="phosphor">█ pim</span>
          <span className="text-text-secondary"> · </span>
          <span className="text-foreground">{status.node}</span>
        </h1>
        <StatusIndicator state={indicatorState} />
      </div>

      <p className="mt-3 text-sm text-foreground">
        <span className="text-text-secondary">mesh:</span> {status.mesh_ip}
        <span className="text-text-secondary"> · </span>
        interface {status.interface.name}
        <span className="text-text-secondary"> · </span>
        <span className={ifaceUp === true ? "" : "text-destructive"}>
          {ifaceUp === true ? "up" : "down"}
        </span>
        <span className="text-text-secondary"> · </span>
        {formatDuration(status.uptime_s)}
        {ifaceUp === false && (
          <>
            <span className="text-text-secondary"> · </span>
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              // D-09 + Phase 6 (UI/UX P2.13): canonical behavior is to
              // route to Logs AND pre-apply a transport source filter
              // so the user lands on the relevant diagnostic stream
              // rather than the full firehose. Implemented as a
              // browser CustomEvent (`pim:logs-prefilter-source`) that
              // LogsScreen drains once on mount — keeps the W1
              // invariant intact (no new Tauri listen() outside
              // src/lib/rpc.ts + src/hooks/use-daemon-state.ts) and
              // matches the existing `pim:settings-*` pattern in
              // app-shell.tsx. Limitation: the filter narrows on the
              // crate-prefix `"transport"`. Daemon log sources may
              // carry a `pim_` prefix (e.g. `pim_transport`) — when
              // the daemon-side log conventions firm up, adjust the
              // dispatched value here and the recipient in logs.tsx.
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("pim:logs-prefilter-source", {
                    detail: { source: "transport" },
                  }),
                );
                setActive("logs");
              }}
            >
              show why →
            </button>
          </>
        )}
        {lastSeenLine === null ? null : (
          <span className="text-text-secondary">
            {" · "}last seen: {lastSeenLine} ago
          </span>
        )}
      </p>

      {/*
        Topology line — appears whenever the user has a path worth
        showing OR when in solo mode (renders `you · local`). Reads
        as "where is my traffic actually going?" answered in one row.
      */}
      <div className="mt-4 pt-3 border-t border-border">
        <TopologyDiagram hops={hops} routing={routing} />
      </div>

      {showDaemonToggle === true ? (
        <div className="mt-5 pt-4 border-t border-border flex justify-end">
          <DaemonToggle />
        </div>
      ) : null}
    </CliPanel>
  );
}
