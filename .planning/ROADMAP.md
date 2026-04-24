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

- [ ] **Phase 1: RPC Bridge & Daemon Lifecycle** - Live JSON-RPC 2.0 over Unix socket, daemon sidecar start/stop, honest connection state
- [ ] **Phase 2: Honest Dashboard & Peer Surface** - Reactive status stream, peer list with true transport info, nearby/incoming pair approval, live logs
- [ ] **Phase 3: Configuration & Peer Management** - Settings sections with raw-TOML-as-authority, static peer add/remove, log filters + debug snapshot
- [ ] **Phase 4: Routing & Onboarding Polish** - Route-internet-via-mesh toggle with pre-flight, routing table, three-step onboarding, solo mode, honest error copy
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
**Plans**: TBD
**UI hint**: yes

### Phase 3: Configuration & Peer Management
**Goal**: User can configure every daemon knob exposed for v1 via a settings page organized by function, with raw TOML as the authoritative editor and daemon-side validation — plus explicit static peer add/remove and log export.
**Depends on**: Phase 2
**Requirements**: PEER-02, PEER-03, CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06, CONF-07, OBS-02, OBS-03
**Success Criteria** (what must be TRUE):
  1. User can open Settings and see eight collapsible sections in fixed order (Identity, Transport, Discovery, Trust, Routing, Gateway, Notifications, Advanced/raw, About), each with a one-line summary visible while collapsed ("Discovery: broadcast on, BLE off, 3 trusted peers").
  2. User can edit the node name, transport settings (interface, MTU, mesh_ip static/auto, listen port), discovery toggles (broadcast, BLE, Wi-Fi Direct, auto-connect), and trust policy (radio: allow_all / allow_list / TOFU) via typed form controls and save to the daemon.
  3. User can open the raw TOML editor, paste a full config, click Save, and either see the daemon accept it or see inline per-line errors (`config.save({dry_run: true})` validation); on reject, the edit buffer is preserved — no silent data loss.
  4. When a raw-TOML save contains fields the form view cannot represent, the form section banner reads "Raw is source of truth — form view shows a subset" next time the user opens that section.
  5. User can add a static peer from a form (address + mechanism + label) without seeing or typing TOML, and remove a peer with a confirmation step — both changes reflected in the live peer list within 2 seconds.
  6. Logs tab supports text search and a time-range filter, and a single Export debug snapshot button downloads a JSON file containing current status + recent logs suitable for attaching to a bug report.
**Plans**: TBD
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
**Plans**: TBD
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
| 1. RPC Bridge & Daemon Lifecycle | 1/4 | In Progress | - |
| 2. Honest Dashboard & Peer Surface | 0/TBD | Not started | - |
| 3. Configuration & Peer Management | 0/TBD | Not started | - |
| 4. Routing & Onboarding Polish | 0/TBD | Not started | - |
| 5. Gateway Mode & System Surfaces | 0/TBD | Not started | - |
