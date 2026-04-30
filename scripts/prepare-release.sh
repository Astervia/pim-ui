#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

REMOTE="${REMOTE:-origin}"
BUMP_KIND="${BUMP_KIND:-patch}"
TAG_PATTERN='v[0-9]*.[0-9]*.[0-9]*'

PACKAGE_JSON="package.json"
CARGO_MANIFEST="src-tauri/Cargo.toml"
TAURI_CONF="src-tauri/tauri.conf.json"

usage() {
    cat <<'EOF'
Usage: scripts/prepare-release.sh [options]

Fetches the latest remote release tag and bumps the project version in
package.json, src-tauri/Cargo.toml, and src-tauri/tauri.conf.json so the
next tag push matches the new release version. Also refreshes the
Cargo and pnpm lockfiles so the bumped versions land in lockfiles too.

Options:
  --bump <kind>                patch|minor|major. Default: patch
  --remote <name>              Git remote to fetch tags from. Default: origin
  --no-fetch                   Skip 'git fetch --tags'
  --no-lockfile-update         Skip refreshing Cargo + pnpm lockfiles
  --dry-run                    Show planned changes without editing files
  -h, --help                   Show this help

Environment overrides:
  BUMP_KIND
  REMOTE

Notes:
  - Release tags are expected to look like vX.Y.Z.
  - All three manifests share a single version field — the script keeps
    them in lockstep, which is also what the release workflow expects.
  - Commit creation, tagging, and tag push remain manual.
EOF
}

die() {
    echo "error: $*" >&2
    exit 1
}

require_tool() {
    command -v "$1" >/dev/null 2>&1 || die "required tool not found: $1"
}

is_valid_bump_kind() {
    case "$1" in
        patch|minor|major) return 0 ;;
        *) return 1 ;;
    esac
}

bump_version() {
    local version="$1"
    local kind="$2"
    local major minor patch

    IFS=. read -r major minor patch <<<"$version"
    [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ && "$patch" =~ ^[0-9]+$ ]] \
        || die "invalid semver version: $version"

    case "$kind" in
        patch) patch=$((patch + 1)) ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        *) die "unsupported bump kind: $kind" ;;
    esac

    printf '%s.%s.%s\n' "$major" "$minor" "$patch"
}

compare_versions() {
    local left="$1"
    local right="$2"
    local l_major l_minor l_patch r_major r_minor r_patch

    IFS=. read -r l_major l_minor l_patch <<<"$left"
    IFS=. read -r r_major r_minor r_patch <<<"$right"

    for pair in \
        "$l_major $r_major" \
        "$l_minor $r_minor" \
        "$l_patch $r_patch"; do
        set -- $pair
        if (( $1 < $2 )); then
            printf '%s\n' -1
            return 0
        fi
        if (( $1 > $2 )); then
            printf '%s\n' 1
            return 0
        fi
    done

    printf '%s\n' 0
}

latest_release_tag() {
    git tag --list "$TAG_PATTERN" --sort=-version:refname | head -n1
}

cargo_version() {
    sed -n 's/^version = "\(.*\)"$/\1/p' "$CARGO_MANIFEST" | head -n1
}

set_cargo_version() {
    local new_version="$1"
    perl -0pi -e 's/^version = "[^"]*"/version = "'"$new_version"'"/m' "$CARGO_MANIFEST"
}

package_json_version() {
    perl -ne 'if (/"version"\s*:\s*"([^"]+)"/) { print "$1\n"; exit }' "$PACKAGE_JSON"
}

set_package_json_version() {
    local new_version="$1"
    # Only touch the first top-level "version" field. Nested "version"
    # fields under packageManager etc. are not matched because we anchor
    # to a leading two-space indent — the convention pnpm/npm emit.
    perl -0pi -e 's/(^\s{2}"version"\s*:\s*")[^"]+(")/${1}'"$new_version"'${2}/m' "$PACKAGE_JSON"
}

tauri_conf_version() {
    perl -ne 'if (/"version"\s*:\s*"([^"]+)"/) { print "$1\n"; exit }' "$TAURI_CONF"
}

set_tauri_conf_version() {
    local new_version="$1"
    perl -0pi -e 's/(^\s{2}"version"\s*:\s*")[^"]+(")/${1}'"$new_version"'${2}/m' "$TAURI_CONF"
}

FETCH_TAGS=true
DRY_RUN=false
UPDATE_LOCKFILES=true

