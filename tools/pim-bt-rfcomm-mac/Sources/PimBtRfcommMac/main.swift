// pim-bt-rfcomm-mac.swift
//
// Mac BT auto-discovery sidecar over RFCOMM/SPP.
//
//  - Polls IOBluetoothDevice.pairedDevices() every 30s.
//  - Filters by name prefix "PIM-".
//  - For each candidate without an active RFCOMM channel:
//      * Opens RFCOMM channel 1 (SPP convention).
//      * Sends `Hello` (JSON, length-prefixed u32 BE).
//      * Awaits `HelloAck`.
//      * On success: prints `{"event":"discovered","peer":...}` on stdout.
//      * On close: prints `{"event":"lost","peer":...,"reason":...}` on stdout.
//  - Also accepts inbound RFCOMM connections by registering a channel
//    handler — paired Linux can dial us back if it scans paired devices too.
//
// Build:  swiftc -framework IOBluetooth -O -o pim-bt-rfcomm-mac pim-bt-rfcomm-mac.swift
// Run:    ./pim-bt-rfcomm-mac [--name=PIM-pepe] [--node-id=<hex>] [--prefix=PIM-]
//
// The output is newline-delimited JSON on stdout, suitable to be piped
// into pim-daemon's IPC consumer (next iteration).

import Foundation
import IOBluetooth
import Network

// MARK: - Args

struct Args {
    var localName: String = "PIM-mac"
    var localNodeId: String = ""
    var prefix: String = "PIM-"
    var rfcommChannel: BluetoothRFCOMMChannelID = 22
    var pollInterval: TimeInterval = 30
    /// Run periodic Bluetooth Classic inquiry to discover PIM-* devices
    /// that are NOT yet paired with this Mac. Disable with
    /// `--inquiry=off` when you want hands-off pairing only via the
    /// existing macOS System Settings → Bluetooth flow.
    var inquiryEnabled: Bool = true
    /// Length of each inquiry burst, in seconds (per Apple spec: 1-30).
    /// Default 8s — enough for a noisy environment, short enough not to
    /// monopolize the radio.
    var inquiryLengthSecs: Int = 8
    /// Time between inquiry bursts, in seconds. Default 120s — Apple
    /// throttles back-to-back inquiries; this matches the system's
    /// politeness window without wasting cycles.
    var inquiryIntervalSecs: TimeInterval = 120
    /// Auto-trigger `IOBluetoothDevicePair` when inquiry surfaces a
    /// PIM-* device that is not paired yet. macOS still shows its native
    /// "Pair this Bluetooth Device?" dialog as a security gate (we
    /// cannot bypass that from a third-party process), but the user no
    /// longer needs to navigate to System Settings.
    var autoPair: Bool = true
    /// Seconds to wait before re-attempting pair against a BD_ADDR
    /// after a previous attempt finished (success OR failure). Prevents
    /// dialog-spam when the user clicks Cancel.
    var pairCooldownSecs: TimeInterval = 600
    /// How long to wait for `rfcommChannelOpenComplete` before declaring
    /// the open dead. macOS IOBluetooth has no public timeout knob and
    /// will silently never fire the callback if the peer accepts the
    /// L2CAP/RFCOMM session but has no listener bound to the channel
    /// (e.g. SDP record advertises SP on ch22 but no service backs it).
    /// Without this, a stuck open holds the device in `registry` forever
    /// and the auto-pair inquiry can never fire either, since it gates
    /// on `registry.allAddrs().isEmpty`.
    var openTimeoutSecs: TimeInterval = 8
}

func parseArgs() -> Args {
    var a = Args()
    for arg in CommandLine.arguments.dropFirst() {
        if let v = arg.value(after: "--name=") { a.localName = v }
        else if let v = arg.value(after: "--node-id=") { a.localNodeId = v }
        else if let v = arg.value(after: "--prefix=") { a.prefix = v }
        else if let v = arg.value(after: "--channel="), let n = UInt8(v) {
            a.rfcommChannel = BluetoothRFCOMMChannelID(n)
        }
        else if let v = arg.value(after: "--poll="), let s = TimeInterval(v) {
            a.pollInterval = s
        }
        else if let v = arg.value(after: "--inquiry=") {
            a.inquiryEnabled = (v == "on" || v == "true" || v == "1")
        }
        else if let v = arg.value(after: "--inquiry-length="), let n = Int(v) {
            a.inquiryLengthSecs = max(1, min(30, n))
        }
        else if let v = arg.value(after: "--inquiry-interval="), let s = TimeInterval(v) {
            a.inquiryIntervalSecs = max(10, s)
        }
        else if let v = arg.value(after: "--auto-pair=") {
            a.autoPair = (v == "on" || v == "true" || v == "1")
        }
        else if let v = arg.value(after: "--pair-cooldown="), let s = TimeInterval(v) {
            a.pairCooldownSecs = max(0, s)
        }
        else if let v = arg.value(after: "--open-timeout="), let s = TimeInterval(v) {
            a.openTimeoutSecs = s
        }
    }
    if a.localNodeId.isEmpty {
        a.localNodeId = randomHex(bytes: 32)
    }
    return a
}

