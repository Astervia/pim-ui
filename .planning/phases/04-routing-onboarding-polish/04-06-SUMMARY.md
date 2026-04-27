---
phase: 04-routing-onboarding-polish
plan: 06
subsystem: ui
tags: [kill-switch, routing, error-states, sonner, tauri-shell, audit-copy, banner, react-19]

# Dependency graph
requires:
  - phase: 04-routing-onboarding-polish
    provides: src/lib/copy.ts (KILL_SWITCH_HEADLINE/BODY/ACTION/TOAST + HANDSHAKE_FAIL_SUBLINE + SECURITY_DOCS_URL); src/hooks/use-routing.ts (useKillSwitch derived selector); src/components/shell/app-shell.tsx (banner mount surface)
  - phase: 02-honest-dashboard-peer-surface
    provides: useDaemonState reactive snapshot (status.event fan-out, kill_switch event delivered into the existing W1 channel); sonner Toaster mounted at AppShell; PeerRow + PeerDetailSheet panel surfaces
  - phase: 04-routing-onboarding-polish (P-01 audit foundation)
    provides: scripts/audit-copy.mjs and pnpm audit:copy script (banned-phrase/voice grep gate)
provides:
  - KillSwitchBanner non-dismissible alert component (D-21, D-22) wired to useKillSwitch + route.set_split_default
  - kill_switch handler in useDaemonState upgraded per D-31 — defensive selected_gateway=null + sonner toast 'kill-switch active · routing blocked' (W1 listen() count preserved at 2)
  - Failed-state PeerRow sub-line "Couldn't verify this peer · → docs/SECURITY.md §3.2" with Tauri shell.open click target (D-24)
  - PeerDetailSheet failed-event callout appended docs link (D-25) using the same HANDSHAKE_FAIL_SUBLINE constant for voice-contract consistency
  - Phase-4-complete codebase passes pnpm audit:copy (UX-08 final gate) and pnpm typecheck + pnpm build (D-36 1/4/5/8/9 gates)
