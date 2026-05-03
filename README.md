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

|          |                                     |
| -------- | ----------------------------------- |
| Shell    | Tauri 2                             |
| Frontend | React 19 · Vite 6 · TypeScript      |
| Styling  | Tailwind v4 · shadcn/ui (new-york)  |
| Type     | Geist Mono · Geist · JetBrains Mono |
| Icons    | Lucide · Unicode-first              |

The brand spec is authored in the kernel repo at
`.design/branding/pim/patterns/` (`pim.yml` source of truth, `STYLE.md` the
agent contract, `guidelines.html` the visual reference). `src/globals.css`
mirrors those tokens — run `pnpm sync-brand` when the brand evolves.

## Install From GitHub Releases

> **No separate kernel install is required.** The desktop bundle ships
> with a matching `pim-daemon` baked in as a Tauri sidecar — installing
> pim-ui is the only step. (`scripts/fetch-daemon.sh` pulls the binary
> from
> [Astervia/proximity-internet-mesh](https://github.com/Astervia/proximity-internet-mesh)'s
> release matching `PIM_DAEMON_VERSION` at build time, and Tauri embeds
> it via `bundle.externalBin`.)

Published releases include native installer bundles named
`pim-ui-<tag>-<label>.<ext>` plus a matching `.sha256` next to each:

| Platform            | Label            | Bundles                     |
| ------------------- | ---------------- | --------------------------- |
| Linux x86_64        | `linux-x86_64`   | `.deb`, `.AppImage`, `.rpm` |
| macOS Intel         | `macos-x86_64`   | `.dmg`                      |
| macOS Apple Silicon | `macos-aarch64`  | `.dmg`                      |
| Windows x86_64      | `windows-x86_64` | `.msi`, `.exe`              |

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
  Linux-x86_64)   LABEL="linux-x86_64"  ; EXT="deb" ;;   # rpm-based distros: set EXT=rpm
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

Then install the bundle the platform-native way. Use a dependency-aware
front-end (`apt`, `dnf`, `zypper`) rather than the raw `dpkg`/`rpm`
commands — the .deb/.rpm declare GTK runtime deps
(`libayatana-appindicator3-1`, `libwebkit2gtk-4.1-0`, `libgtk-3-0` on
Debian/Ubuntu) that need to be pulled in.

- **Debian / Ubuntu (`.deb`)**: `sudo apt install ./pim-ui-${VERSION}-linux-x86_64.deb`
- **Fedora / RHEL (`.rpm`)**: `sudo dnf install ./pim-ui-${VERSION}-linux-x86_64.rpm`
- **openSUSE (`.rpm`)**: `sudo zypper install ./pim-ui-${VERSION}-linux-x86_64.rpm`
- **macOS (`.dmg`)**: open the `.dmg` and drag `pim.app` into `/Applications`
- **Windows (`.msi`)**: double-click to launch the installer
- **Windows (`.exe`)**: NSIS setup — double-click to install

> **Linux `.AppImage` is not recommended.** The AppImage bundler
> currently mangles the bundled `pim-daemon` (same ELF `BuildID` but
> different SHA256 than the `.deb` / `.rpm` payload), causing the daemon
> to `SIGSEGV` before `main()` and the UI to surface
> `pim-daemon exited in ~2000 ms during startup`. Use `.deb` or `.rpm`
> until the AppImage build is fixed.

### Runtime Requirements (Linux)

The .deb / .rpm declare the GTK webview deps and the package manager
will pull them in. A few runtime requirements are not declared and need
to already be present:

- **polkit + a polkit auth agent** — required so the UI can `pkexec`
  the daemon (it needs root for TUN, NAT, etc.). Full KDE / GNOME /
  XFCE / MATE / LXQt desktops ship one. On minimal i3 / sway / headless
  setups install one explicitly (e.g. `polkit-gnome`, `polkit-kde-agent-1`,
  `lxqt-policykit`); without it the password dialog never appears, the
  daemon never starts, and the UI surfaces the same
  `pim-daemon exited in ~2000 ms` error.
