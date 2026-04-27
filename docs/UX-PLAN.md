# pim-ui · UX Plan

> The complete product thinking for the pim desktop + mobile app.
> Derived from a deep study of the kernel (`/tmp/pim-kernel-study.md`)
> and UX reference research (`/tmp/pim-ux-research.md`). Updated 2026-04-24.

---

## 0 · North star

Build the only mesh-networking app a non-technical user can open and make
sense of in 30 seconds, **without** hiding what the protocol is actually
doing. A curious first-timer and a protocol researcher must both look at
the same screen and see their own version of the truth — one as "green
dot = I'm on the mesh," the other as "active peer via tcp with hop
latency 12ms."

The product thesis, in one line:

> **One UI, three disclosure layers, zero lies.**

This is the 1Password doctrine: *build for beginners, which also serves
the expert*. We do not ship a "Simple / Advanced" toggle. We ship one
surface whose defaults, copy, and spatial prominence match a first-timer,
and every deeper knob lives one level down — never absent, never
patronising.

---

## 1 · Design principles

Five principles. They beat any individual screen decision.

### P1 · Honest over polished

The brand promise is *"infrastructure you can read."* Never say
"Connected" when the route is relayed. Never say "Disconnected" when the
kill-switch is blocking internet. Never show a green checkmark and hope
nobody asks what it means.

- Show relay vs direct per peer
- Show transport per peer (tcp · BLE · Wi-Fi Direct · relay)
- Show route topology as ASCII, with hop latency
- Say "Blocking internet" when we are (Mullvad), not "Disconnected"
- Say "via relay-b → gateway-c" (Tailscale redesign), not "Connected"

### P2 · One UI, not two modes

Settings are organised by **what they do** (Routing · Identity · Transport
· Gateway · Discovery), not by whether they're "Basic" or "Advanced."

- Layer 1: **main window** — am I on the mesh? who am I talking to? one-click actions
- Layer 2: **settings with collapsible sections** — grouped knobs, plain labels, inline ⓘ tooltips
- Layer 3: **power surfaces** — command palette (⌘K), raw TOML viewer, in-app logs viewer, debug snapshot export

