# `pim-ui` — UX Research Brief

> Deep reference for designing the desktop + mobile configuration UI of
> `pim`, a Rust overlay daemon that forwards IP traffic across proximity
> mesh peers. Two personas: **Mira** (mesh researcher, reads IETF drafts,
> runs Reticulum on LoRa) and a **first-time curious user** who has never
> heard of a TUN interface.
>
> Method: WebSearch + WebFetch against primary product docs, design case
> studies, app-store listings, blog reviews, and maintainer-written posts.
> Every URL I leaned on is inlined. Anywhere I couldn't confirm a detail,
> it's marked **[unconfirmed]** rather than invented.
>
> This brief is opinionated where it needs to be. The final section ranks
> the five principles `pim-ui` should commit to.

---

## Table of contents

0. [TL;DR — headline findings](#0-tldr)
1. [Direct reference products](#1-direct-reference-products)
2. [Onboarding patterns for networking/privacy/VPN products](#2-onboarding-patterns)
3. [Real-time state / connection status UX](#3-real-time-state)
4. [Progressive disclosure patterns](#4-progressive-disclosure)
5. [Config editor UX](#5-config-editor-ux)
6. [Empty states, first-run, "zero peers"](#6-empty-states)
7. [Permissions / privilege escalation UX](#7-permissions)
8. [Error / failure state UX](#8-errors)
9. [Discoverability for power features](#9-discoverability)
10. [Cross-device consistency](#10-cross-device)
11. [Aesthetic references close to pim's brand](#11-aesthetic)
12. [Anti-patterns to explicitly avoid](#12-anti-patterns)
13. [**Top 5 UX principles `pim-ui` should follow**](#13-top-5)
14. [Appendix — all URLs referenced](#14-urls)

---

## 0. TL;DR — headline findings <a id="0-tldr"></a>

- **Tailscale's 2025 windowed macOS UI redesign is the single most relevant
  precedent** for `pim`. They explicitly admitted the menu-bar-only model
  failed on notched MacBooks and couldn't convey state via colour/shape
  (<https://tailscale.com/blog/windowed-macos-ui-beta>). They now ship
  **three variants**: Standalone (GUI + auto-update, for beginners),
  App Store (sandboxed), CLI-only (open source, for power users). `pim`
  should steal this stratification wholesale.
- **Mullvad is the cleanest "two audiences, one app" reference.** The same
  binary serves a non-technical user ("green padlock = safe, red = not")
  and an engineer (DAITA, multihop, MTU, quantum resistance, manual
  WireGuard port). They achieve it through **hierarchical settings with
  collapsible sections**, not a "simple/advanced" toggle
  (<https://mullvad.net/en/help/using-mullvad-vpn-app>).
- **Briar is the ethos match.** Offline-first, peer-to-peer, no cloud,
  QR+Bluetooth pairing, Tor transport — closest precedent for "add a peer
  nearby" UX. Its UI is widely called "barebones" (Wikipedia + reviews),
  so `pim` can comfortably be *more* polished than Briar without
  compromising ethos.
- **Meshtastic's bottom-tab IA (Nodes / Conversations / Map / Settings /
  Connection)** is the best mobile template for `pim`, because the mental
  model is almost identical: a list of nearby devices, configuration, and
  a physical pairing step.
- **OrbStack is the polish bar for "native daemon + small GUI."** Native
  Swift, menu bar as first-class surface, <2s cold start, ≤300MB RAM,
  Electron avoided on principle. `pim-ui` is Tauri (webview) not Swift,
  but OrbStack's *philosophy* — small, honest, fast — is the aspiration.
- **1Password's five UX principles ("embrace the problem, advocate for
  accessibility, build for beginners, connect the dots, iterate until
  it's great"), especially "build for beginners which also improves the
  experience for power users"** — is the direct answer to the dual-audience
  question. Don't segment users; serve beginners *and thereby* serve
  experts (<https://1password.com/blog/design-values-ux-prinicples>).
- **Anti-pattern canon: NordVPN.** Cluttered world map, hidden tabs,
  autoplay-renewal dark patterns currently in class-action litigation
  (<https://www.law360.com/articles/2464579/nordvpn-hit-with-dark-patterns-class-action>).
  Everything NordVPN does aesthetically — screaming CTAs, gamified
  "boost," animated globes — `pim` should pointedly not do.
- **Terminal-native brand references to mine:** Charm.sh ("we make the
  command line glamorous"), Ghostty (native AppKit/GTK, not Electron),
  Warp (blocks as info-architecture primitive), Linear (three theme
  variables instead of 98, LCH color space). None of them pretend to be
  "terminal-only" while shipping a native-feeling product. That's the
  exact posture `pim-ui` wants.

---

## 1. Direct reference products <a id="1-direct-reference-products"></a>

### 1.1 Tailscale

#### 1.1.1 macOS — the 2025 "windowed UI" redesign

Until mid-2025, Tailscale on macOS was a menu-bar-only app. They shipped
a full windowed UI in beta and now by default. The *reason* is the richest
piece of public UX writing we have about overlay networking apps.

From the engineering blog (<https://tailscale.com/blog/windowed-macos-ui-beta>):

> "Menu bar dropdowns don't allow us to easily convey information through
> changes in shape or color."

> "Critical errors will be indicated by a very visible red dot [on the
> dock icon]."

The windowed app is organized as a **three-pane layout**:
1. **Left sidebar**: source-of-truth navigation — "This Device," "My
   Devices," "Shared Devices," "Exit Nodes," "Tailnet Lock," etc.
2. **Center list**: searchable peer list with OS icon, online/offline
   dot, last-seen timestamp, and — crucially — **relay vs direct
   connection indicator** that was previously terminal-only.
3. **Right detail panel**: selected peer's metadata with quick actions
   (ping, copy IP, copy MagicDNS, Taildrop).

From the Notch Escape post (<https://tailscale.com/blog/macos-notch-escape>),
explaining why they abandoned menu-bar-only:

> "You just say, 'I want to be a menu bar app.' They shove it up there,
> and that's it, you end up where you end up."

Translation: Apple gave them no occlusion signal, no overflow, no rearrange.
On a notched MacBook with 15 menu-bar items the Tailscale icon vanished
behind the notch. Users couldn't find their own VPN.

From the independent review
(<https://dev.to/onsen/tailscales-new-macos-home-whats-changed-25ej>):

> "Each peer now displays multiple data points simultaneously: online/
> offline status indicators, OS icons for quick identification, and
> last-seen timestamps for offline machines. The article notes that
> connection type visibility—distinguishing direct connections from relay
> routing—was previously terminal-only, now appearing directly in the UI."

That last sentence is the load-bearing insight for `pim`: **make the
routing topology legible in the GUI**. Don't make Mira drop to `pim
status --json | jq` to find out whether she's going via a peer or via
egress.

**Three product variants** they now ship
(<https://thepixelspulse.com/posts/tailscale-macos-variants-critical-choices/>):

| Variant | Audience | Install | Updates | Dock icon |
|---|---|---|---|---|
| Standalone | Beginners | pkg download | Sparkle auto-update | Optional, on by default |
| App Store | Convenience-first | Apple store | App Store | Forced (sandbox rule) |
| CLI-only | Power users | `brew install tailscale` | `brew upgrade` | N/A |

Reviewer's read: "one UI cannot serve both populations equally."

**What `pim` should steal**:
- Three variants, different audiences, same daemon underneath.
- The three-pane peer browser.
- The "minimum-real-estate" mini-player as a secondary surface — small
  menu-bar popover that shows just state + exit-node picker.
- Critical-error dot on the dock icon. **Honest signalling > polite
  silence.**

#### 1.1.2 Tailscale iOS / Android

The iOS app (<https://apps.apple.com/us/app/tailscale/id1470499037>) follows
iOS HIG: a tab bar (Devices / Services / Settings). Adding a device is
purely SSO (no QR pairing); the app uses the Network Extension framework
(<https://tailscale.com/docs/install/ios>). MagicDNS is on by default
(<https://tailscale.com/kb/1081/magicdns>).

Android uses `VpnService` with an always-on VPN option
(<https://tailscale.com/docs/install/mac>). Both mobile apps delegate
onboarding to the web via SSO rather than an in-app wizard.

#### 1.1.3 Web admin console

The web console is where Tailscale exposes the advanced surface: ACL
tags, subnet routers, exit nodes, Tailscale Funnel, key expiration
policies, audit log, SSH. Desktop apps defer to the web admin for
anything beyond day-to-day operations. **This is a pattern:** GUI =
state + common actions, web = policy + audit.

### 1.2 Cloudflare WARP / 1.1.1.1

Cloudflare's consumer app has **two distinct modes** that live on the
same binary (<https://developers.cloudflare.com/warp-client/warp-modes/>):

- **1.1.1.1 mode**: only DNS traffic is encrypted to the 1.1.1.1
  resolver. Minimal.
- **WARP mode**: full tunnel.

Users switch via gear → Preferences → mode picker. Recent releases let
users pick **WireGuard vs MASQUE** as the transport protocol inside WARP
mode. This is a model for `pim`: the app should make it trivial to toggle
between "just route to the best egress" and "my phone is a hop in the
mesh."

The macOS client docs
(<https://developers.cloudflare.com/warp-client/get-started/macos/>) are
explicit about the menu-bar presence being the primary touchpoint; the
main window is a fallback for anything the dropdown can't fit. Known
Android issue: app-exclusion list doesn't populate on some devices
(search result from `community.cloudflare.com`) — reminder that the
**split-tunnel picker is a persistent source of UX regression** across
this category.

### 1.3 Mullvad VPN — the "legible plain-language" reference

Mullvad's design story is public on Behance
(<https://www.behance.net/gallery/74594901/Redesign-of-Mullvad-VPN-apps>):

> "show don't tell — use colours, animations, interactions and
> transitions to clearly communicate to the user whether they are safe
> or not."

Their binary visual language:
- **Green padlock + "Connected"** = safe
- **Red unlocked padlock + "Disconnected"** = not safe
- Menubar icon mirrors the state at a glance

**Main window layout** (<https://mullvad.net/en/help/using-mullvad-vpn-app>):

1. Top bar with account icon + settings gear (color-coded by connection state)
2. Central map with animated dot at your apparent location
3. Connect / Switch-location / Reconnect as the primary action buttons

**Settings hierarchy** — hierarchical progressive disclosure:
- Top level: DAITA, Multihop, VPN settings, UI settings, Split tunneling,
  API access, Support, About, Quit.
- Collapsed sub-sections: WireGuard (port, obfuscation, quantum
  resistance, MTU), OpenVPN (transport, bridge mode, mssfix), Server IP
  override.

> "basic users see only essential connect/disconnect controls, while
> advanced users access technical settings through deliberate menu
> navigation."

Mullvad explicitly targets a **blanket-protection default** while leaving
the full knob surface available:

> "Features like DAITA automatically route traffic through compatible
> servers with minimal user intervention, demonstrating 'smart defaults'
> philosophy."

**What `pim` should steal**:
- Binary visual indicator that mirrors between main window and menu bar.
- Collapsible sections instead of a simple/advanced toggle.
- Plain-language labels ("Blocking internet") for failure states.
- Smart defaults: first launch should Just Work without 40 clicks.

Note: Mullvad is **open source**
(<https://github.com/mullvad/mullvadvpn-app>) if you want to read their
exact Svelte layout.

### 1.4 Nebula / Defined Networking — minimal-but-honest

Nebula's client from Defined Networking (DNClient Desktop,
<https://www.defined.net/blog/announcing-dnclient-desktop/>) is a
**deliberately tiny** app:

- **Windows**: systray menu + enroll window
- **macOS**: menubar icon + enroll window
- **Mobile Nebula**: separate iOS/Android apps
  (<https://apps.apple.com/us/app/nebula-mobile/id1137824578>,
  Google Play)

The blog post explicitly positions the GUI as an **ease-of-use escape
hatch** from terminal-only operation:

> "it's simpler than ever to set up Managed Nebula on macOS and Windows
> through a user-friendly UI, allowing users to easily check the status
> of their connection or join multiple networks without having to resort
> to the terminal."

The actual heavy admin (hosts, groups, firewall rules, overlay IPs)
lives in a **web admin app** — same split as Tailscale.

**First-run** is gated by an **enrollment code** pasted from the admin
panel. This is their version of "you need identity from somewhere else."
For `pim`, the identity is generated *locally* (peer-to-peer), so
enrollment-code UX doesn't port. But the shape — "download, paste a
short code, you're on" — is worth copying for flows like "pair with my
laptop across the room."

**Config paradigm**: Nebula's upstream (`slackhq/nebula`) is raw-YAML +
certs. The desktop client abstracts that into enrolled profiles. The
raw-YAML path remains available via the open-source `slackhq/nebula`
binary. This is a useful pattern: **the GUI doesn't replace the
config file; it generates and manages it.**

### 1.5 ZeroTier desktop client — cautionary

ZeroTier's desktop UI is a small tray app that talks to a service
daemon (<https://github.com/zerotier/DesktopUI>). It's open source.

Known UX complaints, pulled from G2 and the ZeroTier forum
(<https://www.g2.com/products/zerotier-one/reviews?qs=pros-and-cons>,
<https://discuss.zerotier.com/t/zerotier-desktop-ui-exe-not-working-in-windows-11/18358>):

- "little tricky" UI
- UAC prompt loops on Windows
  (<https://github.com/zerotier/DesktopUI/issues/15>: clicking "No"
  relaunches the prompt)
- Dashboard-style admin is in the web app; desktop is purely status + join

**Lesson for `pim`**: if the privilege-escalation prompt fails, don't
resubmit it. Show a clear "we need admin to create a TUN — here's why"
panel and let the user retry on their own schedule.

### 1.6 Briar (Android)

Briar (<https://briarproject.org/>, F-Droid
<https://f-droid.org/packages/org.briarproject.briar.android/>) is the
*ethos* match: P2P, no cloud, Tor + Bluetooth + Wi-Fi transports,
offline-first, account is local.

**First run** (<https://briarproject.org/quick-start/>):

1. Pick nickname (permanent) + password (unrecoverable: "If you forget
   your password there's no way to regain access to your account.")
2. Battery-optimization permission grant. Briar explicitly explains:
   > "Briar needs to receive those messages itself" (because there's no
   > central server).
3. Add first contact, two options:
   - **Add contact nearby** — camera + location (for Bluetooth
     discovery) + Bluetooth. Scan their QR, they scan yours, ~30s.
   - **Add contact at a distance** — generates a one-shot link you send
     over another app (Signal, etc.). They paste theirs. Brokered via Tor.

**Transport indicators**: Briar displays per-contact transport status
(synced via Bluetooth / Wi-Fi / Tor), which is the closest precedent for
`pim` showing "this peer is reachable via BLE + egress via laptop."

**UX criticism**: Wikipedia calls the UI "barebones." Reviews note the
onboarding friction (three separate permission prompts) is high for
non-technical users.

**What `pim` should steal**:
- QR-code pairing for in-person peer add (no server involved).
- Per-peer transport legend.
- Permission request copy that is **honest about what's needed and why**
  — Briar's is actually quite good ("Briar needs to receive those
  messages itself").

**What `pim` should do better than Briar**:
- Don't make the first-run feel like a hostile questionnaire. Batch
  permissions. Explain with one panel, not three dialogs.
- Ship an identity that can be rotated. "No way to regain access" is
  fine as an ethical position but terrible UX without an emergency
  escape.

### 1.7 Meshtastic (Android + iOS)

Meshtastic (<https://meshtastic.org/docs/software/android/usage/>) is
the *architectural* match: proximity mesh with hardware config, very
close to `pim`'s mental model except `pim` is software-only.

**Bottom-tab IA**:
- **Nodes** — list of devices visible on your channel, with activity,
  location, distance, power
- **Conversations** — messages to other nodes
- **Mesh Map** — geographic map of nodes with GPS
- **Settings** — config (User, Device, LoRa, Network, MQTT, modules)
- **Connection** — device pairing (BLE / Wi-Fi / USB)

**Pairing** (<https://meshtastic.org/docs/getting-started/initial-config/>):
- App scans BLE, lists nearby devices.
- PIN from the device screen (or `123456` for headless).
- Regional frequency picker (compliance).

**Message delivery states** are shown as icons: RECEIVED, QUEUED,
ENROUTE, DELIVERED, ERROR — because LoRa is a lossy transport and the
UI is honest about that.

**Scaling problems they've hit**
(<https://github.com/meshtastic/Meshtastic-Android/issues/959>): at
100+ nodes the list becomes unusable; text overlaps. Their fix: add an
"Exclude MQTT" filter and move per-node metadata to subpages. `pim`
should plan for ≥100-peer lists from day one: dense rows, filter chips,
a detail pane.

### 1.8 OrbStack — the polish bar

OrbStack (<https://orbstack.dev/>, docs
<https://docs.orbstack.dev/compare/docker-desktop>) is the gold standard
for "small native app wrapping a big technical product."

Differentiators it advertises:
- Native macOS Swift, not Electron.
- 2-second cold start (vs Docker Desktop 30–60s).
- ≤300MB idle RAM (vs 2GB+).
- **Menu-bar-first**: "containers in menu bar" as a primary surface.
- Minimal onboarding.

From the reviews roundup
(<https://medium.com/@maneakanksha772/why-i-uninstalled-docker-desktop-and-switched-to-orbstack-podman-18f9614f3b6e>,
<https://inside.wpriders.com/how-orbstack-beats-docker-desktops-ram-usage/>):

> "OrbStack shows understanding that Mac developers want tools that work
> with their hardware, with thoughtful design decisions including a
> Debug Shell that helps troubleshoot, automatic domain routing that
> works seamlessly, and file access through Finder like any normal Mac
> application."

**What `pim` should steal**:
- Respect the host OS idioms. On macOS, make the menu bar the primary
  surface; on Windows, the tray; on GNOME, the top bar; on KDE, the
  system tray.
- Low resource usage as a *brand promise*. "Infrastructure you can read"
  should extend to "infrastructure you can afford to run always-on."
- Debug shell as a built-in affordance. Power users shouldn't need to
  leave the app to read a structured log.

`pim-ui` is Tauri-based (per the sibling research in
`/tmp/pim-ui-research-patterns.md`), which is not native Swift. Tauri is
the acceptable compromise: native OS webview (WebKit on macOS, WebView2
on Windows), far lighter than Electron, closer to OrbStack's profile
than Docker Desktop's. The OS-integration bar is still: menu bar, tray,
native notifications, system keyboard shortcuts.

### 1.9 1Password — the "build for beginners" doctrine

The public UX principles
(<https://1password.com/blog/design-values-ux-prinicples>):

> "**Build for beginners.** We make it easy for people new to 1Password
> to reach their goals, which also improves the experience for power
> users."

> "**Connect the dots.** From onboarding to error messages and from
> desktop to mobile, we make sure users have a seamless experience."

> "**Advocate for accessibility.** Every day we learn a little bit more
> about accessibility and apply that knowledge to our product work,
> aiming for progress over perfection."

The five together:
1. Embrace the problem
2. Advocate for accessibility
3. Build for beginners
4. Connect the dots
5. Iterate until it's great

**Key insight** for `pim`: **"Build for beginners" is the doctrine that
subsumes "serve Mira and curious-user at once."** You don't write two
UIs; you write the beginner's UI, and you make *sure it doesn't lie to
Mira* — everything the simple UI says should be accurate, just with
fewer knobs exposed by default. Advanced controls are hidden but
*reachable*, not absent.

1Password does this in practice by:
- Identical vocabulary everywhere ("vault," "item," "fill") whether
  you're on the mobile app, desktop app, CLI (`op`), or SSH agent.
- A CLI (`op`) that is a first-class peer to the GUI — not an
  afterthought.
- Developer-facing docs (`developer.1password.com`) that are written to
  the same bar as the consumer marketing site.

### 1.10 Proton VPN — privacy-first, wide audience

Proton VPN's redesign blog
(<https://protonvpn.com/blog/new-windows-ios-apps>):

> "your VPN should make protecting your privacy feel effortless."

Design choices:
- At-a-glance home screen: map + NetShield stats + single connect button.
- **Pin favorite connections** — like a recents/favorites pattern.
- Info tooltips (ⓘ) next to every advanced feature (explicitly listed
  as a way to avoid patronizing the user).
- Shortcuts to advanced features *on the Home screen* — a middle ground
  between beginner and advanced that avoids a mode switch.
- Open source on Windows (<https://github.com/ProtonVPN/win-app>).

**What to steal**: inline ⓘ tooltips with plain-language explanations.
No modal wall of jargon on hover. This is the pragmatic answer to "how
do you explain DAITA/WireGuard/MagicDNS without a degree?"

---

## 2. Onboarding patterns for networking/privacy/VPN products <a id="2-onboarding-patterns"></a>

### 2.1 Identity generation

Three observed models:

| Model | Examples | Trade-off |
|---|---|---|
| **SSO / account** | Tailscale, Proton, Mullvad (account number), Cloudflare WARP | Fast first-run; requires central infra. |
| **Enrollment code** | Nebula (Defined), WireGuard | Separates identity from UI; user pastes a token. |
| **Local-only keypair** | Briar, WireGuard (self-hosted), Meshtastic | No cloud, but pairing is the UX burden. |

`pim` is explicitly no-account, no-cloud. That forces the **local
keypair + peer pairing** model — Briar and Meshtastic are the
precedents.

Best practice for key generation UX (distilled from Briar / Signal / SSH
tooling):
1. Generate silently on first launch. Don't make the user watch entropy
   bars — that's 2004 PGP.
2. Assign a **device name** automatically from hostname, let them edit
   it inline. Mullvad and Tailscale both do this.
3. Let them choose a short, memorable **identifier** (Mullvad's is the
   account number; Briar's is the nickname). For `pim` this is the peer
   ID or its handle.
4. **Don't** surface the private key unless the user drills into "Advanced
   → Export identity." Briar lists "you can't recover your account" on
   the initial password screen — this is over-honest and frightens
   first-timers. Tell them on the export screen instead.

### 2.2 Device naming

- Tailscale: "devices are 'assigned a unique name generated from the
  device's OS hostname.'" Editable from admin console.
- Mullvad: "Device name (assigned automatically)."
- Briar: nickname; **permanent, can't be changed** (punishing).

For `pim`: auto-generate from hostname; let the user edit inline
during onboarding; allow rename later. Never make it permanent.

### 2.3 The first successful connection

The strongest UX moment is **the first time data crosses the mesh**.
Examples:

- **Tailscale**: after SSO, "the device will appear in the browser
  window" — the success cue is seeing your own device in the list.
- **Mullvad**: the map dot turns green and the padlock closes.
- **Briar**: first contact appears after ~30s of Bluetooth sync.
- **Meshtastic**: the node list populates with nearby devices after
  pairing.

For `pim`, the canonical moment is: *a packet you generated traversed
a peer and reached egress*. The UI should mark this explicitly — not
"Connected," but something like:

```
 STATUS  ┌─ you ──► [laptop-kitchen] ──► egress (198.51.100.1) ──► reachable
```

That's richer than a green dot and rewards the mesh-native mental model.

### 2.4 Onboarding models

- **Wizard**: Nebula (enroll code → install → ready), Windows installers
  generally. Linear, ordered.
- **Ask-forgiveness / just-works**: Tailscale desktop (install → SSO
  → done), Mullvad (install → paste account number → connect).
- **Interrogation-style**: Briar (nickname, password, password-confirm,
  battery permissions, location permission, camera permission, Bluetooth
  permission). Widely criticized.

**For `pim`**: a 3-step ask-forgiveness flow:
1. Name your device.
2. Grant TUN / VPN permission.
3. Add your first peer — **or skip and use the internet egress as a
   solo node right now**.

Crucially, step 3 must be skippable. A solo node that routes via
whatever egress it can reach should be the baseline experience even if
there are zero peers.

### 2.5 Common first-run failures

Collated from issue trackers (ZeroTier, Tailscale, WireGuard):

| Failure | Fix |
|---|---|
| TUN creation denied (no sudo) | Clear "needs admin" panel, not a loop. Let retry. (See §7.) |
| Port bind conflict (51820, 3478) | Detect the conflict, name the offender, suggest an alternative port. Do not just fail silently. |
| IPv6 disabled at OS level | Fall back cleanly; don't claim degraded-mode failure. |
| Captive portal intercepting DNS | Detect (classic captive-portal probe); advise "sign in to Wi-Fi first." |
| Corporate MDM blocking TUN | Detect the failure class, show "contact IT" with the MDM config snippet. |
| Time skew > 5min | Show NTP hint — Reticulum + mesh crypto is clock-sensitive. |

---

## 3. Real-time state / connection status UX <a id="3-real-time-state"></a>

### 3.1 State vocabulary

Canonical set observed across Mullvad, Tailscale, WireGuard, Proton:
- **Disconnected** / Off
- **Connecting** / Starting
- **Connected** / On
- **Reconnecting** (after network change)
- **Blocking internet** (kill-switch active — Mullvad)
- **Degraded** (Tailscale: relay-only, no direct)
- **Error** (critical, needs user action)

Mullvad's literal label "Blocking internet" is a great example of
**telling the truth even when it's inconvenient**. Consumer VPN apps
love to show a green checkmark even when the kill switch has killed
the LAN. Don't.

### 3.2 Visual hierarchy

Three surfaces, in order of glance-ability:

1. **Menu bar / tray icon** — single most important affordance.
   - Tailscale: dot + color on dock icon for critical errors.
   - Mullvad: green/red padlock with color overlay for alerts.
   - `pim` should have: a glyph that encodes **(connected? y/n) × (via
     peer? y/n) × (critical error? y/n)**. The brand's ASCII box-drawing
     discipline suggests a small character glyph with one accent dot.

2. **Main window chrome**: always-visible banner with the same state.
   - Mullvad shows the header in solid green/red.
   - Tailscale shows a sidebar-bottom error strip.
   - `pim`: a top-of-window ASCII-rule (`══`) colored by state.

3. **OS notification**: only for transitions requiring user attention
   (disconnected unexpectedly; peer added; trust expiring). Don't notify
   on every peer online/offline.

### 3.3 Live-updating peer list

Patterns observed:
- WebSocket with server-push of state diffs (Tailscale embedded admin
  web UI uses this; Go `watch` endpoint).
- Polling every 1–3s (most VPN apps).
- Tauri event bus (`emit`/`listen`) if UI and daemon coexist.

For `pim` with a Rust daemon and a Tauri UI, the right answer is almost
certainly a **long-lived WebSocket or Unix-domain-socket stream** from
daemon → UI, with events like `peer_added`, `peer_lost`, `throughput`,
`route_changed`. Polling is fine for status indicators; events are
necessary for throughput graphs and topology changes.

### 3.4 Throughput visualization

Three canonical idioms:
- **Sparkline graph** (tiny inline): Activity Monitor, iStat Menus,
  OrbStack container list. Low visual noise; encodes trend.
- **Dial / gauge**: Speedtest apps, consumer VPNs. Showy, rarely
  useful.
- **Number + delta**: Mullvad settings, iftop. Honest but boring.

For `pim`: sparkline per peer in the list, big sparkline on the peer
detail pane. Numbers should be in raw bytes with a clear prefix (K/M/G
binary or decimal — pick one and stick). Do not animate without purpose.

### 3.5 Topology: "you are routing via X"

This is the hardest and most unique UX challenge for `pim`, because
*overlay mesh routing* is not a common mental model.

Options observed:
- **Tailscale's relay indicator**: a small badge "via DERP" on a peer
  row. Terse but legible.
- **Meshtastic's hop count**: "3 hops" text next to a node.
- **Reticulum's path announce**: terminal output showing
  `destination ← intermediate ← origin`.

Recommendation for `pim`: borrow the Reticulum idiom in ASCII form.
A dedicated "route" panel in the peer detail pane that renders:

```
  you  ──►  phone-pocket  ──►  laptop-cafe  ──►  egress-node
         42ms            18ms             9ms
                                          ▲
                                          │
                                       198.51.100.1
```

Small monospace ASCII diagram, latency per hop, current egress IP. This
*respects the brand* (monospace, box-drawing) and is *more informative*
than a green dot could ever be. If Mira wanted to switch egress, she'd
right-click any node and pick "route via this peer."

### 3.6 Latency vs throughput representation

- Latency: integer milliseconds. Color-code above certain thresholds
  (<50 green, 50–200 neutral, >200 warn).
- Throughput: sparkline + text. Never auto-log-scale without a label.

---

## 4. Progressive disclosure patterns <a id="4-progressive-disclosure"></a>

### 4.1 The canonical doctrine

From Nielsen Norman Group's foundational article
(<https://www.nngroup.com/articles/progressive-disclosure/>):

> "Initially, show users **only a few** of the most important options"
> with "a **larger set** of specialized options upon request."

NN/G's two success conditions:
1. **Correct feature split**: the initial display must avoid confusing
   elements.
2. **Clear progression mechanics**: the "more" affordance must be
   visible and descriptive.

NN/G's anti-patterns:
- More than two levels of disclosure → disorientation.
- Hiding interdependent steps ("you have to click 'Show advanced' to
  access step 3 of a 5-step flow") → failure.

### 4.2 Four real-world approaches observed

| Approach | Example | Verdict |
|---|---|---|
| **Beginner/Advanced mode toggle** | Safari Developer menu; Windows "Show more settings" | Works when the two sets are truly disjoint. Usually not the case. |
| **Collapsible sub-sections** | Mullvad (WireGuard / OpenVPN / Server IP override) | Best for structured settings. Handles *many* advanced knobs gracefully. |
| **Inline tooltips (ⓘ)** | Proton VPN, GitHub settings | Best for explaining-not-hiding. Use for jargon, not for hiding options. |
| **Command palette** | Raycast, Arc, Warp, Linear (⌘K) | Best for power-user shortcuts. Does not replace main UI. |

`pim` should combine all four:
- **No mode toggle**. 1Password's "build for beginners also serves
  power users" doctrine.
- **Collapsible sections** for grouped advanced settings (routing,
  transport, egress policy).
- **Inline ⓘ tooltips** with plain-language definitions, linking to
  `docs.pim.net/terms/TUN` or similar. Protocol docs are first-class,
  this is where that promise is cashed.
- **Command palette (⌘K)** for power users: "ping peer," "rotate key,"
  "open log file," "restart daemon," "export config."

### 4.3 Raycast's cautionary tale

Raycast is often cited as the command-palette ideal, but even its own
community (<https://www.raycast.com/faq>) notes that defaulting to
"show everything" causes noise:

> "Raycast is considered to include 'too much' by default, allowing
> users to run not only installed applications and everyday tools, but
> also low-level OS utilities like 'Disk Utility' and 'Keychain
> Access'"

Takeaway for `pim`: **the ⌘K palette should default to the 8–10 most
useful commands**, with "Show all commands" as the escape. Don't put
`daemon.restart_with_env_override` two keystrokes away.

### 4.4 Writing microcopy that respects the user

Heuristics, synthesized:
- **Never call a feature "Advanced" in its label.** Call it the thing it
  is ("Routing," "Key expiry," "Transport"). Mullvad does this; WireGuard
  does not.
- **Never use marketing adjectives** ("Premium," "Pro," "Military-grade").
  `pim`'s brand positioning ("instrument-grade") earns this by sobriety,
  not by adjectives.
- **Use measurement units** ("12 ms," "3 hops," "1.2 MB/s"). Numbers
  respect the user.
- **Use plain failure language**. "Can't reach egress" not "Connectivity
  degraded due to routing loop anomaly."

---

## 5. Config editor UX <a id="5-config-editor-ux"></a>

### 5.1 Form-based vs text-based

| Product | Paradigm | Notes |
|---|---|---|
| Tailscale GUI | Pure form + admin console ACLs in HuJSON | The raw HuJSON editor is a text area with syntax highlighting + validation; they don't pretend it's simple. |
| Mullvad | Pure form | Every knob is a control; no raw file editor. |
| WireGuard GUI | **Form + raw text side-by-side** | "Add tunnel" has a form; "Import tunnel from file" accepts a `.conf`. The same dialog can paste raw. |
| ZeroTier | Web admin forms + CLI `zerotier-cli` | Desktop has no editor. |
| Nebula DN | Enrolled profile only; raw YAML is the CLI-client side | Clean split. |
| Meshtastic | Form per category (User / Device / LoRa / etc.) | Many forms, not one giant one. |

### 5.2 When does the raw file editor make sense?

**It makes sense when**:
- The config format is already the industry-standard (WireGuard `.conf`,
  Nebula YAML) and users are sharing configs externally.
- Power users need to diff and version-control their configs.

**It does not make sense when**:
- The config is the tool's internal state (no one shares it).
- Editing raw is dangerous without validation (most mesh/VPN configs).

`pim`'s config is TOML (per project docs). Recommendation:
- **Default**: form editor with all fields labeled in plain language,
  grouped into collapsible sections.
- **Power-user toggle** (reachable from ⌘K: "Open raw config"): opens a
  Monaco-powered TOML editor with **inline lint** from the daemon's
  schema.
- **Side-by-side preview**: below each form field, a muted line showing
  the corresponding TOML key. This is the **Linear / Tailwind Play**
  idiom. Helps Mira learn the config language without opening the file.
- **Save-time validation** that calls `pimd config validate` and
  surfaces errors at the line in the raw view *and* the field in the
  form view.

### 5.3 Validation UX

- **Inline** (Monaco / CodeMirror linting): red squiggles as you type.
- **On blur**: after you leave a form field, validate.
- **On save**: the daemon rejects and the UI must not have lost state.

`pim-ui` should do all three. The hardest class of bugs is
"Tauri UI has drifted from daemon-accepted state." The daemon must be
the arbiter; the UI must accept a REJECT and keep the edit buffer intact.

### 5.4 Config diff

Nobody in the sample ships a native config-diff view in the GUI — most
defer to `git diff`. If `pim` wants one, the reference is **Obsidian's
file-diff plugin** and **Monaco's built-in diff editor**. For a v1:
before-save, show a diff of the pending TOML against the live TOML.
That's enough.

### 5.5 Config export / import for sharing

WireGuard's import-from-`.conf` is the canonical idiom
(<https://help.bitlaunch.io/en/articles/11864454-how-to-import-configs-in-wireguard>).
Briar's "generate a link you send over Signal" is the P2P-ethos variant.

For `pim`:
- **Export**: one-click export to a pastable TOML snippet, or a QR code,
  or a `pim://join/` link. QR is useful in-person; link is useful over
  messaging.
- **Import**: paste / scan. Import should present a **preview diff**
  (what will change) before applying.

---

## 6. Empty states, first-run, "zero peers" <a id="6-empty-states"></a>

### 6.1 The canonical failure

Most apps in this space handle zero-peers as "you're broken, go do
something." Briar's zero-contact screen is a single "Add Contact"
button on a blank list. Tailscale's empty tailnet is the "add your first
device" OS picker.

Better: **a node with zero peers is still useful if it can egress**.
`pim`'s solo-node case should say so:

```
 ┌──────────────────────────────────────────┐
 │ you are alone on the mesh                │
 │                                          │
 │ ─ routing via local egress (198.51.100.1)│
 │ ─ no peers visible                       │
 │                                          │
 │ [ add a peer nearby ]  [ invite remotely ]│
 └──────────────────────────────────────────┘
```

Two actions. One physical ("nearby" — QR + Bluetooth scan, Briar-style),
one remote ("invite" — generates a `pim://` link). Both skippable.

### 6.2 Invite / pair paradigms

| Paradigm | Examples | Fit for pim |
|---|---|---|
| **SSO-coordinated** | Tailscale | Violates pim ethos (no central server). |
| **Enrollment code** | Nebula | OK; identity lives elsewhere. |
| **QR code in-person** | Briar, Signal | **Primary path**. Matches "proximity" ethos. |
| **Deep-link / magic-link** | Signal, Keybase, Briar "at a distance" | **Secondary path** for remote invites. |
| **Copy-paste ID string** | WireGuard pubkey, ZeroTier network ID | Acceptable fallback. |

`pim`'s default should be the QR+BLE model: two phones in the same room
can pair without any internet. Briar's "at a distance" link should be
the brokered-via-any-chat fallback.

### 6.3 Invite copy

Briar uses "Add contact nearby" / "Add contact at a distance." These are
more honest than "invite a friend" — they describe the *physical state
of the world*, not a social primitive. For `pim`:

- "Add a peer nearby" (QR + BLE)
- "Invite a peer remotely" (shareable link)
- "Join an existing mesh" (enter a link or paste)

---

## 7. Permissions / privilege escalation UX <a id="7-permissions"></a>

### 7.1 The permission list by platform

| Platform | Mechanism | User prompt |
|---|---|---|
| **macOS** | System Extension (Network Extension) OR LaunchDaemon + `utun` | System Settings → "Allow" button required on first install. Requires reboot for some System Extension types. |
| **Linux** | `/dev/net/tun` (CAP_NET_ADMIN) via setuid helper, polkit, or systemd unit | Varies widely. Polkit is the polite option. |
| **Windows** | TUN driver install (Wintun) + service install | UAC prompt. |
| **Android** | `VpnService.prepare()` | One-time system dialog. Always-on adds a second opt-in in Settings. |
| **iOS** | Network Extension entitlement | System dialog on first connect. |

### 7.2 macOS: the System Extension dance

From Apple's docs
(<https://developer.apple.com/documentation/xcode/configuring-network-extensions>)
and community guides
(<https://protonvpn.com/support/macos-network-extensions>):

1. App requests to install Network Extension.
2. macOS shows "System Extension Blocked" notification.
3. User goes to System Settings → Privacy & Security.
4. Clicks "Allow" next to the extension's entry.
5. On some macOS versions, a reboot is required.

This is a **tortuous first-run** that every networking app must survive.
Best-practice UX:
- **Don't start the flow before the user is ready.** Show a panel
  explaining the steps *with screenshots of the macOS prompts that will
  appear*, then a single "Allow network extension" button.
- **Detect the allow** via `SystemExtensions.framework` callback and
  advance automatically.
- **Don't nag.** If the user denies, let the app remain usable in a
  "limited mode" (no TUN, so peer lookup only — no forwarding) and show
  a persistent "Allow network extension to enable forwarding" banner.

ProtonVPN's guide explicitly walks users through it screen by screen —
this is the bar.

### 7.3 Windows: UAC

UAC prompts from the UI process are the classic trap. ZeroTier's
infinite-UAC bug (<https://github.com/zerotier/DesktopUI/issues/15>) is
the cautionary tale. Approach:
- Split the UI (unprivileged, user session) from a **service** (SYSTEM)
  that owns the TUN. Signed installer sets up the service.
- UI talks to the service over a local RPC (named pipe). No UAC after
  install.
- "Modify config" actions that require service-level changes (rare)
  should ask UAC explicitly with an explanation.

### 7.4 Linux: the polite options

Best-practice: a systemd user unit (for per-user daemons) OR a system
unit activated by the installer, with polkit rules for the
privilege-requiring parts. The UI runs as the user and talks to the
daemon over a Unix domain socket.

### 7.5 Android VpnService

Android's `VpnService` prompt is a system dialog the user must OK. Best
practice (<https://developer.android.com/develop/connectivity/vpn>):

- Explain what `pim` will do with the VPN interface *before* triggering
  the prompt. "pim will create a VPN interface to route your traffic to
  nearby peers. No data is sent to pim servers (there are none)." Then
  the button.
- Handle "always-on VPN" correctly: disable the disconnect UI when
  always-on is enabled (as the platform requires).
- Persistent, non-dismissible status notification while active
  (platform requirement).

### 7.6 iOS Network Extension

Single system dialog on first connect. Less painful than macOS. App must
have the Network Extensions entitlement from Apple — this is a manual
approval step from Apple (`developer.apple.com`) and is not a runtime UX
concern.

### 7.7 "Why do you need admin?" copy

Draft, openly stolen from Briar's directness and Tailscale's technical
honesty:

> `pim` forwards IP traffic across mesh peers. That needs a virtual
> network interface on your machine (a "TUN"), which only the operating
> system can create. Creating a TUN requires one administrator approval
> from you, now.
>
> `pim` doesn't keep admin access after that. The daemon runs with
> minimum permissions, and a system service handles the TUN.

Short. Names the mechanism (TUN). Addresses the trust question (we
don't keep admin). Doesn't patronize.

---

## 8. Error / failure state UX <a id="8-errors"></a>

### 8.1 The canon

| Error class | Detection | UX |
|---|---|---|
| Daemon crashed | UI can't reach daemon socket | Red banner: "pim daemon is not running." Button: "Restart daemon." Button: "View last 100 log lines." Auto-retry with backoff. |
| Port bind conflict | Daemon can't bind WireGuard/QUIC/whatever port | Name the conflict: "Another process is using UDP port 51820 (Orbot)." Suggest alternative port. Deep-link to config. |
| Peer unreachable | Ping failing | Per-peer badge: "last seen 14m ago, offline." Don't block the UI. |
| Gateway lost | No peer can egress | Toast: "No peer can reach the internet right now. You can still talk to peers on the local mesh." Don't disconnect. |
| Network change (Wi-Fi → cellular) | OS notification | Auto-reconnect; flash a brief info banner; don't modal. |
| DNS breakage | MagicDNS equivalent can't resolve | "Peer names unresolved — falling back to IP addresses." Never silently swap. |
| Trust / key issue | Signature fail, expired cert | Red card: "Key for [peer-name] no longer trusts us. Re-pair to continue." Don't auto-accept. |

### 8.2 Key principle: **degrade, don't disconnect**

Tailscale and Mullvad both do this well. A relay-only connection on
Tailscale is labeled as "via relay" but *not* as "disconnected." A
Mullvad blocked-by-firewall state is "Blocking internet," not
"Disconnected." `pim` should adopt this vocabulary:

- `routing` — normal
- `partial` — some peers reachable, some not
- `solo` — no peers reachable but egress works
- `stuck` — no peers and no egress
- `off` — user disabled
- `error` — requires attention

### 8.3 Log surfacing

Every app above has a log viewer. OrbStack and Tailscale both build
in-app structured log panels. The minimum bar:
- Last N (1000?) log lines visible in-app.
- Filter by level (info/warn/error).
- Copy-all + "report bug" that packages the log with device metadata.

### 8.4 Reporting UX

Tailscale and Mullvad both have in-app "report a bug" that submits a
small diagnostic bundle. For `pim`, given the no-cloud ethos, the right
idiom is:
- "Save diagnostic bundle" → a zip with redacted logs, config, peer list.
- User sends it *wherever they want* (email, GitHub issue, Matrix).

Never phone home.

---

## 9. Discoverability for power features <a id="9-discoverability"></a>

### 9.1 Command palette (⌘K)

**Who does it well**:
- **Raycast**: the gold standard; extensions, favorites, keyboard-native.
  Cautionary: includes too much by default.
- **Linear**: action-oriented, terse labels, fast.
- **Warp**: palette for terminal actions.
- **Arc browser**: command bar as primary affordance.

Design pattern for `pim`:
- ⌘K opens a palette with 8–12 curated top commands: Connect,
  Disconnect, Ping Peer…, Copy Peer Address, Add Peer Nearby, Add Peer
  Remotely, Rotate Identity, Open Raw Config, View Logs, Restart Daemon.
- Type-ahead for peer names: "ssh laptop-kitchen" → runs SSH to that
  peer's IP.
- **Every menu action must also be a palette command.** Discoverability
  comes from consistency.

### 9.2 Menu bar / system tray

Already argued above (§3.2). Summary: menu bar is the primary surface
on macOS; tray is primary on Windows; top-bar extension on GNOME; tray
on KDE. Main window is the secondary surface.

On macOS, follow Macworld's old but still-correct advice
(<https://www.macworld.com/article/220375/why-some-apps-belong-in-the-menu-bar-not-the-dock.html>):
daemon-style apps default to menu-bar-only (LSUIElement=true), **with a
user setting to show a Dock icon** — because some users genuinely prefer it.
Tailscale's redesign learned this the hard way.

### 9.3 Deep-linking

`pim://` URL scheme, minimum:
- `pim://join/<blob>` — pair with a remote peer via link.
- `pim://peer/<id>` — open the peer detail pane.
- `pim://route/status` — open the status page (good for bookmarks).
- `pim://config?section=routing` — deep-link into a settings section.

Deep-links should round-trip with the web: if `pim.net` ever grows a
docs browser, links from docs can open the app at the relevant section.

### 9.4 Keyboard shortcuts for "terminal-native" aesthetic

Observed conventions:
- ⌘K — palette
- ⌘F — search within list
- ⌘, — preferences
- ⌘R — refresh / rescan peers
- ⌘L — focus address-like field (peer ID)
- j/k — navigate up/down lists (vim-muscle-memory)
- ⌘⇧L — open logs
- ⌘⇧D — toggle daemon

j/k navigation is rare in consumer apps but **mandatory** for the
terminal-native aesthetic. Raycast, Linear, Arc, and Warp all support it.

---

## 10. Cross-device consistency <a id="10-cross-device"></a>

### 10.1 Examples done well

**1Password** is the gold standard. The same vault concept, the same
item types, the same vocabulary, across iOS, Android, macOS, Windows,
Linux, browser extension, and CLI.

**Proton** does it well: a "Proton Suite" (Drive, Mail, VPN) with a
recognizable design language, but they're clearly separate apps.

**Tailscale** does it by minimalism: same left-sidebar + center-list IA
across macOS, Windows, and the web admin; mobile uses tab bars because
iOS/Android HIG demands it.

### 10.2 What changes between contexts

Non-negotiable: **identity and language stay the same**. If it's called
a "peer" on desktop, don't call it a "contact" on mobile.

Negotiable:
- **Primary surface**: menu bar (macOS), tray (Windows), notification
  shade (Android), control center widget (iOS).
- **Density**: mobile accepts less information per screen; prioritize
  one-peer-at-a-time details.
- **Input**: desktop has keyboard (palette!), mobile has gestures
  (swipe to archive/remove peer).
- **Notifications**: mobile notifications are the primary presence
  surface; desktop OS notifications are secondary.

### 10.3 Mobile-first features that map back

- **Always-on** (Android `VpnService` flag) → desktop "auto-connect on
  launch."
- **Low-power mode** → desktop "battery saver" (suspend non-critical
  peer pings).
- **Background refresh** (iOS) → desktop service survives app-window
  close.

Design each mobile feature with its desktop analog in mind. 1Password's
"Connect the dots" principle.

---

## 11. Aesthetic references close to pim's brand <a id="11-aesthetic"></a>

### 11.1 The brand: instrument-grade, terminal-native

Given monospace typography, ASCII box-drawing, dark green phosphor, no
gradients, no mascots, and the positioning "Infrastructure you can
read" — the right references are:

### 11.2 Charm.sh — "we make the command line glamorous"

(<https://charm.land/>, <https://charm.land/blog/the-next-generation/>)

> "We make the command line glamorous."

> "wanted to bring that modern product thinking to the command line"

> "separation of concerns between structure and style"

Charm's Bubble Tea, Lip Gloss, Gum, Glamour ecosystem is the *closest
aesthetic precedent for `pim`'s brand*. They prove that:
- You can design a CLI-native product with real product rigor.
- Monospace + ASCII + selective color ≠ ugly.
- The terminal can feel like a product.

What `pim-ui` (a graphical app) can steal from Charm:
- Spacing via monospace grid (1ch units).
- ASCII rules (`═══`, `───`) as literal UI dividers.
- Accent color sparingly — phosphor green for the single signal
  (connected) state, everything else neutral.
- Typography that looks like the log output of the daemon.

### 11.3 Ghostty — native, not Electron

(<https://ghostty.org/>, <https://github.com/ghostty-org/ghostty>)

Ghostty's positioning is educational for `pim`:

> "Ghostty is a terminal emulator that differentiates itself by being
> fast, feature-rich, and native, offering an alternative to terminals
> that force you to choose between speed, features, or native UIs."

It's native AppKit on macOS and GTK4 on Linux. It uses a GPU shader
pipeline with single-digit-millisecond latency. JetBrains Mono as an
embedded default. The discipline: **respect the platform, ship fast
defaults, let power users customize but never force them to**.

`pim-ui` runs in Tauri (webview), so it can't exactly match Ghostty's
profile. But the *posture* — fast, honest, no fake polish — is right.

### 11.4 Linear — the dark-first single-accent school

(<https://linear.app/>,
<https://linear.app/now/how-we-redesigned-the-linear-ui>)

Linear's redesign writeup:

> "adjusted the sidebar, tabs, headers, and panels to reduce visual
> noise, maintain visual alignment, and increase the hierarchy."

Three theme variables (not 98), LCH color space, paired light/dark
scales (not dark-as-afterthought). For `pim`:

- Use LCH (or OKLCH) for generating the phosphor-green scale from a
  single seed. Tailwind 4 supports this natively.
- Build dark-first — since `pim`'s brand is dark — and *derive* a
  light theme from the same generators. Don't hard-code both.
- Reduce chrome aggressively. Linear's minimal purple is the analog of
  `pim`'s phosphor green: used only where it signals.

### 11.5 Warp — blocks as info architecture

(<https://www.warp.dev/>)

> "Warp originated the terminal Block, grouping input and output together
> for easier navigation."
> "Blocks keep the input and output grouped into 1 unit, reducing
> context switches by 28%."

Warp's "block" is really just a structured log unit with metadata. For
`pim`, an event log view should be block-based:

```
 ┌─ 14:02:08 ─ peer-discovered ──────────────┐
 │ ssh laptop-cafe at fe80::abcd (ble)        │
 │ rtt 12ms, trust: unknown                   │
 │ [ accept ] [ deny ] [ view cert ]          │
 └────────────────────────────────────────────┘
```

This is the "honest log" rendered as UI — inspectable, scrollable,
filterable, copyable. Warp is the precedent.

### 11.6 Raycast, Arc — command-palette normality

They prove a ⌘K palette can be the app's spine, not a hidden feature.
See §9.1.

### 11.7 OrbStack — small, fast, native

Already covered. Aesthetic-wise: restrained icons, flat surfaces, native
macOS sidebar, menu-bar first.

### 11.8 The "it looks cool but is it usable?" test

A risk with the phosphor/ASCII aesthetic is that it becomes **a
costume**, not a product. Mitigations observed in Charm, Warp, Linear:

- Interactive controls must still look interactive (hover states,
  focus rings — WCAG AA).
- Monospace body text is OK for data (peer IDs, addresses) but for long
  explanatory copy (permission justifications, empty-state text), use
  a *slightly* proportional pair (e.g., JetBrains Sans or Inter for body,
  JetBrains Mono for data). Linear uses Inter + Inter Display
  (<https://linear.app/now/how-we-redesigned-the-linear-ui>).
- Green-on-black is brand-legible but accessibility requires a
  minimum 4.5:1 contrast ratio for body text (WCAG AA). Verify.

---

## 12. Anti-patterns to explicitly avoid <a id="12-anti-patterns"></a>

### 12.1 NordVPN / ExpressVPN "consumer polish"

NordVPN is currently defending class-action suits over dark patterns
(<https://www.law360.com/articles/2464579/nordvpn-hit-with-dark-patterns-class-action>)
and has received recurring UX criticism:

> "NordVPN's apps could all stand to undergo a little more quality
> control, with elements distracting from other elements and inconsistent
> designs from platform to platform... the map takes up space that would
> have been better allocated to the server list, and the settings list
> makes the mistake of not keeping all its tabs visible in the window —
> if you open one, you have to click back to the main menu to reach
> another page."

Things `pim-ui` must not do:
- Animated rotating globe. (Looks cool in a screenshot, useless in
  motion.)
- "Quick Connect" button that hides which server is chosen.
- Gamified trust scores / "boost" buttons.
- Inconsistent settings navigation across platforms.
- Default-on auto-renewal (even irrelevant to `pim` since no billing —
  but the *vibe*: no dark patterns around disconnect, kill-switch,
  or telemetry opt-in).

### 12.2 Enterprise VPN tools assuming sysadmin literacy

Cisco AnyConnect, Palo Alto GlobalProtect, FortiClient — these assume
you know what Group Policy, split-tunnel exclusion, and SAML IdP mean.
They fail at the curious-user persona entirely.

`pim-ui` must not:
- Require a username/password/server-url trio on first run.
- Show a log viewer as the primary surface.
- Call itself "Client" ("pim Client" — no). Call it `pim`.

### 12.3 Over-wizardly onboarding

A 7-step onboarding wizard for a VPN is infantilizing. Briar's 5-step
flow is already too much for casual users.

Target: **3 steps maximum for `pim`'s first-run.** Skip to app after
step 3 even if the user hasn't configured peers.

### 12.4 Hiding complexity to the point of lying

Tailscale used to show "Connected" for any state including DERP-relay
fallback. Users of the old UI on forums reported being surprised their
"connection" was relayed through Seattle. The redesign now makes this
explicit.

Meshtastic's honest message delivery states (QUEUED, ENROUTE, DELIVERED,
ERROR) are the inverse — they take a slightly confusing underlying
reality (LoRa is lossy) and surface it faithfully.

`pim` is in Meshtastic's corner: the underlying reality (mesh, hops,
partial connectivity) is interesting and the UI should respect that.

### 12.5 Microcopy anti-examples

- "You're protected!" (consumer VPN lie — protected from what?)
- "🚀 Boost your connection" (emoji + marketing)
- "Something went wrong" (unhelpful error)
- "Connecting..." (indefinite; give the user the stage or the ETA)
- "Click here for Advanced settings" (why hidden?)

### 12.6 Dock icon / menu bar misuse

(Covered §3.2 and §9.2.) The short version: don't park an icon in the
Dock that stays even when no window is open. Users will hate you for it.
Make it a user setting with a sane default (off on macOS).

---

## 13. Top 5 UX principles `pim-ui` should follow <a id="13-top-5"></a>

Opinionated, ranked, defensible.

### Principle 1 — Build for beginners, which also serves Mira

(The 1Password doctrine.)

Do not ship two UIs. Do not ship a "simple / advanced" toggle. Ship one
UI whose **defaults, language, and spatial prominence** match the
curious first-time user — and make sure every control that user sees is
**truthful and accurate** for Mira. Advanced controls are present but
lower in the disclosure hierarchy: behind collapsible sections, behind
the command palette, behind the raw-TOML viewer, behind the in-app log
viewer. Never *absent*.

This means:
- Settings are organized by what they do ("Routing," "Identity,"
  "Transport"), not by whether they're "Basic" or "Advanced."
- Jargon gets inline plain-language tooltips, not hidden away.
- The empty state is genuinely useful (solo-node routes to egress), not
  a scolding page.

Evidence: 1Password design principles, Mullvad settings hierarchy,
Proton VPN tooltip strategy.

### Principle 2 — Honest protocol surfacing: "infrastructure you can read"

The brand promise is "infrastructure you can read." The UI must cash
that promise.

- Never say "Connected" when the connection is relayed. Say "via
  laptop-kitchen" or "via relay."
- Never say "Disconnected" when the kill-switch is blocking internet.
  Say "Blocking internet" (Mullvad).
- Show peer topology as ASCII routes with hop latency. Don't abstract
  it into a green dot.
- Show transport per peer (BLE, Wi-Fi, LAN, WAN, relay). Don't hide
  how packets get there.
- Log every interesting event in a block-based, scrollable in-app viewer
  (Warp-style).

Evidence: Tailscale 2025 redesign explicitly surfaces direct vs relay
routing; Mullvad's "Blocking internet"; Meshtastic's per-message
delivery states.

### Principle 3 — Respect the OS idiom; respect the daemon

`pim` has two loyalties: to the operating system it runs on, and to the
Rust daemon that is the real product.

OS-loyalty:
- Menu bar first on macOS (LSUIElement true by default).
- Tray first on Windows. UAC only during install.
- System-extension installation is gated by an honest, screenshot-lit
  explainer, not a loop.
- Always-on VPN on Android follows platform rules (persistent
  notification, disabled disconnect when always-on is enforced).

Daemon-loyalty:
- UI is never the source of truth for config or state. Daemon is.
- UI must accept daemon REJECTs gracefully and preserve the user's
  edit buffer.
- UI streams events from the daemon in real-time; it does not poll and
  lie.
- UI must remain useful in **limited mode** if the daemon is down (show
  last-known state, offer to restart).

Evidence: OrbStack's native-first ethos; Tailscale's menu-bar-only
failure and the subsequent redesign; ZeroTier's UAC loop as the
cautionary bug.

### Principle 4 — Three disclosure layers, not two modes

Borrow the Mullvad + Linear + 1Password hybrid:

- **Layer 1 — Main window**: connected? Who? How? One-click actions.
- **Layer 2 — Settings sections (collapsible)**: grouped knobs with
  plain labels and inline ⓘ tooltips.
- **Layer 3 — Command palette ⌘K + raw TOML editor + in-app logs**: for
  Mira. Fast, powerful, discoverable only by those who look.

Never use "Advanced" as a label. Never add a third mode. Never nest
more than two levels of disclosure (NN/G's rule).

Evidence: Mullvad's collapsible-section settings; Linear's ⌘K; NN/G's
research on maximum disclosure depth; 1Password's vocabulary
consistency.

### Principle 5 — Onboarding in ≤3 steps; solo mode is a first-class state

Most users should reach a usable state in three interactions:

1. Name this device.
2. Grant TUN permission (with honest explanation of why).
3. Add a peer — OR skip and run as a solo egress node.

Zero-peer state is not an error. It's a valid operational mode. The UI
should:
- Show the solo node's egress routing.
- Offer "Add peer nearby" (QR+BLE, Briar-style) and "Invite peer
  remotely" (`pim://` link).
- Not block any other feature behind having a peer.

Onboarding must survive:
- Permission denial (limited mode).
- Network failure (retry with backoff, don't lose user input).
- User backing out (state persisted, can resume).

Identity generation happens silently — no entropy bar theatre, no
threatening "you can never recover this password" (write that warning
on the export screen instead).

Evidence: Briar's onboarding criticized for being too heavy; Tailscale's
redesign aiming at "fewer clicks to ready"; 1Password's "build for
beginners" doctrine.

---

## 14. Appendix — all URLs referenced <a id="14-urls"></a>

### Primary references (fetched directly)

- <https://tailscale.com/blog/windowed-macos-ui-beta>
- <https://tailscale.com/blog/macos-notch-escape>
- <https://tailscale.com/docs/how-to/quickstart>
- <https://tailscale.com/docs/install/mac>
- <https://tailscale.com/docs/install/ios>
- <https://tailscale.com/kb/1081/magicdns>
- <https://tailscale.com/docs/features/tailscale-system-policies>
- <https://mullvad.net/en/help/using-mullvad-vpn-app>
- <https://mullvad.net/en/download/vpn/macos>
- <https://github.com/mullvad/mullvadvpn-app>
- <https://www.behance.net/gallery/74594901/Redesign-of-Mullvad-VPN-apps>
- <https://briarproject.org/>
- <https://briarproject.org/quick-start/>
- <https://briarproject.org/how-it-works/>
- <https://f-droid.org/packages/org.briarproject.briar.android/>
- <https://meshtastic.org/docs/software/android/usage/>
- <https://meshtastic.org/docs/getting-started/initial-config/>
- <https://meshtastic.org/docs/configuration/radio/bluetooth/>
- <https://orbstack.dev/>
- <https://docs.orbstack.dev/compare/docker-desktop>
- <https://1password.com/blog/design-values-ux-prinicples>
- <https://support.1password.com/style-guide/>
- <https://protonvpn.com/blog/new-windows-ios-apps>
- <https://protonvpn.com/support/macos-network-extensions>
- <https://protonvpn.com/support/android-vpn-permissions-problem>
- <https://github.com/ProtonVPN/win-app>
- <https://www.defined.net/blog/announcing-dnclient-desktop/>
- <https://nebula.defined.net/docs/>
- <https://docs.defined.net/>
- <https://apps.apple.com/us/app/nebula-mobile/id1137824578>
- <https://github.com/slackhq/nebula>
- <https://github.com/zerotier/DesktopUI>
- <https://github.com/zerotier/DesktopUI/issues/15>
- <https://discuss.zerotier.com/t/zerotier-desktop-ui-exe-not-working-in-windows-11/18358>
- <https://www.g2.com/products/zerotier-one/reviews?qs=pros-and-cons>
- <https://charm.land/>
- <https://charm.land/blog/the-next-generation/>
- <https://github.com/charmbracelet/bubbletea>
- <https://ghostty.org/>
- <https://github.com/ghostty-org/ghostty>
- <https://ghostty.org/docs/config>
- <https://linear.app/now/how-we-redesigned-the-linear-ui>
- <https://linear.app/now/behind-the-latest-design-refresh>
- <https://linear.app/changelog/2020-12-04-themes>
- <https://www.raycast.com/faq>
- <https://www.warp.dev/>
- <https://docs.warp.dev>
- <https://www.nngroup.com/articles/progressive-disclosure/>
- <https://ixdf.org/literature/topics/progressive-disclosure>
- <https://developer.android.com/develop/connectivity/vpn>
- <https://developer.android.com/reference/android/net/VpnService>
- <https://developer.apple.com/documentation/xcode/configuring-network-extensions>
- <https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html>
- <https://developers.cloudflare.com/warp-client/>
- <https://developers.cloudflare.com/warp-client/get-started/macos/>
- <https://developers.cloudflare.com/warp-client/warp-modes/>
- <https://help.bitlaunch.io/en/articles/11864454-how-to-import-configs-in-wireguard>
- <https://www.wireguard.com/quickstart/>
- <https://wiki.archlinux.org/title/WireGuard>
- <https://www.macworld.com/article/220375/why-some-apps-belong-in-the-menu-bar-not-the-dock.html>
- <https://www.law360.com/articles/2464579/nordvpn-hit-with-dark-patterns-class-action>

### Secondary references (review blogs, commentary)

- <https://dev.to/onsen/tailscales-new-macos-home-whats-changed-25ej>
- <https://thepixelspulse.com/posts/tailscale-macos-variants-critical-choices/>
- <https://news.ycombinator.com/item?id=47618189>
- <https://news.ycombinator.com/item?id=41421846>
- <https://hawkinswood.github.io/prettygoodsecurity/pages/tailscale/>
- <https://github.com/tailscale/tailscale/issues/17294>
- <https://medium.com/@maneakanksha772/why-i-uninstalled-docker-desktop-and-switched-to-orbstack-podman-18f9614f3b6e>
- <https://inside.wpriders.com/how-orbstack-beats-docker-desktops-ram-usage/>
- <https://thinhdanggroup.github.io/orbstack-docker-desktop/>
- <https://www.engadget.com/cybersecurity/vpn/mullvad-vpn-review-near-total-privacy-with-a-few-sacrifices-130000056.html>
- <https://cyberinsider.com/vpn/reviews/mullvad-vpn/>
- <https://cyberinsider.com/vpn/comparison/expressvpn-vs-nordvpn/>
- <https://www.engadget.com/cybersecurity/vpn/nordvpn-review-2025-innovative-features-a-few-missteps-163000578.html>
- <https://gizmodo.com/best-vpn/nordvpn>
- <https://www.top10vpn.com/tools/vpn-comparison/nordvpn-vs-expressvpn/>
- <https://medium.com/@DarKrMsg/briar-advantages-cons-dangers-34b773fb7244>
- <https://www.localizationlab.org/blog/2019/2/4/vqokvhv4o4v1udmv1o431zg2qbpu92>
- <https://dev.to/juan_diegoisazaa_5362a/proton-suite-review-privacy-tools-that-fit-together-ibi>
- <https://blog.logrocket.com/ux-design/linear-design/>
- <https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/>
- <https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646>
- <https://userpilot.com/blog/progressive-disclosure-examples/>
- <https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/>

### Things I could not confirm

- Specific Cloudflare WARP UX review articles (docs only).
- Specific Tailscale iOS UI screenshots (App Store only; fetcher
  returned metadata not images).
- Exact layout of the DNClient Desktop main window (announcement post
  shows systray/menubar only).
- Whether Meshtastic has a formal design-system doc (couldn't find one).
- Exact copy on Briar's first-run screens (Wikipedia + quick-start guide
  describe the steps but not the literal text strings).
- Whether ExpressVPN has published UX-design writeups (most
  commentary is from reviewers, not the company).

---

*End of brief.*
