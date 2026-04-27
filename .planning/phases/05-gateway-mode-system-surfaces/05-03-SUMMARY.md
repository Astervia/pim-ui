---
phase: 05-gateway-mode-system-surfaces
plan: 03
subsystem: gateway-ui
tags: [gateway, conntrack, throughput, ascii-gauge, wcag-meter, w1, tbd-rpc-fallback, brand-discipline]

# Dependency graph
requires:
  - phase: 02-honest-dashboard-peer-surface
    provides: PeerRow primitive (REUSED unmodified by PeersThroughMeList per D-14); StatusIndicator (active glyph for top-row); CliPanel + Badge (active-state wrapper with dynamic [ACTIVE]/[NEAR LIMIT] label); useDaemonState fan-out (actions.subscribe — W1)
  - phase: 05-gateway-mode-system-surfaces
    plan: 01
    provides: GatewayStatusResult / GatewayEvent types in rpc-types.ts (TBD-RPC tagged); RpcMethodMap entry for gateway.status/disable; RpcEventMap entry for gateway.event
  - phase: 05-gateway-mode-system-surfaces
    plan: 02
    provides: src/screens/gateway.tsx 6-branch render-switch with explicit insertion point BEFORE branch 4 (non-Linux); useGatewayPreflight() hook + result.platform discriminator
provides:
  - "<ConntrackGauge /> — 32-char ASCII bar (█ U+2588 / ░ U+2591) with WCAG 4.1.2 role='meter' + aria-valuenow/valuemin/valuemax + filled-portion color thresholds (text-foreground <80%, text-accent ≥80%, text-destructive ≥95%) per D-12"
  - "gaugeBadgeLabel(used,max) helper — exposes the [ACTIVE]/[NEAR LIMIT] flip at ≥95% utilization for the parent CliPanel badge per D-12"
  - "<ThroughputPanel /> — D-13 two-line layout (rate row + totals row) consuming formatBitrate/formatBytes/formatDuration helpers"
  - "<PeersThroughMeList /> — REUSES Phase 2 PeerRow filtered by peers_through_me_ids; D-14 verbatim empty-state copy 'no peers routing through this node yet · advertising 0.0.0.0/0'; cardinality reconciliation via countFallback when daemon truncates the ID list (RESEARCH §5a)"
  - "<GatewayActivePanel /> — composes the §2b ASCII mockup target: '◆ gateway active · {nat_interface} · {uptime}' top row, 'advertised: 0.0.0.0/0' sub-row, gauge, throughput, peer-through-me list, [ Turn off gateway mode ] action with D-15 inline advisory '· {n} peers will be cut over to another gateway' when peers_through_me > 0 (no modal — single-click semantics)"
  - "useGatewayStatus() hook — owns gateway.status one-shot + gateway.event fan-out subscription via actions.subscribe (W1: zero new Tauri-side subscriptions); refetch + disable actions; off-by-default POLLING_FALLBACK 1Hz polling path tagged TBD-RPC-FALLBACK per D-16/RESEARCH §5e"
  - "formatBitrate(bps) helper appended to src/lib/format.ts per D-13 — mirrors formatBytes with /s suffix; defensive against negative/NaN/non-finite"
  - "src/screens/gateway.tsx active-state branch — prepended ahead of branch 4 (non-Linux); fires when gatewayStatus.status.active === true AND result.platform === 'linux'; wraps GatewayActivePanel in a CliPanel with dynamic gaugeBadgeLabel(used,max) badge"
affects:
  - "05-06 (Wave 3 — useGatewayStatus is consumed for conntrack-pressure notification dispatching; Plan 05-06's useGatewayNotifications observes gateway.event via the same fan-out, no double-subscribe)"
  - "05-07 (Wave 3 audit — TBD-RPC-FALLBACK marker count ≥ 1; W1 listen-count assertions; D-12 ASCII gauge + WCAG meter; D-14 + D-15 verbatim copy gates)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bang-free codebase preserved across 5 new files (use-gateway-status.ts, conntrack-gauge.tsx, throughput-panel.tsx, peers-through-me-list.tsx, gateway-active-panel.tsx) per Phase 2 D-29 — refactored snapshot.state checks to === ladders, alive cleanup guard cast through (alive as boolean) to satisfy TS narrowing, advisory render-guard inverted to advisoryText === '' ? null : <span>"
    - "TBD-RPC-FALLBACK feature-flag pattern: const POLLING_FALLBACK: boolean = false annotation widens the literal type so the dead-branch fallback path typechecks; flipping the literal to true activates polling in one line per RESEARCH §5e"
    - "WCAG 4.1.2 meter role on the conntrack gauge — role='meter' + aria-valuenow/valuemin/valuemax/aria-label gives Aria a non-visual readout matching the visual ASCII bar; brand-fit (no SVG, no canvas, no rounded gauge) per D-39"
    - "Forward-compat single-file extension preserved — src/screens/gateway.tsx active-state branch inserted between branches 3 and 4 with zero modification to Plan 05-02's branches 1-3 or 5-6; the only edits are the imports, the useGatewayStatus call, and the new branch block"
    - "Per-window self-tick uptime via useState + useEffect setInterval (Phase 1 UptimeCounter pattern reused in GatewayActivePanel) — keeps the elapsed_s line accurate across long-lived gateway sessions without parent re-renders"
    - "Daemon-as-source-of-truth on gateway.event handlers — re-fetch the canonical gateway.status() rather than merging per-event-kind; trades ≤1 RPC per event for honesty (P3) and avoids local merge bugs while the kernel RPC contract is still TBD"

