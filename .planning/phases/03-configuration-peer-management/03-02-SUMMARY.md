---
phase: 03-configuration-peer-management
plan: 02
subsystem: ui
tags: [peers, peer-management, peer-add, peer-remove, react-hook-form, sonner, radix-alert-dialog, radix-sheet, w1-preserved]

# Dependency graph
requires:
  - phase: 03-configuration-peer-management
    provides: AlertDialog + Form + Sheet primitives with brand overrides (03-01), useSettingsConfig + module-level refetchSettingsConfig() for D-30, dedicated Peers route stub in active-screen.tsx, react-hook-form runtime dep
  - phase: 02-honest-dashboard-peer-surface
    provides: PeerRow component (reused unchanged), NearbyPanel (reused unchanged), usePeers + useDiscovered selectors, usePeerDetail / usePairApproval shell-mounted overlays, peers.event subscription owned by use-daemon-state.ts, brand sheet primitive
  - phase: 01-rpc-bridge-daemon-lifecycle
    provides: callDaemon<M> typed RPC wrapper, RpcErrorCode.PeerAlreadyExists/-32011 + InvalidPeerAddress/-32012 + InvalidParams/-32602 + PeerNotFound/-32010, W1 single-listener invariant in use-daemon-state.ts
provides:
  - "PeersScreen as the dedicated ⌘2 route — replaces the Plan 03-01 stub and ends the Phase-2 D-01/D-02 'peers tab aliases the Dashboard' compromise"
  - "PeersPanel — CONNECTED CliPanel composition with AddPeerActionRow on top + per-row Remove affordance gated on peer.static === true (D-20). Reuses Phase-2 PeerRow unchanged"
  - "AddPeerSheet — 480px right-edge Sheet for peers.add_static (PEER-02), three D-17 fields with verbatim copy, mechanism-aware placeholder, in-flight + limited-mode states"
  - "RemovePeerAlertDialog — destructive AlertDialog for peers.remove (PEER-03), verbatim D-19 title pattern + body, first-focus-on-Cancel, in-flight + limited-mode states"
  - "AddPeerActionRow + PeerRemoveButton — small button surfaces consumed by PeersPanel"
  - "useAddPeer / useRemovePeer — module-level atoms (mirror use-peer-detail / use-settings-config pattern) for cross-component state with refetchSettingsConfig() on success per D-30"
