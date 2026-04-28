//! `pim-daemon-stub` — dev-mode RPC stub for `pim-ui`.
//!
//! The kernel `pim-daemon` (proximity-internet-mesh repo) does NOT yet ship
//! the JSON-RPC server documented in `docs/RPC.md`. UI development against
//! the real binary stalls at `rpc.hello` because nothing binds the Unix
//! socket the UI tries to connect to. This stub fills the gap:
//!
//!   * Binds `$TMPDIR/pim.sock` (per docs/RPC.md §1.2 macOS row).
//!   * Reads `pim.toml` for `[node].name` and `[interface].name` so the
//!     UI's status surface reflects the config the user just saved.
//!   * Implements the 20+ JSON-RPC methods declared in
//!     `pim-ui/src/lib/rpc-types.ts::RpcMethodMap` with shapes that
//!     match `Status`, `PeerSummary`, etc. — enough to drive the UI
//!     out of `starting` into `running` and exercise every screen.
//!   * `*.subscribe` returns a stable subscription_id but emits no
//!     notifications by default (UI shows "no events yet" / empty
//!     log stream — exactly what Limited Mode is designed for).
//!
//! When the upstream kernel ships the real RPC server, replace
//! `src-tauri/binaries/pim-daemon-aarch64-apple-darwin` with the real
//! binary and this stub becomes obsolete.
//!
//! ## CLI contract
//!
//! Same as the real `pim-daemon`:
//!
//!     pim-daemon-stub <config_path> <pid_file_path>
//!
//! Both arguments are positional. Matches the spawn shell line in
//! `pim-ui/src-tauri/src/daemon/sidecar.rs::spawn_macos_privileged`.
//!
//! ## What it does NOT do
//!
//! No TUN device, no transport listener, no discovery, no mesh
//! networking. This is purely an RPC frontend over fake state. If
//! you need real packet flow, build the kernel daemon from
//! `~/Downloads/proximity-internet-mesh` source.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::Mutex;

const RPC_VERSION: u64 = 1;

/// Concrete daemon ident the UI displays in About / version line.
const DAEMON_IDENT: &str = "pim-daemon-stub/0.0.1";

/// ── Stub state shared across all connections.
struct StubState {
    started_at: Instant,
    /// Wall-clock start, ISO-8601 formatted; baked once at boot.
    started_at_iso: String,
    /// Resolved node name from `[node].name` in pim.toml.
    node_name: String,
    /// Resolved interface name from `[interface].name`.
    interface_name: String,
    /// Configured TCP listen port — informative only, the stub does
    /// not actually bind any TCP.
    tcp_listen_port: u16,
    /// Subscription id allocator (shared mutable counter).
    sub_counter: Mutex<u64>,
    /// Path to the pim.toml the UI is operating against — used by
    /// `config.get` / `config.save`.
    config_path: PathBuf,
}

impl StubState {
    async fn next_sub_id(&self) -> String {
        let mut g = self.sub_counter.lock().await;
        *g += 1;
        format!("stub-sub-{}", *g)
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    // CLI: <config_path> <pid_file_path>
    let mut args = std::env::args().skip(1);
    let config_path = args
        .next()
        .ok_or_else(|| anyhow!("missing positional arg: <config_path>"))?;
    let pid_file_path = args
        .next()
        .ok_or_else(|| anyhow!("missing positional arg: <pid_file_path>"))?;
    let config_path = PathBuf::from(config_path);
    let pid_file_path = PathBuf::from(pid_file_path);

    log::info!(
        "{DAEMON_IDENT} starting — config={} pid_file={}",
        config_path.display(),
        pid_file_path.display()
    );

    // Parse pim.toml for node/interface fields. Tolerate missing fields —
    // the UI's first-run flow may not have populated them yet (e.g.
    // running the stub before any save).
    let parsed = parse_config(&config_path).unwrap_or_default();

    // Write the PID file (matches the real daemon's contract for
    // pim-ui's sidecar liveness probe).
    let pid = std::process::id();
    std::fs::write(&pid_file_path, format!("{pid}\n"))
        .with_context(|| format!("write PID file {}", pid_file_path.display()))?;
    log::info!("PID {pid} written to {}", pid_file_path.display());

    // Resolve the socket path. Honor PIM_RPC_SOCKET if set (matches
    // socket_path::resolve_socket_path in pim-ui), otherwise default
    // to $TMPDIR/pim.sock.
    let socket_path = resolve_socket_path();
    log::info!("RPC socket: {}", socket_path.display());

    // Best-effort: remove a stale socket from a previous run.
    if socket_path.exists() {
        let _ = std::fs::remove_file(&socket_path);
    }

    let listener = UnixListener::bind(&socket_path)
        .with_context(|| format!("bind {}", socket_path.display()))?;
    log::info!("listening for connections");

    let state = Arc::new(StubState {
        started_at: Instant::now(),
        started_at_iso: chrono::Utc::now().to_rfc3339(),
        node_name: parsed.node_name,
        interface_name: parsed.interface_name,
        tcp_listen_port: parsed.tcp_listen_port,
        sub_counter: Mutex::new(0),
        config_path: config_path.clone(),
    });

    // Wire SIGTERM / SIGINT to a clean exit so kill_privileged can
    // drop us politely (same TERM-then-KILL flow the real daemon
    // expects). On clean exit we remove the socket + PID file.
    let cleanup_socket = socket_path.clone();
    let cleanup_pid = pid_file_path.clone();
    tokio::spawn(async move {
        let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler");
        let mut sigint = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
            .expect("install SIGINT handler");
        tokio::select! {
            _ = sigterm.recv() => log::info!("SIGTERM received, shutting down"),
            _ = sigint.recv() => log::info!("SIGINT received, shutting down"),
        }
        let _ = std::fs::remove_file(&cleanup_socket);
        let _ = std::fs::remove_file(&cleanup_pid);
        std::process::exit(0);
    });

    loop {
        let (stream, _addr) = listener.accept().await.context("accept")?;
        let state = state.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_connection(stream, state).await {
                log::warn!("connection error: {e}");
            }
        });
    }
}

