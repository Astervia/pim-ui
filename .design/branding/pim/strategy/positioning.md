# Positioning
> Phase: strategy | Brand: pim | Generated: 2026-04-15

---

## Positioning Statement

For infrastructure hackers and protocol researchers who need proximity networking they can reason about, **PIM** is the IP-level mesh overlay that treats legibility as load-bearing — because the protocol is documented, the crypto choices are named, and the failure modes are listed before you deploy.

---

## Competitive Positioning Map

**Axes:**
- **Legible ↔ Opaque:** Can you read the protocol, the crypto choices, and the failure modes without reverse-engineering the source? Does the project show its work?
- **Protocol-native ↔ Consumer-abstracted:** Does the tool route arbitrary IP traffic at L3, or does it work at the app layer? Does it hide or expose its architecture?

```
                        LEGIBLE
                           │
                 Reticulum │ Scuttlebutt
                           │
                           │          ◆ PIM (target)
                           │
  CONSUMER ────────────────┼──────────────────── PROTOCOL-NATIVE
  ABSTRACTED               │
                           │
                 Bitchat   │   cjdns
                   Briar   │   Yggdrasil
                           │
                  Tailscale │ Nebula
                  ZeroTier  │
                           │
                        OPAQUE
```

**Notes on key placements:**
- **Reticulum:** Legible protocol documentation, but Python (not systems-level) and no designed brand surface. The closest peer — PIM differentiates with Rust, IP routing, and a voice.
- **Bitchat:** Has terminal/IRC voice (designed surface) but app-layer only, BLE-limited, opaque protocol (no published spec). Voice without legibility.
- **Tailscale / Nebula / ZeroTier:** Consumer-abstracted by design — they hide the control plane as a feature, not a bug. Legitimate choice for their audience; wrong model for Mira.
- **cjdns / Yggdrasil:** Protocol-native, some documentation rigor, but dormant or low-momentum. C implementations. No brand voice.
- **PIM (target):** Legible + Protocol-native + Voice. The upper-right quadrant is empty. This is where PIM lives.

---

## White Space Analysis

**The unclaimed position:** There is no Rust, IP-level proximity mesh overlay with a written protocol spec, a designed CLI surface, and a distinct voice. Every competitor either:
- Has the protocol rigour but no voice (Reticulum, cjdns)
- Has a voice but is app-layer or opaque (Bitchat, Briar)
- Routes IP packets but has aging implementations and no momentum (cjdns, Yggdrasil)
- Is commercially opaque by design (Tailscale, Nebula)

**Why this white space is defensible:**
1. Legibility requires deliberate effort — it cannot be retrofitted cheaply. PIM's commitment to documentation-as-engineering is a structural advantage.
2. Rust signals systems-level intent. In 2025–2026, Rust in the mesh/protocol space communicates precision and production ambition that Python or C implementations don't.
3. Voice requires a different kind of work than code. A project that cares about how `pim status --verbose` reads is making a signal that Mira responds to — and most protocol projects never bother.

**Risk:** Reticulum could close the voice gap. The response: PIM's IP-level routing and Rust implementation are structural differentiators that Reticulum's architecture cannot easily match.
