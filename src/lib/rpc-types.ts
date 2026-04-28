/**
 * Hand-maintained TypeScript mirror of proximity-internet-mesh/docs/RPC.md v1.
 *
 * This is the SINGLE SOURCE OF TRUTH on the UI side for the 17-method +
 * 3-event-stream JSON-RPC 2.0 contract exposed by `pim-daemon`. Every
 * other Phase 1 file (rpc.ts, daemon-state.ts, use-daemon-state.ts,
 * and every component/screen that consumes daemon data) imports from
 * here; if a field name, optionality, or enum value drifts from the
 * spec, fix it here and nowhere else.
 *
 * Design rules:
 *   1. ZERO runtime imports — this module is pure types plus one `as
 *      const` error-code map. It must be tree-shakable to near zero.
 *   2. Field names are reproduced VERBATIM from docs/RPC.md, including
 *      snake_case — JSON comes off the wire with those keys and the
 *      Rust side serializes them that way, so we do NOT camel-case
 *      them. (The one exception is a handful of TS convention names
 *      like `RpcErrorCode` — those are compile-time only.)
 *   3. Enum string values are LOAD-BEARING. Changing "active" to
 *      "online" silently breaks the daemon contract. Literal unions
 *      enforce this at compile time.
 *   4. No `any`. Open-ended JSON payloads use `unknown` and require
 *      the caller to narrow.
 *
 * v2 plan (POWER-01): replace this file with `tauri-specta v2` code-
 * generation. Until then, keep the hand-kept mirror in sync with
 * docs/RPC.md; the compile-only test in `rpc-types.test.ts` catches
 * the structural regressions automatically.
 */

// ─── §2 JSON-RPC envelope ────────────────────────────────────────────

/** A JSON-RPC 2.0 request (§2.2). Named params only — no positional arrays. */
export interface JsonRpcRequest<M extends string = string, P = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  method: M;
  params: P;
}

/** Successful response (§2.3). */
export interface JsonRpcSuccess<R = unknown> {
  jsonrpc: "2.0";
  id: number | string;
  result: R;
}

/** Error response (§2.3). */
export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number | string;
  error: RpcError;
}

/** Either outcome of a JSON-RPC request. */
export type JsonRpcResponse<R = unknown> = JsonRpcSuccess<R> | JsonRpcFailure;

/**
 * A server → client notification (§2.4). Notifications carry NO `id`
 * field — the absence of `id` is how the receiver distinguishes a
 * notification from a response.
 */
export interface JsonRpcNotification<M extends string = string, P = unknown> {
  jsonrpc: "2.0";
  method: M;
  params: P;
}

// ─── §3 Error codes ──────────────────────────────────────────────────

/**
 * All error codes enumerated in docs/RPC.md §3. Exposed as an `as const`
 * object (not a TS `enum`) so the values survive tree-shaking and the
 * const union (`RpcErrorCodeValue`) is statically analyzable.
 */
export const RpcErrorCode = {
  // JSON-RPC reserved
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  // Daemon
  DaemonNotReady: -32000,
  RpcVersionMismatch: -32001,
  FeatureNotSupportedOnPlatform: -32002,
  // Peers
  PeerNotFound: -32010,
  PeerAlreadyExists: -32011,
  InvalidPeerAddress: -32012,
  // Config
  ConfigValidationFailed: -32020,
  ConfigSaveRejected: -32021,
  // Gateway
  GatewayPreflightFailed: -32030,
  GatewayNotSupportedOnPlatform: -32031,
  // Routing
  RouteOperationFailed: -32040,
  // Subscriptions
  AlreadySubscribed: -32050,
  NotSubscribed: -32051,
} as const;

/** Union of every declared error-code numeric value. */
export type RpcErrorCodeValue = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];

/**
 * Error payload as carried inside a JSON-RPC failure response (§2.3).
 * The `code` is typed as `RpcErrorCodeValue | number` so we can still
 * receive forward-compatible codes from a newer daemon without the UI
 * rejecting the envelope.
 */
export interface RpcError {
  code: RpcErrorCodeValue | number;
  message: string;
  data?: unknown;
}

// ─── §2.1 rpc.hello ──────────────────────────────────────────────────

export interface HelloParams {
  /** Client identifier + version, e.g. "pim-ui/0.0.1". */
  client: string;
  /** RPC protocol version the client speaks (currently 1). */
  rpc_version: number;
}

export interface HelloResult {
  /** Daemon identifier + version, e.g. "pim-daemon/0.2.0". */
  daemon: string;
  rpc_version: number;
  features: string[];
}

// ─── §5.1 status ─────────────────────────────────────────────────────

