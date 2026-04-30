#!/usr/bin/env bash
# Fetch pim-daemon binaries from the proximity-internet-mesh release
# matching `$PIM_DAEMON_VERSION`, from a source branch matching
# `$PIM_DAEMON_BRANCH`, or from the latest release when neither variable
# is set. Tauri 2 sidecar convention:
# binaries live in src-tauri/binaries/ with a target-triple suffix and
# are declared under bundle.externalBin in tauri.conf.json. Not
# committed to git — CI downloads per-release.
#
# Usage:
#   bash scripts/fetch-daemon.sh                         # latest release, host triple
#   bash scripts/fetch-daemon.sh --version v0.1.12       # pinned release tag
#   bash scripts/fetch-daemon.sh --branch main           # build daemon from branch
#   bash scripts/fetch-daemon.sh [options] <triple>...   # explicit triples
#
# Environment:
#   PIM_DAEMON_VERSION   release tag in proximity-internet-mesh, e.g.
#                        v0.1.12.
#   PIM_DAEMON_BRANCH    branch in proximity-internet-mesh to build from source.
#   PIM_DAEMON_REPO_PATH local kernel checkout used for branch builds when
#                        available. Defaults to ../kernel.
#
# Defaults to the latest GitHub release when no version or branch is provided.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RELEASE_BASE="https://github.com/Astervia/proximity-internet-mesh/releases/download"
LATEST_RELEASE_URL="https://github.com/Astervia/proximity-internet-mesh/releases/latest"
SOURCE_REPO_URL="https://github.com/Astervia/proximity-internet-mesh"
DEFAULT_KERNEL_REPO_PATH="../kernel"
VERSION="${PIM_DAEMON_VERSION:-}"
BRANCH="${PIM_DAEMON_BRANCH:-}"
KERNEL_REPO_PATH="${PIM_DAEMON_REPO_PATH:-$DEFAULT_KERNEL_REPO_PATH}"
TRIPLES=()
TEMP_DIRS=()
BRANCH_SOURCE_DIR=""
MADE_TEMP_DIR=""
VERSION_ARG=false
BRANCH_ARG=false

usage() {
  cat <<'EOF'
Usage:
  bash scripts/fetch-daemon.sh [options] [triple...]

Options:
  --version <tag>       Fetch a release tag, e.g. v0.1.12.
  --branch <branch>     Build pim-daemon from a proximity-internet-mesh branch.
  --repo-path <path>    Local kernel checkout for --branch. Default: ../kernel.
  -h, --help            Show this help.

Environment:
  PIM_DAEMON_VERSION    Same as --version.
  PIM_DAEMON_BRANCH     Same as --branch.
  PIM_DAEMON_REPO_PATH  Same as --repo-path.

If neither version nor branch is set, the latest GitHub release is fetched.
EOF
}

die() {
  echo "fetch-daemon: $*" >&2
  exit 1
}

require_tool() {
  command -v "$1" >/dev/null 2>&1 || die "required tool not found: $1"
}

make_temp_dir() {
  MADE_TEMP_DIR="$(mktemp -d)"
  TEMP_DIRS+=("$MADE_TEMP_DIR")
}

cleanup_temp_dirs() {
  local dir
  for dir in "${TEMP_DIRS[@]+"${TEMP_DIRS[@]}"}"; do
    rm -rf "$dir"
  done
}
trap cleanup_temp_dirs EXIT

latest_release_version() {
  curl -fsSLI -o /dev/null -w '%{url_effective}' "$LATEST_RELEASE_URL" | sed 's:.*/::'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --version)
      [ $# -ge 2 ] || die "--version requires a value"
      VERSION="$2"
      VERSION_ARG=true
      shift 2
      ;;
    --branch)
      [ $# -ge 2 ] || die "--branch requires a value"
      BRANCH="$2"
      BRANCH_ARG=true
      shift 2
      ;;
    --repo-path)
      [ $# -ge 2 ] || die "--repo-path requires a value"
      KERNEL_REPO_PATH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [ $# -gt 0 ]; do
        TRIPLES+=("$1")
        shift
      done
      ;;
    --*)
      die "unknown option: $1"
      ;;
    *)
      TRIPLES+=("$1")
      shift
      ;;
  esac
done

if $VERSION_ARG && $BRANCH_ARG; then
  die "set either --version or --branch, not both"
fi
if $VERSION_ARG; then
  BRANCH=""
fi
if $BRANCH_ARG; then
  VERSION=""
