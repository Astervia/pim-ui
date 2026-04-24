/**
 * <ActiveScreen /> — Phase-2 shell tab router switch.
 *
 * Pure navigation glue: reads the active screen id from useActiveScreen()
 * and renders the matching screen component. Owns ZERO daemon logic —
 * subscribing to RPC is the screen's job, not the router's.
 *
 * D-02: "peers" aliases to the Dashboard component in Phase 2 (Peers
 *       tab shows the Dashboard peer list). The id stays distinct so
 *       Phase 3 can swap in a dedicated Peers screen.
 * D-03: AppShell owns the outer <main> landmark — ActiveScreen renders
 *       a <section aria-label={active}> to avoid a second <main> inside
 *       <main> (axe landmark-unique violation).
 *
 * Extension seams (Wave 2 of Phase 2):
 *   - Plan 02-03 swaps the Dashboard body against real RPC data + adds
 *     onPeerSelect / onNearbyPair prop seams on <Dashboard />.
 *   - Plan 02-04 (this file) threads onPeerSelect / onNearbyPair through
 *     Dashboard, and mounts <PeerDetailSheet /> + <PairApprovalModal />
 *     at shell level so they overlay every screen that displays peers.
 *     Overlays are rendered as siblings of the active-screen <section>
 *     so they are NOT duplicated per tab and their state persists across
 *     ⌘1 / ⌘2 switches.
 *   - Plan 02-05 replaces the "logs" branch with the real Logs screen
 *     and its useLogsStream hook.
 * If a future plan needs additional overlay slots here, add them as
 * further siblings of <section> — do NOT inline daemon state.
 */

import { useActiveScreen, type ActiveScreenId } from "@/hooks/use-active-screen";
import { Dashboard } from "@/screens/dashboard";
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
    // D-02: Peers tab aliases to the Dashboard peer list in Phase 2.
    case "dashboard":
    case "peers":
      return (
        <Dashboard onPeerSelect={onPeerSelect} onNearbyPair={onNearbyPair} />
      );
    case "logs":
      // Phase-2 stub — Plan 02-05 will replace this with the real Logs
      // screen (useLogsStream + virtualized list + level/peer filter bar).
      return (
        <p className="font-code text-sm text-muted-foreground">
          Logs tab will be wired by Plan 02-05.
        </p>
      );
    default:
      return assertNever(active);
  }
}
