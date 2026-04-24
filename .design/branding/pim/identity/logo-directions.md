# Logo Directions
> Phase: identity | Brand: pim | Generated: 2026-04-15

---

## Direction 1: Wordmark + Signal Pulse ✦ Recommended

**Concept:** The wordmark `pim` in Geist Mono 600, preceded by a filled square `█` (Unicode U+2588, FULL BLOCK). The cursor-block is the logo's icon — the terminal's heartbeat at the moment before a command executes. Poised, ready, precise.

**Rationale:** The cursor-block is the most universally legible terminal metaphor — it requires no explanation to Mira's audience. It signals "this was built by people who live in the terminal, not people who made UI about the terminal." Connects to Sage archetype (shows its work), Outlaw inflection (refuses decorative logo conventions), and the brand promise ("read before you route").

**Mark type:** Combination mark — geometric symbol + wordmark

### Construction geometry

```
  Reference unit: X = cap height of 'pim' at base size

  ┌──────────────────────────────────────────┐
  │                                          │
  │   █   p i m                              │
  │   ↑   ↑                                  │
  │   X   X    ← both elements same cap height
  │                                          │
  │   gap between █ and 'p': 0.75X          │
  │   █ width: X (perfect square)            │
  │   █ to wordmark baseline: shared         │
  │                                          │
  └──────────────────────────────────────────┘
```

- Symbol (`█`): monospace character — inherits exact width from the typeface
- Gap: exactly one space character (monospace — the gap is typographically precise, not optical)
- The system: `█ pim` is literally typeable in any terminal with the logo intact

### Animated variant (hero only)

The primary logo has a canonical animated variant for hero/landing contexts:

1. **t=0s** — `█` appears and starts blinking at 1.1s step-end infinite (terminal cursor rhythm)
2. **t=0.5s** — `pim` begins typing, character by character, using `steps(3, end)` over 0.9s — reveals `p`, then `pi`, then `pim`
3. **t=1.4s+** — typing complete, `█` continues blinking perpetually as the logo's heartbeat

The animation plays once on page load. Respect `prefers-reduced-motion: reduce` — render static `█ pim` with no animation in that case.

Restrict to hero contexts only (landing page, docs header, splash). Nav/sticky contexts and favicons stay static — a perpetually blinking cursor at nav scale is a distraction, not a brand signal.

See `patterns/components/token-mapping.md` for the React + CSS recipe.

### Variations

**Primary (color, static):**
```
  █ pim        — █ in signal green #22c55e, 'pim' in text primary #d4d8d4
```

**Primary (monochrome):**
```
  █ pim        — both elements in #a8d5a2, single weight
```

**Dark-on-light (forced context):**
```
  █ pim        — both elements in #0e1a0f, on #f5f8f5
```

**Icon only (favicon, small contexts):**
```
  █            — signal green #22c55e, 12×12px minimum
```

**Reversed (on light bg):**
```
  ■ pim        — black square + black wordmark on white/light
```

**ASCII header (documentation):**
```
  ┌──────────────────────┐
  │  █ pim               │
  └──────────────────────┘
```

**Shell prompt variant (CLI contexts):**
```
  > pim
```
(prompt-style, no block — for use within terminal output headers where `█` might not render)

### Clear space

Minimum clear space: **1X on all sides** where X = cap height of the wordmark.

At 20px cap height: 20px minimum margin around the full lockup.

### Minimum size

- **Full lockup `█ pim`:** 80px wide / 16px cap height minimum
- **Icon only `█`:** 12×12px minimum (renders at 1em in any terminal)
- **No scaling** — never scale the wordmark below minimum; switch to icon-only at small sizes

### Don'ts

- Never use a non-monospace font — the spacing of `█ pim` is built on monospace precision
- Never adjust the gap between `█` and `p` — it is exactly one space character
- Never use a colored wordmark (only the `█` carries the brand color)
- Never outline the `█` — it is always filled, never stroked
- Never add drop shadows, glows, or effects to the mark
- Never place on a gradient or photographic background

---

## Direction 2: Mesh Topology Motif

**Concept:** A minimal ASCII peer-to-peer topology diagram used as a recurring mark — three nodes connected by ASCII lines, with the gateway node (`●`) in signal green. The mark diagrams what PIM does rather than symbolizing it.

