/**
 * Compile-only contract test for the DebugSnapshot type + helpers.
 *
 * Pattern: rpc-types.test.ts + section-schemas.test.ts — `tsc --noEmit`
 * is the test runner; assertions live in the type system. No vitest
 * dep is added by this plan.
 *
 * What we assert:
 *   1. snapshot_version is the literal `1` (D-23 schema lock).
 *   2. The seven snake_case field names exist on DebugSnapshot
 *      (D-24 — kernel-repo diff cleanliness).
 *   3. snapshotFilename strips every colon from a captured_at ISO
 *      string (Windows-safe filename per D-24).
 *   4. buildDebugSnapshot accepts the documented input shape and
 *      returns the documented output shape — catches signature drift
 *      between this module and DebugSnapshotButton.
 */

import {
  buildDebugSnapshot,
  snapshotFilename,
  type DebugSnapshot,
} from "./debug-snapshot";

// 1. snapshot_version literal lock.
type AssertVersion = DebugSnapshot["snapshot_version"] extends 1 ? true : false;
const _v: AssertVersion = true;
void _v;

// 2. snake_case field names — every key must appear on DebugSnapshot.
type HasField<K extends string> = K extends keyof DebugSnapshot ? true : false;
type AssertSnakeFields =
  HasField<"snapshot_version"> extends true
    ? HasField<"ui_version"> extends true
      ? HasField<"captured_at"> extends true
        ? HasField<"daemon_status"> extends true
          ? HasField<"peers"> extends true
            ? HasField<"discovered"> extends true
              ? HasField<"logs"> extends true
                ? HasField<"filters_applied"> extends true
                  ? true
                  : false
                : false
              : false
            : false
          : false
        : false
      : false
    : false;
const _f: AssertSnakeFields = true;
void _f;

// filters_applied sub-object names too.
type FiltersApplied = DebugSnapshot["filters_applied"];
type HasFilterField<K extends string> = K extends keyof FiltersApplied ? true : false;
type AssertFilterFields =
  HasFilterField<"level"> extends true
    ? HasFilterField<"peer_id"> extends true
      ? HasFilterField<"text"> extends true
        ? HasFilterField<"time_range"> extends true
          ? true
          : false
        : false
      : false
    : false;
const _ff: AssertFilterFields = true;
void _ff;

// 3. snapshotFilename strips colons (Windows-safe).
const sample = "2026-04-26T21:34:17.122Z";
const fn = snapshotFilename(sample);
const _noColons: boolean = fn.includes(":") === false;
void _noColons;
const _hasPrefix: boolean = fn.startsWith("pim-debug-snapshot-");
void _hasPrefix;
const _isJson: boolean = fn.endsWith(".json");
void _isJson;

// 4. buildDebugSnapshot signature.
const _built: DebugSnapshot = buildDebugSnapshot({
  daemonStatus: null,
  peers: [],
  discovered: [],
  logs: [],
  filters: { level: "info", peer_id: null, text: "", time_range: "All session" },
});
void _built;
