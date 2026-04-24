# Imagery Style
> Phase: identity | Brand: pim | Generated: 2026-04-15

---

## Photography

**There is no photography in the PIM brand.** The terminal preset's constraint is explicit: no background images or photos. PIM's imagery system is entirely text-based — CLI panels, ASCII diagrams, protocol field maps. These are the brand's first-class visual assets.

**If photography is forced** (blog post, contributor page, documentation of field deployment):
- Subject: actual hardware in context — LoRa modules, relay nodes, laptops in field conditions. Never staged.
- Treatment: desaturate to near-monochrome, apply `filter: saturate(0.15) hue-rotate(90deg)` to pull into the green palette world
- Never: server room stock photos, hands on keyboards in the dark, neon-lit "hacker" setups, abstract globe/network imagery

---

## Illustration

**None.** PIM does not use illustration. Protocol diagrams and CLI output panels fulfill all visual explanation needs. Adding illustration would undermine the instrument-grade positioning — the brand communicates through the thing itself, not a representation of it.

Exception: If an empty state or onboarding context genuinely needs a visual, use a minimal ASCII art construction — never a vector illustration library.

---

## Iconography

### Primary recommendation: Lucide React

```bash
npm install lucide-react
```

```tsx
import { Radio, Network, Shield, Terminal, ChevronRight } from 'lucide-react'
```

**Why Lucide:**
- Stroke-only, consistent 24×24 grid, 2px stroke-width — matches the hairline aesthetic
- MIT license, 1000+ icons, active maintenance
- Signal-processing and network icons available (`Radio`, `Network`, `Wifi`, `WifiOff`, `Shield`)
- Stroke-only treatment aligns with the terminal preset's "no filled shapes" preference for icons

**Icon system:**

| Size | Context | Stroke |
|------|---------|--------|
| 12px | Inline status indicators | Prefer Unicode (◆ ◈ ✗) |
| 16px | Navigation, table rows | 1.5px |
| 20px | Button labels, form fields | 2px |
| 24px | Feature icons, section markers | 2px |
| 32px | Hero section, large callouts | 1.5px |

**Preferred Unicode-first approach:** For status indicators and semantic states, always prefer Unicode characters over icon components — they render in any terminal context and are zero-dependency.

```
  ◆ active / connected / success    (U+25C6 BLACK DIAMOND)
  ◈ relayed / proxied               (U+25C8 WHITE DIAMOND WITH CENTRED DOT)
  ○ connecting / pending            (U+25CB WHITE CIRCLE)
  ✗ failed / error                  (U+2717 BALLOT X)
  → route / forward                 (U+2192 RIGHTWARDS ARROW)
  █ cursor / fill / logo mark       (U+2588 FULL BLOCK)
```

**Color:** All icons in `--color-brand` (`#22c55e`) for active states, `--color-text-2` (`#4e7a52`) for inactive, `--color-error` (`#ff5555`) for failed. Never multi-color icons.

**Container:** Never. Icons are bare — no circle background, no tinted square, no border. The icon exists directly on the surface.

---

## Textures & Patterns

### CRT scanline overlay (terminal preset signature)

```css
/* Apply as a fixed overlay on the root — pointer-events: none */
.scanline-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.08) 3px,
    rgba(0, 0, 0, 0.08) 4px
  );
  mix-blend-mode: overlay;
}
```

Opacity: 4–8%. Any stronger and readability degrades. The scanline is an atmosphere effect, not a visual feature.

### Phosphor text glow (signal green text only)

```css
/* Applied to signal green text elements only — headings, status indicators */
.phosphor-glow {
  text-shadow:
    0 0 4px rgba(34, 197, 94, 0.40),
    0 0 8px rgba(34, 197, 94, 0.20);
}
```

Use sparingly — logo, hero headings, active status indicators. Never on body text (degrades legibility). The glow is the phosphor persistence effect, not a decorative choice.

### Box-drawing structure

```css
/* Borders use box-drawing characters or CSS borders — never decorative */
.pane {
  border: 1px solid var(--color-border); /* #1e3320 */
  border-radius: 0; /* terminal preset: 0px radius always */
}

/* ASCII header pattern for panel titles */
/* ┌─── TITLE ───────────────────────────┐ */
/* Generated as actual text, not images  */
```

### No gradients

The terminal preset prohibits gradient backgrounds. All surfaces are flat, layered, dark. The only "gradient" allowed is the implicit lightness progression from background → surface → surface+2.

### No grain, noise, or paper textures

These belong to editorial/warm aesthetics (humanist-literary, botanical presets). PIM's ground is clean — the structure IS the texture. Box-drawing characters, rule lines, and Unicode indicator characters provide all the visual texture needed.

---

## Image Treatments

### CLI output panels (primary brand imagery)

```css
.cli-panel {
  background: var(--color-surface-2);   /* #162118 */
  border: 1px solid var(--color-border); /* #1e3320 */
  border-radius: 0;
  font-family: var(--font-code);         /* JetBrains Mono */
  font-size: 0.875rem;                   /* 14px */
  line-height: 1.7;
  padding: 1.5rem;
  color: var(--color-text);              /* #a8d5a2 */
}

.cli-panel--active {
  border-color: var(--color-border-active); /* #2a4d2e */
}
```

### Aspect ratios

| Context | Ratio | Notes |
|---------|-------|-------|
| Hero CLI panel | 16:9 | Fixed proportion, not fluid |
| Social preview (og:image) | 1200×630 (1.9:1) | Static render |
| Inline code block | Auto height | Width 100%, height by content |
| Protocol field diagram | Auto | Fixed-width monospace |

### No image loading strategy

PIM has no photographs. CLI panels are rendered as HTML/text — no blur-up, no lazy-loading, no dominant color extraction needed. If hardware photos appear in blog contexts, use `loading="lazy"` with a simple CSS skeleton (`background: var(--color-surface)`).

---

## Anti-Patterns

- No stock photography — servers, hoodies, globe-with-network, fiber optics
- No illustration libraries (Undraw, Storyset, Absurd) — they read consumer-SaaS
- No filled icon sets (FontAwesome solid, Material filled)
- No hero illustrations or mascots
- No background images on any surface (terminal preset hard constraint)
- No colored gradients — the palette is flat layers
- No decorative grain or paper textures — wrong emotional register
- No colored shadows or glows on non-text elements
- No icon containers (circle backgrounds, tinted squares)

---

## Related

- [color-system.md](./color-system.md)
- [typography.md](./typography.md)
