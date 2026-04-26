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
import {
  pickCrashOnBoot,
  type DaemonState,
  type DaemonLastError,
} from "@/lib/daemon-state";
import type { RpcError } from "@/lib/rpc-types";

export interface LimitedModeBannerProps {
  onOpenLogs?: () => void;
  className?: string;
}

interface Variant {
  headlineGlyph: string;
  headlineText: string;
  body: string;
  accentClass: string; // "accent" or "destructive"
  /**
   * Phase 01.1 D-20 crash-on-boot variant only: a one-line nested sub-row
   * rendered below `body` carrying `·› {stderr_tail_first_line}`. Undefined
   * for every other variant — the body `<div>` skips the `<span>` entirely.
   */
  subRow?: string;
  /**
   * Phase 01.1 D-20: crash-on-boot suppresses the START / RETRY action row
   * entirely (Phase 3 owns the re-edit / re-bootstrap flow). All historic
   * variants leave this undefined so their action row continues to render.
   */
  suppressActions?: boolean;
}

function variantFor(
  state: DaemonState,
  lastError: DaemonLastError | null,
  externalKill: boolean,
): Variant {
  // Phase 01.1 D-20: crash-on-boot branch. Must run BEFORE the generic
  // `state === "error"` branch so the more-specific crash copy wins —
  // Plan 01.1-01 transitions to DaemonState::Error before emitting the
  // crash payload, so without this ordering the generic body would
  // render. `pickCrashOnBoot` returns `null` for every non-crash error.
  const crash = pickCrashOnBoot(lastError);
  if (crash !== null) {
    const stderrFirstLine = crash.stderr_tail.split("\n")[0] ?? "";
    return {
      headlineGlyph: "✗",
      headlineText: "DAEMON ERROR",
      body: `pim-daemon exited in ${crash.elapsed_ms} ms during startup. Check config at ${crash.path}.`,
      accentClass: "destructive",
      subRow: stderrFirstLine.length === 0 ? undefined : `·› ${stderrFirstLine}`,
      suppressActions: true,
    };
  }

  // Historic branches: derive the legacy errorMsg locally from the union.
  // The CrashOnBootError variant has no .message; only the rpc_error
  // variant does. Narrow with `in` rather than a blanket cast so the
  // crash variant (already handled above) stays type-safe in case a
  // future caller forgets the early-return.
  const errorMsg =
    lastError === null
      ? null
      : "message" in lastError
        ? (lastError as RpcError).message
        : null;

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

  // Phase 01.1: pass the full DaemonLastError union — variantFor() now
  // owns the message-extraction AND the D-20 crash-on-boot branch
  // (`pickCrashOnBoot(lastError)` runs first inside variantFor and wins
  // when the rpc_error variant carries a `data.kind === "crash_on_boot"`
  // discriminator). The local message-narrowing that used to live here
  // was a Phase 1 workaround obsoleted by the union extension.
  const lastError = snapshot.lastError;
  const v = useMemo(
    () => variantFor(snapshot.state, lastError, externalKill),
    [snapshot.state, lastError, externalKill],
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
        {/* Phase 01.1 D-20: crash-on-boot variant appends a one-line
            stderr-tail sub-row. `·› ` lead-in is U+00B7 + U+203A. */}
        {v.subRow === undefined ? null : (
          <span className="block mt-2 text-xs text-muted-foreground font-code">
            {v.subRow}
          </span>
        )}
      </div>
      {/* Phase 01.1 D-20: crash-on-boot suppresses START / RETRY entirely
          — Phase 3 owns the re-edit / re-bootstrap flow. Every historic
          variant leaves `suppressActions` undefined so the action row
          continues to render with its existing button(s). */}
      {v.suppressActions === true ? null : (
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
      )}
    </section>
  );
}
