/**
 * useBluetoothRfcomm — subscribe to Bluetooth RFCOMM auto-discovery events.
 *
 * The Tauri Rust side spawns the `pim-bt-rfcomm-mac` Swift sidecar at
 * app boot (macOS only) and forwards every newline-delimited JSON event
 * from its stdout onto the `bluetooth-rfcomm://event` Tauri event
 * channel. This hook listens to that channel and keeps a live map of
 * peers by `bd_addr`.
 *
 * Phase 7 spike scope: discovery only. Mesh transport (carrying actual
 * pim-protocol frames over the same RFCOMM channel) is the next round.
 */

import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { callDaemon } from "@/lib/rpc";

/**
 * Discovered peer payload — matches the `peer` object emitted by the
 * sidecar's `discovered` event, plus a derived `lastSeen` ISO string.
 *
 * Field provenance:
 *   - `bd_addr`, `name`, `caps`, `node_id`, `platform`, `since` come
 *     verbatim from the Swift `Session::extractIdentity` payload.
 *   - `lastSeen` is the ISO timestamp of the most recent inbound event
 *     for this peer (refreshed on every `discovered` ping).
 */
export interface BluetoothRfcommPeer {
  bd_addr: string;
  name: string;
  node_id: string;
  platform: string; // "macos" | "linux" | other
  caps: string[];
  /** ISO-8601 timestamp set by the sidecar when the channel opened. */
  since: string;
  /** Mirror of `since` for the latest sighting. UI uses this for sort. */
  lastSeen: string;
}

/**
 * A PIM-* device the sidecar found via Bluetooth Classic inquiry but
 * the Mac hasn't paired with yet. Surfaced separately from `peers` so
 * the UI can show "discovered nearby — awaiting your approval in the
 * macOS pair dialog" while the user clicks Pair (or for the cooldown
 * window after they declined).
 *
 * The auto-pair flow lives entirely in the sidecar: inquiry surfaces
 * the device, IOBluetoothDevicePair runs against it, macOS shows its
 * native pair dialog, and on success the device graduates to `peers`
 * via the existing `discoveryTick` → RFCOMM open path. This struct
 * exists purely for UI feedback during that asynchronous wait.
 */
export interface BluetoothRfcommPairable {
  bd_addr: string;
  name: string;
  /** RSSI at the moment of inquiry (negative dBm, closer to 0 = stronger). */
  rssi: number;
  /**
   * `null` = inquiry just found it, pair not started yet.
   * `started`/`connecting`/`connected`/`confirm` = pair in progress;
   * macOS dialog has been shown or is about to be.
   */
  pairing: { phase: "started" | "connecting" | "connected" | "confirm" } | null;
  /**
   * Last `pair_finished` outcome with `ok: false` — set when the user
   * clicked Cancel in the system dialog or pairing failed for any
   * other reason. `cooldownUntil` (ISO) tells the UI when the sidecar
   * will retry; until then we keep the failed entry visible.
   */
  failed?: { code: string; cooldownUntil: string };
  /** ISO-8601 timestamp of the most recent inquiry sighting. */
  lastSeen: string;
}

/**
 * A paired PIM-* device whose RFCOMM open didn't complete. Apple's
 * IOBluetooth has no public timeout on `openRFCOMMChannelAsync`, so
 * the sidecar arms its own `open_timeout` watchdog (default 8s).
 * When that fires, we surface the device here so the UI can explain
 * "paired and reachable at the BT layer, but the peer's RFCOMM
 * service isn't bound" — instead of going silent. Most common cause:
 * the remote pim-daemon's RFCOMM module isn't running.
 *
 * Entries auto-clear when the same `bd_addr` appears in `peers`
 * (next discoveryTick poll succeeds) or when the user unpairs.
 */
export interface BluetoothRfcommAttempt {
  bd_addr: string;
  name: string;
  channel: number;
  state: "in_progress" | "open_timeout" | "open_failed";
  /** ISO timestamp of the most recent state transition. */
  lastAt: string;
  /** Sidecar-emitted error code/string (open_failed only). */
  errorCode?: string;
  /** Seconds the open was allowed to hang before timing out. */
  timeoutAfterSecs?: number;
}

/**
 * Variants of the raw event coming out of `bluetooth-rfcomm://event`.
 * Anything outside this shape is ignored so the Rust ↔ Swift contract
 * can grow without breaking the UI.
 */
