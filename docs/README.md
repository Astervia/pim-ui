# pim-ui · documentation

Product thinking and reference material for this repo.

## Index

- **[UX-PLAN.md](./UX-PLAN.md)** — the working product doc. Principles,
  personas, feature inventory, IA, user flows, screen specs, roadmap,
  open questions. Start here.

- **research/** — raw subagent output, kept for traceability.
  - [kernel-study.md](./research/kernel-study.md) — exhaustive study of
    the `proximity-internet-mesh` daemon: every CLI command, every config
    field, every error state. 2094 lines, generated 2026-04-24.
  - [ux-references.md](./research/ux-references.md) — UX research of
    reference products (Tailscale, Mullvad, Briar, Meshtastic, OrbStack,
    1Password, …) with concrete URLs and quotes. 1536 lines.

## Writing conventions

- Every product decision traces to either the kernel study (what the
  daemon can do) or the UX references (what good precedents do). If
  it doesn't trace, it doesn't belong in UX-PLAN.
- When the kernel evolves, re-run the study as a subagent and diff.
- When the brand evolves, update `.design/branding/pim/` in the kernel
  repo first, then sync tokens here via `pnpm sync-brand`.
