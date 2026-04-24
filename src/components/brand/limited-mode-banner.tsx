/**
 * <LimitedModeBanner /> — full-width, non-dismissible system-state surface.
 * Rendered above the main content whenever daemon.state !== "running".
 *
 * Spec: 01-UI-SPEC.md §Surface 3. Exact copy from §Copywriting Contract.
 *
 * B2 fix: the START button calls useTunPermission().requestPermission() BEFORE
 * actions.start(), so both entry points (toggle + banner) hit the same modal
 * provided by <TunPermissionProvider /> at the app root. Prior design skipped
 * the prompt here entirely; that was a B2 inverse bug.
 *
 * I2 resolution: `onOpenLogs` is optional. The [ VIEW LOGS ] button is only
 * rendered when the prop is provided. Phase 1 surfaces do not pass it —
 * Phase 2 adds the logs tab and begins passing a real handler.
 *
 * Border width deviates from the project's 1px rule: the left border is
 * 2px accent (or 2px destructive on error/external-kill). This is the
 * ONLY place in Phase 1 where border-width exceeds 1px, called out in
 * the UI spec as an intentional system-critical emphasis.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { useTunPermission } from "./tun-permission-modal";
import type { DaemonState } from "@/lib/daemon-state";

export interface LimitedModeBannerProps {
  onOpenLogs?: () => void;
  className?: string;
}

interface Variant {
  headlineGlyph: string;
  headlineText: string;
  body: string;
  accentClass: string; // "accent" or "destructive"
}

function variantFor(
  state: DaemonState,
  errorMsg: string | null,
  externalKill: boolean,
): Variant {
  if (state === "error") {
    return {
      headlineGlyph: "✗",
      headlineText: "DAEMON ERROR",
      body:
        errorMsg ??
        "pim-daemon reported an error. Start again, or inspect logs.",
      accentClass: "destructive",
    };
  }
  if (state === "starting") {
    return {
      headlineGlyph: "◐",
      headlineText: "STARTING DAEMON…",
      body: "Waiting for rpc.hello handshake.",
      accentClass: "accent",
    };
  }
  if (state === "reconnecting") {
    return {
      headlineGlyph: "◐",
      headlineText: "RECONNECTING…",
      body: "Daemon socket reappeared. Restoring subscriptions.",
      accentClass: "accent",
    };
  }
  if (externalKill) {
    return {
      headlineGlyph: "✗",
      headlineText: "DAEMON STOPPED UNEXPECTEDLY",
      body:
        "The daemon process exited. Start it to reconnect. See docs/TROUBLESHOOTING.md §unexpected-stop.",
      accentClass: "destructive",
    };
  }
  return {
    headlineGlyph: "◐",
    headlineText: "LIMITED MODE",
    body: "pim daemon is stopped. Start it to join the mesh.",
    accentClass: "accent",
  };
}

export function LimitedModeBanner({
  onOpenLogs,
  className,
}: LimitedModeBannerProps) {
  const { snapshot, actions } = useDaemonState();
  const { requestPermission } = useTunPermission();
  if (snapshot.state === "running") return null;

  // Heuristic: if we previously saw a `running` state (baselineTimestamp set) and
  // are now stopped with no user-initiated action, treat as external kill.
  const externalKill =
    snapshot.state === "stopped" && snapshot.baselineTimestamp !== null;

  const v = useMemo(
    () =>
      variantFor(
        snapshot.state,
        snapshot.lastError?.message ?? null,
        externalKill,
      ),
    [snapshot.state, snapshot.lastError?.message, externalKill],
  );

  const isDestructive = v.accentClass === "destructive";
  const leftBorderClass = isDestructive
    ? "border-l-destructive"
    : "border-l-accent";
  const headlineColor = isDestructive ? "text-destructive" : "text-accent";
  const glyphAnim =
    snapshot.state === "starting" || snapshot.state === "reconnecting"
      ? "cursor-blink"
      : "";

  // B2 fix: START path gates through requestPermission, matching DaemonToggle.
  const onStart = async () => {
    const granted = await requestPermission();
    if (!granted) return;
    await actions.start();
  };

  return (
    <section
      role={isDestructive ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "border bg-card p-6",
        "border-border border-l-2",
        leftBorderClass,
        "rounded-none",
        className,
      )}
    >
      <header className="flex items-center gap-3 font-mono text-sm uppercase tracking-widest">
        <span
          className={cn("font-mono", headlineColor, glyphAnim)}
          aria-hidden="true"
        >
          {v.headlineGlyph}
        </span>
        <span className={cn("font-semibold", headlineColor)}>
          {v.headlineText}
        </span>
      </header>
      <div className="mt-4 border-t border-border pt-4 font-mono text-sm text-foreground max-w-[60ch] leading-[1.6]">
        {v.body}
      </div>
      <div className="mt-4 flex gap-4">
        <Button
          type="button"
          size="lg"
          onClick={() => {
            void onStart();
          }}
          aria-disabled={
            snapshot.state === "starting" ||
            snapshot.state === "reconnecting" ||
            undefined
          }
        >
          {snapshot.state === "error" ? "RETRY START" : "START DAEMON"}
        </Button>
        {/* I2: only render [ VIEW LOGS ] if the parent provides a handler.
            Phase 1 does not — Phase 2 wires the logs tab. */}
        {onOpenLogs && (
          <Button type="button" variant="ghost" size="lg" onClick={onOpenLogs}>
            VIEW LOGS
          </Button>
        )}
      </div>
    </section>
  );
}
