/**
 * Compile-only type tests for src/lib/rpc-types.ts.
 *
 * This file has NO runtime — it is never imported by the app. Its sole
 * purpose is to fail `pnpm typecheck` if any structural invariant of the
 * v1 RPC contract drifts from docs/RPC.md.
 *
 * If you change this file to "make the build green" without also
 * updating docs/RPC.md, you are almost certainly introducing a contract
 * regression. Prefer fixing rpc-types.ts instead.
 */

import type {
  RpcMethodMap,
  RpcMethodName,
  HelloResult,
  PeerSummary,
  StatusEventKind,
  RpcErrorCodeValue,
} from "./rpc-types";
import { RpcErrorCode } from "./rpc-types";

// All 23 method names from docs/RPC.md §8 v1 "minimum viable" PLUS the
// Phase 5 Plan 05-01 TBD-RPC additions (gateway.status / gateway.subscribe
// / gateway.unsubscribe per RESEARCH §5c) must be valid keys of
// RpcMethodMap. Adding an entry here that isn't on the map, or omitting
// one that is, breaks the compile — this catches drift in both directions.
const _methods: RpcMethodName[] = [
  "rpc.hello",
  "status",
  "status.subscribe",
  "status.unsubscribe",
  "peers.list",
  "peers.add_static",
  "peers.remove",
  "peers.discovered",
  "peers.pair",
  "peers.subscribe",
  "peers.unsubscribe",
  "route.set_split_default",
  "route.table",
  "gateway.preflight",
  "gateway.enable",
  "gateway.disable",
  // TBD-RPC (RESEARCH §5c) — Phase 5 Plan 05-01 speculative additions.
  "gateway.status",
  "gateway.subscribe",
  "gateway.unsubscribe",
  "config.get",
  "config.save",
  "logs.subscribe",
  "logs.unsubscribe",
];

// Exhaustiveness check for RpcMethodMap: if a new method is added to the
// map but forgotten here, this line still compiles (arrays can be
// sub-sets); what it DOES catch is typos in the left-hand list.
// For the "must contain every key" direction we rely on the next
// lookup — each of these must be a valid key.
const _methodLookup: Record<RpcMethodName, true> = {
  "rpc.hello": true,
  status: true,
  "status.subscribe": true,
  "status.unsubscribe": true,
  "peers.list": true,
  "peers.add_static": true,
  "peers.remove": true,
  "peers.discovered": true,
  "peers.pair": true,
  "peers.subscribe": true,
  "peers.unsubscribe": true,
  "route.set_split_default": true,
  "route.table": true,
  "gateway.preflight": true,
  "gateway.enable": true,
  "gateway.disable": true,
  // TBD-RPC (RESEARCH §5c) — Phase 5 Plan 05-01 speculative additions.
  "gateway.status": true,
  "gateway.subscribe": true,
  "gateway.unsubscribe": true,
  "config.get": true,
  "config.save": true,
  "logs.subscribe": true,
  "logs.unsubscribe": true,
};

// HelloResult must contain exactly these three fields, matching
// docs/RPC.md §2.1 response example.
const _hello: HelloResult = {
  daemon: "pim-daemon/0.2.0",
  rpc_version: 1,
  features: [],
};

// rpc.hello result shape in the method map must equal HelloResult.
type _HelloFromMap = RpcMethodMap["rpc.hello"]["result"];
const _helloFromMap: _HelloFromMap = _hello;

// PeerSummary.state is a closed union of 4 literals per docs/RPC.md §5.2.
const _okState: PeerSummary["state"] = "active";
// @ts-expect-error — "online" is not a valid PeerState
const _badState: PeerSummary["state"] = "online";

// StatusEventKind covers all 8 kinds from docs/RPC.md §5.7.
const _kinds: StatusEventKind[] = [
  "role_changed",
  "interface_up",
  "interface_down",
  "gateway_selected",
  "gateway_lost",
  "route_on",
  "route_off",
  "kill_switch",
];

