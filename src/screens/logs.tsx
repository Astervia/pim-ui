/**
 * LogsScreen — ⌘5 Logs tab composition.
 *
 * Spec: UI-SPEC §S5 Logs tab, §Logs tab [STATUS] badge states.
 *
 * Composition (post-redesign):
 *   - CliPanel title "logs" with a richer status: stream state +
 *     visible-count + filtered-out-count.
 *   - LogToolbar — search hero · severity rail · source picker · peer ·
 *     time · density · pause · export.
 *   - LogList — virtualized, grouped, density-aware, expandable rows.
 *
 * Density and pause are local-state on this screen, NOT persisted to
 * the daemon — they're a viewing preference, not configuration. They
 * survive remounts via localStorage so a return visit shows the user's
 * last setting.
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

import { useEffect, useState } from "react";
import { CliPanel } from "@/components/brand/cli-panel";
import {
  LogToolbar,
  type LogDensity,
} from "@/components/logs/log-toolbar";
import { LogList } from "@/components/logs/log-list";
import { LogDaemonDown } from "@/components/logs/log-daemon-down";
import {
  setCratesAtom,
  setLevelsAtom,
  setPeerAtom,
  setSourceAtom,
  useLogsStream,
  type StreamStatus,
} from "@/hooks/use-logs-stream";
import { useFilteredLogs, useLogFilters } from "@/hooks/use-log-filters";
import { useDaemonState } from "@/hooks/use-daemon-state";
import { ScreenContainer } from "@/components/shell/screen-container";
import type { BadgeVariant } from "@/components/ui/badge";

interface BadgeSpec {
  label: string;
  variant: BadgeVariant;
}

function badgeFor(status: StreamStatus, paused: boolean): BadgeSpec {
  if (paused === true) return { label: "PAUSED", variant: "warning" };
  if (status === "reconnecting") return { label: "RECONNECTING", variant: "muted" };
  if (status === "idle") return { label: "IDLE", variant: "muted" };
  return { label: "STREAMING", variant: "default" };
}

const DENSITY_KEY = "pim-ui:logs:density";
const ALL_LEVELS = new Set<"trace" | "debug" | "info" | "warn" | "error">([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
]);

function readDensityPref(): LogDensity {
  if (typeof window === "undefined") return "compact";
  try {
    const v = window.localStorage.getItem(DENSITY_KEY);
    if (v === "comfortable") return "comfortable";
    return "compact";
  } catch {
    return "compact";
  }
}

export function LogsScreen() {
  const {
    levels,
    toggleLevel,
    crates,
    toggleCrate,
    setCrates,
    discoveredCrates,
    peerFilter,
    setPeerFilter,
    allEvents,
    status,
    errorMessage,
  } = useLogsStream();
  const { searchText, setSearchText, timeRange, setTimeRange } = useLogFilters();
  const { snapshot: daemonSnapshot } = useDaemonState();

  const { rows } = useFilteredLogs();

  const [density, setDensity] = useState<LogDensity>(() => readDensityPref());
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(DENSITY_KEY, density);
    } catch {
      // ignore — preference is best-effort.
    }
  }, [density]);

  // Phase 6 (UI/UX P2.13) — listen for a one-shot browser CustomEvent
  // that pre-applies a crate-prefix filter. The IdentityPanel
  // `show why →` button dispatches `pim:logs-prefilter-source` with
  // `{ detail: { source } }` right before navigating here.
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

  const filtersDirty =
    levels.size !== ALL_LEVELS.size ||
    crates.size > 0 ||
    peerFilter !== null ||
    searchText.length > 0 ||
    timeRange.kind !== "preset" ||
    (timeRange.kind === "preset" && timeRange.preset !== "all");

  const onClearFilters = () => {
    setLevelsAtom(ALL_LEVELS);
    setCratesAtom(new Set<string>());
    setPeerAtom(null);
    setSourceAtom(null);
    setSearchText("");
    setTimeRange({ kind: "preset", preset: "all" });
  };

  const totalBuffered = allEvents.length;
  const totalVisible = rows.length;
  const hidden = Math.max(0, totalBuffered - totalVisible);

  const badge = badgeFor(status, paused);
  const hasError =
    errorMessage === null || errorMessage === undefined ? false : true;
  // Daemon must be in "running" state for the JSON-RPC log subscribe to
  // even have a chance. Any other state is the dominant explanation for
  // an empty stream — surface that instead of the cryptic technical
  // error so a first-time user can act on it (UX-PLAN P1).
  const daemonDown =
    daemonSnapshot.state !== "running" || hasError === true;

  return (
    <ScreenContainer density="wide">
      <CliPanel title="logs" status={badge}>
        {/* Status strip — counts + buffer state. Always visible. */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 pt-3 pb-1 font-code text-[11px]">
          <div className="flex items-center gap-3 text-text-secondary">
            <span>
              <span className="text-foreground tabular-nums">
                {totalVisible.toLocaleString()}
              </span>{" "}
              <span className="text-muted-foreground">visible</span>
            </span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span>
              <span className="text-foreground tabular-nums">
                {totalBuffered.toLocaleString()}
              </span>{" "}
              <span className="text-muted-foreground">buffered</span>
            </span>
            {hidden > 0 && (
              <>
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <span>
                  <span className="text-accent tabular-nums">
                    {hidden.toLocaleString()}
                  </span>{" "}
                  <span className="text-muted-foreground">hidden by filters</span>
                </span>
              </>
            )}
          </div>
          <span className="text-muted-foreground">
            ring buffer · max 2,000 entries · drop-oldest
          </span>
        </div>

        <LogToolbar
          levels={levels}
          onToggleLevel={toggleLevel}
          crates={crates}
          onToggleCrate={toggleCrate}
          onSetCrates={setCrates}
          discoveredCrates={discoveredCrates}
          peerFilter={peerFilter}
          onPeerFilterChange={setPeerFilter}
          events={allEvents}
          density={density}
          onDensityChange={setDensity}
          paused={paused}
          onPausedChange={setPaused}
          filtersDirty={filtersDirty}
          onClearFilters={onClearFilters}
        />

        {daemonDown === true ? (
          <LogDaemonDown
            daemonState={daemonSnapshot.state}
            technicalError={errorMessage}
          />
        ) : (
          <LogList events={rows} density={density} paused={paused} />
        )}
      </CliPanel>
    </ScreenContainer>
  );
}