type RawEvent =
  | { event: "boot"; [k: string]: unknown }
  | { event: "listening"; [k: string]: unknown }
  | { event: "scan_attempt"; bd_addr: string; name?: string; channel?: number }
  | { event: "inbound"; bd_addr: string; name?: string }
  | { event: "discovered"; peer: BluetoothRfcommPeer & Record<string, unknown> }
  | {
      /**
       * The sidecar has opened a 127.0.0.1 TCP listener that bridges
       * verbatim to the post-handshake RFCOMM channel. The hook RPCs
       * the daemon to connect through it so this BT peer becomes a
       * normal TCP-transport peer to the rest of the kernel.
       */
      event: "bridge_ready";
      bd_addr: string;
      name?: string;
      node_id: string;
      port: number;
    }
  | {
      event: "bridge_failed";
      bd_addr: string;
      name?: string;
      reason?: string;
    }
  | { event: "lost"; peer: { bd_addr?: string; node_id?: string; [k: string]: unknown }; reason?: string }
  | { event: "open_failed"; bd_addr: string; name?: string; reason?: string; code?: string }
  | {
      /**
       * Sidecar's open watchdog fired — IOBluetooth accepted the
       * request but never invoked `rfcommChannelOpenComplete` within
       * `after_s`. Almost always means the remote SDP advertises the
       * channel but no service backs it (e.g. BlueZ default Serial
       * Port record with no listener). Surface this so the UI
       * explains the silent-failure mode.
       */
      event: "open_timeout";
      bd_addr: string;
      name: string;
      channel: number;
      after_s: number;
    }
  | { event: "peer_error"; bd_addr?: string; detail?: unknown }
  | { event: "sidecar_terminated"; code?: number | null; signal?: string | null }
  // ── auto-discovery (BT inquiry) ────────────────────────────────────
  | { event: "inquiry_started"; length_s: number }
  | {
      event: "inquiry_device";
      bd_addr: string;
      name: string;
      paired: boolean;
      rssi: number;
    }
  | {
      event: "inquiry_complete";
      code: string;
      aborted: boolean;
      found_count: number;
    }
  | { event: "inquiry_skipped"; reason: string }
  | { event: "inquiry_failed"; code?: string; reason?: string }
  // ── auto-pair (IOBluetoothDevicePair) ──────────────────────────────
  | { event: "pair_start"; bd_addr: string; name: string; code: string }
  | {
      event: "pair_phase";
      bd_addr: string;
      phase: "started" | "connecting" | "connected";
    }
  | {
      event: "pair_confirm";
      bd_addr: string;
      name: string;
      numericValue: number;
    }
  | { event: "pair_pin_request"; bd_addr: string }
  | {
      event: "pair_skipped";
      bd_addr: string;
      name: string;
      reason: string;
      retry_in_s?: number;
    }
  | {
      event: "pair_failed";
      bd_addr: string;
      name?: string;
      reason: string;
    }
  | {
      event: "pair_finished";
      bd_addr: string;
      name: string;
      code: string;
      ok: boolean;
    }
  | { event: string; [k: string]: unknown };

/** Public hook surface. */
export interface BluetoothRfcommSnapshot {
  /** Discovered peers keyed by BD_ADDR (latest identity wins). */
  peers: BluetoothRfcommPeer[];
  /**
   * PIM-* devices the sidecar's BT inquiry surfaced but the Mac hasn't
   * paired with yet. Entries are auto-removed once they show up in
   * `peers` (i.e. paired + RFCOMM handshake done). Entries with a
   * `failed` field are kept until the sidecar's per-address cooldown
   * expires; the UI uses them to explain "we tried, you cancelled".
   */
  pairables: BluetoothRfcommPairable[];
  /**
   * In-flight or stalled RFCOMM open attempts against paired devices.
   * `in_progress` = open request sent, awaiting `OpenComplete`.
   * `open_timeout`/`open_failed` = the peer is reachable at the BT
   * layer but the RFCOMM handshake didn't complete (most often: the
   * remote pim-daemon's RFCOMM module isn't running). Auto-clears
   * when the same `bd_addr` appears in `peers`.
   */
  attempts: BluetoothRfcommAttempt[];
  /** True once the sidecar emitted its `boot` event. */
  sidecarUp: boolean;
  /** Last error reason emitted by the sidecar, if any. */
  lastError: string | null;
}

