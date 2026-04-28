//! Tauri command handlers for the daemon bridge.
//! Names: daemon_call, daemon_subscribe, daemon_unsubscribe,
//!         daemon_start, daemon_stop, daemon_last_error.
//!
//! See src/lib/rpc.ts `DaemonCommands` — strings are the contract.
//!
//! B1 checker fix: daemon_unsubscribe accepts subscription_id (not event name)
//! to match the frontend's { subscriptionId: string } call shape. Tauri's
//! invoke bridge serde-maps camelCase -> snake_case automatically.

use serde::Serialize;
use serde_json::Value;
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::daemon::config_path::resolve_config_path;
use crate::daemon::data_dir::resolve_data_dir;
use crate::daemon::default_config::{render_default_config, Role};
use crate::daemon::jsonrpc::RpcError;
use crate::daemon::state::{subscribe_method_for, unsubscribe_method_for, DaemonConnection};

/// Generic JSON-RPC request/response — used by frontend callDaemon().
#[tauri::command]
pub async fn daemon_call(
    method: String,
    params: Option<Value>,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<Value, RpcError> {
    conn.call(&method, params.unwrap_or(Value::Null)).await
}

/// Starts forwarding one of the three notification streams.
/// Returns a subscription_id the frontend later passes back to daemon_unsubscribe.
/// B1: the returned subscription_id is a uuid; we record (subscription_id ->
/// event_name) in DaemonConnection so daemon_unsubscribe can look it up.
#[tauri::command]
pub async fn daemon_subscribe(
    event: String,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<String, RpcError> {
    let subscribe_method = match subscribe_method_for(&event) {
        Some(m) => m,
        None => {
            return Err(RpcError {
                code: -32602,
                message: format!("unknown event stream '{event}'"),
                data: None,
            });
        }
    };
    conn.call(subscribe_method, Value::Null).await?;
    let subscription_id = Uuid::new_v4().to_string();
    conn.register_subscription(subscription_id.clone(), event)
        .await;
    Ok(subscription_id)
}

/// B1 checker fix: accepts subscription_id (NOT event name). The serde
/// attribute maps JS camelCase `subscriptionId` to Rust snake_case automatically
/// via tauri's invoke convention; the `subscription_id` parameter name here
/// corresponds to the `subscriptionId` key sent by the frontend's
/// invoke(CMD.unsubscribe, { subscriptionId }).
#[tauri::command]
pub async fn daemon_unsubscribe(
    subscription_id: String,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<(), RpcError> {
    // Look up the event name this subscription_id was bound to.
    let Some(event) = conn.take_subscription(&subscription_id).await else {
        // Silently succeed on unknown id — the UI may over-eagerly unsubscribe
        // on unmount after a reconnect cleared state. NotSubscribed (-32051) is
        // the daemon-side code; here we swallow so the UI doesn't see an error
        // on a benign race.
        return Ok(());
    };
    let unsub_method = match unsubscribe_method_for(&event) {
        Some(m) => m,
        None => return Ok(()),
    };
    // Only fire the daemon-side unsubscribe if this was the LAST UI subscriber
    // for the stream. `take_subscription` already removed it from
    // active_subscriptions if so — we call unconditionally here because the
    // daemon-side is idempotent per docs/RPC.md §4 (at worst returns -32051
    // NotSubscribed, which we ignore).
    let _ = conn.call(unsub_method, Value::Null).await;
    Ok(())
}

#[tauri::command]
pub async fn daemon_start(
    app: AppHandle,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<(), String> {
    let conn = conn.inner().clone();
    conn.start(app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn daemon_stop(
    app: AppHandle,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<(), String> {
    let conn = conn.inner().clone();
    conn.stop(app).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn daemon_last_error(
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<Option<RpcError>, String> {
    Ok(conn.last_error().await)
}

// =============================================================================
// Phase 01.1: first-run config bootstrap
// =============================================================================

/// Returned by `bootstrap_config` — Tauri serde defaults to snake_case on the
/// wire, matching the JS-side `{ path }` call shape.
#[derive(Debug, Clone, Serialize)]
pub struct BootstrapResult {
    pub path: String,
}

/// Returned by `config_exists` — `{ exists, path }` on both sides.
#[derive(Debug, Clone, Serialize)]
pub struct ConfigExistsResult {
    pub exists: bool,
    pub path: String,
}

/// Phase 01.1 D-13 step 2: write a sane-default `pim.toml` to the
/// platform-correct user-scope path.
///
/// Behavior:
///   - Resolves the path via `daemon::config_path::resolve_config_path()`.
///   - Renders the TOML via `daemon::default_config::render_default_config`.
///   - Creates parent dirs at 0o700 (D-06; Unix only).
///   - Writes atomically (D-14): `pim.toml.tmp` -> fsync -> rename.
///   - Returns the canonical absolute path on success.
///   - On failure, returns a human-readable message the UI surfaces verbatim
///     (D-13: `Couldn't write config to {path}: {reason}` is assembled
///     client-side from `{ path, error }`).
#[tauri::command]
pub async fn bootstrap_config(node_name: String, role: Role) -> Result<BootstrapResult, String> {
    let path = resolve_config_path();
    let path_str = path.to_string_lossy().to_string();
    let data_dir = resolve_data_dir();
    let toml = render_default_config(&node_name, role, &data_dir);

    if let Some(parent) = path.parent() {
        // D-06: parent dir is 0o700 (owner-only — identity files live here).
        #[cfg(unix)]
        {
            use std::os::unix::fs::DirBuilderExt;
            std::fs::DirBuilder::new()
                .recursive(true)
                .mode(0o700)
                .create(parent)
                .map_err(|e| format!("create parent {}: {e}", parent.display()))?;
        }
        #[cfg(not(unix))]
        {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("create parent {}: {e}", parent.display()))?;
        }
    }

    // D-14 atomic write: tmp -> fsync -> rename.
    let tmp = path.with_extension("toml.tmp");
    {
        use std::io::Write;
        let mut f =
            std::fs::File::create(&tmp).map_err(|e| format!("open {}: {e}", tmp.display()))?;
        f.write_all(toml.as_bytes())
            .map_err(|e| format!("write {}: {e}", tmp.display()))?;
        f.sync_all()
            .map_err(|e| format!("fsync {}: {e}", tmp.display()))?;
    }
    std::fs::rename(&tmp, &path).map_err(|e| {
        // Try to clean up the tmp on rename failure so we don't leave dangling
        // half-written files. The remove_file error itself is intentionally
        // ignored — the rename error is the real story.
        let _ = std::fs::remove_file(&tmp);
        format!("rename {} -> {}: {e}", tmp.display(), path.display())
    })?;

    Ok(BootstrapResult { path: path_str })
}

/// Phase 01.1 D-22: stat-check the resolved `pim.toml` path. Any IO error is
/// treated as `exists=false` (graceful) — never returns `Err`.
#[tauri::command]
pub async fn config_exists() -> Result<ConfigExistsResult, String> {
    let path = resolve_config_path();
    let exists = path.try_exists().unwrap_or(false);
    Ok(ConfigExistsResult {
        exists,
        path: path.to_string_lossy().to_string(),
    })
}

#[cfg(test)]
// Tests below intentionally hold a `std::sync::Mutex` guard across
// `.await` points to serialize access to `PIM_CONFIG_PATH` across the
// async test functions. With `tokio::test(flavor = "current_thread")`
// there's only one task on this thread, so no deadlock risk — clippy
// can't statically prove that, hence the module-level allow.
#[allow(clippy::await_holding_lock)]
mod tests {
    use super::*;

    /// Lock used to serialize tests that mutate `PIM_CONFIG_PATH`. Without
    /// this, parallel test execution races on the env var and produces
    /// flaky "exists" results. We recover from a poisoned mutex (i.e. a
    /// previous test panicked while holding the lock) by taking the inner
    /// guard anyway — the env var is going to be re-set by us regardless.
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn lock_env() -> std::sync::MutexGuard<'static, ()> {
        match ENV_LOCK.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        }
    }

    /// Allocate a temp dir that does NOT honor `TMPDIR` — keeps us robust
    /// against sibling tests that mutate `TMPDIR` for their own assertions
    /// (e.g. `daemon::socket_path::tests::macos_uses_tmpdir` sets it to a
    /// bogus path and never cleans up).
    fn isolated_tempdir() -> tempfile::TempDir {
        let base = if cfg!(target_os = "macos") {
            // macOS: /tmp is always present and writable for tests.
            std::path::PathBuf::from("/tmp")
        } else if cfg!(unix) {
            std::path::PathBuf::from("/tmp")
        } else {
            std::env::current_dir().expect("cwd")
        };
        tempfile::Builder::new()
            .prefix("pim-ui-test-")
            .tempdir_in(base)
            .expect("tempdir_in")
    }

    #[tokio::test]
    async fn bootstrap_writes_atomic() {
        let _g = lock_env();
        let dir = isolated_tempdir();
        let path = dir.path().join("nested").join("pim.toml");
        std::env::set_var("PIM_CONFIG_PATH", &path);

        let res = bootstrap_config("test-node".to_string(), Role::JoinTheMesh)
            .await
            .expect("bootstrap_config");
        assert_eq!(res.path, path.to_string_lossy().to_string());

        let written = std::fs::read_to_string(&path).expect("read written config");
        assert!(
            written.contains(r#"name = "test-node""#),
            "expected node.name interpolation; got:\n{written}"
        );
        // Gateway disabled for JoinTheMesh — assert against the
        // `[gateway]` block's first `enabled = ...` line, since
        // `enabled = ...` also appears under [discovery] and [bluetooth].
        let gateway_block = written
            .split("[gateway]")
            .nth(1)
            .expect("[gateway] section present");
        assert!(
            gateway_block.contains("enabled = false"),
            "expected gateway.enabled = false for JoinTheMesh; got:\n{written}"
        );

        // D-14: the atomic-rename leaves no `.tmp` artifact behind.
        let tmp = path.with_extension("toml.tmp");
        assert!(
            !tmp.exists(),
            "expected pim.toml.tmp to be renamed, but it still exists at {}",
            tmp.display()
        );

        std::env::remove_var("PIM_CONFIG_PATH");
    }

    #[tokio::test]
    async fn bootstrap_writes_share_my_internet_gateway_true() {
        let _g = lock_env();
        let dir = isolated_tempdir();
        let path = dir.path().join("pim.toml");
        std::env::set_var("PIM_CONFIG_PATH", &path);

        bootstrap_config("alice".to_string(), Role::ShareMyInternet)
            .await
            .expect("bootstrap_config");
        let written = std::fs::read_to_string(&path).expect("read");
        let gateway_block = written
            .split("[gateway]")
            .nth(1)
            .expect("[gateway] section present");
        assert!(
            gateway_block.contains("enabled = true"),
            "expected gateway.enabled = true for ShareMyInternet; got:\n{written}"
        );

        std::env::remove_var("PIM_CONFIG_PATH");
    }

    #[tokio::test]
    async fn config_exists_returns_false_when_missing() {
        let _g = lock_env();
        let dir = isolated_tempdir();
        let path = dir.path().join("missing").join("pim.toml");
        std::env::set_var("PIM_CONFIG_PATH", &path);

        let res = config_exists().await.expect("config_exists");
        assert!(!res.exists, "expected exists=false for missing path");
        assert_eq!(res.path, path.to_string_lossy().to_string());

        std::env::remove_var("PIM_CONFIG_PATH");
    }

    #[tokio::test]
    async fn config_exists_returns_true_when_present() {
        let _g = lock_env();
        let dir = isolated_tempdir();
        let path = dir.path().join("pim.toml");
        std::fs::write(&path, "[node]\nname = \"x\"\n").expect("write");
        std::env::set_var("PIM_CONFIG_PATH", &path);

        let res = config_exists().await.expect("config_exists");
        assert!(res.exists, "expected exists=true for present file");

        std::env::remove_var("PIM_CONFIG_PATH");
    }
}
