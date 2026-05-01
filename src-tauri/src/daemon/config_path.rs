//! Platform-correct user-scope `pim.toml` path.
//!
//! Mirrors the kernel-study §2.2 `DEFAULT_CONFIG` rules **as closely as
//! possible WITHOUT REQUIRING ROOT** (Phase 01.1 D-04):
//!
//!   Linux:   `$XDG_CONFIG_HOME/pim/pim.toml` (or `~/.config/pim/pim.toml`)
//!   macOS:   `~/Library/Application Support/pim/pim.toml`
//!   Windows: `%APPDATA%\pim\pim.toml`
//!   Override: `$PIM_CONFIG_PATH` (always wins — mirrors socket_path.rs)
//!   User override: `<data_dir>/config-path-override` — set from the
//!                  Settings → Advanced → Config file panel. Lets the
//!                  user point pim at an arbitrary file (e.g. a config
//!                  shared from another machine) without restarting
//!                  the app or exporting an env var. Daemon needs a
//!                  restart to pick up a changed override (it reads
//!                  `pim.toml` once at startup); the Settings UI's
//!                  read/write Tauri commands honour it immediately.
//!
//! Never panics; if every platform branch fails, returns a clearly-bogus
//! path the OS will refuse so the surrounding error path can render
//! honestly (Phase 01.1 D-22 — fs errors are graceful).

use std::path::PathBuf;

use crate::daemon::data_dir::resolve_data_dir;

/// Filename of the on-disk override under `resolve_data_dir()`. Plain
/// text — one line, the absolute path the user picked.
const OVERRIDE_FILENAME: &str = "config-path-override";

/// Path to the override file. Lives under the data dir (not the config
/// dir) so changing the active config path doesn't move the override
/// out from under itself.
pub fn override_file_path() -> PathBuf {
    resolve_data_dir().join(OVERRIDE_FILENAME)
}

/// Read the override file if present; trim and return the contained path.
/// Empty / unreadable files yield `None` (graceful — falls back to default).
pub fn read_override_file() -> Option<PathBuf> {
    let p = override_file_path();
    let raw = std::fs::read_to_string(&p).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

/// Resolve the user-scope `pim.toml` path. Never fails.
pub fn resolve_config_path() -> PathBuf {
    // 1. Explicit env override wins (also used by tests).
    if let Ok(override_path) = std::env::var("PIM_CONFIG_PATH") {
        return PathBuf::from(override_path);
    }

    // 2. User-set override file (Settings → Advanced → Config file).
    if let Some(p) = read_override_file() {
        return p;
    }

    #[cfg(target_os = "linux")]
    {
        // Honor XDG_CONFIG_HOME explicitly so it round-trips with the kernel
        // daemon's own resolution; dirs::config_dir() also reads it on Linux,
        // but going via the env var keeps the test fixture deterministic.
        if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
            if !xdg.is_empty() {
                return PathBuf::from(xdg).join("pim").join("pim.toml");
            }
        }
        if let Some(cfg) = dirs::config_dir() {
            return cfg.join("pim").join("pim.toml");
        }
    }

    #[cfg(target_os = "macos")]
    {
        // dirs::config_dir() maps to ~/Library/Application Support on macOS.
        if let Some(cfg) = dirs::config_dir() {
            return cfg.join("pim").join("pim.toml");
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        // Windows + everything else — dirs::config_dir() resolves to %APPDATA%
        // on Windows, which is the right user-scope home.
        if let Some(cfg) = dirs::config_dir() {
            return cfg.join("pim").join("pim.toml");
        }
    }

    // Last-ditch fallback — the OS will fail loudly here, which is what we want.
    PathBuf::from("./pim.toml")
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Lock used to serialize tests that mutate process-global env vars.
    /// Without it, `cargo test`'s parallel runner can race set_var/remove_var
    /// against each other and produce flaky failures.
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    /// Point `resolve_data_dir()` at an empty temp dir for the duration of
    /// the test so a real override file on the developer's machine doesn't
    /// poison the assertion. Returns the temp dir guard which should be
    /// kept alive for the duration of the test.
    fn isolated_data_dir() -> tempfile::TempDir {
        let d = tempfile::tempdir().expect("tempdir");
        std::env::set_var("PIM_DATA_DIR", d.path());
        d
    }

    #[test]
    fn override_env_var_wins() {
        let _g = ENV_LOCK.lock().unwrap();
        let _d = isolated_data_dir();
        std::env::set_var("PIM_CONFIG_PATH", "/tmp/my-pim.toml");
        assert_eq!(resolve_config_path(), PathBuf::from("/tmp/my-pim.toml"));
        std::env::remove_var("PIM_CONFIG_PATH");
        std::env::remove_var("PIM_DATA_DIR");
    }

    #[test]
    fn override_file_wins_over_default() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("PIM_CONFIG_PATH");
        let d = isolated_data_dir();
        let target = "/tmp/some-other-pim.toml";
        std::fs::write(d.path().join(OVERRIDE_FILENAME), target).unwrap();
        assert_eq!(resolve_config_path(), PathBuf::from(target));
        std::env::remove_var("PIM_DATA_DIR");
    }

    #[test]
    fn override_env_var_beats_override_file() {
        let _g = ENV_LOCK.lock().unwrap();
        let d = isolated_data_dir();
        std::fs::write(d.path().join(OVERRIDE_FILENAME), "/tmp/from-file.toml").unwrap();
        std::env::set_var("PIM_CONFIG_PATH", "/tmp/from-env.toml");
        assert_eq!(resolve_config_path(), PathBuf::from("/tmp/from-env.toml"));
        std::env::remove_var("PIM_CONFIG_PATH");
        std::env::remove_var("PIM_DATA_DIR");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_app_support() {
        let _g = ENV_LOCK.lock().unwrap();
        let _d = isolated_data_dir();
        std::env::remove_var("PIM_CONFIG_PATH");
        let p = resolve_config_path();
        let s = p.to_string_lossy();
        assert!(
            s.ends_with("Library/Application Support/pim/pim.toml"),
            "expected ~/Library/Application Support/pim/pim.toml suffix, got {s}"
        );
        std::env::remove_var("PIM_DATA_DIR");
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_uses_xdg_config() {
        let _g = ENV_LOCK.lock().unwrap();
        let _d = isolated_data_dir();
        std::env::remove_var("PIM_CONFIG_PATH");
        std::env::set_var("XDG_CONFIG_HOME", "/tmp/xdg-test");
        let p = resolve_config_path();
        assert_eq!(p, PathBuf::from("/tmp/xdg-test/pim/pim.toml"));
        std::env::remove_var("XDG_CONFIG_HOME");
        std::env::remove_var("PIM_DATA_DIR");
    }

    #[test]
    fn never_panics() {
        let _g = ENV_LOCK.lock().unwrap();
        let _d = isolated_data_dir();
        std::env::remove_var("PIM_CONFIG_PATH");
        let _ = resolve_config_path();
        std::env::remove_var("PIM_DATA_DIR");
    }
}