extension String {
    func value(after prefix: String) -> String? {
        guard hasPrefix(prefix) else { return nil }
        return String(dropFirst(prefix.count))
    }
}

func randomHex(bytes: Int) -> String {
    var b = [UInt8](repeating: 0, count: bytes)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes, &b)
    return b.map { String(format: "%02x", $0) }.joined()
}

let ARGS = parseArgs()

// MARK: - Logging (newline-delimited JSON to stdout/stderr)

let stdoutLock = NSLock()

func emit(_ obj: [String: Any]) {
    stdoutLock.lock(); defer { stdoutLock.unlock() }
    if let data = try? JSONSerialization.data(withJSONObject: obj, options: []),
       var line = String(data: data, encoding: .utf8) {
        line.append("\n")
        FileHandle.standardOutput.write(line.data(using: .utf8)!)
    }
}

func logErr(_ s: String) {
    FileHandle.standardError.write("[pim-bt-rfcomm-mac] \(s)\n".data(using: .utf8)!)
}

// MARK: - Frame I/O (u32 BE length prefix + utf8 JSON payload)

enum FrameError: Error { case tooLarge, malformed, eof }

class FrameReader {
    private var buffer = Data()
    private let maxPayload = 65_536

    /// Feed raw bytes; returns any complete payloads available.
    func feed(_ chunk: Data) throws -> [Data] {
        buffer.append(chunk)
        var out: [Data] = []
        while true {
            guard buffer.count >= 4 else { break }
            let len: UInt32 = buffer.prefix(4).withUnsafeBytes {
                let p = $0.bindMemory(to: UInt8.self)
                return (UInt32(p[0]) << 24) | (UInt32(p[1]) << 16)
                     | (UInt32(p[2]) << 8)  |  UInt32(p[3])
            }
            if len == 0 || Int(len) > maxPayload { throw FrameError.tooLarge }
            guard buffer.count >= 4 + Int(len) else { break }
            let payload = buffer.subdata(in: 4..<(4 + Int(len)))
            buffer.removeSubrange(0..<(4 + Int(len)))
            out.append(payload)
        }
        return out
    }
}

func encodeFrame(_ json: [String: Any]) throws -> Data {
    let payload = try JSONSerialization.data(withJSONObject: json, options: [.sortedKeys])
    guard payload.count <= 65_536 else { throw FrameError.tooLarge }
    var hdr = Data(count: 4)
    let n = UInt32(payload.count)
    hdr[0] = UInt8((n >> 24) & 0xff)
    hdr[1] = UInt8((n >> 16) & 0xff)
    hdr[2] = UInt8((n >> 8)  & 0xff)
    hdr[3] = UInt8( n        & 0xff)
    var out = Data(); out.append(hdr); out.append(payload); return out
}

// MARK: - Per-channel session

final class Session: NSObject, IOBluetoothRFCOMMChannelDelegate {
    let bdAddr: String
    let bdName: String
    weak var channel: IOBluetoothRFCOMMChannel?
    let isInitiator: Bool
    let reader = FrameReader()
    var helloSent = false
    var ackReceived = false
    var peerInfo: [String: Any] = [:]
    let openedAt = Date()

    /// After handshake, the channel switches to verbatim byte-pipe mode.
    /// Subsequent RFCOMM bytes go straight to the TCP loopback bridge
    /// instead of being parsed as JSON frames.
    var inBridgeMode = false
    /// Bytes received on RFCOMM after handshake but before the TCP
    /// loopback connection arrives (Mac kernel daemon may take a moment
    /// to invoke `peer_connect_dynamic`). Drained on TCP accept.
    var pendingBytes = Data()
    /// TCP loopback bridge — created once handshake completes, exposes
    /// a port the Mac kernel daemon can `connect()` to so RFCOMM bytes
    /// look like a normal TCP peer to it.
    var bridge: Bridge?
    /// Deadline timer that fires if `rfcommChannelOpenComplete` never
    /// arrives. Cancelled by the delegate callback (success OR error)
    /// and by `rfcommChannelClosed`. See `Args.openTimeoutSecs`.
    var openDeadline: DispatchWorkItem?

