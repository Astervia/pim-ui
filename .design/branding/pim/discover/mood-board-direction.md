# Mood Board Direction
> Phase: discover | Brand: pim | Generated: 2026-04-15

---

## Overall Feel

PIM should feel like a scientific instrument manual written by someone who also cares about typography. Not a product brochure. Not a research paper formatted by a LaTeX template. Not a hacker movie. A well-made reference document for a tool that was designed to last.

The closest analogy: the WireGuard website combined with a Charm.sh CLI in a Reticulum-style documentation structure, with a quieter color palette than any of them and a slightly warmer ground than pure OLED black.

---

## Color Palette

The palette is built around a near-black ground, a structured greyscale for information hierarchy, and a single signal accent. The ground is warmer than pure black (avoids the harshness of #000000 and the cosplay of pure OLED-black web3 aesthetics). The accent is a desaturated teal — reads as precision instrument, not Matrix green.

```
──────────────────────────────────────────────────────
  Background     #0d1012    near-black, warm undertone
  Surface        #15191c    elevated container / sidebar
  Surface +2     #1d2226    card, panel, code block
  Border         #2c3438    hairline rules, dividers
  Text primary   #dde4e8    off-white, low eye-strain
  Text secondary #7a8f9a    labels, metadata, captions
  Text muted     #48626e    placeholders, disabled
  Accent         #4fc3a1    signal teal — accent only
  Accent warm    #e8a84a    amber — warnings, emphasis
  Destructive    #e05c5c    errors, disconnected state
──────────────────────────────────────────────────────
```

**Color rationale:**
- The ground (#0d1012) avoids pure black — pure black on monitors creates glare halos and reads as "hacker movie" not "instrument." The warm undertone grounds it.
- Text primary is off-white (#dde4e8) not white — reduces eye strain in extended reading (Mira reads docs for hours).
- Signal teal (#4fc3a1) is the only color used at saturation. It communicates "active / connected / signal" without screaming. Think oscilloscope trace, not neon sign.
- Amber (#e8a84a) appears only for warnings, high-emphasis text, or structural hierarchy signals. Phosphor-screen associations — analogue instrumentation.
- The palette deliberately has no blue. Blue reads "enterprise SaaS" or "Tailscale." No purple (web3). No green-on-black (hacking movie). The teal is the instrument reading.

---

## Typography

### Headlines / Navigation
**Geist Mono** (Vercel, open-source, free)
- Mono used for all structural typography: headings, navigation labels, status output labels, version numbers.
- Signals: instrument-grade, protocol-first, terminal-native.
- Not used for long-form prose (readability).
- Weight: 500–600 for headlines, 400 for navigation.

Alternative if Geist Mono unavailable: **Commit Mono** (open-source) or **JetBrains Mono** (open-source, more widely known).

### Body / Prose
**Geist** (Vercel, open-source, free) — the sans companion to Geist Mono
- Used for documentation prose, README body, longer explanations.
- Clean, technical sans-serif that doesn't read as consumer-SaaS.
- Weight: 400 regular, 500 for emphasis.

Alternative: **Inter** (open-source) — widely trusted, highly legible, neutral enough not to fight the mono headlines.

### Code / CLI output
**JetBrains Mono** (open-source, free)
- The 2025 standard for developer-tool code samples. High legibility, wide character recognition.
- Used for all code blocks, CLI command examples, protocol field listings.
- Mira has likely already configured this in her terminal — zero friction to recognize.

### Type hierarchy (documentation context)
```
  H1  Geist Mono  32px / 600  — section titles
  H2  Geist Mono  22px / 500  — subsection titles
  H3  Geist Mono  16px / 500  — sub-subsections
  Body Geist       15px / 400  — prose
  Code JBMono      14px / 400  — inline + blocks
  Label Geist Mono 12px / 500  — UI labels, table headers
  Muted Geist      12px / 400  — captions, metadata
```

---

## Imagery Style

**Primary:** CLI output screenshots. `pim status --verbose` output designed as box-drawing ASCII, color-coded by status. These are first-class brand assets — they demonstrate that PIM's surface is as considered as its protocol.

**Secondary:** Network topology diagrams. Box-drawing characters showing connected peers, packet hops, gateway nodes. Not illustrations — structured ASCII or minimal SVG diagrams built on grid.

**Tertiary:** Protocol field maps. Packet byte-field diagrams (like Wireshark's dissection view) for the protocol specification sections. These are functional and aesthetic simultaneously.

**Never:** Stock photography of servers, hoodies, "hacker" hands on keyboards, glowing ethernet cables, globe-with-network-overlay, abstract gradient blobs, people using laptops in coffee shops.

**If imagery is needed beyond diagrams:** Photographs of actual hardware (LoRa modules, mesh nodes in field conditions) — functional, not staged. Black-and-white or desaturated to stay within the palette.

---

## Voice Sample (brand-consistent tone)

```
PIM is a Rust overlay that forwards IPv4 and IPv6 packets across
proximity-linked peers until one reaches an egress gateway.

No cloud dependency. No central server. TCP today, Wi-Fi Direct
when the transport layer catches up. Gateway NAT on Linux.

The protocol is documented. The crypto choices are named. The
failure modes are listed. Read them before deploying.
```

This is the reference voice for all brand touchpoints: README headers, CLI help text, documentation introductions, error messages.

---

## CLI Output Aesthetic Reference

```
  ┌─────────────────────────────────────────────────────┐
  │  pim status --verbose                               │
  ├─────────────────────────────────────────────────────┤
  │  node          client-a                             │
  │  mesh ip       10.77.0.100/24                       │
  │  interface     pim0                          ◆ up   │
  │  transport     tcp :9100                            │
  │                                                     │
  │  peers         3 connected                          │
  │    gateway     10.77.0.1        via tcp    ◆ active │
  │    relay-b     10.77.0.22       via tcp    ◆ active │
  │    client-c    10.77.0.105      via relay  ◈ relayed│
  │                                                     │
  │  routes        12 active / 1 expired                │
  │  forwarded     4.2 MB   ·  3,847 packets            │
  │  dropped       2  (congestion)                      │
  │  uptime        4h 22m                               │
  └─────────────────────────────────────────────────────┘
```

This output format is a brand specification: box-drawing borders, aligned values, Unicode status indicators (◆ active, ◈ relayed, ✗ down), accent teal for active states, amber for warnings. The status panel is the PIM brand in its most distilled form.

---

## Style Affinity

Based on the research findings, the following GSP style presets map most closely to PIM's instrument-grade, terminal-native direction:

### 1. `terminal` — Primary match
- **Tag overlap:** developer, monospace, dark, minimal, technical
- **Rationale:** Designed for exactly this use case — developer tool documentation with a dark, monospace-forward aesthetic. The terminal preset represents the foundation of PIM's visual language. Research confirmed that terminal-native design is both on-trend in 2025 and specifically the right language for Mira's trust context.

### 2. `nothing` — Strong secondary match
- **Tag overlap:** monochrome, industrial, dark, minimal, technical, instrument, mechanical
- **Rationale:** The "instrument" and "mechanical" tags are precise matches for PIM's personality. The Nothing Phone DNA (OLED black, dot-matrix/mono headlines, red signal accent) maps closely to PIM's direction — except PIM replaces the red with teal (warm red reads as alarm/militant, cool teal reads as signal/precision). The "industrial" character is right; the color just needs adjustment for PIM's anti-militant constraint.

### 3. `monochrome` — Fallback / constraint mode
- **Tag overlap:** high-contrast, editorial, minimal
- **Rationale:** If PIM needs to render in constrained contexts (print, monochrome screens, accessibility contexts), the monochrome preset provides a legible fallback that stays on-brand. Also: the PIM CLI must render in 16-color terminals — the monochrome direction ensures the brand holds in ANSI-constrained environments.
