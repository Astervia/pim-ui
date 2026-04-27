# pim-ui · Security model

> v1 minimal. Aggregates the security-relevant invariants from
> kernel docs/PROTOCOL.md and the pim-daemon source. Updated as
> capabilities expand.

## 1. Threat model (v1 desktop)

- Local Unix socket only — no remote daemon attack surface in v1.
- Trusts the OS user — pim-daemon runs as the desktop user, has no
  privilege escalation.
- Does NOT defend against a malicious peer who has already obtained
  your identity key (key compromise = mesh compromise).

## 2. Transport encryption

- Noise Protocol Framework — IK pattern.
- X25519 for static + ephemeral key exchange.
- ChaCha20-Poly1305 for AEAD encryption of every datagram.
- HKDF-SHA256 for key derivation.
- No plaintext mode. No optional encryption knob.

## 3. Peer authentication

### 3.1 Trust models

- **Trust-on-first-use (TOFU)** — default. The first time a peer is
  seen, its node_id is recorded. Subsequent connections must match.
- **allow_list** — only peers in the configured `[trust] allow_list`
  can pair. Strictest mode.
- **allow_all** — every peer is trusted. Use only for closed networks.

### 3.2 Handshake failures

When a peer pair fails (`pair_failed` event), the daemon emits a
reason string. Common reasons:

- **untrusted peer ID** — the peer's announced node_id is not in
  your allow_list, or TOFU detected a node_id change for a known
  address.
- **noise handshake rejected** — cryptographic verification failed.
  Causes: typo in the peer's address, daemon version mismatch,
  impersonation attempt.
- **timeout** — the peer didn't respond within the handshake budget
  (5 s default).

**Resolution path:**

1. Read the peer's actual node_id from their `pim status` output.
2. Compare against the value your peer row shows.
3. If they match: re-pair from a clean slate (`pim peers forget {short_id}`
   on the rejecting side).
4. If they don't match: STOP — investigate before re-pairing. A node_id
   mismatch is the cryptographic signal of a man-in-the-middle attempt.

## 4. Kill-switch behavior

When `Route internet via mesh` is on AND every known gateway is lost,
pim's kill-switch engages: split-default routes stay installed but no
egress is reachable, blocking internet rather than silently bypassing
the mesh. The dashboard surfaces this via the BLOCKING INTERNET banner.
Turning routing off (`route.set_split_default(on=false)`) restores
normal OS routing.

## 5. What pim does NOT do

- No identity backup (intentional — your key file is your identity).
- No reputation scores, rate limiting, or onion routing.
- No traffic obfuscation — the daemon does not pad packets.
