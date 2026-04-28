//! Daemon bridge — spawns pim-daemon, talks JSON-RPC over a Unix socket,
//! manages the connection state machine, and fans notifications out to
//! the frontend via Tauri events.
//!
//! Modules:
//!   socket_path — platform-correct pim.sock path
//!   sidecar     — Tauri externalBin spawn + kill (desktop)
//!   remote      — TCP connection (mobile, future; scaffolded only)
//!   jsonrpc     — newline-delimited JSON-RPC 2.0 client
//!   state       — connection state machine + reconnect loop
//!   events      — Tauri event name constants + emitters

pub mod config_path;
pub mod data_dir;
pub mod default_config;
pub mod events;
pub mod jsonrpc;
pub mod remote;
pub mod sidecar;
pub mod socket_path;
pub mod state;

pub use state::DaemonConnection;
