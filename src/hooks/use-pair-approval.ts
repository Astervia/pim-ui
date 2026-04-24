/**
 * usePairApproval — global queue for inbound pair events + outbound pair
 * triggers + open/close state machine for the PairApprovalModal.
 *
 * Two trigger paths (02-CONTEXT §D-21):
 *   - INBOUND: a `peers.event { kind: "discovered" }` arrives with a
 *     non-null node_id. Treated as a potential pair handshake; the
 *     discovered entry is pushed onto the internal queue and the modal
 *     opens in inbound mode. Anonymous discoveries (node_id === null)
 *     are skipped — D-20 hides pairing for anonymous announcements.
 *   - OUTBOUND: user clicks `[ Pair ]` on a Nearby row. The Nearby
 *     component invokes `requestOutbound(discovered)`, which pushes onto
 *     the queue and opens the modal in outbound mode.
 *
 * Queue behavior (D-22):
 *   - Only ONE modal open at a time.
 *   - Second trigger while current is open → enqueued silently.
 *   - `close()` pops the next queued trigger (if any) after microtask.
 *   - Queue depth is logged via console.info for diagnostic traceability;
 *     NOT surfaced in the UI.
 *
 * Pattern: module-level atom + useSyncExternalStore, mirroring the other
 * Phase-2 hooks. The subscription to `peers.event` is established on the
 * first hook mount (guarded by `subscribed` flag) via the W1 fan-out in
 * useDaemonState.actions.subscribe — NO new Tauri listener.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useDaemonState } from "./use-daemon-state";
import type {
  PeerDiscovered,
  PeerEvent,
} from "@/lib/rpc-types";

export type PairApprovalMode = "inbound" | "outbound";

export interface PairApprovalTrigger {
  mode: PairApprovalMode;
  /**
   * Discovered-peer data driving the modal. Inbound mode uses the
   * payload that arrived on peers.event; outbound mode uses the
   * PeerDiscovered struct from the Nearby row the user clicked.
   */
  discovered: PeerDiscovered;
}

// ─── Module-level state ───────────────────────────────────────────

let current: PairApprovalTrigger | null = null;
const queue: PairApprovalTrigger[] = [];
const listeners = new Set<() => void>();

let subscribed = false;

function notify() {
  listeners.forEach((fn) => fn());
}

function subscribeLocal(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getCurrent(): PairApprovalTrigger | null {
  return current;
}

function openNext(): void {
  if (current !== null) return; // a modal is already open
  const next = queue.shift();
  if (next === undefined) return;
  current = next;
  notify();
}

/** Enqueue + open if free. Logs queue depth (D-22) when non-empty. */
function enqueue(trigger: PairApprovalTrigger): void {
  queue.push(trigger);
  if (current !== null) {
    // D-22: second event while modal open → queue silently, log depth.
    console.info(`pair queue: ${queue.length} waiting`);
  }
  openNext();
}

function handlePeersEvent(evt: PeerEvent): void {
  // D-21 inbound trigger: discovered kind with non-null node_id only.
  if (evt.kind === "discovered") {
    const discovered = evt.peer as PeerDiscovered;
    if (discovered.node_id === null) return; // D-20 anonymous — skip
    enqueue({ mode: "inbound", discovered });
  }
}

// ─── Public hook ──────────────────────────────────────────────────

export interface UsePairApprovalResult {
  current: PairApprovalTrigger | null;
  /** Depth of the internal queue (D-22 diagnostic, not for UI). */
  queueDepth: number;
  /** Called by Nearby row `[ Pair ]` click — opens modal in outbound mode. */
  requestOutbound: (discovered: PeerDiscovered) => void;
  /** Called by modal on Decline / Cancel / Trust-and-connect completion. */
  close: () => void;
}

export function usePairApproval(): UsePairApprovalResult {
  const { actions } = useDaemonState();

  useEffect(() => {
    if (subscribed === true) return;
    subscribed = true;
    actions
      .subscribe("peers.event", handlePeersEvent)
      .catch((e) => {
        subscribed = false;
        console.warn("usePairApproval subscribe failed:", e);
      });
    // No teardown — the pair-approval queue is app-global; the subscription
    // lives for the process lifetime once activated.
  }, [actions]);

  const currentValue = useSyncExternalStore(
    subscribeLocal,
    getCurrent,
    getCurrent,
  );

  const requestOutbound = useCallback((discovered: PeerDiscovered) => {
    enqueue({ mode: "outbound", discovered });
  }, []);

  const close = useCallback(() => {
    if (current === null) return;
    current = null;
    notify();
    // D-22: open next queued trigger on the next microtask so the modal
    // fully unmounts before the next one opens (Radix Dialog focus-trap
    // cleanup plays nicely this way).
    setTimeout(openNext, 0);
  }, []);

  return {
    current: currentValue,
    queueDepth: queue.length,
    requestOutbound,
    close,
  };
}

// Exposed for tests to reset module state between cases.
export const __test_resetPairApproval = (): void => {
  current = null;
  queue.length = 0;
  listeners.clear();
  subscribed = false;
};
