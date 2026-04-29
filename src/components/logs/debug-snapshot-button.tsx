/**
 * DebugSnapshotButton — Phase 3 03-03 Task 2 (OBS-03 / D-23 / D-24).
 *
 * Spec: 03-UI-SPEC §S6 row 3 (right-aligned export button) + §S8
 * Debug snapshot toast.
 *
 * Click flow (post-redesign — native save dialog):
 *   1. Build the DebugSnapshot synchronously from the live daemon
 *      snapshot + the current log buffer + the filter values in effect.
 *   2. Open the OS save dialog via `dialog.save()` (Tauri shell) or
 *      fall back to a Blob+anchor download (plain webview / mobile).
 *   3. On confirmation:
 *        - Tauri path → success toast `Saved to {path}` with a
 *          `[ Reveal ]` action that calls `reveal_in_file_manager`.
 *        - Webview fallback → success toast `Saved as {filename}` with
 *          no reveal action (the browser decides where the file lands).
 *   4. On cancellation: silent — no toast, no download. The user
 *      explicitly chose not to export.
 *   5. On failure (write rejected, dialog crashed): destructive toast
 *      `Couldn't save snapshot.` with the underlying message.
 *
 * Label flips to `[ Preparing… ]` while the dialog is up so a slow
 * picker doesn't read as a frozen button.
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
  revealSnapshotInFileManager,
  saveSnapshot,
} from "@/lib/debug-snapshot";

function timeRangeLabel(r: LogTimeRange): string {
  if (r.kind === "custom") return `Custom (${r.from} – ${r.to})`;
  if (r.preset === "last_5m") return "Last 5 min";
  if (r.preset === "last_15m") return "Last 15 min";
  if (r.preset === "last_1h") return "Last 1 hour";
  if (r.preset === "all") return "All session";
  return "Custom…";
}

function shortenPath(p: string, max: number = 56): string {
  if (p.length <= max) return p;
  // Keep filename + tail context. Truncate from the head.
  return `…${p.slice(p.length - (max - 1))}`;
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

  const onClick = async (): Promise<void> => {
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

      const result = await saveSnapshot(built);
      if (result.kind === "cancelled") {
        // Silent — user chose not to export.
        return;
      }
      if (result.kind === "saved") {
        toast.success(`Saved to ${shortenPath(result.path)}`, {
          duration: 6000,
          action:
            result.revealable === true
              ? {
                  label: "Reveal",
                  onClick: () => {
                    revealSnapshotInFileManager(result.path).catch((e) => {
                      toast.error(
                        `Couldn't reveal: ${e instanceof Error ? e.message : String(e)}`,
                      );
                    });
                  },
                }
              : undefined,
        });
        return;
      }
      // saved-fallback (plain webview Blob download)
      toast.success(`Saved as ${result.filename}`, { duration: 4000 });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // Checker Warning 5 preserved: a `[Show in Logs →]` action lives
      // on the destructive toast so the user has a one-click path to
      // triage the underlying problem.
      toast.error(`Couldn't save snapshot. ${message}`, {
        duration: 8000,
        action: {
          label: "Show in Logs →",
          onClick: () => {
            setActive("logs");
            applyLogsFilter({});
          },
        },
      });
    } finally {
      setPreparing(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={preparing}
      className={className}
    >
      {preparing === true ? "preparing…" : "↓ export"}
    </Button>
  );
}
