//! Tauri shell entrypoint.

mod daemon;
mod rpc;

use std::sync::Arc;
use tauri::{Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .manage(daemon::DaemonConnection::new())
        .invoke_handler(tauri::generate_handler![
            rpc::commands::daemon_call,
            rpc::commands::daemon_subscribe,
            rpc::commands::daemon_unsubscribe,
            rpc::commands::daemon_start,
            rpc::commands::daemon_stop,
            rpc::commands::daemon_last_error,
            // Phase 01.1: first-run config bootstrap.
            rpc::commands::bootstrap_config,
            rpc::commands::config_exists,
        ])
        .setup(|_app| {
            tracing::info!("pim-ui starting — daemon not yet spawned (awaiting daemon_start from UI)");
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            // Success criterion 2 / DAEMON-05: kill sidecar on window destroy
            // so there's no orphan daemon hanging around after the UI closes.
            RunEvent::WindowEvent {
                event: WindowEvent::Destroyed,
                ..
            } => {
                let conn = app
                    .state::<Arc<daemon::DaemonConnection>>()
                    .inner()
                    .clone();
                let app_handle = app.clone();
                tauri::async_runtime::block_on(async move {
                    let _ = conn.stop(app_handle).await;
                });
            }
            RunEvent::ExitRequested { .. } => {
                let conn = app
                    .state::<Arc<daemon::DaemonConnection>>()
                    .inner()
                    .clone();
                let app_handle = app.clone();
                tauri::async_runtime::block_on(async move {
                    let _ = conn.stop(app_handle).await;
                });
            }
            _ => {}
        });
}
