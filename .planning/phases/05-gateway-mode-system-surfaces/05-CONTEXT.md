# Phase 5: Gateway Mode & System Surfaces — Context

**Gathered:** 2026-04-26
**Status:** Ready for planning
**Source:** Research-driven planning per user instruction; see `05-RESEARCH.md`. No `/gsd:discuss-phase` pass — every decision below is anchored either in the locked 2026-04-24 STATE.md decisions, the ROADMAP §Phase 5 success criteria, the REQUIREMENTS.md verbatim wording, the UX-PLAN.md microcopy + IA contract, the STYLE.md hard constraints, or the §13 plan breakdown in 05-RESEARCH.md (refined here, not blindly copied).

<domain>
## Phase Boundary

Phase 5 is the v1 closing phase for Mira: it lights up Linux **gateway mode** with pre-flight + active-state monitoring, ships the macOS / Windows **tray popover** + Linux **AppIndicator menu** + ⌘K **command palette** that exposes every action one keystroke away, and wires the **toast + system-notification policy** that escalates only critical events to the OS notification center. Phase 5 inherits Phase 4's `<RouteInternetToggle />`, kill-switch state machine, and COPY.md voice contract — every Phase-4 dependency is tagged `TBD-PHASE-4-<letter>` per RESEARCH §4 so a later integrator can grep them deterministically. Speculative RPC type additions (`gateway.status`, `gateway.event`) are tagged `TBD-RPC` per RESEARCH §5 because the kernel-repo `docs/RPC.md` push is BLOCKED.

**Ships:**

1. **Gateway tab** wired into the sidebar at `⌘4` (RESEARCH §11a flips the existing reserved row from `RESERVED` → `NAV`); on Linux, renders a pre-flight check list with pass/fail + `detail` + UI-side recovery hint per RESEARCH §10, an enable form with `nat_interface` Select, and (when active) a conntrack ASCII gauge + throughput panel + peer-through-me list (GATE-01, GATE-02, GATE-03).
2. **Honest non-Linux Gateway surface** — macOS / Windows show the verbatim copy `Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay.` (already locked in Phase 01.1 SETUP-02; rendered, not hidden) (GATE-04).
3. **Tray + popover + native menu** — macOS borderless `tray-popover` window, Windows borderless popover (left-click) + native context menu (right-click, subset), Linux AppIndicator native GTK menu (right-click only, per Tauri 2 limitation). Each surface offers status dot + node name + mesh IP + `<RouteInternetToggle />` (TBD-PHASE-4-A) + Add peer nearby (TBD-PHASE-4-G) + Open pim + Quit pim (UX-05, UX-06).
4. **⌘K command palette** — `cmdk@^1.1.1` Dialog mounted at AppShell level, exposing six navigate items + three routing items + three peers items + three gateway items + two logs items per RESEARCH §2f; `keywords` synonym lookup; cmdk default ranking (no recency in v1) (UX-07).
5. **Notification policy** — toasts for non-critical lifecycle events (peer connected, gateway failover, gateway enabled/disabled, conntrack pressure level 1, kill-switch disengage, daemon transitions); OS notifications via `tauri-plugin-notification` only for critical events (kill-switch engage, conntrack saturated, all-gateways-lost). Permission requested lazily on first critical event, not at app launch. Phase 3's `Settings → Notifications` section gets a read-only display of the policy table (UX-04).

**Does NOT ship (belongs to other phases or v2+):**

