/**
 * useConversations — reactive list of message conversations, sorted by
 * most-recent activity.
 *
 * Mirrors usePeerTroubleshootLog's pattern (single shared subscription,
 * module-level atom, useSyncExternalStore for fan-out). Plain
 * `actions.subscribe` keeps the W1 invariant (zero new Tauri listen
 * calls).
 */
import { useEffect, useSyncExternalStore } from "react";
import { useDaemonState } from "./use-daemon-state";
import { callDaemon } from "@/lib/rpc";
import type { DaemonSubscription } from "@/lib/rpc";
import type {
  ConversationSummary,
  MessageEvent,
} from "@/lib/rpc-types";

const EMPTY: ConversationSummary[] = [];

let conversations: ConversationSummary[] = EMPTY;
const listeners = new Set<() => void>();

let refCount = 0;
let subscription: DaemonSubscription | null = null;
let subscribing = false;
let initialFetchInFlight = false;

function notify() {
  listeners.forEach((fn) => fn());
}

function setConversations(next: ConversationSummary[]): void {
  conversations = next;
  notify();
}

async function fetchInitial(): Promise<void> {
  if (initialFetchInFlight === true) return;
  initialFetchInFlight = true;
  try {
    const r = await callDaemon("messages.list_conversations", null);
    setConversations(r.conversations);
  } catch (e) {
    console.warn("messages.list_conversations failed:", e);
  } finally {
    initialFetchInFlight = false;
  }
}

function applyEvent(evt: MessageEvent): void {
  if (evt.kind === "message_received") {
    const incoming = evt.conversation;
    const next = [
      incoming,
      ...conversations.filter(
        (c) => c.peer_node_id !== incoming.peer_node_id,
      ),
    ];
    setConversations(next);
    return;
  }
  if (evt.kind === "peer_seen") {
    // Update the matching conversation row's name if we know about it
    // already; no new row when the peer has not yet exchanged a message.
    let touched: boolean = false;
    const next = conversations.map((c) => {
      if (c.peer_node_id === evt.peer_node_id && c.name !== evt.name) {
        touched = true;
        return { ...c, name: evt.name };
      }
      return c;
    });
    if ((touched as boolean) === true) {
      setConversations(next);
    }
    return;
  }
  // message_status — refetch the affected conversation cheaply for now
  // (only impacts last_message_preview's status indicator). Server-side
  // we could push the full ConversationSummary; deferred to v1.1.
  void fetchInitial();
}

export function useConversations(): ConversationSummary[] {
  const { actions } = useDaemonState();

  useEffect(() => {
    refCount += 1;
    if (refCount === 1 && subscription === null && subscribing === false) {
      subscribing = true;
      void fetchInitial();
      actions
        .subscribe("messages.event", applyEvent)
        .then((sub) => {
          subscription = sub;
          subscribing = false;
        })
        .catch((e) => {
          subscribing = false;
          console.warn("useConversations subscribe failed:", e);
        });
    }
    return () => {
      refCount -= 1;
      if (refCount === 0 && subscription !== null) {
        const s = subscription;
        subscription = null;
        s.unsubscribe().catch((e) =>
          console.warn("useConversations unsubscribe failed:", e),
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
    () => conversations,
    () => conversations,
  );
}

/** Manual refresh — used after explicit user actions like
 *  marking a conversation as read.  */
export function refreshConversations(): Promise<void> {
  return fetchInitial();
}

export const __test_resetConversations = (): void => {
  conversations = EMPTY;
  listeners.clear();
  refCount = 0;
  subscription = null;
  subscribing = false;
  initialFetchInFlight = false;
};
