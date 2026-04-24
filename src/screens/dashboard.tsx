/**
 * Dashboard screen.
 *
 * Plan 01 deletes the mock data source that previously drove this
 * screen; the full rewiring against `useDaemonState` lands in Plan 04.
 * This file is a deliberate placeholder so `pnpm typecheck` stays
 * green during the interim plans (02, 03) without leaving a broken
 * import or a mock that would silently betray the honesty principle.
 */

// Dashboard rewiring lives in Plan 04 — temporary stub so typecheck passes.

export function Dashboard() {
  return (
    <main className="font-mono text-muted-foreground p-6">
      Phase 1 plan 04 will wire the dashboard to the daemon.
    </main>
  );
}
