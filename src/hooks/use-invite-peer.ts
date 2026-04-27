/**
 * useInvitePeer — app-wide "is the InvitePeerSheet open" atom.
 *
 * Phase 4 D-08 (04-CONTEXT.md). Pattern mirrors usePeerDetail verbatim:
 * module-level boolean atom + useSyncExternalStore. A single shell-level
 * mount of <InvitePeerSheet /> reads its open state from this atom; any
 * caller (PeerListPanel's [ Invite peer ] button, future palette entry,
 * etc.) flips the flag via open() / close().
 *
 * Why module-level (not per-component useState): the trigger lives on
 * the Dashboard while the Sheet is mounted at AppShell level, so they
 * MUST share the same boolean. Two useStates would diverge.
 *
 * W1 invariant: no new Tauri-side subscription added by this file —
 * this is a UI-only atom. The single Tauri event channel remains owned
 * by useDaemonState.
 *
 * Bang-free: open/close compare against the literal boolean (`=== true`
 * / `=== false`) so the no-exclamation grep gate (D-36) passes on this
 * file.
 */

import { useCallback, useSyncExternalStore } from "react";

// ─── Module-level atom ─────────────────────────────────────────────

let isOpen = false;
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

function getIsOpen(): boolean {
  return isOpen;
}

// ─── Public API ────────────────────────────────────────────────────

export interface UseInvitePeerResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function useInvitePeer(): UseInvitePeerResult {
  const current = useSyncExternalStore(subscribeLocal, getIsOpen, getIsOpen);
  const open = useCallback(() => {
    if (isOpen === true) return;
    isOpen = true;
    notify();
  }, []);
  const close = useCallback(() => {
    if (isOpen === false) return;
    isOpen = false;
    notify();
  }, []);
  return { isOpen: current, open, close };
}

// Exposed for tests to reset module state between cases.
export const __test_resetInvitePeerAtom = (): void => {
  isOpen = false;
  listeners.clear();
};