fi
if [ -n "$VERSION" ] && [ -n "$BRANCH" ]; then
  die "set either a version or a branch, not both"
fi

SOURCE_KIND="release"
if [ -n "$BRANCH" ]; then
  SOURCE_KIND="branch"
elif [ -z "$VERSION" ]; then
  require_tool curl
  require_tool sed
  VERSION="$(latest_release_version)"
  if [ -z "$VERSION" ]; then
    die "failed to determine latest proximity-internet-mesh release"
  fi
fi

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

# Detect host triple if no triples were passed.
if [ ${#TRIPLES[@]} -eq 0 ]; then
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
      die "unsupported host $(uname -sm); pass triples explicitly"
      ;;
  esac
fi

prepare_branch_source() {
  if [ -n "$BRANCH_SOURCE_DIR" ]; then
    return 0
  fi

  require_tool cargo
  require_tool tar

  local source_dir
  make_temp_dir
  source_dir="${MADE_TEMP_DIR}/source"
  mkdir -p "$source_dir"

  if [ -d "$KERNEL_REPO_PATH/.git" ] && git -C "$KERNEL_REPO_PATH" rev-parse --verify --quiet "${BRANCH}^{commit}" >/dev/null; then
    echo "fetch-daemon: building branch ${BRANCH} from ${KERNEL_REPO_PATH}"
    git -C "$KERNEL_REPO_PATH" archive "$BRANCH" | tar -x -C "$source_dir"
  else
    require_tool curl
    echo "fetch-daemon: building branch ${BRANCH} from ${SOURCE_REPO_URL}"
    curl -fsSL "${SOURCE_REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz" | tar -xz --strip-components=1 -C "$source_dir"
  fi

  BRANCH_SOURCE_DIR="$source_dir"
}

fetch_release_daemon() {
  local triple="$1"
  local src_triple="$2"
  local ext="$3"
  local asset url sha_url workdir expected actual

  require_tool curl
  require_tool awk
  require_tool shasum
  require_tool tar

  asset="pim-${VERSION}-${src_triple}"
  url="${RELEASE_BASE}/${VERSION}/${asset}.tar.gz"
  sha_url="${RELEASE_BASE}/${VERSION}/${asset}.sha256"

  echo "→ ${triple} ← ${url}"

  make_temp_dir
  workdir="$MADE_TEMP_DIR"

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
  cp "${workdir}/${asset}/pim-daemon${ext}" "src-tauri/binaries/pim-daemon-${triple}${ext}"
  chmod 755 "src-tauri/binaries/pim-daemon-${triple}${ext}"
}

build_branch_daemon() {
  local triple="$1"
  local ext="$2"
  local bin_path

  prepare_branch_source

  echo "→ ${triple} ← branch ${BRANCH}"
  (
    cd "$BRANCH_SOURCE_DIR"
    cargo build --release --locked --bin pim-daemon --target "$triple"
  )

  bin_path="${BRANCH_SOURCE_DIR}/target/${triple}/release/pim-daemon${ext}"
  [ -f "$bin_path" ] || die "branch build did not produce $bin_path"

  cp "$bin_path" "src-tauri/binaries/pim-daemon-${triple}${ext}"
  chmod 755 "src-tauri/binaries/pim-daemon-${triple}${ext}"
}

mkdir -p src-tauri/binaries

for triple in "${TRIPLES[@]}"; do
  ext=""
  case "$triple" in
    *windows*) ext=".exe" ;;
  esac

  if [ "$SOURCE_KIND" = "branch" ]; then
    build_branch_daemon "$triple" "$ext"
    echo "✓ placed src-tauri/binaries/pim-daemon-${triple}${ext}"
    continue
  fi

  src_triple="$(asset_triple_for "$triple")"
  if [ -z "$src_triple" ]; then
    # No upstream asset for this triple yet (e.g. Windows). Drop a stub
    # so tauri.conf.json's externalBin resolves and `cargo build` can
    # link; do NOT bundle this for release. desktop-release.yml is
    # responsible for either (a) skipping unsupported targets or (b)
    # providing a real binary once proximity ships one.
    stub="src-tauri/binaries/pim-daemon-${triple}${ext}"
    echo "fetch-daemon: no proximity release for $triple — stubbing $stub" >&2
    : >"$stub"
    chmod 755 "$stub"
    continue
  fi

  fetch_release_daemon "$triple" "$src_triple" "$ext"
  echo "✓ placed src-tauri/binaries/pim-daemon-${triple}${ext}"
done