export type NodeRole = "client" | "relay" | "gateway";

export interface StatusInterface {
  /** OS-level interface name, e.g. "pim0", "utun4". */
  name: string;
  up: boolean;
  mtu: number;
}

export interface StatusTransportTcp {
  port: number;
}
export interface StatusTransportBluetooth {
  enabled: boolean;
}
export interface StatusTransportWifiDirect {
  enabled: boolean;
}

export interface StatusTransport {
  tcp?: StatusTransportTcp;
  bluetooth?: StatusTransportBluetooth;
  wifi_direct?: StatusTransportWifiDirect;
}

export interface StatusRoutes {
  active: number;
  expired: number;
  /** node_id of current egress gateway, or null when routing is local-only. */
  selected_gateway: string | null;
}

export interface StatusStats {
  forwarded_bytes: number;
  forwarded_packets: number;
  dropped: number;
  dropped_reason: string | null;
  congestion_drops: number;
  conntrack_size: number;
}

export interface Status {
  /** Configured node name (from pim.toml `[node] name`). */
  node: string;
  /** Full 64-char hex Ed25519 pubkey. */
  node_id: string;
  /** 8-char prefix for UI display. */
  node_id_short: string;
  /** CIDR, e.g. "10.77.0.100/24". */
  mesh_ip: string;
  interface: StatusInterface;
  role: NodeRole[];
  transport: StatusTransport;
  peers: PeerSummary[];
  routes: StatusRoutes;
  stats: StatusStats;
  uptime_s: number;
  /** Split-default routing (`pim route on`) active. */
  route_on: boolean;
  /** ISO-8601 timestamp of daemon process start. */
  started_at: string;
}

// ─── §5.2 peers ──────────────────────────────────────────────────────

/** Transport type a peer is currently reached via (in a PeerSummary). */
export type PeerTransport = "tcp" | "bluetooth" | "wifi_direct" | "relay";

/** Connection state of a paired peer. */
export type PeerState = "active" | "relayed" | "connecting" | "failed";

export interface PeerSummary {
  node_id: string;
  node_id_short: string;
  label: string | null;
  mesh_ip: string;
  transport: PeerTransport;
  state: PeerState;
  /** 1 = direct; >1 = via a relay. */
  route_hops: number;
  last_seen_s: number;
  latency_ms: number | null;
  is_gateway: boolean;
  /** True when the peer is configured statically in pim.toml. */
  static: boolean;
}

export interface PeersAddStaticParams {
  /** "host:port" for tcp, device address for BT/WFD. */
  address: string;
  mechanism: "tcp" | "bluetooth" | "wifi_direct";
  label?: string;
}

export interface PeersAddStaticResult {
  /** null until the handshake completes; stable config_entry_id is always set. */
  node_id: string | null;
  config_entry_id: string;
}

/** One of the two fields is required; both are accepted for convenience. */
export interface PeersRemoveParams {
  node_id?: string;
  config_entry_id?: string;
}

/** Mechanisms through which an unpaired peer can be discovered. */
export type DiscoveryMechanism = "broadcast" | "bluetooth" | "wifi_direct";

export interface PeerDiscovered {
  /** null if announced anonymously. */
  node_id: string | null;
  address: string;
  mechanism: DiscoveryMechanism;
  first_seen_s: number;
  last_seen_s: number;
  /** Friendly name the peer included in its announce, if any. */
  label_announced: string | null;
}

export interface PeersPairParams {
  node_id?: string;
  address?: string;
  mechanism?: "tcp" | "bluetooth" | "wifi_direct";
  /** "once" = trust for this session only; "persist" = write to trust store. */
  trust: "once" | "persist";
  label?: string;
}

/** Kinds emitted on the `peers.event` notification stream. */
export type PeerEventKind =
  | "connected"
  | "disconnected"
  | "state_changed"
  | "discovered"
  | "pair_failed";

export interface PeerEvent {
  kind: PeerEventKind;
  /** PeerSummary for paired peers; PeerDiscovered for discovery events. */
  peer: PeerSummary | PeerDiscovered;
  /** ISO-8601 timestamp. */
  at: string;
  /** Present for `disconnected` and `pair_failed`. */
  reason?: string;
}

// ─── §5.3 routing ────────────────────────────────────────────────────

export interface RouteSetSplitDefaultParams {
  on: boolean;
}

export interface RouteSetSplitDefaultResult {
  on: boolean;
  /** node_id of gateway selected as egress after the toggle. */
  via_gateway_id: string | null;
}

