//! Tauri shell entrypoint.

mod daemon;
mod rpc;
mod tray;

use std::sync::Arc;
use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tauri::{Listener, Manager, RunEvent, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        // Plan 05-01: register notification + positioner plugins.
        // Tray construction code is added by Plan 05-04 in the .setup() hook.
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_positioner::init())
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
        .setup(|app| {
            tracing::info!(
                "pim-ui starting — daemon not yet spawned (awaiting daemon_start from UI)"
            );

            // Plan 05-04: tray + popover construction is desktop-only —
            // mobile builds (iOS/Android) skip the entire block.
            #[cfg(desktop)]
            {
                let app_handle = app.handle().clone();

                // Build the popover window UPFRONT (D-17 / RESEARCH §6c —
                // cheap, preserves React state across opens, hidden until
                // tray-click on macOS / Windows).
                tray::build_popover_window(&app_handle)?;

                // Build the native menu (D-17 / D-20). Linux uses this
                // exclusively (right-click), Windows shows it on right-click,
                // macOS shows it on right-click as a fallback to the popover.
                let menu = tray::build_native_menu(&app_handle)?;

                // Tray icon: load the brand-glyph asset from icons/tray.png
                // (D-22 + Plan 05-04 W2 fix). Falls back to the default
                // window icon ONLY if the resource is missing — log loudly
                // so a dev catches the gap.
                let tray_icon_path = app
                    .path()
                    .resource_dir()
                    .ok()
                    .map(|d| d.join("icons/tray.png"));
                let tray_icon: Image<'_> = match tray_icon_path
                    .as_ref()
                    .and_then(|p| Image::from_path(p).ok())
                {
                    Some(img) => img,
                    None => {
                        tracing::warn!(
                            "tray: icons/tray.png not found in resource_dir; falling back to default_window_icon (D-22 brand asset missing — Image::from_path on icons/tray.png returned None)"
                        );
                        match app.default_window_icon() {
                            Some(icon) => icon.clone(),
                            None => {
                                return Err(
                                    "tray: no tray icon AND no default window icon available"
                                        .into(),
                                );
                            }
                        }
                    }
                };

                let _tray = TrayIconBuilder::new()
                    .icon(tray_icon)
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_tray_icon_event(|tray, event| {
                        tray::on_tray_icon_event_handler(tray, &event);
                    })
                    .on_menu_event(|app, event| {
                        tray::on_menu_event_handler(app, &event);
                    })
                    .build(app)?;

                // pim://quit — emitted by the tray popover's Quit pim button
                // (Plan 05-04 Task 2 popover-actions.tsx). Routes the quit
                // request through a single Rust source of truth so the
                // popover doesn't need a JS exit API. Joins pim://open-add-peer
                // as the popover's documented W1 cross-window IPC exceptions.
                let app_handle_for_quit = app.handle().clone();
                app.listen("pim://quit", move |_event| {
                    app_handle_for_quit.exit(0);
                });
            }

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
