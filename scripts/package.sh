#!/usr/bin/env bash
set -euo pipefail

# Build Kanso release artifacts for the current host platform.
# Usage: ./scripts/package.sh [version]
#
# Produces:
#   Linux:   .deb, .pkg.tar.zst, .tar.gz
#   Windows: .exe installer
#   macOS:   .dmg (+ .zip for auto-updater)

RAW_VERSION="${1:-${GITHUB_REF_NAME:-dev}}"
VERSION="${RAW_VERSION#v}"

REPO_URL="https://github.com/${GITHUB_REPOSITORY:-psychosomat/Kanso}"

echo "=== Packaging Kanso v${VERSION} for current platform ==="

if ! command -v npm &> /dev/null; then
    echo "Error: npm is required but not installed." >&2
    exit 1
fi

npm ci

mkdir -p release

case "$(uname -s)" in
    Linux*)
        echo "Building Linux artifacts (.deb, .pkg.tar.zst, .tar.gz)..."
        npm run build
        npx electron-builder --linux deb pacman tar.gz
        ;;
    Darwin*)
        echo "Building macOS artifacts (.dmg, .zip)..."
        npm run build
        npm run build:thumbnail:mac
        npx electron-builder --mac dmg zip
        ;;
    CYGWIN*|MINGW*|MSYS*)
        echo "Building Windows artifacts (.exe installer)..."
        npm run build
        npm run build:thumbnail:win
        npx electron-builder --win nsis
        ;;
    *)
        echo "Unsupported platform: $(uname -s)" >&2
        exit 1
        ;;
esac

echo "=== Packaging complete ==="
ls -l release/
