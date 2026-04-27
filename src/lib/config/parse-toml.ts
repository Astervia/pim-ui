/**
 * Typed wrapper over @iarna/toml parse. Returns a discriminated Result
 * so callers never have to try/catch — per PROJECT.md daemon-is-
 * source-of-truth, client-side parse failures are rendered via the
 * UI-SPEC fallback banner ("Couldn't parse TOML returned by daemon").
 */
import TOML from "@iarna/toml";

export type ParsedConfig = Record<string, unknown>;

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

export type ParseResult =
  | { ok: true; value: ParsedConfig }
  | { ok: false; error: ParseError };

export function parseToml(source: string): ParseResult {
  try {
    const value = TOML.parse(source) as ParsedConfig;
    return { ok: true, value };
  } catch (e) {
    // @iarna/toml errors expose `.line` and `.col` on the thrown Error.
    const err = e as Error & { line?: number; col?: number };
    return {
      ok: false,
      error: {
        message: err.message ?? "TOML parse failed",
        line: err.line,
        column: err.col,
      },
    };
  }
}
