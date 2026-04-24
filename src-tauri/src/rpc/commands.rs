//! Tauri command handlers for the daemon bridge.
//! Names: daemon_call, daemon_subscribe, daemon_unsubscribe,
//!         daemon_start, daemon_stop, daemon_last_error.
//!
//! See src/lib/rpc.ts `DaemonCommands` — strings are the contract.
//!
//! B1 checker fix: daemon_unsubscribe accepts subscription_id (not event name)
//! to match the frontend's { subscriptionId: string } call shape. Tauri's
//! invoke bridge serde-maps camelCase -> snake_case automatically.

use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::daemon::jsonrpc::RpcError;
use crate::daemon::state::{subscribe_method_for, unsubscribe_method_for, DaemonConnection};

/// Generic JSON-RPC request/response — used by frontend callDaemon().
#[tauri::command]
pub async fn daemon_call(
    method: String,
    params: Option<Value>,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<Value, RpcError> {
    conn.call(&method, params.unwrap_or(Value::Null)).await
}

/// Starts forwarding one of the three notification streams.
/// Returns a subscription_id the frontend later passes back to daemon_unsubscribe.
/// B1: the returned subscription_id is a uuid; we record (subscription_id ->
/// event_name) in DaemonConnection so daemon_unsubscribe can look it up.
#[tauri::command]
pub async fn daemon_subscribe(
    event: String,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<String, RpcError> {
    let subscribe_method = match subscribe_method_for(&event) {
        Some(m) => m,
        None => {
            return Err(RpcError {
                code: -32602,
                message: format!("unknown event stream '{event}'"),
                data: None,
            });
        }
    };
    conn.call(subscribe_method, Value::Null).await?;
    let subscription_id = Uuid::new_v4().to_string();
    conn.register_subscription(subscription_id.clone(), event)
        .await;
    Ok(subscription_id)
}

/// B1 checker fix: accepts subscription_id (NOT event name). The serde
/// attribute maps JS camelCase `subscriptionId` to Rust snake_case automatically
/// via tauri's invoke convention; the `subscription_id` parameter name here
/// corresponds to the `subscriptionId` key sent by the frontend's
/// invoke(CMD.unsubscribe, { subscriptionId }).
#[tauri::command]
pub async fn daemon_unsubscribe(
    subscription_id: String,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<(), RpcError> {
    // Look up the event name this subscription_id was bound to.
    let Some(event) = conn.take_subscription(&subscription_id).await else {
        // Silently succeed on unknown id — the UI may over-eagerly unsubscribe
        // on unmount after a reconnect cleared state. NotSubscribed (-32051) is
        // the daemon-side code; here we swallow so the UI doesn't see an error
        // on a benign race.
        return Ok(());
    };
    let unsub_method = match unsubscribe_method_for(&event) {
        Some(m) => m,
        None => return Ok(()),
    };
    // Only fire the daemon-side unsubscribe if this was the LAST UI subscriber
    // for the stream. `take_subscription` already removed it from
    // active_subscriptions if so — we call unconditionally here because the
    // daemon-side is idempotent per docs/RPC.md §4 (at worst returns -32051
    // NotSubscribed, which we ignore).
    let _ = conn.call(unsub_method, Value::Null).await;
    Ok(())
}

#[tauri::command]
pub async fn daemon_start(
    app: AppHandle,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<(), String> {
    let conn = conn.inner().clone();
    conn.start(app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn daemon_stop(
    app: AppHandle,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<(), String> {
    let conn = conn.inner().clone();
    conn.stop(app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn daemon_last_error(
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<Option<RpcError>, String> {
    Ok(conn.last_error().await)
}
