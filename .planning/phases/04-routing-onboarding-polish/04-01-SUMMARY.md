---
phase: 04-routing-onboarding-polish
plan: 01
subsystem: foundation
tags: [docs, copy-contract, voice-audit, routing, pure-functions, tdd, security-model]

# Dependency graph
requires:
  - phase: 02-honest-dashboard-peer-surface
    provides: Status / RouteTableResult / PeerSummary wire types in src/lib/rpc-types.ts; W1 single-listener invariant; bang-free source policy
  - phase: 03-configuration-peer-management
    provides: shadcn/ui primitives brand-overridden inline (form.tsx soft-warning surfaced by audit, triaged as runtime-error string)
provides:
  - docs/COPY.md voice contract (single source of truth for §3 banned phrases / §4 soft warnings / §6 component-locked strings)
  - docs/SECURITY.md v1 minimal model (link-target authority for handshake-fail row; §3.2 anchor #32-handshake-failures)
  - src/lib/copy.ts named-const exports for every Phase 4 user-visible string
  - src/lib/copy.test.ts compile-only export pin + load-time bang guard
  - src/lib/routing.ts formatRouteLine + derivePreflight pure helpers (D-12, D-14)
  - src/lib/routing.test.ts 10 behavior assertions (A–J), all 18 sub-checks pass live
  - scripts/audit-copy.mjs voice-contract audit (D-27 / D-28)
  - package.json audit:copy npm script
affects: [04-02 KillSwitchBanner, 04-03 RouteTogglePanel + WelcomeScreen + InvitePeerSheet, 04-04 RouteScreen, 04-05 PeerRow handshake-fail variant, 04-06 voice-pass + audit gate enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Locked-string export module: every Phase 4 plan imports from src/lib/copy.ts rather than typing strings inline; audit script verifies docs/COPY.md ↔ copy.ts ↔ component round-trip"
    - "Pure-function routing helpers: formatRouteLine + derivePreflight live in src/lib/routing.ts with zero React/RPC coupling, tested via tsx-runnable assertion blocks (Phase 1/2 if(false)-guarded compile-only convention)"
    - "Voice-contract audit script: Node ESM, regex-based, sources its banned/soft lists from docs/COPY.md with hardcoded fallback; hard-fails on '!' in string literals or JSX text"

key-files:
  created:
    - docs/COPY.md
    - docs/SECURITY.md
    - src/lib/copy.ts
    - src/lib/copy.test.ts
    - src/lib/routing.ts
    - src/lib/routing.test.ts
    - scripts/audit-copy.mjs
  modified:
    - package.json

key-decisions:
  - "docs/COPY.md §3 banned-phrase list is the canonical authority; audit script reads it dynamically with hardcoded fallback so the doc stays the source of truth (D-26)"
  - "Comment in src/lib/routing.ts header was rewritten to remove a backtick-quoted exclamation that would have flagged the audit; voice-contract treats source-file docstrings the same as user-visible strings under bang-free policy"
  - "formatRouteLine returns a single string (not a structured object); D-25 left this open and the call sites in 04-02/04-03/04-04 will render it directly into a CliPanel body line — no JSX-element interpolation needed"
  - "derivePreflight always emits 3 rows (or [] when status===null); the third row 'split-default routing supported' is hardcoded ok=true because route.set_split_default is in RpcMethodMap at compile time (D-12)"
  - "src/lib/copy.test.ts uses the compile-only Phase 1/2 if(false)-guard pattern (matches format.test.ts and rpc-types.test.ts) — no vitest install in this plan; runtime checks were verified once via npx tsx and stripped before commit"
  - "Pre-existing 'should' soft-warning in src/components/ui/form.tsx:53 is a runtime-error message thrown by useFormField, not user-visible copy. Surfaced by the audit (exit 0, 1 warning); deferred to 04-06's full voice pass for triage rather than touching shadcn-generated code now"

patterns-established:
  - "Phase 4 components import from src/lib/copy.ts; never type Phase 4 strings inline"
  - "Phase 4 pure helpers live in src/lib/*.ts collocated with src/lib/*.test.ts (matches Phase 1/2)"
  - "scripts/audit-copy.mjs is the phase-end gate; Phase 4 plans must keep `pnpm audit:copy` exit 0 throughout the phase"

requirements-completed: [UX-08]

# Metrics
duration: 15min
completed: 2026-04-26
---

# Phase 04 Plan 01: Voice-contract foundation + routing pure helpers Summary

**Voice-contract authority (docs/COPY.md), v1 security model (docs/SECURITY.md), locked-string TS export (src/lib/copy.ts), pure-function routing helpers (formatRouteLine + derivePreflight), and the regex audit script (`pnpm audit:copy`) — all four task commits land bang-free with W1 invariants intact.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-04-27T01:01:54Z
- **Completed:** 2026-04-27T01:17:49Z
- **Tasks:** 4
- **Files created:** 7
- **Files modified:** 1

## Accomplishments

- docs/COPY.md is now the single voice-contract authority for Phase 4+. §3 / §4 lists are read dynamically by the audit script, so any future doc edit changes the audit behaviour without touching the script.
- docs/SECURITY.md ships the v1 minimal sections needed to back the handshake-fail link target. §3.2 heading "Handshake failures" maps to GitHub auto-anchor #32-handshake-failures, which is the URL embedded in src/lib/copy.ts SECURITY_DOCS_URL.
- src/lib/copy.ts exports every Phase 4 locked string as a top-level const. src/lib/copy.test.ts pins each export with `: string`; load-time bang-check is `if (false)`-guarded per Phase 1/2 convention. All values bang-free, all imports compile.
- src/lib/routing.ts implements formatRouteLine + derivePreflight as pure functions. 18 runtime assertions across the 10 specified test behaviors (A–J) all pass live; assertions live in src/lib/routing.test.ts under the compile-only guard.
- scripts/audit-copy.mjs runs `pnpm audit:copy` as a Node ESM scanner. Hard-fails on `!` inside string literals or JSX text and on banned phrases; soft-warns on hedge words. Verified end-to-end: clean baseline → exit 0; injected exclamation → exit 1; injected banned phrase → exit 1.

## Task Commits

Each task was committed atomically:

1. **Task 1: docs/COPY.md + docs/SECURITY.md** — `d68db15` (docs)
2. **Task 2: src/lib/copy.ts + src/lib/copy.test.ts** — `1723f36` (feat)
3. **Task 3: src/lib/routing.ts + src/lib/routing.test.ts** — `28b25ce` (feat)
4. **Task 4: scripts/audit-copy.mjs + package.json** — `a01e847` (feat)

## Files Created/Modified

- `docs/COPY.md` — Voice contract (§1 hard rules · §2 lexicon · §3 banned phrases · §4 soft warnings · §5 brand glyphs · §6 component-locked strings); audit-script source of truth for banned + soft lists.
- `docs/SECURITY.md` — v1 security model (§1 threat model · §2 transport encryption with X25519/ChaCha20-Poly1305/HKDF-SHA256 · §3 peer auth incl. §3.2 Handshake failures · §4 kill-switch behavior · §5 anti-features).
- `src/lib/copy.ts` — Named-const exports: KILL_SWITCH_HEADLINE/BODY/ACTION, ROUTE_OFF_BODY, ROUTE_TOGGLE_TURN_ON/OFF/CONFIRM/CANCEL, PREFLIGHT_*, WELCOME_*, INVITE_*, HANDSHAKE_FAIL_SUBLINE, SECURITY_DOCS_URL, ROUTE_TABLE_EMPTY, KNOWN_GATEWAYS_EMPTY, ROUTE_TABLE_REFRESH, KILL_SWITCH_TOAST.
- `src/lib/copy.test.ts` — Per-export `: string` pins for every constant; module-level `Object.entries(copy)` bang-check inside `_runtimeChecks` (gated by `if(false)` for production).
- `src/lib/routing.ts` — `formatRouteLine(status, routeTable): string | null` (D-14) + `derivePreflight(status): PreflightResult` (D-12). Three private helpers: `gatewayLabelFor`, `relayLabelFor`, plus the row builders inside `derivePreflight`.
- `src/lib/routing.test.ts` — Test cases A–J covering: gateway direct labeled, gateway via relay (label fallback), gateway labeled multi-hop, no peer record fallback, route_on=false → null, status=null → null, derivePreflight all-pass, interface-down failure, no-gateway failure, status-null empty result.
- `scripts/audit-copy.mjs` — Walks `src/**/*.{ts,tsx}` excluding `*.test.ts`. Per-line scan: skip `//`/`*`/`import` lines, strip block comments, then per-quote regex for `!` inside literal + JSX-text-region regex for `>...!...<` + banned-phrase substring + soft-warning quoted-context regex. Sources banned/soft lists from `docs/COPY.md` with hardcoded fallback.
- `package.json` — `audit:copy` script inserted between `typecheck` and `sync-brand`.

## Decisions Made

- **docs/COPY.md is the canonical source for the audit lists** — the script reads its banned + soft arrays dynamically from §3 and §4 so docs become authoritative; hardcoded arrays remain as the fallback when the doc is missing or unparseable.
- **formatRouteLine returns a single string, not a structured object** — D-15 (Discretion) allowed either; the call sites in 04-02 / 04-03 / 04-04 will render the line directly into a CliPanel body, so the simpler return type wins.
- **Comment-string exclamation found and removed** — the original src/lib/routing.ts header had ``` `!` ``` in a backtick docstring, which the audit's per-quote regex caught (correctly — a generated `.d.ts` or compile-step might preserve it). Rewrote the comment to use the prose phrase "the JS negation operator" instead. This is a Rule 2 deviation (CLAUDE.md/D-36 forbids `!` in source where the audit can see it).
- **`if (false)`-guarded test runners** — both copy.test.ts and routing.test.ts use the established Phase 1/2 pattern; tsc still type-checks the assertion bodies but production builds skip the loops. Verified routing.test.ts assertions ALL pass via a one-shot `npx tsx` run before deletion.
- **Pre-existing soft warning in shadcn/ui form.tsx:53 deferred to 04-06** — `"useFormField should be used within FormField"` is a JS Error message thrown for misuse, not user-visible copy. Triaging it now would require touching shadcn-generated code outside this plan's scope; logged for the final voice-pass plan to handle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed exclamation from src/lib/routing.ts docstring**

- **Found during:** Task 3 (routing.ts initial write)
- **Issue:** Header docstring contained a backtick-quoted ``` `!` ``` glyph illustrating the bang-free policy. The audit's per-quote-pair regex (`(["'\`])[^...]*?!.*?\1`) caught it as a string-literal exclamation, which would have failed `pnpm audit:copy` in Task 4's verify step.
- **Fix:** Rewrote the comment to spell out "the JS negation operator" instead of glyph-illustrating the rule. The bang-free policy is still documented; only the literal exclamation in the docstring is gone.
- **Files modified:** src/lib/routing.ts (header comment block only)
- **Verification:** `grep -E '\!' src/lib/routing.ts | grep -v '!==' | grep -v '!=' | wc -l` returns 0; `pnpm audit:copy` exits 0.
- **Committed in:** 28b25ce (Task 3 commit, fix folded into the same commit before staging)

**2. [Rule 3 - Blocking] Cleared stale `.git/index.lock` between Task 1 and Task 2 commits**

- **Found during:** Between Task 1 and Task 2 (post-commit reflow)
- **Issue:** A concurrent `gsd-tools commit` invocation appears to have left `.git/index.lock` claimed and triggered a `git reset HEAD~1` (visible in reflog HEAD@{2} → HEAD@{3}). The Task 1 docs commit `05edcdc` was rolled back to `70f94ff` mid-execution, leaving docs/COPY.md + docs/SECURITY.md as untracked files.
- **Fix:** Re-staged docs/COPY.md + docs/SECURITY.md from the working tree and re-committed atomically as `d68db15`. Task 2 then committed cleanly as `1723f36`. The `<parallel_execution>` block in the executor prompt asserted "running solo (no parallel siblings in this dispatch)", so the interfering process is presumed to be ambient gsd tooling rather than a sibling executor.
- **Files modified:** none beyond originally-intended Task 1 artifacts
- **Verification:** `git log --oneline -6` confirms 4 atomic Phase-4-01 commits in declared order, all four tracked in HEAD's tree.
- **Committed in:** d68db15 (Task 1 re-commit)

**3. [Rule 3 - Blocking] Tolerated environmental noise in Task 3 commit**

- **Found during:** Task 3 commit
- **Issue:** Pre-staged files (.planning/STATE.md, .planning/ROADMAP.md, 03-03-SUMMARY.md) were already in the index when `git add src/lib/routing.ts src/lib/routing.test.ts` ran, so the Task 3 commit `28b25ce` mixed those into its tree alongside the routing helpers. This is the same ambient-tooling pattern noted in deviation 2.
- **Fix:** Left the commit as-is — the routing helpers ARE atomically in `28b25ce`, the dominant change is the routing files (491 of 777 insertions), and reverting/splitting would have required destructive history rewriting prohibited by CLAUDE.md.
- **Files modified:** none beyond the dominant change
- **Verification:** `git show 28b25ce --stat` confirms src/lib/routing.ts + src/lib/routing.test.ts are present and complete in the commit tree.
- **Committed in:** 28b25ce (Task 3 commit, dominant)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 bug, 2 Rule 3 environmental)
**Impact on plan:** Bug fix was necessary to keep `pnpm audit:copy` clean. Two environmental deviations did not affect plan correctness — every Task 1–4 acceptance criterion is satisfied in the final tree.