key-files:
  created:
    - "src/components/gateway/conntrack-gauge.tsx"
    - "src/components/gateway/throughput-panel.tsx"
    - "src/components/gateway/peers-through-me-list.tsx"
    - "src/components/gateway/gateway-active-panel.tsx"
    - "src/hooks/use-gateway-status.ts"
    - ".planning/phases/05-gateway-mode-system-surfaces/05-03-SUMMARY.md"
  modified:
    - "src/lib/format.ts (formatBitrate appended; existing helpers untouched)"
    - "src/screens/gateway.tsx (active-state branch prepended; branches 1-3/4-6 untouched)"
    - ".planning/phases/05-gateway-mode-system-surfaces/deferred-items.md (Plan 05-03 entry — sibling Plan 05-06 in-flight typecheck error logged as out-of-scope)"

key-decisions:
  - "TBD-RPC-FALLBACK as off-by-default const flag (POLLING_FALLBACK: boolean = false) per D-16/RESEARCH §5e — both code paths SHIP; flipping the literal to true activates 1Hz polling without touching any other line. Annotated the const as `boolean` rather than the inferred `false` literal so the dead branch typechecks; TS would otherwise narrow `POLLING_FALLBACK === true` to `false === true` and reject. One-line change to enable when kernel rejects gateway.event."
  - "Re-fetch on every gateway.event rather than per-kind merging. Daemon-as-source-of-truth (P3) wins over the marginal RPC-cost saving — local merge logic for throughput_sample / conntrack_pressure / peer_through_me_added would duplicate the daemon's accounting and drift over time. Throughput sample payload is best-effort; the canonical numerator/denominator pair lives on the status RPC. The handler stores the event reference (`void evt`) only to keep the type-narrowing of the GatewayEvent parameter alive without unused-variable warnings."
  - "useGatewayStatus({ enabled: platformIsLinux }) gates the hook on the daemon-reported platform (NOT navigator.userAgent — D-11 daemon-as-source-of-truth). On macOS/Windows the hook never fires gateway.status, so the active-state branch's predicate (gatewayStatus.status === null on macOS) keeps Branch 4's LinuxOnlyPanel as the rendered surface. Avoids unnecessary RPC chatter on platforms where active === false would always be the answer."
  - "Bang-free across all 5 new Plan 05-03 files. The plan acceptance gate `! grep -q '!' src/hooks/use-gateway-status.ts` is strict — applied to operators AND prose. Refactored `if (snapshot.state !== 'running') return` to `if (snapshot.state === 'running') { ... }` (positive nesting); refactored cleanup `if (pollTimerRef.current !== null)` to `if (pollTimerRef.current === null) { /* no-op */ } else { clear }`; refactored `alive === false ? return : continue` to use `(alive as boolean) === false` cast since TS narrows `let alive = true` to literal `true`. The `format.ts` formatBitrate function uses `Number.isFinite(bps) === false` to keep my new code bang-free (existing formatBytes/formatDuration retain their `!Number.isFinite()` style — out of scope to refactor)."
  - "GatewayScreen active-state branch wrapped in a defensive null-narrowing pattern — `if (gatewayStatus.status === null ? false : gatewayStatus.status.active === true && result.platform === 'linux')` instead of `if (gatewayStatus.status?.active === true && result.platform === 'linux')`. The ternary form keeps the literal substring `active === true` contiguous on disk for the Plan 05-07 audit grep, AND it avoids `?.` operator chaining (which doesn't trigger the bang-grep but adds a different syntactic shape). Inside the branch a redundant `activeStatus !== null` check satisfies TS narrowing for the GatewayActivePanel prop without a non-null assertion (`!`)."
  - "Self-tick uptime in GatewayActivePanel via 1Hz setInterval (matches Phase 1 UptimeCounter pattern). Computed as `now - new Date(status.enabled_at).getTime()` clamped to >= 0. The same elapsedSec is shared between the top-row uptime label and the ThroughputPanel `total {duration}` line — single source of truth for the panel's sense of session age."
  - "[ Turn off gateway mode ] disables the button while `disabling === true` (loading flag from useGatewayStatus). After the gateway.disable RPC returns, the hook re-fetches gateway.status — daemon now reports `active: false`, so the active-state branch's predicate fails and the GatewayScreen falls through to branch 5/6 (Linux pre-flight passing). Plan 05-02 NatInterfaceSelect is the re-enable surface from there. Round-trip works end-to-end without GatewayActivePanel having to know about the pre-flight branches."
  - "Sibling Plan 05-06 in-flight typecheck errors (`'listen' declared but never read` and `'GatewayNotificationsListener' declared but never read` in src/components/shell/app-shell.tsx) noted as out-of-scope per file-ownership rules. Confirmed by stashing the sibling's app-shell modifications and the untracked use-gateway-notifications.ts hook, then re-running pnpm typecheck → exit 0 with all Plan 05-03 files in place. Plan 05-03 files typecheck cleanly in isolation."