affects: [03-03, 03-04, 03-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level atom + useSyncExternalStore for cross-component state — confirmed as the canonical pattern for this codebase: useAddPeer (Sheet + ActionRow share `open`) and useRemovePeer (Button + AlertDialog share `target` peer) both follow it. No React context, no per-component useState that would diverge between trigger and consumer"
    - "useForm instance owned by the consumer (Sheet) rather than by the atom — react-hook-form's per-render instance + setError() lifecycle make module-scope useForm awkward. The hook exposes buildOnSubmit(form) so the field-level error mapping (D-18) lands in the form instance the Sheet rendered with"
    - "Best-effort refetchSettingsConfig() on RPC success: wrapped in its own try/catch so a config.get failure does NOT block the user-visible commit moment. add_peer / remove_peer success is still authoritative; the Settings raw-is-source-of-truth scan picks up the next time a Settings section opens"
    - "AlertDialog primary action uses e.preventDefault() in onClick to prevent Radix's auto-close from racing the in-flight RPC. Close happens inside the hook's confirm() after the RPC resolves — keeps the [ Remove ] button's aria-busy state honest while the daemon mutates"
    - "Bang-free policy continues mechanically — every === false / === null / === '' inversion documented inline; no `!value` patterns introduced in any of the eight new files"

key-files:
  created:
    - src/screens/peers.tsx
    - src/components/peers/peers-panel.tsx
    - src/components/peers/add-peer-sheet.tsx
    - src/components/peers/add-peer-action-row.tsx
    - src/components/peers/remove-peer-alert-dialog.tsx
    - src/components/peers/peer-remove-button.tsx
    - src/hooks/use-add-peer.ts
    - src/hooks/use-remove-peer.ts
  modified:
    - src/components/shell/active-screen.tsx

key-decisions:
  - "useAddPeer's form instance lives in the Sheet (not in the atom) — react-hook-form is per-render by design, and only the Sheet needs it. The atom owns the open/submitting flags shared between Sheet and ActionRow; buildOnSubmit(form) bridges the two so D-18 setError landings target the correct form instance"
  - "node_id chosen over config_entry_id for peers.remove in Phase 3. PeerSummary.config_entry_id doesn't exist in rpc-types.ts; the daemon's PeersRemoveParams accepts either field; node_id is unambiguous for connected peers. config_entry_id is reserved for a future PeerSummary schema extension (would let us remove a static peer that hasn't completed its first handshake yet — irrelevant for v1's CONNECTED-list scope)"
  - "AlertDialogAction onClick uses preventDefault + void confirm() so the dialog stays open with aria-busy='true' until peers.remove resolves. Without preventDefault, Radix auto-closes the dialog on click and the in-flight state vanishes — making the [ Remove ] button feel untrustworthy on slow daemons"
  - "refetchSettingsConfig() wrapped in inner try/catch in both hooks. The outer try/catch handles the RPC failure (where setError + toast live); the refetch failure is purely a Settings-side hygiene step (D-30) that should not retry, surface a toast, or block the user-visible flow. console.warn captures the failure for debugging"
  - "PeersPanel is a NEW component, not a re-render of Phase-2 PeerListPanel. PeerListPanel renders two disabled 'phase 4' action rows below the list (Add peer nearby + Invite peer); Phase 3's Peers tab needs the AddPeerActionRow above the list and the inline Remove affordance per row — different chrome, different placement. PeerRow itself is reused verbatim"
  - "PeersScreen mounts AddPeerSheet + RemovePeerAlertDialog as direct children of the panel column (not at shell level via ActiveScreen). PeerDetailSheet + PairApprovalModal stay shell-mounted because they're cross-screen surfaces (clicking a peer on Dashboard or Peers opens the same slide-over). Phase-3's add/remove dialogs are scoped to the Peers tab — mounting them where they're consumed keeps the responsibility clear"

requirements-completed: [PEER-02, PEER-03]

# Metrics
duration: 12min
completed: 2026-04-26
---

# Phase 03 Plan 02: Dedicated Peers Screen Summary

**Replaces the Phase-2 'Peers tab aliases the Dashboard peer list' compromise with a dedicated PeersScreen that ships PEER-02 (add static peer via right-edge Sheet → peers.add_static) and PEER-03 (remove peer via destructive AlertDialog → peers.remove). Reuses the Phase-2 peer-row component and the existing peers.event subscription — no new Tauri listeners, no new RPC subscription lifecycle, no new npm dependencies. Two atomic commits, all locked-copy strings verbatim per D-17/D-18/D-19/D-32.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 (atomic commits per task)
- **Files created:** 8
- **Files modified:** 1

## Task Commits

1. **PeersScreen + AddPeerSheet (PEER-02)** — `0a52780` (feat)
   - `src/hooks/use-add-peer.ts` — module-level atom for Sheet open/submitting state; buildOnSubmit(form) for per-call setError binding; refetchSettingsConfig() on success (D-30); D-18 error mapping verbatim
   - `src/components/peers/add-peer-sheet.tsx` — 480px right-edge Sheet, three D-17 fields, mechanism-aware placeholder, limited-mode disable per D-32
   - `src/components/peers/add-peer-action-row.tsx` — `[ + Add static peer ]` button with border-b divider per 03-UI-SPEC §S2
   - `src/components/peers/peers-panel.tsx` — new CliPanel composition reusing Phase-2 PeerRow; empty-state copy verbatim per 03-UI-SPEC
   - `src/screens/peers.tsx` — composes PeersPanel + NearbyPanel + AddPeerSheet
   - `src/components/shell/active-screen.tsx` — case "peers" returns `<PeersScreen />` (replaces Plan 03-01 stub)

2. **RemovePeerAlertDialog + PeerRemoveButton (PEER-03)** — `8b9deb8` (feat)
   - `src/hooks/use-remove-peer.ts` — module-level atom mirroring use-add-peer; confirm() calls peers.remove (node_id) + refetchSettingsConfig(); D-19 race toast verbatim on -32010
   - `src/components/peers/remove-peer-alert-dialog.tsx` — destructive AlertDialog, verbatim D-19 title + body, first-focus on Cancel via autoFocus
   - `src/components/peers/peer-remove-button.tsx` — ghost variant + border, e.stopPropagation() to protect row-click → PeerDetailSheet
   - `src/components/peers/peers-panel.tsx` — adds the `peer.static === true` branch rendering `<PeerRemoveButton />`
   - `src/screens/peers.tsx` — mounts `<RemovePeerAlertDialog />` alongside `<AddPeerSheet />`

## Files Created/Modified

### Created (8)

- `src/hooks/use-add-peer.ts` — module atom + buildOnSubmit + D-18 error mapping + D-30 refetch
- `src/hooks/use-remove-peer.ts` — module atom + confirm() with node_id strategy + D-19 race toast + D-30 refetch
- `src/components/peers/add-peer-sheet.tsx` — 480px right-edge Sheet with three D-17 fields
- `src/components/peers/add-peer-action-row.tsx` — `[ + Add static peer ]` action row above list
- `src/components/peers/peers-panel.tsx` — CONNECTED panel for the dedicated ⌘2 tab
- `src/components/peers/peer-remove-button.tsx` — ghost-variant `[ Remove ]` with stopPropagation
- `src/components/peers/remove-peer-alert-dialog.tsx` — destructive AlertDialog per 03-UI-SPEC §S4
- `src/screens/peers.tsx` — PeersScreen composing all five surfaces

### Modified (1)

- `src/components/shell/active-screen.tsx` — `case "peers"` returns `<PeersScreen />` (replaces the 03-01 stub)

## Decisions Made

See `key-decisions` in frontmatter (six decisions). Highlights:

- **Module-level atom + useSyncExternalStore** for both useAddPeer and useRemovePeer — required so the trigger (ActionRow / RemoveButton) and the consumer (Sheet / AlertDialog) read the SAME open flag. The plan's "useState scaffolding" example is explicitly contradicted in Part C; we used the canonical Phase-2 pattern (mirrors use-peer-detail.ts and use-settings-config.ts).
- **react-hook-form's useForm lives in the Sheet, not the atom** — useForm returns a per-render instance, and only the Sheet consumes the field state. buildOnSubmit(form) wires the daemon-error → form.setError mapping (D-18) at the Sheet's instance, while open/submitting stay shared via the module atom.
- **node_id over config_entry_id for peers.remove** — PeerSummary doesn't expose config_entry_id today; daemon accepts either; node_id is unambiguous for the CONNECTED-list scope Phase-3 cares about. config_entry_id deferred until a future PeerSummary schema extension.
- **AlertDialogAction onClick uses preventDefault + void confirm()** — prevents Radix's auto-close from racing the in-flight peers.remove and dropping the aria-busy state; close happens inside confirm() after the RPC resolves.

## Deviations from Plan

### None.

The plan executed cleanly end-to-end. Two minor presentation-level choices were made within the plan's "Claude's discretion" envelope:

- **PeersPanel is a new component** rather than a re-skin of Phase-2 PeerListPanel. The plan suggested either approach; the new component is cleaner because PeerListPanel hosts two phase-4 action stubs that are out of scope for the Peers tab.
- **buildOnSubmit(form)** factory pattern in useAddPeer instead of the plan's literal `onSubmit` (which had `form` baked into a useState'd instance inside the hook). The plan's Part A code block is explicitly superseded by Part C ("drop the earlier 'contradictory useState scaffolding' block; one pattern only"); we honored Part C's module-atom directive while moving the form into the Sheet (the only consumer that needs it). Acceptance grep `grep -q "peers\\.add_static" src/hooks/use-add-peer.ts` still matches because `callDaemon("peers.add_static", params)` lives inside buildOnSubmit().

