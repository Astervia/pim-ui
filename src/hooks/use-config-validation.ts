/**
 * useConfigValidation — debounced live schema validation for the raw
 * TOML editor.
 *
 * Calls the Rust `config_validate` Tauri command 300 ms after the user
 * stops typing, surfaces the resulting `ConfigValidationError` so the
 * editor's gutter / inline rows can light up BEFORE Save is clicked.
 *
 * This is a UX accelerator — the daemon's `config.save` REJECT
 * (and the disk-mode `write_pim_config_text` validation) remain the
 * source of truth. If the daemon accepts a config that this validator
 * rejected (forward-compat, looser parsing), trust the daemon: the
 * save flow's error path overrides whatever live validation said.
 *
 * Validation runs against the SAME `pim-core` schema bundled in the
 * Tauri sidecar, so the answer matches what `write_pim_config_text`
 * will say a moment later when the user clicks Save.
 *
 * Bang-free per project policy. No new Tauri listeners (W1 preserved).
 */

import { useEffect, useState } from "react";
import {
  validatePimConfigText,
  isConfigValidationError,
} from "@/lib/config/disk-save";
import type { ConfigValidationError } from "@/lib/rpc-types";

/** Debounce window (ms) — long enough to avoid hammering on every
 *  keystroke, short enough that the gutter feels responsive. */
const DEBOUNCE_MS = 300;

export interface RawTomlValidationError {
  line: number;
  column: number;
  path: string;
  message: string;
}

export type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

export interface UseConfigValidationReturn {
  /** Errors from the LIVE validator (may be empty). */
  errors: RawTomlValidationError[];
  /** State machine for the validator — drives optional UI affordances
   *  ("checking…" indicator, etc.). */
  status: ValidationStatus;
}

/**
 * Live-validate a TOML buffer.
 *
 * Pass `enabled = false` to skip validation entirely (e.g. while a
 * higher-priority save flow is running and its errors should win).
 * Buffer changes are debounced; rapid edits cancel the in-flight
 * validation so the response always reflects the latest text.
 */
export function useConfigValidation(
  buffer: string,
  enabled: boolean = true,
): UseConfigValidationReturn {
  const [errors, setErrors] = useState<RawTomlValidationError[]>([]);
  const [status, setStatus] = useState<ValidationStatus>("idle");

  useEffect(() => {
    if (enabled === false) {
      setErrors([]);
      setStatus("idle");
      return;
    }
    if (buffer === "") {
      setErrors([]);
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      setStatus("validating");
      validatePimConfigText(buffer)
        .then(() => {
          if (cancelled === true) return;
          setErrors([]);
          setStatus("valid");
        })
        .catch((e: unknown) => {
          if (cancelled === true) return;
          if (isConfigValidationError(e) === true) {
            const ve = e as ConfigValidationError;
            setErrors([
              {
                line: ve.line ?? 0,
                column: ve.column ?? 0,
                path: ve.path ?? "",
                message: ve.message,
              },
            ]);
            setStatus("invalid");
          } else {
            // Unknown shape (IPC dropped, sidecar dead, etc.) — treat as
            // "no opinion" so the editor doesn't show a stale error.
            setErrors([]);
            setStatus("idle");
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [buffer, enabled]);

  return { errors, status };
}