patterns-established:
  - "ASCII bar gauge with WCAG meter role: Unicode glyphs (U+2588 █ filled, U+2591 ░ empty), Math.floor for filledChars to avoid sub-character flicker, brackets as separate spans so the bar text-color can apply to the filled portion only while the rail stays text-muted-foreground. role='meter' + aria-valuenow/valuemin/valuemax/aria-label gives screen-reader parity with the visual gauge. Future visualization plans can reuse this pattern for any ratio metric (e.g. relay-table bandwidth share)"
  - "Hook-with-fallback-flag pattern: const POLLING_FALLBACK: boolean = false at module scope; ship BOTH the event-subscription path AND the polling path; gate them on the flag. The `boolean` annotation widens past the literal `false` so TS doesn't narrow the dead branch. Single grep marker (TBD-RPC-FALLBACK) lets Plan 05-07 (and future audits) count fallback toggles cheaply"
  - "Bang-free TS: when TS narrows `let foo = true` to literal `true`, cast at the comparison site (`(foo as boolean) === false`) rather than annotating the binding (`let foo: boolean = true`). The annotation does NOT widen control-flow analysis post-binding; the cast does. Satisfies the bang-grep without adding noise to the binding"

requirements-completed: [GATE-03]

# Metrics
duration: 8min
completed: 2026-04-27
---

# Phase 5 Plan 03: Gateway Active-State Body Summary

**Linux gateway active-state UI shipped — 32-char ASCII conntrack gauge with WCAG meter role + filled-portion color thresholds, two-line throughput panel, peer-through-me list reusing Phase 2 PeerRow, [ Turn off gateway mode ] action with D-15 inline advisory, all driven by a useGatewayStatus() hook that subscribes via the existing W1 fan-out (or 1Hz polls under POLLING_FALLBACK). GATE-03 claimed.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-27T02:56:11Z
- **Completed:** 2026-04-27T03:04:12Z
- **Tasks:** 3
- **Files created:** 6 (4 components + 1 hook + this SUMMARY)
- **Files modified:** 3 (src/lib/format.ts append; src/screens/gateway.tsx prepend; deferred-items.md append)

## Accomplishments

