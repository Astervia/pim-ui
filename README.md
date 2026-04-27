# pim-ui

Desktop and mobile UI for the [pim](https://github.com/Astervia/proximity-internet-mesh)
proximity mesh daemon. A Tauri 2 application — the same React codebase targets
macOS, Windows, Linux, iOS, and Android.

```
  ┌────────────────────────────────────────────┐
  │  █ pim  ·  status --verbose         [OK]  │
  ├────────────────────────────────────────────┤
  │  node        client-a                      │
  │  interface   pim0                  ◆ up    │
  │  peers       3 connected                   │
  │    gateway   10.77.0.1   via tcp   ◆ active│
  │    relay-b   10.77.0.22  via tcp   ◆ active│
  │  forwarded   4.2 MB  ·  3,847 packets      │
  │  uptime      4h 22m                        │
  └────────────────────────────────────────────┘
```

## Scope

This repo contains the **UI** only. The daemon, CLI, and protocol spec live in
[Astervia/proximity-internet-mesh](https://github.com/Astervia/proximity-internet-mesh).

On desktop, pim-ui spawns `pim-daemon` as a sidecar child process.
On mobile, pim-ui connects to a remote daemon over TCP (embedded daemon is
planned but requires platform-native VPN plugins — see `ROADMAP.md`).

## Stack

| | |
|---|---|
| Shell | Tauri 2 |
| Frontend | React 19 · Vite 6 · TypeScript |
| Styling | Tailwind v4 · shadcn/ui (new-york) |
| Type | Geist Mono · Geist · JetBrains Mono |
| Icons | Lucide · Unicode-first |

The brand spec is authored in the kernel repo at
`.design/branding/pim/patterns/` (`pim.yml` source of truth, `STYLE.md` the
agent contract, `guidelines.html` the visual reference). `src/globals.css`
mirrors those tokens — run `pnpm sync-brand` when the brand evolves.

## Develop

```bash
pnpm install
pnpm tauri dev          # desktop — requires Rust + platform build tools
```

First-time prerequisites:

- **Node** ≥ 20
- **pnpm** 10
- **Rust** (stable) — install via [rustup](https://rustup.rs/)
- **Platform build deps** — see
  [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

## Project layout

```
pim-ui/
├── src/                       React frontend
│   ├── components/
│   │   ├── brand/             Logo, CliPanel, StatusIndicator
│   │   └── ui/                shadcn primitives (overridden per pim.yml)
│   ├── lib/
│   │   ├── rpc.ts             typed client — mirrors src-tauri/src/rpc
│   │   └── utils.ts           cn() helper
│   ├── screens/               one file per page
│   ├── globals.css            brand tokens + Tailwind v4 @theme
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                 Rust shell
│   ├── src/
│   │   ├── rpc/               Tauri commands, one module per domain
│   │   └── daemon/            sidecar + remote implementations
│   ├── binaries/              pre-built pim-daemon (not committed)
│   ├── capabilities/          Tauri 2 permission manifests
│   ├── Cargo.toml
│   └── tauri.conf.json
├── scripts/
│   ├── sync-brand.sh          sync tokens from the kernel repo
│   └── fetch-daemon.sh        download pim-daemon for bundling
└── .github/workflows/         check + desktop-release
```

## The RPC contract

The wire between the UI and the daemon is defined in
`proximity-internet-mesh/docs/RPC.md`. Until that doc is authored, the types
are hand-kept in sync between `src-tauri/src/rpc/` (Rust) and `src/lib/rpc.ts`
(TypeScript).

Roadmap: migrate to [`tauri-specta` v2](https://github.com/specta-rs/tauri-specta)
for generated bindings so the TS types are always truthful to the Rust source.

## Brand

The pim brand is instrument-grade and terminal-native. Every surface — hero
screen, status panel, CLI output, error message — is designed to feel like a
well-made CLI, not a SaaS dashboard.

- **Canonical logo**: `█ pim` — cursor-block + wordmark. Hero variant animates
  the cursor blink and types the wordmark character-by-character on mount
  (`src/components/brand/logo.tsx`, `<Logo animated size="hero" />`).
- **Status glyphs**: Unicode-first — `◆ active`, `◈ relayed`, `○ connecting`,
  `✗ failed`. See `src/components/brand/status-indicator.tsx`.
- **Palette**: green-tinted near-black ground, pale phosphor text, signal
  green (`#22c55e`) as the one active color, amber (`#e8a84a`) for warnings.
- **Motion**: instant (linear, 100ms). No easing curves. Respects
  `prefers-reduced-motion`.

See `.design/branding/pim/patterns/guidelines.html` in the kernel repo for
the full visual reference.

## License

MIT — see [LICENSE](./LICENSE).