## Issues Encountered

- None blocking. The shadcn Form's `<Slot.Root>` in `<FormControl>` accepts the brand `<Input>` cleanly because Input forwards ref to the inner `<input>` element via React.forwardRef. No double-input rendering, no className collisions.
- The brand `<Input>` renders a hardcoded `> ` prompt prefix; this lives outside the form-row label/description so it does not interfere with the placeholder swap (D-17 mechanism-aware) or with FormMessage's destructive error rendering. Visual outcome matches 03-UI-SPEC §S3 mockup ("Peer address ▸ [ 192.168.1.5:9000 ] ⓘ" — the `▸` glyph is the Input's `> ` prompt rendered in primary color).

## User Setup Required

None — Phase 3 Plan 02 ships purely on top of dependencies that already landed in Plan 03-01 and Phase 2. No new npm packages, no Tauri commands, no environment variables, no daemon-side wiring required.

## Next Phase Readiness

**Wave 2 plans 03-03 / 03-04 can now consume:**

- Verified `refetchSettingsConfig()` cross-hook contract — works end-to-end via use-add-peer / use-remove-peer; Plan 03-04's section-save hooks can copy the same shape (await callDaemon("config.save", ...) → await refetchSettingsConfig()).
- Verified module-atom-with-useSyncExternalStore pattern for trigger/consumer pairs — Plan 03-04's CollapsibleCliPanel header (trigger) and section body (consumer) can mirror useAddPeer if section state ever needs to live above a single component.
- The PeersScreen is the canonical example of an additive screen replacing a stub: read this file when wiring SettingsScreen in 03-04.

