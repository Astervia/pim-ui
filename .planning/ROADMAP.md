# Roadmap: pim-ui

## Overview

pim-ui ships in five phases that walk from "nothing works without a daemon
connection" to "a researcher opens the menu bar and every daemon capability
is one keystroke away." Phase 1 replaces the mock CliPanel with a live
JSON-RPC bridge and the daemon start/stop surface; Phase 2 turns the
dashboard honest by wiring `status.event`, peer transport info, and the
first log stream; Phase 3 gives users settings and raw TOML editing so
they can configure without touching the CLI; Phase 4 lands the
route-internet-via-mesh toggle with the onboarding flow and solo-mode
polish that serves Aria; Phase 5 finishes gateway mode, the menu-bar
popover, the command palette, and the toast/system-notification surfaces
that complete v1 for Mira.

This structure follows UX-PLAN §9's v0.1→v0.4 spine but collapses v0.1
into two phases (plumbing vs. honest surfacing) because without reactive
status events and honest transport info the dashboard doesn't satisfy
either persona. Coarse granularity; mobile (MOBILE-01..06) is v0.5 and
explicitly not in this roadmap.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: RPC Bridge & Daemon Lifecycle** - Live JSON-RPC 2.0 over Unix socket, daemon sidecar start/stop, honest connection state (completed 2026-04-24)
- [x] **Phase 2: Honest Dashboard & Peer Surface** - Reactive status stream, peer list with true transport info, nearby/incoming pair approval, live logs (completed 2026-04-27)
- [ ] **Phase 3: Configuration & Peer Management** - Settings sections with raw-TOML-as-authority, static peer add/remove, log filters + debug snapshot
- [x] **Phase 4: Routing & Onboarding Polish** - Route-internet-via-mesh toggle with pre-flight, routing table, three-step onboarding, solo mode, honest error copy (completed 2026-04-27)
- [ ] **Phase 5: Gateway Mode & System Surfaces** - Gateway pre-flight + enable (Linux), conntrack gauge, menu-bar popover, tray/AppIndicator, command palette, toast + system notifications

## Phase Details

### Phase 1: RPC Bridge & Daemon Lifecycle
**Goal**: Replace the mock dashboard with a live JSON-RPC 2.0 connection to a daemon spawned as a Tauri sidecar, with honest status surfacing when the daemon is down.
**Depends on**: Nothing (first phase)
**Requirements**: RPC-01, RPC-02, RPC-03, RPC-04, RPC-05, DAEMON-01, DAEMON-02, DAEMON-03, DAEMON-04, DAEMON-05
**Success Criteria** (what must be TRUE):
  1. User can launch pim-ui and, on first start, click a single toggle to start `pim-daemon`; within 3 seconds the status indicator moves from stopped → starting → running.
  2. User can click stop and the daemon exits cleanly; the status indicator returns to stopped and the main window remains usable.
  3. When the daemon is not running, the main window shows "Limited mode — pim daemon is stopped" with a visible Start action — not a blank screen or a spinner.
  4. When the daemon is killed externally, the UI detects disconnect within 5 seconds, displays the Limited mode banner, and auto-reconnects (restoring any subscriptions) the moment the socket reappears.
  5. After handshake, the About section / footer shows the daemon version string and feature flags reported by `rpc.hello`, and the UI-side TypeScript types match `proximity-internet-mesh/docs/RPC.md` exactly (verified by compile against a fixture).
  6. While the daemon is running, the dashboard displays an uptime counter that ticks forward continuously and survives a UI window close/reopen (reads from daemon, not UI state).
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — TypeScript RPC type mirror of docs/RPC.md v1 + typed Tauri invoke wrapper + DaemonState machine (RPC-05)
- [x] 01-02-PLAN.md — Rust sidecar spawn + newline-delimited JSON-RPC Unix socket client + 6 Tauri commands + 2 Tauri events + reconnect loop (RPC-01, RPC-02, RPC-04, DAEMON-01, DAEMON-02, DAEMON-05)
- [x] 01-03-PLAN.md — useDaemonState hook + DaemonStatusIndicator/DaemonToggle/LimitedModeBanner/TunPermissionModal/StopConfirmDialog components + shadcn Dialog primitive (RPC-03, DAEMON-03)
- [x] 01-04-PLAN.md — UptimeCounter + AboutFooter + ReconnectToast + dashboard rewire + human-verify checkpoint for all 6 Phase 1 success criteria (DAEMON-04, RPC-02 surface)
**UI hint**: yes

