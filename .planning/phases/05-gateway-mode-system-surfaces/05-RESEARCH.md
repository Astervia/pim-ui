# Phase 5: Gateway Mode & System Surfaces — Research

**Researched:** 2026-04-26
**Domain:** Linux gateway control · cross-OS tray/menubar · system notifications · ⌘K command palette
**Confidence:** HIGH on stack + IA · MEDIUM on RPC contract (TBD-RPC, daemon spec not in tree) · MEDIUM on macOS popover lifecycle (multiple credible patterns; recommend ahkohd's reference)

## 1 · What pim is + Phase 5's role

**pim-ui** is the Tauri 2 + React 19 desktop shell for the `pim-daemon` proximity mesh stack — an honest CLI-aesthetic GUI whose entire job is to faithfully display what the daemon is doing while being reachable enough that a first-time user (Aria) can succeed in ≤ 3 interactions. Phase 1 wired the JSON-RPC bridge and daemon lifecycle; Phase 2 made the Dashboard honest with reactive status + peer + log streams; Phase 3 lands Settings + raw-TOML editing + log search; Phase 4 ships the route-internet-via-mesh toggle, three-step onboarding, kill-switch banner, and the COPY.md voice contract.

**Phase 5 closes v1 for Mira.** It does three things: (a) lights up the **Gateway tab** so a Linux user can run pre-flight, pick a `nat_interface`, enable gateway mode, and watch conntrack/throughput/peer-through-me — and so a macOS/Windows user sees the honest "Linux-only today" surface; (b) ships the **menu-bar/tray/AppIndicator popover** that lets either persona reach the daemon at any time with a status dot, the route-internet toggle, and an Open-pim hand-off into the main window, in the **window-first default** decided 2026-04-24; (c) ships the **⌘K command palette** that gives Mira every major action one keystroke away, plus the **toast + system-notification policy** where lifecycle events stay in-app and only kill-switch + all-gateways-lost escalate to the OS notification center.

**Primary recommendation:** scope Phase 5 as an **inheriting** phase — it consumes Phase 4's `RouteInternetToggle`, kill-switch state machine, and COPY.md voice contract, and reuses Phase 2's `CliPanel`, `StatusIndicator`, sonner Toaster, and W1 single-listener fan-out. Every new surface follows the existing brand contract (radius-0, monospace, ASCII glyphs, no exclamation marks) and the sidebar Gateway row that Phase 2 reserved with `(phase 5)` is flipped active by Plan 05-01. No new event channel — `gateway.event` joins the existing `daemon://rpc-event` fan-out.

---

## 2 · Personas applied

> Concrete walkthroughs of every Phase 5 surface for both personas. The "verified by" column at the bottom of each scenario points at the success-criterion it proves.

### 2a · Gateway tab (Linux) — Aria's first encounter

**Scenario:** Aria's laptop is on Ubuntu. She's already onboarded (Phase 4) and is sitting at the Dashboard. She clicks the sidebar `gateway` row.

```
┌─── GATEWAY ────────────────────────────────────────────┐  [READY]
│  share your internet with the mesh                      │
│                                                         │
│  pre-flight                                             │
│  ◆ running on linux (gateway is linux-only today)       │
│  ◆ network interfaces detected: wlan0 · eth0            │
│  ◆ CAP_NET_ADMIN available                              │
│  ✗ iptables not installed   detail: command 'iptables'  │
│                              not found in PATH          │
│                              · install: sudo apt        │
│                              install iptables           │
│                                                         │
│  [ Re-run pre-flight ]                                  │
│                                                         │
│  Pre-flight failed — fix the items above and re-run.    │
└─────────────────────────────────────────────────────────┘
```

What Aria sees: every check rendered as a row with a `◆` (pass) or `✗` (fail) glyph, then the daemon's `name` token (verbatim — `iptables_present`), then the daemon's `detail` string. On failure she gets a *recovery hint* (`install: sudo apt install iptables`) constructed UI-side from a known-check map keyed on `name` (see §10) — but never a fake green dot.

What she does NOT see: a "Continue anyway" override, a "Skip pre-flight" toggle, a wizard splitter. The `[ Turn on gateway mode ]` action is not rendered until every check is `ok: true` (GATE-02 explicit gate).

**After fixing iptables and clicking `[ Re-run pre-flight ]`:**

```
┌─── GATEWAY ────────────────────────────────────────────┐  [READY]
│  share your internet with the mesh                      │
│                                                         │
│  pre-flight  · all checks passed                        │
│  ◆ running on linux                                     │
│  ◆ iptables present                                     │
│  ◆ network interfaces detected: wlan0 · eth0            │
│  ◆ CAP_NET_ADMIN available                              │
│                                                         │
│  nat interface                                          │
│  ( wlan0 ▾ )                                            │
│                                                         │
│  [ Turn on gateway mode ]                               │
└─────────────────────────────────────────────────────────┘
```

Aria picks `wlan0` (the only check-marked interface in `suggested_nat_interfaces`), clicks the button, and the panel transitions to the active state below.

**Verifies:** GATE-01 (pre-flight check rendering), GATE-02 (Linux-only enable + nat_interface picker)

### 2b · Gateway tab (Linux active) — Mira's surveillance state

```
┌─── GATEWAY ────────────────────────────────────────────┐  [ACTIVE]
│  ◆ gateway active · wlan0 · 4h 12m                      │
│  advertised: 0.0.0.0/0                                  │
│                                                         │
│  conntrack                                              │
│  [████████████░░░░░░░░░░░░░░░░░░░░] 1,247 / 4,096 (30%) │
│                                                         │
│  throughput                                             │
│  in   1.4 MB/s   out  920 KB/s                          │
│  total 4h        in   2.1 GB    out  1.4 GB             │
│                                                         │
│  peers routing through this node (3)                    │
│  client-a  10.77.0.100  via tcp     ◆ active   12ms     │
│  client-b  10.77.0.101  via relay-c ◈ relayed  47ms     │
│  client-c  10.77.0.102  via tcp     ◆ active   18ms     │
│                                                         │
│  [ Turn off gateway mode ]                              │
└─────────────────────────────────────────────────────────┘
```

Mira's "Mira-passes" predicate (defined): on a single screen, she must be able to spot a degradation within 1 second. The screen above gives her:

1. **Conntrack saturation** — both an ASCII bar gauge AND the `n / max (pct%)` numbers. The bar fills with `█` for used, `░` for headroom. At ≥ 80% the bar's filled portion flips to `text-accent` (amber). At ≥ 95% it flips to `text-destructive` and the panel `[STATUS]` badge becomes `[NEAR LIMIT]`.
2. **Throughput trend** — current rate (`in 1.4 MB/s`) AND session totals (`in 2.1 GB`). She can correlate.
3. **Peer-through-me list** — every client routing through her node, filtered from `snapshot.status.peers` where `peer.is_routing_through === true` (TBD-RPC: the daemon's PeerSummary in v1 doesn't have this field; see §5).
4. **Honest transport per peer** — `via tcp` or `via relay-c` rendered verbatim from `PeerSummary.transport`, never abstracted into "good"/"degraded".

The `[ Turn off gateway mode ]` button is one click — never a confirmation modal — because turning *off* is not a destructive action vs the mesh; the daemon advertises route-removal and peers re-elect a new gateway naturally. **However**, if `peers_routing_through > 0`, the button copy expands inline: `[ Turn off gateway mode ] · 3 peers will be cut over to another gateway` (advisory text, not a confirmation). This honors P1 (honest over polished) without infantilizing.

**Verifies:** GATE-03 (conntrack gauge + throughput + peer-through-me), partial REQ ROADMAP SC2

### 2c · Gateway tab (macOS / Windows) — Aria sees an honest no-op

```
┌─── GATEWAY ────────────────────────────────────────────┐  [LINUX-ONLY]
│                                                         │
│  Gateway mode is Linux-only today.                      │
│                                                         │
│  Your device can still join a mesh as a client or       │
│  relay. Gateway support for macOS and Windows depends   │
│  on the kernel growing iptables-equivalent NAT — see    │
│  the kernel repo for status.                            │
│                                                         │
│  · platform: macos                                      │
│  · supported: false                                     │
│                                                         │
│  [ Open kernel repo ]                                   │
└─────────────────────────────────────────────────────────┘
```

Critical: the section is **rendered, not hidden** (GATE-04 and `STATE.md` 01.1 D-08 verbatim copy from SETUP-02). Aria opening this on her MacBook learns *why* it's unavailable, gets reassurance she's still functional ("can still join a mesh as a client or relay"), and gets a place to track future support — without being given a stub error. **No exclamation marks**, no "Coming soon!", no roadmap dates we don't control.

The copy is locked verbatim to the SETUP-02 string already in production (Phase 01.1) so we don't re-litigate Aria's first impression.

**Verifies:** GATE-04 (Linux-only messaging visible, not hidden), brand voice (P1)

### 2d · Menu-bar popover (macOS) — Mira's airport check

**Scenario:** Mira is on a flight, has the pim window minimized, and wants to know without raising the window: am I still routing through gateway-c?

She clicks the menu-bar icon (top-right of macOS). The popover appears below the icon (positioned via `tauri-plugin-positioner` `Position.TrayCenter`):

```
  ┌────────────────────────────────────────┐
  │ ◆ pim · client-a-macbook               │
  │ mesh: 10.77.0.100/24                   │
  ├────────────────────────────────────────┤
  │ [ Route internet via mesh ]   on  ●    │   <- TBD-PHASE-4: the actual toggle component
  │ Routing through gateway-c              │   <- TBD-PHASE-4: ROUTE-02 status sub-line
  │  (via relay-b)                         │
  ├────────────────────────────────────────┤
  │ + Add peer nearby            ⌘⇧N       │   <- TBD-PHASE-4: action lives in onboarding
  │ Open pim                     ⌘O        │
  ├────────────────────────────────────────┤
  │ Quit pim                     ⌘Q        │
  └────────────────────────────────────────┘
```

Because the popover is a **separate borderless window** (recommendation §6c), it can render the same React tree the main window uses — meaning the same `useDaemonState` snapshot, same `<StatusIndicator />`, same brand tokens. The popover is NOT a stock `Menu`, because a menu can't carry a toggle component or a multi-line "Routing through gateway-c (via relay-b)" honest-status line. It IS a separate window because that window can host arbitrary React/Tailwind, get tray-relative positioning via `tauri-plugin-positioner`, hide on blur, and respect the brand without fighting macOS chrome.

What Aria gets here: a short status, a one-click toggle, an "Open pim" path back to the main window. What Mira gets: the `Routing through gateway-c (via relay-b)` honest topology line — same string the Dashboard shows, never abstracted.

**Verifies:** UX-05 (status dot + toggle + Open pim, window-first), partial UX-06 (Linux/Windows parity built on same surface)

### 2e · Tray popover (Linux AppIndicator) — divergence

**Linux AppIndicator IS NOT macOS NSPopover.** Per Tauri 2's tray docs (https://v2.tauri.app/learn/system-tray/), Linux tray events are limited — left-click and tray-icon click events are **not emitted** on Linux because libayatana-appindicator only fires `on_menu_event`, not `on_tray_icon_event`. The interaction model on Linux is RIGHT-CLICK to open the menu, no popover.

**Resolution (P4 OS idiom first):** on Linux, the "popover" is rendered as a **native menu** (Tauri 2 `Menu` API) with `MenuItem`s for the same affordances:

```
  ◆ pim · client-a-macbook
  mesh: 10.77.0.100/24
  ─────────────
  [✓] Route internet via mesh         <- native CheckMenuItem; toggles ROUTE-01
      Routing through gateway-c       <- disabled MenuItem, status only
  ─────────────
  Add peer nearby                     <- opens main window + Add Peer flow
  Open pim
  ─────────────
  Quit pim
```

Multi-line content the macOS popover renders as styled rows (`Routing through gateway-c (via relay-b)`) collapses to **two `MenuItem`s on Linux**: one disabled item showing the status, one disabled sub-item showing the route. This is the trade — Linux users get a native menu that respects `gtk-application-prefer-dark-theme`, rather than a spawned floating window that fights GNOME/KDE conventions.

**Windows tray** — Tauri 2 supports both `on_tray_icon_event` (left-click) AND `on_menu_event` (right-click). Recommendation: mirror macOS — left-click opens the React popover window, right-click opens a native context menu that's a subset (Open pim, Quit). This gives Windows users the rich popover via the primary gesture (left-click is the dominant idiom on Windows) while keeping the right-click fallback for power users.

**Keyboard / screen-reader story:**

| OS | Popover open | Keyboard nav | Screen reader |
|----|--------------|--------------|---------------|
| macOS | left-click tray icon (no keyboard shortcut by default — macOS doesn't expose tray to keyboard without a11y-extra setup) | once open: Tab cycles within the React tree (Radix focus trap) | NSPopover + React tree; `<button>`s carry their own aria-labels |
| Linux | right-click tray icon | native GTK menu — arrow keys, Enter to activate, Esc to close | GTK menu native a11y |
| Windows | left-click tray icon (popover) OR right-click (native menu) | popover: Tab cycles (Radix); native menu: arrow keys | Same as Tauri React + native menu |

**Verifies:** UX-06 (Linux + Windows parity with respect to *capabilities offered*, not pixel-identical UI)

### 2f · Command palette (⌘K) — Mira's home court

Mira presses `⌘K` from anywhere. A centered Dialog opens (via `cmdk` v1.1.1 — Radix Dialog under the hood):

```
┌──────────────────────────────────────────────────────────┐
│  > _                                              [esc]  │   <- Command.Input, prompt style
├──────────────────────────────────────────────────────────┤
│  navigate                                                │   <- Command.Group
│  > go to dashboard                              ⌘1       │
│  > go to peers                                  ⌘2       │
│  > go to routing                                ⌘3       │
│  > go to gateway                                ⌘4       │
│  > go to logs                                   ⌘5       │
│  > go to settings                               ⌘,       │
│  ─────────                                               │
│  routing                                                 │   <- Command.Group
│  > route on  (turn on split-default routing)             │
│  > route off (turn off split-default routing)            │
│  > show routing table                                    │
│  ─────────                                               │
│  peers                                                   │
│  > peers list                                            │
│  > add peer nearby                                       │
│  > invite peer                                           │
│  ─────────                                               │
│  gateway                                                 │
│  > gateway preflight                                     │
│  > gateway enable (linux)                                │
│  > gateway disable (linux)                               │
│  ─────────                                               │
│  logs                                                    │
│  > logs subscribe (open logs tab)                        │
│  > export debug snapshot                                 │
└──────────────────────────────────────────────────────────┘
```

**Aria pressing ⌘K:** cmdk's default behavior shows everything; she scrolls and sees plain-language hints (`turn on split-default routing` after `route on`). She's not penalized for not knowing the jargon, but she sees the jargon next to the explanation — direct application of UX-PLAN §1 P2 ("one UI, three disclosure layers, zero lies").

**Search ranking when Mira types** (recommendation, see §7):

| Input | Top result | Rationale |
|-------|-----------|-----------|
| `g` | `go to gateway` | exact-prefix match on the first navigate item; cmdk default scoring favors prefix |
| `ga` | `go to gateway` (kept), then `gateway preflight` | prefix on "gateway" word in two items; cmdk ranks by character distance |
| `gate` | `go to gateway`, `gateway preflight`, `gateway enable`, `gateway disable` | full-word prefix tier; cmdk groups exact-prefix above substring |
| `p` | `go to peers`, `peers list` | prefix on `peers` (preferred over `gateway preflight` because the word "peers" starts with `p` and so does "preflight" — cmdk's frecency lifts navigate items by default since they're at the top of the registered list) |
| `pre` | `gateway preflight`, then nothing else | substring on "preflight" |

**Recency / frecency:** cmdk supports `keywords` + `value` for synonyms but does NOT track recency itself. Phase 5 should NOT add a recency tracker in v1 — Mira's muscle memory will discover items deterministically faster than a fuzzy-frecency algorithm she can't predict. Defer recency to a v0.6+ polish (POWER-04 territory).

**Verifies:** UX-07 (palette surfaces every major action + tab navigation)

### 2g · Notifications — Mira on the train

**Scenario:** Mira's train enters a tunnel. The mesh loses every gateway. The daemon emits `status.event { kind: "gateway_lost" }`, then sees the route-on flag is true, then engages the kill-switch, then emits `status.event { kind: "kill_switch", detail: { engaged: true } }`.

**What fires:**

| Event | UI surface | OS notification |
|-------|------------|-----------------|
| `gateway_lost` (one peer lost; failover to another succeeded) | Toast: `Failed over to relay-c — gateway-b lost` (sonner, 3s, info border) | NONE — UX-04 + 2026-04-24 decision |
| `gateway_lost` AND no other gateway → kill-switch engages | **Toast** + **OS notification**: `Blocking internet — gateway unreachable. Open pim to fix.` | YES — UX-04: kill-switch-active is critical |

The OS notification fires via `tauri-plugin-notification`'s `sendNotification({ title: 'pim', body: 'Blocking internet — gateway unreachable. Open pim to fix.' })`. On click, the notification (via the plugin's action API) brings the main pim window to front.

**Aria scenario:** her partner connects with `peer connected` event → in-app toast `relay-b is connected`, no OS notification. She's not interrupted while typing in another app. (Decision 2026-04-24 verbatim.)

**Verifies:** UX-04 (toasts for non-critical, system-notif only for critical)

---

## 3 · Persona pressure tests

> Where Aria and Mira pull the design in opposite directions, and how Phase 5 resolves.

| # | Tension | Aria wants | Mira wants | Resolution |
|---|---------|-----------|-----------|------------|
| **PT-01** | Pre-flight failure copy when iptables is missing | "Click here to install iptables" (one-click experience) | The daemon's exact `detail` string + the actual shell command so she can audit | **Both.** Render daemon `detail` verbatim, then append a UI-constructed `· install: sudo apt install iptables` recovery hint keyed on `name === "iptables_present"`. We do NOT auto-install (that requires sudo + we'd be running shell on user's behalf — out of scope, brand-violating). The hint is a **plain text suggestion**, not a clickable action. Aria gets a copyable command; Mira gets the daemon's truth. |
| **PT-02** | Conntrack rendering | Single number ("30%") | Bar + numerator/denominator + max-conn knob context | **Both.** ASCII bar `[████░░░░] 1,247 / 4,096 (30%)` — Aria reads "30%", Mira reads the numbers. Color thresholds (amber ≥ 80%, red ≥ 95%) carry the warning at a glance. |
| **PT-03** | Menu-bar popover content density | Status dot + one toggle + Open pim (3 items) | Full peer list, throughput, gateway choice, raw `pim status --json` output | **Aria's spec wins.** UX-05 explicitly enumerates: status dot · "Route internet via mesh" toggle · Open pim. We do NOT cram the peer list into the popover. Mira's surface is the main window — one click away via "Open pim". The popover's *only* divergence from the spec is the honest topology sub-line `Routing through gateway-c (via relay-b)` (Phase 4's ROUTE-02 string), which serves both: Aria reads "I'm routing", Mira reads the exact gateway. |
| **PT-04** | Command palette discoverability | She doesn't know about ⌘K | She wants every action one keystroke away | **Both.** ⌘K is bound globally and surfaces every action — but Phase 5 also wires ⌘K-discoverability into the existing About section (Phase 3 D-27 already lists `Keyboard shortcuts`). Aria isn't punished for not knowing; Mira gets her power surface. **Crucially**, none of the palette's actions are *only* reachable via the palette — every command corresponds to a button somewhere in the main UI. The palette is the second path, not the first (UX-PLAN §8 Layer-3). |
| **PT-05** | Gateway-active "Turn off" affordance | Click once, no friction | Confirmation, audit trail | **Aria's spec wins** — `[ Turn off gateway mode ]` is one click. But when `peers_through_me > 0`, the button copy expands inline (advisory, not modal): `[ Turn off gateway mode ] · 3 peers will be cut over`. No alert dialog — turning off is recoverable (re-enable). The audit trail is the Logs tab, where Mira's already going if she cares. |
| **PT-06** | Linux interaction divergence | "Why does the menu look different on my Ubuntu vs my mac?" | "Don't paper over OS conventions; respect AppIndicator's right-click idiom" | **Mira's spec wins, with explicit copy.** The Settings → Notifications section (Phase 3 already structures the section) gets a Phase 5 paragraph: "On Linux, click the system tray icon to open this menu. On macOS and Windows, click for the popover." We name the divergence rather than hide it. P4 (OS idiom first) wins over visual parity. |
| **PT-07** | Notification escalation copy | "Don't yell at me unless it's critical" | "Tell me everything, but in the right channel" | **Both.** Concrete trigger table in §8 — every event mapped to `silent | toast | system | both`. Default to *silent or toast*; system notification only fires for two events (kill-switch-active, all-gateways-lost). Notifications-section in Settings (Phase 3) shows the full table — Mira can audit, Aria never has to. |
| **PT-08** | "Open pim" from popover | Brings up the main window centered, focused | Brings up the main window where she left it | **Same behavior — fortunately neither persona is harmed.** Tauri's `window.show()` + `window.set_focus()` preserves window position by default (https://v2.tauri.app/learn/system-tray/ click handler example). No special positioning logic needed. |

