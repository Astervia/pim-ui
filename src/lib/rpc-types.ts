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
  // Messages
  MessagePeerUnknown: -32060,
  MessageBodyTooLarge: -32061,
  MessageStorageError: -32062,
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
  /** 32-char lowercase hex NodeId (SHA-256/2 of the Ed25519 pubkey). */
  node_id: string;
  /** 8-char prefix for UI display. */
  node_id_short: string;
  /**
   * 64-char lowercase hex of this node's static X25519 public key.
   * Derived from the same Ed25519 seed at startup; safe to share
   * out-of-band so peers can import it via `peers.import_identity`
   * and message us across the mesh.
   */
  x25519_pubkey: string;
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
  /**
   * 64-char lowercase hex of the peer's cached X25519 static public
   * key. Null when no `PeerInfo` has been received and no out-of-band
   * `peers.import_identity` has populated the keystore.
   */
  x25519_pubkey: string | null;
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

/**
 * Dial a peer at a runtime-known socket address with the given NodeId.
 * Used to wire BT-discovered peers into the mesh: the Tauri sidecar
 * exposes a 127.0.0.1 TCP port that bridges to the open RFCOMM channel,
 * and this RPC asks the daemon to connect through it.
 */
export interface PeersConnectDynamicParams {
  /** 32-character lowercase hex of the remote peer's NodeId. */
  node_id: string;
  /** Socket address to dial — e.g. "127.0.0.1:53104" for a BT bridge. */
  address: string;
}

