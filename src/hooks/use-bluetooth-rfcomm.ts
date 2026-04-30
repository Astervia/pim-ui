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
  | { event: "open_failed"; bd_addr: string; name?: string; reason?: string }
  | { event: "peer_error"; bd_addr?: string; detail?: unknown }
  | { event: "sidecar_terminated"; code?: number | null; signal?: string | null }
  | { event: string; [k: string]: unknown };

/** Public hook surface. */
export interface BluetoothRfcommSnapshot {
  /** Discovered peers keyed by BD_ADDR (latest identity wins). */
  peers: BluetoothRfcommPeer[];
  /** True once the sidecar emitted its `boot` event. */
  sidecarUp: boolean;
  /** Last error reason emitted by the sidecar, if any. */
  lastError: string | null;
}

export function useBluetoothRfcomm(): BluetoothRfcommSnapshot {
  const [peers, setPeers] = useState<Map<string, BluetoothRfcommPeer>>(
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

  return { peers: peerArray, sidecarUp, lastError };
}

interface Handlers {
  upsert: (peer: BluetoothRfcommPeer) => void;
  remove: (bd_addr: string) => void;
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
    case "open_failed":
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
