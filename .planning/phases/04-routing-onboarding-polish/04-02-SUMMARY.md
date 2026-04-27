---
phase: 04-routing-onboarding-polish
plan: 02
subsystem: ui
tags: [react, tauri, routing, selectors, cli-panel, w1-fanout]

# Dependency graph
requires:
  - phase: 01-rpc-bridge-daemon-lifecycle
    provides: callDaemon, useDaemonState, W1 single-listener fan-out, RpcMethodMap
  - phase: 02-honest-dashboard-peer-surface
    provides: CliPanel + Badge primitives, dashboard panel stack, sonner toast wiring
  - phase: 04-routing-onboarding-polish
    provides: src/lib/copy.ts (locked strings), src/lib/routing.ts (formatRouteLine + derivePreflight)
provides:
  - useRouteOn / useSelectedGateway / useKillSwitch — D-30 selector hooks over snapshot.status
  - useRouteTable — D-18 W1 fan-out joiner with refcounted refetch on D-19 trigger kinds
  - RouteTogglePanel — three-state route control surface (off / pre-flight / on / pending)
  - Dashboard panel stack now renders ROUTING between Identity and Peers per D-10
affects: [04-03 routing-screen (consumes RouteTogglePanel + useRouteTable), 04-04 onboarding-add-peer-scroll, 04-05 button-props-enable, 04-06 verification-and-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level refcounted hook (useRouteTable) mirrors usePeerTroubleshootLog — single subscription regardless of consumer count, last-consumer-unmount tears down"
    - "Selector hooks as one-liners over useDaemonState — no useMemo (React 19 compiler), nullable returns, no new snapshot fields"
    - "RPC panels use no-optimistic-UI: actions call route.set_split_default and wait for the route_on/route_off status.event to flip useRouteOn() — body line is gated on the snapshot, not on local state"
    - "Brand-grep gates baked into commits: 0 rounded-*, 0 gradient, 0 bangs, 0 listen( in every new file"

key-files:
  created:
    - src/hooks/use-routing.ts
    - src/hooks/use-route-table.ts
    - src/hooks/use-route-table.test.ts
    - src/components/routing/route-toggle-panel.tsx
  modified:
    - src/screens/dashboard.tsx

key-decisions:
  - "Plan 04-02: useRouteTable refcount + module-level shared state (sharedTable / sharedError / sharedLoading + subscribers Set) — pattern lifted from usePeerTroubleshootLog so the W1 fan-out joiner stays single-subscription even when both Dashboard's RouteTogglePanel and the future RouteScreen mount it concurrently"
  - "Plan 04-02: route-toggle pending state uses a shared `pending` local flag that overrides routeOn/expanded when computing the badge — keeps `[…]` cursor-blink visible during the in-flight RPC without requiring an optimistic transition; snapshot remains source of truth"
  - "Plan 04-02: badge cursor-blink rendered via wrapper-class `[&_header_span:last-child]:cursor-blink` rather than mutating CliPanel API — Phase 2 D-policy keeps shared primitives untouched; Phase 4 panels carry their own selector classes"
  - "Plan 04-02: RouteTogglePanel `useSelectedGateway()` is intentionally invoked (via `void`) even though the rendered line comes from formatRouteLine — explicit dependency keeps the panel re-rendering on gateway changes future-proof against any refactor that splits the route line into a separate sub-component"

patterns-established:
  - "W1 fan-out joiner with refcount + subscribers Set: useRouteTable joins existing status.event fan-out via actions.subscribe — zero new Tauri listeners; module-level state is shared and reactively invalidated via useState force-render"
  - "Three-state CliPanel pattern: off / expanded / on / pending all derived from snapshot + 2-3 local flags, badge label/variant computed in fixed precedence order (limitedMode > pending > snapshot-derived > local-expanded > default)"
  - "Locked-copy import discipline: every user-visible string imported from @/lib/copy — pnpm audit:copy enforces no paraphrase"

requirements-completed: [ROUTE-01, ROUTE-02]

# Metrics
duration: 6min
completed: 2026-04-27
---

# Phase 04 Plan 02: Route-toggle dashboard panel (ROUTE-01, ROUTE-02) Summary

**Three-state RouteTogglePanel + W1-compliant useRouteTable + D-30 routing selectors — the most-visible Phase 4 surface for Aria, wired to the Dashboard panel stack between Identity and Peers without a single new Tauri listener.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-27T01:22:39Z
- **Completed:** 2026-04-27T01:28:45Z
- **Tasks:** 4
- **Files created:** 4
- **Files modified:** 1

## Accomplishments

- D-30 selector hooks (`useRouteOn`, `useSelectedGateway`, `useKillSwitch`) — three thin selectors over `useDaemonState().snapshot.status`. NO new fields on `DaemonSnapshot`; mirrors the Phase 2 `useStatus` / `usePeers` / `useDiscovered` pattern.
- D-18 `useRouteTable` hook — one-shot `route.table` fetch on first mount, then refetches on D-19 trigger kinds (`route_on` / `route_off` / `gateway_selected` / `gateway_lost` / `kill_switch`) by joining the existing W1 fan-out via `actions.subscribe('status.event', ...)`. Module-level refcount + shared state. Zero new Tauri listeners. `refetch()` exposed as the D-20 `[ refresh ]` escape hatch for the Routing tab in 04-03.
- D-10..D-15 `RouteTogglePanel` — three runtime states (off / pre-flight / on / pending), all derived from `useRouteOn()` + local `expanded`/`pending` flags. `[ CONFIRM TURN ON ]` calls `route.set_split_default({ on: true })`; on success the snapshot's `route_on` event flips `useRouteOn()` to true and the panel transitions to the on body. RPC errors raise sonner toasts (`Couldn't enable routing: {message}`) and prepend a `✗ {message}` row to the checklist. D-30 limited mode dims to opacity-60 with `[STALE]` badge.
- D-10 Dashboard insertion — `<RouteTogglePanel limitedMode={limitedMode} />` placed between `<IdentityPanel />` and `<PeerListPanel />`. Final panel order: `LimitedModeBanner → DaemonToggle → Identity → ROUTING → Peers → Nearby → Metrics`. Top-of-file docblock updated to reflect Phase 4 routing-toggle insertion.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-execution requirement):

1. **Task 1: Create src/hooks/use-routing.ts (D-30 selectors)** — `940aae8` (feat)
2. **Task 2: Create src/hooks/use-route-table.ts + test (D-18 fan-out joiner)** — `c0c2fc0` (feat)
3. **Task 3: Create src/components/routing/route-toggle-panel.tsx (D-10..D-15)** — `956144f` (feat)
4. **Task 4: Insert RouteTogglePanel into Dashboard (D-10)** — `c9839b3` (feat)

## Files Created/Modified

- `src/hooks/use-routing.ts` — three exported selector hooks per D-30 (`useRouteOn`, `useSelectedGateway`, `useKillSwitch`) deriving from `useDaemonState().snapshot.status`. No new snapshot fields, no `useMemo`, bang-free.
- `src/hooks/use-route-table.ts` — `useRouteTable()` joining the W1 fan-out via `actions.subscribe('status.event', ...)` per D-18. Module-level refcount + shared `sharedTable` / `sharedError` / `sharedLoading` + `subscribers` Set. `REFETCH_KINDS` is a `ReadonlySet<StatusEventKind>` for `route_on` / `route_off` / `gateway_selected` / `gateway_lost` / `kill_switch`. Exposes `__test_resetRouteTable` for downstream tests.
- `src/hooks/use-route-table.test.ts` — compile-only test pinning `UseRouteTableResult` shape. Phase 1/2 convention (no vitest, `if (false)` guard).
- `src/components/routing/route-toggle-panel.tsx` — three-state `<CliPanel>` rendering off / pre-flight expanded / on / pending. Imports locked copy from `@/lib/copy`. Calls `formatRouteLine(status, routeTable)` for the on body and `derivePreflight(status)` for the pre-flight checklist. RPC error path raises sonner toasts and surfaces a `✗ {message}` row. Pending state shows `[…]` badge with cursor-blink via wrapper-class selector.
- `src/screens/dashboard.tsx` — `<RouteTogglePanel limitedMode={limitedMode} />` inserted between `<IdentityPanel />` and `<PeerListPanel />`. Top-of-file docblock D-10 note flipped from "not rendered in Phase 2" to "rendered between Identity and Peers".

## Decisions Made

- **Pending state badge via wrapper-class CSS selector** — CliPanel's `status` prop is `{ label, variant }` with no `blink` flag. Rather than expand the shared primitive's API in this plan (Phase 2 D-policy: keep shared primitives untouched), the panel adds `[&_header_span:last-child]:cursor-blink` to the wrapper className. Falls back to a plain `[…]` if a future CliPanel rewrite drops descendant-class targeting.
- **`useSelectedGateway()` invoked via `void` in RouteTogglePanel** — `formatRouteLine` already derives the gateway label from `status` directly, so the panel does not consume the selector's return value today. Pulling the hook anyway (with `void`) keeps RouteTogglePanel reactive to future selector-driven derivations without needing to refactor when 04-04 / 04-05 add per-gateway behavior.
- **`useDaemonState()` invoked via `void` in RouteTogglePanel** — same reasoning; RouteTogglePanel reads several selectors that already subscribe via `useDaemonState`, but the explicit hook call documents the dependency for future maintainers and ensures every snapshot mutation triggers a re-render even if upstream selectors are inlined.
- **Compile-only test for `useRouteTable`** — Phase 1/2 convention. The test imports `useRouteTable` and `__test_resetRouteTable`, pins `UseRouteTableResult` member types, and references all captured names so `tsc --noEmit` validates without `--noUnusedLocals` warnings. No vitest is installed in the repo; `pnpm test` is not a package script. Compile-time is the test framework.
- **No new types in `rpc-types.ts`** — D-35 explicitly forbids extending the wire-types module. `UseRouteTableResult` lives in the hook file because it is a UI-shape, not a wire-shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Reworded docblocks to satisfy D-36 grep gates**
- **Found during:** Task 1, Task 3
- **Issue:** The plan-prescribed docblocks for `use-routing.ts` and `route-toggle-panel.tsx` referenced D-36 rules verbatim — `grep -c 'listen(' src/lib/rpc.ts === 0`, `No gradients`, `No '!' in any string literal` — which themselves match the very grep gates they were documenting. `grep -c 'listen(' src/hooks/use-routing.ts` returned 2 (matching the docblock references); `grep -E '\bgradient' src/components/routing/route-toggle-panel.tsx | wc -l` returned 1; `grep -E '\!' ... | wc -l` returned 1.
- **Fix:** Reworded the docblocks to describe the invariants without quoting the literal `listen(` / `gradient` / `!` tokens. Semantics preserved (W1 contract still documented; brand absolutes still listed); only the wording changed so the grep-based audit gates pass mechanically. Phase 2 D-policy is that grep gates are mechanical regression-detectors — the gates win.
- **Files modified:** `src/hooks/use-routing.ts`, `src/components/routing/route-toggle-panel.tsx`
- **Verification:** All three D-36 gates against new files now return 0; `pnpm typecheck` passes; `pnpm audit:copy` reports 0 hard violations.
- **Committed in:** `940aae8` (Task 1) and `956144f` (Task 3) — folded into the same task commits since the grep gates ARE Task 1/3's acceptance criteria.

---

**Total deviations:** 1 auto-fixed (Rule 1 — surface-level wording adjustment to satisfy mechanical grep gates that are themselves documented in the same surface)
**Impact on plan:** Zero behavioral change; the rules being documented are now described without using their forbidden tokens. The grep gates themselves are unchanged. No scope creep.

## Issues Encountered

- **Cross-agent typecheck transient (parallel execution):** During Task 4, `pnpm typecheck` briefly reported `src/components/shell/active-screen.tsx(100,26): error TS2345: Argument of type '"routing"' is not assignable to parameter of type 'never'.` This was caused by 04-03 (running in parallel) having uncommitted changes to `src/hooks/use-active-screen.ts` (extending `ActiveScreenId` with `"routing"`) without yet committing the matching update to `active-screen.tsx`. The error was in 04-03's territory (shell wiring, NOT this plan's files), and resolved itself when 04-03 finished its shell-wiring updates. Final `pnpm typecheck` after all parallel-agent work landed: exits 0. My plan's files (`use-routing.ts`, `use-route-table.ts`, `route-toggle-panel.tsx`, `dashboard.tsx` insertion) are correct in isolation; the `dashboard.tsx` insertion does not depend on the shell wiring.

## Verification Results

- **`pnpm typecheck`:** exits 0
- **`pnpm audit:copy`:** exits 0 (1 pre-existing soft warning in `src/components/ui/form.tsx:53` — out of scope per plan; lives in shadcn-generated runtime-error string, not user-visible copy)
- **W1 invariants:**
  - `grep -c 'listen(' src/lib/rpc.ts` returns `0`
  - `grep -c 'listen(' src/hooks/use-daemon-state.ts` returns `2`
  - `grep -c 'listen(' src/hooks/use-route-table.ts` returns `0`
  - `grep -c 'listen(' src/hooks/use-routing.ts` returns `0`
  - `grep -c 'listen(' src/components/routing/route-toggle-panel.tsx` returns `0`
- **D-36 brand grep gates (against new files):**
  - `rounded-*` in `route-toggle-panel.tsx`: `0`
  - `gradient` in `route-toggle-panel.tsx`: `0`
  - bang-free check (`grep -E '\!' ... | grep -v '!==' | grep -v '!='`): `0` for `route-toggle-panel.tsx`, `use-route-table.ts`, `use-routing.ts`
- **Dashboard panel order:** verified — `IdentityPanel` (line 91) → `RouteTogglePanel` (line 97) → `PeerListPanel` (line 99) → `NearbyPanel` (line 105) → `MetricsPanel` (line 111).

## Self-Check: PASSED

All claimed files exist on disk and all task commits are reachable from `main`:

- `src/hooks/use-routing.ts` — FOUND
- `src/hooks/use-route-table.ts` — FOUND
- `src/hooks/use-route-table.test.ts` — FOUND
- `src/components/routing/route-toggle-panel.tsx` — FOUND
- `src/screens/dashboard.tsx` (modified) — FOUND
- `940aae8` (Task 1) — FOUND in `git log`
- `c0c2fc0` (Task 2) — FOUND in `git log`
- `956144f` (Task 3) — FOUND in `git log`
- `c9839b3` (Task 4) — FOUND in `git log`

## Next Phase Readiness

- Plan 04-03 (Routing screen) consumes `RouteTogglePanel` (D-15: same component instance on Dashboard and Routing tab) and `useRouteTable` (D-18) — both shipped in this plan and verified to support multi-mount via the module-level refcount.
- Plan 04-04 / 04-05 will edit `src/screens/dashboard.tsx` again (onboarding scroll wire + PeerListPanel button props) — this plan's edits are minimal and surgical, reducing merge-conflict surface.
- Plan 04-06 (final phase verification + audit) will run the full grep gate suite — every gate in this plan's success criteria already passes.

---
*Phase: 04-routing-onboarding-polish*
*Completed: 2026-04-27*
