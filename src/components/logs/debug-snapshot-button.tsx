/**
 * DebugSnapshotButton — Phase 3 03-03 Task 2 (OBS-03 / D-23 / D-24).
 *
 * Spec: 03-UI-SPEC §S6 row 3 (right-aligned export button) + §S8
 * Debug snapshot toast.
 *
 * Click flow:
 *   1. Build the DebugSnapshot object synchronously from the live
 *      daemon snapshot (status + peers + discovered) + the current
 *      log buffer (use-logs-stream allEvents) + the filter values
 *      currently in effect (level, peer, source — though source is
 *      not part of the D-23 schema's filters_applied, only level /
 *      peer_id / text / time_range are).
 *   2. Trigger a Blob + `<a download>` download with a Windows-safe
 *      filename per D-24.
 *   3. Fire a sonner success toast: `Snapshot saved as {filename}`
 *      (auto-dismiss 4s).
 *   4. On failure (rare — only if Blob/URL APIs reject), fire a
 *      destructive toast `Couldn't generate snapshot.` with a
 *      `[Show in Logs →]` action that navigates to Logs (no source
 *      filter applied — snapshot failures are UI-side, not daemon-
 *      source filterable).
 *
 * Label flips to `[ Preparing… ]` for < 100 ms while the blob is
 * assembled (03-UI-SPEC §S6: "barely perceptible; included for the
 * honesty of the label").
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useLogsStream } from "@/hooks/use-logs-stream";
import {
  applyLogsFilter,
  useLogFilters,
  type LogTimeRange,
} from "@/hooks/use-log-filters";
import { useActiveScreen } from "@/hooks/use-active-screen";
import {
  buildDebugSnapshot,
  downloadSnapshot,
  snapshotFilename,
} from "@/lib/debug-snapshot";

function timeRangeLabel(r: LogTimeRange): string {
  if (r.kind === "custom") return `Custom (${r.from} – ${r.to})`;
  if (r.preset === "last_5m") return "Last 5 min";
  if (r.preset === "last_15m") return "Last 15 min";
  if (r.preset === "last_1h") return "Last 1 hour";
  if (r.preset === "all") return "All session";
  return "Custom…";
}

export interface DebugSnapshotButtonProps {
  className?: string;
}

export function DebugSnapshotButton({ className }: DebugSnapshotButtonProps) {
  const [preparing, setPreparing] = useState<boolean>(false);
  const { snapshot } = useDaemonState();
  const { allEvents, level, peerFilter } = useLogsStream();
  const { searchTextDebounced, timeRange } = useLogFilters();
  const { setActive } = useActiveScreen();

  const onClick = (): void => {
    setPreparing(true);
    try {
      const built = buildDebugSnapshot({
        daemonStatus: snapshot.status,
        peers:
          snapshot.status === null ||
          snapshot.status === undefined ||
          snapshot.status.peers === undefined
            ? []
            : snapshot.status.peers,
        discovered: snapshot.discovered,
        logs: allEvents,
        filters: {
          level,
          peer_id: peerFilter,
          text: searchTextDebounced,
          time_range: timeRangeLabel(timeRange),
        },
      });
      downloadSnapshot(built);
      toast.success(`Snapshot saved as ${snapshotFilename(built.captured_at)}`, {
        duration: 4000,
      });
    } catch {
      // Checker Warning 5: wire the [Show in Logs →] action directly
      // on the failure toast so users have a one-click path to the
      // log surface for triage. The action: { label: "Show in Logs →" }
      // shape is recognized by sonner's renderer.
      toast.error("Couldn't generate snapshot.", {
        duration: 8000,
        action: { label: "Show in Logs →", onClick: () => {
          setActive("logs");
          // No source filter — snapshot failures are UI-side errors,
          // not daemon-source filterable events.
          applyLogsFilter({});
        } },
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Button
      type="button"
      variant="default"
      onClick={onClick}
      disabled={preparing}
      className={className}
    >
      {preparing === true ? "[ Preparing… ]" : "[ Export debug snapshot ]"}
    </Button>
  );
}