export interface RouteEntry {
  /** mesh_ip or CIDR. */
  destination: string;
  /** node_id of the next-hop peer. */
  via: string;
  hops: number;
  /** node_id of the peer that advertised this route. */
  learned_from: string;
  is_gateway: boolean;
  /** 0-255 or similar score. */
  load: number;
  age_s: number;
}

export interface KnownGateway {
  node_id: string;
  via: string;
  hops: number;
  score: number;
  selected: boolean;
}

export interface RouteTableResult {
  routes: RouteEntry[];
  gateways: KnownGateway[];
}

// ─── §5.4 gateway ────────────────────────────────────────────────────

export type GatewayPlatform = "linux" | "macos" | "windows" | "other";

export interface GatewayPreflightCheck {
  /** e.g. "iptables_present". */
  name: string;
  ok: boolean;
  detail: string;
}

export interface GatewayPreflightResult {
  supported: boolean;
  platform: GatewayPlatform;
  checks: GatewayPreflightCheck[];
  /** e.g. ["wlan0", "eth0"]. */
  suggested_nat_interfaces: string[];
}

export interface GatewayEnableParams {
  nat_interface: string;
  /** conntrack limit. */
  max_connections?: number;
}

export interface GatewayEnableResult {
  active: boolean;
  nat_interface: string;
  advertised_routes: string[];
}

/** Per §5.4: always `{ active: false }`. */
export interface GatewayDisableResult {
  active: false;
}

// TBD-RPC (RESEARCH §5a): gateway.status method shape — speculative
// pending kernel-repo docs/RPC.md push (BLOCKED per STATE.md). Confirm
// with kernel maintainer when the RPC contract drafts merge.
export interface GatewayStatusResult {
  active: boolean;
  /** Echoed nat_interface; null when active === false. */
  nat_interface: string | null;
  /** Conntrack utilization. Both numerator AND denominator are
   *  required so the brand-fit gauge can render `[████] n / max (pct%)`
   *  per RESEARCH §9a. */
  conntrack: {
    used: number;
    max: number;
  };
  throughput: {
    in_bps: number;
    out_bps: number;
    /** Session-cumulative since gateway enabled. */
    in_total_bytes: number;
    out_total_bytes: number;
  };
  /** Count of paired peers whose egress is THIS node. */
  peers_through_me: number;
  /** Optional list of node_ids routing through this gateway; may be
   *  empty when count > 0 if the daemon truncates for cardinality. */
  peers_through_me_ids?: string[];
  /** ISO-8601; drives the "4h 12m" uptime line. */
  enabled_at: string;
}

// TBD-RPC (RESEARCH §5b): gateway.event notification stream — kinds.
export type GatewayEventKind =
  | "enabled"
  | "disabled"
  | "conntrack_pressure"
  | "throughput_sample"
  | "peer_through_me_added"
  | "peer_through_me_removed";

// TBD-RPC (RESEARCH §5b): gateway.event payload shape.
export interface GatewayEvent {
  kind: GatewayEventKind;
  /** ISO-8601. */
  at: string;
  /** For throughput_sample: { in_bps, out_bps, conntrack_used, conntrack_max }.
   *  For conntrack_pressure: { level: 1 | 2, used, max }. */
  detail?: Record<string, unknown>;
}

// ─── §5.5 config ─────────────────────────────────────────────────────

export type ConfigFormat = "toml" | "json";

export interface ConfigGetParams {
  format: ConfigFormat;
}

export interface ConfigGetResult {
  format: ConfigFormat;
  /** Raw document content in the requested format. */
  config: string;
  /** Absolute path to pim.toml. */
  source_path: string;
  /** ISO-8601. */
  last_modified: string;
}

export interface ConfigSaveParams {
  format: ConfigFormat;
  config: string;
  /** When true, validate only — do not write to disk. */
  dry_run?: boolean;
}

export interface ConfigSaveResult {
  saved: boolean;
  /** List of [section.field] paths whose change requires daemon restart. */
  requires_restart: string[];
  written_to: string;
}

/** Shape carried in `RpcError.data` when `code === ConfigValidationFailed`. */
export interface ConfigValidationError {
  line: number;
  column: number;
  /** e.g. "transport.listen_port". */
  path: string;
  message: string;
}

// ─── §5.6 logs + §5.7 status subscriptions ───────────────────────────

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LogsSubscribeParams {
  /** Threshold filter — only events at or above this level pass.
   *  Used for back-compat / "warn and up" simplicity. If `levels` is
   *  also set, `levels` wins (explicit beats threshold). */
  min_level?: LogLevel;
  /** Explicit allow-list of levels. When non-empty, ONLY events at one
   *  of these levels are forwarded — arbitrary subset selection
   *  (e.g. info + error without warn). Empty / missing falls back to
   *  `min_level` semantics. */
  levels?: LogLevel[];
  /** Source-prefix filter. The daemon uses `event.source.starts_with`
   *  on each entry. e.g. `["pim_daemon", "pim_transport"]` shows logs
   *  only from those crates and ignores `tao`, `mio`, etc. */
  sources?: string[];
}

