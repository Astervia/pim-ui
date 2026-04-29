/**
 * <SectionSaveFooter /> — per-section save/discard footer.
 *
 * Post-redesign: separated from the section body by a 1px rule, with
 * the dirty-count and saved/error state surfaced inline so the user
 * never has to guess what's about to land. Discard button restores
 * the original snapshot via the form's `reset()` helper without
 * leaving the section.
 *
 * Anatomy:
 *
 *   ──────────────────────────────────────────────────────
 *     ◆ 2 unsaved fields           [ DISCARD ]  [ SAVE ]
 *
 * State labels (D-25):
 *   idle   → `[ SAVE ]`     (enabled iff dirty && !limited)
 *   saving → `[ SAVING… ]`  (disabled, aria-busy)
 *   saved  → `[ SAVED ]`    (disabled — caller flips back to idle after 2s)
 *   error  → `[ SAVE ]`     (re-enabled so user can retry)
 *
 * Limited mode renders the verbatim 03-UI-SPEC copy
 * "Daemon stopped — reconnect to save." inline above the button row,
 * and disables Save (Discard stays usable so the user can revert
 * locally even when the daemon is unreachable).
 */

import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { cn } from "@/lib/utils";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface SectionSaveFooterProps {
  dirty: boolean;
  state: SaveState;
  onSave: () => void;
  /** Optional discard handler — typically `() => form.reset()`. */
  onDiscard?: () => void;
  /** Optional explicit dirty-field count for the inline status hint. */
  dirtyFieldCount?: number;
}

export function SectionSaveFooter({
  dirty,
  state,
  onSave,
  onDiscard,
  dirtyFieldCount,
}: SectionSaveFooterProps) {
  const { snapshot } = useDaemonState();
  const limited = snapshot.state === "running" ? false : true;

  const saveLabel =
    state === "saving"
      ? "[ SAVING… ]"
      : state === "saved"
        ? "[ SAVED ]"
        : "[ SAVE ]";

  const saveDisabled =
    limited === true ||
    dirty === false ||
    state === "saving" ||
    state === "saved";

  const discardDisabled =
    dirty === false || state === "saving" || state === "saved";

  // Inline status — describes WHAT state the section is in.
  let status: React.ReactNode = null;
  if (state === "saved") {
    status = (
      <span className="flex items-center gap-2 text-primary">
        <span aria-hidden className="phosphor">
          ◆
        </span>
        <span>saved · daemon reloaded</span>
      </span>
    );
  } else if (state === "error") {
    status = (
      <span className="flex items-center gap-2 text-destructive">
        <span aria-hidden>✗</span>
        <span>save failed · review fields above</span>
      </span>
    );
  } else if (limited === true) {
    status = (
      <span className="flex items-center gap-2 text-text-secondary">
        <span aria-hidden>○</span>
        <span>daemon stopped — reconnect to save</span>
      </span>
    );
  } else if (dirty === true) {
    const count = dirtyFieldCount ?? 0;
    const label =
      count <= 0
        ? "unsaved changes"
        : count === 1
          ? "1 unsaved field"
          : `${count} unsaved fields`;
    status = (
      <span className="flex items-center gap-2 text-accent">
        <span aria-hidden className="phosphor-pulse">
          ◆
        </span>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div className={cn("mt-6 pt-4 border-t border-border")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-code text-xs min-h-5">
          {status}
        </div>
        <div className="flex items-center gap-2">
          {onDiscard !== undefined ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={discardDisabled}
              onClick={onDiscard}
            >
              [ DISCARD ]
            </Button>
          ) : null}
          <Button
            type="button"
            variant="default"
            disabled={saveDisabled}
            aria-busy={state === "saving" ? true : undefined}
            onClick={onSave}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
