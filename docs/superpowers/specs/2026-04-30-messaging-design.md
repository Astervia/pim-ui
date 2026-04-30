---
date: 2026-04-30
title: Peer-to-peer encrypted messaging
status: design-approved-autonomous
authors:
  - pim · creator (Pedro)
  - claude (autonomous)
---

# Peer-to-peer encrypted messaging — design

## Goal

Add a `Conversations` surface to pim-ui that lets the user exchange text
messages with any peer in their mesh. Messages are end-to-end encrypted,
authenticated by cryptographic identity, and persist across restarts and
across changes of peer name or mesh IP.

## Non-goals (v1)

- File / image / voice attachments
- Group conversations
- Edit / delete / reactions / typing indicators
- Read receipts beyond a single delivered/read flag
- Forward secrecy ratchet beyond what ECIES already gives (sender uses an
  ephemeral key per message; recipient's static key compromise still
  exposes history — accepted for v1, document threat model honestly)
- Multi-hop messaging to non-direct peers (deferred until X25519 gossip
  rides on RouteUpdateFrame in v1.1)

## Architecture

### Identity & encryption

- Each peer's **stable identity** is its `NodeId` (16 bytes, derived from
  the Ed25519 verifying key). Names and mesh IPs change; node_id does not.
- E2E encryption uses the existing `pim-crypto::e2e` module (ECIES =
  ephemeral X25519 → HKDF-SHA256 → AES-256-GCM).
- For ECDH the daemon needs **the recipient's X25519 static public key**,
  which is derived from their Ed25519 seed and therefore not computable
  from the public Ed25519 key alone. Distribution: see "PeerInfo
  exchange" below.

### Wire-level changes (kernel repo)

Three new `ControlType` discriminants on the existing `ControlFrame`
enum (in `pim-protocol`). They ride inside `MeshDataFrame` with
`DataFlags::IS_CONTROL` set, so the daemon's existing routing handles
multi-hop delivery between directly-connected peers.

| New variant | Discriminant | Body |
|---|---|---|
| `ControlType::PeerInfo` | `0x07` | `x25519_pub: [u8; 32] · friendly_name_len: u8 · friendly_name: utf-8` |
| `ControlType::Message` | `0x08` | `message_id: [u8; 16] · timestamp_ms: u64 · ciphertext_len: u16 · ciphertext` |
| `ControlType::MessageAck` | `0x09` | `message_id: [u8; 16] · ack_kind: u8` (1=delivered, 2=read) |

`PeerInfo` is sent **once** in each direction immediately after the
mesh-routed `ControlType::IpAssign` (or after the first established
session). Receiving daemon caches `node_id → x25519_pub` in memory and
persists in SQLite for cross-restart memory.

`Message`'s `ciphertext` is the literal output of
`e2e_encrypt(utf8_body_bytes, recipient_x25519_pub)`. The whole
`MeshDataFrame` carries `flags = IS_CONTROL | IS_E2E`. Intermediate
relays cannot decrypt; only the recipient holds the X25519 private
half.

`MessageAck` rides as plain hop-by-hop (no IS_E2E) — the ack contains
no secret, only the message_id, and integrity is already guaranteed by
the per-link AES-GCM session.

### Daemon storage (kernel repo)

New crate **`pim-messaging`** (workspace member). Owns SQLite database
at `data_dir/messages.db` (created with mode 0600 on Unix).

```sql
CREATE TABLE peers_seen (
  node_id            TEXT PRIMARY KEY,            -- 32-char hex
  x25519_pub         BLOB NOT NULL,               -- 32 bytes
  last_known_name    TEXT,
  first_seen_ms      INTEGER NOT NULL,
  last_seen_ms       INTEGER NOT NULL
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,               -- UUIDv4 hex (no dashes)
  peer_node_id    TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK(direction IN ('sent','received')),
  body            TEXT NOT NULL,                  -- utf-8 plaintext, max 8 KB
  timestamp_ms    INTEGER NOT NULL,
  status          TEXT NOT NULL CHECK(status IN ('pending','sent','delivered','read','failed')),
  failure_reason  TEXT,
  delivered_at_ms INTEGER,
  read_at_ms      INTEGER,
  FOREIGN KEY(peer_node_id) REFERENCES peers_seen(node_id)
);
CREATE INDEX idx_msg_peer_ts ON messages(peer_node_id, timestamp_ms DESC);

CREATE TABLE conversations_meta (
  peer_node_id          TEXT PRIMARY KEY,
  unread_count          INTEGER NOT NULL DEFAULT 0,
  last_read_message_id  TEXT
);
```

