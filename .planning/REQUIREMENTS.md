# Requirements: pim-ui

**Defined:** 2026-04-24
**Core Value:** One app that is honest about what the mesh is actually doing — never abstracts packets into a happy green dot — yet stays reachable enough that a first-time user can succeed in ≤ 3 interactions.

## v1 Requirements

Requirements for initial desktop release (macOS + Linux + Windows).
Mobile is v2 per Core Value & Constraints in PROJECT.md.

### RPC — JSON-RPC client ↔ daemon bridge

- [ ] **RPC-01**: App connects to `pim-daemon` via JSON-RPC 2.0 over a Unix socket at the platform-standard path (`/run/pim/pim.sock` linux, `$TMPDIR/pim.sock` macOS)
- [x] **RPC-02**: Connection performs `rpc.hello` handshake and reports daemon version + feature flags in UI
- [x] **RPC-03**: UI gracefully handles daemon not running — shows "Limited mode — pim daemon is stopped" banner with Start action
- [ ] **RPC-04**: UI reconnects automatically on daemon restart, preserving subscriptions
- [x] **RPC-05**: UI maintains TypeScript types mirroring kernel `docs/RPC.md` (hand-maintained for v1, `tauri-specta` v2 is a v2 requirement)

### DAEMON — lifecycle + sidecar management

- [ ] **DAEMON-01**: User can start the daemon from the UI with a single toggle; TUN permission prompt surfaces on first start with honest copy
- [ ] **DAEMON-02**: User can stop the daemon from the UI
- [x] **DAEMON-03**: UI shows daemon status (stopped / starting / running / error) prominently on the main window
- [x] **DAEMON-04**: Dashboard displays uptime counter while running
- [ ] **DAEMON-05**: Tauri shell spawns `pim-daemon` as a sidecar (Tauri externalBin convention); kills it on app window destroy

### STATUS — dashboard at a glance

- [x] **STAT-01**: Dashboard shows node name, short node ID, mesh IP, interface state (`pim0 · up`) from live RPC `status` call
- [x] **STAT-02**: Dashboard shows connected peer count and current egress gateway (if any)
- [x] **STAT-03**: Dashboard shows key metrics: forwarded bytes + packets, dropped count with reason, uptime
- [x] **STAT-04**: UI subscribes to `status.event` stream and updates dashboard reactively (no polling)

### PEER — peer discovery + management

- [x] **PEER-01**: Dashboard lists connected peers with honest transport info (tcp / bluetooth / wifi_direct / relay) and state (active / relayed / connecting / failed)
- [ ] **PEER-02**: User can add a static peer via form (address + mechanism + label) without touching TOML
- [ ] **PEER-03**: User can remove a peer with confirmation
- [x] **PEER-04**: User can view peer detail: node_id (short + full on hover), mesh_ip, route hops, last_seen, latency, trust state, troubleshoot log
- [x] **PEER-05**: UI shows "Nearby — not yet paired" section listing `peers.discovered()` results
- [x] **PEER-06**: User can approve incoming pair request via modal ("relay-b wants to join your mesh")

### ROUTE — routing + gateway mode

- [ ] **ROUTE-01**: User can toggle "Route internet via mesh" (split-default) with a single action on the dashboard
- [ ] **ROUTE-02**: When route-on is active, dashboard shows "Routing through gateway-c (via relay-b)" — honest topology, not just "on"
- [ ] **ROUTE-03**: UI shows the routing table via `route.table()` in a dedicated view — destination, via, hops, learned_from, age
- [ ] **ROUTE-04**: UI shows known gateways with their score and marks the selected one
- [ ] **GATE-01**: Settings → Gateway shows pre-flight check results (`gateway.preflight()`) with each check's pass/fail + detail
- [ ] **GATE-02**: User can enable gateway mode (Linux only) after pre-flight passes, choosing nat_interface from detected list
- [ ] **GATE-03**: When gateway is active, UI shows conntrack utilization gauge, throughput, and peer-through-me count
- [ ] **GATE-04**: On macOS/Windows, Gateway section shows clear "Gateway mode is Linux-only today" messaging (not hidden)

### CONF — configuration (form + raw)

