/**
 * <SectionSaveFooter /> — shared per-section save row. Phase 3 Plan 03-04 §Part C.
 *
 * Spec: 03-UI-SPEC §Primary CTAs table (Per-section Save button) +
 *        §Daemon-stopped copy + §Interaction states (per-section save flow).
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────────┐
 *   │  Daemon stopped — reconnect to save.    (only when limited) │
 *   │                                              · [ Save ]    │
 *   └────────────────────────────────────────────────────────────┘
 *
 * State labels (D-25, 03-UI-SPEC §Primary CTAs):
 *   idle   → `[ Save ]`        (enabled iff dirty && !limited)
 *   saving → `[ Saving… ]`     (disabled, aria-busy)
 *   saved  → `[ Saved ]`       (disabled — caller flips back to idle after 2s)
 *   error  → `[ Save ]`        (re-enabled so user can retry)
 *
 * Limited-mode (LimitedModeBanner active, snapshot.state !== "running"):
 *   - Inline hint above button: `Daemon stopped — reconnect to save.`
 *     (verbatim per 03-UI-SPEC §Daemon-stopped copy)
 *   - Save button disabled regardless of dirty
 *
 * Bang-free per project policy. Comparisons are `=== false` / `!== ` only
 * where TS narrows naturally — no `!value` patterns.
 */

import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";

/**
 * Per-section save state. Re-exported by `@/hooks/use-section-save` (the
 * orchestrator that drives this footer); declared here so the footer
 * component is self-describing for read-only consumers.
 */
export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SectionSaveFooterProps {
  dirty: boolean;
  state: SaveState;
  onSave: () => void;
}

export function SectionSaveFooter({
  dirty,
  state,
  onSave,
}: SectionSaveFooterProps) {
  const { snapshot } = useDaemonState();
  const limited = snapshot.state === "running" ? false : true;

  const label =
    state === "saving"
      ? "[ Saving… ]"
      : state === "saved"
        ? "[ Saved ]"
        : "[ Save ]";

  // Disabled: limited-mode wins; otherwise depends on dirty + transient state.
  const disabled =
    limited === true ||
    dirty === false ||
    state === "saving" ||
    state === "saved";

  return (
    <div className="mt-6 flex flex-col gap-2">
      {limited === true && (
        <p className="font-mono text-sm text-muted-foreground">
          Daemon stopped — reconnect to save.
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        {dirty === true && limited === false && (
          <span
            aria-label="unsaved changes"
            role="img"
            className="text-primary font-mono"
          >
            ·
          </span>
        )}
        <Button
          type="button"
          variant="default"
          disabled={disabled}
          aria-busy={state === "saving" ? true : undefined}
          onClick={onSave}
        >
          {label}
        </Button>
      </div>
    </div>
  );
}
