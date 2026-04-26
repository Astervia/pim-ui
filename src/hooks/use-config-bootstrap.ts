/**
 * useConfigBootstrap — D-13 5-step boot-sequence state machine.
 *
 * Owns steps 2-4 of the boot sequence:
 *   step 2: invoke("bootstrap_config", { nodeName, role }) → { path }
 *   step 3: requestPermission() — false continues to step 4 anyway
 *   step 4: startDaemon() — resolves when DaemonState reaches running
 *
 * Step 1 (UI-only button-disable) and step 5 (onBootstrapComplete) live
 * in the consumer (FirstRunScreen) — the hook just exposes `status` so
 * the screen can render the disabled state and fire the completion
 * callback when status flips to "complete".
 *
 * Failure copy is the D-13 verbatim string formatted INSIDE the hook,
 * so the consumer just renders `error.message` directly.
 *
 * Cross-phase W1 invariant: this hook registers ZERO Tauri event
 * subscriptions — it only invokes Tauri commands and awaits a Phase-1
 * promise.
 */

import { useCallback, useState } from "react";
import {
  bootstrapConfig,
  configExists,
  startDaemon,
  type FirstRunRole,
} from "@/lib/rpc";
import { useTunPermission } from "@/components/brand/tun-permission-modal";

export type BootstrapStatus =
  | "idle"
  | "writing_config"
  | "requesting_permission"
  | "starting_daemon"
  | "complete"
  | "failed";

export interface BootstrapError {
  /**
   * D-13 step identifier — distinguishes step-2 (config-write) failures
   * from step-4 (daemon-start) failures. Step 3 (TUN permission) is
   * never a failure — `false` continues to step 4 per D-13.
   */
  step: "write_config" | "start_daemon";
  /** Already-formatted verbatim D-13 copy ready for inline display. */
  message: string;
}

export interface BootstrapHandle {
  runBootstrap(args: { nodeName: string; role: FirstRunRole }): Promise<void>;
  status: BootstrapStatus;
  error: BootstrapError | null;
  /** Clears `error` + `status` back to "idle" — call on form-edit. */
  reset(): void;
}

const UNKNOWN_PATH = "(unknown path)";

/**
 * Extracts a human-readable message from an unknown thrown value.
 * Bang-free: uses explicit `=== null` / `typeof` checks, no negation.
 */
function formatErr(e: unknown): string {
  if (e === null || e === undefined) return "unknown error";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(e);
}

export function useConfigBootstrap(): BootstrapHandle {
  const [status, setStatus] = useState<BootstrapStatus>("idle");
  const [error, setError] = useState<BootstrapError | null>(null);
  const { requestPermission } = useTunPermission();

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  const runBootstrap = useCallback(
    async (args: { nodeName: string; role: FirstRunRole }): Promise<void> => {
      // Step 1 (UI-only): the consumer (FirstRunScreen) disables the
      // submit button + form fieldset based on `status !== "idle"`.
      // Hook just transitions state through the remaining steps.
      setError(null);
      setStatus("writing_config");

      // Capture the resolved path for step-2 error formatting (D-13).
      // Best-effort — if configExists itself fails, fall back to the
      // sentinel UNKNOWN_PATH literal so the inline-error copy still
      // renders the verbatim D-13 prefix.
      let capturedPath = UNKNOWN_PATH;
      try {
        const probe = await configExists();
        capturedPath = probe.path;
      } catch {
        // intentional — UNKNOWN_PATH already assigned
      }

      // Step 2: write config atomically (D-14, Rust-side).
      try {
        const result = await bootstrapConfig(args);
        capturedPath = result.path;
      } catch (e) {
        setStatus("failed");
        setError({
          step: "write_config",
          message: `Couldn't write config to ${capturedPath}: ${formatErr(e)}`,
        });
        return;
      }

      // Step 3: TUN permission. Per D-13, `false` continues anyway —
      // Limited Mode banner inside AppShell will surface the
      // permission-skipped copy via Phase 1's existing path.
      setStatus("requesting_permission");
      try {
        await requestPermission();
      } catch {
        // Even an unexpected rejection of the permission promise must
        // not abort the boot sequence — D-13 explicitly says the user
        // can refuse permission and still get a daemon process.
      }

      // Step 4: spawn the daemon (Phase 1 contract — resolves on
      // running OR rejects on error).
      setStatus("starting_daemon");
      try {
        await startDaemon();
      } catch {
        // The error message is the verbatim D-13 step-4 string. We do
        // NOT interpolate the underlying error here — the user's
        // recovery path is to check docs/SECURITY.md or the bundled
        // binary, not to read the Rust error verbatim. The crash-on-boot
        // banner (Plan 01.1-04, after AppRoot has flipped) carries the
        // structured payload for those who want it.
        setStatus("failed");
        setError({
          step: "start_daemon",
          message:
            "Daemon didn't start. Check docs/SECURITY.md §2.1 or the bundled pim-daemon at src-tauri/binaries/.",
        });
        return;
      }

      // Step 5 trigger: status flips to "complete". The consumer
      // (FirstRunScreen) watches this via useEffect and fires
      // onBootstrapComplete() exactly once (dedupe-guarded).
      setStatus("complete");
    },
    [requestPermission],
  );

  return { runBootstrap, status, error, reset };
}