---

## 4 · Phase 4 dependency inventory

> **Every Phase-4-blocked integration point.** Each row is `TBD-PHASE-4: <what's needed>` so the eventual Phase 4 author can grep these back when integrating. **Phase 5 plans MUST grep-mark each touchpoint with `TBD-PHASE-4` so a Phase 4 author finds them deterministically.**

| Hook ID | What Phase 5 needs | Source REQ (Phase 4) | Workaround for solo Phase-5 planning | Where it appears |
|---------|--------------------|---------------------|------|------------------|
| **TBD-PHASE-4-A** | `<RouteInternetToggle />` component — the one-click toggle that calls `route.set_split_default` | ROUTE-01 | Phase 5 popover renders a stub "TBD-PHASE-4-A: render Phase 4's RouteInternetToggle here" — popover plan ships otherwise complete; integration is a Phase-4 follow-up plan | Menu-bar popover (macOS), Linux menu CheckItem, Windows popover |
| **TBD-PHASE-4-B** | The "Routing through gateway-c (via relay-b)" honest status string | ROUTE-02 | Phase 5 menu popover defines a `useRouteStatusLine()` selector that returns `null` until Phase 4 wires `snapshot.status.routes.selected_gateway` resolution. Until then, popover sub-line reads the Phase-2-already-implemented `egress: gateway-c` from `useStatus()`; full hop-chain ships when Phase 4 lands. | Popover status sub-line, command-palette `route on/off` action items |
| **TBD-PHASE-4-C** | Kill-switch state machine — `snapshot.killSwitch.engaged: boolean` | UX-03 | Phase 5 notification fan-out subscribes to `status.event { kind: "kill_switch" }` directly (already in `rpc-types.ts`). Phase 4 will add `snapshot.killSwitch` for banner UI; Phase 5's notification firing just listens to the event. **Phase 5 plan ships independently** — system notification fires the moment the daemon emits the event, regardless of whether the in-app banner is wired. | `useGatewayNotifications()` hook (Phase 5) |
| **TBD-PHASE-4-D** | `docs/COPY.md` voice contract for Aria-copy + Mira-annotation | UX-08 | Phase 5 microcopy is authored against UX-PLAN §7 + STYLE.md §Voice. When Phase 4 lands COPY.md, a Phase-5-completion plan re-audits every Phase-5 string against the table. **Audit is a final-plan task in Phase 5**, not a per-plan blocker. | Every Phase 5 user-facing string |
| **TBD-PHASE-4-E** | First-run onboarding screen IDs (so palette `go to <screen>` matches what Phase 4 introduces) | UX-01 | Phase 5 palette navigates to the existing 6 sidebar tabs (`dashboard`, `peers`, `routing`, `gateway`, `logs`, `settings`). Onboarding Phase 4 may add transient screens (`onboard:name-device`, `onboard:permission`, `onboard:choose`) — those are NOT in Phase 5's palette by default. **Verdict:** out of scope. Onboarding is exited before palette use is meaningful. |
| **TBD-PHASE-4-F** | Routing tab (sidebar `⌘3`) | ROUTE-03 | Phase 5 palette `> show routing table` action navigates to `routing` screen ID. If Phase 4 ships `<RoutingScreen />`, the palette opens it; if not, ActiveScreen renders a placeholder. **Phase 5 palette plan ships referencing the screen ID; rendering is Phase 4's job.** |
| **TBD-PHASE-4-G** | The "Add peer nearby" flow end-to-end | UX-01, PEER-05/06 | Phase 5's tray menu and palette include `Add peer nearby` as a navigation action that opens main window + activates the existing Phase 2 `Nearby` section. The actual *flow* (QR + BLE pairing) lands in Phase 4. **Phase 5 just brings the user to the right surface**; flow execution is Phase 4. |

