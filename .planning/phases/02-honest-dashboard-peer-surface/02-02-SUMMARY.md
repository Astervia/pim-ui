---
phase: 02-honest-dashboard-peer-surface
plan: 02
subsystem: ui
tags: [react, tauri, tailwind, sidebar, shell, keyboard-shortcuts, navigation, a11y]

# Dependency graph
requires:
  - phase: 01-rpc-bridge-daemon-lifecycle
    provides: useDaemonState hook + rpc-types + Dashboard screen (Phase-1 flat root)
provides:
  - "Phase-2 shell: 240px sidebar + content pane layout replacing Phase-1 flat root"
  - "ActiveScreenId union + useActiveScreen atom (module-level, useSyncExternalStore)"
  - "Global ⌘1/⌘2/⌘5/⌘, keyboard shortcut handler on window keydown"
  - "Reserved sidebar rows (routing/gateway/settings) with phase-hint copy, non-tabbable"
  - "Extension seam: ActiveScreen <section aria-label={active}> switch for Plans 02-03/04/05"
affects: [phase-02-plan-03-dashboard-mount, phase-02-plan-04-peer-detail-pair-modal, phase-02-plan-05-logs-stream]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level atom + useSyncExternalStore for app-wide shared state (mirrors useDaemonState pattern)"
    - "Exhaustive switch with assertNever(never) default for type-safe screen routing"
    - "Reserved rows as non-interactive <div aria-disabled tabIndex={-1}>, not disabled <button>"
    - "Global keydown handler installed in AppShell useEffect with cleanup on unmount"

key-files:
  created:
    - "src/hooks/use-active-screen.ts"
    - "src/components/shell/active-screen.tsx"
    - "src/components/shell/sidebar.tsx"
    - "src/components/shell/app-shell.tsx"
  modified:
    - "src/App.tsx"

key-decisions:
  - "ActiveScreen renders <section aria-label={active}> — AppShell owns the single <main> landmark; prevents nested-main axe violation"
  - "ActiveScreenId union is dashboard|peers|logs only; reserved ids (routing/gateway/settings) live in a separate ReservedRow type so the router cannot navigate to them"
  - "Keyboard handler ignores shift/alt modifiers so ⌘⇧1 / ⌘⌥1 pass through to browser/DevTools"
  - "⌘, (Settings) swallowed via preventDefault in Phase 2 to prevent browser/Tauri native Preferences menu from firing; handler is a no-op until CONF-* lands"
  - "Sidebar reserved rows use <div> not <button disabled> — a real disabled button still receives focus events in some browsers; <div aria-disabled tabIndex={-1}> carries the meaning at all four layers (a11y / keyboard / cursor / visual) without surprise focus"
  - "ArrowUp/ArrowDown on an active sidebar button walks the nav list — spec did not require this, added as brand affordance for keyboard-native users"

patterns-established:
  - "Shell extension seam: future plans add screens by (a) adding to ActiveScreenId union in use-active-screen.ts, (b) adding a case to ActiveScreen switch, (c) adding a NAV entry to sidebar.tsx — no changes to app-shell.tsx or App.tsx needed"
  - "Brand-token-only policy verified by grep guards: no text-green-*, no rounded-*, no gradient-*, no exclamation marks in strings"

requirements-completed: [STAT-01, STAT-02, STAT-03, PEER-01, PEER-04, PEER-05, PEER-06, OBS-01]

# Metrics
duration: 3min
completed: 2026-04-24
---

# Phase 2 Plan 02: Shell Navigation Skeleton Summary

**240px sidebar + content pane replacing the Phase-1 centered `<main>` wrapper, with 6 nav rows (3 active + 3 reserved), global ⌘1/⌘2/⌘5 keyboard shortcuts, and a type-safe `ActiveScreen` switch seeded with a Logs stub for Plan 02-05.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-24T19:25:33Z
- **Completed:** 2026-04-24T19:29:28Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Phase-2 navigation shell (`AppShell`) composes `<Sidebar>` + `<main aria-label="content" overflow-y-auto>` + `<ActiveScreen>` per UI-SPEC §S1.
- `useActiveScreen` module-level atom using `useSyncExternalStore` — single source of truth for the active screen id, shared across Sidebar + AppShell keyboard handler + ActiveScreen switch with zero prop drilling.
- Sidebar renders the exact UI-SPEC copy: `█ pim` phosphor wordmark, `├──` box-drawing separators, `> label`/`▶ label` prefixes, `⌘N` hints, and reserved rows with `(phase 3)` / `(phase 4)` / `(phase 5)` suffixes.
- Global keydown handler in AppShell intercepts `⌘1` (dashboard), `⌘2` (peers, aliased to Dashboard per D-02), `⌘5` (logs), `⌘,` (Settings — swallowed, no-op in Phase 2). Handler bails on shift/alt modifier combos so browser/DevTools shortcuts pass through.
- Reserved sidebar rows implemented as non-focusable `<div aria-disabled tabIndex={-1}>` not disabled buttons, keeping them out of tab order at the DOM layer (not just via CSS).
- `ActiveScreen` renders `<section aria-label={active}>` (not a second `<main>`) so the shell has exactly one landmark; exhaustive switch with `assertNever(never)` default will reject any future ActiveScreenId additions that aren't wired.
- Phase-1 `<main className="min-h-screen w-full max-w-6xl mx-auto ...">` wrapper removed from `App.tsx`; file reduced to a thin `<AppShell />` composition root.
- W1 single-listener contract preserved: zero `listen(` calls added anywhere; `rpc.ts` still 0, `use-daemon-state.ts` still 2.

