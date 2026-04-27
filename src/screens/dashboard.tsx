/**
 * <Dashboard /> — Phase-2 4-panel stack (02-UI-SPEC §S2, 02-CONTEXT
 * D-08/D-10/D-30).
 *
 * Replaces the Phase-1 single-CliPanel layout with the four sections
 * locked by the UI-SPEC mockup, in this order (do NOT reorder):
 *
 *   1. IdentityPanel  — `█ pim · {node}` hero + mesh/interface/uptime
 *                       detail (STAT-01, STAT-04).
 *   2. PeerListPanel  — D-13-sorted connected peers, empty state copy
 *                       verbatim (PEER-01, STAT-02 connected count).
 *   3. NearbyPanel    — discovered-but-unpaired peers (PEER-05, D-19).
 *   4. MetricsPanel   — one dense line with forwarded / dropped /
 *                       egress per D-23 (STAT-02, STAT-03).
 *
 * D-10 (Phase 4): RouteTogglePanel rendered between IdentityPanel and
 * PeerListPanel. Component derives its own state from useDaemonState
 * + useRouteTable; this screen passes only `limitedMode` so dim
 * opacity stays consistent across the panel stack.
 *
 * D-06/D-07/D-08 (Phase 4 Plan 04-05): Dashboard wires PeerListPanel's
 * two enabled action buttons. `[ + Add peer nearby ]` calls a local
 * scrollToNearby() which scrolls the NearbyPanel into view via a ref;
 * the same scroll is also triggered by the `pim-ui:scroll-to-nearby`
 * window event dispatched by the WelcomeScreen (Plan 04-04) on the
 * `[ ADD PEER NEARBY ]` path. `[ Invite peer ]` opens the shell-level
 * InvitePeerSheet via useInvitePeer().open().
 *
 * D-30 limited mode: when daemon.state is anything other than "running", every panel dims
 * to opacity-60 and badges flip to [STALE]. The IdentityPanel also
 * appends a relative "last seen: N ago" hint derived from
 * snapshot.baselineTimestamp. This is honest — last-known state is
 * more useful than a blank screen.
 *
 * Shell layout changes in this plan:
 *   - Logo hero is removed — the sidebar (Plan 02-02) now owns
 *     branding via the `█ pim` wordmark.
 *   - AboutFooter is removed — Phase-2 Dashboard is panel-stack-only
 *     per UI-SPEC §S2.
 *   - ReconnectToast and StopConfirmDialog are moved to AppShell —
 *     these are app-level chrome, not Dashboard content.
 *   - DaemonToggle stays on the Dashboard, rendered in a small action
 *     row above the 4 panels so the IdentityPanel layout matches the
 *     ASCII mockup verbatim.
 *
 * Plan 02-04 will wire onPeerSelect / onNearbyPair to open the Peer
 * Detail slide-over + Pair Approval modal. Phase 2 Plan 03 accepts
 * those props but leaves them optional with no-op defaults so the
 * panels render cleanly before the slide-over plumbing lands.
 */

import { useEffect, useRef } from "react";
import type { PeerSummary, PeerDiscovered } from "@/lib/rpc-types";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useStatus } from "@/hooks/use-status";
import { usePeers } from "@/hooks/use-peers";
import { useDiscovered } from "@/hooks/use-discovered";
import { useInvitePeer } from "@/hooks/use-invite-peer";
import { IdentityPanel } from "@/components/identity/identity-panel";
import { PeerListPanel } from "@/components/peers/peer-list-panel";
import { NearbyPanel } from "@/components/peers/nearby-panel";
import { MetricsPanel } from "@/components/metrics/metrics-panel";
import { LimitedModeBanner } from "@/components/brand/limited-mode-banner";
import { DaemonToggle } from "@/components/brand/daemon-toggle";
import { RouteTogglePanel } from "@/components/routing/route-toggle-panel";

export interface DashboardProps {
  /** Wired by Plan 02-04 to open the Peer Detail slide-over. */
  onPeerSelect?: (peer: PeerSummary) => void;
  /** Wired by Plan 02-04 to open the outbound Pair Approval modal. */
  onNearbyPair?: (discovered: PeerDiscovered) => void;
}

export function Dashboard({ onPeerSelect, onNearbyPair }: DashboardProps = {}) {
  const { snapshot } = useDaemonState();
  const status = useStatus();
  const peers = usePeers();
  const discovered = useDiscovered();
  const { open: openInvite } = useInvitePeer();

  // Phase 4 D-07: ref to the NearbyPanel wrapper so [ + Add peer nearby ]
  // (and the WelcomeScreen window event below) can scroll it into view.
  const nearbyRef = useRef<HTMLDivElement | null>(null);

  const scrollToNearby = () => {
    if (nearbyRef.current === null) return;
    nearbyRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // Phase 4 D-07: Plan 04-04's WelcomeScreen [ ADD PEER NEARBY ] path
  // dispatches a `pim-ui:scroll-to-nearby` window event AFTER calling
  // onComplete() (which mounts AppShell + Dashboard). We wrap the scroll
  // in requestAnimationFrame so the panel is laid out before we measure.
  // Browser-native event channel — W1 invariant preserved (no Tauri
  // listen() call added by this hook).
  useEffect(() => {
    const handler = () => {
      requestAnimationFrame(scrollToNearby);
    };
    window.addEventListener("pim-ui:scroll-to-nearby", handler);
    return () => {
      window.removeEventListener("pim-ui:scroll-to-nearby", handler);
    };
  }, []);

  // D-30: limited mode is any non-`running` daemon state. Panels stay
  // visible with last-known data but dim to opacity-60.
  const limitedMode = snapshot.state === "running" ? false : true;

  // The Phase-1 LimitedModeBanner still surfaces in the transient /
  // offline states. `reconnecting` keeps the panels visible without the
  // banner because the Phase-1 banner is authored for daemon-lifecycle
  // states, not for the brief reconnect window.
  const showLimitedBanner =
    snapshot.state === "stopped" ||
    snapshot.state === "starting" ||
    snapshot.state === "error";

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      {showLimitedBanner === true ? <LimitedModeBanner /> : null}

      <div className="flex justify-end">
        <DaemonToggle />
      </div>

      <IdentityPanel
        status={status}
        limitedMode={limitedMode}
        lastSeenTimestamp={snapshot.baselineTimestamp}
      />

      <RouteTogglePanel limitedMode={limitedMode} />

      <PeerListPanel
        peers={peers}
        onPeerSelect={onPeerSelect}
        onAddPeerNearby={scrollToNearby}
        onInvitePeer={openInvite}
        limitedMode={limitedMode}
      />

      <div ref={nearbyRef}>
        <NearbyPanel
          discovered={discovered}
          onPair={onNearbyPair}
          limitedMode={limitedMode}
        />
      </div>

      <MetricsPanel status={status} limitedMode={limitedMode} />
    </div>
  );
}
