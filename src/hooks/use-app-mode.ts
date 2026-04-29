/**
 * useAppMode — global atom for the app "mode" (simple | advanced).
 *
 * `simple` mode renders the SimpleShell — a single TURN ON button and
 * an automated flow (start daemon → discovery → pair-on-confirm →
 * routing). `advanced` mode renders the full AppShell (sidebar,
 * dashboard, detailed settings, command palette, etc.).
 *
 * Persistence: localStorage["pim-ui.app-mode"]. Default = "simple"
 * for first-time users (UX-PLAN §2a, persona Aria). Returning users
 * keep the chosen mode across sessions.
 *
 * Pattern: module-level atom + useSyncExternalStore — same shape as
 * useActiveScreen / useDaemonState. Multiple consumers (AppRoot, the
 * header of each shell) share a single snapshot and re-render in
 * sync.
 *
 * W1: no Tauri listener introduced here — only localStorage.
 */

import { useCallback, useSyncExternalStore } from "react";

export type AppMode = "simple" | "advanced";

const STORAGE_KEY = "pim-ui.app-mode";
const DEFAULT_MODE: AppMode = "simple";

function readInitial(): AppMode {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "simple" || v === "advanced") return v;
  } catch {
    // localStorage unavailable (SSR / sandboxed env) — fall back.
  }
  return DEFAULT_MODE;
}

let mode: AppMode = readInitial();
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

function getMode(): AppMode {
  return mode;
}

function setModeInternal(next: AppMode): void {
  if (next === mode) return;
  mode = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Best-effort persistence.
  }
  notify();
}

export interface UseAppModeResult {
  mode: AppMode;
  setMode: (next: AppMode) => void;
  toggle: () => void;
}

export function useAppMode(): UseAppModeResult {
  const current = useSyncExternalStore(subscribe, getMode, getMode);
  const setMode = useCallback((next: AppMode) => setModeInternal(next), []);
  const toggle = useCallback(
    () => setModeInternal(mode === "simple" ? "advanced" : "simple"),
    [],
  );
  return { mode: current, setMode, toggle };
}

export const __test_resetAppMode = (): void => {
  mode = DEFAULT_MODE;
  listeners.clear();
};
