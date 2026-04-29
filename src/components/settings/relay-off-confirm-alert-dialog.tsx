/**
 * <RelayOffConfirmAlertDialog /> — Phase 6 Plan 06-01.
 *
 * Destructive confirm gate when the user tries to flip
 * `[relay].enabled` from true → false in <RelaySection />.
 *
 * Why this exists: pim's default capability is `relay + client` (0x03)
 * and the kernel (`pim-daemon` runtime_config.rs) only treats a node as
 * client-only (0x01) when `[relay].enabled = false`. A mesh full of
 * client-only nodes degenerates — see the partner conversation log of
 * 2026-04-29 ("não adianta ter um monte de client sem relay com poucos
 * gateways"). This dialog makes the trade-off explicit.
 *
 * Copy authority: docs/COPY.md §6 — RelaySection (Phase 6).
 *
 * Brand rules upheld:
 *   - No exclamation marks (audited by `pnpm audit:copy`).
 *   - Crypto / capability primitive named on first use ("client only").
 *   - Primary action is destructive variant; safe action ([ Keep relay on ])
 *     is the autoFocus default — first-focus-on-safe convention from
 *     03-UI-SPEC §AlertDialog.
 *   - No bang prefix (`!`) — bang-free conditional convention.
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

export interface RelayOffConfirmAlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Confirm: user accepted the trade-off and wants relay = false. */
  onConfirm: () => void;
  /** Cancel: user backed out; the Switch should snap back to checked. */
  onCancel: () => void;
}

export function RelayOffConfirmAlertDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: RelayOffConfirmAlertDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Run as client only?</AlertDialogTitle>
          <AlertDialogDescription>
            Without relay, this device only consumes the mesh — it stops
            forwarding traffic for nearby peers. The mesh weakens with
            every client-only node, so other peers may lose paths to a
            gateway. Recommended: leave relay on.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Destructive primary; preventDefault so the caller controls
              the dialog state after running side-effects. */}
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            [ Run client only ]
          </AlertDialogAction>
          <AlertDialogCancel autoFocus onClick={onCancel}>
            [ Keep relay on ]
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
