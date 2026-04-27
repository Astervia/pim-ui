/**
 * use-gated-navigation — D-13 nav-away interception.
 * Phase 3 Plan 03-04 §Part H.3 (addresses checker Blocker 1).
 *
 * Replaces the Sidebar / AppShell-keyboard direct calls to
 * `useActiveScreen().setActive(id)` with `requestActive(id)` so the
 * navigation can be gated by dirty-section state:
 *
 *   - If `getDirtySections().length === 0`, the request goes straight
 *     to `setActive(id)` (no dialog).
 *   - Otherwise the request is stashed in a module atom + a dialog is
 *     opened. On `[ Discard ]`, `emitDiscardReset("all")` fans out to
 *     reset every section's react-hook-form, and `setActive(target)` is
 *     called. On `[ Stay ]`, the pending request is cleared and
 *     navigation is aborted.
 *
 * Why a module atom (mirrors useActiveScreen / useDaemonState pattern):
 *   - The trigger (Sidebar button click, AppShell keyboard handler)
 *     and the consumer (ActiveScreen mounting the dialog) are sibling
 *     components — sharing state via a module atom avoids prop
 *     drilling and matches every other Phase 3 cross-component channel.
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { useSyncExternalStore } from "react";
import {
  useActiveScreen,
  type ActiveScreenId,
} from "@/hooks/use-active-screen";
import {
  emitDiscardReset,
  getDirtySections,
} from "@/hooks/use-dirty-sections";

interface PendingNav {
  target: ActiveScreenId;
}

let pending: PendingNav | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function get(): PendingNav | null {
  return pending;
}

/**
 * Non-hook setter — called by the gated requestActive flow + the
 * discard-dialog on Discard / Stay. Module-scope keeps writes outside
 * render so the Sidebar's onClick can fire setPending() without a
 * useState dance.
 */
function setPending(next: PendingNav | null): void {
  if (pending === next) return;
  pending = next;
  notify();
}

/**
 * The replacement for `setActive(id)` from useActiveScreen. Routes
 * through the gate:
 *   - No dirty sections → call setActive(id) directly.
 *   - Otherwise → stash pending nav + open the dialog (the dialog is
 *     mounted by ActiveScreen and reads `usePendingNav()` to know what
 *     to render and what to do on Discard).
 *
 * Imported as a non-hook function by Sidebar / AppShell keyboard
 * handler — those callers don't sit in a React tree where a hook can
 * yield the underlying setActive directly. The setActive reference
 * comes from the module-level atom in use-active-screen.ts
 * (setActiveInternal / the public `setActive`); we look it up via a
 * shim that re-exports through the hook contract.
 */
export function requestActive(
  id: ActiveScreenId,
  setActive: (id: ActiveScreenId) => void,
): void {
  if (getDirtySections().length === 0) {
    setActive(id);
    return;
  }
  setPending({ target: id });
}

export interface UsePendingNavReturn {
  pending: PendingNav | null;
  /** Confirm Discard — fan-out reset + set active to the pending target. */
  discardAndProceed: () => void;
  /** Confirm Stay — clear pending; abort navigation. */
  stay: () => void;
}

/**
 * Consumed by the ActiveScreen wrapper component to mount the
 * DiscardUnsavedChangesAlertDialog when `pending !== null`. This hook
 * is the only React-tree consumer of the atom — the writers (Sidebar,
 * AppShell) call `requestActive()` directly without subscribing.
 */
export function usePendingNav(): UsePendingNavReturn {
  const value = useSyncExternalStore(subscribe, get, get);
  const { setActive } = useActiveScreen();
  return {
    pending: value,
    discardAndProceed: () => {
      const target = value?.target;
      if (target === undefined) return;
      emitDiscardReset("all");
      setPending(null);
      setActive(target);
    },
    stay: () => {
      setPending(null);
    },
  };
}

// Exposed for tests to reset module state between cases.
export const __test_resetPendingNavAtom = (): void => {
  pending = null;
  listeners.clear();
};
