# PIM — Design Contract

> Agent contract. Designer and builder agents consume this file directly.
> Read once, then apply everywhere. No interpretation, no drift.

---

## The brand in one line

**Infrastructure you can read is infrastructure you can trust.**

PIM is a Rust IP-level proximity mesh overlay. Its visual language is instrument-grade and terminal-native — phosphor green on green-tinted near-black, monospace everywhere, box-drawing for structure, zero decoration. Every surface (docs site, README, CLI output) is designed with the same discipline as the protocol.

---

## Archetype

**Sage (primary) + Outlaw (secondary).** The Sage shows its work — named crypto, written protocol, listed failure modes. The Outlaw edge appears only when the category earns a pointed observation; sparingly.

---

## Design tokens (source of truth: `pim.yml`)

### Color

```
  --background        #0a0c0a   near-black, subtle green undertone
  --foreground        #d4d8d4   off-white, barely-warm
  --card              #121513   surface (sidebar, card)
  --popover           #1a1e1b   surface+2 (code block, panel)
  --primary           #22c55e   signal green — active/connected/success
  --accent            #e8a84a   amber — warnings, relayed
  --destructive       #ff5555   error — failed, disconnected
  --border            #2a2e2c   hairline rules (green-neutral)
  --muted-foreground  #7a807c   text secondary (labels, metadata)
```

All text/bg pairs are WCAG AAA except text-secondary (AA-large only — never use at body size).

### Typography

- **Geist Mono** — headings, nav, labels, badges, buttons, wordmark
- **Geist** — long-form prose only (paragraphs)
- **JetBrains Mono** — code blocks, CLI output, protocol field tables

Scale: Major Third (1.250). Base 14px. Headings snap to grid (8px).

### Shape

- `border-radius: 0` — always, everywhere. Sharp corners.
- `border-width: 1px` — hairline rules, box-drawing
- No shadows. Flat layered surfaces.

### Motion

- `duration: 100ms`, `easing: linear` — instant digital response
- Cursor blink `1s step-end infinite` on active input state
- Type-reveal on hero headline
- CRT scanline overlay at 4% opacity (atmospheric)

---

## Component patterns

### Button primary
```
  [ READ THE PROTOCOL ]
```
- Bracketed text in UPPERCASE, Geist Mono 500
- `background: var(--primary)`, `color: var(--primary-foreground)`, `border: 1px solid var(--primary)`, `radius: 0`
- Hover: video-invert (background → foreground, foreground → background)

### Button secondary
```
  [ VIEW ON GITHUB ]
```
- Bracketed text, transparent background, `border: 1px solid var(--border)`
- Hover: border → `var(--primary)`, text → `var(--primary)`

### Card / Panel
- `background: var(--card)`, `border: 1px solid var(--border)`, `radius: 0`, `shadow: none`
- Optional ASCII title bar: `┌─── TITLE ───┐`

### Input
- No box — prompt-style: `> ` prefix before input
- `background: transparent`, `border: none`
- Focus: blinking block cursor `█`, no ring

### Badge / Status
```
  [OK]  [WARN]  [ERR]  [...]
```
- Bracketed, UPPERCASE, Geist Mono 500
- `[OK]` — signal green bg, background foreground
- `[WARN]` — amber bg, background foreground
- `[ERR]` — error red bg, white foreground
- Or Unicode-only: `◆` active, `◈` relayed, `○` connecting, `✗` failed

### CLI output panel (hero imagery)
```
  ┌────────────────────────────────────┐
  │  █ pim  ·  status --verbose  [OK] │
  ├────────────────────────────────────┤
  │  peers    3 connected              │
  │    gateway  10.77.0.1    ◆ active  │
  │    relay-b  10.77.0.22   ◆ active  │
  └────────────────────────────────────┘
```

Box-drawing borders in `var(--border)`, text in `var(--foreground)`, `◆` in `var(--primary)`, JetBrains Mono, 14px.

---

## Voice rules (apply to all UI copy)

- **Declarative, Legible, Alive.** Active voice, present tense. No hedges.
- Active: "The protocol is documented." · Not: "We've tried to document most of it."
- Error messages: name the failure, point to docs. "Peer session closed: key exchange failed. See docs/SECURITY.md §3.2"
- No exclamation marks.
- "PIM" as subject (not "we"). Direct "you" for the reader.
- Name crypto primitives: X25519, ChaCha20-Poly1305, HKDF-SHA256 — never "military-grade encryption."

---

## Hard constraints

### Never
- Non-monospace font on any structural element
- Any border-radius other than 0
- Shadows, glows (except phosphor text-shadow on signal green)
- Photography, illustration, mascots, hero imagery that isn't CLI/diagram-based
- Gradient backgrounds
- Blue or purple anywhere (Matrix/GitHub/Web3 associations)
- White text (`#fff`) or pure black background (`#000`)
- Exclamation marks in prose
- Lucide filled icons or multi-color icon sets
- Rounded/pill buttons

### Always
- Monospace for structure, headings, buttons, labels
- Signal green (`#22c55e`) for active/connected/success
- `border-radius: 0` everywhere
- Box-drawing borders (1px solid, sharp corners)
- Status via Unicode indicators (`◆ ◈ ○ ✗`) or bracketed codes (`[OK] [ERR]`)
- CLI output panels as first-class brand imagery
- Explicit crypto primitive names
- Honest scope statements ("TCP today, Wi-Fi Direct as target")

---

## Logo usage

- Primary: `█ pim` — cursor-block + wordmark. Block in signal green, wordmark in phosphor text.
- Favicon: `█` alone, 12×12px minimum, signal green
- Wordmark: lowercase `pim` only, never uppercase
- Inline: `[pim]` in prose, `> pim` in CLI/shell contexts
- Clear space: 1X (cap height) on all sides of full lockup

---

## Style base

This brand extends the `terminal` preset (see `.design/config.json` → `system_config.style_base`). All terminal preset constraints apply. PIM customizes the palette (replaces GitHub-green `#22c55e` was already primary — retained — with custom green-tinted ground, added `--accent` amber, removed blue `--info` that conflicts with brand).
