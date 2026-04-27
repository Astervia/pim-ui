/**
 * <AddPeerActionRow /> — `[ + Add static peer ]` button rendered above
 * the connected-peer list inside <PeersPanel /> (PEER-02, 03-UI-SPEC §S2).
 *
 * Locked-copy: `[ + Add static peer ]` (verbatim per 03-CONTEXT D-16 +
 * 03-UI-SPEC §Copywriting Contract).
 *
 * Layout: divider beneath, `border-b border-border pb-3 mb-3`, so the
 * action row reads as part of the panel's body grammar (03-UI-SPEC §S2).
 *
 * Limited mode (D-32): when daemon state is anything other than
 * "running", the button is disabled with `Reconnect to add peers.` as
 * its native title hint.
 *
 * State sharing: useAddPeer() reads the SAME module-level atom the
 * <AddPeerSheet /> reads, so clicking here flips `open` for the sheet.
 *
 * Brand rules: no radius, no gradient, no lucide icons, no `!` prefix
 * on values, no exclamation marks in copy.
 */

import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useAddPeer } from "@/hooks/use-add-peer";

export function AddPeerActionRow() {
  const { openSheet } = useAddPeer();
  const { snapshot } = useDaemonState();
  const limited = snapshot.state === "running" ? false : true;

  return (
    <div className="border-b border-border pb-3 mb-3 px-4">
      <Button
        type="button"
        variant="default"
        onClick={openSheet}
        disabled={limited}
        title={limited === true ? "Reconnect to add peers." : undefined}
      >
        [ + Add static peer ]
      </Button>
    </div>
  );
}
