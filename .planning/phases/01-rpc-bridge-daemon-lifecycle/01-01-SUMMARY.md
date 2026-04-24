---
phase: 01-rpc-bridge-daemon-lifecycle
plan: 01
subsystem: rpc
tags: [typescript, tauri, json-rpc, types, rpc-contract, daemon-lifecycle]

# Dependency graph
requires: []
provides:
  - Hand-maintained TS mirror of docs/RPC.md v1 (17 methods + 3 event streams + 18 error codes)
  - Typed Tauri invoke wrapper (callDaemon<M>, subscribeDaemon, startDaemon, stopDaemon, lastDaemonError)
  - 5-state DaemonState machine + DaemonSnapshot + INITIAL_SNAPSHOT + DaemonStateChange
  - Tauri command + event name constants (DaemonCommands, DaemonEvents) the Rust side must register
  - W1 single-listener contract documented in code comments
affects: [01-02, 01-03, 01-04, 02-*, 03-*, 04-*, 05-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-maintained RPC contract mirror keyed via RpcMethodMap<Method>['params' | 'result']"
    - "Const-object error codes (as const) instead of TypeScript enum — tree-shakable, literal-unioned"
    - "Compile-only type-test file (rpc-types.test.ts) enforces contract shape via @ts-expect-error"
    - "W1 single-listener design: rpc.ts owns zero Tauri subscriptions; fan-out is the hook's job"
    - "camelCase → snake_case: JS passes subscriptionId, Tauri serde maps to Rust subscription_id"

key-files:
  created:
    - src/lib/rpc-types.ts
    - src/lib/rpc-types.test.ts
    - src/lib/daemon-state.ts
  modified:
    - src/lib/rpc.ts (wholesale replacement — mock-only surface deleted)
    - src/screens/dashboard.tsx (temporary placeholder; Plan 04 rewires)
    - src/components/brand/status-indicator.tsx (PeerState import redirected to rpc-types)

key-decisions:
  - "Error codes as `as const` object instead of TS enum — avoids runtime enum allocation, plays nicer with tree-shaking, and `RpcErrorCodeValue` is a literal union that narrows in switch statements"
  - "subscribeDaemon returns only subscription_id (no payload-typed handler parameter) — delegates listener ownership to useDaemonState hook (Plan 03) to guarantee exactly one Tauri event subscription app-wide"
  - "rpc-types.ts uses snake_case field names verbatim from JSON wire format rather than camelCasing them — keeps the TS mirror 1:1 with docs/RPC.md and avoids a translation layer"
  - "Compile-only type-test file with @ts-expect-error directives instead of adding a vitest dependency — zero runtime cost, still catches structural drift on every typecheck"
  - "PeerState re-homed to rpc-types.ts (was a re-export from rpc.ts); status-indicator.tsx updated to import from the new home — keeps rpc.ts a pure invoke surface"

patterns-established:
  - "Contract spine: every RPC call goes through callDaemon<RpcMethodName>(method, params), typed by RpcMethodMap. Wrong params shape fails typecheck at call site, not at runtime."
  - "Listener dedup: subscription helpers do NOT register listeners; they only invoke Rust subscribe/unsubscribe. Hook layer owns the single global Tauri subscription."
  - "Snapshot-over-flags: DaemonSnapshot carries hello + status + error + peerCount in one value; no component reads a ad-hoc scattered field set."

requirements-completed: [RPC-05]

# Metrics
duration: 14 min
completed: 2026-04-24
---

# Phase 1 Plan 1: RPC Types + Typed Invoke Wrapper + DaemonState Machine Summary

**Hand-maintained TS mirror of docs/RPC.md v1 (17 methods + 3 event streams + 18 error codes), typed Tauri invoke wrapper (`callDaemon<M>`), and 5-state DaemonState machine — the load-bearing spine every downstream Phase 1 plan imports from.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-24T17:47:13Z
- **Completed:** 2026-04-24T18:01:20Z
- **Tasks:** 2 (both TDD — 4 code commits + 1 metadata commit)
- **Files modified:** 6

## Accomplishments

- `src/lib/rpc-types.ts` (523 lines): complete v1 mirror — JSON-RPC envelope types, 18 error codes as `as const` map, `HelloResult`, full `Status` shape (nested interface/transport/routes/stats), `PeerSummary` + `PeerDiscovered` + `PeerEvent` + 5 peer-event kinds, routing / gateway / config types, log stream, 8 `StatusEventKind` literals, and the 20-method `RpcMethodMap` that makes `callDaemon<"status">()` type-safe at the call site.
- `src/lib/rpc.ts` (wholesale replacement): typed invoke wrapper exposing `callDaemon`, `subscribeDaemon`, `unsubscribeDaemon`, `startDaemon`, `stopDaemon`, `lastDaemonError`, `DaemonEvents`, `DaemonCommands`, `DaemonSubscription`. Zero Tauri listeners registered here — W1 single-listener contract is enforced by `grep -c 'listen(' src/lib/rpc.ts == 0`.
- `src/lib/daemon-state.ts`: 5-state `DaemonState` union + `TRANSIENT_STATES` + `isTransientState` helper, `DaemonSnapshot` (6 fields: state / hello / status / baselineTimestamp / lastError / peerCount), `INITIAL_SNAPSHOT`, and `DaemonStateChange` payload type.
- `src/lib/rpc-types.test.ts` (compile-only): enforces 20-method list, `HelloResult` shape, `PeerSummary.state` closed union, `StatusEventKind` exhaustive list, specific error-code numeric values (-32001 / -32000 / -32020), `callDaemon` signature, `DaemonState` union equality, and `DaemonSnapshot` field presence — all via `@ts-expect-error` + type-level equality tricks with zero runtime.

## Task Commits

1. **Task 1 RED:** failing type test for rpc-types v1 contract — `d74ab93` (test)
2. **Task 1 GREEN:** rpc-types.ts implementation — `a2c7de3` (feat)
3. **Task 2 RED:** failing type test for callDaemon + DaemonState — `c666fac` (test)
4. **Task 2 GREEN:** rpc.ts + daemon-state.ts + blocking consumer fixes — `ab55815` (feat)

**Plan metadata commit:** added as the final step below.

## Files Created/Modified

- `src/lib/rpc-types.ts` — 523-line hand mirror of docs/RPC.md v1; single source of truth for every RPC call in the app until POWER-01 replaces it with `tauri-specta v2` codegen.
- `src/lib/rpc-types.test.ts` — Compile-only structural test; never imported by the app.
- `src/lib/rpc.ts` — Typed invoke wrapper + Tauri command/event name constants.
- `src/lib/daemon-state.ts` — 5-state machine + `DaemonSnapshot` the whole UI reads from.
- `src/screens/dashboard.tsx` — Replaced mock-driven dashboard with a minimal placeholder; Plan 04 does the full rewire.
- `src/components/brand/status-indicator.tsx` — `PeerState` import redirected from `@/lib/rpc` to `@/lib/rpc-types` (blocking fix, Rule 3).

## Tauri Command + Event Names (Plan 02 Rust contract)

Plan 02's Rust side MUST register these exact `#[tauri::command]` and `app.emit(...)` strings:

**Commands** (`DaemonCommands` in `rpc.ts`):

| Constant | String | Purpose |
|---|---|---|
| `CMD.call` | `"daemon_call"` | Generic JSON-RPC request/response; takes `{ method, params }` |
| `CMD.subscribe` | `"daemon_subscribe"` | Start forwarding one of 3 event streams; takes `{ event }`; returns subscription_id string |
| `CMD.unsubscribe` | `"daemon_unsubscribe"` | Cancel by id; takes `{ subscriptionId }` (camelCase on JS side — Tauri serde maps to Rust `subscription_id`) |
| `CMD.startDaemon` | `"daemon_start"` | Spawn sidecar; resolves when daemon reaches `running` |
| `CMD.stopDaemon` | `"daemon_stop"` | Kill sidecar; resolves when child exits |
| `CMD.getLastError` | `"daemon_last_error"` | Returns `RpcError | null` |

**Events** (`DaemonEvents` in `rpc.ts`):

| Constant | String | Payload |
|---|---|---|
| `EVT.stateChanged` | `"daemon://state-changed"` | `DaemonStateChange` (state + optional error/hello/status) |
| `EVT.rpcEvent` | `"daemon://rpc-event"` | `{ event: RpcEventName; params: unknown }` — discriminated by event name |

## W1 Note (Single-Listener Contract)

**`subscribeDaemon()` does NOT own a Tauri event subscription.** It only invokes the Rust `daemon_subscribe` command and returns the subscription_id plus an `unsubscribe` closure. The single global Tauri subscription on `DaemonEvents.rpcEvent` lives in `src/hooks/use-daemon-state.ts` (Plan 03) and fans out payloads to per-event handlers via an internal `Map<eventName, Set<handler>>`.

This is enforced by the Plan 01 acceptance check `grep -c 'listen(' src/lib/rpc.ts == 0`. Anyone onboarding later: if you see a PR that adds `import { listen } from '@tauri-apps/api/event'` to `src/lib/rpc.ts`, reject it — that line must only exist in the hook.

## Sections of docs/RPC.md NOT Yet Mirrored

None at the type level — every v1 method, event, error code, and envelope form from §2, §3, §5, §7, §8 is represented in `rpc-types.ts`.

**Out of scope for Phase 1 (reserved in docs/RPC.md §6 for v2, not typed here):**
- `rpc.capabilities` (v2 introspection)
- `auth.*` (remote RPC capability tokens)
- `peers.reputation` (future daemon feature)
- `onion.*` (future routing feature)
- `metrics.*` (Prometheus exposure)

**Open questions from docs/RPC.md §10 (untyped deliberately — deferred):**
- macOS system-daemon socket path
- TLS-over-TCP for mobile
- Log subscription back-pressure policy
- `peers.pair` vs `peers.trust` naming (current v1 mirror uses `peers.pair`)

## Decisions Made

- **`as const` error codes over TS `enum`** — enum generates a runtime IIFE and doesn't tree-shake cleanly; the `as const` map gives an identical literal union with zero runtime except the object reference.
- **`subscribeDaemon` returns only subscription_id, no handler param** — this is the W1 single-listener design. Alternative (each subscribe allocates its own Tauri listener) leaks OS-level subscriptions on every component mount/unmount cycle and was explicitly rejected in the UI-SPEC.
- **snake_case field names verbatim from the wire format** — mirrors docs/RPC.md exactly, avoids a translation layer, simplifies debugging (`console.log(status)` in the UI looks identical to the JSON line on the socket).
- **Compile-only type-test file (no vitest)** — adding vitest for contract tests costs ~8MB of deps and a runner config for what `tsc --noEmit` already enforces. The `@ts-expect-error` directive in `rpc-types.test.ts` is the actual assertion primitive.
- **Temporary placeholder for `dashboard.tsx`** — the alternative (leave `mockStatus()` in place and rewire later) violates the no-mock-data principle and betrays the honesty mandate. Plan 04 does the real rewire against `useDaemonState`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `status-indicator.tsx` import broke when `PeerState` left `rpc.ts`**
- **Found during:** Task 2 (GREEN phase — `pnpm typecheck` after rewriting rpc.ts)
- **Issue:** `src/components/brand/status-indicator.tsx` was importing `PeerState` from `@/lib/rpc`. The plan's Task 2 deletes `PeerState` from `rpc.ts` (it now lives in `rpc-types.ts`), but the plan did not explicitly address this existing consumer. Without a fix, typecheck would fail with a "no exported member 'PeerState'" error.
- **Fix:** Redirected the import to `@/lib/rpc-types`. Added a code comment explaining the provenance so future PRs don't accidentally revert it.
- **Files modified:** `src/components/brand/status-indicator.tsx`
- **Verification:** `pnpm typecheck` passes; `grep -rn "from \"@/lib/rpc\"" src/components/` returns nothing (only imports from `@/lib/rpc-types` remain).
- **Committed in:** `ab55815` (bundled with Task 2 GREEN commit since it is load-bearing for typecheck).

**2. [Rule 3 - Blocking] Comment strings in rpc.ts contained the literal `listen(` substring**
- **Found during:** Task 2 acceptance check (W1 listener-dedup: `grep -c 'listen(' src/lib/rpc.ts` must return 0)
- **Issue:** JSDoc comments explaining the W1 design used phrases like `listen(daemon://rpc-event)` and `listen(DaemonEvents.rpcEvent)` as pedagogical references to what the hook does. The raw `grep -c 'listen('` check is a substring count and doesn't skip comments.
- **Fix:** Rewrote the explanatory text to use phrases like "Tauri event subscription on DaemonEvents.rpcEvent" instead. Meaning preserved, literal `listen(` substring removed.
- **Files modified:** `src/lib/rpc.ts`
- **Verification:** `grep -c "listen(" src/lib/rpc.ts` now returns 0.
- **Committed in:** `ab55815` (same commit as Task 2 GREEN).

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking).
**Impact on plan:** Both auto-fixes were required to land Task 2 green. Neither touched the plan's design intent — the first was a missing-consumer update that the plan overlooked, the second was a grep-strictness adjustment that preserved the W1 design in spirit. No scope creep.

