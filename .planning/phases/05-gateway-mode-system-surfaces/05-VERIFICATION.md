---
phase: 05-gateway-mode-system-surfaces
verified: 2026-04-27T00:00:00Z
status: human_needed
score: 8/8 must-haves verified (automated); 6/6 SCs deferred to milestone-end UAT batch
re_verification: null
human_verification:
  - test: "SC1 — Linux pre-flight rendering"
    expected: "Gateway tab on Linux shows each pre-flight check with ◆/✗ + name + detail; ✗ rows show daemon detail + UI recovery hint (e.g. `install: sudo apt install iptables`); when all pass, `[ Turn on gateway mode ]` appears with `nat_interface` Select."
    why_human: "Requires Linux + pim-daemon binary running with real preflight result; UI rendering check best confirmed visually."
    persistence: ".planning/phases/05-gateway-mode-system-surfaces/05-HUMAN-UAT.md (SC1)"
  - test: "SC2 — Active gateway live updates"
    expected: "Gateway tab on Linux after enable: conntrack ASCII gauge `[████░░░░] used/max (pct%)` updates reactively (color thresholds 80%→amber, 95%→red); throughput panel shows in/out bps; peer-through-me list reflects real peers within 1s of daemon event."
    why_human: "Requires Linux + active gateway state + real RPC event traffic; reactive update timing best confirmed by observation."
    persistence: ".planning/phases/05-gateway-mode-system-surfaces/05-HUMAN-UAT.md (SC2)"
  - test: "SC3 — macOS / Windows Linux-only messaging"
    expected: "Gateway tab on macOS or Windows renders the verbatim string `Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay.` (D-09 verbatim copy gate). No stub error, no blank page."
    why_human: "Requires macOS or Windows runtime; visual confirmation that section is rendered (not hidden)."
    persistence: ".planning/phases/05-gateway-mode-system-surfaces/05-HUMAN-UAT.md (SC3)"
  - test: "SC4 — Tray / popover / AppIndicator parity"
    expected: "Status dot + node name + mesh IP visible; route-internet toggle present (currently a TBD-PHASE-4-A placeholder labeled `(phase 4)` — record as DEFERRED-PHASE-4, NOT failed); Add peer nearby + Open pim + Quit pim work on each platform."
    why_human: "Requires macOS + Windows + Linux runtimes; cross-platform tray/popover behavior must be observed live."
    persistence: ".planning/phases/05-gateway-mode-system-surfaces/05-HUMAN-UAT.md (SC4)"
    deferred_note: "TBD-PHASE-4-A route toggle placeholder is intentional per user policy — record as DEFERRED-PHASE-4 in batch UAT, not failed."
  - test: "SC5 — ⌘K command palette"
    expected: "Pressing ⌘K from any screen opens the palette; typing `g` ranks `go to gateway` first; typing `route` shows route on/off + show routing table; selecting a navigate action moves to the right tab."
    why_human: "Requires runtime; keyboard shortcut + cmdk default ranking behavior best confirmed interactively."
    persistence: ".planning/phases/05-gateway-mode-system-surfaces/05-HUMAN-UAT.md (SC5)"
  - test: "SC6 — Notification policy (toast vs OS notification)"
    expected: "peer_connected → toast only (no OS notification); kill_switch_engaged → BOTH toast AND OS notification with body `Blocking internet — gateway unreachable. Open pim to fix.`; gateway_failover → toast only; conntrack_saturated → BOTH; all_gateways_lost → BOTH (UI-synthesized)."
    why_human: "Requires daemon-driven event triggers (incl. kill-switch + saturation); per-channel routing best confirmed end-to-end against a real daemon."
    persistence: ".planning/phases/05-gateway-mode-system-surfaces/05-HUMAN-UAT.md (SC6)"
---

# Phase 5: Gateway Mode & System Surfaces — Verification Report

**Phase Goal (ROADMAP):** A Linux user can enable gateway mode after pre-flight and watch conntrack/throughput live; every desktop OS gets a menu-bar/tray/AppIndicator popover, a ⌘K command palette, and honest toast + system notifications — completing v1 for Mira.

**Verified:** 2026-04-27
**Status:** human_needed
**Re-verification:** No — initial verification