while [[ $# -gt 0 ]]; do
    case "$1" in
        --bump)
            [[ $# -ge 2 ]] || die "--bump requires a value"
            BUMP_KIND="$2"
            shift 2
            ;;
        --remote)
            [[ $# -ge 2 ]] || die "--remote requires a value"
            REMOTE="$2"
            shift 2
            ;;
        --no-fetch)
            FETCH_TAGS=false
            shift
            ;;
        --no-lockfile-update)
            UPDATE_LOCKFILES=false
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "unknown option: $1"
            ;;
    esac
done

require_tool git
require_tool perl
require_tool sed
require_tool cargo

is_valid_bump_kind "$BUMP_KIND" || die "invalid bump kind: $BUMP_KIND"

if $FETCH_TAGS; then
    git fetch --tags "$REMOTE"
fi

LATEST_TAG="$(latest_release_tag)"
[[ -n "$LATEST_TAG" ]] || die "no release tags matching $TAG_PATTERN were found"

LATEST_VERSION="${LATEST_TAG#v}"
TARGET_VERSION="$(bump_version "$LATEST_VERSION" "$BUMP_KIND")"

CURRENT_CARGO_VERSION="$(cargo_version)"
CURRENT_PACKAGE_VERSION="$(package_json_version)"
CURRENT_TAURI_VERSION="$(tauri_conf_version)"

if [[ -z "$CURRENT_CARGO_VERSION" ]]; then
    die "could not parse current version from $CARGO_MANIFEST"
fi
if [[ -z "$CURRENT_PACKAGE_VERSION" ]]; then
    die "could not parse current version from $PACKAGE_JSON"
fi
if [[ -z "$CURRENT_TAURI_VERSION" ]]; then
    die "could not parse current version from $TAURI_CONF"
fi

for current in "$CURRENT_CARGO_VERSION" "$CURRENT_PACKAGE_VERSION" "$CURRENT_TAURI_VERSION"; do
    if [[ "$(compare_versions "$current" "$TARGET_VERSION")" == "1" ]]; then
        die "manifest already has newer version $current than target $TARGET_VERSION"
    fi
done

echo "Latest release tag: $LATEST_TAG"
echo "Latest release version: $LATEST_VERSION"
echo "Target version: $TARGET_VERSION"
echo ""
echo "Current manifest versions:"
printf '  %-32s %s\n' "$PACKAGE_JSON" "$CURRENT_PACKAGE_VERSION"
printf '  %-32s %s\n' "$CARGO_MANIFEST" "$CURRENT_CARGO_VERSION"
printf '  %-32s %s\n' "$TAURI_CONF" "$CURRENT_TAURI_VERSION"
echo ""

if $DRY_RUN; then
    echo "Dry run only. No files were modified."
    exit 0
fi

if [[ "$CURRENT_PACKAGE_VERSION" != "$TARGET_VERSION" ]]; then
    set_package_json_version "$TARGET_VERSION"
fi
if [[ "$CURRENT_CARGO_VERSION" != "$TARGET_VERSION" ]]; then
    set_cargo_version "$TARGET_VERSION"
fi
if [[ "$CURRENT_TAURI_VERSION" != "$TARGET_VERSION" ]]; then
    set_tauri_conf_version "$TARGET_VERSION"
fi

if $UPDATE_LOCKFILES; then
    echo "Refreshing lockfiles…"
    cargo update --manifest-path "$CARGO_MANIFEST" --workspace --quiet || \
        echo "warning: cargo update returned non-zero — review Cargo.lock manually" >&2
    if command -v pnpm >/dev/null 2>&1; then
        pnpm install --lockfile-only >/dev/null || \
            echo "warning: pnpm install --lockfile-only failed — refresh pnpm-lock.yaml manually" >&2
    else
        echo "warning: pnpm not on PATH; skipping pnpm-lock.yaml refresh" >&2
    fi
fi

echo "Updated manifest versions:"
printf '  %-32s %s\n' "$PACKAGE_JSON" "$(package_json_version)"
printf '  %-32s %s\n' "$CARGO_MANIFEST" "$(cargo_version)"
printf '  %-32s %s\n' "$TAURI_CONF" "$(tauri_conf_version)"
echo ""
echo "Next manual steps:"
echo "  1. Review manifest and lockfile changes."
echo "  2. Commit the version bumps."
echo "  3. Create and push the release tag manually (e.g. git tag v$TARGET_VERSION && git push --tags)."