- **`iproute2` (`ip`) and `iptables`** — used by the daemon to bring up
  the TUN interface and set up forwarding. Installed by default on most
  desktop distros.
- **Bluetooth path only** — if `[bluetooth]` or `[bluetooth_rfcomm]` is
  enabled in `~/.config/pim/pim.toml`, the daemon shells out to
  `bluetoothctl`, `bt-network`, `dnsmasq`, `dhclient`. Install
  `bluez`, `bluez-tools`, `dnsmasq`, and `isc-dhcp-client` on
  Debian/Ubuntu (or the equivalents on other distros) before enabling
  those features. The UI starts fine without them; only the BT bridge
  setup logs errors.
- **Wi-Fi Direct path only** — if `[wifi_direct]` is enabled, the daemon
  drives `wpa_supplicant` directly. Most desktop distros include it.

### Run From the App Launcher

- **Linux (`.deb`/`.rpm`)**: after installation, search for `pim` in your
  desktop app launcher and open it from there.
- **macOS (`.dmg`)**: after dragging `pim.app` into `/Applications`, open it
  from `/Applications`, Spotlight, or Launchpad.

The bundle ships with the matching `pim-daemon` sidecar baked in; no
separate daemon download is required for desktop use.

### Clean A Previous Install (Linux)

Run this before installing or upgrading on Linux. It is idempotent —
safe to run when nothing is installed. Preserves `~/.config/pim/pim.toml`
(your authored daemon config); to wipe that too, `rm -rf ~/.config/pim`
explicitly.

```bash
# 1. Stop the UI (the daemon is killed by the UI on close).
pkill -x pim-ui 2>/dev/null || true
sudo pkill -x pim-daemon 2>/dev/null || true

# 2. Uninstall whichever package format is installed (silences "not installed").
sudo dpkg -r pim 2>/dev/null || true
sudo rpm -e pim 2>/dev/null || true

# 3. Remove user-level launcher remnants from any earlier AppImage recipe.
rm -rf "${HOME}/.local/share/pim-ui"
rm -f "${HOME}/.local/share/applications/pim-ui.desktop"
rm -f "${HOME}/.local/share/icons/hicolor/512x512/apps/pim-ui.png"
update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
gtk-update-icon-cache "${HOME}/.local/share/icons/hicolor" 2>/dev/null || true

# 4. Clear stale root-owned daemon runtime state.
sudo rm -f \
  "/run/user/$(id -u)/pim.sock" \
  "/run/user/$(id -u)/pim.pid" \
  "/run/user/$(id -u)/pim-daemon.log"
```

## Build From Source