## Summary

All 8 Phase-5 must-haves verified via grep / file-read / typecheck / cargo-check on the current main branch. The 6 ROADMAP §Phase 5 success criteria require runtime walkthrough; per the user-deferred-UAT policy recorded in 05-07-SUMMARY.md (`Task 2 [approved-deferred-uat]`) and 05-HUMAN-UAT.md (`status: partial`, all 6 SCs `pending`), they are persisted to a milestone-end batch UAT queue rather than walked inline. This verification reflects the GSD `human_needed` pattern: automated checks all green; live walkthrough deferred per user policy. Phase 4 placeholders (TBD-PHASE-4-A/B/C/D/F/G) are intentional integration markers documented in the plans' frontmatter, NOT gaps.

## Goal Achievement — Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Sidebar `gateway` row navigable at ⌘4 | ✓ VERIFIED | `grep -q gateway src/components/shell/sidebar.tsx`; `case "4"` → `requestActive("gateway", setActive)` in app-shell.tsx; `case "gateway"` returning `<GatewayScreen />` in active-screen.tsx; ActiveScreenId union extended with "gateway" |
| 2   | Linux user sees pre-flight check rows + nat_interface Select + Turn-on action when all pass | ✓ VERIFIED | `src/components/gateway/preflight-section.tsx` + `preflight-check-row.tsx` + `nat-interface-select.tsx` exist (substantive, ~3-4KB each); `<NatInterfaceSelect />` calls `callDaemon("gateway.enable", { nat_interface })`; D-09 verbatim banner gate passes |
| 3   | When gateway active, conntrack gauge + throughput + peer-through-me list update via gateway.event | ✓ VERIFIED | `src/components/gateway/conntrack-gauge.tsx` (32-char `█`/`░` bar + WCAG `role="meter"` + threshold colors + NEAR LIMIT badge flip); `throughput-panel.tsx`; `peers-through-me-list.tsx`; `useGatewayStatus()` subscribes via `actions.subscribe("gateway.event", ...)` (W1 fan-out — zero new Tauri listener) |
| 4   | macOS/Windows show verbatim "Gateway mode is Linux-only today." (rendered, not hidden) | ✓ VERIFIED | `src/components/gateway/linux-only-panel.tsx` contains both verbatim strings (GATE-04-1 + GATE-04-2 PASS); `src/screens/gateway.tsx` branches on `result.platform !== "linux"` with daemon-as-source-of-truth (D-11) |
| 5   | macOS popover + Windows tray + Linux AppIndicator each provide status dot + node + mesh IP + route toggle + Add peer + Open pim + Quit | ✓ VERIFIED | `src-tauri/src/tray.rs` (`build_native_menu` for Linux GTK; `build_popover_window` for macOS/Windows borderless React); `popover-shell.tsx` composes `<PopoverHeader />` + `<TBDRouteToggle />` (TBD-PHASE-4-A placeholder, intentional) + `<PopoverActions />`; `Position::TrayCenter` positioning; `show_menu_on_left_click(false)` preserves Linux right-click idiom; LSUIElement absent (window-first per 2026-04-24 STATE.md) |
| 6   | ⌘K from any screen opens palette with 17 D-27 verbatim actions (navigate + routing + peers + gateway + logs) | ✓ VERIFIED | `src/lib/command-palette/actions.ts` registers 17 actions in locked order (`grep -c "id:" = 19` including 2 interface decls); `<CommandPalette />` cmdk Dialog mounted at AppShell next to `<SubscriptionErrorToast />`; AppShell `case "k"` / `case "K"` calls `togglePalette()`; cmdk brand-override CSS in globals.css with `border-radius: 0` across 9 [cmdk-*] selectors |
| 7   | Toast for non-critical lifecycle events; OS notification only for critical (kill-switch + all-gateways-lost + conntrack saturated) | ✓ VERIFIED | `src/lib/notifications/policy.ts` defines `getChannelFor(eventKey) → 'silent' | 'toast' | 'system' | 'both'`; verbatim D-34 copy gates pass (Blocking internet…, Mesh has no gateway…, Internet routing restored, gateway conntrack saturated…); `<GatewayNotificationsListener />` mounted at AppShell subscribes via `actions.subscribe` (W1 fan-out); D-32 lazy permission flow via `useRef<boolean | null>` cache; synthesized `all_gateways_lost` via `previousGatewayRef` |
| 8   | W1 single-listener invariant preserved for daemon-event domain | ✓ VERIFIED | `grep -c 'listen(' src/lib/rpc.ts` = 0; `grep -c 'listen(' src/hooks/use-daemon-state.ts` = 2; documented W1 exception for custom Tauri event `pim://open-add-peer` (cross-window IPC, NOT daemon RPC) in app-shell.tsx; `pim://quit` Rust-side listener in lib.rs (single source of truth — popover never imports JS exit API) |

