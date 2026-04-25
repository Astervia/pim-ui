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

/// Render the sane-default `pim.toml`. Two interpolation points:
///   - `[node].name = "{node_name}"`
///   - `[roles].gateway = true` if `Role::ShareMyInternet`, else `false`.
///
/// All other fields come from D-16 verbatim.
pub fn render_default_config(node_name: &str, role: Role) -> String {
    let escaped = node_name.replace('\\', "\\\\").replace('"', "\\\"");
    let gateway = matches!(role, Role::ShareMyInternet);
    format!(
        r#"[node]
name = "{name}"

[interface]
name = "pim0"         # Linux daemon creates this; macOS daemon re-maps to utunN automatically
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