### Phase 01.1: First-run config bootstrap (INSERTED)
**Goal**: On first launch (when no `pim.toml` exists on the platform-default path), the UI shows a single-screen form that captures device name + role, generates a sensible `pim.toml`, and starts the daemon — without the user ever seeing the filesystem, a wizard, or an error. Closes the "click Start, nothing happens" gap discovered during Phase 2 verification.
**Depends on**: Phase 1
**Requirements**: SETUP-01, SETUP-02, SETUP-03
**Success Criteria** (what must be TRUE):
  1. On first launch (no `pim.toml` at the platform-default path, e.g. `~/.config/pim/pim.toml` on Linux, `~/Library/Application Support/pim/pim.toml` on macOS), the UI renders a single-screen first-run surface — not the Dashboard, not a wizard, not the Limited-mode banner.
  2. The first-run surface has exactly two form fields (device name pre-filled from hostname; role radio defaulted to "Join the mesh") and two actions: `[ Start pim ]` primary + `[ Customize… ]` secondary-grayed with "(Phase 3)" hint.
  3. Clicking `[ Start pim ]` writes a default `pim.toml` (sane defaults: broadcast on, BLE off, TOFU policy, no gateway) to the platform path and triggers `daemon_start` — user lands on Dashboard within 3 seconds, no manual file creation, no terminal.
  4. On macOS / Windows, the `Share my internet` radio option is visibly disabled with honest copy "Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay." — the option is not hidden.
  5. On subsequent launches (config exists), the first-run surface does NOT appear; the UI boots straight to AppShell + Dashboard as before.
  6. If `daemon_start` fails after config was written (e.g. daemon crashes within 500 ms), the UI surfaces an honest error banner referencing the config path — the user is never left with a silent "nothing happened" state. No polling; Phase 1 `DaemonState` machine detects the crash via the sidecar's `Terminated` event.
**Plans**: 4 plans
Plans:
- [x] 01.1-01-PLAN.md — Rust foundation: config_path resolver + default_config TOML template + bootstrap_config + config_exists Tauri commands + sidecar crash-on-boot detection routed through existing daemon://state-changed event (SETUP-01/02/03 backend)
- [x] 01.1-02-PLAN.md — TS contract: bootstrapConfig + configExists wrappers + DaemonLastError discriminated union + isCrashOnBoot/pickCrashOnBoot helpers (SETUP-01/02/03 frontend types) — preserves W1 cross-phase invariant (listen() count unchanged)
- [x] 01.1-03-PLAN.md — UI: AppRoot router + FirstRunScreen (D-07/D-08/D-09/D-13) + useConfigBootstrap boot-sequence hook + main.tsx wire-in (SETUP-01/02 frontend)
- [x] 01.1-04-PLAN.md — LimitedModeBanner crash-on-boot variant (D-20) + final human-verify checkpoint walking all 6 ROADMAP Phase 01.1 SCs (SETUP-03) (completed 2026-04-27)
**UI hint**: yes