**Score:** 8/8 truths verified via automated checks. Live runtime confirmation deferred to milestone-end UAT batch (06 SCs in 05-HUMAN-UAT.md).

## Required Artifacts (Level 1+2+3 — exists, substantive, wired)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/screens/gateway.tsx` | 7-branch platform/state-aware screen | ✓ VERIFIED | 6.3KB; branches: daemon-not-running, preflight-loading, preflight-error, **active-state (prepended by 05-03)**, non-Linux, Linux-passing, Linux-failing; uses useGatewayStatus + GatewayActivePanel + LinuxOnlyPanel + PreflightSection + NatInterfaceSelect |
| `src/components/gateway/preflight-check-row.tsx` | StatusIndicator + name + detail + recovery hint | ✓ VERIFIED | exists, substantive; reuses Phase 2 StatusIndicator (D-04, no new icon work) |
| `src/components/gateway/preflight-section.tsx` | Pre-flight list + Re-run + D-09 verbatim banner | ✓ VERIFIED | exists, substantive; D-09 verbatim banner gate passes |
| `src/components/gateway/nat-interface-select.tsx` | Brand Select + gateway.enable submit | ✓ VERIFIED | exists, substantive; calls `callDaemon("gateway.enable", { nat_interface })`; D-44 inline error + sonner toast redundancy |
| `src/components/gateway/linux-only-panel.tsx` | GATE-04 verbatim copy + Open kernel repo | ✓ VERIFIED | exists, substantive; both GATE-04 verbatim strings present; iptables-equivalent NAT continuation; @tauri-apps/plugin-shell `open()` |
| `src/components/gateway/conntrack-gauge.tsx` | 32-char ASCII bar + WCAG meter + threshold colors | ✓ VERIFIED | exists, substantive; `BAR_WIDTH = 32`, `█` (U+2588), `░` (U+2591), `role="meter"`, `NEAR LIMIT` badge flip at ≥95% |
| `src/components/gateway/throughput-panel.tsx` | D-13 two-line layout (rate + totals) | ✓ VERIFIED | exists, substantive; consumes formatBitrate/formatBytes/formatDuration |
| `src/components/gateway/peers-through-me-list.tsx` | Reuses Phase 2 PeerRow; D-14 verbatim empty state | ✓ VERIFIED | exists, substantive; `no peers routing through this node yet · advertising 0.0.0.0/0` verbatim grep PASS |
| `src/components/gateway/gateway-active-panel.tsx` | §2b mockup composition with D-15 advisory | ✓ VERIFIED | 3.8KB; `peers will be cut over to another gateway` verbatim grep PASS; `[ Turn off gateway mode ]` action |
| `src/hooks/use-gateway-preflight.ts` | gateway.preflight call + refetch | ✓ VERIFIED | exists, substantive; `callDaemon("gateway.preflight", null)`; W1 preserved (zero new Tauri-side subscriptions) |
| `src/hooks/use-gateway-status.ts` | gateway.status + gateway.event subscription + TBD-RPC-FALLBACK polling | ✓ VERIFIED | exists, substantive; `actions.subscribe("gateway.event", ...)` (W1 fan-out); `callDaemon("gateway.status"|"gateway.disable")`; 4 TBD-RPC-FALLBACK markers (≥1 required); POLLING_FALLBACK feature flag (off by default) |
| `src/components/tray-popover/popover-shell.tsx` | D-19 popover layout shell | ✓ VERIFIED | exists, substantive; composes Header + (TBDRouteToggle + useRouteStatusLine) + Actions |
| `src/components/tray-popover/popover-header.tsx` | Status dot + node + mesh IP | ✓ VERIFIED | exists, substantive; reuses StatusIndicator; `mesh:` prefix grep PASS |
| `src/components/tray-popover/popover-actions.tsx` | Add peer nearby + Open pim + Quit pim | ✓ VERIFIED | exists, substantive; emits `pim://open-add-peer` + `pim://quit` Tauri events; @tauri-apps/plugin-shell NOT imported (W1 fix) |
| `src/components/tray-popover/use-popover-lifecycle.ts` | D-21 hide-on-blur via onFocusChanged | ✓ VERIFIED | exists, substantive |
| `src/components/tray-popover/use-route-status-line.ts` | TBD-PHASE-4-B fallback selector | ✓ VERIFIED | exists; intentionally a placeholder (DEFERRED-PHASE-4) |
| `src/components/tray-popover/tbd-route-toggle.tsx` | TBD-PHASE-4-A placeholder labeled `(phase 4)` | ✓ VERIFIED (DEFERRED-PHASE-4) | intentional placeholder per user policy; documented in 05-04-SUMMARY + 05-HUMAN-UAT SC4 |
| `src-tauri/src/tray.rs` | Linux GTK menu + macOS/Windows borderless popover | ✓ VERIFIED | exists, substantive; `build_native_menu` + `build_popover_window` + handlers; `Position::TrayCenter`; `decorations(false)` |
| `src-tauri/icons/tray.png` | 16×16 monochrome PNG | ✓ VERIFIED | 339 bytes; bundled via tauri.conf.json `bundle.resources` |
| `src-tauri/capabilities/tray-popover.json` | Scoped popover capability | ✓ VERIFIED | exists, substantive; `windows: ["tray-popover"]` + 4 permissions per D-23 |
| `tray-popover.html` + `src/tray-popover-main.tsx` | Vite multi-entry popover bundle | ✓ VERIFIED | both exist; vite.config.ts rollupOptions.input includes tray-popover.html |
| `src/lib/command-palette/state.ts` | Real useCommandPalette atom (replaces 05-01 stub) | ✓ VERIFIED | module-level atom + listeners Set + useSyncExternalStore; `togglePalette` / `setPaletteOpen` / `getPaletteOpen` exposed |
| `src/lib/command-palette/actions.ts` | 17-action PALETTE_ACTIONS registry in locked order | ✓ VERIFIED | 19 `id:` matches (17 actions + 2 type decls); navigate (6) → routing (3) → peers (3) → gateway (3) → logs (2); D-27 verbatim labels; TBD-PHASE-4-A/F/G markers preserved per user directive |
| `src/components/command-palette.tsx` | cmdk Command.Dialog with brand-override CSS | ✓ VERIFIED | exists, substantive; mounted at AppShell next to `<SubscriptionErrorToast />`; loop keyboard nav; value=label+keywords search ranking |
| `src/lib/notifications/policy.ts` | Channel table + verbatim D-34 copy | ✓ VERIFIED | exists, substantive; 18 event keys mapped; verbatim D-34 toast + system copy; `synthesized:all_gateways_lost` event key present |
| `src/hooks/use-system-notifications.ts` | D-32 lazy permission flow + D-35 click-to-focus | ✓ VERIFIED | exists, substantive; `useRef<boolean | null>` permission cache; `focusMain()` helper |
| `src/hooks/use-gateway-notifications.ts` | `<GatewayNotificationsListener />` shell-level subscriber | ✓ VERIFIED | exists, substantive; subscribes via actions.subscribe to status.event + peers.event + gateway.event; `previousGatewayRef` synthesizes all-gateways-lost |
| `src/lib/format.ts` (formatBitrate appended) | D-13 bitrate helper | ✓ VERIFIED | `formatBitrate` exported; existing helpers untouched |
| `src/lib/rpc-types.ts` (TBD-RPC additions) | GatewayStatusResult + GatewayEvent + RpcMethodMap/RpcEventMap extensions | ✓ VERIFIED | 5 TBD-RPC markers (≥5 required); `GatewayStatusResult`, `GatewayEvent`, `gateway.status`, `gateway.event` all present |
| `package.json` (cmdk + plugin-notification + plugin-positioner) | JS deps locked at RESEARCH §6e versions | ✓ VERIFIED | cmdk@^1.1.1, @tauri-apps/plugin-notification@^2.3.3, @tauri-apps/plugin-positioner@^2.3.1 |
| `src-tauri/Cargo.toml` (tray-icon + image-png + plugin-notification + plugin-positioner) | Rust crates + features | ✓ VERIFIED | tauri-plugin-notification@2 + tauri-plugin-positioner@2 (tray-icon feature); tauri features include tray-icon + image-png (W2 fix for Image::from_path) |