/// Resolve `$TMPDIR/pim.sock` (or `PIM_RPC_SOCKET` override). Mirrors
/// `pim-ui/src-tauri/src/daemon/socket_path.rs::resolve_socket_path`.
fn resolve_socket_path() -> PathBuf {
    if let Ok(p) = std::env::var("PIM_RPC_SOCKET") {
        return PathBuf::from(p);
    }
    let tmp = std::env::var_os("TMPDIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/tmp"));
    tmp.join("pim.sock")
}

#[derive(Default)]
struct ParsedConfig {
    node_name: String,
    interface_name: String,
    tcp_listen_port: u16,
}

fn parse_config(path: &Path) -> Result<ParsedConfig> {
    let text = std::fs::read_to_string(path).with_context(|| format!("read {}", path.display()))?;
    let v: toml::Value = toml::from_str(&text).context("parse pim.toml")?;
    let node_name = v
        .get("node")
        .and_then(|n| n.get("name"))
        .and_then(|s| s.as_str())
        .unwrap_or("(unset)")
        .to_string();
    let interface_name = v
        .get("interface")
        .and_then(|i| i.get("name"))
        .and_then(|s| s.as_str())
        .unwrap_or("pim0")
        .to_string();
    let tcp_listen_port = v
        .get("transport")
        .and_then(|t| t.get("listen_port"))
        .and_then(|n| n.as_integer())
        .and_then(|n| u16::try_from(n).ok())
        .unwrap_or(0);
    Ok(ParsedConfig {
        node_name,
        interface_name,
        tcp_listen_port,
    })
}

// ─────────────────────────────────────────────────────────────────────────
// Per-connection handler.
// ─────────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct RpcRequest {
    jsonrpc: Option<String>,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct RpcResponse {
    jsonrpc: &'static str,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcError>,
}

#[derive(Debug, Serialize)]
struct RpcError {
    code: i32,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
}

async fn handle_connection(stream: UnixStream, state: Arc<StubState>) -> Result<()> {
    let (rd, mut wr) = stream.into_split();
    let mut lines = BufReader::new(rd).lines();

    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() {
            continue;
        }
        let req: RpcRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                log::warn!("malformed JSON from client: {e} (line={line:?})");
                continue;
            }
        };
        if req.jsonrpc.as_deref() != Some("2.0") {
            log::warn!("non-2.0 jsonrpc request: {req:?}");
        }
        let id = req.id.clone().unwrap_or(Value::Null);
        log::debug!("→ {} (id={})", req.method, id);

        let outcome = dispatch(&state, &req.method, req.params.unwrap_or(Value::Null)).await;
        let response = match outcome {
            Ok(result) => RpcResponse {
                jsonrpc: "2.0",
                id,
                result: Some(result),
                error: None,
            },
            Err(err) => RpcResponse {
                jsonrpc: "2.0",
                id,
                result: None,
                error: Some(err),
            },
        };

        let mut bytes = serde_json::to_vec(&response).context("serialize response")?;
        bytes.push(b'\n');
        wr.write_all(&bytes).await.context("write response")?;
        wr.flush().await.ok();
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────
// Method dispatch.
// ─────────────────────────────────────────────────────────────────────────

