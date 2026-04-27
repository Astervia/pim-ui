---
phase: 03-configuration-peer-management
plan: 01
subsystem: infra
tags: [shadcn, react-hook-form, @iarna/toml, radix-ui, tooltip, alert-dialog, switch, radio-group, collapsible, form, settings, peers, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 02-honest-dashboard-peer-surface
    provides: Sidebar / AppShell / ActiveScreen scaffolding (D-01/D-02 reserved-slot rows + ⌘1/⌘2/⌘5 keyboard handler), useActiveScreen module-level atom, sheet/select/scroll-area/sonner primitives, peer-row component, useLogsStream + use-peers + use-discovered hooks
  - phase: 01-rpc-bridge-daemon-lifecycle
    provides: callDaemon<M> + RpcMethodMap typed RPC wrapper, ConfigGetParams/ConfigGetResult types (RPC §5.5), W1 single-listener invariant in use-daemon-state.ts, brand button.tsx + dialog.tsx + input.tsx primitives, sonner toast plumbing
provides:
  - "Six shadcn new-york UI primitives with PIM brand overrides applied verbatim per 03-UI-SPEC §Registry Safety: switch, radio-group, collapsible, alert-dialog, form, tooltip (plus transitive label.tsx)"
  - "react-hook-form ^7.74.0 and @iarna/toml ^2.2.5 added as runtime deps"
  - "TOML orchestration library under src/lib/config/ — section-schemas (nine-section registry, daemon wire names verbatim), parse-toml (typed Result wrapper over @iarna/toml.parse), assemble-toml (form values + parsed base → full TOML preserving unmapped keys), schema-diff (CONF-07 raw-is-source-of-truth detection)"
  - "useSettingsConfig hook + module-level refetchSettingsConfig() callable outside React (D-30 — Plan 03-02 peer hooks call it after peers.add_static / peers.remove success)"
  - "Sidebar flips Settings (⌘6) from grayed-reserved to active; Peers route stops aliasing Dashboard and points to a dedicated PeersScreen stub; routing + gateway remain grayed-reserved"
  - "AppShell keyboard handler extended: ⌘6 / ⌘, → settings; ⌘↑ → window CustomEvent pim:settings-collapse-all (active==='settings' guarded); ⌘↓ → pim:settings-expand-all"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07]

# Tech tracking
tech-stack:
  added:
    - react-hook-form ^7.74.0
    - "@iarna/toml ^2.2.5"
    - shadcn switch (radix-ui Switch wrapper)
    - shadcn radio-group (radix-ui RadioGroup wrapper)
    - shadcn collapsible (radix-ui Collapsible wrapper)
    - shadcn alert-dialog (radix-ui AlertDialog wrapper)
    - shadcn form (react-hook-form Controller bindings)
    - shadcn tooltip (radix-ui Tooltip wrapper)
    - shadcn label (transitive dep of form)
  patterns:
    - "Brand-override-on-install: every shadcn primitive opened post-CLI and patched inline against 03-UI-SPEC §Registry Safety table — rounded-none everywhere, bg-popover for floating surfaces, font-mono on label/title, no shadow, no lucide-react icons in user-visible chrome (concentric square indicator instead of CircleIcon for radio-group)"
    - "Module-level atom + useSyncExternalStore for client state with module-scope refetcher exposed for non-React callers (mirrors useActiveScreen / useDaemonState; refetchSettingsConfig is the new instance for cross-hook invocation)"
    - "Discriminated Result return shape on parser wrappers (parseToml → { ok: true; value } | { ok: false; error }) — no try/catch leakage at call sites, mirrors Phase 01.1 DaemonLastError discriminated union pattern"
    - "Bang-free implementation continues — useFormField rewrite swapped !!error for hasError() helper using === undefined / === null comparisons so the no-! grep rule holds in every new file"
    - "Browser CustomEvent over Tauri listen() — global keyboard shortcut handler dispatches window.dispatchEvent(new CustomEvent('pim:settings-…')) and Plan 03-04 will add window.addEventListener for these; W1 invariant preserved (no @tauri-apps/api/event listen() outside use-daemon-state.ts)"

