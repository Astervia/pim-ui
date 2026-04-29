# PIM-UI · Copy & Voice Contract

> Audit target for Phase 4+. Every user-visible string must conform.
> Source: aggregates `docs/UX-PLAN.md §7` + `.design/branding/pim/patterns/STYLE.md`.
>
> Authority for `scripts/audit-copy.mjs` (`pnpm audit:copy`) — §3 lists hard-fail phrases, §4 lists soft-warning words. The audit script reads its own banned + soft lists from this file when present, falling back to its hardcoded copy.

## 1. Hard rules

- Declarative, present tense, no hedges.
- No exclamation marks anywhere in user-visible strings.
- Name crypto primitives explicitly on first use (X25519, ChaCha20-Poly1305, HKDF-SHA256).
- Errors name the failure and point to a docs section.
- Lowercase wordmark `pim`, never uppercase.

## 2. Aria/Mira lexicon

| Surface | Aria-copy | Mira annotation | Banned |
|---|---|---|---|
| TUN interface | "virtual network connection" | "(TUN/TAP interface)" | "TUN" alone, "VPN tunnel" |
| Mesh IP | "your address on the mesh" | "(mesh_ip)" | "mesh_ip" alone |
| Gateway | "a device sharing its internet" | "(NAT-egress gateway)" | "internet shareer" |
| Relay | "a device passing traffic" | "(L3 relay)" | "relay" without explanation |
| Route-on | "Route internet via mesh" | "(split-default routing)" | "VPN on" |
| Handshake fail | "Couldn't verify this peer" | "(Noise handshake rejection)" | "Pairing rejected" |
| Conntrack exhausted | "Too many connections through your gateway" | "(conntrack table full)" | "conntrack full" |
| Daemon stopped | "pim is stopped" | "(pim-daemon process exited)" | "daemon dead", "pim crashed" |
| Kill-switch active | "Blocking internet — gateway unreachable" | "(route-on with selected_gateway=null)" | "Internet down" |
| Solo state | "no peers connected · discovery is active" | "(zero-peer ready state)" | "Add your first peer", "Welcome" |

## 3. Banned phrases

- Add your first peer
- Welcome to pim
- Get started
- Connecting…
- Oops
- Whoops
- any string ending with an exclamation mark

## 4. Soft warnings (style review)

- maybe
- please
- try to
- we'll
- kinda
- should

## 5. Brand glyphs (Unicode)

- ◆ active
- ◈ relayed
- ○ connecting
- ✗ failed / blocked
- ◐ in-progress (cursor-blink)
- █ wordmark prefix
- · separator (U+00B7)
- ─ ┌ ┐ └ ┘ ├ ┤ ▶ box-drawing only

## 6. Components — locked strings

### LimitedModeBanner (existing, reference)

- Headlines: `LIMITED MODE`, `DAEMON ERROR`, `STARTING DAEMON…`, `RECONNECTING…`, `DAEMON STOPPED UNEXPECTEDLY`
- Body strings: see `src/components/brand/limited-mode-banner.tsx` — locked verbatim there. Do not paraphrase from this doc. The component file is the source of truth for those specific strings; this entry exists only so the audit script knows the component is in scope.

### KillSwitchBanner (Phase 4)

- Headline: `✗ BLOCKING INTERNET — gateway unreachable`
- Body: `pim is keeping you off the internet because the routing gateway is gone. Turn off routing to use your normal connection.`
- Action: `[ TURN OFF KILL-SWITCH ]`
- Sonner toast (D-31): `kill-switch active · routing blocked`

### RouteTogglePanel (Phase 4)

- Off body: `internet uses your normal connection · not routed through the mesh`
- On body template: `Routing through {gateway-label} (via {first-hop-label})`
- On body (gateway is direct): `Routing through {gateway-label}`
- Pre-flight pass copy:
  - `interface up ({iface_name})`
  - `gateway reachable ({label} · {latency}ms)`
  - `split-default routing supported`
- Pre-flight failure copy:
  - `interface {iface_name} is down · check transport logs`
  - `no gateway is advertising itself · pair with a gateway-capable peer or run pim on a Linux device`
  - `daemon does not advertise route.set_split_default · upgrade pim-daemon`
- Buttons: `[ TURN ON ROUTING ]`, `[ TURN OFF ROUTING ]`, `[ CONFIRM TURN ON ]`, `[ CANCEL ]`