affects: phase-05-gateway-mode-and-system-surfaces (kill-switch + handshake-fail surfaces will be referenced by GATE-04 macOS/Windows messaging and UX-04 system-notification triggers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derived-state banner: KillSwitchBanner reads useKillSwitch() (route_on===true && selected_gateway===null) instead of holding its own state machine — single source of truth in DaemonSnapshot"
    - "Defensive snapshot mutation in event handler: kill_switch case re-sets next.routes.selected_gateway=null even if the daemon SHOULD have already cleared it via gateway_lost — banner condition reliably satisfied for standalone kill_switch arrivals"
    - "Cross-component voice consistency: peer-row.tsx and peer-detail-sheet.tsx both render the same HANDSHAKE_FAIL_SUBLINE constant — single locked-string source"
    - "Nested-button stopPropagation: failed-state docs-link button inside PeerRow uses event.stopPropagation so the row's primary onClick (open detail sheet) doesn't fire when the docs link is clicked"
    - "Tauri shell.open via @tauri-apps/plugin-shell — webview-aware browser opener, works on every desktop target without a separate cross-platform polyfill"

key-files:
  created:
    - src/components/brand/kill-switch-banner.tsx — D-21/D-22 KillSwitchBanner alert component
  modified:
    - src/hooks/use-daemon-state.ts — kill_switch handler upgraded per D-31 (defensive selected_gateway=null + sonner toast)
    - src/components/shell/app-shell.tsx — KillSwitchBanner mounted above ActiveScreen inside <main>
    - src/components/peers/peer-row.tsx — failed-state sub-line with Tauri shell.open + stopPropagation guard (D-24)
    - src/components/peers/peer-detail-sheet.tsx — failed-event callout appended docs-link button (D-25)

key-decisions:
  - "kill_switch handler defensively re-sets selected_gateway=null — the daemon SHOULD emit gateway_lost first, but standalone kill_switch must still satisfy the KillSwitchBanner derived condition (route_on===true && selected_gateway===null)"
  - "KillSwitchBanner is a SEPARATE component from LimitedModeBanner (not a variant) per D-22 — different copy contract, different action, different visibility derivation; sharing a primitive would couple two unrelated state surfaces"
  - "KILL_SWITCH_TOAST extracted as a copy.ts constant (not inlined in use-daemon-state.ts) — keeps the audit:copy locked-string surface complete; the toast string is user-facing copy and belongs in the same module as the banner copy"
  - "PeerRow restructure: outer element changed from single <button> to <div className=\"flex flex-col\"> wrapping the primary <button> + conditional sub-line <button> — preserves grid layout of primary row while allowing failed-state sub-line as a sibling. event.stopPropagation defensively prevents nested-button bubbling"
  - "PeerDetailSheet failed-event <li> wrapped in flex flex-col gap-1 — keeps the timestamp + reason on one line and the docs-link button on the next line without breaking the existing border-b separator pattern"
  - "Final audit gate accepts the 1 pre-existing soft warning in src/components/ui/form.tsx (line 53: 'should be used within FormField') — runtime-error message thrown for misuse of the FormField context, not user-visible copy. Touching shadcn-generated code in the final voice plan would violate the registry-safety contract from 03-01"
  - "human-verify checkpoint auto-approved per --auto flag — the six ROADMAP Phase 4 SCs are codebase-checkable (not requiring a live daemon at this stage): SC1/2/3/4 are verified by Plans 04-01..04-05 SUMMARYs + their committed audit gates; SC5 (kill-switch + handshake-fail) is verified by this plan's Tasks 1-3 acceptance grep gates + typecheck; SC6 (audit:copy) passes 0 hard violations"

patterns-established:
  - "Derived-banner pattern: alert components derive visibility from snapshot selectors (useKillSwitch / useLimitedMode) — no parent-managed open flags, banner unmounts cleanly when condition flips false"
  - "Event-handler defensive mutation: when a status.event arrives that asserts a system state, the handler re-establishes invariants on the snapshot even if upstream events SHOULD have already done so — covers race conditions and out-of-order delivery"
  - "Locked-string voice consistency: when the same user-facing string appears in multiple components (PeerRow sub-line + PeerDetailSheet docs link both use HANDSHAKE_FAIL_SUBLINE), a single copy.ts export ensures voice contract holds across re-renders and future edits"
  - "Tauri shell.open as the canonical 'open URL in default browser' primitive across desktop — keeps webview-aware behavior consistent with macOS/Linux/Windows defaults"

requirements-completed: [UX-03, UX-08]

# Metrics
duration: ~38min
completed: 2026-04-27
---

# Phase 4 Plan 06: Critical Error States + Final Audit Gate Summary

**KillSwitchBanner alert + handshake-fail PeerRow sub-line + PeerDetailSheet docs link, kill_switch handler upgrade with defensive snapshot mutation + sonner toast, all closed by a green pnpm audit:copy on the Phase-4-complete codebase.**

## Performance

- **Duration:** ~38 min (approximate; spans Tasks 1-4 implementation + final audit gate; checkpoint auto-approved)
- **Started:** 2026-04-27T01:15:00Z (estimated)
- **Completed:** 2026-04-27T01:53:27Z
- **Tasks:** 5 (4 implementation + 1 auto-approved human-verify checkpoint)
- **Files modified:** 5 (1 new component + 4 edits)

## Accomplishments

- **D-31 kill_switch handler upgrade in useDaemonState** — defensively sets `next.routes = { ...current.routes, selected_gateway: null }` AND fires `void toast.error(KILL_SWITCH_TOAST, { duration: 6000 })` on every kill_switch status.event. W1 invariant strictly preserved (`grep -c 'listen(' src/hooks/use-daemon-state.ts` returns `2` exactly as before this plan).
- **D-21/D-22 KillSwitchBanner component** — new file at `src/components/brand/kill-switch-banner.tsx`, renders only when `useKillSwitch()` returns true (`route_on===true && selected_gateway===null`). Verbatim D-22 copy: `✗ BLOCKING INTERNET — gateway unreachable` headline + body + `[ TURN OFF KILL-SWITCH ]` action that calls `route.set_split_default({on:false})` via callDaemon. 2px destructive-left border, `<section role="alert" aria-live="polite">`, no rounded, no gradient — passes every D-36 brand grep gate.
- **AppShell mount above ActiveScreen** — banner sits inside `<main aria-label="content">` above `<ActiveScreen />` so it overlays every screen (Dashboard / Peers / Routing / Logs / Settings / About) per D-21, NOT just Dashboard.
- **D-24 PeerRow failed-state sub-line** — failed peers render `Couldn't verify this peer · → docs/SECURITY.md §3.2` below the row content. Click target opens SECURITY_DOCS_URL via Tauri `shell.open`. Outer element restructured to `<div className="flex flex-col">` wrapping the primary row button + conditional sub-line button; primary row's grid layout preserved, sub-line uses stopPropagation to prevent the row's primary onClick from firing.
- **D-25 PeerDetailSheet docs link append** — failed-event `<li>` callout in the troubleshoot log section now wraps timestamp/reason + docs link in a flex column. Same HANDSHAKE_FAIL_SUBLINE string for voice-contract consistency.
- **Final audit gate green:** pnpm typecheck=0, pnpm audit:copy=0 hard violations (1 pre-existing soft warning in shadcn `ui/form.tsx` is a runtime-error message, out of scope), pnpm build=0, all D-36 brand grep gates (1/4/5/8/9) clean against the Phase-4-complete codebase.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-31 useDaemonState kill_switch handler upgrade** — `f93a94b` (feat)
   - Adds `import { toast } from "sonner"` + `import { KILL_SWITCH_TOAST } from "@/lib/copy"`
   - Replaces Phase-2 placeholder `console.info("kill_switch event ignored in phase 2"); return;` with `next.routes = { ...current.routes, selected_gateway: null }; void toast.error(KILL_SWITCH_TOAST, { duration: 6000 }); break;`
   - Updates the file's docblock to record the Phase 4 D-31 upgrade and re-affirm the W1 single-listener contract
2. **Task 2: D-21/D-22 KillSwitchBanner + AppShell mount** — `8d7bd79` (feat)
   - NEW file `src/components/brand/kill-switch-banner.tsx` (D-21 placement, D-22 verbatim copy + non-dismissible contract)
   - `src/components/shell/app-shell.tsx` import + render `<KillSwitchBanner />` directly above `<ActiveScreen />` inside `<main>`
3. **Task 3: D-24 PeerRow + D-25 PeerDetailSheet** — `ee3dce6` (feat)
   - `src/components/peers/peer-row.tsx` outer element restructured (grid preserved on primary button, sub-line as sibling button)
   - `src/components/peers/peer-detail-sheet.tsx` failed-event `<li>` wraps in flex flex-col, docs link button appended
4. **Task 4: Final audit gate** — verification only, no commit (gates: typecheck=0, audit:copy=0 hard, build=0, all D-36 grep gates clean)
5. **Task 5: human-verify checkpoint** — auto-approved per --auto flag (no commit)

**Plan metadata:** _(this commit)_ `docs(04-06): complete critical error states + Phase 4 final plan` — SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md

## Files Created/Modified

- **CREATED** `src/components/brand/kill-switch-banner.tsx` — D-21/D-22 KillSwitchBanner alert component. Reads `useKillSwitch()`, renders verbatim KILL_SWITCH_HEADLINE/BODY/ACTION, [ TURN OFF KILL-SWITCH ] calls `route.set_split_default({on:false})`. Pending-state shows `[…]` cursor-blink. Bang-free, no rounded-*, no gradient — passes every D-36 grep gate.
- **MODIFIED** `src/hooks/use-daemon-state.ts` — kill_switch handler (Phase 2 placeholder) replaced with D-31 implementation: defensive `selected_gateway=null` + `toast.error(KILL_SWITCH_TOAST, { duration: 6000 })`. W1 invariant preserved (listen() count exactly 2).
- **MODIFIED** `src/components/shell/app-shell.tsx` — KillSwitchBanner imported and mounted directly above `<ActiveScreen />` inside `<main>` so it overlays every screen (D-21).
- **MODIFIED** `src/components/peers/peer-row.tsx` — outer element restructured to `<div className="flex flex-col">` containing the primary row `<button>` (grid layout preserved exactly) + conditional `<button>` sub-line for `peer.state === "failed"` rendering HANDSHAKE_FAIL_SUBLINE with Tauri `shell.open(SECURITY_DOCS_URL)` click target. event.stopPropagation guards both onClick and onKeyDown handlers.
- **MODIFIED** `src/components/peers/peer-detail-sheet.tsx` — failed-event `<li>` wrapped in flex flex-col gap-1; existing timestamp + pair_failed + reason preserved on top line; docs-link button appended below using the same HANDSHAKE_FAIL_SUBLINE constant.

## Decisions Made

- **Defensive snapshot mutation in kill_switch case** — even though the daemon SHOULD emit `gateway_lost` BEFORE `kill_switch` (which would already clear `selected_gateway`), we cannot rely on event ordering. Re-setting `next.routes.selected_gateway = null` in the kill_switch case ensures the KillSwitchBanner derived condition `route_on===true && selected_gateway===null` is reliably satisfied for both ordered (gateway_lost → kill_switch) and standalone (kill_switch only) sequences. Documented in the kill_switch case body comment.
- **KILL_SWITCH_TOAST extracted as a copy.ts constant** (not inlined in use-daemon-state.ts) — keeps the audit:copy locked-string surface complete. Aligns with the existing pattern: every user-facing string lives in `src/lib/copy.ts` and is imported by its consumer. Inline strings would silently bypass the audit gate.
- **KillSwitchBanner is a SEPARATE component, not a LimitedModeBanner variant** — per D-22, the kill-switch is a distinct system state with its own copy contract, action button, and derivation logic. Sharing a primitive would couple two unrelated state surfaces (Limited mode = daemon stopped/error; Kill-switch = daemon running but routing blocked) and force one to grow variants every time the other adds a state.
- **PeerRow outer element restructured to `<div className="flex flex-col">`** — wrapping the primary `<button>` (grid layout) + conditional sub-line `<button>` as a sibling. Adding a sub-line inside the primary button would break the grid; making it a sibling preserves both grid and a11y. event.stopPropagation defensively guards future parent-element changes from accidentally re-triggering the row's primary onClick.
- **Same HANDSHAKE_FAIL_SUBLINE string used in both PeerRow + PeerDetailSheet** — voice-contract consistency. If a user reads the failed peer in the row AND opens the detail sheet, both surfaces speak the same line. Future copy edits change one constant, both surfaces update.
- **`pnpm audit:copy` 1 soft warning accepted** — `src/components/ui/form.tsx:53` `throw new Error("useFormField should be used within FormField")` is a runtime-error message thrown when the `FormField` context is missing, not user-visible copy. Touching shadcn-generated code in the final voice plan would violate the registry-safety contract established in 03-01.
- **human-verify checkpoint auto-approved** per --auto flag. The six ROADMAP Phase 4 SCs are codebase-checkable at this point: SC1 (UX-01 onboarding), SC2 (ROUTE-01/02 toggle), SC3 (UX-02 zero-peer dashboard), SC4 (ROUTE-03/04 ⌘3 routing tab) are verified by Plans 04-01..04-05 SUMMARYs + their committed audit gates; SC5 (UX-03 kill-switch + handshake-fail) is verified by this plan's Tasks 1-3 acceptance grep gates + typecheck + build; SC6 (UX-08 audit:copy) passes 0 hard violations against the Phase-4-complete codebase. Live-daemon walkthrough (kill the gateway, verify banner shows verbatim copy, click [ TURN OFF KILL-SWITCH ], verify banner unmounts) is deferred to Phase 5's manual UAT under v0.1 milestone verification.

## Deviations from Plan

None - plan executed exactly as written.

The acceptance gates in PLAN.md spec were all met without inline fixes during execution. The pre-existing `src/components/ui/form.tsx:53` soft warning was already documented in 04-01's SUMMARY as deferred to 04-06's voice pass for triage; the triage outcome here is "accept as out-of-scope shadcn registry code" (rationale captured under Decisions Made).

## Issues Encountered

None.

The task spec's `pnpm audit:copy` and `pnpm typecheck` gates passed on first run after each task's edits. The W1 listen()-count invariant (rpc.ts=0, use-daemon-state.ts=2) was preserved throughout — `import { toast } from "sonner"` and `import { KILL_SWITCH_TOAST } from "@/lib/copy"` are import-only changes that do not introduce new Tauri event subscriptions.

## User Setup Required

None - no external service configuration required.

The KillSwitchBanner exercises an existing daemon RPC (`route.set_split_default`) and the existing sonner Toaster mounted at AppShell since Phase 2. Tauri `shell.open` is provided by `@tauri-apps/plugin-shell` which is already a project dep (Plan 04-04 / 04-05 dependency).

## Next Phase Readiness

Phase 4 (Routing & Onboarding Polish) is now complete:
- All 8 Phase 4 requirements (ROUTE-01/02/03/04, UX-01/02/03/08) marked complete in REQUIREMENTS.md
- 6/6 plans committed with green audit gates
- ROADMAP.md will mark Phase 4 as Complete (2026-04-27)

**Ready for Phase 5 (Gateway Mode & System Surfaces)** which depends on Phase 4 for:
- KillSwitchBanner pattern (UX-04 system-notification trigger for kill-switch-active will reuse the useKillSwitch derivation)
- HANDSHAKE_FAIL_SUBLINE / SECURITY_DOCS_URL pattern (GATE-04 macOS/Windows messaging will reuse the docs-link Tauri-shell pattern)
- pnpm audit:copy as a standing gate (every Phase 5 string addition must pass)

**Live UAT (when daemon binary lands for v0.1 milestone verification):** the human-verify walkthrough described in PLAN.md `<how-to-verify>` should be executed against a real `pim-daemon` to spot-check the kill-switch trigger path, the failed-peer handshake path, and the docs-link Tauri shell.open behavior on each desktop target. This is tracked under v0.1 milestone verification, not as a Phase 4 blocker.

## Self-Check: PASSED

- FOUND: src/components/brand/kill-switch-banner.tsx
- FOUND: src/hooks/use-daemon-state.ts (kill_switch handler upgraded; toast import; KILL_SWITCH_TOAST usage)
- FOUND: src/components/shell/app-shell.tsx (KillSwitchBanner import + mount)
- FOUND: src/components/peers/peer-row.tsx (HANDSHAKE_FAIL_SUBLINE + SECURITY_DOCS_URL + stopPropagation + @tauri-apps/plugin-shell import)
- FOUND: src/components/peers/peer-detail-sheet.tsx (HANDSHAKE_FAIL_SUBLINE + SECURITY_DOCS_URL + @tauri-apps/plugin-shell import)
- FOUND: commit f93a94b (feat 04-06-01 — kill_switch handler)
- FOUND: commit 8d7bd79 (feat 04-06-02 — KillSwitchBanner + AppShell mount)
- FOUND: commit ee3dce6 (feat 04-06-03 — PeerRow sub-line + PeerDetailSheet docs link)
- VERIFIED: pnpm typecheck exits 0
- VERIFIED: pnpm audit:copy exits 0 (1 pre-existing soft warning, out of scope)
- VERIFIED: W1 invariants preserved — `grep -c 'listen(' src/lib/rpc.ts` = 0; `grep -c 'listen(' src/hooks/use-daemon-state.ts` = 2

---
*Phase: 04-routing-onboarding-polish*
*Plan: 06*
*Completed: 2026-04-27*
