---
phase: 02-honest-dashboard-peer-surface
plan: 04
subsystem: ui
tags: [react, tauri, tailwind, shadcn, sheet, dialog, peer-detail, pair-approval, a11y, brand-tokens]

# Dependency graph
requires:
  - phase: 02-honest-dashboard-peer-surface
    plan: 01
    provides: "useDaemonState.actions.subscribe (W1 fan-out to peers.event), callDaemon('peers.pair'), formatShortId / formatDuration helpers"
  - phase: 02-honest-dashboard-peer-surface
    plan: 02
    provides: "ActiveScreen extension seam + shell-level overlay slot"
  - phase: 02-honest-dashboard-peer-surface
    plan: 03
    provides: "<Dashboard onPeerSelect onNearbyPair> prop seams"
provides:
  - "Peer Detail right-edge slide-over (480px) with 4 fixed sections (IDENTITY / CONNECTION / TRUST / TROUBLESHOOT LOG) per D-17 verbatim copy"
  - "Peer Detail [ show full ] toggle that reveals 64-char node_id inline per D-16"
  - "usePeerDetail() global selected-peer atom (module-level + useSyncExternalStore)"
  - "usePeerTroubleshootLog(nodeId) hook with Map<node_id, last 25 PeerEvent[]> ring buffer; auto-subscribed to peers.event via W1 fan-out"
  - "Pair Approval modal (inbound + outbound variants) with verbatim UI-SPEC copy and [ Trust and connect ] calling peers.pair({ trust: 'persist' })"
  - "usePairApproval() global queue with D-22 single-modal-at-a-time behavior (console.info on queue depth, no UI surface)"
  - "Shell-level overlay mount: ActiveScreen renders PeerDetailSheet + PairApprovalModal as siblings of the active <section>, persisting across ⌘1/⌘2 tab switches"
  - "KvRow shared two-column primitive (label / value, click-to-copy) for the slide-over Identity + Connection + Trust sections"
  - "shadcn new-york Sheet primitive installed + brand-overridden (bg-popover, border-border, font-mono SheetTitle, × glyph close button, zero border radius, no shadows)"
affects: [02-05, 02-06]

# Tech tracking
tech-stack:
  added:
    - "radix-ui meta package (pulled in transitively by shadcn sheet; @radix-ui/react-dialog was already present)"
  patterns:
    - "Brand-overridden shadcn primitive: install via `pnpm dlx shadcn@latest add`, immediately rewrite the generated file to apply zero-radius / bg-popover / font-mono Title / × glyph close"
    - "Module-level atom + useSyncExternalStore for app-global UI state (selected peer, pair-approval queue) — mirrors useActiveScreen + useDaemonState"
    - "Shared W1 subscription pattern: use `useDaemonState.actions.subscribe('peers.event', handler)` to register a fan-out handler without allocating a Tauri listener (multi-handler Set<Handler> dedupes at the rpcEvent layer)"
    - "Bang-free negation throughout: `x === true ? a : b`, `x === null ? y : z`, explicit `null`/`undefined` checks instead of `!x` / `x !== null` — keeps the per-file `grep -q '!'` acceptance gate at zero false positives"
    - "Shell-level overlay mounting: rather than re-mounting modals/sheets inside each screen, render them once at ActiveScreen as siblings of the active <section> so state (selected peer, pair queue) survives tab switches"

key-files:
  created:
    - "src/components/ui/sheet.tsx (shadcn new-york primitive, brand-overridden)"
    - "src/components/peers/kv-row.tsx (two-column key/value row)"
    - "src/components/peers/peer-detail-sheet.tsx (PEER-04 slide-over)"
    - "src/components/peers/pair-approval-modal.tsx (PEER-06 modal, both variants)"
    - "src/hooks/use-peer-detail.ts (selected-peer atom)"
    - "src/hooks/use-peer-troubleshoot-log.ts (per-peer last-25 PeerEvent ring buffer)"
    - "src/hooks/use-pair-approval.ts (inbound + outbound queue + modal state machine)"
  modified:
    - "src/components/shell/active-screen.tsx (wired onPeerSelect / onNearbyPair, mounted PeerDetailSheet + PairApprovalModal at shell level)"
    - "package.json (added radix-ui^1.4.3, transitively by shadcn add sheet)"
    - "pnpm-lock.yaml (lockfile update for radix-ui deps)"

