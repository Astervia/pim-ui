#!/usr/bin/env bash
#
# build-bt-rfcomm-sidecar.sh — compile the `pim-bt-rfcomm-mac` Swift
# Package and drop the resulting binaries into `src-tauri/binaries/`
# under the per-triple naming convention Tauri v2 expects.
#
# Run from the repo root:
#     bash scripts/build-bt-rfcomm-sidecar.sh
#
# Optional env:
#     PIM_DEVELOPER_ID  — Developer ID Application certificate identity
#                         (e.g. "Developer ID Application: Foo (TEAM)").
#                         If unset, ad-hoc signs (`-s -`) for local dev.
#
# Idempotent: re-running rebuilds and replaces existing binaries.

set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$REPO_ROOT/tools/pim-bt-rfcomm-mac"
OUT_DIR="$REPO_ROOT/src-tauri/binaries"

if [[ ! -d "$PKG_DIR" ]]; then
    echo "build-bt-rfcomm-sidecar: package not found: $PKG_DIR" >&2
    exit 1
fi

mkdir -p "$OUT_DIR"

build_for_triple() {
    local triple_in="$1"
    local triple_out="$2"
    echo "==> building $triple_out"
    (cd "$PKG_DIR" && swift build -c release --triple "$triple_in")
    # SwiftPM strips the SDK-version suffix off the path on recent
    # toolchains, so `--triple arm64-apple-macosx13.0` writes to
    # `.build/arm64-apple-macosx/`. Try the trimmed form first, fall
    # back to the literal triple for older toolchains.
    local triple_dir
    triple_dir="$(echo "$triple_in" | sed 's/macosx[0-9].*$/macosx/')"
    local src="$PKG_DIR/.build/$triple_dir/release/pim-bt-rfcomm-mac"
    if [[ ! -f "$src" ]]; then
        src="$PKG_DIR/.build/$triple_in/release/pim-bt-rfcomm-mac"
    fi
    local dst="$OUT_DIR/pim-bt-rfcomm-mac-$triple_out"
    cp "$src" "$dst"
    chmod +x "$dst"

    # Ad-hoc sign in dev mode; real Developer ID when present.
    if [[ -n "${PIM_DEVELOPER_ID:-}" ]]; then
        echo "==> codesign Developer ID for $triple_out"
        codesign \
            --force \
            --options=runtime \
            --timestamp \
            --entitlements "$PKG_DIR/entitlements/pim-bt-rfcomm-mac.entitlements" \
            -s "$PIM_DEVELOPER_ID" \
            "$dst"
    else
        echo "==> codesign ad-hoc for $triple_out (no PIM_DEVELOPER_ID set)"
        codesign --force -s - "$dst"
    fi

    echo "    out: $dst"
    file "$dst" || true
}

build_for_triple arm64-apple-macosx13.0 aarch64-apple-darwin

# x86_64 build is best-effort: many Apple Silicon machines lack the SDK
# fallback toolchain. Skip with a warning rather than fail the script.
if (cd "$PKG_DIR" && swift build -c release --triple x86_64-apple-macosx13.0) 2>/dev/null; then
    x86_dir="$PKG_DIR/.build/x86_64-apple-macosx/release/pim-bt-rfcomm-mac"
    if [[ ! -f "$x86_dir" ]]; then
        x86_dir="$PKG_DIR/.build/x86_64-apple-macosx13.0/release/pim-bt-rfcomm-mac"
    fi
    cp "$x86_dir" \
       "$OUT_DIR/pim-bt-rfcomm-mac-x86_64-apple-darwin"
    chmod +x "$OUT_DIR/pim-bt-rfcomm-mac-x86_64-apple-darwin"
    if [[ -n "${PIM_DEVELOPER_ID:-}" ]]; then
        codesign --force --options=runtime --timestamp \
            --entitlements "$PKG_DIR/entitlements/pim-bt-rfcomm-mac.entitlements" \
            -s "$PIM_DEVELOPER_ID" \
            "$OUT_DIR/pim-bt-rfcomm-mac-x86_64-apple-darwin"
    else
        codesign --force -s - "$OUT_DIR/pim-bt-rfcomm-mac-x86_64-apple-darwin"
    fi
    echo "==> x86_64 OK"
else
    echo "==> x86_64 build skipped (toolchain not available); arm64 only"
fi

echo "==> done"
ls -la "$OUT_DIR"/pim-bt-rfcomm-mac-*
