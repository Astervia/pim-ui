/**
 * useMessageHistory — per-peer reactive history backed by `messages.history`
 * + live-merge of `messages.event`.
 *
 * Module-level Map<peer_node_id, MessageRecord[]> mirrors
 * usePeerTroubleshootLog. One shared subscription to `messages.event`
 * across all consumers; W1 invariant preserved.
 */
import { useEffect, useSyncExternalStore } from "react";
import { useDaemonState } from "./use-daemon-state";
import { callDaemon } from "@/lib/rpc";
import type { DaemonSubscription } from "@/lib/rpc";
import type { MessageEvent, MessageRecord } from "@/lib/rpc-types";

const PAGE_SIZE = 100;
const EMPTY: MessageRecord[] = [];

const buffers = new Map<string, MessageRecord[]>();
const listeners = new Set<() => void>();

let refCount = 0;
let subscription: DaemonSubscription | null = null;
let subscribing = false;

function notify(): void {
  listeners.forEach((fn) => fn());
}

function setForPeer(peer: string, next: MessageRecord[]): void {
  buffers.set(peer, next);
  notify();
}

async function fetchHistoryFor(peer: string): Promise<void> {
  try {
    const r = await callDaemon("messages.history", {
      peer_node_id: peer,
      limit: PAGE_SIZE,
    });
    // Daemon returns newest-first; UI wants oldest-at-top so we reverse.
    const oldestFirst = [...r.messages].reverse();
    setForPeer(peer, oldestFirst);
  } catch (e) {
    console.warn(`messages.history(${peer}) failed:`, e);
  }
}

function appendOrReplace(peer: string, record: MessageRecord): void {
  const prior = buffers.get(peer) ?? EMPTY;
  const idx = prior.findIndex((m) => m.id === record.id);
  if (idx >= 0) {
    const next = prior.slice();
    next[idx] = record;
    setForPeer(peer, next);
  } else {
    setForPeer(peer, [...prior, record]);
  }
}

function applyEvent(evt: MessageEvent): void {
  if (evt.kind === "message_received") {
    appendOrReplace(evt.message.peer_node_id, evt.message);
    return;
  }
  if (evt.kind === "history_cleared") {
    if (evt.scope === "all") {
      buffers.clear();
      notify();
      return;
    }
    if (evt.peer_node_id !== null) {
      buffers.delete(evt.peer_node_id);
      notify();
    }
    return;
  }
  if (evt.kind === "message_status") {
    const prior = buffers.get(evt.peer_node_id);
    if (prior === undefined) return;
    const idx = prior.findIndex((m) => m.id === evt.message_id);
    if (idx < 0) return;
    const target = prior[idx];
    if (target === undefined) return;
    const next = prior.slice();
    const updated: MessageRecord = {
      ...target,
      status: evt.new_status,
      delivered_at_ms:
        evt.new_status === "delivered" || evt.new_status === "read"
          ? evt.at_ms
          : target.delivered_at_ms,
      read_at_ms:
        evt.new_status === "read" ? evt.at_ms : target.read_at_ms,
    };
    next[idx] = updated;
    setForPeer(evt.peer_node_id, next);
    return;
  }
  // peer_seen — no message-level effect.
}

/**
 * Optimistic-add a freshly-sent record so the conversation pane reflects
 * the user's last input immediately, before the daemon round-trip.
 *
 * `replaceId` lets the post-send reconcile step swap the optimistic row
 * (keyed under `optimistic-…`) for the canonical record (keyed under the
 * daemon-issued UUID). Without it, the differing ids would cause the
 * merge to append a second row instead of replacing the first.
 */
export function injectOptimisticSend(
  record: MessageRecord,
  replaceId?: string,
): void {
  const peer = record.peer_node_id;
  if (replaceId !== undefined && replaceId !== record.id) {
    const prior = buffers.get(peer) ?? EMPTY;
    const idx = prior.findIndex((m) => m.id === replaceId);
    if (idx >= 0) {
      const next = prior.slice();
      next[idx] = record;
      setForPeer(peer, next);
      return;
    }
  }
  appendOrReplace(peer, record);
}

export function useMessageHistory(
  peer: string | null | undefined,
): MessageRecord[] {
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
          console.warn("useMessageHistory subscribe failed:", e);
        });
    }
    return () => {
      refCount -= 1;
      if (refCount === 0 && subscription !== null) {
        const s = subscription;
        subscription = null;
        s.unsubscribe().catch((e) =>
          console.warn("useMessageHistory unsubscribe failed:", e),
        );
      }
    };
  }, [actions]);

  useEffect(() => {
    if (peer === null || peer === undefined || peer === "") return;
    if (buffers.has(peer)) return; // already loaded this session
    void fetchHistoryFor(peer);
  }, [peer]);

  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () =>
      peer === null || peer === undefined || peer === ""
        ? EMPTY
        : buffers.get(peer) ?? EMPTY,
    () =>
      peer === null || peer === undefined || peer === ""
        ? EMPTY
        : buffers.get(peer) ?? EMPTY,
  );
}

export const __test_resetMessageHistory = (): void => {
  buffers.clear();
  listeners.clear();
  refCount = 0;
  subscription = null;
  subscribing = false;
};
