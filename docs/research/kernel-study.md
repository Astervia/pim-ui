# PIM Kernel Study — Comprehensive UX Requirements for pim-ui

**Document**: Exhaustive analysis of proximity-internet-mesh repository for UI feature exposure  
**Target**: Tauri 2 + React desktop/mobile app (pim-ui)  
**Scope**: All commands, config fields, roles, discovery mechanisms, security, runtime observability, routing, gateway, and platform quirks  
**Thoroughness Level**: Very thorough (foundation for UX planning)

---

## 1. CLI Surface

### 1.1 Command Structure

**File**: `/crates/pim-cli/src/main.rs` (lines 27-87)

The CLI has a hierarchical structure with the root binary `pim` and multiple subcommands:

#### 1.1.1 `pim up` — Start the daemon

**Exact Invocation:**
```
pim up [--config <path>] [--daemon] [--pid-file <path>]
```

**Flags and Defaults** (lines 38–50):
- `--config <path>`: Path to TOML config file. Default: `/etc/pim/pim.toml` (DEFAULT_CONFIG, line 20)
- `--pid-file <path>`: Where daemon writes its PID. Default: `/run/pim.pid` (DEFAULT_PID_FILE, line 21)
- `--daemon`: Boolean flag (short `-d`, long `--daemon`). When set, daemonize (background). When absent, run in foreground.

**Behavior** (lines 239–274):
- Validates config file exists; bails if not found
- Locates `pim-daemon` binary (same directory as `pim` CLI, then PATH search, lines 690–710)
- If `--daemon` true: spawns daemon in background with null stdio, prints PID
- If `--daemon` false: runs daemon in foreground, waits for exit, propagates daemon exit code

**Output**: 
- Success: `"pim daemon started (pid {pid})"` (line 259)
- Failure: Error message with context (e.g., binary not found, config missing, daemon exit error)

**Requires Root/Sudo**: YES — Creating TUN interface requires `CAP_NET_ADMIN` or full root

**Platform Constraints**: Linux and macOS supported; Windows not supported (no TUN implementation)

---

#### 1.1.2 `pim down` — Stop the daemon

**Exact Invocation:**
```
pim down [--pid-file <path>]
```

**Flags and Defaults** (lines 53–56):
- `--pid-file <path>`: Path to PID file. Default: `/run/pim.pid`

**Behavior** (lines 279–292 for Unix):
- Reads PID from file
- Sends `SIGTERM` signal to process (libc::kill with signal 15)
- Prints confirmation: `"Sent SIGTERM to pim daemon (pid {pid})"`

**Output**: Success message or error (e.g., PID file not found, process not alive)

**Requires Root/Sudo**: YES — Most systems require elevated privilege to write PID file at `/run/`

**Platform Constraints**: Unix only (lines 279–297); Windows returns error "not supported on non-Unix systems"

---

#### 1.1.3 `pim status` — Inspect daemon state

**Exact Invocation:**
```
pim status [--pid-file <path>] [--verbose]
```

**Flags and Defaults** (lines 60–68):
- `--pid-file <path>`: Path to PID file. Default: `/run/pim.pid`
- `--verbose` (short `-v`): Enable detailed live metrics

**Behavior** (lines 301–346):
1. Checks if PID file exists
2. If missing: prints `"pim: stopped (no PID file at {path})"`, exits OK
3. If present:
   - Reads PID, checks process alive via `kill(pid, 0)` system call
   - If alive:
     - Reads config info from `/etc/pim/pim.toml` (line 747–756)
     - Prints: node name, mesh IP, role (gateway vs client), listen port
     - If `--verbose`: reads `/run/pim.stats` (line 725, 737–744)
       - Stats format: key=value pairs, one per line
       - Example: `peers=3\nroutes=5\npackets_forwarded=100\n...`
   - If not alive: prints stale PID message, attempts cleanup of PID file

**Output**:
```
pim: running (pid 1234)
  node:      my-node
  mesh_ip:   10.77.0.2/24
  role:      client
  transport: :9100

Live metrics:
  peers:                 3
  routes:                12
  packets_forwarded:     50000
  bytes_forwarded:       25165824
  dropped_packets:       10
  congestion_drops:      0
  conntrack_size:        50
  uptime_secs:           3600
```

**Requires Root/Sudo**: Generally yes (accessing `/run/` files on many systems), but status can be read by unprivileged users if file permissions allow

**Platform Constraints**: Unix-like systems; Windows uses different process checking

---

#### 1.1.4 `pim route on|off|status` — Control split-default routing

**Exact Invocation:**
```
pim route on   [--config <path>]
pim route off  [--config <path>]
pim route status [--config <path>]
```

**Flags and Defaults** (lines 114–132):
- `--config <path>`: Path to TOML config. Default: `/etc/pim/pim.toml`

**Behavior** (lines 392–443):

**`pim route on`** (lines 392–404):
- Loads config to get interface name and mesh gateway IP
- Ensures `pim0` (or configured interface name) is present via `ip link show` or `ifconfig`
- Calls platform-specific route setup for split-default routes
  - **Linux** (lines 833–855): Uses `ip route replace` for `0.0.0.0/1` and `128.0.0.0/1` with `onlink` flag
  - **macOS** (lines 858–880): Deletes (silently ignores if absent) then adds routes via `route` command
  - **Other**: Returns error "not supported on this platform"
- Prints: `"pim routes enabled via {gateway_ip} dev {interface}"`

**`pim route off`** (lines 407–422):
- Loads config for interface and gateway IP
- Removes split-default routes (counts successful removals)
- Prints: `"pim routes disabled"` or `"pim routes already disabled"`

**`pim route status`** (lines 425–443):
- Loads config
- Checks if both split-default routes (0.0.0.0/1 and 128.0.0.0/1) are present
- **Linux** (lines 927–934): Parses `ip route show` output
- **macOS** (lines 937–956): Probes with `route get` for sentinel IPs (1.1.1.1 for 0.0.0.0/1, 129.0.0.1 for 128.0.0.0/1)
- Prints status: `"pim routes: enabled..."` or `"pim routes: disabled (expected...)"`

**Output**: Status messages (human-readable), no JSON

**Requires Root/Sudo**: YES — Modifying routing table requires elevated privilege

**Platform Constraints**: Linux and macOS; Windows not supported (uses platform-specific route commands)

**Critical Note**: Interface must be up before `pim route on` can work. For clients with `mesh_ip = "auto"`, the daemon must have negotiated an IP from gateway first.

---

#### 1.1.5 `pim config generate` — Generate config templates

**Exact Invocation:**
```
pim config generate <roles...> [--name <node_name>] [--output <path>] [--force]
```

**Arguments and Flags** (lines 92–108):
- `<roles...>`: One or more of: `client`, `relay`, `gateway` (ValueEnum, lines 185–190)
- `--name <string>`: Override generated node name
- `--output <path>`: Write to file instead of stdout
- `--force`: Overwrite existing file without prompting

**Behavior** (lines 351–388):
- Calls `render_config_template()` with roles and optional name override (lines 1022–1236)
- Template generation:
  - Role-specific defaults (lines 1261–1290):
    - **Gateway**: `mesh_ip = "10.77.0.1/24"`, enables gateway section
    - **Relay**: `mesh_ip = "10.77.0.10/24"`
    - **Client**: `mesh_ip = "auto"` (request from gateway), gateway section commented
  - Platform defaults (lines 1271–1281):
    - **macOS**: interface name `utun0`, route commands differ
    - **Linux/other**: interface name `pim0`
  - Includes all sections with defaults and comments
- If `--output`: writes to file (mode 0o600 on Unix for security), confirms with message
- If no `--output`: prints to stdout

**Output**: TOML template (commented, human-readable)

**Requires Root/Sudo**: NO — Just generates text

**Platform Constraints**: Cross-platform; platform-specific defaults applied based on build target

---

### 1.1.6 `pim debug` — Inspect live mesh state

**Exact Invocation:**
```
pim debug peers [--snapshot <path>]
pim debug routes [--snapshot <path>]
pim debug gateways [--snapshot <path>]
pim debug discovery [--snapshot <path>]
pim debug route get <target> [--snapshot <path>]
```

**Flags and Defaults** (lines 139–182):
- `--snapshot <path>`: Path to debug snapshot JSON. Default: `/run/pim-debug.json`

**File Format**: JSON serialized `DebugSnapshot` struct (lines 8–26 of `/crates/pim-core/src/debug.rs`)

#### 1.1.6.1 `pim debug peers`

**Behavior** (lines 448–473):
Reads snapshot, lists connected peers with details:
- node ID (full and short)
- mechanism (tcp, bluetooth, etc.)
- transport address
- heartbeat age (ms)
- whether configured vs discovered
- whether direct connection

**Output**:
```
connected peers: 3  node=client-a (abc123de...)
  def456gh...  direct=true  mechanism=tcp  addr=192.168.1.1:9100  configured=true  discovered=false  hb_age=245ms
  jkl789mn...  direct=false  mechanism=unknown  addr=-  configured=false  discovered=true  hb_age=-
  ...
```

#### 1.1.6.2 `pim debug routes`

**Behavior** (lines 476–504):
Lists all installed routes from routing table:
- destination node ID
- next hop node ID
- hop count
- learned-from node
- is gateway route
- RTT (ms) if known
- mesh IP (if known)
- age (ms)
- whether next hop is blacklisted

**Output**:
```
installed routes: 12
  abc123de...  via=def456gh...  hops=1  learned_from=def456gh...  gateway=false  load=0  rtt=5ms  mesh_ip=10.77.0.2/24  age=123ms  blacklisted=false
  ...
```

#### 1.1.6.3 `pim debug gateways`

**Behavior** (lines 507–534):
Lists known gateways sorted by preference (selected gateway marked with `*`):
- node ID
- next hop (path to gateway)
- hops
- score (calculated by gateway_score function)
- load (advertised by gateway)
- RTT
- mesh IP

**Output**:
```
known gateways: 2
* gw-1-node-id...  via=relay1-id...  hops=2  score=80  load=25  rtt=15ms  mesh_ip=10.77.0.1/24
  gw-2-node-id...  via=relay2-id...  hops=3  score=70  load=60  rtt=25ms  mesh_ip=10.77.0.1/24
```

#### 1.1.6.4 `pim debug discovery`

