/**
 * <SubscriptionErrorToast /> — logical watcher that surfaces D-31
 * subscription-failure errors as sonner toasts.
 *
 * D-31 rule (02-CONTEXT.md): when a subscription fails, log + retry-once
 * with 500 ms backoff (owned by Plan 02-01 in useDaemonState + Plan 02-05
 * in useLogsStream). If still failing, store the error on
 * snapshot.subscriptionError (status/peers) or expose errorStream (logs)
 * AND surface a toast so the user can act.
 *
 * Copy rule — D-31 + 02-UI-SPEC §Subscription-failure toast VERBATIM:
 *   Couldn't subscribe to {stream}. Check the Logs tab.
 * where {stream} is one of "status", "peers", "logs".
 *
 * Component renders null; side effect only. Dedupes by (stream, code) so a
 * steady-state failure fires exactly once. Cleared when the snapshot
 * clears the error (i.e. a successful re-subscribe).
 *
 * Note on stream mapping: snapshot.subscriptionError.stream is the full
 * RpcEventName ("status.event" | "peers.event" | "logs.event"). The toast
 * copy wants the shorter form ("status" | "peers" | "logs") per the
 * user-facing spec, so we trim the ".event" suffix here.
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useDaemonState } from "@/hooks/use-daemon-state";

/** "status.event" → "status", "peers.event" → "peers", "logs.event" → "logs". */
function streamLabel(eventName: string): string {
  return eventName.replace(".event", "");
}

export function SubscriptionErrorToast() {
  const { snapshot } = useDaemonState();
  const lastShownRef = useRef<string | null>(null);

  useEffect(() => {
    const err = snapshot.subscriptionError;
    if (err === null) {
      // Cleared — allow the next failure to fire even if same (stream,code).
      lastShownRef.current = null;
      return;
    }
    // Dedupe by (stream, error code) — only fire once per unique failure.
    const key = `${err.stream}:${err.error.code}`;
    if (lastShownRef.current === key) return;
    lastShownRef.current = key;

    // D-31 verbatim. No exclamation marks, trailing period retained,
    // Logs is capitalised because it names the UI tab.
    toast.error(
      `Couldn't subscribe to ${streamLabel(err.stream)}. Check the Logs tab.`,
      {
        duration: 6000,
        className: "font-mono",
      },
    );
  }, [snapshot.subscriptionError]);

  return null;
}