// RpcVersionMismatch must be -32001 per docs/RPC.md §3.
const _ver: RpcErrorCodeValue = RpcErrorCode.RpcVersionMismatch;
const _verCheck: -32001 = RpcErrorCode.RpcVersionMismatch;
// DaemonNotReady must be -32000 per docs/RPC.md §3.
const _notReady: -32000 = RpcErrorCode.DaemonNotReady;
// ConfigValidationFailed must be -32020 per docs/RPC.md §3.
const _cfgFail: -32020 = RpcErrorCode.ConfigValidationFailed;

// Status result from map must include the nested interface object.
type _StatusFromMap = RpcMethodMap["status"]["result"];
const _statusIface: _StatusFromMap["interface"]["name"] = "pim0";

// ─── Task 2 guards: callDaemon signature + DaemonState machine ───────

import type {
  CrashOnBootError,
  DaemonLastError,
  DaemonSnapshot,
  DaemonState,
} from "./daemon-state";
import { isCrashOnBoot, isTransientState, pickCrashOnBoot } from "./daemon-state";
import type {
  BootstrapConfigArgs,
  BootstrapConfigResult,
  ConfigExistsResult,
  DaemonSubscription,
  FirstRunRole,
} from "./rpc";
import {
  bootstrapConfig,
  callDaemon,
  configExists,
  DaemonEvents,
  subscribeDaemon,
} from "./rpc";

// callDaemon<"status"> must accept null and return Promise<Status>.
const _statusCall: Promise<RpcMethodMap["status"]["result"]> = callDaemon(
  "status",
  null,
);

// callDaemon<"rpc.hello"> must accept HelloParams and return Promise<HelloResult>.
const _helloCall: Promise<HelloResult> = callDaemon("rpc.hello", {
  client: "pim-ui/0.0.1",
  rpc_version: 1,
});

// @ts-expect-error — missing required field `rpc_version`
const _badHelloCall = callDaemon("rpc.hello", { client: "pim-ui/0.0.1" });

// subscribeDaemon returns Promise<DaemonSubscription>; no payload handler param.
const _sub: Promise<DaemonSubscription> = subscribeDaemon("status.event");

// DaemonState is exactly the 5 UI-SPEC states — no more, no fewer.
type _DaemonStateExpected =
  | "stopped"
  | "starting"
  | "running"
  | "reconnecting"
  | "error";
// Bidirectional assignability = type equality.
const _forward: _DaemonStateExpected = "running" as DaemonState;
const _backward: DaemonState = "running" as _DaemonStateExpected;

// isTransientState returns boolean; compile should infer it.
const _transient: boolean = isTransientState("starting");

// DaemonSnapshot must embed all required fields from the UI-SPEC. Phase 2
// Plan 01 extended the snapshot with `discovered` + `subscriptionError`;
// the Phase-1 literal below stays a valid initializer and keeps the
// existing compile-only regression covered.
const _snapshot: DaemonSnapshot = {
  state: "stopped",
  hello: null,
  status: null,
  baselineTimestamp: null,
  lastError: null,
  peerCount: 0,
  discovered: [],
  subscriptionError: null,
};

// ─── Plan 01.1-02 Task 1 guards: bootstrapConfig + configExists + FirstRunRole ─
//
// These compile-only tests fail to build (`pnpm typecheck`) if the rpc.ts
// wrappers drift from the Rust contract shipped by Plan 01.1-01
// (see `.planning/phases/01.1-first-run-config-bootstrap/01.1-01-SUMMARY.md`):
//
//   bootstrap_config(node_name: String, role: Role) -> { path: String }
//   config_exists()                                   -> { exists: bool, path: String }
//
// The Tauri serde bridge maps JS camelCase `nodeName` to Rust snake_case
// `node_name` automatically (matches the daemon_unsubscribe pattern at
// rpc.ts L 124-125), so the JS-side type stays camelCase by convention.

