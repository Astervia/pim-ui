/**
 * <PairApprovalModal /> — Pair Approval dialog (PEER-06).
 *
 * Two variants driven by usePairApproval.current.mode (02-CONTEXT §D-21,
 * 02-UI-SPEC §Pair Approval modal):
 *
 *   INBOUND (peers.event pair-handshake):
 *     Title       — `{label_announced ?? short_id} wants to join your mesh.`
 *     Description — `↳ node ID: {shortId}` with shortId span in text-accent
 *                   `↳ via {mechanism}`
 *     Footer      — [ Decline ]  [ Trust and connect ]
 *     Role        — alertdialog (interrupts user)
 *
 *   OUTBOUND (user clicked [ Pair ] on a Nearby row):
 *     Title       — `Pair with {label ?? short_id} via {mechanism}?`
 *     Description — `↳ node ID: {shortId}` with shortId span in text-accent
 *     Footer      — [ Cancel ]  [ Trust and connect ]
 *     Role        — dialog (user-initiated)
 *
 * Trust-and-connect path (D-21): calls
 *   callDaemon("peers.pair", { node_id, trust: "persist" })
 * Decline / Cancel path: no RPC — daemon times out its own discovered entry.
 *
 * [ show full ] toggles the 64-char node_id into a wrapped <pre>; repeat
 * click collapses (UI-SPEC §Pair Approval §Description line 2).
 *
 * Color discipline (UI-SPEC §Color reserved list):
 *   - shortId span uses text-accent (item 4 in reserved list).
 *   - Primary action [ Trust and connect ] uses Button variant="default"
 *     which is primary GREEN — NEVER accent.
 *
 * NO exclamation marks, NO rounded-*, NO gradients, NO literal palette colors.
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
import { usePairApproval } from "@/hooks/use-pair-approval";
import { callDaemon } from "@/lib/rpc";
import { formatShortId } from "@/lib/format";

export function PairApprovalModal() {
  const { current, close } = usePairApproval();
  const [showFull, setShowFull] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset local state whenever the active trigger changes (queue advance).
  useEffect(() => {
    setShowFull(false);
    setBusy(false);
  }, [current?.discovered?.node_id, current?.discovered?.address]);

  if (current === null) return null;

  const d = current.discovered;
  const shortId = formatShortId(d.node_id);
  const isInbound = current.mode === "inbound";
  // D-20 says outbound pairing on anonymous peers is hidden at the Nearby
  // row layer. Defensive guard: if an anonymous trigger reaches us,
  // degrade to shortId "(no id)".
  const announcedLabel = d.label_announced === null ? null : d.label_announced;

  // UI-SPEC verbatim title copy.
  const title = isInbound === true
    ? `${announcedLabel === null ? shortId : announcedLabel} wants to join your mesh.`
    : `Pair with ${announcedLabel === null ? shortId : announcedLabel} via ${d.mechanism}?`;

  const onTrustAndConnect = async () => {
    if (d.node_id === null) {
      // Can't call peers.pair without a node_id. Just close.
      close();
      return;
    }
    setBusy(true);
    try {
      await callDaemon("peers.pair", {
        node_id: d.node_id,
        trust: "persist",
      });
      // On failure the daemon emits a peers.event { kind: "pair_failed" }
      // which the troubleshoot log hook captures. No toast here in Phase 2.
    } catch (e) {
      console.warn("peers.pair failed:", e);
    } finally {
      setBusy(false);
      close();
    }
  };

  const onDecline = () => {
    // D-21: no RPC on Decline (inbound) or Cancel (outbound).
    // The daemon eventually times the discovery entry out on its own.
    close();
  };

  return (
    <Dialog
      open={current === null ? false : true}
      onOpenChange={(open) => {
        if (open === false) onDecline();
      }}
    >
      <DialogContent
        className="max-w-lg bg-popover"
        role={isInbound === true ? "alertdialog" : "dialog"}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="font-code text-sm flex flex-col gap-1 mt-2">
              <p className="flex items-center gap-2 flex-wrap">
                <span>↳ node ID:</span>
                <span className="text-accent">{shortId}</span>
                <button
                  type="button"
                  onClick={() =>
                    setShowFull((s) => (s === true ? false : true))
                  }
                  className="font-mono text-xs uppercase tracking-wider text-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 transition-colors duration-100 ease-linear"
                >
                  [ show {showFull === true ? "short" : "full"} ]
                </button>
              </p>
              {isInbound === true ? (
                <p className="text-muted-foreground">↳ via {d.mechanism}</p>
              ) : null}
              {showFull === true && d.node_id === null ? (
                <p className="text-muted-foreground">
                  full node id unavailable
                </p>
              ) : null}
              {showFull === true && d.node_id === null ? null : showFull ===
                true ? (
                <pre className="font-code text-xs break-all text-foreground whitespace-pre-wrap mt-1">
                  {d.node_id}
                </pre>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onDecline}
            disabled={busy === true}
          >
            {isInbound === true ? "[ Decline ]" : "[ Cancel ]"}
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onTrustAndConnect}
            disabled={busy === true}
          >
            [ Trust and connect ]
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
