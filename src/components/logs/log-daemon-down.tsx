/**
 * LogDaemonDown — friendly empty state shown on the Logs tab when the
 * daemon isn't actually running.
 *
 * Replaces the old `Couldn't subscribe to logs.event. [object Object]`
 * line — that error fires whenever the JSON-RPC subscribe fails, and
 * the most common cause by far is a daemon that hasn't been started
 * yet. Telling a non-technical user "couldn't subscribe to logs.event"
 * gives them nothing to act on. UX-PLAN.md P1 ("honest over polished")
 * still applies — we name the actual reason ("daemon stopped",
 * "daemon error during boot", etc.) and route the user to where they
 * can act on it.
 *
 * Branches on the lifecycle state from `useDaemonState().snapshot.state`:
 *
 *   stopped       → "daemon is not running" + [ go to dashboard ]
 *   starting      → "daemon is starting…" — spinner, no action
 *   reconnecting  → "daemon reconnecting…" — spinner, no action
 *   error         → "daemon failed to start" + [ go to dashboard ]
 *   running but
 *     subscribe
 *     failed       → technical error preserved + [ go to dashboard ]
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { Button } from "@/components/ui/button";
import { useActiveScreen } from "@/hooks/use-active-screen";
import { cn } from "@/lib/utils";
import type { DaemonState } from "@/lib/daemon-state";

export interface LogDaemonDownProps {
  /** Daemon lifecycle state from useDaemonState().snapshot.state. */
  daemonState: DaemonState;
  /** Underlying logs-stream errorMessage when daemon === "running" but
   *  subscribe still fails (rare — local socket present but daemon RPC
   *  not yet ready, schema mismatch, etc). */
  technicalError: string | null;
}

export function LogDaemonDown({
  daemonState,
  technicalError,
}: LogDaemonDownProps) {
  const { setActive } = useActiveScreen();
  const goDashboard = () => setActive("dashboard");

  const isTransient =
    daemonState === "starting" || daemonState === "reconnecting";

  let title: string;
  let body: string;
  let primaryAction: { label: string; onClick: () => void } | null = null;

  if (daemonState === "stopped") {
    title = "daemon is not running";
    body =
      "Logs stream live from pim-daemon — start the daemon and the rail will fill in real time.";
    primaryAction = { label: "go to dashboard", onClick: goDashboard };
  } else if (daemonState === "starting") {
    title = "daemon is starting…";
    body =
      "Wait a moment — once rpc.hello completes, the log stream attaches automatically.";
  } else if (daemonState === "reconnecting") {
    title = "daemon reconnecting…";
    body =
      "The local socket dropped. The UI is auto-retrying; the stream returns when it is back.";
  } else if (daemonState === "error") {
    title = "daemon failed to start";
    body =
      "The daemon process exited before rpc.hello succeeded. Open the dashboard for the crash details and retry.";
    primaryAction = { label: "go to dashboard", onClick: goDashboard };
  } else {
    // running but subscribe failed — uncommon path
    title = "logs.event subscribe failed";
    body =
      "The daemon is running but rejected the log subscription. Try the dashboard for daemon details, or restart the daemon.";
    primaryAction = { label: "go to dashboard", onClick: goDashboard };
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
      <pre
        aria-hidden
        className="font-code text-muted-foreground text-[11px] leading-tight m-0 select-none"
      >
{`     ┌──────────────────────┐
     │  ··· no stream ··· ··│
     └──────────────────────┘`}
      </pre>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <h3
          className={cn(
            "font-mono text-sm uppercase tracking-[0.2em]",
            daemonState === "error"
              ? "text-destructive"
              : isTransient === true
                ? "text-accent"
                : "text-foreground",
          )}
        >
          {title}
          {isTransient === true && (
            <span aria-hidden className="ml-2 phosphor-pulse">
              ▮
            </span>
          )}
        </h3>
        <p className="font-code text-xs text-text-secondary max-w-[460px] leading-relaxed">
          {body}
        </p>
      </div>

      {primaryAction !== null && (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={primaryAction.onClick}
        >
          {primaryAction.label} →
        </Button>
      )}

      {technicalError !== null && technicalError.length > 0 && (
        <details className="font-code text-[11px] text-text-secondary mt-2 max-w-[520px]">
          <summary className="cursor-pointer text-muted-foreground uppercase tracking-widest text-[10px] hover:text-primary">
            technical detail
          </summary>
          <pre className="whitespace-pre-wrap break-words mt-2 px-3 py-2 border border-border bg-popover/40 text-destructive">
            {technicalError}
          </pre>
        </details>
      )}
    </div>
  );
}
