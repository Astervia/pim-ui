---
phase: 01-rpc-bridge-daemon-lifecycle
plan: 04
subsystem: ui-dashboard-phase1-closeout
tags: [react, tauri, sonner, dashboard, brand, phase1-complete, checkpoint-pending]

# Dependency graph
requires: [01-01, 01-02, 01-03]
provides:
  - UptimeCounter — 1Hz self-ticking seconds/minutes/hours/days counter anchored on RPC baseline
  - formatUptime exported from uptime-counter.tsx as the single shared helper
  - AboutFooter — rpc.hello version + rpc_version + feature flags surface (success criterion 5)
  - ReconnectToaster + ReconnectToast — sonner-backed toast fires once on reconnecting → running
  - src/main.tsx — mounts <TunPermissionProvider> at app root (B2 fix live) + <ReconnectToaster />
  - src/screens/dashboard.tsx — live, daemon-sourced, single useDaemonState call, no mock data
  - Phase 1 UI-layer closure pending only the human-verify checkpoint (Task 4)
affects: [02-*, 03-*, 04-*, 05-*]

# Tech tracking
tech-stack:
  added:
    - sonner ^1.7.1 (installed 1.7.4)
  patterns:
    - "Shared helper refactor: formatUptime moved out of daemon-status.tsx into uptime-counter.tsx, re-imported by daemon-status — prevents drift"
    - "W3 self-tick: UptimeCounter owns its setInterval(1000), anchored on props (baselineSeconds, baselineTimestamp); no localStorage, no parent re-render dependency"
    - "Sonner toaster mounted OUTSIDE the provider tree at app root — observer (ReconnectToast) mounted inside Dashboard"
    - "Reconnect transition detection via useRef<DaemonState> — compares prev vs current, fires once on reconnecting → running (not on initial stopped → starting → running)"
    - "Dashboard reads only snapshot.status — never callDaemon directly, never useTunPermission"
    - "TunPermissionProvider mounted in main.tsx (not App.tsx) — consolidates app-root wiring with ReconnectToaster"

key-files:
  created:
    - src/components/brand/uptime-counter.tsx
    - src/components/brand/about-footer.tsx
    - src/components/brand/reconnect-toast.tsx
  modified:
    - package.json (added sonner)
    - pnpm-lock.yaml
    - src/main.tsx (wraps <App /> in TunPermissionProvider + mounts ReconnectToaster)
    - src/screens/dashboard.tsx (full live rewire — stub replaced)
    - src/components/brand/daemon-status.tsx (formatUptime import refactor)

key-decisions:
  - "sonner over hand-rolled toast — auto-dismiss, pause-on-hover, aria-live, and reduced-motion handling are all baked in; the alternative (re-using LimitedModeBanner in a success variant) is a fallback documented in UI-SPEC Surface 7 and was NOT needed"
  - "TunPermissionProvider mounted in src/main.tsx (not App.tsx) — co-locates all app-root wiring (StrictMode + provider + toaster) in one file; matches Plan 03's API note"
  - "formatUptime exported from uptime-counter.tsx — the original copy in daemon-status.tsx was DELETED and re-imported. Single shared helper, no drift risk"
  - "Dashboard omits onOpenLogs — exercises the Plan 03 I2 optional-prop contract; [ VIEW LOGS ] button hidden in Phase 1; Phase 2 wires a Logs tab handler"
  - "AboutFooter version line lowercase tracking-widest — matches the 11px micro spec from UI-SPEC §Surface 5"
  - "ReconnectToaster outside the provider tree — it has no dependency on TUN permission context; keeping the provider subtree focused avoids spurious context consumer re-evaluation"

patterns-established:
  - "App-root wiring convention: providers and toasters live in src/main.tsx, not App.tsx — App.tsx is the layout shell"
  - "Pre-checkpoint sweep gates: typecheck + build + rounded-corner grep + raw-color grep + forbidden-verb grep + mock-data grep + B2 modal-uniqueness grep. Every plan closing a UI surface will run this battery."
  - "JSDoc grep-strictness: when structural greps substring-match against comments, rewrite the comment in prose rather than weaken the grep. Applied three times across Phase 1 (01-01 listen(, 01-03 <TunPermissionModal, 01-04 useTunPermission)."

requirements-completed: [DAEMON-04, RPC-02]

# Metrics
duration: "~15 min (pre-checkpoint; Task 4 awaiting user verification)"
completed: 2026-04-24
---

