/**
 * <IdentityPanel /> — the top CliPanel on the Dashboard (02-UI-SPEC §S2,
 * 02-CONTEXT D-08/D-09/D-30).
 *
 * Honest rendering contract:
 *   - Hero line: `█ pim · {node.name}` — the block + wordmark get the
 *     `.phosphor` glow, the middle-dot separator is `·` (U+00B7), and
 *     the node name stays plain foreground.
 *   - Detail line: `mesh: {mesh_ip} · interface {iface.name} · {up|down}
 *     · {formatDuration(uptime_s)}` — lowercase, `·` separators. When the
 *     interface is down, the `down` token renders `text-destructive` and
 *     the line appends a `· show why →` affordance (routed by Plan 02-06).
 *   - Limited mode (D-30): panel dims to opacity-60 and the detail line
 *     appends a relative `last seen: {N ago}` line derived from the
 *     snapshot's baselineTimestamp.
 *   - Status badge: `[LIVE]` in normal operation, `[STALE]` in limited
 *     mode (UI-SPEC §Identity panel).
 *   - Loading (status === null, D-07): a single muted "Loading status…"
 *     line inside the panel body — no placeholder zeros.
 *
 * Copy rules (enforced by checker):
 *   - `█ pim` verbatim — block character U+2588 + ASCII space + "pim".
 *   - Separator `·` U+00B7, never `.` / `*` / `•`.
 *   - No exclamation marks anywhere.
 *   - No border-radius, no gradients, no literal Tailwind palette colors
 *     (e.g. numeric-variant tokens) — brand tokens only.
 */

import type { Status } from "@/lib/rpc-types";
import { CliPanel } from "@/components/brand/cli-panel";
import { StatusIndicator } from "@/components/brand/status-indicator";
import { formatDuration } from "@/lib/format";
import { useActiveScreen } from "@/hooks/use-active-screen";
import { cn } from "@/lib/utils";

export interface IdentityPanelProps {
  status: Status | null;
  /** D-30: daemon not in `running` state — dim to 60% + show last-seen hint. */
  limitedMode?: boolean;
  /** D-30: `DaemonSnapshot.baselineTimestamp` (ms since epoch) for the
   *  last-seen hint. Ignored when `limitedMode` is false. */
  lastSeenTimestamp?: number | null;
}

export function IdentityPanel({
  status,
  limitedMode = false,
  lastSeenTimestamp = null,
}: IdentityPanelProps) {
  const { setActive } = useActiveScreen();

  // Loading / pre-seed: honest placeholder, not zeros (D-07).
  if (status === null) {
    return (
      <CliPanel
        title="identity"
        status={{ label: "WAITING", variant: "muted" }}
        density="spacious"
        className={cn(limitedMode === true && "opacity-60")}
      >
        <p className="text-muted-foreground">Loading status…</p>
      </CliPanel>
    );
  }

  const ifaceUp = status.interface.up;
  const indicatorState = ifaceUp === true ? "active" : "failed";

  const badge = limitedMode === true
    ? { label: "STALE", variant: "muted" as const }
    : { label: "LIVE", variant: "default" as const };

  // D-30 last-seen hint: relative duration from baselineTimestamp to now.
  const hasBaseline =
    lastSeenTimestamp === null || lastSeenTimestamp === undefined
      ? false
      : true;
  const lastSeenLine =
    limitedMode === true && hasBaseline === true
      ? formatDuration(
          Math.floor((Date.now() - (lastSeenTimestamp as number)) / 1000),
        )
      : null;

  return (
    <CliPanel
      title="identity"
      status={badge}
      density="spacious"
      className={cn(limitedMode === true && "opacity-60")}
    >
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-mono text-xl tracking-tight leading-[1.4]">
          <span className="phosphor">█ pim</span>
          <span className="text-muted-foreground"> · </span>
          <span className="text-foreground">{status.node}</span>
        </h1>
        <StatusIndicator state={indicatorState} />
      </div>

      <p className="mt-1 text-sm text-foreground">
        <span className="text-muted-foreground">mesh:</span> {status.mesh_ip}
        <span className="text-muted-foreground"> · </span>
        interface {status.interface.name}
        <span className="text-muted-foreground"> · </span>
        <span className={ifaceUp === true ? "" : "text-destructive"}>
          {ifaceUp === true ? "up" : "down"}
        </span>
        <span className="text-muted-foreground"> · </span>
        {formatDuration(status.uptime_s)}
        {ifaceUp === false && (
          <>
            <span className="text-muted-foreground"> · </span>
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              // D-09: canonical behavior routes to Logs filtered by
              // source: "transport". Phase 2 ships navigation-only — the
              // Logs filter bar exposes level + peer filters (Plan 02-05);
              // the source filter UI lands in Phase 3 (OBS-02). Clicking
              // here jumps to the Logs tab so the user can read the
              // transport-level diagnostic inline; no pre-filter applied.
              onClick={() => setActive("logs")}
            >
              show why →
            </button>
          </>
        )}
        {lastSeenLine === null ? null : (
          <span className="text-muted-foreground">
            {" · "}last seen: {lastSeenLine} ago
          </span>
        )}
      </p>
    </CliPanel>
  );
}