key-decisions:
  - "Shell-level overlay mounting (D-03 extension): PeerDetailSheet + PairApprovalModal mount once at ActiveScreen as siblings of the active <section>. Alternative (mount inside Dashboard) rejected because overlays must survive ⌘1/⌘2 tab switches and stay live when the user navigates to Logs mid-flow."
  - "usePeerTroubleshootLog registers a SECOND peers.event handler alongside useDaemonState's in-spine handler. Safe because the W1 fan-out is a Set<Handler> per event — both handlers fire on every event, zero Tauri-listener growth."
  - "Anonymous inbound pair-event (node_id === null) is dropped in use-pair-approval's handlePeersEvent rather than opening an 'anonymous pair' modal. D-20 hides pairing for anonymous discoveries at every layer."
  - "D-22 queue depth is logged via console.info but NOT surfaced in the UI — honest enough for troubleshooting, invisible enough to not stress an anxious user watching pair-requests stack up."
  - "Pair Approval modal close via setTimeout(openNext, 0) rather than immediate next-open. Radix Dialog focus-trap + unmount animations play nicely when the DOM has one microtask to reconcile the closed state before the next one opens."
  - "Brand-override policy on shadcn sheet: the generated file is REPLACED wholesale rather than patched in place — the generator's rounded-xs / shadow-lg / lucide XIcon / bg-background are all 'wrong' enough that surgical edits would leave the file half-correct."

patterns-established:
  - "Per-file brand sweep: every new TSX in this plan keeps `! grep -q '!'`, `! grep -q 'rounded-'`, `! grep -q 'text-(green|red|blue|yellow)-[0-9]'`, and positive asserts on UI-SPEC-verbatim strings. Doc comments must use prose descriptions of forbidden patterns, NEVER quoting the literal banned string (avoids grep false-positives Plans 02-03 + 02-04 both hit)."
  - "Global UI-state atom shape: `let value; const listeners = Set<()=>void>; function notify(){}; useSyncExternalStore(subscribe, get, get)`. The `__test_reset*` export at EOF is the reset hook for any future vitest suite."

requirements-completed: [PEER-04, PEER-06]

# Metrics
duration: 11min
completed: 2026-04-24
---

# Phase 2 Plan 04: Peer Detail Slide-Over + Pair Approval Modal Summary

**PEER-04 right-edge slide-over (480px, 4 sections, D-17 verbatim copy, show-full node_id reveal, per-peer 25-entry troubleshoot log ring buffer) and PEER-06 pair-approval modal (inbound + outbound variants, UI-SPEC-verbatim titles, queue-on-collision per D-22, `peers.pair({ trust: 'persist' })` on Trust-and-connect) wired at the shell level so they overlay every screen in the Phase-2 shell.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-24T19:54:12Z
- **Completed:** 2026-04-24T20:05:04Z
- **Tasks:** 3
- **Files created:** 7
- **Files modified:** 3

## Accomplishments

