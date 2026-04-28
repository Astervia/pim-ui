//! Newline-delimited JSON-RPC 2.0 client over a tokio UnixStream.
//! Mirrors proximity-internet-mesh/docs/RPC.md §1.1 transport and §2 message format.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;
use tokio::sync::{broadcast, oneshot, Mutex};

/// RPC error payload from docs/RPC.md §2.3. Matches the frontend RpcError type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

/// Server-push notification (§2.4). Forwarded verbatim to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub method: String,
    pub params: Value,
}

/// In-flight request map: response id → oneshot reply channel. The reader
/// task owns this; senders insert before writing the request and remove
/// when the response (or error) arrives. Aliased to keep `JsonRpcClient`
/// readable.
type PendingMap = HashMap<u64, oneshot::Sender<std::result::Result<Value, RpcError>>>;

#[derive(Serialize)]
struct Request<'a> {
    jsonrpc: &'static str,
    id: u64,
    method: &'a str,
    params: Value,
}

#[derive(Deserialize)]
struct RawMessage {
    // id present => response; id absent => notification (§2.4)
    #[serde(default)]
    id: Option<Value>,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    params: Option<Value>,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<RpcError>,
}

/// JSON-RPC client — one per Unix socket connection.
///
/// Spawn policy: the I/O task runs until the socket closes; at that point
/// every pending oneshot is resolved with an error and the notifications
/// channel is dropped. Callers detect disconnect by the broadcast receiver
/// lagging / closing or by watching `disconnected()`.
pub struct JsonRpcClient {
    next_id: Mutex<u64>,
    pending: Arc<Mutex<PendingMap>>,
    writer: Mutex<tokio::net::unix::OwnedWriteHalf>,
    notifications_tx: broadcast::Sender<Notification>,
    /// Signalled when the reader task exits (socket closed / EOF).
    disconnected_rx: tokio::sync::watch::Receiver<bool>,
}

impl JsonRpcClient {
    /// Connect and spawn the reader task.
    pub async fn connect(socket: &Path) -> Result<Arc<Self>> {
        let stream = UnixStream::connect(socket)
            .await
            .map_err(|e| anyhow!("connect {:?}: {}", socket, e))?;
        let (read_half, write_half) = stream.into_split();
        let (notifications_tx, _) = broadcast::channel::<Notification>(128);
        let (disconnected_tx, disconnected_rx) = tokio::sync::watch::channel(false);
        let pending: Arc<Mutex<PendingMap>> = Arc::new(Mutex::new(HashMap::new()));

        let client = Arc::new(Self {
            next_id: Mutex::new(1),
            pending: pending.clone(),
            writer: Mutex::new(write_half),
            notifications_tx: notifications_tx.clone(),
            disconnected_rx,
        });

        // Reader task: parses one line at a time (§1.1 framing).
        tokio::spawn({
            let pending = pending.clone();
            async move {
                let mut lines = BufReader::new(read_half).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let msg: RawMessage = match serde_json::from_str(&line) {
                        Ok(m) => m,
                        Err(e) => {
                            log::warn!("malformed JSON from daemon: {}", e);
                            continue;
                        }
                    };
                    match (msg.id, msg.method, msg.result, msg.error, msg.params) {
                        // Response (§2.3) — id is set.
                        (Some(Value::Number(n)), _, result, error, _) => {
                            let Some(id) = n.as_u64() else { continue };
                            let Some(tx) = pending.lock().await.remove(&id) else {
                                continue;
                            };
                            let outcome = if let Some(err) = error {
                                Err(err)
                            } else {
                                Ok(result.unwrap_or(Value::Null))
                            };
                            let _ = tx.send(outcome);
                        }
                        // Notification (§2.4) — no id, method + params set.
                        (None, Some(method), _, _, Some(params)) => {
                            let _ = notifications_tx.send(Notification { method, params });
                        }
                        _ => log::warn!("unexpected JSON-RPC message shape: {}", line),
                    }
                }
                // Socket closed — wake every pending caller.
                let mut pending = pending.lock().await;
                for (_, tx) in pending.drain() {
                    let _ = tx.send(Err(RpcError {
                        code: -32603,
                        message: "connection closed".into(),
                        data: None,
                    }));
                }
                let _ = disconnected_tx.send(true);
            }
        });

        Ok(client)
    }

    /// Send one JSON-RPC request and await its response.
    /// Timeout after 10s — if daemon is alive but unresponsive, surface error.
    pub async fn call(&self, method: &str, params: Value) -> std::result::Result<Value, RpcError> {
        let id = {
            let mut next = self.next_id.lock().await;
            let id = *next;
            *next += 1;
            id
        };
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(id, tx);

        let req = Request {
            jsonrpc: "2.0",
            id,
            method,
            params,
        };
        let encoded = match serde_json::to_string(&req) {
            Ok(s) => s,
            Err(e) => {
                return Err(RpcError {
                    code: -32603,
                    message: e.to_string(),
                    data: None,
                });
            }
        };
        let mut writer = self.writer.lock().await;
        if let Err(e) = writer.write_all(encoded.as_bytes()).await {
            return Err(RpcError {
                code: -32603,
                message: format!("write: {e}"),
                data: None,
            });
        }
        if let Err(e) = writer.write_all(b"\n").await {
            return Err(RpcError {
                code: -32603,
                message: format!("write newline: {e}"),
                data: None,
            });
        }
        drop(writer);

        match tokio::time::timeout(Duration::from_secs(10), rx).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(RpcError {
                code: -32603,
                message: "reader dropped".into(),
                data: None,
            }),
            Err(_) => {
                self.pending.lock().await.remove(&id);
                Err(RpcError {
                    code: -32603,
                    message: "request timeout (10s)".into(),
                    data: None,
                })
            }
        }
    }

    /// Subscribe to the notification fan-out. Each receiver sees every server-push.
    pub fn subscribe_notifications(&self) -> broadcast::Receiver<Notification> {
        self.notifications_tx.subscribe()
    }

    /// Clone a watch receiver that flips to `true` when the socket closes.
    pub fn disconnected(&self) -> tokio::sync::watch::Receiver<bool> {
        self.disconnected_rx.clone()
    }
}
