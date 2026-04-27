//! Hard-coded sane-default `pim.toml` template (Phase 01.1 D-15 + D-16).
//!
//! D-15 anchors the template to Rust — the UI must not ship with
//! protocol-specific knowledge. The string here is the wire contract with
//! `pim-daemon`. Two interpolation points only: `{node_name}` and the
//! `[roles].gateway` boolean derived from `Role`.
//!
//! Intentionally NO file I/O, NO validation: the caller (commands::bootstrap_config)
//! is responsible for the atomic-rename write (D-14) and the client UI is
//! responsible for `node_name` validation (D-11). The only defensive step we
//! take here is escaping a `"` character in `node_name` so the produced TOML
//! is always parseable — the regex-validated UI input wouldn't include one,
//! but malformed TOML on disk would brick the daemon, so the cost of cheap
//! defense is worth it.

use serde::{Deserialize, Serialize};

/// Role identifiers — wire-format `snake_case` per Phase 01.1 D-08.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Role {
    JoinTheMesh,
    ShareMyInternet,
}

/// Render the sane-default `pim.toml`. Three interpolation points:
///   - `[node].name = "{node_name}"`
///   - `[roles].gateway = true` if `Role::ShareMyInternet`, else `false`.
///   - `[interface].name` is platform-aware: `pim0` on Linux (kernel
///     daemon creates it), `utun8` on macOS (daemon binary's interface
///     validation rejects non-`utun*` names — the kernel will rename
///     to the next available `utunN` if 8 is taken).
///
/// All other fields come from D-16 verbatim.
pub fn render_default_config(node_name: &str, role: Role) -> String {
    let escaped = node_name.replace('\\', "\\\\").replace('"', "\\\"");
    let gateway = matches!(role, Role::ShareMyInternet);

    // The shipped pim-daemon binary in src-tauri/binaries/ rejects `pim0` on
    // macOS at TUN-creation time (`unsupported interface name for this
    // platform: pim0`). macOS requires `utun*`. We pre-fill a high index
    // (`utun8`) to dodge collisions with system utuns (utun0..3 are used by
    // various OS services); the kernel falls back to the next free index if
    // 8 is occupied. Linux keeps `pim0` because the kernel daemon creates a
    // named TUN device verbatim there.
    #[cfg(target_os = "macos")]
    let interface_name = "utun8";
    #[cfg(not(target_os = "macos"))]
    let interface_name = "pim0";

    let interface_comment = if cfg!(target_os = "macos") {
        "# macOS — utun* is the only allowed prefix; kernel resolves to next free utunN"
    } else {
        "# Linux daemon creates this; macOS daemon re-maps to utunN automatically"
    };

    format!(
        r#"[node]
name = "{name}"

[interface]
name = "{iface}"         {iface_comment}
mtu = 1400
mesh_ip = "auto"      # daemon picks a CIDR it hasn't seen

[transport]
listen_port = 0       # 0 = OS-assigned, avoids port conflicts on dev machines
tcp = true
bluetooth = false     # off — BLE drains battery, surface opt-in in Phase 3 Discovery
wifi_direct = false   # off — same

[discovery]
broadcast = true      # on — Aria expects nearby discovery to just work
bluetooth = false
wifi_direct = false
auto_connect = false  # OFF — trust must be deliberate (TOFU), never silent

[security]
authorization_policy = "trust_on_first_use"
require_encryption = true

[roles]
gateway = {gateway}   # true if role == "share_my_internet", false otherwise
"#,
        name = escaped,
        iface = interface_name,
        iface_comment = interface_comment,
        gateway = gateway,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_join_the_mesh() {
        let toml = render_default_config("alice-laptop", Role::JoinTheMesh);
        assert!(
            toml.contains(r#"name = "alice-laptop""#),
            "expected node.name to be 'alice-laptop'; got:\n{toml}"
        );
        assert!(
            toml.contains("gateway = false"),
            "expected gateway = false for JoinTheMesh; got:\n{toml}"
        );
    }

    #[test]
    fn render_share_my_internet() {
        let toml = render_default_config("alice-laptop", Role::ShareMyInternet);
        assert!(
            toml.contains("gateway = true"),
            "expected gateway = true for ShareMyInternet; got:\n{toml}"
        );
    }

    #[test]
    fn render_escapes_quotes_in_node_name() {
        let toml = render_default_config(r#"a"b"#, Role::JoinTheMesh);
        // The double-quote in node_name must be escaped as `\"` so the TOML
        // parses cleanly.
        assert!(
            toml.contains(r#"name = "a\"b""#),
            "expected escaped quote in node.name; got:\n{toml}"
        );
    }

    #[test]
    fn serde_role_snake_case() {
        let s = serde_json::to_string(&Role::ShareMyInternet).expect("serialize");
        assert_eq!(s, "\"share_my_internet\"");
        let s = serde_json::to_string(&Role::JoinTheMesh).expect("serialize");
        assert_eq!(s, "\"join_the_mesh\"");
    }
}
