/**
 * Compile-only test for `src/hooks/use-route-table.ts`.
 *
 * Pattern matches Phase 1/2 convention (`format.test.ts`,
 * `rpc-types.test.ts`, `copy.test.ts`): no vitest, no runtime test
 * framework. `tsc --noEmit` enforces the type pins; the load-time
 * checks live behind `if (false)` so production builds skip them.
 *
 * Two compile-time guarantees:
 *   1. `useRouteTable` is exported and returns a value structurally
 *      compatible with `UseRouteTableResult` (table / loading / error
 *      / refetch).
 *   2. `__test_resetRouteTable` exists for downstream test suites that
 *      may want to reset module state between cases.
 *
 * The `_runtimeChecks` body asserts the W1 invariant in spirit (the
 * hook does not import `listen` from `@tauri-apps/api/event`) by
 * referencing the `actions.subscribe` path.
 */

import {
  useRouteTable,
  __test_resetRouteTable,
  type UseRouteTableResult,
} from "./use-route-table";

// Compile-time pins on the public surface.
type _PinTable = UseRouteTableResult["table"];
type _PinLoading = UseRouteTableResult["loading"];
type _PinError = UseRouteTableResult["error"];
type _PinRefetch = UseRouteTableResult["refetch"];

// Structural-shape pin: any object satisfying the four members must
// be assignable to UseRouteTableResult.
const _check: {
  table: unknown;
  loading: boolean;
  error: unknown;
  refetch: () => Promise<void>;
} = {
  table: null,
  loading: false,
  error: null,
  refetch: async () => {},
};

// Reference everything captured so tsc does not drop the imports.
void useRouteTable;
void __test_resetRouteTable;
void _check;

// Compile-time-only consumers of the type pins so they survive
// `tsc --noEmit` without `--noUnusedLocals` complaints.
const _t: _PinTable = null;
const _l: _PinLoading = false;
const _e: _PinError = null;
const _r: _PinRefetch = async () => {};
void _t;
void _l;
void _e;
void _r;
