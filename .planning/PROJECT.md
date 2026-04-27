# pim-ui

## What This Is

A cross-platform desktop + mobile app that lets anyone — from a complete
newcomer to a protocol researcher — configure, run, and monitor the
`pim-daemon` proximity mesh stack without touching TOML or the CLI.
Tauri 2 shell driving a React 19 frontend that speaks JSON-RPC 2.0 to
the local daemon over a Unix socket.

## Core Value

One app that is honest about what the mesh is actually doing — never
abstracts packets into a happy green dot — yet stays reachable enough
that a first-time user can succeed in ≤ 3 interactions.

## Requirements

### Validated

- ✓ **BRAND-01** — pim brand identity complete — pim · 2026-04-15 (kernel repo `.design/branding/pim/`)
- ✓ **SCAF-01** — Tauri 2 + React 19 + Vite + Tailwind v4 + shadcn/ui scaffold builds and runs — existing (`pim-ui/src`, `src-tauri`)
- ✓ **SCAF-02** — Animated `█ pim` hero logo + mock CliPanel dashboard render at localhost:1420 — existing
- ✓ **DOCS-01** — UX plan + research + RPC contract authored — existing (`docs/UX-PLAN.md`, `docs/research/`, kernel `docs/RPC.md`)
- ✓ **ROUTE-01..04** — Route-internet-via-mesh toggle with honest gateway/relay surfacing + Routing view (table + known gateways) — Phase 4 · 2026-04-27
- ✓ **UX-01** — Three-interaction first-run onboarding (FirstRunScreen + TUN modal + WelcomeScreen pick) — Phase 4 · 2026-04-27
- ✓ **UX-02** — Solo-mode dashboard with enabled `[ + Add peer nearby ]` + `[ Invite peer ]` actions — Phase 4 · 2026-04-27
- ✓ **UX-03** — KillSwitchBanner + handshake-fail peer-row sub-line linking `docs/SECURITY.md §3.2` — Phase 4 · 2026-04-27
- ✓ **UX-08** — `docs/COPY.md` voice contract + `pnpm audit:copy` script enforces brand voice — Phase 4 · 2026-04-27

### Active

See `.planning/REQUIREMENTS.md` for the full v1 list (36 requirements
across 6 categories) with traceability to phases.

### Out of Scope

- **SSO / cloud account system** — contradicts the "no control plane" ethos
- **Built-in chat/messaging** — pim is not a messenger; ships protocol only
- **Gateway mode on macOS/Windows** — kernel is Linux-only; deferred until kernel supports
- **Rate limiting / reputation scores / onion routing** — not yet exposed by the daemon
- **Simple/Advanced mode toggle** — explicitly rejected; single UI with three disclosure layers instead
- **Account-backed device sync / "my devices" auto-trust** — each device is an independent mesh node; revisit only if SSO lands

## Context

**Product context**
- Built for two audiences: Aria (non-technical first-timer) and Mira (mesh-networking researcher, Reticulum/LoRa background). Design for Aria; never betray Mira.
- Kernel repo (`Astervia/proximity-internet-mesh`) ships the Rust daemon, CLI, and now the RPC contract (`docs/RPC.md`, 17 methods + 3 event streams).
- Brand is terminal-native: monospace Geist Mono + JetBrains Mono, green phosphor palette on green-tinted near-black, flat layers, box-drawing structural elements, CRT scanline overlay.

**Stakeholder decisions locked 2026-04-24**
- Transport: JSON-RPC 2.0 over Unix domain socket
- Raw TOML is source of truth when editing diverges from GUI form
- macOS default: window-first, menu bar as secondary surface
- `pim://invite/...` fallback → `github.com/Astervia/proximity-internet-mesh` README
- Mobile is **full node from day 1** (not remote-only companion) — expands v0.5 scope significantly (Apple enrollment, iOS Network Extension entitlement, Android VpnService plugin)
- Identity backup: Briar model (none by default; optional export behind warnings)
- Multi-device auto-trust: deferred
- Gateway failover notification: toast-in-app
- System notifications: only for all-gateways-lost + kill-switch-active

**Reference material**
- `docs/UX-PLAN.md` (801 lines) — design principles, personas, IA, flows, screen specs
- `docs/research/kernel-study.md` (2094 lines) — exhaustive daemon study
- `docs/research/ux-references.md` (1536 lines) — Tailscale/Mullvad/Meshtastic/Briar/1Password precedents
- `docs/creator-brief.md` — locked decisions

## Constraints

- **Tech stack**: Tauri 2 + React 19 + Vite 6 + Tailwind v4 + shadcn/ui (new-york) — cross-platform webview, Rust backend, single codebase for 5 OS targets
- **Daemon source of truth**: UI never stores state that isn't in `pim-daemon`; always poll/subscribe via RPC; daemon REJECT on save preserves user's edit buffer
- **Brand discipline**: tokens synced from `.design/branding/pim/patterns/pim.yml`; see `docs/UX-PLAN.md` §1 for immutable design principles (no gradients, no border-radius, no "Advanced" toggle, no native-platform UI idioms that fight the monospace aesthetic)
- **Security**: local Unix socket only for v1; TLS-over-TCP for remote mobile is out of scope until dedicated follow-up spec
- **Desktop first, mobile later**: mobile scope expanded to full-node requires Apple Developer enrollment (~$99/yr) + Network Extension entitlement review (multi-week); desktop must ship independently and first

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri 2 over Expo/React Native | Brand is web-native (monospace, box-drawing, CRT scanlines); RN would fight the aesthetic and require react-native-webview anyway. Tauri keeps Rust on backend. | — Pending validation |
| Flat repo (no pnpm workspaces) | Under 4-app threshold per Spacedrive precedent; graduate only when a second consumer appears | — Pending |
| Brand tokens inlined in `src/globals.css` (not git submodule) | Kernel repo push blocked; submodule when kernel is publicly accessible. Manual sync via `pnpm sync-brand` in the interim | ⚠️ Revisit when kernel repo access is resolved |
| JSON-RPC 2.0 over Unix socket | Creator-approved 2026-04-24. Matches spec in kernel `docs/RPC.md`. | — Pending implementation |
| Window-first macOS (Tailscale 2025 lesson) | Menu-bar-only model failed on notched MacBooks; windowed UI conveys state via shape/color | — Pending |
| Mobile as full-node from day 1 | Creator decision 2026-04-24; expands v0.5 from weeks to months. Requires Apple enrollment, VpnService plugin, NEPacketTunnelProvider, 50MB memory discipline | ⚠️ Watch: high-risk scope |
| Briar identity model (no backup default) | Consistent with "infrastructure you can read" ethos; mess with key = re-pair. Export available in Layer 3 for power users. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-27 after Phase 4 (Routing & Onboarding Polish) complete*
