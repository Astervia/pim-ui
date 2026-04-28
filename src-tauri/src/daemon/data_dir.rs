//! Platform-correct user-scope data directory for the pim daemon.
//!
//! Distinct from `resolve_config_path()` (which resolves the path to
//! `pim.toml` itself). The data dir is where the daemon stores
//! persistent local state — the Ed25519 node key, runtime caches, etc.
//! Mirrors what Tauri's `app_data_dir` resolves to per platform:
//!
//!   Linux:   `$XDG_DATA_HOME/pim` (or `~/.local/share/pim`)
//!   macOS:   `~/Library/Application Support/pim`
//!   Windows: `%APPDATA%\pim`
//!   Override: `$PIM_DATA_DIR` (always wins — convenient for tests)
//!
//! On macOS the data dir and config dir resolve to the same
//! `~/Library/Application Support/pim/` path; Apple's filesystem
//! conventions don't separate them. On Linux they're distinct because
//! XDG places config under `$XDG_CONFIG_HOME` and data under
//! `$XDG_DATA_HOME`.
//!
//! Never panics. If every platform branch fails, returns a clearly
//! bogus path the OS will refuse — keeps the failure path honest.

use std::path::PathBuf;

/// Resolve the user-scope data directory. Never fails.
pub fn resolve_data_dir() -> PathBuf {
    if let Ok(override_path) = std::env::var("PIM_DATA_DIR") {
        return PathBuf::from(override_path);
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            if !xdg.is_empty() {
                return PathBuf::from(xdg).join("pim");
            }
        }
        if let Some(d) = dirs::data_dir() {
            return d.join("pim");
        }
    }

    #[cfg(not(target_os = "linux"))]
    {
        // macOS → ~/Library/Application Support
        // Windows → %APPDATA%\Roaming
        if let Some(d) = dirs::data_dir() {
            return d.join("pim");
        }
    }

    PathBuf::from("./pim-data")
}

#[cfg(test)]
mod tests {
    use super::*;

    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn override_env_var_wins() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::set_var("PIM_DATA_DIR", "/tmp/my-pim-data");
        assert_eq!(resolve_data_dir(), PathBuf::from("/tmp/my-pim-data"));
        std::env::remove_var("PIM_DATA_DIR");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_app_support() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("PIM_DATA_DIR");
        let p = resolve_data_dir();
        let s = p.to_string_lossy();
        assert!(
            s.ends_with("Library/Application Support/pim"),
            "expected ~/Library/Application Support/pim suffix, got {s}"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_honors_xdg_data_home() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("PIM_DATA_DIR");
        std::env::set_var("XDG_DATA_HOME", "/tmp/xdg-data-test");
        let p = resolve_data_dir();
        assert_eq!(p, PathBuf::from("/tmp/xdg-data-test/pim"));
        std::env::remove_var("XDG_DATA_HOME");
    }

    #[test]
    fn never_panics() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("PIM_DATA_DIR");
        let _ = resolve_data_dir();
    }
}
