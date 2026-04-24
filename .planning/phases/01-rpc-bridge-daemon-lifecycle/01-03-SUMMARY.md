---
phase: 01-rpc-bridge-daemon-lifecycle
plan: 03
subsystem: ui-daemon-lifecycle
tags: [react, hook, context, tauri-events, brand, dialog, tdd]

# Dependency graph
requires: [01-01, 01-02]
provides:
  - useDaemonState hook — single source of truth for DaemonSnapshot + actions
  - W1-compliant single-listener design (exactly 2 `listen()` calls in whole app)
  - TunPermissionProvider + useTunPermission (B2 — exactly one modal in DOM)
  - DaemonStatusIndicator with internal 1Hz uptime tick (W3)
  - DaemonToggle (5-state matrix)
  - LimitedModeBanner (5 variants + verbatim UI-SPEC copy)
  - StopConfirmDialog (singular/plural peer count)
  - shadcn Dialog primitive with PIM brand overrides
  - Badge `muted` variant for CliPanel [...] reconnecting state
affects: [01-04, 02-*, 03-*, 04-*, 05-*]

# Tech tracking
tech-stack:
  added:
    - "@radix-ui/react-dialog ^1.1.4 (resolved to 1.1.15)"
  patterns:
    - "Module-level atom + useSyncExternalStore for shared React state across many consumers with zero prop drilling"
    - "W1 single-listener: one global Tauri event subscription per event name; fan-out via Map<eventName, Set<handler>>"
    - "B2 modal-provider: provider owns the promise resolver (useRef); consumers receive only requestPermission() via context"
    - "W3 internal tick: UI components own their own setInterval for live counters (uptime) instead of relying on parent re-renders"
    - "Brand-override Dialog: rounded-none, bg-background/80 overlay NO blur, box-drawing border-b/border-t dividers, Geist Mono titles"
    - "TDD with compile-only type tests (@ts-expect-error-free contract asserts) — zero runtime cost, still caught by tsc --noEmit"

key-files:
  created:
    - src/hooks/use-daemon-state.ts
    - src/hooks/use-daemon-state.test.ts
    - src/components/brand/daemon-status.tsx
    - src/components/brand/daemon-toggle.tsx
    - src/components/brand/limited-mode-banner.tsx
    - src/components/brand/tun-permission-modal.tsx
    - src/components/brand/tun-permission-modal.test.ts
    - src/components/brand/stop-confirm-dialog.tsx
    - src/components/ui/dialog.tsx
  modified:
    - package.json (added @radix-ui/react-dialog)
    - pnpm-lock.yaml
    - src/components/ui/badge.tsx (added `muted` variant)

key-decisions:
  - "useSyncExternalStore module-level atom beats React Context for the DaemonSnapshot — every consumer needs the SAME live value, Context would force a top-level provider dance and the atom is literally one hook import"
  - "Provider-mounted single modal (B2) over local-modal-per-consumer — the resolver promise must bind to the DOM-resident modal, which only the provider owns"
  - "Internal setInterval in DaemonStatusIndicator (W3) instead of parent-computed uptime — keeps the hero counter honest when no daemon event arrives for 5+ seconds"
  - "useRef (not useState) for the permission resolver — it's not render state, just a mutable slot the grant/skip handlers close over"
  - "I2: VIEW LOGS button hidden when no handler is passed — Phase 1 shouldn't render a dead button; Phase 2 wires it up"

patterns-established:
  - "Snapshot-over-flags: every UI component reads `snapshot.state`, never ad-hoc booleans — the 5-state machine is the contract"
  - "Every START path in the app gates through useTunPermission().requestPermission() — grep for `requestPermission` finds both DaemonToggle + LimitedModeBanner"
  - "Every new bordered surface uses `rounded-none` explicitly; every color token references CSS variables (bg-primary, text-destructive, border-border) — no raw Tailwind colors"

requirements-completed: [RPC-03, DAEMON-03]

# Metrics
duration: "~22 min"
completed: 2026-04-24
---

# Phase 1 Plan 3: useDaemonState Hook + Limited-Mode UI Surfaces Summary