### WelcomeScreen (Phase 4)

- Title: `█ pim · ready`
- Section: `YOU'RE SET`
- Subtitle: `Two ways to start.`
- Action 1 label: `[ ADD PEER NEARBY ]`
- Action 1 description: `pair with someone in the same room — uses broadcast on your local network.`
- Action 2 label: `[ RUN SOLO ]`
- Action 2 description: `skip pairing for now. you can add peers anytime from the dashboard.`

### InvitePeerSheet (Phase 4)

- Title: `INVITE A REMOTE PEER`
- Body (verbatim, single multiline string with `\n\n` separators):

```
Remote invites need an RPC the v1 daemon does not yet ship.

For now, send your peer this link to install pim on their device:

github.com/Astervia/proximity-internet-mesh

[ COPY LINK ]

Once installed, both devices on the same Wi-Fi can pair via Add peer nearby.

Remote invite RPC: planned for v0.6.
```

- Copy-link button states:
  - Default: `[ COPY LINK ]`
  - Confirmed (2 s): `[ COPIED ]`
- Full URL written to clipboard: `https://github.com/Astervia/proximity-internet-mesh`

### PeerRow handshake-fail sub-line (Phase 4)

- Sub-line: `Couldn't verify this peer · → docs/SECURITY.md §3.2`
- Tauri shell.open target: `https://github.com/Astervia/proximity-internet-mesh/blob/main/docs/SECURITY.md#32-handshake-failures`

### RouteScreen empty states (Phase 4)

- Routing table empty: `no routes yet · waiting for advertisements`
- Known gateways empty: `no gateways known · pair with a gateway-capable peer or run pim on a Linux device`
- Refresh button: `[ refresh ]`

### FirstRunScreen role descriptions (Phase 6 Plan 06-01)

The role picker labels make the capability bitfield explicit so users
know whether their device will forward traffic for nearby peers. The
default is `client + relay (0x03)`; gateway implies relay.

- Option 1 primary: `Join + relay (recommended)`
- Option 1 description: `client + relay (0x03) — your device forwards traffic for nearby peers · the mesh needs relays to work`
- Option 2 primary: `Share my internet`
- Option 2 description (Linux): `client + relay + gateway (0x07) — Linux only · NAT egress for mesh peers (CAP_NET_ADMIN + iptables)`
- Option 2 description (non-Linux, disabled): `Gateway mode is Linux-only today. Your device can still join a mesh as a client or relay.`

### RelaySection — RelayOffConfirmAlertDialog (Phase 6 Plan 06-01)

Destructive confirm gate when the user flips `[relay].enabled` from
true to false. Surfaces the trade-off explicitly: a mesh full of
client-only nodes loses paths to gateways.

- Title: `Run as client only?`
- Body: `Without relay, this device only consumes the mesh — it stops forwarding traffic for nearby peers. The mesh weakens with every client-only node, so other peers may lose paths to a gateway. Recommended: leave relay on.`
- Primary (destructive): `[ Run client only ]`
- Secondary (autofocus, safe): `[ Keep relay on ]`

### RelaySection — body copy (Phase 6 Plan 06-01)

The form-field helper text below the Switch:

- `Recommended: leave this on. When on, this node accepts inbound connections from other peers and forwards mesh frames on their behalf — the mesh needs relays to reach gateways. When off, you run as a client-only node (0x01) and other peers won't initiate connections to you.`

### Phase 3 — TeachingEmptyState microcopy (overhaul Phase 3)

Each panel below renders `<TeachingEmptyState />` with a verbatim
`headline` and an optional teaching `next` line. Both must come from
`src/lib/copy.ts` — no inline string literals in JSX.

- PeerListPanel headline: `no peers connected`
- PeerListPanel next: `discovery is listening · invite a peer to join your mesh`
- NearbyPanel headline: `no devices discovered yet`
- NearbyPanel next: `scanning local networks · auto-pair will surface peers here`
- PeersPanel headline: `no static peers`
- PeersPanel next: `discovered peers appear above · use [ + add peer ] for a manual pin`
- RouteTablePanel headline: reuses `ROUTE_TABLE_EMPTY` above.
- RouteTablePanel next: `routes appear here as soon as a peer announces a destination`
- KnownGatewaysPanel headline: reuses `KNOWN_GATEWAYS_EMPTY` above.
- KnownGatewaysPanel next: `gateways are peers offering internet egress · none yet`
