/**
 * <Dashboard /> — primary screen.
 *
 * Composition philosophy (UI/UX overhaul Phase 5 + Dashboard redesign):
 *
 *   1. IdentityPanel  — hero. Owns daemon-toggle, mesh detail, AND a
 *                       topology diagram showing where traffic is going.
 *   2. RouteTogglePanel — primary action. CliPanel emphasis when ON.
 *   3. PeerListPanel  — workspace. Connected peers + invite affordance.
 *   4. NearbyPanel    — conditional. Only when there's an unpaired
 *                       discovered peer to act on.
 *   5. Insights row   — two-column grid at default width:
 *      • ThroughputPanel — current bytes/sec + 60-sample sparkline
 *      • NetworkInsightsPanel — KV grid (forwarded, dropped, routes,
 *                                egress)
 *      Collapses to single column at narrow viewports via the brand
 *      container-query rules in CliPanel.
 *
 * Reveal staggering — every panel gets a `revealDelay` driving the
 * `.crt-on-stagger` CSS animation. Sequence (ms): 0 / 80 / 160 / 220 /
 * 280 / 320. The dashboard reads as a CRT firing up rather than a
 * static document.
 *
 * Spacing rhythm — ScreenContainer's gap-6 collapses to gap-4 for the
 * tight Identity ↔ Routing cluster; manual `mt-6` separates the peers
 * workspace and the insights periphery.
 *
 * D-30 limited mode preserved — every panel dims and badges flip to
 * [STALE]. IdentityPanel also appends `last seen: N ago` from the
 * snapshot baseline.
 *
 * W1 invariant preserved — the only browser CustomEvent listener
 * (`pim-ui:scroll-to-nearby`) stays as-is.
 */

import { useEffect, useMemo, useRef } from "react";
import type { PeerSummary, PeerDiscovered } from "@/lib/rpc-types";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useStatus } from "@/hooks/use-status";
import { usePeers } from "@/hooks/use-peers";
import { useDiscovered } from "@/hooks/use-discovered";
import { useInvitePeer } from "@/hooks/use-invite-peer";
import { IdentityPanel } from "@/components/identity/identity-panel";
import { PeerListPanel } from "@/components/peers/peer-list-panel";
import { NearbyPanel } from "@/components/peers/nearby-panel";
import { ThroughputPanel } from "@/components/metrics/throughput-panel";
import { NetworkInsightsPanel } from "@/components/metrics/network-insights-panel";
import { RelayContributionPanel } from "@/components/relay/relay-contribution-panel";
import { RouteTogglePanel } from "@/components/routing/route-toggle-panel";
import { ScreenContainer } from "@/components/shell/screen-container";

export interface DashboardProps {
  onPeerSelect?: (peer: PeerSummary) => void;
  onNearbyPair?: (discovered: PeerDiscovered) => void;
}

export function Dashboard({ onPeerSelect, onNearbyPair }: DashboardProps = {}) {
  const { snapshot } = useDaemonState();
  const status = useStatus();
  const peers = usePeers();
  const discovered = useDiscovered();
  const { open: openInvite } = useInvitePeer();

  // Hide already-paired peers from the nearby list so they don't
  // double-count once paired.
  const nearby = useMemo(
    () =>
      discovered.filter(
        (d) =>
          d.node_id === null ||
          peers.some((p) => p.node_id === d.node_id) === false,
      ),
    [discovered, peers],
  );

  const nearbyRef = useRef<HTMLDivElement | null>(null);
  const scrollToNearby = () => {
    if (nearbyRef.current === null) return;
    nearbyRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // WelcomeScreen → Dashboard handoff: a `pim-ui:scroll-to-nearby`
  // CustomEvent fires after the welcome path picks "ADD PEER NEARBY".
  // Browser-native event channel — W1 preserved.
  useEffect(() => {
    const handler = () => requestAnimationFrame(scrollToNearby);
    window.addEventListener("pim-ui:scroll-to-nearby", handler);
    return () => window.removeEventListener("pim-ui:scroll-to-nearby", handler);
  }, []);

  const limitedMode = snapshot.state === "running" ? false : true;

  return (
    <ScreenContainer className="gap-4">
      {/* Cluster 1 — identity hero (with topology + DaemonToggle inside)
          followed by routing primary action. Tight gap-4 keeps them
          reading as a single decision cluster. */}
      <IdentityPanel
        status={status}
        limitedMode={limitedMode}
        lastSeenTimestamp={snapshot.baselineTimestamp}
        showDaemonToggle={true}
        revealDelay={0}
      />

      <RouteTogglePanel limitedMode={limitedMode} revealDelay={80} />

      {/* Cluster 2 — peers workspace. mt-6 gives the peer list its own
          "room" so the eye reads it as the day-to-day work area. */}
      <div className="mt-6">
        <PeerListPanel
          peers={peers}
          onPeerSelect={onPeerSelect}
          onInvitePeer={openInvite}
          limitedMode={limitedMode}
          revealDelay={160}
        />
      </div>

      {nearby.length > 0 ? (
        <div ref={nearbyRef}>
          <NearbyPanel
            discovered={nearby}
            onPair={onNearbyPair}
            limitedMode={limitedMode}
            revealDelay={220}
          />
        </div>
      ) : null}

      {/* Periphery — insights row. Two columns at the default 72ch
          width (throughput on the left, KV on the right); collapses
          to a stack on narrow viewports. Phase 6 Plan 06-02 adds the
          RelayContributionPanel below as a third row so the relay
          role gets its own honest readout (peers via this node,
          forwarded bytes/packets) instead of being a subset of the
          generic network KV grid. */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <ThroughputPanel limitedMode={limitedMode} revealDelay={280} />
        <NetworkInsightsPanel
          status={status}
          limitedMode={limitedMode}
          revealDelay={320}
        />
      </div>

      <RelayContributionPanel limitedMode={limitedMode} revealDelay={360} />
    </ScreenContainer>
  );
}
