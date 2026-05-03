/**
 * useDiscoveredPeers — module-level atom of peers we've learned about
 * via routed (broadcast) `PeerInfo` only — i.e. nodes we have an
 * X25519 cache entry for but have neither a direct session nor a
 * message-history row with.
 *
 * Mirrors the conversations/messages atoms (single shared subscription
 * + useSyncExternalStore). Resets on daemon reconnect — pure runtime
 * state. A future `peers.list_known_identities` RPC could seed this
 * from `peers_seen` so the list survives reload; for v1 we accumulate
 * what arrives during the session.
 */

import { useEffect, useSyncExternalStore } from "react";
import { useDaemonState } from "./use-daemon-state";
import type { DaemonSubscription } from "@/lib/rpc";
import type { MessageEvent } from "@/lib/rpc-types";

export interface DiscoveredPeer {
  /** 32-char lowercase hex NodeId. */
  nodeId: string;
  /** Latest friendly name from the broadcast. */
  name: string;
  /** Wall-clock (ms since epoch) of the most recent broadcast we
   *  accepted from this peer. Useful for sorting "recently seen". */
  lastSeenMs: number;
}

const EMPTY: DiscoveredPeer[] = [];

let entries: Map<string, DiscoveredPeer> = new Map();
const listeners = new Set<() => void>();

let refCount = 0;
let subscription: DaemonSubscription | null = null;
let subscribing = false;

function snapshot(): DiscoveredPeer[] {
  if (entries.size === 0) return EMPTY;
  return [...entries.values()].sort((a, b) => b.lastSeenMs - a.lastSeenMs);
}

let cachedSnapshot: DiscoveredPeer[] = EMPTY;

function notify(): void {
  cachedSnapshot = snapshot();
  listeners.forEach((fn) => fn());
}

function applyEvent(evt: MessageEvent): void {
  // history_cleared { scope: all } also drops every discovered row —
  // those entries are pure-runtime state that follows the keystore.
  if (evt.kind === "history_cleared" && evt.scope === "all") {
    if (entries.size === 0) return;
    entries = new Map();
    notify();
    return;
  }
  if (evt.kind !== "peer_seen") return;
  // x25519_known=false is the peer-forget signal — drop the entry
  // regardless of the via discriminator (the daemon emits this with
  // via="direct" because the user explicitly forgot, not the broadcast
  // path).
  if (evt.x25519_known === false) {
    if (!entries.has(evt.peer_node_id)) return;
    entries = new Map(entries);
    entries.delete(evt.peer_node_id);
    notify();
    return;
  }
  if (evt.via !== "routed") return;
  const prior = entries.get(evt.peer_node_id);
  const next: DiscoveredPeer = {
    nodeId: evt.peer_node_id,
    name: evt.name,
    lastSeenMs: Date.now(),
  };
  if (
    prior !== undefined &&
    prior.name === next.name &&
    prior.lastSeenMs === next.lastSeenMs
  ) {
    return;
  }
  entries = new Map(entries);
  entries.set(evt.peer_node_id, next);
  notify();
}

export function useDiscoveredPeers(): DiscoveredPeer[] {
  const { actions } = useDaemonState();

  useEffect(() => {
    refCount += 1;
    if (refCount === 1 && subscription === null && subscribing === false) {
      subscribing = true;
      actions
        .subscribe("messages.event", applyEvent)
        .then((sub) => {
          subscription = sub;
          subscribing = false;
        })
        .catch((e) => {
          subscribing = false;
          console.warn("useDiscoveredPeers subscribe failed:", e);
        });
    }
    return () => {
      refCount -= 1;
      if (refCount === 0 && subscription !== null) {
        const s = subscription;
        subscription = null;
        s.unsubscribe().catch((e) =>
          console.warn("useDiscoveredPeers unsubscribe failed:", e),
        );
      }
    };
  }, [actions]);

  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => cachedSnapshot,
    () => cachedSnapshot,
  );
}

export const __test_resetDiscoveredPeers = (): void => {
  entries = new Map();
  cachedSnapshot = EMPTY;
  listeners.clear();
  refCount = 0;
  subscription = null;
  subscribing = false;
};
