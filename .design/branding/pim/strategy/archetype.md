# Archetype
> Phase: strategy | Brand: pim | Generated: 2026-04-15

---

## Primary Archetype: The Sage

**Core desire:** Truth, knowledge, understanding.
**Brand promise:** The truth — the protocol, the crypto choices, the failure modes — will set you free.
**Traits:** Knowledgeable, analytical, transparent, rigorous, informative.

**Why The Sage fits PIM:**
Mira doesn't trust tools she can't read. Her trust signal is the protocol spec, the named crypto primitives, and the honest list of what the tool does *not* do yet. The Sage's fundamental promise — "here is the truth, read it" — maps exactly to PIM's structural advantage. PIM's moat is legibility; the Sage archetype is legibility made into a brand personality.

The Sage also fits the competitive gap: in a space where most projects either hide their architecture (Tailscale, Nebula) or have legible architecture but no voice (Reticulum), the Sage occupies the credible, transparent position that PIM can actually deliver on.

**Sage communication style for PIM:**
- Declarations over descriptions: "The protocol is documented." Not "We tried to document the protocol."
- Names things precisely: X25519, ChaCha20-Poly1305, distance-vector routing, egress gateway — never "military-grade encryption" or "smart routing."
- Acknowledges limits: "TCP today, Wi-Fi Direct as the target." Honesty about current state is a trust-building act, not a weakness to hide.
- Educational where needed, never condescending: The Sage assumes the audience is literate. PIM never explains what a TUN interface is to Mira — she knows. It does explain PIM's specific implementation choices.

**Sage visual tendencies:**
Clean typography, structured layouts, data visualization, muted palettes. The `terminal` style base (selected) aligns directly — a design system that foregrounds information and minimizes decoration. Sage visual language = the protocol spec is the wallpaper.

---

## Secondary Archetype: The Outlaw (Rebel)

**Core desire:** Revolution, liberation — breaking the conventions that serve the wrong people.
**Traits:** Disruptive, unconventional, principled, anti-establishment.

**Why The Outlaw (secondary) fits PIM:**
The Sage alone risks tipping into the "lifeless academic" anti-direction — rigorous but bloodless. The Outlaw inflection gives PIM the edge that Reticulum lacks. PIM has a point of view: *the word "mesh" has been misused, and the tools most people reach for route through someone else's server.* That's not neutral. That's a position, and positions are Outlaw territory.

The Outlaw secondary is deployed sparingly — only where the category earns a pointed observation. It appears in:
- Brand positioning language: "Most mesh tools require you to trust something you can't read."
- Protocol introduction: "No magic. Read the spec, run the tests, route your packets."
- README voice: when the honest scope statement implies a structural critique of alternatives.

The Outlaw secondary must never become the primary register. PIM is not aggrieved. It is not in a feud with Tailscale. It simply disagrees with a structural choice the category makes, names that disagreement clearly, and demonstrates the alternative.

**Sage + Outlaw pairing logic:**
> Sage: "Here is the truth."
> Outlaw: "And that truth disagrees with how the industry has been operating."

This is the Reticulum whitepaper + the WireGuard website's pointed simplicity + a voice that acknowledges the competitive landscape without being petty about it.

---

## Shadow Traits to Avoid

**Sage shadow — ivory tower condescension:**
- Never: "Obviously, anyone running a mesh should understand..."
- Never: Making Mira feel uninformed for asking a question that the docs should have answered.
- The antidote: Write documentation that respects the reader's intelligence AND their time. Dense ≠ gatekeeping.

**Outlaw shadow — aggrieved hacker energy:**
- Never: Sustained criticism of named competitors in brand voice.
- Never: Positioning PIM as oppositional to a company (Tailscale, etc.) rather than to an architectural choice.
- Never: The edge becoming self-congratulation or tribalism.
- The antidote: The Outlaw edge is about *what PIM is for*, not what PIM is against. Point at the problem (centralized dependency, protocol opacity), not the vendor.

**Both shadows to avoid — lifeless academic tone:**
- The Sage can go dry. The Outlaw can go cold. PIM must maintain the "Alive" quality from the voice direction — the protocol prose with a pulse.
- The antidote: Every section of documentation should have at least one sentence that could only have been written by someone who actually built the thing and cares about it.
