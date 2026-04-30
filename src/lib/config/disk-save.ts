/**
 * disk-save — Tauri-side write of pim.toml when the daemon is stopped.
 *
 * The settings page used to be read-only when daemon.state !== "running"
 * because saves went through the daemon's `config.save` RPC. The TOML
 * file lives on disk regardless of daemon state, so editing it offline
 * is a perfectly reasonable thing for the user to do — the daemon picks
 * up the new file the next time it starts.
 *
 * The Rust-side `write_pim_config_text` command validates the content
 * against `pim_core::Config` before writing (mirroring the live
 * `config.save` REJECT contract) and writes atomically (tmp → fsync →
 * rename). On validation failure it returns a `ConfigValidationError`
 * shaped like the one daemon REJECTs use, so the same error-mapping UI
 * (FormMessage / banner / line-gutter) works in both modes.
 */

import { invoke } from "@tauri-apps/api/core";
import type { ConfigValidationError } from "@/lib/rpc-types";

export interface WriteConfigResult {
  path: string;
  last_modified: string;
}

/**
 * Atomically write `content` to the user-scope `pim.toml`.
 *
 * Throws a `ConfigValidationError` (the Rust command's structured error
 * payload) on schema-validation failure or on any IO error. Callers
 * should catch and translate into the existing toast / inline-error UI.
 */
export async function writePimConfigText(
  content: string,
): Promise<WriteConfigResult> {
  return invoke<WriteConfigResult>("write_pim_config_text", { content });
}

/**
 * Schema-validate `content` against `pim_core::Config` WITHOUT touching
 * the disk. Used by the live editor to surface errors as the user types,
 * BEFORE Save is clicked. Returns void on success; rejects with
 * `ConfigValidationError` on failure.
 *
 * Independent of daemon state — works whether the daemon is running or
 * stopped because the schema lives in the bundled `pim-core` crate.
 * The daemon's REJECT-on-save remains the source of truth — this is
 * a UX accelerator, not a substitute.
 */
export async function validatePimConfigText(content: string): Promise<void> {
  await invoke<void>("config_validate", { content });
}

/**
 * Type-narrowing helper — Tauri's `invoke` rejects with whatever shape
 * the Rust `Result::Err` carries; this guard lets callers tell a
 * structured `ConfigValidationError` apart from a plain `Error` thrown
 * by the JS layer (e.g. when the IPC call itself failed).
 */
export function isConfigValidationError(
  e: unknown,
): e is ConfigValidationError {
  return (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  );
}
