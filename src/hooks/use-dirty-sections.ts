/**
 * use-dirty-sections — module atom tracking per-section dirty state.
 * Phase 3 Plan 03-04 §Part H.1 (addresses checker Blocker 1).
 *
 * Why a module atom:
 *   - useSectionSave (per react-hook-form instance) writes the form's
 *     `formState.isDirty` here on every change so non-React callers
 *     (active-screen.tsx nav-interception, stop-confirm-dialog.tsx Stop
 *     gate) can read getDirtySections() to decide whether to show the
 *     D-13 discard dialog before navigating away.
 *   - emitDiscardReset(id) fans-out a `pim:settings-discard-reset`
 *     CustomEvent so every mounted section's useSectionSave handler
 *     calls form.reset() in lockstep — no per-section refs leak.
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved —
 * window.dispatchEvent is browser-native, not @tauri-apps/api/event).
 */

import { useSyncExternalStore } from "react";
import { type SectionId, SECTION_IDS } from "@/lib/config/section-schemas";

interface DirtyEntry {
  dirty: boolean;
  dirtyFieldCount: number;
}

type DirtyMap = Record<SectionId, DirtyEntry>;

function emptyMap(): DirtyMap {
  return Object.fromEntries(
    SECTION_IDS.map((id) => [id, { dirty: false, dirtyFieldCount: 0 }]),
  ) as DirtyMap;
}

let atom: DirtyMap = emptyMap();
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

function get(): DirtyMap {
  return atom;
}

/**
 * Non-hook writer — called by use-section-save's useEffect on every
 * react-hook-form formState change. Module-scope keeps writes outside
 * the render tree.
 */
export function setSectionDirty(
  id: SectionId,
  dirty: boolean,
  dirtyFieldCount: number,
): void {
  const prev = atom[id];
  if (prev.dirty === dirty && prev.dirtyFieldCount === dirtyFieldCount) {
    return;
  }
  atom = { ...atom, [id]: { dirty, dirtyFieldCount } };
  notify();
}

/** Returns the list of sections currently dirty (and their field counts). */
export function getDirtySections(): Array<{
  id: SectionId;
  dirtyFieldCount: number;
}> {
  return SECTION_IDS.filter((id) => atom[id].dirty === true).map((id) => ({
    id,
    dirtyFieldCount: atom[id].dirtyFieldCount,
  }));
}

/**
 * Fan-out reset — active-screen / stop-confirm-dialog calls this to
 * notify every mounted section form to call form.reset() before
 * navigation proceeds. Sections listen via a window CustomEvent
 * `pim:settings-discard-reset` whose detail.id is the section to reset
 * or "all" to reset every dirty section at once.
 *
 * Optimistically clears the atom — the form.reset() handlers will echo
 * back via setSectionDirty(id, false, 0) on their next tick anyway,
 * but doing it here means getDirtySections() returns [] immediately
 * for the navigation continuation.
 */
export function emitDiscardReset(id: SectionId | "all"): void {
  window.dispatchEvent(
    new CustomEvent("pim:settings-discard-reset", { detail: { id } }),
  );
  if (id === "all") {
    atom = emptyMap();
  } else {
    atom = { ...atom, [id]: { dirty: false, dirtyFieldCount: 0 } };
  }
  notify();
}

export interface UseDirtySectionsReturn {
  sections: DirtyMap;
  dirtyIds: SectionId[];
  anyDirty: boolean;
}

export function useDirtySections(): UseDirtySectionsReturn {
  const map = useSyncExternalStore(subscribe, get, get);
  const dirtyIds = SECTION_IDS.filter((id) => map[id].dirty === true);
  return {
    sections: map,
    dirtyIds,
    anyDirty: dirtyIds.length > 0,
  };
}

// Exposed for tests to reset module state between cases.
export const __test_resetDirtySectionsAtom = (): void => {
  atom = emptyMap();
  listeners.clear();
};