export function useBluetoothRfcomm(): BluetoothRfcommSnapshot {
  const [peers, setPeers] = useState<Map<string, BluetoothRfcommPeer>>(
    () => new Map(),
  );
  const [pairables, setPairables] = useState<
    Map<string, BluetoothRfcommPairable>
  >(() => new Map());
  const [attempts, setAttempts] = useState<Map<string, BluetoothRfcommAttempt>>(
    () => new Map(),
  );
  const [sidecarUp, setSidecarUp] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    let cancelled = false;

    const handlers: Handlers = {
      upsert: (p) =>
        setPeers((prev) => {
          const next = new Map(prev);
          next.set(p.bd_addr, p);
          return next;
        }),
      remove: (bd_addr) =>
        setPeers((prev) => {
          const next = new Map(prev);
          next.delete(bd_addr);
          return next;
        }),
      pairableUpsert: (p) =>
        setPairables((prev) => {
          const next = new Map(prev);
          // Merge with existing entry so phased `pair_phase` events
          // don't clobber rssi/lastSeen captured from `inquiry_device`.
          // We treat each input field as authoritative if present,
          // otherwise inherit from the prior snapshot. Defaults
          // ensure the resulting object is a fully-formed
          // `BluetoothRfcommPairable` even on the first sighting.
          const existing = next.get(p.bd_addr);
          const merged: BluetoothRfcommPairable = {
            bd_addr: p.bd_addr,
            name: p.name ?? existing?.name ?? "",
            rssi: p.rssi ?? existing?.rssi ?? 0,
            pairing:
              p.pairing !== undefined ? p.pairing : existing?.pairing ?? null,
            failed: p.failed ?? existing?.failed,
            lastSeen: p.lastSeen ?? existing?.lastSeen ?? new Date().toISOString(),
          };
          next.set(p.bd_addr, merged);
          return next;
        }),
      pairableRemove: (bd_addr) =>
        setPairables((prev) => {
          if (!prev.has(bd_addr)) return prev;
          const next = new Map(prev);
          next.delete(bd_addr);
          return next;
        }),
      attemptUpsert: (a) =>
        setAttempts((prev) => {
          const next = new Map(prev);
          next.set(a.bd_addr, a);
          return next;
        }),
      attemptRemove: (bd_addr) =>
        setAttempts((prev) => {
          if (!prev.has(bd_addr)) return prev;
          const next = new Map(prev);
          next.delete(bd_addr);
          return next;
        }),
      markBoot: () => setSidecarUp(true),
      markError: (reason) => setLastError(reason),
      markTerminated: () => setSidecarUp(false),
    };

    // Subscribe FIRST (so any events emitted while we fetch the snapshot
    // are still captured), THEN replay the snapshot. The handlers are
    // idempotent on `discovered`/`lost` — replaying a duplicate event
    // just rewrites the same map entry.
    const subscribePromise = listen<RawEvent>(
      "bluetooth-rfcomm://event",
      (msg) => {
        if (cancelled) return;
        handleEvent(msg.payload, handlers);
      },
    );

    // Snapshot recovery — Tauri does not buffer events, so the sidecar's
    // `boot` and first `discovered` events typically fire before this
    // hook mounts. Replaying the Rust-side ring buffer rebuilds peer
    // state across that race.
    invoke<RawEvent[]>("bluetooth_rfcomm_snapshot")
      .then((events) => {
        if (cancelled) return;
        for (const ev of events) handleEvent(ev, handlers);
      })
      .catch((e: unknown) => {
        // Non-macOS targets won't have the command — silent fallback to
        // live-only mode is fine.
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.debug("bluetooth_rfcomm_snapshot unavailable:", e);
        }
      });

    subscribePromise
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unlisten = fn;
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLastError(`subscribe failed: ${String(e)}`);
        }
      });

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, []);

  // Stable array sorted by lastSeen DESC for deterministic UI rendering.
  const peerArray = useMemo(
    () =>
      Array.from(peers.values()).sort((a, b) =>
        b.lastSeen.localeCompare(a.lastSeen),
      ),
    [peers],
  );

  // Filter pairables whose bd_addr graduated to peers (sidecar fires
  // `discovered` after `pair_finished{ok}` → next discoveryTick → RFCOMM
  // open succeeds; the inquiry-side state is stale at that point).
  const pairableArray = useMemo(
    () =>
      Array.from(pairables.values())
        .filter((p) => !peers.has(p.bd_addr))
        .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)),
    [pairables, peers],
  );

  const attemptArray = useMemo(
    () =>
      Array.from(attempts.values())
        .filter((a) => !peers.has(a.bd_addr))
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    [attempts, peers],
  );

  return {
    peers: peerArray,
    pairables: pairableArray,
    attempts: attemptArray,
    sidecarUp,
    lastError,
  };
}