If you would rather produce your own installer bundle than download a
published one, build it locally. The output is the same
`.deb` / `.rpm` / `.AppImage` / `.dmg` / `.msi` / `.exe` formats listed in
[Install From GitHub Releases](#install-from-github-releases) — install them
the same platform-native way once built.

### Prerequisites

- **git**
- **Node** ≥ 20
- **pnpm** 10 (`npm install -g pnpm@10`)
- **Rust** (stable) — install via [rustup](https://rustup.rs/)
- **Platform build deps** — see
  [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.
  On Debian / Ubuntu:

  ```bash
  sudo apt-get install -y libwebkit2gtk-4.1-dev libxdo-dev libssl-dev \
    libayatana-appindicator3-dev librsvg2-dev patchelf
  ```

- **macOS only** — Xcode command-line tools (Swift toolchain) are required to
  build the `pim-bt-rfcomm-mac` Bluetooth-RFCOMM bridge declared in
  `src-tauri/tauri.macos.conf.json`.

### Build

```bash
git clone https://github.com/Astervia/pim-ui.git
cd pim-ui

pnpm install --frozen-lockfile

# Bake the matching pim-daemon sidecar into src-tauri/binaries/.
# Defaults to the latest proximity-internet-mesh release;
# see "Pinning the bundled daemon" below to override.
pnpm fetch-daemon
```

On **macOS only**, also build the Bluetooth-RFCOMM Swift sidecar that
`tauri.macos.conf.json` declares (mirrors the matching step in
`.github/workflows/release.yml`):

```bash
case "$(uname -m)" in
  arm64)  TRIPLE_IN=arm64-apple-macosx13.0  ; TRIPLE_OUT=aarch64-apple-darwin ;;
  x86_64) TRIPLE_IN=x86_64-apple-macosx13.0 ; TRIPLE_OUT=x86_64-apple-darwin  ;;
esac
(
  cd tools/pim-bt-rfcomm-mac
  swift build -c release --triple "$TRIPLE_IN"
  src="$(find .build -name pim-bt-rfcomm-mac -type f -path '*/release/*' ! -path '*.dSYM*' | head -1)"
  dst="../../src-tauri/binaries/pim-bt-rfcomm-mac-${TRIPLE_OUT}"
  cp "$src" "$dst"
  chmod +x "$dst"
  codesign --force -s - \
    --entitlements entitlements/pim-bt-rfcomm-mac.entitlements "$dst"
)
```

Then produce the native installer bundles for the host:

```bash
pnpm tauri build
```

Output lands under `src-tauri/target/release/bundle/`:

| Platform | Bundles                                                               |
| -------- | --------------------------------------------------------------------- |
| Linux    | `bundle/deb/*.deb`, `bundle/rpm/*.rpm`, `bundle/appimage/*.AppImage`  |
| macOS    | `bundle/dmg/*.dmg`, `bundle/macos/pim.app`                            |
| Windows  | `bundle/msi/*.msi`, `bundle/nsis/*.exe`                               |

Install the resulting bundle the same platform-native way described in
[Install From GitHub Releases](#install-from-github-releases). For example
on Debian / Ubuntu:

```bash
sudo apt install ./src-tauri/target/release/bundle/deb/pim_*.deb
```

The `.AppImage` warning above applies to locally-built AppImages too —
prefer `.deb` or `.rpm` on Linux until the AppImage daemon-mangling issue
is fixed. On Linux, the [Runtime Requirements](#runtime-requirements-linux)
(polkit auth agent, `iproute2`, `iptables`, …) apply to source-built
bundles exactly the same way they apply to released ones.

### Pinning the bundled daemon

`scripts/fetch-daemon.sh` decides which `pim-daemon` ends up baked into the
bundle. Override the default-latest-release with:

```bash
pnpm fetch-daemon --version v0.1.16        # pin a kernel release tag
pnpm fetch-daemon --branch main            # build pim-daemon from a kernel branch
PIM_DAEMON_VERSION=v0.1.16 pnpm fetch-daemon
```

`--branch` builds the daemon from source: it reads a sibling `../kernel`
checkout when present, otherwise pulls a tarball from
[Astervia/proximity-internet-mesh](https://github.com/Astervia/proximity-internet-mesh).
Override the local checkout location with `--repo-path <path>` or
`PIM_DAEMON_REPO_PATH=<path>`.

### Cross-compiling

`pnpm tauri build` defaults to the host triple. To target another triple,
fetch a daemon for it and pass `--target`:

```bash
# Apple Silicon host → also build the Intel bundle:
rustup target add x86_64-apple-darwin
pnpm fetch-daemon x86_64-apple-darwin
pnpm tauri build --target x86_64-apple-darwin
```

For multi-platform releases the
[`.github/workflows/release.yml`](.github/workflows/release.yml) matrix is
the easier path — it already runs each target on a matching host runner
and produces the same `pim-ui-<tag>-<label>.<ext>` artifact layout used in
[Install From GitHub Releases](#install-from-github-releases).

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