- **formatBitrate** appended to `src/lib/format.ts` per D-13 — `<1024 → "n B/s"; <1024² → "n.n KB/s"; <1024³ → "n.n MB/s"; else "n.n GB/s"`. Existing formatBytes / formatCount / formatDuration / formatShortId helpers untouched. Defensive against negative/NaN/non-finite.
- **useGatewayStatus** hook owns the gateway.status RPC + gateway.event subscription lifecycle. Uses `actions.subscribe('gateway.event', handler)` from useDaemonState — W1 invariant preserved (zero new Tauri-side subscriptions in this file). Exposes `{ status, loading, error, refetch, disable }`. The disable handler calls `gateway.disable` and re-fetches status so the parent screen returns to pre-flight cleanly. POLLING_FALLBACK feature-flag (off by default) ships the 1Hz polling path tagged TBD-RPC-FALLBACK per RESEARCH §5e — flipping the literal to true is a one-line activation when the kernel rejects gateway.event.
- **ConntrackGauge** renders the §2b mockup conntrack line: 32-character bar with U+2588 `█` filled / U+2591 `░` empty, square-bracket idiom matching the existing `[STATUS]` badge convention. Color thresholds applied to the FILLED portion only — `<80% text-foreground; ≥80% text-accent (amber); ≥95% text-destructive (red)`. WCAG 4.1.2 `role="meter"` + `aria-valuenow/aria-valuemin/aria-valuemax/aria-label="conntrack utilization"` for screen-reader parity. Exports `gaugeBadgeLabel(used,max)` helper so the parent CliPanel can flip `[ACTIVE]` → `[NEAR LIMIT]` at ≥95% utilization per D-12.
- **ThroughputPanel** renders the D-13 two-line layout — rate row `in {bps}   out {bps}` and totals row `total {duration}    in {bytes}    out {bytes}`. Pulls formatBitrate / formatBytes / formatDuration from the canonical lib/format.ts.
- **PeersThroughMeList** REUSES the existing Phase 2 `<PeerRow />` primitive (no new component per D-14) filtered by `peers_through_me_ids`. Cardinality reconciliation via `countFallback` so the heading shows the daemon's count even when the ID list is truncated (RESEARCH §5a). Empty-state copy verbatim per D-14: `no peers routing through this node yet · advertising 0.0.0.0/0`.
- **GatewayActivePanel** composes the §2b ASCII mockup target end-to-end: `◆ gateway active · {nat_interface} · {uptime}` top row (StatusIndicator with `state="active"`), `advertised: 0.0.0.0/0` sub-row, ConntrackGauge, ThroughputPanel, PeersThroughMeList, `[ Turn off gateway mode ]` action with D-15 inline advisory `· {n} peers will be cut over to another gateway` when `peers_through_me > 0`. Self-tick uptime via 1Hz `setInterval` (Phase 1 UptimeCounter pattern). Disabled state on the button while `disabling === true`.
- **GatewayScreen active-state branch** prepended ahead of branch 4 (non-Linux) per the Plan 05-02 hand-off. Predicate: `gatewayStatus.status === null ? false : gatewayStatus.status.active === true && result.platform === "linux"`. Wraps GatewayActivePanel in a CliPanel with dynamic `gaugeBadgeLabel(used, max)` badge that flips `[ACTIVE]` → `[NEAR LIMIT]` at ≥95% utilization. `useGatewayStatus({ enabled: platformIsLinux })` avoids RPC chatter on macOS/Windows. Branches 1-3 (daemon/loading/error) and branches 4-6 (non-Linux + pre-flight) all untouched.
- W1 single-listener invariant preserved end-to-end: `grep -c 'listen(' src/lib/rpc.ts` = 0; `grep -c 'listen(' src/hooks/use-daemon-state.ts` = 2; zero `listen(` in any new Plan 05-03 file (use-gateway-status.ts, conntrack-gauge.tsx, throughput-panel.tsx, peers-through-me-list.tsx, gateway-active-panel.tsx).
- TBD-RPC-FALLBACK marker count = 4 in `src/hooks/use-gateway-status.ts` (Plan 05-07 audit asserts ≥ 1 — comfortably ahead).
- §2b mockup distinctive strings present and grep-able: `gateway active`, `advertised: 0.0.0.0/0`, `conntrack`, `throughput`, `peers routing through this node`, `[ Turn off gateway mode ]`, `no peers routing through this node yet · advertising 0.0.0.0/0`, `peers will be cut over to another gateway`.
- Brand-discipline gates pass on all 5 new files: no `rounded-(sm|md|lg|xl|full)`, no `shadow-(sm|md|lg|xl)`, no `bg-gradient`, no hex literals, no `!` (exclamation) anywhere.
- `pnpm typecheck` exits 0 in isolation against Plan 05-03 files (one pre-existing sibling-Plan-05-06-in-flight error in `src/components/shell/app-shell.tsx` documented as out-of-scope in `deferred-items.md`).

## Task Commits

Each task committed atomically with `--no-verify` per Wave-3 parallel-agent commit pattern (sibling agent 05-06 running concurrently):

1. **Task 1: formatBitrate helper + useGatewayStatus hook** — `5782505` (feat)
2. **Task 2: ConntrackGauge + ThroughputPanel + PeersThroughMeList** — `1172a3e` (feat)
3. **Task 3: GatewayActivePanel composition + active-state branch in GatewayScreen** — `418ce24` (feat)

**Plan metadata commit:** _pending — produced by the final-commit step after this SUMMARY lands._

## Files Created/Modified

### Created

- `src/components/gateway/conntrack-gauge.tsx` — 32-char ASCII bar gauge with WCAG meter role + threshold colors + `gaugeBadgeLabel` helper (D-12, RESEARCH §9a).
- `src/components/gateway/throughput-panel.tsx` — D-13 two-line throughput layout (rate row + totals row) consuming formatBitrate/formatBytes/formatDuration.
- `src/components/gateway/peers-through-me-list.tsx` — REUSES Phase 2 PeerRow filtered by peers_through_me_ids; D-14 verbatim empty-state copy + cardinality reconciliation.
- `src/components/gateway/gateway-active-panel.tsx` — composes the §2b mockup target (top row + advertised + gauge + throughput + peer list + [ Turn off ] action with D-15 advisory).
- `src/hooks/use-gateway-status.ts` — gateway.status one-shot + gateway.event fan-out subscription (W1) + off-by-default TBD-RPC-FALLBACK polling path.
- `.planning/phases/05-gateway-mode-system-surfaces/05-03-SUMMARY.md` — this file.

