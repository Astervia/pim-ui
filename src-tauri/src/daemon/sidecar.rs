//! Spawns pim-daemon as a Tauri externalBin sidecar and forwards its
//! stdout/stderr to tracing. Kills the child on app exit to prevent orphans.
//!
//! IMPORTANT: wire WindowEvent::Destroyed -> Sidecar::kill in lib.rs.

use anyhow::{anyhow, Result};
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

pub struct Sidecar {
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl Sidecar {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    /// Spawn pim-daemon. Returns Ok(()) when the process is alive; caller
    /// must then connect to the socket separately (see DaemonConnection).
    pub async fn spawn(&self, app: &AppHandle) -> Result<()> {
        let sidecar = app
            .shell()
            .sidecar("pim-daemon")
            .map_err(|e| anyhow!("externalBin 'pim-daemon' not configured: {e}"))?;
        let (mut rx, child) = sidecar
            .spawn()
            .map_err(|e| anyhow!("spawn pim-daemon: {e}"))?;

        // Forward child output to tracing. This also keeps the receiver alive
        // so the child doesn't SIGPIPE on write when stdout buffer fills.
        tokio::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => tracing::info!(
                        target: "pim-daemon",
                        "{}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Stderr(bytes) => tracing::warn!(
                        target: "pim-daemon",
                        "{}",
                        String::from_utf8_lossy(&bytes).trim_end()
                    ),
                    CommandEvent::Error(e) => tracing::error!(target: "pim-daemon", "{e}"),
                    CommandEvent::Terminated(payload) => {
                        tracing::warn!(
                            target: "pim-daemon",
                            "terminated: code={:?} signal={:?}",
                            payload.code,
                            payload.signal
                        );
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

    pub async fn is_running(&self) -> bool {
        self.child.lock().await.is_some()
    }
}

impl Default for Sidecar {
    fn default() -> Self {
        Self::new()
    }
}