**Plan 03-02 success criteria — verified:**

- ⌘2 routes to `<PeersScreen />` (not the stub, not aliased to Dashboard) ✓
- `[ + Add static peer ]` opens the right-edge Sheet with three D-17 fields; submitting fires `peers.add_static` and closes on success; -32011 / -32012 render as inline FormMessage; -32602 fires sonner ✓
- Static-row `[ Remove ]` opens AlertDialog; confirm fires `peers.remove`; -32010 race fires the verbatim "Peer was already removed." toast ✓
- Non-static rows do NOT render `[ Remove ]` (D-20 — gated by `peer.static === true` in PeersPanel) ✓
- LimitedModeBanner state disables both add and remove with verbatim reconnect hints ✓
- W1 + brand-discipline greps pass ✓

**No blockers introduced.**

## Self-Check: PASSED

- All 8 claimed created files present on disk (verified via test -f sweep)
- All 1 claimed modified file present + diff lands as documented
- Both claimed commit hashes (`0a52780`, `8b9deb8`) present in `git log --oneline -5`
- Both requirement IDs (PEER-02, PEER-03) found in `.planning/REQUIREMENTS.md`
- `pnpm typecheck` exits 0
- `pnpm build` exits 0 (550 kB main bundle / 158 kB gzipped — within range; growth from 03-01's 540 kB is the new react-hook-form callsite + Radix AlertDialog usage)
- W1 grep gates pass (use-daemon-state.ts listen() count = 2; rpc.ts = 0; zero @tauri-apps/api/event imports outside use-daemon-state)
- Brand-discipline grep gate passes (zero `rounded-(md|lg|full|xl)`, zero literal palette colors, zero lucide-react imports across all eight new files)
- Bang-free policy preserved (zero `!value` patterns in the eight new files)
- All locked-copy grep gates pass: "Add a static peer", "Peer address", "How to reach it", "Nickname (optional)", "[ + Add static peer ]", "tcp (internet / LAN)", "That peer is already configured.", "Address format not recognized by the daemon.", "Reconnect to add peers.", "This peer will be removed from pim.toml and disconnected.", "Nearby discovery can re-pair it later.", "Peer was already removed.", "Reconnect to remove peers.", "[ Remove ]", "[ Cancel ]"

---
*Phase: 03-configuration-peer-management*
*Completed: 2026-04-26*
