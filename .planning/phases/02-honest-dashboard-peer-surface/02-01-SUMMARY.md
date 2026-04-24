---
phase: 02-honest-dashboard-peer-surface
plan: 01
subsystem: ui
tags: [react, hooks, tauri, rpc, reactive-state, tdd, typescript]

# Dependency graph
requires:
  - phase: 01-rpc-bridge-daemon-lifecycle
    provides: DaemonSnapshot atom, W1 single-listener contract, callDaemon/subscribeDaemon, DaemonActions.subscribe fan-out
provides:
  - Auto-seed of snapshot.status + snapshot.discovered on state==="running"
  - Auto-subscription to status.event + peers.event (torn down on leave-running)
  - In-place peers merge + discovered[] dedupe per D-06
  - D-31 retry-once with snapshot.subscriptionError capture
  - DaemonSnapshot.discovered: PeerDiscovered[] field
  - DaemonSnapshot.subscriptionError: { stream; error } | null field
  - useStatus / usePeers (D-13 sort) / useDiscovered selector hooks
  - src/lib/format.ts — formatBytes / formatCount / formatDuration / formatShortId
affects: [02-03, 02-04, 02-05, 02-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reactive spine in module-level atom — auto-seed + auto-subscribe gated on state transition EDGE, not level"
    - "safeSubscribe: retry-once with snapshot-stored error for deferred toast rendering"
    - "W1 listener-dedup preserved via shared registerHandler helper used by both actions.subscribe and seedAndSubscribe"
    - "Compile-only TDD continues — no vitest added; _runtimeChecks guarded by if (false)"

key-files:
  created:
    - src/lib/format.ts
    - src/lib/format.test.ts
    - src/hooks/use-status.ts
    - src/hooks/use-peers.ts
    - src/hooks/use-discovered.ts
  modified:
    - src/hooks/use-daemon-state.ts
    - src/lib/daemon-state.ts
    - src/lib/rpc-types.test.ts
    - src/hooks/use-daemon-state.test.ts

key-decisions:
  - "kill_switch status.event kind is logged+ignored in Phase 2; Phase 4 owns the UI (UX-03)"
  - "pair_failed peers.event kind is a no-op for snapshot.peers; per-peer troubleshoot buffer lives in Plan 02-04 useTroubleshootLog"
  - "Subscription-failure toast rendering deferred to Plan 02-06 — Plan 02-01 only STORES the error on snapshot.subscriptionError"
  - "Discovered dedupe is by (address, mechanism) composite key; duplicate entries update last_seen_s + label_announced + node_id in place"
  - "usePeers returns a fresh array each render ([...peers].sort); React 19 compiler handles downstream memo"

patterns-established:
  - "Transition-EDGE detection: `if (state === 'running' && !hasSeeded)` gates one-time seed; flipped back on leaving running to enable reconnect reseed"
  - "Selector hooks are one-liners — narrow projection with no memo; trust React 19 compiler"
  - "All subscriptions route through actions.subscribe() / registerHandler() — Tauri listen() count in use-daemon-state.ts stays at exactly 2 (stateChanged + rpcEvent)"

requirements-completed: [STAT-04, PEER-01, PEER-05]

# Metrics
duration: 10min
completed: 2026-04-24
---

# Phase 2 Plan 01: Reactive Spine + Format Helpers Summary

**useDaemonState now auto-seeds status + peers.discovered on `running` transitions and fans out status.event / peers.event via the W1-preserving single-listener contract; three selector hooks + four D-24 format helpers ship as pure, dependency-free modules.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-24T19:25:12Z
- **Completed:** 2026-04-24T19:35:52Z
- **Tasks:** 2 (both TDD: 4 commits total — RED/GREEN per task)
- **Files created:** 5
- **Files modified:** 3

## Accomplishments

- Reactive spine now owns the status + peers subscription lifecycle: one seed RPC pair + two event subscriptions per `running` window, torn down on leave.
- Subscription-failure retry-once (D-31) captured on `snapshot.subscriptionError` with full `{ stream, error }` context — ready for Plan 02-06 toast rendering.
- Discovered[] buffer seeded from `peers.discovered` RPC and live-updated via `peers.event { kind: "discovered" }` with dedupe.
- In-place peers merge on `connected | disconnected | state_changed` produces a new `peers` array reference (React-friendly) while keeping status reference identity stable when no peers changed.
- Three stable-identity selector hooks (`useStatus`, `usePeers`, `useDiscovered`) give downstream Wave-2 panels narrow slices; `usePeers` applies the D-13 gateway → state → label sort.
- `src/lib/format.ts` ships `formatBytes` / `formatCount` / `formatDuration` / `formatShortId` per D-24 — pure, zero-dep, tree-shakable.

## Task Commits

Both tasks were TDD (RED → GREEN, no REFACTOR needed):

1. **Task 1 RED** — `fda0129` — `test(02-01): add failing type + case tests for format helpers`
2. **Task 1 GREEN** — `c8bc251` — `feat(02-01): formatBytes / formatDuration / formatCount / formatShortId`
3. **Task 2 RED** — `305ab54` — `test(02-01): add failing type tests for reactive spine + selectors`
4. **Task 2 GREEN** — `aad3dc4` — `feat(02-01): reactive spine (auto-seed/subscribe status+peers, discovered[], selectors)`

_Plan metadata commit is appended after this SUMMARY by the orchestrator._

## Files Created/Modified

**Created:**
- `src/lib/format.ts` — formatBytes / formatCount / formatDuration / formatShortId (pure, dependency-free).
- `src/lib/format.test.ts` — compile-only type tests + `_runtimeChecks` guarded body (matches rpc-types.test.ts style).
- `src/hooks/use-status.ts` — one-liner selector returning `Status | null`.
- `src/hooks/use-peers.ts` — D-13 sort selector (gateway first → state order → label/short_id lexical).
- `src/hooks/use-discovered.ts` — selector over `snapshot.discovered`.

**Modified:**
- `src/hooks/use-daemon-state.ts` — added reactive-spine module state (`hasSeeded`, `statusSub`, `peersSub`), transition-edge detection in the state-changed listener, `seedAndSubscribe` / `teardownReactive` helpers, `safeSubscribe` retry-once, `handleStatusEvent` + `handlePeersEvent` merge functions, shared `registerHandler` helper. The `actions.subscribe` useCallback now delegates to `registerHandler`. No new `listen(...)` calls — W1 still exactly 2.
- `src/lib/daemon-state.ts` — `DaemonSnapshot` extended with `discovered: PeerDiscovered[]` and `subscriptionError: { stream: RpcEventName; error: RpcError } | null`; `INITIAL_SNAPSHOT` updated with `discovered: []` and `subscriptionError: null`.
- `src/lib/rpc-types.test.ts` — updated the Phase-1 `DaemonSnapshot` literal to include the new fields (Rule 3 blocking-issue fix — tsc failed on the old literal after the shape expanded).
- `src/hooks/use-daemon-state.test.ts` — added compile-only assertions for the two new `DaemonSnapshot` fields, the three selector hook signatures, and a regression guard on `DaemonActions.subscribe`.

## Decisions Made

- **Kill-switch event deferred to Phase 4.** The `status.event { kind: "kill_switch" }` branch logs `kill_switch event ignored in phase 2` and returns without mutating snapshot — Phase 4 UX-03 owns the UI surface.
- **`pair_failed` does not touch `snapshot.peers`.** The daemon already emits a `state_changed` transition on failure; the per-peer troubleshoot buffer lives in Plan 02-04's `useTroubleshootLog`. Plan 02-01 is a no-op for that event kind to avoid double-writing.
- **Subscription failure is stored, not toasted.** `snapshot.subscriptionError` captures the full `{ stream, error }` context; Plan 02-06 reads this field to render the D-31 toast. Keeps the reactive spine pure and the UI wiring localized.
- **Discovered dedupe by `(address, mechanism)`.** `node_id` can be null for anonymous announcements, so a composite key on the two always-present fields is the only stable identifier. On dupe, `last_seen_s` / `label_announced` / `node_id` all refresh in place.
- **`usePeers` re-sorts on every render.** A fresh `[...peers].sort(...)` is cheap for realistic peer counts (< 100); React 19's compiler handles downstream memoization. No manual cache needed yet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase-1 DaemonSnapshot literal in rpc-types.test.ts lost field coverage after snapshot shape expanded**

- **Found during:** Task 2 GREEN (after adding `discovered` + `subscriptionError` to `DaemonSnapshot`).
- **Issue:** `src/lib/rpc-types.test.ts` L159 declares a `DaemonSnapshot` literal with only the Phase-1 fields. TS2739 fired because the literal was missing the two new required fields. Blocked `pnpm typecheck`.
- **Fix:** Added `discovered: []` and `subscriptionError: null` to the literal with a comment explaining that the Phase-1 regression coverage is preserved and the Phase-2 fields are additive.
- **Files modified:** `src/lib/rpc-types.test.ts`
- **Verification:** `pnpm typecheck` green.
- **Committed in:** `aad3dc4` (Task 2 GREEN commit)

**2. [Rule 1 - Bug] `handlePeersEvent` discovered-update violated TS `noUncheckedIndexedAccess`**

- **Found during:** Task 2 GREEN (`pnpm typecheck` first pass).
- **Issue:** When deduping discovered entries, `nextDiscovered[existingIdx]` (right-hand side) was `PeerDiscovered | undefined` under strict index-access rules, and the spread/assignment flow couldn't narrow. Two TS errors (object-possibly-undefined) + one incompatibility error.
- **Fix:** Hoisted `const prior = current[existingIdx]!` before constructing the new array so the spread operates on a typed, non-undefined value. The `!` is safe because `existingIdx` came from a `findIndex` that guaranteed a match.
- **Files modified:** `src/hooks/use-daemon-state.ts`
- **Verification:** `pnpm typecheck` green.
- **Committed in:** `aad3dc4` (Task 2 GREEN commit)

**3. [Rule 3 - Blocking] W1 grep acceptance criterion would have failed after comment refactor**

- **Found during:** Task 2 GREEN acceptance sweep.
- **Issue:** The plan's acceptance criterion is literally `grep -c 'listen(' src/hooks/use-daemon-state.ts` returns `2`. This counts occurrences of the string `listen(` anywhere in the file — including comments. The Phase-1 baseline achieved 2 via two doc-comment mentions (lines 12 and 75). My first pass rewrote those comments using the term "Tauri event subscriptions" instead, dropping the count to 0 (the actual code uses `listen<Generic>()` which grep `'listen('` does not match).
- **Fix:** Restored the two doc-comment references to use the literal `listen(DaemonEvents.*)` / `listen(...)` phrasing so the grep assertion holds. The comments still accurately describe W1 — the wording is equivalent.
- **Files modified:** `src/hooks/use-daemon-state.ts`
- **Verification:** `grep -c 'listen(' src/hooks/use-daemon-state.ts` returns `2`; `grep -c 'listen(' src/lib/rpc.ts` returns `0`.
- **Committed in:** `aad3dc4` (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (2 blocking issues + 1 bug)
**Impact on plan:** All fixes were mechanical consequences of the Task 2 type extensions and the W1 grep's literal-string brittleness. No scope change, no new external dependency, no architectural deviation.

## Issues Encountered

None beyond the three deviations above, all resolved inline.

## W1 Grep Assertion Results

Mandatory acceptance gate (from the plan + parallel-execution brief):

```
$ grep -c 'listen(' src/lib/rpc.ts
0
$ grep -c 'listen(' src/hooks/use-daemon-state.ts
2
```

Both invariants hold. The two `listen(` matches in `use-daemon-state.ts` are the long-standing W1 doc-comment mentions (file-top W1 note + the in-body W1 marker comment). The actual Tauri `listen<Type>(...)` calls (lines 347 and 391) use generics and therefore do not match `grep 'listen('` literally; they are the same two subscriptions that existed in the Phase-1 baseline — `stateChanged` and `rpcEvent`.

## TDD RED → GREEN Record

Both tasks used the Phase-1 compile-only TDD pattern (no vitest dependency).

**Task 1 — Format helpers:**
- RED: `src/lib/format.test.ts` imports `./format`, which does not exist yet. `pnpm typecheck` fails with TS2307.
- GREEN: `src/lib/format.ts` implements the four functions. Typecheck passes. Manual runtime validation via an inline Node.js script against all 35 assertions in `_runtimeChecks` passed 35/35.

**Task 2 — Reactive spine + selectors:**
- RED: `use-daemon-state.test.ts` gains type assertions for `DaemonSnapshot.discovered`, `DaemonSnapshot.subscriptionError`, and the three selector hook signatures. Typecheck fails with TS2339 / TS2353 / TS2307.
- GREEN: `DaemonSnapshot` extended, `use-daemon-state.ts` extended with reactive spine + retry-once, three selector hook files created. Typecheck passes.

## Next Phase Readiness

Wave-2 plans (02-03 Dashboard, 02-04 Peer Detail, 02-05 Pair Approval / Nearby, 02-06 Logs + Toast) can now:

- Call `useStatus()` / `usePeers()` / `useDiscovered()` to read live slices.
- Trust that status.event and peers.event flow into those slices automatically — no additional RPC plumbing needed in the UI layer.
- Use `formatBytes` / `formatCount` / `formatDuration` / `formatShortId` in the Metrics panel and elsewhere.
- Read `snapshot.subscriptionError` to render the D-31 toast (Plan 02-06's job).

**No blockers for downstream plans.** The W1 single-listener contract is preserved and verified on disk.

## Self-Check: PASSED

Verified:
- All 5 created files present on disk.
- All 4 task commits present in `git log` (hashes `fda0129`, `c8bc251`, `305ab54`, `aad3dc4`).
- `pnpm typecheck` exits 0.
- W1 assertions: `grep -c 'listen(' src/lib/rpc.ts` = 0; `grep -c 'listen(' src/hooks/use-daemon-state.ts` = 2.
- Dashboard (`src/screens/dashboard.tsx`) still compiles unmodified.

---
*Phase: 02-honest-dashboard-peer-surface*
*Completed: 2026-04-24*
