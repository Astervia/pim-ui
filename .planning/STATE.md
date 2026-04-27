---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: verifying
stopped_at: Completed 04-05-PLAN.md
last_updated: "2026-04-27T01:41:51.407Z"
last_activity: 2026-04-27
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 34
  completed_plans: 22
  percent: 53
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-24)

**Core value:** One app that is honest about what the mesh is actually doing — never abstracts packets into a happy green dot — yet stays reachable enough that a first-time user can succeed in ≤ 3 interactions.
**Current focus:** Phase 04 — routing-onboarding-polish

## Current Position

Phase: 03 (configuration-peer-management) — IN PROGRESS
Plan: 7 of 7
Status: Phase complete — ready for verification
Last activity: 2026-04-27

Progress: [█████░░░░░] 53%

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
| Phase 03-configuration-peer-management P03 | 22min | 2 tasks | 12 files |
| Phase 04-routing-onboarding-polish P01 | 15 min | 4 tasks | 8 files |
| Phase 04-routing-onboarding-polish P02 | 6 min | 4 tasks | 5 files |
| Phase 04-routing-onboarding-polish P03 | 6 min | 3 tasks | 7 files |
| Phase 04-routing-onboarding-polish P04 | 6 min | 2 tasks | 2 files |
| Phase 04-routing-onboarding-polish P05 | 5 min | 3 tasks | 5 files |

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
- [Phase 03-configuration-peer-management]: Plan 03-03: useLogsStream refactored to module-level atoms (level/peer/source) + module-level ring buffer + reference-counted daemon subscription — required so applyLogsFilter() can reach level/peer/source from any non-React caller for cross-plan [Show in Logs →] toast routing (D-32), and so multiple components (LogsScreen + CustomTimeRangeDialog) share one logs.subscribe call without spawning duplicates
- [Phase 03-configuration-peer-management]: Plan 03-03: Filter chain split — level/peer/source on use-logs-stream (close to the daemon subscription), search/time-range on use-log-filters (Phase 3 additions). useFilteredLogs composes them via useMemo over events
- [Phase 03-configuration-peer-management]: Plan 03-03: Source filter is client-side, not server-side via daemon's `sources: []` param — pushing it server-side would force resubscribes on every source change, fighting the reference-counted lifecycle
- [Phase 03-configuration-peer-management]: Plan 03-03: DebugSnapshot schema = D-23 verbatim (8 top-level snake_case fields + 4 filters_applied sub-fields) — load-bearing per D-24 so the JSON diffs cleanly against `pim status --json` + `pim logs --json` for kernel-repo bug reports
- [Phase 03-configuration-peer-management]: Plan 03-03: snapshotFilename strips colons via `.replace(/:/g, "-")` — Windows-safe per D-24; downloadSnapshot uses Blob + <a download> + microtask URL revoke (no Tauri FS API; works in both webview and future mobile)
- [Phase 03-configuration-peer-management]: Plan 03-03: vite-env.d.ts created — baseline tsconfig had no /// <reference types="vite/client" />, so `import.meta.env.VITE_APP_VERSION` failed typecheck. Added typed augmentation for VITE_APP_VERSION + VITE_APP_COMMIT (the latter is consumed by Plan 03-06 About section, D-27)
- [Phase 04-routing-onboarding-polish]: Plan 04-01: docs/COPY.md is the canonical source for the audit's banned + soft lists; scripts/audit-copy.mjs reads them dynamically with a hardcoded fallback so future doc edits change behaviour without touching the script (D-26, D-27)
- [Phase 04-routing-onboarding-polish]: Plan 04-01: formatRouteLine returns a single string (not a structured object) — D-15 left the choice open; downstream call sites in 04-02/03/04 render the line directly into a CliPanel body, simpler return type wins
- [Phase 04-routing-onboarding-polish]: Plan 04-01: copy.test.ts + routing.test.ts use the Phase-1/2 if(false)-guarded compile-only pattern (matches format.test.ts and rpc-types.test.ts); routing.test.ts assertions verified via one-shot tsx run before commit (18/18 pass), then guarded for production
- [Phase 04-routing-onboarding-polish]: Plan 04-01: src/components/ui/form.tsx:53 'should be used within FormField' soft warning is a runtime-error message thrown for misuse, not user-visible copy — deferred to 04-06's voice pass for triage rather than touching shadcn-generated code in the foundation plan
- [Phase 04-routing-onboarding-polish]: Plan 04-02: useRouteTable refcount + module-level shared state mirrors usePeerTroubleshootLog pattern — single subscription, single fetch regardless of consumer count, clean unmount on last-consumer-leave
- [Phase 04-routing-onboarding-polish]: Plan 04-02: RouteTogglePanel pending state uses local pending flag overriding routeOn/expanded for badge derivation — keeps cursor-blink visible during in-flight RPC without optimistic UI; snapshot remains source of truth (route_on event flips the body line)
- [Phase 04-routing-onboarding-polish]: Plan 04-02: badge cursor-blink rendered via wrapper-class [&_header_span:last-child]:cursor-blink rather than mutating CliPanel API — Phase 2 D-policy keeps shared primitives untouched
- [Phase 04-routing-onboarding-polish]: Plan 04-03: CliPanel does not (currently) expose a headerActions slot — RouteTablePanel renders the D-20 [ refresh ] button as the first child inside the panel body (above the column header), keeping the panel primitive API untouched
- [Phase 04-routing-onboarding-polish]: Plan 04-03: KnownGatewaysPanel renders 4-then-4 ellipsis short id (a3c2…7f8e) per D-17 mockup — distinct from the 8-char prefix convention used elsewhere because the routing screen wants the user to spot-match BOTH start AND end of the 64-char node id when comparing to log lines
- [Phase 04-routing-onboarding-polish]: Plan 04-03: Brand-comment grep gates trip on JSDoc literal mentions of forbidden tokens (gradient/listen/rounded) — comments rephrased to 'fade-blends' / 'no new Tauri-side subscription' so the audit grep passes on file content alone. Future routing-folder panels must follow the same comment-vocabulary discipline
- [Phase 04-routing-onboarding-polish]: Plan 04-04: WelcomeScreen onboarding step 3 — AppRoot extended with localStorage["pim-ui.onboarding.completed"] gate; returning users (flag === "true") skip directly to AppShell on first render via synchronous useState lazy initializer (no UI flash)
- [Phase 04-routing-onboarding-polish]: Plan 04-04: cross-screen scroll signal uses window CustomEvent "pim-ui:scroll-to-nearby" (not module-level atom, not prop chain) — AppRoot dispatches on add-peer-nearby branch, Plan 04-05 Task 2 will register a one-shot self-removing listener on dashboard.tsx; W1 single-listener invariant preserved (zero new Tauri listen() calls)
- [Phase 04-routing-onboarding-polish]: Plan 04-04: D-03 flag-set-before-navigate ordering enforced inside WelcomeScreen.handle() — localStorage written BEFORE onComplete() is invoked, so the flag is durable even if the parent setState is interrupted (window close, hot-reload). useEffect-mount short-circuit covers reload-mid-flight by re-firing onComplete(false) when the flag is already "true"
- [Phase 04-routing-onboarding-polish]: Plan 04-05: InvitePeerSheet honest-stub mounted at shell level via module-level useInvitePeer atom (mirrors usePeerDetail) — open state survives ⌘1/⌘2/⌘3 tab switches; trigger on Dashboard, Sheet on shell, no useState divergence
- [Phase 04-routing-onboarding-polish]: Plan 04-05: PeerListPanel buttons enabled without aria-disabled — limited-mode dim is the panel-wrapper opacity-60; UI-only actions (scroll + slide-over) require no daemon RPC, so they remain functional in transient states; this also dodges the substring-match acceptance gate ('disabled' matches 'aria-disabled')
- [Phase 04-routing-onboarding-polish]: Plan 04-05: Dashboard listens for window CustomEvent 'pim-ui:scroll-to-nearby' (dispatched by Plan 04-04 WelcomeScreen [ ADD PEER NEARBY ]) — handler wraps scrollIntoView in requestAnimationFrame so the panel is laid out before measurement on the WelcomeScreen-to-Dashboard transition; W1 preserved (browser-native, not Tauri listen())

### Roadmap Evolution

- 2026-04-24: Phase 01.1 inserted after Phase 1 — "First-run config bootstrap" (URGENT). Discovered during Phase 2 runtime verification: clicking [ Start daemon ] silently fails because pim-daemon needs `pim.toml` at platform-default path before it can boot, and the product must not require the user to create that file by hand. Scope: first-run screen (device name + role radio + Start / Customize…) + `bootstrap_config` Tauri command + Sidecar::Terminated-within-500ms detection. 3 new REQs (SETUP-01/02/03). Unblocks Phase 2 live-daemon verify.

### Pending Todos

None yet.

### Blockers/Concerns

- Brand tokens are inlined in `src/globals.css` rather than submoduled from kernel repo (kernel repo push blocked). Revisit when kernel repo access is resolved; does not block Phase 1.
- `tauri-specta` v2 for auto-generated types deferred to v2 (POWER-01). Phase 1 maintains hand-written TS types mirroring `docs/RPC.md` (RPC-05).

## Session Continuity

Last session: 2026-04-27T01:41:51.403Z
Stopped at: Completed 04-05-PLAN.md
Resume file: None
