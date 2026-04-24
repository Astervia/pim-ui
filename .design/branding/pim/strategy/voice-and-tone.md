# Voice & Tone
> Phase: strategy | Brand: pim | Generated: 2026-04-15

---

## Voice Attributes

PIM's voice is **Declarative, Legible, Alive**. Three attributes, all required simultaneously.

---

### 1. Declarative

| | |
|---|---|
| **Means** | Statements, not hedges. PIM says what it does, what it doesn't do, and what happened. Active voice, present tense. Commits to claims. |
| **Doesn't mean** | Aggressive, absolutist, or dismissive. Declarative is confident, not arrogant. |
| **Do** | "The protocol is documented in `docs/PROTOCOL.md`." |
| **Don't** | "We've tried to document most of the protocol in a document that should be available." |
| **Do** | "Peer session closed: key exchange failed. Check that both nodes share the same trust anchor." |
| **Don't** | "There may have been an issue with the peer connection. Please check your configuration." |
| **Do** | "TCP today. Wi-Fi Direct when the transport layer catches up." |
| **Don't** | "We're currently using TCP but may eventually support other transports in the future." |

---

### 2. Legible

| | |
|---|---|
| **Means** | Names things precisely. Uses the right technical term, not a marketing proxy. Shows the work — explains not just what but why a choice was made. Structures information so Mira can navigate it at speed. |
| **Doesn't mean** | Jargon as gatekeeping. Legible means Mira can read it — it doesn't mean she needs a glossary to start. |
| **Do** | "Key agreement uses X25519. Message encryption uses ChaCha20-Poly1305 with HKDF-SHA256 for key derivation." |
| **Don't** | "Military-grade end-to-end encryption protects your data." |
| **Do** | "Gateway NAT is Linux-only. macOS nodes can run as clients or relays." |
| **Don't** | "Platform support varies." |
| **Do** | "Why not AES-GCM? ChaCha20-Poly1305 is faster on hardware without AES acceleration — the class of device most likely to run as a relay." |
| **Don't** | (silently choosing an algorithm without explanation) |

---

### 3. Alive

| | |
|---|---|
| **Means** | The writing has a perspective. There is someone behind it who built the thing and cares about it. The Outlaw secondary archetype lives here — the observation that the category earns a pointed remark, used sparingly. Dry wit is acceptable when the situation earns it. |
| **Doesn't mean** | Personality for its own sake. Humor that dilutes trust. Snark at competitors. Alive means the writing has a pulse, not that it's performing personality. |
| **Do** | "No magic. Read the spec, run the tests, route your packets." |
| **Don't** | A wall of specification prose with no point of view anywhere. |
| **Do** | "Most tools calling themselves 'mesh' route through someone else's server. PIM doesn't." (only when contextually earned) |
| **Don't** | Sustained competitive sniping. Named-competitor criticism in brand voice. |
| **Do** | Comments in source that acknowledge why a hard call was made: "// Using ChaCha20 here rather than AES-GCM for performance on ARM devices without hardware AES — see rationale in docs/PROTOCOL.md §4.2" |
| **Don't** | "// encrypt" with no context |

---

## Tone Spectrum

PIM's default position on each scale. Context shifts are noted.

```
  Formal    1 ──●── 3 ───── 5  Casual        Default: 2 (formal-leaning)
  Serious   1 ─●─── 3 ───── 5  Playful       Default: 2 (serious)
  Auth.     1 ──●── 3 ───── 5  Friendly      Default: 2 (authoritative)
  Technical 1 ─●─── 3 ───── 5  Simple        Default: 1.5 (technical — Mira handles this)
  Reserved  1 ──●── 3 ───── 5  Enthusiastic  Default: 2 (reserved)
```

### Context shifts

| Context | Formal↔Casual | Serious↔Playful | Auth↔Friendly | Technical↔Simple |
|---------|:---:|:---:|:---:|:---:|
| Protocol documentation | 1 | 1 | 2 | 1 |
| README introduction | 2 | 2 | 2 | 2 |
| CLI help text | 2 | 2 | 2 | 1.5 |
| Error messages | 1 | 1 | 3 | 1.5 |
| Success states | 2 | 3 | 3 | 2 |
| Release notes | 2 | 2 | 2 | 2 |
| GitHub Issues response | 2 | 2 | 3 | 2 |
| HN / community posts | 3 | 3 | 3 | 2 |
| README "Current Limitations" | 1 | 1 | 2 | 1 |

**Key shift:** Error messages move toward friendly (3) on the Auth↔Friendly scale — Mira hit a problem, she doesn't need condescension. But tone stays formal (1) and serious (1) — the error message is helping her debug a real system failure.

---

## Style Rules

**Contractions:** Yes, sparingly. "It's" and "doesn't" in prose contexts. Never in protocol specifications.

**Oxford comma:** Always.

**Exclamation marks:** Never. PIM does not exclaim.

**Emoji:** Never in documentation or CLI output. Reserved for community contexts (GitHub reactions, Matrix, HN) where the author is speaking as a person, not the project.

**First person:** "PIM" as the subject, not "we." ("PIM forwards IP traffic." Not "We forward IP traffic.") When a human is clearly speaking (release notes, GitHub Issues), "we" is acceptable.

**Addressing users:** Direct "you" in instructional contexts. Never "the user."

**Sentence length:** Short to medium. Target 15 words. Technical sentences can go longer when the structure requires it — don't truncate a protocol explanation into ambiguity. But every sentence that can be shorter should be.

**Jargon:** Use freely, without apology. Mira knows what TUN, HKDF, distance-vector, and egress mean. Define only PIM-specific concepts (mesh IP, trust anchor in PIM's specific sense) on first use.

**Hedges to eliminate:** "basically," "essentially," "kind of," "sort of," "may," "might," "could," "potentially," "perhaps," "in some ways," "arguably." Replace every hedge with either a declarative statement or an honest acknowledgment of uncertainty ("We don't yet know whether X").

**Passive voice:** Avoid except in protocol specifications where the subject is genuinely ambiguous or where passive is the precise technical convention.

---

## Nomenclature

**The project:** "PIM" (caps, always). The abbreviation is the name.
**The full form:** "Proximity Internet Mesh" — used in formal contexts, never in CLI output.
**The daemon binary:** `pim-daemon`
**The CLI binary:** `pim`
**Peer link types:** "client," "relay," "gateway" — lowercase, unadorned.
**The overlay network:** "the mesh" (lowercase) — never "PIM Network" or "PIMnet."
**Crypto terms:** Always the algorithm name (X25519, ChaCha20-Poly1305, HKDF-SHA256), never the property name alone ("encryption," "key exchange").
**"Mesh" usage:** Use precisely — "mesh" means peer-to-peer forwarding without a central hub. When describing the category, note this distinction.
