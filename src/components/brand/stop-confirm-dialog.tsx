/**
 * <StopConfirmDialog /> — fires when the user clicks Stop while peers
 * are connected. Solo case (peerCount=0) skips this dialog — the toggle
 * stops immediately.
 *
 * Spec: 01-UI-SPEC.md §Surface 2 Stop flow + §Copywriting Contract.
 * Copy honors singular/plural and names the system state we preserve
 * ([ KEEP RUNNING ], not a generic "Cancel").
 *
 * Phase 3 Plan 03-04 §Part H.4 (checker Blocker 1) — D-13 chained gate:
 *   When stopConfirmOpen flips to true AND `getDirtySections().length`
 *   is non-zero, the DiscardUnsavedChangesAlertDialog renders FIRST.
 *   On `[ Discard ]` we fan-out emitDiscardReset("all") and proceed to
 *   the stop confirmation body. On `[ Stay ]` we dismiss the stop
 *   confirm entirely (no further dialog opens — the daemon stays
 *   running and the user's edits stay intact).
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { DiscardUnsavedChangesAlertDialog } from "@/components/settings/discard-unsaved-changes-alert-dialog";
import {
  emitDiscardReset,
  getDirtySections,
} from "@/hooks/use-dirty-sections";

export function StopConfirmDialog() {
  const { snapshot, stopConfirmOpen, actions } = useDaemonState();
  const n = snapshot.peerCount;
  const bodyWithPeers = `${n} connected peer${n === 1 ? "" : "s"} will disconnect. Routes will be torn down. You can start the daemon again at any time.`;
  const bodySolo =
    "pim will stop listening on the mesh until you start it again.";

  // D-13 chained gate (checker Blocker 1): when stopConfirmOpen flips
  // to true AND dirty sections exist, show the discard dialog FIRST.
  // The state variable below tracks whether the discard prompt is the
  // currently-rendered dialog. Once the user confirms Discard the
  // gate clears and the stop-confirm body takes over.
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardCleared, setDiscardCleared] = useState(false);
  const dirty = getDirtySections();
  const totalDirtyFields = dirty.reduce(
    (sum, d) => sum + d.dirtyFieldCount,
    0,
  );

  useEffect(() => {
    if (stopConfirmOpen === true) {
      if (dirty.length > 0 && discardCleared === false) {
        setDiscardOpen(true);
      }
    } else {
      // Reset the gate state when the parent dialog closes — next
      // open should re-evaluate dirty status from scratch.
      setDiscardOpen(false);
      setDiscardCleared(false);
    }
    // We deliberately watch only the open flag — re-running on every
    // dirty-list mutation would re-open the gate after the user clicks
    // Discard (the fan-out clears dirty before discardCleared latches).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopConfirmOpen]);

  // While the discard gate is up, suppress the stop-confirm body so
  // both dialogs don't stack on screen at once.
  const showStopBody =
    stopConfirmOpen === true &&
    discardOpen === false &&
    (dirty.length === 0 || discardCleared === true);

  return (
    <>
      <DiscardUnsavedChangesAlertDialog
        open={discardOpen}
        onOpenChange={(v) => {
          if (v === false) setDiscardOpen(false);
        }}
        sectionName="this app session"
        dirtyFieldCount={totalDirtyFields}
        onDiscard={() => {
          emitDiscardReset("all");
          setDiscardCleared(true);
          setDiscardOpen(false);
        }}
        onStay={() => {
          setDiscardOpen(false);
          actions.dismissStopConfirm();
        }}
      />
      <Dialog
        open={showStopBody}
        onOpenChange={(v) => {
          if (v === false) actions.dismissStopConfirm();
        }}
      >
        <DialogContent aria-describedby="stop-desc">
          <DialogHeader>
            <DialogTitle>Stop daemon</DialogTitle>
          </DialogHeader>
          <DialogDescription id="stop-desc">
            {n > 0 ? bodyWithPeers : bodySolo}
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={actions.dismissStopConfirm}
              type="button"
            >
              KEEP RUNNING
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void actions.confirmStop();
              }}
              type="button"
            >
              STOP DAEMON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