## Key Link Verification — Wiring

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| GatewayScreen | gateway.preflight RPC | useGatewayPreflight → callDaemon | ✓ WIRED | `callDaemon("gateway.preflight", null)` in src/hooks/use-gateway-preflight.ts:47 |
| NatInterfaceSelect | gateway.enable RPC | callDaemon | ✓ WIRED | `callDaemon("gateway.enable", { nat_interface })` in nat-interface-select.tsx:44 |
| GatewayActivePanel | gateway.status / gateway.disable | useGatewayStatus → callDaemon | ✓ WIRED | `callDaemon("gateway.status"\|"gateway.disable", null)` in use-gateway-status.ts:67,79 |
| useGatewayStatus | gateway.event stream | actions.subscribe (W1 fan-out) | ✓ WIRED | `actions.subscribe<"gateway.event">(...)` in use-gateway-status.ts:111 — no new Tauri listener |
| GatewayNotificationsListener | status.event + peers.event + gateway.event | actions.subscribe (W1 fan-out) | ✓ WIRED | three actions.subscribe calls in use-gateway-notifications.ts:99,164,184 |
| GatewayNotificationsListener | sonner toast + tauri-plugin-notification | dispatch via getChannelFor | ✓ WIRED | per-event policy lookup; toast + sendNotification fired per channel |
| AppShell `case "4"` | GatewayScreen | requestActive("gateway", setActive) | ✓ WIRED | matches existing nav-gating pattern (Phase 3 D-13 dirty-Settings interception) |
| AppShell `case "k"`/`case "K"` | CommandPalette open | togglePalette | ✓ WIRED | toggles useCommandPalette atom; cmdk Dialog renders when open |
| Tray popover Add peer | Main window peers tab | emit("pim://open-add-peer") → app-shell.tsx listen | ✓ WIRED | popover emits; AppShell listen<unknown>("pim://open-add-peer", ...) → requestActive("peers") |
| Tray popover Quit | app.exit(0) | emit("pim://quit") → Rust setup hook listen | ✓ WIRED | popover emits; lib.rs `app.listen("pim://quit", \|_\| app.exit(0))` |
| Tray popover Open pim | main window show + setFocus | getMainWindow().show() + setFocus() | ✓ WIRED | popover-actions.tsx |
| CommandPalette navigate actions | setActive(screen_id) | PaletteContext.setActive | ✓ WIRED | actions.ts → run handler invokes ctx.setActive |
| CommandPalette TBD-PHASE-4-A/F | console.warn + closePalette | DEFERRED-PHASE-4 | ✓ WIRED (intentionally noop) | route on/off, show routing table — markers preserved per user directive (NOT a gap) |
| Tray icon asset | runtime resource_dir | tauri.conf.json bundle.resources + Image::from_path | ✓ WIRED | `Image::from_path` regex match in lib.rs; bundle.resources includes icons/tray.png |
| Vite multi-entry build | tray-popover.html bundle | rollupOptions.input | ✓ WIRED | vite.config.ts includes tray-popover.html alongside main |
| tauri-plugin-notification + plugin-positioner | App runtime | .plugin() registration in lib.rs | ✓ WIRED | both plugins registered before .manage(); main capability has notification:default + positioner:default |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| GatewayScreen | preflight result | useGatewayPreflight → callDaemon("gateway.preflight") | Yes — daemon RPC | ✓ FLOWING |
| GatewayActivePanel | gateway status | useGatewayStatus → callDaemon("gateway.status") + actions.subscribe("gateway.event") | Yes — daemon RPC + event stream | ✓ FLOWING |
| ConntrackGauge | used / max | GatewayActivePanel props from useGatewayStatus | Yes — daemon-reported | ✓ FLOWING |
| ThroughputPanel | in_bps / out_bps / totals | GatewayActivePanel props from useGatewayStatus | Yes — daemon-reported | ✓ FLOWING |
| PeersThroughMeList | peer rows | snapshot.status.peers filtered by peers_through_me_ids | Yes — daemon-reported | ✓ FLOWING |
| PopoverHeader | status / node name / mesh IP | useDaemonState | Yes — daemon snapshot | ✓ FLOWING |
| TBDRouteToggle | route state | TBD-PHASE-4-A placeholder | Placeholder (intentional) | ⚠️ DEFERRED-PHASE-4 (intentional per user policy) |
| useRouteStatusLine | egress | useStatus selector (Phase 2) — fallback line | Yes — fallback works today | ✓ FLOWING (Phase 4 will refine) |
| CommandPalette | PALETTE_ACTIONS array | static registry | Yes — 17 typed actions | ✓ FLOWING |
| GatewayNotificationsListener | event payloads | actions.subscribe (W1 fan-out) | Yes — daemon event stream | ✓ FLOWING |

