# Typography
> Phase: identity | Brand: pim | Generated: 2026-04-15

---

## Creative premise

PIM uses a monospace-primary type system. Geist Mono for all structural elements, JetBrains Mono for technical/code content, Geist for long-form prose only. Scale ratio: **1.250 (Major Third)** — tight enough for information density, enough contrast for clear hierarchy.

---

## Typeface stack

| Role | Family | Source | License |
|------|--------|--------|---------|
| Structural (headings, nav, labels) | **Geist Mono** | fonts.vercel.com / npm @vercel/next | SIL OFL |
| Code / CLI / protocol | **JetBrains Mono** | jetbrains.com/mono / npm @fontsource | Apache 2.0 |
| Prose (long-form docs) | **Geist** | fonts.vercel.com / npm @vercel/next | SIL OFL |
| System fallback | `ui-monospace, 'Cascadia Code', 'Source Code Pro', monospace` | — | — |

**Pairing rationale:** Geist Mono and Geist share the same design DNA — a geometric grotesque foundation adapted for mono and proportional respectively. Switching between them within a page is seamless. JetBrains Mono is visually compatible (geometric, clean) and widely recognized by Mira's audience.

---

## Type scale — Major Third (1.250)

Base: **14px** · Ratio: **1.250** · Root: 16px

| Level | Name | px | rem | Line height | Weight | Tracking | Use |
|-------|------|----|-----|-------------|--------|----------|-----|
| 9 | display | 54px | 3.375rem | 1.05 | 600 | -0.03em | Hero, massive headings |
| 8 | h1 | 43px | 2.688rem | 1.08 | 600 | -0.02em | Page titles |
| 7 | h2 | 34px | 2.125rem | 1.10 | 600 | -0.015em | Section headings |
| 6 | h3 | 27px | 1.688rem | 1.15 | 500 | -0.01em | Subsection headings |
| 5 | h4 | 22px | 1.375rem | 1.20 | 500 | 0em | Group headings |
| 4 | lg | 17px | 1.063rem | 1.40 | 400 | 0.01em | Lead body, callouts |
| 3 | base | 14px | 0.875rem | 1.60 | 400 | 0.01em | Body text (prose) |
| 2 | sm | 12px | 0.750rem | 1.50 | 400 | 0.02em | Labels, metadata, badges |
| 1 | xs | 10px | 0.625rem | 1.40 | 500 | 0.04em | Captions, micro-labels |

**Note:** All heading levels use Geist Mono. Prose (level 3–4) uses Geist. Code uses JetBrains Mono at base (14px) with 1.7 line-height.

---

## Fluid type — clamp() formulas

For heading levels h1–h3 on documentation sites. Scales fluidly between 375px and 1280px viewport.

```css
/* Display */
font-size: clamp(2.5rem, 4.5vw + 0.5rem, 3.375rem);

/* H1 */
font-size: clamp(2rem, 3.5vw + 0.5rem, 2.688rem);

/* H2 */
font-size: clamp(1.5rem, 2.5vw + 0.5rem, 2.125rem);

/* H3 */
font-size: clamp(1.25rem, 2vw + 0.25rem, 1.688rem);

/* Body (prose) — fixed, no fluid scaling */
font-size: 0.875rem; /* 14px */
line-height: 1.6;

/* Code — fixed */
font-size: 0.875rem; /* 14px */
line-height: 1.7;
```

---

## Font loading

### Next.js (recommended)

```tsx
// app/layout.tsx
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

// GeistMono and GeistSans are already optimized by next/font
// JetBrains Mono via fontsource
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

export default function RootLayout({ children }) {
  return (
    <html className={`${GeistMono.variable} ${GeistSans.variable}`}>
      {children}
    </html>
  )
}
```

### CSS variables

```css
:root {
  --font-mono:  'Geist Mono', ui-monospace, 'Cascadia Code', monospace;
  --font-sans:  'Geist', system-ui, sans-serif;
  --font-code:  'JetBrains Mono', 'Fira Code', monospace;
}

/* Structural: always mono */
h1, h2, h3, h4, h5, h6,
nav, label, .badge, .status {
  font-family: var(--font-mono);
}

/* Prose */
p, li, blockquote {
  font-family: var(--font-sans);
}

/* Code / CLI */
code, pre, kbd, .cli-output, .protocol-field {
  font-family: var(--font-code);
}
```

### Google Fonts fallback (no npm access)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
```
Geist is not on Google Fonts — self-host via Vercel CDN or npm. For doc-only contexts, IBM Plex Mono is the best Google Fonts alternative (same geometric DNA, same SIL OFL license).

---

## Vertical rhythm

Base grid: **8px** (0.5rem). Line-height at base (14px × 1.6 = 22.4px ≈ 24px = 3 grid units). Headings snap to grid — 43px h1 uses 48px (6 units) min-height, 34px h2 uses 40px (5 units).

Paragraph spacing: `margin-bottom: 1.25rem` (about 1 line-height unit).
Section spacing: `padding: 4rem 0` (32 grid units) between major sections.

---

## Related

- [color-system.md](./color-system.md)
- [brand-applications.md](./brand-applications.md)
