# Resilience Lab — tri-node UAT runbook

> Phase 6 Plan 06-04. Companion to `.planning/phases/06-resilience-lab-and-relay-honesty/HUMAN-UAT.md`.

This document describes how to validate `pim-ui` + `pim-daemon` end-to-end on three real machines spanning two transports (LAN-TCP + Bluetooth-PAN). It is the first multi-host UAT pass for milestone v0.1; previous validation was Docker-only and did not exercise BT pairing or cross-OS topologies.

---

## Topology

```
┌──────────────────────────┐                ┌──────────────────────────┐
│  ruy-desktop (Linux)     │                │  partner-pc (Linux/macOS)│
│  role: client+relay+     │                │  role: client+relay      │
│        gateway (0x07)    │                │        (0x03)            │
│  bluetooth.serve_nap=on  │                │  no BT                   │
│  internet upstream       │                │                          │
└──────────────┬───────────┘                └──────────────┬───────────┘
               │                                           │
               │ Bluetooth PAN (br-bt + dnsmasq)           │ LAN-TCP
               │                                           │
               ▼                                           ▼
        ┌──────────────────────────────────────────────────────┐
        │              pedro-laptop (macOS)                     │
        │              role: client+relay (0x03)                │
        │              transport: BT to ruy + LAN-TCP to partner│
        └──────────────────────────────────────────────────────┘
```

Goal: `partner-pc` reaches the internet through `pedro-laptop` as a relay through `ruy-desktop` as a gateway. Two-hop split-default routing over a mixed transport.

---

## Pre-requisites

### Hardware

- **ruy-desktop** — Linux machine with a Bluetooth controller, internet-shareable interface (eth0 / wlan0), and root (for `bt-network` + iptables).
- **pedro-laptop** — macOS laptop with Bluetooth on, capable of pairing to ruy-desktop.
- **partner-pc** — any Linux or macOS machine on the same Wi-Fi as pedro-laptop.

### Software (per host)

| Tool | ruy-desktop | pedro-laptop | partner-pc |
|---|---|---|---|
| `pim-daemon` binary | ✓ | ✓ | ✓ |
| `pim-ui` (Tauri build) | ✓ | ✓ | ✓ |
| `bluetoothctl` (BlueZ) | ✓ | n/a | n/a |
| `bt-network` (bluez-tools) | ✓ | n/a | n/a |
| `dnsmasq` | ✓ | n/a | n/a |
| `bridge-utils` or `iproute2` | ✓ | n/a | n/a |
| `bnep` kernel module | ✓ (run `sudo modprobe bnep`) | n/a | n/a |
| `socat` or `nc -U` | ✓ | ✓ | ✓ |
| `jq` | ✓ | ✓ | ✓ |

The Bluetooth section's NAP-server preflight in pim-ui Settings will surface any missing tool on ruy-desktop with an explicit install hint — run it once before the session.

### Hardening checklist

1. **Firewall (ruy-desktop):** allow TCP 9100 inbound from the LAN and BT bridge; allow ICMP for the ping matrix.
2. **macOS Bluetooth pairing:** pair pedro-laptop to ruy-desktop via *System Settings → Bluetooth* before the daemon starts. macOS won't surface a TCC prompt mid-handshake otherwise.
3. **Time sync:** confirm all three hosts are within ~1 minute of each other (route freshness uses ages in seconds).

---

## Bring-up sequence

The order matters — bring up gateway first so partner-pc has somewhere to route to when it joins.

### 1. ruy-desktop (gateway)

```sh
# Verify NAP-server preflight is green via UI: Settings → Bluetooth → NAP server.
# All 4 checks (bt_network, dnsmasq, bridge_tools, bnep_module) must show ◆.

# In pim-ui first-run (or Settings → Identity), pick:
#   - device name: ruy-desktop
#   - role: Share my internet
# Then enable [bluetooth].serve_nap = true and save.

# Bring the daemon up via [ TURN ON ] in simple-mode or DaemonToggle.
```

Verify in the Dashboard:
- Identity panel reads `role: client+relay+gateway (0x07)`.
- Relay contribution panel reads `LIVE` with `0 · ready to help` until peers join.
- Gateway view shows `nat_interface` populated, all preflight checks pass, `Active: yes`.

### 2. pedro-laptop (relay+client)

```sh
# In first-run or Settings:
#   - device name: pedro-laptop
#   - role: Join + relay (recommended)   # the default
# [bluetooth].enabled = true (default on Linux; flip on for macOS).
# Save and start the daemon.
```

Pair with ruy-desktop:
1. macOS *System Settings → Bluetooth* → connect to `PIM-ruy-desktop`.
2. Wait ≤ 30 s for the daemon to learn ruy's PAN IP via `auto_discover_peers`.
3. Verify in pim-ui:
   - Peers list shows `ruy-desktop` with `transport: bluetooth`, `state: active`.
   - Routing screen shows ruy as the selected gateway, hops = 1.
4. Toggle `Route internet via mesh` on. Dashboard reads `Routing through ruy-desktop`.

