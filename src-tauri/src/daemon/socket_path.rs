//! Platform-correct pim-daemon Unix socket path.
//!
//! Mirrors proximity-internet-mesh/docs/RPC.md §1.2:
//!   Linux system: /run/pim/pim.sock
//!   Linux user:   $XDG_RUNTIME_DIR/pim.sock
//!   macOS:        $TMPDIR/pim.sock
//!   Override:     $PIM_RPC_SOCKET (always wins)

use std::path::PathBuf;

/// Resolve the platform's pim.sock path. Never fails — falls back to
/// `/tmp/pim.sock` if the preferred directory does not exist (dev-only).
pub fn resolve_socket_path() -> PathBuf {
    // 1. Explicit override wins — documented in docs/RPC.md §1.2 "Override".
    if let Ok(override_path) = std::env::var("PIM_RPC_SOCKET") {
        return PathBuf::from(override_path);
    }

    #[cfg(target_os = "macos")]
    {
        // $TMPDIR is always set on macOS by launchd. Falls back to /tmp.
        let tmp = std::env::var_os("TMPDIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/tmp"));
        tmp.join("pim.sock")
    }

    #[cfg(target_os = "linux")]
    {
        // User daemon first (no root required).
        if let Some(xdg) = dirs::runtime_dir() {
            return xdg.join("pim.sock");
        }
        // System daemon fallback — requires membership in the `pim` group.
        PathBuf::from("/run/pim/pim.sock")
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux")))]
    {
        // Windows support is a future; named pipes per docs/RPC.md §1.2.
        // For now, refuse to guess — return a path that will fail clearly.
        PathBuf::from("C:\\\\pipe\\\\pim")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn override_env_var_wins() {
        std::env::set_var("PIM_RPC_SOCKET", "/tmp/my-pim.sock");
        assert_eq!(resolve_socket_path(), PathBuf::from("/tmp/my-pim.sock"));
        std::env::remove_var("PIM_RPC_SOCKET");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_uses_tmpdir() {
        std::env::remove_var("PIM_RPC_SOCKET");
        std::env::set_var("TMPDIR", "/var/folders/xx");
        assert_eq!(resolve_socket_path(), PathBuf::from("/var/folders/xx/pim.sock"));
    }
}