interface Handlers {
  upsert: (peer: BluetoothRfcommPeer) => void;
  remove: (bd_addr: string) => void;
  pairableUpsert: (pairable: Partial<BluetoothRfcommPairable> & { bd_addr: string }) => void;
  pairableRemove: (bd_addr: string) => void;
  attemptUpsert: (attempt: BluetoothRfcommAttempt) => void;
  attemptRemove: (bd_addr: string) => void;
  markBoot: () => void;
  markError: (reason: string) => void;
  markTerminated: () => void;
}

function handleEvent(raw: RawEvent, h: Handlers): void {
  switch (raw.event) {
    case "boot":
    case "listening":
      h.markBoot();
      return;
    case "discovered": {
      const peer = raw.peer as BluetoothRfcommPeer & Record<string, unknown>;
      if (typeof peer?.bd_addr !== "string") return;
      h.upsert({
        bd_addr: peer.bd_addr,
        name: typeof peer.name === "string" ? peer.name : "",
        node_id: typeof peer.node_id === "string" ? peer.node_id : "",
        platform: typeof peer.platform === "string" ? peer.platform : "unknown",
        caps: Array.isArray(peer.caps) ? (peer.caps as string[]) : [],
        since: typeof peer.since === "string" ? peer.since : "",
        lastSeen: new Date().toISOString(),
      });
      // Drop any inquiry-side pairable entry — the device graduated.
      h.pairableRemove(peer.bd_addr);
      // And drop any in-progress / failed attempt — RFCOMM completed.
      h.attemptRemove(peer.bd_addr);
      return;
    }
    case "scan_attempt": {
      const r = raw as Extract<RawEvent, { event: "scan_attempt" }>;
      if (typeof r.bd_addr !== "string") return;
      h.attemptUpsert({
        bd_addr: r.bd_addr,
        name: typeof r.name === "string" ? r.name : "",
        channel: typeof r.channel === "number" ? r.channel : 0,
        state: "in_progress",
        lastAt: new Date().toISOString(),
      });
      return;
    }
    case "open_failed": {
      const r = raw as Extract<RawEvent, { event: "open_failed" }>;
      if (typeof r.bd_addr === "string") {
        h.attemptUpsert({
          bd_addr: r.bd_addr,
          name: typeof r.name === "string" ? r.name : "",
          channel: 0,
          state: "open_failed",
          lastAt: new Date().toISOString(),
          errorCode:
            (typeof r.code === "string" && r.code) ||
            (typeof r.reason === "string" ? r.reason : undefined),
        });
      }
      const reason =
        (typeof r.reason === "string" && r.reason) ||
        (typeof r.code === "string" && `code=${r.code}`) ||
        "open_failed";
      h.markError(reason);
      return;
    }
    case "open_timeout": {
      const r = raw as Extract<RawEvent, { event: "open_timeout" }>;
      if (typeof r.bd_addr !== "string") return;
      h.attemptUpsert({
        bd_addr: r.bd_addr,
        name: typeof r.name === "string" ? r.name : "",
        channel: typeof r.channel === "number" ? r.channel : 0,
        state: "open_timeout",
        lastAt: new Date().toISOString(),
        timeoutAfterSecs:
          typeof r.after_s === "number" ? r.after_s : undefined,
      });
      return;
    }
    case "inquiry_device": {
      const r = raw as Extract<RawEvent, { event: "inquiry_device" }>;
      // Already-paired devices are tracked by discoveryTick / `peers`.
      // We only care about the unpaired ones here so the panel can
      // explain "discovered nearby — waiting for you to click Pair".
      if (r.paired) {
        h.pairableRemove(r.bd_addr);
        return;
      }
      h.pairableUpsert({
        bd_addr: r.bd_addr,
        name: r.name ?? "",
        rssi: typeof r.rssi === "number" ? r.rssi : 0,
        pairing: null,
        lastSeen: new Date().toISOString(),
      });
      return;
    }
    case "pair_start": {
      const r = raw as Extract<RawEvent, { event: "pair_start" }>;
      h.pairableUpsert({
        bd_addr: r.bd_addr,
        name: r.name ?? "",
        pairing: { phase: "started" },
        lastSeen: new Date().toISOString(),
      });
      return;
    }
    case "pair_phase": {
      const r = raw as Extract<RawEvent, { event: "pair_phase" }>;
      h.pairableUpsert({
        bd_addr: r.bd_addr,
        pairing: { phase: r.phase },
        lastSeen: new Date().toISOString(),
      });
      return;
    }
    case "pair_confirm": {
      const r = raw as Extract<RawEvent, { event: "pair_confirm" }>;
      h.pairableUpsert({
        bd_addr: r.bd_addr,
        name: r.name ?? "",
        pairing: { phase: "confirm" },
        lastSeen: new Date().toISOString(),
      });
      return;
    }
    case "pair_finished": {
      const r = raw as Extract<RawEvent, { event: "pair_finished" }>;
      if (r.ok) {
        // Drop from pairables; the upcoming `discovered` event will
        // promote it to `peers` (or fail to open RFCOMM, surfaced via
        // open_failed/open_timeout in a future iteration).
        h.pairableRemove(r.bd_addr);
        return;
      }
      // Pair attempt finished with error (often: user clicked Cancel).
      // Compute the cooldown window from the sidecar default (10 min)
      // unless the sidecar passes one explicitly later.
      const cooldownUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      h.pairableUpsert({
        bd_addr: r.bd_addr,
        name: r.name ?? "",
        pairing: null,
        failed: { code: r.code ?? "unknown", cooldownUntil },
        lastSeen: new Date().toISOString(),
      });
      return;
    }
    case "pair_skipped":
    case "pair_failed":
    case "pair_pin_request":
      // Diagnostic events — surfaced via lastError so the user has
      // some signal even if the panel UI doesn't render them. Most
      // are transient or rare.
      if ("reason" in raw && typeof raw.reason === "string") {
        h.markError(`pair: ${raw.reason}`);
      }
      return;
    case "inquiry_started":
    case "inquiry_complete":
    case "inquiry_skipped":
      // Phase transitions of the inquiry loop — useful for debugging
      // but no UI surface yet. The pairable list updates from the
      // per-device events.
      return;
    case "inquiry_failed": {
      const reason =
        ("reason" in raw && typeof raw.reason === "string" && raw.reason) ||
        ("code" in raw && typeof raw.code === "string" && `code=${raw.code}`) ||
        "inquiry_failed";
      h.markError(`inquiry: ${reason}`);
      return;
    }
    case "bridge_ready": {
      // Sidecar opened a 127.0.0.1 TCP listener bridging to RFCOMM.
      // RPC the daemon to dial it so the BT peer becomes a normal
      // TCP transport peer. Idempotent: callDaemon failures are
      // logged but not fatal — the discovery state is unchanged.
      const r = raw as Extract<RawEvent, { event: "bridge_ready" }>;
      if (
        typeof r.node_id === "string" &&
        r.node_id.length === 32 &&
        typeof r.port === "number" &&
        r.port > 0
      ) {
        const address = `127.0.0.1:${r.port}`;
        callDaemon("peers.connect_dynamic", {
          node_id: r.node_id,
          address,
        }).catch((e: unknown) => {
          // eslint-disable-next-line no-console
          console.warn(
            `peers.connect_dynamic failed for ${r.node_id} via ${address}:`,
            e,
          );
          h.markError(`bridge connect: ${String(e)}`);
        });
      }
      return;
    }
    case "bridge_failed": {
      const reason =
        ("reason" in raw && typeof raw.reason === "string" && raw.reason) ||
        "bridge_failed";
      h.markError(`bridge: ${reason}`);
      return;
    }
    case "lost": {
      const bd = (raw.peer as { bd_addr?: unknown })?.bd_addr;
      if (typeof bd === "string") h.remove(bd);
      return;
    }
    case "peer_error": {
      const reason =
        ("reason" in raw && typeof raw.reason === "string" && raw.reason) ||
        "peer_error";
      h.markError(reason);
      return;
    }
    case "sidecar_terminated":
      h.markTerminated();
      h.markError("sidecar terminated");
      return;
    default:
      // Unknown events are ignored — sidecar is allowed to add new ones.
      return;
  }
}
