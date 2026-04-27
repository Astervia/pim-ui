---
status: partial
phase: 05-gateway-mode-system-surfaces
source: [05-07-PLAN.md Task 2 human-verify checkpoint]
started: 2026-04-27
updated: 2026-04-27
note: User deferred per-phase UAT to milestone-end batch (recorded 2026-04-27 by orchestrator).
---

## Current Test

[awaiting milestone-end UAT batch — see /gsd:audit-uat]

## Tests

### SC1. Linux pre-flight rendering
expected: Gateway tab on Linux shows each pre-flight check with ◆/✗ + name + detail; ✗ rows show daemon detail + UI recovery hint (e.g. `install: sudo apt install iptables`); when all pass, `[ Turn on gateway mode ]` appears with `nat_interface` Select.
result: pending (requires Linux + pim-daemon binary)

### SC2. Active gateway live updates
expected: Gateway tab on Linux after enable: conntrack ASCII gauge `[████░░░░] used/max (pct%)` updates reactively (color thresholds 80%→amber, 95%→red); throughput panel shows in/out bps; peer-through-me list reflects real peers within 1s of daemon event.
result: pending (requires Linux + active gateway state)

### SC3. macOS / Windows Linux-only messaging
expected: Gateway tab on macOS or Windows renders the verbatim string `Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay.` (D-09 verbatim copy gate). No stub error, no blank page.
result: pending (requires macOS or Windows runtime)

### SC4. Tray / popover / AppIndicator parity
expected: Status dot + node name + mesh IP visible; route-internet toggle present (currently a TBD-PHASE-4-A placeholder labeled `(phase 4)` — DEFERRED-PHASE-4 expected, NOT a fail); Add peer nearby + Open pim + Quit pim work on each platform.
result: pending (requires macOS + Windows + Linux runtimes)
note: TBD-PHASE-4-A placeholder is intentional — Phase 5 plans were authored before Phase 4 shipped; a follow-up integration pass swaps the placeholder for `<RouteToggle />` from src/components/routing/route-toggle-panel.tsx.

### SC5. ⌘K command palette
expected: Pressing ⌘K from any screen opens the palette; typing `g` ranks `go to gateway` first; typing `route` shows route on/off + show routing table; selecting a navigate action moves to the right tab.
result: pending (requires runtime)

### SC6. Notification policy (toast vs OS notification)
expected: peer_connected → toast only (no OS notification); kill_switch_engaged → BOTH toast AND OS notification with body `Blocking internet — gateway unreachable. Open pim to fix.`; gateway_failover → toast only; conntrack_saturated → BOTH; all_gateways_lost → BOTH (UI-synthesized).
result: pending (requires daemon-driven event triggers)

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
