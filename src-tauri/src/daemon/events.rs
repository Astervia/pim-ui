//! Tauri event names + emitters that the React side subscribes to.
//! Mirror src/lib/rpc.ts `DaemonEvents` — strings are the contract.

use crate::daemon::jsonrpc::RpcError;
use crate::daemon::state::DaemonState;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const EVT_STATE_CHANGED: &str = "daemon://state-changed";
pub const EVT_RPC_EVENT: &str = "daemon://rpc-event";

/// Matches frontend DaemonStateChange from src/lib/daemon-state.ts.
#[derive(Debug, Clone, Serialize)]
pub struct DaemonStateChange {
    pub state: DaemonState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<RpcError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hello: Option<serde_json::Value>,
}

/// Matches frontend `{ event, params }` payload on EVT_RPC_EVENT.
#[derive(Debug, Clone, Serialize)]
pub struct RpcEventPayload {
    pub event: String,
    pub params: serde_json::Value,
}

pub fn emit_state(app: &AppHandle, change: DaemonStateChange) {
    if let Err(e) = app.emit(EVT_STATE_CHANGED, &change) {
        log::warn!("emit state-changed: {e}");
    }
}

pub fn emit_rpc_event(app: &AppHandle, payload: RpcEventPayload) {
    if let Err(e) = app.emit(EVT_RPC_EVENT, &payload) {
        log::warn!("emit rpc-event: {e}");
    }
}