export interface PeersConnectDynamicResult {
  /** Echoed back from the request — useful for logging on the UI side. */
  node_id: string;
  address: string;
  status: "connected";
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

/**
 * Out-of-band identity import. Lets a user paste a peer's `node_id +
 * x25519_pubkey` (typically shared via Signal/email/QR) so the daemon
 * can ECIES-encrypt to that peer without a direct PeerInfo handshake —
 * unblocking multi-hop messaging when both sides import each other.
 */
export interface PeersImportIdentityParams {
  /** 32-char lowercase hex NodeId. */
  node_id: string;
  /** 64-char lowercase hex of the peer's static X25519 public key. */
  x25519_pubkey: string;
  /** Optional friendly label; preserves existing if omitted/empty. */
  friendly_name?: string;
}

export interface PeersImportIdentityResult {
  /** Echoed back: 32-char hex NodeId. */
  node_id: string;
  /** 8-char prefix for UI surfacing. */
  node_id_short: string;
  /**
   * `true` when a new `peers_seen` row was created; `false` when an
   * identical row already existed (idempotent re-import).
   */
  imported: boolean;
}

/**
 * Source of an inbound `PeerInfo` frame — direct (handshake) vs. routed
 * (multi-hop broadcast). Carried on `peer_seen` so the UI can section
 * directly-paired peers from broadcast-discovered ones, and also
 * surfaces in the broadcast-state RPCs.
 */
export type PeerInfoSource = "direct" | "routed";

export interface PeersBroadcastIdentityNowResult {
  /** Number of distinct destination NodeIds the cycle attempted. */
  recipients: number;
  /** UTC ms when the cycle completed (`i64::MIN` if it didn't run). */
  sent_at_ms: number;
}

/**
 * Partial update for `peers.set_broadcast_config`. Fields omitted from
 * the payload leave the corresponding daemon-side value unchanged. To
 * disable the periodic outbound broadcast, send
 * `outgoing_interval_s: null` explicitly (an absent key is a no-op).
 */
export interface PeersSetBroadcastConfigParams {
  /** `null` disables; `>= 30` sets a periodic cadence. */
  outgoing_interval_s?: number | null;
  /** When false, routed PeerInfo no longer surfaces `peer_seen`. */
  watch_incoming?: boolean;
  /** Per-peer minimum seconds between accepted broadcasts. */
  min_peer_interval_s?: number;
}

export interface BroadcastState {
  outgoing_interval_s: number | null;
  watch_incoming: boolean;
  min_peer_interval_s: number;
  /** UTC ms of the last completed broadcast cycle, null if none yet. */
  last_broadcast_ms: number | null;
  /** Recipient count from the last completed cycle, null if none yet. */
  last_recipient_count: number | null;
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
//
// The kernel daemon today only emits { active, nat_interface,
// advertised_routes }; everything below is optional so the UI doesn't
// crash when the rich payload (gauge / throughput / peer-through-me)
// hasn't been wired up daemon-side yet. Active-panel surfaces gracefully
// degrade — see <GatewayActivePanel /> for the per-field guards.
export interface GatewayStatusResult {
  active: boolean;
  /** Echoed nat_interface; null when active === false. */
  nat_interface: string | null;
  /** Conntrack utilization. Daemon may omit while wiring up the kernel
   *  contract; gauge is suppressed when absent. */
  conntrack?: {
    used: number;
    max: number;
  };
  throughput?: {
    in_bps: number;
    out_bps: number;
    /** Session-cumulative since gateway enabled. */
    in_total_bytes: number;
    out_total_bytes: number;
  };
  /** Count of paired peers whose egress is THIS node. */
  peers_through_me?: number;
  /** Optional list of node_ids routing through this gateway; may be
   *  empty when count > 0 if the daemon truncates for cardinality. */
  peers_through_me_ids?: string[];
  /** ISO-8601; drives the "4h 12m" uptime line. */
  enabled_at?: string;
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

/**
 * Shape carried in `RpcError.data` when `code === ConfigValidationFailed`,
 * AND the structured error returned by the Tauri commands `config_validate`
 * and `write_pim_config_text`.
 *
 * `line` / `column` / `path` are optional because schema-level errors
 * (unknown enum variant, missing required field) and IO failures don't
 * carry span info. Daemon REJECTs always populate them; the Tauri Rust
 * command may omit them for non-syntactic errors. Consumers default
 * `line ?? 0` / `column ?? 0` / `path ?? ""` when threading into
 * `RawTomlError`.
 */
export interface ConfigValidationError {
  line?: number;
  column?: number;
  /** e.g. "transport.listen_port". */
  path?: string;
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

// ─── §5.7 messages ───────────────────────────────────────────────────

/** Message lifecycle, mirrored verbatim from `pim-daemon::messaging`. */
export type MessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

/** Direction of a message relative to the local node. */
export type MessageDirection = "sent" | "received";

/** A single stored message — sent or received. */
export interface MessageRecord {
  /** 32-char lowercase hex (UUIDv4 bytes). */
  id: string;
  /** Peer node id (32-char lowercase hex). */
  peer_node_id: string;
  direction: MessageDirection;
  /** UTF-8 plaintext body. */
  body: string;
  timestamp_ms: number;
  status: MessageStatus;
  failure_reason: string | null;
  delivered_at_ms: number | null;
  read_at_ms: number | null;
}

/** One row in the conversation list (sidebar in the Messages tab). */
export interface ConversationSummary {
  /** 32-char lowercase hex. */
  peer_node_id: string;
  peer_node_id_short: string;
  /** Latest friendly name advertised by the peer; falls back to short id. */
  name: string;
  last_message_preview: string | null;
  last_message_ts_ms: number | null;
  unread_count: number;
  /** Whether the peer currently has a live session with the daemon. */
  is_connected: boolean;
  /**
   * 64-char lowercase hex of the peer's cached X25519 static public key
   * (sourced from `peers_seen`). Lets the identity card render the key
   * for offline / known-only peers without needing a matching active
   * session in `usePeers()`.
   */
  x25519_pubkey: string | null;
}

export interface MessagesListConversationsResult {
  conversations: ConversationSummary[];
}

export interface MessagesHistoryParams {
  peer_node_id: string;
  before_ts_ms?: number;
  limit?: number;
}

export interface MessagesHistoryResult {
  messages: MessageRecord[];
  has_more: boolean;
}

export interface MessagesSendParams {
  peer_node_id: string;
  /** UTF-8 plaintext, ≤ 8 KB. */
  body: string;
}

export interface MessagesSendResult {
  id: string;
  timestamp_ms: number;
  status: MessageStatus;
}

export interface MessagesMarkReadParams {
  peer_node_id: string;
  up_to_ts_ms: number;
}

export interface MessagesMarkReadResult {
  unread_count: number;
}

/** Discriminated union over `messages.event` notification kinds. */
export type MessageEvent =
  | {
      kind: "message_received";
      message: MessageRecord;
      conversation: ConversationSummary;
    }
  | {
      kind: "message_status";
      message_id: string;
      peer_node_id: string;
      new_status: MessageStatus;
      at_ms: number;
    }
  | {
      kind: "peer_seen";
      peer_node_id: string;
      name: string;
      x25519_known: boolean;
      /** How the identity arrived — direct handshake or routed broadcast. */
      via: PeerInfoSource;
    };

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
  "peers.connect_dynamic": {
    params: PeersConnectDynamicParams;
    result: PeersConnectDynamicResult;
  };
  "peers.remove": { params: PeersRemoveParams; result: null };
  "peers.discovered": { params: null; result: PeerDiscovered[] };
  "peers.pair": { params: PeersPairParams; result: PeerSummary };
  "peers.import_identity": {
    params: PeersImportIdentityParams;
    result: PeersImportIdentityResult;
  };
  "peers.broadcast_identity_now": {
    params: null;
    result: PeersBroadcastIdentityNowResult;
  };
  "peers.set_broadcast_config": {
    params: PeersSetBroadcastConfigParams;
    result: BroadcastState;
  };
  "peers.get_broadcast_state": { params: null; result: BroadcastState };
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
  // §5.7 messages
  "messages.list_conversations": {
    params: null;
    result: MessagesListConversationsResult;
  };
  "messages.history": {
    params: MessagesHistoryParams;
    result: MessagesHistoryResult;
  };
  "messages.send": {
    params: MessagesSendParams;
    result: MessagesSendResult;
  };
  "messages.mark_read": {
    params: MessagesMarkReadParams;
    result: MessagesMarkReadResult;
  };
  "messages.subscribe": { params: null; result: SubscriptionResult };
  "messages.unsubscribe": {
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
  /** Messaging (§5.7) — discriminated by `kind`. */
  "messages.event": MessageEvent;
}

export type RpcMethodName = keyof RpcMethodMap;
export type RpcEventName = keyof RpcEventMap;