### Phase 2: Honest Dashboard & Peer Surface
**Goal**: The dashboard shows what the daemon is actually doing via reactive event streams — node identity, mesh address, peer transport per row, forwarded/dropped metrics, nearby peers, and incoming pair approval.
**Depends on**: Phase 1
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04, PEER-01, PEER-04, PEER-05, PEER-06, OBS-01
**Success Criteria** (what must be TRUE):
  1. User sees, on the dashboard, the node name, short node ID, mesh IP, and interface state (e.g. "pim0 · up") populated from the live `status` RPC — never from placeholder data.
  2. Dashboard updates reactively when a peer connects, disconnects, or a metric changes, with no UI-side polling interval — verifiable by toggling a peer in the daemon and seeing the UI redraw within 1 second.
  3. Each peer row honestly names its transport (tcp / bluetooth / wifi_direct / relay) and state (active / relayed / connecting / failed); a relayed peer never appears as "active," and a failed peer shows the failure explicitly.
  4. User can click a peer to open a detail view showing full node_id (with short→full reveal on hover), mesh_ip, hop count, last_seen, latency, trust state, and the handshake troubleshoot log — all sourced from RPC.
  5. A "Nearby — not yet paired" section lists discovered peers and, when another peer initiates pairing, a modal fires with honest copy ("relay-b wants to join your mesh") and explicit [ Trust and connect ] / [ Decline ] actions.
  6. User can open the Logs tab and watch events from `logs.event` stream with a level filter (trace/debug/info/warn/error) and a peer filter, updating in real time.
  7. Dashboard shows forwarded bytes + packets, dropped count with reason, connected peer count, and current egress gateway (if any) — all live.
**Plans**: 6 plans
Plans:
- [x] 02-01-PLAN.md — Reactive spine: extend useDaemonState with status/peers auto-seed + subscribe + discovered[] + format helpers + selector hooks (STAT-04, PEER-01, PEER-05)
- [x] 02-02-PLAN.md — Navigation shell: sidebar (240px, 6 rows) + content pane + keyboard shortcuts ⌘1/⌘2/⌘5/⌘, (shell scaffolding for STAT-01..03, PEER-01/04/05/06, OBS-01)
- [x] 02-03-PLAN.md — Dashboard 4-panel layout: IdentityPanel + PeerListPanel + NearbyPanel + MetricsPanel + PeerRow + NearbyRow (STAT-01, STAT-02, STAT-03, PEER-01, PEER-05)
- [x] 02-04-PLAN.md — Peer Detail slide-over + Pair Approval modal + sheet primitive install + troubleshoot-log buffer (PEER-04, PEER-06)
- [x] 02-05-PLAN.md — Logs tab: select + scroll-area primitives, react-window virtualized list, useLogsStream subscription lifecycle, level + peer filters (OBS-01)
- [x] 02-06-PLAN.md — Integration: sonner Toaster mount, SubscriptionErrorToast (D-31), show-why → Logs wiring (D-09), human-verify checkpoint against all 7 ROADMAP success criteria (completed 2026-04-27)
**UI hint**: yes

### Phase 3: Configuration & Peer Management
**Goal**: User can configure every daemon knob exposed for v1 via a settings page organized by function, with raw TOML as the authoritative editor and daemon-side validation — plus explicit static peer add/remove and log export.
**Depends on**: Phase 2
**Requirements**: PEER-02, PEER-03, CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, OBS-02, OBS-03
**Success Criteria** (what must be TRUE):
  1. User can open Settings and see nine collapsible sections in fixed order (Identity, Transport, Discovery, Trust, Routing, Gateway, Notifications, Advanced/raw, About), each with a one-line summary visible while collapsed ("Discovery: broadcast on, BLE off, 3 trusted peers").
  2. User can edit the node name, transport settings (interface, MTU, mesh_ip static/auto, listen port), discovery toggles (broadcast, BLE, Wi-Fi Direct, auto-connect), and trust policy (radio: allow_all / allow_list / TOFU) via typed form controls and save to the daemon.
  3. User can open the raw TOML editor, paste a full config, click Save, and either see the daemon accept it or see inline per-line errors (`config.save({dry_run: true})` validation); on reject, the edit buffer is preserved — no silent data loss.
  4. When a raw-TOML save contains fields the form view cannot represent, the form section banner reads "Raw is source of truth — form view shows a subset" next time the user opens that section.
  5. User can add a static peer from a form (address + mechanism + label) without seeing or typing TOML, and remove a peer with a confirmation step — both changes reflected in the live peer list within 2 seconds.
  6. Logs tab supports text search and a time-range filter, and a single Export debug snapshot button downloads a JSON file containing current status + recent logs suitable for attaching to a bug report.
