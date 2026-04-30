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

## Install From GitHub Releases

Published releases include native installer bundles named
`pim-ui-<tag>-<label>.<ext>` plus a matching `.sha256` next to each:

| Platform           | Label             | Bundles                        |
| ------------------ | ----------------- | ------------------------------ |
| Linux x86_64       | `linux-x86_64`    | `.deb`, `.AppImage`, `.rpm`    |
| macOS Intel        | `macos-x86_64`    | `.dmg`                         |
| macOS Apple Silicon| `macos-aarch64`   | `.dmg`                         |
| Windows x86_64     | `windows-x86_64`  | `.msi`, `.exe`                 |

Pick the bundle that matches your host:

```bash
VERSION="$(curl -fsSLI -o /dev/null -w '%{url_effective}' \
  https://github.com/Astervia/pim-ui/releases/latest \
  | sed 's:.*/::')"

if [ -z "${VERSION}" ]; then
  echo "Failed to determine the latest GitHub release version" >&2
  exit 1
fi

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)   LABEL="linux-x86_64"  ; EXT="AppImage" ;;
  Darwin-x86_64)  LABEL="macos-x86_64"  ; EXT="dmg" ;;
  Darwin-arm64)   LABEL="macos-aarch64" ; EXT="dmg" ;;
  *)
    echo "No published release artifact for $(uname -s)-$(uname -m)" >&2
    exit 1
    ;;
esac

ASSET="pim-ui-${VERSION}-${LABEL}.${EXT}"
BASE="https://github.com/Astervia/pim-ui/releases/download/${VERSION}"

curl -LO "${BASE}/${ASSET}"
curl -LO "${BASE}/${ASSET}.sha256"

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum -c "${ASSET}.sha256"
else
  shasum -a 256 -c "${ASSET}.sha256"
fi
```

Then install the bundle the platform-native way:

- **Linux (`.AppImage`)**: `chmod +x ./pim-ui-${VERSION}-linux-x86_64.AppImage && ./pim-ui-${VERSION}-linux-x86_64.AppImage`
- **Linux (`.deb`)**: `sudo dpkg -i pim-ui-${VERSION}-linux-x86_64.deb`
- **Linux (`.rpm`)**: `sudo rpm -i pim-ui-${VERSION}-linux-x86_64.rpm`
- **macOS (`.dmg`)**: open the `.dmg` and drag `pim.app` into `/Applications`
- **Windows (`.msi`)**: double-click to launch the installer
- **Windows (`.exe`)**: NSIS setup — double-click to install

The bundle ships with the matching `pim-daemon` sidecar baked in; no
separate daemon download is required for desktop use.

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
│   ├── fetch-daemon.sh        download pim-daemon for bundling
│   ├── prepare-release.sh     bump versions across package.json + cargo + tauri.conf
│   ├── pre-pr.sh              auto-fix + run all CI checks locally
│   └── pre-pr-check.sh        check-only mirror of CI for PR validation
└── .github/workflows/         quality-and-security · codeql-analysis · release · sbom · secret_scanning · dependency-review
```

## Pre-PR validation

Run the full CI check suite locally before opening a PR:

```bash
scripts/pre-pr.sh           # auto-fixes formatting, then runs all checks
scripts/pre-pr-check.sh     # check-only — matches CI exactly
```

Both scripts run `rustfmt`, `clippy`, `cargo test`, `pnpm typecheck`,
`pnpm build`, `pnpm test`, `gitleaks`, `cargo audit`, and a final
`cargo build` of `src-tauri`. They mirror
`.github/workflows/quality-and-security.yml` and
`.github/workflows/secret_scanning.yml`.

## Cutting a release

```bash
scripts/prepare-release.sh --bump patch    # or minor/major
git diff                                   # review version bumps + lockfiles
git commit -am "chore: release vX.Y.Z"
git tag vX.Y.Z
git push --tags
```

The tag push triggers `.github/workflows/release.yml`, which builds
Tauri bundles for every supported target, generates a SHA-256 next to
each, and publishes a draft GitHub release. Review and publish the
draft once the matrix completes.

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
