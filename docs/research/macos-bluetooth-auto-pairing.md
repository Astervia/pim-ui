# macOS Bluetooth auto-discovery + auto-pair (sidecar improvement)

> Author: research session 2026-04-30 · target: `pim-bt-rfcomm-mac` Swift
> sidecar at `tools/pim-bt-rfcomm-mac/Sources/PimBtRfcommMac/main.swift`

## TL;DR

Replace the current "wait for user to pair manually in System Settings"
flow with: sidecar runs Bluetooth Classic inquiry every ~2 min, finds
PIM-* devices that aren't paired yet, and triggers
`IOBluetoothDevicePair` on each. macOS shows its native pair dialog (one
click "Pair" by user), then the existing `discoveryTick` →
`openRFCOMMChannelAsync` → `bridge_ready` → `peers.connect_dynamic`
chain takes over without further intervention.

All required permissions are already in place in this repo
(`src-tauri/Info.plist` has `NSBluetoothAlwaysUsageDescription`;
`tools/pim-bt-rfcomm-mac/entitlements/` has
`com.apple.security.device.bluetooth = true`).

Cost estimate: ~150 LOC Swift + ~80 LOC TS hook + ~50 LOC TSX panel.
No new Tauri commands, no new Info.plist keys, no new build steps.

## Why this matters

Current `discoveryTick()`:

```swift
let paired = IOBluetoothDevice.pairedDevices() ?? []
for any in paired {
    // … filter PIM-*, open RFCOMM …
}
```

`pairedDevices()` only returns devices the user has **already** confirmed
in System Settings → Bluetooth. New PIM-* devices nearby are invisible
until the user opens System Settings, finds the device, clicks Pair,
confirms a passkey on both sides, then waits up to 30s for the next
sidecar poll. This is friction the product can remove.

The Linux side already does it: `pim-bluetooth/src/lib.rs` uses
`bluetoothctl` with the `NoInputNoOutput` agent to automatically inquiry
+ pair + trust + connect any prefix-matched device (see the platform
matrix at `docs/research/macos-bluetooth-discovery.md` §1.1). The Mac
sidecar should mirror this with the equivalent IOBluetooth APIs.

## API verification (read from the local SDK)

Headers consulted live at
`/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk/System/Library/Frameworks/IOBluetooth.framework/Versions/A/Headers/objc/`.
Both files copyright 2008-2023, no `API_DEPRECATED` markers, both
`API_UNAVAILABLE(ios, watchos, tvos)` (macOS-only — fine).

### `IOBluetoothDeviceInquiry.h`

| Item | Signature / value | Note |
|---|---|---|
| Init | `+ inquiryWithDelegate:` / `- initWithDelegate:` | Class or instance |
| `inquiryLength` | `@property uint8_t` | Default 10s; this is the radio inquiry window only — name updates extend the wall-clock duration |
| `searchType` | `@property IOBluetoothDeviceSearchTypes` | Default `kIOBluetoothDeviceSearchClassic` (what we want — RFCOMM is BR/EDR) |
| `updateNewDeviceNames` | `@property BOOL` | Default `YES` — fetches remote name post-inquiry |
| `start` / `stop` | `- (IOReturn)` | Throttled by system if called rapid back-to-back |
| `foundDevices` / `clearFoundDevices` | array helpers | Found set persists across `start` calls until `clearFoundDevices` |
| `setSearchCriteria:majorDeviceClass:minorDeviceClass:` | optional class filter | Don't bother — PIM-* prefix is our filter |

Delegate (`IOBluetoothDeviceInquiryDelegate`, all optional):

- `deviceInquiryStarted:` — fires when actual radio inquiry starts (may lag `start` due to throttling)
- `deviceInquiryDeviceFound:device:` — fires per device discovered
- `deviceInquiryUpdatingDeviceNamesStarted:devicesRemaining:` — name-fetch phase begins
- `deviceInquiryDeviceNameUpdated:device:devicesRemaining:` — device name resolved
- `deviceInquiryComplete:error:aborted:` — inquiry done

**Apple warning** (header line 31-33): "DO NOT perform remote name
requests on devices from delegate methods or while this object is in
use. If you wish to do your own remote name requests on devices, do
them after you have stopped this object. If you do not heed this
warning, you could potentially deadlock your process."