- **Shadcn new-york Sheet primitive** installed via `pnpm dlx shadcn@latest add sheet` then fully rewritten for brand compliance: zero border-radius, no shadows, `bg-popover` (not `bg-background`), `border-l border-border` on the right-edge variant, `font-mono uppercase tracking-wider font-semibold` SheetTitle, and a plain `×` (U+00D7) glyph close button with `aria-label="close peer detail"` in place of lucide's `XIcon`.
- **PeerDetailSheet (PEER-04)** renders a 480px right-edge slide-over opened by clicking any peer row on the Dashboard. Four fixed sections in D-17 order: IDENTITY (full node_id click-to-copy, short_id, mesh_ip, label), CONNECTION (transport, state with StatusIndicator glyph + colour-word, hops, last_seen duration, latency, is_gateway), TRUST (`configured in pim.toml` vs `paired via discovery` verbatim), TROUBLESHOOT LOG (last 25 peers.event entries with local-time prefix). Failed peers get a pinned `✗ pair_failed  reason: …` callout at top in `text-destructive`. The header `[ show full ]` button toggles 8-char short_id ↔ 64-char full node_id per D-16. Phase-3 actions (Retry / Trust this peer / Forget peer) are entirely omitted per D-18 — not disabled, not rendered.
- **usePeerDetail** global atom (`select(peer)` / `close()`) lets Dashboard's `onPeerSelect` callback drive sheet visibility without prop drilling through ActiveScreen.
- **usePeerTroubleshootLog** hook maintains a module-level `Map<node_id, PeerLogEntry[]>` capped at 25 entries per peer (most-recent first). Subscribes to `peers.event` via `useDaemonState.actions.subscribe` — the W1 fan-out means this does NOT add a Tauri listener (`grep -c 'listen(' src/hooks/use-daemon-state.ts` still returns `2`, `src/lib/rpc.ts` still `0`). Ref-counted activation/teardown across consumer mounts.
- **PairApprovalModal (PEER-06)** renders two variants driven by `usePairApproval.current.mode`:
  - **Inbound** — triggered by `peers.event { kind: "discovered" }` with non-null node_id. Title: `{label_announced ?? short_id} wants to join your mesh.` (UI-SPEC verbatim). Description: `↳ node ID: {shortId}` with shortId in `text-accent` (UI-SPEC §Color reserved list item 4) + `[ show full ]` reveal. Sub-line: `↳ via {mechanism}`. Footer: `[ Decline ]` (secondary) + `[ Trust and connect ]` (default/primary-green — NOT accent, per UI-SPEC §Color do-not-use list). Role: `alertdialog`.
  - **Outbound** — triggered by `[ Pair ]` click on a Nearby row. Title: `Pair with {label ?? short_id} via {mechanism}?`. Same shortId-in-accent + show-full reveal. Footer: `[ Cancel ]` + `[ Trust and connect ]`. Role: `dialog`.
  - `[ Trust and connect ]` calls `callDaemon("peers.pair", { node_id, trust: "persist" })`. `[ Decline ]` / `[ Cancel ]` close without RPC (daemon times out its own discovered entry).
- **usePairApproval** queue (D-22): `current` holds the open trigger; `queue[]` holds pending triggers; only one modal at a time. Second trigger while open → `queue.push(...)` and `console.info('pair queue: N waiting')` (NOT UI-surfaced). On `close()`, `setTimeout(openNext, 0)` advances the queue after the modal unmounts.
- **Shell-level overlay mount**: `ActiveScreen` now renders `<PeerDetailSheet />` and `<PairApprovalModal />` as siblings of the active `<section>`, wires `onPeerSelect={select}` and `onNearbyPair={requestOutbound}` into the `<Dashboard>` prop seams. Overlay state persists across ⌘1 / ⌘2 tab switches and remains live when the user navigates to the Logs tab mid-flow.
- **W1 invariant preserved**: `grep -c 'listen(' src/lib/rpc.ts` returns `0`; `grep -c 'listen(' src/hooks/use-daemon-state.ts` returns `2`. No new Tauri listeners anywhere.
- **Brand invariants preserved**: zero `rounded-*` classes in any new file, zero `shadow-*`, zero literal Tailwind palette colors, zero exclamation marks in the three bang-sensitive files (`peer-detail-sheet.tsx`, `pair-approval-modal.tsx`, `kv-row.tsx`).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install + brand-override shadcn Sheet primitive** — `f663e99` (feat)
2. **Task 2: PeerDetailSheet + troubleshoot-log hook + kv-row primitive** — `d2d2044` (feat)
3. **Task 3: Pair Approval modal + pair-approval hook + shell wiring** — `a7f8d35` (feat)
4. **Task 3.1: Reword doc comment to avoid banned-string false-positive** — `f7f2091` (refactor)

_Plan metadata commit is appended by the orchestrator after this SUMMARY._

## Files Created/Modified

**Created:**

