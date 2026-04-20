#!/bin/bash
# Uninstallation script for Kanso Video Quick Look Generator

set -e

QL_DIR="$HOME/Library/QuickLook"
QL_GENERATOR="$QL_DIR/KansoQuickLook.qlgenerator"

echo "Uninstalling Kanso Video Quick Look Generator..."

# Remove the generator
if [ -d "$QL_GENERATOR" ]; then
    rm -Rf "$QL_GENERATOR"
    echo "Quick Look generator removed"
else
    echo "Quick Look generator not found, skipping removal"
fi

# Restart Quick Look
echo "Restarting Quick Look..."
qlmanage -r
qlmanage -r cache

echo "Kanso Video Quick Look Generator uninstalled successfully!"
