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
import { SettingsScreen } from "@/screens/settings";
import { RouteScreen } from "@/screens/routing";
import { GatewayScreen } from "@/screens/gateway";
import { MessagesScreen } from "@/screens/messages";
import { AboutScreen } from "@/screens/about";
import { usePeerDetail } from "@/hooks/use-peer-detail";
import { usePairApproval } from "@/hooks/use-pair-approval";
import { PeerDetailSheet } from "@/components/peers/peer-detail-sheet";
import { PairApprovalModal } from "@/components/peers/pair-approval-modal";
// Peer-management overlays mounted at shell level so the Add Peer
// affordance on the Dashboard's PeerListPanel can open them without
// the (now-removed) Peers screen.
import { AddPeerSheet } from "@/components/peers/add-peer-sheet";
import { RemovePeerAlertDialog } from "@/components/peers/remove-peer-alert-dialog";
// Plan 03-04 §Part H.3 (checker Blocker 1) — D-13 nav-away interception.
// `getDirtySections` is read by `requestActive` (use-gated-navigation.ts)
// before any setActive; this file mounts the matching dialog so the
// dirty-section list and the dialog live at the same shell scope.
import { DiscardUnsavedChangesAlertDialog } from "@/components/settings/discard-unsaved-changes-alert-dialog";
import { getDirtySections } from "@/hooks/use-dirty-sections";
import { usePendingNav } from "@/hooks/use-gated-navigation";
import { SECTION_SCHEMAS, type SectionId } from "@/lib/config/section-schemas";
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
  // D-13 nav-away interception (checker Blocker 1). The pending-nav atom
  // is written by Sidebar / AppShell-keyboard via `requestActive(...)`
  // when getDirtySections() is non-empty; this hook reads it to decide
  // whether to mount the discard dialog.
  const { pending, discardAndProceed, stay } = usePendingNav();

  const onPeerSelect = (p: PeerSummary) => select(p);
  const onNearbyPair = (d: PeerDiscovered) => requestOutbound(d);

  // Resolve the section name + total dirty-field count when a discard
  // gate is open. If exactly one section is dirty we name it (e.g.
  // "Transport"); otherwise we use "this app session" so the verbatim
  // D-13 copy still reads naturally.
  const dirty = getDirtySections();
  const totalDirtyFields = dirty.reduce(
    (sum, d) => sum + d.dirtyFieldCount,
    0,
  );
  const sectionName: string =
    dirty.length === 1
      ? SECTION_SCHEMAS[dirty[0]?.id as SectionId].title
      : "this app session";

  return (
    <>
      <section
        aria-label={active}
        className={
          // Messages is the only viewport-filling screen — its conversation
          // pane needs the section to be a constrained flex column so the
          // panel can use `flex-1 min-h-0` end-to-end. Other screens stay
          // content-sized so <main>'s overflow-y-auto continues to scroll
          // the tall Dashboard / Settings / Logs layouts.
          active === "messages"
            ? "flex flex-col gap-6 flex-1 min-h-0"
            : "flex flex-col gap-6"
        }
      >
        {renderScreen(active, onPeerSelect, onNearbyPair)}
      </section>
      {/* App-global overlays — rendered once at shell level, not per-screen.
          Persist their state (selected peer, pair queue) across ⌘1 / ⌘2
          tab switches. */}
      <PeerDetailSheet />
      <PairApprovalModal />
      {/* Peers-tab overlays now live at shell level so the Dashboard's
          inline [ + add peer ] affordance can drive them without a
          dedicated screen. */}
      <AddPeerSheet />
      <RemovePeerAlertDialog />
      {/* D-13 discard-unsaved-changes dialog — opens whenever a gated
          navigation request lands while sections are dirty. Verbatim
          copy lives in the dialog component itself. */}
      <DiscardUnsavedChangesAlertDialog
        open={pending !== null}
        onOpenChange={(v) => {
          if (v === false) stay();
        }}
        sectionName={sectionName}
        dirtyFieldCount={totalDirtyFields}
        onDiscard={discardAndProceed}
        onStay={stay}
      />
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
    case "routing":
      // Phase 4 Plan 04-03 D-16/D-17: ⌘3 Routing tab. Three-panel stack
      // — RouteTogglePanel (D-15 same instance as Dashboard) +
      // RouteTablePanel + KnownGatewaysPanel.
      return <RouteScreen />;
    case "gateway":
      // Plan 05-01 D-02: gateway route now resolves to a real screen.
      // Plan 05-02 ships pre-flight + Linux-only copy; Plan 05-03 ships
      // the active-state gauge + throughput + peer-through-me list.
      return <GatewayScreen />;
    case "logs":
      // Real Logs screen: useLogsStream + LogToolbar + virtualized
      // LogList + D-28 auto-scroll pill.
      return <LogsScreen />;
    case "settings":
      // Plan 03-01 D-01: settings route is now active (⌘6). Plan 03-04
      // ships the SettingsScreen scaffold (nine CollapsibleCliPanel
      // section stubs in fixed order; bodies populated by 03-05/06).
      return <SettingsScreen />;
    case "messages":
      // 2026-04-30: encrypted peer-to-peer messaging tab.
      return <MessagesScreen />;
    case "about":
      // ⌘7 — dedicated About surface (split out of the previous Settings
      // section). Houses app + daemon version, credits, repo link,
      // keyboard shortcuts, and crash-log access.
      return <AboutScreen />;
    default:
      return assertNever(active);
  }
}
