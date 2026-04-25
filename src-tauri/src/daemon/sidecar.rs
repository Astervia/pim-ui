//! Spawns pim-daemon as a Tauri externalBin sidecar and forwards its
//! stdout/stderr to tracing. Kills the child on app exit to prevent orphans.
//!
//! IMPORTANT: wire WindowEvent::Destroyed -> Sidecar::kill in lib.rs.
//!
//! Phase 01.1 D-18: extended with `spawned_at` capture + a 500 ms
//! crash-on-boot threshold. When `CommandEvent::Terminated` arrives within
//! 500 ms of spawn, the supplied `on_crash_on_boot` closure is invoked with
//! a `CrashOnBootInfo` so the caller (DaemonConnection) can transition to
//! `Error` via the EXISTING `daemon://state-changed` event. NO new Tauri
//! event channel is introduced — preserves the W1 single-listener contract.

use anyhow::{anyhow, Result};
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

use crate::daemon::config_path::resolve_config_path;
use crate::daemon::state::CrashOnBootInfo;

/// Phase 01.1 D-18 crash-on-boot threshold.
const CRASH_ON_BOOT_THRESHOLD_MS: u64 = 500;
/// Phase 01.1 D-19: ring-cap the captured stderr tail to keep the payload
/// small (the UI surfaces the first line; we keep the whole 2 KiB for logs).
const STDERR_TAIL_BYTES: usize = 2048;

pub struct Sidecar {
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl Sidecar {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    /// Spawn pim-daemon. Returns Ok(()) the moment the child PROCESS is
    /// spawned (Phase 2 Plan 02-01 contract). The crash-on-boot detection
    /// runs in the inner tokio task; the outer return type is unchanged.
    ///
    /// `on_crash_on_boot` fires at most once per spawn, only when
    /// `CommandEvent::Terminated` arrives within 500 ms.
    pub async fn spawn<F>(&self, app: &AppHandle, on_crash_on_boot: F) -> Result<()>
    where
        F: Fn(CrashOnBootInfo) + Send + Sync + Clone + 'static,
    {
        let sidecar = app
            .shell()
            .sidecar("pim-daemon")
            .map_err(|e| anyhow!("externalBin 'pim-daemon' not configured: {e}"))?;
        let (mut rx, child) = sidecar
            .spawn()
            .map_err(|e| anyhow!("spawn pim-daemon: {e}"))?;

        // D-18: clock starts when the child PROCESS is alive.
        let spawned_at = std::time::Instant::now();

        // Forward child output to tracing. This also keeps the receiver alive
        // so the child doesn't SIGPIPE on write when stdout buffer fills.
        tokio::spawn(async move {
            // D-19: 2 KiB ring buffer — last bytes win, no allocation churn.
            let mut stderr_buf: Vec<u8> = Vec::with_capacity(STDERR_TAIL_BYTES);

            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => tracing::info!(
                        target: "pim-daemon",
                        "{}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Stderr(bytes) => {
                        tracing::warn!(
                            target: "pim-daemon",
                            "{}",
                            String::from_utf8_lossy(&bytes).trim_end()
                        );
                        // D-19: append + ring-cap to STDERR_TAIL_BYTES.
                        stderr_buf.extend_from_slice(&bytes);
                        if stderr_buf.len() > STDERR_TAIL_BYTES {
                            let drop = stderr_buf.len() - STDERR_TAIL_BYTES;
                            stderr_buf.drain(0..drop);
                        }
                    }
                    CommandEvent::Error(e) => tracing::error!(target: "pim-daemon", "{e}"),
                    CommandEvent::Terminated(payload) => {
                        let elapsed_ms = spawned_at.elapsed().as_millis() as u64;
                        tracing::warn!(
                            target: "pim-daemon",
                            "terminated: code={:?} signal={:?} elapsed_ms={}",
                            payload.code,
                            payload.signal,
                            elapsed_ms,
                        );
                        // D-18: < 500 ms — surface as crash-on-boot. >= 500 ms
                        // keeps existing trace-warn-only behavior so Phase 1
                        // success criterion 4 (graceful disconnect) holds.
                        if elapsed_ms < CRASH_ON_BOOT_THRESHOLD_MS {
                            let stderr_tail =
                                String::from_utf8_lossy(&stderr_buf).to_string();
                            let config_path =
                                resolve_config_path().to_string_lossy().to_string();
                            (on_crash_on_boot.clone())(CrashOnBootInfo {
                                exit_code: payload.code,
                                signal: payload.signal,
                                stderr_tail,
                                elapsed_ms,
                                config_path,
                            });
                        }
                        break;
                    }
                    _ => {}
                }
            }
        });

        *self.child.lock().await = Some(child);
        Ok(())
    }

    /// SIGTERM the child and wait briefly for graceful exit.
    pub async fn kill(&self) -> Result<()> {
        if let Some(child) = self.child.lock().await.take() {
            child.kill().map_err(|e| anyhow!("kill pim-daemon: {e}"))?;
        }
        Ok(())
    }

}

impl Default for Sidecar {
    fn default() -> Self {
        Self::new()
    }
}