**The React layer that turns the Rust RPC bridge into honest, live UI. One shared hook (`useDaemonState`) with a W1-compliant single Tauri listener design, five brand surfaces from 01-UI-SPEC (status chip, toggle, banner, TUN permission modal, stop-confirm dialog), a B2-safe provider pattern that mounts exactly one modal app-wide, and a W3 self-ticking uptime counter.**

## Accomplishments

- **`src/hooks/use-daemon-state.ts`** — Module-level atom (`snapshot`, `stopConfirmOpen`, `listeners` Set) + `useSyncExternalStore`. Owns the two Tauri subscriptions app-wide (`DaemonEvents.stateChanged`, `DaemonEvents.rpcEvent`). Fan-out to per-event subscribers through `eventHandlers: Map<RpcEventName, Set<handler>>`. `peerCount` computed from `status.peers.filter(p => p.state === "active").length`. `actions.stop()` gates on `peerCount > 0` to open the confirm dialog; `confirmStop()` then invokes `stopDaemon()` directly.
- **`src/components/brand/daemon-status.tsx`** — 5-state glyph chip (`○ ◐ ● ◐ ✗`) with brand-token colors (`text-muted-foreground` / `text-accent` / `text-primary phosphor` / `text-accent` / `text-destructive`). W3: takes `baselineSeconds` + `baselineTimestamp` and self-ticks with `setInterval(1000)` while `state === "running"`. `formatUptime` covers <60s / <1h / <24h / ≥24h. ARIA: `role="img"` on glyph, `aria-live="polite"` on label.
- **`src/components/brand/tun-permission-modal.tsx`** — B2 provider pattern. `TunPermissionProvider` mounts one modal internally; `useTunPermission()` throws if used outside the provider. Resolver stored in `useRef`. `sessionStorage` memoizes a granted permission for the current page session.
- **`src/components/brand/daemon-toggle.tsx`** — 5-state rendering matrix from 01-UI-SPEC §Surface 2. START/STOP/STARTING…/RECONNECTING…/RETRY START. Variants: `default` / `destructive` / `secondary`. Sizes: `lg` for start/retry, `default` for stop/reconnecting. Calls `useTunPermission().requestPermission()` before `actions.start()`. `aria-disabled + aria-busy` while transient.
- **`src/components/brand/limited-mode-banner.tsx`** — Renders when `state !== "running"`. 5 variants: LIMITED MODE (stopped), STARTING DAEMON… (starting), RECONNECTING… (reconnecting), DAEMON ERROR (error, destructive), DAEMON STOPPED UNEXPECTEDLY (external-kill heuristic, destructive). 2px left border (`border-l-accent` or `border-l-destructive`) — the only Phase 1 surface where border-width exceeds 1px. B2: START also gates through `useTunPermission()`. I2: `[ VIEW LOGS ]` button only renders when `onOpenLogs` prop is passed.
- **`src/components/brand/stop-confirm-dialog.tsx`** — Fires from `snapshot.stopConfirmOpen`. Singular (`1 connected peer will disconnect.`) vs plural (`3 connected peers will disconnect.`) body. `[ STOP DAEMON ]` (destructive) + `[ KEEP RUNNING ]` (ghost).
- **`src/components/ui/dialog.tsx`** — PIM-brand-overridden shadcn Dialog. `rounded-none`, `bg-background/80` overlay NO blur, Geist Mono titles, `border-b`/`border-t` dividers between header / body / footer (box-drawing discipline). 8 exports: Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription.
- **`src/components/ui/badge.tsx`** — Added `muted` variant (`bg-muted text-muted-foreground border-muted`) for the `[...]` reconnecting badge Plan 04 will render on the CliPanel header.

## Task Commits

1. **Task 1:** `c3b1726` — feat(01-03): add shadcn Dialog primitive + Badge muted variant
2. **Task 2 RED:** `92c01d9` — test(01-03): add failing type test for useDaemonState hook contract
3. **Task 2 GREEN:** `3b84524` — feat(01-03): useDaemonState hook (single-listener W1) + DaemonStatusIndicator
4. **Task 3 RED:** `1f63a25` — test(01-03): add failing type test for TunPermissionProvider contract
5. **Task 3 GREEN:** `8fe31e8` — feat(01-03): TunPermissionProvider (B2) + DaemonToggle + LimitedModeBanner + StopConfirmDialog

