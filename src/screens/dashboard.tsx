/**
 * <Dashboard /> — primary screen (Phase 5 composition).
 *
 * Stack ordering reflects visual hierarchy (Phase 5 of the UI/UX
 * overhaul). Top to bottom:
 *
 *   1. IdentityPanel  — hero (density="spacious"), `█ pim · {node}` +
 *                       mesh/interface/uptime detail. Now also owns
 *                       the DaemonToggle as a bottom-right action
 *                       inside the panel body — replaces the previous
 *                       header strip that competed for primary attention.
 *   2. RouteTogglePanel — primary action; CliPanel emphasis (2px primary
 *                       left edge) when state === ON so the panel
 *                       outranks neighbours by visual weight.
 *   3. PeerListPanel  — D-13-sorted connected peers; teaching empty
 *                       state via TeachingEmptyState (Phase 3).
 *   4. NearbyPanel    — discovered-but-unpaired peers; only rendered
 *                       when there's a real entry to act on.
 *   5. MetricsPanel   — periphery (density="compact"); single dense
 *                       line, smallest panel.
 *
 * Reveal staggering: every panel gets a `revealDelay` driving the
 * .crt-on-stagger CSS animation declared in globals.css. Sequence:
 * 0/80/160/220/280 ms — the staggered phosphor warm-up makes the
 * dashboard feel like a CRT firing up rather than a static document.
 *
 * Spacing rhythm (Phase 5): the ScreenContainer's default gap-6 is
 * compressed to gap-4 for tight clusters (Identity ↔ Routing) and
 * a manual `mt-6` is added before PeerList + before Metrics so the
 * peer list and the periphery breathe. Visually the eye groups the
 * top two panels as one cluster, the peer list as the workspace, and
 * the metrics as the readout.
 *
 * D-30 limited mode preserved: every panel dims and badges flip to
 * [STALE]. IdentityPanel also appends `last seen: N ago` from the
 * snapshot baseline.
 *
 * W1 invariant preserved — ScrollToNearby still uses browser
 * CustomEvent, no Tauri listeners added.
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
import { MetricsPanel } from "@/components/metrics/metrics-panel";
import { ScreenRefresh } from "@/components/brand/screen-refresh";
import { RouteTogglePanel } from "@/components/routing/route-toggle-panel";
import { ScreenContainer } from "@/components/shell/screen-container";

export interface DashboardProps {
  /** Wired by Plan 02-04 to open the Peer Detail slide-over. */
  onPeerSelect?: (peer: PeerSummary) => void;
  /** Wired by Plan 02-04 to open the outbound Pair Approval modal. */
  onNearbyPair?: (discovered: PeerDiscovered) => void;
}

export function Dashboard({ onPeerSelect, onNearbyPair }: DashboardProps = {}) {
  const { snapshot, actions } = useDaemonState();
  const status = useStatus();
  const peers = usePeers();
  const discovered = useDiscovered();
  const { open: openInvite } = useInvitePeer();

  // Hide discovered peers that already exist in the connected peer list —
  // the daemon advertises a peer via broadcast even after pairing, so an
  // active peer would otherwise appear twice (once as CONNECTED and again
  // as NEARBY with a misleading [ PAIR ] button).
  const nearby = useMemo(
    () =>
      discovered.filter(
        (d) =>
          d.node_id === null ||
          peers.some((p) => p.node_id === d.node_id) === false,
      ),
    [discovered, peers],
  );

  // Ref retained so the WelcomeScreen's `pim-ui:scroll-to-nearby` event
  // can still bring the NearbyPanel into view after onboarding completes.
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

  // Phase 1 Task 1.3: LimitedModeBanner moved to AppShell-level
  // BannerStack. Dashboard no longer renders it inline.

  return (
    <ScreenContainer className="gap-4">
      {/* Tiny refresh affordance — no longer competes with the primary
          DaemonToggle (which now lives inside IdentityPanel). Stays
          right-aligned and low-weight; keyboard users can still trigger
          a manual reseed but visually it stays out of the way. */}
      <ScreenRefresh
        onRefresh={actions.reseed}
        ariaLabel="refresh dashboard"
      />

      {/* Cluster 1 — identity + primary routing action (tight). */}
      <IdentityPanel
        status={status}
        limitedMode={limitedMode}
        lastSeenTimestamp={snapshot.baselineTimestamp}
        showDaemonToggle={true}
        revealDelay={0}
      />

      <RouteTogglePanel limitedMode={limitedMode} revealDelay={80} />

      {/* Cluster 2 — peers workspace (loose separation above). */}
      <div className="mt-6">
        <PeerListPanel
          peers={peers}
          onPeerSelect={onPeerSelect}
          onInvitePeer={openInvite}
          limitedMode={limitedMode}
          revealDelay={160}
        />
      </div>

      {/* Auto-pair is enabled by default — discovered peers transition
          to CONNECTED in <20ms, so the Nearby panel would otherwise sit
          empty as visual noise. We render it only when there is actually
          an unpaired peer to act on (manual-pair mode, failed handshake,
          or briefly during the discovery → connection window). */}
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

      {/* Periphery — metrics readout (loose separation above). */}
      <div className="mt-6">
        <MetricsPanel
          status={status}
          limitedMode={limitedMode}
          revealDelay={280}
        />
      </div>
    </ScreenContainer>
  );
}
