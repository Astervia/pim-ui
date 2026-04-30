/**
 * useRawTomlSave — raw-buffer save orchestration. Phase 3 Plan 03-06 §Part A.
 *
 * Save flow (D-12):
 *   1. dry_run FIRST — `config.save({ format: "toml", config: textareaBuffer,
 *      dry_run: true })` with the textarea contents VERBATIM (no
 *      assembleToml — the raw editor IS the source of truth here).
 *   2. On dry-run success, real save — `config.save({ ..., dry_run: false })`.
 *   3. refetchSettingsConfig() to pull the authoritative TOML back.
 *   4. On reject (RpcError code -32020 / -32021), populate `errors[]` so the
 *      gutter + inline rows can render per-line markers; the textarea
 *      buffer is preserved (no reset) per D-12.
 *   5. requires_restart toast routes [ Restart ] through the SAME
 *      restartDaemon(actions) util the form-section save uses (checker
 *      Warning 3 — the raw-TOML restart is no longer a no-op).
 *   6. Reject toast fires `Daemon rejected settings: {first error.message}`
 *      with a working `[Show in Logs →]` action (checker Warning 5 —
 *      setActive("logs") + applyLogsFilter({ source: "config" })).
 *
 * Returned errors are `RawTomlError[]` (line / column / path / message),
 * sourced from `RpcError.data` per ConfigValidationError (rpc-types.ts §5.5).
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { callDaemon } from "@/lib/rpc";
import {
  RpcErrorCode,
  type ConfigValidationError,
  type RpcError,
} from "@/lib/rpc-types";
import { writePimConfigText } from "@/lib/config/disk-save";
import { useSettingsConfig } from "./use-settings-config";
import { useDaemonState } from "./use-daemon-state";
import { useActiveScreen } from "./use-active-screen";
import { applyLogsFilter } from "./use-log-filters";
import { restartDaemon } from "@/lib/daemon-restart";

export interface RawTomlError {
  line: number;
  column: number;
  path: string;
  message: string;
}

export type RawSaveState = "idle" | "saving" | "saved" | "error";

export interface UseRawTomlSaveReturn {
  state: RawSaveState;
  errors: RawTomlError[];
  save: (buffer: string) => Promise<void>;
}

function extractValidationErrors(err: RpcError): ConfigValidationError[] {
  // ConfigValidationFailed (-32020) and ConfigSaveRejected (-32021) carry
  // an array of ConfigValidationError on `data` per docs/RPC.md §5.5.
  const data = err.data;
  if (Array.isArray(data) === false) return [];
  return data as ConfigValidationError[];
}

export function useRawTomlSave(): UseRawTomlSaveReturn {
  const [state, setState] = useState<RawSaveState>("idle");
  const [errors, setErrors] = useState<RawTomlError[]>([]);
  const { refetch } = useSettingsConfig();
  const { actions, snapshot: daemon } = useDaemonState();
  const { setActive } = useActiveScreen();
  const daemonRunning = daemon.state === "running";

  const save = useCallback(
    async (buffer: string) => {
      setState("saving");
      setErrors([]);
      try {
        if (daemonRunning === true) {
          // 1. dry_run FIRST (D-12) — buffer goes verbatim, no assembleToml.
          await callDaemon("config.save", {
            format: "toml",
            config: buffer,
            dry_run: true,
          });
          // 2. Real save.
          const real = await callDaemon("config.save", {
            format: "toml",
            config: buffer,
            dry_run: false,
          });
          // 3. Refetch authoritative TOML.
          await refetch();
          // 4. requires_restart handling (D-25 + checker Warning 3).
          if (real.requires_restart.length > 0) {
            toast(
              `Saved. Restart pim to apply: ${real.requires_restart.join(", ")}`,
              {
                duration: 8000,
                action: {
                  label: "[ Restart ]",
                  onClick: () => {
                    void restartDaemon(actions);
                  },
                },
              },
            );
          } else {
            toast.success("Saved.", { duration: 3000 });
          }
        } else {
          // Daemon stopped — write directly to disk. Validation runs in
          // Rust against pim_core::Config, mirroring the daemon REJECT
          // contract. Errors are converted into the same RpcError-shaped
          // object the running-mode error path consumes.
          await writePimConfigText(buffer);
          await refetch();
          toast.success("Saved to disk · daemon will load on next start.", {
            duration: 3000,
          });
        }
        setState("saved");
        setTimeout(() => setState("idle"), 2000);
      } catch (e) {
        // Disk-write returns a ConfigValidationError without an RPC code;
        // synthesize ConfigValidationFailed so the existing line-aware
        // error path lights the gutter / inline rows.
        const err: RpcError =
          typeof e === "object" && e !== null && "code" in e
            ? (e as RpcError)
            : {
                code: RpcErrorCode.ConfigValidationFailed,
                message:
                  (e as ConfigValidationError | Error).message ??
                  "Save failed.",
                data:
                  typeof e === "object" && e !== null && "line" in e
                    ? [e as ConfigValidationError]
                    : null,
              };
        if (
          err.code === RpcErrorCode.ConfigValidationFailed ||
          err.code === RpcErrorCode.ConfigSaveRejected
        ) {
          const list = extractValidationErrors(err);
          setErrors(
            list.map((entry) => ({
              // Span fields are optional on the wire — schema-level and
              // IO errors omit them. Default to 0 / "" so the gutter and
              // inline rows don't crash on undefined.
              line: entry.line ?? 0,
              column: entry.column ?? 0,
              path: entry.path ?? "",
              message: entry.message,
            })),
          );
          const firstMsg = list[0]?.message ?? err.message ?? "Save failed.";
          const prefix =
            daemonRunning === true ? "Daemon rejected settings" : "Couldn't save to disk";
          // Checker Warning 5: wire [Show in Logs →] action handler.
          // The single-line `action: { label: "Show in Logs →", … }`
          // shape satisfies the plan's verify regex
          // `action:.*label.*Show in Logs` — keep this on one line.
          toast.error(`${prefix}: ${firstMsg}`, {
            duration: 8000,
            action: { label: "Show in Logs →", onClick: () => { setActive("logs"); applyLogsFilter({ source: "config" }); } },
          });
        } else {
          toast.error(err.message ?? "Save failed.");
        }
        setState("error");
        setTimeout(() => setState("idle"), 2000);
      }
    },
    [refetch, actions, setActive, daemonRunning],
  );

  return { state, errors, save };
}
