//! Phase 6 Plan 06-03 — Bluetooth NAP-server preflight.
//!
//! `bluetooth.serve_nap = true` runs the Linux PAN access-point side of
//! the daemon (`bt-network -s nap` on a `br-bt` bridge plus a dnsmasq
//! DHCP server). The kernel daemon will fail loudly at startup if any
//! of those tools is missing; we'd rather catch that condition in the
//! UI BEFORE the user saves the toggle, so the bluetooth-section can
//! disable the switch + render an honest checklist of what to install.
//!
//! The check has no side effects — it runs `which` for the binaries and
//! reads `/proc/modules` for the `bnep` kernel module. No background
//! state, no daemon RPC. Returns a `BtNapPreflightResult` shape mirroring
//! `GatewayPreflightResult` so the UI can reuse the same renderer.
//!
//! Future migration: when the kernel exposes a real RPC for this (TBD —
//! tracked alongside `gateway.preflight`), the UI swaps `invoke` for
//! `callDaemon("bluetooth.preflight", null)` and this file goes away.
//! Until then the Tauri-side check is the practical answer; we keep it
//! independent of `commands.rs` to make the eventual deletion painless.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)] // variants are platform-specific; the unused ones still need to ship in the enum so the wire shape is stable
pub enum BtNapPlatform {
    Linux,
    Macos,
    Windows,
    Other,
}

