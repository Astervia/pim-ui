/**
 * Wire-name → human description map.
 *
 * Single source of truth consumed by <WireNameTooltip />. Every key
 * matches a daemon TOML path (`section.field`). The descriptions are
 * concise prose explaining WHAT the setting does and WHY a user might
 * change it. Keep them under ~140 chars so they fit a small tooltip
 * surface without scrolling.
 *
 * When a key is missing from the map, the tooltip falls back to
 * surfacing only the wire name (preserves the original Phase 3
 * behaviour for any field not yet documented).
 */

export interface WireDoc {
  description: string;
  /** Optional default value rendered as `default: …` under the description. */
  default?: string;
  /** Optional unit hint (e.g. "ms", "seconds", "bytes"). */
  unit?: string;
}

export const WIRE_DOCS: Readonly<Record<string, WireDoc>> = {
  // ── node ────────────────────────────────────────────────────────
  "node.name": {
    description:
      "Human-readable label for this device. Shows on peer rows and in invitations.",
  },
  node_id: {
    description:
      "64-char Ed25519 public-key fingerprint that uniquely identifies this node. Generated once on first run.",
  },
  short_id: {
    description: "First 8 hex chars of node_id — enough to spot the peer in a list.",
  },
  public_key: {
    description: "Ed25519 public key the daemon advertises to peers during the noise handshake.",
  },

  // ── interface ───────────────────────────────────────────────────
  "interface.name": {
    description:
      "OS-level name of the TUN interface the daemon creates (e.g. utun7 on macOS, pim0 on Linux).",
  },
  "interface.mtu": {
    description: "Maximum transmission unit. Lower = safer over flaky links; higher = better throughput.",
    default: "1280",
    unit: "bytes",
  },
  "interface.mesh_ip": {
    description: "This node's IPv4 address inside the mesh overlay. Static when set, auto-assigned otherwise.",
  },

  // ── transport ───────────────────────────────────────────────────
  "transport.listen_port": {
    description: "TCP port the daemon listens on for inbound peer connections.",
    default: "9100",
  },
  "transport.connect_timeout_ms": {
    description: "How long to wait for a TCP handshake before giving up on a peer.",
    unit: "ms",
  },
  "transport.keepalive_ms": {
    description: "Idle interval before sending a keepalive probe over an established peer connection.",
    unit: "ms",
  },

  // ── discovery ───────────────────────────────────────────────────
  "discovery.enabled": {
    description: "Find peers on the local network via UDP broadcasts. Limited to one broadcast domain.",
    default: "true",
  },
  "discovery.port": {
    description: "UDP port for sending and receiving peer-presence advertisements.",
    default: "9101",
  },
  "discovery.broadcast_interval_ms": {
    description: "How often this node broadcasts its presence to the local network.",
    default: "5000",
    unit: "ms",
  },
  "discovery.peer_timeout_ms": {
    description: "How long an unseen peer remains in the table before the daemon expires it.",
    default: "30000",
    unit: "ms",
  },
  "discovery.connect_relays": {
    description: "Auto-connect to peers that advertise the relay capability — needed to reach distant nodes.",
    default: "true",
  },
  "discovery.connect_gateways": {
    description: "Auto-connect to peers that advertise an internet gateway — needed for split-default routing.",
    default: "true",
  },
  "discovery.shared_key": {
    description:
      "Optional 64-hex-char group key. Only nodes with the same key decode each other's discovery broadcasts. Does NOT replace the noise handshake — it just gates LAN visibility.",
  },

  // ── bluetooth ───────────────────────────────────────────────────
  "bluetooth.enabled": {
    description: "Discover and pair peers over Bluetooth PAN. Useful when no Wi-Fi is available.",
  },
  "bluetooth.interface": {
    description: "Bluetooth controller name to use (e.g. hci0 on Linux). Leave empty for the default.",
  },
  "bluetooth.device_name_prefix": {
    description: "Prefix the daemon prepends to the bluetooth device name when advertising itself.",
  },
  "bluetooth.local_alias": {
    description: "Local Bluetooth alias broadcast to nearby devices. Empty derives from node.name.",
  },
  "bluetooth.radio_discovery_enabled": {
    description: "Allow the bluetooth radio to actively scan for nearby pim devices.",
  },
  "bluetooth.connect_pan": {
    description: "Connect to peers' Bluetooth PAN networks as a client when found.",
  },
  "bluetooth.auto_discover_peers": {
    description: "Automatically discover and pair with nearby pim peers without confirmation.",
  },
  "bluetooth.request_dhcp": {
    description: "Request a DHCP lease over the bluetooth bridge so this node gets a routable address.",
  },
  "bluetooth.serve_nap": {
    description: "Run as a Bluetooth NAP server — peers can connect through us. Linux-only feature.",
  },
  "bluetooth.nap_bridge": {
    description: "Linux bridge interface used to forward Bluetooth-PAN traffic. NAP-server-only.",
  },
  "bluetooth.nap_bridge_addr": {
    description: "IPv4/CIDR address assigned to the NAP bridge interface (e.g. 192.168.44.1/24).",
  },
  "bluetooth.dhcp_enabled": {
    description: "Run dnsmasq behind the NAP bridge so connecting peers get IP addresses automatically.",
  },
  "bluetooth.dhcp_range": {
    description: "DHCP lease range distributed by the NAP DHCP server (e.g. 192.168.44.10,192.168.44.50,12h).",
  },
  "bluetooth.dhcp_lease_time": {
    description: "How long a DHCP lease remains valid before the client must renew.",
  },
  "bluetooth.dhcp_dns": {
    description: "DNS server pushed to clients via DHCP option 6 (e.g. 1.1.1.1,9.9.9.9).",
  },
  "bluetooth.poll_interval_ms": {
    description: "How often to poll bluetoothctl for adapter state changes.",
    unit: "ms",
  },
  "bluetooth.scan_interval_ms": {
    description: "How often to start a fresh bluetooth scan when actively looking for peers.",
    unit: "ms",
  },
  "bluetooth.peer_discovery_interval_ms": {
    description: "How often to retry pim peer discovery between bluetooth scans.",
    unit: "ms",
  },
  "bluetooth.bluetoothctl_timeout_s": {
    description: "Timeout for any bluetoothctl shell-out before the daemon gives up on it.",
    unit: "seconds",
  },
  "bluetooth.discoverable_timeout_s": {
    description: "How long the local bluetooth adapter stays discoverable per cycle.",
    unit: "seconds",
  },
  "bluetooth.startup_timeout_ms": {
    description: "Maximum time the daemon waits for the bluetooth radio to come up at startup.",
    unit: "ms",
  },

  // ── bluetooth_rfcomm ────────────────────────────────────────────
  "bluetooth_rfcomm.enabled": {
    description:
      "Scan paired Bluetooth devices by name prefix, open RFCOMM channels, and exchange PIM identity frames. Independent from PAN/NAP.",
    default: "false",
  },
  "bluetooth_rfcomm.channel": {
    description: "RFCOMM channel to bind and dial. 22 avoids common SPP channel conflicts.",
    default: "22",
  },
  "bluetooth_rfcomm.device_name_prefix": {
    description: "Filter paired Bluetooth devices by name prefix when looking for PIM peers.",
    default: "PIM-",
  },
  "bluetooth_rfcomm.outbound_enabled": {
    description: "Periodically scan paired devices and dial out over RFCOMM. Disable for inbound-only nodes.",
    default: "true",
  },
  "bluetooth_rfcomm.poll_interval_ms": {
    description: "How often to poll the paired-device list for outbound RFCOMM dial attempts.",
    default: "30000",
    unit: "ms",
  },
  "bluetooth_rfcomm.bridge_to_tcp": {
    description:
      "Bridge established RFCOMM sessions into 127.0.0.1:<transport.listen_port> so normal PIM handshakes are reused. Disable for discovery-only deployments.",
    default: "true",
  },

  // ── wifi_direct ─────────────────────────────────────────────────
  "wifi_direct.enabled": {
    description: "Enable Wi-Fi Direct (P2P) peer discovery and pairing.",
  },
  "wifi_direct.interface": {
    description: "Wireless interface to use for Wi-Fi Direct (e.g. wlan0 on Linux).",
  },
  "wifi_direct.go_intent": {
    description:
      "Group-Owner intent (0–15). Higher = more likely to host the P2P group; lower = more likely to be a client.",
    default: "7",
  },
  "wifi_direct.connect_method": {
    description: "How to authenticate the P2P pairing (PBC / PIN / displayed PIN).",
  },
  "wifi_direct.scan_interval_ms": {
    description: "How often to scan for nearby Wi-Fi Direct devices.",
    unit: "ms",
  },

  // ── routing ─────────────────────────────────────────────────────
  "routing.max_hops": {
    description:
      "Maximum number of relays a packet may traverse before being dropped. Caps unbounded paths through the mesh.",
    default: "16",
  },
  "routing.algorithm": {
    description: "Distance-vector algorithm name. Only one is supported today.",
  },
  "routing.advertise_interval_ms": {
    description: "How often this node advertises its installed routes to neighbours.",
    unit: "ms",
  },
  "routing.route_expiry_ms": {
    description: "How long a learned route remains in the table without being re-advertised.",
    unit: "ms",
  },

  // ── relay ───────────────────────────────────────────────────────
  "relay.enabled": {
    description:
      "Forward traffic for other peers — necessary for multi-hop reachability. Costs you bandwidth.",
  },

  // ── gateway ─────────────────────────────────────────────────────
  "gateway.enabled": {
    description:
      "Share your internet connection with the mesh — peers route through you to the public internet. Linux-only today.",
  },
  "gateway.nat_interface": {
    description:
      "External (uplink) interface that NAT'd traffic exits through (e.g. eth0, wlan0). Must have a public/upstream IP.",
  },
  "gateway.max_connections": {
    description:
      "conntrack limit for sessions through this gateway. Hitting the cap drops new connections — raise carefully.",
  },

  // ── security ────────────────────────────────────────────────────
  "security.authorization_policy": {
    description:
      "Who is allowed to peer with this node: allow_all (open), allow_list (only listed peers), or tofu (trust on first use).",
  },
  "security.require_encryption": {
    description:
      "Reject peers that don't complete the noise/X25519 handshake. Always on by default — disable only for protocol research.",
    default: "true",
  },
  "security.key_file": {
    description: "Filesystem path to this node's Ed25519 private key. Managed by the daemon — handle with care.",
  },
  "security.trust_store_file": {
    description: "Filesystem path to the TOFU trust store (peers approved on first contact).",
  },
  "security.authorized_peers": {
    description: "Explicit list of node_ids permitted to peer with this node when policy = allow_list.",
  },

  // ── notifications (UI-side, not daemon) ─────────────────────────
  "notifications.all_gateways_lost": {
    description:
      "Show an OS notification when every known gateway becomes unreachable while routing is on.",
  },
  "notifications.kill_switch": {
    description:
      "Show an OS notification when the kill-switch engages (routing on but no gateway available).",
  },
};

/** Lookup a documented description for a wire name. Returns null when undocumented. */
export function getWireDoc(wireName: string): WireDoc | null {
  return WIRE_DOCS[wireName] ?? null;
}