    init(addr: String, name: String, channel: IOBluetoothRFCOMMChannel, initiator: Bool) {
        self.bdAddr = addr
        self.bdName = name
        self.channel = channel
        self.isInitiator = initiator
        super.init()
    }

    /// Schedule a watchdog that surfaces a stuck `openRFCOMMChannelAsync`
    /// as an `open_timeout` event and removes the session from the
    /// registry so the next discovery poll can retry. Idempotent —
    /// rescheduling cancels the prior timer first.
    func armOpenDeadline(seconds: TimeInterval) {
        openDeadline?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self = self else { return }
            // If we made progress (sent hello as initiator, or got peer
            // hello as acceptor) the open already completed — bail.
            if self.helloSent || self.ackReceived || !self.peerInfo.isEmpty {
                return
            }
            emit([
                "event": "open_timeout",
                "bd_addr": self.bdAddr,
                "name": self.bdName,
                "channel": Int(ARGS.rfcommChannel),
                "after_s": seconds,
            ])
            self.channel?.close()
            registry.remove(addr: self.bdAddr)
        }
        openDeadline = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    /// Write raw bytes (no framing) directly to the RFCOMM channel.
    /// Used by the bridge to forward TCP loopback bytes verbatim.
    func sendRawToRfcomm(_ data: Data) {
        guard let ch = channel else { return }
        // RFCOMM writeSync wants UInt16 length; chunk if necessary.
        var offset = 0
        let mtu = max(1, Int(ch.getMTU()))
        while offset < data.count {
            let chunkLen = min(mtu, data.count - offset)
            let slice = data.subdata(in: offset..<(offset + chunkLen))
            slice.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
                let p = UnsafeMutableRawPointer(mutating: raw.baseAddress!)
                _ = ch.writeSync(p, length: UInt16(chunkLen))
            }
            offset += chunkLen
        }
    }

    func send(_ json: [String: Any]) {
        guard let ch = channel else { return }
        do {
            let frame = try encodeFrame(json)
            frame.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
                let p = UnsafeMutableRawPointer(mutating: raw.baseAddress!)
                _ = ch.writeSync(p, length: UInt16(frame.count))
            }
        } catch {
            logErr("send error to \(bdAddr): \(error)")
        }
    }

    func sendHello() {
        send([
            "type": "hello",
            "v": 1,
            "node_id": ARGS.localNodeId,
            "name": ARGS.localName,
            "platform": "macos",
            "caps": ["mesh-v1"],
        ])
        helloSent = true
    }

    func sendHelloAck() {
        send([
            "type": "hello-ack",
            "v": 1,
            "node_id": ARGS.localNodeId,
            "name": ARGS.localName,
            "platform": "macos",
            "caps": ["mesh-v1"],
        ])
    }

    // MARK: IOBluetoothRFCOMMChannelDelegate

    func rfcommChannelOpenComplete(_ ch: IOBluetoothRFCOMMChannel!, status err: IOReturn) {
        // Whatever the outcome, the open watchdog has done its job —
        // cancel it before either branch returns.
        openDeadline?.cancel()
        openDeadline = nil
        if err != kIOReturnSuccess {
            emit(["event": "open_failed", "bd_addr": bdAddr, "name": bdName,
                  "code": String(format: "0x%x", err)])
            registry.remove(addr: bdAddr)
            return
        }
        if isInitiator { sendHello() }
        // If acceptor, wait for peer's hello then ack.
    }

    func rfcommChannelData(_ ch: IOBluetoothRFCOMMChannel!,
                           data ptr: UnsafeMutableRawPointer!, length n: Int) {
        let chunk = Data(bytes: ptr, count: n)
        if inBridgeMode {
            // Verbatim byte pipe: RFCOMM → TCP loopback. If the local
            // kernel daemon hasn't `connect()`ed yet, buffer until it
            // does so we don't drop the first frames after handshake.
            if let bridge = bridge, bridge.tcpConnected {
                bridge.sendToTcp(chunk)
            } else {
                pendingBytes.append(chunk)
            }
            return
        }
        do {
            for payload in try reader.feed(chunk) {
                handlePayload(payload)
            }
        } catch {
            logErr("decode error from \(bdAddr): \(error)")
            ch.close()
        }
    }

    func rfcommChannelClosed(_ ch: IOBluetoothRFCOMMChannel!) {
        openDeadline?.cancel()
        openDeadline = nil
        bridge?.shutdown()
        bridge = nil
        emit(["event": "lost",
              "peer": peerInfo.isEmpty ? ["bd_addr": bdAddr, "name": bdName] : peerInfo,
              "reason": "channel_closed"])
        registry.remove(addr: bdAddr)
    }

    private func handlePayload(_ payload: Data) {
        guard let obj = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
              let type = obj["type"] as? String else {
            logErr("bad payload from \(bdAddr): \(String(data: payload, encoding: .utf8) ?? "<bin>")")
            return
        }
        switch type {
        case "hello":
            // We are the acceptor. Capture peer info, ack.
            peerInfo = Session.extractIdentity(obj)
            sendHelloAck()
            emitDiscovered()
        case "hello-ack":
            // We are the initiator.
            peerInfo = Session.extractIdentity(obj)
            ackReceived = true
            emitDiscovered()
        case "error":
            emit(["event": "peer_error", "bd_addr": bdAddr, "detail": obj])
        default:
            // Future mesh frames go here. Echo for now to prove duplex.
            emit(["event": "frame", "bd_addr": bdAddr, "type": type])
        }
    }

    /// Strip protocol meta fields (type, v); keep only peer identity.
    static func extractIdentity(_ msg: [String: Any]) -> [String: Any] {
        var out = msg
        out.removeValue(forKey: "type")
        out.removeValue(forKey: "v")
        return out
    }

    private func emitDiscovered() {
        var peer: [String: Any] = peerInfo
        peer["bd_addr"] = bdAddr
        peer["since"] = ISO8601DateFormatter().string(from: openedAt)
        emit(["event": "discovered", "peer": peer])
        startBridge()
    }

    /// Open a TCP loopback listener and emit `bridge_ready` so the UI
    /// can RPC the kernel daemon to connect into it. Once the kernel
    /// connects, post-handshake RFCOMM bytes flow as a verbatim pipe.
    private func startBridge() {
        do {
            let bridge = try Bridge(session: self)
            self.bridge = bridge
            inBridgeMode = true
            let peerNodeId = (peerInfo["node_id"] as? String) ?? ""
            emit([
                "event": "bridge_ready",
                "bd_addr": bdAddr,
                "name": bdName,
                "node_id": peerNodeId,
                "port": Int(bridge.port),
            ])
        } catch {
            logErr("bridge start failed for \(bdAddr): \(error)")
            emit([
                "event": "bridge_failed",
                "bd_addr": bdAddr,
                "name": bdName,
                "reason": "\(error)",
            ])
        }
    }
}