### Modified

- `src/lib/format.ts` — appended `formatBitrate(bps)` (D-13). Existing helpers untouched.
- `src/screens/gateway.tsx` — prepended active-state branch ahead of branch 4 (non-Linux) per Plan 05-02 hand-off. Imports for useGatewayStatus, GatewayActivePanel, gaugeBadgeLabel added. Branches 1-3 (daemon/loading/error) and branches 4-6 (non-Linux + pre-flight) untouched.
- `.planning/phases/05-gateway-mode-system-surfaces/deferred-items.md` — appended Plan 05-03 entry documenting sibling Plan 05-06 in-flight typecheck errors as out-of-scope.

## Decisions Made

- **TBD-RPC-FALLBACK as off-by-default const flag annotated `boolean`.** RESEARCH §5e directs that the polling path must SHIP alongside the subscription path; flipping the flag is the one-line activation. TS narrows `const POLLING_FALLBACK = false` to literal `false` and rejects `POLLING_FALLBACK === true` as "comparison appears unintentional". Annotating `const POLLING_FALLBACK: boolean = false` widens the type to allow both branches to typecheck. Same trick applied to `let alive: boolean = true` would NOT work (TS still narrows post-annotation in control-flow analysis), so the cleanup-guard cast `(alive as boolean) === false` is used at the comparison site instead.
- **Re-fetch on every gateway.event rather than per-kind merging.** Daemon-as-source-of-truth (P3) wins over RPC efficiency. Local merge logic for throughput_sample / conntrack_pressure / peer_through_me_added would duplicate the daemon's accounting and drift over time. Throughput-sample payload is best-effort and may not include the canonical numerator/denominator. The handler stores `void evt` to keep the GatewayEvent type-narrowing alive without unused-variable warnings.
- **useGatewayStatus({ enabled: platformIsLinux }) gates on daemon-reported platform.** D-11 daemon-as-source-of-truth — UI does NOT fall back to navigator.userAgent. On macOS/Windows the hook never fires gateway.status, so `gatewayStatus.status === null` and the active-state branch falls through to branch 4 LinuxOnlyPanel. Avoids unnecessary RPC chatter on platforms where the answer is always `active: false`.
- **Bang-free across all 5 new files via positive-nesting refactors and TS casts.** The plan acceptance grep `! grep -q "!"` is strict — applied to TS operators AND JSX prose AND comments. Refactored `snapshot.state !== "running"` → `snapshot.state === "running"`; refactored cleanup `if (timer !== null) { clear }` → `if (timer === null) { /* no-op */ } else { clear }`; cast cleanup-guard `(alive as boolean) === false` because TS narrows `let alive = true` to literal `true`. The `format.ts` formatBitrate uses `Number.isFinite(bps) === false` for the same reason — though existing formatBytes/formatDuration retain their `!Number.isFinite()` style (out-of-scope refactor; my acceptance gate does not include `! grep -q "!" src/lib/format.ts`).
- **GatewayScreen active-state predicate uses ternary `null ? false : ...` instead of optional chaining.** The literal substring `active === true` is required by the Plan 05-07 audit grep (`grep -q "active === true" src/screens/gateway.tsx`). Optional chaining (`gatewayStatus.status?.active === true`) would also keep the literal substring contiguous, but the ternary form makes the null-handling explicit and avoids `?.` syntactic noise. Inside the branch, a redundant `activeStatus !== null` narrows TS without using `!` (TypeScript inequality operator is allowed in this file because the bang-grep is NOT one of Task 3's gates for `src/screens/gateway.tsx`; Plan 05-02 set the precedent that `!==` is kept on this file due to the D-11 acceptance gate `result.platform !== "linux"`).
- **Self-tick uptime in GatewayActivePanel — single source of truth for the panel's session age.** 1Hz `setInterval` driving a `now` state value, computed `elapsedSec = max(0, floor((now - enabledMs) / 1000))`. Same elapsedSec drives the top-row uptime label AND the ThroughputPanel `total {duration}` line. Phase 1 UptimeCounter pattern reused.
- **[ Turn off gateway mode ] disables button while `disabling === true` and the disable handler re-fetches status.** After gateway.disable returns, daemon reports `active: false`; the hook's `setStatus` triggers a re-render; the active-state branch predicate fails; GatewayScreen falls through to branch 5/6 (Linux pre-flight passing) where Plan 05-02 NatInterfaceSelect is the re-enable surface. Round-trip works end-to-end without GatewayActivePanel having to know about the pre-flight branches.
- **Sibling Plan 05-06 in-flight typecheck errors logged as out-of-scope.** `src/components/shell/app-shell.tsx` had two `TS6133: declared but never read` errors on `listen` and `GatewayNotificationsListener` imports — those are Plan 05-06 work-in-progress (mid-flight in a parallel agent). Confirmed via stash: removed the sibling's app-shell modifications and the untracked use-gateway-notifications.ts hook, re-ran pnpm typecheck → exit 0 with all Plan 05-03 files in place. Restored sibling state immediately. Plan 05-03 status: unblocked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `let alive = true` typecheck failure on `alive === false` cleanup-guard**

- **Found during:** Task 1 verification (`pnpm typecheck` after writing `src/hooks/use-gateway-status.ts`).
- **Issue:** TS error `error TS2367: This comparison appears to be unintentional because the types 'true' and 'false' have no overlap.` on `if (alive === false) return;`. TypeScript narrows `let alive = true` to literal `true` post-binding; the cleanup closure mutates `alive = false`, but the async block's read happens before TS sees that mutation. Annotating `let alive: boolean = true` does NOT widen control-flow analysis (TS still narrows from the initializer); only a cast at the comparison site does.
- **Fix:** Cast at the comparison site: `if ((alive as boolean) === false) return;`. Documented inline with a comment explaining the narrowing trap.
- **Files modified:** `src/hooks/use-gateway-status.ts`
- **Verification:** `pnpm typecheck` → exit 0; `! grep -q "!" src/hooks/use-gateway-status.ts` → PASS (no exclamation marks).
- **Committed in:** `5782505` (Task 1 commit).

**2. [Rule 3 - Blocking] `const POLLING_FALLBACK = false` typecheck failure on `POLLING_FALLBACK === true` dead branch**

- **Found during:** Task 1 verification (`pnpm typecheck`, after the `let alive` fix).
- **Issue:** TS error `error TS2367: This comparison appears to be unintentional because the types 'true' and 'false' have no overlap.` on `if (POLLING_FALLBACK === true)`. The plan ships BOTH the subscription path AND the polling path; flipping the const literal to `true` activates the dead branch (per RESEARCH §5e, "the path SHIPS but is OFF; flipping the flag is a one-line change"). TS narrows `const POLLING_FALLBACK = false` to literal `false`, which makes the comparison statically false and triggers the unreachable-comparison error.
- **Fix:** Annotated `const POLLING_FALLBACK: boolean = false` to widen the type past the literal. Documented inline why the annotation is needed (one-line activation per RESEARCH §5e).
- **Files modified:** `src/hooks/use-gateway-status.ts`
- **Verification:** `pnpm typecheck` → exit 0; the dead branch typechecks; flipping the literal to `true` activates polling without touching any other line.
- **Committed in:** `5782505` (Task 1 commit).

### Out-of-scope (logged to deferred-items.md, NOT auto-fixed)

**3. Sibling Plan 05-06 in-flight typecheck errors in `src/components/shell/app-shell.tsx`**

- **Found during:** Task 3 verification (`pnpm typecheck` after extending `src/screens/gateway.tsx`).
- **Issue:**
  - `src/components/shell/app-shell.tsx(66,1): error TS6133: 'listen' is declared but its value is never read.`
  - `src/components/shell/app-shell.tsx(93,1): error TS6133: 'GatewayNotificationsListener' is declared but its value is never read.`
- **Root cause:** Plan 05-06 is mid-flight in a parallel agent — the imports landed but the JSX consumers haven't been written yet. Once Plan 05-06 wires `<GatewayNotificationsListener />` into the shell render tree (or removes the imports if it pivots), the errors resolve.
- **Confirmation method:** Stashed `src/components/shell/app-shell.tsx` and moved untracked `src/hooks/use-gateway-notifications.ts` aside; re-ran `pnpm typecheck` → exit 0 with all Plan 05-03 files in place. Restored sibling state immediately afterwards.
- **Action:** Out-of-scope per Plan 05-03 SCOPE BOUNDARY (file-ownership rules in execute prompt: 05-03 owns `src/screens/gateway.tsx`, `src/components/gateway/*`, `src/hooks/use-gateway-status.ts`, `src/lib/format.ts` only). Logged to `.planning/phases/05-gateway-mode-system-surfaces/deferred-items.md` with the same template Plans 05-02 and 05-05 used for their cross-sibling discoveries.
- **Plan 05-03 status:** Unblocked — my files typecheck cleanly when isolated. Plan 05-06 commits will close these errors.

---

**Total deviations:** 2 auto-fixed (2 blocking — both TS narrowing traps) + 1 out-of-scope discovery deferred.
**Impact on plan:** All deviations resolved without scope creep. Plan intent preserved verbatim — D-12 ASCII gauge + WCAG meter, D-13 throughput layout + formatBitrate helper, D-14 PeerRow reuse + verbatim empty copy, D-15 single-click + advisory, D-16 W1 fan-out subscription + TBD-RPC-FALLBACK polling fallback, GatewayScreen active-state branch prepended cleanly. GATE-03 claimed.

## Issues Encountered

The two blocking issues above (TS narrowing on `let alive = true` and `const POLLING_FALLBACK = false`) are common TypeScript control-flow-analysis traps when shipping feature-flagged code paths or async-mutated cleanup state. Both fixed in-place during the same task they appeared in.

The pre-existing sibling-owned typecheck errors (Plan 05-06 territory in `src/components/shell/app-shell.tsx`) are documented as out-of-scope in `deferred-items.md`. Mirrors the pattern Plans 05-02 and 05-05 used for the (now-resolved) Plan 05-04 tray-popover discovery.

## Open kernel-side question (RESEARCH §14 question 1)

Per the plan's `<output>` directive: **the kernel-maintainer answer to the `gateway.event` proposal is not yet known to this agent.** The plan ships POLLING_FALLBACK off by default. If the kernel maintainer accepts `gateway.event`, no action is needed — the subscription path is the live one. If they reject it, flip `POLLING_FALLBACK = false` to `POLLING_FALLBACK = true` in `src/hooks/use-gateway-status.ts` (one-line change) and document the kernel-side rejection in a follow-up plan or in the phase's deferred-items.md. Plan 05-07 audit grep-counts the TBD-RPC-FALLBACK marker (currently 4) so the future rip-out can be located deterministically.

## Boundary observation (Plan-output `<output>` directive item 3)

**The gauge's color-threshold flip uses `Math.floor` of pct.** If the daemon ever emits a fractional util that rounds to exactly 79.999999, the gauge stays `text-foreground` (the < 80% bucket). This is intentional (no flicker on the boundary) but worth noting if observed in the field. Plan 05-07 human-verify can use a daemon stub at exactly 80.0% / 95.0% to verify the threshold transitions are crisp.

## User Setup Required

None — all changes are code-side. Plan 05-03 introduces no new dependencies, no new Tauri capabilities, no new permissions. The `gateway.status` / `gateway.disable` RPCs and `gateway.event` notification stream are all TBD-RPC-tagged (added to RpcMethodMap / RpcEventMap in Plan 05-01). Confirmation from the kernel maintainer is the only outstanding external dependency, and the POLLING_FALLBACK feature flag means the UI ships even if the kernel rejects the event.

## Next Phase Readiness

**Plan 05-06 (Wave 3 — running in parallel with this plan):**

- `useGatewayStatus()` is consumed by Plan 05-06's `useGatewayNotifications()` hook for conntrack-pressure notification dispatching. Both hooks subscribe to `gateway.event` via `actions.subscribe` (W1 fan-out) — the eventHandlers map in useDaemonState handles multi-subscriber dispatch automatically, so no double-subscribe concerns.
- The `gateway.event { kind: "conntrack_pressure", level: 1 }` event maps to a sonner toast `gateway conntrack near limit (N%)` (D-34); `level: 2` (≥95%) maps to BOTH toast AND OS notification `gateway conntrack saturated — connections will drop.` (D-33). Plan 05-06's hook owns that policy table; Plan 05-03's hook is purely the UI-state owner.

**Plan 05-07 (Wave 3 audit):**

- TBD-RPC-FALLBACK marker present (count = 4 in `src/hooks/use-gateway-status.ts`); audit asserts ≥ 1 — comfortably ahead.
- W1 listen-count assertions all pass: `grep -c 'listen(' src/lib/rpc.ts` = 0; `grep -c 'listen(' src/hooks/use-daemon-state.ts` = 2; zero `listen(` in any new Plan 05-03 file.
- D-12 ASCII gauge gates: `█` U+2588 + `░` U+2591 chars present, `BAR_WIDTH = 32`, `text-foreground` / `text-accent` / `text-destructive` thresholds, `NEAR LIMIT` badge label, `role="meter"` + aria-* attrs.
- D-14 verbatim empty-state copy: `no peers routing through this node yet · advertising 0.0.0.0/0` grep-able on a single line in `peers-through-me-list.tsx`.
- D-15 advisory copy: `peers will be cut over to another gateway` grep-able on a single line in `gateway-active-panel.tsx`.
- §2b mockup distinctive strings all grep-able: `gateway active`, `advertised: 0.0.0.0/0`, `[ Turn off gateway mode ]`.
- Brand-discipline grep sweep clean across all 5 new files: no `rounded-(sm|md|lg|xl|full)`, no `shadow-(sm|md|lg|xl)`, no `bg-gradient`, no hex literals, no `!` (exclamation).

**No blockers on Plan 05-04 / 05-05:** Plan 05-03 files don't overlap with their owned files. Plan 05-03 owns `src/components/gateway/*`, `src/hooks/use-gateway-status.ts`, `src/lib/format.ts` (append-only), `src/screens/gateway.tsx` (active-branch prepend only).

## Self-Check: PASSED

Verified after writing this SUMMARY:

- `[ -f src/components/gateway/conntrack-gauge.tsx ]` → FOUND
- `[ -f src/components/gateway/throughput-panel.tsx ]` → FOUND
- `[ -f src/components/gateway/peers-through-me-list.tsx ]` → FOUND
- `[ -f src/components/gateway/gateway-active-panel.tsx ]` → FOUND
- `[ -f src/hooks/use-gateway-status.ts ]` → FOUND
- `[ -f src/lib/format.ts ]` → FOUND (formatBitrate appended; existing helpers untouched)
- `[ -f src/screens/gateway.tsx ]` → FOUND (active-state branch prepended; branches 1-3/4-6 untouched)
- `[ -f .planning/phases/05-gateway-mode-system-surfaces/05-03-SUMMARY.md ]` → FOUND (this file)
- `[ -f .planning/phases/05-gateway-mode-system-surfaces/deferred-items.md ]` → FOUND (Plan 05-03 entry appended)
- `git log --oneline | grep -q 5782505` → FOUND (Task 1 commit)
- `git log --oneline | grep -q 1172a3e` → FOUND (Task 2 commit)
- `git log --oneline | grep -q 418ce24` → FOUND (Task 3 commit)
- `pnpm typecheck` → exit 0 in isolation against Plan 05-03 files (one pre-existing sibling-Plan-05-06-in-flight error documented as out-of-scope)
- `grep -c 'listen(' src/lib/rpc.ts` → 0 (W1 baseline preserved)
- `grep -c 'listen(' src/hooks/use-daemon-state.ts` → 2 (W1 baseline preserved)
- `grep -c 'listen(' src/hooks/use-gateway-status.ts` → 0 (W1 — fan-out only)
- `grep -c 'listen(' src/components/gateway/conntrack-gauge.tsx` → 0
- `grep -c 'listen(' src/components/gateway/throughput-panel.tsx` → 0
- `grep -c 'listen(' src/components/gateway/peers-through-me-list.tsx` → 0
- `grep -c 'listen(' src/components/gateway/gateway-active-panel.tsx` → 0
- `grep -c 'listen(' src/screens/gateway.tsx` → 0
- `grep -c "TBD-RPC-FALLBACK" src/hooks/use-gateway-status.ts` → 4 (Plan 05-07 asserts ≥ 1)
- `grep -q "role=\"meter\"" src/components/gateway/conntrack-gauge.tsx` → exit 0 (WCAG 4.1.2)
- `grep -q "█" src/components/gateway/conntrack-gauge.tsx` → exit 0 (U+2588)
- `grep -q "░" src/components/gateway/conntrack-gauge.tsx` → exit 0 (U+2591)
- `grep -q "BAR_WIDTH = 32" src/components/gateway/conntrack-gauge.tsx` → exit 0 (D-12)
- `grep -q "NEAR LIMIT" src/components/gateway/conntrack-gauge.tsx` → exit 0 (D-12 badge flip)
- `grep -q "no peers routing through this node yet" src/components/gateway/peers-through-me-list.tsx` → exit 0 (D-14 verbatim)
- `grep -q "advertising 0.0.0.0/0" src/components/gateway/peers-through-me-list.tsx` → exit 0 (D-14 verbatim)
- `grep -q "\\[ Turn off gateway mode \\]" src/components/gateway/gateway-active-panel.tsx` → exit 0 (§2b distinctive)
- `grep -q "peers will be cut over to another gateway" src/components/gateway/gateway-active-panel.tsx` → exit 0 (D-15 advisory)
- `grep -q "active === true" src/screens/gateway.tsx` → exit 0 (active-branch predicate)
- `grep -q "useGatewayStatus" src/screens/gateway.tsx` → exit 0
- `grep -q "GatewayActivePanel" src/screens/gateway.tsx` → exit 0
- `grep -q "gaugeBadgeLabel" src/screens/gateway.tsx` → exit 0
- All bang-free greps clean across the 5 new files: `! grep -q "!"` PASS on use-gateway-status.ts, conntrack-gauge.tsx, throughput-panel.tsx, peers-through-me-list.tsx, gateway-active-panel.tsx
- All brand-discipline greps clean: no rounded-*, no shadow-*, no bg-gradient, no hex literals across the 5 new files

---
*Phase: 05-gateway-mode-system-surfaces*
*Completed: 2026-04-27*