**Greppable convention:** every TBD-PHASE-4 reference in code/plans uses the exact format `TBD-PHASE-4-<letter>:` so `grep -rn "TBD-PHASE-4-" .` after Phase 4 lands surfaces every integration point.

---

## 5 · RPC contract additions (speculative — TBD-RPC)

> **The kernel-repo `docs/RPC.md` push is BLOCKED per STATE.md.** Phase 5 must define types speculatively, tagged `TBD-RPC`, for kernel-maintainer confirmation. Existing `rpc-types.ts` already has `GatewayPreflightResult`, `GatewayEnableParams`, `GatewayEnableResult`, `GatewayDisableResult`, `GatewayPlatform`, `GatewayPreflightCheck`. **Phase 5 needs to ADD:**

### 5a · `gateway.status()` — TBD-RPC

```typescript
// TBD-RPC: shape inferred from GATE-03 + UX-PLAN §3h + brand-fit gauge spec.
// Confirm with kernel maintainer when docs/RPC.md is unblocked.
export interface GatewayStatusResult {
  active: boolean;
  /** Echoed nat_interface; null when active === false. */
  nat_interface: string | null;
  /** Conntrack utilization. Both numerator AND denominator are required so
   *  the gauge can render the brand-fit `[████] n / max (pct%)` form. */
  conntrack: {
    used: number;       // current entries in /proc/net/nf_conntrack
    max: number;        // value of net.netfilter.nf_conntrack_max sysctl
  };
  /** Throughput sampled at daemon-side; UI does NOT poll. Bytes per second
   *  averaged over the last sampling window (recommend daemon-side ~1s). */
  throughput: {
    in_bps: number;
    out_bps: number;
    in_total_bytes: number;   // session-cumulative (since gateway enabled)
    out_total_bytes: number;
  };
  /** Number of currently-paired peers whose egress is THIS node.
   *  This is a count derived daemon-side from the conntrack table; the UI
   *  does NOT compute it from PeerSummary[]. */
  peers_through_me: number;
  /** Optional list of peer node_ids routing through this gateway, used to
   *  render the §2b peer-through-me list. May be empty even when count > 0
   *  if the daemon truncates for cardinality. */
  peers_through_me_ids?: string[];
  /** When the gateway was enabled, ISO-8601 — drives the "4h 12m" uptime. */
  enabled_at: string;
}
```

### 5b · `gateway.event` notification stream — TBD-RPC

`gateway.status()` is a one-shot RPC. For reactive updates we need a fourth notification stream alongside `status.event`, `peers.event`, `logs.event`:

```typescript
// TBD-RPC: gateway.event stream emits when the daemon's gateway state changes
// at a granularity finer than status.event (which fires on gateway_selected /
// gateway_lost — those are mesh-wide selection events, not local-gateway ops).
export type GatewayEventKind =
  | "enabled"                 // we just became a gateway
  | "disabled"                // we just stopped being a gateway
  | "conntrack_pressure"      // utilization crossed an threshold (≥ 80% → 1, ≥ 95% → 2)
  | "throughput_sample"       // periodic 1Hz sample for the gauge
  | "peer_through_me_added"   // a peer's egress is now via us
  | "peer_through_me_removed";

export interface GatewayEvent {
  kind: GatewayEventKind;
  at: string;
  /** For throughput_sample: { in_bps, out_bps, conntrack_used, conntrack_max }. */
  detail?: Record<string, unknown>;
}
```

**Existing fan-out integration:** `gateway.event` joins `RpcEventMap` alongside `status.event`/`peers.event`/`logs.event`. The W1 single-listener pattern is preserved — `useDaemonState` registers one fan-out handler set per event name; new events cost zero new Tauri listeners. No `lib.rs` change required either, because Rust's `daemon_subscribe` and `daemon_unsubscribe` are generic over event name.

### 5c · Method registry additions

```typescript
export interface RpcMethodMap {
  // ... existing 20 methods ...

  // §5.4 gateway — new for Phase 5
  // TBD-RPC: confirm method names + payload shapes
  "gateway.status": { params: null; result: GatewayStatusResult };
  "gateway.subscribe": { params: null; result: SubscriptionResult };
  "gateway.unsubscribe": {
    params: SubscriptionUnsubscribeParams;
    result: null;
  };
}

export interface RpcEventMap {
  "status.event": StatusEvent;
  "peers.event": PeerEvent;
  "logs.event": LogEvent;
  // TBD-RPC
  "gateway.event": GatewayEvent;
}
```

### 5d · Existing `gateway.preflight` / `gateway.enable` / `gateway.disable` are sufficient

`rpc-types.ts` (current Phase 1 mirror) already defines these. Phase 5's pre-flight UI calls `gateway.preflight(null)` on Gateway-tab mount and on `[ Re-run pre-flight ]`. Enable calls `gateway.enable({ nat_interface })`. Disable calls `gateway.disable(null)`. **No new types needed for the lifecycle methods** — only the runtime status surface.

### 5e · Fallback if `gateway.event` doesn't ship in the kernel's v1

If the kernel maintainer pushes back on adding `gateway.event` (citing scope), Phase 5 has a graceful degradation:

