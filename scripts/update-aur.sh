#!/usr/bin/env bash
set -euo pipefail

# Publish a kanso-bin AUR package update.
# Usage: ./scripts/update-aur.sh <version-without-v> <source-url> <sha256>
#
# Requires an SSH key authorized for the AUR account to be available in the
# ssh-agent. In GitHub Actions, configure this with the webfactory/ssh-agent
# action and an AUR_SSH_PRIVATE_KEY secret.

if [ "$#" -ne 3 ]; then
    echo "usage: $0 <version-without-v> <source-url> <sha256>" >&2
    exit 1
fi

VERSION="$1"
SOURCE_URL="$2"
SOURCE_SHA="$3"

AUR_REPO_URL="${AUR_REPO:-aur@aur.archlinux.org:kanso-bin.git}"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Cloning AUR repository ${AUR_REPO_URL}..."
git clone "$AUR_REPO_URL" "$WORKDIR/kanso-bin"

echo "Rendering AUR packaging files for v${VERSION}..."
OUT_DIR="$WORKDIR/kanso-bin" "$SCRIPT_DIR/render-aur.sh" "$VERSION" "$SOURCE_URL" "$SOURCE_SHA"

cd "$WORKDIR/kanso-bin"

git add PKGBUILD .SRCINFO
if git diff --cached --quiet; then
    echo "AUR package already up to date for v${VERSION}."
    exit 0
fi

git -c user.email="github-actions@kanso.local" -c user.name="Kanso Release Bot" \
    commit -m "Release v${VERSION}"

echo "Pushing AUR package update..."
git push
