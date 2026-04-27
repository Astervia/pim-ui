---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: executing
stopped_at: Completed 03-02-PLAN.md
last_updated: "2026-04-27T00:44:57.186Z"
last_activity: 2026-04-27
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 30
  completed_plans: 16
  percent: 65
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** One app that is honest about what the mesh is actually doing — never abstracts packets into a happy green dot — yet stays reachable enough that a first-time user can succeed in ≤ 3 interactions.
**Current focus:** Phase 03 — configuration-peer-management

## Current Position

Phase: 03 (configuration-peer-management) — IN PROGRESS
Plan: 3 of 7
Status: Ready to execute
Last activity: 2026-04-27

Progress: [███████░░░] 65%

## Performance Metrics

**Velocity:**

- Total plans completed: 1
- Average duration: 14 min
- Total execution time: 14 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-rpc-bridge-daemon-lifecycle | 1 | 14 min | 14 min |

**Recent Trend:**

- Last 5 plans: 01-rpc-bridge-daemon-lifecycle P01 (14 min)
- Trend: —

*Updated after each plan completion*
| Phase 01-rpc-bridge-daemon-lifecycle P03 | 22 min | 3 tasks | 10 files |
| Phase 01-rpc-bridge-daemon-lifecycle P04 | 15 min | 3 tasks | 7 files |
| Phase 02-honest-dashboard-peer-surface P02 | 3 | 3 tasks | 5 files |
| Phase 02-honest-dashboard-peer-surface P01 | 10 | 2 tasks | 9 files |
| Phase 02-honest-dashboard-peer-surface P03 | 7min | 3 tasks | 8 files |
| Phase 02-honest-dashboard-peer-surface P04 | 11min | 3 tasks | 9 files |
| Phase 02-honest-dashboard-peer-surface P05 | 9min | 4 tasks | 11 files |
| Phase 01.1 P03 | 7 min | 3 tasks | 4 files |
| Phase 03-configuration-peer-management P01 | 30 min | 1 tasks | 19 files |
| Phase 03-configuration-peer-management P02 | 12 min | 2 tasks | 9 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 2026-04-24: Transport is JSON-RPC 2.0 over Unix socket — Phase 1 critical path
- 2026-04-24: Mobile is full-node from day 1; v0.5+ scope, excluded from this roadmap
- 2026-04-24: Raw TOML is source of truth when editor and form diverge (1Password pattern) — informs Phase 3 CONF-06/07
- 2026-04-24: Window-first macOS; menu bar is secondary surface — informs Phase 5 UX-05
- 2026-04-24: Notifications system-fires only on critical events (all-gateways-lost, kill-switch-active) — informs Phase 5 UX-04
- [Phase 01-rpc-bridge-daemon-lifecycle]: RPC error codes as `as const` object (not TS enum) — tree-shakable, literal-unioned, no runtime IIFE
- [Phase 01-rpc-bridge-daemon-lifecycle]: W1 single-listener design: rpc.ts owns zero Tauri event subscriptions; useDaemonState hook owns the one global subscription and fans out by event name
- [Phase 01-rpc-bridge-daemon-lifecycle]: rpc-types.ts uses snake_case field names verbatim from the JSON wire format — 1:1 with docs/RPC.md, no translation layer
- [Phase 01-rpc-bridge-daemon-lifecycle]: Module-level atom + useSyncExternalStore for DaemonSnapshot — single source of truth, no prop drilling, one listener budget
- [Phase 01-rpc-bridge-daemon-lifecycle]: B2 provider pattern: TunPermissionProvider mounts exactly one modal app-wide; all START paths gate through useTunPermission().requestPermission()
- [Phase 01-rpc-bridge-daemon-lifecycle]: W3 internal tick: DaemonStatusIndicator takes (baselineSeconds, baselineTimestamp) and self-ticks via setInterval; keeps uptime honest without parent re-renders
- [Phase 01-rpc-bridge-daemon-lifecycle]: sonner used for reconnect toast; TunPermissionProvider mounted at app root in main.tsx (B2 fix live)
- [Phase 01-rpc-bridge-daemon-lifecycle]: formatUptime refactored into uptime-counter.tsx as single shared helper; daemon-status.tsx re-imports it
- [Phase 02-honest-dashboard-peer-surface]: Shell navigation atom uses module-level useSyncExternalStore (mirrors useDaemonState); ActiveScreen renders <section aria-label={active}> to avoid nested-main axe violation
- [Phase 02-honest-dashboard-peer-surface]: Reserved sidebar rows rendered as <div aria-disabled tabIndex={-1}> not <button disabled>; keeps them out of tab order at DOM layer, not just CSS
- [Phase 02-honest-dashboard-peer-surface]: AppShell keyboard handler ignores shift/alt modifiers so ⌘⇧1 / ⌘⌥1 pass through to browser/DevTools; ⌘, swallowed via preventDefault as a Phase-2 no-op until CONF-* lands
- [Phase 02-honest-dashboard-peer-surface]: Plan 02-01: useDaemonState auto-seeds status + peers.discovered and auto-subscribes to status.event / peers.event on running transitions; W1 single-listener contract preserved
- [Phase 02-honest-dashboard-peer-surface]: Plan 02-01: Subscription-failure (D-31) retry-once stores error on snapshot.subscriptionError for Plan 02-06 to render as toast — executor only captures, does not render
- [Phase 02-honest-dashboard-peer-surface]: Plan 02-01: kill_switch status.event is logged and ignored in Phase 2 (Phase 4 UX-03 owns the UI); pair_failed peers.event is a no-op for snapshot.peers (Plan 02-04 useTroubleshootLog owns per-peer buffer)
- [Phase 02-honest-dashboard-peer-surface]: ReconnectToast + StopConfirmDialog moved from Dashboard to AppShell — app-level chrome belongs at shell layer
- [Phase 02-honest-dashboard-peer-surface]: DaemonToggle rendered above the 4 panels (not integrated into IdentityPanel) so Identity panel matches UI-SPEC ASCII mockup verbatim
- [Phase 02-honest-dashboard-peer-surface]: Connected-peer count filter = state in (active OR relayed) for both Peers badge and Metrics line — a relayed peer is still connected
- [Phase 02-honest-dashboard-peer-surface]: Bang-free source files policy: negations expressed as === false / === null ternary inversion, avoiding !/!==/!= so the 'no exclamation marks' grep rule holds mechanically
- [Phase 02-honest-dashboard-peer-surface]: Shell-level overlay mount for PeerDetailSheet + PairApprovalModal (sibling of active section in ActiveScreen) so state survives tab switches
- [Phase 02-honest-dashboard-peer-surface]: usePeerTroubleshootLog registers a second peers.event handler via W1 fan-out — Set<Handler> supports multi-handler dispatch, no new Tauri listener
- [Phase 02-honest-dashboard-peer-surface]: D-22 queue advance via setTimeout(openNext, 0) — gives React one commit cycle to unmount closed modal before next opens (prevents focus-trap race)
- [Phase 02-honest-dashboard-peer-surface]: Shadcn Sheet primitive rewritten wholesale post-generation (4 simultaneous brand violations in default output: rounded-xs, shadow-lg, bg-background, lucide XIcon)
- [Phase 02-honest-dashboard-peer-surface]: Pinned react-window to v1.8.11 (not v2.x) because Plan 02-05's acceptance gate requires FixedSizeList + ListChildComponentProps + scrollToItem — v1 APIs only. v2 renamed to List + rowComponent + scrollToRow.
- [Phase 02-honest-dashboard-peer-surface]: useLogsStream exposes errorStream: 'logs' | null on the hook result so Plan 02-06's toast can assemble the D-31 'Couldn't subscribe to {stream}' string without re-deriving it.
- [Phase 02-honest-dashboard-peer-surface]: Narrowed .gitignore 'logs/' rule to root-anchored '/logs/' so src/components/logs/ (Logs-tab UI folder) tracks. Original rule still covers any future top-level log-output folder.
- [Phase 01.1]: Plan 01.1-03: Platform detection via navigator.userAgent fallback (Tauri 2 plugin-os not in deps); UI-only gating, Rust is source of truth
- [Phase 01.1]: Plan 01.1-03: D-13 inline-error copy formatted INSIDE useConfigBootstrap hook so screen renders bootstrap.error.message directly — no string interpolation in JSX
- [Phase 01.1]: Plan 01.1-03: useRef-based dedupe guard for onBootstrapComplete (StrictMode-safe, render-invisible) — pattern matches TunPermissionProvider's resolverRef
- [Phase 03-configuration-peer-management]: Plan 03-01: shadcn primitives generated by CLI then patched inline against 03-UI-SPEC §Registry Safety — rounded-none everywhere, bg-popover floating surfaces, no lucide icons, concentric square radio indicator over CircleIcon dot
- [Phase 03-configuration-peer-management]: Plan 03-01: AlertDialogAction defaults variant=destructive + AlertDialogCancel defaults variant=ghost — every Phase 3 use site is a destructive prompt, defaults shift removes call-site boilerplate
- [Phase 03-configuration-peer-management]: Plan 03-01: useSettingsConfig moved from 03-04 to 03-01 + module-level refetchSettingsConfig() exposed (D-30) — 03-02 peer hooks call refetch on add/remove without holding a hook reference
- [Phase 03-configuration-peer-management]: Plan 03-01: ⌘↑/⌘↓ dispatch window CustomEvents (pim:settings-collapse-all / -expand-all) guarded by active==='settings' — browser-native channel keeps W1 invariant intact while letting Plan 03-04 own the collapse-all behavior
- [Phase 03-configuration-peer-management]: Plan 03-02: useAddPeer + useRemovePeer module-level atoms with useSyncExternalStore — required so trigger (ActionRow / RemoveButton) and consumer (Sheet / AlertDialog) read the SAME open flag; per-component useState would diverge
- [Phase 03-configuration-peer-management]: Plan 03-02: react-hook-form useForm lives in the Sheet, not the atom — buildOnSubmit(form) factory binds field-level setError mapping (D-18) to the Sheet's instance, while open/submitting stay shared via the module atom
- [Phase 03-configuration-peer-management]: Plan 03-02: peers.remove uses node_id (not config_entry_id) — PeerSummary doesn't expose config_entry_id; daemon accepts either; node_id is unambiguous for the CONNECTED-list scope
- [Phase 03-configuration-peer-management]: Plan 03-02: AlertDialogAction onClick uses preventDefault + void confirm() — prevents Radix's auto-close from racing the in-flight peers.remove and dropping aria-busy state; close happens inside confirm() after RPC resolves

### Roadmap Evolution

- 2026-04-24: Phase 01.1 inserted after Phase 1 — "First-run config bootstrap" (URGENT). Discovered during Phase 2 runtime verification: clicking [ Start daemon ] silently fails because pim-daemon needs `pim.toml` at platform-default path before it can boot, and the product must not require the user to create that file by hand. Scope: first-run screen (device name + role radio + Start / Customize…) + `bootstrap_config` Tauri command + Sidecar::Terminated-within-500ms detection. 3 new REQs (SETUP-01/02/03). Unblocks Phase 2 live-daemon verify.

### Pending Todos

None yet.

### Blockers/Concerns

- Brand tokens are inlined in `src/globals.css` rather than submoduled from kernel repo (kernel repo push blocked). Revisit when kernel repo access is resolved; does not block Phase 1.
- `tauri-specta` v2 for auto-generated types deferred to v2 (POWER-01). Phase 1 maintains hand-written TS types mirroring `docs/RPC.md` (RPC-05).

## Session Continuity

Last session: 2026-04-27T00:44:57.182Z
Stopped at: Completed 03-02-PLAN.md
Resume file: None
