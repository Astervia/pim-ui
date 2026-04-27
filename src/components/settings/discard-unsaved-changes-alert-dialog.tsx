/**
 * <DiscardUnsavedChangesAlertDialog /> — D-13 verbatim copy dialog.
 * Phase 3 Plan 03-04 §Part H.2 (addresses checker Blocker 1).
 *
 * Spec: 03-UI-SPEC §Unsaved changes — locked copy + §S5.
 * Copy contract (LOAD-BEARING — verbatim per UI-SPEC §Copywriting):
 *   Title:    `Discard unsaved changes in {section name}?`
 *   Body:     `{N} field{N≠1?s:} in {section name} haven't been saved.
 *              If you leave, your edits disappear.`
 *   Primary:  `[ Discard ]` (destructive variant — the action destroys edits)
 *   Secondary: `[ Stay ]`   (autoFocus — first-focus-on-safe convention)
 *
 * This is a stateless presentation: open / sectionName / dirtyFieldCount /
 * onDiscard / onStay come from the caller.
 *
 * Used by:
 *   - src/components/shell/active-screen.tsx — nav-away interception
 *     when getDirtySections().length > 0 (Sidebar tab clicks).
 *   - src/components/brand/stop-confirm-dialog.tsx — pre-Stop gate
 *     when dirty sections exist (D-13 says the same dialog gates the
 *     daemon-stop path).
 *
 * Brand rules:
 *   - Reuses the brand-overridden AlertDialog primitive (zero radius,
 *     bg-popover, font-mono title/description, AlertDialogAction
 *     defaults to destructive variant).
 *   - No `!` prefix policy.
 *   - No exclamation marks in copy (the title's `?` is allowed; D-13
 *     copy ends with a period, not a `!`).
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface DiscardUnsavedChangesAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name (e.g. "Transport", "this app session"). */
  sectionName: string;
  /** Sum of dirty field counts across the affected section(s). */
  dirtyFieldCount: number;
  onDiscard: () => void;
  onStay: () => void;
}

export function DiscardUnsavedChangesAlertDialog({
  open,
  onOpenChange,
  sectionName,
  dirtyFieldCount,
  onDiscard,
  onStay,
}: DiscardUnsavedChangesAlertDialogProps) {
  // D-13 body template: "{N} field(s) in {section name} haven't been saved.
  // If you leave, your edits disappear." — pluralize only when N !== 1.
  const fieldWord = dirtyFieldCount === 1 ? "field" : "fields";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Discard unsaved changes in {sectionName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {dirtyFieldCount} {fieldWord} in {sectionName} haven&apos;t been
            saved. If you leave, your edits disappear.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Primary = destructive [ Discard ]; secondary = [ Stay ] with
              autoFocus (first-focus-on-safe convention per
              03-UI-SPEC §AlertDialog). preventDefault on Discard so we
              keep the dialog state until onDiscard's caller closes it
              after the form.reset() fan-out has run. */}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onDiscard();
            }}
          >
            [ Discard ]
          </AlertDialogAction>
          <AlertDialogCancel autoFocus onClick={onStay}>
            [ Stay ]
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
