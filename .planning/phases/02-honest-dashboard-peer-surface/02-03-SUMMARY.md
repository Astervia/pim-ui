---
phase: 02-honest-dashboard-peer-surface
plan: 03
subsystem: ui
tags: [react, dashboard, peers, cli-panel, brand-tokens, honest-surfacing, a11y]

# Dependency graph
requires:
  - phase: 02-honest-dashboard-peer-surface
    plan: 01
    provides: useStatus / usePeers (D-13 sorted) / useDiscovered selectors + formatBytes/formatCount/formatDuration/formatShortId helpers
  - phase: 02-honest-dashboard-peer-surface
    plan: 02
    provides: AppShell + ActiveScreen router that mounts <Dashboard /> for ⌘1 and ⌘2
provides:
  - "4-panel Dashboard: IdentityPanel → PeerListPanel → NearbyPanel → MetricsPanel in D-08 locked order"
  - "IdentityPanel: honest `█ pim · {node}` hero + mesh/iface/up|down/uptime detail + D-30 last-seen hint"
  - "PeerListPanel: D-13-sorted peer rows + D-14 verbatim empty-state + Phase-4-deferred ActionRow buttons"
  - "PeerRow: role=button + aria-label + keyboard-activation, honesty contract (relayed → text-accent, failed → text-destructive, never text-primary/◆ for relayed)"
  - "NearbyPanel: D-19 verbatim title + empty-state copy; D-20 anonymous-row has no Pair affordance"
  - "MetricsPanel: dense one-line metrics per D-23 — zero-dropped without parens, no-gateway → 'egress local'"
  - "onPeerSelect / onNearbyPair prop seams on <Dashboard /> — Plan 02-04 wires slide-over + modal through these"
