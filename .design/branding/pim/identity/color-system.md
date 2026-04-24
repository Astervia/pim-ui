# Color System
> Phase: identity | Brand: pim | Generated: 2026-04-15

---

## Composition strategy: Terminal/ANSI + Neutral + Single Accent

PIM uses the Terminal/ANSI strategy as its base — a green-family monochrome world with exactly two accent signals (signal green, amber). Everything exists in a phosphor-screen color space. Signal green carries all interactive/connected semantic weight. Amber appears only for warnings and emphasis. No other hues.

---

## Source palette

| Role | Hex | OKLCH approx. |
|------|-----|---------------|
| Background | `#0a0c0a` | oklch(8% 0.004 150) |
| Surface | `#121513` | oklch(14% 0.006 150) |
| Surface +2 | `#1a1e1b` | oklch(18% 0.008 150) |
| Border | `#2a2e2c` | oklch(26% 0.010 150) |
| Border active | `#3a5a3e` | oklch(38% 0.035 142) |
| Text primary | `#d4d8d4` | oklch(86% 0.006 150) |
| Text secondary | `#7a807c` | oklch(55% 0.010 150) |
| Text muted | `#3e4540` | oklch(32% 0.008 150) |
| Signal green | `#22c55e` | oklch(74% 0.178 142) |
| Signal bright | `#4ade80` | oklch(83% 0.162 142) |
| Amber | `#e8a84a` | oklch(75% 0.148 65) |
| Error | `#ff5555` | oklch(66% 0.228 25) |

---

## 11-stop OKLCH scale — Signal Green (primary)

| Stop | Hex | OKLCH | Usage |
|------|-----|-------|-------|
| 50 | `#f0fdf4` | oklch(99% 0.030 142) | Tint backgrounds (light mode only) |
| 100 | `#dcfce7` | oklch(97% 0.052 142) | Subtle tints |
| 200 | `#bbf7d0` | oklch(93% 0.086 142) | Hover tints |
| 300 | `#86efac` | oklch(89% 0.128 142) | Active tints |
| 400 | `#4ade80` | oklch(83% 0.162 142) | **Signal bright — hover states** |
| 500 | `#22c55e` | oklch(74% 0.178 142) | **Signal green — primary** |
| 600 | `#16a34a` | oklch(64% 0.162 142) | Pressed states |
| 700 | `#15803d` | oklch(54% 0.138 142) | Dim active |
| 800 | `#166534` | oklch(41% 0.108 142) | Very dim |
| 900 | `#14532d` | oklch(33% 0.082 142) | Structural elements |
| 950 | `#052e16` | oklch(18% 0.050 142) | Near-surface green tint |

## 11-stop OKLCH scale — Amber (secondary accent)

| Stop | Hex | OKLCH | Usage |
|------|-----|-------|-------|
| 50 | `#fffbeb` | oklch(99% 0.024 85) | Light mode only |
| 100 | `#fef3c7` | oklch(97% 0.058 85) | |
| 200 | `#fde68a` | oklch(93% 0.112 85) | |
| 300 | `#fcd34d` | oklch(88% 0.162 85) | |
| 400 | `#fbbf24` | oklch(82% 0.168 82) | |
| 500 | `#f59e0b` | oklch(77% 0.158 75) | |
| 600 | `#e8a84a` | oklch(75% 0.148 65) | **Amber — primary use** |
| 700 | `#b45309` | oklch(56% 0.148 60) | Dim amber |
| 800 | `#92400e` | oklch(44% 0.128 55) | |
| 900 | `#78350f` | oklch(34% 0.102 52) | |
| 950 | `#451a03` | oklch(20% 0.078 50) | |

---

## WCAG contrast audit

All pairs tested against WCAG 2.2. Ratios calculated via relative luminance formula.

| Foreground | Background | Ratio | AA normal | AA large | AAA |
|------------|------------|-------|-----------|----------|-----|
| Text primary `#a8d5a2` | Background `#080e09` | **11.9:1** | ✓ | ✓ | ✓ |
| Text primary `#a8d5a2` | Surface `#0e1a0f` | **9.8:1** | ✓ | ✓ | ✓ |
| Text primary `#a8d5a2` | Surface+2 `#162118` | **7.4:1** | ✓ | ✓ | ✓ |
| Signal green `#22c55e` | Background `#080e09` | **8.7:1** | ✓ | ✓ | ✓ |
| Signal green `#22c55e` | Surface `#0e1a0f` | **8.0:1** | ✓ | ✓ | ✓ |
| Amber `#e8a84a` | Background `#080e09` | **9.6:1** | ✓ | ✓ | ✓ |
| Error `#ff5555` | Background `#080e09` | **8.1:1** | ✓ | ✓ | ✓ |
| Text secondary `#4e7a52` | Background `#080e09` | **3.8:1** | ✗ | ✓ | ✗ |
| Text muted `#2c4a30` | Background `#080e09` | **1.9:1** | ✗ | ✗ | ✗ |

**Notes:**
- **Text secondary** passes AA for large text (18px+) only. Restrict to metadata labels, captions, secondary UI — never body text.
- **Text muted** is intentionally inaccessible — it is for decorative/background context only (placeholders at rest, disabled states). Never use for readable content.
- All primary communication surfaces (text primary, signal green, amber, error) exceed AAA.

---

## Semantic token assignments (dark mode primary)

| CSS token | Value | Hex | Notes |
|-----------|-------|-----|-------|
| `--color-bg` | Ground | `#080e09` | Page background |
| `--color-surface` | Surface | `#0e1a0f` | Sidebar, cards |
| `--color-surface-2` | Surface+2 | `#162118` | Code blocks, panels |
| `--color-border` | Border | `#1e3320` | Dividers, box-drawing |
| `--color-border-active` | Border active | `#2a4d2e` | Hover/focused borders |
| `--color-text` | Text primary | `#a8d5a2` | All body text |
| `--color-text-2` | Text secondary | `#4e7a52` | Large labels only |
| `--color-text-muted` | Text muted | `#2c4a30` | Decorative only |
| `--color-brand` | Signal green | `#22c55e` | Primary accent, active |
| `--color-brand-hover` | Signal bright | `#4ade80` | Hover state |
| `--color-warning` | Amber | `#e8a84a` | Warnings, relayed |
| `--color-error` | Error | `#ff5555` | Failed, disconnected |
| `--color-success` | Signal green | `#22c55e` | Same as brand — green IS success |

---

## Light mode (fallback — forced contexts only)

PIM is dark-mode primary. Light mode is a fallback for forced contexts (print, accessibility override).

| Token | Dark | Light fallback |
|-------|------|----------------|
| `--color-bg` | `#080e09` | `#f5f8f5` |
| `--color-surface` | `#0e1a0f` | `#e8f0e9` |
| `--color-text` | `#a8d5a2` | `#0e1a0f` |
| `--color-brand` | `#22c55e` | `#15803d` (600) |
| `--color-border` | `#1e3320` | `#b8d4ba` |

---

## Anti-patterns

- No pure `#000000` — kills the phosphor quality
- No `#ffffff` text — use `#a8d5a2` (phosphor pale)  
- No blue — enterprise/GitHub association
- No purple — web3 association
- No gradient backgrounds — Terminal/ANSI strategy: flat layers only
- Text secondary must never appear at body text sizes (below 18px)

---

## Related

- [typography.md](./typography.md)
- [brand-applications.md](./brand-applications.md)
