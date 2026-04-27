/**
 * daemon-restart — shared `stop → wait → start` helper.
 * Phase 3 Plan 03-04 §Part H.5 (addresses checker Warning 3).
 *
 * Used by:
 *   - src/hooks/use-section-save.ts   (form-section [ Restart ] toast action)
 *   - src/hooks/use-raw-toml-save.ts  (raw-TOML [ Restart ] toast action,
 *                                      Plan 03-06 — not yet shipped; this
 *                                      module exists so that future hook
 *                                      can call the SAME implementation
 *                                      instead of a no-op restart)
 *
 * Pattern: stop → 500 ms pause → start. The pause is a pragmatic lower
 * bound; the daemon-state subscription is the actual source of truth
 * for completion (the toggle reflects the new running state once the
 * Tauri state-changed event fires). Errors surface as a toast and the
 * promise rejects for the caller to log if needed.
 *
 * Why this matters: the daemon's ConfigSaveResult.requires_restart
 * fields don't take effect until pim-daemon restarts. The post-save
 * toast offers a `[ Restart ]` action that calls into here so the
 * user doesn't have to manually click the daemon toggle Stop → Start
 * sequence. D-25 + 03-UI-SPEC §Restart-required copy.
 *
 * Bang-free per project policy.
 */

import { toast } from "sonner";

/**
 * Minimal shape of the actions object exposed by `useDaemonState()` —
 * defined inline here so this module imports nothing from the React
 * tree (kept side-effect-free for tree-shaking).
 */
export interface RestartActions {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Shared restart helper (checker Warning 3). Pass the `actions` object
 * from `useDaemonState()` — both useSectionSave (this plan) and
 * useRawTomlSave (Plan 03-06) thread it through unchanged so both
 * restart-required toasts route through identical logic.
 */
export async function restartDaemon(actions: RestartActions): Promise<void> {
  try {
    await actions.stop();
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    await actions.start();
  } catch (e) {
    toast.error("Couldn't restart pim.");
    throw e;
  }
}