// MARK: - TCP loopback bridge
//
// After RFCOMM Hello/HelloAck, each Session opens an `NWListener` on
// `127.0.0.1:0` (kernel-picked random port) and waits for the local
// pim-daemon to `connect()` into it. Once connected:
//
//   RFCOMM ────→ TCP   (Session.rfcommChannelData → bridge.sendToTcp)
//   RFCOMM ←──── TCP   (Bridge.receiveLoop → Session.sendRawToRfcomm)
//
// The first 16 B the daemon writes is its own NodeId (per
// `TcpTransport::connect`), which travel across the bridge so the
// peer's `TcpTransport::handle_incoming` can identify the new peer.
// We do not parse those bytes — bridge mode is a verbatim byte pipe.

final class Bridge {
    weak var session: Session?
    let listener: NWListener
    var connection: NWConnection?
    var tcpConnected: Bool = false
    let port: UInt16
    private let queue = DispatchQueue(label: "pim-bt-rfcomm-bridge", qos: .userInitiated)
    private var shutdownRequested = false

    init(session: Session) throws {
        self.session = session
        // Open the listener and discover the kernel-picked port BEFORE
        // wiring up `newConnectionHandler`, so its `[weak self]` capture
        // happens against a fully-initialized Bridge (Swift forbids
        // referencing `self.<let property>` before it is assigned).
        let (listener, port) = try Bridge.openListener(queue: queue)
        self.listener = listener
        self.port = port
        listener.newConnectionHandler = { [weak self] conn in
            self?.handleNewConnection(conn)
        }
    }