- `src/components/ui/sheet.tsx` — shadcn Sheet primitive (new-york), brand-overridden. Exports `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`. `SheetContent` defaults to `bg-popover` + `border-l border-border` on the right-edge variant. Close button renders `×` (U+00D7) with `aria-label="close peer detail"`.
- `src/components/peers/kv-row.tsx` — Two-column monospace key/value row with optional click-to-copy on string values. Grid: `12ch` label column + `1fr` value column, `font-code text-sm leading-[1.7]`.
- `src/components/peers/peer-detail-sheet.tsx` — PEER-04 slide-over. Reads from `usePeerDetail` + `usePeerTroubleshootLog`; renders 4 sections + failed-peer pinned callout + show-full toggle.
- `src/components/peers/pair-approval-modal.tsx` — PEER-06 modal. Reads from `usePairApproval`; renders inbound or outbound variant based on `current.mode`. Calls `peers.pair` on Trust-and-connect.
- `src/hooks/use-peer-detail.ts` — Module-level atom `selected: PeerSummary | null`, plus `select` / `close` callbacks. useSyncExternalStore pattern.
- `src/hooks/use-peer-troubleshoot-log.ts` — Per-peer ring buffer (25 entries). `usePeerTroubleshootLog(nodeId)` returns `PeerLogEntry[]`; subscribes to `peers.event` via the W1 fan-out on first consumer mount, tears down on last unmount.
- `src/hooks/use-pair-approval.ts` — Inbound + outbound pair-trigger queue with single-modal-at-a-time state machine. Subscribes to `peers.event` once on first mount (guarded by `subscribed` flag); no teardown (lives for app lifetime).

**Modified:**

- `src/components/shell/active-screen.tsx` — Wired `usePeerDetail().select` into Dashboard's `onPeerSelect` prop; wired `usePairApproval().requestOutbound` into `onNearbyPair`. Mounted `<PeerDetailSheet />` and `<PairApprovalModal />` as siblings of the active `<section>` so they overlay every screen. Extended the extension-seam comment with a Plan 02-04 entry.
- `package.json` — Added `radix-ui ^1.4.3` (transitive dep pulled in by `shadcn add sheet`).
- `pnpm-lock.yaml` — Lockfile update for the radix-ui meta package and its nested primitives.

## Exact Copy Strings Shipped (for checker traceability)

| Surface | Exact string |
|---------|--------------|
| Sheet close button | `×` (U+00D7) with `aria-label="close peer detail"` |
| Peer Detail show-full toggle | `[ show full ]` / `[ show short ]` |
| Peer Detail Section titles | `identity` · `connection` · `trust` · `troubleshoot log` (rendered uppercase via CSS `uppercase tracking-widest`) |
| Peer Detail TRUST source | `configured in pim.toml` (static peer) or `paired via discovery` (discovery peer) — D-17 verbatim |
| Peer Detail TROUBLESHOOT empty | `No events recorded this session` — D-17 verbatim |
| Peer Detail failed-peer callout | `{HH:mm:ss}  ✗ pair_failed  reason: {reason}` with reason in `text-destructive` |
| Peer Detail is_gateway value | `yes (egress)` or `no` |
| Pair Approval inbound title | `{label_announced ?? short_id} wants to join your mesh.` (trailing period, UI-SPEC verbatim) |
| Pair Approval outbound title | `Pair with {label ?? short_id} via {mechanism}?` (trailing question mark) |
| Pair Approval node ID line | `↳ node ID: {shortId}` with shortId span in `text-accent` |
| Pair Approval inbound mechanism line | `↳ via {mechanism}` |
| Pair Approval show-full toggle | `[ show full ]` / `[ show short ]` |
| Pair Approval primary action | `[ Trust and connect ]` — Button variant="default" (primary green) |
| Pair Approval inbound secondary | `[ Decline ]` — Button variant="secondary" |
| Pair Approval outbound secondary | `[ Cancel ]` — Button variant="secondary" |
| Queue log line (D-22, console only) | `pair queue: {N} waiting` |

## Decisions Made