async fn dispatch(state: &Arc<StubState>, method: &str, _params: Value) -> Result<Value, RpcError> {
    match method {
        // §2.1
        "rpc.hello" => Ok(json!({
            "daemon": DAEMON_IDENT,
            "rpc_version": RPC_VERSION,
            "features": [],
        })),

        // §5.1 status
        "status" => Ok(stub_status(state)),
        "status.subscribe" => Ok(json!({ "subscription_id": state.next_sub_id().await })),
        "status.unsubscribe" => Ok(Value::Null),

        // §5.2 peers
        "peers.list" => Ok(Value::Array(vec![])),
        "peers.add_static" => Ok(json!({
            "node_id": null,
            "config_entry_id": format!("stub-peer-{}", state.next_sub_id().await),
        })),
        "peers.remove" => Ok(Value::Null),
        "peers.discovered" => Ok(Value::Array(vec![])),
        "peers.pair" => Err(RpcError {
            code: -32603,
            message: "stub daemon: pair is not implemented; no real handshake possible".into(),
            data: None,
        }),
        "peers.subscribe" => Ok(json!({ "subscription_id": state.next_sub_id().await })),
        "peers.unsubscribe" => Ok(Value::Null),

        // §5.3 routing
        "route.set_split_default" => Ok(json!({
            "on": false,
            "via_gateway_id": null,
        })),
        "route.table" => Ok(json!({
            "routes": [],
            "gateways": [],
        })),

        // §5.4 gateway
        "gateway.preflight" => Ok(json!({
            "supported": cfg!(target_os = "linux"),
            "platform": platform_tag(),
            "checks": [
                {
                    "name": "stub_daemon_active",
                    "ok": false,
                    "detail": "stub RPC daemon — kernel pim-daemon JSON-RPC not implemented yet",
                }
            ],
            "suggested_nat_interfaces": [],
        })),
        "gateway.enable" => Err(RpcError {
            code: -32031,
            message: "stub daemon: gateway mode requires the kernel daemon".into(),
            data: None,
        }),
        "gateway.disable" => Ok(json!({ "active": false })),
        "gateway.status" => Ok(json!({
            "active": false,
            "nat_interface": null,
            "advertised_routes": [],
        })),
        "gateway.subscribe" => Ok(json!({ "subscription_id": state.next_sub_id().await })),
        "gateway.unsubscribe" => Ok(Value::Null),

        // §5.5 config
        "config.get" => stub_config_get(state).map_err(|e| RpcError {
            code: -32603,
            message: format!("config.get: {e}"),
            data: None,
        }),
        "config.save" => Ok(json!({
            "saved": true,
            "applied": true,
            "warnings": ["stub daemon: save is in-memory only — no real reload"],
        })),

        // §5.6 logs
        "logs.subscribe" => Ok(json!({ "subscription_id": state.next_sub_id().await })),
        "logs.unsubscribe" => Ok(Value::Null),

        unknown => Err(RpcError {
            code: -32601,
            message: format!("method not found: {unknown}"),
            data: None,
        }),
    }
}

fn platform_tag() -> &'static str {
    if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "other"
    }
}

fn stub_status(state: &Arc<StubState>) -> Value {
    let uptime_s = state.started_at.elapsed().as_secs();
    json!({
        "node": state.node_name,
        // 64-char zero hex = obviously-stub identity. The UI's
        // node_id_short helper takes the first 8 chars.
        "node_id": "0000000000000000000000000000000000000000000000000000000000000000",
        "node_id_short": "00000000",
        "mesh_ip": "10.77.0.1/24",
        "interface": {
            "name": state.interface_name,
            "up": false,
            "mtu": 1400,
        },
        "role": ["client"],
        "transport": {
            "tcp": { "port": state.tcp_listen_port },
        },
        "peers": [],
        "routes": {
            "active": 0,
            "expired": 0,
            "selected_gateway": null,
        },
        "stats": {
            "forwarded_bytes": 0,
            "forwarded_packets": 0,
            "dropped": 0,
            "dropped_reason": null,
            "congestion_drops": 0,
            "conntrack_size": 0,
        },
        "uptime_s": uptime_s,
        "route_on": false,
        "started_at": state.started_at_iso,
    })
}

fn stub_config_get(state: &Arc<StubState>) -> Result<Value> {
    let toml_text = std::fs::read_to_string(&state.config_path)
        .with_context(|| format!("read {}", state.config_path.display()))?;
    Ok(json!({
        "format": "toml",
        "content": toml_text,
        "path": state.config_path.to_string_lossy(),
    }))
}
