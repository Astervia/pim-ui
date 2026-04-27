/**
 * useCommandPalette — module-level atom for the ⌘K palette open state.
 *
 * Plan 05-05 D-28 + RESEARCH §7d: mirrors src/hooks/use-active-screen.ts
 * pattern — single atom + listeners + useSyncExternalStore. Multiple
 * consumers (AppShell keyboard handler, palette Dialog onOpenChange,
 * action handlers that call closePalette) read/write the same state.
 *
 * Replaces the Plan 05-01 stub. The export shape is unchanged so
 * AppShell's case "k": case "K": handler from Plan 05-01 keeps working
 * without a touch — Plan 05-01 imported { useCommandPalette } from this
 * module path; that import now resolves to the real atom.
 *
 * W1 invariant: this file contains zero Tauri listen() calls. The atom
 * is purely in-memory + browser-event-free.
 */

import { useCallback, useSyncExternalStore } from "react";

let open: boolean = false;
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

export function getPaletteOpen(): boolean {
  return open;
}

export function setPaletteOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  notify();
}

export function togglePalette(): void {
  setPaletteOpen(open === false);
}

export interface UseCommandPaletteResult {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export function useCommandPalette(): UseCommandPaletteResult {
  const current = useSyncExternalStore(subscribeLocal, getPaletteOpen, getPaletteOpen);
  const setOpen = useCallback(setPaletteOpen, []);
  const toggle = useCallback(togglePalette, []);
  return { open: current, setOpen, toggle };
}

// Exposed for tests to reset module state between cases — matches the
// __test_resetActiveScreenAtom convention in src/hooks/use-active-screen.ts.
export const __test_resetPaletteAtom = (): void => {
  open = false;
  listeners.clear();
};