The single ⚠️ DEFERRED-PHASE-4 is intentional per user policy: TBD-PHASE-4-A placeholder labeled `(phase 4)` is documented as DEFERRED-PHASE-4, NOT a gap; a follow-up integration pass will swap the placeholder for `<RouteToggle />` from `src/components/routing/route-toggle-panel.tsx`.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| TypeScript typechecks | `pnpm typecheck` | exit 0 (no output) | ✓ PASS |
| Rust crate compiles | `cd src-tauri && cargo check` | `Finished dev profile in 0.90s` | ✓ PASS |
| W1 daemon-event invariant | `grep -c 'listen(' src/lib/rpc.ts; grep -c 'listen(' src/hooks/use-daemon-state.ts` | 0 + 2 | ✓ PASS |
| TBD-RPC marker count | `grep -c "TBD-RPC" src/lib/rpc-types.ts` | 5 (≥5 required) | ✓ PASS |
| TBD-RPC-FALLBACK marker count | `grep -c "TBD-RPC-FALLBACK" src/hooks/use-gateway-status.ts` | 4 (≥1 required) | ✓ PASS |
| TBD-PHASE-4 inventory grep | `grep -rn "TBD-PHASE-4-" src/ src-tauri/` | A=10, B=4, C=4, D=1, E=0, F=5, G=9 (all thresholds met) | ✓ PASS |
| Verbatim copy gates | greps for D-09 / D-14 / D-15 / D-34 / GATE-04 strings | All PASS | ✓ PASS |
| LSUIElement absent (window-first) | `! grep -q "LSUIElement" src-tauri/tauri.conf.json` | PASS | ✓ PASS |
| `pim://quit` Rust listener wired | `grep -qE 'app\.listen.*"pim://quit"' src-tauri/src/lib.rs` | FOUND | ✓ PASS |
| Linux right-click idiom preserved | `grep -q "show_menu_on_left_click(false)" src-tauri/src/lib.rs` | FOUND | ✓ PASS |
| Tray icon bundled | `grep -q "icons/tray.png" src-tauri/tauri.conf.json` | FOUND | ✓ PASS |
| Vite multi-entry | `grep -q "tray-popover.html" vite.config.ts` | FOUND | ✓ PASS |
| Sidebar gateway navigable | `grep -q gateway src/components/shell/sidebar.tsx` | FOUND | ✓ PASS |
| AppShell ⌘4 + ⌘K bindings | `grep -A3 'case "4"' / 'case "k"' src/components/shell/app-shell.tsx` | both FOUND with correct handlers | ✓ PASS |
| Plugins registered | `grep -q tauri_plugin_notification\|tauri_plugin_positioner src-tauri/src/lib.rs` | both FOUND | ✓ PASS |