**Plan metadata commit:** added as the final step below.

## W1 Note (Single-Listener Contract)

**`useDaemonState` is the sole owner of the two Tauri event subscriptions in the whole app.**

```
grep -c 'listen(' src/hooks/use-daemon-state.ts   # => 2
grep -c 'listen(' src/lib/rpc.ts                   # => 0
```

`subscribeDaemon()` (Plan 01) only invokes the Rust `daemon_subscribe` command and returns the `subscription_id`. The hook registers the per-event handler in an internal `Map<RpcEventName, Set<handler>>` before calling `subscribeDaemon`. When the single global `listen(DaemonEvents.rpcEvent)` callback fires, it looks up the set by `payload.event` and dispatches. One Tauri subscription, N logical subscribers.

Anyone onboarding: if a PR introduces a new `listen(...)` in any file other than `src/hooks/use-daemon-state.ts`, reject it. The whole app's Tauri event subscription budget is two.

## B2 Note (Modal-Provider Pattern)

**`<TunPermissionModal />` appears exactly once in the DOM.**

```
grep -rn "<TunPermissionModal" src/   # => 1 (inside TunPermissionProvider)
```

Any component that needs to prompt the user for TUN (virtual network) permission calls `useTunPermission().requestPermission()` — a context consumer hook. The provider owns the `open` state and the resolver slot (via `useRef`). Both `DaemonToggle` and `LimitedModeBanner` consume the hook; both START paths go through the same modal. Plan 04 mounts `<TunPermissionProvider>` at the app root (`src/main.tsx`).

If `useTunPermission()` is called outside the provider, it throws with a pointed message — this catches Plan 04 wiring mistakes at mount time rather than silently hanging the START promise.

## W3 Note (Self-Ticking Uptime)

**`DaemonStatusIndicator` owns its own `setInterval(1000)` while `state === "running"`.**

```
grep 'setInterval' src/components/brand/daemon-status.tsx    # => match
grep 'state !== "running"' src/components/brand/daemon-status.tsx # => match (early return)
```

Props are `(state, baselineSeconds, baselineTimestamp, errorMessage)` — NOT a pre-computed `uptimeSeconds`. Every second the component recomputes: `baselineSeconds + Math.floor((Date.now() - baselineTimestamp) / 1000)`. The interval effect depends on `[state]` so it's cleared the moment state leaves `running` (and on unmount). This keeps the uptime counter honest even when the daemon hasn't emitted a `status.event` for 5+ seconds.

## Copy Rendered (for Plan 04 copy audit)

| Surface | Copy rendered verbatim |
|---------|------------------------|
| DaemonStatusIndicator | `○ stopped` / `◐ starting…` / `● running · {formatted}` / `◐ reconnecting…` / `✗ error` (optional ` — {reason}` suffix) |
| DaemonToggle | `[ START DAEMON ]` / `[ STARTING… ]` / `[ STOP DAEMON ]` / `[ RECONNECTING… ]` / `[ RETRY START ]` (auto-bracketed by Button) |
| LimitedModeBanner headline | `LIMITED MODE` (amber) / `STARTING DAEMON…` / `RECONNECTING…` / `DAEMON ERROR` (destructive) / `DAEMON STOPPED UNEXPECTEDLY` (destructive) |
| LimitedModeBanner body (fresh stopped) | `pim daemon is stopped. Start it to join the mesh.` |
| LimitedModeBanner body (starting) | `Waiting for rpc.hello handshake.` |
| LimitedModeBanner body (reconnecting) | `Daemon socket reappeared. Restoring subscriptions.` |
| LimitedModeBanner body (external kill) | `The daemon process exited. Start it to reconnect. See docs/TROUBLESHOOTING.md §unexpected-stop.` |
| LimitedModeBanner body (error) | error.message (fallback: `pim-daemon reported an error. Start again, or inspect logs.`) |
| TunPermissionModal headline | `Grant virtual network permission` |
| TunPermissionModal body | `pim needs permission to create a virtual network connection (TUN interface). This lets the mesh route traffic on your device without sending it through a third-party server. See docs/SECURITY.md §2.1.` |
| TunPermissionModal actions | `[ SKIP FOR NOW ]` (ghost) / `[ GRANT PERMISSION ]` (primary) |
| StopConfirmDialog headline | `Stop daemon` |
| StopConfirmDialog body (peers>0) | `{N} connected peer{s} will disconnect. Routes will be torn down. You can start the daemon again at any time.` |
| StopConfirmDialog body (solo) | `pim will stop listening on the mesh until you start it again.` |
| StopConfirmDialog actions | `[ KEEP RUNNING ]` (ghost) / `[ STOP DAEMON ]` (destructive) |