    private static func openListener(queue: DispatchQueue) throws -> (NWListener, UInt16) {
        // 127.0.0.1 only — never expose this listener on the network.
        // kernel-picked port (.any) so multiple peers don't clash.
        let params = NWParameters.tcp
        params.requiredInterfaceType = .loopback
        params.acceptLocalOnly = true
        params.allowLocalEndpointReuse = false
        let listener = try NWListener(using: params, on: .any)

        let portReady = DispatchSemaphore(value: 0)
        var assignedPort: UInt16 = 0
        listener.stateUpdateHandler = { state in
            switch state {
            case .ready:
                if let p = listener.port { assignedPort = p.rawValue }
                portReady.signal()
            case .failed(let err):
                logErr("bridge listener failed: \(err)")
                portReady.signal()
            case .cancelled:
                break
            default:
                break
            }
        }
        listener.start(queue: queue)
        _ = portReady.wait(timeout: .now() + .milliseconds(500))
        if assignedPort == 0 {
            throw NSError(domain: "PimBtRfcomm", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "listener never reached .ready"])
        }
        return (listener, assignedPort)
    }

    private func handleNewConnection(_ conn: NWConnection) {
        // First arrival wins; any subsequent connect is rejected so we
        // can't end up multiplexing two daemons over one RFCOMM pipe.
        if connection != nil {
            conn.cancel()
            return
        }
        connection = conn
        conn.stateUpdateHandler = { [weak self] state in
            guard let self = self else { return }
            switch state {
            case .ready:
                self.tcpConnected = true
                // Drain any RFCOMM bytes that arrived while we were
                // waiting for the kernel to connect.
                if let session = self.session, !session.pendingBytes.isEmpty {
                    let data = session.pendingBytes
                    session.pendingBytes = Data()
                    self.sendToTcp(data)
                }
                self.receiveLoop()
            case .failed(let err):
                logErr("bridge tcp connection failed: \(err)")
                self.shutdown()
            case .cancelled:
                self.shutdown()
            default: break
            }
        }
        conn.start(queue: queue)
    }

    private func receiveLoop() {
        guard let conn = connection, !shutdownRequested else { return }
        conn.receive(minimumIncompleteLength: 1, maximumLength: 8192) { [weak self] data, _, isComplete, error in
            guard let self = self else { return }
            if let data = data, !data.isEmpty {
                self.session?.sendRawToRfcomm(data)
            }
            if let error = error {
                logErr("bridge tcp recv error: \(error)")
                self.shutdown()
                return
            }
            if isComplete {
                self.shutdown()
                return
            }
            self.receiveLoop()
        }
    }

    /// Forward bytes from the RFCOMM channel to the local TCP peer.
    func sendToTcp(_ data: Data) {
        guard let conn = connection else { return }
        conn.send(content: data, completion: .contentProcessed { error in
            if let error = error {
                logErr("bridge tcp send error: \(error)")
            }
        })
    }

    /// Tear down the listener + connection. Idempotent.
    func shutdown() {
        if shutdownRequested { return }
        shutdownRequested = true
        connection?.cancel()
        connection = nil
        listener.cancel()
        // Force the corresponding RFCOMM channel down so the peer
        // notices the half-duplex closure and tears its side down too.
        session?.channel?.close()
    }
}

// MARK: - Registry of active sessions

final class Registry {
    private let q = DispatchQueue(label: "registry")
    private var sessions: [String: Session] = [:]
    func has(addr: String) -> Bool { q.sync { sessions[addr] != nil } }
    func put(_ s: Session) { q.sync { sessions[s.bdAddr] = s } }
    func remove(addr: String) { q.sync { sessions.removeValue(forKey: addr) } }
    func allAddrs() -> [String] { q.sync { Array(sessions.keys) } }
}

let registry = Registry()

// MARK: - Outbound discovery loop (poll paired devices)