**Behavior** (lines 537–556):
Lists all peers seen by discovery layer (whether connected or not):
- node ID (full and short)
- transport address
- capabilities: is_client, is_relay, is_gateway (boolean flags)
- last seen age (ms)

**Output**:
```
discovered peers: 5
  abc123...  addr=192.168.1.10:9100  client=true  relay=false  gateway=false  age=2000ms
  def456...  addr=192.168.1.11:9100  client=false  relay=true  gateway=false  age=500ms
  ...
```

#### 1.1.6.5 `pim debug route get <target>`

**Behavior** (lines 559–601):
Explains the current route to a destination:
- `<target>` can be: 32-char node ID hex, mesh IPv4 (e.g., 10.77.0.2), or literal "internet"
- If target is "internet": shows selected gateway info (or error if node is gateway itself)
- Otherwise: shows installed route entry with full details

**Output**:
```
internet route:
  gateway:   gw-abc123...
  next_hop:  relay-def456...
  hops:      2
  score:     85
  mechanism: tcp

OR

route:
  destination: abc123de...
  next_hop:    def456gh...
  mechanism:   tcp
  hops:        1
  learned_from: def456gh...
  gateway:     false
  gateway_load: 0
  rtt:         5ms
  mesh_ip:     10.77.0.2/24
  age_ms:      234
  blacklisted: false
```

**Requires Root/Sudo**: NO — Debug snapshots are readable by any user with permission

**Platform Constraints**: Cross-platform

---

### 1.2 Summary of CLI Command Surface

| Command | What It Does | Requires Root | Output Type | Platform |
|---------|-------------|---------------|------------|----------|
| `pim up` | Start daemon (foreground or daemonized) | YES | Status message | Linux, macOS |
| `pim down` | Stop daemon (SIGTERM) | YES | Status message | Unix only |
| `pim status` | Show daemon status, optional verbose metrics | Maybe | Human-readable text | Unix |
| `pim route on` | Install split-default routes | YES | Status message | Linux, macOS |
| `pim route off` | Remove split-default routes | YES | Status message | Linux, macOS |
| `pim route status` | Check route state | Maybe | Status message | Linux, macOS |
| `pim config generate` | Render TOML template | NO | TOML text | All |
| `pim debug peers` | List connected peers | NO | Human-readable text | All |
| `pim debug routes` | List installed routes | NO | Human-readable text | All |
| `pim debug gateways` | List known gateways | NO | Human-readable text | All |
| `pim debug discovery` | List discovered peers | NO | Human-readable text | All |
| `pim debug route get` | Explain route to target | NO | Human-readable text | All |

---

## 2. Config Schema

**File**: `/crates/pim-core/src/config.rs` (all structures and defaults documented in lines 9–398)

### 2.1 Top-Level Sections

The config is a TOML file with these sections:

#### 2.1.1 `[node]` — Identity and local state

**Struct** (lines 46–54):
```rust
pub struct NodeConfig {
    pub name: String,                    // Required
    #[serde(default = "default_data_dir")]
    pub data_dir: PathBuf,              // Optional, default: ~/.pim
}
```

| Field | Type | Default | Required | Meaning |
|-------|------|---------|----------|---------|
| `name` | string | (none) | YES | Human-readable node name for logs, displayed in status output. No length limit enforced in code; practical limit ~32 chars recommended. |
| `data_dir` | filesystem path | `~/.pim` | NO | Where daemon stores generated keys, trusted-peers store, and runtime metadata. Must be writable by daemon process. |

**Validation Logic**: None explicit; TOML parsing itself enforces types. Directory must exist or daemon creates it.

---

#### 2.1.2 `[interface]` — TUN interface settings

