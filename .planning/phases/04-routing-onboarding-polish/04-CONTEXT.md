# Phase 4: Routing & Onboarding Polish — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Autonomous decision pass — user directed Claude to drive all gray areas without discussion ("não vamos discutir, faça o que vc achar melhor… execute a fase"). Decisions below were chosen after re-reading PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, prior CONTEXT.md (01.1 / 02 / 03), `docs/UX-PLAN.md` (full), `docs/research/kernel-study.md` (relevant sections), `.design/branding/pim/patterns/STYLE.md`, and the live codebase. See `04-DISCUSSION-LOG.md` for the alternatives considered per area.

<domain>
## Phase Boundary

Phase 4 closes the v1 desktop loop for **Aria** (newcomer) without betraying **Mira** (researcher): the user can route their internet through the mesh with honest gateway/relay surfacing, see the live routing table and known-gateways list, finish onboarding in three interactions to a usable solo dashboard, and read a kill-switch / handshake-fail surface that names the technical state instead of hiding it.

**Ships:**

1. **Onboarding step 3 (`UX-01`)** — a new `WelcomeScreen` rendered by `AppRoot` after Phase 01.1 successfully bootstraps the config + daemon. Two bracketed actions: `[ ADD PEER NEARBY ]` and `[ RUN SOLO ]`. Picking one persists the choice and transitions to `AppShell` / Dashboard. Three interactions total: name device + role (Phase 01.1 step 1), grant TUN permission (Phase 01.1 step 2), pick a path (this step). Solo-path budget ≤ 30 s.

2. **Route-internet-via-mesh toggle (`ROUTE-01`, `ROUTE-02`)** — a new `RouteTogglePanel` `CliPanel` on the Dashboard, between `IdentityPanel` and `PeerListPanel`. Off by default. When the user clicks `[ TURN ON ]`, the panel expands inline with a three-row pre-flight checklist (interface up, gateway reachable, split-default supported) computed from `Status` in <50 ms, then fires `route.set_split_default({ on: true })`. On success, the panel collapses to a runtime line: `Routing through {gateway-label} (via {first-hop-label})` — never just "on". Action becomes `[ TURN OFF ]`.

3. **Routing view (`ROUTE-03`, `ROUTE-04`)** — a new `⌘3 Routing` tab. The Phase 2 sidebar's reserved `routing (phase 4)` row flips to active, `ActiveScreenId` extends with `"routing"`, and the `routes` row gets shortcut `⌘3`. Layout: the same `RouteTogglePanel` on top (mirrors Dashboard per `UX-PLAN §6c`), then two stacked `CliPanel`s — `ROUTING TABLE` (destination · via · hops · learned_from · age) and `KNOWN GATEWAYS` (short_id · via · hops · score · selected). Selected gateway row gets a leading `◆` glyph + signal-green destination so the eye lands on it. Data sourced from `route.table()` once on tab mount, refetched on every `status.event` of kind `route_on | route_off | gateway_selected | gateway_lost | kill_switch` — daemon-driven, no polling.

4. **Solo-mode actions (`UX-02`)** — `PeerListPanel`'s two action buttons (`[ + Add peer nearby ]` / `[ Invite peer ]`), currently disabled with the `pairing UI lands in phase 4` tooltip, become enabled. `[ + Add peer nearby ]` scrolls focus to the `NearbyPanel` and announces "scanning…" via a status row when the discovered list is empty (the daemon's `peers.subscribe` is already running). `[ Invite peer ]` opens a new right-edge `InvitePeerSheet` (480 px) carrying an honest stub: a copy-able install link to the kernel repo (`https://github.com/Astervia/proximity-internet-mesh`) plus copy `Remote invite RPC ships in v0.6 — for now, send your peer to the install page above and they can pair on the same network.` No fake `pim://invite/abc123…` URL — the brand contract forbids surfaces that lie about what the system can do.

