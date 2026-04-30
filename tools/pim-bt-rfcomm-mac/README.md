# pim-bt-rfcomm-mac

Mac-side Bluetooth RFCOMM auto-discovery sidecar for `pim-ui` (Phase 7 spike).

The Tauri shell auto-spawns this binary at app boot on macOS. It polls
`IOBluetoothDevice.pairedDevices()` every 30 seconds, filters peers
whose `name` starts with `PIM-`, opens an RFCOMM channel (default 22),
exchanges a JSON `Hello`/`HelloAck` handshake, and emits one
newline-delimited JSON event per state transition on stdout. The Tauri
Rust side (`src-tauri/src/bluetooth_rfcomm.rs`) parses each line and
forwards it to the UI as a Tauri event on the
`bluetooth-rfcomm://event` channel; the Dashboard's
`<BluetoothPeersPanel />` subscribes via `useBluetoothRfcomm`.

## Why this lives outside the kernel

`IOBluetooth` is the only public macOS API for BR/EDR (Classic
Bluetooth) sockets. Apple removed BT-PAN entirely from macOS Tahoe
(both server and client side — the Mac sees a paired Linux node only
as an audio device). `IOBluetoothL2CAPChannel` and
`IOBluetoothRFCOMMChannel` still work, but their delegate-based API
must run on the main run loop and is allergic to being driven from
foreign threads. Embedding this in `pim-daemon` would force the Rust
event loop to share Apple's main run loop, with predictable
NSException leaks. A separate sidecar process owns its own run loop,
crashes alone if it crashes, and reports its identity via a one-way
JSON stream that survives across runtime versions.

The Linux side does NOT need a sidecar — it speaks RFCOMM via
`socket(AF_BLUETOOTH, SOCK_STREAM, BTPROTO_RFCOMM)` natively, and the
production port lives directly in the `pim-bluetooth` crate.

## Build

```bash
swift build -c release            # debug build
bash ../../scripts/build-bt-rfcomm-sidecar.sh   # production: arm64 + x86_64
```

The production script writes:

```
src-tauri/binaries/pim-bt-rfcomm-mac-aarch64-apple-darwin
src-tauri/binaries/pim-bt-rfcomm-mac-x86_64-apple-darwin   (best-effort)
```

Both ad-hoc signed by default; set `PIM_DEVELOPER_ID="Developer ID
Application: ..."` to sign with a real cert when shipping.

Tauri picks the right triple at bundle time per `tauri.conf.json`'s
`bundle.externalBin` entry:

```json
"externalBin": ["binaries/pim-daemon", "binaries/pim-bt-rfcomm-mac"]
```

## Runtime contract

CLI args (all optional):

| Arg | Default | Notes |
|-----|---------|-------|
| `--name=<str>`     | `PIM-<hostname>` | Local advertised name |
| `--node-id=<hex>`  | random 32B hex   | Persistent identity from `pim-daemon` |
| `--prefix=<str>`   | `PIM-`           | Filter for paired-device scan |
| `--channel=<u8>`   | `22`             | RFCOMM channel (1-30; 1 conflicts with BlueZ SPP) |
| `--poll=<secs>`    | `30`             | Outbound discovery interval |

Events (newline-delimited JSON to stdout):

| Event | Fields |
|-------|--------|
| `boot`              | local identity + config snapshot |
| `scan_attempt`      | `bd_addr`, `name`, `channel` |
| `inbound`           | `bd_addr`, `name` |
| `discovered`        | `peer: { bd_addr, name, node_id, platform, caps, since }` |
| `lost`              | `peer`, `reason` |
| `open_failed`       | `bd_addr`, `name`, `code` |
| `peer_error`        | `bd_addr`, `detail` |
| `frame`             | unknown post-handshake frame type — debug only |

Tauri `bluetooth-rfcomm://event` re-emits each line as a JSON value;
`useBluetoothRfcomm` deduplicates by `bd_addr` and renders the latest
identity in the Dashboard panel.

## TCC permission on first run

macOS will prompt the parent process (Terminal / Xcode / pim-ui app)
for Bluetooth access on the first `IOBluetoothDevice.pairedDevices()`
call. Approve once; subsequent runs reuse the grant. To reset
(troubleshooting):

```bash
tccutil reset Bluetooth com.astervia.pim-ui
```

## Permissions / entitlements

`entitlements/pim-bt-rfcomm-mac.entitlements` includes
`com.apple.security.device.bluetooth`. The Tauri parent app's
`Info.plist` (in `src-tauri/`) already carries
`NSBluetoothAlwaysUsageDescription`; no separate plist is required for
the sidecar in dev mode.

## Wire protocol

See `spikes/bt-rfcomm/PROTOCOL.md` in the kernel repo
(`proximity-internet-mesh`) for the canonical handshake spec. The
binary in this directory is the production port of the Swift spike at
`spikes/bt-rfcomm/mac/pim-bt-rfcomm-mac.swift`, with the same Hello /
HelloAck flow.
