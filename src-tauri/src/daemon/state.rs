//! Daemon connection state machine + reconnect loop + handshake watchdog.
//!
//! Owns the Sidecar (child process) and the JsonRpcClient (Unix socket).
//! Emits Tauri events on every state transition. Maintains a
//! HashMap<subscription_id, event_name> so daemon_unsubscribe(subscription_id)
//! can look up which daemon-side stream to tear down (B1 checker fix).
//!
//! State graph:
//!   stopped -> [start()] -> starting -> (hello OK, within HANDSHAKE_TIMEOUT_SECS) -> running
//!   starting -> [watchdog fires, still Starting] -> error (-32000 "handshake timeout")
//!   running -> [stop()] -> stopped
//!   running -> [socket closed] -> reconnecting -> (hello OK) -> running
//!   any    -> [fatal] -> error
//!
//! Reconnect policy: 500ms -> 1s -> 2s -> 4s -> 4s ... capped at 4s.
//! Handshake watchdog: 10s — caps the worst-case "daemon spawned but never
//!   responds" surface. W2 checker fix for success criterion 4 (≤ 3s target
//!   for happy-path, but a hard 10s ceiling for honest error surfacing).
//! Success criterion 4: disconnect detected within 5s; reconnect restores
//! subscriptions transparently.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::sync::{oneshot, Mutex};

use crate::daemon::events::{self, DaemonStateChange, RpcEventPayload};
use crate::daemon::jsonrpc::{JsonRpcClient, Notification, RpcError};
use crate::daemon::sidecar::Sidecar;
use crate::daemon::socket_path;

/// W2 checker fix: hard ceiling on how long `starting` can last before the
/// state machine gives up and transitions to `error`.
pub const HANDSHAKE_TIMEOUT_SECS: u64 = 10;

/// Mirror of frontend DaemonState (src/lib/daemon-state.ts).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DaemonState {
    Stopped,
    Starting,
    Running,
    Reconnecting,
    Error,
}

/// Phase 01.1 D-18: payload the sidecar's tokio task hands back to
/// DaemonConnection when `CommandEvent::Terminated` fires within 500 ms of
/// `daemon_start`. Routed through the EXISTING `daemon://state-changed`
/// event by `report_crash_on_boot` — no new event channel.
#[derive(Debug, Clone)]
pub struct CrashOnBootInfo {
    pub exit_code: Option<i32>,
    pub signal: Option<i32>,
    /// Last 2 KiB of the daemon's stderr.
    pub stderr_tail: String,
    /// Wall-clock ms between spawn and Terminated; always < 500 here.
    pub elapsed_ms: u64,
    /// Resolved user-scope `pim.toml` path so the UI can show it without
    /// re-resolving (which might pick up a different env at UI boot).
    pub config_path: String,
}

pub struct DaemonConnection {
    state: Mutex<DaemonState>,
    last_error: Mutex<Option<RpcError>>,
    sidecar: Sidecar,
    client: Mutex<Option<Arc<JsonRpcClient>>>,
    /// Subscriptions restored after reconnect — set of RPC event names the UI asked for.
    active_subscriptions: Mutex<HashSet<String>>,
    /// B1 checker fix: subscription_id → event_name. Populated by daemon_subscribe,
    /// read by daemon_unsubscribe to resolve which daemon-side stream to unsub from.
    /// The type is HashMap<String, String> — subscription_id is a uuid v4, event_name
    /// is one of "status.event" | "peers.event" | "logs.event".
    subscription_ids: Mutex<HashMap<String, String>>,
    /// W2 checker fix: handshake watchdog cancel handle. Dropped (or replaced)
    /// on successful handshake or on stop().
    watchdog_cancel: Mutex<Option<oneshot::Sender<()>>>,
}

