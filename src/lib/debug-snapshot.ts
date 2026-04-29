/**
 * Debug snapshot builder + saver (OBS-03 / D-23 / D-24).
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
 * Save mechanism — runtime-detected:
 *   - Tauri shell:  `dialog.save()` → user picks path → `save_text_file`
 *     Rust command writes the JSON → caller toasts `Saved to <path>`
 *     with a `[ Reveal ]` action that calls `reveal_in_file_manager`.
 *   - Plain webview: legacy Blob + `<a download>` so a browser-served
 *     dev build (vite at :1420 with no Tauri shell) still produces
 *     something usable. The browser's downloads folder receives the
 *     file silently — the toast falls back to `Saved as <filename>`.
 */

import { invoke } from "@tauri-apps/api/core";
import { save as openSaveDialog } from "@tauri-apps/plugin-dialog";
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
 * Result returned by `saveSnapshot()`. Lets the caller render an
 * appropriate toast — when the user cancels the save dialog we want
 * NO toast (cancellation is silent), when the file actually lands we
 * want a path-bearing success toast with a `[ Reveal ]` action.
 */
export type SaveSnapshotResult =
  | { kind: "saved"; path: string; revealable: boolean }
  | { kind: "saved-fallback"; filename: string }
  | { kind: "cancelled" };

function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri 2 marks the shell with __TAURI_INTERNALS__. Plain Vite dev
  // server has neither, so the fallback path runs there.
  return "__TAURI_INTERNALS__" in window;
}

/**
 * Show a native save dialog (Tauri) or fall back to a Blob download
 * (plain webview), and write the snapshot JSON to the chosen location.
 *
 * Returns:
 *   - { kind: "saved", path } when the Tauri path-write succeeded
 *   - { kind: "saved-fallback", filename } when the browser download
 *     fired (the user agent decides where it lands, typically Downloads)
 *   - { kind: "cancelled" } when the user dismissed the save dialog
 *
 * Throws if the underlying write rejects (e.g. permissions denied) —
 * the caller (DebugSnapshotButton) catches and routes to a destructive
 * toast.
 */
export async function saveSnapshot(
  snapshot: DebugSnapshot,
): Promise<SaveSnapshotResult> {
  const json = JSON.stringify(snapshot, null, 2);
  const filename = snapshotFilename(snapshot.captured_at);

  if (isTauriRuntime() === true) {
    const picked = await openSaveDialog({
      title: "Export debug snapshot",
      defaultPath: filename,
      filters: [{ name: "JSON snapshot", extensions: ["json"] }],
    });
    if (picked === null) return { kind: "cancelled" };
    const path = await invoke<string>("save_text_file", {
      path: picked,
      content: json,
    });
    return { kind: "saved", path, revealable: true };
  }

  // Plain webview fallback — Blob + temporary anchor.
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  queueMicrotask(() => URL.revokeObjectURL(url));
  return { kind: "saved-fallback", filename };
}

/**
 * Open the OS file manager focused on the saved snapshot. macOS opens
 * Finder with the file selected; Windows opens Explorer with the file
 * highlighted; Linux opens the parent folder via xdg-open. Silent
 * no-op outside Tauri (the plain-webview fallback can't reach the OS
 * file manager).
 */
export async function revealSnapshotInFileManager(path: string): Promise<void> {
  if (isTauriRuntime() === false) return;
  await invoke<void>("reveal_in_file_manager", { path });
}

/**
 * @deprecated Kept for backwards-compat with any caller still importing
 * the old name. New callers should use `saveSnapshot()` which returns
 * the chosen path so the toast can confirm where the file landed.
 */
export function downloadSnapshot(snapshot: DebugSnapshot): void {
  void saveSnapshot(snapshot);
}
