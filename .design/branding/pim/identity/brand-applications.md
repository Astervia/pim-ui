# Brand Applications
> Phase: identity | Brand: pim | Generated: 2026-04-15

---

## Application 1: Documentation site hero

The first thing Mira sees. Full-width dark ground (`#080e09`). The `pim status --verbose` panel as a live-rendered or static artifact in the center. Above it: `█ pim` wordmark in signal green, `#22c55e`. Below it: the tagline in pale phosphor.

```
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  █ pim                                                       │
  │                                                              │
  │  Infrastructure you can read.                                │
  │                                                              │
  │  ┌────────────────────────────────────────────────────┐     │
  │  │  █ pim  ·  status --verbose               [OK]    │     │
  │  ├────────────────────────────────────────────────────┤     │
  │  │  node        client-a                              │     │
  │  │  interface   pim0                     ◆ up         │     │
  │  │  peers       3 connected                           │     │
  │  │    gateway   10.77.0.1    via tcp    ◆ active      │     │
  │  │    relay-b   10.77.0.22   via tcp    ◆ active      │     │
  │  │  forwarded   4.2 MB  ·  3,847 pkts                 │     │
  │  └────────────────────────────────────────────────────┘     │
  │                                                              │
  │  [ READ THE PROTOCOL ]          [ VIEW ON GITHUB ]          │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘
```

**Design notes:**
- Background: `#080e09`. Panel background: `#0e1a0f`. Panel border: `#1e3320`.
- Wordmark: Geist Mono 600, `#22c55e`.
- Tagline: Geist Mono 400, `#a8d5a2`, slightly smaller.
- Buttons: bracketed style `[ READ THE PROTOCOL ]` — Geist Mono 500, `#a8d5a2` on `#0e1a0f`, 1px border `#1e3320`. Hover: inverts to signal green bg, black text.
- `◆` indicators: `#22c55e`. Values: `#a8d5a2`.

---

## Application 2: GitHub README header

ASCII-rendered header that degrades gracefully to plain text in any terminal or rendered markdown.

```
  ┌──────────────────────────────────────────────────────┐
  │  █ pim  ·  proximity internet mesh                   │
  │  infrastructure you can read                         │
  └──────────────────────────────────────────────────────┘

  IP-level mesh overlay · Rust · TCP today · Wi-Fi Direct pending
  Protocol documented · Crypto named · Failure modes listed
```

**Design notes:**
- Box-drawing characters render in both GitHub dark and light mode.
- The tagline line `infrastructure you can read` appears below the wordmark without punctuation — statement, not slogan.
- The second paragraph is metadata-style: `·` separators, lowercase, no caps. This is PIM's "spec header" — it reads like a protocol file header.

---

## Application 3: CLI help output

`pim --help` is a brand surface. The help text should follow voice guidelines (declarative, specific, no hedges) and use the same visual structure as `status --verbose`.

```
  █ pim  ·  proximity internet mesh

  USAGE
    pim <command> [flags]

  COMMANDS
    up        Start the daemon (requires root or CAP_NET_ADMIN)
    down      Stop the daemon
    status    Show node state, peers, and forwarding stats
    route     Manage split-default routing through the mesh
    config    Generate or validate configuration

  FLAGS
    --config   Path to config file  [default: /etc/pim/pim.toml]
    --daemon   Run in background
    --verbose  Verbose output
    --help     Show this message

  DOCUMENTATION
    docs/PROTOCOL.md  — protocol specification
    docs/CRYPTO.md    — cryptographic choices and rationale
```

**Design notes:**
- Section headers (USAGE, COMMANDS, FLAGS) in Geist Mono 500, signal green — or ALL CAPS in the terminal's text color (color not always available in all terminals).
- Command names: JetBrains Mono, monospace.
- Descriptions: plain prose, declarative.
- The documentation section at the bottom is intentional — every CLI interaction ends with a pointer to where to read more.

---

## Application 4: Error message in CLI

Error messages follow the voice guide: specific failure, where to look, no apology.

```
  [ERR] peer session closed: key exchange failed

        Both nodes must share the same trust anchor.
        Check that key_file paths match on both sides.

        See docs/SECURITY.md §3.2 — Trust Anchors
```

**Design notes:**
- `[ERR]` badge: Geist Mono 500, signal red `#ff5555`.
- Primary error description: Geist Mono 400, phosphor text.
- Explanation: Geist Mono 400, text-secondary, indented.
- Documentation pointer: always present, always specific (section number, not just file).

---

## Application 5: Terminal output — route status

```
  ┌───────────────────────────────────────────────────────┐
  │  pim route status                                     │
  ├───────────────────────────────────────────────────────┤
  │  split-default routing    ◆ active                    │
  │                                                       │
  │  0.0.0.0/1     via 10.77.0.1  on pim0    ◆ installed │
  │  128.0.0.0/1   via 10.77.0.1  on pim0    ◆ installed │
  │                                                       │
  │  internet traffic is routing through the mesh.        │
  │  gateway: 10.77.0.1 (relay-b → gateway-c)            │
  │                                                       │
  │  to disable:  sudo pim route off                      │
  └───────────────────────────────────────────────────────┘
```

**Design notes:**
- The final line `to disable: sudo pim route off` is always present when a mode is active — PIM tells you how to undo what it did. This is the brand's Honesty value in CLI form.

---

## Application 6: Social preview (GitHub og:image)

A static dark card, 1200×630px. Left half: `█ pim` wordmark large, tagline below. Right half: the `status --verbose` panel as a screenshot/render. Signal green on `#080e09` ground. No photography, no illustration, no gradient.