Verify the relay role:
- Relay contribution panel: `role: relay + client (0x03)`, peers count `0` (still alone in the relay path).
- simple-mode (toggle ⌘\\) shows `you're a relay · ready to help`.

### 3. partner-pc (client+relay)

```sh
# Same default role: Join + relay (recommended).
# No special config — start the daemon.
```

This host is on the Wi-Fi that pedro-laptop is on. UDP broadcast discovery should find pedro-laptop within `discovery.broadcast_interval_ms` (5 s by default).

Verify:
- Peers list shows `pedro-laptop` with `transport: tcp`, `state: active`.
- Routing screen shows ruy as a known gateway, **via pedro-laptop**, hops = 2.
- Toggle `Route internet via mesh` on. Dashboard reads `Routing through ruy-desktop (via pedro-laptop)`.

After this finishes, pedro-laptop's relay panel should switch to `1 via this node · ready to help`, and simple-mode there should now read `you're a relay · helping 1 device nearby`.

---

## Running the harness

On each host (in three terminals or sequentially via SSH):

```sh
./scripts/lab-tri-node-collect.sh -o /tmp/${HOSTNAME}.json
```

Each invocation reads from the local Unix socket (`$PIM_RPC_SOCKET`, falling back to `$XDG_RUNTIME_DIR/pim.sock` on Linux or `$TMPDIR/pim.sock` on macOS) and writes a JSON snapshot.

Combine and render the markdown report:

```sh
./scripts/lab-tri-node-report.sh \
  /tmp/ruy-desktop.json \
  /tmp/pedro-laptop.json \
  /tmp/partner-pc.json \
  -o docs/RESILIENCE-LAB-$(date +%Y-%m-%d)-RUN.md
```

Inspect the produced markdown. Pass criteria:

1. **Identity table** lists three hosts with the expected role strings.
2. **Peer matrix** has every off-diagonal cell at `active (...)` — no `connecting`, no `failed`, no `absent`.
3. **Route table summary** shows the gateway path on every host: ruy from itself (hops=0 implicit), pedro-laptop with hops=1 to ruy, partner-pc with hops=2 to ruy via pedro-laptop's node_id.
4. **Known gateways** lists ruy with `selected: yes` on both pedro-laptop and partner-pc.
5. **Failures** section is empty.

---

## Resilience scenarios

After the steady-state run, exercise:

### A. Gateway gone

```sh
# On ruy-desktop:
# In pim-ui, click [ TURN OFF ] in simple-mode or DaemonToggle.
```

Expected on partner-pc within ≤ 5 seconds:
- Kill-switch banner (`✗ BLOCKING INTERNET — gateway unreachable`).
- Routing screen drops the gateway, `selected_gateway` becomes null.
- Sonner toast surfaces the loss.

Restart ruy-desktop's daemon. Both clients should re-elect the gateway within ~10 s and the kill-switch should clear.

### B. Relay gone

```sh
# On pedro-laptop:
# [ TURN OFF ] the daemon while ruy-desktop is still up.
```

Expected on partner-pc:
- If partner-pc has BT → ruy is reachable directly (one hop), routing should re-converge.
- If partner-pc has no BT → kill-switch banner; partner-pc cannot reach the internet via mesh.

This case validates that the UI distinguishes "relay-only loss" from "gateway loss". Both are honest.

### C. Client-only stress

On partner-pc, open Settings → Relay → flip off. The `RelayOffConfirmAlertDialog` must appear with `[ Run client only ]` / `[ Keep relay on ]`. Confirm. Save.

Verify on the Dashboard:
- Relay panel switches to the OFF state with `client only (0x01)` headline and the install-hint copy.
- Other peers' Routing screen no longer shows partner-pc as a relay candidate.

Restore via Settings → Relay → switch back on. Save.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `bnep_module` ✗ in NAP preflight | kernel module not loaded | `sudo modprobe bnep` on ruy-desktop |
| pedro-laptop never sees ruy as a peer | macOS pairing didn't complete | re-pair manually via System Settings → Bluetooth |
| partner-pc sees ruy directly (hops=1) instead of via pedro-laptop | broadcast discovery reached ruy | expected if all three are on the same Wi-Fi; either disable broadcast on ruy or test on isolated Wi-Fi |
| `peers.discovered` empty on every host | `discovery.enabled = false` somewhere | check Settings → Discovery |
| Latency on the BT hop > 200 ms | BlueZ is overloaded | reduce `peer_discovery_interval_ms` to 5000 to lower BT scan churn |
| Dashboard never shows `Routing through {gateway}` | `route.set_split_default` failed | check Logs tab; usually a missing CAP_NET_ADMIN on Linux |

---

## Artifacts to keep

After the session, commit (or attach to the PR closing milestone v0.1):

1. The three `*.json` snapshots from `lab-tri-node-collect.sh`.
2. The combined `RESILIENCE-LAB-YYYY-MM-DD-RUN.md` report.
3. Screenshots of the Dashboard + Routing + Relay panels on each host.
4. Any debug snapshot exports triggered (Logs tab → [ EXPORT DEBUG SNAPSHOT ]).
5. The completed `HUMAN-UAT.md` checklist.
