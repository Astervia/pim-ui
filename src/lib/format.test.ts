/**
 * Compile-only tests for src/lib/format.ts.
 *
 * Follows the same pattern as `rpc-types.test.ts`: no vitest, no runtime
 * test framework. `tsc --noEmit` is the enforcement mechanism — this file
 * imports the helpers, captures their return types, and embeds a
 * `_runtimeChecks` function whose body asserts the expected string for
 * every case from D-24 and the plan's behavior spec. The `_runtimeChecks`
 * function is declared but never called at runtime (guarded by
 * `if (false)`), which matches the Phase-1 TDD-without-vitest precedent:
 * tsc validates the types, nothing executes.
 *
 * If you want to manually exercise the runtime assertions during
 * development, change the guard to `if (true)` and run
 * `pnpm tsx src/lib/format.test.ts`. Leave it at `if (false)` for commit.
 */

import {
  formatBytes,
  formatCount,
  formatDuration,
  formatShortId,
} from "./format";

// Return types — each helper returns a string.
const _b: string = formatBytes(0);
const _c: string = formatCount(0);
const _d: string = formatDuration(0);
const _s: string = formatShortId(null);

// @ts-expect-error — formatBytes requires a number, not a string
const _badBytes: string = formatBytes("100");
// @ts-expect-error — formatCount requires a number
const _badCount: string = formatCount("100");
// @ts-expect-error — formatDuration requires a number
const _badDuration: string = formatDuration("100");

// formatShortId accepts string | null | undefined; rejects numbers.
const _sNull: string = formatShortId(null);
const _sUndef: string = formatShortId(undefined);
const _sStr: string = formatShortId("abcdefghij");
// @ts-expect-error — formatShortId does not accept numbers
const _badShort: string = formatShortId(42);

/**
 * Runtime assertion cases — each bullet from the plan's <behavior> block
 * and 02-CONTEXT.md §D-24 is represented here with at least two cases per
 * boundary. This function is declared for tsc type-checking but never
 * invoked at runtime (the `if (false)` guard at the bottom is dead code
 * stripped by any optimizer and compiles cleanly with tsc).
 */
function _runtimeChecks(): void {
  // formatBytes — B / KB / MB / GB boundaries + defensive.
  console.assert(formatBytes(0) === "0 B", "formatBytes 0");
  console.assert(formatBytes(512) === "512 B", "formatBytes 512");
  console.assert(formatBytes(1023) === "1023 B", "formatBytes 1023");
  console.assert(formatBytes(1024) === "1.0 KB", "formatBytes 1024");
  console.assert(formatBytes(2048) === "2.0 KB", "formatBytes 2048");
  console.assert(formatBytes(1024 * 1024) === "1.0 MB", "formatBytes 1MB");
  // 4_200_000 / 1048576 ≈ 4.005 → "4.0 MB"
  console.assert(formatBytes(4_200_000) === "4.0 MB", "formatBytes 4_200_000");
  // 4_400_000 / 1048576 ≈ 4.196 → "4.2 MB"
  console.assert(formatBytes(4_400_000) === "4.2 MB", "formatBytes 4_400_000");
  // 1_500_000_000 / 1073741824 ≈ 1.397 → "1.4 GB"
  console.assert(
    formatBytes(1_500_000_000) === "1.4 GB",
    "formatBytes 1_500_000_000",
  );
  // Defensive — negative / NaN / non-finite → "0 B".
  console.assert(formatBytes(-1) === "0 B", "formatBytes negative");
  console.assert(formatBytes(Number.NaN) === "0 B", "formatBytes NaN");
  console.assert(
    formatBytes(Number.POSITIVE_INFINITY) === "0 B",
    "formatBytes Infinity",
  );

  // formatCount — grouped digits via Intl.NumberFormat en-US.
  console.assert(formatCount(0) === "0", "formatCount 0");
  console.assert(formatCount(42) === "42", "formatCount 42");
  console.assert(formatCount(3847) === "3,847", "formatCount 3847");
  console.assert(formatCount(1234567) === "1,234,567", "formatCount 1234567");

  // formatDuration — s / m / h / d boundaries.
  console.assert(formatDuration(0) === "0s", "formatDuration 0");
  console.assert(formatDuration(32) === "32s", "formatDuration 32");
  console.assert(formatDuration(59) === "59s", "formatDuration 59");
  console.assert(formatDuration(60) === "1m 0s", "formatDuration 60");
  console.assert(formatDuration(262) === "4m 22s", "formatDuration 262");
  console.assert(formatDuration(3599) === "59m 59s", "formatDuration 3599");
  console.assert(formatDuration(3600) === "1h 0m", "formatDuration 3600");
  console.assert(formatDuration(15_720) === "4h 22m", "formatDuration 15720");
  console.assert(formatDuration(86_399) === "23h 59m", "formatDuration 86399");
  console.assert(formatDuration(86_400) === "1d 0h", "formatDuration 86400");
  console.assert(
    formatDuration(302_400) === "3d 12h",
    "formatDuration 302400",
  );
  // Defensive.
  console.assert(formatDuration(-1) === "0s", "formatDuration negative");
  console.assert(formatDuration(Number.NaN) === "0s", "formatDuration NaN");

  // formatShortId — empty-id phrasing + first-8 + verbatim-short.
  console.assert(formatShortId(null) === "(no id)", "formatShortId null");
  console.assert(
    formatShortId(undefined) === "(no id)",
    "formatShortId undefined",
  );
  console.assert(formatShortId("") === "(no id)", "formatShortId empty");
  console.assert(
    formatShortId("7f8e1234a3c2aaaaaaaaaaaa") === "7f8e1234",
    "formatShortId 24-char",
  );
  console.assert(
    formatShortId("abcdefgh") === "abcdefgh",
    "formatShortId exactly 8",
  );
  console.assert(formatShortId("abc") === "abc", "formatShortId shorter than 8");
}

// `if (false)` guard — tsc still type-checks the body but no runtime call happens.
// Matches rpc-types.test.ts pattern of compile-only validation.
if (false as boolean) {
  _runtimeChecks();
}

// Reference exported symbols so tsc doesn't drop the import tree.
void _b;
void _c;
void _d;
void _s;
void _sNull;
void _sUndef;
void _sStr;
void _badBytes;
void _badCount;
void _badDuration;
void _badShort;
void _runtimeChecks;