1. **Shell-level overlay mount chosen over Dashboard-level mount.** PeerDetailSheet and PairApprovalModal are mounted once at ActiveScreen as siblings of the active `<section>`. Alternative considered: mount inside Dashboard. Rejected because the Dashboard unmounts when the user switches to Logs (⌘5), which would dismiss an open peer sheet or mid-flow pair modal. Shell-level mount keeps overlay state alive across ⌘1/⌘2/⌘5 switches and gives them a stable place to live as Phase 3 adds more screens.
2. **Sheet primitive is REWRITTEN wholesale after generation.** The shadcn generator emits `rounded-xs`, `shadow-lg`, `bg-background`, and a lucide `XIcon` — four simultaneous brand violations. Rather than patch each one, the file is fully rewritten preserving the Radix wrapper structure. This also lets us replace `radix-ui` with the already-present `@radix-ui/react-dialog` if a future plan wants to shed the meta-package dep.
3. **`usePeerTroubleshootLog` registers a SECOND peers.event handler.** Plan 02-01's reactive spine already registers one handler (for the in-place peers merge). The W1 fan-out's `eventHandlers: Map<event, Set<Handler>>` structure supports multiple handlers per event, and each one fires on every payload. The troubleshoot log handler processes every peers.event and buffers by node_id — independent of the spine's merge logic. This is why the W1 grep still returns `0` / `2` after this plan.
4. **D-22 queue uses `setTimeout(openNext, 0)` to advance.** Radix Dialog focus-trap cleanup + Dialog unmount animations can race with an immediate remount. The microtask defer gives React one commit cycle to flush the close state before the next open fires, which avoids a momentary double-dialog flash and keeps the focus trap handoff clean.
5. **Anonymous inbound pair-events are dropped at the hook, not shown.** D-20 says "anonymously-announced entries still get a Pair action because the modal shows the warning and lets the user consent (but this is advanced — Phase 2 can choose to hide Pair on anonymous rows; default: hide, defer pairing to a future phase)". Given the `usePairApproval` subscription sees `discovered` events from the daemon (not just the ones a user clicks on), dropping `node_id === null` entries at the hook layer matches the Nearby-row layer (which already hides `[ Pair ]` per D-20). Consistent layering.
6. **Pair Approval `[ Trust and connect ]` uses `variant="default"` (primary green), NOT accent.** Explicitly called out in UI-SPEC §Color "Do NOT use accent for: Pair Approval [ Trust and connect ] action". The shortId span inside the description uses `text-accent` (reserved-list item 4) — that's the ONLY accent use inside the modal.
7. **Bang-free source files, phase-2 continuation.** The per-file `! grep -q '!'` gate introduced in Plan 02-03 is preserved here. All TypeScript negations (`!==`, logical `!`) are rewritten as `=== x ? y : z` ternaries or explicit `null`/`undefined` checks. The cost is slightly more verbose source; the benefit is the "no exclamation marks in user-facing copy" rule reduces to a trivial grep per file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Doc-comment grep false-positives on `rounded-*`, banned action names, and `!`**

- **Found during:** Tasks 1, 2, 3 verification sweeps.
- **Issue:** The plan's acceptance criteria use literal `grep -q` / `! grep -q` assertions (e.g. `! grep -q "rounded-" src/components/ui/sheet.tsx`, `! grep -q "Retry\|Forget peer\|Trust this peer" src/components/peers/peer-detail-sheet.tsx`, `! grep -q "!" src/components/peers/pair-approval-modal.tsx`). My first-pass doc comments described the banned patterns by quoting them literally (e.g. "NO rounded-*, NO gradients", "Phase-3 actions (Retry / Trust this peer / Forget peer) are OMITTED", "NO exclamation marks, NO rounded-*"). Each quoted pattern tripped the corresponding sweep.
- **Fix:** Reworded comments to describe the forbidden patterns in prose without quoting them — "zero border radius" instead of "no rounded-*", "Phase-3 peer-action affordances" instead of listing action names, "Brand rules: zero border radius, no gradients, no literal palette colors, no exclamation marks" instead of "NO exclamation marks, NO rounded-*, ...". Informational intent preserved; grep sweeps clean.
- **Files modified:** `src/components/ui/sheet.tsx`, `src/components/peers/peer-detail-sheet.tsx`, `src/components/peers/pair-approval-modal.tsx`.
- **Verification:** All acceptance greps green after rewording.
- **Committed in:** `f663e99` (Task 1, proactive), `d2d2044` (Task 2, inline fix), `f7f2091` (Task 3 follow-up, separate refactor commit because Task 3 was already pushed).

**2. [Rule 3 - Blocking] TypeScript negation operators trip the "no exclamation mark" grep**