## Issues Encountered

- **Concurrent git activity (resets + auto-commits) during execution.** Visible in `git reflog`: between Task 1 commit and Task 2 commit, an external process performed a `reset HEAD~1` and committed `e0c0314 feat(03-03): debug snapshot export (OBS-03)`. Task 3 commit picked up pre-staged STATE/ROADMAP edits as collateral. None of this affected the correctness of the Phase 4 Plan 01 deliverables — the working tree still contained the on-disk files, re-staging them produced clean commits. The pattern suggests gsd tooling running outside this executor; the prompt's `<parallel_execution>` block stated solo mode, so I logged this as ambient noise rather than treating it as a critical bug.

## User Setup Required

None — no external service configuration required. Phase 4 Plan 01 ships only documentation and pure-function source. The audit script runs locally via `pnpm audit:copy`.

## Next Phase Readiness

- **04-02, 04-03, 04-04, 04-05** can now safely import from `src/lib/copy.ts` (every Phase 4 user-visible string available as a named const) and `src/lib/routing.ts` (`formatRouteLine` for runtime-line rendering, `derivePreflight` for the route-toggle pre-flight checklist).
- **04-06 voice-pass plan** has the audit gate (`pnpm audit:copy` exit 0) ready to enforce on a Phase-4-complete tree.
- **Pre-existing soft warning** in shadcn/ui `form.tsx:53` (`'should' in error message`) is logged as a known soft warning — not blocking — for 04-06 triage.
- W1 invariants intact: `grep -c 'listen(' src/lib/rpc.ts === 0`; `grep -c 'listen(' src/hooks/use-daemon-state.ts === 2`.
- `pnpm typecheck` exits 0; `pnpm audit:copy` exits 0.

## Self-Check: PASSED

All 8 declared output files present on disk; all 4 task commits present in `git log --oneline --all`.

- FOUND: docs/COPY.md
- FOUND: docs/SECURITY.md
- FOUND: src/lib/copy.ts
- FOUND: src/lib/copy.test.ts
- FOUND: src/lib/routing.ts
- FOUND: src/lib/routing.test.ts
- FOUND: scripts/audit-copy.mjs
- FOUND: .planning/phases/04-routing-onboarding-polish/04-01-SUMMARY.md
- FOUND: d68db15 (Task 1)
- FOUND: 1723f36 (Task 2)
- FOUND: 28b25ce (Task 3)
- FOUND: a01e847 (Task 4)

---
*Phase: 04-routing-onboarding-polish*
*Plan: 04-01*
*Completed: 2026-04-26*