/** Result shape of every `*.subscribe` RPC (§4 shows the example). */
export interface SubscriptionResult {
  subscription_id: string;
}

/** Params shape of every `*.unsubscribe` RPC. */
export interface SubscriptionUnsubscribeParams {
  subscription_id: string;
}

export interface LogEvent {
  /** ISO-8601 with millisecond precision. */
  ts: string;
  level: LogLevel;
  /** Module name. */
  source: string;
  /** Present when the event pertains to a specific peer. */
  peer_id?: string;
  message: string;
  fields?: Record<string, unknown>;
}

/** Kinds emitted on the `status.event` stream per §5.7. */
export type StatusEventKind =
  | "role_changed"
  | "interface_up"
  | "interface_down"
  | "gateway_selected"
  | "gateway_lost"
  | "route_on"
  | "route_off"
  | "kill_switch";

export interface StatusEvent {
  kind: StatusEventKind;
  at: string;
  /** Free-form structured context; shape depends on `kind`. */
  detail?: Record<string, unknown>;
}

// ─── Method + event registry (typed callDaemon spine) ────────────────

/**
 * Maps each v1 method name to its `{ params; result }` pair. This is
 * what makes `callDaemon<"status">(null)` type-safe in `rpc.ts` —
 * callers pick a method name, the compiler enforces the param shape
 * and infers the result. If a method is missing here the rpc.ts
 * wrapper will refuse to call it.
 *
 * 20 entries total: 17 methods from docs/RPC.md §8 plus the three
 * `*.subscribe` / `*.unsubscribe` control pairs. This matches the list
 * asserted by the compile-only test in `rpc-types.test.ts`.
 */
export interface RpcMethodMap {
  // §2.1
  "rpc.hello": { params: HelloParams; result: HelloResult };
  // §5.1
  "status": { params: null; result: Status };
  "status.subscribe": { params: null; result: SubscriptionResult };
  "status.unsubscribe": {
    params: SubscriptionUnsubscribeParams;
    result: null;
  };
  // §5.2
  "peers.list": { params: null; result: PeerSummary[] };
  "peers.add_static": {
    params: PeersAddStaticParams;
    result: PeersAddStaticResult;
  };
  "peers.remove": { params: PeersRemoveParams; result: null };
  "peers.discovered": { params: null; result: PeerDiscovered[] };
  "peers.pair": { params: PeersPairParams; result: PeerSummary };
  "peers.subscribe": { params: null; result: SubscriptionResult };
  "peers.unsubscribe": {
    params: SubscriptionUnsubscribeParams;
    result: null;
  };
  // §5.3
  "route.set_split_default": {
    params: RouteSetSplitDefaultParams;
    result: RouteSetSplitDefaultResult;
  };
  "route.table": { params: null; result: RouteTableResult };
  // §5.4
  "gateway.preflight": { params: null; result: GatewayPreflightResult };
  "gateway.enable": {
    params: GatewayEnableParams;
    result: GatewayEnableResult;
  };
  "gateway.disable": { params: null; result: GatewayDisableResult };
  // TBD-RPC (RESEARCH §5c): gateway.status one-shot + subscribe lifecycle.
  "gateway.status": { params: null; result: GatewayStatusResult };
  "gateway.subscribe": { params: null; result: SubscriptionResult };
  "gateway.unsubscribe": {
    params: SubscriptionUnsubscribeParams;
    result: null;
  };
  // §5.5
  "config.get": { params: ConfigGetParams; result: ConfigGetResult };
  "config.save": { params: ConfigSaveParams; result: ConfigSaveResult };
  // §5.6
  "logs.subscribe": {
    params: LogsSubscribeParams;
    result: SubscriptionResult;
  };
  "logs.unsubscribe": {
    params: SubscriptionUnsubscribeParams;
    result: null;
  };
}

/** Maps each v1 notification method to its `params` payload shape. */
export interface RpcEventMap {
  "status.event": StatusEvent;
  "peers.event": PeerEvent;
  "logs.event": LogEvent;
  // TBD-RPC (RESEARCH §5b)
  "gateway.event": GatewayEvent;
}

export type RpcMethodName = keyof RpcMethodMap;
export type RpcEventName = keyof RpcEventMap;
