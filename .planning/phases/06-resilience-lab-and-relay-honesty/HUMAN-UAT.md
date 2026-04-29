# Phase 6 — Resilience Lab UAT checklist

> Companion to `docs/RESILIENCE-LAB.md`. Run during the live session with Ruy + Pedro + partner. Each item is independently verifiable; none requires a code change.

**Session metadata** (fill at start)

- Date: __________
- Duration: __________
- Hosts: ruy-desktop=____________ · pedro-laptop=____________ · partner-pc=____________
- pim-daemon version (`rpc.hello.value.daemon`): ____________
- pim-ui git rev: ____________

---

## Pre-flight (before the daemon starts)

- [ ] **UAT-1.** On ruy-desktop, Settings → Bluetooth → NAP server preflight shows ◆ for all four checks (`bt_network`, `dnsmasq`, `bridge_tools`, `bnep_module`). Any ✗ must be resolved before the session can start; capture the install hint from the UI as part of the troubleshooting log.
- [ ] **UAT-2.** On all three hosts, the first-run role picker primary label reads exactly `Join + relay (recommended)` (Plan 06-01). The description below the radio names the bitfield (`client + relay (0x03)`).

## Steady-state mesh

- [ ] **UAT-3.** After the bring-up sequence, the Dashboard on ruy-desktop reports `role: client+relay+gateway (0x07)` in the identity panel; pedro-laptop and partner-pc report `client+relay (0x03)`.
- [ ] **UAT-4.** Peers list on every host shows the other two hosts with `state: active`. Transports are honest: the BT hop reads `bluetooth`, the LAN hops read `tcp`; nothing reads `relay` for a path that is genuinely direct.
- [ ] **UAT-5.** Routing screen on partner-pc lists ruy-desktop as the **selected** gateway, hops=2, via pedro-laptop. The dashboard banner reads `Routing through ruy-desktop (via pedro-laptop)` once the route toggle is on.
- [ ] **UAT-6.** `lab-tri-node-collect.sh` runs cleanly on each host (exit 0, single-line JSON). `lab-tri-node-report.sh` produces a markdown report with no `Failures` block populated.

## Relay honesty (Plan 06-01 + 06-02)

- [ ] **UAT-7.** Relay contribution panel on pedro-laptop shows `peers: 1 via this node` (or higher if any host has multiple destinations) once partner-pc routes through it. Forwarded bytes counter is non-zero after a successful internet ping.
- [ ] **UAT-8.** Simple-mode on pedro-laptop (toggle ⌘\\) reads `you're a relay · helping 1 device nearby` in the connected state. ruy-desktop's simple-mode reads either `helping N devices` (if ≥ 2 peers) or `ready to help`.
- [ ] **UAT-9.** Settings → Relay on partner-pc → flip the switch off. The `RelayOffConfirmAlertDialog` appears with the verbatim copy locked in `docs/COPY.md` (`Run as client only?` title, `[ Run client only ]` / `[ Keep relay on ]` actions). Cancel keeps relay on; confirm flips it. After confirming, the Dashboard relay panel switches to the `OFF` state. Restore by toggling back on.

## Resilience drills

- [ ] **UAT-10.** Stop ruy-desktop's daemon. Within ≤ 5 s the kill-switch banner appears on partner-pc; pedro-laptop's gateway list drops ruy. Restart ruy and watch the recovery: kill-switch clears, dashboard re-shows the routing path within ~10 s.
- [ ] **UAT-11.** Stop pedro-laptop's daemon. partner-pc behaviour depends on whether it has BT to ruy:
  - With BT → mesh re-converges to the direct one-hop path. Capture this in the report.
  - Without BT → kill-switch fires; capture which copy fired (`Blocking internet — gateway unreachable`).

## Wrap-up

- [ ] **UAT-12.** Three `*.json` snapshots from `lab-tri-node-collect.sh` are saved with the session date in the filename. The combined `docs/RESILIENCE-LAB-YYYY-MM-DD-RUN.md` is committed (or attached to the milestone close PR). Screenshots of dashboard, routing screen, and relay panel from each host accompany the report. Bugs filed for any item that did NOT pass; their issue numbers are linked in the report.

---

## Sign-off

- Ruy: __________________ (date)
- Pedro: __________________ (date)
- Partner: __________________ (date)

This document, once 12/12 are checked, fulfils the milestone v0.1 batch UAT referenced in `README.md` and triggers `/gsd:complete-milestone`.
