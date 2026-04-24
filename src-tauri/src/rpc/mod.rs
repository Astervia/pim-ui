//! Tauri command surface — the frontend's entry point into the Rust shell.
//!
//! Frontend calls `invoke("daemon_call", { method, params })` etc.; those
//! land here and are dispatched through `daemon::DaemonConnection`.

pub mod commands;