## Known Stubs

These are **intentional** stubs documented in the plan; they will be resolved in the listed future plan. Not regressions.

1. **`INITIAL_SNAPSHOT` (daemon-state.ts)** — all `null` / `0` values. Intentional pre-boot default, not a UI fabrication. The hook (Plan 03) replaces these values the moment the Rust side emits its first `stateChanged` event.
2. **`src/screens/dashboard.tsx` placeholder** — renders "Phase 1 plan 04 will wire the dashboard to the daemon." This is documented as the deliberate replacement for `mockStatus()`; Plan 04 (per ROADMAP.md `01-04-PLAN.md`) does the full rewire against `useDaemonState`.
3. **`src/lib/rpc.ts` function bodies are thin `return invoke(...)` wrappers** — Not stubs; they are the correct final implementation at this layer. The Rust side that services these commands does not yet exist and will be implemented in Plan 02 (`01-02-PLAN.md`). Calling any function in `rpc.ts` today will fail at runtime with "command not found" — this is expected and the UI cannot exercise these paths until Plan 02 lands, at which point the hook (Plan 03) wires everything together.

## Issues Encountered

None — both TDD cycles (Task 1 and Task 2) went RED → GREEN cleanly on the first attempt. Typecheck baseline was green before the plan started and stayed green through every commit except the two deliberate RED commits (which is the correct TDD behavior).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02.** Plan 02 (`01-02-PLAN.md`) needs:
- The 6 Tauri command names in `DaemonCommands` — Rust must register `#[tauri::command]` handlers under these exact strings.
- The 2 Tauri event names in `DaemonEvents` — Rust emits state transitions and RPC events on these channels.
- The `RpcError` / `RpcErrorCode` shape for its error translation layer.
- The `DaemonStateChange` payload shape for the `stateChanged` event.
- Awareness of the W1 single-listener contract so the Rust side sends ONE event per RPC notification (not one per subscriber) — the hook dispatches locally.

No blockers. `pnpm typecheck` is green; the Tauri command surface is fully typed; every downstream plan can `import { callDaemon } from '@/lib/rpc'` and pick a method name with full IDE autocomplete.

## Self-Check: PASSED

Verified before declaring the plan complete:

**Files created (`[ -f ]` check):**
- `src/lib/rpc-types.ts` — FOUND
- `src/lib/rpc-types.test.ts` — FOUND
- `src/lib/rpc.ts` — FOUND (wholesale replaced)
- `src/lib/daemon-state.ts` — FOUND

**Commits (git log check):**
- `d74ab93` — FOUND (Task 1 RED)
- `a2c7de3` — FOUND (Task 1 GREEN)
- `c666fac` — FOUND (Task 2 RED)
- `ab55815` — FOUND (Task 2 GREEN)

**Plan verification block re-run:**
- `pnpm typecheck` — exit 0
- `grep -rn "mockStatus" src/ src-tauri/src/` — empty (src-tauri/ is out of scope per plan §5)
- All four files exist check — `OK`
- `grep -c 'listen(' src/lib/rpc.ts` — `0` (W1-OK)

---
*Phase: 01-rpc-bridge-daemon-lifecycle*
*Completed: 2026-04-24*
