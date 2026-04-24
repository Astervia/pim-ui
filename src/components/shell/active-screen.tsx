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
 *   - Plan 02-03 swaps the Dashboard body against real RPC data.
 *   - Plan 02-04 threads the Peer Detail slide-over + Pair Approval
 *     modal into the rendered screen (likely via component composition
 *     inside Dashboard, not here — this file stays a pure switch).
 *   - Plan 02-05 replaces the "logs" branch with the real Logs screen
 *     and its useLogsStream hook.
 * If a future plan needs overlay/modal slots here, add optional
 * children or render-prop props — do NOT inline daemon state.
 */

import { useActiveScreen, type ActiveScreenId } from "@/hooks/use-active-screen";
import { Dashboard } from "@/screens/dashboard";

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

  return (
    <section aria-label={active} className="flex flex-col gap-6">
      {renderScreen(active)}
    </section>
  );
}

function renderScreen(active: ActiveScreenId) {
  switch (active) {
    // D-02: Peers tab aliases to the Dashboard peer list in Phase 2.
    case "dashboard":
    case "peers":
      return <Dashboard />;
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