key-files:
  created:
    - src/components/ui/switch.tsx
    - src/components/ui/radio-group.tsx
    - src/components/ui/collapsible.tsx
    - src/components/ui/alert-dialog.tsx
    - src/components/ui/form.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/label.tsx
    - src/lib/config/section-schemas.ts
    - src/lib/config/parse-toml.ts
    - src/lib/config/assemble-toml.ts
    - src/lib/config/schema-diff.ts
    - src/lib/config/section-schemas.test.ts
    - src/hooks/use-settings-config.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/components/shell/sidebar.tsx
    - src/components/shell/active-screen.tsx
    - src/components/shell/app-shell.tsx
    - src/hooks/use-active-screen.ts

key-decisions:
  - "Radio indicator is a concentric h-2 w-2 bg-primary SQUARE (not the lucide CircleIcon dot from upstream shadcn) — box-drawing aesthetic forbids circle indicators per 03-UI-SPEC §Registry Safety §radio-group override"
  - "AlertDialogAction defaults to variant='destructive' and AlertDialogCancel defaults to variant='ghost' — Phase 3's only AlertDialog uses are destructive prompts (Remove peer / Discard changes); shifting the defaults removes per-call boilerplate"
  - "AlertDialogMedia removed entirely — upstream uses non-zero radius + bg-muted, brand violation, and no Phase 3 surface uses a media slot"
  - "TooltipPrimitive.Arrow removed — box-drawing aesthetic doesn't host speech-bubble arrows (locked in 03-UI-SPEC §tooltip override)"
  - "useSettingsConfig was moved from Plan 03-04 to 03-01 per checker Blocker 2 — exposing refetchSettingsConfig() at module scope before Plan 03-02 needs it lets 03-02 peer hooks call the refetch without dragging the hook into their component tree"
  - "section-schemas test follows the rpc-types.test.ts compile-only pattern (no vitest dep added) — drift catches on tsc --noEmit run automatically; consistent with the project's existing test stance"
  - "FormField/FormControl/FormLabel kept the upstream react-hook-form scaffolding verbatim (it IS the integration); brand overrides applied only to the wrapper typography (FormItem flex/gap-2, FormLabel font-mono uppercase tracking-widest, FormDescription/Message body-grade)"
  - "⌘↑ / ⌘↓ guarded by active === 'settings' — D-06 explicitly says 'no-op on other tabs' so the shortcut doesn't leak across screens"

patterns-established:
  - "Pre-flight gate adapts to actual repo paths: Phase 2 placed peer-row.tsx under src/components/peers/ (not src/components/dashboard/ as the plan's stale path expected) and uses sonner via bare package import (no shadcn ui/sonner.tsx wrapper). The intent of the gate (every Phase-2 artifact present) is met; downstream plans can use either path verbatim"
  - "Custom-event channel for cross-component shell→screen communication: window.dispatchEvent(new CustomEvent('pim:settings-collapse-all')) keeps the keyboard handler at shell scope while letting Plan 03-04 SettingsScreen own the actual collapse-all behavior — and crucially is browser-native, NOT a Tauri event, so W1 invariant stays intact"
  - "shadcn add CLI prompts on existing-file overwrites even with --yes; piping `printf 'n\\n…' | shadcn add …` answers 'no' to every overwrite prompt and the CLI still creates the new files in one pass"

requirements-completed: [CONF-01, CONF-06, CONF-07, PEER-02, PEER-03, OBS-02, OBS-03]

# Metrics
duration: 30min
completed: 2026-04-27
---

# Phase 03 Plan 01: Configuration & Peer Management — Foundation Summary