**Plans**: 7 plans
Plans:
- [x] 03-01-PLAN.md — Foundation: Phase-2 pre-flight gate + ROADMAP typo fix + shadcn primitives (switch/radio-group/collapsible/alert-dialog/form/tooltip) + react-hook-form + @iarna/toml + TOML orchestration library (section-schemas, parse, assemble, diff) + useSettingsConfig hook (+ refetchSettingsConfig for D-30) + sidebar ⌘6 Settings route + dedicated Peers route (PEER-02/03 infra, CONF-01/06/07 infra, OBS-02/03 infra)
- [x] 03-02-PLAN.md — Dedicated Peers screen: PeersScreen + AddPeerSheet (right-edge form, peers.add_static, calls refetchSettingsConfig on success per D-30) + RemovePeerAlertDialog + PeerRemoveButton (static-only per D-20) (PEER-02, PEER-03)
- [x] 03-03-PLAN.md — Logs extension: text search (300ms debounced) + time-range select (5 presets + Custom… Dialog with Cancel-revert) + Export debug snapshot button (D-23 schema) + applyLogsFilter module function for cross-plan [Show in Logs →] routing (OBS-02, OBS-03)
- [x] 03-04-PLAN.md — Settings scaffold + hooks + D-13 discard flow + shared utils: CollapsibleCliPanel + SectionSaveFooter + WireNameTooltip + RawWinsBanner + DiscardUnsavedChangesAlertDialog + four hooks (section-save, section-raw-wins with module-level setAllSectionRawWins writer, pending-restart, dirty-sections) + map-errors + daemon-restart shared util + nav-away interception + Stop-path gate (CONF-01, CONF-07)
- [x] 03-05-PLAN.md — Form sections (split out from original 03-04 per checker Warning 1): IDENTITY + TRANSPORT + DISCOVERY + TRUST sections consuming 03-04 hooks (CONF-02, CONF-03, CONF-04, CONF-05)
- [x] 03-06-PLAN.md — Remaining sections + Raw TOML editor: ROUTING + GATEWAY placeholder + NOTIFICATIONS + ADVANCED — RAW CONFIG (plain textarea + gutter, dry_run-first save, [Restart] toast uses shared restartDaemon util) + ABOUT + VITE_APP_VERSION/COMMIT vite.config wiring (CONF-01, CONF-06, CONF-07)
- [ ] 03-07-PLAN.md — Audit sweep (includes no-zod negative assertion per D-08) + human-verify checkpoint walking all six ROADMAP Phase 3 success criteria live against real pim-daemon (all 11 requirement IDs)
**UI hint**: yes

### Phase 4: Routing & Onboarding Polish
**Goal**: Aria can open the app for the first time, succeed in ≤ 3 interactions, and toggle "Route internet via mesh" with honest surfacing of which gateway/relay is carrying traffic; solo mode and error states are first-class; every microcopy string matches the brand voice.
**Depends on**: Phase 3
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04, UX-01, UX-02, UX-03, UX-08
**Success Criteria** (what must be TRUE):
  1. First-run: user names the device, grants TUN permission (with honest one-sentence copy + learn-more link), and chooses "Add peer nearby" or "Run solo" — three interactions, ≤ 30 seconds to dashboard on the solo path, no wizard framing.
  2. User clicks a single "Route internet via mesh" toggle on the dashboard; the UI runs pre-flight inline within ~500 ms and, once enabled, the dashboard reads "Routing through gateway-c (via relay-b)" — never just "on."
  3. Zero-peer state is a usable dashboard: status, uptime, metrics visible, and "Add peer nearby" + "Invite peer remotely" actions present — no empty-state illustration, no "Add your first peer!" microcopy.
  4. User can open a Routing view that shows the live routing table (destination · via · hops · learned_from · age) and a known-gateways list with scores and the currently-selected gateway highlighted.
  5. When the kill-switch engages (route-on + all gateways lost), a blocking banner reads "Blocking internet — gateway unreachable" with an explicit "Turn off kill-switch" action; when a handshake fails, the peer row shows "Couldn't verify this peer" with a link to `docs/SECURITY.md §3.2`.
  6. Every user-facing string matches `docs/COPY.md`: no exclamation marks, crypto primitives named explicitly on first use, declarative not hedging — verified by a copy audit pass against the Aria-copy column.