(Spot-checks that require a running daemon — actual UI rendering, palette opening, notification firing — are deferred to milestone-end UAT batch per user policy.)

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| GATE-01 | 05-01, 05-02 | Settings → Gateway shows pre-flight check results with each check's pass/fail + detail | ✓ SATISFIED (auto) + ? UAT | preflight-section.tsx + preflight-check-row.tsx + useGatewayPreflight; verbatim copy gates pass; live render confirmation deferred to UAT SC1 |
| GATE-02 | 05-01, 05-02 | User can enable gateway mode (Linux only) after pre-flight passes, choosing nat_interface | ✓ SATISFIED (auto) + ? UAT | nat-interface-select.tsx → callDaemon("gateway.enable"); D-06 explicit gate (only renders when every check.ok); deferred to UAT SC1 |
| GATE-03 | 05-01, 05-03 | When gateway is active, UI shows conntrack utilization gauge, throughput, peer-through-me count | ✓ SATISFIED (auto) + ? UAT | conntrack-gauge.tsx (32-char ASCII bar + WCAG meter + thresholds) + throughput-panel.tsx + peers-through-me-list.tsx + GatewayActivePanel; reactive update timing deferred to UAT SC2 |
| GATE-04 | 05-01, 05-02 | macOS/Windows Gateway section shows clear "Linux-only today" messaging (not hidden) | ✓ SATISFIED (auto) + ? UAT | linux-only-panel.tsx with both verbatim strings; rendered on `result.platform !== "linux"` branch (D-11 daemon-as-source-of-truth); deferred to UAT SC3 |
| UX-04 | 05-06 | Toast for non-critical lifecycle events; OS notification only for kill-switch + all-gateways-lost | ✓ SATISFIED (auto) + ? UAT | policy.ts channel table + verbatim D-34 copy; useGatewayNotifications dispatcher; D-32 lazy permission; deferred to UAT SC6 |
| UX-05 | 05-04 | macOS menu-bar popover provides status dot + Route toggle + Open pim (window-first default) | ✓ SATISFIED (auto, modulo intentional DEFERRED-PHASE-4-A) + ? UAT | popover-shell + popover-header + popover-actions; tray.rs build_popover_window borderless; LSUIElement absent; route toggle is TBD-PHASE-4-A placeholder per user policy; deferred to UAT SC4 |
| UX-06 | 05-04 | Windows tray + Linux AppIndicator parity with macOS popover | ✓ SATISFIED (auto, modulo intentional DEFERRED-PHASE-4-A) + ? UAT | hybrid pattern: macOS/Windows borderless React popover + Linux GTK native menu; show_menu_on_left_click(false); deferred to UAT SC4 |
| UX-07 | 05-05 | ⌘K palette exposes every major action + tab navigation | ✓ SATISFIED (auto) + ? UAT | actions.ts 17-action registry; D-27 verbatim labels; cmdk Dialog mounted; ⌘K wired in AppShell; deferred to UAT SC5 |