# Phase 1 Plan 4: Dashboard Rewire + Phase 1 Closeout Summary

**Phase 1 closeout — three final brand components (UptimeCounter, AboutFooter, ReconnectToast), full dashboard rewire against `useDaemonState`, sonner toaster, and TunPermissionProvider wired at the app root (B2 fix live). Ends at a human-verify checkpoint for all 6 Phase 1 success criteria.**

## Performance

- **Duration (tasks 1-3):** ~15 min
- **Started:** 2026-04-24T18:32:52Z
- **Tasks 1-3 completed:** 2026-04-24T18:47:14Z
- **Tasks:** 3 auto + 1 pending human-verify checkpoint (Task 4)
- **Files changed:** 7 (3 created, 4 modified, 1 replaced)

## Accomplishments

- **`src/components/brand/uptime-counter.tsx`** (new) — `<UptimeCounter baselineSeconds baselineTimestamp startedAt?>`: owns `setInterval(1000)`, recomputes `displayed = baselineSeconds + floor((Date.now() - baselineTimestamp) / 1000)` every tick, `font-variant-numeric: tabular-nums` so digits don't jitter, wraps in `<time dateTime={startedAt}>` when available, `aria-live="off"` (no announcement flood). NO localStorage — success criterion 6 requires daemon-sourced baseline. **`formatUptime` is exported as the single shared helper** — `daemon-status.tsx` now imports it rather than owning a duplicate.
- **`src/components/brand/about-footer.tsx`** (new) — Two-row footer. Row 1 reuses the peer-state legend (`◆ active ◈ relayed ○ connecting ✗ failed`). Row 2 renders one of three variants from `rpc.hello`: no-handshake (`pim-daemon · not connected`, muted), post-handshake (version in signal-green semibold + `· rpc {n} · features: ...` muted), or rpc-version mismatch (full line in destructive red). `EXPECTED_RPC_VERSION = 1` constant gates the mismatch branch.
- **`src/components/brand/reconnect-toast.tsx`** (new) — `<ReconnectToaster />` mounts the sonner container at bottom-right with brand overrides (`rounded-none`, `border border-border border-l-2 border-l-primary bg-card`). `<ReconnectToast />` is a zero-visual observer that subscribes via `useDaemonState`, tracks the previous state in a `useRef`, and calls `toast(...)` exactly when `prevState === "reconnecting" && snapshot.state === "running"` (never on initial stopped → starting → running).
- **`src/main.tsx`** — Wraps `<App />` in `<TunPermissionProvider>` (B2 fix wired live — exactly one `<TunPermissionModal />` in the tree) AND mounts `<ReconnectToaster />` outside the provider. Confirmed via `grep -rn '<TunPermissionModal' src/ | wc -l` = 1.
- **`src/screens/dashboard.tsx`** — Full live version replaces the Plan 01 stub. Single `useDaemonState()` call. Four regions:
  1. Hero: animated `<Logo size="hero" animated />` + kicker + tagline + `<DaemonStatusIndicator>` top-right.
  2. `<LimitedModeBanner />` when `state !== "running"` (onOpenLogs intentionally omitted per I2 fix).
  3. CliPanel with live status RPC data (node, mesh_ip, interface up/down + glyph, transport, peers, routes, forwarded bytes, dropped) — rendered when running, dimmed 50% + pointer-events-none when reconnecting, hidden otherwise. UptimeCounter wired under the grid with `startedAt={status.started_at}`.
  4. `<AboutFooter daemon={hello} />` + observers (`<ReconnectToast />`, `<StopConfirmDialog />`).
- **`src/components/brand/daemon-status.tsx`** — Local `formatUptime` deleted; imports from `./uptime-counter` instead. Behavior identical.

## Task Commits

1. **Task 1:** `8551eec` — feat(01-04): install sonner, add UptimeCounter/AboutFooter/ReconnectToast, wire TunPermissionProvider at app root
2. **Task 2:** `dfe38a9` — feat(01-04): rewire dashboard — CliPanel live when running, LimitedModeBanner otherwise
3. **Task 3:** `5da8c0a` — chore(01-04): brand + B2 sweep — JSDoc grep-strictness adjustment
4. **Task 4:** PENDING human-verify checkpoint (no commit yet — nothing modified)

**Plan metadata commit:** will be added after Task 4 resolves.

## B2, W3, and I2 Closure (from Plan 03)

