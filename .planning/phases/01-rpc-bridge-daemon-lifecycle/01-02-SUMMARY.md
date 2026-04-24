---
plan: 01-02
phase: 01-rpc-bridge-daemon-lifecycle
status: complete
requirements: [RPC-01, RPC-02, RPC-04, DAEMON-01, DAEMON-02, DAEMON-05]
duration: "~30 min (executor timed out writing SUMMARY; task commits landed — e3a471a, 6b8bfb3, 20b4122)"
---

## Summary

The Rust half of the RPC bridge. Spawns `pim-daemon` as a Tauri externalBin
sidecar, talks newline-delimited JSON-RPC 2.0 over a Unix socket with a
10-second `rpc.hello` handshake watchdog, runs a reconnect loop that restores
subscriptions, and exposes the whole thing to React as 6 Tauri commands + 2
Tauri events. Kills the child on `WindowEvent::Destroyed` and `ExitRequested`
to prevent orphan daemons.

## Key files created

- `src-tauri/Cargo.toml` — deps: `tauri-plugin-shell` (features), `dirs`, `uuid` (v4). **NO** `futures`/`futures-util`/`tokio-util` (W5).
- `src-tauri/tauri.conf.json` — `bundle.externalBin: ["binaries/pim-daemon"]`
- `src-tauri/binaries/.gitkeep` + `README.md` — documents where the user drops platform-specific daemon binaries
- `src-tauri/src/daemon/socket_path.rs` — resolves `/run/pim/pim.sock` (Linux) / `$TMPDIR/pim.sock` (macOS), honors `$PIM_RPC_SOCKET` override
- `src-tauri/src/daemon/sidecar.rs` — `Sidecar` wraps `CommandChild`; `spawn/kill/is_running`; forwards stdout/stderr to tracing
- `src-tauri/src/daemon/remote.rs` — v0.5 stub that errors "remote TCP daemon not supported in Phase 1"
- `src-tauri/src/daemon/jsonrpc.rs` — `JsonRpcClient` with request/response correlation by id, `tokio::sync::broadcast` fan-out for notifications, `AsyncBufReadExt::lines()` for framing. **No** `futures` crates used.
- `src-tauri/src/daemon/state.rs` — `DaemonConnection` 5-state machine, `HANDSHAKE_TIMEOUT_SECS = 10` watchdog with `oneshot` cancel, `HashMap<subscription_id, event_name>` for B1 unsubscribe resolution, `register_subscription`/`take_subscription` helpers, reconnect loop that restores subscriptions on return
- `src-tauri/src/daemon/events.rs` — `DAEMON_STATE_CHANGED = "daemon://state-changed"`, `DAEMON_RPC_EVENT = "daemon://rpc-event"` + emitter helpers
- `src-tauri/src/rpc/commands.rs` — 6 `#[tauri::command]` handlers (`daemon_call`, `daemon_subscribe`, `daemon_unsubscribe(subscription_id: String)`, `daemon_start`, `daemon_stop`, `daemon_last_error`)
- `src-tauri/src/lib.rs` — Tauri Builder with all 6 commands in `invoke_handler!`, manages `Arc<DaemonConnection>`, `RunEvent::WindowEvent { Destroyed } → conn.stop()` (DAEMON-05), also on `ExitRequested`

## Acceptance criteria results

Grep-verified (Rust compile deferred — see constraint below):

- ✓ W5 — no `futures`/`futures-util`/`tokio-util` in Cargo.toml
- ✓ W2 — `HANDSHAKE_TIMEOUT_SECS` constant present in `state.rs`
- ✓ B1 — `daemon_unsubscribe(subscription_id: String, ...)` in `commands.rs`
- ✓ 6 command names registered in `lib.rs` invoke_handler
- ✓ 2 event names in `events.rs`
- ✓ `WindowEvent::Destroyed` handler wired in `lib.rs`
- ✓ `HashMap<subscription_id, event_name>` in `state.rs`
- ✓ `bundle.externalBin` declared in `tauri.conf.json`
- ✓ `pnpm typecheck` passes (frontend unaffected)

## Known constraint — Rust not installed locally

The user's machine does not have `rustup`/`cargo`. Acceptance criteria were
grep-based and structural, **not** compile-verified. The first real `cargo
check` / `cargo build` will happen during Plan 01-04's human-verify
checkpoint after the user runs:

```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Compile-deferred items** (may surface as quick fixes during Plan 04 checkpoint):
- Imports completeness in each new Rust file
- serde derive macros resolve correctly
- `#[tauri::command]` signatures pass Tauri's macro expansion
- tokio feature set sufficient (`full` should cover it)

## Deliverables for Plan 03

Plan 03 consumes:
- Event names: `daemon://state-changed`, `daemon://rpc-event` (DaemonEvents from rpc.ts already matches)
- Command names: all 6 already wrapped in `src/lib/rpc.ts`
- Expected `DaemonStateChange` payload shape serialized by `events.rs`
- Subscribe returns `String` (subscription_id UUID); Plan 03 hook tracks these

## Commits

- `e3a471a` — feat(01-02): cargo deps + externalBin config + socket path resolver
- `6b8bfb3` — feat(01-02): JSON-RPC client + sidecar + state machine with handshake watchdog
- `20b4122` — feat(01-02): Tauri command surface + lib.rs wiring + orphan-daemon kill