affects: [02-04, 02-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Brand-token-only styling policy: no literal Tailwind palette colors, no rounded-*, no gradients, no exclamation marks — enforced by grep acceptance criteria"
    - "Bang-free source files: negation via `=== false` / `=== null ? Y : X` ternary inversion instead of `!`/`!==` so copy-level exclamation-mark bans reduce to a single `grep -q '!'` assertion per file"
    - "Honest rendering contract: per-state colour mapping in a STATE_WORD_CLASS record (Record<PeerState, string>) so the relayed → text-accent guarantee is mechanical, not prose"
    - "App-level chrome (ReconnectToast, StopConfirmDialog) lives in AppShell — screens are pure content"

key-files:
  created:
    - "src/components/identity/identity-panel.tsx"
    - "src/components/metrics/metrics-panel.tsx"
    - "src/components/peers/peer-row.tsx"
    - "src/components/peers/peer-list-panel.tsx"
    - "src/components/peers/nearby-row.tsx"
    - "src/components/peers/nearby-panel.tsx"
  modified:
    - "src/screens/dashboard.tsx"
    - "src/components/shell/app-shell.tsx"

key-decisions:
  - "ReconnectToast + StopConfirmDialog moved from Dashboard to AppShell — both are logical/chrome components that read useDaemonState directly; belong at the shell layer, not inside a specific screen. Alternative (keeping them in Dashboard) left available but chosen against for separation of concerns."
  - "DaemonToggle rendered above the 4 panels in a right-aligned row — alternative (integrating into IdentityPanel's `actions` slot) rejected because IdentityPanel is locked to the UI-SPEC ASCII mockup layout; keeping the toggle as a sibling preserves the Identity hero line verbatim."
  - "Connected-peer count = peers in state 'active' OR 'relayed' (shared between PeerListPanel badge and MetricsPanel). A relayed peer is still connected — the kernel is actively forwarding packets through it — so including relayed in the count is the honest read."
  - "When `status` is null, IdentityPanel + MetricsPanel render `[WAITING]` badge + `Loading …` placeholder rather than `[STALE]` or empty panels (D-07 — never placeholder zeros, but a loading affordance is honest)."
  - "PeerRow uses `onKeyDown` for Enter/Space activation even though it's already a native `<button>` (which handles Enter/Space on its own). The explicit handler is defensive against future refactors that might swap the element and break keyboard parity."

requirements-completed: [STAT-01, STAT-02, STAT-03, PEER-01, PEER-05]

# Metrics
duration: 7min
completed: 2026-04-24
---

# Phase 2 Plan 03: Honest Dashboard (4-Panel Stack) Summary

**Replaces the Phase-1 placeholder Dashboard with the UI-SPEC §S2 4-panel layout (Identity → Peers → Nearby → Metrics), wired to the Wave-1 reactive spine and honoring the non-negotiable honesty contract — a relayed peer NEVER renders as active, and empty/degraded states use the exact D-14 / D-19 / D-23 copy.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-24T19:41:28Z
- **Completed:** 2026-04-24T19:49:21Z
- **Tasks:** 3
- **Files created:** 6
- **Files modified:** 2

## Accomplishments

- **Identity panel ships the UI-SPEC hero line verbatim:** `█ pim · {node}` with `.phosphor` on the block + wordmark, `·` (U+00B7) separators, node name in plain foreground, right-aligned StatusIndicator derived from `interface.up`. Detail line renders `mesh: {mesh_ip} · interface {iface.name} · {up|down} · {formatDuration(uptime_s)}`. When interface is down, the `down` word is colored `text-destructive` and a `show why →` affordance renders (Plan 02-06 will wire it to the Logs filter). D-30 limited-mode adds a `· last seen: {N ago}` suffix and dims the panel to opacity-60.
- **Metrics panel ships the D-23 line verbatim:** `peers {n} · forwarded {formatBytes(bytes)} / {formatCount(packets)} pkts · dropped {n}[reason] · egress {short_id|local}`. Zero-dropped correctly drops the parenthesised reason. No gateway renders `egress local` — the `egress none` failure-implying string is explicitly rejected.
- **Peer rows honor the honesty contract mechanically:** the per-state `STATE_WORD_CLASS` record maps `relayed → text-accent`, `failed → text-destructive`, `connecting → text-muted-foreground`, `active → text-foreground`. Combined with `StatusIndicator` (which already colors the glyph per state), a relayed peer cannot render with `◆`/text-primary. The only `text-primary` in `peer-row.tsx` is the `node_id_short` column per UI-SPEC §Interaction §Peer row.
- **Peer rows are keyboard-first:** `role="button"` + `tabIndex={0}` + `aria-label="peer detail: {label or short_id}"` + explicit Enter/Space key handling. Focus-visible outline is 2px inset signal-green per UI-SPEC §Focus policy for large click targets. Hover adds a subtle left-edge border. Plan 02-04 will wire `onSelect` to open the slide-over.
- **PeerListPanel empty state is D-14 verbatim:** `no peers connected · discovery is active`. The ActionRow buttons `[ + Add peer nearby ]` and `[ Invite peer ]` render disabled with tooltip `pairing UI lands in phase 4` — honest about what Phase 2 does and does not ship. Column-header row renders muted uppercase with the exact eight column labels from UI-SPEC §Peers panel.
- **NearbyPanel honors D-19 + D-20:** title `nearby — not paired` (em-dash U+2014) auto-uppercases in CliPanel to `NEARBY — NOT PAIRED`. Empty state is `no devices discovered yet · discovery is active` verbatim. Anonymous rows (`node_id === null`) render `anonymous` + `(no id)` + NO Pair affordance per D-20. Non-anonymous rows get a `[ Pair ]` button wired through `onPair`.
- **Dashboard is now a pure panel stack** in the D-08 locked order: `IdentityPanel → PeerListPanel → NearbyPanel → MetricsPanel`. Wave-1 selectors are the only data source. `max-w-4xl flex flex-col gap-6` content column matches UI-SPEC §S2. The D-10 routing toggle is NOT rendered (Phase 4 work; a disabled stub would be dishonest).
- **Shell chrome relocated:** `ReconnectToast` and `StopConfirmDialog` moved from Dashboard to `AppShell`, where they belong conceptually. `Logo` hero and `AboutFooter` removed from Dashboard (sidebar owns branding per Plan 02-02; Phase-2 Dashboard is panel-stack-only per UI-SPEC §S2). `DaemonToggle` is rendered above the 4 panels in a right-aligned `<div>` so the IdentityPanel matches the ASCII mockup verbatim.
- **Brand guards pass phase-wide:** no `!` chars, no `rounded-*`, no `bg-gradient|from-|to-`, no literal `text-{palette}-{N}` colors in any new file or in `src/screens/dashboard.tsx`. W1 invariant intact — `grep -c 'listen(' src/lib/rpc.ts` still `0`.

## Task Commits

1. **Task 1 — IdentityPanel + MetricsPanel** — `a5e267f` — `feat(02-03): IdentityPanel + MetricsPanel (STAT-01, STAT-02, STAT-03)`
2. **Task 2 — PeerRow + PeerListPanel + NearbyRow + NearbyPanel** — `19083f7` — `feat(02-03): PeerRow + NearbyRow + PeerListPanel + NearbyPanel (PEER-01, PEER-05)`
3. **Task 3 — Rewire Dashboard to 4-panel layout** — `c20fe1e` — `feat(02-03): rewire Dashboard to 4-panel stack (Identity/Peers/Nearby/Metrics) per UI-SPEC §S2`

_Plan metadata commit is appended by the orchestrator after this SUMMARY._

## Files Created / Modified

**Created:**
- `src/components/identity/identity-panel.tsx` — IdentityPanel component with hero + detail line (STAT-01).
- `src/components/metrics/metrics-panel.tsx` — MetricsPanel component with D-23 dense line (STAT-02, STAT-03).
- `src/components/peers/peer-row.tsx` — Single peer row with honesty-contract colouring + keyboard activation (PEER-01).
- `src/components/peers/peer-list-panel.tsx` — Peers CliPanel wrapping PeerRows + ActionRow + D-14 empty state (PEER-01 container).
- `src/components/peers/nearby-row.tsx` — Single discovered-peer row with D-20 anonymity rule (PEER-05).
- `src/components/peers/nearby-panel.tsx` — Nearby CliPanel with D-19 title + empty state (PEER-05).

**Modified:**
- `src/screens/dashboard.tsx` — Rewrote from Phase-1 single-panel layout to 4-panel stack; removed Logo / AboutFooter / ReconnectToast / StopConfirmDialog; added `onPeerSelect` + `onNearbyPair` prop seams for Plan 02-04; computes `limitedMode` from `snapshot.state !== "running"` (expressed as `=== "running" ? false : true` for bang-free compliance).
- `src/components/shell/app-shell.tsx` — Added `ReconnectToast` + `StopConfirmDialog` imports and rendered both as siblings of `<main>`. These are logical/chrome components that read `useDaemonState` directly; they belong at the shell layer.

## Exact Copy Strings Shipped (for checker traceability)

| Surface | Exact string |
|---------|-------------|
| Identity hero wordmark | `█ pim` (U+2588 block + ASCII space + "pim") |
| Identity detail template | `mesh: {mesh_ip} · interface {name} · up|down · {formatDuration(uptime_s)}` |
| Identity interface-down affordance | `show why →` (as a `<button>` that's a Plan 02-06 seam) |
| Identity limited-mode suffix | ` · last seen: {N ago}` |
| Identity badges | `[LIVE]` (running), `[STALE]` (limited mode), `[WAITING]` (status null) |
| Peers panel empty state | `no peers connected · discovery is active` (D-14 verbatim) |
| Peers ActionRow primary | `[ + Add peer nearby ]` (disabled, tooltip `pairing UI lands in phase 4`) |
| Peers ActionRow secondary | `[ Invite peer ]` (disabled, same tooltip) |
| Peers column headers | `short id`, `label`, `mesh ip`, `transport`, `state`, `hops`, `latency`, `last seen` |
| Peers row template | `{short_id}  {label or —}  {mesh_ip}  via {transport}  {◆/◈/○/✗} {state}  {hops or ""}  {latency or ""}  {last_seen}s` |
| Nearby panel title | `nearby — not paired` → rendered `NEARBY — NOT PAIRED` (em-dash U+2014) |
| Nearby empty state | `no devices discovered yet · discovery is active` (D-19 verbatim) |
| Nearby anonymous fallbacks | label `anonymous`, short id `(no id)` (D-20) |
| Nearby row template | `{label_announced or "anonymous"}  {short_id or "(no id)"}  via {mechanism}  first seen {first_seen_s}s ago  [optional [ Pair ]]` |
| Metrics line | `peers {n} · forwarded {formatBytes(bytes)} / {formatCount(packets)} pkts · dropped {n}[reason] · egress {short_id or "local"}` (D-23) |
| Metrics zero-dropped | `dropped 0` (no parens) |
| Metrics no-gateway | `egress local` (never the failure-implying alternative) |
| Metrics badges | `[LIVE]`, `[STALE]`, `[WAITING]` |

## Decisions Made

1. **ReconnectToast + StopConfirmDialog moved to AppShell.** The plan offered two options — leave them in Dashboard (lower-risk) or move to AppShell (cleaner separation of concerns). I took the planner's default: both components are logical/chrome surfaces that consume `useDaemonState` directly and have no visual coupling to the Dashboard; hosting them at the shell layer means they're active on every screen (including the Logs tab once Plan 02-05 lands) without re-wiring.
2. **DaemonToggle rendered as a sibling of the 4 panels.** Alternative considered: add an `actions` prop to `IdentityPanel` so the toggle lives inside the Identity CliPanel header. Rejected because the Identity panel's layout is locked to the UI-SPEC ASCII mockup verbatim — adding an actions slot would force a structural deviation. A small right-aligned `<div>` above the panel stack keeps the contract clean.
3. **Connected-peer count includes `relayed` peers.** The Peers panel badge `[{n} CONNECTED]` and the Metrics panel `peers {n}` both filter by `state === "active" || state === "relayed"`. A relayed peer is still connected — the kernel is actively forwarding packets through it — so including it is the honest read. This matches the UI-SPEC §Peers panel description "Peers panel wraps … connected peer list".
4. **`[WAITING]` badge added for the status-null case.** The plan lists `[LIVE]` and `[STALE]` but doesn't name the pre-seed state. `[WAITING]` honestly describes "we're waiting for the daemon's first status RPC" without lying about liveness; it renders with the muted variant so it's visually distinct from the live green badge.
5. **PeerRow has explicit `onKeyDown` handling even though it's already a `<button>`.** Native `<button>` elements handle Enter/Space click triggering on their own; the redundant `onKeyDown` is defensive against future refactors that might swap the element for a `<div role="button">`. The cost is ~5 lines; the benefit is the keyboard-parity contract holds even under element changes.

## Deviations from Plan

None — plan executed exactly as written.

All auto-fixes during execution were mechanical grep-contract adjustments (doc comments that accidentally contained banned strings like `text-green-500` inside warning text, or `egress none` inside the D-23 negative example, or `Add your first peer` inside the voice-rule comment). Every auto-fix was a wording-only change that kept the comment's informational intent; no behavioural change, no new external dependency, no architectural deviation.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Doc-comment grep false-positives would fail acceptance sweeps**

- **Found during:** Task 1 + Task 2 + Task 3 verification passes.
- **Issue:** The plan's acceptance criteria use literal `grep -q` checks (e.g. `! grep -q "egress none"`, `! grep -q "text-green-"`, `! grep -q "Route internet via mesh"`, `! grep -q "Add your first peer"`, `! grep -q "!"`). My initial doc-comments referenced those strings as the negative cases being explicitly rejected — which is what comments should do. But grep is line-based and doesn't distinguish comment from code, so the acceptance sweeps flagged the doc-comments.
- **Fix:** Reworded each doc comment to describe the rejected pattern without including the literal string. E.g. "NEVER `egress none`" → "never the failure-implying alternative"; "`text-green-500`, etc." → "e.g. numeric-variant tokens"; "the `Route internet via mesh` toggle" → "the Phase-4 routing toggle"; `auto-uppercase` (whose `to-u` substring tripped the `to-` gradient-token sweep) → `CliPanel uppercases internally`.
- **Files modified:** `src/components/identity/identity-panel.tsx`, `src/components/metrics/metrics-panel.tsx`, `src/components/peers/peer-row.tsx`, `src/components/peers/peer-list-panel.tsx`, `src/components/peers/nearby-panel.tsx`, `src/screens/dashboard.tsx`.
- **Verification:** All grep acceptance criteria pass cleanly; the informational intent of each comment is preserved.
- **Committed in:** Same-task commits (`a5e267f`, `19083f7`, `c20fe1e`) — no separate commit needed because the fixes landed within the task's primary diff.

**2. [Rule 3 - Blocking] TypeScript negation operators would trip the "no exclamation mark" grep**

- **Found during:** Task 1 (first bang-sweep on `identity-panel.tsx`).
- **Issue:** The plan's per-file acceptance criterion `! grep -q "!"` is strict — any `!` character fails the check, including TypeScript operators like `!==`, `!=`, or the logical-NOT `!`. My initial writes used `lastSeenTimestamp !== null` / `if (!onSelect)` idiomatic TypeScript.
- **Fix:** Rewrote all negations using bang-free patterns: `X !== null` → `X === null ? null : X`, `!X` → `X === undefined ? Y : Z`, and boolean negations flipped via swapped ternary branches (`limitedMode === true` instead of `!limitedMode`). This reads more verbosely but reduces the "no exclamation marks in copy" rule to a single mechanical grep assertion per file.
- **Files modified:** `src/components/identity/identity-panel.tsx`, `src/components/metrics/metrics-panel.tsx`, `src/components/peers/peer-row.tsx`, `src/components/peers/peer-list-panel.tsx`, `src/components/peers/nearby-row.tsx`, `src/components/peers/nearby-panel.tsx`, `src/screens/dashboard.tsx`.
- **Verification:** `for f in …; do grep -q "!" "$f" && echo BAD; done` is empty for all seven files.
- **Committed in:** Same-task commits — all applied inline during the task's first write.

**Impact on plan:** Both deviations are documentation/formatting-level; no scope change, no behavioural change, no new external dependency, no architectural shift.

## Issues Encountered

None beyond the two auto-fixed deviations above. `pnpm typecheck` passed cleanly after each task commit.

## Known Stubs

- **`src/components/identity/identity-panel.tsx`** L105-L115 — the `show why →` button has an empty `onClick` (marked `// wired by Plan 02-06`). This is intentional and planner-specified: the affordance MUST render so the honesty contract (interface-down state is visibly explainable) holds, but the actual Logs-filter navigation is Plan 02-06's job. The button is fully focusable + keyboard-accessible; only the side effect of clicking it is deferred.

- **`src/screens/dashboard.tsx`** `onPeerSelect` + `onNearbyPair` props default to `undefined`. Plan 02-04 will thread handlers through `ActiveScreen` → `Dashboard` to open the Peer Detail slide-over and outbound Pair modal. Until then, clicking a peer row or a `[ Pair ]` button is a no-op. This is intentional and planner-specified (Task 3 note "Plan 02-04 will thread the handlers").

No other stubs. All rendered copy comes from the UI-SPEC / D-decisions verbatim; all panel data flows through the Wave-1 selector hooks; no mock data is committed.

## User Setup Required

None. This plan is pure UI composition — no new env vars, no new services, no new permissions, no npm install required (every primitive was already in `src/components/brand/` or `src/components/ui/` from Phase 1).

## Next Phase Readiness

Wave-2 siblings can now build on top of Plan 02-03 cleanly:

- **Plan 02-04 (Peer Detail slide-over + Pair Approval modal):** thread a concrete `onPeerSelect` handler through `ActiveScreen` → `Dashboard` to open the slide-over; thread `onNearbyPair` through the same path to open the outbound Pair modal. Because `PeerRow` and `NearbyRow` already carry the callbacks as props with no-op defaults, no changes to the peer-row components themselves are needed — Plan 02-04 just needs to create the slide-over and modal components, wire them at the Dashboard or ActiveScreen level, and pass the handlers.
- **Plan 02-05 (Logs tab):** unrelated to Dashboard — lands inside the `case "logs":` branch of `active-screen.tsx`. The shell plumbing and global `⌘5` shortcut are already live from Plan 02-02.

The shell-chrome relocation (ReconnectToast + StopConfirmDialog now in AppShell) means they remain active on the Logs tab and any future tabs without re-wiring.

**No new blockers.** The W1 single-listener contract is preserved and verified.

## Self-Check: PASSED

Verified:
- All 6 created files present on disk.
- Both modified files (`src/screens/dashboard.tsx`, `src/components/shell/app-shell.tsx`) updated.
- All 3 task commits present in `git log` (`a5e267f`, `19083f7`, `c20fe1e`).
- `pnpm typecheck` exits 0 after each task commit and after the final plan.
- W1 invariant: `grep -c 'listen(' src/lib/rpc.ts` returns `0`.
- Honesty contract: `grep -q "text-accent" src/components/peers/peer-row.tsx` and `grep -q "text-destructive" src/components/peers/peer-row.tsx` both return 0.
- Empty-state copy: `no peers connected · discovery is active` present in `peer-list-panel.tsx`; `no devices discovered yet · discovery is active` present in `nearby-panel.tsx`.
- Brand guards phase-wide: no `rounded-*`, no `bg-gradient|from-|to-`, no `text-(green|red|blue|yellow|purple|orange|pink)-[0-9]+`, no `!` in any new file or in the modified `dashboard.tsx`.
- Panel order in `src/screens/dashboard.tsx`: `IdentityPanel` before `PeerListPanel` before `NearbyPanel` before `MetricsPanel`.

---
*Phase: 02-honest-dashboard-peer-surface*
*Completed: 2026-04-24*