- **Found during:** Tasks 2 and 3 sweeps on `peer-detail-sheet.tsx` and `pair-approval-modal.tsx`.
- **Issue:** The plan's per-file `! grep -q "!"` acceptance gate is strict — any `!` character in source fails the check. My initial writes used idiomatic TypeScript `x !== null`, `x !== undefined`, `!onSelect` / `!busy`, and `.filter(e => e !== failedEvent)`. Each tripped the sweep.
- **Fix:** Rewrote all negations using bang-free patterns: `x !== null` → `x === null ? false : true` or `x === null ? a : b`, `!x` → `x === undefined ? y : z`, `.filter(e => e !== foo)` → `.filter(e => (e === foo ? false : true))`, boolean checks flipped via `=== true` / `=== false`. More verbose but mechanical.
- **Files modified:** `src/components/peers/peer-detail-sheet.tsx`, `src/components/peers/pair-approval-modal.tsx`.
- **Verification:** `grep -q "!" <file>` returns exit code 1 (no matches) for both files.
- **Committed in:** `d2d2044` and `a7f8d35` (inline in their respective task commits).

**3. [Rule 3 - Blocking] Shadcn `sheet.tsx` generator emits four brand violations simultaneously**

- **Found during:** Task 1, immediately after `pnpm dlx shadcn@latest add sheet --yes`.
- **Issue:** The generated file contained `rounded-xs` on the close button, `shadow-lg` on `SheetContent`, `bg-background` (not `bg-popover`), and a lucide `<XIcon className="size-4" />` instead of the `×` (U+00D7) glyph required by UI-SPEC §Peer Detail slide-over close. All four of these violate explicit brand rules.
- **Fix:** Full rewrite of the generated `sheet.tsx` preserving the Radix wrapper structure but applying every override required by UI-SPEC §Registry Safety: `bg-popover`, `border-l border-border` on `side="right"`, no shadows, no rounded anywhere, `font-mono uppercase tracking-wider font-semibold` on SheetTitle, `× aria-hidden` literal close glyph with `aria-label="close peer detail"`. Same approach shadcn users recommend for heavily themed projects.
- **Files modified:** `src/components/ui/sheet.tsx`.
- **Verification:** `! grep -q "rounded-\|shadow-" src/components/ui/sheet.tsx` + positive asserts on `bg-popover`, `border-border`, `font-mono`, `aria-label` all green.
- **Committed in:** `f663e99` (Task 1 commit includes the post-generation rewrite).

---

**Total deviations:** 3 auto-fixed (3 blocking issues; 0 bugs; 0 missing critical)
**Impact on plan:** All fixes are mechanical reconciliations between the plan's strict grep gates and the realities of (a) doc-comment prose wanting to describe what NOT to do, (b) idiomatic TypeScript negation operators, and (c) shadcn generator output vs. pim brand rules. No scope change, no new external dependency beyond `radix-ui` (which `npx shadcn add` pulled in and is transitively required), no architectural deviation.

## Issues Encountered

- **shadcn registry was slow.** `pnpm dlx shadcn@latest add sheet --yes` spent ~90 s on network fetches (`ERR_SOCKET_TIMEOUT` / slow `registry.npmjs.org` responses for `execa`, `fs-extra`, `diff`, `@modelcontextprotocol/sdk`, `@dotenvx/dotenvx`). Completed successfully, just slow. Ran in the background while I read the remaining context files.
- **No pnpm or runtime issues** — the installed `radix-ui` meta-package coexists fine with the already-present `@radix-ui/react-dialog`. `pnpm typecheck` clean from Task 2 onward.

## User Setup Required

None — this plan is pure frontend composition. No new env vars, no new services, no new permissions. `radix-ui` was added as a dep but `pnpm install` is already satisfied by the shadcn command that introduced it.

## Human-verify sub-note

Plan 02-06 is the phase's full human-verify checkpoint. Plan 02-04 is component-level — the surfaces it adds will be exercised in 02-06 by:

1. Launching `pnpm tauri dev`, waiting for the Dashboard.
2. Clicking a connected-peer row in the Peers panel → PeerDetailSheet opens with that peer's data, `[ show full ]` toggles 8-char ↔ 64-char id, Esc/×/click-outside closes it.
3. With a second peer transmitting, clicking `[ Pair ]` on its Nearby row → PairApprovalModal opens in outbound mode, `[ Trust and connect ]` calls `peers.pair({ trust: "persist" })` and closes; `[ Cancel ]` closes without RPC.
4. Triggering an inbound pair-request (second peer announces via broadcast) → modal opens in inbound mode with `{label} wants to join your mesh.`.
5. Stacking two inbound pair-requests rapidly → first opens a modal, second enqueues; console shows `pair queue: 1 waiting`; closing the first advances to the second (D-22).

## Known Stubs

None.

- All rendered copy comes from UI-SPEC §Peer Detail slide-over / §Pair Approval modal verbatim.
- The `full node id unavailable` line in `pair-approval-modal.tsx` is a defensive fallback for the edge case where an anonymous trigger reaches the modal (already filtered at the hook) — honest disclosure, not a placeholder.
- The troubleshoot-log Section 4 empty state `No events recorded this session` is D-17-verbatim copy for the truly-no-events case.

## Next Phase Readiness

- **Plan 02-05 (Logs tab) unblocked.** Shell overlays mount at ActiveScreen level; Plan 02-05 only needs to replace the `case "logs":` branch inside `renderScreen()` with the real `<LogsScreen />`. The PeerDetailSheet + PairApprovalModal will remain live above the Logs tab automatically because they're siblings of the active `<section>`.
- **Plan 02-06 (toast wiring + checkpoint) unblocked.** The reactive spine's `snapshot.subscriptionError` (Plan 02-01) has nothing new from this plan to worry about; the two subscriptions added by 02-04's hooks (one via `usePeerTroubleshootLog`, one via `usePairApproval`) use the same W1 fan-out and would populate `snapshot.subscriptionError` identically if Rust ever started rejecting `peers.event` subscribes.
- **D-31 toast surface** needs to be added in Plan 02-06; this plan touches nothing in that path.
- **No new blockers.** W1 contract verified on disk; brand-token policy verified per file.

## Self-Check: PASSED

Verified:
- All 7 created files present on disk (`src/components/ui/sheet.tsx`, `src/components/peers/{kv-row,peer-detail-sheet,pair-approval-modal}.tsx`, `src/hooks/{use-peer-detail,use-peer-troubleshoot-log,use-pair-approval}.ts`).
- Modified file updated (`src/components/shell/active-screen.tsx` contains `PeerDetailSheet`, `PairApprovalModal`, `onPeerSelect`).
- All 4 task commits present in `git log` (hashes `f663e99`, `d2d2044`, `a7f8d35`, `f7f2091`).
- `pnpm typecheck` exits 0.
- W1 invariant: `grep -c 'listen(' src/lib/rpc.ts` returns `0`; `grep -c 'listen(' src/hooks/use-daemon-state.ts` returns `2`.
- Sheet brand override: `bg-popover` present, `rounded-` absent, `shadow-` absent, `font-mono` on SheetTitle, `aria-label="close peer detail"` on × button.
- PeerDetailSheet copy: `show full`, `configured in pim.toml`, `paired via discovery`, `No events recorded this session`, `troubleshoot log`, `w-[480px]`, `side="right"` all grep-present.
- No Phase-3 actions in PeerDetailSheet (`! grep -q "Retry\|Forget peer\|Trust this peer"` clean).
- PairApprovalModal copy: `wants to join your mesh`, `Pair with `, `[ Trust and connect ]`, `[ Decline ]`, `[ Cancel ]`, `text-accent` (for short_id), `callDaemon("peers.pair"`, `trust: "persist"` all grep-present.
- Shell wiring: `PeerDetailSheet`, `PairApprovalModal`, `onPeerSelect` all present in `active-screen.tsx`.
- Brand guards phase-wide: no `!` in the three bang-sensitive files, no `rounded-*` in any new file, no literal palette colors (`text-(green|red|blue|yellow)-[0-9]`) anywhere in `src/components/peers/` or the three new hooks.
- PEER-04 + PEER-06 requirement IDs in frontmatter for `requirements mark-complete` to pick up.

---
*Phase: 02-honest-dashboard-peer-surface*
*Completed: 2026-04-24*