**Struct** (lines 56–68):
```rust
pub struct InterfaceConfig {
    #[serde(default = "default_interface_name")]
    pub name: String,               // pim0 or utunN
    #[serde(default = "default_mtu")]
    pub mtu: u32,                  // bytes, default 1400
    #[serde(default = "default_mesh_ip")]
    pub mesh_ip: String,           // CIDR or "auto"
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `name` | string | Platform-dependent: `pim0` (Linux), `utun0` (macOS) | Platform-specific names | Name of TUN interface to create/use. Linux: max 15 chars, no special chars. macOS: must match `utunN` pattern. |
| `mtu` | u32 | 1400 | 500–16000 (typical) | MTU in bytes. Align with other mesh peers. Affects fragmentation thresholds. |
| `mesh_ip` | string | `"auto"` | IPv4 CIDR (e.g. `"10.77.0.2/24"`) OR `"auto"` | Mesh-layer IPv4 address. `"auto"` means request assignment from gateway. Static value enables standalone operation. |

**Platform Quirks**:
- **Linux** (line 265): Default `pim0`
- **macOS** (line 274): Default `utun0`; must use `utunN` format where N is 0-9
- macOS utun devices have kernel-imposed numbering; user can request a name but kernel assigns the actual device

---

#### 2.1.3 `[discovery]` — Peer discovery settings

**Struct** (lines 70–95):
```rust
pub struct DiscoveryConfig {
    #[serde(default = "default_discovery_enabled")]
    pub enabled: bool,                  // true by default
    #[serde(default = "default_discovery_port")]
    pub port: u16,                     // 9101
    #[serde(default = "default_broadcast_interval_ms")]
    pub broadcast_interval_ms: u64,    // 5000
    #[serde(default = "default_peer_timeout_ms")]
    pub peer_timeout_ms: u64,          // 30000
    #[serde(default = "default_connect_relays")]
    pub connect_relays: bool,          // true
    #[serde(default = "default_connect_gateways")]
    pub connect_gateways: bool,        // true
    #[serde(default)]
    pub shared_key: Option<String>,    // None
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `enabled` | bool | `true` | `true`, `false` | Enable/disable broadcast discovery. If false, only static peers are used. |
| `port` | u16 | 9101 | 1–65535 | UDP port for discovery broadcasts. Must not conflict with `transport.listen_port`. |
| `broadcast_interval_ms` | u64 | 5000 | 100–60000 (typical) | How often to send discovery packets (in ms). Higher → less overhead, slower peer detection. |
| `peer_timeout_ms` | u64 | 30000 | 5000–300000 | How long before unseen peer is forgotten (in ms). Higher → more resilience to transient drops, slower churn detection. |
| `connect_relays` | bool | `true` | `true`, `false` | Automatically initiate connections to discovered relay nodes (if not already connected). |
| `connect_gateways` | bool | `true` | `true`, `false` | Automatically initiate connections to discovered gateway nodes. |
| `shared_key` | string option | `null` | 64 hex characters (32 bytes) | Optional discovery group encryption key. When set, only nodes with same key can decode broadcasts. Format: 64-char hex string representing 32 bytes. |

**Discovery Mechanism**: UDP broadcast on local LAN. All nodes on the same subnet receive each other's broadcasts. Each broadcast includes node ID, capabilities (client/relay/gateway), and transport address. Nodes receiving broadcasts add sender to a "discovered peers" table and may auto-connect if `connect_relays` or `connect_gateways` is true.

---

#### 2.1.4 `[relay]` — Relay forwarding configuration

**Struct** (lines 97–104):
```rust
pub struct RelayConfig {
    #[serde(default)]
    pub enabled: bool,  // default false
}
```

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `enabled` | bool | `false` | Enable relay forwarding. When true, node forwards mesh frames not destined for itself. Note: gateways always relay regardless of this setting. |

**Behavior**: If enabled, node participates in multi-hop routing, forwarding frames to next-hop peers. Requires `TTL > 0` and a valid route to destination.

---

#### 2.1.5 `[transport]` — Peer-to-peer transport layer

**Struct** (lines 106–115):
```rust
pub struct TransportConfig {
    #[serde(default = "default_transport_type")]
    pub r#type: String,            // "tcp"
    #[serde(default = "default_listen_port")]
    pub listen_port: u16,          // 9100
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `type` | string | `"tcp"` | Currently only `"tcp"` | Transport backend. Future: Bluetooth PAN, Wi-Fi Direct. |
| `listen_port` | u16 | 9100 | 1–65535, not overlapping with discovery port | Local TCP port daemon listens on for incoming peer connections. |

---

#### 2.1.6 `[routing]` — Route propagation and expiry

**Struct** (lines 117–129):
```rust
pub struct RoutingConfig {
    #[serde(default = "default_max_hops")]
    pub max_hops: u8,                 // 10
    #[serde(default = "default_route_algorithm")]
    pub algorithm: String,            // "distance-vector"
    #[serde(default = "default_route_expiry_s")]
    pub route_expiry_s: u64,         // 300
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `max_hops` | u8 | 10 | 2–255 | Maximum hops before route is considered unusable (TTL limit). Packets with TTL=0 are dropped. |
| `algorithm` | string | `"distance-vector"` | Currently only `"distance-vector"` | Routing algorithm identifier. Used for diagnostics and future extensibility. |
| `route_expiry_s` | u64 | 300 | 30–3600 (typical) | Route lifetime in seconds. Routes older than this are purged. Controls route churn. |

**Distance-Vector Details**: Each node periodically broadcasts its known routes to neighbors. Each route includes destination node ID, hop count, next hop, and gateway load. Nodes merge received routes into their routing table, selecting best routes by hop count (and gateway load for gateway routes).

---

#### 2.1.7 `[gateway]` — Internet gateway and NAT settings

**Struct** (lines 131–143):
```rust
pub struct GatewayConfig {
    #[serde(default)]
    pub enabled: bool,                    // false
    #[serde(default = "default_nat_interface")]
    pub nat_interface: String,           // "eth0"
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,            // 200
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `enabled` | bool | `false` | `true`, `false` | Enable gateway/NAT mode. Requires Linux, iptables, and CAP_NET_ADMIN. |
| `nat_interface` | string | `"eth0"` | Real interface name (e.g., `"eth0"`, `"wlan0"`) | Internet-facing network interface. Gateway uses this for SNAT of mesh traffic. Must have internet connectivity. |
| `max_connections` | u32 | 200 | 10–65535 | Maximum number of tracked NAT connections. When exceeded, new flows are dropped with error. |

**Gateway Behavior**: 
- When enabled, node becomes a gateway providing internet access to mesh clients
- Daemon performs NAT (masquerading) on `nat_interface`, rewriting source IP/port of outbound mesh traffic
- Tracks connections in conntrack table with idle timeouts: TCP 300s, UDP 30s, ICMP 10s
- Advertises itself via routing updates as a gateway route with load (number of active connections)

**Linux-Only**: Gateway mode requires:
- Linux OS (iptables integration)
- `/dev/net/tun` device
- Capability `CAP_NET_ADMIN` (or root)
- `iptables` and `sysctl` binaries in PATH
- Internet-facing interface with real IP address

---

#### 2.1.8 `[security]` — Encryption and authentication

**Struct** (lines 145–163):
```rust
pub struct SecurityConfig {
    #[serde(default = "default_key_file")]
    pub key_file: PathBuf,                    // ~/.pim/node.key
    #[serde(default = "default_require_encryption")]
    pub require_encryption: bool,             // true
    #[serde(default)]
    pub authorization_policy: AuthorizationPolicy,  // AllowAll
    #[serde(default)]
    pub authorized_peers: Vec<crate::NodeId>,      // []
    #[serde(default = "default_trust_store_file")]
    pub trust_store_file: PathBuf,           // ~/.pim/trusted-peers.toml
}

pub enum AuthorizationPolicy {
    #[default]
    AllowAll,              // line 170
    AllowList,             // line 172
    TrustOnFirstUse,       // line 174
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `key_file` | path | `~/.pim/node.key` | Filesystem path (must be writable) | Ed25519 private key file. Generated on first run if absent. Must be readable by daemon only (mode 0o600 recommended). |
| `require_encryption` | bool | `true` | `true`, `false` | Reject unencrypted peer sessions. If false, allows backward compatibility with unencrypted nodes (not recommended). |
| `authorization_policy` | enum | `allow_all` | `allow_all`, `allow_list`, `trust_on_first_use` | Policy for accepting new direct peer connections after authentication. |
| `authorized_peers` | array of node IDs | `[]` | List of 32-char hex node IDs | Used only when `authorization_policy = "allow_list"`. Nodes not in this list are rejected after handshake. |
| `trust_store_file` | path | `~/.pim/trusted-peers.toml` | Filesystem path | Used only when `authorization_policy = "trust_on_first_use"`. Persistent record of trusted peers. |

**Authorization Policies**:
1. **`allow_all`**: Accept any authenticated peer without restriction. Suitable for lab/trusted networks.
2. **`allow_list`**: Accept only peers whose node ID is in `authorized_peers` array. Requires manual configuration. Suitable for closed networks.
3. **`trust_on_first_use` (TOFU)**: Accept peer on first contact, record its public key in `trust_store_file`, reject any peer claiming to be that node ID with a different key. Suitable for small deployments. File format: TOML with entries like `peer-id-hex = "public-key-base64"`.

**Key Management**: 
- Ed25519 keypair stored in `key_file` (PEM format, private key only)
- Public key derived from private key and used as node identity
- Node ID is SHA-256 hash of public key, truncated to 16 bytes, displayed as 32-char hex
- Keys persist across restarts; can be rotated by deleting key file and restarting daemon

---

#### 2.1.9 `[wifi_direct]` — Wi-Fi Direct discovery and P2P group formation

**Struct** (lines 178–208):
```rust
pub struct WifiDirectConfig {
    #[serde(default)]
    pub enabled: bool,                     // false
    #[serde(default = "default_wfd_interface")]
    pub interface: String,                 // "wlan0"
    #[serde(default = "default_wfd_go_intent")]
    pub go_intent: u8,                     // 7 (neutral)
    #[serde(default = "default_wfd_listen_channel")]
    pub listen_channel: u8,                // 6
    #[serde(default = "default_wfd_op_channel")]
    pub op_channel: u8,                    // 6
    #[serde(default = "default_wfd_connect_method")]
    pub connect_method: String,            // "pbc" or "pin:XXXXXXXX"
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `enabled` | bool | `false` | `true`, `false` | Enable Wi-Fi Direct peer discovery via IEEE 802.11 P2P. Requires wpa_supplicant with P2P support. |
| `interface` | string | `"wlan0"` | Physical Wi-Fi interface name | Which Wi-Fi adapter to use for P2P operations. |
| `go_intent` | u8 | 7 | 0–15 | Group Owner intent. Higher values → more likely to become GO. 7 is neutral. 15 → always try to be GO. 0 → never be GO. |
| `listen_channel` | u8 | 6 | 1–14 (2.4 GHz), or 36–165 (5 GHz) | 802.11 channel where device listens for P2P discovery frames. |
| `op_channel` | u8 | 6 | Same as listen_channel | Channel to operate on once P2P group is formed. Can differ from listen channel. |
| `connect_method` | string | `"pbc"` | `"pbc"` OR `"pin:XXXXXXXX"` (8-digit) | Connection method: `"pbc"` (push-button, automatic) or `"pin:12345678"` (user must enter PIN on both devices). |

**Behavior**: When enabled, daemon uses `wpa_cli` to discover nearby Wi-Fi Direct devices, negotiate group formation, and establish TCP transport over the resulting P2P link. Requires:
- Linux
- `wpa_supplicant` with P2P support running on the interface
- Device with Wi-Fi Direct capability

---

#### 2.1.10 `[bluetooth]` — Bluetooth PAN link monitoring and discovery

**Struct** (lines 218–256):
```rust
pub struct BluetoothConfig {
    #[serde(default)]
    pub enabled: bool,                                // false
    #[serde(default = "default_bluetooth_interface")]
    pub interface: String,                           // "bnep0"
    #[serde(default = "default_bluetooth_radio_discovery_enabled")]
    pub radio_discovery_enabled: bool,               // true
    #[serde(default = "default_bluetooth_device_name_prefix")]
    pub device_name_prefix: String,                  // "PIM-"
    #[serde(default)]
    pub local_alias: String,                         // "" (derived from node name)
    #[serde(default = "default_bluetooth_auto_discover_peers")]
    pub auto_discover_peers: bool,                   // true
    #[serde(default = "default_bluetooth_poll_interval_ms")]
    pub poll_interval_ms: u64,                       // 2000
    #[serde(default = "default_bluetooth_scan_interval_ms")]
    pub scan_interval_ms: u64,                       // 5000
    #[serde(default = "default_bluetooth_peer_discovery_interval_ms")]
    pub peer_discovery_interval_ms: u64,             // 2000
    #[serde(default = "default_bluetoothctl_timeout_s")]
    pub bluetoothctl_timeout_s: u64,                 // 15
    #[serde(default = "default_bluetooth_discoverable_timeout_s")]
    pub discoverable_timeout_s: u64,                 // 180
    #[serde(default = "default_bluetooth_startup_timeout_ms")]
    pub startup_timeout_ms: u64,                     // 15000
}
```

| Field | Type | Default | Valid Values | Meaning |
|-------|------|---------|--------------|---------|
| `enabled` | bool | `false` | `true`, `false` | Enable Bluetooth PAN monitoring. Waits for `interface` (bnep0) to appear, then auto-discovers peers on it. |
| `interface` | string | `"bnep0"` | Linux bridge interface name | Expected name of Bluetooth PAN interface. Daemon monitors this interface for peer IPs. |
| `radio_discovery_enabled` | bool | `true` | `true`, `false` | Enable radio-level Bluetooth discovery (scan for devices, attempt pairing). |
| `device_name_prefix` | string | `"PIM-"` | Any string | Prefix used to identify PIM nodes by Bluetooth device name. Device names must start with this prefix to be considered PIM peers. |
| `local_alias` | string | `""` | Any string | Local Bluetooth controller alias (device name) to advertise. If empty, derived from node name. |
| `auto_discover_peers` | bool | `true` | `true`, `false` | Automatically learn peer IPs from PAN interface neighbor table (ARP). |
| `poll_interval_ms` | u64 | 2000 | 100–10000 | How often to check if PAN interface is ready. |
| `scan_interval_ms` | u64 | 5000 | 1000–30000 | How often to perform radio-level device scan (for discovering new nearby devices). |
| `peer_discovery_interval_ms` | u64 | 2000 | 100–10000 | How often to poll PAN neighbor table for new peers. |
| `bluetoothctl_timeout_s` | u64 | 15 | 5–60 | Timeout for `bluetoothctl` command execution. |
| `discoverable_timeout_s` | u64 | 180 | 10–3600 | How long the local Bluetooth controller remains discoverable after daemon startup. |
| `startup_timeout_ms` | u64 | 15000 | 5000–60000 | Maximum time to wait for PAN interface to appear. After this, PAN setup is aborted. |

**Bluetooth Behavior**: Daemon does not manage Bluetooth pairing itself. It assumes:
1. Bluetooth devices are pre-paired via OS Bluetooth settings
2. Bluetooth PAN connection (BNEP) is already established
3. PAN interface (bnep0) has an IP assigned by the system
Daemon then:
1. Monitors for interface appearance
2. Discovers peer IPs from ARP neighbor table
3. Hands IPs to transport layer for TCP connection
4. Optionally performs radio discovery to find new devices (requires pre-pairing or PIN entry)

---

#### 2.1.11 `[[peers]]` — Static peer configuration (array)

**Struct** (lines 453–478):
```rust
pub struct PeerConfig {
    #[serde(default)]
    pub label: String,
    #[serde(flatten)]
    pub endpoint: PeerEndpointConfig,
}

pub enum PeerEndpointConfig {
    Tcp { address: String },           // e.g., "10.0.0.1:9100"
    Bluetooth { ip: String },          // e.g., "192.168.44.2" or IPv6
}
```

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `label` | string | NO | Human-readable peer label (e.g., "gateway", "relay-1"). Used in logs and status output. |
| `mechanism` (in flattened endpoint) | enum | YES | Connection mechanism: `"tcp"` or `"bluetooth"` |
| `address` (if mechanism = tcp) | string | YES | TCP endpoint in format `"host:port"`. Can be IP or hostname (resolved via DNS). |
| `ip` (if mechanism = bluetooth) | string | YES | IPv4 or IPv6 address reachable on Bluetooth PAN interface. Used only if Bluetooth PAN is active. |

**Multiple Peers**: Config supports multiple `[[peers]]` sections. Daemon attempts connections to all configured peers and maintains those connections across restarts.

**Example**:
```toml
[[peers]]
label = "gateway"
mechanism = "tcp"
address = "192.168.1.1:9100"

[[peers]]
label = "relay"
mechanism = "tcp"
address = "relay.example.com:9100"

[[peers]]
label = "nearby-node"
mechanism = "bluetooth"
ip = "192.168.44.2"
```

---

### 2.2 Config File Locations

- **Default Path**: `/etc/pim/pim.toml` (specified in CLI as DEFAULT_CONFIG)
- **Key Files**: `~/.pim/node.key` (Ed25519 private key), `~/.pim/trusted-peers.toml` (TOFU store)
- **Runtime Files**: `/run/pim.pid` (PID), `/run/pim.stats` (metrics), `/run/pim-debug.json` (snapshot)
- **Data Directory**: Configurable via `node.data_dir`; default `~/.pim`

---

### 2.3 UI Complexity Classification

**MUST expose in simple mode:**
- `node.name` — node identity
- `interface.name` — TUN device (with platform-specific UI note)
- `interface.mesh_ip` — static CIDR or "auto" toggle
- `discovery.enabled` — on/off toggle
- `transport.listen_port` — port number
- `routing.max_hops` — hop limit
- `gateway.enabled` — on/off toggle
- `gateway.nat_interface` — dropdown of available interfaces
- `security.authorization_policy` — radio buttons: allow_all, allow_list, trust_on_first_use
- `peers` — table for managing static peers (add/edit/remove)

**SHOULD expose in "advanced" tab:**
- `interface.mtu` — advanced tuning
- `discovery.broadcast_interval_ms`, `peer_timeout_ms` — discovery timing
- `discovery.connect_relays`, `connect_gateways` — auto-connect toggles
- `discovery.shared_key` — optional encryption key for discovery
- `relay.enabled` — relay mode toggle
- `routing.algorithm`, `route_expiry_s` — routing configuration
- `gateway.max_connections` — conntrack table size
- `security.require_encryption`, `authorized_peers`, `trust_store_file` — security details
- `wifi_direct.*`, `bluetooth.*` — detailed discovery mechanism configs

**Should NOT expose:**
- `node.data_dir` — internal detail; hard-code to user standard location
- `security.key_file` — internal; manage programmatically
- Partial/deprecated fields

---

## 3. Node Roles

**References**: `/crates/pim-cli/src/main.rs` lines 185–190 (NodeRole enum), config.rs documentation

### 3.1 Role Definitions

A node can have one or more of three primary roles:

#### 3.1.1 **Client**

**Configuration**: `relay.enabled = false`, `gateway.enabled = false`

**Behavior**:
- Initiates outbound connections to peers (relays or gateways)
- Requests mesh IP from gateway via DHCP-like protocol if `mesh_ip = "auto"`
- Forwards packets only for itself (does not relay traffic for others)
- Sends and receives traffic
- Discovers gateways and selects best one based on hop count, latency, and load

**Hardware/OS Requirements**: Cross-platform (Linux, macOS, Windows with TUN support)

**Example Use Cases**:
- Laptop, desktop, smartphone accessing mesh internet
- Remote device with limited resources

---

#### 3.1.2 **Relay**

**Configuration**: `relay.enabled = true`, `gateway.enabled = false`

**Behavior**:
- Forwards mesh frames for other nodes (decrement TTL, lookup next-hop, re-encrypt, forward)
- Does NOT provide internet access (not a gateway)
- Participates in routing by receiving, propagating, and advertising routes
- Acts as a bridge between network segments
- Usually has stable connectivity and remains powered on

**Hardware/OS Requirements**: Linux or macOS with TUN support (not Windows)

**Multi-role**:
- A relay can also be a client (have traffic of its own)
- A relay cannot be a gateway in current implementation (though architecturally possible)

**Example Use Cases**:
- Fixed infrastructure node (router, edge device) extending mesh range
- Bridge between two mesh segments that cannot see each other directly

---

#### 3.1.3 **Gateway**

**Configuration**: `gateway.enabled = true`

**Behavior**:
- Provides internet access to mesh clients via NAT (network address translation)
- Implicitly acts as a relay (forwards traffic even though `relay.enabled` may be false)
- Advertises itself as a gateway in routing updates with load (conntrack utilization)
- Performs SNAT: rewrites source IP/port of outbound mesh traffic to its internet-facing address
- Tracks connections and rewrites responses back to originating mesh client

**Hardware/OS Requirements**: **Linux only** (requires iptables, `/dev/net/tun`, CAP_NET_ADMIN)

**Key Constraints**:
- Must have internet connectivity on `nat_interface`
- Must have dedicated public/LAN IP address
- Must have permission to run iptables commands
- Cannot be deployed on macOS, Windows, or non-Linux Unix

**Setup Requirements**:
1. Linux system with root/CAP_NET_ADMIN capability
2. `iptables` and `sysctl` binaries in PATH
3. Internet-facing network interface configured (e.g., eth0)
4. Daemon runs setup automatically: calls `iptables` to enable MASQUERADE and `sysctl` to enable IP forwarding

**Example Use Cases**:
- Dedicated gateway (VM, container, edge router)
- Single internet uplink shared by multiple mesh clients

---

### 3.2 Role Transitions

**How a node becomes a role**: Set `gateway.enabled` or `relay.enabled` in config, restart daemon.

**Can a node change roles at runtime?** No — requires config edit and daemon restart. Config reload is not supported in current implementation.

**Can a node be multiple roles simultaneously?**
- Client + Relay: YES (both can be enabled)
- Client + Gateway: YES (both can be enabled; relay is implicit)
- Relay + Gateway: Architecturally possible but not explicitly documented; typically deployed separately

---

### 3.3 Role Auto-Detection

There is **no auto-detection** of role based on hardware or connectivity. Role is explicit in config:
- If `gateway.enabled = true` → node is a gateway (and relay)
- If `relay.enabled = true` → node is a relay (and possibly client)
- Otherwise → node is a client

Discovery broadcasts (`[discovery]` section) include node capabilities (client, relay, gateway) flags that other nodes read. This allows discovery mechanisms to prefer certain types, but does not change local node role.

---

## 4. Discovery Mechanisms

**Reference Files**: 
- `/crates/pim-discovery/` (discovery service)
- `/docs/architecture/discovery.md` (detailed protocol)
- Config sections: `[discovery]`, `[wifi_direct]`, `[bluetooth]`

### 4.1 Discovery Mechanisms Implemented

#### 4.1.1 **UDP Broadcast Discovery** (Production)

**Current Status**: Implemented and enabled by default

**Mechanism**:
- Each node broadcasts UDP packets to local subnet (limited broadcast 255.255.255.255 or directed to subnet broadcast address)
- Broadcast contains: node ID, transport address, capabilities (client/relay/gateway), supported mechanisms
- All nodes on same LAN receive broadcasts and build "discovered peers" table
- Interval: configurable `broadcast_interval_ms` (default 5s)
- Timeout: peer removed if not seen for `peer_timeout_ms` (default 30s)
- Port: `discovery.port` (default 9101)

**Configuration**:
```toml
[discovery]
enabled = true
port = 9101
broadcast_interval_ms = 5000
peer_timeout_ms = 30000
connect_relays = true
connect_gateways = true
shared_key = null  # optional encryption key
```

**Behavior**:
- When a new peer is discovered:
  - If `connect_relays = true` and peer is a relay: daemon auto-initiates TCP connection
  - If `connect_gateways = true` and peer is a gateway: daemon auto-initiates TCP connection
  - Otherwise: peer is added to discovery table but not auto-connected

**Security**: Optional `shared_key` (64 hex chars = 32 bytes) encrypts discovery broadcasts with ChaCha20 or similar. Only nodes with the same key can decode broadcasts.

**Limitations**:
- LAN-only (broadcast doesn't traverse routers)
- Requires all peers on same subnet or with broadcast relay configured

---

#### 4.1.2 **Bluetooth PAN Discovery** (Current Implementation)

**Current Status**: Implemented as "link monitoring" rather than active discovery

**Mechanism**:
- Daemon waits for Bluetooth PAN interface (`bnep0` by default) to appear
- Once interface is up, daemon:
  1. Queries ARP neighbor table to discover peer IPs on PAN link
  2. Optionally performs radio-level Bluetooth device scanning
  3. Initiates TCP connections to discovered peers

**Configuration**:
```toml
[bluetooth]
enabled = true
interface = "bnep0"
radio_discovery_enabled = true
device_name_prefix = "PIM-"
local_alias = ""
auto_discover_peers = true
poll_interval_ms = 2000
scan_interval_ms = 5000
peer_discovery_interval_ms = 2000
bluetoothctl_timeout_s = 15
discoverable_timeout_s = 180
startup_timeout_ms = 15000
```

**Behavior**:
- Daemon uses `bluetoothctl` (BlueZ user-space daemon interface) to:
  - Set device discoverable for `discoverable_timeout_s` seconds
  - Scan for nearby Bluetooth devices
  - Match devices by name prefix (`device_name_prefix`)
  - Attempt connections to discovered device names
- Assumes Bluetooth pairing is already done via OS settings
- Learns peer IPs from neighbor table after PAN link is active
- Requires manual pairing or PIN entry if not pre-paired

**Limitations**:
- Requires pre-pairing or PIN entry for radio discovery
- PAN must be manually established via OS Bluetooth settings
- Linux-only (BlueZ not available on macOS/Windows)
- Does not replace static peer configuration (can be used together)

---

#### 4.1.3 **Wi-Fi Direct Discovery** (Roadmap/Partial Implementation)

**Current Status**: Code scaffolding present; not fully tested in production

**Mechanism** (planned):
- Uses `wpa_supplicant` P2P support to discover and form Wi-Fi Direct groups
- Negotiates Group Owner role based on `go_intent` setting
- Once group is formed, peers have IP addresses and use standard TCP transport

**Configuration**:
```toml
[wifi_direct]
enabled = true
interface = "wlan0"
go_intent = 7
listen_channel = 6
op_channel = 6
connect_method = "pbc"
```

**Behavior** (planned):
- Daemon invokes `wpa_cli` commands on the interface
- Scans for Wi-Fi Direct devices
- Negotiates group formation (one device becomes Group Owner with DHCP server)
- Devices obtain IPs from GO's DHCP
- Standard TCP transport over P2P link

**Limitations**:
- Requires `wpa_supplicant` with P2P support
- Only one active P2P group per interface in basic mode
- Channel coordination required
- Not fully documented in current codebase

---

#### 4.1.4 **Static Peer Configuration** (Fallback)

**Current Status**: Always available, simplest method

**Mechanism**:
- Administrator manually lists peers in config file `[[peers]]` sections
- Daemon attempts persistent connections to all configured peers
- Reconnects automatically with exponential backoff if connection drops

**Configuration**:
```toml
[[peers]]
label = "gateway"
mechanism = "tcp"
address = "192.168.1.1:9100"

[[peers]]
label = "relay"
mechanism = "tcp"
address = "relay.local:9100"
```

**Behavior**:
- Daemon maintains persistent connections
- If connection drops, reconnects with backoff (max ~30s between retries)
- No discovery of new peers
- Most reliable in controlled environments

**Suitable For**:
- Lab deployments with fixed topologies
- Bootstrapping a mesh before discovery is ready
- Closed networks where manual configuration is acceptable

---

### 4.2 Discovery UX from CLI/UI

**User-Facing Commands** (from `pim debug` suite):

```bash
pim debug discovery
```

This command shows the current state of all discovery mechanisms:
- Peers seen by discovery layer (broadcast)
- Their addresses, roles (client/relay/gateway), last-seen age

**No explicit "find nearby nodes" command** exists in the CLI. Discovery is automatic and continuous. The UI should display discovered peers in a list and allow manual connection if needed.

---

## 5. Security and Key Management

**Reference Files**: 
- `/docs/architecture/security.md` (detailed threat model and crypto)
- `/crates/pim-crypto/` (handshake, encryption, key derivation)

### 5.1 Key Lifecycle

#### 5.1.1 **Key Generation**

**When**: On first daemon startup, if `security.key_file` doesn't exist

**How**: 
- Daemon calls `ed25519_keypair()` to generate a new Ed25519 keypair
- Writes private key to `security.key_file` (default `~/.pim/node.key`)
- File mode: 0o600 (read-write by owner only) on Unix
- Public key is derived on-the-fly from private key (not stored)

**Key Format**: PEM-encoded Ed25519 private key (standard format, compatible with OpenSSH and other tools)

**Key Derivation**:
```
Node ID = SHA-256(public_key)[0..16]  (first 16 bytes, displayed as 32-char hex)
```

#### 5.1.2 **Key Storage**

**Location**: 
- Primary: `security.key_file` (default `~/.pim/node.key` or configured path)
- Must be on persistent storage (not tmpfs)
- Survives daemon restarts

**Ownership**: Must be readable/writable only by daemon process (mode 0o600)

**Backup**: Private key should be backed up securely; compromise allows node impersonation

#### 5.1.3 **Key Rotation**

**Manual Rotation**:
1. Delete `security.key_file`
2. Restart daemon (will generate new key)
3. This breaks trust with all existing peers (they don't recognize the new node ID)

**Automatic Rotation**: Not implemented; must be done manually

---

### 5.2 Trust Establishment Between Peers

#### 5.2.1 **Handshake Protocol** (Authenticated Key Exchange)

**When**: Each time two peers establish a direct TCP connection

**Protocol** (from `/docs/architecture/security.md` lines 39–88):

```
    Initiator (A)                          Responder (B)
         │                                      │
         │─── HandshakeInit ───────────────────▶│
         │    { A.pub, A.ephemeral_pub,         │
         │      nonce_a, sig_a }                │
         │                                      │
         │◀── HandshakeResponse ────────────────│
         │    { B.pub, B.ephemeral_pub,         │
         │      nonce_b, sig_b }                │
         │     Both sides compute:              │
         │     session_key = HKDF-SHA256(...)   │
         │─── HandshakeConfirm ────────────────▶│
         │    { HMAC(session_key, transcript) }  │
         │◀── HandshakeConfirm ─────────────────│
         ▼   Session established                ▼
```

**Properties**:
- **Forward secrecy**: Ephemeral X25519 keys ensure past traffic remains secure even if long-term key is compromised
- **Mutual authentication**: Both sides prove possession of private key via Ed25519 signatures
- **Replay resistance**: Fresh nonces prevent replay of old handshakes

#### 5.2.2 **Authorization Policies** (After Handshake)

After the handshake proves a peer's identity, the daemon applies an authorization policy:

| Policy | Behavior | Config |
|--------|----------|--------|
| **allow_all** (default) | Accept any authenticated peer | `authorization_policy = "allow_all"` |
| **allow_list** | Accept only peers in `authorized_peers` list | `authorization_policy = "allow_list"` + list of 32-char node IDs in `authorized_peers = [...]` |
| **trust_on_first_use (TOFU)** | Accept peer on first contact, remember its public key, reject imposter claiming same node ID | `authorization_policy = "trust_on_first_use"` + persistent store in `trust_store_file` |

#### 5.2.3 **Trust Anchor** Concept

In some mesh frameworks, a "trust anchor" (also called "root of trust") is a pre-shared root certificate or key that signs all other peers' certificates.

**In PIM**: There is **no trust anchor implementation** in the current codebase. Trust is distributed:
- Each node owns its own private key
- Authorization is either open (`allow_all`), explicit (`allow_list`), or opportunistic (`trust_on_first_use`)
- No central certificate authority or PKI

---

### 5.3 Pairing and Initial Connection

**Pairing Flows Supported**:

| Mechanism | Pairing | Trust Establishment |
|-----------|---------|-------------------|
| **Static TCP peer** | Manual config (admin-created) | Handshake validates identity; policy determines acceptance |
| **UDP Broadcast Discovery** | Automatic (no pairing) | Handshake + policy (usually `allow_all` in trusted LAN) |
| **Bluetooth PAN** | Manual OS pairing (Bluetooth settings) + optional `device_name_prefix` matching | After PAN link, handshake + policy |
| **Wi-Fi Direct** | Automatic or manual (depends on `connect_method`: `pbc` or `pin:`) | After P2P group formation, handshake + policy |

**No QR Code Pairing**: Not implemented in current codebase. Could be added in UI for:
- Encoding node's public key or invite code in QR
- User scans and adds peer to config

---

### 5.4 Encryption Layers

#### 5.4.1 **Hop-by-Hop Transport Encryption**

**What**: Every frame on a direct TCP link between peers is encrypted

**Cipher**: AES-256-GCM (256-bit key, authenticated encryption)

**Key**: Derived from handshake ephemeral X25519 result via HKDF-SHA256

**Nonce**: 96-bit counter + random session prefix (handles up to 2^32 frames per session)

**Protection**:
- Eavesdropping on TCP link (passive attack) — prevented
- Tampering with frames (active attack) — detected
- Replay of old frames — prevented by counter

#### 5.4.2 **End-to-End Payload Encryption** (Multi-Hop)

**What**: For multi-hop paths, the IP packet payload is encrypted from client to gateway, so relay nodes cannot read it

**Scheme**:
```
ephemeral_priv, ephemeral_pub = x25519_keygen()
shared = X25519(ephemeral_priv, gateway_pub)
e2e_key = HKDF-SHA256(shared, salt=random, info="pim-e2e-v1")
ciphertext = AES-256-GCM(e2e_key, nonce, ip_packet)
```

**Protection**:
- Relay nodes cannot read the encrypted payload (only see headers)
- End-to-end confidentiality from client to gateway (or any ultimate destination)

**Limitation**: Gateway (or destination) must have its public key known to client. Obtained during route discovery.

---

### 5.5 Cryptographic Primitives

| Purpose | Algorithm | Library |
|---------|-----------|---------|
| Node identity | Ed25519 | `ed25519-dalek` |
| Key exchange | X25519 (Curve25519 ECDH) | `x25519-dalek` |
| Key derivation | HKDF-SHA256 | `hkdf` + `sha2` |
| Symmetric encryption | AES-256-GCM | `aes-gcm` |
| Hashing / fingerprints | SHA-256 | `sha2` |
| Message authentication | HMAC-SHA256 | `hmac` + `sha2` |
| Random number generation | CSPRNG (OS-provided) | `rand` |

**All Rust crates are well-audited and industry-standard.**

---

### 5.6 Security Operations for UI

**Key Activities UI Must Support**:

1. **Display node identity** (public key / node ID)
2. **Trigger key regeneration** (delete key file, restart daemon)
3. **View and configure authorization policy**:
   - Radio button: allow_all, allow_list, trust_on_first_use
   - For allow_list: manage list of authorized peer node IDs
   - For TOFU: show trusted-peers file, allow manual removal of trusted peer
4. **View connected peers and their identities** (short node ID)
5. **Monitor handshake status** (not explicitly exposed; can infer from "connected" state)

**Security Notes for UI**:
- Never display private keys in UI (not stored in snapshot; daemon only)
- Warn user before triggering key regeneration (breaks existing connections)
- Require confirmation for policy changes (affects which peers are accepted)

---

## 6. Runtime Observability and Metrics

**Reference Files**: 
- `/crates/pim-cli/src/main.rs` lines 725–744 (stats parsing)
- `/crates/pim-core/src/debug.rs` (DebugSnapshot structures)

### 6.1 Stats File (`/run/pim.stats`)

**Format**: Key=value pairs, one per line

**Accessible Via**: `pim status --verbose` or direct read

**Current Fields** (from test lines 1307–1330 and CLI usage):

```
peers=3
routes=5
packets_forwarded=100
bytes_forwarded=51200
packets_dropped=10
congestion_drops=2
conntrack_size=50
uptime_secs=3600
```

| Field | Type | Meaning |
|-------|------|---------|
| `peers` | u64 | Number of currently connected peer sessions |
| `routes` | u64 | Number of installed routes in routing table |
| `packets_forwarded` | u64 | Total packets relayed/forwarded by this node |
| `bytes_forwarded` | u64 | Total bytes forwarded |
| `packets_dropped` | u64 | Packets dropped due to various errors |
| `congestion_drops` | u64 | Packets dropped specifically due to congestion (send buffer full) |
| `conntrack_size` | u64 | Current number of NAT connection tracking entries (gateway only) |
| `uptime_secs` | u64 | Time since daemon started (seconds) |

**Update Frequency**: Daemon updates stats file periodically (likely every 1–10 seconds; exact interval not documented in code)

**Access**: Read from `/run/pim.stats` using standard file I/O. Format is simple; parse with regex or split-on-equals.

---

### 6.2 Debug Snapshot (`/run/pim-debug.json`)

**Format**: JSON serialized `DebugSnapshot` struct

**Access Method**: `pim debug *` commands read this file

**Structure** (from `/crates/pim-core/src/debug.rs` lines 8–110):

```json
{
  "version": 1,
  "generated_at_unix_secs": 1700000000,
  "node": {
    "name": "my-node",
    "node_id": "abcdef0123456789abcdef0123456789",
    "short_id": "abcdef01",
    "is_gateway": false,
    "mesh_ip": "10.77.0.2/24",
    "mesh_prefix_len": 24,
    "request_dynamic_ip": true
  },
  "stats": {
    "peers": 3,
    "routes": 12,
    "packets_forwarded": 5000,
    "bytes_forwarded": 2560000,
    "packets_dropped": 10,
    "congestion_drops": 2,
    "conntrack_size": 50,
    "uptime_secs": 7200
  },
  "peers": [
    {
      "node_id": "def4567890abcdef0123456789abcdef",
      "short_id": "def45678",
      "addr": "192.168.1.10:9100",
      "mechanism": "tcp",
      "direct": true,
      "configured": true,
      "discovered": false,
      "last_heartbeat_age_ms": 245
    }
  ],
  "discovered_peers": [
    {
      "node_id": "ghi789...",
      "short_id": "ghi78901",
      "addr": "192.168.1.11:9100",
      "is_client": true,
      "is_relay": false,
      "is_gateway": false,
      "last_seen_age_ms": 1500
    }
  ],
  "routes": [
    {
      "destination_id": "jkl012...",
      "destination_short_id": "jkl01234",
      "next_hop_id": "def456...",
      "next_hop_short_id": "def45678",
      "learned_from_id": "def456...",
      "learned_from_short_id": "def45678",
      "hops": 1,
      "is_gateway": false,
      "gateway_load": 0,
      "rtt_ms": 5,
      "mesh_ip": "10.77.0.3/24",
      "age_ms": 1234,
      "next_hop_blacklisted": false
    }
  ],
  "gateways": [
    {
      "node_id": "mno345...",
      "short_id": "mno34567",
      "next_hop_id": "pqr678...",
      "next_hop_short_id": "pqr67890",
      "hops": 2,
      "gateway_load": 25,
      "rtt_ms": 12,
      "score": 85,
      "selected": true,
      "mesh_ip": "10.77.0.1/24"
    }
  ]
}
```

**Update Frequency**: Daemon writes snapshot periodically (interval not documented; likely every 1–5 seconds)

---

### 6.3 Real-Time Events and Subscriptions

**Current Implementation**: None. Snapshot-based observability only.

**No streaming interfaces** (WebSocket, Unix socket, gRPC) are implemented for real-time event subscriptions.

**Workaround for UI**: Poll `/run/pim-debug.json` every 1–2 seconds to detect changes:
- Peer join/leave (peer list length change)
- Route updates (routes list length or content change)
- Gateway selection change (selected gateway flag flip)
- Uptime and stats updates

**Future Enhancement**: Could add:
- HTTP `/metrics` endpoint (Prometheus format)
- WebSocket endpoint for live updates
- Unix socket for local IPC

---

### 6.4 Logging

**Daemon Logging**: Daemon emits logs via `tracing` crate (structured logging library)

**Log Levels**:
- `error`: Fatal issues (connection failure, crypto error, etc.)
- `warn`: Recoverable issues (route timeout, peer blacklist, etc.)
- `info`: Important state changes (peer joined, gateway selected, etc.)
- `debug`: Detailed packet processing (currently less used)
- `trace`: Very verbose (frame-by-frame activity)

**Output**: Logs to stderr (unless configured otherwise). Not exposed in snapshots.

**CLI Control**: No log level control in `pim up` command. Could be added via environment variable (e.g., `RUST_LOG=pim_daemon=debug`).

---

## 7. Routing

**Reference Files**: `/crates/pim-routing/` (routing logic)

### 7.1 Algorithm and Behavior

**Algorithm**: Distance-Vector (AODV-like)

**Periodic Route Broadcasts**:
- Each node periodically broadcasts its known routes to all direct neighbors
- Each route advertisement includes: destination node ID, hop count, next hop, gateway load, timestamp
- Routes are signed with Ed25519 to prevent injection

**Route Selection**:
- Nodes build a routing table from received advertisements
- Best route to each destination is selected by: minimum hop count (then gateway load for gateway routes)
- Split horizon with poison reverse: don't advertise route back to originator

**Configuration**:
```toml
[routing]
max_hops = 10              # Max hop count; routes with TTL > 10 are dropped
algorithm = "distance-vector"
route_expiry_s = 300       # Routes older than 5 minutes are purged
```

**Expiry Logic**:
- Daemon tracks age of each learned route
- Routes older than `route_expiry_s` seconds are removed from table
- If a route becomes invalid (next hop blacklisted, too old), daemon stops forwarding to that destination

---

### 7.2 Routing Information in UI

**What to Display** (from `pim debug routes` output):

For each installed route:
- **Destination**: Short node ID (8-char hex)
- **Via**: Next-hop node ID
- **Hops**: Number of hops to destination
- **Learned From**: Which peer advertised this route
- **Is Gateway**: Boolean flag (whether destination is a gateway)
- **Gateway Load**: Current load of gateway (0–255, where higher = more congested)
- **RTT**: Round-trip time to next hop (if measured)
- **Mesh IP**: Destination node's mesh IP address (if known)
- **Age**: How long since route was learned (ms)
- **Blacklisted**: Whether next hop is currently blacklisted due to failures

**Route Selection UI**:
- Show selected gateway with a star/highlight
- Display alternative gateways below with scores
- Show gateway score calculation (hops, load, latency)

---

### 7.3 Gateway Selection

**Multi-Gateway Scenario** (Phase 5):
- When multiple gateways are available, daemon selects the "best" one based on:
  1. Hop count (prefer closer)
  2. Gateway load (prefer less loaded)
  3. Latency / RTT (prefer faster)

**Selection Logic**:
```rust
fn gateway_score(hops: u8, load: u8, rtt_ms: Option<u32>) -> u32 {
    // Higher score = better
    // Simplified pseudocode:
    score = 100 - hops * 10
    score -= load  // Decrease score if loaded
    if rtt_ms > 50 { score -= (rtt_ms - 50) / 5 }  // Penalize high RTT
    score
}
```

**Gateway Load Advertising**:
- Gateway advertises its current load (number of active NAT connections / max_connections) as a percentage (0–255)
- Clients receive this load in routing advertisements and factor it into selection

**Failover**:
- If selected gateway becomes unreachable (no route, timeout), client falls back to next-best gateway
- Fallback is automatic; no user action required

---

## 8. Gateway and NAT

**Reference Files**: `/crates/pim-gateway/src/lib.rs`

### 8.1 NAT Implementation

**Type**: Userspace NAT (connection tracking in daemon memory, not iptables-based)

**Outbound NAT Flow**:
1. Incoming mesh packet from client has source IP = client's mesh IP
2. Gateway daemon receives packet, recognizes it's destined for internet (outside mesh)
3. Rewrites source IP to gateway's internet-facing IP
4. Assigns external port from pool (30000–59999)
5. Forwards packet to internet interface
6. Tracks flow in conntrack table: (proto, client_ip, client_port) → external_port

**Inbound NAT Flow**:
1. Internet response packet arrives on gateway's internet interface
2. Daemon extracts destination port and protocol
3. Looks up conntrack entry to find original client
4. Rewrites destination IP/port back to original client's mesh IP/port
5. Forwards packet into mesh tunnel destined for client

**Connection Tracking Timeouts**:
- **TCP**: 300 seconds (5 minutes) — idle timeout
- **UDP**: 30 seconds — idle timeout
- **ICMP**: 10 seconds — idle timeout

**Conntrack Table Limits**:
- Maximum: `gateway.max_connections` (default 200)
- When full, new flows are dropped with `GatewayError::ConntrackFull`
- Expired entries are automatically cleaned up (GC task)

---

### 8.2 Pre-Flight Checks for Gateway Mode

**Before enabling gateway**, system must have:

1. **Linux OS** (iptables integration required)
2. **Executable `iptables` and `sysctl` binaries** in PATH
3. **Capability CAP_NET_ADMIN** or full root
4. **Device `/dev/net/tun`** (for TUN interface)
5. **Internet-facing interface** (e.g., eth0) with:
   - Real IP address (not loopback)
   - Connectivity to internet (ping external DNS works)
   - Writable (daemon must modify iptables rules on this interface)

**Daemon Checks** (in code):
- Calls `iptables -C` to check if MASQUERADE rule exists
- Calls `sysctl` to enable `net.ipv4.ip_forward`
- If any command fails, logs error and continues (assumes rules already set or will be set manually)

**UI Checks** (for pim-ui):
- Detect OS (Linux vs macOS vs Windows)
- Show error if not Linux: "Gateway mode is only supported on Linux"
- Detect if user can run iptables (test running a safe read command, e.g., `iptables -L`)
- Detect available network interfaces (parse `ip link show` or equivalent)
- Warn if selected interface has no real IP (check `ip addr show`)
- Suggest running daemon with elevated privilege

---

### 8.3 Active Gateway State Exposure

**What daemon exposes** (via debug snapshot):

```json
{
  "stats": {
    "conntrack_size": 50  // Current NAT connections
  }
}
```

**What UI can infer**:
- Conntrack utilization: `conntrack_size / max_connections` (e.g., 50 / 200 = 25%)
- Display as progress bar or percentage

**What's NOT exposed**:
- Per-flow details (which client connected to which external IP)
- Bandwidth utilization per flow
- Packet loss or congestion per flow

**Potential additions**:
- Throughput (bytes forwarded per second)
- Active flow count (may differ from conntrack size)
- Traffic by destination (Internet Service)

---

## 9. Route Management (`pim route`)

**Reference Files**: `/crates/pim-cli/src/main.rs` lines 392–443

### 9.1 Split-Default Routing

**What It Is**: Routing scheme that splits the IPv4 address space into two halves and sends them through the mesh tunnel:

```
0.0.0.0/1  (0.0.0.0 – 127.255.255.255) → pim0 gateway
128.0.0.0/1 (128.0.0.0 – 255.255.255.255) → pim0 gateway
```

**Why**: Avoids replacing the default route (0.0.0.0/0), which would break the underlay network connection. Instead, it installs two /1 routes that together cover all IPv4 addresses but leaves room for other routes (e.g., to the gateway machine via underlay).

**Enabling / Disabling**:

```bash
sudo pim route on    # Install routes
sudo pim route off   # Remove routes
sudo pim route status # Check if enabled
```

**Platform-Specific Implementation**:

**Linux** (`ip route` command):
```bash
ip route replace 0.0.0.0/1 via {gateway_ip} dev pim0 onlink
ip route replace 128.0.0.0/1 via {gateway_ip} dev pim0 onlink
```

**macOS** (`route` command):
```bash
route -n add -net 0.0.0.0/1 -interface pim0
route -n add -net 128.0.0.0/1 -interface pim0
```

### 9.2 UX Implications

**When to Enable**:
- User wants all internet traffic to go through mesh (instead of direct to LAN/Wi-Fi gateway)
- Useful for testing gateway functionality or using mesh as default internet route

**When NOT to Enable**:
- User wants to access resources on the underlay LAN while using mesh for specific destinations
- Can be toggled on/off without restarting daemon

**UI Control**: 
- Checkbox or toggle: "Route Internet Through Mesh"
- Clicking enables `pim route on`, unchecking enables `pim route off`
- Display status: "Currently enabled" / "Currently disabled"
- Show current route (e.g., "via 10.77.0.1 dev pim0")

**Important Notes**:
- Daemon must be running and pim0 interface must be up
- For clients with `mesh_ip = "auto"`, daemon must have obtained an IP from gateway first (otherwise gateway IP is unknown)
- Disabling routes returns traffic to normal underlay routing

---

## 10. Interfaces and TUN Configuration

**Reference Files**: `/crates/pim-tun/src/lib.rs`

### 10.1 TUN Interface Creation and Management

**What It Is**: Virtual network interface (TUN device) that carries mesh traffic

**Cross-Platform Names**:
- **Linux**: `pim0` (or any name, default pim0)
- **macOS**: `utunN` format (e.g., utun0, utun1, utun2) — kernel-assigned but user can request a number

### 10.2 Interface Configuration

**Configuration Parameters** (set by daemon via ioctl):

| Setting | Method | Meaning |
|---------|--------|---------|
| Interface name | Request during creation | pim0 or utunN |
| IPv4 address | `set_ip()` call | Mesh IP address (e.g., 10.77.0.2) |
| Prefix length | `set_ip()` call | /24 for 10.77.0.0/24 |
| MTU | `set_mtu()` call | Configured via `interface.mtu` in config (default 1400) |
| Up/Down | `up()` / `down()` call | Interface enabled or disabled |

**Daemon Initialization**:
```
1. Create TUN device (request name from config)
2. Set IP address and prefix length
3. Set MTU
4. Bring interface up
5. (Optional) Configure default route via interface
```

### 10.3 Platform Differences

**Linux TUN Creation**:
- Opens `/dev/net/tun`
- Issues TUNSETIFF ioctl with IFF_TUN | IFF_NO_PI flags
- Configures IP via SIOCSIFADDR, SIOCSIFNETMASK, SIOCSIFMTU ioctls
- Brings up via SIOCSIFFLAGS with IFF_UP flag

**macOS utun Creation**:
- Uses PF_SYSTEM socket family (Apple-specific)
- Connects to `com.apple.net.utun_control` kernel control socket
- Kernel assigns unit number (utun0, utun1, etc.); requests with `go_intent` value
- IP configuration via `ifconfig` command (daemon spawns subprocess)
- macOS automatically handles packet framing (no IFF_NO_PI equivalent)

**Constraints**:
- **macOS**: Device name must match `utunN` pattern. Trying to request `pim0` will fail.
- **Linux**: Name can be arbitrary (up to 15 characters). `pim0` is conventional.
- **Windows**: Not yet supported (no TUN implementation).

### 10.4 MTU Considerations

**Default MTU**: 1400 bytes (configured in `interface.mtu`)

**Why 1400 and Not 1500?**:
- 1500 is standard Ethernet MTU
- 1400 accounts for mesh framing overhead:
  - IP header: 20 bytes
  - Transport frame header: ~40 bytes
  - Encryption overhead (GCM tag): 16 bytes
  - Fragmentation header (if needed): variable
  - Total overhead: ~100 bytes
  - Leaves ~1400 bytes for actual IP payload

**Configuration**:
- All peers in the mesh should use the same MTU
- If a peer uses a smaller MTU, packets will be fragmented mid-mesh (inefficient)
- If a peer uses a larger MTU, packets from peer may be dropped by others

**UI Note**: 
- Display current MTU
- Warn if it differs from peers (requires reading peer MTU from discovery or manually configured)
- Allow adjustment (requires daemon restart)

---

## 11. Docker Test Scenarios

**Reference**: `/docker/compose/` directory with 13 test files

### 11.1 Test Scenarios

Each compose file represents a scenario that exercises specific features:

| File | Scenario | Covers |
|------|----------|--------|
| `phase1-single-hop.yml` | Client → Gateway → Internet | Basic TUN, NAT, single-hop forwarding, gateway setup |
| `phase2-relay.yml` | Client → Relay → Gateway → Internet | Multi-hop forwarding, E2E encryption, relay node |
| `phase2-routing.yml` | Multi-client, multi-relay, multi-gateway | Distance-vector routing, route advertising, route selection |
| `phase3-discovery.yml` | Auto-discovery without static config | UDP broadcast discovery, auto-peer-join, peer-lifecycle |
| `phase4-flow-control.yml` | Stress test with high throughput | Send buffer, backpressure, flow control, congestion handling |
| `phase4-resilience.yml` | Intermittent failures and recovery | Reconnection logic, backoff, blacklisting, route timeout |
| `phase5-multigateway.yml` | Multiple gateways, load balancing | Gateway scoring, failover, load distribution |
| `phase7-auto-discovery.yml` | Discovery + auto-topology formation | Combines discovery with multi-hop |
| `auth-allow-all.yml` | Authorization: allow_all policy | Open mesh, any authenticated peer accepted |
| `auth-allow-list.yml` | Authorization: allow_list policy | Whitelist-based access control |
| `auth-discovery-key.yml` | Authorization: shared_key encryption | Discovery group key for broadcast isolation |
| `auth-tofu.yml` | Authorization: trust_on_first_use | TOFU trust establishment, trust store |
| `bluetooth-seam.yml` | Bluetooth PAN link test | PAN interface monitoring, peer discovery on BT link |

### 11.2 Happy Paths for UI

These scenarios represent the "happy paths" the UI should support:

1. **Simple Single-Hop**: Start gateway, start client, client accesses internet
2. **Multi-Hop Relay**: Add relay node, client reaches gateway through relay
3. **Auto-Discovery**: Nodes discover each other automatically (no manual config)
4. **Gateway Failover**: Switch client to alternative gateway when preferred gateway fails
5. **Static Peer Config**: Manually configure static peers, daemon maintains connections
6. **Authorization**: Choose authorization policy, manage allowed peers
7. **Metrics Monitoring**: Watch real-time stats (peer count, packet forwarding, uptime)

---

## 12. Operations and Error States

### 12.1 Daemon Lifecycle States

| State | Condition | User Action |
|-------|-----------|------------|
| **Stopped** | No PID file or process not alive | `pim up` to start |
| **Starting** | PID file exists, process alive, TUN not yet up | Wait a few seconds, then status |
| **Running (Idle)** | Process alive, TUN up, 0 peers connected | Check config, add static peers or enable discovery |
| **Running (Connected)** | Process alive, TUN up, ≥1 peer connected | Normal operation |
| **Shutting Down** | Process alive but terminating | Wait for graceful shutdown |
| **Error (No TUN)** | Process alive but TUN creation failed | Check root/CAP_NET_ADMIN, /dev/net/tun availability |
| **Error (No Internet)** | Gateway mode enabled but nat_interface unreachable | Check internet connectivity on nat_interface |
| **Degraded (High Latency)** | Routes exist but RTT high or packet loss | Check underlay network, reduce mesh hops if possible |

### 12.2 Error Conditions and Recovery

| Error | Cause | Recovery |
|-------|-------|----------|
| **Daemon won't start** | Missing config file | Generate config with `pim config generate`, specify path in `pim up --config` |
| **TUN creation fails** | No root, missing /dev/net/tun, unsupported OS | Run with `sudo`, verify Linux/macOS, check kernel has TUN module |
| **No peers connecting** | Discovery disabled, no static peers | Enable discovery or manually add static peers to config |
| **Peer connection fails** | Firewall blocking port 9100, peer not reachable | Check peer address, firewall rules, static route to peer |
| **Route not established** | Peer is relay but not advertising routes | Check if relay is enabled in peer config, restart peer |
| **Gateway unreachable** | No gateway in mesh, gateway offline | Add gateway or check if gateway is running and connected |
| **NAT connection full** | Too many concurrent connections | Increase `gateway.max_connections` in config, restart daemon |
| **Cannot enable `pim route`** | pim0 not up or gateway IP unknown | Ensure daemon is running and has connected to at least one peer |
| **High packet loss** | Network congestion, weak signal (Bluetooth/Wi-Fi) | Reduce traffic, check RSSI/signal strength, add more gateways |
| **Authentication failed** | Authorization policy rejecting peer | Check peer is in allow_list, or switch to allow_all (for testing) |

### 12.3 Monitoring and Alerting (for UI)

**Recommended Alerts**:
- Peer count drops to 0 (disconnected from mesh)
- Selected gateway changes frequently (gateway selection instability)
- Conntrack size approaches max_connections
- Uptime resets unexpectedly (daemon crash + restart)
- packets_dropped increasing rapidly (congestion or errors)

---

## 13. Platform Quirks and Constraints

### 13.1 Linux

**Supported**: Full feature set

**Requirements**:
- Kernel with TUN module (`CONFIG_TUN=y`)
- iptables installed (for gateway mode)
- iproute2 installed (for route management)
- CAP_NET_ADMIN capability or root

**Interface Names**: pim0, pim1, etc. (conventional: pim0)

**TUN Device**: `/dev/net/tun`

**Stats File**: `/run/pim.stats` (or `/var/run/` on older systems)

**Special Notes**:
- Gateway mode works perfectly on Linux
- Multiple gateways can be deployed on Linux
- Split-default routing uses `ip route` command

### 13.2 macOS

**Supported**: Client and relay (NOT gateway)

**Requirements**:
- Kernel with utun support (all modern macOS)
- TUN interface kernel extension (typically installed by Homebrew or similar)
- Capability to create network interfaces (available to root or user with special entitlements)

**Interface Names**: utun0, utun1, utun2, ... (must match `utunN` pattern)

**TUN Device**: PF_SYSTEM socket + kernel control socket (no /dev/net/tun)

**Special Handling**:
- macOS does not have `iptables` (uses `pfctl` instead) — no gateway NAT support
- Route management uses `route` command (different syntax from Linux `ip`)
- Split-default routing uses `route -n add` / `route -n delete`
- utun device numbering is kernel-managed; user can request but not guarantee a specific number

**Special Notes**:
- Cannot run as full daemon (backgrounding is possible but some features may not work)
- Requires elevated privilege to create TUN and modify routes
- Bluetooth support may differ from Linux (needs testing)

### 13.3 Windows

**Current Support**: None (not implemented)

**Potential Future Support**: Requires TUN implementation using NDIS driver or WinTUN library

**Challenges**:
- Windows does not have /dev/net/tun
- Must use NDIS driver or third-party library (e.g., WinTUN from Wireguard)
- Route management requires different approach (netsh or Windows API)
- iptables equivalent is less accessible to user-space programs

### 13.4 Mobile (Android, iOS)

**Current Support**: None (not implemented as platform)

**Status**: Codebase is Rust + async Tokio, which is portable. Logic can run on mobile, but:
- TUN interface API differs on Android (use standard /dev/net/tun via bionic libc)
- iOS has restricted TUN access (must use NetworkExtension framework in modern iOS)
- App permissions and background execution model differ

**Crate Structure**: Some discovery crates (Bluetooth, Wi-Fi Direct) are designed with mobile in mind, suggesting future mobile support is planned.

---

## 14. Daemon Behavior NOT Exposed via CLI

### 14.1 Config-Only Settings (Require Restart)

These settings are not exposed via CLI but can be changed via config file + restart:

| Setting | Why Not Exposed | Required Action |
|---------|---|---|
| `node.data_dir` | Where keys are stored | Edit config, restart daemon |
| `interface.mtu` | Network parameter | Edit config, restart daemon (affects new sessions) |
| `discovery.broadcast_interval_ms` | Tuning parameter | Edit config, restart daemon |
| `discovery.peer_timeout_ms` | Peer lifecycle | Edit config, restart daemon |
| `discovery.shared_key` | Authorization | Edit config, restart daemon |
| `transport.listen_port` | Network parameter | Edit config, restart daemon |
| `routing.max_hops` | Network parameter | Edit config, restart daemon |
| `routing.route_expiry_s` | Routing behavior | Edit config, restart daemon |
| `gateway.nat_interface` | Hardware-specific | Edit config, restart daemon |
| `gateway.max_connections` | Conntrack limit | Edit config, restart daemon |
| `wifi_direct.*` | Discovery configuration | Edit config, restart daemon |
| `bluetooth.*` | Discovery configuration | Edit config, restart daemon |

### 14.2 Runtime-Only Behavior (Not in Config)

| Behavior | Where Configured | Control |
|----------|---|---|
| Peer reconnection backoff | Code hardcoded | Not configurable |
| Nonce counter rekey trigger (2^32 frames) | Code hardcoded | Not configurable |
| Send buffer size (100 frames) | Code hardcoded | Not configurable |
| Heartbeat interval | Code hardcoded | Not configurable |
| Reputation/blacklisting thresholds | Code hardcoded | Not configurable |
| Rate limiting (packets/sec per peer) | Code hardcoded | Not configurable |

---

## 15. Roadmap and Future Features

**Reference**: `/docs/project/roadmap.md`

### 15.1 Implemented (Current)

- Phase 1: Single-hop tunnel (client + gateway + NAT)
- Phase 2: Multi-hop relay, E2E encryption, fragmentation
- Phase 3: Discovery (UDP broadcast), auto-join, peer lifecycle
- Phase 4: Partial — flow control, send buffer, backoff, metrics (but not TCP windowing or full stress test)
- Phase 5: Partial — multi-gateway, gateway scoring (but not load-aware traffic split)

### 15.2 In Progress / Planned

- Phase 4 Completion:
  - Zero-copy packet handling
  - Prometheus endpoint for metrics
  - Connection pooling per peer
  
- Phase 5 Expansion:
  - Per-flow gateway selection (different flows use different gateways)
  - Adaptive load balancing (shift traffic away from overloaded gateways)
  
- Phase 6: Security hardening
  - Peer reputation system (packet delivery success rate)
  - Rate limiting enforcement
  - Onion routing (optional, high performance cost)

### 15.3 Not Yet Started

- Windows support
- Mobile (Android, iOS) support
- Onion routing / privacy enhancements
- Multi-gateway per-flow splitting

### 15.4 What NOT to Expose in UI Yet

- Features from Phases 5–6 that are incomplete
- Placeholder controls for non-existent features
- Advanced tuning parameters that are hardcoded (would give false impression of control)

---

## 16. UI Feature Exposure — Opinionated Recommendations

Based on the above analysis:

### **UI MUST expose:**

1. **Daemon Lifecycle**
   - Start/Stop button with confirmation
   - Status display: Stopped, Starting, Running, Error
   - Uptime counter

2. **Node Identity**
   - Display node name (from config)
   - Display node ID (short 8-char hex, full 32-char hex on hover)
   - Display mesh IP address (with /prefix)
   - Display role(s): Client, Relay, Gateway

3. **Network Status**
   - Connected peers count
   - Routes installed count
   - Current internet route (selected gateway)
   - Interface status (pim0 or utunN: up/down)

4. **Metrics Dashboard**
   - Peer count (bar chart over time)
   - Packets forwarded (rate or cumulative)
   - Uptime (counter)
   - Selected gateway (highlighted)

5. **Peer Management**
   - Table of connected peers (ID, address, mechanism, last heartbeat)
   - Table of static peers (with add/edit/remove buttons)
   - Trigger manual connection to discovered peer

6. **Configuration (Simple Mode)**
   - Node name (editable, requires restart)
   - Interface: name + MTU + mesh_ip (radio: static CIDR or "auto")
   - Discovery: enabled/disabled + auto-connect toggles
   - Gateway: enabled/disabled + nat_interface (dropdown)
   - Authorization: radio buttons (allow_all, allow_list, trust_on_first_use)
   - Listen port (editable)

7. **Advanced Configuration (Expandable Section)**
   - Discovery timing (broadcast interval, peer timeout)
   - Routing settings (max hops, algorithm, route expiry)
   - Gateway: max connections (conntrack limit)
   - Security: require_encryption toggle
   - Authorization policy details (allowed peers list, TOFU trust store)
   - Wi-Fi Direct / Bluetooth settings (hidden unless enabled)

8. **Routing & Gateway Information**
   - Table of installed routes (destination, via, hops, learned from, is_gateway, load, age, mesh_ip)
   - Table of known gateways (ID, via, hops, score, selected marker)
   - Route explanation (`pim debug route get internet` output)
   - Split-default routing toggle (`pim route on/off/status`)

9. **Error Display**
   - Prominent error banner if daemon stopped unexpectedly
   - Connection failures (peer, gateway, interface)
   - Authorization failures (with peer ID)

---

### **UI SHOULD expose (in advanced tab or drawer):**

1. **Discovery Mechanisms**
   - Broadcast discovery: enable/disable, show discovered peers
   - Bluetooth PAN: enable/disable, interface selection, radio discovery toggle
   - Wi-Fi Direct: enable/disable, channel selection, connection method
   - Static peers: table with add/remove/test

2. **Security Deep Dive**
   - Display node public key (with copy button)
   - Trigger key regeneration (with strong warning)
   - Authorization policy management:
     - Allow-list: add/remove peer node IDs
     - TOFU: view trusted peers, revoke trust
   - Trust store file browser

3. **Performance Tuning**
   - Conntrack table utilization (% bar)
   - Send buffer status
   - Reputation scores per peer (if available)
   - Detailed metrics export (JSON)

4. **Debugging**
   - Raw debug snapshot (JSON viewer)
   - Logs viewer (tail /stderr or stored log file)
   - `pim debug` commands (peers, routes, gateways, discovery, route get)

5. **Platform-Specific Notes**
   - macOS: warning that gateway mode not supported
   - Linux: capability/iptables verification
   - Show detected system interfaces for NAT

---

### **UI should NOT expose:**

1. **Internal details**:
   - `node.data_dir` (fixed to user standard)
   - `security.key_file` path (managed by daemon)
   - `trust_store_file` path (managed by daemon)
   
2. **Unimplemented features** (Phases 5–6):
   - Per-flow gateway selection
   - Peer reputation scores
   - Rate limiting controls
   - Onion routing toggle
   
3. **Hardcoded parameters** (non-configurable):
   - Reconnection backoff algorithm
   - Nonce counter rekey threshold
   - Send buffer size
   - Heartbeat interval
   - Provide a "Show Hidden Settings" debug button instead of exposing these

4. **Deprecated or unused fields**:
   - Any fields marked as optional but not yet implemented
   - Partial discovery mechanisms (Wi-Fi Direct if unstable)

---

## Summary

**pim-kernel-study.md — Complete. See table above for UI exposure recommendations.**

This study covers:
- 12 CLI commands with exact invocations, flags, outputs
- 11 config sections with all fields, types, defaults, constraints
- 3 node roles with behavioral differences and platform support
- 4 discovery mechanisms (broadcast, Bluetooth, Wi-Fi Direct, static)
- Complete security model: Ed25519 keys, handshake, 2-layer encryption, 3 authorization policies
- Runtime observability: stats file, debug snapshot, no streaming (yet)
- Distance-vector routing with gateway selection, multi-gateway support
- Userspace NAT with conntrack, Linux-only, pre-flight checks
- TUN interface management with platform differences (Linux pim0, macOS utunN)
- 13 Docker test scenarios demonstrating happy paths
- 5 lifecycle states, 10 error conditions, recovery procedures
- Platform quirks (Linux full support, macOS client/relay, Windows not yet)
- Daemon behavior not exposed (config-only and hardcoded runtime parameters)
- Roadmap: Phase 4 partially done, Phase 5 underway, Phase 6 planned

**Recommended UI exposure tiers**: MUST (9 categories), SHOULD (5 categories), NOT (4 categories).

