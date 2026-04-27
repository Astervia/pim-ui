/**
 * Debug snapshot builder + downloader (OBS-03 / D-23 / D-24).
 *
 * Schema: snake_case verbatim so pasting the JSON into a kernel-repo
 * bug report diffs cleanly against `pim status --json` +
 * `pim logs --json` output. Field names + ordering are load-bearing —
 * change `snapshot_version` to `2` if the schema ever evolves.
 *
 * Filename: `pim-debug-snapshot-{ISO-with-hyphens}.json` per D-24 —
 * colons in the captured_at ISO string are replaced with hyphens so
 * Windows can save the file (Windows reserves `:` in filenames).
 *
 * Download mechanism: Blob + `<a download>` click — works in both
 * the Tauri webview and a future mobile WebView, no Tauri FS API
 * required (D-23). The temporary `<a>` is appended to the document,
 * clicked, and removed; the object URL is revoked on a microtask so
 * the browser has time to start the download.
 */

import type {
  LogEvent,
  LogLevel,
  PeerDiscovered,
  PeerSummary,
  Status,
} from "./rpc-types";

export interface DebugSnapshotFilters {
  level: LogLevel;
  peer_id: string | null;
  text: string;
  time_range: string;
}

export interface DebugSnapshot {
  snapshot_version: 1;
  ui_version: string;
  /** ISO-8601 with milliseconds. */
  captured_at: string;
  daemon_status: Status | null;
  peers: PeerSummary[];
  discovered: PeerDiscovered[];
  logs: LogEvent[];
  filters_applied: DebugSnapshotFilters;
}

export interface BuildSnapshotInput {
  daemonStatus: Status | null;
  peers: PeerSummary[];
  discovered: PeerDiscovered[];
  logs: LogEvent[];
  filters: DebugSnapshotFilters;
}

/**
 * Build the DebugSnapshot object in memory. Pure — no DOM access, no
 * side effects. Safe to call from anywhere; pair with downloadSnapshot
 * to actually trigger the download.
 *
 * Field ordering matches the D-23 schema verbatim so the JSON output
 * is byte-stable across runs (only captured_at + content varies).
 */
export function buildDebugSnapshot(
  input: BuildSnapshotInput,
): DebugSnapshot {
  const versionFromEnv = import.meta.env.VITE_APP_VERSION;
  const uiVersion =
    versionFromEnv === undefined || versionFromEnv === "" ? "unknown" : versionFromEnv;
  return {
    snapshot_version: 1,
    ui_version: uiVersion,
    captured_at: new Date().toISOString(),
    daemon_status: input.daemonStatus,
    peers: input.peers,
    discovered: input.discovered,
    logs: input.logs,
    filters_applied: input.filters,
  };
}

/**
 * Per D-24: colons replaced with hyphens so Windows can save the file.
 * Periods inside the milliseconds segment are preserved — they're
 * legal in filenames on every supported platform.
 */
export function snapshotFilename(capturedAt: string): string {
  return `pim-debug-snapshot-${capturedAt.replace(/:/g, "-")}.json`;
}

/**
 * Serialize the snapshot to JSON, wrap in a Blob, and trigger a
 * download via a temporary `<a download>`. Revokes the object URL on
 * a microtask so the browser has time to start the download but the
 * URL doesn't leak.
 *
 * Throws if `document` is unavailable (e.g. in a Node test runner) —
 * the test suite for this module is compile-only and never invokes
 * downloadSnapshot, so the throw never fires in CI.
 */
export function downloadSnapshot(snapshot: DebugSnapshot): void {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = snapshotFilename(snapshot.captured_at);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on microtask — browser has begun the download but the URL
  // is still valid until the next tick.
  queueMicrotask(() => URL.revokeObjectURL(url));
}
