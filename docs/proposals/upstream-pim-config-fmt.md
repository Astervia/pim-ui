# Upstream proposal — extract `render_config_template` into `pim-config-fmt`

**Status:** Draft (issue body for `Astervia/proximity-internet-mesh`).
**Owner:** pim-ui maintainers.
**Asks of the kernel:** publish a new crate; no breaking changes to existing
ones.

## Context

Two consumers maintain hand-written, comment-rich `pim.toml` template
generators that mirror `pim-core::Config` 1:1:

- `pim-cli/src/commands/config.rs` — `render_config_template(roles, name)`,
  ~700 lines, gates on `NodeRole::{Client, Relay, Gateway}`.
- `pim-ui/src-tauri/src/daemon/default_config.rs` —
  `render_default_config(node_name, role, data_dir)`, ~735 lines, gates on
  a UX-friendly `Role::{JoinTheMesh, ShareMyInternet}`.

Both produce TOML where every key is preceded by an explanatory comment,
optional fields are emitted commented-out, and platform-specific defaults
(macOS `utun*`, Linux `pim0`/`bridge0`) are baked in. They agree on
schema (both round-trip through `pim_core::Config::from_toml_str`) but
diverge intentionally on defaults:

| Field | `pim-cli` | `pim-ui` |
|---|---|---|
| `node.data_dir` | `/var/lib/pim` (system) | user-scope (`dirs::data_local_dir()`) |
| `interface.name` (macOS) | `utun0` | `utun8` (avoids BSD fallback collision) |
| `bluetooth.enabled` (Linux) | `false` | `true` |
| `bluetooth.radio_discovery_enabled` (macOS) | `true` | `false` (TCC blocks) |
| `security.authorization_policy` | `allow_all` | `trust_on_first_use` |
| `interface.mesh_ip` | role-conditional CIDR | always `auto` |
| Roles | `Client/Relay/Gateway` (multi-select) | `JoinTheMesh/ShareMyInternet` (UX) |

Today these are two near-identical 700-line files maintained in lockstep.
When `pim-core` adds a field, both must be updated. When the wording of
a comment is improved in one, the other drifts.

## Proposal

Extract a new crate `pim-config-fmt` (or `pim-core/config-fmt` feature)
that owns the comment-bearing TOML renderer, parameterized over the
defaults each consumer needs:

```rust
// crates/pim-config-fmt/src/lib.rs
pub struct RenderOptions {
    /// Node name to interpolate into [node].name and Bluetooth alias.
    pub node_name: String,
    /// Whether [gateway].enabled emits `true` or `false`.
    pub gateway_enabled: bool,
    /// Whether [relay].enabled emits `true` or `false`.
    pub relay_enabled: bool,
    /// Authorization policy literal in [security].
    pub authorization_policy: AuthorizationPolicy,
    /// Resolved data_dir path used for [node].data_dir, key_file,
    /// trust_store_file.
    pub data_dir: PathBuf,
    /// Platform-aware overrides for interface names. None = use
    /// `pim_core::config::defaults::*` for the host target.
    pub interface_name: Option<String>,
    pub bluetooth_interface: Option<String>,
    pub bluetooth_enabled: Option<bool>,
    pub bluetooth_radio_discovery_enabled: Option<bool>,
    pub nat_interface: Option<String>,
    pub wifi_direct_interface: Option<String>,
    /// Mesh IP CIDR or `"auto"`.
    pub mesh_ip: String,
    /// Optional static peers shown commented-out as examples.
    pub peer_example_address: String,
    /// Banner role label rendered in the file header (e.g.
    /// "client + relay" or "client + relay + gateway").
    pub role_label: String,
}

pub fn render(options: &RenderOptions) -> String {
    // Body of the existing pim-cli `render_config_template` — same
    // section ordering, same comment text, but every literal that
    // varies between consumers comes from `options`.
}
```

`pim-cli` and `pim-ui` then each ship a thin wrapper that builds
`RenderOptions` from their own role enum and calls `render(&opts)`.

## Why this beats the status quo

- **Comments stay where docs already live.** Field doc-comments in
  `pim-core::Config` are the source of truth; the renderer reflects them
  verbatim. Today both consumers re-paraphrase them.
- **Schema drift becomes a single-PR fix.** Add a field to
  `pim_core::BluetoothConfig` → `pim-config-fmt::render` adds the
  comment block once, both consumers pick it up on `cargo update`.
- **No behavioral change for either consumer.** The `RenderOptions`
  shape is wide enough to express both the system-scope CLI defaults
  and the user-scope desktop UX defaults without merging them.
- **Testability.** `pim-config-fmt::render` becomes the place where
  the round-trip-with-pim-core test lives — both consumers inherit it.

## Migration plan

1. Cut `pim-config-fmt 0.1.0` containing `render` + `RenderOptions`.
   Body is the existing `pim-cli` template renderer plus the option
   plumbing.
2. `pim-cli 0.1.15` switches to `pim-config-fmt`. Tests pin the rendered
   string for one role to catch accidental wording changes.
3. `pim-ui` adds `pim-config-fmt = "0.1"`. The 735-line
   `default_config.rs` becomes a 50-line wrapper that builds
   `RenderOptions` from `Role::{JoinTheMesh, ShareMyInternet}` and the
   platform-aware defaults.
4. Existing `default_config.rs` tests stay (they describe pim-ui-side
   contract — gateway flag mapping, TrustOnFirstUse, etc.) and run
   against the wrapper.

## What pim-ui will commit on its side once `pim-config-fmt` ships

- Replace `default_config.rs` body with a wrapper. ~700 LOC removed.
- Bump `pim-core` minimum to whatever version `pim-config-fmt` requires.
- The existing `rendered_template_parses_with_pim_core` smoke test
  becomes redundant (the upstream crate guarantees the round-trip) and
  can be removed.

## Non-goals

- Auto-generating field docstrings from `///` comments via proc-macro.
  Nice-to-have but separate; the existing hand-paraphrased comments are
  better than what `///` lines produce verbatim.
- Sharing the role enum. `pim-cli` and `pim-ui` have different role
  semantics on purpose — `pim-config-fmt` only needs the *outputs* of
  role decisions (`gateway_enabled: bool`, etc.), not the role itself.

## Cross-link

This proposal is the upstream side of pim-ui's
`feat(settings): validate pim.toml against pim-core schema` (pim-ui
commit `795e123`), which added `pim-core 0.1.4` as a dep and a
round-trip drift detector. That commit is the point at which the two
template generators became formally coupled to the same schema; this
proposal is what removes the duplication.
