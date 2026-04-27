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
