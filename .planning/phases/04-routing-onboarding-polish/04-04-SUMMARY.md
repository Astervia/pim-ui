---
phase: 04-routing-onboarding-polish
plan: 04
subsystem: ui
tags: [onboarding, welcome-screen, app-root, localStorage, custom-event, tauri, react]

# Dependency graph
requires:
  - phase: 01.1-first-run-config-bootstrap
    provides: AppRoot three-state machine (loading | missing+!bootstrapped | else); FirstRunScreen + bootstrapped flag handoff
  - phase: 04-routing-onboarding-polish/04-01
    provides: src/lib/copy.ts WELCOME_* locked-string constants (D-26 §6)
provides:
  - WelcomeScreen component (src/screens/welcome.tsx) with two bracketed actions [ ADD PEER NEARBY ] and [ RUN SOLO ]
  - AppRoot four-state boot router extension (loading | first-run | welcome | app) with localStorage["pim-ui.onboarding.completed"] gate
  - pim-ui:scroll-to-nearby window CustomEvent dispatcher (consumer = Plan 04-05 Task 2 dashboard listener)
  - Onboarding step 3 of the 3-interaction UX-01 flow (FirstRunScreen + TUN modal + WelcomeScreen pick)
affects:
  - 04-05 (Dashboard registers window.addEventListener for pim-ui:scroll-to-nearby; relies on character-identical event-name string)
  - 04-06 (final voice/audit pass over WelcomeScreen strings — already audit-locked via copy.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Browser-native CustomEvent on window as a one-shot cross-screen signal (avoids new module-level atom, preserves W1 single-listener invariant)
    - localStorage flag gating with synchronous useState initializer to bypass UI flash on returning users
    - Locked-string discipline: every user-visible string imported from src/lib/copy.ts; zero inline literals

key-files:
  created:
    - src/screens/welcome.tsx
  modified:
    - src/app-root.tsx

key-decisions:
  - "WelcomeScreen branch placed AFTER the FirstRunScreen branch and BEFORE the App branch; the configState-present case (returning user) and the bootstrapped===true case (new user just finished FirstRunScreen) both flow through the same onboardingDone gate so the UX-01 third-interaction is a single render path"
  - "onboardingDone useState uses a synchronous lazy initializer (() => localStorage.getItem(KEY) === 'true') so a returning user with the flag set gets <App /> on the very first render — no WelcomeScreen flash, no double mount under React StrictMode"
  - "Cross-screen scroll signal uses window.dispatchEvent(new CustomEvent('pim-ui:scroll-to-nearby')) rather than a module-level atom or prop chain — keeps the W1 invariant intact (zero new Tauri listen() calls), keeps Dashboard's listener a one-shot self-removing handler, and the event-name string is the only contract surface (declared as SCROLL_TO_NEARBY_EVENT constant in app-root.tsx, listener will reference the same literal in dashboard.tsx)"
  - "WelcomeScreen fires onComplete(false) inside its mount-time useEffect when localStorage flag is already 'true' — covers the reload-mid-flight case (flag set but AppRoot's useState initializer somehow saw a stale read); render returns null branch is unnecessary because AppRoot will re-render with onboardingDone===true on the next tick"
  - "Both buttons set localStorage BEFORE invoking onComplete (D-03 ordering) — guarantees the flag is durable even if the parent's setOnboardingDone(true) is interrupted by a hot-reload or window close mid-callback"
  - "Brand-comment grep gates trip on JSDoc literal mentions of forbidden tokens (gradients) — top-of-file docblock rephrased to 'no border-radius variants, no fade-blends' so the brand audit grep passes on file content alone (matches the comment-vocabulary discipline locked by Plan 04-03)"

patterns-established:
  - "Cross-screen one-shot signaling: window CustomEvent — declared once as a module-level constant in the dispatcher, referenced by literal-string match in the listener; no new atom, no new RPC, no new Tauri channel"
  - "Onboarding gate pattern: synchronous useState lazy initializer reading localStorage at construction time, not in a useEffect — eliminates first-render UI flash for returning users"
  - "Locked-copy import discipline carried into screens: every user-visible string in welcome.tsx comes from @/lib/copy; pnpm audit:copy now has a single point of authority for the WelcomeScreen strings"

requirements-completed: [UX-01]

# Metrics
duration: 6min
completed: 2026-04-27
---

# Phase 4 Plan 04: WelcomeScreen Onboarding Step 3 Summary

**WelcomeScreen inserted between Phase 01.1 FirstRunScreen and Phase 2 AppShell as the third onboarding interaction; localStorage flag gate bypasses returning users; window CustomEvent bridges to Plan 04-05's NearbyPanel scroll handler.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-27T01:30:55Z
- **Completed:** 2026-04-27T01:37:01Z
- **Tasks:** 2 (both `auto`)
- **Files modified:** 2 (1 created, 1 edited)

## Accomplishments

- **Onboarding step 3 shipped (UX-01):** AppRoot now renders WelcomeScreen exactly once per device after Phase 01.1 bootstrap completes; localStorage flag persists the choice across sessions so returning users boot straight to AppShell.
- **Three-interaction onboarding loop closed:** FirstRunScreen device-name + role (interaction 1) → TUN permission modal (interaction 2) → WelcomeScreen pick (interaction 3) → Dashboard. Solo-path budget ≤ 30 s preserved.
- **Locked-copy contract honored:** every user-visible string in WelcomeScreen sourced from `src/lib/copy.ts` (WELCOME_TITLE / WELCOME_SECTION / WELCOME_SUBTITLE / WELCOME_ADD_LABEL / WELCOME_ADD_DESC / WELCOME_SOLO_LABEL / WELCOME_SOLO_DESC) — `pnpm audit:copy` has zero hard violations.
- **Cross-screen scroll bridge wired:** `[ ADD PEER NEARBY ]` causes AppRoot to dispatch a `pim-ui:scroll-to-nearby` CustomEvent on window; Plan 04-05 Task 2 will register a one-shot listener on dashboard.tsx that scrolls NearbyPanel into view and self-removes. Event-name string declared as `SCROLL_TO_NEARBY_EVENT` constant for refactor safety.
- **W1 single-listener invariant preserved:** `grep -c 'listen(' src/lib/rpc.ts` = 0; `grep -c 'listen(' src/hooks/use-daemon-state.ts` = 2. Neither file touched. The cross-screen signal uses the browser-native event channel, not a Tauri subscription.
- **Brand absolutes upheld:** zero `rounded-*`, zero `gradient`, zero `!` (excluding `!==` / `!=`) in `src/screens/welcome.tsx` and `src/app-root.tsx`; all conditionals bang-free (`=== true` / `=== false` / `=== null`).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-execution protocol):