// Test 1: bootstrapConfig accepts the happy-path args and resolves to { path: string }.
const _bootstrapOk: Promise<BootstrapConfigResult> = bootstrapConfig({
  nodeName: "alice",
  role: "join_the_mesh",
});

// The awaited result has a string `path`.
const _bootstrapPath: Promise<string> = _bootstrapOk.then((r) => r.path);

// Test 2: missing `role` fails typecheck (required field).
// @ts-expect-error — missing required field `role`
const _bootstrapNoRole = bootstrapConfig({ nodeName: "alice" });

// Test 3: role literal outside FirstRunRole fails typecheck. The Rust enum
// uses `#[serde(rename_all = "snake_case")]` so the only legal literals are
// "join_the_mesh" and "share_my_internet"; "client" is a NodeRole, not a
// FirstRunRole, and must be rejected.
const _bootstrapBadRole = bootstrapConfig({
  nodeName: "alice",
  // @ts-expect-error — "client" is not in FirstRunRole
  role: "client",
});

// Test 3b: FirstRunRole literal union is exactly the two snake_case values.
const _roleJoin: FirstRunRole = "join_the_mesh";
const _roleGateway: FirstRunRole = "share_my_internet";
// @ts-expect-error — "gateway" (pre-rename_all literal) is not a FirstRunRole
const _roleBad: FirstRunRole = "gateway";

// BootstrapConfigArgs structural shape — nodeName string + role FirstRunRole.
const _bootstrapArgs: BootstrapConfigArgs = {
  nodeName: "alice",
  role: "share_my_internet",
};

// Test 4: configExists() takes no params and resolves to { exists, path }.
const _configExistsOk: Promise<ConfigExistsResult> = configExists();
const _configExistsShape: Promise<{ exists: boolean; path: string }> =
  _configExistsOk.then((r) => ({ exists: r.exists, path: r.path }));

// Test 5 (NEGATIVE — proves no new event channel for crash-on-boot):
// DaemonEvents must NOT grow a `crashOnBoot` key, because Plan 01.1-01
// routes the crash signal through the existing `daemon://state-changed`
// event (RpcError.data carries the D-19 discriminator). Adding a
// `crashOnBoot` key would break the W1 cross-phase invariant
// (`listen(` count in use-daemon-state.ts must stay exactly 2).
type _NoCrashOnBootKey = Extract<keyof typeof DaemonEvents, "crashOnBoot">;
const _noCrashOnBoot: _NoCrashOnBootKey extends never ? true : false = true;

// ─── Plan 01.1-02 Task 2 guards: DaemonLastError union + narrowing helpers ─
//
// D-19 routing: Plan 01.1-01 emits `daemon://state-changed` with
// payload.error = RpcError where `data` carries
// `{ kind: "crash_on_boot", path, stderr_tail, elapsed_ms, … }`. The
// existing state-changed listener in use-daemon-state.ts already merges
// payload.error into snapshot.lastError verbatim (file L 347-387,
// UNTOUCHED by this plan). What this task adds: a discriminated union
// `DaemonLastError` so consumers (Plan 01.1-04 LimitedModeBanner) can
// narrow with `isCrashOnBoot(err)` and project to a canonical
// `CrashOnBootError` via `pickCrashOnBoot(err)` without re-parsing JSON.

// Test 6: DaemonSnapshot.lastError accepts the canonical CrashOnBootError shape.
const _crashCanonical: DaemonLastError = {
  kind: "crash_on_boot",
  path: "/Users/pedro/Library/Application Support/pim/pim.toml",
  stderr_tail: "[ERROR] invalid listen_port: 65536",
  elapsed_ms: 220,
};