**Plans**: 6 plans
Plans:
- [x] 04-01-PLAN.md — Foundation: docs/COPY.md + docs/SECURITY.md + src/lib/copy.ts + src/lib/routing.ts + scripts/audit-copy.mjs (UX-08)
- [x] 04-02-PLAN.md — RouteTogglePanel + useRouting selectors + useRouteTable + Dashboard insertion (ROUTE-01, ROUTE-02)
- [x] 04-03-PLAN.md — RouteScreen + sidebar/active-screen wiring (⌘3) + RouteTablePanel + KnownGatewaysPanel (ROUTE-03, ROUTE-04)
- [x] 04-04-PLAN.md — WelcomeScreen + AppRoot welcome branch (UX-01)
- [x] 04-05-PLAN.md — Solo-mode actions enabling + InvitePeerSheet (UX-02)
- [x] 04-06-PLAN.md — Critical error states (KillSwitchBanner + handshake-fail sub-line) + final audit gate (UX-03, UX-08)
**UI hint**: yes

### Phase 5: Gateway Mode & System Surfaces
**Goal**: A Linux user can enable gateway mode after pre-flight and watch conntrack/throughput live; every desktop OS gets a menu-bar/tray/AppIndicator popover, a ⌘K command palette, and honest toast + system notifications — completing v1 for Mira.
**Depends on**: Phase 4
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04, UX-04, UX-05, UX-06, UX-07
**Success Criteria** (what must be TRUE):
  1. On Linux, user opens Settings → Gateway, sees each pre-flight check rendered with pass/fail + detail (iptables, interface detection, CAP_NET_ADMIN), and — when all checks pass — can pick a `nat_interface` from a detected dropdown and enable gateway mode with one action.
  2. When gateway mode is active, the Gateway view shows a conntrack utilization gauge, live throughput, and the count of peers routing through this node — all updating reactively from RPC events.
  3. On macOS and Windows, the Gateway section is visible (not hidden) and reads "Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay." — no stub error, no blank page.
  4. macOS menu-bar popover, Windows tray, and Linux AppIndicator each provide parity: status dot, node name + mesh IP, "Route internet via mesh" toggle, "Add peer nearby" action, and Open pim → main window — reachable at any time, window-first default.
  5. User presses ⌘K from any screen and gets a command palette that surfaces every major action (`route on/off`, `peers.list`, `gateway.preflight`, `logs.subscribe`) plus tab navigation; typing narrows results in real time.
  6. Toast notifications fire for peer connected and gateway failover; system notifications fire only for all-gateways-lost and kill-switch-active — never for routine lifecycle events.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. RPC Bridge & Daemon Lifecycle | 1/4 | Complete    | 2026-04-24 |
| 01.1. First-run config bootstrap | 4/4 | Complete    | 2026-04-27 |
| 2. Honest Dashboard & Peer Surface | 6/6 | Complete    | 2026-04-27 |
| 3. Configuration & Peer Management | 6/7 | In progress | - |
| 4. Routing & Onboarding Polish | 6/6 | Complete    | 2026-04-27 |
| 5. Gateway Mode & System Surfaces | 0/TBD | Not started | - |