- **B2 (single modal mount site):** `grep -rn '<TunPermissionModal' src/ | wc -l` returns `1`. The single mount is inside `TunPermissionProvider` in `tun-permission-modal.tsx`. `src/main.tsx` now mounts the provider at the app root; Dashboard does NOT reference `useTunPermission` or `<TunPermissionModal />`.
- **W3 (self-ticking uptime):** Dashboard passes `baselineSeconds={status?.uptime_s}` and `baselineTimestamp={baselineTimestamp ?? undefined}` to `<DaemonStatusIndicator>`. No `uptimeSeconds` prop anywhere. `grep -c uptimeSeconds src/screens/dashboard.tsx` = 0. Additionally, `<UptimeCounter>` under the status grid owns its own `setInterval(1000)` with the same discipline.
- **I2 (optional VIEW LOGS):** Dashboard omits `onOpenLogs` — `grep -c onOpenLogs src/screens/dashboard.tsx` = 0. The `<LimitedModeBanner>` hides the button when no handler is provided.

## Pre-Checkpoint Sweep Results

```
pnpm typecheck                                    → exit 0
pnpm build                                         → exit 0 (306.52 kB js / 35.80 kB css)
grep rounded-{md,lg,full,xl,2xl,sm} src/           → 0 matches
grep bg-{green,red,amber,orange}-N text-{g,r}-N    → 0 matches
grep bg-{blue,purple} text-{blue,purple}           → 0 matches
grep mockStatus|mock_status src/                   → 0 matches
grep '<TunPermissionModal' src/ | wc -l            → 1
grep TunPermissionProvider src/main.tsx            → 3 (import + <JSX> + </JSX>)
grep useTunPermission|tunModal|<TunPermissionModal src/screens/dashboard.tsx → 0
grep Connect|Disconnect|Online|Offline|Please|Oops → 0 matches
```

## Copy Rendered (Phase 1 audit)

| Surface | Copy verbatim |
|---------|---------------|
| AboutFooter (no handshake) | `pim-daemon · not connected` |
| AboutFooter (post-handshake) | `<daemon> · rpc <n> · features: <list>` (version green semibold; rest muted) |
| AboutFooter (mismatch) | `<daemon> · rpc <n> — incompatible (expected rpc 1)` (destructive) |
| ReconnectToast | `◆ Daemon reconnected.` + `<daemon> · rpc <n>` muted second line |
| UptimeCounter | `{n}s` / `{m}m {ss}s` / `{h}h {m}m` / `{d}d {h}h` |
| Dashboard tagline | `Infrastructure you can read.` |
| Dashboard kicker | `proximity internet mesh` |

No exclamation marks in any user-visible string. No "please", no "Connect/Disconnect", no "Online/Offline".

## Decisions Made

- **sonner over a hand-rolled toast.** The fallback (re-using `LimitedModeBanner` in a success variant for 3s) was documented in UI-SPEC §Surface 7 as acceptable, but sonner already handles pause-on-hover, reduced-motion, focus management, and queueing — re-implementing those inside the banner would inflate the banner's concerns.
- **TunPermissionProvider in `main.tsx`, not `App.tsx`.** Plan 03's API note explicitly called out `src/main.tsx` as the app-root mount site. Co-locates StrictMode + provider + toaster in one file.
- **`formatUptime` moved OUT of `daemon-status.tsx` into `uptime-counter.tsx` (not duplicated).** The two tickers (status chip + under-grid counter) must never drift. Single export, two consumers.
- **ReconnectToaster outside the provider subtree.** It has no dependency on TUN permission context; mounting it inside would cause any provider re-render to re-evaluate the Toaster.
- **Dashboard omits `onOpenLogs`.** Exercises the Plan 03 I2 optional-prop contract — Phase 1 has no Logs tab yet; Phase 2 will pass a real handler.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] JSDoc reference to `useDaemonState()` tripped the "exactly one match" acceptance grep**

- **Found during:** Task 2 acceptance check (`grep -c "useDaemonState()" src/screens/dashboard.tsx` returned 2 instead of 1).
- **Issue:** The module header comment on `dashboard.tsx` referenced the hook call with its parentheses (`useDaemonState()`) for pedagogy. The substring grep counted the comment reference alongside the actual call site.
- **Fix:** Rewrote the comment to say `the useDaemonState hook` (no parentheses), preserving meaning without the literal call-shape. Grep now returns `1` (the real call).
- **Files modified:** `src/screens/dashboard.tsx`
- **Committed in:** `dfe38a9` (Task 2).

