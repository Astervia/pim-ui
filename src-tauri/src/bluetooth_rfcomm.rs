//! Bluetooth RFCOMM auto-discovery sidecar integration (Phase 7 spike).
//!
//! Spawns the `pim-bt-rfcomm-mac` Swift sidecar (built from
//! `tools/pim-bt-rfcomm-mac/`) on macOS, parses its newline-delimited
//! JSON event stream from stdout, and forwards every event to the UI on
//! the `bluetooth-rfcomm://event` Tauri channel.
//!
//! Why a separate process: a stuck IOBluetooth callback (Apple's API
//! is delegate-based and notoriously prone to NSException leaks across
//! threads) cannot freeze the mesh kernel. The sidecar owns its own
//! main runloop; if it crashes, the main app keeps running and we emit
//! a `sidecar_terminated` event so the UI can react.
//!
//! Lifecycle: started in `lib.rs::run` setup hook on macOS; shut down
//! when the user invokes the `bluetooth_rfcomm_stop` Tauri command or
//! when the app exits (Drop on `BluetoothRfcommState` triggers kill).
//!
//! Wire format from sidecar stdout — one JSON object per line, e.g.:
//!   {"event":"boot",...}
//!   {"event":"listening",...}
//!   {"event":"scan_attempt","bd_addr":"...","name":"...","channel":N}
//!   {"event":"inbound","bd_addr":"..."}
//!   {"event":"discovered","peer":{...}}
//!   {"event":"lost","peer":{...},"reason":"..."}
//!   {"event":"open_failed","bd_addr":"...","name":"...","reason":"..."}
//!   {"event":"peer_error","bd_addr":"...","detail":{...}}

#![cfg(target_os = "macos")]

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

/// Tauri event name carrying every line emitted by the sidecar.
pub const EVENT_CHANNEL: &str = "bluetooth-rfcomm://event";

/// Default RFCOMM channel matches the spike protocol (`spikes/bt-rfcomm/PROTOCOL.md`).
const DEFAULT_RFCOMM_CHANNEL: u8 = 22;
/// Default name prefix the sidecar filters on for the paired-device scan.
const DEFAULT_PREFIX: &str = "PIM-";
/// Default poll interval for the outbound discovery loop, in seconds.
const DEFAULT_POLL_SECS: u32 = 30;

/// Holds the running child handle so we can kill on drop / app exit.
#[derive(Default)]
pub struct BluetoothRfcommState {
    inner: Arc<Mutex<Option<CommandChild>>>,
}

impl BluetoothRfcommState {
    pub fn new() -> Self {
        Self::default()
    }

    /// Mark a freshly-spawned child as the live one. Replaces any prior.
    async fn install(&self, child: CommandChild) {
        let mut guard = self.inner.lock().await;
        if let Some(prev) = guard.take() {
            // Best-effort kill of the previous child; we don't await
            // termination to keep startup snappy.
            let _ = prev.kill();
        }
        *guard = Some(child);
    }

    /// Kill the running sidecar if any. Idempotent.
    pub async fn shutdown(&self) {
        let mut guard = self.inner.lock().await;
        if let Some(child) = guard.take() {
            let _ = child.kill();
        }
    }
}

/// Snapshot of the discovery configuration the sidecar is launched with.
/// Persisted-config integration is a follow-up; for now we use defaults.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BluetoothRfcommConfig {
    pub local_name: String,
    pub prefix: String,
    pub channel: u8,
    pub poll_secs: u32,
    /// Optional hex-encoded 32-byte node id. None → sidecar generates a
    /// random one (fine for the discovery-only smoke test).
    pub node_id_hex: Option<String>,
}

impl Default for BluetoothRfcommConfig {
    fn default() -> Self {
        Self {
            local_name: format!("PIM-{}", local_hostname_safe()),
            prefix: DEFAULT_PREFIX.to_string(),
            channel: DEFAULT_RFCOMM_CHANNEL,
            poll_secs: DEFAULT_POLL_SECS,
            node_id_hex: None,
        }
    }
}

/// Read the host's short name without pulling in the `hostname` crate.
/// Output is restricted to `[A-Za-z0-9_-]` so the BlueZ peer-side prefix
/// filter (`PIM-*`) keeps matching.
fn local_hostname_safe() -> String {
    let raw = std::env::var("HOST")
        .or_else(|_| std::env::var("HOSTNAME"))
        .ok()
        .or_else(read_hostname_via_uname)
        .unwrap_or_else(|| "mac".to_string());
    let trimmed = raw.split('.').next().unwrap_or(&raw);
    let safe: String = trimmed
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    if safe.is_empty() {
        "mac".to_string()
    } else {
        safe
    }
}