1. **Task 1: Create src/screens/welcome.tsx (WelcomeScreen component, D-02 + D-04)** — `ba02e5a` (feat)
2. **Task 2: Wire WelcomeScreen into AppRoot's boot sequence + signal dashboard scroll-to-nearby (D-01, D-04, D-07)** — `833d58b` (feat)

**Plan metadata commit:** see final-commit hash recorded by orchestrator after all parallel agents finish.

## Files Created/Modified

- **`src/screens/welcome.tsx` (created, 109 lines)** — WelcomeScreen component. Renders a single CliPanel with `WELCOME_SECTION` ("YOU'RE SET") header; subtitle; two bracketed `<Button>` actions; descriptive sub-copy under each. `useEffect` short-circuits via `onComplete(false)` if the localStorage flag is already `"true"` on mount (reload-mid-flight safety). `handle(scrollToNearby: boolean)` writes the flag THEN invokes `onComplete` (D-03 ordering). All strings imported from `@/lib/copy`.
- **`src/app-root.tsx` (modified, +52 / −3 lines)** — Three new pieces wired in: (1) `import { WelcomeScreen } from "@/screens/welcome"`, (2) `onboardingDone` useState slot with synchronous localStorage lazy initializer, (3) new branch between FirstRunScreen and `<App />` that renders WelcomeScreen when `onboardingDone === false` and dispatches `pim-ui:scroll-to-nearby` window CustomEvent on the add-peer-nearby branch. Existing `loading` splash branch and `missing && bootstrapped === false` FirstRunScreen branch preserved verbatim. Top-of-file docblock extended to document the Phase 4 D-01 third boot state.

## Decisions Made