func discoveryTick() {
    let paired = IOBluetoothDevice.pairedDevices() ?? []
    for any in paired {
        guard let dev = any as? IOBluetoothDevice else { continue }
        let name = dev.name ?? ""
        let addr = dev.addressString ?? ""
        guard name.hasPrefix(ARGS.prefix), !addr.isEmpty else { continue }
        if registry.has(addr: addr) { continue }
        // Try outbound RFCOMM.
        emit(["event": "scan_attempt", "bd_addr": addr, "name": name,
              "channel": Int(ARGS.rfcommChannel)])
        var ch: IOBluetoothRFCOMMChannel?
        let session = Session(addr: addr, name: name, channel: ch ?? IOBluetoothRFCOMMChannel(),
                              initiator: true)
        // openRFCOMMChannelAsync wants &ch, set delegate to session.
        let r = dev.openRFCOMMChannelAsync(&ch, withChannelID: ARGS.rfcommChannel,
                                            delegate: session)
        if r == kIOReturnSuccess, let opened = ch {
            session.channel = opened
            registry.put(session)
            // IOBluetooth never times out a stuck open — arm a watchdog
            // so the next poll can retry instead of skipping this device
            // forever via `registry.has(addr) { continue }` above. Also
            // unblocks the inquiry loop, which gates on `registry.allAddrs().isEmpty`.
            session.armOpenDeadline(seconds: ARGS.openTimeoutSecs)
        } else {
            emit(["event": "open_failed", "bd_addr": addr, "name": name,
                  "code": String(format: "0x%x", r)])
        }
    }
}

// MARK: - Inquiry + auto-pair
//
// `discoveryTick` only sees devices already paired with this Mac, so a
// fresh peer is invisible until the user opens System Settings →
// Bluetooth and pairs by hand. To remove that friction we run periodic
// `IOBluetoothDeviceInquiry` bursts, and for every PIM-* device that
// isn't paired yet we kick off `IOBluetoothDevicePair`.
//
// macOS still pops its native "Pair this Bluetooth Device?" dialog as
// the final security gate — Apple does not provide a public way to
// bypass it from a third-party process. The Linux peer's BlueZ agent
// uses `NoInputNoOutput` IO capability so the negotiation falls back
// to Just Works mode (single yes/no, no numeric comparison to copy);
// after the user clicks Pair once, every future session is silent.
//
// Apple warns in IOBluetoothDeviceInquiry.h not to make remote-name
// requests from delegate methods (deadlock risk), so we never open
// RFCOMM here. We just emit events and trigger pair; `discoveryTick`
// picks the device up on its own cadence once it appears in
// `pairedDevices()`.

/// Lock guarding `pendingPairs` and `pairCooldowns`. Pair work bounces
/// between the inquiry callback (background queue) and the pair
/// delegate callbacks (main runloop), so a small lock is the simplest
/// way to keep both maps coherent.
let pairLock = NSLock()
/// In-flight `IOBluetoothDevicePair` keyed by BD_ADDR. The map holds
/// strong references so the pair object isn't deallocated mid-flow
/// (its `delegate` property is `weak`).
var pendingPairs: [String: (IOBluetoothDevicePair, PairDelegate)] = [:]
/// Per-address cooldown after a pair attempt finishes (success or
/// failure). Without this, every inquiry burst would re-trigger pair
/// against a device the user just declined, spamming the system dialog.
var pairCooldowns: [String: Date] = [:]
/// Currently-running inquiry, if any. We never run two in parallel.
var currentInquiry: IOBluetoothDeviceInquiry?

final class InquiryDelegate: NSObject, IOBluetoothDeviceInquiryDelegate {
    func deviceInquiryStarted(_ sender: IOBluetoothDeviceInquiry) {
        emit([
            "event": "inquiry_started",
            "length_s": Int(sender.inquiryLength),
        ])
    }

    func deviceInquiryDeviceFound(
        _ sender: IOBluetoothDeviceInquiry,
        device: IOBluetoothDevice
    ) {
        let name = device.name ?? ""
        let addr = device.addressString ?? ""
        guard !addr.isEmpty, name.hasPrefix(ARGS.prefix) else { return }
        let paired = device.isPaired()
        emit([
            "event": "inquiry_device",
            "bd_addr": addr,
            "name": name,
            "paired": paired,
            "rssi": Int(device.rawRSSI()),
        ])
        // Already-paired devices are picked up by discoveryTick.
        if paired { return }
        guard ARGS.autoPair else { return }
        // Cooldown / dedupe gate before invoking the pair API.
        pairLock.lock()
        let isPending = pendingPairs[addr] != nil
        let cooldownUntil = pairCooldowns[addr]
        pairLock.unlock()
        if isPending { return }
        if let until = cooldownUntil, Date() < until {
            emit([
                "event": "pair_skipped",
                "bd_addr": addr,
                "name": name,
                "reason": "cooldown",
                "retry_in_s": Int(until.timeIntervalSinceNow),
            ])
            return
        }
        attemptPair(device)
    }

