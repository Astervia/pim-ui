/**
 * use-section-raw-wins — per-section CONF-07 raw-wins flag atom.
 * Phase 3 Plan 03-04 §Part F (refactored per checker Blocker 3).
 *
 * After every successful save, useSectionSave re-fetches the
 * authoritative TOML doc, runs `diffSectionsAgainstSchema(parsed)` and
 * calls `setAllSectionRawWins(map)` to persist which sections currently
 * have keys the form view cannot represent. Sections render the
 * verbatim CONF-07 banner (`Raw is source of truth — form view shows
 * a subset`) when their flag is true.
 *
 * Persisted to localStorage under keys `pim-ui.section-raw-wins.{id}`
 * (D-15) so the flag survives reloads — the daemon is the source of
 * truth for the actual TOML, but the diff is a UI-side observation.
 *
 * Checker Blocker 3 resolution: the API was previously
 *   useSectionRawWins(id).setAll(map)
 * which conflated a per-section read with a whole-map write. The hook
 * is now strictly read-only; writers import `setAllSectionRawWins`
 * directly (a non-hook module function).
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { useSyncExternalStore } from "react";
import { type SectionId, SECTION_IDS } from "@/lib/config/section-schemas";

type RawWinsMap = Record<SectionId, boolean>;

const LS_PREFIX = "pim-ui.section-raw-wins.";

function loadFromStorage(): RawWinsMap {
  const out = {} as RawWinsMap;
  for (const id of SECTION_IDS) {
    out[id] = localStorage.getItem(LS_PREFIX + id) === "true";
  }
  return out;
}

function emptyMap(): RawWinsMap {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, false])) as RawWinsMap;
}

let atom: RawWinsMap =
  typeof localStorage !== "undefined" ? loadFromStorage() : emptyMap();

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

function get(): RawWinsMap {
  return atom;
}

/**
 * Read-only hook — returns `{ rawWins }` for the given section.
 *
 * The hook does NOT expose a writer (checker Blocker 3 — the earlier
 * dual API where `.setAll(map)` lived on the per-section return was
 * ambiguous). Writers import `setAllSectionRawWins` directly.
 */
export function useSectionRawWins(sectionId: SectionId): { rawWins: boolean } {
  const map = useSyncExternalStore(subscribe, get, get);
  return { rawWins: map[sectionId] };
}

/**
 * Module-level writer (non-hook). Overwrites the whole raw-wins map +
 * persists each entry to localStorage. Called by use-section-save.ts
 * after diffSectionsAgainstSchema runs on the post-save refetched
 * config (Plan 03-04 §Part I).
 */
export function setAllSectionRawWins(next: RawWinsMap): void {
  atom = next;
  if (typeof localStorage !== "undefined") {
    for (const id of SECTION_IDS) {
      localStorage.setItem(LS_PREFIX + id, String(next[id]));
    }
  }
  notify();
}

/** Non-hook read accessor — useful outside React (rarely needed). */
export function getSectionRawWins(sectionId: SectionId): boolean {
  return atom[sectionId];
}

// Exposed for tests to reset module state between cases.
export const __test_resetSectionRawWinsAtom = (): void => {
  atom = emptyMap();
  listeners.clear();
};
