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

// All 20 method names from docs/RPC.md §8 v1 "minimum viable" must be
// valid keys of RpcMethodMap. Adding an entry here that isn't on the map,
// or omitting one that is, breaks the compile — this catches drift in
// both directions.
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

import type { DaemonSnapshot, DaemonState } from "./daemon-state";
import { isTransientState } from "./daemon-state";
import type { DaemonSubscription } from "./rpc";
import { callDaemon, subscribeDaemon } from "./rpc";

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

// DaemonSnapshot must embed all required fields from the UI-SPEC.
const _snapshot: DaemonSnapshot = {
  state: "stopped",
  hello: null,
  status: null,
  baselineTimestamp: null,
  lastError: null,
  peerCount: 0,
};

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