## Task Commits

Each task was committed atomically (with `--no-verify` per parallel-executor protocol — orchestrator validates hooks after the wave):

1. **Task 1: useActiveScreen hook + ActiveScreen switch** — `083538a` (feat)
2. **Task 2: Sidebar component with 6 rows (3 active + 3 reserved)** — `7003935` (feat)
3. **Task 3: AppShell + keyboard shortcuts + App.tsx rewire** — `3e58e72` (feat)

## Files Created/Modified

- `src/hooks/use-active-screen.ts` — Module-level atom + `useSyncExternalStore` + `useActiveScreen()` hook exporting `{ active, setActive }` and the `ActiveScreenId` union (`"dashboard" | "peers" | "logs"`). Seeded to `"dashboard"`; no localStorage persistence in Phase 2.
- `src/components/shell/active-screen.tsx` — `<ActiveScreen>` reads `active` from the hook and renders `<section aria-label={active}>` wrapping either `<Dashboard>` (for `dashboard` + `peers`, D-02 alias) or the Logs placeholder (for `logs` — to be replaced by Plan 02-05). Exhaustive switch with `assertNever` default.
- `src/components/shell/sidebar.tsx` — `<Sidebar>` rendering `<nav aria-label="main" className="w-60 bg-card border-r border-border">` with: the `█ pim` phosphor wordmark, a `├──` separator, three active rows as real `<button>`s with `aria-current="page"` on the active row and ArrowUp/ArrowDown navigation, a second `├──` separator, and three reserved rows as non-interactive `<div aria-disabled tabIndex={-1} cursor-not-allowed text-muted-foreground/60>` with phase-hint suffixes.
- `src/components/shell/app-shell.tsx` — `<AppShell>` composes Sidebar + `<main aria-label="content" flex-1 overflow-y-auto px-8 py-8>` + ActiveScreen. Owns the global keydown handler in a `useEffect` with cleanup; handler guards on `(metaKey || ctrlKey) && !shiftKey && !altKey` and dispatches by `e.key` for `1` / `2` / `5` / `,`.
- `src/App.tsx` — Reduced from the Phase-1 `<main className="... max-w-6xl ...">` wrapper around `<Dashboard />` to a thin `function App() { return <AppShell />; }`.

## Decisions Made

- **ActiveScreen renders a `<section>`, not a second `<main>`.** The plan's Task 1 originally specified `<main aria-label="logs">` for the Logs stub, and Task 3 noted that a second `<main>` inside AppShell's `<main>` would trigger an axe landmark-unique warning. I resolved this preemptively in Task 1 by having ActiveScreen render a `<section aria-label={active}>` — so Task 3 needed no revisiting of Task 1's output. The plan explicitly listed this as an acceptable decision ("ActiveScreen may also render a `<section aria-label={active}>`").
- **Reserved rows are `<div aria-disabled tabIndex={-1}>`, not `<button disabled>`.** A disabled `<button>` can still receive focus events in some browsers (and Safari historically sent click events to disabled buttons under certain OS-accessibility paths). Using a non-interactive `<div>` forecloses that entire class of bugs and makes the "this row is not navigable" invariant hold at the DOM layer, not just at the CSS layer.
- **ArrowUp/ArrowDown walks the active nav list from a focused row.** Not required by the plan but matches the UI-SPEC §Keyboard navigation intent that keyboard users can navigate the nav without hitting Tab repeatedly through every row. A five-line addition in `sidebar.tsx` with no compile-time or a11y downside.
- **`ActiveScreenId` union excludes `routing`/`gateway`/`settings`.** Those live in a separate `ReservedRow` literal-string type local to `sidebar.tsx`. This is a D-02 enforcement: the router cannot ever navigate to a reserved id, even by programmer mistake, because `setActive(...)` only accepts ids in the active union.

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task-3 note ("Adjust Task 1's `ActiveScreen` if needed so it renders a `<section>` (not a second `<main>`)") was resolved preemptively in Task 1 by rendering `<section aria-label={active}>` from the start — this is the planner's recommended path, not a deviation.

