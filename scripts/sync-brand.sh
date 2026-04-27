#!/usr/bin/env bash
# Sync brand tokens from the kernel repo (proximity-internet-mesh).
#
# Source of truth: .design/branding/pim/patterns/pim.yml
# Destination: src/globals.css (tokens under @theme)
#
# Strategy for v0.0.1: manual sync — both repos are sibling checkouts.
#   ../proximity-internet-mesh/.design/branding/pim/patterns/pim.yml
#
# When the kernel repo is pushed to a location we can pull as a submodule,
# add it as a submodule at .brand/ and update this script to read from there.

set -euo pipefail

KERNEL_REPO_PATH="${KERNEL_REPO_PATH:-../proximity-internet-mesh}"
SOURCE="${KERNEL_REPO_PATH}/.design/branding/pim/patterns/pim.yml"
TARGET="src/globals.css"

if [[ ! -f "$SOURCE" ]]; then
  echo "error: brand source not found at $SOURCE" >&2
  echo "set KERNEL_REPO_PATH to point to the proximity-internet-mesh checkout" >&2
  exit 1
fi

echo "→ reading $SOURCE"
echo "→ current target: $TARGET"
echo
echo "TODO: this script will parse tokens.color.* from the YAML and"
echo "regenerate the @theme block in $TARGET."
echo
echo "For v0.0.1, tokens are inlined in $TARGET. When the brand evolves,"
echo "update both manually and run this script once it's implemented."
