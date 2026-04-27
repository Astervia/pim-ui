/**
 * use-pending-restart — per-section "fields awaiting daemon restart" atom.
 * Phase 3 Plan 03-04 §Part G + 03-CONTEXT D-25 / D-26.
 *
 * After a successful save, the daemon's ConfigSaveResult.requires_restart
 * lists field paths that won't take effect until pim-daemon restarts
 * (e.g. transport.listen_port). Those paths are added to this atom under
 * their owning section id; the section's CollapsibleCliPanel renders
 * `· ⚠ pending restart: {fields}` in the collapsed summary until the
 * daemon actually restarts.
 *
 * Persisted to localStorage under key `pim-ui.pending-restart` (D-26)
 * so the marker survives reloads — UI restart should NOT silently clear
 * it; only an actual daemon restart does.
 *
 * INVARIANT (checker Info 3):
 *   Single status.event subscription for the lifetime of the app.
 *   Module-level guard `statusEventSubscribed` ensures N section mounts
 *   register exactly 1 handler via `actions.subscribe(...)`. Subsequent
 *   mounts are no-ops. The subscription is never torn down — it lives
 *   for the app process, not a component tree. `actions.subscribe` is
 *   the W1 fan-out (NOT a new Tauri listen); registers against the
 *   single module-scope event handler map in use-daemon-state.ts.
 *
 * Why role_changed is the proxy for "daemon restarted":
 *   v1 daemon doesn't emit a dedicated `daemon.started_again` event.
 *   role_changed fires on rpc.hello which always emits on a fresh
 *   handshake (Phase 1 W1 contract). It's the closest "the daemon
 *   relaunched" signal we have until v2 adds a richer lifecycle stream.
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved —
 * status.event flows through the W1 fan-out registered in
 * use-daemon-state.ts).
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { type SectionId, SECTION_IDS } from "@/lib/config/section-schemas";
import { useDaemonState } from "@/hooks/use-daemon-state";

const LS_KEY = "pim-ui.pending-restart";
type PendingMap = Record<SectionId, string[]>;

function emptyMap(): PendingMap {
  return Object.fromEntries(SECTION_IDS.map((id) => [id, [] as string[]])) as PendingMap;
}

function loadFromStorage(): PendingMap {
  const out = emptyMap();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw === null) return out;
    const parsed = JSON.parse(raw) as Partial<PendingMap>;
    for (const id of SECTION_IDS) {
      const v = parsed[id];
      out[id] = Array.isArray(v) ? (v as string[]) : [];
    }
  } catch {
    // Ignore parse errors — fall back to empty map.
  }
  return out;
}

let atom: PendingMap =
  typeof localStorage !== "undefined" ? loadFromStorage() : emptyMap();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((cb) => cb());
}

function persist(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LS_KEY, JSON.stringify(atom));
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function get(): PendingMap {
  return atom;
}

// INVARIANT (checker Info 3): single status.event subscription for the
// lifetime of the app. Module-level guard ensures N section mounts
// register exactly 1 handler via stable reference — NOT N handlers.
// The subscription never unsubscribes (it's tied to the app process,
// not a component tree). Future edits MUST preserve this guard.
let statusEventSubscribed = false;

type DaemonActionsLike = ReturnType<typeof useDaemonState>["actions"];

function ensureStatusEventSubscription(actions: DaemonActionsLike): void {
  if (statusEventSubscribed === true) return;
  statusEventSubscribed = true;
  void actions
    .subscribe("status.event", (evt) => {
      if (evt.kind === "role_changed") {
        atom = emptyMap();
        persist();
        notify();
      }
    })
    .catch(() => {
      // Subscription failure is non-fatal — the atom still works for
      // reads + writes; only the role_changed auto-clear is lost. The
      // fan-out's retry-once already covers transient daemon hiccups.
    });
}

export interface UsePendingRestartReturn {
  /** Pending field paths for THIS section (e.g. ["transport.listen_port"]). */
  fields: string[];
  /** Add fields to a section's pending set. Idempotent (Set-deduped). */
  addFields: (sectionId: SectionId, fields: string[]) => void;
  /** Clear every section's pending set (e.g. after a successful restart). */
  clearAll: () => void;
}

export function usePendingRestart(sectionId: SectionId): UsePendingRestartReturn {
  const map = useSyncExternalStore(subscribe, get, get);
  const { actions } = useDaemonState();

  // Register the W1 fan-out handler exactly once. Subsequent mounts
  // are no-ops via the module-level guard above.
  useEffect(() => {
    ensureStatusEventSubscription(actions);
  }, [actions]);

  const addFields = useCallback(
    (sid: SectionId, fields: string[]) => {
      const existing = atom[sid];
      const merged = Array.from(new Set([...existing, ...fields]));
      atom = { ...atom, [sid]: merged };
      persist();
      notify();
    },
    [],
  );

  const clearAll = useCallback(() => {
    atom = emptyMap();
    persist();
    notify();
  }, []);

  return { fields: map[sectionId], addFields, clearAll };
}

// Exposed for tests to reset module state between cases.
export const __test_resetPendingRestartAtom = (): void => {
  atom = emptyMap();
  listeners.clear();
  statusEventSubscribed = false;
};
