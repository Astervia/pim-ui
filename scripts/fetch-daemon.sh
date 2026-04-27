#!/usr/bin/env bash
# Fetch pre-built pim-daemon binaries from the kernel repo's releases.
#
# Tauri 2 sidecar convention: binaries live in src-tauri/binaries/
# with a target-triple suffix and are declared under bundle.externalBin
# in tauri.conf.json. Not committed to git — CI downloads per-release.

set -euo pipefail

VERSION="${PIM_DAEMON_VERSION:-v0.1.8}"
TARGETS=(
  "aarch64-apple-darwin"
  "x86_64-apple-darwin"
  "x86_64-pc-windows-msvc"
  "x86_64-unknown-linux-gnu"
  "aarch64-unknown-linux-gnu"
)

mkdir -p src-tauri/binaries

for triple in "${TARGETS[@]}"; do
  ext=""
  [[ "$triple" == *"windows"* ]] && ext=".exe"

  # Matches the kernel repo's release asset naming (see proximity-internet-mesh README).
  asset="pim-${VERSION}-${triple}"
  url="https://github.com/Astervia/proximity-internet-mesh/releases/download/${VERSION}/${asset}.tar.gz"

  echo "→ $triple ← $url"
  # TODO: curl, verify sha256, extract, rename to pim-daemon-<triple>${ext}
  # For v0.0.1 this is a stub — implement when the kernel repo has matching releases.
done

echo
echo "TODO: implement download + checksum verification. For now,"
echo "drop binaries manually into src-tauri/binaries/ following the"
echo "convention documented in the .gitkeep file."
