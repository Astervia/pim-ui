/**
 * use-section-save — per-section save orchestration.
 * Phase 3 Plan 03-04 §Part I.
 *
 * Save flow (D-11):
 *   1. Build the full TOML doc from `useSettingsConfig().base` + this
 *      section's react-hook-form values via assembleToml().
 *   2. dry_run FIRST — `config.save({ format: "toml", config, dry_run: true })`.
 *   3. On dry-run success, real save — `config.save({ ..., dry_run: false })`.
 *   4. refetchSettingsConfig() to get the authoritative TOML back.
 *   5. Re-run diffSectionsAgainstSchema(parsed) and write the resulting
 *      map via setAllSectionRawWins (CONF-07, checker Blocker 3).
 *   6. If `requires_restart[]` is non-empty, addFields() to the section's
 *      pending-restart bucket and surface the verbatim toast
 *      `Saved. Restart pim to apply: {fields}` with a `[ Restart ]`
 *      action that calls restartDaemon(actions) (checker Warning 3 —
 *      shared util consumed by Plan 03-06's raw-TOML save too).
 *   7. On reject, mapConfigErrorsToFields(err, sectionId) drives the
 *      FormMessage rendering + section banner; toast fires
 *      `Daemon rejected settings: {first error.message}` with a
 *      `[Show in Logs →]` action that calls setActive("logs") +
 *      applyLogsFilter({ source: "config" }) per checker Warning 5.
 *
 * Cross-cuts:
 *   - Writes form.formState.isDirty into use-dirty-sections via a
 *     useEffect on every change (checker Blocker 1) so non-React
 *     callers can read getDirtySections() before navigating away.
 *   - Listens for `pim:settings-discard-reset` and calls form.reset()
 *     when the event targets THIS section or "all" (D-13).
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { useCallback, useEffect, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { callDaemon } from "@/lib/rpc";
import type { RpcError } from "@/lib/rpc-types";
import { assembleToml } from "@/lib/config/assemble-toml";
import { parseToml } from "@/lib/config/parse-toml";
import { diffSectionsAgainstSchema } from "@/lib/config/schema-diff";
import { type SectionId } from "@/lib/config/section-schemas";
import { mapConfigErrorsToFields } from "@/lib/config/map-errors";
import { useSettingsConfig } from "./use-settings-config";
import { setAllSectionRawWins } from "./use-section-raw-wins";
import { usePendingRestart } from "./use-pending-restart";
import { setSectionDirty } from "./use-dirty-sections";
import { useDaemonState } from "./use-daemon-state";
import { useActiveScreen } from "./use-active-screen";
import { applyLogsFilter } from "./use-log-filters";
import { restartDaemon } from "@/lib/daemon-restart";

/**
 * Per-section save state. Re-exported here from
 * `@/components/settings/section-save-footer` so the orchestrator hook
 * is the canonical export site (acceptance criterion).
 */
export type SaveState = "idle" | "saving" | "saved" | "error";

export interface UseSectionSaveReturn {
  state: SaveState;
  /** Submit handler — pass values from react-hook-form's `handleSubmit`. */
  save: (values: Record<string, unknown>) => Promise<void>;
  /** Daemon-path → message; consumed via `<FormMessage>` per field. */
  fieldErrors: Record<string, string>;
  /** Section-banner fallback when no error path matches a known field. */
  sectionBannerError: string | null;
}

export function useSectionSave<TValues extends FieldValues = FieldValues>(
  sectionId: SectionId,
  form: UseFormReturn<TValues>,
): UseSectionSaveReturn {
  const [state, setState] = useState<SaveState>("idle");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sectionBannerError, setSectionBannerError] = useState<string | null>(
    null,
  );
  const { base, refetch } = useSettingsConfig();
  const { addFields } = usePendingRestart(sectionId);
  const { actions } = useDaemonState();
  const { setActive } = useActiveScreen();

  // Checker Blocker 1: mirror react-hook-form's dirty state into the
  // module atom on every change so nav-interception + stop-confirm
  // can read getDirtySections() without a hook context.
  const isDirty = form.formState.isDirty;
  const dirtyFieldKeys = Object.keys(form.formState.dirtyFields);
  // Stable count derivation — re-render-stable across renders that
  // produce the same dirty shape.
  const dirtyCount = dirtyFieldKeys.length;
  useEffect(() => {
    setSectionDirty(sectionId, isDirty, dirtyCount);
  }, [sectionId, isDirty, dirtyCount]);

  // Checker Blocker 1 + D-13: listen for `pim:settings-discard-reset`
  // and call form.reset() when targeted (or when "all" is emitted).
  useEffect(() => {
    function handler(e: Event): void {
      const detail = (e as CustomEvent<{ id: SectionId | "all" }>).detail;
      if (detail.id === "all" || detail.id === sectionId) {
        form.reset();
      }
    }
    window.addEventListener("pim:settings-discard-reset", handler);
    return () => {
      window.removeEventListener("pim:settings-discard-reset", handler);
    };
  }, [form, sectionId]);

  const save = useCallback(
    async (values: Record<string, unknown>) => {
      if (base === null) {
        toast.error("Config not yet loaded.");
        return;
      }
      setState("saving");
      setFieldErrors({});
      setSectionBannerError(null);

      const doc = assembleToml(base, { [sectionId]: values });
      try {
        // 1. Dry-run FIRST (D-11 step 2)
        await callDaemon("config.save", {
          format: "toml",
          config: doc,
          dry_run: true,
        });
        // 2. Real save (D-11 step 3)
        const real = await callDaemon("config.save", {
          format: "toml",
          config: doc,
          dry_run: false,
        });
        // 3. Refetch to get authoritative TOML (D-11 step 5)
        await refetch();
        // 4. Re-scan rawWins from the freshly-assembled doc (checker
        //    Blocker 3 — module-level writer).
        const freshParsed = parseToml(doc);
        if (freshParsed.ok === true) {
          setAllSectionRawWins(diffSectionsAgainstSchema(freshParsed.value));
        }
        // 5. requires_restart handling (D-25 + checker Warning 3 —
        //    shared restartDaemon util).
        if (real.requires_restart.length > 0) {
          addFields(sectionId, real.requires_restart);
          toast(`Saved. Restart pim to apply: ${real.requires_restart.join(", ")}`, {
            duration: 8000,
            action: {
              label: "[ Restart ]",
              onClick: () => {
                void restartDaemon(actions);
              },
            },
          });
        } else {
          toast.success("Saved.", { duration: 3000 });
        }
        setState("saved");
        setTimeout(() => setState("idle"), 2000);
      } catch (e) {
        const err = e as RpcError;
        const mapped = mapConfigErrorsToFields(err, sectionId);
        if (mapped !== null) {
          setFieldErrors(mapped.fieldErrors);
          setSectionBannerError(mapped.sectionBannerError);
          // Checker Warning 5: wire [Show in Logs →] action handler.
          toast.error(`Daemon rejected settings: ${mapped.firstMessage}`, {
            duration: 8000,
            action: {
              label: "Show in Logs →",
              onClick: () => {
                setActive("logs");
                applyLogsFilter({ source: "config" });
              },
            },
          });
        } else {
          toast.error(err.message ?? "Save failed.");
        }
        setState("error");
        setTimeout(() => setState("idle"), 2000);
      }
    },
    [base, sectionId, refetch, addFields, actions, setActive],
  );

  return { state, save, fieldErrors, sectionBannerError };
}
