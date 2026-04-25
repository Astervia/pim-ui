//! Platform-correct user-scope `pim.toml` path.
//!
//! Mirrors the kernel-study §2.2 `DEFAULT_CONFIG` rules **as closely as
//! possible WITHOUT REQUIRING ROOT** (Phase 01.1 D-04):
//!
//!   Linux:   `$XDG_CONFIG_HOME/pim/pim.toml` (or `~/.config/pim/pim.toml`)
//!   macOS:   `~/Library/Application Support/pim/pim.toml`
//!   Windows: `%APPDATA%\pim\pim.toml`
//!   Override: `$PIM_CONFIG_PATH` (always wins — mirrors socket_path.rs)
//!
//! Never panics; if every platform branch fails, returns a clearly-bogus
//! path the OS will refuse so the surrounding error path can render
//! honestly (Phase 01.1 D-22 — fs errors are graceful).

use std::path::PathBuf;

/// Resolve the user-scope `pim.toml` path. Never fails.
pub fn resolve_config_path() -> PathBuf {
    // 1. Explicit override wins (also used by tests).
    if let Ok(override_path) = std::env::var("PIM_CONFIG_PATH") {
        return PathBuf::from(override_path);
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

    #[test]
    fn override_env_var_wins() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::set_var("PIM_CONFIG_PATH", "/tmp/my-pim.toml");
        assert_eq!(resolve_config_path(), PathBuf::from("/tmp/my-pim.toml"));
        std::env::remove_var("PIM_CONFIG_PATH");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_app_support() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("PIM_CONFIG_PATH");
        let p = resolve_config_path();
        let s = p.to_string_lossy();
        assert!(
            s.ends_with("Library/Application Support/pim/pim.toml"),
            "expected ~/Library/Application Support/pim/pim.toml suffix, got {s}"
        );
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_uses_xdg_config() {
        let _g = ENV_LOCK.lock().unwrap();
        std::env::remove_var("PIM_CONFIG_PATH");
        std::env::set_var("XDG_CONFIG_HOME", "/tmp/xdg-test");
        let p = resolve_config_path();
        assert_eq!(p, PathBuf::from("/tmp/xdg-test/pim/pim.toml"));
        std::env::remove_var("XDG_CONFIG_HOME");
    }

    #[test]
    fn never_panics() {
        let _g = ENV_LOCK.lock().unwrap();
        // Even with no env hints set, resolution must produce some PathBuf.
        std::env::remove_var("PIM_CONFIG_PATH");
        let _ = resolve_config_path();
    }
}
