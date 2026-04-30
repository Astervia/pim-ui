/**
 * Phase 4 D-10/D-11/D-12/D-13/D-14: <RouteTogglePanel /> — three-state
 * routing-control surface for the Dashboard (and the Routing tab in
 * 04-03 per D-15).
 *
 * Runtime states (D-11):
 *   - **Off (idle)**: badge `[OFF]`, body line `ROUTE_OFF_BODY`,
 *     single action `[ TURN ON ROUTING ]`.
 *   - **Pre-flight expanded** (local `expanded === true`): badge
 *     `[PRE-FLIGHT]`, body shows the 3-row checklist from
 *     `derivePreflight(status)`, actions `[ CONFIRM TURN ON ]` /
 *     `[ CANCEL ]`. `[ CONFIRM TURN ON ]` is `aria-disabled` when any
 *     row fails.
 *   - **On (routing)**: badge `[ON]`, body line from
 *     `formatRouteLine(status, routeTable)`, single action
 *     `[ TURN OFF ROUTING ]`.
 *   - **Pending** (local `pending === true`): badge label `…` (cursor
 *     blink), other state preserved underneath; resolves when the
 *     RPC settles and the snapshot's route_on event flips.
 *
 * D-13 RPC orchestration:
 *   - `[ CONFIRM TURN ON ]` → `route.set_split_default({ on: true })`.
 *     Snapshot's `route_on` `status.event` flips, `useRouteOn()`
 *     returns true, panel transitions to on without optimistic UI.
 *   - On RPC error: sonner toast `Couldn't enable routing: {message}`
 *     (no exclamation), keep panel in pre-flight expanded, prepend a
 *     `✗ {message}` row to the checklist.
 *   - `[ TURN OFF ROUTING ]` → `route.set_split_default({ on: false })`.
 *     On RPC error: `Couldn't turn off routing: {message}` toast.
 *
 * D-30 limited mode: when daemon state is not `running`, panel dims to
 * opacity-60 and badge becomes `[STALE]`; all buttons are aria-disabled.
 *
 * Brand absolutes (D-36): flat-only surfaces (no border-radius, no
 * blends, no shadow effects), brand tokens only (no literal palette),
 * bang-free conditionals (=== false / === null / === true). No
 * exclamation marks anywhere — JSX text, string literals, comments.
 *
 * W1 contract: this component owns ZERO Tauri event subscriptions. It
 * reads `useRouteOn()` / `useSelectedGateway()` (selectors over
 * useDaemonState) and `useRouteTable()` (a W1 fan-out joiner).
 *
 * Locked-copy contract (D-26 §6 / `src/lib/copy.ts`): every user-
 * visible string is imported from `@/lib/copy`. The `pnpm audit:copy`
 * gate fails the build if a paraphrase appears here.
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CliPanel } from "@/components/brand/cli-panel";
import { Button } from "@/components/ui/button";
import { useStatus } from "@/hooks/use-status";
import { useRouteOn, useSelectedGateway } from "@/hooks/use-routing";
import { useRouteTable } from "@/hooks/use-route-table";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { callDaemon } from "@/lib/rpc";
import { formatRouteLine, derivePreflight } from "@/lib/routing";
import {
  ROUTE_OFF_BODY,
  ROUTE_TOGGLE_TURN_ON,
  ROUTE_TOGGLE_TURN_OFF,
  ROUTE_TOGGLE_CONFIRM,
  ROUTE_TOGGLE_CANCEL,
} from "@/lib/copy";
import { cn } from "@/lib/utils";

export interface RouteTogglePanelProps {
  /** D-30: when true, panel dims to opacity-60 and badge flips to [STALE]. */
  limitedMode?: boolean;
  /**
   * Phase 5 — when true AND routing is ON, the underlying CliPanel
   * renders with `emphasis` (2px primary left border). Defaults to
   * true; pass false to suppress (e.g. on the dedicated Routing tab
   * where emphasis would be redundant).
   */
  emphasizeWhenOn?: boolean;
  /** Phase 2/5 — staggered reveal delay forwarded to CliPanel. */
  revealDelay?: number | null;
}

/** Defensive coercion of an unknown thrown value to a user-safe message. */
function errorMessage(e: unknown): string {
  if (e !== null && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    return typeof m === "string" ? m : String(m);
  }
  return e instanceof Error ? e.message : String(e);
}