**2. [Rule 3 — Blocking] JSDoc references to `useTunPermission` tripped the B2 grep in Task 3 sweep**

- **Found during:** Task 3 final sweep (`grep -cE "useTunPermission|\btunModal\b|<TunPermissionModal" src/screens/dashboard.tsx` returned 2 instead of 0).
- **Issue:** Two pedagogical comment lines explained the B2 contract by naming `useTunPermission` directly. The grep substring-matches comments too.
- **Fix:** Rewrote the comment to describe the hook in prose ("the TUN permission consumer hook", "the permission modal") without the literal name. The B2 contract explanation is still clear; the grep count is now 0.
- **Files modified:** `src/screens/dashboard.tsx`
- **Committed in:** `5da8c0a` (Task 3).

**Total deviations:** 2 auto-fixed (both Rule 3 — JSDoc grep-strictness adjustments, same pattern as prior Phase 1 plans). Neither touched design intent; both preserved meaning while shifting from literal identifier references to prose descriptions so the structural greps only fire on real code occurrences.

## Known Stubs

1. **`LimitedModeBanner`'s `[ VIEW LOGS ]` button is hidden in Phase 1.** Intentional per Plan 03's I2 resolution — Dashboard passes no `onOpenLogs` handler. Phase 2 will wire a real Logs tab handler.
2. **`pim-daemon` binary may be absent from `src-tauri/binaries/`.** Task 4's full-path verification (success criteria 1, 2, 5, 6) requires the binary. If absent, Limited-mode-only verification (success criteria 3 + partial 4) is still possible — documented in the how-to-verify block.
3. **`rustup` may not be installed on the user's machine.** `pnpm tauri dev` invokes `cargo`; without Rust, the UI can be verified only via `pnpm dev` (browser) for Limited-mode-only criteria.

## Issues Encountered

- Two JSDoc grep-strictness adjustments (documented as deviations above). No real bugs.
- Build time fluctuated (~900ms first run, ~4s second with no changes — likely cold cache). Not a concern.

## User Setup Required (for Task 4 checkpoint)

Full success-criterion verification needs:

1. **Rust toolchain** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`, then restart terminal.
2. **pim-daemon binary** — build from the kernel repo and drop into `src-tauri/binaries/pim-daemon-<host-triple>`.
3. **Launch app** — `pnpm tauri dev` from this repo.

Limited-mode-only fallback path (for when the binary is unavailable) is documented in the plan's how-to-verify block.

## Next Phase Readiness

**Task 4 pending human verification.** After the user types `approved` (or `approved-limited-mode-only`), Phase 1 is closed. Phase 2 (the reactive status.event wiring + logs tab) can then proceed.

## Self-Check: PASSED

**Files created (`[ -f ]` check):**
- `src/components/brand/uptime-counter.tsx` — FOUND
- `src/components/brand/about-footer.tsx` — FOUND
- `src/components/brand/reconnect-toast.tsx` — FOUND

**Files modified:**
- `package.json` — sonner ^1.7.1 present
- `src/main.tsx` — TunPermissionProvider + ReconnectToaster mounted
- `src/screens/dashboard.tsx` — live version in place
- `src/components/brand/daemon-status.tsx` — formatUptime import refactor

**Commits (git log check):**
- `8551eec` — FOUND (Task 1)
- `dfe38a9` — FOUND (Task 2)
- `5da8c0a` — FOUND (Task 3)

**Sweep verification:**
- `pnpm typecheck` — exit 0
- `pnpm build` — exit 0
- `grep -rn '<TunPermissionModal' src/ | wc -l` — 1 (B2-OK)
- `grep -c "TunPermissionProvider" src/main.tsx` — 3 (import + open + close tag)
- `grep -rn "mockStatus\|mock_status" src/` — empty
- `grep -rnE "(rounded-md|rounded-lg|rounded-full|rounded-xl|bg-green-[0-9]|bg-red-[0-9]|bg-blue|bg-purple|text-blue|text-purple)" src/` — empty
- `grep -c uptimeSeconds src/screens/dashboard.tsx` — 0 (W3-OK)
- `grep -cE "useTunPermission|\btunModal\b|<TunPermissionModal" src/screens/dashboard.tsx` — 0 (B2-OK)

---
*Phase: 01-rpc-bridge-daemon-lifecycle*
*Tasks 1-3 completed: 2026-04-24*
*Task 4 (human-verify): awaiting user resume signal*