## Brand Discipline Grep Results

```
grep -rnE "(rounded-md|rounded-lg|rounded-full|rounded-xl|bg-green-[0-9]|bg-red-[0-9]|bg-blue-|bg-purple-)" \
    src/components/brand/ src/components/ui/dialog.tsx src/hooks/
# => empty (zero matches)
```

Every corner is sharp (`rounded-none`), every color references a brand token (`bg-primary`, `text-destructive`, `border-border`, etc.), no blue, no purple. Verified across all new files.

## Decisions Made

- **`useSyncExternalStore` over React Context** for the daemon snapshot — Context would re-render every consumer through provider diffing; the module atom + external store gives stable identity and opt-in re-renders via the `getSnapshot` returning the same reference when nothing changed.
- **Provider-mounted single modal (B2)** over local-modal-per-consumer — the previous pattern (each component owned a modal) meant `useTunPermission()` called from DaemonToggle would open a modal that exists only in DaemonToggle's JSX, but if DaemonToggle unmounts (e.g., view switch mid-flow), the modal disappears and the promise hangs. Provider pattern fixes that class of bugs.
- **Internal tick (W3)** in `DaemonStatusIndicator` instead of parent-derived `uptimeSeconds` — previous designs passed `uptimeSeconds` as a prop, meaning the hero counter would only advance when the parent got a new daemon event. Now it ticks every second regardless of daemon chatter.
- **`useRef` for the resolver slot (I1)** — the resolver is not part of render state. `useState` would trigger a re-render whenever we swap it, which is both wasteful and could cause a render between resolver-set and modal-open leading to a lost promise. `useRef` is the right primitive.
- **I2: hide `[ VIEW LOGS ]` when no handler is passed** — Phase 1 has no logs tab yet. Rendering a dead button violates the "every surface names what it does" voice rule. Phase 2 owns this wiring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] JSDoc comments contained literal `<TunPermissionModal` substring, breaking B2 grep check**

- **Found during:** Task 3 acceptance check (`grep -rn "<TunPermissionModal" src/ | wc -l` returned 3 instead of 1)
- **Issue:** JSDoc comments in `tun-permission-modal.tsx` (module header) and `daemon-toggle.tsx` (module header) referenced `<TunPermissionModal />` pedagogically. The grep is a substring count and doesn't skip comments, so those two references counted alongside the real JSX mount inside the Provider.
- **Fix:** Rewrote both comments to use prose (`TunPermissionModal instance`) instead of a literal JSX-shaped reference. Meaning preserved, grep now correctly returns 1.
- **Files modified:** `src/components/brand/tun-permission-modal.tsx`, `src/components/brand/daemon-toggle.tsx`
- **Verification:** `grep -rn "<TunPermissionModal" src/ | wc -l` returns exactly 1 (the mount site inside `TunPermissionProvider`).
- **Committed in:** `8fe31e8` (Task 3 GREEN — adjustment made before the commit).

---

**Total deviations:** 1 auto-fixed (Rule 3 - Blocking grep-strictness adjustment). No scope creep; the design intent (exactly one modal in the DOM) was correct the first time — only the pedagogy leaked into the substring-count check.

## Known Stubs

