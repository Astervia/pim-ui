/**
 * Registry of Settings sections + the daemon TOML keys each one owns.
 *
 * Source of truth for:
 *   - Form scaffolding (which fields each section renders)
 *   - schema-diff.ts (any parsed TOML key outside the union flips
 *     raw-is-source-of-truth for that section, per CONF-07 / D-15)
 *   - assemble-toml.ts (which keys to overwrite with form values when
 *     building the save payload)
 *
 * Wire names are VERBATIM from the daemon's `pim-core/src/config/model.rs`.
 * Snake_case, no translation. Labels and help text live in the section
 * components, not here.
 */

export const SECTION_IDS = [
  "identity",
  "interface",
  "discovery",
  "bluetooth",
  "bluetooth_rfcomm",
  "wifi_direct",
  "transport",
  "routing",
  "relay",
  "gateway",
  "trust",
  "notifications",
  "advanced",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionSchema {
  id: SectionId;
  /** Uppercase title rendered in CliPanel header. */
  title: string;
  /**
   * Daemon TOML paths this section exposes in its form view. A parsed
   * TOML key NOT in any section's list flips its rawWins = true.
   * Empty arrays are valid (advanced/about — no form fields).
   */
  tomlKeys: readonly string[];
}

export const SECTION_SCHEMAS: Readonly<Record<SectionId, SectionSchema>> = {
  identity: {
    id: "identity",
    title: "IDENTITY",
    tomlKeys: ["node.name", "node.data_dir"],
  },
  interface: {
    id: "interface",
    title: "INTERFACE",
    tomlKeys: [
      "interface.name",
      "interface.mtu",
      "interface.mesh_ip",
      "interface.mesh_ipv6",
    ],
  },
  discovery: {
    id: "discovery",
    title: "DISCOVERY",
    tomlKeys: [
      "discovery.enabled",
      "discovery.port",
      "discovery.broadcast_interval_ms",
      "discovery.peer_timeout_ms",
      "discovery.connect_relays",
      "discovery.connect_gateways",
      "discovery.shared_key",
    ],
  },
  bluetooth: {
    id: "bluetooth",
    title: "BLUETOOTH",
    tomlKeys: [
      "bluetooth.enabled",
      "bluetooth.interface",
      "bluetooth.radio_discovery_enabled",
      "bluetooth.device_name_prefix",
      "bluetooth.local_alias",
      "bluetooth.connect_pan",
      "bluetooth.serve_nap",
      "bluetooth.nap_bridge",
      "bluetooth.nap_bridge_addr",
      "bluetooth.dhcp_enabled",
      "bluetooth.dhcp_range",
      "bluetooth.dhcp_lease_time",
      "bluetooth.dhcp_dns",
      "bluetooth.request_dhcp",
      "bluetooth.auto_discover_peers",
      "bluetooth.poll_interval_ms",
      "bluetooth.scan_interval_ms",
      "bluetooth.peer_discovery_interval_ms",
      "bluetooth.bluetoothctl_timeout_s",
      "bluetooth.discoverable_timeout_s",
      "bluetooth.startup_timeout_ms",
    ],
  },
  bluetooth_rfcomm: {
    id: "bluetooth_rfcomm",
    title: "BLUETOOTH RFCOMM",
    tomlKeys: [
      "bluetooth_rfcomm.enabled",
      "bluetooth_rfcomm.channel",
      "bluetooth_rfcomm.device_name_prefix",
      "bluetooth_rfcomm.outbound_enabled",
      "bluetooth_rfcomm.poll_interval_ms",
      "bluetooth_rfcomm.bridge_to_tcp",
    ],
  },
  wifi_direct: {
    id: "wifi_direct",
    title: "WI-FI DIRECT",
    tomlKeys: [
      "wifi_direct.enabled",
      "wifi_direct.interface",
      "wifi_direct.go_intent",
      "wifi_direct.listen_channel",
      "wifi_direct.op_channel",
      "wifi_direct.connect_method",
    ],
  },
  transport: {
    id: "transport",
    title: "TRANSPORT",
    tomlKeys: [
      "transport.type",
      "transport.listen_port",
      "transport.max_reconnect_attempts",
      "transport.connect_timeout_ms",
    ],
  },
  routing: {
    id: "routing",
    title: "ROUTING",
    tomlKeys: [
      "routing.max_hops",
      "routing.algorithm",
      "routing.route_expiry_s",
    ],
  },
  relay: {
    id: "relay",
    title: "RELAY",
    tomlKeys: ["relay.enabled"],
  },
  gateway: {
    id: "gateway",
    title: "GATEWAY",
    tomlKeys: [
      "gateway.enabled",
      "gateway.nat_interface",
      "gateway.max_connections",
    ],
  },
  trust: {
    id: "trust",
    title: "TRUST",
    tomlKeys: [
      "security.authorization_policy",
      "security.authorized_peers",
      "security.trust_store_file",
      "security.key_file",
      "security.require_encryption",
    ],
  },
  notifications: {
    id: "notifications",
    title: "NOTIFICATIONS",
    // UI-side preferences (not daemon-backed in v1). Kept as a section
    // so existing pending-restart / dirty-tracking infrastructure
    // works uniformly. Will gain real fields in Phase 5.
    tomlKeys: [],
  },
  advanced: {
    id: "advanced",
    title: "ADVANCED — RAW CONFIG",
    // Raw TOML editor saves the textarea verbatim; no form-mapped keys.
    tomlKeys: [],
  },
};