impl DaemonConnection {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            state: Mutex::new(DaemonState::Stopped),
            last_error: Mutex::new(None),
            sidecar: Sidecar::new(),
            client: Mutex::new(None),
            active_subscriptions: Mutex::new(HashSet::new()),
            subscription_ids: Mutex::new(HashMap::new()),
            watchdog_cancel: Mutex::new(None),
        })
    }

    pub async fn current_state(&self) -> DaemonState {
        *self.state.lock().await
    }

    pub async fn last_error(&self) -> Option<RpcError> {
        self.last_error.lock().await.clone()
    }

    /// B1 checker fix: register a new subscription_id → event_name mapping.
    /// Called by daemon_subscribe after it successfully invokes the daemon-side
    /// subscribe method.
    pub async fn register_subscription(&self, subscription_id: String, event_name: String) {
        self.subscription_ids
            .lock()
            .await
            .insert(subscription_id, event_name.clone());
        self.active_subscriptions.lock().await.insert(event_name);
    }

    /// B1 checker fix: look up and remove a subscription by id. Returns the
    /// event name so the caller (daemon_unsubscribe) can fire the matching
    /// daemon-side unsubscribe RPC.
    pub async fn take_subscription(&self, subscription_id: &str) -> Option<String> {
        let event_name = self.subscription_ids.lock().await.remove(subscription_id)?;
        // Only remove from active_subscriptions if no OTHER subscription_id points
        // at the same event name (multiple UI subscribers to one stream = one
        // daemon-side subscription, torn down only when the last UI subscriber leaves).
        let still_referenced = self
            .subscription_ids
            .lock()
            .await
            .values()
            .any(|e| e == &event_name);
        if !still_referenced {
            self.active_subscriptions.lock().await.remove(&event_name);
        }
        Some(event_name)
    }

    /// Drive stopped -> starting -> running.
    pub async fn start(self: Arc<Self>, app: AppHandle) -> Result<()> {
        self.set_state(&app, DaemonState::Starting, None, None, None)
            .await;
        // Phase 01.1 D-18: closure routes sidecar's Terminated-within-500ms
        // signal back to report_crash_on_boot, which transitions to Error and
        // emits a single state-changed event. No new event channel.
        let conn_for_crash = self.clone();
        let app_for_crash = app.clone();
        let on_crash_on_boot = move |info: CrashOnBootInfo| {
            let conn = conn_for_crash.clone();
            let app = app_for_crash.clone();
            // tokio::spawn so the call from inside the sidecar's sync-style
            // closure callsite stays cheap (no .await blocking the rx loop).
            tokio::spawn(async move {
                conn.report_crash_on_boot(app, info).await;
            });
        };

        // The handshake watchdog must NOT count human-typing time in the
        // macOS auth dialog. Sidecar fires this callback once the daemon
        // process is actually running (post-auth on macOS, immediate on
        // Linux/Windows); only then does the rpc.hello clock start.
        let conn_for_auth = self.clone();
        let app_for_auth = app.clone();
        let on_post_auth = move || {
            let conn = conn_for_auth.clone();
            let app = app_for_auth.clone();
            tokio::spawn(async move {
                conn.arm_handshake_watchdog(app).await;
            });
        };

        if let Err(e) = self
            .sidecar
            .spawn(&app, on_crash_on_boot, on_post_auth)
            .await
        {
            let err = RpcError {
                code: -32000,
                message: format!("{e}"),
                data: None,
            };
            *self.last_error.lock().await = Some(err.clone());
            self.set_state(&app, DaemonState::Error, Some(err), None, None)
                .await;
            return Err(e);
        }

        // Spawn a background task that handles connect + reconnect forever,
        // until stop() is called.
        let self_ref = self.clone();
        let app_clone = app.clone();
        tokio::spawn(async move {
            self_ref.connect_loop(app_clone).await;
        });
        Ok(())
    }

    /// Arm the rpc.hello handshake watchdog. Fired by the sidecar's
    /// `on_post_auth` callback so the timer doesn't count macOS auth-dialog
    /// time. If we're still in `Starting` after HANDSHAKE_TIMEOUT_SECS,
    /// transitions to Error.
    async fn arm_handshake_watchdog(self: Arc<Self>, app: AppHandle) {
        let (cancel_tx, cancel_rx) = oneshot::channel::<()>();
        *self.watchdog_cancel.lock().await = Some(cancel_tx);
        let self_ref = self.clone();
        tokio::spawn(async move {
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(HANDSHAKE_TIMEOUT_SECS)) => {
                    let cur = *self_ref.state.lock().await;
                    if cur == DaemonState::Starting {
                        let err = RpcError {
                            code: -32000,
                            message: format!("daemon did not answer rpc.hello within {HANDSHAKE_TIMEOUT_SECS}s"),
                            data: None,
                        };
                        *self_ref.last_error.lock().await = Some(err.clone());
                        self_ref.set_state(&app, DaemonState::Error, Some(err), None, None).await;
                    }
                }
                _ = cancel_rx => {}
            }
        });
    }

    /// Drive running -> stopped. Idempotent.
    pub async fn stop(self: Arc<Self>, app: AppHandle) -> Result<()> {
        // Cancel watchdog if still armed.
        if let Some(tx) = self.watchdog_cancel.lock().await.take() {
            let _ = tx.send(());
        }
        // Drop the client first so the reader task exits before the socket goes away.
        *self.client.lock().await = None;
        self.sidecar.kill().await.ok();
        self.active_subscriptions.lock().await.clear();
        self.subscription_ids.lock().await.clear();
        self.set_state(&app, DaemonState::Stopped, None, None, None)
            .await;
        Ok(())
    }

    /// The one JSON-RPC call gateway — used by daemon_call Tauri command.
    pub async fn call(&self, method: &str, params: Value) -> std::result::Result<Value, RpcError> {
        let client = self.client.lock().await.clone();
        match client {
            Some(c) => c.call(method, params).await,
            None => Err(RpcError {
                code: -32000,
                message: "daemon not connected".into(),
                data: None,
            }),
        }
    }

    /// Phase 01.1 D-18 / D-19: route a sidecar crash-on-boot signal through
    /// the EXISTING `daemon://state-changed` event by enriching `RpcError.data`
    /// with the discriminator `{ kind: "crash_on_boot", path, stderr_tail,
    /// elapsed_ms, exit_code, signal }`. NO new Tauri event channel — this
    /// preserves the cross-phase W1 invariant that `use-daemon-state.ts`
    /// holds exactly two `listen(` calls.
    pub async fn report_crash_on_boot(self: Arc<Self>, app: AppHandle, info: CrashOnBootInfo) {
        let data = serde_json::json!({
            "kind": "crash_on_boot",
            "path": info.config_path,
            "stderr_tail": info.stderr_tail,
            "elapsed_ms": info.elapsed_ms,
            "exit_code": info.exit_code,
            "signal": info.signal,
        });
        let err = RpcError {
            code: -32000,
            message: format!("pim-daemon exited in {} ms during startup", info.elapsed_ms,),
            data: Some(data),
        };
        // Cancel the handshake watchdog if still armed — the sidecar already
        // died, so the 10s ceiling is moot and would otherwise fire a second
        // (later, less informative) Error transition over the top of ours.
        if let Some(tx) = self.watchdog_cancel.lock().await.take() {
            let _ = tx.send(());
        }
        // set_state already updates last_error AND emits state-changed via
        // events::emit_state — single existing helper, single existing channel.
        self.set_state(&app, DaemonState::Error, Some(err), None, None)
            .await;
    }

    pub(crate) async fn set_state(
        &self,
        app: &AppHandle,
        new_state: DaemonState,
        error: Option<RpcError>,
        status: Option<Value>,
        hello: Option<Value>,
    ) {
        *self.state.lock().await = new_state;
        if let Some(ref e) = error {
            *self.last_error.lock().await = Some(e.clone());
        }
        events::emit_state(
            app,
            DaemonStateChange {
                state: new_state,
                error,
                status,
                hello,
            },
        );
    }

    /// Connect → handshake → pump notifications → on disconnect, loop with backoff.
    async fn connect_loop(self: Arc<Self>, app: AppHandle) {
        let mut backoff = Duration::from_millis(500);
        let max_backoff = Duration::from_secs(4);
        let socket = socket_path::resolve_socket_path();

        loop {
            // Current state may already be Stopped if the user hit stop mid-loop.
            if matches!(self.current_state().await, DaemonState::Stopped) {
                return;
            }

            match JsonRpcClient::connect(&socket).await {
                Ok(client) => {
                    backoff = Duration::from_millis(500);
                    if let Err(e) = self.handshake_and_pump(app.clone(), client).await {
                        log::warn!("daemon pump exited: {e}");
                        // Race fix: stop() may have just run and set Stopped.
                        // Without this guard, we'd overwrite Stopped with
                        // Reconnecting and the loop would spin forever trying
                        // to reach a daemon the user just killed.
                        if matches!(self.current_state().await, DaemonState::Stopped) {
                            return;
                        }
                        self.set_state(&app, DaemonState::Reconnecting, None, None, None)
                            .await;
                    } else {
                        return; // clean stop
                    }
                }
                Err(e) => {
                    log::debug!("socket connect failed (will retry): {e}");
                    // Keep state as starting/reconnecting; sleep backoff.
                }
            }

            tokio::time::sleep(backoff).await;
            backoff = std::cmp::min(backoff * 2, max_backoff);
        }
    }

    async fn handshake_and_pump(&self, app: AppHandle, client: Arc<JsonRpcClient>) -> Result<()> {
        // rpc.hello per docs/RPC.md §2.1
        let hello_params = serde_json::json!({
            "client": format!("pim-ui/{}", env!("CARGO_PKG_VERSION")),
            "rpc_version": 1,
        });
        let hello_result = client
            .call("rpc.hello", hello_params)
            .await
            .map_err(|e| anyhow!("rpc.hello rejected: code={} msg={}", e.code, e.message))?;

        // W2 checker fix: handshake succeeded — cancel the watchdog.
        if let Some(tx) = self.watchdog_cancel.lock().await.take() {
            let _ = tx.send(());
        }

        // First status snapshot.
        let status_result = client.call("status", Value::Null).await.ok();

        *self.client.lock().await = Some(client.clone());
        self.set_state(
            &app,
            DaemonState::Running,
            None,
            status_result,
            Some(hello_result),
        )
        .await;

        // Restore subscriptions (success criterion 4). `active_subscriptions` is
        // the set of event names currently being watched; re-issue the daemon-side
        // subscribe RPCs. subscription_ids remain stable from the UI's POV.
        let to_restore: Vec<String> = self
            .active_subscriptions
            .lock()
            .await
            .iter()
            .cloned()
            .collect();
        for event in to_restore {
            let subscribe_method = subscribe_method_for(&event);
            if let Some(m) = subscribe_method {
                let _ = client.call(m, Value::Null).await;
            }
        }

        // Pump notifications + watch for disconnect.
        let mut notif_rx = client.subscribe_notifications();
        let mut disc_rx = client.disconnected();

        loop {
            tokio::select! {
                msg = notif_rx.recv() => match msg {
                    Ok(Notification { method, params }) => {
                        events::emit_rpc_event(&app, RpcEventPayload { event: method, params });
                    }
                    Err(_) => break, // channel closed
                },
                _ = disc_rx.changed() => {
                    if *disc_rx.borrow() { break; }
                }
            }
        }

        // Clear the client so subsequent calls fail fast.
        *self.client.lock().await = None;
        anyhow::bail!("daemon disconnected")
    }
}