1. **`<TunPermissionProvider>` is not yet mounted at the app root** — Plan 04 (`01-04-PLAN.md`) mounts it in `src/main.tsx`. Calling `useTunPermission()` today (e.g., in a hypothetical dev harness) will throw with a helpful message pointing to Plan 04; this is intentional — the hook should throw loudly if the provider isn't mounted.
2. **`StopConfirmDialog` and `DaemonStatusIndicator` are not yet rendered by any parent** — Plan 04 adds them to the main window layout. All the component-level behavior is present and type-checked; they just aren't on screen until Plan 04 wires them up.
3. **Runtime Tauri calls (`startDaemon`, `stopDaemon`, `listen(...)`) will 404 until the app is run inside the Tauri shell with the Rust side running** — this is expected; Plan 01-02 built the Rust surface, but the binary isn't present in `src-tauri/binaries/` until the user runs `pnpm fetch-daemon`. Plan 04's checkpoint surfaces this to the user.

## Issues Encountered

- **B2 grep-strictness adjustment** — documented above under Deviations. Resolved by rewriting two JSDoc comments.
- **Initial typecheck failure (intentional RED commits)** — both TDD tasks went RED on the first typecheck (missing implementation files), GREEN after implementation. Expected behavior; no actual bugs.

## User Setup Required

None for this plan. Plan 04's verify checkpoint is where the user runs `pnpm tauri dev` and sees the real daemon lifecycle on screen.

## Next Phase Readiness

**Ready for Plan 04.** Plan 04 needs:
- Mount `<TunPermissionProvider>` at the app root (`src/main.tsx`) wrapping `<App />` — without this, any `useTunPermission()` call throws.
- Replace the current `dashboard.tsx` placeholder with a layout that renders:
  - `<DaemonStatusIndicator state={snapshot.state} baselineSeconds={snapshot.status?.uptime_s} baselineTimestamp={snapshot.baselineTimestamp} errorMessage={snapshot.lastError?.message} />` in the top-right.
  - `<DaemonToggle />` where appropriate (header actions when running, inside the banner when stopped).
  - `<LimitedModeBanner />` above the main content (it self-unmounts when `state === "running"`).
  - `<StopConfirmDialog />` at the top of the tree (self-mounts via `stopConfirmOpen`).
  - The existing `<CliPanel>` + `<Logo>` dimmed/hidden per the honesty overlay rules in 01-UI-SPEC Surface 6.
- The hook atom is module-level, so importing `useDaemonState()` in multiple components does NOT create multiple subscriptions — the Tauri listeners ref-count on consumer mount/unmount.

## Self-Check: PASSED

Verified before declaring the plan complete:

**Files created (`[ -f ]` check):**
- `src/hooks/use-daemon-state.ts` — FOUND
- `src/hooks/use-daemon-state.test.ts` — FOUND
- `src/components/brand/daemon-status.tsx` — FOUND
- `src/components/brand/daemon-toggle.tsx` — FOUND
- `src/components/brand/limited-mode-banner.tsx` — FOUND
- `src/components/brand/tun-permission-modal.tsx` — FOUND
- `src/components/brand/tun-permission-modal.test.ts` — FOUND
- `src/components/brand/stop-confirm-dialog.tsx` — FOUND
- `src/components/ui/dialog.tsx` — FOUND

**Commits (git log check):**
- `c3b1726` — FOUND (Task 1)
- `92c01d9` — FOUND (Task 2 RED)
- `3b84524` — FOUND (Task 2 GREEN)
- `1f63a25` — FOUND (Task 3 RED)
- `8fe31e8` — FOUND (Task 3 GREEN)

**Plan verification block re-run:**
- `pnpm typecheck` — exit 0
- `pnpm build` — exit 0 (194.92 kB js / 33.52 kB css)
- `grep -c "listen(" src/hooks/use-daemon-state.ts` — `2` (W1-OK)
- `grep -c "listen(" src/lib/rpc.ts` — `0` (W1-OK)
- `grep -rn "<TunPermissionModal" src/ | wc -l` — `1` (B2-OK)
- `grep "setInterval" src/components/brand/daemon-status.tsx` — match (W3-OK)
- Brand discipline sweep — zero matches for rounded-md/lg/full/xl, bg-green-N, bg-red-N, bg-blue-*, bg-purple-*

---
*Phase: 01-rpc-bridge-daemon-lifecycle*
*Completed: 2026-04-24*