    func deviceInquiryComplete(
        _ sender: IOBluetoothDeviceInquiry,
        error: IOReturn,
        aborted: Bool
    ) {
        let count = sender.foundDevices().count
        emit([
            "event": "inquiry_complete",
            "code": String(format: "0x%x", error),
            "aborted": aborted,
            "found_count": count,
        ])
        if currentInquiry === sender { currentInquiry = nil }
    }
}

let inquiryDelegate = InquiryDelegate()

/// Runs at most one inquiry burst at a time, and only when no RFCOMM
/// open is in flight (`registry` empty). Apple's docs warn that mixing
/// inquiry with remote-name / channel-open work can deadlock the BT
/// stack; serializing with `discoveryTick` sidesteps that.
func runInquiryIfDue() {
    guard ARGS.inquiryEnabled else { return }
    guard currentInquiry == nil else { return }
    guard registry.allAddrs().isEmpty else {
        emit(["event": "inquiry_skipped", "reason": "rfcomm_in_flight"])
        return
    }
    guard let inq = IOBluetoothDeviceInquiry(delegate: inquiryDelegate) else {
        emit(["event": "inquiry_failed", "reason": "alloc_failed"])
        return
    }
    inq.inquiryLength = UInt8(ARGS.inquiryLengthSecs)
    inq.updateNewDeviceNames = true
    let r = inq.start()
    if r == kIOReturnSuccess {
        currentInquiry = inq
    } else {
        emit([
            "event": "inquiry_failed",
            "code": String(format: "0x%x", r),
        ])
    }
}

func attemptPair(_ device: IOBluetoothDevice) {
    let addr = device.addressString ?? ""
    let name = device.name ?? ""
    guard let pair = IOBluetoothDevicePair(device: device) else {
        emit([
            "event": "pair_failed",
            "bd_addr": addr,
            "name": name,
            "reason": "construct_failed",
        ])
        markPairCooldown(addr: addr)
        return
    }
    let delegate = PairDelegate(addr: addr, name: name)
    pair.delegate = delegate
    let r = pair.start()
    emit([
        "event": "pair_start",
        "bd_addr": addr,
        "name": name,
        "code": String(format: "0x%x", r),
    ])
    if r == kIOReturnSuccess {
        pairLock.lock()
        pendingPairs[addr] = (pair, delegate)
        pairLock.unlock()
    } else {
        markPairCooldown(addr: addr)
    }
}

func markPairCooldown(addr: String) {
    pairLock.lock()
    pairCooldowns[addr] = Date().addingTimeInterval(ARGS.pairCooldownSecs)
    pendingPairs.removeValue(forKey: addr)
    pairLock.unlock()
}

final class PairDelegate: NSObject, IOBluetoothDevicePairDelegate {
    let bdAddr: String
    let bdName: String

    init(addr: String, name: String) {
        self.bdAddr = addr
        self.bdName = name
        super.init()
    }

    func devicePairingStarted(_ sender: Any!) {
        emit(["event": "pair_phase", "bd_addr": bdAddr, "phase": "started"])
    }

    func devicePairingConnecting(_ sender: Any!) {
        emit(["event": "pair_phase", "bd_addr": bdAddr, "phase": "connecting"])
    }

    func devicePairingConnected(_ sender: Any!) {
        emit(["event": "pair_phase", "bd_addr": bdAddr, "phase": "connected"])
    }

    func devicePairingUserConfirmationRequest(
        _ sender: Any!,
        numericValue: BluetoothNumericValue
    ) {
        emit([
            "event": "pair_confirm",
            "bd_addr": bdAddr,
            "name": bdName,
            "numericValue": Int(numericValue),
        ])
        // Auto-confirm Just Works numeric. The PIM-* prefix is our
        // trust boundary; the eventual pim-protocol Hello handshake is
        // the real authentication gate. The system pair dialog is
        // shown by macOS itself in parallel — that gives the user the
        // veto power.
        if let p = sender as? IOBluetoothDevicePair {
            p.replyUserConfirmation(true)
        }
    }

    func devicePairingPINCodeRequest(_ sender: Any!) {
        emit(["event": "pair_pin_request", "bd_addr": bdAddr])
        // Legacy PIN flow shouldn't trigger for SSP-capable peers like
        // the Linux pim-daemon (which uses `NoInputNoOutput`). Reply
        // with "0000" defensively for headless legacy peers.
        if let p = sender as? IOBluetoothDevicePair {
            var pin = BluetoothPINCode()
            withUnsafeMutableBytes(of: &pin) { buf in
                guard buf.count >= 4 else { return }
                buf[0] = 0x30; buf[1] = 0x30; buf[2] = 0x30; buf[3] = 0x30
            }
            p.replyPINCode(4, pinCode: &pin)
        }
    }

