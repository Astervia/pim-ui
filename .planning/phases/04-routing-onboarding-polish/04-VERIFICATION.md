---
phase: 04-routing-onboarding-polish
verified: 2026-04-26T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: null
gaps: []
human_verification:
  - test: "First-run solo path under 30 seconds to dashboard"
    expected: "From cold launch → name device → grant TUN → tap [ RUN SOLO ] reaches Dashboard in ≤30s"
    why_human: "Wall-clock latency; TUN permission dialog is OS-driven and cannot be timed by static analysis."
  - test: "Pre-flight inline within ~500 ms"
    expected: "Tapping [ TURN ON ROUTING ] expands the 3-row checklist within ~500 ms perceptually"
    why_human: "derivePreflight() is pure and runs synchronously, but the expanded-state animation timing must be felt, not greppped."
  - test: "[ ADD PEER NEARBY ] scrolls NearbyPanel into view smoothly"
    expected: "Window event pim-ui:scroll-to-nearby fires, Dashboard listener calls scrollIntoView({behavior:'smooth'}); panel ends fully visible"
    why_human: "scrollIntoView smoothness depends on browser behavior + viewport state; codebase shows the listener and ref are wired."
  - test: "[ COPY LINK ] in InvitePeerSheet writes INVITE_FULL_URL to clipboard"
    expected: "Click → button label flips to [ COPIED ] for 2s; pasting elsewhere yields the URL"
    why_human: "Clipboard semantics in Tauri webview are runtime-dependent; navigator.clipboard.writeText is wired but the OS-side write must be observed."
  - test: "KillSwitchBanner appears exactly when route_on===true && selected_gateway===null after a real status.event"
    expected: "Banner renders above ActiveScreen, shows verbatim ✗ BLOCKING INTERNET — gateway unreachable + body + [ TURN OFF KILL-SWITCH ]"
    why_human: "Requires a live daemon emitting kill_switch / gateway_lost events; useDaemonState's defensive snapshot mutation is wired but the event channel must be observed end-to-end."
---

# Phase 4: Routing & Onboarding Polish — Verification Report

**Phase Goal:** Aria can open the app for the first time, succeed in ≤ 3 interactions, and toggle "Route internet via mesh" with honest surfacing of which gateway/relay is carrying traffic; solo mode and error states are first-class; every microcopy string matches the brand voice.

**Verified:** 2026-04-26
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                                                                           | Status     | Evidence                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | First-run: name device → TUN consent → choose `Add peer nearby` or `Run solo`; ≤3 interactions, no wizard framing                               | ✓ VERIFIED | `src/screens/welcome.tsx` (108 LOC, two `[ ADD PEER NEARBY ]` / `[ RUN SOLO ]` buttons, localStorage flag `pim-ui.onboarding.completed` set BEFORE navigation). `src/app-root.tsx` gates WelcomeScreen on the flag (synchronous read on mount, no UI flash for returning users). |
| 2   | Single dashboard `Route internet via mesh` toggle, pre-flight inline, on-state reads `Routing through gateway-X (via relay-Y)` — never just "on" | ✓ VERIFIED | `src/components/routing/route-toggle-panel.tsx` (280 LOC, four runtime states off/pre-flight/on/pending). `src/lib/routing.ts::formatRouteLine()` returns `Routing through {gw}` or `Routing through {gw} (via {hop})` — never raw "on". `[ TURN ON ROUTING ]` calls `route.set_split_default({on:true})`. |
| 3   | Zero-peer state is a usable dashboard with `Add peer nearby` + `Invite peer remotely` actions enabled; no `Add your first peer!` microcopy       | ✓ VERIFIED | `src/components/peers/peer-list-panel.tsx` — both `<Button>`s render with no `disabled` attr. `src/components/brand/invite-peer-sheet.tsx` (115 LOC, real `navigator.clipboard.writeText`). Audit script enforces banned phrases `"Add your first peer"` and `"Welcome to pim"` (scripts/audit-copy.mjs:32–33). |
| 4   | Routing view shows live route table (destination · via · hops · learned_from · age) and known-gateways list with scores + selected highlight     | ✓ VERIFIED | `src/screens/routing.tsx` mounts three-panel stack. `route-table-panel.tsx` (153 LOC) renders all 5 columns. `known-gateways-panel.tsx` (130 LOC) renders score + ◆ marker on `g.selected === true`. ⌘3 wired in `app-shell.tsx`, `sidebar.tsx`, `use-active-screen.ts`, `active-screen.tsx`. |
| 5   | Kill-switch banner reads "Blocking internet — gateway unreachable" with `Turn off kill-switch`; handshake-fail row links to `docs/SECURITY.md §3.2` | ✓ VERIFIED | `kill-switch-banner.tsx` (96 LOC, derived from `useKillSwitch()`). `copy.ts:26-29` exports verbatim `✗ BLOCKING INTERNET — gateway unreachable` + body + `[ TURN OFF KILL-SWITCH ]`. `peer-row.tsx` imports `HANDSHAKE_FAIL_SUBLINE` and calls `shellOpen(SECURITY_DOCS_URL)` via `@tauri-apps/plugin-shell`. `docs/SECURITY.md` line 33: `### 3.2 Handshake failures`. |
| 6   | Every user-facing string matches `docs/COPY.md`: no exclamation marks, declarative voice; verified by copy audit                                | ✓ VERIFIED | `docs/COPY.md` exists. `scripts/audit-copy.mjs` (155 LOC) enforces banned phrases + JSX `>...!...<` + quoted exclamations. `package.json` exposes `audit:copy` script. `pnpm audit:copy` → `0 hard violations, 1 soft warning` (pre-existing soft warning in `form.tsx:53`, documented as acceptable). |