- [ ] **CONF-01**: Settings page is organized by function — Identity, Transport, Discovery, Trust, Routing, Gateway, Notifications, Advanced (raw), About — each collapsible with a one-line summary visible collapsed
- [ ] **CONF-02**: User can edit identity section (node name)
- [ ] **CONF-03**: User can edit transport section (interface name, MTU, mesh_ip static/auto, listen port)
- [ ] **CONF-04**: User can edit discovery section (broadcast on/off, bluetooth on/off, wifi_direct on/off, auto-connect)
- [ ] **CONF-05**: User can edit trust section (authorization policy radio: allow_all / allow_list / TOFU, plus trusted-peers list)
- [ ] **CONF-06**: Raw TOML editor with validation — server-side via `config.save({dry_run: true})`; inline errors with line/column when available
- [ ] **CONF-07**: When raw save contains content unrepresentable in the form view, banner shows "Raw is source of truth — form view shows a subset" on form reopen (1Password pattern)

### OBS — observability + logs

- [x] **OBS-01**: Logs tab streams `logs.event` notifications with level filter (trace/debug/info/warn/error) and peer filter
- [ ] **OBS-02**: Log viewer supports text search and time-range filter
- [ ] **OBS-03**: User can export a debug snapshot (one click) — JSON dump of current status + recent logs

### SETUP — first-run config bootstrap (added Phase 01.1)

- [x] **SETUP-01**: On first launch (no `pim.toml` at the platform-default path), UI detects missing config and renders a single-screen first-run surface instead of the Dashboard or Limited-mode banner; platform paths match the daemon's `DEFAULT_CONFIG` rules (`/etc/pim/pim.toml` Linux system, `~/.config/pim/pim.toml` Linux user, `~/Library/Application Support/pim/pim.toml` macOS, `%APPDATA%\pim\pim.toml` Windows)
- [x] **SETUP-02**: First-run surface captures device name (pre-filled from hostname) + role radio (Join the mesh / Share my internet — the latter disabled outside Linux with honest copy) and offers `[ Start pim ]` primary + `[ Customize… ]` secondary (Phase 3 stub); clicking `[ Start pim ]` writes a sane-default `pim.toml` via a new Tauri command and chains to `daemon_start`
- [ ] **SETUP-03**: If the daemon exits within 500 ms of `daemon_start` (crash-on-boot, e.g. config validation failure), the UI surfaces a `DAEMON ERROR` banner citing the config path and daemon stderr — never a silent "nothing happened" state; detected via the existing Phase 1 `Sidecar::Terminated` event path

### UX — onboarding + error states + polish

- [ ] **UX-01**: First-run onboarding completes in ≤ 3 interactions (name device → grant TUN permission → connect or run solo)
- [ ] **UX-02**: Zero-peer state is a valid "solo mode" — dashboard is fully functional, offering "Add peer nearby" and "Invite peer remotely" at all times
- [ ] **UX-03**: Critical error states render with honest copy: "Blocking internet — gateway unreachable" (kill-switch), "Couldn't verify this peer" (handshake fail), pointing to relevant `docs/` section
- [ ] **UX-04**: Toast notifications fire for non-critical lifecycle events (gateway failover, peer connected) — never system notifications except for all-gateways-lost + kill-switch-active
- [ ] **UX-05**: macOS menu-bar popover provides status dot + "Route internet via mesh" toggle + Open pim → main window at any time (window-first default, menu-bar secondary)
- [ ] **UX-06**: Windows tray + Linux AppIndicator parity with macOS menu-bar popover
- [ ] **UX-07**: Command palette (⌘K) exposes every major action — `route on/off`, `peers.list`, `gateway.preflight`, `logs.subscribe`, plus navigation between tabs
- [ ] **UX-08**: All microcopy matches the brand voice contract in `docs/COPY.md` (Aria-copy + Mira-annotation) — no exclamation marks, name crypto primitives explicitly, declarative not hedging

## v2 Requirements

Deferred to future releases. Tracked but not in current roadmap.

### MOBILE (v0.5 series)

- **MOBILE-01**: Tauri 2 mobile build targets iOS + Android
- **MOBILE-02**: Android Kotlin `VpnService` plugin integrated with embedded `pim-daemon` (Rust library)
- **MOBILE-03**: iOS Swift `NEPacketTunnelProvider` plugin integrated with embedded `pim-daemon`, deployed under approved Network Extension entitlement, within 50 MB memory cap
- **MOBILE-04**: Tab bar IA (Mesh / Peers / Routes / Settings) on both platforms
- **MOBILE-05**: BLE discovery + QR pairing on mobile
- **MOBILE-06**: Always-on VPN support on Android (respecting platform disconnect-rules)

