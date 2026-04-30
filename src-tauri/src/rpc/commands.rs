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

/// Probe the daemon socket and attach to a pre-existing daemon WITHOUT
/// spawning. Returns true if a connect loop was started, false if no live
/// daemon was found. Called by the UI on mount so a reload of the webview
/// (or a fresh app launch with the daemon already up) reflects the live
/// state instead of waiting for the user to click [TURN ON].
#[tauri::command]
pub async fn daemon_attach_if_running(
    app: AppHandle,
    conn: State<'_, Arc<DaemonConnection>>,
) -> Result<bool, String> {
    let conn = conn.inner().clone();
    conn.attach_if_running(app).await.map_err(|e| e.to_string())
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

/// Write arbitrary text to an absolute filesystem path the frontend
/// already obtained from a save dialog (e.g. via the dialog plugin).
///
/// The path is chosen by the user through a native picker, so the Rust
/// side accepts it as-is — there is no allow-list scope. We avoid
/// using the `tauri-plugin-fs` JS API on the frontend specifically so
/// we don't have to ship a permissive `fs:scope` in capabilities; this
/// dedicated command is the narrow seam.
///
/// Used by `lib/debug-snapshot.ts` to persist the OBS-03 debug snapshot
/// at the path the user picks in `dialog.save()`. The frontend renders
/// a confirmation toast with the saved path on success and a destructive
/// toast on error.
#[tauri::command]
pub async fn save_text_file(path: String, content: String) -> Result<String, String> {
    let p = std::path::PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("create parent dir failed: {e}"))?;
        }
    }
    std::fs::write(&p, content).map_err(|e| format!("write failed: {e}"))?;
    Ok(p.to_string_lossy().to_string())
}

/// Read the canonical `pim.toml` from disk and return its raw text
/// + resolved path. Used by the Settings tab as a fallback when the
/// daemon is stopped — `config.get` RPC requires a live JSON-RPC
/// connection, but the TOML file lives in the user's config dir and
/// is readable any time. Returns an empty string + the resolved path
/// when the file does not exist (first-run case); the frontend then
/// decides whether to render the bootstrap flow.
#[tauri::command]
pub async fn read_pim_config_text() -> Result<ReadConfigResult, String> {
    let path = resolve_config_path();
    let path_str = path.to_string_lossy().to_string();
    if !path.try_exists().unwrap_or(false) {
        return Ok(ReadConfigResult {
            raw: String::new(),
            path: path_str,
            last_modified: String::new(),
        });
    }
    let raw = std::fs::read_to_string(&path)
        .map_err(|e| format!("read pim.toml at {}: {e}", path.display()))?;
    let last_modified = std::fs::metadata(&path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .ok()
                .map(|d| d.as_secs())
        })
        .map(|secs| {
            // RFC-3339-ish — only the seconds component, sufficient for
            // change-detection on the frontend.
            chrono_secs_to_rfc3339(secs)
        })
        .unwrap_or_default();
    Ok(ReadConfigResult {
        raw,
        path: path_str,
        last_modified,
    })
}

#[derive(Serialize)]
pub struct ReadConfigResult {
    pub raw: String,
    pub path: String,
    pub last_modified: String,
}

/// Tiny ad-hoc UNIX-seconds → RFC-3339 (UTC) formatter — avoids pulling
/// `chrono` for one date-stamp. Format: `YYYY-MM-DDTHH:MM:SSZ`.
fn chrono_secs_to_rfc3339(secs: u64) -> String {
    // days since unix epoch
    let days = (secs / 86_400) as i64;
    let mut secs_today = (secs % 86_400) as u32;
    let h = secs_today / 3_600;
    secs_today %= 3_600;
    let m = secs_today / 60;
    let s = secs_today % 60;

    // Howard Hinnant's days-from-epoch → civil-date algorithm.
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m_civil = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = y + if m_civil <= 2 { 1 } else { 0 };
    format!("{y:04}-{m_civil:02}-{d:02}T{h:02}:{m:02}:{s:02}Z")
}

/// Reveal a saved file in the OS file explorer (Finder on macOS,
/// Explorer on Windows, the default file manager on Linux). Selects
/// the file when possible so the user immediately sees what they just
/// exported. Falls back to opening the parent directory.
#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> Result<(), String> {
    use std::process::Command;
    // Each branch is the LAST expression for its target; the `return`s
    // are gone so clippy::needless_return stays happy under
    // `-D warnings`.
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("open -R failed: {e}"))?;
        Ok(())
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| format!("explorer /select failed: {e}"))?;
        Ok(())
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| ".".to_string());
        Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("xdg-open failed: {e}"))?;
        Ok(())
    }
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
