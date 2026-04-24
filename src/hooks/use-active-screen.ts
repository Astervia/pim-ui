/**
 * useActiveScreen — app-wide navigation atom for the Phase-2 shell.
 *
 * D-01: client-side tab router via plain useState-style hook, no react-router.
 * D-02: "peers" is a distinct id but aliases to the Dashboard component in
 *       Phase 2 — we keep the id so the sidebar can highlight the correct
 *       active row and so Phase 3 can swap in a dedicated Peers screen
 *       without changing this union.
 *
 * Pattern: module-level atom + useSyncExternalStore, mirroring the
 * shape of useDaemonState. Multiple consumers (Sidebar, ActiveScreen,
 * AppShell keyboard handler) all read the same state via this hook.
 *
 * Phase 2: default is always "dashboard" — NO localStorage persistence.
 * The app boots to Dashboard every session; persistence can land later.
 */

import { useCallback, useSyncExternalStore } from "react";

// Union of screen ids the Phase-2 shell can render.
// Phase 3/4/5 will extend this union when routing/gateway/settings ship —
// the grayed sidebar rows for those ids do NOT live in this union, because
// they are not navigable targets in the current phase.
export type ActiveScreenId = "dashboard" | "peers" | "logs";

// ─── Module-level atom ─────────────────────────────────────────────

let active: ActiveScreenId = "dashboard";
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

function getActive(): ActiveScreenId {
  return active;
}

function setActiveInternal(next: ActiveScreenId): void {
  if (next === active) return;
  active = next;
  notify();
}

// ─── Public API ────────────────────────────────────────────────────

export interface UseActiveScreenResult {
  active: ActiveScreenId;
  setActive: (id: ActiveScreenId) => void;
}

export function useActiveScreen(): UseActiveScreenResult {
  const current = useSyncExternalStore(subscribeLocal, getActive, getActive);
  const setActive = useCallback((id: ActiveScreenId) => {
    setActiveInternal(id);
  }, []);
  return { active: current, setActive };
}

// Exposed for tests to reset module state between cases.
export const __test_resetActiveScreenAtom = (): void => {
  active = "dashboard";
  listeners.clear();
};
