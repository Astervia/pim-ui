/**
 * <ActiveScreen /> — shell tab router switch (Phase 2 + Phase 3 03-01 +
 * Phase 4 04-03).
 *
 * Pure navigation glue: reads the active screen id from useActiveScreen()
 * and renders the matching screen component. Owns ZERO daemon logic —
 * subscribing to RPC is the screen's job, not the router's.
 *
 * Phase 2 D-02: "peers" aliased to Dashboard as a compromise.
 * Phase 3 Plan 03-01 D-02: "peers" gets a dedicated stub branch (the
 *       real PeersScreen lands in Plan 03-02). "settings" likewise gets
 *       a stub branch (real SettingsScreen lands in Plan 03-04).
 * Phase 4 Plan 04-03 D-16: "routing" case added; renders <RouteScreen />.
 * D-03: AppShell owns the outer <main> landmark — ActiveScreen renders
 *       a <section aria-label={active}> to avoid a second <main> inside
 *       <main> (axe landmark-unique violation).
 *
 * Extension seams (Wave 2 of Phase 2):
 *   - The dashboard body reads from live RPC selectors and exposes the
 *     onPeerSelect / onNearbyPair prop seams on <Dashboard />.
 *   - This file threads onPeerSelect / onNearbyPair through Dashboard,
 *     and mounts <PeerDetailSheet /> + <PairApprovalModal /> at shell
 *     level so they overlay every screen that displays peers. Overlays
 *     are rendered as siblings of the active-screen <section> so they
 *     are NOT duplicated per tab and their state persists across ⌘1 /
 *     ⌘2 switches.
 *   - The "logs" branch renders <LogsScreen /> (its useLogsStream hook
 *     owns its own subscription lifecycle on mount / unmount).
 * If a future phase needs additional overlay slots here, add them as
 * further siblings of <section> — do NOT inline daemon state.
 */

import { useActiveScreen, type ActiveScreenId } from "@/hooks/use-active-screen";
import { Dashboard } from "@/screens/dashboard";
import { LogsScreen } from "@/screens/logs";
import { PeersScreen } from "@/screens/peers";
import { SettingsScreen } from "@/screens/settings";
import { RouteScreen } from "@/screens/routing";
import { usePeerDetail } from "@/hooks/use-peer-detail";
import { usePairApproval } from "@/hooks/use-pair-approval";
import { PeerDetailSheet } from "@/components/peers/peer-detail-sheet";
import { PairApprovalModal } from "@/components/peers/pair-approval-modal";
import type { PeerDiscovered, PeerSummary } from "@/lib/rpc-types";

/**
 * Exhaustive-check helper: if a new ActiveScreenId is added and a branch
 * is missing below, TypeScript fails here with "Argument of type 'X' is
 * not assignable to parameter of type 'never'".
 */
function assertNever(id: never): never {
  throw new Error(`ActiveScreen: unhandled screen id ${String(id)}`);
}

export function ActiveScreen() {
  const { active } = useActiveScreen();
  const { select } = usePeerDetail();
  const { requestOutbound } = usePairApproval();

  const onPeerSelect = (p: PeerSummary) => select(p);
  const onNearbyPair = (d: PeerDiscovered) => requestOutbound(d);

  return (
    <>
      <section aria-label={active} className="flex flex-col gap-6">
        {renderScreen(active, onPeerSelect, onNearbyPair)}
      </section>
      {/* App-global overlays — rendered once at shell level, not per-screen.
          Persist their state (selected peer, pair queue) across ⌘1 / ⌘2
          tab switches. */}
      <PeerDetailSheet />
      <PairApprovalModal />
    </>
  );
}

function renderScreen(
  active: ActiveScreenId,
  onPeerSelect: (p: PeerSummary) => void,
  onNearbyPair: (d: PeerDiscovered) => void,
) {
  switch (active) {
    case "dashboard":
      return (
        <Dashboard onPeerSelect={onPeerSelect} onNearbyPair={onNearbyPair} />
      );
    case "peers":
      // Plan 03-02: dedicated PeersScreen — composes PeersPanel +
      // NearbyPanel + AddPeerSheet (PEER-02) and (Task 2)
      // RemovePeerAlertDialog (PEER-03). The Phase-2 D-01 alias to
      // Dashboard is gone for good — this route owns its own peer-list
      // chrome and add/remove affordances per 03-CONTEXT D-02.
      return <PeersScreen />;
    case "routing":
      // Phase 4 Plan 04-03 D-16/D-17: ⌘3 Routing tab. Three-panel stack
      // — RouteTogglePanel (D-15 same instance as Dashboard) +
      // RouteTablePanel + KnownGatewaysPanel.
      return <RouteScreen />;
    case "logs":
      // Real Logs screen: useLogsStream + LogFilterBar + virtualized
      // LogList + D-28 auto-scroll pill.
      return <LogsScreen />;
    case "settings":
      // Plan 03-01 D-01: settings route is now active (⌘6). Plan 03-04
      // ships the SettingsScreen scaffold (nine CollapsibleCliPanel
      // section stubs in fixed order; bodies populated by 03-05/06).
      return <SettingsScreen />;
    default:
      return assertNever(active);
  }
}
