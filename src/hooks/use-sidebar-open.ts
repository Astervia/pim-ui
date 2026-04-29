/**
 * useSidebarOpen — module-level atom for the mobile sidebar drawer
 * open/close state. The sidebar is always-visible on md+ viewports
 * (≥768px) so this atom only meaningfully affects mobile chrome.
 *
 * Pattern: same shape as useActiveScreen / useCommandPalette —
 * module-level open boolean + listener set + useSyncExternalStore.
 *
 * The atom is also used to auto-close the drawer when the user picks
 * a nav row on mobile, so a tap doesn't leave the drawer hanging open
 * over the destination screen.
 */

import { useCallback, useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getOpen(): boolean {
  return open;
}

export function setSidebarOpen(next: boolean): void {
  if (next === open) return;
  open = next;
  notify();
}

export function toggleSidebar(): void {
  setSidebarOpen(open === false);
}

export interface UseSidebarOpenResult {
  open: boolean;
  setOpen: (next: boolean) => void;
  toggle: () => void;
  close: () => void;
}

export function useSidebarOpen(): UseSidebarOpenResult {
  const current = useSyncExternalStore(subscribe, getOpen, getOpen);
  const setOpen = useCallback(setSidebarOpen, []);
  const toggle = useCallback(toggleSidebar, []);
  const close = useCallback(() => setSidebarOpen(false), []);
  return { open: current, setOpen, toggle, close };
}
