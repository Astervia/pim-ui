---
phase: 03-configuration-peer-management
plan: 04
subsystem: ui
tags: [settings, scaffold, react-hook-form, radix-collapsible, conf-01, conf-07, dirty-state, raw-wins, pending-restart, discard-dialog, w1-preserved]

# Dependency graph
requires:
  - phase: 03-configuration-peer-management
    provides: Six brand-overridden shadcn primitives (collapsible / alert-dialog / form / tooltip / switch / radio-group), TOML library (parseToml + assembleToml + diffSectionsAgainstSchema + SECTION_SCHEMAS), useSettingsConfig + module-level refetchSettingsConfig (Plan 03-01), applyLogsFilter + setActive routing pattern (Plan 03-03)
  - phase: 02-honest-dashboard-peer-surface
    provides: Sidebar / AppShell / ActiveScreen scaffolding (D-01/D-02 reserved-slot rows + ⌘1/⌘2/⌘5 keyboard handler), useActiveScreen module-level atom, useDaemonState fan-out + actions.subscribe (W1 contract)
  - phase: 01-rpc-bridge-daemon-lifecycle
    provides: callDaemon<M> + RpcMethodMap typed RPC wrapper, RpcErrorCode.ConfigValidationFailed (-32020) + ConfigSaveRejected (-32021), W1 single-listener invariant (rpc.ts 0 listen / use-daemon-state.ts 2 listen), brand button.tsx + dialog.tsx + StopConfirmDialog, daemon stop/start actions
provides:
  - "<SettingsScreen /> orchestrator at ⌘6 — nine CollapsibleCliPanel sections in fixed order (CONF-01 framing). Plan 03-05 replaces the four form-heavy stubs (IDENTITY/TRANSPORT/DISCOVERY/TRUST); Plan 03-06 replaces the remaining five (ROUTING/GATEWAY/NOTIFICATIONS/ADVANCED/ABOUT)."
  - "<CollapsibleCliPanel /> — brand-wrapped Radix Collapsible on top of CliPanel header shape. Box-drawing chrome + summary right-area + ▸/▾ glyph swap + animation classes mirroring dialog.tsx / sheet.tsx patterns."
  - "<SectionSaveFooter /> — shared per-section save row with [ Save ] / [ Saving… ] / [ Saved ] state labels and the verbatim 'Daemon stopped — reconnect to save.' hint when limited."
  - "<WireNameTooltip /> — `ⓘ` trigger that reveals the daemon TOML wire name verbatim on hover/focus (D-33)."
  - "<RawWinsBanner /> — verbatim CONF-07 banner 'Raw is source of truth — form view shows a subset' + [ Open Advanced ] scroll action targeting #settings-section-advanced."
  - "<DiscardUnsavedChangesAlertDialog /> — D-13 verbatim copy dialog (title, body, [ Discard ], [ Stay ]). Stateless — caller drives open / sectionName / dirtyFieldCount / onDiscard / onStay."
  - "useSectionSave(sectionId, form) — per-section orchestration: dry_run -> real save -> refetchSettingsConfig -> diffSectionsAgainstSchema -> setAllSectionRawWins. requires_restart toast routes [ Restart ] through restartDaemon util; reject toast routes [Show in Logs ->] through setActive('logs') + applyLogsFilter({ source: 'config' }). Mirrors form.formState.isDirty into use-dirty-sections via useEffect."
  - "useSectionRawWins (read-only hook) + setAllSectionRawWins (module-level writer) — Blocker-3 refactor of the previously-ambiguous dual API. Persists per-section flag to localStorage 'pim-ui.section-raw-wins.{id}' (D-15)."
  - "usePendingRestart(sectionId) — atom for per-section requires_restart fields; persisted to localStorage 'pim-ui.pending-restart' (D-26); cleared on status.event { kind: 'role_changed' } via the W1 fan-out (single-handler invariant per Info 3)."
  - "useDirtySections + setSectionDirty + getDirtySections + emitDiscardReset — module atom + non-hook setters/readers + window CustomEvent fan-out for D-13 form.reset() lockstep across sections."
  - "use-gated-navigation (requestActive + usePendingNav) — wraps setActive so Sidebar / AppShell-keyboard nav requests are intercepted when getDirtySections() is non-empty. Module-atom holds pending nav target; ActiveScreen mounts the discard dialog and consumes the atom."
  - "src/lib/config/map-errors.ts — mapConfigErrorsToFields(err, sectionId) translates daemon ConfigValidationError[] (codes -32020 / -32021) to per-field FormMessage map keyed by daemon TOML path + a section-banner fallback when no field matches."
  - "src/lib/daemon-restart.ts — shared restartDaemon(actions) util (checker Warning 3) so useSectionSave AND Plan 03-06's useRawTomlSave call the SAME stop -> wait -> start sequence; raw-TOML restart toast is no longer a no-op gap."