**REQUIREMENTS.md state confirmed:** All 8 Phase-5 REQ IDs marked `[x]` and the requirement-to-phase trace table marks all 8 as `Complete`. ROADMAP §Phase 5 row marks `Complete · 2026-04-27`.

## Anti-Patterns Found

None blocking. The following are intentional and documented in plan frontmatter:

| File | Pattern | Severity | Impact |
| ---- | ------- | -------- | ------ |
| src/components/tray-popover/tbd-route-toggle.tsx | TBD-PHASE-4-A placeholder labeled `(phase 4)` | ℹ️ Info (intentional) | DEFERRED-PHASE-4 per user policy; resolves in Phase-5↔Phase-4 follow-up integration pass |
| src/components/tray-popover/use-route-status-line.ts | TBD-PHASE-4-B fallback selector | ℹ️ Info (intentional) | Falls back to existing useStatus().egress today; full hop-chain resolves in Phase-4 ROUTE-02 follow-up |
| src/lib/command-palette/actions.ts | TBD-PHASE-4-A/F handlers (route on/off, show routing table) as console.warn + closePalette | ℹ️ Info (intentional, per user directive) | Markers preserved verbatim per execution-context user directive — NOT inline-replaced with real Phase-4 imports; greppable for future audit |
| src/components/shell/app-shell.tsx | One Tauri-API listen<unknown>("pim://open-add-peer") subscription | ℹ️ Info (documented W1 exception) | Custom Tauri event for cross-window IPC, NOT a daemon RPC event; documented in Plan 05-06 + Plan 05-07 audit Block D |
| src/hooks/use-gateway-status.ts | POLLING_FALLBACK feature flag (off by default) | ℹ️ Info (intentional) | TBD-RPC-FALLBACK per RESEARCH §5e; one-line activation if kernel maintainer rejects gateway.event |

