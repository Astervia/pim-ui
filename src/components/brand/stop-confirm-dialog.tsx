/**
 * <StopConfirmDialog /> — fires when the user clicks Stop while peers
 * are connected. Solo case (peerCount=0) skips this dialog — the toggle
 * stops immediately.
 *
 * Spec: 01-UI-SPEC.md §Surface 2 Stop flow + §Copywriting Contract.
 * Copy honors singular/plural and names the system state we preserve
 * ([ KEEP RUNNING ], not a generic "Cancel").
 */

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

export function StopConfirmDialog() {
  const { snapshot, stopConfirmOpen, actions } = useDaemonState();
  const n = snapshot.peerCount;
  const bodyWithPeers = `${n} connected peer${n === 1 ? "" : "s"} will disconnect. Routes will be torn down. You can start the daemon again at any time.`;
  const bodySolo =
    "pim will stop listening on the mesh until you start it again.";
  return (
    <Dialog
      open={stopConfirmOpen}
      onOpenChange={(v) => {
        if (!v) actions.dismissStopConfirm();
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
  );
}
