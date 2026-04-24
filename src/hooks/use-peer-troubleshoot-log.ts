/**
 * usePeerTroubleshootLog — per-peer in-memory ring buffer of the last
 * 25 `peers.event` entries scoped to that peer (02-CONTEXT D-17 §4,
 * 02-UI-SPEC §Peer Detail §Section 4).
 *
 * Design:
 *   - Module-level `Map<node_id, LogEntry[]>` holds up to 25 entries
 *     per peer, most-recent first.
 *   - A single subscription to `peers.event` is registered via
 *     `useDaemonState.actions.subscribe` the first time any consumer
 *     mounts. The W1 fan-out guarantees this does NOT add a Tauri
 *     listener — it adds a handler to the Set that the Phase-1 Plan-03
 *     rpcEvent listener already dispatches to.
 *   - When the last consumer unmounts, the subscription is torn down.
 *
 * No persistence — the buffer is cleared on page reload (intentional;
 * the troubleshoot log is a live session diagnostic, not history).
 *
 * Anonymous PeerDiscovered entries (`node_id === null`) are skipped —
 * we key by `node_id` and anonymous peers cannot be retrieved by the
 * Peer Detail slide-over anyway (the slide-over renders PeerSummary,
 * which always carries a node_id).
 */

import { useEffect, useSyncExternalStore } from "react";
import { useDaemonState } from "./use-daemon-state";
import type {
  DaemonSubscription,
} from "@/lib/rpc";
import type {
  PeerDiscovered,
  PeerEvent,
  PeerEventKind,
  PeerSummary,
} from "@/lib/rpc-types";

export interface PeerLogEntry {
  /** ISO-8601 timestamp as emitted by the daemon. */
  at: string;
  kind: PeerEventKind;
  /** Present for `disconnected` / `pair_failed` (and sometimes others). */
  reason?: string;
}

// ─── Module-level state ───────────────────────────────────────────

const MAX_ENTRIES = 25;
const buffers = new Map<string, PeerLogEntry[]>();
const listeners = new Set<() => void>();

let refCount = 0;
let subscription: DaemonSubscription | null = null;
let subscribing = false;

function notify() {
  listeners.forEach((fn) => fn());
}

function pushEntry(nodeId: string, entry: PeerLogEntry): void {
  const prior = buffers.get(nodeId) ?? [];
  const next = [entry, ...prior].slice(0, MAX_ENTRIES);
  buffers.set(nodeId, next);
  notify();
}

function handlePeersEvent(evt: PeerEvent): void {
  // Narrow on the wire `kind`. `discovered` carries PeerDiscovered;
  // every other kind carries PeerSummary.
  if (evt.kind === "discovered") {
    const peer = evt.peer as PeerDiscovered;
    if (peer.node_id === null) return; // anonymous — skip
    pushEntry(peer.node_id, { at: evt.at, kind: evt.kind, reason: evt.reason });
    return;
  }
  const peer = evt.peer as PeerSummary;
  if (peer.node_id === undefined || peer.node_id === null || peer.node_id === "") return;
  pushEntry(peer.node_id, { at: evt.at, kind: evt.kind, reason: evt.reason });
}

// ─── Public hook ──────────────────────────────────────────────────

/**
 * Return the (reactive) troubleshoot-log entries for the given peer.
 *
 * Empty array when:
 *   - nodeId is null / undefined (no peer selected)
 *   - no events have been recorded for this peer this session
 */
export function usePeerTroubleshootLog(
  nodeId: string | null | undefined,
): PeerLogEntry[] {
  const { actions } = useDaemonState();

  useEffect(() => {
    refCount += 1;
    // First consumer starts the subscription. Guard against a concurrent
    // second-consumer mount racing the first subscribe() resolution.
    if (refCount === 1 && subscription === null && subscribing === false) {
      subscribing = true;
      actions
        .subscribe("peers.event", handlePeersEvent)
        .then((sub) => {
          subscription = sub;
          subscribing = false;
        })
        .catch((e) => {
          subscribing = false;
          console.warn("usePeerTroubleshootLog subscribe failed:", e);
        });
    }
    return () => {
      refCount -= 1;
      if (refCount === 0 && subscription !== null) {
        const s = subscription;
        subscription = null;
        s.unsubscribe().catch((e) =>
          console.warn("usePeerTroubleshootLog unsubscribe failed:", e),
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
    () =>
      nodeId === null || nodeId === undefined
        ? EMPTY
        : buffers.get(nodeId) ?? EMPTY,
    () =>
      nodeId === null || nodeId === undefined
        ? EMPTY
        : buffers.get(nodeId) ?? EMPTY,
  );
}

// Shared empty-array singleton so `usePeerTroubleshootLog(null)` returns
// a stable reference across renders (React 19 compiler + downstream memo
// friendly).
const EMPTY: PeerLogEntry[] = [];

// Exposed for tests to reset module state between cases.
export const __test_resetTroubleshootLog = (): void => {
  buffers.clear();
  listeners.clear();
  refCount = 0;
  subscription = null;
  subscribing = false;
};