Implication: **don't open RFCOMM channels from inside the inquiry
delegate**. Only emit events / start `IOBluetoothDevicePair`. Let the
existing `discoveryTick` open the RFCOMM after the device shows up in
`pairedDevices()`.

### `IOBluetoothDevicePair.h`

| Item | Signature | Note |
|---|---|---|
| Init | `+ pairWithDevice:` (autorelease) | The device is retained |
| `delegate` | `@property(weak) id` | Strong ref must come from caller |
| `start` | `- (IOReturn)` | Kicks off pairing |
| `stop` | `- (void)` | Sets delegate to nil + disconnects if connected |
| `replyPINCode:PINCode:` | reply to legacy PIN request | 4-octet 0x30303030 = "0000" |
| `replyUserConfirmation:` | reply to SSP numeric Just Works | `BOOL reply` |

Delegate (`IOBluetoothDevicePairDelegate`, all optional):

- `devicePairingStarted:`
- `devicePairingConnecting:`
- `devicePairingConnected:`
- `devicePairingPINCodeRequest:` — peer wants legacy PIN
- `devicePairingUserConfirmationRequest:numericValue:` — Secure Simple Pairing numeric comparison; we reply yes/no
- `devicePairingUserPasskeyNotification:passkey:` — display passkey (peer enters)
- `devicePairingFinished:error:` — terminal callback
- `deviceSimplePairingComplete:status:` — alternative SSP termination

Header docstring (line 117-121): "Use the IOBluetoothDevicePair object
to attempt to pair with any Bluetooth device. […] This object enables
you to pair with devices within your application without having to use
the standard panels provided by the IOBluetoothUI framework, allowing
you to write custom UI to select devices, and still handle the ability
to perform device pairings."

So programmatic pairing **without** the legacy `IOBluetoothPairingController`
panel is the documented intended use. **However**, in practice on
modern macOS (≥ 12), the system *also* shows its own pairing dialog for
SSP numeric confirmation as a security gate (reported on Apple Dev
Forums; expected behavior since user must visually confirm a numeric
value displayed on both devices). Our user has explicitly accepted this
("tudo bem aparecer o dialog").

## Permissions: already wired

| Surface | File | Status |
|---|---|---|
| Tauri main app: BT permission strings | `src-tauri/Info.plist` | ✅ `NSBluetoothAlwaysUsageDescription` + `NSBluetoothPeripheralUsageDescription` already present |
| Sidecar: BT entitlement | `tools/pim-bt-rfcomm-mac/entitlements/pim-bt-rfcomm-mac.entitlements` | ✅ `com.apple.security.device.bluetooth = true`, `app-sandbox = false` |
| Build: code-sign with entitlements | `scripts/build-bt-rfcomm-sidecar.sh` | ✅ ad-hoc dev sign + Developer ID prod path |

**Open question to verify in spike**: the sidecar is a separate Mach-O
process, not embedded in pim-ui's bundle. macOS reads
`NSBluetoothAlwaysUsageDescription` from the **calling app's** Info.plist
to show the BT permission prompt. For a child process, the framework
walks up via `responsibleProcess` (TCC) — usually attributing to the
parent app. In this codebase, the parent is the Tauri pim-ui app whose
Info.plist already has the description, so the prompt should appear
once for "pim" not for "pim-bt-rfcomm-mac". This needs validation in a
fresh user session (after `tccutil reset Bluetooth com.astervia.pim`).

If TCC attribution fails, the workaround is to embed an `__info_plist`
section into the sidecar's Mach-O via linker flag in `Package.swift`:

```swift
// Package.swift linkerSettings:
.linkedFramework("IOBluetooth"),
.unsafeFlags([
    "-Xlinker", "-sectcreate",
    "-Xlinker", "__TEXT",
    "-Xlinker", "__info_plist",
    "-Xlinker", "tools/pim-bt-rfcomm-mac/Resources/Info.plist",
])
```

Where `Info.plist` is a minimal plist with the BT description string.

## Architecture

### Sidecar additions (Swift, ~150 LOC)