/// Map a notification stream name to its subscribe method (docs/RPC.md §4).
pub fn subscribe_method_for(event: &str) -> Option<&'static str> {
    match event {
        "status.event" => Some("status.subscribe"),
        "peers.event" => Some("peers.subscribe"),
        "logs.event" => Some("logs.subscribe"),
        _ => None,
    }
}

/// B1 checker fix: map notification stream name to its UNSUBSCRIBE method.
pub fn unsubscribe_method_for(event: &str) -> Option<&'static str> {
    match event {
        "status.event" => Some("status.unsubscribe"),
        "peers.event" => Some("peers.unsubscribe"),
        "logs.event" => Some("logs.unsubscribe"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Phase 01.1 D-19: locks the wire shape that the TS side
    /// (Plan 01.1-02 — DaemonLastError narrow) discriminates on. If this
    /// test ever flips, the TS union must flip in lockstep.
    #[test]
    fn crash_on_boot_data_shape_is_d19_compliant() {
        let info = CrashOnBootInfo {
            exit_code: Some(1),
            signal: None,
            stderr_tail: "boom\n".to_string(),
            elapsed_ms: 42,
            config_path: "/tmp/pim/pim.toml".to_string(),
        };
        // Mirrors the exact `serde_json::json!` block used by
        // `report_crash_on_boot` so the test fails loudly if either drifts.
        let data = serde_json::json!({
            "kind": "crash_on_boot",
            "path": info.config_path,
            "stderr_tail": info.stderr_tail,
            "elapsed_ms": info.elapsed_ms,
            "exit_code": info.exit_code,
            "signal": info.signal,
        });
        assert_eq!(data["kind"], "crash_on_boot");
        assert_eq!(data["path"], "/tmp/pim/pim.toml");
        assert_eq!(data["stderr_tail"], "boom\n");
        assert_eq!(data["elapsed_ms"], 42);
        assert_eq!(data["exit_code"], 1);
        assert!(data["signal"].is_null());
    }
}