// Test 7: DaemonSnapshot.lastError ALSO accepts a plain RpcError (backward
// compat — every existing consumer like limited-mode-banner.tsx today
// populates this field with a plain RpcError, no `kind` set).
const _rpcErrCompat: DaemonLastError = {
  code: -32603,
  message: "internal error",
};

// Test 7b: an RpcError carrying the discriminator inside `data` is also
// accepted (this is the actual on-the-wire shape Plan 01.1-01 emits).
const _rpcErrWithCrashData: DaemonLastError = {
  code: -32000,
  message: "pim-daemon exited in 220 ms during startup",
  data: {
    kind: "crash_on_boot",
    path: "/Users/pedro/Library/Application Support/pim/pim.toml",
    stderr_tail: "[ERROR] invalid listen_port: 65536",
    elapsed_ms: 220,
    exit_code: 1,
    signal: null,
  },
};

// Test 7c: a snapshot with the wider lastError typechecks, proving
// DaemonSnapshot was widened in place (no parallel field).
const _snapshotWithCrash: DaemonSnapshot = {
  state: "error",
  hello: null,
  status: null,
  baselineTimestamp: null,
  lastError: _rpcErrWithCrashData,
  peerCount: 0,
  discovered: [],
  subscriptionError: null,
};

// Test 8: isCrashOnBoot narrows so .path is statically accessible —
// the predicate signature must be `(e): e is CrashOnBootError`.
function _narrowIsCrashOnBoot(e: DaemonLastError | null): string | null {
  if (isCrashOnBoot(e)) {
    // Inside this branch, TS knows e: CrashOnBootError.
    const _path: string = e.path;
    const _stderr: string = e.stderr_tail;
    const _elapsed: number = e.elapsed_ms;
    void _stderr;
    void _elapsed;
    return _path;
  }
  return null;
}

// Test 9: pickCrashOnBoot lifts an RpcError-with-crash-data into the
// canonical CrashOnBootError shape, returning null when the input
// isn't a crash variant.
const _pickCanonical: CrashOnBootError | null = pickCrashOnBoot(
  _rpcErrWithCrashData,
);
const _pickAlreadyCanonical: CrashOnBootError | null = pickCrashOnBoot(
  _crashCanonical,
);
const _pickPlainRpc: CrashOnBootError | null = pickCrashOnBoot(_rpcErrCompat);
const _pickNull: CrashOnBootError | null = pickCrashOnBoot(null);

// Test 10 (NEGATIVE — re-asserts W1 invariant lives in this plan's tests):
// the cross-phase commitment that no `crashOnBoot` key exists on
// DaemonEvents. Restated here so this plan's checker greps see it
// alongside the union/helper tests, not just under Task 1.
type _NoCrashOnBootKeyTask2 = Extract<keyof typeof DaemonEvents, "crashOnBoot">;
const _noCrashOnBootTask2: _NoCrashOnBootKeyTask2 extends never
  ? true
  : false = true;

// All references are unused in runtime — the whole point is compile-time.
void _methods;
void _methodLookup;
void _hello;
void _helloFromMap;
void _okState;
void _badState;
void _kinds;
void _ver;
void _verCheck;
void _notReady;
void _cfgFail;
void _statusIface;
void _statusCall;
void _helloCall;
void _badHelloCall;
void _sub;
void _forward;
void _backward;
void _transient;
void _snapshot;
void _bootstrapOk;
void _bootstrapPath;
void _bootstrapNoRole;
void _bootstrapBadRole;
void _roleJoin;
void _roleGateway;
void _roleBad;
void _bootstrapArgs;
void _configExistsOk;
void _configExistsShape;
void _noCrashOnBoot;
void _crashCanonical;
void _rpcErrCompat;
void _rpcErrWithCrashData;
void _snapshotWithCrash;
void _narrowIsCrashOnBoot;
void _pickCanonical;
void _pickAlreadyCanonical;
void _pickPlainRpc;
void _pickNull;
void _noCrashOnBootTask2;