Never nest more than two levels of disclosure (NN/G's rule). Never label
a section "Advanced."

### P3 · Daemon is the source of truth

`pim-daemon` owns configuration and state. The UI is a faithful display
and an input form — nothing more.

- UI subscribes to daemon events; UI does not poll and lie
- Daemon REJECT on a save → preserve user's edit buffer, show inline error, don't lose work
- Daemon down → "Limited mode" with last-known state + "Restart daemon" action
- No state is stored in the UI that isn't also in the daemon

### P4 · OS idiom first, brand idiom second

The brand is terminal-native, but the **shell** must feel like a native
app on each platform.

- macOS: menu-bar first, LSUIElement true by default; optional dock icon
- Windows: tray first; UAC only during install
- Linux: systemd-style install (daemon as system service)
- iOS: tab bar (Meshtastic pattern), Network Extension framework
- Android: tab bar, VpnService, respect always-on VPN rules

### P5 · Solo mode is a first-class state

Zero peers is not an error. It's "I'm running as a node, I have an
internet egress, I'm ready to be joined." The UI reflects that:

- Solo state shows the same dashboard as a connected node, with zero peers
- "Add peer nearby" (QR + BLE) and "Invite peer remotely" (`pim://` link) are always-available actions, never locked behind an empty state
- No prompt infantilizes: no "Add your first peer!" guilt microcopy

---

## 2 · Users

### 2a · Aria (primary — serves as default)

27, product manager, installed pim because she read a post about
off-grid mesh and thought it sounded cool. She's never typed `tcpdump`.
She doesn't know what a TUN interface is, but she'll accept "pim needs
permission to create a network connection for your device."

What she wants:
- Open the app → see green dot → "I'm on"
- One button that connects her to her partner's laptop nearby
- Feel like the app was built by adults who respect her

What she doesn't want:
- Wizards that talk down to her
- Jargon
- A dashboard that looks like a hospital monitor

### 2b · Mira (secondary — every screen must also satisfy her)

29, mesh-networking researcher. She's already read `docs/PROTOCOL.md`
before installing. She wants the app to prove it tells the truth.

What she wants:
- Every peer's transport, route hops, and latency visible on the dashboard
- The raw TOML at two keystrokes away
- A log viewer that shows handshake failures with peer IDs
- `pim status --json` output reachable via ⌘K

What she doesn't want:
- Hand-holding microcopy
- A "Simple" mode that is the real mode with handcuffs
- Any screen that implies something the daemon isn't actually doing

---

## 3 · Feature inventory (what the daemon can do)

From the kernel study — everything `pim-daemon` exposes. Columns: **UI
tier** (L1 main window · L2 settings section · L3 power surface · —
don't expose).

### 3a · Daemon lifecycle

| Feature | UI tier | Notes |
|---|---|---|
| Start daemon | **L1** | Single toggle, with TUN permission prompt |
| Stop daemon | **L1** | |
| Daemon status (stopped / starting / running / error) | **L1** | Brand's big indicator |
| Uptime | **L1** | Inline with status |
| Daemon logs (tail, filter) | **L3** | Log viewer |
| Config reload | **L2** | Settings → "Apply" |

### 3b · Node identity

| Feature | UI tier | Notes |
|---|---|---|
| Node name | **L1** | Shown inline; editable in Settings |
| Node ID (8-char short / 32-char full) | **L1 / L3** | Short visible; click to reveal full |
| Public key | **L3** | Settings → Identity → copy button |
| Regenerate identity | **L3** | Under lock with strong warning (loses trust) |
| Export identity | **L3** | For backup |

### 3c · Network status

| Feature | UI tier | Notes |
|---|---|---|
| Mesh IP address | **L1** | |
| Interface name + up/down | **L1** | "pim0 · up" (linux) / "utun4 · up" (macOS) |
| Current role (client / relay / gateway) | **L1** | |
| Internet egress route (via peer X) | **L1** | Topology sparkline or text |
| Peers connected / total | **L1** | |
| Routes installed | **L1** | Counter, click to drill into L2 |

### 3d · Peer management

| Feature | UI tier | Notes |
|---|---|---|
| Peer list (name · mesh IP · transport · state) | **L1** | Dashboard main panel |
| Add peer nearby (QR + BLE scan) | **L1** | Primary action |
| Invite peer remotely (pim:// link, copy) | **L1** | Secondary action |
| Remove peer | **L2** | In peer detail |
| Peer detail (route hops, latency, transport, last seen) | **L2** | Slide-over / detail pane |
| Static peer editing (manual TOML fragment) | **L3** | Settings → Peers → "Edit raw" |
| Connection test to peer | **L2** | In peer detail |

### 3e · Discovery

| Feature | UI tier | Notes |
|---|---|---|
| Discovery enabled toggle | **L2** | Settings → Discovery |
| UDP broadcast discovery | **L2** | On by default |
| Bluetooth PAN discovery | **L2** | Platform-dependent |
| Wi-Fi Direct discovery | **L2** | Platform-dependent |
| Auto-connect toggle | **L2** | "Accept nearby peers automatically" |
| Discovered-but-unpaired list | **L2** | "People nearby you haven't trusted yet" |

### 3f · Authorization / trust

| Feature | UI tier | Notes |
|---|---|---|
| Authorization policy (allow_all · allow_list · TOFU) | **L2** | Radio group with plain explanation |
| Trusted peers list (TOFU store) | **L2** | Revoke / inspect |
| Allow-list editor (node IDs) | **L3** | Advanced users |
| Trust on handshake (approve incoming pair) | **L1** | Modal: "relay-b is asking to join" |
| Require encryption toggle | **L3** | On by default, buried |

### 3g · Routing

| Feature | UI tier | Notes |
|---|---|---|
| Installed routes table | **L2** | "Routing" section |
| Route detail (via, hops, learned from, load, age) | **L2** | Expand row |
| Max hops | **L3** | Default fine for 99% |
| Algorithm selector | — | Only one algorithm today |
| Route expiry | **L3** | |

### 3h · Gateway

| Feature | UI tier | Notes |
|---|---|---|
| Become gateway toggle | **L1** | Giant permission-gated switch |
| NAT interface dropdown | **L2** | Pre-populated with detected interfaces |
| Gateway pre-flight check | **L1** | Inline "checking iptables... ✓" before enabling |
| Max connections (conntrack limit) | **L3** | |
| Conntrack utilization gauge | **L2** | Status view, when running as gateway |
| Gateway throughput | **L2** | |

### 3i · Split-default routing

| Feature | UI tier | Notes |
|---|---|---|
| "Route internet through the mesh" toggle | **L1** | Major switch |
| Status: "Currently routing internet via gateway-c" | **L1** | Honest surfacing |
| Turn off | **L1** | |

### 3j · Observability / debug

| Feature | UI tier | Notes |
|---|---|---|
| Live log viewer (filter, level, peer) | **L3** | Warp-style blocks |
| Debug snapshot export (JSON) | **L3** | One click |
| Stats (/run/pim.stats) live values | **L2** | Dashboard secondary tiles |
| Peer reputation scores | — | Not yet in daemon |
| Per-route metrics | **L3** | |

### 3k · Configuration

| Feature | UI tier | Notes |
|---|---|---|
| Node name | **L2** | Settings → Identity |
| Interface name + MTU + mesh_ip (static or auto) | **L2** | Settings → Transport |
| Listen port | **L2** | |
| Security (require_encryption, authorization policy) | **L2** / **L3** | |
| Raw TOML editor + validator | **L3** | Settings → "Edit raw config" |
| Config import / export | **L3** | Share an entire setup |

### 3l · What we do NOT expose

- `node.data_dir`, `security.key_file`, `trust_store_file` paths — managed by daemon
- Reconnection backoff, nonce rekey threshold, send buffer size, heartbeat — hardcoded in daemon, no knob
- Phase-5/6 features (per-flow gateway, reputation, rate-limit, onion) — daemon doesn't support yet
- Windows support messaging — no platform yet

---

## 4 · Information architecture

### 4a · Desktop (macOS · Windows · Linux)

Tauri 2 shell. Two surfaces per OS, both driving the same daemon:

```
Menu-bar popover (macOS) / Tray menu (Windows, Linux)
├─ Status dot (●○◑◆)
├─ Node name + mesh IP
├─ "Route internet via mesh" toggle
├─ Add peer nearby…    ⌘⇧N
├─ Open pim…            ⌘O
└─ Quit pim

Main window (windowed UI — Tailscale 2025 precedent)
└─ Sidebar (left, 240px)
   ├─ Dashboard         ⌘1
   ├─ Peers             ⌘2
   ├─ Routing           ⌘3
   ├─ Gateway           ⌘4
   ├─ Logs              ⌘5
   └─ Settings          ⌘,
└─ Content pane (right)
   └─ one of Dashboard / Peers / Routing / Gateway / Logs / Settings
```

Dock icon is optional and off by default; gets a red dot on critical
error (Tailscale's exact pattern).

### 4b · Mobile (iOS · Android)

Tab bar (Meshtastic / Tailscale iOS precedent):

```
┌─────────────────────────────────┐
│                                 │
│        [screen content]         │
│                                 │
├─────────────────────────────────┤
│  Mesh │ Peers │ Routes │ ⚙️     │
└─────────────────────────────────┘
```

- **Mesh** — the dashboard. Status, solo-mode prompt or peer list.
- **Peers** — peer management, add/invite, trust.
- **Routes** — routing table, gateway state, "route internet via mesh" toggle.
- **⚙️ Settings** — config sections (identity, transport, discovery, gateway, raw).

Mobile intentionally does NOT mirror desktop's Logs + Gateway tabs as
first-class; those are in Settings → "Logs" and Settings → "Gateway."

### 4c · Shared primitives

Three layouts used everywhere:

1. **CliPanel** — the brand's hero: box-drawing bordered panel with ASCII
   title bar + `[STATUS]` badge + monospace content. Used for all status
   views and drill-downs.
2. **KeyValueTable** — compact `label · value` rows, used in status sections.
3. **ActionRow** — `[ BRACKETED ACTION ]` buttons, monospace, inline-inverted on hover.

---

## 5 · Critical user flows

Seven flows. If all seven work, the product works.

### Flow 1 · First-run onboarding (Aria opens the app)

Three steps, max. No wizard framing — just a single scrolling setup surface.

```
Step 0 — Splash (0.5s):
  █ pim
  booting…

Step 1 — Name this device:
  "What should we call this device?"
    [ client-a-macbook         ]
  [ Continue ]
  (auto-filled with hostname; user can edit)

Step 2 — Permission:
  "pim needs permission to create a virtual network interface.
   This lets the mesh route traffic on your device."
   Why: [learn more ⓘ]
  [ Grant permission ]  [ Skip for now ]
  (Skip → limited mode with clear banner)

Step 3 — Connect or solo:
  "You're set. Two ways to start:"
  [ Add peer nearby ]   [ Run solo (just an egress node) ]
  ↳ "Add peer nearby" → QR + BLE pairing view
  ↳ "Run solo" → go to Dashboard
```

Time to dashboard: **≤ 30 seconds** for the solo path. Identity generation
happens silently between steps 1 and 3; no entropy bars.

### Flow 2 · Add peer nearby (the killer feature)

Briar's exact pattern, adapted:

```
Dashboard → [ Add peer nearby ] →

View A · "Hold phones together"
┌───────────────────────────────┐
│       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│       ▓▓ your QR ▓▓           │
│       ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│                               │
│       or scan theirs:         │
│       [ Open camera ]         │
└───────────────────────────────┘

On scan:
  "relay-b wants to join your mesh."
   ↳ node ID: 7f8e…a3c2  [show full]
   ↳ via Bluetooth

  [ Trust and connect ]   [ Decline ]
```

After trust: return to Dashboard with relay-b visible in the peer list,
`◆ active`.

### Flow 3 · Invite a remote peer

```
Dashboard → [ Invite peer ] →

"Send them this link. It expires in 1 hour."

  pim://invite/abc123def…

  [ Copy ]   [ Show QR ]   [ Send via…▾ ]

  (Send via → macOS share sheet / iOS share sheet / Android share intent)
```

Peer clicks link → if they have pim installed, deep-link opens the pair
view; if not, we host a fallback page on a kernel-repo subdomain with
install instructions.

### Flow 4 · Route internet through the mesh

```
Dashboard  →  toggle "Route internet via mesh"

Pre-flight (inline, 500ms):
  ✓ Gateway reachable (gateway-c)
  ✓ Split-default routing supported
  [ Turn on ]

On:
  status changes to "Routing through gateway-c (via relay-b)"
  secondary line: "internet traffic is going: client-a → relay-b → gateway-c → internet"
  [ Turn off ] is always one click away
```

### Flow 5 · Become a gateway

```
Settings → Gateway → "Share your internet with the mesh"

Pre-flight:
  ✓ Running on Linux (gateway is Linux-only)
  ✗ iptables not installed  →  [Install iptables…]
  ✓ Network interface detected: wlan0  (change)
  ✓ CAP_NET_ADMIN available

If all checks pass:
  [ Turn on gateway mode ]

When on:
  Dashboard shows "Gateway active · 3 peers connecting through you · 1.2 MB/min"
  Settings → Gateway adds a gauge for conntrack utilization (% of max)
```

On macOS / Windows the whole section is replaced with:

> "Gateway mode is Linux-only today. Your device can still join a mesh
> as a client or relay."

### Flow 6 · Troubleshoot (Mira-mode)

User clicks the ⚠️ indicator next to a peer that's "failed":

```
Peer · client-c
Status: ✗ failed
Last attempt: 32s ago

┌─── handshake log (last attempt) ────────────────────┐
│ 21:14:07  connecting to 10.77.0.105 via tcp         │
│ 21:14:08  noise handshake initiated                 │
│ 21:14:09  handshake failed: untrusted peer ID       │
│           (7f8e…a3c2)                               │
│ 21:14:09  see docs/SECURITY.md §3.2                 │
└─────────────────────────────────────────────────────┘

[ Retry ]   [ Trust this peer ]   [ Forget peer ]
```

Every error surfaces (a) the exact daemon reason, (b) the relevant docs
section, (c) an action to resolve.

### Flow 7 · Power-user flow (Mira)

Mira opens the app. She is muscle-memory about two shortcuts:

- ⌘K — command palette. Types "route". Sees:
  ```
  Route: turn on split-default routing
  Route: turn off split-default routing
  Route: show routing table
  Route: explain route get internet   ←  equivalent of `pim debug route get internet`
  ```
- ⌥⌘E — raw TOML editor. Loads her current config. Edits `discovery.broadcast_interval_ms`. Save → daemon validates → success or inline error with line number.

Neither shortcut is documented on any main screen. Both are documented
in Settings → "Keyboard shortcuts."

---

## 6 · Screen-by-screen spec

### 6a · Dashboard (default screen)

```
╔════════════════════════════════════════════════════════════╗
║  █ pim · client-a-macbook                          ●       ║
║  mesh: 10.77.0.100/24 · interface pim0 · up · 4h 22m       ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║   [ Route internet via mesh ]     currently: off           ║
║                                                            ║
║   Peers (3 connected)                                      ║
║   ┌────────────────────────────────────────────────────┐   ║
║   │ gateway-c  10.77.0.1    via tcp      ◆ active     │   ║
║   │            ↳ internet egress · 12ms               │   ║
║   │ relay-b    10.77.0.22   via tcp      ◆ active     │   ║
║   │ client-c   10.77.0.105  via relay-b  ◈ relayed    │   ║
║   └────────────────────────────────────────────────────┘   ║
║                                                            ║
║   [ + Add peer nearby ]    [ Invite peer ]                 ║
║                                                            ║
║   routes 12 active  ·  forwarded 4.2 MB / 3,847 pkts       ║
║   dropped 2 (congestion)                                   ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

Click a peer row → Peer Detail slide-over.
Click the mesh IP / node name → Identity slide-over.
Click "routes 12 active" → jump to Routing tab.

### 6b · Peers tab

Full-width peer list with search. Each row: short node ID, nickname,
mesh IP, transport, state, last seen, row actions (trust, connect, forget).

A section above the connected list: **Nearby (not paired)** — discovered
peers from broadcast / BLE / WFD that haven't handshaken. "Add" button
per row.

A section below: **Static peers** — manually added. Add / edit / delete.

### 6c · Routing tab

CliPanel showing the routing table. Columns: destination · via · hops ·
learned from · is_gateway · age. Expand a row → last 5 heartbeats, chosen reason.

Above: the "route internet via mesh" toggle (mirrors the Dashboard).
Below: current known gateways list with their score; selected one is
highlighted.

### 6d · Gateway tab

- If **not running as gateway**: explanation, pre-flight card, turn-on button.
- If **running as gateway**: status, conntrack gauge, throughput,
  connected peers count, turn-off button.
- If **not on Linux**: "Gateway mode is Linux-only today." + link to
  setup docs.

### 6e · Logs tab

Warp-style block viewer. Each event is a block: timestamp, severity icon,
peer ID (if relevant), message. Filter bar at top: level (debug/info/warn/
error), peer, text search, time range. Export: JSON download.

### 6f · Settings

Scrollable page with collapsible sections, in this order:

1. **Identity** — node name, node ID, public key, regenerate (lock-confirmed).
2. **Transport** — interface, MTU, mesh IP (static | auto), listen port.
3. **Discovery** — broadcast on/off, BLE on/off, Wi-Fi Direct on/off,
   auto-connect, broadcast interval (collapsed).
4. **Trust** — authorization policy (radio), trusted peers list, allow-list editor.
5. **Routing** — max hops, route expiry, algorithm (if >1).
6. **Gateway** — everything from the Gateway tab, plus hardcoded-limit knobs.
7. **Notifications** — what triggers a system notification (peer connected, gateway lost, kill-switch active).
8. **Advanced — raw config** — full TOML editor, validator, import/export.
9. **About** — version, kernel daemon version, link to repo, crash log.

Each section is collapsed by default, with a one-line summary ("Discovery: broadcast on, BLE off, 3 trusted peers") visible collapsed. Open with click or keyboard nav.

### 6g · Onboarding screens

See Flow 1.

### 6h · Error states

- **Daemon crashed**: banner at top with "Restart daemon" button; content still visible with last-known state + muted overlay.
- **Interface down**: inline indicator on dashboard; `Show why` → logs.
- **Kill-switch active (route-on + gateway lost)**: BIG banner "Blocking internet — gateway unreachable" with "Turn off kill-switch" action.
- **Permission missing (TUN)**: dashboard shows "Limited mode — grant permission to start daemon" with re-request button.

---

## 7 · Microcopy · terminology

Write for Aria. Always include the technical term in parentheses on
first use — respect for Mira.

| What it is | Aria-copy | Never |
|---|---|---|
| TUN interface | "virtual network connection" | "TUN/TAP interface" (unqualified) |
| Mesh IP | "your address on the mesh" | "mesh_ip" |
| Gateway | "a device sharing its internet with the mesh" | "NAT-enabled egress node" |
| Relay | "a device passing traffic between others" | "relay" (unqualified — define on first use) |
| Trust anchor | "pairing secret" | |
| Route-on | "Route internet via mesh" | "split-default routing" |
| Handshake fail | "Couldn't verify this peer" | "Noise handshake rejection" |
| Conntrack exhausted | "Too many connections through your gateway" | "conntrack full" |
| Daemon not running | "pim is stopped" | "daemon dead" |

Tone rules, inherited from the brand (see `.design/branding/pim/patterns/STYLE.md`):

- Declarative, not hedging
- No exclamation marks
- No hype
- Error copy names the specific failure and points at `docs/...`
- Never tell the user they did something wrong — tell them what state the system is in

---

## 8 · Progressive disclosure strategy

Three layers, per P2.

### Layer 1 — Main window / menu bar / tab bar

Visible without clicking into settings. Holds **only**:

- Status + mesh IP + interface + uptime
- Route-internet-via-mesh toggle
- Peers list (short)
- Add peer nearby · Invite
- Single key metrics (forwarded, dropped)

Nothing else belongs here. If a knob has a default that's right for 95%
of users, it goes to Layer 2.

### Layer 2 — Settings sections (collapsible)

Every section has:

- A one-line summary visible collapsed ("Discovery: broadcast on, BLE off")
- Grouped knobs inside
- An inline ⓘ tooltip per non-obvious label

Never more than two levels of collapse. If a knob needs a third level,
move it to Layer 3.

### Layer 3 — Power surfaces

- ⌘K command palette: every action, every "debug" CLI command
- Raw TOML editor + validator
- In-app log viewer with filters and export
- Debug snapshot export (JSON dump of everything)
- Keyboard shortcuts cheat sheet
- `pim://` deep link handler

These surfaces are **discoverable only by people who look**. They are
not hidden from Settings (Settings → About → "Keyboard shortcuts" lists
them), but they don't occupy Layer 1 real estate.

---

## 9 · Priority roadmap

### v0.1 — "Hello mesh" (desktop only)

Ship a desktop Tauri app that can:

- Start / stop the daemon (sidecar)
- Show the Dashboard with mock → then real status
- Add a static peer via Settings
- Display the peer list with honest transport info
- Show daemon logs tail
- Raw TOML editor (read-only initially)

No mobile. No QR/BLE pairing. No gateway pre-flight. The goal is
a Mira-usable desktop app that is honest about what the daemon is doing.

### v0.2 — "Add a peer"

- Menu bar / tray surface
- Static peer add via form (not raw TOML)
- QR pairing (show your QR, scan theirs) — desktop camera on macOS
- Peer detail slide-over with troubleshoot log
- Command palette (⌘K)
- Raw TOML editor writable with validation

### v0.3 — "Onboard a beginner"

- First-run flow (Aria's path)
- Onboarding copy + illustrations
- Permission-grant UX (TUN) on all three desktop OSes
- Route-internet-via-mesh toggle on Dashboard with pre-flight
- "Invite peer remotely" (pim:// link + share)
- Empty-state / solo-node polish

### v0.4 — "Serve the gateway"

- Gateway tab with pre-flight checks
- Become-a-gateway toggle with linux detection
- Conntrack gauge, throughput, connected-peers-through-you count
- Kill-switch state banner

### v0.5 — "Mobile (full node)"

Scope revised 2026-04-24: mobile is **full node from day 1**, not a
remote-only companion. This is a multi-milestone initiative.

**v0.5.0 — daemon-as-library**
- Restructure `pim-daemon` to compile as both a binary (existing) and a
  Rust library (new) usable from a Tauri mobile `src-tauri/lib.rs`.
- Stub sidecar/embedded split in UI daemon trait (already present; finalize the `Embedded` impl).

**v0.5.1 — Android**
- Tauri 2 Android build green
- Kotlin `VpnService` plugin integrated (reference: EasyTier `tauri-plugin-vpnservice`)
- Handshake between VpnService TUN FD and embedded pim-daemon
- Tab-bar IA on Android
- BLE discovery enabled

**v0.5.2 — iOS**
- Apple Developer enrollment completed (~US$99/yr, separate thread)
- Network Extension entitlement request filed + approved (expect multi-week review)
- Swift `NEPacketTunnelProvider` target created
- pim-daemon linked as lib into the NE process
- Memory usage verified under the 50 MB NE hard cap
- Tab-bar IA on iOS
- Always-on toggle + OS-triggered relaunch handling

**v0.5.3 — parity polish**
- BLE discovery + pairing UX on both platforms
- System-notification parity with desktop
- Tauri updater configured per platform

### v0.6+ — "Power tools"

- Live log streaming with filters and Warp-style blocks
- Debug snapshot export (one click)
- Keyboard shortcut cheat sheet
- In-app protocol doc viewer (`docs/PROTOCOL.md` rendered)

### Non-goals for v1.0

- Account system, cloud sync, SSO
- Built-in chat (pim is not a messenger)
- Hardware pairing beyond BLE (no LoRa companion, no audio pair)
- Automatic gateway on macOS/Windows until kernel supports it
- Rate-limiting, reputation scores, onion routing — until daemon exposes

---

## 10 · Decisions

All open questions from the first draft were resolved with the project
creator on **2026-04-24**. Baseline locked:

| # | Decision |
|---|---|
| **Transport** | Unix domain socket with JSON-RPC 2.0. Full spec lives in `proximity-internet-mesh/docs/RPC.md`. |
| **TOML vs form parity** | Raw TOML editor is the authority. When raw input is unrepresentable in the form view, show banner *"Raw is source of truth — form view shows a subset."* (1Password pattern.) |
| **macOS default** | Window-first on first-run. Menu bar available as a secondary surface; user can hide either. (Tailscale 2025 lesson.) |
| **`pim://` fallback** | Uninstalled clicks resolve to `https://github.com/Astervia/proximity-internet-mesh` — the kernel repo README handles install instructions. No custom subdomain needed for v1. |
| **Mobile scope** | **Full node from day 1.** `pim-ui` mobile embeds `pim-daemon` as a Rust library with platform-native plugins: Kotlin `VpnService` on Android, Swift `NEPacketTunnelProvider` on iOS. Requires Apple Developer enrollment + Network Extension entitlement approval. Remote-only client is NOT the plan. |
| **Identity backup** | Briar model. No default backup; silent key generation; lose device = re-pair. An explicit "Export identity" lives in Layer 3 for power users, gated behind strong warnings. |
| **Multi-device per user** | Ignored in v1. Each device is an independent mesh node with its own key; auto-trust between a user's devices is not modelled. Revisit if SSO ever lands. |
| **Gateway failover** | Toast-in-app when daemon failovers to a new gateway (no OS notification). |
| **Notification policy** | System notification fires only on *critical* events: all gateways lost, kill-switch active. Everything else is silent or a toast. Full table lives in the App Settings → Notifications section. |
| **RPC contract ownership** | Draft PR in kernel repo authored from this side, reviewed + merged by kernel maintainer. File: `proximity-internet-mesh/docs/RPC.md`. |

### 10a · Downstream consequences of the "full node mobile" decision

Elevating mobile to full-node status (vs companion-only) changes v0.5
from a two-week task to a multi-month initiative. Explicit downstream
work items now on the critical path:

1. **`pim-daemon` needs to compile as both `bin` and `lib`** — Android links the lib; iOS Network Extension links the lib.
2. **Android VpnService plugin** — Kotlin code that requests `VpnService` permission, establishes the TUN FD, passes it to the linked Rust daemon. Reference: EasyTier's `tauri-plugin-vpnservice`.
3. **iOS Network Extension entitlement** — requires paid Apple Developer enrollment (≈US$99/yr) and explicit Apple approval for NE entitlement. Expect weeks of back-and-forth with Apple review.
4. **Memory budget on iOS** — Network Extensions have a 50 MB hard memory cap and run in a separate process. The daemon must fit, with routing state + handshake state + send buffers.
5. **Background mode policies** — iOS kills NE processes aggressively; mobile UX needs an "always-on" toggle that accepts OS-imposed re-launches.
6. **First-run permission flow on mobile** — explicitly the "why does this app want VPN permission" moment. Must be honest, one sentence, linked to `docs/`.

Tentative revised mobile roadmap is captured in §9.

---

## 11 · Reference material

- `/tmp/pim-kernel-study.md` · full daemon study (2094 lines)
- `/tmp/pim-ux-research.md` · UX reference research (1536 lines)
- `.design/branding/pim/patterns/guidelines.html` · visual brand reference
- `.design/branding/pim/patterns/STYLE.md` · agent contract
- `.design/branding/pim/patterns/pim.yml` · source-of-truth tokens

Key external precedents (quick index):

- **Tailscale 2025 windowed macOS redesign** — three-variant stratification, three-pane layout, honest relay-vs-direct surfacing
- **Meshtastic mobile** — tab bar IA for a proximity mesh product
- **Briar** — QR + BLE pairing, offline-first ethos; avoid their over-permissive onboarding
- **Mullvad** — hierarchical collapsible settings (no "simple/advanced" mode), "Blocking internet" microcopy
- **1Password** — the "build for beginners, which also serves the expert" doctrine
- **OrbStack** — native-feeling daemon-GUI polish bar
- **Linear, Raycast, Warp, Charm.sh** — monospace-first aesthetic that remains usable

---

## Appendix · quick wins

1. ~~**Protocol RPC doc in kernel**~~ ✓ **Done 2026-04-24** —
   `proximity-internet-mesh/docs/RPC.md` drafted with 17 methods + 3
   event streams over JSON-RPC 2.0 on a Unix socket. Awaiting review from
   kernel maintainer.

2. **Copy guide** — `pim-ui/docs/COPY.md`. One row per user-facing
   string: context · Aria-copy · Mira-annotation. Forces every microcopy
   choice to be deliberate. To do before v0.3 (onboarding polish).

3. **Icon set pinned to brand** — `█` logo, `◆ ◈ ○ ✗` status, `↯`
   degraded, `◉` gateway, `⎋` kill-switch. Pin these to `pim.yml` in the
   kernel repo. To do alongside first real peer-list UI.

---

*This plan is a living document. When the roadmap changes or new daemon
capabilities land, update the feature inventory and the priority bands
first — everything else follows.*
