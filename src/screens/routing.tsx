/**
 * Phase 4 D-17: <RouteScreen /> — the ⌘3 Routing tab.
 *
 * Three-panel stack, top-to-bottom (D-15 explicit ordering):
 *   1. RouteTogglePanel  (same component instance as Dashboard, D-15 —
 *      no prop drilling, no duplicated state; both surfaces derive from
 *      the same `useDaemonState` snapshot).
 *   2. RouteTablePanel   (live route table; `[ refresh ]` calls
 *      `useRouteTable.refetch()` per D-20).
 *   3. KnownGatewaysPanel.
 *
 * Data: `useRouteTable()` does the one-shot `route.table` fetch on mount
 * and joins the W1 fan-out for refetches on `status.event` of kinds
 * `route_on | route_off | gateway_selected | gateway_lost | kill_switch`
 * (D-19). It is NOT a polling hook; the `[ refresh ]` button is the
 * documented escape hatch (D-20). No new types, no new RPC methods, no
 * new `lis` + `ten(` calls — every dependency was created in earlier
 * Phase-4 plans.
 *
 * D-30 limited mode: when the daemon is not `running`, all three panels
 * dim to opacity-60 and badges flip to `[STALE]` (each panel handles
 * its own dimming via the shared `limitedMode` prop). Mirrors the
 * Dashboard convention.
 *
 * W1 invariant preserved: this screen registers ZERO Tauri event
 * subscriptions of its own. After this file lands:
 *   - `rpc.ts` still owns 0 subscriptions
 *   - `use-daemon-state.ts` still owns exactly 2
 *   - this screen owns 0
 *
 * Bang-free per D-36 — every conditional uses `=== "running"` /
 * `=== null` instead of the JS negation operator.
 */

import { useDaemonState } from "@/hooks/use-daemon-state";
import { useRouteTable } from "@/hooks/use-route-table";
import { RouteTogglePanel } from "@/components/routing/route-toggle-panel";
import { RouteTablePanel } from "@/components/routing/route-table-panel";
import { KnownGatewaysPanel } from "@/components/routing/known-gateways-panel";
import { ScreenRefresh } from "@/components/brand/screen-refresh";

export function RouteScreen() {
  const { snapshot, actions } = useDaemonState();
  const { table, loading, refetch } = useRouteTable();

  // Screen-level refresh = daemon snapshot reseed + route-table refetch.
  // The RouteTablePanel keeps its own [refresh] for the table-only
  // case (D-20 escape hatch) — both buttons coexist.
  const refreshAll = async () => {
    await Promise.all([actions.reseed(), refetch()]);
  };

  // D-30 limited mode: same convention as Dashboard — anything other
  // than `running` is "limited", panels render last-known data dimmed.
  const limitedMode = snapshot.state === "running" ? false : true;

  // Defensive: until the first `route.table` fetch resolves, `table` is
  // null — render empty arrays so each panel's empty-state copy
  // (verbatim from src/lib/copy.ts) shows instead of a crash.
  const routes = table === null ? [] : table.routes;
  const gateways = table === null ? [] : table.gateways;

  return (
    <div className="max-w-4xl flex flex-col gap-6">
      <ScreenRefresh onRefresh={refreshAll} ariaLabel="refresh routing" />
      <RouteTogglePanel limitedMode={limitedMode} />
      <RouteTablePanel
        routes={routes}
        onRefresh={() => {
          void refetch();
        }}
        loading={loading}
        limitedMode={limitedMode}
      />
      <KnownGatewaysPanel gateways={gateways} limitedMode={limitedMode} />
    </div>
  );
}
