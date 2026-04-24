/**
 * usePeerDetail — app-wide "which peer is selected for detail view" atom.
 *
 * Pattern mirrors useActiveScreen (module-level atom + useSyncExternalStore).
 * Single source of truth shared between Dashboard's `onPeerSelect` callback
 * (which dispatches `select(peer)`) and PeerDetailSheet (which reads `selected`
 * to decide whether to render + which peer to show).
 *
 * D-15/D-16 (02-CONTEXT): clicking a peer row opens the right-edge slide-over;
 * closing it (Esc, click-outside, × glyph) clears the selected peer.
 */

import { useCallback, useSyncExternalStore } from "react";
import type { PeerSummary } from "@/lib/rpc-types";

// ─── Module-level atom ─────────────────────────────────────────────

let selected: PeerSummary | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function subscribeLocal(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSelected(): PeerSummary | null {
  return selected;
}

// ─── Public API ────────────────────────────────────────────────────

export interface UsePeerDetailResult {
  selected: PeerSummary | null;
  select: (peer: PeerSummary) => void;
  close: () => void;
}

export function usePeerDetail(): UsePeerDetailResult {
  const current = useSyncExternalStore(subscribeLocal, getSelected, getSelected);
  const select = useCallback((peer: PeerSummary) => {
    selected = peer;
    notify();
  }, []);
  const close = useCallback(() => {
    if (selected === null) return;
    selected = null;
    notify();
  }, []);
  return { selected: current, select, close };
}

// Exposed for tests to reset module state between cases.
export const __test_resetPeerDetailAtom = (): void => {
  selected = null;
  listeners.clear();
};
