/**
 * use-save-registry — module-level registry of per-section save callbacks.
 *
 * The Save-All affordance on the advanced settings page needs to drive
 * every dirty section's save flow without owning a reference to each
 * section's react-hook-form instance. Each useSectionSave registers its
 * own `() => Promise<void>` here on mount and unregisters on unmount;
 * Save-All reads the list via `getRegisteredSaves()` and awaits each
 * dirty section's callback sequentially.
 *
 * Why sequential, not parallel:
 *   assembleToml(base, { [sectionId]: values }) preserves every OTHER
 *   section verbatim from `base`. Two parallel saves would each see the
 *   pre-save `base`, and the last write to land would clobber the
 *   first section's mutation. By awaiting each save (which refetches
 *   `base` before returning), the next section's assembleToml sees the
 *   freshly-saved state and the saves compose correctly.
 *
 * No React tree involvement — just a Map + listener set, mirroring the
 * pattern in use-dirty-sections.ts.
 */

import type { SectionId } from "@/lib/config/section-schemas";

type SaveFn = () => Promise<void>;

const registry = new Map<SectionId, SaveFn>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => cb());
}

/** Register a section's save callback. Overwrites any previous entry. */
export function registerSectionSave(id: SectionId, fn: SaveFn): void {
  registry.set(id, fn);
  notify();
}

/** Unregister on unmount. No-op if not registered. */
export function unregisterSectionSave(id: SectionId): void {
  if (registry.delete(id) === true) {
    notify();
  }
}

/** Snapshot of the currently registered save callbacks. */
export function getRegisteredSaves(): Map<SectionId, SaveFn> {
  return new Map(registry);
}

/** Subscribe to registry changes — used by tests / future indicators. */
export function subscribeRegistry(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Test reset.
export const __test_resetSaveRegistry = (): void => {
  registry.clear();
  listeners.clear();
};