export function RouteTogglePanel({
  limitedMode = false,
  emphasizeWhenOn = true,
  revealDelay = 0,
}: RouteTogglePanelProps) {
  const status = useStatus();
  const routeOn = useRouteOn();
  // gwPeer reserved for future enrichment (D-14); current rendering
  // path goes through formatRouteLine which derives the same value
  // from status itself. Pulling the selector keeps a single derived
  // source of truth and ensures re-renders track gateway changes.
  void useSelectedGateway();
  const { table: routeTable } = useRouteTable();
  // Snapshot reader to feed reactive re-renders even when only
  // route-on flips (selectors above already cover this; explicit
  // dependency keeps the panel in step with future snapshot-driven
  // derivations without prop drilling).
  void useDaemonState();

  const [expanded, setExpanded] = useState<boolean>(false);
  // `pendingDirection` carries both "is an RPC in flight" and "what
  // are we trying to flip TO" so the body can render an optimistic
  // "TURNING ON…" / "TURNING OFF…" message immediately on click —
  // no perceived freeze while the daemon round-trips and the
  // status.event lands.
  const [pendingDirection, setPendingDirection] =
    useState<"on" | "off" | null>(null);
  const pending = pendingDirection !== null;
  const [errorRow, setErrorRow] = useState<string | null>(null);

  const onTurnOn = (): void => {
    setExpanded(true);
    setErrorRow(null);
  };
  const onCancel = (): void => {
    setExpanded(false);
    setErrorRow(null);
  };

  const onConfirm = async (): Promise<void> => {
    setPendingDirection("on");
    setErrorRow(null);
    setExpanded(false);
    try {
      await callDaemon("route.set_split_default", { on: true });
    } catch (e) {
      const msg = errorMessage(e);
      toast.error(`Couldn't enable routing: ${msg}`);
      setExpanded(true);
      setErrorRow(`✗ ${msg}`);
      setPendingDirection(null);
    }
  };

  const onTurnOff = async (): Promise<void> => {
    setPendingDirection("off");
    try {
      await callDaemon("route.set_split_default", { on: false });
    } catch (e) {
      const msg = errorMessage(e);
      toast.error(`Couldn't turn off routing: ${msg}`);
      setPendingDirection(null);
    }
  };

  // Auto-clear pendingDirection when daemon-confirmed routeOn matches
  // the optimistic direction. Without this, the body falls through to
  // OFF/PRE-FLIGHT between the RPC response and the status.event
  // arrival — perceived as a flicker / "stuck" feeling.
  useEffect(() => {
    if (pendingDirection === null) return;
    if (pendingDirection === "on" && routeOn === true) {
      setPendingDirection(null);
    } else if (pendingDirection === "off" && routeOn === false) {
      setPendingDirection(null);
    }
  }, [pendingDirection, routeOn]);

  // Watchdog: if the daemon-confirmed flip never lands (e.g. the
  // status.event broadcast didn't reach us), give up after 5s and
  // fall back to whatever routeOn says. Prevents the panel from
  // sitting in pending forever.
  useEffect(() => {
    if (pendingDirection === null) return;
    const t = setTimeout(() => {
      setPendingDirection(null);
    }, 5000);
    return () => clearTimeout(t);
  }, [pendingDirection]);

  // ─── Badge derivation ──────────────────────────────────────────
  // D-30 wins over routeOn so a stopped daemon never claims [ON].
  let badgeLabel: string;
  let badgeVariant: "default" | "muted";
  let badgeBlink = false;
  if (limitedMode === true) {
    badgeLabel = "STALE";
    badgeVariant = "muted";
  } else if (pending === true) {
    badgeLabel = "…";
    badgeVariant = "default";
    badgeBlink = true;
  } else if (routeOn === true) {
    badgeLabel = "ON";
    badgeVariant = "default";
  } else if (expanded === true) {
    badgeLabel = "PRE-FLIGHT";
    badgeVariant = "default";
  } else {
    badgeLabel = "OFF";
    badgeVariant = "muted";
  }

  const buttonsDisabled = limitedMode === true || pending === true;

  // ─── Body branching ────────────────────────────────────────────
  let body: React.ReactNode;
  if (pendingDirection !== null) {
    // Optimistic loading body — visible while the RPC round-trips
    // AND while waiting for the daemon-confirmed status.event to
    // flip `routeOn`. Made deliberately prominent (uppercase, primary
    // color, blink) because user reports the previous compact line
    // didn't read as "loading" clearly enough.
    const label =
      pendingDirection === "on"
        ? "turning routing on"
        : "turning routing off";
    body = (
      <div className="flex flex-col gap-2 py-2">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3 font-code text-sm text-primary"
        >
          <span aria-hidden="true" className="cursor-blink text-base">
            ◆
          </span>
          <span className="uppercase tracking-wider">{label}…</span>
        </div>
        <p className="font-mono text-xs text-text-secondary pl-7">
          waiting for daemon to confirm
        </p>
      </div>
    );
  } else if (routeOn === true) {
    const line = formatRouteLine(status, routeTable);
    // line === null means route_on is true but there is no
    // selected_gateway. Two sub-cases:
    //   - self-gateway: this node IS the gateway; route_on on top of
    //     that is a no-op (egress goes through our NAT, not the mesh)
    //     and ROUTE_OFF_BODY would lie about "uses your normal
    //     connection".
    //   - non-gateway: kill-switch state — banner above already tells
    //     the user pim is blocking internet; the panel here would
    //     contradict if it said "uses your normal connection".
    // Pick honest copy for each case so the panel aligns with the
    // banner instead of denying the kill-switch.
    const isSelfGateway =
      status === null ? false : status.role.includes("gateway") === true;
    const fallbackLine =
      isSelfGateway === true
        ? "you are the gateway · routing through the mesh has no effect"
        : "no upstream gateway · routing blocked until one reconnects";
    body = (
      <div className="flex flex-col gap-3">
        <p className="font-code text-sm text-foreground">
          {line === null ? fallbackLine : line}
        </p>
        <div>
          <Button
            variant="default"
            onClick={() => {
              void onTurnOff();
            }}
            aria-disabled={buttonsDisabled === true ? true : undefined}
            aria-busy={pending === true ? true : undefined}
          >
            {ROUTE_TOGGLE_TURN_OFF}
          </Button>
        </div>
      </div>
    );
  } else if (expanded === true) {
    const pre = derivePreflight(status);
    const confirmDisabled =
      pre.ok === false || pending === true || limitedMode === true;
    body = (
      <div className="flex flex-col gap-2">
        {errorRow === null ? null : (
          <p className="font-code text-sm text-destructive">{errorRow}</p>
        )}
        <ul role="list" className="flex flex-col gap-1">
          {pre.rows.map((r, i) => (
            <li
              key={i}
              className="flex items-baseline gap-2 font-code text-sm"
            >
              <span
                aria-hidden="true"
                className={
                  r.ok === true ? "text-primary" : "text-destructive"
                }
              >
                {r.ok === true ? "✓" : "✗"}
              </span>
              <span
                className={
                  r.ok === true ? "text-foreground" : "text-destructive"
                }
              >
                {r.msg}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-3 mt-2">
          <Button
            variant="default"
            onClick={() => {
              void onConfirm();
            }}
            aria-disabled={confirmDisabled === true ? true : undefined}
            aria-busy={pending === true ? true : undefined}
          >
            {ROUTE_TOGGLE_CONFIRM}
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            aria-disabled={pending === true ? true : undefined}
          >
            {ROUTE_TOGGLE_CANCEL}
          </Button>
        </div>
      </div>
    );
  } else {
    // Off (idle).
    body = (
      <div className="flex flex-col gap-3">
        <p className="font-code text-sm text-foreground">{ROUTE_OFF_BODY}</p>
        <div>
          <Button
            variant="default"
            onClick={onTurnOn}
            aria-disabled={limitedMode === true ? true : undefined}
          >
            {ROUTE_TOGGLE_TURN_ON}
          </Button>
        </div>
      </div>
    );
  }

  const emphasis =
    emphasizeWhenOn === true && routeOn === true && limitedMode === false;

  return (
    <CliPanel
      title="ROUTING"
      status={{
        label: badgeBlink === true ? badgeLabel : badgeLabel,
        variant: badgeVariant,
      }}
      emphasis={emphasis}
      revealDelay={revealDelay}
      className={cn(
        limitedMode === true && "opacity-60",
        // The CliPanel Badge does not currently expose a blink prop;
        // we tag the wrapper so the badge inherits the cursor-blink
        // animation (defined in globals.css). The class only applies
        // a blinking opacity to descendants, leaving the body alone.
        badgeBlink === true && "[&_header_span:last-child]:cursor-blink",
      )}
    >
      {body}
    </CliPanel>
  );
}