- Per-event notification preferences toggle (POWER-04, deferred to v0.6+).
- Recency / frecency tracking in the command palette (deferred — Mira's muscle memory is more deterministic than a fuzzy frecency algorithm).
- Multi-monitor popover positioning fix (known Tauri positioner bug per https://github.com/tauri-apps/tauri/issues/7139 — single-monitor only in v1).
- Custom tray icon design pass beyond the brand `█` glyph (assets ship at 16×16 monochrome template image; bigger design pass deferred).
- Kernel-repo `RPC.md` push for `gateway.status` / `gateway.event` — speculative; tagged `TBD-RPC`.
- Any Phase-4 surface (route-internet toggle, kill-switch banner, routing table view, three-step onboarding, COPY.md audit) — Phase 5 stubs Phase-4 integration points with `TBD-PHASE-4-A..G` markers and ships otherwise complete; integration is a Phase-4 follow-up plan.

</domain>

<decisions>
## Implementation Decisions

### Sidebar + IA

- **D-01:** Sidebar `gateway` row flips from `RESERVED` to `NAV` with shortcut hint `⌘4`. Verbatim entry: `{ id: "gateway", label: "gateway", shortcut: "⌘4" }`. The `routing` reserved row is LEFT UNTOUCHED so Phase 4 owns its own flip — Plan 05-01 only touches the gateway entry. (RESEARCH §11a, ROADMAP §Phase 5 SC1.)
- **D-02:** `ActiveScreenId` union extends to `"dashboard" | "peers" | "logs" | "settings" | "gateway"` (4-letter additive change). The `assertNever` exhaustive-check in `active-screen.tsx` automatically forces a `case "gateway":` branch — Plan 05-01 adds it returning `<GatewayScreen />` from `src/screens/gateway.tsx`.
- **D-03:** `AppShell` keyboard handler grows two new branches in addition to the Phase-2/3 set: `case "4":` (mirrors `case "1"/2"/5"/6"`) → `setActive("gateway")`; `case "k":` → toggles `useCommandPalette().open` (Plan 05-05 owns the atom; Plan 05-01 stages the keyboard hook and renders a no-op until 05-05 lands the component). Modifier guard (`if (e.shiftKey || e.altKey) return;`) preserved exactly as Phase 2 D-29.

### Gateway pre-flight UX (Plan 05-02)

- **D-04:** Pre-flight check rows render via `<PreflightCheckRow check={GatewayPreflightCheck} />` with a `<StatusIndicator state={check.ok ? "active" : "failed"} />` (REUSED — no new icon work) followed by a humanized check name from `humanizeCheckName(name)` (a UI-side `Record<string,string>` map keyed on the daemon's snake_case names: `running_on_linux` → `running on linux`, `iptables_present` → `iptables present`, `cap_net_admin` → `CAP_NET_ADMIN available`, `interfaces_detected` → `network interfaces detected`); on failure, append `· {check.detail}` (verbatim daemon string) + `· {recoveryHint(name)}` from a UI-side recovery-hint map (RESEARCH §10a).
- **D-05:** Recovery hints are PLAIN TEXT, not clickable buttons — the user copies the command into their shell. Hints map keyed on check name: `iptables_present → install: sudo apt install iptables`; `cap_net_admin → run pim-daemon as root or grant cap_net_admin: sudo setcap cap_net_admin=ep $(which pim-daemon)`. Other checks have no actionable recovery (omit). Distro-specific (Debian/Ubuntu favored); Arch/Fedora users translate. We do NOT auto-detect distro (out of scope, brand-violating). (RESEARCH §10b.)
- **D-06:** `[ Turn on gateway mode ]` action is rendered ONLY when EVERY `check.ok === true`. No "continue anyway" override; no "skip pre-flight" toggle. (GATE-02 explicit gate, RESEARCH §2a.)
- **D-07:** `nat_interface` Select trigger uses the brand-overridden shadcn `<Select>` (already installed in Phase 2 Plan 02-05) seeded from `GatewayPreflightResult.suggested_nat_interfaces`. The Select renders `( {iface} ▾ )` trigger style mirroring the Phase 2 logs peer-filter pattern. Submit calls `gateway.enable({ nat_interface })`. On reject, surface inline error per Phase 2 D-31 toast pattern.
- **D-08:** `[ Re-run pre-flight ]` button below the check list re-calls `gateway.preflight(null)` — while pending, the previous check list stays visible at `opacity-60` (mirrors Phase 2 D-30 limited-mode dim pattern). No partial render (RESEARCH §10c).
- **D-09:** Pre-flight outcome banner copy: when ANY check fails, render `Pre-flight failed — fix the items above and re-run.` below the `[ Re-run pre-flight ]` button. When all pass, hide the failure banner and render the nat-interface form + enable action. Banner uses `text-muted-foreground` (not destructive — destructive belongs on the per-row `✗` glyph).

### Gateway non-Linux surface (Plan 05-02)

- **D-10:** macOS / Windows Gateway tab renders the SETUP-02 verbatim copy: `Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay.` followed by a continuation paragraph: `Gateway support for macOS and Windows depends on the kernel growing iptables-equivalent NAT — see the kernel repo for status.` followed by a `· platform: {macos|windows}` and `· supported: false` data lines, and a `[ Open kernel repo ]` button that opens https://github.com/Astervia/proximity-internet-mesh in the OS browser via `@tauri-apps/plugin-shell` (already installed). CliPanel `[STATUS]` badge variant: `LINUX-ONLY`. (GATE-04, RESEARCH §2c.)
- **D-11:** Platform detection: read `GatewayPreflightResult.platform` from a one-shot `gateway.preflight(null)` call on mount. The daemon is the source of truth for platform — UI does NOT fall back to `navigator.userAgent` for this surface (in contrast to Phase 01.1's UI-only platform gate). Daemon-as-source-of-truth (P3) wins.

### Gateway active state (Plan 05-03)

- **D-12:** Conntrack ASCII gauge: 32-character bar where each char ≈ 3.125%. Filled char `█` (U+2588 FULL BLOCK), empty char `░` (U+2591 LIGHT SHADE), brackets `[`/`]` ASCII square brackets. Trailing label: `n / max (pct%)` — n + max via `formatCount()` (existing helper from `src/lib/format.ts`), pct as integer floor. Color thresholds on the FILLED portion only: `< 80%` → `text-foreground`; `≥ 80%` → `text-accent` (amber); `≥ 95%` → `text-destructive` (red). At ≥ 95% the parent CliPanel `[STATUS]` badge flips from `[ACTIVE]` to `[NEAR LIMIT]`. Rendered inside `<div role="meter" aria-valuenow={used} aria-valuemin={0} aria-valuemax={max} aria-label="conntrack utilization">`. (RESEARCH §9a.)
- **D-13:** Throughput panel renders two lines: `in {formatBitrate(in_bps)}   out {formatBitrate(out_bps)}` followed by `total {formatDuration(elapsed_s)}    in {formatBytes(in_total_bytes)}    out {formatBytes(out_total_bytes)}`. `formatBitrate(bps)` is a NEW helper appended to `src/lib/format.ts` — `bps < 1024 → '{n} B/s'; < 1024² → '{n.n} KB/s'; < 1024³ → '{n.n} MB/s'; else '{n.n} GB/s'`. (RESEARCH §9b.)
- **D-14:** Peer-through-me list reuses the existing Phase 2 `<PeerRow />` (no new component) filtered by `snapshot.status.peers.filter(p => peers_through_me_ids.includes(p.node_id))`. Empty state copy: `no peers routing through this node yet · advertising 0.0.0.0/0` — non-infantilizing (P5). (RESEARCH §9c.)
- **D-15:** `[ Turn off gateway mode ]` is a single-click action, no confirmation dialog (turning off is recoverable — re-enable, peers re-elect a new gateway). When `peers_through_me > 0`, append inline advisory: `[ Turn off gateway mode ] · {n} peers will be cut over to another gateway` — no modal. (RESEARCH §2b PT-05.)
- **D-16:** `gateway.event` subscription wires through `actions.subscribe('gateway.event', handler)` from `useDaemonState` — same fan-out pattern as `status.event` / `peers.event` / `logs.event`. ZERO new Tauri listeners (W1 invariant). Plan 05-01 extends `RpcEventMap` with the new event; Plan 05-03 uses it. **Fallback** (RESEARCH §5e): if the kernel maintainer rejects `gateway.event`, the active-state hook degrades to 1Hz polling of `gateway.status()` while the Gateway tab is mounted. Polling code path is tagged `TBD-RPC-FALLBACK` so it can be ripped out cleanly when the event lands. Plan 05-03 SHIPS BOTH — the subscription path is the default, polling is a feature-flagged fallback toggled off-by-default; flipping the flag is a one-line change.

### Tray + popover (Plan 05-04)

- **D-17:** Hybrid pattern per RESEARCH §6c: macOS + Windows render a **borderless React window** (Tauri 2 `WebviewWindowBuilder` with `decorations: false, resizable: false, always_on_top: true, skip_taskbar: true, visible: false` + `inner_size(360.0, 280.0)`) positioned via `tauri-plugin-positioner` `Position::TrayCenter`; Linux renders a **native GTK Menu** (Tauri 2 `Menu` API) with disabled `MenuItem`s for status lines + a `CheckMenuItem` for the route-internet toggle. The popover window is built UPFRONT in the `setup` hook (cheap — preserves React state across opens). `show_menu_on_left_click(false)` so Linux's right-click idiom is preserved.
- **D-18:** macOS LSUIElement is **NOT** set (`tauri.conf.json` MUST NOT contain an `LSUIElement` key) — window-first per 2026-04-24 STATE.md decision row 4. Plan 05-04 includes a negative-grep acceptance criterion. (RESEARCH §6c LSUIElement gotcha.)
- **D-19:** Popover content (macOS / Windows) layout, top-down:
  - Row 1: `◆ pim · {node.name}` (status dot via `<StatusIndicator />` reusing `snapshot.status.role`-derived state — `role.includes('gateway') ? "active" : peers.length > 0 ? "active" : "connecting"`)
  - Row 2: `mesh: {mesh_ip}` (sub-row)
  - Separator: `├──`
  - Row 3: `<TBDRouteToggle />` (TBD-PHASE-4-A placeholder — renders `[ Route internet via mesh ]   (phase 4)` until Phase 4 wires the real toggle)
  - Row 4: `useRouteStatusLine()` selector return — TBD-PHASE-4-B; returns `null` until Phase 4 lands; falls back to displaying `egress: {selected_gateway ?? "local"}` from existing `useStatus()`
  - Separator: `├──`
  - Row 5: `+ Add peer nearby   ⌘⇧N` (TBD-PHASE-4-G — clicking emits Tauri event `pim://open-add-peer` that the main window listens for and routes to the existing Phase 2 Nearby panel)
  - Row 6: `Open pim   ⌘O` (calls `getMainWindow().show() + setFocus()`)
  - Separator: `├──`
  - Row 7: `Quit pim   ⌘Q` (calls `app.exit(0)`)
- **D-20:** Linux native menu collapses Row 3 + Row 4 into TWO MenuItems: a `CheckMenuItem` for the route toggle and a disabled MenuItem for the status line (e.g. `Routing through gateway-c`). Multi-line popover content does not render in a GTK Menu — this is the explicit OS-idiom-first trade per P4 (UX-PLAN §1) and PT-06.
- **D-21:** Popover lifecycle: in the popover's React tree, `useEffect` registers `getCurrentWebviewWindow().onFocusChanged(({payload: focused}) => focused === false && win.hide())` — hides on blur. Each window has its own `useDaemonState` listener (per-window, NOT per-app) — W1 contract is *per-window*, not *per-app*. The popover window has 2 Tauri listeners (mirror of main); main window has 2; total = 4 across 2 windows. Plan 05-04 acceptance includes `grep -c "listen(" src/components/tray-popover/` returning 0 (the popover's `useDaemonState` re-uses the existing module via per-window mount, no new direct `listen(...)` calls).
- **D-22:** Tray icon visual: brand `█` glyph rendered as 16×16 monochrome PNG template image at `src-tauri/icons/tray.png` (NEW or repurpose existing `app-icon.png` resized). macOS auto-tints template images. Windows uses the same asset. Linux AppIndicator uses the same asset. Phase 5 ships the asset; finer design pass deferred.
- **D-23:** Popover capability scoping per RESEARCH §6d: NEW file `src-tauri/capabilities/tray-popover.json` with `windows: ["tray-popover"]`, permissions `core:default`, `core:window:allow-hide`, `core:window:allow-show`, `core:window:allow-set-focus`. Main window's `default.json` gains `notification:default` + `positioner:default`.

### Command palette (Plan 05-05)

- **D-24:** `cmdk@^1.1.1` chosen over `kbar` / `react-cmdk` / hand-rolled per RESEARCH §7a — 5.2KB gz, fully unstyled, Radix Dialog under the hood (already a Phase-2 dep). Rendered as `<Command.Dialog>` with `loop` prop for keyboard-nav wraparound.
- **D-25:** Brand-override CSS appended to `src/globals.css` per RESEARCH §7a: `[cmdk-root]` (bg `var(--color-popover)`, border `1px solid var(--color-border)`, `border-radius: 0`, `font-family: var(--font-mono)`); `[cmdk-input]` (transparent bg, no border-radius, `var(--font-code)`, prompt-style); `[cmdk-item]` (`text-transform: lowercase; letter-spacing: 0.05em`); `[cmdk-item][data-selected="true"]` highlight uses `var(--color-popover)` + `var(--color-primary)`; `[cmdk-group-heading]` UPPERCASE + `letter-spacing: 0.1em`; `[cmdk-empty]` muted. ZERO border-radius, ZERO shadows, ZERO gradients, ZERO hex literals.
- **D-26:** Action registry — single source of truth at `src/lib/command-palette/actions.ts` exporting `PALETTE_ACTIONS: readonly PaletteAction[]` where:
  ```typescript
  type PaletteAction = {
    id: string;
    group: "navigate" | "routing" | "peers" | "gateway" | "logs";
    label: string;        // visible, lowercase, brand voice
    shortcut?: string;    // optional, right-aligned in the row (e.g. "⌘1")
    keywords?: string[];  // synonyms for cmdk filtering
    run: (ctx: PaletteContext) => void;
  };
  ```
  Registration order LOCKED for cmdk default-ranking determinism (RESEARCH §7b): `navigate` group FIRST (6 items), then `routing` (3), `peers` (3), `gateway` (3), `logs` (2). Total: **17 items**. `grep -c "Command.Item" src/components/command-palette.tsx` returns ≥ 17 (acceptance criterion per RESEARCH §12).
- **D-27:** Action label copy per RESEARCH §2f, verbatim (lowercase, brand voice, no exclamation):
  - navigate: `go to dashboard ⌘1`, `go to peers ⌘2`, `go to routing ⌘3`, `go to gateway ⌘4`, `go to logs ⌘5`, `go to settings ⌘,`
  - routing: `route on  (turn on split-default routing)`, `route off (turn off split-default routing)`, `show routing table`
  - peers: `peers list`, `add peer nearby`, `invite peer`
  - gateway: `gateway preflight`, `gateway enable (linux)`, `gateway disable (linux)`
  - logs: `logs subscribe (open logs tab)`, `export debug snapshot`
- **D-28:** Module-level atom for palette `open` state (mirrors `useActiveScreen` / `useDaemonState` pattern) at `src/lib/command-palette/state.ts`. Hook `useCommandPalette()` exposes `{ open, setOpen, toggle }` (RESEARCH §7d). Mounted ONCE at AppShell level next to `<Toaster />` and `<SubscriptionErrorToast />`.
- **D-29:** Palette `[esc]` close, `[enter]` activate, `↑/↓` navigate (cmdk defaults). Letter keys filter input. The `⌘K` global hotkey is bound by Plan 05-01 in `app-shell.tsx` (case `"k":` → `useCommandPalette().toggle()`); Plan 05-05 mounts the component.
- **D-30:** TBD-PHASE-4-F: the `> show routing table` action navigates to `setActive("routing")`. Phase 5 does NOT add a `routing` route to `ActiveScreenId` (Phase 4 owns that). Until Phase 4 lands, the palette item exists but `setActive("routing")` triggers a TypeScript error — Plan 05-05 ships it as `setActive("routing" as ActiveScreenId)` with a `// TBD-PHASE-4-F:` comment OR as a no-op handler that logs a console warning. Decision: **no-op + console.warn** with `// TBD-PHASE-4-F: route is unwired until Phase 4 ROUTE-03 lands` — keeps the palette ranking deterministic without forcing a type cast that hides a real type mismatch when Phase 4 lands.

### Notification policy (Plan 05-06)

- **D-31:** Notification policy table (RESEARCH §8) is implemented as a single `useGatewayNotifications()` hook at `src/hooks/use-gateway-notifications.ts` that subscribes to `status.event` + `peers.event` + `gateway.event` (all via `actions.subscribe` fan-out) and dispatches per-event to one of: `silent`, `toast` (sonner), `system` (`tauri-plugin-notification`), or `both`. The hook is mounted ONCE at AppShell level (sibling of `<SubscriptionErrorToast />`) — per-screen mounts would duplicate. (UX-04.)
- **D-32:** Lazy permission flow: at app start the hook calls `isPermissionGranted()` ONCE. If `false`, do NOT request — wait for the first event that maps to `system` or `both`, then call `requestPermission()` then `sendNotification()`. Avoids the macOS / Windows permission prompt at app launch (which would interrupt onboarding). (RESEARCH §8.)
- **D-33:** Critical events that fire OS notifications:
  - `status.event { kind: "kill_switch", detail: { engaged: true } }` (TBD-PHASE-4-C — fires regardless of whether Phase 4 has landed the in-app banner, because the daemon emits the event verbatim)
  - `gateway.event { kind: "conntrack_pressure", level: 2 }` (≥ 95%)
  - Synthesized "all gateways lost" — when the UI observes `gateway_lost` AND `selected_gateway === null` AND `route_on === true` AND `previous_selected_gateway !== null` (RESEARCH §14 open question 7 — UI synthesizes; documented in Plan 05-06)
- **D-34:** Toast copy verbatim (UX-04 + brand voice — declarative, no exclamation, named events):
  - peer connected: `{label ?? short_id} connected`
  - gateway failover: `Failed over to {new_gateway} — {old_gateway} lost`
  - kill-switch engage (toast variant of `both`): `Blocking internet — gateway unreachable. Open pim to fix.`
  - kill-switch disengage: `Internet routing restored.`
  - conntrack pressure level 1 (≥ 80%): `gateway conntrack near limit ({pct}%).`
  - conntrack saturated (system toast variant of `both`): `gateway conntrack saturated — connections will drop.`
  - all gateways lost (system): `Mesh has no gateway — internet routing lost.`
  - gateway enabled: `gateway active on {nat_interface}.`
  - gateway disabled: `gateway off.`
  - daemon stopped: `pim daemon stopped — restart to continue.`
  - daemon reconnected: `pim daemon reconnected.` (Phase-1 ReconnectToast already does this — Plan 05-06 does NOT duplicate; just confirms the pattern.)
- **D-35:** OS-notification on-click handler: `notification.actionType('default')` brings the main pim window to front via `getWebviewWindowByLabel('main').show().then(win => win.setFocus())`. (RESEARCH §6b click-to-focus.)
- **D-36 (revised):** Phase 3's `Settings → Notifications` section will gain an additive read-only display of the policy table (D-31 mapping above) — but Plan 05-06 does NOT directly edit `src/components/settings/sections/notifications.tsx` because Plan 03-06 has not yet executed (per `STATE.md`, only Plans 03-01 and 03-02 are complete) and editing a Phase-3-pending file would create cross-phase conflict. Instead, Plan 05-06 owns the canonical policy table by exporting it from `src/lib/notifications/policy.ts` (already required by D-32 + D-34 for the dispatcher hook). Plan 03-06 (or a follow-on Phase-3-close plan) imports this export and renders a CliPanel sub-section with verbatim copy `notification policy (read-only · per-event toggles in future release)` followed by a 3-column table: `event · channel · copy`. The Settings display itself is recorded in the `<deferred>` block below as a Phase-3-handover deliverable; UX-04 acceptance does NOT depend on it (UX-04 measures toast/system-notification firing, not the Settings display). Per-event toggle UI remains POWER-04 (v0.6+).

### Speculative RPC contract (Plan 05-01)

- **D-37:** Plan 05-01 adds `GatewayStatusResult` + `GatewayEvent` + `GatewayEventKind` types to `src/lib/rpc-types.ts` per RESEARCH §5a / §5b verbatim, and extends `RpcMethodMap` with `"gateway.status"` / `"gateway.subscribe"` / `"gateway.unsubscribe"` and `RpcEventMap` with `"gateway.event"`. Every addition is tagged with a `// TBD-RPC:` comment naming the RESEARCH section. Acceptance criterion: `grep -c "TBD-RPC" src/lib/rpc-types.ts` returns ≥ 5 (one per new method/event/type addition).
- **D-38:** No new Tauri `#[tauri::command]` handlers required — Rust's generic `daemon_call` + `daemon_subscribe` + `daemon_unsubscribe` route any RPC method by string name. Plan 05-01 / 05-03 / 05-04 / 05-05 / 05-06 introduce ZERO new Rust commands. Plan 05-04 adds tray + popover construction code in `src-tauri/src/lib.rs` setup hook + a NEW `src-tauri/src/tray.rs` for testability — these are NOT Tauri commands, just Rust setup code.

### Brand-fit visualizations

- **D-39:** Gauge MUST be ASCII bar (D-12) — NOT an SVG/Canvas gauge. STYLE.md "Never: photography, illustration, mascots, hero imagery that isn't CLI/diagram-based" + "Always: CLI output panels as first-class brand imagery". A rounded SVG arc-gauge reads SaaS, not infrastructure.
- **D-40:** Throughput rendering inside a CliPanel sub-section titled `throughput` (lowercase via CliPanel auto-uppercase header) — terminal convention, matches Phase 2 metrics line idiom.

### Keyboard layer

- **D-41:** Phase 5 hotkey additions LOCK at: `⌘4` (gateway tab) + `⌘K` (palette toggle). No collisions with existing Phase 2 (`⌘1/⌘2/⌘5/⌘,/⌘↑/⌘↓`) or Phase 3 (`⌘6` aliased from `⌘,`). Phase-4 will add `⌘3` (routing); Plan 05-07 audit task verifies no Phase-5 binding fights Phase-4's eventual `⌘3`.
- **D-42:** ⌘K modifier guard mirrors Phase 2 D-29: `if (e.shiftKey === true || e.altKey === true) return;` — `⌘⇧K` and `⌘⌥K` pass through to browser/DevTools.

### Error states

- **D-43:** `gateway.preflight` reject (RPC error code `-32030 GatewayPreflightFailed` per `RpcErrorCode`) renders the daemon error message inline above the `[ Re-run pre-flight ]` button in `text-destructive` font-code text, with retry-once-on-mount via the existing pattern. NO toast — pre-flight failures are tab-scoped, not app-scoped.
- **D-44:** `gateway.enable` reject renders inline below the `[ Turn on gateway mode ]` button (NOT toast) AND fires a sonner toast as a backup signal: `Gateway enable failed: {error.message}` — the user is on the Gateway tab, the inline error is primary; toast is a redundancy belt for long enable times where the user navigated away mid-call.
- **D-45:** `gateway.event` subscription failure surfaces via the existing Phase 2 D-31 `<SubscriptionErrorToast />` — `snapshot.subscriptionError` is already wired in `useDaemonState`. Plan 05-01's RpcEventMap addition means the existing fan-out subscription error path covers `gateway.event` with zero new code.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (planner / executor) MUST read these before planning or implementing.**

### Project-level specs

- `.planning/STATE.md` — Phase-5 locked decisions 2026-04-24: window-first macOS (D-18), system-notifications-only-on-critical (D-31..33), gateway-failover-toast-in-app (D-34); plus the W1 single-listener invariant carried from Phase 1.
- `.planning/REQUIREMENTS.md` — verbatim wording for GATE-01..04 + UX-04..07.
- `.planning/ROADMAP.md` §Phase 5 — six success criteria the plans MUST collectively satisfy.

### Domain knowledge

- `.planning/phases/05-gateway-mode-system-surfaces/05-RESEARCH.md` — full research, with §13 plan breakdown (refined here, not blindly copied), §4 TBD-PHASE-4 inventory (load-bearing), §5 TBD-RPC types (load-bearing), §8 notification policy table (load-bearing).
- `docs/UX-PLAN.md` §1 (P1–P5 design principles, especially P3 daemon-as-source-of-truth + P4 OS idiom first), §3h (Gateway feature inventory), §4a (desktop IA — sidebar + content pane), §4c (CliPanel / KeyValueTable / ActionRow primitives), §6d (Gateway tab states), §7 (microcopy table — "your address on the mesh", "device sharing its internet", no-exclamation rule), §8 (Layer-3 power surfaces — palette + raw TOML).
- `.design/branding/pim/patterns/STYLE.md` — Hard constraints: never `border-radius` other than 0, never shadows except `.phosphor`, never gradients, never hex literals (tokens only), never exclamation marks. Always: monospace, signal-green for active, box-drawing borders, ASCII status glyphs (`◆ ◈ ○ ✗`), CLI output panels as hero imagery, explicit crypto primitive names, honest scope statements.
- `CLAUDE.md` — daemon source of truth, brand-token policy, no rounding/shadows/gradients, GSD workflow conventions.

### Existing planning patterns (frontmatter + structure must match)

- `.planning/phases/02-honest-dashboard-peer-surface/02-CONTEXT.md` — D-XX decision-table format reference.
- `.planning/phases/02-honest-dashboard-peer-surface/02-05-PLAN.md` — PLAN.md frontmatter format (wave / depends_on / files_modified / autonomous / requirements / must_haves.{truths, artifacts, key_links}); ASCII task density.
- `.planning/phases/02-honest-dashboard-peer-surface/02-06-PLAN.md` — final-plan / human-verify checkpoint pattern (mirrored by Plan 05-07).
- `.planning/phases/03-configuration-peer-management/03-04-PLAN.md` — example of a plan that introduces SHARED hooks + utils consumed by sibling plans (mirrored by Plan 05-01 foundation).

### Code anchors (real file paths, not hypotheticals)

- `src/lib/rpc-types.ts` — already has `GatewayPreflightResult`, `GatewayEnableParams`, `GatewayEnableResult`, `GatewayDisableResult`, `GatewayPlatform`, `GatewayPreflightCheck`. Plan 05-01 ADDS `GatewayStatusResult` + `GatewayEvent` per RESEARCH §5; tag every addition with `// TBD-RPC:`.
- `src/lib/rpc.ts` — `callDaemon<M>` + `subscribeDaemon` + `unsubscribeDaemon`; Phase 5 preserves W1 (zero `listen(...)` calls in this file).
- `src/hooks/use-daemon-state.ts` — central atom; `gateway.event` joins existing fan-out via `actions.subscribe`. NO new Tauri listener.
- `src/components/brand/cli-panel.tsx` — every Phase-5 panel wraps in this; auto-uppercase title; `[STATUS]` badge.
- `src/components/brand/status-indicator.tsx` — `◆ ◈ ○ ✗` glyphs reused for pre-flight rows + popover status dot. NO new icon work.
- `src/components/shell/sidebar.tsx` — Plan 05-01 flips the gateway entry from `RESERVED` to `NAV`.
- `src/components/shell/active-screen.tsx` — Plan 05-01 adds `case "gateway":` returning `<GatewayScreen />`; assertNever exhaustive-check forces this.
- `src/components/shell/app-shell.tsx` — Plan 05-01 adds `case "4":` and `case "k":` to the keyboard handler; Plan 05-05 mounts `<CommandPalette />`.
- `src/hooks/use-active-screen.ts` — Plan 05-01 extends `ActiveScreenId` union with `"gateway"`.
- `src-tauri/Cargo.toml` — Plan 05-01 sets `tauri = { version = "2", features = ["tray-icon"] }` + adds `tauri-plugin-notification = "2"` + `tauri-plugin-positioner = { version = "2", features = ["tray-icon"] }`.
- `src-tauri/src/lib.rs` — Plan 05-01 registers the two plugins (no tray code yet); Plan 05-04 adds tray + popover construction.
- `src-tauri/capabilities/default.json` — Plan 05-01 adds `notification:default` + `positioner:default`.
- `package.json` — Plan 05-01 adds `cmdk@^1.1.1`, `@tauri-apps/plugin-notification@^2.3.3`, `@tauri-apps/plugin-positioner@^2.3.1`.
- `src/lib/format.ts` — Plan 05-03 appends `formatBitrate(bps: number): string` helper.

### Goal-backward trace: ROADMAP §Phase 5 success criteria → plans

- **SC1** (Linux pre-flight rendering + nat_interface picker + enable) → **Plan 05-02** (D-04..09).
- **SC2** (gateway active state: conntrack gauge + throughput + peer-through-me) → **Plan 05-03** (D-12..16).
- **SC3** (macOS / Windows Linux-only messaging — visible, not hidden) → **Plan 05-02** (D-10..11).
- **SC4** (tray popover + tray menu parity: status dot + node + IP + route toggle + Add peer + Open pim) → **Plan 05-04** (D-17..23).
- **SC5** (⌘K palette surfaces every major action + tab navigation) → **Plan 05-05** (D-24..30).
- **SC6** (toast for non-critical, OS notification only for critical) → **Plan 05-06** (D-31..36).

</canonical_refs>

<specifics>
## Specific Ideas / References

### ASCII mockup — Linux Gateway pre-flight failing (Plan 05-02 spec target, RESEARCH §2a verbatim trim)

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

### ASCII mockup — Linux Gateway pre-flight passing (Plan 05-02, RESEARCH §2a verbatim trim)

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

### ASCII mockup — Linux Gateway active (Plan 05-03, RESEARCH §2b verbatim trim)

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

### ASCII mockup — Gateway tab on macOS / Windows (Plan 05-02, RESEARCH §2c verbatim trim)

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

### macOS / Windows tray popover layout (Plan 05-04, RESEARCH §2d verbatim trim)

```
┌────────────────────────────────────────┐
│ ◆ pim · client-a-macbook               │
│ mesh: 10.77.0.100/24                   │
├────────────────────────────────────────┤
│ [ Route internet via mesh ]   on  ●    │   ← TBD-PHASE-4-A
│ Routing through gateway-c              │   ← TBD-PHASE-4-B
│  (via relay-b)                         │
├────────────────────────────────────────┤
│ + Add peer nearby            ⌘⇧N       │   ← TBD-PHASE-4-G
│ Open pim                     ⌘O        │
├────────────────────────────────────────┤
│ Quit pim                     ⌘Q        │
└────────────────────────────────────────┘
```

### Linux tray AppIndicator menu (Plan 05-04, RESEARCH §2e verbatim trim)

```
◆ pim · client-a-macbook
mesh: 10.77.0.100/24
─────────────
[✓] Route internet via mesh         ← native CheckMenuItem (TBD-PHASE-4-A)
    Routing through gateway-c       ← disabled MenuItem (TBD-PHASE-4-B)
─────────────
Add peer nearby                     ← (TBD-PHASE-4-G)
Open pim
─────────────
Quit pim
```

### Command palette layout (Plan 05-05, RESEARCH §2f verbatim trim)

```
┌──────────────────────────────────────────────────────────┐
│  > _                                              [esc]  │
├──────────────────────────────────────────────────────────┤
│  navigate                                                │
│  > go to dashboard                              ⌘1       │
│  > go to peers                                  ⌘2       │
│  > go to routing                                ⌘3       │
│  > go to gateway                                ⌘4       │
│  > go to logs                                   ⌘5       │
│  > go to settings                               ⌘,       │
│  ─────────                                               │
│  routing                                                 │
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

### Toast / system-notification examples (Plan 05-06, RESEARCH §8 verbatim)

- toast: `relay-b connected`
- toast: `Failed over to gateway-c — gateway-b lost`
- toast: `gateway active on wlan0.`
- toast: `gateway conntrack near limit (82%).`
- system + toast: `Blocking internet — gateway unreachable. Open pim to fix.`
- system: `gateway conntrack saturated — connections will drop.`
- system: `Mesh has no gateway — internet routing lost.`

</specifics>

<deferred>
## Deferred Ideas

These surfaced during research but belong outside Phase 5 scope.

- **Per-event notification preferences toggle UI** — POWER-04, v0.6+. Phase 5 ships read-only display only.
- **Recency / frecency tracking in command palette** — POWER-04 territory. Phase 5 uses cmdk's default ranking + registration order + `keywords` synonyms only.
- **Multi-monitor popover positioning fix** — known Tauri positioner upstream bug (https://github.com/tauri-apps/tauri/issues/7139). Phase 5 acceptance: works on single-monitor; multi-monitor is a known issue.
- **macOS / Windows installer signing for notification toasts** — `tauri-plugin-notification` toast notifications require an installed (signed bundle) app on Windows; dev-mode may not show toasts. Not blocking Phase 5 plan; CI signing is a separate workstream.
- **Kernel-repo `RPC.md` push for `gateway.status` / `gateway.event`** — BLOCKED per STATE.md kernel-repo access. Phase 5 ships speculative TBD-RPC types; kernel maintainer confirmation is a follow-up.
- **Custom tray icon design pass beyond `█`** — Phase 5 ships the brand glyph at 16×16 monochrome; finer-grained iconography (light/dark adaptation, status overlays) deferred.
- **Full COPY.md audit (UX-08)** — Phase 4 owns COPY.md; Phase 5 microcopy follows UX-PLAN §7 + STYLE.md voice. Plan 05-07 audit task notes the COPY.md re-audit as a follow-up after Phase 4 lands UX-08.
- **In-app Phase-4 Routing tab placeholder** — RESEARCH §14 question 9 — Phase 5 assumes Phase 4 → Phase 5 ROADMAP order. The palette `> show routing table` action is a no-op + console.warn until ROUTE-03 ships (D-30).
- **All-gateways-lost daemon-side event** — RESEARCH §14 question 7 — daemon may emit per-gateway `gateway_lost` only. Phase 5 UI synthesizes the "all lost" condition (D-33).
- **Settings → Notifications read-only display** (D-36 revised) — pending Plan 03-06 (Phase 3 Notifications section). Plan 05-06 ships the canonical policy export at `src/lib/notifications/policy.ts`; Plan 03-06 (or a follow-on plan) consumes it and renders the CliPanel sub-section. UX-04 acceptance does NOT depend on this display.

</deferred>

---

*Phase: 05-gateway-mode-system-surfaces*
*Context gathered: 2026-04-26 (research-driven, no /gsd:discuss-phase pass)*
