//! Tauri shell entrypoint.

#[cfg(target_os = "macos")]
mod bluetooth_rfcomm;
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
        // Native save/open dialogs — used by Logs tab to let the user
        // pick where the debug snapshot is exported.
        .plugin(tauri_plugin_dialog::init())
        .manage(daemon::DaemonConnection::new())
        .invoke_handler(tauri::generate_handler![
            rpc::commands::daemon_call,
            rpc::commands::daemon_subscribe,
            rpc::commands::daemon_unsubscribe,
            rpc::commands::daemon_start,
            rpc::commands::daemon_stop,
            rpc::commands::daemon_attach_if_running,
            rpc::commands::daemon_last_error,
            // Phase 01.1: first-run config bootstrap.
            rpc::commands::bootstrap_config,
            rpc::commands::config_exists,
            // Logs tab debug-snapshot export — write the JSON to the
            // path the user picked in the save dialog, then reveal it
            // in the OS file manager on confirmation.
            rpc::commands::save_text_file,
            rpc::commands::reveal_in_file_manager,
            // Settings tab — read pim.toml from disk when the daemon
            // is stopped so the form can populate without a live RPC.
            rpc::commands::read_pim_config_text,
            // Settings tab — atomically write pim.toml when the daemon
            // is stopped. Validates against pim_core schema first so a
            // bad file never lands; mirrors bootstrap_config's atomic
            // write strategy.
            rpc::commands::write_pim_config_text,
            // Settings tab — schema-validate edited TOML against
            // `pim_core::Config` before the user triggers a save.
            // Surfaces type/structure errors inline; daemon REJECT
            // remains the source of truth for save outcomes.
            rpc::commands::config_validate,
            // Phase 6 Plan 06-03: BT NAP-server preflight (Linux-only,
            // honest unsupported answer on macOS/Windows).
            rpc::bt_nap::bt_nap_preflight,
            // Phase 7 spike: Mac-side BT RFCOMM auto-discovery.
            // Spawns the `pim-bt-rfcomm-mac` Swift sidecar which
            // discovers paired `PIM-*` devices over Bluetooth Classic
            // RFCOMM, exchanges a Hello/HelloAck handshake, and emits
            // `discovered`/`lost` events on `bluetooth-rfcomm://event`.
            #[cfg(target_os = "macos")]
            bluetooth_rfcomm::bluetooth_rfcomm_start,
            #[cfg(target_os = "macos")]
            bluetooth_rfcomm::bluetooth_rfcomm_stop,
            #[cfg(target_os = "macos")]
            bluetooth_rfcomm::bluetooth_rfcomm_snapshot,
        ])
        .setup(|app| {
            log::info!(
                "pim-ui starting — daemon not yet spawned (awaiting daemon_start from UI)"
            );

            // Phase 7 spike: register BT RFCOMM state and auto-spawn the
            // Swift sidecar so the Peers panel can show paired BT devices
            // without the user clicking anything. macOS-only because
            // IOBluetooth is the only public Classic-BT API on Mac and
            // there is no Linux/Windows binary in this iteration.
            #[cfg(target_os = "macos")]
            {
                use bluetooth_rfcomm::{
                    start as start_bt_rfcomm, BluetoothRfcommConfig,
                    BluetoothRfcommState,
                };
                app.manage(BluetoothRfcommState::new());
                let app_handle_for_bt = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(e) = start_bt_rfcomm(
                        &app_handle_for_bt,
                        BluetoothRfcommConfig::default(),
                    )
                    .await
                    {
                        log::warn!(
                            target: "pim-bt-rfcomm-mac",
                            "auto-spawn failed: {e}"
                        );
                    }
                });
            }

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
                        log::warn!(
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
            // Closing the main window translates to "quit the app" — this
            // is a single-window utility, not a full tray-only background
            // app, so X / Cmd+W should terminate the cargo run process
            // cleanly. We only react to the MAIN window's destroy; the
            // tray popover destroying itself (e.g. during teardown) must
            // NOT trigger app exit.
            //
            // We dispatch through `app.exit(0)` rather than running
            // `conn.stop()` here directly so all shutdown logic lives in
            // ONE place — `RunEvent::ExitRequested` below.
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::Destroyed,
                ..
            } if label == "main" => {
                app.exit(0);
            }
            // Single source of truth for shutdown. Reaches here from
            // (a) `app.exit(0)` above, (b) Cmd+Q via the OS menu, and
            // (c) the tray popover's "Quit pim" button (`pim://quit`).
            //
            // `conn.stop()` returns in milliseconds on macOS now because
            // `kill_privileged` is fire-and-forget — the auth dialog for
            // killing the daemon shows up independently of our process
            // exiting (the osascript child reparents to launchd). On
            // Linux/Windows the kill is a real SIGTERM on the sidecar
            // child handle; both finish before the run loop tears down.
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
