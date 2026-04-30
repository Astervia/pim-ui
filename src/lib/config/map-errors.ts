/**
 * map-errors — translate daemon ConfigValidationError[] to per-field
 * messages keyed by daemon TOML path. Phase 3 Plan 03-04 §Part H.
 *
 * Daemon contract (RPC.md §5.5):
 *   - On `code === -32020` (ConfigValidationFailed) or `-32021`
 *     (ConfigSaveRejected), `RpcError.data` is `ConfigValidationError[]`.
 *   - Each error has `{ line, column, path, message }` where `path` is
 *     the dotted daemon key (e.g. `transport.listen_port`).
 *
 * Mapping rule (D-11 step 4):
 *   - If `error.path` is one of THIS section's `tomlKeys`, render it
 *     under that field via `FormMessage`.
 *   - Otherwise render the message at the section banner (the form
 *     can't map it to a control — `Daemon rejected this section: …`).
 *
 * The first error message is also returned for the toast headline
 * (`Daemon rejected settings: {first error.message}`).
 *
 * Bang-free per project policy.
 */

import type { ConfigValidationError, RpcError } from "@/lib/rpc-types";
import { RpcErrorCode } from "@/lib/rpc-types";
import { type SectionId, SECTION_SCHEMAS } from "./section-schemas";

export interface MappedErrors {
  /** Daemon-path → human-readable message; consumed via FormMessage. */
  fieldErrors: Record<string, string>;
  /** Section-level fallback when none of the errors map to a known path. */
  sectionBannerError: string | null;
  /** First error message — used for the toast headline. */
  firstMessage: string;
}

/**
 * Returns a `MappedErrors` projection or `null` when this isn't a
 * config-validation error (so the caller can treat unknown errors
 * uniformly via the toast/log path).
 */
export function mapConfigErrorsToFields(
  err: RpcError,
  sectionId: SectionId,
): MappedErrors | null {
  if (
    err.code !== RpcErrorCode.ConfigValidationFailed &&
    err.code !== RpcErrorCode.ConfigSaveRejected
  ) {
    return null;
  }
  const list = (err.data as ConfigValidationError[] | undefined) ?? [];
  const fieldErrors: Record<string, string> = {};
  let sectionBannerError: string | null = null;
  const keySet = new Set(SECTION_SCHEMAS[sectionId].tomlKeys);
  for (const ve of list) {
    // `path` is optional on the wire — only schema errors carry it.
    // Errors without a path always fall through to the section banner.
    if (ve.path !== undefined && keySet.has(ve.path) === true) {
      fieldErrors[ve.path] = ve.message;
    } else {
      sectionBannerError = `Daemon rejected this section: ${ve.message}`;
    }
  }
  const firstMessage =
    list[0]?.message ?? err.message ?? "Daemon rejected settings.";
  return { fieldErrors, sectionBannerError, firstMessage };
}