Ring constant: `MAX_BODY_BYTES = 8 * 1024`.

### RPC surface (kernel + UI)

Following existing snake_case + JSON-RPC 2.0 conventions in
`docs/RPC.md`.

```text
messages.list_conversations()
  → { conversations: [{
        peer_node_id, peer_node_id_short, name,
        last_message_preview, last_message_ts_ms, unread_count,
        is_connected
      }] }

messages.history({ peer_node_id, before_ts_ms?, limit? = 100 })
  → { messages: [{
        id, peer_node_id, direction, body, timestamp_ms,
        status, delivered_at_ms?, read_at_ms?
      }], has_more }

messages.send({ peer_node_id, body })
  → { id, timestamp_ms, status }    // status starts as 'pending', becomes 'sent' on transport ack

messages.mark_read({ peer_node_id, up_to_ts_ms })
  → { unread_count: 0 }

messages.subscribe()
  → { ok: true }   // existing subscribe pattern; events arrive on `messages.event`

messages.unsubscribe()
  → { ok: true }
```

Event stream `messages.event` emits notifications:

```text
{ kind: "message_received", message: Message, conversation_meta: {...} }
{ kind: "message_status",   message_id, peer_node_id, new_status, at_ms }
{ kind: "peer_seen",         peer_node_id, name, x25519_known: bool }
```

New error codes:

```
MessagePeerUnknown      -32060   // no x25519 pub cached for this peer yet
MessageBodyTooLarge     -32061   // > 8 KB
MessageStorageError     -32062
MessagePeerOffline      -32063   // best-effort; still queued as 'pending'
```

### UI (pim-ui)

New screen `Conversations` mounted at sidebar position **⌘6** (between
Logs ⌘5 and Settings ⌘,).

```
╔════════════════════════════════════════════════════════════════════╗
║  █ pim · conversations                                            ║
║  via mesh · noise + ecies e2e · stored locally                    ║
╠════════════════════════════════════════════════════════════════════╣
║ ┌── peers ─────────┐ ┌── relay-b · 7f8e…a3c2 ───────────────────┐ ║
║ │ ◆ relay-b     3  │ │ direct · tcp · 12ms · last seen now      │ ║
║ │ ◆ gateway-c      │ │                                          │ ║
║ │ ○ client-c       │ │ 21:14  > hey                             │ ║
║ │                  │ │ 21:14  < hey, you set up?                │ ║
║ │ ── known ──      │ │ 21:15  > yep, hop count 1                │ ║
║ │ ○ alice-laptop   │ │                                          │ ║
║ └──────────────────┘ │ ┌──────────────────────────────────────┐ │ ║
║                      │ │ type a message, ⌘↵ to send          │ │ ║
║                      │ └──────────────────────────────────────┘ │ ║
║                      └──────────────────────────────────────────┘ ║
╚════════════════════════════════════════════════════════════════════╝
```

Brand discipline (per `.design/branding/pim/patterns/STYLE.md`):

- All borders are box-drawing characters; **no `border-radius`**, **no
  `border-image`**, **no gradients**, **no `shadow-*`**.
- Typography: Geist Mono / JetBrains Mono only.
- Colors only from the existing tokens in `globals.css`.
- Bullets: `◆` for connected peers, `○` for known-but-disconnected.
- Sent messages prefixed `>`, received prefixed `<`.

States:

| State | Visual |
|---|---|
| No peer selected | center hint: "no conversation selected · pick a peer on the left" |
| Peer selected, no messages | center hint: "no messages with {name} yet · type below to start" |
| Sending | message row dims to 50%, status "·" |
| Delivered | status "✓" |
| Read | status "✓✓" |
| Failed | status "✗" + sub-line "tap to retry" |
| Peer unknown (no X25519 yet) | composer disabled, banner: "still learning {name}'s key — usually takes a few seconds after they come online" |

### Components (UI)

| Component | Purpose |
|---|---|
| `screens/conversations.tsx` | Top-level screen mounted via `<ActiveScreen>` |
| `components/conversations/peer-list.tsx` | Sidebar peer list with active/known split |
| `components/conversations/conversation-pane.tsx` | Active thread + composer |
| `components/conversations/message-row.tsx` | Single message line (sent/received variant) |
| `components/conversations/composer.tsx` | textarea + send button + ⌘↵ binding |
| `hooks/use-conversations.ts` | Module-level atom mirroring usePeerTroubleshootLog pattern; subscribes to `messages.event` via W1 fan-out |
| `hooks/use-message-history.ts` | Per-peer paginated history fetcher |
| `lib/conversations/format.ts` | timestamp formatting + preview truncation |

State management follows existing patterns: module-level atom +
`useSyncExternalStore`. Events arrive via `actions.subscribe('messages.event', handler)` — no new Tauri `listen()` call (W1 single-listener invariant preserved).

## Threat model (honest)

- **Active relay attacker** (controls a hop): can drop messages, delay
  delivery, observe metadata (sender / recipient node_id, timestamp,
  ciphertext length). **Cannot read or forge content** — ciphertext is
  ECIES-bound to recipient's X25519 static; sender authenticated via
  Ed25519 (Noise transport).
- **Passive eavesdropper on a hop**: same as above minus drop/delay.
- **Compromised recipient device**: full plaintext exposure of all past
  messages. (Forward secrecy ratchet not implemented in v1.)
- **Compromised sender device**: same. Plus impersonation going forward
  until peer revokes trust.
- **Metadata leak to relays**: graph-position + timestamp + size. No
  onion routing.

## Scope cuts triaged for v1

- Multi-hop messaging to non-direct peers (X25519 distribution gossip)
  — direct + cached-known peers only
- Message search (SQLite FTS) — defer
- Conversation pinning / archiving — defer
- Message edit / delete — defer
- Read receipts (✓✓) — implement; cross-device sync not in scope
- SimpleShell (`/simple-shell`) entry — out of scope for first cut;
  AppShell only

## Documentation updates

1. `.planning/PROJECT.md`: move "Built-in chat" from **Out of Scope** to
   **Active**, citing user decision 2026-04-30.
2. `docs/UX-PLAN.md` line 733: remove or qualify the "pim is not a
   messenger" exclusion.
3. `proximity-internet-mesh/docs/RPC.md`: add the four `messages.*`
   methods + `messages.event` stream + 4 new error codes.
4. `proximity-internet-mesh/docs/SECURITY.md`: add §3.5 "Messaging
   threat model" mirroring the table above.

## Phase decomposition

| # | Layer | Repo | Deliverable |
|---|---|---|---|
| 1 | Wire | kernel | new ControlType variants in pim-protocol + tests |
| 2 | Storage + dispatch | kernel | `pim-messaging` crate (sqlite + ack/retry queue) |
| 3 | Daemon integration | kernel | wire `pim-messaging` into app event loop; cache PeerInfo; emit RPC events |
| 4 | RPC surface | kernel | 4 new methods + event stream + docs/RPC.md |
| 5 | UI types + hooks | pim-ui | rpc-types.ts, useConversations, useMessageHistory |
| 6 | UI screens | pim-ui | Conversations screen + components + ⌘6 binding |
| 7 | Binary integration | pim-ui | rebuild daemon, copy binary, smoke test |
| 8 | Scope docs | both | update PROJECT.md / UX-PLAN.md / SECURITY.md |
