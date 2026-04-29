#!/usr/bin/env bash
# Fetch pre-built pim-daemon binaries from the proximity-internet-mesh
# release matching `$PIM_DAEMON_VERSION`. Tauri 2 sidecar convention:
# binaries live in src-tauri/binaries/ with a target-triple suffix and
# are declared under bundle.externalBin in tauri.conf.json. Not
# committed to git — CI downloads per-release.
#
# Usage:
#   bash scripts/fetch-daemon.sh                # auto-detect host triple
#   bash scripts/fetch-daemon.sh <triple>...    # explicit triples
#
# Environment:
#   PIM_DAEMON_VERSION   release tag in proximity-internet-mesh, e.g.
#                        v0.1.12. Defaults to the value below — bump
#                        when you cut a new pim-ui release that needs
#                        a fresher daemon.

set -euo pipefail

VERSION="${PIM_DAEMON_VERSION:-v0.1.12}"
RELEASE_BASE="https://github.com/Astervia/proximity-internet-mesh/releases/download"

# Map pim-ui target triples → proximity release asset triples.
# proximity-internet-mesh/.github/workflows/release.yml currently ships:
#   - aarch64-apple-darwin
#   - x86_64-apple-darwin
#   - x86_64-unknown-linux-musl  (works on glibc systems too)
# Windows + Linux ARM are NOT yet shipped by proximity — those rows
# are intentionally absent so the script fails fast for them rather
# than silently downloading the wrong asset.
asset_triple_for() {
  case "$1" in
    aarch64-apple-darwin)        echo "aarch64-apple-darwin" ;;
    x86_64-apple-darwin)         echo "x86_64-apple-darwin" ;;
    x86_64-unknown-linux-gnu)    echo "x86_64-unknown-linux-musl" ;;
    *)                           echo "" ;;
  esac
}

# Detect host triple if no args were passed.
if [ $# -eq 0 ]; then
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64)         TRIPLES=("aarch64-apple-darwin") ;;
    Darwin-x86_64)        TRIPLES=("x86_64-apple-darwin") ;;
    Linux-x86_64)         TRIPLES=("x86_64-unknown-linux-gnu") ;;
    # Windows runners (Git Bash / MSYS2 / Cygwin all match here).
    # proximity-internet-mesh does not yet ship a Windows release —
    # the loop below detects the empty asset_triple_for() result and
    # places a stub at src-tauri/binaries/pim-daemon-<triple>.exe so
    # `cargo build` resolves the externalBin path without bundling a
    # real daemon.
    MINGW*-x86_64|MSYS*-x86_64|CYGWIN*-x86_64)
      TRIPLES=("x86_64-pc-windows-msvc")
      ;;
    *)
      echo "fetch-daemon: unsupported host $(uname -sm); pass triples explicitly" >&2
      exit 1
      ;;
  esac
else
  TRIPLES=("$@")
fi

mkdir -p src-tauri/binaries

for triple in "${TRIPLES[@]}"; do
  src_triple="$(asset_triple_for "$triple")"
  if [ -z "$src_triple" ]; then
    # No upstream asset for this triple yet (e.g. Windows). Drop a stub
    # so tauri.conf.json's externalBin resolves and `cargo build` can
    # link; do NOT bundle this for release. desktop-release.yml is
    # responsible for either (a) skipping unsupported targets or (b)
    # providing a real binary once proximity ships one.
    ext=""
    case "$triple" in
      *windows*) ext=".exe" ;;
    esac
    stub="src-tauri/binaries/pim-daemon-${triple}${ext}"
    echo "fetch-daemon: no proximity release for $triple — stubbing $stub" >&2
    : >"$stub"
    chmod 755 "$stub"
    continue
  fi

  asset="pim-${VERSION}-${src_triple}"
  url="${RELEASE_BASE}/${VERSION}/${asset}.tar.gz"
  sha_url="${RELEASE_BASE}/${VERSION}/${asset}.sha256"

  echo "→ ${triple} ← ${url}"

  workdir="$(mktemp -d)"
  trap 'rm -rf "$workdir"' EXIT

  curl -fsSL "${url}" -o "${workdir}/${asset}.tar.gz"
  curl -fsSL "${sha_url}" -o "${workdir}/${asset}.sha256"

  # Verify checksum. proximity's release writes
  # `<sha>  <asset>.tar.gz` so we strip the filename column and
  # recompute over the local tarball.
  expected="$(awk '{print $1}' "${workdir}/${asset}.sha256")"
  actual="$(shasum -a 256 "${workdir}/${asset}.tar.gz" | awk '{print $1}')"
  if [ "${expected}" != "${actual}" ]; then
    echo "fetch-daemon: sha256 mismatch for ${asset}.tar.gz" >&2
    echo "  expected ${expected}" >&2
    echo "  actual   ${actual}" >&2
    exit 1
  fi

  tar -xzf "${workdir}/${asset}.tar.gz" -C "${workdir}"

  # The tarball contains pim and pim-daemon at the top of the extracted
  # dir, named `<asset>/pim-daemon`. Pull just the daemon and rename
  # to the externalBin suffix the UI's tauri.conf.json expects.
  ext=""
  case "$triple" in
    *windows*) ext=".exe" ;;
  esac
  cp "${workdir}/${asset}/pim-daemon${ext}" "src-tauri/binaries/pim-daemon-${triple}${ext}"
  chmod 755 "src-tauri/binaries/pim-daemon-${triple}${ext}"

  rm -rf "$workdir"
  trap - EXIT

  echo "✓ placed src-tauri/binaries/pim-daemon-${triple}${ext}"
done
