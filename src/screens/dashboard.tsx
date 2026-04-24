/**
 * Dashboard — Phase 1 live version.
 *
 * Source of truth: the useDaemonState hook. NEVER imports rpc-types.Status
 * directly to fetch; only reads from snapshot.status.
 *
 * Render contract mirrors 01-UI-SPEC.md §Surface 6 and §Interaction State Matrix:
 *   daemon.state === "running"       -> full live panel
 *   daemon.state === "reconnecting"  -> panel dimmed 50%, pointer-events-none, last-known data
 *   daemon.state === "stopped"       -> panel hidden, Limited Mode shown
 *   daemon.state === "starting"      -> panel hidden, Limited Mode (starting variant)
 *   daemon.state === "error"         -> panel hidden, Limited Mode (error variant)
 *
 * B2 fix (Plan 03): TunPermissionProvider mounts at the app root (src/main.tsx).
 * Dashboard does NOT import useTunPermission and does NOT render
 * TunPermissionModal directly — that lives inside the provider. DaemonToggle and
 * LimitedModeBanner call useTunPermission() internally and share the single
 * provider-owned modal instance.
 *
 * I2 fix (Plan 03): LimitedModeBanner.onOpenLogs is optional; Dashboard does
 * not pass it in Phase 1, so the VIEW LOGS button is hidden. Phase 2 will
 * wire a real Logs tab handler.
 *
 * Phase 2 will rewire the peer list + stats to read from the reactive
 * status.event stream. Phase 1 reads snapshot.status directly — the Rust
 * side emits status as part of state-changed events on every (re)connect.
 */

import { Logo } from "@/components/brand/logo";
import { CliPanel } from "@/components/brand/cli-panel";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { DaemonStatusIndicator } from "@/components/brand/daemon-status";
import { DaemonToggle } from "@/components/brand/daemon-toggle";
import { LimitedModeBanner } from "@/components/brand/limited-mode-banner";
import { UptimeCounter } from "@/components/brand/uptime-counter";
import { AboutFooter } from "@/components/brand/about-footer";
import { ReconnectToast } from "@/components/brand/reconnect-toast";
import { StopConfirmDialog } from "@/components/brand/stop-confirm-dialog";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Dashboard() {
  const { snapshot } = useDaemonState();
  const { state, status, hello, baselineTimestamp } = snapshot;

  const showPanel = state === "running" || state === "reconnecting";
  const panelDimmed = state === "reconnecting";

  const cliPanelBadge =
    state === "running"
      ? { label: "OK", variant: "default" as const }
      : { label: "...", variant: "muted" as const };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <header className="space-y-6">
        <div className="flex items-start justify-between gap-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            proximity internet mesh
          </p>
          <DaemonStatusIndicator
            state={state}
            baselineSeconds={status?.uptime_s}
            baselineTimestamp={baselineTimestamp ?? undefined}
            errorMessage={snapshot.lastError?.message}
          />
        </div>

        <h1>
          <Logo size="hero" animated />
        </h1>

        <p className="font-mono text-lg md:text-xl text-foreground max-w-[42ch]">
          Infrastructure you can read.
        </p>
      </header>

      {/* Limited mode.
          onOpenLogs intentionally omitted — Plan 03 I2 fix hides the
          VIEW LOGS button when no handler is provided; Phase 2 wires the Logs tab. */}
      {state !== "running" && <LimitedModeBanner />}

      {/* Live status panel */}
      {showPanel && status && (
        <div
          className={cn(
            "transition-opacity duration-100 ease-linear",
            panelDimmed && "opacity-50 pointer-events-none",
          )}
          aria-hidden={panelDimmed || undefined}
        >
          <CliPanel title={`pim · status --verbose`} status={cliPanelBadge}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              <dt className="text-muted-foreground">node</dt>
              <dd>
                {status.node}{" "}
                <span className="text-muted-foreground">
                  · {status.node_id_short}
                </span>
              </dd>

              <dt className="text-muted-foreground">mesh ip</dt>
              <dd>{status.mesh_ip}</dd>

              <dt className="text-muted-foreground">interface</dt>
              <dd className="flex items-center gap-2">
                {status.interface.name}{" "}
                <StatusIndicator
                  state={status.interface.up ? "active" : "failed"}
                />
                <span className="text-muted-foreground">
                  {status.interface.up ? "up" : "down"}
                </span>
              </dd>

              <dt className="text-muted-foreground">transport</dt>
              <dd>
                {status.transport.tcp
                  ? `tcp :${status.transport.tcp.port}`
                  : "—"}
                {status.transport.bluetooth?.enabled ? " · bluetooth" : ""}
                {status.transport.wifi_direct?.enabled ? " · wifi_direct" : ""}
              </dd>

              <dt className="text-muted-foreground">uptime</dt>
              <dd>
                <UptimeCounter
                  baselineSeconds={status.uptime_s}
                  baselineTimestamp={baselineTimestamp ?? Date.now()}
                  startedAt={status.started_at}
                />
              </dd>
            </dl>

            <div className="mt-5 pt-4 border-t border-border space-y-1">
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                peers — {status.peers.length} connected
              </div>
              {status.peers.map((peer) => (
                <div
                  key={peer.node_id}
                  className="grid grid-cols-[8rem_1fr_6rem_auto_6rem] items-center gap-3"
                >
                  <span className="text-muted-foreground">
                    {peer.label ?? peer.node_id_short}
                  </span>
                  <span>{peer.mesh_ip}</span>
                  <span className="text-muted-foreground">
                    via {peer.transport}
                  </span>
                  <StatusIndicator state={peer.state} />
                  <span className="text-muted-foreground">{peer.state}</span>
                </div>
              ))}
            </div>

            <dl className="mt-5 pt-4 border-t border-border grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
              <dt className="text-muted-foreground">routes</dt>
              <dd>
                {status.routes.active} active
                {status.routes.expired > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    / {status.routes.expired} expired
                  </span>
                )}
              </dd>

              <dt className="text-muted-foreground">forwarded</dt>
              <dd>
                {formatBytes(status.stats.forwarded_bytes)} ·{" "}
                {status.stats.forwarded_packets.toLocaleString()} packets
              </dd>

              {status.stats.dropped > 0 && (
                <>
                  <dt className="text-muted-foreground">dropped</dt>
                  <dd className="flex items-center gap-2">
                    {status.stats.dropped}
                    {status.stats.dropped_reason && (
                      <Badge variant="warning">
                        {status.stats.dropped_reason}
                      </Badge>
                    )}
                  </dd>
                </>
              )}
            </dl>
          </CliPanel>

          <div className="mt-6 flex gap-4">
            <DaemonToggle />
          </div>
        </div>
      )}

      {/* Footer legend + version */}
      <AboutFooter daemon={hello} />

      {/* Observers + dialogs (no visual unless triggered).
          Dashboard does NOT render TunPermissionModal — it lives inside
          TunPermissionProvider at the app root (src/main.tsx). B2 fix. */}
      <ReconnectToast />
      <StopConfirmDialog />
    </div>
  );
}