affects: [03-05, 03-06, 03-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-commit atomic narrative for scaffold plans: (1) shared components + screen; (2) hooks + lib utilities; (3) cross-cutting D-13 discard flow. Each commit independently verifiable with typecheck + build, no broken intermediate state."
    - "Module-atom + useSyncExternalStore continues as the canonical client-state pattern (mirrors useActiveScreen / useDaemonState / useSettingsConfig / use-add-peer / use-remove-peer / use-logs-stream). Phase 3 03-04 extends it to four new atoms: use-section-raw-wins, use-pending-restart, use-dirty-sections, use-gated-navigation."
    - "Cross-component fan-out via window CustomEvent (NOT Tauri event channel — W1 invariant preserved): pim:settings-collapse-all / -expand-all (Plan 03-01 -> 03-04 SettingsScreen), pim:settings-discard-reset (D-13 emitDiscardReset -> useSectionSave's per-section form.reset listener)."
    - "Single-handler invariant for W1 fan-out subscriptions: usePendingRestart's status.event subscription is registered exactly once at app-init (module-level guard); N section mounts do NOT register N handlers. Documented inline as 'INVARIANT (checker Info 3)' so future edits don't accidentally break it."
    - "Read-only hook + non-hook module writer pattern (checker Blocker 3): useSectionRawWins exposes only a per-section read; writers import setAllSectionRawWins directly. Eliminates the previously-ambiguous dual API where `.setAll(map)` lived on the per-section return."
    - "Gated navigation pattern: requestActive(id, setActive) wraps the underlying setter. No-dirty path is a direct call; dirty path stashes pending nav to a module atom + opens dialog. ActiveScreen consumes the atom and mounts the dialog at shell scope. Sidebar + AppShell-keyboard call requestActive instead of setActive directly."
    - "Stateless dialog presentation: DiscardUnsavedChangesAlertDialog accepts open / sectionName / dirtyFieldCount / onDiscard / onStay as props — no internal state, no atom coupling. Mounted by both ActiveScreen (nav-away gate) and StopConfirmDialog (Stop-path gate); each caller provides its own state coupling."
    - "Bang-free implementation continues mechanically — every negation as `=== false` / `=== null` / `=== undefined`. Verified: zero `!value` patterns in any of the 12 new files + the four shell modifications."

key-files:
  created:
    - src/screens/settings.tsx
    - src/components/settings/collapsible-cli-panel.tsx
    - src/components/settings/section-save-footer.tsx
    - src/components/settings/wire-name-tooltip.tsx
    - src/components/settings/raw-wins-banner.tsx
    - src/components/settings/discard-unsaved-changes-alert-dialog.tsx
    - src/hooks/use-section-save.ts
    - src/hooks/use-section-raw-wins.ts
    - src/hooks/use-pending-restart.ts
    - src/hooks/use-dirty-sections.ts
    - src/hooks/use-gated-navigation.ts
    - src/lib/config/map-errors.ts
    - src/lib/daemon-restart.ts
  modified:
    - src/components/shell/active-screen.tsx
    - src/components/shell/app-shell.tsx
    - src/components/shell/sidebar.tsx
    - src/components/brand/stop-confirm-dialog.tsx

key-decisions:
  - "Three-commit atomic sequence (per the plan's commit-narrative): commit 1 = shared components + screen; commit 2 = hooks + lib; commit 3 = D-13 discard flow + nav interception. Each commit is independently typecheck-clean + build-clean."
  - "use-gated-navigation factored as its own hook + module atom (Plan H.3 mentioned this as 'optional helper'; chosen here for readability). Sidebar.tsx + app-shell.tsx call requestActive(id, setActive) instead of setActive(id) directly — the gating logic lives in one place rather than being duplicated at every nav-trigger site."
  - "Discard-dialog mounted at shell-scope inside ActiveScreen (NOT inside SettingsScreen). Two callers gate through it: nav-away interception (any tab change) AND stop-confirm chained gate. Mounting at shell scope means it survives the SettingsScreen unmounting that follows the actual tab change."
  - "Section name resolution in ActiveScreen.tsx: when exactly one section is dirty, its title from SECTION_SCHEMAS is used (e.g. 'TRANSPORT'); otherwise 'this app session' — matches D-13's body template grammar both ways."
  - "useSectionSave signature takes (sectionId, form) so the hook can write form.formState.isDirty into use-dirty-sections via useEffect AND listen for pim:settings-discard-reset to call form.reset() in lockstep. The plan's earlier signature did NOT pass form in; checker Blocker 1 mandated this revision."
  - "active-screen.tsx already had `<SettingsScreen />` wired by Phase 4's commit 3ec907f (Phase 4 imported the screen this plan ships preemptively). The Phase 3 commit 1 created src/screens/settings.tsx so the import resolves; no second edit to active-screen.tsx was needed for that wire-up."
  - "SaveState type re-exported from useSectionSave (the orchestrator) AND defined locally in section-save-footer (the consumer). The orchestrator export is the canonical site (acceptance grep target); the local definition keeps section-save-footer self-describing for read-only consumers without forcing a circular dep."
  - "stop-confirm-dialog.tsx gates via a local discardOpen / discardCleared useState pair rather than rolling into use-gated-navigation. The Stop path is conceptually distinct from tab-nav (no `pending` target) and the gate transitions through a different decision tree (Stay = dismiss whole flow vs. nav's Stay = abort just the tab change)."
  - "Animation classes (data-[state=open]:animate-in etc.) included on CollapsibleCliPanel + DiscardDialog matching the existing dialog.tsx / sheet.tsx pattern. The project does not appear to currently load tailwindcss-animate / tw-animate — these classes are no-ops at runtime today but the collapse / fade still works correctly via Radix's data-state attributes; once a future plan loads the animation utility plugin, the motion comes online without code changes."

patterns-established:
  - "Coexistence with parallel Phase 4 work: this executor was warned that the previous Phase 3 plan (03-03) accidentally bundled Phase 4 routing files into a docs commit. Mitigation here: every git add invocation passed specific filenames (never `git add .` or `-A`); for active-screen.tsx the Phase 4 routing case had been committed by Phase 4's commit 3ec907f BEFORE my changes landed, so my diff vs HEAD was strictly Phase 3 (no Phase 4 hunks bundled in)."
  - "Acceptance-grep verification rule: `! grep -E useSectionRawWins(...).setAll src/hooks/` failed because a comment in use-section-raw-wins.ts described the OLD ambiguous API verbatim. Resolution: rewrite the comment to be prose-only (no inline code-shaped strings) so literal greps don't trip on documentation. This is the same pattern Plan 03-01 hit with rounded-(md|lg|full|xl) JSDoc references."
  - "Cross-plan contract for [Show in Logs ->] toasts (D-32): callers wire `setActive('logs') + applyLogsFilter({ source: <module> })`. Plan 03-04 useSectionSave is the second consumer (after Plan 03-03 DebugSnapshotButton); the pattern is now the canonical action handler shape for any settings/peers/config error toast going forward."

requirements-completed: [CONF-01, CONF-07]

# Metrics
duration: 28min
completed: 2026-04-27
---

# Phase 03 Plan 04: Settings Scaffold Summary

**Settings scaffold (CONF-01) at ⌘6 — nine CollapsibleCliPanel section stubs in fixed order, brand-wrapped Radix Collapsible + verbatim CONF-07 raw-wins banner + per-section save flow (dry_run -> real save -> refetch -> rawWins rescan -> requires_restart toast / reject toast) + D-13 discard-unsaved-changes flow gating both nav-away and Stop-daemon paths. Plans 03-05 / 03-06 replace the section bodies; this plan ships the chrome + the orchestration.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-04-27T01:30:00Z (approx)
- **Completed:** 2026-04-27T01:58:00Z (approx)
- **Tasks:** 1 (single-task plan; executed as three atomic commits per the plan's commit sequence)
- **Files created:** 13
- **Files modified:** 4

## Accomplishments

- ⌘6 routes to <SettingsScreen /> rendering nine CollapsibleCliPanel stub sections in fixed order (CONF-01 framing); ⌘↑/⌘↓ collapse-all / expand-all via window CustomEvent.
- Save orchestration ready for Plan 03-05 to consume: useSectionSave(sectionId, form) drives dry_run -> real save -> refetchSettingsConfig -> diffSectionsAgainstSchema -> setAllSectionRawWins; reject toast fires `Daemon rejected settings: {msg}` with a working `[Show in Logs →]` action; success toast with non-empty requires_restart fires `Saved. Restart pim to apply: {fields}` with a working `[ Restart ]` action via the shared restartDaemon util.
- D-13 discard-unsaved-changes flow lands end-to-end: verbatim copy in DiscardUnsavedChangesAlertDialog, module atom in use-dirty-sections, nav-interception via use-gated-navigation, stop-path gate inside StopConfirmDialog. Sidebar clicks + AppShell ⌘1/⌘2/⌘3/⌘5/⌘6/⌘, all routed through requestActive(id, setActive).
- src/lib/daemon-restart.ts created + consumed by useSectionSave; Plan 03-06's useRawTomlSave will import the SAME util so the raw-TOML [ Restart ] toast is not a no-op.
- useSectionRawWins exposes a read-only hook; setAllSectionRawWins is the module-level writer (checker Blocker 3 resolution).
- usePendingRestart's single-status-handler invariant documented inline (checker Info 3); N section mounts register exactly 1 W1 fan-out handler at app-init.
- LimitedModeBanner state disables Save with the verbatim 'Daemon stopped — reconnect to save.' hint.
- W1 invariant preserved (use-daemon-state.ts listen() count = 2; rpc.ts = 0; zero @tauri-apps/api/event imports outside use-daemon-state.ts).
- Brand-discipline grep clean (zero rounded-(md|lg|full|xl), zero literal palette colors, zero lucide-react imports across all 13 new + 4 modified files).
- pnpm typecheck exits 0; pnpm build exits 0 (599.62 kB main bundle / 170.08 kB gzipped — within range; growth from 03-03's 590 kB is the new react-hook-form orchestration + AlertDialog usage).

## Task Commits

1. **Settings scaffold + shared components (CollapsibleCliPanel, SectionSaveFooter, WireNameTooltip, RawWinsBanner) + SettingsScreen** — `096f726` (feat)
   - 5 new files: collapsible-cli-panel.tsx + section-save-footer.tsx + wire-name-tooltip.tsx + raw-wins-banner.tsx + screens/settings.tsx
   - active-screen.tsx already wired <SettingsScreen /> via Phase 4 commit 3ec907f (the screen file landing here resolves the import)

2. **use-section-raw-wins + use-pending-restart + use-section-save + use-dirty-sections + map-errors + daemon-restart** — `2e9bf79` (feat)
   - 6 new files: use-dirty-sections.ts + use-pending-restart.ts + use-section-raw-wins.ts + use-section-save.ts + lib/config/map-errors.ts + lib/daemon-restart.ts

3. **D-13 discard-unsaved-changes flow (dialog + nav interception + stop-path gate)** — `93cda44` (feat)
   - 2 new files: discard-unsaved-changes-alert-dialog.tsx + hooks/use-gated-navigation.ts
   - 4 modified shell/brand files: active-screen.tsx (mounts dialog) + app-shell.tsx (keyboard requestActive) + sidebar.tsx (click requestActive) + stop-confirm-dialog.tsx (chained discard gate); also a docstring tweak in use-section-raw-wins.ts so the Blocker-3 grep returns 0

## Hook Architecture

```
useSettingsConfig (Plan 03-01)
  ├── { base: ParsedConfig | null, raw, refetch }
  └── refetchSettingsConfig() — module-level, also called by use-add-peer / use-remove-peer (D-30)

useSectionSave(sectionId, form) [Plan 03-04]
  ├── reads useSettingsConfig().base / refetch
  ├── writes setSectionDirty(sectionId, isDirty, count) on every form.formState change
  ├── listens for pim:settings-discard-reset → form.reset()
  ├── on save success:
  │     ├── parseToml(assembled) → diffSectionsAgainstSchema → setAllSectionRawWins(map)
  │     ├── requires_restart non-empty? → addFields(sectionId, fields) + toast([ Restart ] → restartDaemon(actions))
  │     └── otherwise → toast.success("Saved.")
  └── on save reject:
        ├── mapConfigErrorsToFields(err, sectionId) → fieldErrors / sectionBannerError / firstMessage
        └── toast.error("Daemon rejected settings: ...", action: [Show in Logs →] → setActive("logs") + applyLogsFilter({ source: "config" }))

usePendingRestart(sectionId) [Plan 03-04]
  ├── INVARIANT: single status.event subscription per app lifetime (module-level guard)
  └── auto-clear on status.event { kind: "role_changed" } (proxy for daemon restart)

useSectionRawWins(sectionId) [Plan 03-04 — read-only hook]
  └── setAllSectionRawWins(map) [non-hook module writer; persists to localStorage]

useDirtySections / setSectionDirty / getDirtySections / emitDiscardReset(id|"all") [Plan 03-04]

use-gated-navigation [Plan 03-04]
  ├── requestActive(id, setActive) [non-hook]
  │     ├── getDirtySections().length === 0 → setActive(id)
  │     └── otherwise → stash { target: id } in module atom + open dialog
  └── usePendingNav() [hook for ActiveScreen]
        ├── pending: PendingNav | null (subscribed via useSyncExternalStore)
        ├── discardAndProceed() → emitDiscardReset("all") + setActive(target) + clear pending
        └── stay() → clear pending (abort)
```

## Save Flow Sequence (D-11)

```
form.handleSubmit(values) →
  useSectionSave.save(values) →
    1. assembleToml(base, { [sectionId]: values }) → doc
    2. callDaemon("config.save", { format: "toml", config: doc, dry_run: true })  // dry_run FIRST
    3. callDaemon("config.save", { format: "toml", config: doc, dry_run: false }) // real save
    4. refetchSettingsConfig()                                                     // authoritative TOML
    5. parseToml(doc) → diffSectionsAgainstSchema(parsed) → setAllSectionRawWins(map)
    6. branch on real.requires_restart:
         non-empty → addFields(sectionId, fields) + toast([ Restart ] → restartDaemon(actions))
         empty     → toast.success("Saved.")
    7. setState("saved") → setTimeout(() => setState("idle"), 2000)

  on RpcError:
    1. mapConfigErrorsToFields(err, sectionId) → MappedErrors | null
    2. mapped?.fieldErrors → useState → consumed by <FormMessage> per field
       mapped?.sectionBannerError → useState → consumed at top of section body
    3. toast.error("Daemon rejected settings: " + mapped.firstMessage,
                   action: [Show in Logs →] → setActive("logs") + applyLogsFilter({ source: "config" }))
    4. setState("error") → setTimeout(() => setState("idle"), 2000)
```

## D-13 Discard Flow Sequence

```
User clicks Sidebar tab / presses ⌘N (with dirty Settings sections):
  1. requestActive(target, setActive) [Sidebar / AppShell]
  2. getDirtySections().length > 0 → stash pending = { target } + notify()
  3. ActiveScreen.usePendingNav() re-renders → mounts <DiscardUnsavedChangesAlertDialog open={true} />
  4. User clicks [ Discard ]:
       discardAndProceed() → emitDiscardReset("all") → window.dispatchEvent("pim:settings-discard-reset")
                          → every useSectionSave handler runs form.reset() → setSectionDirty(id, false, 0)
                          → setActive(target) → tab change lands
  5. User clicks [ Stay ]:
       stay() → clear pending → dialog closes → original tab stays active

User clicks Stop daemon (with peers AND dirty Settings sections):
  1. actions.stop() → setStopConfirm(true) [peerCount > 0]
  2. StopConfirmDialog useEffect detects stopConfirmOpen + getDirtySections().length > 0 → setDiscardOpen(true)
  3. <DiscardUnsavedChangesAlertDialog open={true} sectionName="this app session" />
  4. User clicks [ Discard ]:
       emitDiscardReset("all") → setDiscardCleared(true) → discardOpen=false
       → showStopBody becomes true → stop-confirm body opens
       → user confirms STOP DAEMON → actions.confirmStop() → daemon stops
  5. User clicks [ Stay ]:
       setDiscardOpen(false) + actions.dismissStopConfirm() → entire flow dismissed
```

## Verbatim Locked-Copy Inventory

| Surface | Copy (verbatim) |
| ------- | --------------- |
| RawWinsBanner body | `Raw is source of truth — form view shows a subset` |
| RawWinsBanner action | `[ Open Advanced ]` |
| SectionSaveFooter limited hint | `Daemon stopped — reconnect to save.` |
| SectionSaveFooter button (idle) | `[ Save ]` |
| SectionSaveFooter button (in-flight) | `[ Saving… ]` |
| SectionSaveFooter button (post-success) | `[ Saved ]` |
| DiscardDialog title | `Discard unsaved changes in {sectionName}?` |
| DiscardDialog body | `{N} field(s) in {sectionName} haven't been saved. If you leave, your edits disappear.` |
| DiscardDialog primary | `[ Discard ]` (destructive variant) |
| DiscardDialog secondary | `[ Stay ]` (autoFocus) |
| Save reject toast | `Daemon rejected settings: {first error.message}` (action: `Show in Logs →`) |
| Save reject section banner fallback | `Daemon rejected this section: {error.message}` |
| Save success (no restart) | `Saved.` |
| Save success (restart needed) | `Saved. Restart pim to apply: {requires_restart.join(", ")}` (action: `[ Restart ]`) |
| restartDaemon failure toast | `Couldn't restart pim.` |

All copy verified by acceptance grep; zero divergences.

## Files Created/Modified

### Created (13)

- `src/screens/settings.tsx` — SettingsScreen orchestrator (Plan 03-04 §Part J)
- `src/components/settings/collapsible-cli-panel.tsx` — brand-wrapped Radix Collapsible (Part A)
- `src/components/settings/section-save-footer.tsx` — shared per-section save row (Part C)
- `src/components/settings/wire-name-tooltip.tsx` — `ⓘ` daemon wire-name tooltip (Part B)
- `src/components/settings/raw-wins-banner.tsx` — verbatim CONF-07 banner (Part D)
- `src/components/settings/discard-unsaved-changes-alert-dialog.tsx` — D-13 verbatim dialog (Part H.2)
- `src/hooks/use-section-save.ts` — orchestration (Part I)
- `src/hooks/use-section-raw-wins.ts` — read-only hook + module-level writer (Part F, Blocker 3 resolution)
- `src/hooks/use-pending-restart.ts` — atom + single-handler INVARIANT (Part G, Info 3)
- `src/hooks/use-dirty-sections.ts` — module atom + emitDiscardReset fan-out (Part H.1)
- `src/hooks/use-gated-navigation.ts` — requestActive + usePendingNav for D-13 nav-away (Part H.3)
- `src/lib/config/map-errors.ts` — daemon ConfigValidationError -> form-field map (Part H)
- `src/lib/daemon-restart.ts` — shared restartDaemon util (Part H.5, Warning 3)

### Modified (4)

- `src/components/shell/active-screen.tsx` — mounts <DiscardUnsavedChangesAlertDialog />, reads usePendingNav() + getDirtySections() to drive section name + dirty field count
- `src/components/shell/app-shell.tsx` — ⌘1/⌘2/⌘3/⌘5/⌘6/⌘, route through requestActive(id, setActive) instead of direct setActive
- `src/components/shell/sidebar.tsx` — Sidebar onClick + ArrowUp/ArrowDown route through requestActive
- `src/components/brand/stop-confirm-dialog.tsx` — chained Discard gate when stopConfirmOpen AND getDirtySections().length > 0; on Discard fan-out emitDiscardReset("all") then proceed; on Stay dismiss the whole flow

## Decisions Made

See `key-decisions` in frontmatter (nine decisions). Highlights:

- **use-gated-navigation factored as its own hook + module atom.** Plan H.3 mentioned this as an optional helper; chosen here so requestActive lives in one place rather than being inlined at every nav-trigger site (Sidebar onClick + Sidebar arrow keys + AppShell five keyboard cases = six call sites).
- **Discard dialog mounted at shell scope inside ActiveScreen** (not inside SettingsScreen) — survives the SettingsScreen unmounting that follows the actual tab change.
- **stop-confirm-dialog.tsx gates via local useState** (discardOpen / discardCleared) rather than rolling into use-gated-navigation — the Stop path is conceptually distinct from tab-nav (no `pending` target) and the Stay action has different semantics.
- **SaveState type re-exported from useSectionSave** as the canonical site (acceptance grep target) AND defined locally in section-save-footer for self-describing read-only consumers — avoids a circular dep.
- **active-screen.tsx already had `<SettingsScreen />` wired** via Phase 4 commit 3ec907f. Phase 3 commit 1 just created the file the import resolves to; no additional active-screen.tsx edit was needed for the wire-up itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 4 had pre-emptively committed `<SettingsScreen />` import in active-screen.tsx**

- **Found during:** Commit 1 (settings scaffold)
- **Issue:** When I started, active-screen.tsx had a stub `<div>settings — plan 03-04 renders here</div>` placeholder. Mid-execution, Phase 4 landed commit `3ec907f feat(04-03): wire shell for ⌘3 Routing tab (D-16)` which (in addition to the routing case) pre-emptively imported `<SettingsScreen />` from `@/screens/settings` and replaced the stub with `<SettingsScreen />` — even though `src/screens/settings.tsx` didn't exist yet on disk. This left HEAD in a state where typecheck would fail until I committed Plan 03-04's settings.tsx.
- **Fix:** Created `src/screens/settings.tsx` (Plan 03-04 §Part J) in commit 1. The Phase 4 commit's import then resolves cleanly. No additional edit to active-screen.tsx was needed for the route-wire — the plan's §Part K acceptance criterion (`grep -q "<SettingsScreen" src/components/shell/active-screen.tsx`) was satisfied by Phase 4's pre-emptive commit.
- **Files modified:** none (no edit needed; Phase 4's commit already added the wire).
- **Verification:** `pnpm typecheck` passed after commit 1; the acceptance grep for `<SettingsScreen` matches.
- **Committed in:** `096f726` (commit 1 of Plan 03-04 — landing the screen file resolves Phase 4's pre-emptive import).

**2. [Rule 1 - Bug] Blocker-3 grep tripped on a comment in use-section-raw-wins.ts that documented the OLD ambiguous API verbatim**

- **Found during:** Final acceptance-grep pass (commit 3 verification)
- **Issue:** The plan's negative acceptance criterion `! grep -E "useSectionRawWins\\([^)]+\\)\\.setAll" src/hooks/` was returning 1 hit — a JSDoc comment in `src/hooks/use-section-raw-wins.ts` that read `*   useSectionRawWins(id).setAll(map)` describing what the OLD API used to look like. The actual code is correct; the literal grep can't tell comments from code.
- **Fix:** Rewrote the comment to be prose-only: "the API was previously a per-section return whose .setAll method took a whole-map write" — semantically identical, no inline code-shape pattern that the grep matches. Same pattern Plan 03-01 hit with `rounded-(md|lg|full|xl)` JSDoc references.
- **Files modified:** src/hooks/use-section-raw-wins.ts (JSDoc-only edit, no behavior change)
- **Verification:** `grep -rE "useSectionRawWins\\([^)]+\\)\\.setAll" src/hooks/ src/components/ src/screens/` returns empty.
- **Committed in:** `93cda44` (folded into commit 3 since both deal with finalizing the Blocker-1/3 verification gates within the same single-task plan)

**3. [Info] sectionName resolution in active-screen.tsx for the multi-section-dirty case**

- **Found during:** Commit 3 (D-13 wiring)
- **Issue:** D-13's body template is `{N} field(s) in {section name} haven't been saved.` — singular when one section is dirty (use that section's title) but the plan's Part H.4 also calls for `sectionName="this app session"` for the Stop-path multi-section case. The nav-away interception case (active-screen.tsx) doesn't have an obvious "section name for multi-section case" choice in the plan body.
- **Fix:** Resolved sectionName conditionally: when `dirty.length === 1`, use `SECTION_SCHEMAS[dirty[0].id].title`; otherwise use `"this app session"` (matches the Stop-path's multi-section convention). Reads naturally for both single ("Discard unsaved changes in TRANSPORT?") and multi ("Discard unsaved changes in this app session?") cases.
- **Files modified:** src/components/shell/active-screen.tsx
- **Verification:** Builds clean; the verbatim D-13 grep `Discard unsaved changes in` and `haven't been saved` continue to pass.
- **Committed in:** `93cda44` (commit 3)

---

**Total deviations:** 3 (1 Rule 3 blocking, 1 Rule 1 bug, 1 Info-level decision).

**Impact on plan:** All three are coexistence / acceptance-gate hygiene issues, not scope creep. The plan's intent — CONF-01 framing + CONF-07 (raw-is-source-of-truth) + D-13 discard flow + per-section save orchestration — is preserved end to end. Three commits as the plan specified; no broken intermediate state.

## Issues Encountered

- **Phase 4 parallel work mid-execution**: Phase 4 landed multiple commits (3ec907f, several 04-04 / 04-05 / 04-06 commits) while this plan was running. The plan's executor-warning explicitly called this out; mitigation was to pass specific filenames to every `git add` invocation (never `-A` / `.`), which kept Phase 3 commits scoped to Phase 3 files only. Some of my edits (notably to app-shell.tsx) raced with Phase 4's edits — handled by re-reading the file after Phase 4 modified it and re-applying the requestActive call-site swaps. No bundling regression occurred.
- **noUncheckedIndexedAccess: true narrowing** on `dirty[0]?.id`: TypeScript narrowed the array element to `{ id: SectionId; dirtyFieldCount: number } | undefined`. Used optional chaining + a fallback cast (`SECTION_SCHEMAS[dirty[0]?.id as SectionId]`) — runtime is bounded by the `dirty.length === 1` check that precedes the lookup, so the cast just informs TS what the runtime guard already ensures.

## User Setup Required

None — Plan 03-04 ships purely on top of dependencies that already landed in Plan 03-01 (TOML library + react-hook-form + brand-overridden primitives) and in Phase 1/2 (W1 fan-out + StopConfirmDialog). No new npm packages, no Tauri commands, no environment variables.

## Next Phase Readiness

**Plans 03-05 / 03-06 / 03-07 can now consume:**

- `<SettingsScreen />` — already mounted at ⌘6; Plan 03-05 replaces the four IDENTITY/TRANSPORT/DISCOVERY/TRUST CollapsibleCliPanel stubs by adding new section components and importing them in settings.tsx.
- `<CollapsibleCliPanel id title summary open onOpenChange children />` — every section component composes around this primitive.
- `<SectionSaveFooter dirty state onSave />` — every section's save row.
- `<WireNameTooltip wireName />` — every FormLabel renders this after the user-facing label text.
- `<RawWinsBanner />` — top of any section body when `useSectionRawWins(id).rawWins === true`.
- `useSectionSave(sectionId, form)` — orchestration; returns { state, save, fieldErrors, sectionBannerError }.
- `useSectionRawWins(sectionId)` — read-only banner gate.
- `usePendingRestart(sectionId)` — pending-restart marker for the section's collapsed summary token.

**Plan 03-06 additionally consumes:**

- `restartDaemon(actions)` from `@/lib/daemon-restart` — the raw-TOML save path's `[ Restart ]` toast action (closes the previous no-op gap per checker Warning 3).
- `<DiscardUnsavedChangesAlertDialog />` — if the raw-TOML editor needs its own discard prompt; otherwise the existing nav-away gate (active-screen.tsx) covers it via `getDirtySections()` (the raw editor would write into the dirty atom too once it's wired).
- `RawWinsBanner` anchor target `#settings-section-advanced` — Plan 03-06's Advanced section component renders the actual TOML textarea inside the CollapsibleCliPanel whose id="advanced" already produces the matching anchor id.
- `mapConfigErrorsToFields` — the raw-TOML save path can reuse this for daemon error rendering, or fall through to a textarea-gutter rendering if the plan opts for line-level error markers.

**Plan 03-07 audit checks:**

- Locked copy verbatim across all sections (raw-wins banner, daemon-stopped hint, discard-dialog body) — every string here is captured in this summary's "Verbatim Locked-Copy Inventory" section.
- W1 invariant — `grep -c "listen(" src/hooks/use-daemon-state.ts` = 2; `rpc.ts` = 0; no Tauri event imports outside use-daemon-state.ts.
- Brand-discipline — zero rounded-(md|lg|full|xl), zero literal palette colors, zero lucide-react in any of the 13 new + 4 modified files.

**No blockers introduced.**

## Self-Check: PASSED

- All 13 claimed created files present on disk (verified via test -f sweep)
- All 4 claimed modified files present + diff lands as documented
- All 3 claimed commit hashes (`096f726`, `2e9bf79`, `93cda44`) present in `git log --oneline -10`
- All 2 requirement IDs (CONF-01, CONF-07) found in `.planning/REQUIREMENTS.md`
- `pnpm typecheck` exits 0
- `pnpm build` exits 0 (599.62 kB / 170.08 kB gzipped)
- W1 grep gates pass (`use-daemon-state.ts` listen count = 2, `rpc.ts` = 0, no Tauri event imports outside `use-daemon-state.ts`)
- Brand-discipline grep gate passes (zero `rounded-(md|lg|full|xl)` / `bg-(green|red|blue|purple|amber)-[0-9]` / `text-amber-[0-9]` across all 13 new + 4 modified files)
- Bang-free policy preserved (zero `!value` patterns in the 13 new + 4 modified files)
- All 27 acceptance-grep gates from the PLAN's verify block pass (verbatim copy, hook exports, save-flow markers, gating wiring, route wire, listen count, CollapsibleCliPanel count >= 9)
- Checker Blocker 1 (D-13 dirty-state wiring): use-dirty-sections + setSectionDirty + DiscardDialog + active-screen + stop-confirm wiring all in place
- Checker Blocker 3 (raw-wins API): module-level setAllSectionRawWins + read-only hook; the negative grep `! grep useSectionRawWins(...).setAll src/hooks/` now returns 0 (after the commit-3 doctring tweak)
- Checker Warning 3 (shared restartDaemon): src/lib/daemon-restart.ts exists, exported from `restartDaemon`, called from use-section-save (and Plan 03-06 will import the same util)
- Checker Warning 5 ([Show in Logs →] action): toast.error in use-section-save has `action: { label: "Show in Logs →", onClick: () => { setActive("logs"); applyLogsFilter({ source: "config" }); } }`
- Checker Info 3 (single-handler invariant): `INVARIANT` comment block in use-pending-restart.ts documents the single-status-event-handler pattern

---
*Phase: 03-configuration-peer-management*
*Completed: 2026-04-27*