**New args** (extend `Args`):

```swift
var inquiryEnabled: Bool = true            // --inquiry=on|off
var inquiryLengthSecs: Int = 8             // --inquiry-length=8
var inquiryIntervalSecs: TimeInterval = 120 // --inquiry-interval=120
var autoPair: Bool = true                  // --auto-pair=on|off
var pairCooldownSecs: TimeInterval = 600   // 10 min between retry attempts
```

**New state**:

```swift
let inquiryDelegate = InquiryDelegate()
var currentInquiry: IOBluetoothDeviceInquiry?
var pendingPairs: [String: (IOBluetoothDevicePair, PairDelegate)] = [:]
var pairCooldowns: [String: Date] = [:]   // bd_addr → last attempt time
let pairLock = NSLock()
```

**Inquiry runner** (gated to avoid colliding with RFCOMM opens):

```swift
func runInquiryIfDue() {
    guard ARGS.inquiryEnabled else { return }
    guard currentInquiry == nil else { return }
    // Don't inquiry while ANY RFCOMM open is in flight — the radio
    // can't usefully do both simultaneously and Apple's docs warn
    // about deadlocks if you mix inquiry with name requests.
    guard registry.allAddrs().isEmpty else { return }
    let inq = IOBluetoothDeviceInquiry(delegate: inquiryDelegate)!
    inq.inquiryLength = UInt8(ARGS.inquiryLengthSecs)
    inq.updateNewDeviceNames = true
    let r = inq.start()
    emit(["event": "inquiry_started",
          "code": String(format: "0x%x", r),
          "length_s": ARGS.inquiryLengthSecs])
    if r == kIOReturnSuccess { currentInquiry = inq }
}
```

**Inquiry delegate** (handles found devices, schedules pair):

```swift
class InquiryDelegate: NSObject, IOBluetoothDeviceInquiryDelegate {
    func deviceInquiryDeviceFound(_ sender: IOBluetoothDeviceInquiry,
                                   device: IOBluetoothDevice) {
        let name = device.name ?? ""
        let addr = device.addressString ?? ""
        guard !addr.isEmpty, name.hasPrefix(ARGS.prefix) else { return }
        emit(["event": "inquiry_device",
              "bd_addr": addr, "name": name,
              "paired": device.isPaired(),
              "rssi": Int(device.rawRSSI())])
        if device.isPaired() { return }     // discoveryTick handles
        guard ARGS.autoPair else { return }
        // Cooldown gate: don't retry too fast on the same address
        pairLock.lock()
        let cooldownUntil = pairCooldowns[addr]
        let alreadyPending = pendingPairs[addr] != nil
        pairLock.unlock()
        if alreadyPending { return }
        if let until = cooldownUntil, Date() < until { return }
        attemptPair(device)
    }

    func deviceInquiryComplete(_ sender: IOBluetoothDeviceInquiry,
                                error: IOReturn, aborted: Bool) {
        let count = (sender.foundDevices() as? [Any])?.count ?? 0
        emit(["event": "inquiry_complete",
              "code": String(format: "0x%x", error),
              "aborted": aborted, "found_count": count])
        if currentInquiry === sender { currentInquiry = nil }
    }
}
```

**Pair attempt + delegate**:

```swift
func attemptPair(_ device: IOBluetoothDevice) {
    let addr = device.addressString ?? ""
    let name = device.name ?? ""
    let delegate = PairDelegate(addr: addr, name: name)
    guard let pair = IOBluetoothDevicePair(device: device) else {
        emit(["event": "pair_failed", "bd_addr": addr,
              "reason": "couldnt_construct_pair_object"])
        return
    }
    pair.delegate = delegate
    let r = pair.start()
    emit(["event": "pair_start",
          "bd_addr": addr, "name": name,
          "code": String(format: "0x%x", r)])
    if r == kIOReturnSuccess {
        pairLock.lock()
        pendingPairs[addr] = (pair, delegate)
        pairLock.unlock()
    } else {
        markPairCooldown(addr)
    }
}

func markPairCooldown(_ addr: String) {
    pairLock.lock()
    pairCooldowns[addr] = Date().addingTimeInterval(ARGS.pairCooldownSecs)
    pendingPairs.removeValue(forKey: addr)
    pairLock.unlock()
}

class PairDelegate: NSObject, IOBluetoothDevicePairDelegate {
    let addr: String
    let name: String
    init(addr: String, name: String) { self.addr = addr; self.name = name }

    func devicePairingStarted(_ sender: Any!) {
        emit(["event": "pair_phase", "bd_addr": addr, "phase": "started"])
    }
    func devicePairingConnecting(_ sender: Any!) {
        emit(["event": "pair_phase", "bd_addr": addr, "phase": "connecting"])
    }
    func devicePairingConnected(_ sender: Any!) {
        emit(["event": "pair_phase", "bd_addr": addr, "phase": "connected"])
    }
    func devicePairingUserConfirmationRequest(_ sender: Any!,
                                               numericValue: BluetoothNumericValue) {
        emit(["event": "pair_confirm",
              "bd_addr": addr, "name": name,
              "numericValue": Int(numericValue)])
        // PIM-* prefix is our trust boundary. We auto-accept the
        // numeric comparison on the sidecar side; the system still
        // shows its own dialog for the user to visually confirm the
        // numeric value matches on the peer (security policy gate).
        if let p = sender as? IOBluetoothDevicePair {
            p.replyUserConfirmation(true)
        }
    }
    func devicePairingPINCodeRequest(_ sender: Any!) {
        emit(["event": "pair_pin_request", "bd_addr": addr])
        // Legacy PIN auto-respond with "0000". The Linux pim-bluetooth
        // agent uses NoInputNoOutput / Just Works so this branch should
        // be unreachable in practice for PIM-* peers, but we close the
        // gap defensively.
        if let p = sender as? IOBluetoothDevicePair {
            var pin = BluetoothPINCode()
            withUnsafeMutableBytes(of: &pin) { buf in
                memset(buf.baseAddress, 0, buf.count)
                buf[0] = 0x30; buf[1] = 0x30; buf[2] = 0x30; buf[3] = 0x30
            }
            p.replyPINCode(4, pinCode: &pin)
        }
    }
    func devicePairingFinished(_ sender: Any!, error: IOReturn) {
        emit(["event": "pair_finished",
              "bd_addr": addr, "name": name,
              "code": String(format: "0x%x", error),
              "ok": error == kIOReturnSuccess])
        markPairCooldown(addr)
        // No explicit RFCOMM open here — `discoveryTick` will see the
        // device in `pairedDevices()` on its next pass (within
        // `--poll=N` seconds, default 30s).
    }
}
```

**Loop integration**:

```swift
DispatchQueue.global().async {
    var nextInquiry = Date()
    while true {
        discoveryTick()
        if Date() >= nextInquiry {
            runInquiryIfDue()
            nextInquiry = Date().addingTimeInterval(ARGS.inquiryIntervalSecs)
        }
        Thread.sleep(forTimeInterval: ARGS.pollInterval)
    }
}
```

The orphan watchdog and existing RFCOMM open-timeout (added in the
prior session) are unchanged.

### Tauri bridge (`src-tauri/src/bluetooth_rfcomm.rs`)

Zero changes. The existing `forward_event` already JSON-decodes any
event type and forwards it on `bluetooth-rfcomm://event`. The
ring-buffer snapshot also persists every new event type for free.

### React hook (`src/hooks/use-bluetooth-rfcomm.ts`)

Add to `RawEvent` union:

```typescript
| { event: "inquiry_started"; code: string; length_s: number }
| { event: "inquiry_device"; bd_addr: string; name: string;
    paired: boolean; rssi: number }
| { event: "inquiry_complete"; code: string; aborted: boolean;
    found_count: number }
| { event: "pair_start"; bd_addr: string; name: string; code: string }
| { event: "pair_phase"; bd_addr: string;
    phase: "started" | "connecting" | "connected" }
| { event: "pair_confirm"; bd_addr: string; name: string;
    numericValue: number }
| { event: "pair_pin_request"; bd_addr: string }
| { event: "pair_failed"; bd_addr: string; reason: string }
| { event: "pair_finished"; bd_addr: string; name: string;
    code: string; ok: boolean }
```