### POWER (v0.6+)

- **POWER-01**: `tauri-specta` v2 integration — auto-generated TS types from Rust RPC definitions
- **POWER-02**: In-app renderer for kernel `docs/PROTOCOL.md`
- **POWER-03**: Peer topology visualisation (ASCII network diagram) on a dedicated tab
- **POWER-04**: Notification preferences — per-event category toggles
- **POWER-05**: Tauri updater integration with signed releases on all desktop platforms

### BACKUP (deferred)

- **BACKUP-01**: Identity export (key file) with strong warnings, behind confirm-and-retype
- **BACKUP-02**: Identity import on new install

## Out of Scope

| Feature | Reason |
|---------|--------|
| Simple / Advanced mode toggle | Rejected in favour of one UI + three disclosure layers (1Password doctrine). Segmenting users degrades both audiences. |
| SSO / cloud account system | Contradicts "no control plane" product ethos |
| Built-in chat | pim is a protocol, not a messenger |
| Gateway mode on macOS / Windows | Kernel is Linux-only; revisit when kernel supports |
| Reputation scores, rate limiting, onion routing | Not yet implemented in `pim-daemon` |
| Auto-trust between user's own devices ("My devices") | Requires SSO; deferred until that ever lands |
| Remote daemon over TCP without TLS | Security risk; a proper TLS-with-tokens spec must land first |
| Electron | Contradicts brand promise; Tauri 2 chosen instead |

## Traceability

Every v1 requirement is mapped to exactly one phase. See `.planning/ROADMAP.md` for phase goals and success criteria.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RPC-01 | Phase 1 | Pending |
| RPC-02 | Phase 1 | Complete |
| RPC-03 | Phase 1 | Complete |
| RPC-04 | Phase 1 | Pending |
| RPC-05 | Phase 1 | Complete |
| DAEMON-01 | Phase 1 | Pending |
| DAEMON-02 | Phase 1 | Pending |
| DAEMON-03 | Phase 1 | Complete |
| DAEMON-04 | Phase 1 | Complete |
| DAEMON-05 | Phase 1 | Pending |
| SETUP-01 | Phase 01.1 | Complete |
| SETUP-02 | Phase 01.1 | Complete |
| SETUP-03 | Phase 01.1 | Pending |
| STAT-01 | Phase 2 | Complete |
| STAT-02 | Phase 2 | Complete |
| STAT-03 | Phase 2 | Complete |
| STAT-04 | Phase 2 | Complete |
| PEER-01 | Phase 2 | Complete |
| PEER-04 | Phase 2 | Complete |
| PEER-05 | Phase 2 | Complete |
| PEER-06 | Phase 2 | Complete |
| OBS-01 | Phase 2 | Complete |
| PEER-02 | Phase 3 | Pending |
| PEER-03 | Phase 3 | Pending |
| CONF-01 | Phase 3 | Pending |
| CONF-02 | Phase 3 | Pending |
| CONF-03 | Phase 3 | Pending |
| CONF-04 | Phase 3 | Pending |
| CONF-05 | Phase 3 | Pending |
| CONF-06 | Phase 3 | Pending |
| CONF-07 | Phase 3 | Pending |
| OBS-02 | Phase 3 | Pending |
| OBS-03 | Phase 3 | Pending |
| ROUTE-01 | Phase 4 | Pending |
| ROUTE-02 | Phase 4 | Pending |
| ROUTE-03 | Phase 4 | Pending |
| ROUTE-04 | Phase 4 | Pending |
| UX-01 | Phase 4 | Pending |
| UX-02 | Phase 4 | Pending |
| UX-03 | Phase 4 | Pending |
| UX-08 | Phase 4 | Pending |
| GATE-01 | Phase 5 | Pending |
| GATE-02 | Phase 5 | Pending |
| GATE-03 | Phase 5 | Pending |
| GATE-04 | Phase 5 | Pending |
| UX-04 | Phase 5 | Pending |
| UX-05 | Phase 5 | Pending |
| UX-06 | Phase 5 | Pending |
| UX-07 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 49 total (46 original + 3 SETUP-*)
- Mapped to phases: 49 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-24*
*Last updated: 2026-04-24 after roadmap creation (traceability populated)*
