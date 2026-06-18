#!/usr/bin/env bash
set -euo pipefail

# Build and publish a new Kanso release.
# Usage: ./scripts/release.sh [version]
#
# If no version is provided, the script auto-increments the patch segment of the
# latest Git tag (e.g. v0.1.6 -> v0.1.7).

# 1. Check prerequisites
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI ('gh') is not installed. Please install it first."
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ Error: GitHub CLI ('gh') is not authenticated. Please run 'gh auth login' first."
    exit 1
fi

if ! git rev-parse --is-inside-work-tree &> /dev/null; then
    echo "❌ Error: Not in a git repository."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed."
    exit 1
fi

# 2. Determine target version
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo "ℹ️ Latest Git tag found: $LATEST_TAG"

TARGET_VERSION="${1:-}"

if [ -z "$TARGET_VERSION" ]; then
    # Auto-increment patch version
    CLEAN_TAG="${LATEST_TAG#v}"
    if [[ "$CLEAN_TAG" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        PATCH="${BASH_REMATCH[3]}"
        NEW_PATCH=$((PATCH + 1))
        TARGET_VERSION="v${MAJOR}.${MINOR}.${NEW_PATCH}"
    else
        TARGET_VERSION="v1.0.0"
    fi
    echo "🔮 Auto-determining next version: $TARGET_VERSION"
else
    # Ensure version starts with 'v'
    if [[ ! "$TARGET_VERSION" =~ ^v ]]; then
        TARGET_VERSION="v$TARGET_VERSION"
    fi
    echo "📝 Using user-defined version: $TARGET_VERSION"
fi

# 3. Validate version against package.json
PACKAGE_VERSION=$(node -p "require('./package.json').version")
VERSION_WITHOUT_V="${TARGET_VERSION#v}"
if [ "$VERSION_WITHOUT_V" != "$PACKAGE_VERSION" ]; then
    echo "⚠️ Warning: target version $TARGET_VERSION does not match package.json version $PACKAGE_VERSION"
    read -p "❓ Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "🚫 Release cancelled."
        exit 0
    fi
fi

# 4. Check that the tag does not already exist on the remote
REMOTE_TAG=$(git ls-remote --tags origin "refs/tags/$TARGET_VERSION" 2>/dev/null || true)
if [ -n "$REMOTE_TAG" ]; then
    echo "❌ Error: tag $TARGET_VERSION already exists on the remote."
    exit 1
fi

# 5. Confirm with user
read -p "❓ Do you want to build and publish release $TARGET_VERSION to GitHub? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🚫 Release cancelled."
    exit 0
fi

# 6. Git Tagging & Pushing
CURRENT_BRANCH=$(git branch --show-current)
echo "⬆️ Pushing current branch '$CURRENT_BRANCH' commits to origin..."
git push origin "$CURRENT_BRANCH"

if git rev-parse "$TARGET_VERSION" &> /dev/null; then
    echo "⚠️ Local tag $TARGET_VERSION already exists. Deleting local tag..."
    git tag -d "$TARGET_VERSION"
fi

echo "🏷️ Tagging version $TARGET_VERSION..."
git tag "$TARGET_VERSION"

echo "⬆️ Pushing tag to origin..."
git push origin "$TARGET_VERSION"

echo "⏳ Tag pushed. GitHub Actions now owns release assembly and publishing for $TARGET_VERSION."
echo "🔎 Track progress with: gh run list --workflow Release --limit 1"