New state:

```typescript
export interface BluetoothRfcommPairable {
  bd_addr: string;
  name: string;
  rssi: number;
  pairing: { phase: string } | null;  // null = discovered, awaiting pair
  failed?: { code: string };
}

// Add to BluetoothRfcommSnapshot:
//   pairables: BluetoothRfcommPairable[];
```

Event handler additions: `inquiry_device` (paired=false) → upsert
pairable; `pair_start`/`pair_phase`/`pair_confirm` → mutate the
matching pairable's `pairing.phase`; `pair_finished` ok=true → remove
from pairables (it'll graduate to `peers` once RFCOMM opens); ok=false
→ set `failed.code`. Filter out any pairable whose `bd_addr` already
appears in `peers` (graduated).

### Panel (`src/components/dashboard/bluetooth-peers-panel.tsx`)

Add a third group below `peers` and `attempts`: "Discovered nearby
(awaiting pair)". Each row shows:

```
○  PIM-newpeer       AA:BB:CC:DD:EE:FF       — connecting…
○  PIM-anotherone    EE:FF:00:11:22:33       — confirm in macOS dialog
✗  PIM-broken        12:34:56:78:90:AB       — pair failed (0xe00002eb), retry in 8m
```

Badge updates: `2 found · 1 pairing · 1 stalled`.

### Settings UI (optional but recommended)

`src/screens/settings.tsx` BT section: add toggles for
`auto_pair` (on/off, default on) and `inquiry_interval_secs`
(60/120/300, default 120). These map to sidecar args. Storage path:
extend `[bluetooth]` in pim.toml — or in a new local
`pim-bt-rfcomm-mac` config namespace, since this only affects the Mac
sidecar (Linux already has its own).

For a v1, hardcoding sensible defaults (auto_pair=on, interval=120s)
and skipping the settings UI is acceptable — Phase 7 work might
restructure this anyway.

## Edge cases and risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Inquiry collides with RFCOMM open negotiation | `runInquiryIfDue()` skips when `registry.allAddrs().isEmpty == false` |
| 2 | macOS pair dialog pops up unexpectedly while user is doing something else | Inquiry only every 120s + dialog only on PIM-* prefix match — small surface |
| 3 | Multiple unpaired PIM-* devices nearby → cascading dialogs | Dialogs queue automatically (system serializes); cooldown prevents thrashing |
| 4 | User clicks Cancel in dialog → `pair_finished` with error → cooldown 10 min, then retry | Surface in UI with "retry in 8m" copy |
| 5 | Sidecar restart loses `pendingPairs` map | After restart, next inquiry sees device → if paired in interim, pickup; if not, re-attempt subject to system's own pairing state |
| 6 | TCC attribution puts BT permission prompt under "pim-bt-rfcomm-mac" instead of "pim" | Test with `tccutil reset Bluetooth`; if attribution misroutes, embed `__info_plist` section in sidecar Mach-O |
| 7 | Inquiry throttling (Apple intentionally rate-limits) | Default `--inquiry-interval=120`; system might further delay first start of each inquiry — non-fatal |
| 8 | `IOBluetoothDevicePair` strong reference: weak delegate, must keep `pair` alive | `pendingPairs` map holds strong refs until `devicePairingFinished` |
| 9 | Auto-pair to a hostile / spoofed PIM-* device | Trust gate is BT prefix + later pim-protocol Hello/HelloAck NodeId verification (handshake fails → channel closes → no harm) |
| 10 | Phase 7 (L2CAP CoC) lands and obsoletes RFCOMM auto-pair | This work is RFCOMM-scoped; Phase 7 will use BLE GATT discovery + a different pair flow. Keep the auto-pair work small and modular so it's cheap to remove |

## Test plan

### Manual smoke (single Mac + Linux peer, RFCOMM-equipped daemon)

1. On Mac: `blueutil --unpair 00-15-83-3d-0a-57` (force unpair PIM-gatewaybtonly)
2. Confirm with `blueutil --paired | grep PIM` returns nothing
3. Run new sidecar: `pim-bt-rfcomm-mac --name=PIM-mac --inquiry-interval=20 --inquiry-length=6`
4. Observe within 30s: `inquiry_started` → `inquiry_device { paired: false }` → `pair_start`
5. macOS pair dialog appears with PIM-gatewaybtonly + numeric code
6. Click Pair
7. Observe: `pair_phase: connecting` → `pair_phase: connected` → `pair_confirm` (sidecar auto-replies yes) → `pair_finished { ok: true }`
8. Within next `--poll` interval (30s default): `scan_attempt` → `discovered` (or `open_timeout` if Linux RFCOMM isn't bound)

### Negative: user clicks Cancel

Steps 1-6 same; step 7 shows `pair_finished { ok: false, code: 0xeXXXXXXX }`. Cooldown set. Sidecar should NOT retry for `--pair-cooldown=600` seconds. After cooldown, attempt again on next inquiry.

### Throttle stress

Run sidecar with `--inquiry-interval=5` (tighter than recommended).
Observe `inquiry_started` is delayed by macOS occasionally → events
still arrive but with longer-than-expected gaps. No crash, no spurious
errors. Confirms the system throttles gracefully.

### TCC permission attribution

```
tccutil reset Bluetooth com.astervia.pim
tccutil reset Bluetooth  # (broad reset)
```

Then launch pim-ui fresh. Confirm permission prompt:
- Appears only once
- Attributed to "pim" (parent app), not the sidecar binary name
- Approved → both Tauri main and sidecar gain BT access

If it shows up under "pim-bt-rfcomm-mac": apply the embedded
`__info_plist` workaround.

## Implementation phases

| Phase | Scope | Effort |
|---|---|---|
| **A** | Add inquiry loop + auto-pair to sidecar; emit new events | ~150 LOC Swift, 1-2h |
| **B** | Hook: parse new events, populate `pairables` state | ~80 LOC TS, 30min |
| **C** | Panel: render "Discovered nearby" group, badge | ~50 LOC TSX, 30min |
| **D** | Manual smoke test on real BT (steps in test plan) | 30min |
| **E** | TCC attribution test (clean BT permission prompt) | 30min, may need __info_plist embed |

Total: ~3-4 hours of focused work. No new dependencies, no new build
steps, no kernel-side changes.

## Compatibility with Phase 7 (L2CAP CoC full-node)

The phase-7 master plan at `.planning/phases/07-macos-bluetooth-full-node/`
is a **separate** initiative replacing RFCOMM/SPP with L2CAP CoC for
full Mac↔Mac mesh. This auto-pair work:

- Lives entirely in the existing RFCOMM sidecar (no kernel changes)
- Doesn't modify any phase-7 surface area
- Becomes legacy when phase-7 lands (BLE advertising replaces BT Classic inquiry)
- Delivers immediate UX value during the 2-4 week phase-7 development window

Verdict: ship this if you want auto-discovery now without waiting for
phase-7. The carrying cost is small.

## What we explicitly do NOT do

- **Bypass user confirmation**: even with `replyUserConfirmation(true)`,
  modern macOS still shows its own dialog for SSP numeric comparison.
  That's correct — the user can visually verify the numeric matches
  the peer's display before confirming.
- **Auto-pair non-PIM-* devices**: prefix filter is the trust boundary
  for "is this device part of pim mesh".
- **Run inquiry continuously**: throttled by Apple, hostile to other
  BT activity, drains battery. 120s interval is the sweet spot.
- **Open RFCOMM from inquiry delegate**: Apple explicitly forbids it
  (deadlock risk per header line 31-33). Let the existing
  `discoveryTick` handle that on its own cadence.

## Sources

- IOBluetoothDeviceInquiry header (local SDK 14.x)
- IOBluetoothDevicePair header (local SDK 14.x)
- Apple Developer documentation — IOBluetoothDeviceInquiry
- Apple Developer documentation — IOBluetoothDevicePair
- Existing pim Linux behavior — `proximity-internet-mesh/crates/pim-bluetooth/src/lib.rs`
- Phase 7 planning context — `.planning/phases/07-macos-bluetooth-full-node/07-CONTEXT.md`
- Prior research — `docs/research/macos-bluetooth-discovery.md` §1.1 (Linux/Mac platform matrix)