5. **Critical error states (`UX-03`)**:
   - **Kill-switch banner** — a new `KillSwitchBanner` rendered above the active screen content (sibling of `LimitedModeBanner`, both can be visible during transitions but the kill-switch one outranks). Activates when `Status.route_on === true && Status.routes.selected_gateway === null`, i.e. derived state, plus an instant trigger from `status.event { kind: "kill_switch" }`. Headline: `✗ BLOCKING INTERNET — gateway unreachable`. Body: `pim is keeping you off the internet because the routing gateway is gone. Turn off routing to use your normal connection.` Single action: `[ TURN OFF KILL-SWITCH ]` → `route.set_split_default({ on: false })`. Banner vanishes when `route_on` flips false (driven by event).
   - **Handshake-fail peer row variant** — when `peer.state === "failed"` AND the troubleshoot log has a `pair_failed` event, the `PeerRow` adds a second sub-line below the standard row reading: `Couldn't verify this peer · → docs/SECURITY.md §3.2`. The `→ docs/SECURITY.md §3.2` is a button (Tauri `shell.open` on the project's `docs/SECURITY.md` URL — see Decision G). The `PeerDetailSheet`'s failed-event callout gets the same docs link.

6. **Microcopy authority + audit (`UX-08`)** — a new `docs/COPY.md` is created as the single voice contract for the project (aggregates `docs/UX-PLAN.md §7` + `.design/branding/pim/patterns/STYLE.md` voice rules + every Phase 4 string). A new `scripts/audit-copy.mjs` script + `pnpm audit:copy` npm script greps the codebase for user-visible string violations: hard-fails on `!` inside JSX-text strings, hard-fails on a banned-token list (`Add your first peer`, `Welcome to`, `Get started`, `Connecting…!`), soft-warns on hedge words (`maybe`, `please`, `try to`, `we'll`, `kinda`, `should`). The audit runs as part of Phase 4's final verification gate.

7. **`docs/SECURITY.md` (v1 minimal)** — net-new doc, covers transport encryption (X25519, ChaCha20-Poly1305, HKDF-SHA256 named explicitly), peer authentication §3.1 (TOFU vs allow_list), §3.2 handshake failures (the canonical link target for "Couldn't verify this peer"), §4 kill-switch behavior. The file is small; it exists primarily so the link in the peer row is honest.

**Does NOT ship (belongs to other phases):**

- **Real `pim://invite/...` deep-link generation + handler** — there is no `invite.*` RPC in v1 (`docs/RPC.md` §8 method registry has 17 methods, none for invite). Phase 4 ships the honest stub described in (4); the real flow lands when the kernel grows the RPC (v0.6+).
- **Gateway-mode toggle, conntrack gauge, Linux pre-flight** — `GATE-01..04` belong to Phase 5.
- **Menu-bar popover, tray, AppIndicator** — `UX-05/06` Phase 5.
- **Command palette `⌘K`** — `UX-07` Phase 5.
- **System notifications (toasts beyond the existing sonner)** — `UX-04` Phase 5.
- **Identity backup / export / import** — `BACKUP-01/02` deferred.
- **Routing knobs in Settings (`max_hops`, `route_expiry`, `algorithm`)** — Phase 3 D-19 explicitly placeholders the Routing settings section; Phase 4 does NOT add knobs there. The Routing **view** ships in Phase 4; the Routing **settings** section stays a placeholder until a follow-up phase decides what's tunable.

</domain>

<decisions>
## Implementation Decisions

### Onboarding completion (UX-01)

- **D-01:** Add a **`WelcomeScreen`** rendered by `AppRoot` as a third state, sitting between Phase 01.1's `FirstRunScreen` and Phase 2's `App`/`AppShell`. Render priority in `AppRoot`:
  1. `configState.kind === "loading"` → splash
  2. `configState.kind === "missing" && bootstrapped === false` → `<FirstRunScreen />`
  3. `configState.kind === "present" || bootstrapped === true` → check `localStorage["pim-ui.onboarding.completed"]` — if `null/false`, render `<WelcomeScreen />`; if `"true"`, render `<App />`.
  
  This keeps the `FirstRunScreen → bootstrapped=true → AppShell` path Phase 01.1 already established, but inserts the picker as a one-time gate before AppShell. Returning users (config exists) skip directly to AppShell because the localStorage flag was set on a prior session.

- **D-02:** **`WelcomeScreen` layout** (single `CliPanel`, brand-locked, no wizard chrome):
  ```
  █ pim · ready

  ┌─── YOU'RE SET ─────────────────────────────────┐
  │                                                │
  │   Two ways to start.                           │
  │                                                │
  │   [ ADD PEER NEARBY ]                          │
  │   pair with someone in the same room — uses    │
  │   broadcast on your local network.             │
  │                                                │
  │   [ RUN SOLO ]                                 │
  │   skip pairing for now. you can add peers      │
  │   anytime from the dashboard.                  │
  │                                                │
  └────────────────────────────────────────────────┘
  ```
  Two bracketed primary buttons. No "skip" link, no "later" affordance — `[ RUN SOLO ]` IS the skip. Footer omitted; the dashboard exposes both actions anyway.

- **D-03:** **Persistence:** `localStorage["pim-ui.onboarding.completed"] = "true"` set when EITHER button is clicked, BEFORE navigation. `WelcomeScreen` reads the flag on mount; if already `"true"` (e.g. user reloaded), short-circuits to `AppShell` without rendering. No daemon-side flag — this is purely a UI-onboarding concern, not a config-of-the-mesh concern.

- **D-04:** **Action wiring:**
  - `[ RUN SOLO ]` → set flag → call `onComplete()` → AppRoot mounts `<App />` (default screen Dashboard, where `PeerListPanel` already renders zero-peer copy `no peers connected · discovery is active` per Phase 2 D-14).
  - `[ ADD PEER NEARBY ]` → set flag → call `onComplete()` AND set the active screen via `useActiveScreen.setActive("dashboard")` (default anyway), AND fire `window.scrollTo({ top: ref.current.offsetTop })` once the Dashboard mounts so the `NearbyPanel` is in view. The Phase 2 `peers.subscribe` is already running, so discovered peers will populate the panel as the daemon's broadcast scan picks them up — the user simply needs to be looking at the right panel.

- **D-05:** **TUN permission** is already wired into Phase 01.1's bootstrap step (`D-13` step 3 in `01.1-CONTEXT.md`), satisfying the SC1 phrasing "grants TUN permission (with honest one-sentence copy + learn-more link)". Phase 4 does NOT change `TunPermissionModal` copy unless the audit (UX-08) flags it. SC1's "three interactions" maps to: (1) name device + role + Start pim (FirstRunScreen), (2) grant TUN permission (TunPermissionModal), (3) pick path (WelcomeScreen). Three discrete clicks; permission modal is part of the second interaction.

### Solo mode (UX-02)

- **D-06:** **Enable both `PeerListPanel` action buttons.** Remove the `disabled` prop, remove the `pairing UI lands in phase 4` tooltip. Replace `title=` with `aria-label` matching the action.

- **D-07:** **`[ + Add peer nearby ]` behavior** — does NOT open a modal. Instead:
  1. `useActiveScreen.setActive("dashboard")` (no-op if already there).
  2. `requestAnimationFrame(() => nearbyPanelRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }))`.
  3. The Phase 2 `peers.subscribe` is already running — discovered peers populate live. If `discovered.length === 0`, the existing `NearbyPanel` empty-state copy `no devices discovered yet · discovery is active` already states the truth.
  
  This avoids inventing a "scan" RPC the daemon doesn't expose, and keeps the affordance honest: the user is being directed toward the panel where pairing happens, not promised an instant discovery event.

- **D-08:** **`[ Invite peer ]` opens `InvitePeerSheet`** — a new right-edge slide-over reusing the Phase 2 `Sheet` primitive, 480 px wide. Content (verbatim, copy-locked):
  ```
  ┌─── INVITE A REMOTE PEER ─────────────────┐
  │                                          │
  │  Remote invites need an RPC the v1       │
  │  daemon does not yet ship.               │
  │                                          │
  │  For now, send your peer this link to    │
  │  install pim on their device:            │
  │                                          │
  │  github.com/Astervia/proximity-internet- │
  │  mesh                                    │
  │                                          │
  │  [ COPY LINK ]                           │
  │                                          │
  │  Once installed, both devices on the     │
  │  same Wi-Fi can pair via Add peer        │
  │  nearby.                                 │
  │                                          │
  │  Remote invite RPC: planned for v0.6.    │
  │                                          │
  └──────────────────────────────────────────┘
  ```
  - `[ COPY LINK ]` writes the URL to clipboard via the navigator API (Tauri allows it; no plugin needed). On success, the button text flips to `[ COPIED ]` for 2 seconds.
  - This is the **honest version** of `UX-PLAN §Flow 3`. The fake `pim://invite/abc123…` mockup in that flow is invalidated by the absence of the daemon RPC; we follow the brand contract and surface what the system can actually do.

- **D-09:** **Solo-mode does NOT add a "solo" indicator chip** anywhere. The dashboard already shows live status, peers (zero or more), and metrics — this IS the solo experience. Solo is not a separate mode; it is the dashboard with `peers.length === 0` and `route_on === false`. Adding a chip would imply a separate state and contradict `UX-PLAN §1 P5` ("Solo mode is a first-class state" = identical surface, not a labeled mode).

### Route toggle (ROUTE-01, ROUTE-02)

- **D-10:** **`RouteTogglePanel` placement on Dashboard** — a new `CliPanel` inserted in the Dashboard's vertical stack between `IdentityPanel` and `PeerListPanel`. Order becomes:
  1. `IdentityPanel`
  2. **`RouteTogglePanel`** (new, Phase 4)
  3. `PeerListPanel`
  4. `NearbyPanel`
  5. `MetricsPanel`
  
  Keeps the dashboard scannable: identity → routing decision → peers/metrics. The `DaemonToggle` floating-right action stays where it is (above the stack); it controls the daemon process, the route toggle controls a routing knob — different layers, intentionally separate.

- **D-11:** **Three runtime states** for `RouteTogglePanel`:
  - **Off (idle):** `[ TURN ON ROUTING ]` button, status badge `[OFF]`, body line `internet uses your normal connection · not routed through the mesh`.
  - **Pre-flight expanded:** triggered by `[ TURN ON ROUTING ]` click. Body becomes a three-row checklist; button changes to `[ CONFIRM TURN ON ]` / `[ CANCEL ]`. Pre-flight is purely client-derived from `Status` (no RPC) — see D-12.
  - **On (routing):** `[ TURN OFF ROUTING ]` button, status badge `[ON]` (signal green), body line `Routing through {gateway-label} (via {first-hop-label})`. If the gateway has no `label` in the peers list, fall back to `gateway-{short_id}` and `relay-{short_id}` per `UX-PLAN §6a` mockup conventions.

- **D-12:** **Pre-flight checklist** (computed client-side, in <50 ms, from existing `Status`):
  ```
  ┌─── ROUTING ────────────────── [PRE-FLIGHT] ┐
  │  ✓ interface up (pim0)                     │
  │  ✓ gateway reachable (gateway-c · 12ms)    │
  │  ✓ split-default routing supported         │
  │                                            │
  │  [ CONFIRM TURN ON ]   [ CANCEL ]          │
  └────────────────────────────────────────────┘
  ```
  Check derivations:
  - **Interface up:** `status.interface.up === true`. Fail copy: `interface {iface.name} is down · check transport logs`.
  - **Gateway reachable:** `status.routes.selected_gateway !== null` AND a peer with `peer.node_id === selected_gateway` is in `status.peers` with `peer.state in ("active","relayed")`. The latency in the line comes from that peer's `latency_ms`. Fail copy: `no gateway is advertising itself · pair with a gateway-capable peer or run pim on a Linux device`.
  - **Split-default routing supported:** `route.set_split_default` is in `RpcMethodMap` (compile-time guarantee — passes always in v1). Soft check; included in the list for Mira's reassurance, never fails in v1. Fail-state copy reserved for daemon downgrade scenarios: `daemon does not advertise route.set_split_default · upgrade pim-daemon`.
  
  Failing rows render `✗` glyph in destructive, `[ CONFIRM TURN ON ]` is `aria-disabled=true`, `[ CANCEL ]` re-collapses the panel. The user can re-trigger by clicking the toggle again after fixing the underlying issue (e.g. waiting for a gateway to appear).

- **D-13:** **RPC orchestration:**
  - On `[ CONFIRM TURN ON ]` click, set local state `pending=true`, render a `[…]` glyph cursor-blink in the badge slot, call `callDaemon("route.set_split_default", { on: true })`.
  - On success (`{ on: true, via_gateway_id }`): the snapshot's `status.event` will fire `route_on` shortly; the panel reads `snapshot.status.route_on === true` and `snapshot.status.routes.selected_gateway` to render the runtime line. The local `pending` flag clears.
  - On RPC error (any RPC error code): toast via sonner `Couldn't enable routing: {rpc_error.message}` (no exclamation), keep panel in the pre-flight expanded state (don't roll back to idle), surface a `✗ {error.message}` row at the top of the checklist.
  - The toggle panel does NOT optimistically transition — it waits for either `route_on` event or an explicit RPC success before showing the on state. Phase 1's reactive contract: snapshot is source of truth.

- **D-14:** **Runtime "Routing through X (via Y)" line assembly:**
  - `gateway-label`: lookup `status.peers.find(p => p.node_id === selected_gateway)`. If `peer.label` is set, use it; else use `gateway-{short_id}` (8-char prefix). If no peer record exists (selected gateway is multi-hop and not in our peer list), use `gateway-{short_id}` from the route table entry (`learned_from`).
  - `first-hop-label`: lookup the route entry where `destination === "internet"` or matches the gateway, take its `via` field, find that peer in `status.peers`, render `peer.label ?? "relay-{short_id}"`. If `via === selected_gateway` (gateway is direct), render `Routing through {gateway-label}` (no parenthetical).
  - Implementation: a pure function `formatRouteLine(status: Status, routeTable: RouteTableResult | null): string` in `src/lib/routing.ts`. Tested via vitest pure-function tests.

- **D-15:** **Dashboard ↔ Routing screen sharing:** the `RouteTogglePanel` is rendered on BOTH the Dashboard and the Routing screen (top of the Routing tab). It is the **same component instance** of the panel, importing the same hooks; the runtime state is therefore identical because it derives from the same `useDaemonState` snapshot. No prop drilling, no duplication.

### Routing screen (ROUTE-03, ROUTE-04)

- **D-16:** **`ActiveScreenId` extension:** `"dashboard" | "peers" | "logs"` becomes `"dashboard" | "peers" | "routing" | "logs"`. The `Sidebar`'s `NAV` list gets a new entry `{ id: "routing", label: "routing", shortcut: "⌘3" }` inserted between `peers (⌘2)` and `logs (⌘5)`. The `RESERVED` list drops `routing` (it's no longer reserved). The `AppShell` keyboard handler's `⌘3 → setActive("routing")` route gets enabled. Every other reserved row stays as-is (`gateway (phase 5)`, `settings (phase 3)`).

  Wait: settings is Phase 3, currently in flight, and the previous CONTEXT says Phase 3 ships `⌘6 Settings`. Defer that wiring to Phase 3's plan; Phase 4 only flips the `routing` row — does NOT touch the settings row.

- **D-17:** **`RouteScreen` layout** (single column, three stacked panels):
  ```
  ┌─ RouteTogglePanel (same component as Dashboard) ─┐

  ┌─ ROUTING TABLE ────────────────────── [N ROUTES] ┐
  │ destination     via            hops  learned_from age
  │ ─────────────── ─────────────── ───── ──────────── ───
  │ internet        relay-b         2     gateway-c   123ms
  │ 10.77.0.0/24    (direct)        1     —           5s
  │ ◆ 10.77.0.1/32  gateway-c       1     gateway-c   1m
  └──────────────────────────────────────────────────┘

  ┌─ KNOWN GATEWAYS ──────────────── [M GATEWAYS] ┐
  │ short_id    via       hops    score    selected
  │ ─────────── ───────── ─────── ──────── ────────
  │ ◆ a3c2…7f8e relay-b   2       0.87     selected
  │   c1d4…9b2a (direct)  1       0.62
  └──────────────────────────────────────────────┘
  ```
  - Selected gateway row: leading `◆` glyph (signal-green), destination/short_id text in `text-primary`. Other rows stay `text-foreground`.
  - Empty state for ROUTING TABLE: `no routes yet · waiting for advertisements`. For KNOWN GATEWAYS: `no gateways known · pair with a gateway-capable peer or run pim on a Linux device`.
  - Both panels render a `[STALE]` badge when `useDaemonState.snapshot.state !== "running"` — same convention as Dashboard panels' `D-30` limited-mode dim.

- **D-18:** **`useRouteTable` hook:**
  ```typescript
  // src/hooks/use-route-table.ts
  export interface UseRouteTableResult {
    table: RouteTableResult | null;  // null until first fetch resolves
    loading: boolean;
    error: RpcError | null;
    refetch: () => Promise<void>;
  }
  export function useRouteTable(): UseRouteTableResult { ... }
  ```
  Behavior:
  - On mount, calls `callDaemon("route.table", null)` once.
  - Registers a fan-out handler on `useDaemonState`'s W1 bus for `status.event` of kinds `route_on | route_off | gateway_selected | gateway_lost | kill_switch`. On any of those, refetches `route.table` (no debounce — these events are low-volume).
  - Subscribes only while there is at least one consumer mounted (refcount + cleanup), mirroring `usePeerTroubleshootLog`'s pattern.
  - `error` carries the last RPC error if `route.table` fails; UI renders an inline `couldn't load routes · {message}` row and a `[ retry ]` button that calls `refetch()`.
  - W1 invariant preserved: zero new `listen(` calls.

- **D-19:** **Refetch policy excludes `peers.event`** intentionally — peer connect/disconnect doesn't change the routing table from the daemon's perspective until route advertisements catch up, and those produce `gateway_selected/lost` or `route_on/off`. Refetching on every peer flap would thrash. If telemetry shows the table goes stale, add `peers.event { kind: "state_changed" }` to the refetch trigger list in a follow-up — not in v1.

- **D-20:** **No polling fallback.** If the daemon is buggy and never emits a relevant `status.event` after a route table change, the user can hit the `[ refresh ]` button (always rendered, top-right of `ROUTING TABLE` panel header) to force a `refetch()`. This is the documented escape hatch; it preserves the daemon-driven invariant for the happy path.

### Critical error states (UX-03)

- **D-21:** **`KillSwitchBanner` placement:** rendered as a sibling of `LimitedModeBanner`, inside the `AppShell` `<main>` content area, **above** the active screen's content but **below** the sidebar. Renders only when:
  - `snapshot.status !== null` AND
  - `snapshot.status.route_on === true` AND
  - `snapshot.status.routes.selected_gateway === null`
  
  This is a **derived** state from the snapshot — no separate banner-state machine. The `kill_switch` `status.event` (which currently logs and is ignored in `useDaemonState`) is upgraded to write `selected_gateway = null` (already set by `gateway_lost`) and to trigger a one-shot toast `kill-switch active · routing blocked` (sonner) — the banner picks up the derived state on the same render.

- **D-22:** **`KillSwitchBanner` content** (verbatim):
  ```
  ┌─ ✗ BLOCKING INTERNET — gateway unreachable ────────────┐
  │                                                        │
  │  pim is keeping you off the internet because the       │
  │  routing gateway is gone. Turn off routing to use      │
  │  your normal connection.                               │
  │                                                        │
  │  [ TURN OFF KILL-SWITCH ]                              │
  │                                                        │
  └────────────────────────────────────────────────────────┘
  ```
  - Border-left 2px destructive (matches Phase 1 `LimitedModeBanner` destructive variant).
  - `[ TURN OFF KILL-SWITCH ]` calls `callDaemon("route.set_split_default", { on: false })`. Pending state shows `[…]` cursor-blink. On success, `route_off` event fires, banner derived-condition turns false, banner unmounts cleanly. On error, toast `couldn't turn off routing: {message}`, button re-enables.
  - **Not** dismissible via close-button. The user MUST act (turn off routing) or fix the gateway problem (a peer reconnects, daemon re-selects). A dismiss button would let the user hide the truth — `UX-PLAN §1 P1` forbids it.
  - **Not** a modal overlay. Modal would block legitimate Mira workflows (read logs, read routing table to debug). Banner-style preserves the daemon-is-source-of-truth viewing while the action is one click away.

- **D-23:** **`useDaemonState`'s `kill_switch` handler upgrade:** replace the `console.info` no-op (line 231-234) with an explicit snapshot mutation that ensures `status.routes.selected_gateway = null` (defensive — `gateway_lost` should have done this, but the daemon may emit `kill_switch` without a preceding `gateway_lost`). Also fire a one-shot toast via sonner `kill-switch active · routing blocked` (no exclamation). The W1 invariant is preserved (no new listener; this is the existing fan-out target).

- **D-24:** **Handshake-fail peer row variant** (`PeerRow` extension):
  - When `peer.state === "failed"`, the row's standard line stays unchanged; a second sub-line appears below it inside the same `<button>` row:
    ```
    {short_id}  {label}  {mesh_ip}  via {transport}  ✗ failed  {hops}  {latency}  {last_seen}s
    └─ Couldn't verify this peer · → docs/SECURITY.md §3.2
    ```
  - The `→ docs/SECURITY.md §3.2` is rendered as a nested `<button>` (NOT a link) that calls Tauri `shell.open("https://github.com/Astervia/proximity-internet-mesh/blob/main/docs/SECURITY.md#32-handshake-failures")` — `shell.open` is the Phase 1 convention for external links (`PROJECT.md` "Window-first macOS"). Stop event propagation so the row's primary click (open Peer Detail) doesn't fire.
  - The "Couldn't verify this peer" copy is locked verbatim — `UX-PLAN §7` table row "Handshake fail | Couldn't verify this peer | Noise handshake rejection".
  - Implementation: a small helper `failedPeerSubline(peer: PeerSummary)` returning either the JSX fragment or null, called from `PeerRow`. Adds zero coupling to the troubleshoot-log buffer; the failed-state copy is universal regardless of reason.

- **D-25:** **`PeerDetailSheet` failed-event callout** (existing) gets the same docs link appended below the reason line, identical Tauri `shell.open` target. The detail sheet's troubleshoot log already shows the daemon's reason string; the docs link is the resolution affordance, not a re-explanation.

### Microcopy authority + audit (UX-08)

- **D-26:** **Create `docs/COPY.md`** as the single voice-contract authority. Structure:
  ```markdown
  # PIM-UI · Copy & Voice Contract

  > Audit target for Phase 4+. Every user-visible string must conform.
  > Source: aggregates `docs/UX-PLAN.md §7` + `.design/branding/pim/patterns/STYLE.md`.

  ## 1. Hard rules
  - Declarative, present tense, no hedges.
  - No exclamation marks anywhere in user-visible strings.
  - Name crypto primitives explicitly on first use (X25519, ChaCha20-Poly1305, HKDF-SHA256).
  - Errors name the failure and point to a docs section.
  - Lowercase wordmark `pim`, never uppercase.

  ## 2. Aria/Mira lexicon
  | Surface | Aria-copy | Mira annotation | Banned |
  |---|---|---|---|
  | TUN interface | "virtual network connection" | "(TUN/TAP interface)" | "TUN" alone, "VPN tunnel" |
  | Mesh IP | "your address on the mesh" | "(mesh_ip)" | "mesh_ip" alone |
  | Gateway | "a device sharing its internet" | "(NAT-egress gateway)" | "internet shareer" |
  | Relay | "a device passing traffic" | "(L3 relay)" | "relay" without explanation |
  | Route-on | "Route internet via mesh" | "(split-default routing)" | "VPN on" |
  | Handshake fail | "Couldn't verify this peer" | "(Noise handshake rejection)" | "Pairing rejected!" |
  | Conntrack exhausted | "Too many connections through your gateway" | "(conntrack table full)" | "conntrack full" |
  | Daemon stopped | "pim is stopped" | "(pim-daemon process exited)" | "daemon dead", "pim crashed" |
  | Kill-switch active | "Blocking internet — gateway unreachable" | "(route-on with selected_gateway=null)" | "Internet down!" |
  | Solo state | "no peers connected · discovery is active" | "(zero-peer ready state)" | "Add your first peer", "Welcome!" |

  ## 3. Banned phrases
  - "Add your first peer"
  - "Welcome to pim"
  - "Get started"
  - "Connecting…!"
  - "Oops"
  - "Whoops"
  - any string ending in `!`

  ## 4. Soft warnings (style review)
  - "maybe", "please", "try to", "we'll", "kinda", "should"

  ## 5. Brand glyphs (Unicode)
  - ◆ active
  - ◈ relayed
  - ○ connecting
  - ✗ failed / blocked
  - ◐ in-progress (cursor-blink)
  - █ wordmark prefix
  - · separator (U+00B7)
  - ─ ┌ ┐ └ ┘ ├ ┤ ▶ box-drawing only

  ## 6. Components — locked strings
  ### LimitedModeBanner
  - Headline: `LIMITED MODE` / `DAEMON ERROR` / `STARTING DAEMON…` / `RECONNECTING…` / `DAEMON STOPPED UNEXPECTEDLY`
  - Body (each variant verbatim from existing source — see src/components/brand/limited-mode-banner.tsx)

  ### KillSwitchBanner (Phase 4)
  - Headline: `✗ BLOCKING INTERNET — gateway unreachable`
  - Body: `pim is keeping you off the internet because the routing gateway is gone. Turn off routing to use your normal connection.`
  - Action: `[ TURN OFF KILL-SWITCH ]`

  ### RouteTogglePanel (Phase 4)
  - Off body: `internet uses your normal connection · not routed through the mesh`
  - On body template: `Routing through {gateway-label} (via {first-hop-label})`
  - On body (gateway is direct): `Routing through {gateway-label}`
  - Pre-flight checks (Phase 4 D-12 verbatim): `interface up ({iface.name})`, `gateway reachable ({label} · {latency}ms)`, `split-default routing supported`
  - Pre-flight failures: `interface {iface.name} is down · check transport logs`, `no gateway is advertising itself · pair with a gateway-capable peer or run pim on a Linux device`, `daemon does not advertise route.set_split_default · upgrade pim-daemon`

  ### WelcomeScreen (Phase 4)
  - Title: `█ pim · ready`
  - Section: `YOU'RE SET`
  - Subtitle: `Two ways to start.`
  - Action 1 description: `pair with someone in the same room — uses broadcast on your local network.`
  - Action 2 description: `skip pairing for now. you can add peers anytime from the dashboard.`

  ### InvitePeerSheet (Phase 4)
  - Title: `INVITE A REMOTE PEER`
  - Body: `Remote invites need an RPC the v1 daemon does not yet ship.\n\nFor now, send your peer this link to install pim on their device:\n\ngithub.com/Astervia/proximity-internet-mesh\n\n[ COPY LINK ]\n\nOnce installed, both devices on the same Wi-Fi can pair via Add peer nearby.\n\nRemote invite RPC: planned for v0.6.`
  - Copied state: `[ COPIED ]` for 2 seconds, then revert.

  ### PeerRow handshake-fail sub-line (Phase 4)
  - `Couldn't verify this peer · → docs/SECURITY.md §3.2`
  ```
  
  This file is the **audit target** for the script in D-27.

- **D-27:** **`scripts/audit-copy.mjs`** — Node ESM script (no new dep), runs as `pnpm audit:copy`. Implementation outline:
  ```javascript
  // Walk src/ for *.tsx and *.ts.
  // For each file, parse to find:
  //   1. JSX text children (between > and < or in {"..."} expressions inside JSX).
  //   2. `aria-label`, `title`, `placeholder`, `alt` prop string values.
  //   3. Strings inside Button children, AlertDialogTitle/Description, SheetTitle/Description.
  //   4. String literals in a hardcoded list of "user-visible" identifiers
  //      (HEADLINE, BODY, COPY, LABEL when they appear in /copy*|*messages*|*strings*/ files).
  //
  // For each captured string:
  //   - HARD FAIL if contains "!" anywhere.
  //   - HARD FAIL if matches any banned phrase from docs/COPY.md §3.
  //   - SOFT WARN if contains soft-warning words from §4.
  //
  // Produces a stdout report grouped by file:line with violations and exits 1 on any HARD FAIL.
  ```
  Use a regex-based scanner first (heuristic, fast) backed by Babel parser only if regex misses cases — start regex-only; upgrade to AST if false-negatives appear during phase-4 verification. The bang-free policy is the strongest signal; almost every other check is verifiable mechanically because the codebase already enforces `=== false`/`=== null` in conditionals.

- **D-28:** **Audit integration:**
  - Add `pnpm audit:copy` script to `package.json`.
  - Add an acceptance criterion to the final Phase 4 plan that runs `pnpm audit:copy` and grep-validates exit code 0.
  - DO NOT wire into `pnpm build` (yet). The audit is a phase-end gate, not a per-build gate. A future phase can promote it to CI.

### docs/SECURITY.md (new)

- **D-29:** **Create `docs/SECURITY.md`** with sections sufficient to back the link:
  ```markdown
  # pim-ui · Security model

  > v1 minimal. Aggregates the security-relevant invariants from
  > kernel docs/PROTOCOL.md and the pim-daemon source. Updated as
  > capabilities expand.

  ## 1. Threat model (v1 desktop)
  - Local Unix socket only — no remote daemon attack surface in v1.
  - Trusts the OS user — pim-daemon runs as the desktop user, has no
    privilege escalation.
  - Does NOT defend against a malicious peer who has already obtained
    your identity key (key compromise = mesh compromise).

  ## 2. Transport encryption
  - Noise Protocol Framework — IK pattern.
  - X25519 for static + ephemeral key exchange.
  - ChaCha20-Poly1305 for AEAD encryption of every datagram.
  - HKDF-SHA256 for key derivation.
  - No plaintext mode. No optional encryption knob.

  ## 3. Peer authentication
  ### 3.1 Trust models
  - **Trust-on-first-use (TOFU)** — default. The first time a peer is
    seen, its node_id is recorded. Subsequent connections must match.
  - **allow_list** — only peers in the configured `[trust] allow_list`
    can pair. Strictest mode.
  - **allow_all** — every peer is trusted. Use only for closed networks.

  ### 3.2 Handshake failures
  When a peer pair fails (`pair_failed` event), the daemon emits a
  reason string. Common reasons:
  - **untrusted peer ID** — the peer's announced node_id is not in
    your allow_list, or TOFU detected a node_id change for a known
    address.
  - **noise handshake rejected** — cryptographic verification failed.
    Causes: typo in the peer's address, daemon version mismatch,
    impersonation attempt.
  - **timeout** — the peer didn't respond within the handshake budget
    (5 s default).

  **Resolution path:**
  1. Read the peer's actual node_id from their `pim status` output.
  2. Compare against the value your peer row shows.
  3. If they match: re-pair from a clean slate (`pim peers forget {short_id}`
     on the rejecting side).
  4. If they don't match: STOP — investigate before re-pairing. A node_id
     mismatch is the cryptographic signal of a man-in-the-middle attempt.

  ## 4. Kill-switch behavior
  When `Route internet via mesh` is on AND every known gateway is lost,
  pim's kill-switch engages: split-default routes stay installed but no
  egress is reachable, blocking internet rather than silently bypassing
  the mesh. The dashboard surfaces this via the BLOCKING INTERNET banner.
  Turning routing off (`route.set_split_default(on=false)`) restores
  normal OS routing.

  ## 5. What pim does NOT do
  - No identity backup (intentional — your key file is your identity).
  - No reputation scores, rate limiting, or onion routing.
  - No traffic obfuscation — the daemon does not pad packets.
  ```
  
  Phase 4 ships this as a documentation deliverable, not a marketing piece. The link target `#32-handshake-failures` is GitHub's auto-anchor for `### 3.2 Handshake failures`.

### Snapshot + hook extensions

- **D-30:** **No new fields on `DaemonSnapshot`.** Every Phase 4 surface derives its state from existing snapshot fields:
  - `routeOn` derived from `snapshot.status?.route_on`
  - `selectedGatewayId` from `snapshot.status?.routes.selected_gateway`
  - `killSwitchActive` from `routeOn === true && selectedGatewayId === null`
  
  Selectors live in `src/hooks/use-routing.ts` (new) — three exported hooks: `useRouteOn(): boolean`, `useSelectedGateway(): { id: string | null; peer: PeerSummary | null }`, `useKillSwitch(): boolean`. Each is a thin `useDaemonState` selector. No subscription churn; same pattern as `useStatus`/`usePeers`/`useDiscovered`.

- **D-31:** **`useDaemonState` `kill_switch` handler upgrade** is the ONE surgical edit to `use-daemon-state.ts`. Replace lines 231-234 (the `console.info` no-op) with:
  ```typescript
  case "kill_switch": {
    // Defensive: ensure selected_gateway is null (gateway_lost should
    // have run, but the daemon may emit kill_switch standalone).
    next.routes = { ...current.routes, selected_gateway: null };
    // One-shot toast — sonner Toaster is mounted at AppShell root
    // (Phase 2 02-06). Keeps the kill-switch arrival visible even if
    // the user is on a different screen than KillSwitchBanner.
    void toast.error("kill-switch active · routing blocked", { duration: 6000 });
    break;
  }
  ```
  Adds a sonner import from existing dep. W1 invariant preserved (no new listener).

- **D-32:** **No new `route.event` channel** because the daemon does not emit one in v1. The W1 contract is `grep -c 'listen(' src/lib/rpc.ts === 0` and `grep -c 'listen(' src/hooks/use-daemon-state.ts === 2`. Phase 4 must NOT add new `listen(` calls anywhere — `useRouteTable` joins the existing fan-out for `status.event` exclusively.

### File layout

- **D-33:** **New files (all under `src/`):**
  - `src/screens/welcome.tsx` — `WelcomeScreen` component
  - `src/screens/routing.tsx` — `RouteScreen` (the `⌘3` tab)
  - `src/components/routing/route-toggle-panel.tsx`
  - `src/components/routing/route-table-panel.tsx`
  - `src/components/routing/known-gateways-panel.tsx`
  - `src/components/brand/kill-switch-banner.tsx`
  - `src/components/brand/invite-peer-sheet.tsx`
  - `src/hooks/use-route-table.ts`
  - `src/hooks/use-routing.ts` — selector hooks (D-30)
  - `src/lib/routing.ts` — `formatRouteLine` + pre-flight derivation helpers
  - `src/lib/copy.ts` — exported constants for every locked Phase 4 string (single import target for the audit script + components)
  - `src/lib/copy.test.ts` — compile-only test pinning the locked-string identifiers exist
  - `src/lib/routing.test.ts` — unit tests for `formatRouteLine` and pre-flight derivations
  - `src/hooks/use-route-table.test.ts` — unit tests for the refetch trigger logic
  - `scripts/audit-copy.mjs`
  - `docs/COPY.md`
  - `docs/SECURITY.md`

- **D-34:** **Edited files (minimal surface):**
  - `src/app-root.tsx` — add WelcomeScreen state branch (D-01)
  - `src/screens/dashboard.tsx` — insert `<RouteTogglePanel />` between Identity and PeerList; add ref + scroll wire for `[ Add peer nearby ]`; pass `onInviteClick` prop to `<PeerListPanel />`
  - `src/components/peers/peer-list-panel.tsx` — enable both action buttons; accept `onAddPeerNearby` and `onInvitePeer` props (no longer `disabled`)
  - `src/components/peers/peer-row.tsx` — add the failed-state sub-line (D-24)
  - `src/components/peers/peer-detail-sheet.tsx` — append docs link to failed-event callout (D-25)
  - `src/components/shell/sidebar.tsx` — flip `routing` from RESERVED to active NAV row (D-16)
  - `src/components/shell/active-screen.tsx` — render `<RouteScreen />` when `active === "routing"`
  - `src/components/shell/app-shell.tsx` — add `KillSwitchBanner` slot above active screen content; wire `⌘3` keyboard shortcut
  - `src/hooks/use-active-screen.ts` — extend `ActiveScreenId` union with `"routing"`
  - `src/hooks/use-daemon-state.ts` — `kill_switch` handler upgrade (D-31)
  - `package.json` — add `audit:copy` script

- **D-35:** **Untouched (DO NOT modify):**
  - Phase 1 RPC/sidecar code (`src-tauri/src/`) — Phase 4 adds no new Tauri commands or Rust modules
  - `src/lib/rpc-types.ts` — every type Phase 4 needs (`RouteTableResult`, `KnownGateway`, `RouteEntry`, `RouteSetSplitDefaultParams/Result`, `StatusEventKind` including `kill_switch`) is already defined
  - `src/lib/rpc.ts` — `callDaemon` already supports the route methods via the `RpcMethodMap`
  - `src/components/brand/limited-mode-banner.tsx` — Phase 4's KillSwitchBanner is a separate component, not a banner-variant
  - Phase 2 dashboard panels (`identity-panel`, `metrics-panel`, `nearby-panel`, `pair-approval-modal`) — unchanged
  - Phase 2 logs subsystem — unchanged
  - Phase 01.1 first-run + bootstrap logic — unchanged

### Acceptance gates carried into the plan

- **D-36:** Every Phase 4 plan must include the following grep-based acceptance gates (extending Phase 2 D-policies):
  - `grep -rE '\\!' src/components/routing/ src/screens/welcome.tsx src/screens/routing.tsx src/components/brand/kill-switch-banner.tsx src/components/brand/invite-peer-sheet.tsx src/lib/copy.ts | grep -v '!==' | grep -v '!=' | wc -l` returns 0 (no exclamation marks in new files; bang-free conditionals via `=== false` only)
  - `grep -c 'listen(' src/lib/rpc.ts` returns 0 (W1)
  - `grep -c 'listen(' src/hooks/use-daemon-state.ts` returns 2 (W1)
  - `grep -rE 'rounded-(sm|md|lg|xl|2xl|3xl|full)' src/components/routing/ src/screens/welcome.tsx src/screens/routing.tsx src/components/brand/kill-switch-banner.tsx src/components/brand/invite-peer-sheet.tsx | wc -l` returns 0
  - `grep -rE '\\bgradient' src/components/routing/ src/screens/welcome.tsx src/screens/routing.tsx src/components/brand/kill-switch-banner.tsx src/components/brand/invite-peer-sheet.tsx | wc -l` returns 0
  - `pnpm typecheck` exits 0
  - `pnpm test` (when introduced) passes
  - `pnpm audit:copy` exits 0
  - `pnpm build` (Vite) exits 0

### Claude's Discretion

The following are not locked — the planner / executor may pick any reasonable implementation:

- Exact Tailwind class tuning for new components (RouteTogglePanel, RouteScreen, KillSwitchBanner, WelcomeScreen, InvitePeerSheet) within brand tokens; padding, gaps, exact spacing.
- Whether `formatRouteLine` returns a single string or a structured `{ gateway: string; via: string | null }` for richer JSX rendering — pick whichever keeps the call site simplest.
- Animation choices: brand demands instant digital response (`duration: 100ms, easing: linear`). New panel reveals can fade in 100ms or render instantly; pre-flight checklist row reveal is permitted but not required.
- Whether `useRouteTable`'s refetch is debounced to coalesce burst events; default to no debounce (events are low-volume), add only if testing reveals thrash.
- Implementation of the `audit-copy.mjs` scanner: regex-only is acceptable for v1; upgrade to Babel AST only if false-negatives surface during the audit pass.
- Whether the WelcomeScreen "scanning…" hint on `[ + Add peer nearby ]` re-render is pure CSS or a `useState` + `setTimeout(2s)` reset — pick the simpler.
- Test placement: collocate with implementation files (`src/lib/routing.test.ts` next to `routing.ts`) per Phase 1 / Phase 2 convention.
- Whether `docs/SECURITY.md` lives in the repo root or as part of a docs site; ship in repo `docs/` per existing convention (UX-PLAN, kernel-study, creator-brief all live there).
- Sonner toast position for the kill-switch arrival toast — default `top-right` is fine; STYLE.md doesn't lock toast position.
- Whether `RouteScreen`'s `[ refresh ]` button on the Routing Table panel is icon or text — text per brand (`[ refresh ]`); no icons-as-text.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, plan-checker, executor) MUST read these before planning or implementing.**

### Project-level specs

- `.planning/PROJECT.md` — Core value, stakeholder-locked decisions 2026-04-24, constraints, tech stack, "no fake URLs" honest-surface principle
- `.planning/REQUIREMENTS.md` — The 8 Phase-4 requirements (`ROUTE-01..04`, `UX-01`, `UX-02`, `UX-03`, `UX-08`) and their acceptance-criteria phrasing
- `.planning/ROADMAP.md` — Phase 4 goal, 6 success criteria, and the phase boundary against Phase 3 (depends on) and Phase 5
- `.planning/STATE.md` — Roadmap evolution + recent decisions log (Phase 1 + Phase 2 + Phase 3 + Phase 01.1)
- `.planning/phases/01.1-first-run-config-bootstrap/01.1-CONTEXT.md` — Phase 01.1 ships first-run steps 1-2; Phase 4 owns step 3 (D-21+ explicit deferral). `AppRoot` architecture (D-01) extended in this phase by D-01 here.
- `.planning/phases/02-honest-dashboard-peer-surface/02-CONTEXT.md` — Phase 2 W1 single-listener contract, dashboard 4-panel stack, peer row honesty contract, `kill_switch` event placeholder (D-policy carries forward)
- `.planning/phases/03-configuration-peer-management/03-CONTEXT.md` — Phase 3 D-19 explicitly placeholders the Routing settings section; Phase 4 ships the Routing **view** but does NOT extend Settings

### UX & design

- `docs/UX-PLAN.md` §1 (P1 Honest over polished, P2 One UI not two modes, P3 Daemon source of truth, P5 Solo-mode first-class — all non-negotiable)
- `docs/UX-PLAN.md` §3g Routing — what the daemon exposes for routing
- `docs/UX-PLAN.md` §3i Split-default routing — the route-on contract
- `docs/UX-PLAN.md` §4a desktop sidebar IA — `⌘3 Routing` shortcut
- `docs/UX-PLAN.md` §4c shared primitives — CliPanel, KeyValueTable, ActionRow
- `docs/UX-PLAN.md` §6a Dashboard — Route toggle position, runtime line copy "Routing through gateway-c (via relay-b)"
- `docs/UX-PLAN.md` §6c Routing tab — two-section layout authority
- `docs/UX-PLAN.md` §6g Onboarding screens / `§Flow 1` — three-step onboarding spec
- `docs/UX-PLAN.md` §6h Error states — kill-switch banner copy authority
- `docs/UX-PLAN.md` §7 Microcopy — Aria-copy + banned-phrase table (Phase 4's `docs/COPY.md` aggregates this)
- `docs/UX-PLAN.md` §Flow 2 (Add peer nearby) — `[ + Add peer nearby ]` action target
- `docs/UX-PLAN.md` §Flow 3 (Invite remote peer) — superseded for v1 (no invite RPC); honest stub per D-08
- `docs/UX-PLAN.md` §Flow 4 (Route internet through the mesh) — pre-flight checklist authority
- `docs/UX-PLAN.md` §Flow 6 (Troubleshoot) — handshake-fail variant + docs link
- `.design/branding/pim/patterns/STYLE.md` — Brand voice contract (declarative, no exclamation, named crypto), brand glyphs, hard constraints (no rounded, no gradient, no shadow, no white text, no exclamation, no rounded buttons), button bracketed-text pattern, `█ pim` lockup
- `.design/branding/pim/patterns/pim.yml` — Design tokens (color, typography, spacing — sourced via `src/globals.css` inline tokens)

### Kernel / RPC contract

- `proximity-internet-mesh/docs/RPC.md` §5.1 (`status` + `status.event`) — `route_on/off`, `gateway_selected/lost`, `kill_switch` event kinds
- `proximity-internet-mesh/docs/RPC.md` §5.3 (`route.set_split_default`, `route.table`) — the two RPC methods Phase 4 calls
- `proximity-internet-mesh/docs/RPC.md` §8 method registry — verifies no `invite.*` method exists in v1 (D-08 honest stub)
- `docs/research/kernel-study.md` §1.1.4 — `pim route on/off/status` daemon-side semantics
- `docs/research/kernel-study.md` §1.1.6.2/3/5 — `pim debug routes/gateways/route get` reference for route table + known gateways shape (mirrored by `RouteTableResult` in `src/lib/rpc-types.ts`)

### Phase 1/2/01.1 artifacts (REUSED, must not be broken)

- `src/lib/rpc-types.ts` — `Status`, `StatusEvent`, `StatusEventKind` (incl. `kill_switch`), `RouteEntry`, `KnownGateway`, `RouteTableResult`, `RouteSetSplitDefaultParams/Result`, `PeerEvent` with optional `reason` field. Phase 4 adds NO new types here — it only consumes existing ones.
- `src/lib/rpc.ts` — `callDaemon<M>` typed RPC dispatcher; W1 invariant `grep -c 'listen('` returns 0
- `src/lib/daemon-state.ts` — `DaemonSnapshot` shape; no new fields
- `src/hooks/use-daemon-state.ts` — owns the W1 fan-out; `kill_switch` handler upgraded by D-31. `grep -c 'listen('` stays at 2.
- `src/hooks/use-status.ts`, `use-peers.ts`, `use-discovered.ts` — selector pattern Phase 4's `use-routing.ts` mirrors
- `src/components/brand/cli-panel.tsx` — Brand hero primitive — every Phase 4 panel wraps in this
- `src/components/brand/status-indicator.tsx` — `◆ ◈ ○ ✗` glyphs; reused for route table selected-gateway leading glyph
- `src/components/brand/limited-mode-banner.tsx` — Pattern reference for `KillSwitchBanner` (NOT extended; new component); destructive border-left convention
- `src/components/ui/sheet.tsx` — Phase 2 primitive for `InvitePeerSheet`
- `src/components/peers/peer-row.tsx`, `peer-list-panel.tsx`, `peer-detail-sheet.tsx` — extended (D-24, D-06, D-25)
- `src/components/shell/sidebar.tsx`, `app-shell.tsx`, `active-screen.tsx` — sidebar route-row flipped, `⌘3` keyboard shortcut, screen registration (D-16)
- `src/screens/dashboard.tsx` — RouteTogglePanel inserted (D-10)
- `src/app-root.tsx` — WelcomeScreen state branch added (D-01)
- `src/lib/format.ts` — `formatDuration` reused for route-table age column

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`CliPanel`** (`src/components/brand/cli-panel.tsx`) — wraps every new panel (RouteToggle, RouteTable, KnownGateways, KillSwitch, Invite, Welcome).
- **`StatusIndicator`** (`src/components/brand/status-indicator.tsx`) — Unicode glyph by state. Reused for route-table selected-gateway leading `◆`.
- **`Button`** (`src/components/ui/button.tsx`) — bracketed primary/ghost variants. Reused for `[ TURN ON ]`, `[ TURN OFF ]`, `[ ADD PEER NEARBY ]`, `[ RUN SOLO ]`, `[ COPY LINK ]`, `[ TURN OFF KILL-SWITCH ]`.
- **`Sheet`** (`src/components/ui/sheet.tsx`) — Phase 2 brand-overridden primitive. Reused for `InvitePeerSheet`.
- **`Toaster` / `toast`** (sonner, mounted in AppShell, Phase 2 D-31) — reused for kill-switch arrival toast (D-31) and route-toggle RPC error toasts (D-13).
- **`callDaemon<M>`** (`src/lib/rpc.ts`) — typed RPC dispatcher; Phase 4 calls `route.set_split_default` and `route.table` via this.
- **`useDaemonState`** (`src/hooks/use-daemon-state.ts`) — single-source-of-truth snapshot reader; W1 fan-out target for new event-driven refetch (`useRouteTable`).
- **`useStatus`, `usePeers`, `useDiscovered`** (`src/hooks/use-status.ts`, etc.) — selector pattern Phase 4's `use-routing.ts` selectors mirror.
- **`useTunPermission`** (`src/components/brand/tun-permission-modal.tsx`) — already wired to FirstRunScreen step 2; Phase 4 does not change.
- **`PeerListPanel`** (`src/components/peers/peer-list-panel.tsx`) — has the disabled `[ + Add peer nearby ]` / `[ Invite peer ]` buttons; Phase 4 enables them with the props in D-06.
- **`PeerRow`** (`src/components/peers/peer-row.tsx`) — failed-state styling already in place; Phase 4 adds the second sub-line (D-24).
- **`PeerDetailSheet`** (`src/components/peers/peer-detail-sheet.tsx`) — failed-event callout exists; Phase 4 appends the docs link (D-25).
- **`useActiveScreen`** (`src/hooks/use-active-screen.ts`) — module-level atom; Phase 4 extends `ActiveScreenId` with `"routing"` (D-16).
- **`Sidebar`** (`src/components/shell/sidebar.tsx`) — has `routing (phase 4)` in RESERVED list; Phase 4 moves it to NAV with shortcut `⌘3`.
- **`ActiveScreen`** (`src/components/shell/active-screen.tsx`) — switch on active id; Phase 4 adds the `"routing"` case rendering `<RouteScreen />`.
- **`AppShell`** (`src/components/shell/app-shell.tsx`) — keyboard handler; Phase 4 adds `Meta+3 → setActive("routing")`. Banner slot above content gets `<KillSwitchBanner />`.
- **`AppRoot`** (`src/app-root.tsx`) — boot router; Phase 4 inserts `WelcomeScreen` between `FirstRunScreen` and `App` based on localStorage flag (D-01).
- **`FirstRunScreen`** (`src/screens/first-run.tsx`) — Phase 01.1 surface; Phase 4 does NOT modify (TUN permission is already wired).
- **`formatDuration`** (`src/lib/format.ts`) — reused for route-table age column rendering.

### Established Patterns (carried forward)

- **Snake_case on the wire, verbatim in TS:** every field from the daemon keeps its snake_case name. Phase 4 reads `selected_gateway`, `route_on`, `learned_from`, etc. directly.
- **W1 single-listener contract:** `grep -c 'listen(' src/lib/rpc.ts === 0`, `grep -c 'listen(' src/hooks/use-daemon-state.ts === 2`. Phase 4 must NOT add `listen(` calls anywhere.
- **`as const` over `enum`:** no new enums. All discriminated unions stay literal.
- **Tailwind via brand tokens:** `text-primary`, `text-accent`, `text-destructive`, `text-muted-foreground`, `bg-popover`, `border-border` only. No literal palette.
- **No exclamation marks in user-visible strings:** enforced by D-36 grep gate. Bang-free conditionals via `=== false` / `=== null` ternary inversion (`src/screens/first-run.tsx` is the model — every conditional explicit, zero `!`).
- **Shadcn primitives brand-overridden:** any new shadcn install (none expected in Phase 4) gets brand classes wholesale per Phase 2 sheet/select rewrite.
- **Atomic commits per task:** every GSD executor task ends in a single focused commit.
- **Compile-only type tests:** `src/lib/rpc-types.test.ts` model. Phase 4 uses pure-function unit tests for `formatRouteLine`, pre-flight derivation, kill-switch derivation; compile-only types for the new hook surfaces.
- **Daemon-driven reactivity:** any UI state that the daemon owns is read from the snapshot, never cached locally. New `useRouteTable` is the only Phase 4 hook that does its own RPC fetch — and only because `route.table` is not a streamed event.
- **No optimistic UI on RPC actions:** the route toggle waits for the snapshot's `route_on` flip before showing the on state. Phase 1 reactive contract.

### Integration Points

- **`src/app-root.tsx`** — three-state branch (loading / first-run / welcome / app); WelcomeScreen inserted before App (D-01).
- **`src/screens/dashboard.tsx`** — `<RouteTogglePanel />` inserted in the panel stack (D-10); ref + scroll wire for `[ + Add peer nearby ]` (D-07).
- **`src/components/peers/peer-list-panel.tsx`** — buttons enabled, accept `onAddPeerNearby` and `onInvitePeer` props; remove `pairing UI lands in phase 4` tooltip.
- **`src/components/shell/active-screen.tsx`** — register `"routing"` case rendering `<RouteScreen />`.
- **`src/components/shell/sidebar.tsx`** — flip `routing` from RESERVED to NAV; add `⌘3` shortcut.
- **`src/hooks/use-active-screen.ts`** — extend `ActiveScreenId` with `"routing"`.
- **`src/hooks/use-daemon-state.ts`** — `kill_switch` handler upgrade (D-31); imports sonner `toast`.
- **`src/components/shell/app-shell.tsx`** — register `<KillSwitchBanner />` above active screen content; add `Meta+3` keyboard shortcut alongside existing `Meta+1/2/5`.
- **`package.json`** — add `audit:copy` npm script.

### Creative options the architecture enables

- The dashboard ↔ Routing screen toggle sharing (D-15) is enabled by `useDaemonState`'s single-snapshot architecture — both surfaces render from the same source of truth, no prop drilling, no sync state.
- Because `KillSwitchBanner` derives from existing snapshot fields, the banner appears + disappears reactively without any banner-specific state machine. The `kill_switch` event handler upgrade (D-31) is purely defensive.
- The honest invite stub (D-08) is the simplest possible affordance that doesn't lie — and reuses the Phase 2 `Sheet` primitive verbatim.
- The pre-flight checklist (D-12) being client-derived means it always reflects the current snapshot, never goes stale, and updates live as `status.event`s arrive — Mira can watch the rows flip ✗→✓ in real time as a peer reconnects.

</code_context>

<specifics>
## Specific Ideas / References

- **Dashboard panel stack with RouteTogglePanel inserted** (the only structural Dashboard change in Phase 4):
  ```
  [Daemon Toggle ─ floats right]

  ┌─── identity ──────────────────────────── [LIVE] ┐
  │ █ pim · client-a-macbook                  ●     │
  │ mesh: 10.77.0.100/24 · interface pim0 · up · 4h │
  └─────────────────────────────────────────────────┘

  ┌─── ROUTING ────────────────────────────── [OFF] ┐  ← Phase 4 NEW
  │ internet uses your normal connection · not      │
  │ routed through the mesh                         │
  │ [ TURN ON ROUTING ]                             │
  └─────────────────────────────────────────────────┘

  ┌─── peers ────────────────────────── [3 CONNECTED] ┐
  │ … existing Phase 2 peer rows …                    │
  │ [ + ADD PEER NEARBY ]   [ INVITE PEER ]           │  ← Phase 4 ENABLES
  └───────────────────────────────────────────────────┘

  ┌─── nearby — not paired ────────── [N DISCOVERED] ┐
  │ … existing Phase 2 nearby rows …                 │
  └──────────────────────────────────────────────────┘

  ┌─── metrics ─────────────────────────────── [LIVE] ┐
  │ peers 3 · forwarded 4.2 MB / 3,847 pkts · …       │
  └───────────────────────────────────────────────────┘
  ```

- **RouteTogglePanel ON state** (after successful turn-on):
  ```
  ┌─── ROUTING ─────────────────────────────── [ON] ┐
  │ Routing through gateway-c (via relay-b)         │
  │ [ TURN OFF ROUTING ]                            │
  └─────────────────────────────────────────────────┘
  ```

- **KillSwitchBanner** (above active screen content, full width):
  ```
  ╔═ ✗ BLOCKING INTERNET — gateway unreachable ════════════╗
  ║                                                        ║
  ║  pim is keeping you off the internet because the       ║
  ║  routing gateway is gone. Turn off routing to use      ║
  ║  your normal connection.                               ║
  ║                                                        ║
  ║  [ TURN OFF KILL-SWITCH ]                              ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  ```
  (Box-drawing here is illustrative — implementation uses `LimitedModeBanner`'s 1px-border + 2px-destructive-left border pattern, NOT actual `═` box-drawing characters.)

- **RouteScreen** (new `⌘3` tab):
  ```
  [ ROUTE TOGGLE PANEL — same component as Dashboard ]

  ┌─── ROUTING TABLE ───────────────── [3 ROUTES]  [ refresh ] ┐
  │ destination     via         hops  learned_from   age       │
  │ ─────────────── ─────────── ───── ─────────────  ────      │
  │   internet      relay-b     2     gateway-c      123ms     │
  │   10.77.0.0/24  (direct)    1     —              5s        │
  │ ◆ 10.77.0.1/32  gateway-c   1     gateway-c      1m        │
  └────────────────────────────────────────────────────────────┘

  ┌─── KNOWN GATEWAYS ─────────────────────── [2 GATEWAYS] ┐
  │ short_id    via       hops    score    selected         │
  │ ─────────── ───────── ─────── ──────── ────────         │
  │ ◆ a3c2…7f8e relay-b   2       0.87     selected         │
  │   c1d4…9b2a (direct)  1       0.62                      │
  └─────────────────────────────────────────────────────────┘
  ```

- **WelcomeScreen** (post-bootstrap, before AppShell):
  ```
  ┌────────────────────────────────────────┐
  │                                        │
  │  █ pim · ready                         │
  │                                        │
  │  ┌─── YOU'RE SET ────────────────────┐ │
  │  │                                   │ │
  │  │   Two ways to start.              │ │
  │  │                                   │ │
  │  │   [ ADD PEER NEARBY ]             │ │
  │  │   pair with someone in the same   │ │
  │  │   room — uses broadcast on your   │ │
  │  │   local network.                  │ │
  │  │                                   │ │
  │  │   [ RUN SOLO ]                    │ │
  │  │   skip pairing for now. you can   │ │
  │  │   add peers anytime from the      │ │
  │  │   dashboard.                      │ │
  │  │                                   │ │
  │  └───────────────────────────────────┘ │
  │                                        │
  └────────────────────────────────────────┘
  ```

- **Locked Aria-copy strings** (every Phase 4 user-visible string traces back to one of these — see `docs/COPY.md` for the full table):
  - `BLOCKING INTERNET — gateway unreachable`
  - `pim is keeping you off the internet because the routing gateway is gone. Turn off routing to use your normal connection.`
  - `[ TURN OFF KILL-SWITCH ]`
  - `Routing through {gateway-label} (via {first-hop-label})`
  - `internet uses your normal connection · not routed through the mesh`
  - `interface up ({iface.name})`
  - `gateway reachable ({label} · {latency}ms)`
  - `split-default routing supported`
  - `Couldn't verify this peer · → docs/SECURITY.md §3.2`
  - `no routes yet · waiting for advertisements`
  - `no gateways known · pair with a gateway-capable peer or run pim on a Linux device`
  - `Two ways to start.`
  - `pair with someone in the same room — uses broadcast on your local network.`
  - `skip pairing for now. you can add peers anytime from the dashboard.`
  - `Remote invites need an RPC the v1 daemon does not yet ship.`
  - `Remote invite RPC: planned for v0.6.`

- **Verbatim Tauri shell.open URL** for handshake-fail link target: `https://github.com/Astervia/proximity-internet-mesh/blob/main/docs/SECURITY.md#32-handshake-failures` (anchor matches GitHub auto-anchor for `### 3.2 Handshake failures` heading).

</specifics>

<deferred>
## Deferred Ideas

- **Real `pim://invite/...` deep-link generation + handler** — needs an `invite.create()` / `invite.consume()` RPC pair on the daemon side. Tracked for v0.6+ kernel scope. Phase 4 ships honest stub per D-08.
- **Settings → Routing knob section** (max_hops, route_expiry, algorithm) — Phase 3 D-19 placeholders this; a future phase decides what's tunable. Phase 4 does NOT add knobs.
- **`route.table()` polling fallback** — D-20 keeps `[ refresh ]` button as the escape hatch; promote to scheduled poll only if telemetry shows event-driven refetch misses cases.
- **Kill-switch toast position customization** — sonner's default is fine; if the toast competes with other top-right toasts during incident, consider promoting kill-switch to `top-center` in a follow-up.
- **Audit script as a CI pre-commit hook** — Phase 4 wires the script as `pnpm audit:copy`; promotion to CI / pre-commit is a hygiene-phase concern (not v1).
- **Babel AST upgrade for `audit-copy.mjs`** — D-27 keeps regex-only. Promote only if false-negatives surface.
- **Animations on RouteTogglePanel state transitions** — brand allows 100ms linear; Phase 4 ships instant transitions, leaves animation polish for an explicit hardening phase.
- **Onboarding "Show me around" tour** — explicitly out of scope; UX-PLAN P5 forbids tutorial overlays. Solo dashboard is the tour.
- **`localStorage` migration / versioning** — `pim-ui.onboarding.completed` is a single-purpose flag; no migration story needed in v1.
- **Per-peer "trust this peer" action on handshake-fail row** — currently lives in the daemon's `peers.pair({ trust: "persist" })` flow, surfaced through the existing PairApprovalModal. A retry-from-failed-row affordance would need a dedicated flow; defer to a debug/troubleshooting hardening phase.
- **`docs/SECURITY.md` expansion** — v1 minimal. Version 2 adds: threat model under remote daemon TCP-with-TLS scope, audit-trail of trust-state changes, key-rotation guidance.

</deferred>

---

*Phase: 04-routing-onboarding-polish*
*Context gathered: 2026-04-26 — autonomous decision pass per user direction*