1. Subscribe to `status.event` only — `gateway_selected` / `gateway_lost` give us the *mesh-wide* gateway lifecycle.
2. For the conntrack gauge, **call `gateway.status()` once per second** while the Gateway tab is visible. This violates the daemon-is-source-of-truth-via-events principle locally but is ACCEPTABLE because (a) the polling stops the moment the user navigates away, (b) the polling rate is 1Hz which is the same rate the daemon would emit a `throughput_sample`, (c) it's tab-scoped not app-wide. Document the polling clearly (`useGatewayStatusPolling` hook) so it's trivially ripped out when `gateway.event` lands.
3. For the menu-bar popover's status dot, use `useStatus()` + `useDaemonState()` ONLY — no gateway-specific subscription. Popover doesn't need conntrack data.

**Recommendation:** propose `gateway.event` to the kernel maintainer in the same PR that drafts the gateway RPC additions. Polling is the fallback, not the plan.

---

## 6 · Tauri 2 platform research

### 6a · System tray API — verified

| Topic | Finding | Confidence | Source |
|-------|---------|------------|--------|
| Tauri 2 tray API | `tauri::tray::TrayIconBuilder` in setup hook (replaces v1 `Builder::system_tray`) | HIGH | https://v2.tauri.app/learn/system-tray/ |
| Cargo feature flag | `tauri = { version = "2", features = ["tray-icon"] }` — currently `features = []` in `src-tauri/Cargo.toml` | HIGH | tauri-apps tray-icon README |
| Linux dependency | `libayatana-appindicator3-dev` (Debian) or `libappindicator-gtk3` (Arch). Already required for Tauri prerequisites — no new install for end users via the app, but our CI may need to verify. | HIGH | https://v2.tauri.app/start/prerequisites/ |
| Linux event limitation | `on_tray_icon_event` does NOT fire on Linux (libayatana only emits `on_menu_event`). Right-click is the only interaction. | **HIGH (load-bearing)** | https://v2.tauri.app/learn/system-tray/ |
| macOS event support | All tray events fire (`Click`, `DoubleClick`, `Enter`, `Move`, `Leave`) | HIGH | https://v2.tauri.app/learn/system-tray/ |
| Windows event support | All tray events fire including left-click | HIGH | Same |
| No special capability | tray-icon does NOT require a capability/permission entry beyond the Cargo feature flag | HIGH | Tauri docs; capabilities/default.json scope is for plugin permissions only |

### 6b · Notification plugin — verified

| Topic | Finding | Source |
|-------|---------|--------|
| Plugin name | `tauri-plugin-notification` (Rust) + `@tauri-apps/plugin-notification` (JS) | https://v2.tauri.app/plugin/notification/ |
| Latest crate version | `2.x` (Tauri 2 ecosystem) — verify with `cargo search tauri-plugin-notification` at install time | docs.rs |
| Latest npm version | `2.3.3` (verified 2026-04-26 via `npm view`) | npm registry |
| Linux backend | `notify-rust` crate — uses D-Bus org.freedesktop.Notifications interface (notify-send equivalent) | docs |
| macOS backend | NSUserNotification / UNUserNotificationCenter | docs |
| Windows backend | Toast notifications — **only works for installed apps** (signed bundle). Dev mode may not show toasts. | docs |
| Required capability | `notification:default` in `capabilities/default.json` permissions array. Default set includes: `allow-is-permission-granted`, `allow-request-permission`, `allow-notify`, `allow-register-action-types`, `allow-cancel`, `allow-create-channel`. | docs |
| Permission flow | `isPermissionGranted()` → `requestPermission()` if not → `sendNotification({ title, body })` | docs |
| Click-to-focus | The plugin supports notification action handlers; on click we call `window.show() + window.set_focus()` from Rust | docs |

### 6c · Popover pattern — recommendation

**The question:** popover should be (a) a stock dropdown menu (b) a hidden borderless window positioned near the tray icon (c) a hybrid.

**Recommendation:** **(c) hybrid** — borderless window on macOS + Windows, native menu on Linux.

**Why:**