**Score:** 6 / 6 truths verified.

### Required Artifacts

| Artifact                                              | Expected                                                | Status     | Details                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/screens/welcome.tsx`                             | Onboarding choice surface, two bracketed buttons        | ✓ VERIFIED | 108 LOC; sets `pim-ui.onboarding.completed` flag before `onComplete()`; uses copy constants only.                                              |
| `src/app-root.tsx`                                    | AppRoot welcome branch keyed by localStorage            | ✓ VERIFIED | Synchronous flag init in `useState`, dispatches `pim-ui:scroll-to-nearby` when `[ ADD PEER NEARBY ]` chosen.                                  |
| `src/components/routing/route-toggle-panel.tsx`       | Off / pre-flight / on / pending state machine + RPC     | ✓ VERIFIED | 280 LOC; 4 runtime states; `route.set_split_default` via `callDaemon`; sonner toast on error; no listen() of its own (W1).                    |
| `src/components/routing/route-table-panel.tsx`        | 5-column live route table                               | ✓ VERIFIED | 153 LOC; columns destination/via/hops/learned_from/age; ◆ glyph + text-primary on selected row.                                                |
| `src/components/routing/known-gateways-panel.tsx`     | Gateway list with scores + selected highlight           | ✓ VERIFIED | 130 LOC; columns short_id/via/hops/score/selected; ◆ on `g.selected === true`.                                                                 |
| `src/screens/routing.tsx`                             | Three-panel stack mount                                 | ✓ VERIFIED | RouteTogglePanel + RouteTablePanel + KnownGatewaysPanel; consumes useDaemonState + useRouteTable.                                              |
| `src/components/brand/kill-switch-banner.tsx`         | Derived banner from snapshot, action wired              | ✓ VERIFIED | 96 LOC; mounts in `app-shell.tsx:153` above `<ActiveScreen />`; `route.set_split_default({on:false})` on action.                              |
| `src/components/brand/invite-peer-sheet.tsx`          | Solo-mode invite slide-over with clipboard             | ✓ VERIFIED | 115 LOC; `navigator.clipboard.writeText(INVITE_FULL_URL)`; honest-stub for absent daemon-side `invite.*` RPC (documented).                    |
| `src/lib/copy.ts`                                     | Locked-string registry                                  | ✓ VERIFIED | Exports `KILL_SWITCH_HEADLINE`, `KILL_SWITCH_ACTION`, `ROUTE_TOGGLE_TURN_ON/OFF`, `WELCOME_*`, `INVITE_*`, `HANDSHAKE_FAIL_SUBLINE`, `SECURITY_DOCS_URL`, `PREFLIGHT_*` etc. |
| `src/lib/routing.ts`                                  | Pure helpers `formatRouteLine` + `derivePreflight`      | ✓ VERIFIED | 203 LOC; pure, no React/RPC; tolerant of missing peer records and route table.                                                                  |
| `src/hooks/use-routing.ts`                            | `useRouteOn`, `useSelectedGateway`, `useKillSwitch`     | ✓ VERIFIED | All three selectors over useDaemonState; no listen() (W1).                                                                                     |
| `src/hooks/use-route-table.ts`                        | One-shot fetch + status-event-driven refetch fan-out    | ✓ VERIFIED | Listens via useDaemonState's status event; 0 own `listen(` calls; `[ refresh ]` escape hatch.                                                  |
| `docs/COPY.md`                                        | Source of truth for locked copy + banned phrases        | ✓ VERIFIED | §3 banned phrases include `Add your first peer` and `Welcome to pim`.                                                                          |
| `docs/SECURITY.md`                                    | §3.2 anchor for handshake failures                      | ✓ VERIFIED | Line 33: `### 3.2 Handshake failures` — link target verified.                                                                                  |
| `scripts/audit-copy.mjs`                              | Build-blocking copy audit                               | ✓ VERIFIED | 155 LOC; loads banned phrases from `docs/COPY.md §3` with hardcoded fallback; checks JSX `>…!…<` + quoted-string `!`; CI exit code on hard violations. |
| `package.json :: audit:copy`                          | Script entry                                            | ✓ VERIFIED | `"audit:copy": "node scripts/audit-copy.mjs"`.                                                                                                 |

### Key Link Verification

| From                        | To                                  | Via                                                    | Status   | Details                                                                                                  |
| --------------------------- | ----------------------------------- | ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------- |
| `app-root.tsx`              | `welcome.tsx`                       | `localStorage["pim-ui.onboarding.completed"]` gate     | ✓ WIRED  | Synchronous flag init; gate flips on `onComplete`; `pim-ui:scroll-to-nearby` CustomEvent dispatched.     |
| `welcome.tsx`               | `dashboard.tsx`                     | window event `pim-ui:scroll-to-nearby`                 | ✓ WIRED  | Both files reference the same string verbatim. `dashboard.tsx:100` registers `addEventListener`; `:87` calls `scrollIntoView`. |
| `dashboard.tsx`             | `route-toggle-panel.tsx`            | direct mount between Identity and PeerList             | ✓ WIRED  | Order: IdentityPanel → RouteTogglePanel → PeerListPanel → NearbyPanel (lines 127, 133, 135, 144).        |
| `route-toggle-panel.tsx`    | `route.set_split_default` daemon    | `callDaemon` from `lib/rpc.ts`                         | ✓ WIRED  | Both `[ CONFIRM TURN ON ]` and `[ TURN OFF ROUTING ]` paths await the call; sonner toasts error path.   |
| `route-toggle-panel.tsx`    | `useDaemonState` snapshot           | `useRouteOn`, `useSelectedGateway`, `useStatus`         | ✓ WIRED  | Re-renders on `route_on / gateway_selected / gateway_lost / kill_switch` events.                         |
| `app-shell.tsx`             | `kill-switch-banner.tsx`            | direct mount above `<ActiveScreen />`                  | ✓ WIRED  | Line 153 — banner sits above the rest of the screen DOM.                                                  |
| `kill-switch-banner.tsx`    | `useKillSwitch()` selector          | derived `route_on === true && selected_gateway === null` | ✓ WIRED  | `useDaemonState` `kill_switch` handler defensively zeros `selected_gateway` so the derived condition is reliably true. |
| `peer-row.tsx`              | `docs/SECURITY.md §3.2`             | `shellOpen(SECURITY_DOCS_URL)`                          | ✓ WIRED  | `@tauri-apps/plugin-shell` import at line 43; nested button at line 134 invokes shellOpen with stopPropagation. |
| `invite-peer-sheet.tsx`     | system clipboard                    | `navigator.clipboard.writeText(INVITE_FULL_URL)`        | ✓ WIRED  | Button label flips to `[ COPIED ]` for 2 s; silent no-op on rejection (URL visible verbatim above).       |
| `routing.tsx`               | `use-route-table.ts`                | `useRouteTable()` consumer                              | ✓ WIRED  | Returns `{table, loading, refetch}`; `[ refresh ]` button calls `refetch()`.                              |
| `app-shell.tsx` keyboard    | `routing` screen id                 | ⌘3 / Ctrl+3 hotkey                                     | ✓ WIRED  | `app-shell.tsx` registers Meta/Ctrl + 3 → setActiveScreen("routing"). Sidebar shows `routing ⌘3`.        |
| `active-screen.tsx`         | `routing.tsx`                       | `case "routing": return <RouteScreen />`               | ✓ WIRED  | Line confirmed.                                                                                            |

### Data-Flow Trace (Level 4)

| Artifact                         | Data Variable                  | Source                                                                                          | Produces Real Data | Status     |
| -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| `RouteTogglePanel`               | `routeOn`, `status`, `routeTable` | `useDaemonState` snapshot (events) + `useRouteTable` (one-shot RPC + event refetch fan-out)     | Yes                | ✓ FLOWING  |
| `RouteTablePanel`                | `routes` prop                  | `routing.tsx` passes `table.routes` from `useRouteTable()`                                       | Yes                | ✓ FLOWING  |
| `KnownGatewaysPanel`             | `gateways` prop                | `routing.tsx` passes `table.gateways` from `useRouteTable()`                                     | Yes                | ✓ FLOWING  |
| `KillSwitchBanner`               | `visible`                      | `useKillSwitch()` selector over `useDaemonState` snapshot                                        | Yes                | ✓ FLOWING  |
| `WelcomeScreen`                  | `onComplete` callback          | `app-root.tsx` → flips `onboardingDone`; dispatches `scroll-to-nearby` event                     | Yes                | ✓ FLOWING  |
| `InvitePeerSheet`                | `INVITE_FULL_URL` constant     | hardcoded in copy.ts (honest-stub, daemon `invite.*` RPC absent in v1)                           | Static-by-design   | ⚠️ STATIC  |
| `peer-row.tsx` handshake row     | `HANDSHAKE_FAIL_SUBLINE` + URL | copy.ts constants; only renders when peer state indicates handshake failure (caller-driven)      | Yes (conditional)  | ✓ FLOWING  |

The InvitePeerSheet "STATIC" status is an explicit, documented honest-stub per `04-CONTEXT.md` and the file's header — the v1 daemon ships no `invite.*` RPC; UX-PLAN P1 ("never abstract a packet into a happy green dot") forbids inventing a fake URL, so the surface declares its limits. This is intentional and aligned with the brand contract, not a gap.

### Behavioral Spot-Checks

| Behavior                                                                         | Command                                                                                                | Result                                          | Status |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------ |
| TypeScript compilation has zero errors                                           | `pnpm typecheck`                                                                                       | exit 0; no output (clean)                        | ✓ PASS |
| Copy audit passes with 0 hard violations                                         | `pnpm audit:copy`                                                                                      | `0 hard violations, 1 soft warnings` (form.tsx:53 pre-existing, acceptable) | ✓ PASS |
| Production build succeeds                                                        | `pnpm build`                                                                                           | `✓ built in 2.16s`, 1812 modules, 602 KB JS bundle | ✓ PASS |
| W1 invariant: `rpc.ts` owns 0 listen() subscriptions                             | `grep -c 'listen(' src/lib/rpc.ts`                                                                     | `0`                                              | ✓ PASS |
| W1 invariant: `use-daemon-state.ts` owns exactly 2 listen() subscriptions         | `grep -c 'listen(' src/hooks/use-daemon-state.ts`                                                      | `2`                                              | ✓ PASS |
| W1 invariant: `use-route-table.ts` owns 0 listen() subscriptions                 | `grep -c 'listen(' src/hooks/use-route-table.ts`                                                       | `0`                                              | ✓ PASS |
| Banned phrases absent from product code                                          | `grep -rE "Add your first peer|Welcome to pim" src/ --include="*.tsx" --include="*.ts"`                | (no matches)                                     | ✓ PASS |
| Phase-4 files contain zero TODO/FIXME/placeholder anti-patterns                  | grep across welcome / routing / route-toggle-panel / kill-switch-banner / invite-peer-sheet            | (no matches)                                     | ✓ PASS |
| `kill_switch` event handler upgraded with defensive `selected_gateway: null`     | `grep -A 5 'case "kill_switch"' src/hooks/use-daemon-state.ts`                                         | `next.routes = { ...current.routes, selected_gateway: null }` | ✓ PASS |
| `docs/SECURITY.md §3.2` exists as link target                                    | `grep "### 3.2 Handshake" docs/SECURITY.md`                                                            | line 33 match                                    | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan         | Status (REQUIREMENTS.md) | Plan-FM Status | Evidence                                                                                                                                |
| ----------- | ------------------- | ------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ROUTE-01    | 04-02-PLAN          | Complete (Phase 4)       | ✓ SATISFIED    | RouteTogglePanel renders dashboard toggle; off/on/pre-flight states; `[ TURN ON ROUTING ]` calls `route.set_split_default({on:true})`. |
| ROUTE-02    | 04-02-PLAN          | Complete (Phase 4)       | ✓ SATISFIED    | `formatRouteLine` returns honest `Routing through {gateway-X}` / `(via relay-Y)`; never just "on".                                       |
| ROUTE-03    | 04-03-PLAN          | Complete (Phase 4)       | ✓ SATISFIED    | RouteScreen + sidebar/active-screen wiring; ⌘3 hotkey lands on Routing tab; sidebar shows `routing ⌘3`.                                  |
| ROUTE-04    | 04-03-PLAN          | Complete (Phase 4)       | ✓ SATISFIED    | RouteTablePanel + KnownGatewaysPanel render full schema (destination · via · hops · learned_from · age) and selected gateway ◆ highlight.|
| UX-01       | 04-04-PLAN          | Complete (Phase 4)       | ✓ SATISFIED    | WelcomeScreen + AppRoot welcome branch + localStorage gate; ≤ 3 interactions to dashboard on solo path; no wizard framing.                |
| UX-02       | 04-05-PLAN          | Complete (Phase 4)       | ✓ SATISFIED    | PeerListPanel buttons enabled, no Phase-2 disabled tooltip; InvitePeerSheet wired with clipboard write.                                   |
| UX-03       | 04-06-PLAN          | Complete (Phase 4)       | ✓ SATISFIED    | KillSwitchBanner derived from snapshot; verbatim copy; handshake-fail sub-line links to SECURITY.md §3.2 via shellOpen.                    |
| UX-08       | 04-01-PLAN, 04-06-PLAN | Complete (Phase 4)    | ✓ SATISFIED    | docs/COPY.md + audit-copy.mjs + `audit:copy` script; pnpm audit:copy returns 0 hard violations.                                            |

No orphaned requirements detected. Every Phase-4 ID listed in REQUIREMENTS.md (rows 165–172) is covered by at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact                                                                                                                                                              |
| ---- | ---- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/ui/form.tsx` | 53 | soft warning `should` (audit-copy soft list) | ℹ️ Info | Documented as pre-existing, acceptable. Inside a thrown developer-error message, not user-visible copy. |

No blocker or warning anti-patterns detected in any Phase-4 file. All grep sweeps for TODO / FIXME / placeholder / coming soon / not-yet-implemented across welcome.tsx, routing.tsx, route-toggle-panel.tsx, kill-switch-banner.tsx, invite-peer-sheet.tsx returned zero matches.

### Human Verification Required

Five polish-level observations are best validated against a live build. None block the goal — every truth is satisfied by codebase evidence — but the following are observable runtime characteristics that static analysis cannot certify:

1. **Solo-path latency ≤ 30 s.** `welcome.tsx` writes the localStorage flag synchronously before `onComplete()`; AppRoot reads it synchronously. The gate cost is bounded, but the OS-driven TUN-permission dialog is the dominant time term and must be felt with a stopwatch.
2. **Pre-flight ~500 ms perception.** `derivePreflight()` runs synchronously (zero-RPC, three pure rows). The CSS expansion / row-paint timing is a perceptual judgement.
3. **`scrollIntoView` smoothness.** Listener wired (`dashboard.tsx:100`); ref wired (`:87`); CSS `behavior: 'smooth'` — visual smoothness depends on scroll-container layout and viewport.
4. **Clipboard semantics in Tauri.** `navigator.clipboard.writeText(INVITE_FULL_URL)` is wired with a `try / catch` and 2 s revert. Verify the copied value pastes verbatim.
5. **Kill-switch banner appearance during a real `status.event`.** Defensive snapshot mutation (`use-daemon-state.ts case "kill_switch"`) guarantees the derived condition; observe the banner mount when daemon emits the event.

### Gaps Summary

No gaps. The phase contract is met by committed code:

- All 6 ROADMAP success criteria have codebase-verifiable evidence.
- All 8 requirement IDs (ROUTE-01..04, UX-01, UX-02, UX-03, UX-08) are complete with implementation evidence.
- All 6 plan files have substantive SUMMARY documents (138–207 LOC each).
- W1 brand invariants (Tauri event subscription topology) intact.
- Locked copy registry + audit script + CI-blocking npm script in place; `pnpm audit:copy` returns 0 hard violations.
- TypeScript build clean (`pnpm typecheck` exit 0).
- Production build succeeds (`pnpm build` exit 0, 1812 modules transformed).
- The InvitePeerSheet ships with no real `pim://invite/...` URL because the v1 daemon has no `invite.*` RPC method — this is an intentional honest-stub per UX-PLAN §1 P1, not a gap; the sheet declares its limits inline rather than inventing a fake URL.

The Phase 3 work-in-progress (`app-shell.tsx`, `active-screen.tsx`, `sidebar.tsx`, `stop-confirm-dialog.tsx`) is a separate workstream and is explicitly excluded from this verification per the user's instructions.

---

_Verified: 2026-04-26_
_Verifier: Claude (gsd-verifier)_
