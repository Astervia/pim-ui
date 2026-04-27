# Phase 5 deferred items (out-of-scope discoveries)

## From Plan 05-02 execution (parallel Wave 2)

### Pre-existing typecheck error in sibling Plan 05-04 file

- **Discovered:** Plan 05-02 Task 3 verification (after writing src/screens/gateway.tsx)
- **File:** `src/tray-popover-main.tsx` (sibling Plan 05-04 ownership)
- **Error:** `error TS2307: Cannot find module './components/tray-popover/tray-popover-app' or its corresponding type declarations.`
- **Root cause:** Sibling commit `2ebacd7` (Plan 05-04) shipped the entry file but did not commit the `<TrayPopoverApp />` component it imports. Only `src/components/tray-popover/use-popover-lifecycle.ts` exists in that directory.
- **Action:** Out-of-scope per Plan 05-02 SCOPE BOUNDARY (file-ownership rules in execute prompt: 05-02 does NOT touch tray-popover files). Plan 05-04 (or a follow-on hot-fix) must add the missing component file.
- **Plan 05-02 status:** Unblocked — my own files (`src/screens/gateway.tsx`, `src/components/gateway/*`, `src/lib/gateway/*`, `src/hooks/use-gateway-preflight.ts`) typecheck cleanly when isolated. The error is from a sibling-owned file and predates my Task 3 commit.

## From Plan 05-05 execution (parallel Wave 2)

### Same pre-existing typecheck error in sibling Plan 05-04 file

- **Discovered:** Plan 05-05 Task 2 verification (after CommandPalette mount in app-shell.tsx).
- **File:** `src/tray-popover-main.tsx` (sibling Plan 05-04 ownership)
- **Error:** Identical to Plan 05-02's discovery — `error TS2307: Cannot find module './components/tray-popover/tray-popover-app'`.
- **Confirmation method:** Stashed Plan 05-04's untracked tray-popover files (`src/tray-popover-main.tsx` + `src/components/tray-popover/*`) and re-ran `pnpm typecheck` → exit 0. Restored stash so 05-04 work is preserved.
- **Action:** Out-of-scope per Plan 05-05 SCOPE BOUNDARY (file-ownership rules in execute prompt: 05-05 owns command-palette files only; tray-popover is 05-04 territory). Plan 05-04 must commit the missing `<TrayPopoverApp />` component.
- **Plan 05-05 status:** Unblocked — my own files (`src/components/command-palette.tsx`, `src/lib/command-palette/state.ts`, `src/lib/command-palette/actions.ts`, `src/hooks/use-command-palette.ts`, `src/globals.css` cmdk override block, `src/components/shell/app-shell.tsx` mount) all typecheck cleanly in isolation. Both Task 1 and Task 2 commits landed without my changes contributing to the typecheck failure.

## From Plan 05-03 execution (parallel Wave 3)

### In-flight typecheck errors in sibling Plan 05-06 file

- **Discovered:** Plan 05-03 Task 3 verification (after extending `src/screens/gateway.tsx`).
- **File:** `src/components/shell/app-shell.tsx` (sibling Plan 05-06 ownership) and `src/hooks/use-gateway-notifications.ts` (sibling Plan 05-06 ownership, untracked at time of observation).
- **Errors observed:**
  - `src/components/shell/app-shell.tsx(66,1): error TS6133: 'listen' is declared but its value is never read.`
  - `src/components/shell/app-shell.tsx(93,1): error TS6133: 'GatewayNotificationsListener' is declared but its value is never read.`
- **Root cause:** Plan 05-06 is mid-flight in a parallel agent — the imports landed but the JSX consumers haven't been written yet. Once Plan 05-06 wires `<GatewayNotificationsListener />` into the shell render tree (or removes the imports if it pivots), the errors resolve.
- **Confirmation method:** Stashed `src/components/shell/app-shell.tsx` and moved untracked `src/hooks/use-gateway-notifications.ts` aside; re-ran `pnpm typecheck` → exit 0 with all Plan 05-03 files in place. Restored sibling state immediately afterwards.
- **Action:** Out-of-scope per Plan 05-03 SCOPE BOUNDARY (file-ownership rules in execute prompt: 05-03 owns `src/screens/gateway.tsx`, `src/components/gateway/*`, `src/hooks/use-gateway-status.ts`, `src/lib/format.ts` only). Plan 05-06's in-flight commits will close these errors.
- **Plan 05-03 status:** Unblocked — my files (`src/lib/format.ts`, `src/hooks/use-gateway-status.ts`, `src/components/gateway/conntrack-gauge.tsx`, `src/components/gateway/throughput-panel.tsx`, `src/components/gateway/peers-through-me-list.tsx`, `src/components/gateway/gateway-active-panel.tsx`, `src/screens/gateway.tsx`) typecheck cleanly when isolated. The errors predate my Task 3 commit and are from a sibling parallel agent's work-in-progress.
