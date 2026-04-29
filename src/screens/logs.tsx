/**
 * LogsScreen — ⌘5 Logs tab composition.
 *
 * Spec: UI-SPEC §S5 Logs tab, §Logs tab [STATUS] badge states.
 *
 * Composes:
 *   - CliPanel title "logs" (auto-uppercased to LOGS by the primitive)
 *   - [STATUS] badge reflecting useLogsStream().status:
 *       streaming    → [STREAMING]   (default variant, signal green)
 *       reconnecting → [RECONNECTING] (muted — short-lived retry state)
 *       idle         → [IDLE]         (muted — retry exhausted)
 *     Note: "paused" is a LogList-level scroll state (UI-SPEC §S5 pill),
 *     not a CliPanel badge state — the pill copy surfaces that state.
 *   - LogFilterBar bound to hook state
 *   - LogList rendering filtered events
 *
 * Error surface: when useLogsStream reports errorMessage (post-D-31
 * retry exhaustion), render an inline destructive note instead of the
 * list. Plan 02-06 wires the dedicated toast — this inline copy is the
 * local honest-surfacing fallback until then.
 *
 * Phase 6 (UI/UX P2.13): on mount, drain a one-shot
 * `pim:logs-prefilter-source` browser CustomEvent dispatched by the
 * IdentityPanel `show why →` affordance. The detail.source value is
 * applied as the multi-select crate prefix filter so the user lands
 * on Logs already narrowed to the relevant crate (e.g. "transport").
 * Browser CustomEvent only — no Tauri listen() — so the W1 invariant
 * is preserved.
 *
 * Brand rules: zero border radius, no shadows, no literal palette
 * colors, no exclamation marks anywhere in this file.
 */

import { useEffect } from "react";
import { CliPanel } from "@/components/brand/cli-panel";
import { LogFilterBar } from "@/components/logs/log-filter-bar";
import { LogList } from "@/components/logs/log-list";
import {
  setCratesAtom,
  useLogsStream,
  type StreamStatus,
} from "@/hooks/use-logs-stream";
import { useFilteredLogs } from "@/hooks/use-log-filters";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { ScreenRefresh } from "@/components/brand/screen-refresh";
import { ScreenContainer } from "@/components/shell/screen-container";
import type { BadgeVariant } from "@/components/ui/badge";

interface BadgeSpec {
  label: string;
  variant: BadgeVariant;
}

function badgeFor(status: StreamStatus): BadgeSpec {
  if (status === "reconnecting") return { label: "RECONNECTING", variant: "muted" };
  if (status === "idle") return { label: "IDLE", variant: "muted" };
  // "streaming" or "paused" — CliPanel shows STREAMING; the paused scroll
  // state is communicated by the LogList pill, not the panel badge.
  return { label: "STREAMING", variant: "default" };
}

export function LogsScreen() {
  const {
    levels,
    toggleLevel,
    crates,
    toggleCrate,
    discoveredCrates,
    peerFilter,
    setPeerFilter,
    status,
    errorMessage,
  } = useLogsStream();
  const { actions } = useDaemonState();
  // events arrive pre-filtered by levels + crates + peer + source
  // (all client-side) from useLogsStream; useFilteredLogs adds the
  // search-text + time-range filters on top per D-21 / D-22.
  const { rows } = useFilteredLogs();

  // Phase 6 (UI/UX P2.13) — listen for a one-shot browser CustomEvent
  // that pre-applies a crate-prefix filter. The IdentityPanel
  // `show why →` button dispatches `pim:logs-prefilter-source` with
  // `{ detail: { source } }` right before navigating here. We narrow
  // the multi-select crates set to the requested prefix so the user
  // lands already filtered to the diagnostic stream they asked about.
  // Any subsequent crate toggle via LogFilterBar overrides this freely.
  //
  // Limitation: the daemon's log `source` field may carry a `pim_`
  // prefix (e.g. `pim_transport`). The crate filter does prefix
  // matching, so a dispatched value of `"transport"` matches any
  // source starting with that exact string — adjust the dispatched
  // value (and any future routing site) when the daemon-side log
  // source conventions firm up.
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ source?: string }>;
      const src = ce.detail?.source;
      if (typeof src !== "string" || src.length === 0) return;
      setCratesAtom(new Set([src]));
    };
    window.addEventListener("pim:logs-prefilter-source", handler);
    return () => {
      window.removeEventListener("pim:logs-prefilter-source", handler);
    };
  }, []);

  const badge = badgeFor(status);
  const hasError =
    errorMessage === null || errorMessage === undefined ? false : true;

  return (
    <ScreenContainer density="wide">
      <ScreenRefresh
        onRefresh={actions.reseed}
        ariaLabel="refresh logs"
      />
      <CliPanel title="logs" status={badge}>
        <LogFilterBar
          levels={levels}
          onToggleLevel={toggleLevel}
          crates={crates}
          onToggleCrate={toggleCrate}
          discoveredCrates={discoveredCrates}
          peerFilter={peerFilter}
          onPeerFilterChange={setPeerFilter}
        />
        {hasError === true ? (
          <p className="font-code text-sm text-destructive px-4">
            Couldn't subscribe to logs.event. {errorMessage}
          </p>
        ) : (
          <LogList events={rows} />
        )}
      </CliPanel>
    </ScreenContainer>
  );
}
