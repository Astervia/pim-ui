/**
 * <RemovePeerAlertDialog /> — destructive AlertDialog confirming
 * peers.remove on a static peer (PEER-03).
 *
 * Spec:
 *   - 03-CONTEXT D-19 (verbatim title pattern + body lines 1+2 + race
 *     toast copy)
 *   - 03-CONTEXT D-20 (Remove flow targets static peers only —
 *     gating lives on the PeerRemoveButton render path)
 *   - 03-CONTEXT D-32 (limited mode disables confirm; verbatim hint)
 *   - 03-UI-SPEC §S4 Remove Peer AlertDialog (first focus on Cancel
 *     for safety; mirrors stop-confirm-dialog.tsx convention)
 *
 * Locked-copy strings (DO NOT paraphrase):
 *   - Title:      "Remove {label ?? short_id}?"
 *   - Body:       "This peer will be removed from pim.toml and
 *                  disconnected. Nearby discovery can re-pair it later."
 *   - Confirm:    [ Remove ]
 *   - Cancel:     [ Cancel ]
 *   - Limited:    "Reconnect to remove peers."
 *   - Race toast: "Peer was already removed."
 *
 * AlertDialog primitive (03-01) flips defaults so Action=destructive +
 * Cancel=ghost — no extra props needed at this call site.
 *
 * First-focus-on-Cancel: Radix's default focus lands on the LAST
 * rendered focusable button by way of the close button placement.
 * Adding `autoFocus` on AlertDialogCancel forces the safe side to
 * receive initial focus, matching the StopConfirmDialog pattern that
 * Phase 1 established (and that 03-UI-SPEC §AlertDialog explicitly
 * calls out as the destructive-prompt convention).
 *
 * W1 contract: this component does NOT call listen(...) — only
 * callDaemon("peers.remove", ...) via the use-remove-peer hook.
 *
 * Brand rules: zero radius (AlertDialog primitive enforces), monospace
 * everywhere, no lucide icons, no `!` prefix on values, no exclamation
 * marks in copy.
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
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useRemovePeer } from "@/hooks/use-remove-peer";

export function RemovePeerAlertDialog() {
  const { peer, submitting, cancel, confirm } = useRemovePeer();
  const { snapshot } = useDaemonState();
  const limited = snapshot.state === "running" ? false : true;

  const open = peer === null ? false : true;
  // D-19 title pattern: prefer the human label, fall back to short_id.
  const displayName =
    peer === null
      ? ""
      : peer.label === null
        ? peer.node_id_short
        : peer.label;
  const titleId = "remove-peer-title";
  const descId = "remove-peer-description";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (v === false) cancel();
      }}
    >
      <AlertDialogContent
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <AlertDialogHeader>
          <AlertDialogTitle id={titleId}>
            Remove {displayName}?
          </AlertDialogTitle>
          <AlertDialogDescription id={descId}>
            This peer will be removed from pim.toml and disconnected. Nearby
            discovery can re-pair it later.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {limited === true ? (
          <p className="font-mono text-sm text-text-secondary">
            Reconnect to remove peers.
          </p>
        ) : null}

        <AlertDialogFooter>
          {/*
            03-UI-SPEC §S4: Cancel rendered AFTER Action so first focus
            lands on the safe side. autoFocus reinforces this for
            assistive-tech that doesn't follow Radix's tabindex order.
          */}
          <AlertDialogAction
            onClick={(e) => {
              // preventDefault so Radix doesn't auto-close before
              // peers.remove resolves; close happens inside confirm().
              e.preventDefault();
              void confirm();
            }}
            disabled={limited === true || submitting === true}
            aria-busy={submitting === true ? true : undefined}
          >
            [ Remove ]
          </AlertDialogAction>
          <AlertDialogCancel autoFocus onClick={cancel}>
            [ Cancel ]
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
