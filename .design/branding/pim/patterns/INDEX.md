# Patterns
> Phase: guidelines | Brand: pim | Generated: 2026-04-15

| File | Purpose |
|------|---------|
| [pim.yml](./pim.yml) | Source of truth — tokens, intensity, patterns, constraints, effects, voice |
| [STYLE.md](./STYLE.md) | Agent contract — designer/builder agents read this to apply the brand |
| [guidelines.html](./guidelines.html) | Visual brand guide — open in browser to see the brand in context |
| [components/token-mapping.md](./components/token-mapping.md) | PIM tokens → shadcn/ui + Tailwind v4 override recipes |

## Summary

**Source of truth:** `pim.yml` (extends `terminal` preset, customizes palette and voice)

**Tech stack:** Next.js 15 + Tailwind v4 + shadcn/ui

**Brand heartbeat:** "The quiet confidence of an instrument you can read from first principles — one that keeps transmitting when the backbone goes quiet."

**Manifesto:** Infrastructure you can read is infrastructure you can trust.

**Key tokens:**
- Ground: `#080e09` · Text: `#a8d5a2` · Primary: `#22c55e` · Accent: `#e8a84a`
- Type: Geist Mono + Geist + JetBrains Mono
- Radius: 0 everywhere. Shadows: none. Scanlines: 4% opacity.

**To start building:** Open `guidelines.html` in a browser, then follow `components/token-mapping.md` to scaffold a Next.js project with the PIM brand applied.
