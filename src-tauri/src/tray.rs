//! Plan 05-04: tray icon + native menu + popover-window construction.
//!
//! 05-CONTEXT D-17: hybrid pattern — borderless React popover on macOS / Windows;
//! native GTK menu on Linux. show_menu_on_left_click(false) preserves Linux's
//! right-click idiom.
//!
//! D-18: NO LSUIElement key in tauri.conf.json. Window-first macOS per
//! 2026-04-24 STATE.md decision row 4.
//!
//! TBD-PHASE-4-* markers (RESEARCH §4): A (route toggle), B (route status),
//! G (add peer nearby) — every marker is an inline comment at the integration
//! point so a Phase-4 grep -rn "TBD-PHASE-4-" surfaces all of them.

use tauri::{
    menu::{CheckMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};
use tauri_plugin_positioner::{Position as PositionerPosition, WindowExt};

/// Build the native menu shown on Linux (right-click) and as the
/// right-click fallback on Windows. Per D-20 the Linux menu collapses
/// the multi-line "Routing through gateway-c (via relay-b)" content
/// into TWO MenuItems: a CheckMenuItem for the route toggle, a disabled
/// MenuItem for the status line.
pub fn build_native_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    // Status header (disabled — informational only). The label is updated
    // per-event by Phase 4 ROUTE-* hooks once status data flows; for now
    // the menu ships with a static "◆ pim" placeholder.
    let status_item = MenuItem::with_id(app, "status", "\u{25C6} pim", false, None::<&str>)?;
    let mesh_item = MenuItem::with_id(app, "mesh", "mesh: \u{2014}", false, None::<&str>)?;

    // TBD-PHASE-4-A: route_toggle CheckMenuItem.
    // Phase 4 ROUTE-01 will hook the on_menu_event for "route_toggle"
    // to call route.set_split_default. For now, the menu item exists
    // but its handler is a no-op + tracing log.
    let route_toggle = CheckMenuItem::with_id(
        app,
        "route_toggle",
        "Route internet via mesh",
        true,
        false, // initial checked state
        None::<&str>,
    )?;

    // TBD-PHASE-4-B: route_status disabled MenuItem.
    // Phase 4 ROUTE-02 will update this label per-event with the full
    // hop-chain "Routing through gateway-c (via relay-b)". For now we
    // ship the fallback "Routing — local" string from existing Phase-2
    // selected_gateway data.
    let route_status = MenuItem::with_id(
        app,
        "route_status",
        "Routing \u{2014} local",
        false,
        None::<&str>,
    )?;

    // TBD-PHASE-4-G: add_peer MenuItem.
    // The handler emits "pim://open-add-peer" so the main window's
    // listener routes the user to the existing Phase 2 Nearby section.
    let add_peer = MenuItem::with_id(app, "add_peer", "Add peer nearby", true, None::<&str>)?;
    let open_pim = MenuItem::with_id(app, "open_pim", "Open pim", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit pim", true, None::<&str>)?;

    let separator_a = PredefinedMenuItem::separator(app)?;
    let separator_b = PredefinedMenuItem::separator(app)?;
    let separator_c = PredefinedMenuItem::separator(app)?;

    Menu::with_items(
        app,
        &[
            &status_item,
            &mesh_item,
            &separator_a,
            &route_toggle,
            &route_status,
            &separator_b,
            &add_peer,
            &open_pim,
            &separator_c,
            &quit,
        ],
    )
}

/// Build the borderless React popover window programmatically.
/// 05-CONTEXT D-17 + RESEARCH §6c: created upfront (cheap, preserves React
/// state across opens), hidden until tray click on macOS / Windows.
pub fn build_popover_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if app.get_webview_window("tray-popover").is_some() {
        return Ok(());
    }
    let _popover = tauri::WebviewWindowBuilder::new(
        app,
        "tray-popover",
        tauri::WebviewUrl::App("tray-popover.html".into()),
    )
    .title("pim tray")
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .inner_size(360.0, 280.0)
    .build()?;
    Ok(())
}

/// Handle the tray icon click. On Linux this is a no-op (Tauri docs:
/// libayatana doesn't fire icon-click events on Linux — right-click
/// opens the menu instead, which on_menu_event handles).
pub fn on_tray_icon_event_handler<R: Runtime>(
    tray: &tauri::tray::TrayIcon<R>,
    event: &TrayIconEvent,
) {
    // Forward the raw event to tauri-plugin-positioner so its tray-state
    // bookkeeping (cursor + tray rect) is fresh when we ask for
    // Position::TrayCenter below.
    tauri_plugin_positioner::on_tray_event(tray.app_handle(), event);
    if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
    } = event
    {
        if let Some(win) = tray.app_handle().get_webview_window("tray-popover") {
            let _ = win.move_window(PositionerPosition::TrayCenter);
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

/// Handle a menu item click — Linux's only interaction path; also the
/// Windows right-click fallback.
pub fn on_menu_event_handler<R: Runtime>(app: &AppHandle<R>, event: &MenuEvent) {
    match event.id.as_ref() {
        "open_pim" => {
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
        }
        "add_peer" => {
            // TBD-PHASE-4-G: emit event for the main window to consume.
            // Phase 4 ROUTE-* / PEER-05/06 may further refine the
            // destination; Plan 05-04 brings the user to the surface.
            if let Some(main) = app.get_webview_window("main") {
                let _ = main.show();
                let _ = main.set_focus();
            }
            let _ = app.emit("pim://open-add-peer", ());
        }
        "route_toggle" => {
            // TBD-PHASE-4-A: route.set_split_default RPC call lands here
            // when ROUTE-01 ships. For now log + no-op.
            tracing::info!(
                "tray: route_toggle clicked (TBD-PHASE-4-A — Phase 4 wires the RPC)"
            );
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