#[derive(Debug, Clone, Serialize)]
pub struct BtNapPreflightCheck {
    /// Stable identifier the UI uses to key check rows.
    pub name: &'static str,
    pub ok: bool,
    /// Human-readable detail rendered in the UI; explicit about which
    /// tool is missing and how to install it.
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BtNapPreflightResult {
    pub supported: bool,
    pub platform: BtNapPlatform,
    pub checks: Vec<BtNapPreflightCheck>,
}

/// Look up `binary` on PATH using `which` (Unix) / `where.exe` (Windows).
/// We avoid pulling the `which` crate to keep this file self-contained.
#[allow(dead_code)] // only called from the Linux branch, but needed in tests on every platform
fn binary_on_path(binary: &str) -> bool {
    let probe_cmd = if cfg!(windows) { "where" } else { "which" };
    std::process::Command::new(probe_cmd)
        .arg(binary)
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Cheap check for a kernel module: scan `/proc/modules` for the literal
/// module name at the start of a line. Returns false on any IO error.
#[cfg(target_os = "linux")]
fn kernel_module_loaded(name: &str) -> bool {
    match std::fs::read_to_string("/proc/modules") {
        Ok(contents) => contents
            .lines()
            .any(|line| line.split_whitespace().next() == Some(name)),
        Err(_) => false,
    }
}

#[cfg(not(target_os = "linux"))]
#[allow(dead_code)] // referenced only on Linux; the stub keeps cross-platform compilation clean
fn kernel_module_loaded(_name: &str) -> bool {
    false
}

#[cfg(target_os = "linux")]
fn run_linux_checks() -> BtNapPreflightResult {
    let mut checks: Vec<BtNapPreflightCheck> = Vec::new();

    let bt_network_ok = binary_on_path("bt-network");
    checks.push(BtNapPreflightCheck {
        name: "bt_network",
        ok: bt_network_ok,
        detail: if bt_network_ok {
            "bt-network found on PATH".to_string()
        } else {
            "bt-network missing — install bluez-tools (apt: bluez-tools, dnf: bluez-tools)"
                .to_string()
        },
    });

    let dnsmasq_ok = binary_on_path("dnsmasq");
    checks.push(BtNapPreflightCheck {
        name: "dnsmasq",
        ok: dnsmasq_ok,
        detail: if dnsmasq_ok {
            "dnsmasq found on PATH".to_string()
        } else {
            "dnsmasq missing — install dnsmasq (apt: dnsmasq, dnf: dnsmasq)".to_string()
        },
    });

    let brctl_ok = binary_on_path("brctl") || binary_on_path("ip");
    checks.push(BtNapPreflightCheck {
        name: "bridge_tools",
        ok: brctl_ok,
        detail: if brctl_ok {
            "bridge tools available (brctl or ip)".to_string()
        } else {
            "bridge tools missing — install bridge-utils or iproute2".to_string()
        },
    });

    let bnep_ok = kernel_module_loaded("bnep");
    checks.push(BtNapPreflightCheck {
        name: "bnep_module",
        ok: bnep_ok,
        detail: if bnep_ok {
            "bnep kernel module loaded".to_string()
        } else {
            "bnep kernel module not loaded — run `sudo modprobe bnep`".to_string()
        },
    });

    let supported = checks.iter().all(|c| c.ok);
    BtNapPreflightResult {
        supported,
        platform: BtNapPlatform::Linux,
        checks,
    }
}

#[cfg(target_os = "macos")]
fn run_macos_checks() -> BtNapPreflightResult {
    BtNapPreflightResult {
        supported: false,
        platform: BtNapPlatform::Macos,
        checks: vec![BtNapPreflightCheck {
            name: "platform",
            ok: false,
            detail: "NAP server (bt-network -s nap) is Linux-only. macOS \
                     can still join a Bluetooth PAN as a client."
                .to_string(),
        }],
    }
}

#[cfg(target_os = "windows")]
fn run_windows_checks() -> BtNapPreflightResult {
    BtNapPreflightResult {
        supported: false,
        platform: BtNapPlatform::Windows,
        checks: vec![BtNapPreflightCheck {
            name: "platform",
            ok: false,
            detail: "NAP server is Linux-only. Bluetooth PAN client mode \
                     is unsupported on Windows in the bundled daemon."
                .to_string(),
        }],
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn run_other_checks() -> BtNapPreflightResult {
    BtNapPreflightResult {
        supported: false,
        platform: BtNapPlatform::Other,
        checks: vec![BtNapPreflightCheck {
            name: "platform",
            ok: false,
            detail: "NAP server is Linux-only.".to_string(),
        }],
    }
}

/// Tauri command surface — invoked from `useBtNapPreflight` on the
/// frontend. `async` to match the Tauri command signature convention,
/// but the work is synchronous fast filesystem access.
#[tauri::command]
pub async fn bt_nap_preflight() -> Result<BtNapPreflightResult, String> {
    #[cfg(target_os = "linux")]
    {
        return Ok(run_linux_checks());
    }
    #[cfg(target_os = "macos")]
    {
        return Ok(run_macos_checks());
    }
    #[cfg(target_os = "windows")]
    {
        return Ok(run_windows_checks());
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
    {
        Ok(run_other_checks())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    #[tokio::test]
    async fn macos_returns_unsupported_with_explanation() {
        let r = bt_nap_preflight().await.expect("bt_nap_preflight");
        assert!(matches!(r.platform, BtNapPlatform::Macos));
        assert!(!r.supported, "macOS must report unsupported");
        assert_eq!(r.checks.len(), 1);
        assert_eq!(r.checks[0].name, "platform");
        assert!(r.checks[0].detail.contains("Linux-only"));
    }

    #[cfg(target_os = "windows")]
    #[tokio::test]
    async fn windows_returns_unsupported_with_explanation() {
        let r = bt_nap_preflight().await.expect("bt_nap_preflight");
        assert!(matches!(r.platform, BtNapPlatform::Windows));
        assert!(!r.supported, "Windows must report unsupported");
    }

    #[cfg(target_os = "linux")]
    #[tokio::test]
    async fn linux_runs_all_four_checks() {
        // The actual ok/!ok values depend on the test host's PATH and
        // loaded modules — we only assert structure here.
        let r = bt_nap_preflight().await.expect("bt_nap_preflight");
        assert!(matches!(r.platform, BtNapPlatform::Linux));
        let names: Vec<&str> = r.checks.iter().map(|c| c.name).collect();
        assert!(names.contains(&"bt_network"));
        assert!(names.contains(&"dnsmasq"));
        assert!(names.contains(&"bridge_tools"));
        assert!(names.contains(&"bnep_module"));
    }

    #[test]
    fn binary_on_path_returns_true_for_standard_shell() {
        // `sh` on Unix, `cmd.exe` on Windows — both ship with the OS.
        if cfg!(windows) {
            assert!(binary_on_path("cmd"));
        } else {
            assert!(binary_on_path("sh"));
        }
    }

    #[test]
    fn binary_on_path_returns_false_for_nonsense() {
        assert!(!binary_on_path("definitely-not-a-real-binary-xyz123"));
    }
}