- **Cross-screen signaling via window CustomEvent (not module-level atom):** the alternative — a `useNavigationIntent` hook with a module-level atom and `useSyncExternalStore` — would have added a third file to this plan and a third state surface to maintain. The one-shot scroll intent has no observability requirements (Mira-level diagnostics aren't useful for "scroll the nearby panel into view"), so the simplest contract — a string-named browser event — wins. Plan 04-05 Task 2 only needs to know the event-name string `"pim-ui:scroll-to-nearby"`; both files reference it as a literal so the contract is greppable.
- **Synchronous localStorage initializer over useEffect read:** a useEffect-based read would cause a one-frame flash of WelcomeScreen for returning users, contradicting the "boots straight to AppShell" requirement in the success criteria. The lazy useState initializer runs at construction time, before the first commit, so React mounts the correct branch on the very first render.
- **D-03 flag-set ordering inside WelcomeScreen.handle():** writing the flag BEFORE calling onComplete means even if the parent setState is interrupted (window close, hot-reload), the flag persists and the user is not trapped in an onboarding loop on the next launch. This matches the spirit of Phase 01.1's atomic-rename config write — durable state before navigation.
- **Two `<Button variant="default" size="lg">` actions:** matches the Phase 2 + Phase 01.1 primary-bracketed-button convention and gives the WelcomeScreen the same visual weight as `[ Start pim ]` in FirstRunScreen — the user is making the same kind of decision (commit to a path) and the visual language should reinforce that.

## Deviations from Plan

None — plan executed exactly as written. The only edit not literally specified by the plan was the docblock comment-vocabulary fix for the gradient grep gate (matches the Plan 04-03 comment-discipline pattern already in STATE.md decisions); this is the established style in the routing folder, so it's a pattern conformance, not a deviation.

## Issues Encountered

- **Initial `gradient` grep gate tripped on the JSDoc literal "NO gradients" in the docblock.** The brand grep `grep -E '\bgradient' src/screens/welcome.tsx` returned 1, not 0. Fix: rephrased the docblock from "NO rounded-*, NO gradients" to "no border-radius variants, no fade-blends" — same intent, audit-clean. This is the exact pattern Plan 04-03 locked in STATE.md for the routing folder; applied here for consistency. No code-level change, only comment-level vocabulary.

## User Setup Required

None — no external service configuration required. The localStorage flag is an in-app concern; users only experience this as the welcome screen showing once on first launch and never again.

## Next Phase Readiness

- **04-05 unblocked:** Dashboard can now register a one-shot `window.addEventListener("pim-ui:scroll-to-nearby", ...)` handler that scrolls its NearbyPanel ref into view and self-removes. The event-name string is the only contract surface — character-for-character identical to the dispatcher in `src/app-root.tsx`.
- **04-06 (voice/audit pass) inputs ready:** WelcomeScreen strings are already routed through `src/lib/copy.ts` (D-26), so any audit-flagged voice issues will be fixed in copy.ts (single edit) rather than in welcome.tsx itself. The audit script already passes hard checks; only the pre-existing `should` soft warning in `src/components/ui/form.tsx:53` (out-of-scope per Plan 04-01) remains.
- **No blockers, no concerns.** UX-01 (first-run onboarding completes in ≤3 interactions) is now fully satisfied for the desktop happy path.

## Self-Check: PASSED

Verified after writing this SUMMARY:

- `[x] FOUND src/screens/welcome.tsx` (created in Task 1)
- `[x] FOUND src/app-root.tsx` (extended in Task 2)
- `[x] FOUND commit ba02e5a (Task 1)`
- `[x] FOUND commit 833d58b (Task 2)`
- `[x] grep -q "export function WelcomeScreen" src/screens/welcome.tsx` — passes
- `[x] grep -q '"pim-ui.onboarding.completed"' src/screens/welcome.tsx` — passes
- `[x] grep -q '"pim-ui:scroll-to-nearby"' src/app-root.tsx` — passes
- `[x] grep -c 'listen(' src/lib/rpc.ts` returns 0 — W1 preserved
- `[x] grep -c 'listen(' src/hooks/use-daemon-state.ts` returns 2 — W1 preserved
- `[x] pnpm typecheck` exits 0
- `[x] pnpm audit:copy` 0 hard violations (1 pre-existing `should` soft warning in src/components/ui/form.tsx:53, out of scope per Plan 04-01)
- `[x] grep -E 'rounded-(sm|md|lg|xl|2xl|3xl|full)' src/screens/welcome.tsx` returns 0
- `[x] grep -E '\bgradient' src/screens/welcome.tsx` returns 0
- `[x] grep -E '\!' src/screens/welcome.tsx src/app-root.tsx | grep -v '!==' | grep -v '!='` returns 0

---
*Phase: 04-routing-onboarding-polish*
*Plan: 04*
*Completed: 2026-04-27*