**Rationale:** Directly expresses the protocol — peer-to-peer forwarding with a gateway. Mira reads it as a network diagram immediately. Connects to Sage archetype (shows the mechanism) and positioning (protocol-native). Constructed entirely from Unicode characters — renders in any terminal.

**Mark type:** Abstract symbol + wordmark (combination mark)

### Construction geometry

```
  ○──●──○
     │
     pim

  ○ = peer node (Unicode U+25CB, WHITE CIRCLE)
  ● = gateway node (Unicode U+25CF, BLACK CIRCLE) — signal green in color
  ── = direct link (em dashes or box-drawing)
  │  = branch (box-drawing U+2502)
```

- Horizontal width: 7 characters (monospace grid-aligned)
- Vertical height: 2 characters + gap + wordmark
- The middle `●` is always the gateway — the node with egress

### Variations

- **Primary:** `○──●──○ / pim` stacked, gateway in signal green
- **Icon only:** `●` — the gateway node, signal green, 12×12px minimum
- **Horizontal:** `○──●──○  pim` — 3-node diagram + wordmark inline
- **Extended (docs):** multi-hop chain for architecture section headers

### Clear space

**0.75X on all sides** where X = cap height of wordmark. The topology diagram is compact — less clear space needed than Direction 1.

### Minimum size

- **Full lockup:** 96px wide minimum
- **Icon `●`:** 12×12px minimum

### Don'ts

- Never use more than 3 nodes — legibility degrades
- Never use a different character for the gateway — `●` is always the filled node
- Never render as SVG circles with stroke — must read as ASCII/Unicode in terminal contexts
- Never add arrowheads or directional indicators — the topology is peer-to-peer, not hierarchical

---

## Direction 3: Pure Wordmark

**Concept:** `pim` — nothing else. All-lowercase, Geist Mono 600, signal green. The confidence of the wordmark alone is the statement.

**Rationale:** The hardest logo to pull off and the most distinctive when it works. WireGuard does this — the project's rigour speaks for the mark. The "Alive" voice quality: the absence of decoration is itself a declaration. The trailing underscore variant (`pim_`) brings back the cursor motif in a more minimal form.

**Mark type:** Wordmark (type only)

### Construction

- Typeface: Geist Mono 600
- Color: signal green `#22c55e` on dark ground; text primary `#a8d5a2` when signal green is used elsewhere on the same surface
- Tracking: 0.02em (very slightly open — mono fonts already have adequate spacing)
- Case: always lowercase — `pim`, never `PIM` or `Pim`

### Variations

- **Primary:** `pim` — signal green, Geist Mono 600
- **With cursor:** `pim_` — trailing underscore as punctuation (animated blink in interactive contexts only)
- **Bracketed (inline docs):** `[pim]` — for use within body text referencing the project
- **Shell prefix (CLI contexts):** `> pim` — prompt character before wordmark in command examples
- **Monochrome:** `pim` — in text primary `#a8d5a2`, single weight

### Clear space

**1.5X on left/right, 0.75X on top/bottom** — the wordmark needs horizontal breathing room.

### Minimum size

- **Primary wordmark:** 48px wide / 12px cap height minimum
- **`pim_` cursor variant:** interactive/animated contexts only, minimum 64px wide

### Don'ts

- Never capitalize — `pim`, not `PIM`, `Pim`, or `PIM`
- Never use a non-monospace font — the wordmark depends on the grid precision of Geist Mono
- Never use the `pim_` cursor variant in static print/non-interactive contexts
- Never stretch or condense — Geist Mono's proportions are exact
- Never use the wordmark at less than 12px cap height — switch to abbreviation or icon at that size

---

## Recommended system

- **Primary brand mark:** Direction 1 (`█ pim`) — cursor-block + wordmark
- **Documentation diagrams:** Direction 2 motif (topology diagram as a recurring visual element within docs, not as logo)
- **Inline/prose:** Direction 3 variants (`[pim]`, `> pim`) within body text and CLI output
- **Favicon:** Direction 1 icon-only (`█` at 12×12px, signal green)

---

## Related

- [color-system.md](./color-system.md)
- [typography.md](./typography.md)