No TODO/FIXME/HACK/PLACEHOLDER strings found in Phase-5 code outside the documented TBD-PHASE-4-* / TBD-RPC-FALLBACK markers (all intentional per phase context).

## Phase-4 Placeholder Note (CRITICAL — NOT a gap)

Per user policy recorded in 05-CONTEXT.md `<deferred>` block + RESEARCH §4 dependency inventory + 05-07-SUMMARY.md Task 2 deferral: the TBD-PHASE-4-A/B/C/D/F/G markers are **intentional integration markers** for a follow-up Phase-5↔Phase-4 integration pass, NOT gaps. They are documented in:

- `05-CONTEXT.md` <decisions> D-19 + D-20 + D-30 + D-33 + D-36 (popover route toggle, palette routing actions, kill-switch consumer, COPY.md re-audit)
- `05-RESEARCH.md` §4 (TBD-PHASE-4 inventory by letter A..G)
- Each plan's `<phase_4_dependencies>` frontmatter section
- `05-HUMAN-UAT.md` SC4 explicit note: "TBD-PHASE-4-A placeholder is intentional — Phase 5 plans were authored before Phase 4 shipped; a follow-up integration pass swaps the placeholder for `<RouteToggle />`"

For SC4 specifically: the popover route toggle is a TBD-PHASE-4-A placeholder labeled `(phase 4)` — record this as **DEFERRED-PHASE-4** in the milestone-end UAT batch, NOT FAIL.

## Human Verification Required (Deferred to Milestone-End UAT Batch)

Per user policy, the 6 ROADMAP §Phase 5 success criteria require live runtime walkthrough and have been persisted to `.planning/phases/05-gateway-mode-system-surfaces/05-HUMAN-UAT.md` (`status: partial`, all 6 SCs `pending`) for a future `/gsd:audit-uat` (or equivalent) milestone-end UAT batch. See the `human_verification` array in this file's frontmatter for the full SC1..SC6 list with expected behaviors and runtime requirements.

**Code/audit layer is shipped:**
- All 8 must-have truths verified via grep / file-read / typecheck / cargo-check.
- All 8 Phase-5 REQ IDs marked `[x]` in REQUIREMENTS.md and `Complete` in the requirement-to-phase trace.
- ROADMAP §Phase 5 row marks `Complete · 2026-04-27` (7/7 plans).
- Build sanity green: `pnpm typecheck` exit 0; `cargo check` exit 0.
- W1 daemon-event invariant preserved end-to-end.
- All TBD-PHASE-4-* / TBD-RPC / TBD-RPC-FALLBACK markers present at expected counts.
- Brand discipline holds across every Phase-5 new file (zero rounded-{sm|md|lg|xl|full}, zero shadow-{sm|md|lg|xl}, zero bg-gradient, zero hex literals in component sources, zero exclamation marks in JSX prose).
- All Phase-5 verbatim-copy gates pass.

**UAT layer pending:** the visible-on-real-daemon confirmation moves to the milestone-end UAT batch (06 SCs in 05-HUMAN-UAT.md).

## Gaps Summary

**No gaps blocking goal achievement.** All 8 must-haves verified via automated checks. The 6 SCs are deferred to milestone-end UAT batch per documented user policy (NOT a failure) — this is the GSD `human_needed` pattern for "automated checks all green; human walkthrough deferred."

The single TBD-PHASE-4-A route toggle placeholder in the tray popover is an intentional integration marker per user policy, NOT a gap, and is explicitly recorded as DEFERRED-PHASE-4 in 05-HUMAN-UAT.md SC4 (a follow-up integration pass swaps the placeholder for `<RouteToggle />` from `src/components/routing/route-toggle-panel.tsx`).

---

_Verified: 2026-04-27_
_Verifier: Claude (gsd-verifier)_
_Pattern: human_needed (automated checks all green; live walkthrough deferred per user-deferred-UAT policy)_
