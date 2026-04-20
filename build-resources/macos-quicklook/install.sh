#!/bin/bash
# Installation script for Kanso Video Quick Look Generator

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QL_GENERATOR="$SCRIPT_DIR/build/KansoQuickLook.qlgenerator"
QL_DIR="$HOME/Library/QuickLook"

echo "Installing Kanso Video Quick Look Generator..."

# Check if the generator exists
if [ ! -d "$QL_GENERATOR" ]; then
    echo "Error: Quick Look generator not found at $QL_GENERATOR"
    echo "Please build it first using: bun run build:thumbnail:mac"
    exit 1
fi

# Create QuickLook directory if it doesn't exist
mkdir -p "$QL_DIR"

# Copy the generator
cp -R "$QL_GENERATOR" "$QL_DIR/"

# Restart Quick Look
echo "Restarting Quick Look..."
qlmanage -r
qlmanage -r cache

echo "Kanso Video Quick Look Generator installed successfully!"
