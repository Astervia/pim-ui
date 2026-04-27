/**
 * <GatewayScreen /> — Phase 5 Gateway tab.
 *
 * Plan 05-02 ships pre-flight + enable form (Linux) + Linux-only panel
 * (macOS/Windows). Plan 05-03 extends with the active-state body
 * (gauge + throughput + peer-through-me) when the daemon's
 * gateway.status({ active: true }).
 *
 * Branch order (Plan 05-03 prepends an active-state branch BEFORE
 * branches 4/5/6 by adding a useGatewayStatus() check that early-returns
 * <GatewayActivePanel />):
 *   1. Daemon not running       → CliPanel with hint to Phase-1 Limited
 *      mode banner; pre-flight cannot run without a daemon.
 *   2. Preflight loading + null → CliPanel with "checking pre-flight…" hint.
 *   3. Preflight error          → CliPanel with inline destructive error
 *      (D-43, no toast — pre-flight failures are tab-scoped).
 *   3b. (Plan 05-03) gateway.status().active === true on Linux
 *       → <GatewayActivePanel /> + dynamic [ACTIVE]/[NEAR LIMIT] badge.
 *   4. platform other-than-linux → <LinuxOnlyPanel /> (D-10, GATE-04).
 *   5. platform linux AND not all checks ok → <PreflightSection />.
 *   6. platform linux AND all checks ok     → <PreflightSection /> +
 *                                              <NatInterfaceSelect />.
 *
 * D-11: platform comes from gateway.preflight().platform — daemon as
 * source of truth. UI does NOT fall back to navigator.userAgent here
 * (in contrast to Phase 01.1's UI-only platform gate).
 *
 * W1: zero new Tauri-side subscriptions in this file.
 */

import { CliPanel } from "@/components/brand/cli-panel";
import { useGatewayPreflight } from "@/hooks/use-gateway-preflight";
import { useGatewayStatus } from "@/hooks/use-gateway-status";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { LinuxOnlyPanel } from "@/components/gateway/linux-only-panel";
import { PreflightSection } from "@/components/gateway/preflight-section";
import { NatInterfaceSelect } from "@/components/gateway/nat-interface-select";
import { GatewayActivePanel } from "@/components/gateway/gateway-active-panel";
import { gaugeBadgeLabel } from "@/components/gateway/conntrack-gauge";

export function GatewayScreen() {
  const { snapshot } = useDaemonState();
  const { result, loading, error, refetch } = useGatewayPreflight();
  // Plan 05-03: only run gateway.status when on Linux (avoids unnecessary
  // RPC chatter on macOS/Windows where the call would resolve with active: false
  // anyway). The hook gates internally on snapshot.state === "running".
  const platformIsLinux = result === null ? false : result.platform === "linux";
  const gatewayStatus = useGatewayStatus({ enabled: platformIsLinux });

  // Branch 1 — daemon not running
  if (snapshot.state !== "running") {
    return (
      <div className="max-w-5xl">
        <CliPanel title="gateway" status={{ label: "OFFLINE", variant: "muted" }}>
          <p className="font-code text-sm text-muted-foreground">
            pim daemon is not running — start the daemon to run gateway pre-flight.
          </p>
        </CliPanel>
      </div>
    );
  }

  // Branch 2 — initial loading
  if (result === null && loading === true) {
    return (
      <div className="max-w-5xl">
        <CliPanel title="gateway" status={{ label: "CHECKING", variant: "muted" }}>
          <p className="font-code text-sm text-muted-foreground">
            checking pre-flight…
          </p>
        </CliPanel>
      </div>
    );
  }

  // Branch 3 — preflight error (D-43 inline, no toast)
  if (result === null && error !== null) {
    return (
      <div className="max-w-5xl">
        <CliPanel title="gateway" status={{ label: "ERROR", variant: "destructive" }}>
          <p className="font-code text-sm text-destructive">
            gateway pre-flight failed: {error.message}
          </p>
          <button
            type="button"
            onClick={refetch}
            className="mt-3 self-start px-3 py-1 border border-border bg-transparent text-foreground hover:border-primary hover:text-primary font-mono text-xs uppercase tracking-wider"
          >
            [ Re-run pre-flight ]
          </button>
        </CliPanel>
      </div>
    );
  }

  if (result === null) {
    // Defensive: should never hit (loading + null is branch 2)
    return null;
  }

  // Plan 05-03 active-state branch — fires when daemon reports gateway active
  // on Linux. Wins over branches 5/6 (pre-flight) so the active body replaces
  // the enable form for as long as the daemon reports active === true.
  if (
    gatewayStatus.status === null
      ? false
      : gatewayStatus.status.active === true && result.platform === "linux"
  ) {
    const activeStatus = gatewayStatus.status;
    if (activeStatus !== null) {
      const badge = gaugeBadgeLabel(
        activeStatus.conntrack.used,
        activeStatus.conntrack.max,
      );
      return (
        <div className="max-w-5xl">
          <CliPanel title="gateway" status={{ label: badge }}>
            <GatewayActivePanel
              status={activeStatus}
              onDisable={gatewayStatus.disable}
              disabling={gatewayStatus.loading}
            />
          </CliPanel>
        </div>
      );
    }
  }

  // Branch 4 — non-Linux (GATE-04, D-10)
  if (result.platform !== "linux") {
    return (
      <div className="max-w-5xl">
        <CliPanel title="gateway" status={{ label: "LINUX-ONLY", variant: "muted" }}>
          <LinuxOnlyPanel platform={result.platform} />
        </CliPanel>
      </div>
    );
  }

  // Branch 5/6 — Linux pre-flight (Plan 05-03 prepends active branch)
  const allOk = result.checks.every((c) => c.ok === true);
  const badgeLabel = allOk === true ? "READY" : "PRE-FLIGHT";

  return (
    <div className="max-w-5xl">
      <CliPanel title="gateway" status={{ label: badgeLabel }}>
        <p className="font-code text-sm text-muted-foreground mb-3">
          share your internet with the mesh
        </p>

        <PreflightSection result={result} loading={loading} onRerun={refetch} />

        {allOk === true ? (
          <NatInterfaceSelect
            suggestedInterfaces={result.suggested_nat_interfaces}
            onEnabled={refetch}
          />
        ) : null}
      </CliPanel>
    </div>
  );
}