**Six shadcn primitives + react-hook-form + @iarna/toml installed and brand-overridden, the TOML orchestration library scaffolded under src/lib/config/, useSettingsConfig hook exposed with module-level refetcher (D-30), and the shell flipped so Settings (⌘6) + Peers (⌘2) are dedicated active routes — pure infrastructure, zero user-visible screens.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-04-26T23:54:00Z
- **Completed:** 2026-04-27T00:25:00Z
- **Tasks:** 1 (single-task plan; executed as four atomic commits per the plan's commit sequence)
- **Files created:** 13
- **Files modified:** 6

## Accomplishments

- All six Phase 3 shadcn primitives shipped with brand overrides verified by grep: `rounded-(md|lg|full|xl)` count is 0 across switch / radio-group / alert-dialog / tooltip / form / collapsible
- `pnpm typecheck` exits 0; `pnpm build` exits 0 (production bundle 402.85 kB / 125.99 kB gzipped)
- W1 single-listener invariant intact: rpc.ts `listen(` count = 0; use-daemon-state.ts `listen(` count = 2; zero `from "@tauri-apps/api/event"` imports outside use-daemon-state.ts
- ⌘6 routes to Settings stub, ⌘2 routes to Peers stub (no longer aliases Dashboard), ⌘, aliases ⌘6, ⌘↑/⌘↓ dispatch settings-only window CustomEvents
- TOML library exposes the four-function API Wave-2 plans need: parseToml(string) → ParseResult, assembleToml(base, sectionValues) → string, diffSectionsAgainstSchema(parsed) → SectionRawWinsMap, SECTION_SCHEMAS registry of nine sections in fixed order
- useSettingsConfig + refetchSettingsConfig() unblocks Plan 03-02 (post-add/remove peer refetch per D-30) without forcing 03-02 to hold a hook reference

## Task Commits

1. **Install shadcn primitives + npm deps with brand overrides** — `b3df058` (chore)
   - `pnpm add react-hook-form@^7.74.0 @iarna/toml@^2.2.5`
   - `pnpm dlx shadcn add switch radio-group collapsible alert-dialog form tooltip` (label.tsx pulled transitively for FormLabel)
   - Six primitives + label.tsx all opened post-install and patched against 03-UI-SPEC §Registry Safety overrides table

2. **TOML orchestration library + useSettingsConfig hook** — `8e8aa30` (feat)
   - `src/lib/config/section-schemas.ts` — SECTION_IDS + SECTION_SCHEMAS (nine sections)
   - `src/lib/config/parse-toml.ts` — parseToml() + ParseResult discriminated union
   - `src/lib/config/assemble-toml.ts` — assembleToml() + getPath helper
   - `src/lib/config/schema-diff.ts` — diffSectionsAgainstSchema() + SectionRawWinsMap
   - `src/lib/config/section-schemas.test.ts` — compile-only contract assertions
   - `src/hooks/use-settings-config.ts` — module-level atom + useSyncExternalStore + exported refetchSettingsConfig()

3. **Shell wiring: Settings + Peers routes + ⌘↑/⌘↓** — `325beeb` (feat)
   - `src/hooks/use-active-screen.ts` — ActiveScreenId += "settings"
   - `src/components/shell/sidebar.tsx` — settings appended to NAV (⌘6 hint); routing + gateway remain RESERVED
   - `src/components/shell/active-screen.tsx` — peers + settings get explicit branches with stubs; dashboard|peers fallthrough alias removed (D-02 break)
   - `src/components/shell/app-shell.tsx` — keydown handler extended (⌘6 / ⌘, / ⌘↑ / ⌘↓); active included in effect deps
   - JSDoc cleanup in switch / radio-group / alert-dialog / tooltip — removed historical references to upstream `rounded-md` / `-lg` / `-full` tokens from doc comments so the plan's grep gate `grep -rnE '(rounded-md|rounded-lg|rounded-full|rounded-xl)' [primitives]` returns 0 (actual class strings already used `rounded-none` exclusively; comment-only edit, no behavior change)

**Plan metadata:** [appended after this summary lands] (docs: complete plan)

## Files Created/Modified

### Created (13)

- `src/components/ui/switch.tsx` — brand Switch (rounded-none root + thumb, h-5 w-9 / h-4 w-4, bg-popover/bg-primary, border-border, outline focus ring, transition-transform 100ms ease-linear)
- `src/components/ui/radio-group.tsx` — brand RadioGroup (grid gap-2, h-4 w-4 zero-radius square items, concentric h-2 w-2 bg-primary square indicator — no lucide CircleIcon)
- `src/components/ui/collapsible.tsx` — Radix passthrough (no visual chrome — CollapsibleCliPanel in Plan 03-04 owns the box-drawing header)
- `src/components/ui/alert-dialog.tsx` — brand AlertDialog (bg-popover + bg-background/80 overlay matches dialog.tsx, font-mono uppercase title, AlertDialogAction defaults variant=destructive, AlertDialogCancel defaults variant=ghost, AlertDialogMedia removed)
- `src/components/ui/form.tsx` — react-hook-form integration with brand wrapper typography (FormItem flex+gap-2, FormLabel font-mono uppercase tracking-widest, FormDescription muted body, FormMessage destructive); bang-free hasError() helper
- `src/components/ui/tooltip.tsx` — brand Tooltip (bg-popover + border-border + font-mono text-xs + arrow removed; delayDuration 200ms)
- `src/components/ui/label.tsx` — neutral plumbing for FormLabel (FormLabel sets brand typography)
- `src/lib/config/section-schemas.ts` — nine-section registry; daemon wire names verbatim per UX-PLAN §6f
- `src/lib/config/parse-toml.ts` — typed Result wrapper over @iarna/toml.parse
- `src/lib/config/assemble-toml.ts` — form-values + parsed base → full TOML; preserves unmapped keys (D-10)
- `src/lib/config/schema-diff.ts` — raw-is-source-of-truth detection (CONF-07 / D-15)
- `src/lib/config/section-schemas.test.ts` — compile-only contract assertions (rpc-types.test.ts pattern)
- `src/hooks/use-settings-config.ts` — config.get atom + refetchSettingsConfig (D-30)

### Modified (6)

- `package.json` — `+ react-hook-form ^7.74.0`, `+ @iarna/toml ^2.2.5`
- `pnpm-lock.yaml` — lockfile updated for the two new deps + their transitives
- `src/components/shell/sidebar.tsx` — settings flipped from RESERVED → NAV (⌘6 hint visible)
- `src/components/shell/active-screen.tsx` — explicit peers + settings branches; dashboard|peers alias removed
- `src/components/shell/app-shell.tsx` — keydown handler extended (⌘6 / ⌘, / ⌘↑ / ⌘↓)
- `src/hooks/use-active-screen.ts` — ActiveScreenId union += "settings"

## Decisions Made

See `key-decisions` in frontmatter (eight decisions). Highlights:

- **Concentric square radio indicator** instead of lucide CircleIcon — locked by 03-UI-SPEC §Registry Safety, matches the box-drawing aesthetic that disallows circular shapes in chrome.
- **AlertDialog default variants flipped** (Action=destructive, Cancel=ghost) — every Phase 3 use site is destructive (Remove peer / Discard unsaved changes / Stop daemon with dirty sections), so shifting the default removes prop boilerplate at every call site.
- **useSettingsConfig moved from 03-04 to 03-01** — addresses checker Blocker 2; exposing `refetchSettingsConfig()` at module scope lets Plan 03-02's peer hooks call the refetch without holding a hook reference (D-30 cross-hook contract).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ROADMAP "eight collapsible sections" typo was already fixed before this plan ran**
- **Found during:** Pre-B (ROADMAP typo fix step)
- **Issue:** The plan's Pre-B says "find line 85 of .planning/ROADMAP.md, change `eight` → `nine`". On disk the ROADMAP already reads "nine collapsible sections" (line 104) — the typo was patched in an earlier session (likely during the same checker pass that moved useSettingsConfig from 03-04 to 03-01).
- **Fix:** Skipped the no-op edit; verified the acceptance assertion `grep -q 'nine collapsible sections' .planning/ROADMAP.md` passes on the unmodified file.
- **Files modified:** none (no-op)
- **Verification:** `grep -q 'nine collapsible sections' .planning/ROADMAP.md` exits 0; the plan's stated acceptance criterion holds.
- **Committed in:** N/A (no commit landed because no edit was made — commit 1 of the plan's four-commit sequence was therefore omitted)

**2. [Rule 1 - Bug] Pre-flight gate referenced a stale path: src/components/dashboard/peer-row.tsx**
- **Found during:** Part Pre-A (Phase 2 dependency pre-flight gate)
- **Issue:** The plan's pre-flight loop checks `src/components/dashboard/peer-row.tsx` and `src/components/ui/sonner.tsx`. On disk Phase 2 actually placed peer-row at `src/components/peers/peer-row.tsx` (matches the plan's must_haves item which uses the correct path) and uses sonner via bare package import (no shadcn `ui/sonner.tsx` wrapper exists or is needed — `Toaster` is imported directly from `sonner` in `src/components/shell/app-shell.tsx`).
- **Fix:** Adjusted the pre-flight gate to check the actual paths Phase 2 ships (`src/components/peers/peer-row.tsx` for peer-row; bare `sonner` import for Toaster). The intent of the gate (every Phase-2 artifact present) is satisfied — every other listed file exists.
- **Files modified:** none (gate is a runtime check, not an edit)
- **Verification:** All adjusted paths resolve; `pnpm build` succeeds (which it would not if any consumed Phase 2 artifact were missing).
- **Committed in:** N/A (gate-only)

**3. [Rule 3 - Blocking] shadcn CLI ignored --yes for existing-file overwrite prompts**
- **Found during:** Part B (shadcn install)
- **Issue:** `pnpm dlx shadcn@latest add switch radio-group collapsible alert-dialog form tooltip --yes` paused on `The file button.tsx already exists. Would you like to overwrite? (y/N)` — `--yes` skips component-selection confirmation but does not auto-answer the per-file overwrite prompt. The CLI does not accept `--overwrite=false`; only `-o` / `--overwrite` (which would defaultto y, the wrong answer).
- **Fix:** Re-ran with `printf 'n\nn\n…\n' | pnpm dlx shadcn@latest add … --yes`. The CLI accepted `n` for the button.tsx prompt and proceeded to install the new files. Final state: 3 new files created (label.tsx, alert-dialog.tsx, form.tsx); 5 files reported as "skipped because identical" (switch.tsx, radio-group.tsx, collapsible.tsx, tooltip.tsx, button.tsx). All six expected primitives are present on disk after install.
- **Files modified:** N/A (workaround)
- **Verification:** `ls src/components/ui/{switch,radio-group,collapsible,alert-dialog,form,tooltip}.tsx` lists all six.
- **Committed in:** `b3df058` (the install commit)

**4. [Rule 1 - Bug] Plan's brand-discipline grep tripped on JSDoc references to forbidden tokens**
- **Found during:** Final verification pass
- **Issue:** The plan's acceptance grep `grep -rnE "(rounded-md|rounded-lg|rounded-full|rounded-xl)" [primitives]` was returning 7 hits, all inside JSDoc comments documenting which tokens were *removed* from the upstream shadcn output (e.g. "replaces upstream rounded-lg + bg-background"). The actual Tailwind class strings were clean (rounded-none everywhere), but a literal grep can't tell comments from code.
- **Fix:** Rewrote the JSDoc commentary in switch / radio-group / alert-dialog / tooltip to describe the brand contract using "zero radius" language instead of citing the upstream token names verbatim. Behavior unchanged; the plan's literal verification command now returns 0.
- **Files modified:** src/components/ui/switch.tsx, src/components/ui/radio-group.tsx, src/components/ui/alert-dialog.tsx, src/components/ui/tooltip.tsx (JSDoc-only edits)
- **Verification:** `grep -rnE "(rounded-md|rounded-lg|rounded-full|rounded-xl)" src/components/ui/{switch,radio-group,alert-dialog,tooltip,form,collapsible}.tsx | wc -l` → 0; `grep -c rounded-none` across the same files still returns the expected counts (switch=2, radio-group=1, alert-dialog=2, tooltip=2).
- **Committed in:** `325beeb` (folded into the wiring commit since both deal with finalizing brand-discipline gates within the same single-task plan)

---

**Total deviations:** 4 auto-fixed (3× Rule 1 bug, 1× Rule 3 blocking).
**Impact on plan:** All four are stale-plan-vs-disk-reality issues, not scope creep. The plan's intent — every artifact present, brand-clean, the four-commit narrative — is preserved end to end. The plan's stated four-commit sequence collapses to three actual commits because Pre-B was a no-op (commit 1 of the plan's four-commit narrative produced no diff).

## Issues Encountered

- `noUncheckedIndexedAccess: true` in tsconfig surfaced four TS2538 errors in assemble-toml.ts and one TS2532 in schema-diff.ts on first build attempt; fixed by inserting explicit `as string` assertions on `parts[i]` / `firstKey` / `prefix` reads (split-and-index is bounded by length checks already in place; the assertions only document for the type system what the runtime guard already ensures).
- The bang-free policy required rewriting shadcn-upstream `!!error` checks in form.tsx; introduced a small `hasError()` helper that uses `error !== undefined && error !== null`, then replaced every `!!error` / `!error` site with `hasError(error)` / `hasError(error) === false`. Behaviorally identical for the react-hook-form `error` shape but compatible with the project's no-bang grep.

## User Setup Required

None — this plan installs only published npm packages and writes only project files. No external service configuration, no environment variables, no credentials.

## Next Phase Readiness

**Wave 2 (Plans 03-02 / 03-03 / 03-04 / 03-05 / 03-06) can now import:**

- Six brand-overridden primitives via `@/components/ui/{switch,radio-group,collapsible,alert-dialog,form,tooltip}` — no further shadcn installs needed inside any Plan-3 plan
- `@/lib/config/section-schemas` — `SECTION_IDS`, `SectionId`, `SECTION_SCHEMAS`, `SectionSchema`
- `@/lib/config/parse-toml` — `parseToml`, `ParsedConfig`, `ParseResult`, `ParseError`
- `@/lib/config/assemble-toml` — `assembleToml`, `getPath`
- `@/lib/config/schema-diff` — `diffSectionsAgainstSchema`, `SectionRawWinsMap`
- `@/hooks/use-settings-config` — `useSettingsConfig`, `refetchSettingsConfig`
- `react-hook-form` — `useForm`, `Controller`, etc. (peer-imported by `form.tsx`)
- `@iarna/toml` — `TOML.parse` / `TOML.stringify` (peer-imported by `parse-toml.ts` and `assemble-toml.ts`)

**Plan-3 wave-coordination contract:**

- Plan 03-02 (Peers screen): import `refetchSettingsConfig` from `@/hooks/use-settings-config` and call it from the success branch of use-add-peer / use-remove-peer per D-30. Use `AlertDialog` (defaults already destructive) for Remove. Use `Sheet` (Phase-2 primitive) for Add. Replace the active-screen "peers" stub.
- Plan 03-03 (Logs extension): no dependencies on this plan beyond the existing Phase-2 logs surface; Plan 03-01 added no logs-specific primitives.
- Plan 03-04 (Settings scaffold): bind `window.addEventListener('pim:settings-collapse-all', …)` + `'pim:settings-expand-all'` inside `<SettingsScreen />` to consume the ⌘↑/⌘↓ events the shell dispatches. Use `useSettingsConfig()` for the parsed base + raw + sourcePath + lastModified. Use `Collapsible` + `Form` + `Switch` + `RadioGroup` + `Tooltip` to build the section components. Replace the active-screen "settings" stub.
- Plan 03-05 (Form sections IDENTITY/TRANSPORT/DISCOVERY/TRUST): consume the 03-04 hooks; reach for `SECTION_SCHEMAS[id].tomlKeys` to register form fields and for `getPath(base, key)` to seed defaultValues.
- Plan 03-06 (Routing/Gateway/Notifications/Advanced/About + raw editor): consume `assembleToml` for form-side saves and `parseToml` for raw-side parses; consume `diffSectionsAgainstSchema` after every successful save to recompute the raw-wins map.
- Plan 03-07 (Audit + checkpoint): grep the codebase against the no-zod negative assertion (`grep -r 'from "zod"' src/lib/config/` → empty) — already true on disk after this plan.

**No blockers introduced.**

## Self-Check: PASSED

- All 13 claimed created files present on disk
- All 3 claimed commit hashes present in `git log --oneline --all` (b3df058, 8e8aa30, 325beeb)
- All 7 requirement IDs (CONF-01, CONF-06, CONF-07, PEER-02, PEER-03, OBS-02, OBS-03) found in `.planning/REQUIREMENTS.md`
- `pnpm typecheck` exits 0
- `pnpm build` exits 0
- W1 grep gates pass (rpc.ts=0, use-daemon-state.ts=2, no Tauri event imports outside use-daemon-state.ts)
- Brand-discipline grep gate passes (`rounded-(md|lg|full|xl)` count = 0 across the six new primitives)
- No zod imports anywhere in the new lib/config/ files (D-08 negative assertion holds)

---
*Phase: 03-configuration-peer-management*
*Completed: 2026-04-27*