| Pattern | macOS | Windows | Linux | Verdict |
|---------|-------|---------|-------|---------|
| (a) Stock menu | Loses ability to render `<RouteInternetToggle />` (UX-05 requires a toggle, not just a checkable menuitem); loses brand styling; cannot show multi-line "Routing through gateway-c (via relay-b)" honest topology line as styled text | Same — limits content to MenuItems | **Native menu IS the AppIndicator idiom; CheckMenuItem suffices for the toggle, disabled MenuItems for status lines** | Linux only |
| (b) Borderless window | Best — full React/Tailwind, brand tokens preserved, hide-on-blur via `Window.onFocusChanged`, position via `tauri-plugin-positioner` `Position.TrayCenter`. Matches Tailscale 2025 and the ahkohd reference (https://github.com/ahkohd/tauri-macos-menubar-app-example) | Same as macOS — works well on Win10/11 | Tauri tray-event doesn't fire on Linux — we'd need a custom right-click → window position handler that fights GTK; better to stay native | macOS + Windows |
| (c) **Hybrid (recommended)** | Borderless window | Borderless window (left-click) + native context menu (right-click, subset) | Native AppIndicator menu (right-click only) | **All three** |

**Implementation primer:**

```rust
// src-tauri/src/lib.rs — Phase 5 setup
.setup(|app| {
    #[cfg(desktop)]
    {
        // Positioner plugin must be initialized BEFORE TrayIconBuilder per
        // https://v2.tauri.app/plugin/positioner/ — its on_tray_event handler
        // is what makes Position.TrayCenter work later.
        app.handle().plugin(tauri_plugin_positioner::init());
        app.handle().plugin(tauri_plugin_notification::init());

        // Build the popover window UPFRONT (hidden). Cheaper than spawning
        // on every tray click, preserves React state across opens.
        // - decorations: false  (no titlebar)
        // - resizable: false
        // - alwaysOnTop: true   (popover idiom)
        // - skipTaskbar: true   (don't show in dock/taskbar)
        // - visible: false      (hidden until tray click)
        // - transparent: true   (macOS — for vibrancy if we want it)
        let popover = tauri::WebviewWindowBuilder::new(
            app, "tray-popover", tauri::WebviewUrl::App("tray-popover.html".into())
        )
            .decorations(false)
            .resizable(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .visible(false)
            .inner_size(360.0, 280.0)
            .build()?;

        TrayIconBuilder::new()
            .icon(app.default_window_icon().unwrap().clone())
            .menu(&native_menu(app)?)  // Linux uses this; macOS/Windows still get it on right-click as fallback
            .show_menu_on_left_click(false)  // Linux: right-click only opens menu, matches AppIndicator default
            .on_tray_icon_event(move |tray, event| {
                // Note: this handler is a no-op on Linux per Tauri docs.
                tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event {
                    if let Some(win) = tray.app_handle().get_webview_window("tray-popover") {
                        let _ = tauri_plugin_positioner::Position::TrayCenter
                            .move_window(&win);
                        let _ = win.show();
                        let _ = win.set_focus();
                    }
                }
            })
            .on_menu_event(|app, event| match event.id.as_ref() {
                "open" => { /* show main window */ }
                "route_toggle" => { /* TBD-PHASE-4-A */ }
                "quit" => app.exit(0),
                _ => {}
            })
            .build(app)?;
    }
    Ok(())
})
```

**Hide-on-blur for the macOS / Windows popover:** listen for the popover window's blur event from JS:

```typescript
// src/components/tray-popover/use-popover-lifecycle.ts
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
useEffect(() => {
  const win = getCurrentWebviewWindow();
  const unlisten = win.onFocusChanged(({ payload: focused }) => {
    if (!focused) win.hide();
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

**LSUIElement gotcha:** the 2026-04-24 decision is **window-first macOS** — DO NOT set `LSUIElement = true` in `Info.plist` / `tauri.conf.json`. The dock icon stays visible by default. The tray is a secondary surface. (Tailscale 2025 lesson; STATE.md row 4.)

### 6d · Capabilities entries Phase 5 must add

`src-tauri/capabilities/default.json` currently has:
```json
"permissions": [ "core:default", "shell:default", "log:default" ]
```

**Add for Phase 5:**

```json
{
  "permissions": [
    "core:default",
    "shell:default",
    "log:default",
    "notification:default",
    "positioner:default"
  ]
}
```

**The popover window needs its own capability scope** because it's not the `main` window. Add a second capability file (Tauri 2 supports multiple capability files per app, scoped by window label):

```json
// src-tauri/capabilities/tray-popover.json (NEW)
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "tray-popover",
  "description": "Capability for the tray popover window — minimal surface area",
  "windows": ["tray-popover"],
  "permissions": [
    "core:default",
    "core:window:allow-hide",
    "core:window:allow-show",
    "core:window:allow-set-focus"
  ]
}
```

Confidence: **HIGH** — capabilities scoping is documented at https://v2.tauri.app/security/capabilities/ and verified by reading existing `default.json`.

### 6e · Cargo + npm deps Phase 5 adds

**`src-tauri/Cargo.toml` `[dependencies]` additions:**

```toml
tauri = { version = "2", features = ["tray-icon"] }   # <- ADD tray-icon feature
tauri-plugin-notification = "2"
tauri-plugin-positioner = { version = "2", features = ["tray-icon"] }
```

Verified versions (npm view 2026-04-26):
- `@tauri-apps/plugin-notification@2.3.3`
- `@tauri-apps/plugin-positioner@2.3.1`
- `cmdk@1.1.1`

**`package.json` `dependencies` additions:**

```json
"@tauri-apps/plugin-notification": "^2.3.3",
"@tauri-apps/plugin-positioner": "^2.3.1",
"cmdk": "^1.1.1"
```

Bundle impact: cmdk ~5.2KB gz (https://cmdk.paco.me badge); notification + positioner ~3KB gz each (thin JS wrappers over Rust commands). Total Phase 5 JS bundle delta: **< 15KB gz**. Acceptable per Phase 2 D-27 bundle-discipline pattern.

---

## 7 · Command palette research

### 7a · Library choice — `cmdk`

| Candidate | Bundle | Brand fit | Recommendation |
|-----------|--------|-----------|----------------|
| **`cmdk` (1.1.1, 2025-03)** | 5.2KB gz | **Excellent** — fully unstyled, exposes `data-cmdk-*` attributes for our own CSS. Radix Dialog under the hood (already a Phase 2 dep). 4 deps (`@radix-ui/react-id`, `react-dialog`, `react-primitive`, `react-compose-refs`). All Radix-namespace. | **YES** |
| `kbar` | ~30KB gz | Ships heavier defaults: animations, theming, search highlighting overrides. Fighting it would consume the savings. | NO |
| `react-cmdk` (albingroen) | ~14KB gz | Pre-styled — would conflict with brand override constantly. Rejected on aesthetic grounds. | NO |
| Hand-rolled | 0 deps | We'd reinvent: keyboard-nav focus model, fuzzy filtering, group rendering, screen-reader semantics, Radix-Dialog-based focus trap. **Don't hand-roll** — cmdk is the standard for a reason. | NO |

**Verdict:** install `cmdk@^1.1.1`. Phase 5 ships the palette as `<CommandPalette />`, a `Command.Dialog`-mode component bound to `⌘K` globally.

**Brand override pattern** — cmdk exposes data attributes; our CSS rules write directly:

```css
/* Append to globals.css — phase 5 additions */
[cmdk-root] {
  background: var(--color-popover);
  border: 1px solid var(--color-border);
  border-radius: 0;
  font-family: var(--font-mono);
  color: var(--color-foreground);
}
[cmdk-input] {
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--font-code);
  font-size: 14px;
  color: var(--color-foreground);
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}
[cmdk-item] {
  padding: 8px 16px;
  font-family: var(--font-mono);
  text-transform: lowercase;
  letter-spacing: 0.05em;
}
[cmdk-item][data-selected="true"] {
  background: var(--color-popover);
  color: var(--color-primary);
}
[cmdk-group-heading] {
  padding: 8px 16px 4px;
  color: var(--color-muted-foreground);
  font-family: var(--font-mono);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.1em;
}
[cmdk-empty] {
  padding: 16px;
  color: var(--color-muted-foreground);
  font-family: var(--font-code);
}
```

No `border-radius`, no shadows, no gradients — brand contract preserved. `[data-selected="true"]` styling provides the active-row highlight per UI-SPEC patterns.

### 7b · Search-result ranking specification

**Default behavior** (cmdk default scoring): substring + prefix + Levenshtein-ish edit distance. Items in registration order tie-break.

**Ranking decisions for Phase 5:**

1. **Registration order** — register `navigate` group FIRST (6 items: `dashboard`/`peers`/`routing`/`gateway`/`logs`/`settings`), then `routing` (3 items), then `peers` (3), then `gateway` (3), then `logs` (2). This makes `g` resolve to `go to gateway` over `gateway preflight` (both have `g` prefix; navigate wins by registration tie-break).
2. **Disable `shouldFilter`'s built-in fuzzy on synonyms** — instead use `keywords` per item:
   ```tsx
   <Command.Item value="route on" keywords={["split-default", "internet via mesh", "route-on"]}>
     route on (turn on split-default routing)
   </Command.Item>
   ```
   So `Mira typing "split"` matches `route on` even though "split" doesn't appear in the visible label.
3. **No recency in v1.** Defer to v0.6+ (POWER-04 — Notification preferences may include palette ordering).

### 7c · Keyboard layer

| Key | Behavior | Source |
|-----|----------|--------|
| `⌘K` / `Ctrl+K` | Open palette globally | UX-07 |
| `Esc` | Close palette | cmdk default |
| `↑` / `↓` | Navigate items (with loop wraparound, `loop` prop) | cmdk default |
| `Enter` | Activate selected item | cmdk default |
| Letter keys | Filter input | cmdk default |

**Conflict check:** Phase 2's `AppShell` already binds `⌘1`/`⌘2`/`⌘5`/`⌘,` globally. `⌘K` does not collide with any existing Phase 2/3 binding. Phase 5 adds the binding to `AppShell.useEffect` next to the existing handlers, with the same `if (e.shiftKey || e.altKey) return;` modifier guard. A Phase 5 plan re-checks the ⌘3 (routing) and ⌘6 (settings) bindings introduced by Phases 4 and 3 respectively — confirming `⌘K` doesn't collide.

### 7d · Mount strategy

The palette is an **app-shell-level overlay**, mounted in `AppShell` next to `<ReconnectToast />` and `<Toaster />`. It survives tab switches and is not duplicated per screen. Pattern parallel to `<PeerDetailSheet />` and `<PairApprovalModal />` mount in `ActiveScreen` (Phase 2).

**Rationale:** the palette is global. Mounting per-screen would force `useState(open)` to live somewhere — and the hotkey would need to set state from outside React. Module-level atom (parallel to `useDaemonState`'s pattern) keeps state in one place; `AppShell` reads the atom and renders the dialog.

---

## 8 · Notification policy table

> **Concrete enumeration** of every event the daemon can emit OR the UI can synthesize, mapped to a delivery channel. `system` = OS notification via `tauri-plugin-notification`. `toast` = sonner in-app. `both` = system AND toast (rare, critical events only). `silent` = log to console + dashboard, no user-facing surface.

| Source event | Channel | Copy (Aria-spec) | Rationale | Phase dep |
|--------------|---------|------------------|-----------|-----------|
| `peers.event { kind: "connected" }` | **toast** | `relay-b connected` | UX-04: non-critical lifecycle → toast only | Phase 2 already emits |
| `peers.event { kind: "disconnected" }` | **silent** | (peer row updates; no toast) | High volume; toast spam violates "honest, not noisy" | Phase 2 |
| `peers.event { kind: "discovered" }` | **silent** | (Nearby panel updates; modal fires only on inbound pair handshake) | Discovery is continuous; toast on every announce would be noise | Phase 2 |
| `peers.event { kind: "pair_failed" }` | **toast** | `Couldn't verify {label ?? short_id}. See logs.` | Mira-class signal — needs surfacing but not OS-level | Phase 2 (D-31 already toasts subscription errors; this row is a NEW toast trigger) |
| `peers.event { kind: "state_changed" }` | **silent** | (peer row updates) | Continuous; channel → toast spam | Phase 2 |
| `status.event { kind: "interface_up" }` | **silent** | (Identity panel updates) | UX-04 default — silent | Phase 2 |
| `status.event { kind: "interface_down" }` | **toast** | `interface {iface} is down — show why →` | Critical local condition; one-shot | Phase 2 (D-09 already shows the chip; toast is NEW) |
| `status.event { kind: "gateway_selected" }` | **silent** | (Dashboard egress line updates) | Selection is the steady state; only failover surfaces | Phase 4 (TBD-PHASE-4-B for the ROUTE-02 string) |
| `status.event { kind: "gateway_lost" }` (one of N gateways lost; failover succeeded) | **toast** | `Failed over to {new_gateway} — {old_gateway} lost` | UX-04 verbatim: "gateway failover" → toast only. 2026-04-24 decision row 4. | Phase 5 |
| `status.event { kind: "gateway_lost" }` AND no other gateway available (kill-switch about to engage) | **silent** (handled by next event) | — | The `kill_switch` event fires next — surface that, not this. | TBD-PHASE-4-C |
| `status.event { kind: "kill_switch", detail: { engaged: true } }` | **both** | `Blocking internet — gateway unreachable. Open pim to fix.` | UX-04 critical. 2026-04-24 decision row 5. + STATE.md row 5. | TBD-PHASE-4-C |
| `status.event { kind: "kill_switch", detail: { engaged: false } }` | **toast** | `Internet routing restored.` | Disengage is non-critical (positive outcome) | TBD-PHASE-4-C |
| All gateways lost (synthesized — when `selected_gateway === null` AND `route_on === true`) | **system** | `Mesh has no gateway — internet routing lost.` | Distinct from kill-switch (which only engages when route-on). All-gateways-lost when route-off is also a critical trust signal for Mira. | Phase 5 |
| `status.event { kind: "role_changed" }` | **toast** | `node role: {new_role}` | Information; rare | Phase 2 |
| `status.event { kind: "route_on" }` | **silent** | (Dashboard toggle reflects state) | User-initiated; toast is redundant | TBD-PHASE-4-A |
| `status.event { kind: "route_off" }` | **silent** | (Same) | Same | TBD-PHASE-4-A |
| `daemon://state-changed → state: "error"` (crash) | **toast** | `pim daemon stopped — restart to continue.` | LimitedModeBanner is the persistent surface; toast is the transition signal | Phase 1 |
| `daemon://state-changed → state: "running"` AFTER previous error | **toast** | `pim daemon reconnected.` | ReconnectToast (Phase 1) already does this | Phase 1 (existing) |
| `gateway.event { kind: "conntrack_pressure", level: 1 }` (≥ 80%) | **toast** | `gateway conntrack near limit ({pct}%).` | Mira surface; one-shot per crossing | Phase 5 |
| `gateway.event { kind: "conntrack_pressure", level: 2 }` (≥ 95%) | **system** | `gateway conntrack saturated — connections will drop.` | Critical local condition; OS-level escalation per UX-04 spirit | Phase 5 |
| `gateway.event { kind: "enabled" }` | **toast** | `gateway active on {nat_interface}.` | One-shot, user-initiated → confirmation | Phase 5 |
| `gateway.event { kind: "disabled" }` | **toast** | `gateway off.` | One-shot | Phase 5 |
| Subscription error (D-31 from Phase 2) | **toast** | `Couldn't subscribe to {stream}. Check the Logs tab.` | Already handled by `<SubscriptionErrorToast />` from Plan 02-06 | Phase 2 (existing) |

**Settings → Notifications surface (Phase 3 already structured the section):** Phase 5's Plan-05 wires the table above into the existing Notifications section as a read-only display (per-event toggles are POWER-04 — out of scope). The user can audit; they cannot reconfigure in v1. Honest by default.