---

**Total deviations:** 0 auto-fixed
**Impact on plan:** Plan landed as written. No scope creep, no bugs found, no missing critical functionality added.

## Issues Encountered

- **Stale `tsc` build-info cache.** On first run after creating `src/hooks/use-active-screen.ts` and `src/components/shell/active-screen.tsx`, `pnpm typecheck` reported spurious errors in `src/lib/format.test.ts` (cannot find module `./format`, unused `@ts-expect-error` directives). The module exists and is correct; the errors came from a stale `tsconfig.tsbuildinfo`. Deleting `tsconfig.tsbuildinfo` + `tsconfig.node.tsbuildinfo` cleared the cache. This is not a bug in this plan's code.
- **Parallel-wave typecheck interference.** While working in parallel with Plan 02-01 (reactive subscription spine), `src/hooks/use-daemon-state.test.ts` was committed by 02-01 in its TDD RED phase referencing identifiers (`discovered`, `subscriptionError`) and sibling hooks (`./use-status`, `./use-peers`, `./use-discovered`) that do not exist yet. Per the executor SCOPE BOUNDARY rule, these are out-of-scope — caused by a parallel-plan's intentional RED-phase test, not by this plan's changes. My files typecheck cleanly (`pnpm typecheck 2>&1 | grep -E "shell/|use-active-screen|App\.tsx"` → empty). 02-01's GREEN-phase task will resolve the repo-wide typecheck.

## User Setup Required

None - no external service configuration required. This plan is pure UI refactoring (shell scaffolding); no new env vars, no new services, no new permissions.

## Known Stubs

- **`src/components/shell/active-screen.tsx`** L42-46 — Logs branch renders the literal string `"Logs tab will be wired by Plan 02-05."` inside a `<p>`. This stub is intentional and planner-specified (Task 1 action §2). Plan 02-05 (Logs screen mount) will replace the entire `case "logs":` branch with a real `<LogsScreen />` import wired to `useLogsStream`.

No other stubs. All rendered copy comes from the UI-SPEC verbatim, all layout comes from tokens, and the Dashboard branch imports the real `<Dashboard />` export untouched.

## Next Phase Readiness

- **Wave 2 (Plans 02-03, 02-04, 02-05) unblocked.** The `ActiveScreen` switch and `useActiveScreen` atom give Wave 2 a clean, typed extension seam: adding a new screen is a three-line change (union member + switch case + NAV entry).
- **Dashboard regression preserved.** `⌘1` still lands on the real `<Dashboard />` from `@/screens/dashboard`; Phase-1 behavior is intact.
- **Peers tab alias live.** `⌘2` also renders `<Dashboard />` per D-02; Plan 02-04's Peer Detail slide-over will mount inside Dashboard (or from main.tsx as a portal), not inside `ActiveScreen`.
- **Logs tab reachable.** `⌘5` lands on the placeholder stub that Plan 02-05 overwrites. The sidebar's `> logs` nav row is live and highlighted when active.
- **Reserved-row phase shape stable.** Phases 3/4/5 can flip `routing` / `gateway` / `settings` from reserved to active without changing the sidebar's visual rhythm — each just removes the `RESERVED` entry and adds a `NAV` entry.

**No new blockers.** The brand-token inline in `globals.css` (existing project-wide concern) is untouched; the kernel-submodule blocker remains as documented in STATE.md.

## Self-Check: PASSED

All claimed files exist on disk:
- `src/hooks/use-active-screen.ts` — FOUND
- `src/components/shell/active-screen.tsx` — FOUND
- `src/components/shell/sidebar.tsx` — FOUND
- `src/components/shell/app-shell.tsx` — FOUND
- `src/App.tsx` — FOUND
- `.planning/phases/02-honest-dashboard-peer-surface/02-02-SUMMARY.md` — FOUND

All claimed commits exist in `git log --oneline --all`:
- `083538a` (Task 1) — FOUND
- `7003935` (Task 2) — FOUND
- `3e58e72` (Task 3) — FOUND

Plan invariants verified:
- `grep -c 'listen(' src/lib/rpc.ts` → `0` (W1 intact)
- `grep -c 'listen(' src/hooks/use-daemon-state.ts` → `2` (no new listeners added by this plan)
- `grep -rE '(text-(green|red|yellow|blue|orange)-[0-9]|rounded-)' src/components/shell/` → empty (brand palette only, no border-radius)
- `pnpm typecheck` on this plan's files → clean (no errors scoped to `shell/ | use-active-screen | App.tsx`)

---
*Phase: 02-honest-dashboard-peer-surface*
*Completed: 2026-04-24*