#[cfg(unix)]
fn read_hostname_via_uname() -> Option<String> {
    let mut buf = [0u8; 256];
    // SAFETY: gethostname(3) writes at most `buf.len()` bytes including
    // the trailing NUL; we then locate the NUL and decode as UTF-8.
    let rc = unsafe { libc::gethostname(buf.as_mut_ptr() as *mut _, buf.len()) };
    if rc != 0 {
        return None;
    }
    let nul = buf.iter().position(|b| *b == 0).unwrap_or(buf.len());
    String::from_utf8(buf[..nul].to_vec()).ok()
}

#[cfg(not(unix))]
fn read_hostname_via_uname() -> Option<String> {
    None
}

/// Spawn the `pim-bt-rfcomm-mac` sidecar and forward its stdout JSON
/// lines to the UI as Tauri events on `EVENT_CHANNEL`.
pub async fn start(app: &AppHandle, cfg: BluetoothRfcommConfig) -> Result<()> {
    let mut command = app
        .shell()
        .sidecar("pim-bt-rfcomm-mac")
        .map_err(|e| anyhow!("externalBin 'pim-bt-rfcomm-mac' not configured: {e}"))?;
    command = command.args([
        format!("--name={}", cfg.local_name),
        format!("--prefix={}", cfg.prefix),
        format!("--channel={}", cfg.channel),
        format!("--poll={}", cfg.poll_secs),
    ]);
    if let Some(hex) = cfg.node_id_hex.as_deref() {
        command = command.args([format!("--node-id={hex}")]);
    }

    let (mut rx, child) = command
        .spawn()
        .map_err(|e| anyhow!("spawn pim-bt-rfcomm-mac: {e}"))?;

    let state: tauri::State<'_, BluetoothRfcommState> = app.state();
    state.install(child).await;

    let app_handle = app.clone();
    tokio::spawn(async move {
        // Buffer partial stdout lines so we deliver only complete JSON
        // objects to the UI. Sidecar always terminates frames with `\n`.
        let mut stdout_buf = String::new();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let chunk = String::from_utf8_lossy(&bytes);
                    stdout_buf.push_str(&chunk);
                    while let Some(idx) = stdout_buf.find('\n') {
                        let line: String = stdout_buf.drain(..=idx).collect();
                        let trimmed = line.trim();
                        if trimmed.is_empty() {
                            continue;
                        }
                        forward_event(&app_handle, trimmed);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    log::warn!(
                        target: "pim-bt-rfcomm-mac",
                        "{}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    );
                }
                CommandEvent::Error(e) => {
                    log::error!(target: "pim-bt-rfcomm-mac", "{e}");
                }
                CommandEvent::Terminated(payload) => {
                    log::warn!(
                        target: "pim-bt-rfcomm-mac",
                        "terminated: code={:?} signal={:?}",
                        payload.code,
                        payload.signal,
                    );
                    let payload = serde_json::json!({
                        "event": "sidecar_terminated",
                        "code": payload.code,
                        "signal": payload.signal,
                    });
                    let _ = app_handle.emit(EVENT_CHANNEL, payload);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// Parse a stdout JSON line and re-emit on the Tauri event bus.
/// Malformed lines are logged at warn but otherwise ignored — the
/// sidecar is allowed to evolve its event vocabulary without breaking
/// the UI.
fn forward_event(app: &AppHandle, line: &str) {
    match serde_json::from_str::<Value>(line) {
        Ok(value) => {
            log::debug!(target: "pim-bt-rfcomm-mac", "{}", value);
            if let Err(e) = app.emit(EVENT_CHANNEL, &value) {
                log::error!(
                    target: "pim-bt-rfcomm-mac",
                    "failed to emit event: {e}"
                );
            }
        }
        Err(e) => {
            log::warn!(
                target: "pim-bt-rfcomm-mac",
                "non-JSON stdout: {} ({})",
                line,
                e
            );
        }
    }
}

/// Tauri command — invoked by the UI to start the sidecar lazily.
/// Idempotent: a second call kills the previous child first.
#[tauri::command]
pub async fn bluetooth_rfcomm_start(app: AppHandle) -> std::result::Result<(), String> {
    start(&app, BluetoothRfcommConfig::default())
        .await
        .map_err(|e| e.to_string())
}

/// Tauri command — invoked by the UI to stop the sidecar.
#[tauri::command]
pub async fn bluetooth_rfcomm_stop(app: AppHandle) -> std::result::Result<(), String> {
    let state: tauri::State<'_, BluetoothRfcommState> = app.state();
    state.shutdown().await;
    Ok(())
}