**Permission flow:** at app start (one-shot), Phase 5 calls `isPermissionGranted()`. If false, **does NOT request** — wait until the first event that would trigger an OS notification, then call `requestPermission()` then `sendNotification`. This avoids the macOS / Windows permission prompt at app launch (which would interrupt Aria's onboarding) and only surfaces when needed.

---

## 9 · Conntrack / throughput visualization

### 9a · Recommendation: ASCII bar gauge

**Brand-fit** (per STYLE.md "Always: CLI output panels as first-class brand imagery; status via Unicode indicators or bracketed codes"):

```
  conntrack
  [████████████░░░░░░░░░░░░░░░░░░░░] 1,247 / 4,096 (30%)
```

| Property | Value | Source |
|----------|-------|--------|
| Filled char | `█` (U+2588 FULL BLOCK) | brand logo char; CliPanel idiom |
| Empty char | `░` (U+2591 LIGHT SHADE) | hairline contrast against background |
| Brackets | `[` `]` ASCII square brackets | matches existing `[STATUS]` badge idiom |
| Width | 32 chars (each char = ~3.125%) | dense enough to be meaningful, narrow enough to fit in the Gateway tab's 5xl content width on a 720px-min window |
| Color thresholds | < 80% → `text-foreground` filled portion; ≥ 80% → `text-accent` (amber); ≥ 95% → `text-destructive` (red) | brand semantic mapping |
| Label | `n / max (pct%)` after the gauge — comma-grouped numerator, integer pct | existing `formatBytes` / `formatCount` patterns from `src/lib/format.ts` |
| Accessibility | wrap in `<div role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} aria-label="conntrack utilization">{ascii} {label}</div>` | WCAG 4.1.2 |

**Why NOT an SVG gauge:** STYLE.md "Never: photography, illustration, mascots, hero imagery that isn't CLI/diagram-based" — a rounded SVG gauge with stroke arcs reads as SaaS, not infrastructure. The ASCII bar reads from the same well as the CliPanel borders; it's the same idiom Mira sees in `pim status --verbose`. Brand contract preserved.

### 9b · Throughput panel

```
  throughput
  in   1.4 MB/s   out  920 KB/s
  total 4h 12m    in   2.1 GB    out  1.4 GB
```

**Format helpers** (extend `src/lib/format.ts`):
- `formatBitrate(bps: number): string` — `"1.4 MB/s"`, `"920 KB/s"`, `"2.3 GB/s"` — SI binary, 1 decimal, units `B/s` / `KB/s` / `MB/s` / `GB/s`. Matches existing `formatBytes` from Phase 2 D-24.
- `formatBytesTotal(bytes: number): string` — `"2.1 GB"`, `"4.2 MB"`, `"512 KB"`. Same scale, no `/s` suffix. (May already exist as `formatBytes` — verify.)

### 9c · Peer-through-me list

Reuses existing `<PeerRow />` from Phase 2 with one filter change: `peers.filter(p => peers_through_me_ids.includes(p.node_id))`. No new component. Honest transport per row, same as Dashboard.

**Empty state copy:** `no peers routing through this node yet · advertising 0.0.0.0/0` — non-infantilizing, accurate.

---

## 10 · Pre-flight UX

### 10a · Per-check rendering

Each check from `GatewayPreflightResult.checks` renders as one line inside a CliPanel section:

```tsx
function PreflightCheckRow({ check }: { check: GatewayPreflightCheck }) {
  return (
    <div className="flex gap-2 items-baseline font-code text-sm">
      <StatusIndicator state={check.ok ? "active" : "failed"} />
      <span>{humanizeCheckName(check.name)}</span>
      {!check.ok && <span className="text-muted-foreground">· {check.detail}</span>}
      {!check.ok && recoveryHint(check.name) && (
        <span className="text-muted-foreground">· {recoveryHint(check.name)}</span>
      )}
    </div>
  );
}
```

**`humanizeCheckName(name: string): string`** — daemon emits `iptables_present`, `cap_net_admin`, `running_on_linux`, `interfaces_detected`. UI maps to:

```typescript
const humanCheckNames: Record<string, string> = {
  running_on_linux: "running on linux",
  iptables_present: "iptables present",
  cap_net_admin: "CAP_NET_ADMIN available",
  interfaces_detected: "network interfaces detected",
  // Unknown check names fall through to lowercased name verbatim:
  // `daemon emits "foo_bar" → UI shows "foo bar"`.
};
function humanizeCheckName(name: string): string {
  return humanCheckNames[name] ?? name.replace(/_/g, " ");
}
```

`StatusIndicator state="failed"` renders `✗` in `text-destructive`; `state="active"` renders `◆` in `text-primary`. Reuses Phase 2 primitive. **No new icon work.**

### 10b · Failure recovery — iptables not installed

The hardest case: Aria on Ubuntu without iptables.

**Daemon emits:**
```json
{ "name": "iptables_present", "ok": false, "detail": "command 'iptables' not found in PATH" }
```

**UI renders:**
```
✗ iptables present · command 'iptables' not found in PATH · install: sudo apt install iptables
```

**The recovery hint** is constructed UI-side from a known-check map keyed on `name`:

```typescript
// recoveryHint() — UI knowledge, NOT daemon truth.
// We say "install: sudo apt install iptables" because it's the most common
// path on Linux (Ubuntu / Debian). Arch/Fedora users see the same hint,
// run the wrong command, get an error in their shell — that's their cue
// to translate. We do NOT auto-detect distro (that requires shell + parses
// /etc/os-release; out of scope, brand-violating).
const recoveryHints: Record<string, string> = {
  iptables_present: "install: sudo apt install iptables",
  cap_net_admin: "run pim-daemon as root or grant cap_net_admin: sudo setcap cap_net_admin=ep $(which pim-daemon)",
  // running_on_linux + interfaces_detected have no actionable recovery — omit.
};
function recoveryHint(name: string): string | null {
  return recoveryHints[name] ?? null;
}
```

**Critical brand call-out:** the hint is **plain text**, not a clickable button or terminal-emulator embed. We don't auto-run shell. We don't escalate to UAC. Mira can copy the command (text is selectable); Aria is given a path forward without pretending we did the work.

**Per-check expandable detail (deferred):** The `fields` data carried in some daemon errors (e.g. `LogEvent.fields`) suggests a future enhancement where pre-flight checks could carry a `fields: Record<string, unknown>` map (specific blocked iptables rule, pid of conflicting NAT process). Not in v1 RPC. Defer.

### 10c · Re-run pre-flight

Single button `[ Re-run pre-flight ]` below the check list. On click: re-call `gateway.preflight(null)`, replace the rendered list. Spinner state via the existing button-pending pattern from Phase 1 (not re-invented here). **No partial render** — when the call is in flight, the previous list stays visible at `opacity-60` (same pattern as D-30 Limited-mode dim).

---

## 11 · Information-architecture impact

### 11a · Sidebar — Gateway row activation

`src/components/shell/sidebar.tsx` (Phase 2) currently lists:

```typescript
const RESERVED: readonly ReservedRow[] = [
  { id: "routing", label: "routing", reservedFor: "(phase 4)" },
  { id: "gateway", label: "gateway", reservedFor: "(phase 5)" },  // <- Phase 5 flips this
  { id: "settings", label: "settings", reservedFor: "(phase 3)" },
];
```

**Phase 5 plan moves the `gateway` entry from `RESERVED` to `NAV`** — adds keyboard shortcut `⌘4` (already implied by sidebar order). Consequences:

- `useActiveScreen()` discriminator union expands: `"dashboard" | "peers" | "logs" | "gateway"` (Phase 4 will add `routing`, Phase 3 already adds `settings`).
- `<ActiveScreen />` switch grows a `case "gateway":` returning `<GatewayScreen />`.
- `AppShell` keyboard handler grows a `case "4":` (mirror of `case "1"/2"/5"`).

Phase 4's `routing` will land between Phases 4 and 5 — Phase 5 must be careful that flipping `gateway` active doesn't conflict with Phase 4's flipping `routing` active. **Solution:** Phase 5's first plan modifies the sidebar with **only the `gateway` flip** — leaves `routing` (phase 4) reserved row untouched. Phase 4 owns its own row flip.

### 11b · Shell-level palette overlay mount

`<CommandPalette />` mounts at `AppShell` level (parallel to `<Toaster />`, `<ReconnectToast />`, `<SubscriptionErrorToast />`). Module-level `useCommandPalette()` atom holds `open: boolean`. Hotkey `⌘K` toggles via `setOpen(!open)`. Closes via `Esc` (cmdk default) or item-activation (executes the action then sets `open: false`).

```tsx
// AppShell.tsx — Phase 5 addition
return (
  <div className="flex min-h-screen bg-background text-foreground">
    <Sidebar />
    <main aria-label="content" className="flex-1 overflow-y-auto px-8 py-8">
      <ActiveScreen />
    </main>
    <ReconnectToast />
    <StopConfirmDialog />
    <Toaster ... />
    <SubscriptionErrorToast />
    <CommandPalette />               {/* <- Phase 5 */}
  </div>
);
```

### 11c · Popover lifecycle owner

The tray-popover window is owned by **Rust** (created in `setup` hook, lifecycle bound to app process) — NOT React. React renders inside the popover window, but the window's existence persists across React component remounts.

**Communication:** popover window and main window each run their own React tree. They share state via:
1. **The daemon** — both windows mount `useDaemonState()` and read from the same Tauri event stream. No cross-window IPC needed for status/peers/gateway state.
2. **A small atom for "open Add peer flow"** — when the popover's `Add peer nearby` is clicked, the popover emits a Tauri event `pim://open-add-peer`, the main window listens, navigates to the Nearby panel, and shows the window.

**This means W1 single-listener becomes per-window** — each window has its own `useDaemonState` listener. That's acceptable: the W1 contract is *per-window*, not *per-app*. The popover window has 2 listeners (mirror of main), the main window has 2. Total Tauri-side: 4 listeners across 2 windows. The point of W1 is "no per-component listener leaks within a single window's React tree" — that invariant is preserved.

**Confirm in plan:** Phase 5 plan-checker should grep `listen(` count in `src/components/tray-popover/` (new directory) and assert it's 0 — the popover's `useDaemonState` re-uses the existing module via a per-window mount.

---

## 12 · Validation Architecture (testability notes)

> **Nyquist validation is DISABLED per `.planning/config.json` (`workflow.nyquist_validation: false`).** Per the user's instructions, include concise testability notes per REQ for the planner to scaffold human-verify checkpoints. Phase 5 follows Phase 2's D-28 pattern: human-verify checkpoints in the final plan, supported by automated greps in each plan.

| Req ID | Behavior | Test type | How to verify (human) | How to grep-verify (plan acceptance) |
|--------|----------|-----------|----------------------|--------------------------------------|
| GATE-01 | Pre-flight check pass/fail rendering | manual + grep | Linux: open Gateway tab, see N checks each with glyph + name + detail. Force iptables fail by `mv /usr/sbin/iptables /tmp/`; re-run; see ✗ + detail + recovery hint. | `grep -q "GatewayPreflightCheck" src/screens/gateway.tsx` + `grep -q "humanizeCheckName" src/screens/gateway.tsx` |
| GATE-02 | Linux gateway enable + nat_interface picker | manual | All checks pass → `[ Turn on gateway mode ]` becomes visible; pick interface from `<Select>`; click; daemon receives `gateway.enable({ nat_interface: "wlan0" })` (verify in Logs tab). | `grep -q "gateway.enable" src/screens/gateway.tsx` |
| GATE-03 | Conntrack gauge + throughput + peer-through-me | manual | Active gateway state: bar gauge updates within 1s of conntrack change (verify by opening 50 connections through gateway), peer count matches `pim peers list`. | `grep -q "aria-valuenow" src/components/gateway/conntrack-gauge.tsx` + `grep -q "useGatewayStatus" src/screens/gateway.tsx` |
| GATE-04 | macOS / Windows Linux-only messaging | manual | macOS: open Gateway tab; see exact SETUP-02 copy "Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay." — copy is rendered, not hidden. | `grep -q "Linux-only today" src/screens/gateway.tsx` (verbatim copy gate) |
| UX-04 | Toast for non-critical, system for critical | manual + grep | Trigger peer connect → toast only (no OS notification). Trigger kill-switch via `iptables -A OUTPUT -j DROP` while route-on → BOTH toast and OS notification fire. Verify OS notification in macOS Notification Center. | `grep -q "sendNotification" src/hooks/use-gateway-notifications.ts` + `grep -q "kill_switch" src/hooks/use-gateway-notifications.ts` |
| UX-05 | macOS menu-bar popover provides status + toggle + Open pim, window-first | manual | Click tray icon: popover appears; status dot reflects `useStatus()` value; toggle round-trips through daemon; Open pim shows main window. **Quit pim AND verify dock icon was visible** (LSUIElement = false). | `grep -qv "LSUIElement" src-tauri/tauri.conf.json` (negative — no LSUIElement key); `grep -q "tauri-plugin-positioner" src-tauri/Cargo.toml` |
| UX-06 | Windows tray + Linux AppIndicator parity | manual | Windows: left-click tray = popover; right-click tray = native context menu (Open pim, Quit). Linux: right-click AppIndicator = native menu with same items. **Same daemon state reflected in all three OS surfaces.** | `grep -q "show_menu_on_left_click(false)" src-tauri/src/lib.rs` |
| UX-07 | ⌘K palette exposes every major action + tab nav | manual | Press ⌘K, type `g` → first item is `go to gateway`; type `route` → see `route on`/`route off`/`show routing table`; press Enter → action executes. | `grep -q "Command.Dialog" src/components/command-palette.tsx`; `grep -c "Command.Item" src/components/command-palette.tsx` returns ≥ 17 (number of distinct actions in §2f) |

**Final plan (Plan 05-N)** runs the full human-verify walkthrough with 6 success-criteria checkboxes per ROADMAP Phase 5 SC1–SC6. Pattern from Plan 02-06 (verified-on-real-daemon checkpoint).

---

## 13 · Estimated plan breakdown

> Recommendation for splitting Phase 5 into 5–7 plans. Wave assignments are parallelism boundaries — plans in the same wave have **zero file conflicts**; plans in later waves depend on earlier waves. Each plan ships an independently-acceptable success-criterion subset.

### Plan 05-01 — Foundation & dependency installs (Wave 1, depends_on: none)

**Wave 1.** No file conflicts with anything in Phase 5. Establishes the substrate.

**Files modified:**
- `package.json` — add `cmdk@^1.1.1`, `@tauri-apps/plugin-notification@^2.3.3`, `@tauri-apps/plugin-positioner@^2.3.1`
- `src-tauri/Cargo.toml` — add `tauri-plugin-notification = "2"`, `tauri-plugin-positioner = { version = "2", features = ["tray-icon"] }`, set `tauri = { version = "2", features = ["tray-icon"] }`
- `src-tauri/src/lib.rs` — register the two plugins (no tray code yet — that's Plan 05-04)
- `src-tauri/capabilities/default.json` — add `notification:default`, `positioner:default`
- `src/lib/rpc-types.ts` — add `GatewayStatusResult`, `GatewayEvent`, `GatewayEventKind`, extend `RpcMethodMap` and `RpcEventMap`. Tag every addition with `// TBD-RPC: ...` comment.
- `src/components/shell/sidebar.tsx` — flip `gateway` from `RESERVED` to `NAV` with shortcut `⌘4`
- `src/hooks/use-active-screen.ts` — extend `ActiveScreenId` union with `"gateway"`
- `src/components/shell/active-screen.tsx` — add `case "gateway": return <GatewayScreen />` placeholder
- `src/screens/gateway.tsx` — placeholder screen (real impl in Plan 05-02 / 05-03)
- `src/components/shell/app-shell.tsx` — extend keyboard handler with `case "4":` and `case "k":` (palette opens; CommandPalette ships in Plan 05-05)

**Requirements addressed:** infrastructure for GATE-01..04 + UX-05/06/07 (dependency-availability gate).

**Wave check:** Plan 05-02 / 05-03 / 05-04 / 05-05 ALL depend on 05-01.

### Plan 05-02 — Gateway tab pre-flight + enable + Linux-only messaging (Wave 2, depends_on: 05-01)

**Wave 2.** Sole owner of `src/screens/gateway.tsx` and the gateway directory.

**Files modified:**
- `src/screens/gateway.tsx` — full pre-flight UI + enable form + macOS/Windows messaging
- `src/components/gateway/preflight-check-row.tsx` — single check row component
- `src/components/gateway/preflight-section.tsx` — list + re-run button + check-name humanizer + recovery-hint map
- `src/components/gateway/nat-interface-select.tsx` — wraps existing `<Select>` primitive

**Requirements addressed:** GATE-01, GATE-02, GATE-04.

**Phase 4 deps:** none — entirely self-contained on Phase 5 + Phase 2 primitives.

### Plan 05-03 — Gateway active state (gauge + throughput + peer-through-me) (Wave 2, depends_on: 05-01)

**Wave 2.** Adds files; touches `src/screens/gateway.tsx` only inside the `active` branch.

**Files modified:**
- `src/screens/gateway.tsx` — extend with `<GatewayActivePanel />` rendered when `gateway.status().active === true`
- `src/components/gateway/conntrack-gauge.tsx` — ASCII bar gauge
- `src/components/gateway/throughput-panel.tsx` — current rate + session totals
- `src/components/gateway/peers-through-me-list.tsx` — filtered peer list
- `src/hooks/use-gateway-status.ts` — `gateway.status()` one-shot + `gateway.event` subscription via existing `actions.subscribe` fan-out (W1 preserved)
- `src/lib/format.ts` — extend with `formatBitrate()` if not present
- `src-tauri/src/rpc/gateway.rs` (NEW) — Rust-side passthrough for `gateway.status` + `gateway.subscribe` if not already covered by generic `daemon_call` (likely already covered — verify in plan)

**Requirements addressed:** GATE-03.

**Wave 2 conflict check:** Plan 05-02 owns `src/screens/gateway.tsx` for the inactive (pre-flight) state; Plan 05-03 owns the active state. Both modify the SAME FILE — must be sequenced. **Move Plan 05-03 to Wave 3** with `depends_on: ["05-01", "05-02"]`. Updated below.

### Plan 05-04 — Tray + popover + native menu (Wave 2, depends_on: 05-01)

**Wave 2.** No conflict with 05-02 — separate file domain (`src-tauri/src/lib.rs` shared with 05-01 but 05-01 leaves the tray section commented; 05-04 adds it).

**Files modified:**
- `src-tauri/src/lib.rs` — `TrayIconBuilder` setup + native menu construction + popover window creation + `on_tray_icon_event` + `on_menu_event` handlers
- `src-tauri/src/tray.rs` (NEW) — extracted tray helpers (build_menu, build_popover_window) for testability
- `src-tauri/capabilities/tray-popover.json` (NEW) — capability scoped to `tray-popover` window
- `src-tauri/icons/tray.png` (NEW or reuse) — tray icon (small, monochrome, signal-green-on-transparent for macOS template image)
- `src-tauri/tauri.conf.json` — register the tray-popover window if needed (Tauri 2 supports defining additional windows in config OR programmatically; programmatic is simpler — no config change needed)
- `src/components/tray-popover/tray-popover-app.tsx` (NEW) — the popover's React entrypoint
- `src/components/tray-popover/popover-shell.tsx` (NEW) — layout
- `src/components/tray-popover/use-popover-lifecycle.ts` (NEW) — hide-on-blur listener
- `tray-popover.html` (NEW at repo root or `src/`) — HTML entrypoint for the popover window
- `vite.config.ts` — add `tray-popover.html` to `rollupOptions.input` so Vite builds it

**Requirements addressed:** UX-05, UX-06.

**Phase 4 deps:** TBD-PHASE-4-A (route toggle component) — popover renders `<TBDRouteToggle />` placeholder until Phase 4 lands. TBD-PHASE-4-B (route status sub-line) — popover renders `useRouteStatusLine()` selector that returns null until Phase 4 wires it.

### Plan 05-05 — Command palette (Wave 2, depends_on: 05-01)

**Wave 2.** Independent of 05-02/03/04 — sole owner of palette files.

**Files modified:**
- `src/components/command-palette.tsx` (NEW) — `<Command.Dialog>` wrapper with all groups
- `src/lib/command-palette/actions.ts` (NEW) — registry of every action (navigate / routing / peers / gateway / logs)
- `src/lib/command-palette/state.ts` (NEW) — module-level atom (parallel to `useDaemonState` pattern) for `open` boolean
- `src/hooks/use-command-palette.ts` (NEW) — public API: `{ open, setOpen, toggle }`
- `src/components/shell/app-shell.tsx` — mount `<CommandPalette />` (already extended in 05-01 with the ⌘K hotkey)
- `src/globals.css` — append cmdk brand-override CSS rules (§7a)

**Requirements addressed:** UX-07.

**Phase 4 deps:** TBD-PHASE-4-F (`> show routing table` action) — palette item exists; navigation lands on `routing` screen ID which Phase 4 may or may not have wired. TBD-PHASE-4-G (`> add peer nearby` action) navigates to existing Phase 2 Nearby section.

### Plan 05-06 — Notification policy + system notifications (Wave 3, depends_on: 05-01, 05-04)

**Wave 3.** Depends on 05-01 (deps installed) and 05-04 (tray-popover already exists, so notifications can also bring the popover-emitted "Open pim" path live). Could also depend on 05-03 if conntrack_pressure events need the gateway hook.

**Files modified:**
- `src/hooks/use-gateway-notifications.ts` (NEW) — listens to `status.event` + `gateway.event`; calls `sendNotification()` per the §8 policy table
- `src/hooks/use-system-notifications.ts` (NEW) — generic permission flow + send wrapper
- `src/components/notifications/notification-permission-prompt.tsx` (NEW) — fires on first critical event if permission not granted
- `src/screens/settings.tsx` — extend Phase 3 Notifications section with the §8 policy table (read-only display)

**Requirements addressed:** UX-04.

**Phase 4 deps:** TBD-PHASE-4-C (kill-switch state machine) — `kill_switch` event already in `rpc-types.ts`; Phase 5 listens directly. Phase 4 owns the in-app banner; Phase 5 owns the OS notification. Both fire from the same event.

### Plan 05-07 — Phase 5 audit + human-verify checkpoint (Wave 4, depends_on: all prior)

**Wave 4.** Final plan — audit pass + walkthrough.

**Files modified:** none (audit-only); creates `05-07-SUMMARY.md`.

**Tasks:**
1. Grep audit: `grep -rn "TBD-PHASE-4-" src/ src-tauri/` — list every Phase-4 dep for the eventual integrator. Verify count matches §4 inventory.
2. Grep audit: `grep -rn "TBD-RPC" src/lib/rpc-types.ts` — verify every speculative RPC type is tagged.
3. Brand audit: no border-radius, no shadows, no exclamation marks, no literal hex colors in any new file.
4. Human-verify walkthrough: 6 ROADMAP success-criteria checkboxes against real `pim-daemon` (Linux for SC1/SC2, any OS for SC3/SC4/SC5/SC6).
5. COPY.md audit (if Phase 4 has shipped UX-08): re-verify every Phase-5 string against the table; otherwise mark as deferred to Phase 4 close-out.

**Requirements addressed:** none new — all 8 Phase-5 reqs (GATE-01..04, UX-04..07) have full plan coverage above.

### Wave summary

| Wave | Plans | Parallel? | Critical-path |
|------|-------|-----------|---------------|
| 1 | 05-01 | — (foundation) | YES |
| 2 | 05-02, 05-04, 05-05 | YES (no file conflicts) | NO |
| 3 | 05-03, 05-06 | YES (no file conflicts; both depend on Wave 2) | NO |
| 4 | 05-07 | — (audit) | YES |

**Critical-path duration estimate:** Plans 05-01 → 05-02 → 05-03 → 05-07 = **4 sequential plans**. Plans 05-04, 05-05, 05-06 fit into Wave 2/3 alongside.

**Total plans:** 7. Within the 4–7 range the user requested.

---

## 14 · Open questions for the planner

> Anything still ambiguous after research that the planner / discuss-phase should resolve before plans are written.

1. **`gateway.event` stream — does the kernel maintainer accept the addition?** §5b proposes adding a fourth notification stream. If rejected, fall back to 1Hz polling per §5e. **Decision needed before Plan 05-03 ships.** Proposal: planner files an issue / draft PR against the kernel repo at the same time as Plan 05-01 starts; if no answer by Wave-2-start, default to polling and document the rip-out path.

2. **macOS notification icon** — the `tauri-plugin-notification` API uses the app's bundle icon by default. Brand-fit demands the green `█` block. Verify the existing `src-tauri/icons/icon.icns` is brand-compliant; if not, regenerate at the same time as the tray icon.

3. **Tray icon visual** — macOS tray icons are template images (single-color, system tints them). The `█` brand glyph at 16×16 px reads cleanly; alternative is `◆`. **Recommendation:** `█` (matches logo). Phase 5 plan should include an `assets/tray-icon.png` design pass.

4. **Popover on multi-monitor** — known Tauri positioner bug for tray-relative position when monitor configurations change (https://github.com/tauri-apps/tauri/issues/7139). Phase 5 acceptance: works on single-monitor (verified); known-issue note for multi-monitor (defer fix to upstream).

5. **Windows installer signing** — `tauri-plugin-notification` toast notifications require an installed (not dev-mode) app on Windows. Phase 5 testing on Windows requires building a signed bundle. Verify CI has signing creds before Plan 05-06 verify.

6. **Conntrack `max` discoverability when daemon doesn't expose it** — if `gateway.status()` doesn't include `conntrack.max`, the gauge can't render. The fallback (read `/proc/sys/net/netfilter/nf_conntrack_max` UI-side) is wrong because the UI is a Tauri webview without filesystem read perms. **Hard requirement** that the daemon's `gateway.status` includes both numerator and denominator (§5a).

7. **"All gateways lost" event** — §8 lists this as a `system` notification. The daemon may NOT emit a single canonical event for "all lost" — it may emit per-gateway `gateway_lost` events. Phase 5's notification hook would need to track "did this gateway_lost leave 0 known gateways?" by reading `snapshot.status.routes` after each event. **TBD-RPC clarification:** does the daemon emit a final "all gateways lost" event, or does the UI synthesize it? Recommendation: UI synthesizes via `selected_gateway === null && previous_selected_gateway !== null && status.routes.gateways.length === 0` — but this requires `route.table()` data. Document the synthesis logic in Plan 05-06.

8. **Mira's right-click menu on Linux — does it duplicate the popover idiom on macOS, or does it diverge to add CLI-grade items (e.g. "Show daemon status JSON")?** Recommendation per §2e: stay parity-only. Don't slip extra items in just because Linux can render them. Aria's mental model of "all OSes show the same things" is more valuable than Mira's mental model of "Linux gets bonus tools". POWER-04 territory.

9. **Should Phase 5 backfill a `<RoutingScreen />` placeholder for `⌘3`?** Phase 4 owns ROUTE-03 (routing tab). If Phase 5 ships before Phase 4 (out of strict order), the palette's `> show routing table` action would navigate to a missing screen. **Decision rule:** the ROADMAP locks Phase 4 → Phase 5 sequence. Phase 5 can assume Phase 4 has shipped. If for any reason the order inverts, Plan 05-01 should add a `<RoutingScreen placeholder />` rendering `routing tab lands in phase 4`.

10. **How does the popover share React state with the main window?** §11c says: not at all (each window has its own React tree, both subscribe to the daemon). Cross-window IPC is via Tauri event emit/listen for the few cases (Add peer click → focus main window). **Confirm with planner** that this is acceptable vs spawning the popover as a portal of the main window's React tree (the latter is harder in Tauri 2 and not the common pattern).

---

## Sources

### Primary (HIGH confidence)
- [Tauri System Tray docs](https://v2.tauri.app/learn/system-tray/) — TrayIconBuilder API, Linux event limitations, click handlers
- [Tauri Notification plugin](https://v2.tauri.app/plugin/notification/) — install, capabilities, JS API
- [Tauri Positioner plugin](https://v2.tauri.app/plugin/positioner/) — TrayCenter usage, on_tray_event handler
- [Tauri Capabilities](https://v2.tauri.app/security/capabilities/) — multi-window scoping, plugin permissions
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) — Linux libayatana requirement
- [cmdk GitHub](https://github.com/dip/cmdk) — full API + customization story
- npm registry verifications (2026-04-26): `cmdk@1.1.1`, `@tauri-apps/plugin-positioner@2.3.1`, `@tauri-apps/plugin-notification@2.3.3`
- pim-ui repo files: `rpc-types.ts` (existing gateway types), `globals.css` (brand tokens), `STATE.md` (locked decisions), `REQUIREMENTS.md` (REQ-ID verbatim wording), Phase 2 `02-CONTEXT.md` + `02-UI-SPEC.md` (format model + brand contract)

### Secondary (MEDIUM confidence)
- [ahkohd's Tauri macOS Menubar example](https://github.com/ahkohd/tauri-macos-menubar-app-example) — popover-as-window pattern reference
- [Tauri tray tutorial](https://tauritutorials.com/blog/building-a-system-tray-app-with-tauri) — practical setup walkthrough; confirms positioner plugin pattern
- [Tauri discussion #12924](https://github.com/orgs/tauri-apps/discussions/12924) — confirms macOS tray icon click handler patterns
- [shadcn-cmdk](https://github.com/HuakunShen/shadcn-cmdk) — confirms cmdk + Radix Dialog integration approach
- npm `tauri-plugin-notifications` (Choochmeque fork) — confirms Linux notify-rust D-Bus backend

### Tertiary (LOW confidence — flagged for kernel-maintainer validation)
- §5 RPC contract additions — entirely speculative pending `proximity-internet-mesh/docs/RPC.md` v2 push (BLOCKED per STATE.md)
- §10 recovery hint copy — distro-specific (`apt install`); not validated on Arch/Fedora/Alpine
- §7c keyboard collision check — assumes Phase 3's `⌘6` (settings) and Phase 4's `⌘3` (routing) bindings; verify when those phases land

---

## Metadata

**Confidence breakdown:**
- Standard stack (Tauri tray, notification, positioner, cmdk): **HIGH** — all verified against official Tauri 2 docs + npm registry within last 24 hours
- Architecture (popover pattern, palette mount, sidebar flip): **HIGH** — based on existing pim-ui code patterns + Phase 2 precedent
- RPC contract for `gateway.status` / `gateway.event`: **MEDIUM** — speculative, tagged `TBD-RPC`, kernel maintainer must confirm
- Phase 4 dependencies: **HIGH** — every dep enumerated with source REQ + workaround; Phase 5 plans ship independently
- Notification policy: **HIGH** — UX-04 + 2026-04-24 decisions verbatim, plus complete event enumeration

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days; stable Tauri 2.x ecosystem). Re-verify if kernel `docs/RPC.md` lands or if `cmdk` ships v2.

## RESEARCH COMPLETE