    func devicePairingFinished(_ sender: Any!, error: IOReturn) {
        let ok = (error == kIOReturnSuccess)
        emit([
            "event": "pair_finished",
            "bd_addr": bdAddr,
            "name": bdName,
            "code": String(format: "0x%x", error),
            "ok": ok,
        ])
        markPairCooldown(addr: bdAddr)
        // No explicit RFCOMM open from here — `discoveryTick` will see
        // the device in `pairedDevices()` on its next pass (within
        // `--poll=N` seconds, default 30s) and run the existing
        // outbound channel flow.
    }
}

// MARK: - Inbound: register an RFCOMM channel listener
//
// The IOBluetoothRFCOMMChannel notification API calls the selector with
// TWO arguments — the IOBluetoothUserNotification and the channel — not
// a Foundation.Notification. Selector signature must match exactly,
// otherwise Swift's auto-bridging tries to cast IOBluetoothUserNotification
// to NSNotification and crashes with `unrecognized selector sent to
// instance` on -[IOBluetoothConcreteUserNotification name].

final class InboundHandler: NSObject {
    @objc func handleIncoming(
        _ userNotification: IOBluetoothUserNotification,
        channel ch: IOBluetoothRFCOMMChannel
    ) {
        guard let dev = ch.getDevice() else { ch.close(); return }
        let addr = dev.addressString ?? "unknown"
        let name = dev.name ?? ""
        // Filter to PIM-* peers; close anyone else.
        guard name.hasPrefix(ARGS.prefix) else { ch.close(); return }
        if registry.has(addr: addr) {
            // Outbound session already exists with this peer — drop the
            // duplicate inbound channel for now. Production may multiplex.
            ch.close(); return
        }
        let s = Session(addr: addr, name: name, channel: ch, initiator: false)
        ch.setDelegate(s)
        registry.put(s)
        emit(["event": "inbound", "bd_addr": addr, "name": name])
    }
}

let inboundHandler = InboundHandler()
let userInfoChannel: BluetoothRFCOMMChannelID = ARGS.rfcommChannel
IOBluetoothRFCOMMChannel.register(
    forChannelOpenNotifications: inboundHandler,
    selector: #selector(InboundHandler.handleIncoming(_:channel:)),
    withChannelID: userInfoChannel,
    direction: kIOBluetoothUserNotificationChannelDirectionIncoming
)

// MARK: - Main loop

emit([
    "event": "boot",
    "name": ARGS.localName,
    "node_id": ARGS.localNodeId,
    "prefix": ARGS.prefix,
    "channel": Int(ARGS.rfcommChannel),
    "poll_s": ARGS.pollInterval,
    "inquiry_enabled": ARGS.inquiryEnabled,
    "inquiry_interval_s": ARGS.inquiryIntervalSecs,
    "auto_pair": ARGS.autoPair,
])

DispatchQueue.global().async {
    var nextInquiry = Date()
    while true {
        // Inquiry runs FIRST so it gets a clean window to check
        // `registry.allAddrs().isEmpty`. If we ran discoveryTick first,
        // it would re-attempt RFCOMM on every paired device and re-fill
        // the registry; on a stuck peer (Linux RFCOMM module not
        // listening) the registry would never empty and inquiry would
        // never fire — auto-discovery would silently degrade.
        if Date() >= nextInquiry {
            runInquiryIfDue()
            nextInquiry = Date().addingTimeInterval(ARGS.inquiryIntervalSecs)
        }
        discoveryTick()
        Thread.sleep(forTimeInterval: ARGS.pollInterval)
    }
}

// Orphan watchdog: when the Tauri shell that spawned us dies (hot
// reload, `pnpm tauri dev` restart, app crash), `getppid()` flips to 1
// (launchd adopts us). Without this, every dev iteration leaks a
// sidecar — observed 28 stale processes accumulating in a single
// morning, all holding RFCOMM channel 22 in some indeterminate state.
// Polling once per second keeps the leak window short without
// measurable cost.
let initialParent = getppid()
DispatchQueue.global().async {
    while true {
        Thread.sleep(forTimeInterval: 1.0)
        let p = getppid()
        if p != initialParent {
            logErr("parent died (orig=\(initialParent), now=\(p)), exiting")
            exit(0)
        }
    }
}

RunLoop.main.run()
