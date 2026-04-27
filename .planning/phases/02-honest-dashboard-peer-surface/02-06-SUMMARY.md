---
phase: 02-honest-dashboard-peer-surface
plan: 06
subsystem: ui
tags: [sonner, toast, react, navigation, app-shell]

requires:
  - phase: 02-01
    provides: snapshot.subscriptionError on DaemonSnapshot + retry-once D-31 wiring
  - phase: 02-02
    provides: useActiveScreen() module-level atom + AppShell layout
  - phase: 02-03
    provides: IdentityPanel with the "show why →" CTA placeholder
  - phase: 02-05
    provides: Logs tab + LogFilterBar (level + peer filters)

provides:
  - Sonner Toaster mounted ONCE at AppShell root (replaces per-screen toaster duplication)
  - SubscriptionErrorToast watcher firing destructive sonner toast with D-31 verbatim copy `Couldn't subscribe to {stream}. Check the Logs tab.` on snapshot.subscriptionError changes (with stream:code dedupe)
  - IdentityPanel `show why →` link wired to `useActiveScreen().setActive('logs')` (D-09 partial — phase-2 navigates only; Phase 3 OBS-02 will add source:'transport' pre-filter)

affects: [phase-03 logs source filter (OBS-02), phase-3 settings toast variants]

tech-stack:
  added: []  # sonner already a dependency (Phase 1)
  patterns:
    - "Watcher component pattern — null-rendering React component that consumes useDaemonState and fires side effects (sonner toast) via useEffect with dedupe ref"
    - "Shell-level overlay mounting — Toaster + watchers live in AppShell, not main.tsx, so they're scoped to post-bootstrap UI"

key-files:
  created:
    - src/components/brand/subscription-error-toast.tsx
  modified:
    - src/components/shell/app-shell.tsx
    - src/components/identity/identity-panel.tsx
    - src/main.tsx

key-decisions:
  - "Toaster `position` deviated from plan's `bottom-center` to `bottom-right` to avoid colliding with Phase-1's existing reconnect-toast position"
  - "Phase-2 `show why →` ships navigation-only (setActive('logs')); the source:'transport' pre-filter portion of D-09 was DEFERRED to Phase 3 OBS-02 where the source-filter UI lands. Inline comment in identity-panel.tsx documents the deferral."
  - "SubscriptionErrorToast lives in AppShell, not main.tsx — main.tsx retains only TunPermissionProvider (Phase 1) for pre-shell modal reachability"
  - "Dedupe key = `${stream}:${error.code}` — same stream + same RPC error code suppresses re-fire until snapshot.subscriptionError clears to null"

patterns-established:
  - "Brand-override sonner Toaster: bg-popover, border-border, rounded-none, font-mono — Phase-3 toasts inherit this base styling"
  - "Cross-tab navigation from a panel CTA: import useActiveScreen at the leaf component, call setActive('<tab>') in onClick — no parent-prop drilling, no new hooks"

requirements-completed:
  - STAT-01
  - STAT-02
  - STAT-03
  - STAT-04
  - PEER-01
  - PEER-04
  - PEER-05
  - PEER-06
  - OBS-01

duration: ~10 min
completed: 2026-04-25
---

# Phase 02 Plan 06: shell-toaster-and-d09-link Summary

**Stitched the last two integration seams Phase 2 needed: sonner Toaster mount + D-31 subscription-failure toast + IdentityPanel show-why navigation to Logs.**

## Performance

- **Duration:** ~10 min (2 atomic feat commits)
- **Started:** 2026-04-25
- **Completed:** 2026-04-25
- **Tasks committed:** 2 of 3 (Task 3 was the human-verify checkpoint — see Notes)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- App-global Sonner Toaster mounted at the shell root with brand-override classNames (`bg-popover border-border rounded-none font-mono text-sm`, error variant gets `border-destructive`).
- `SubscriptionErrorToast` watcher reads `snapshot.subscriptionError` via `useDaemonState`, fires `toast.error` with the D-31 verbatim copy `Couldn't subscribe to {stream}. Check the Logs tab.` (no exclamation marks), and dedupes via a `${stream}:${code}` key so the same failure does not re-toast on every snapshot tick.
- `IdentityPanel` show-why link became clickable: `setActive('logs')` from `useActiveScreen()` — Phase-2 ships navigation-only; source:'transport' pre-filter is owned by Phase 3 (OBS-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: SubscriptionErrorToast + mount Toaster in AppShell (D-31)** — `368ce1b` (feat)
2. **Task 2: Wire IdentityPanel show-why link to Logs tab (D-09 partial)** — `a45f9b7` (feat)
3. **Task 3: Human-verify checkpoint (all 7 Phase-2 ROADMAP SCs)** — closed retroactively (see Notes)

## Files Created/Modified
- `src/components/brand/subscription-error-toast.tsx` (created) — null-rendering watcher that subscribes to `snapshot.subscriptionError` and fires sonner toast with D-31 verbatim copy + dedupe ref.
- `src/components/shell/app-shell.tsx` (modified) — mounts `<Toaster />` (sonner) + `<SubscriptionErrorToast />` alongside the sidebar/main layout. Brand-override `classNames`: `bg-popover border-border text-foreground font-mono text-sm rounded-none`, error variant adds `border-destructive`.
- `src/components/identity/identity-panel.tsx` (modified) — show-why link onClick handler calls `useActiveScreen().setActive('logs')`. Inline comment documents the source:'transport' deferral to Phase 3.
- `src/main.tsx` (modified) — slimmed: TunPermissionProvider (Phase 1) stays; subscription-error logic moved into AppShell so it does not run pre-bootstrap.

## Cross-Phase Invariants

W1 single-listener contract (verified post-plan):
- `grep -c "listen(" src/lib/rpc.ts` returns `0`
- `grep -c "listen(" src/hooks/use-daemon-state.ts` returns exactly `2`

D-31 verbatim copy present:
- `grep -c "Couldn't subscribe to" src/components/brand/subscription-error-toast.tsx` returns ≥ 1
- `grep -c "Check the Logs tab" src/components/brand/subscription-error-toast.tsx` returns ≥ 1

## Notes

This plan was executed and committed during the Phase 2 cycle but the human-verify checkpoint (Task 3) and the SUMMARY artifact were never formally written. SUMMARY backfilled here on 2026-04-26 as part of the Phase 3 pre-flight cleanup. The 7 Phase-2 ROADMAP success criteria pass at runtime against the running app — confirmed by the user during the Phase 3 kickoff. No code changes were required to close this plan; only the bookkeeping artifact was missing.
