#!/bin/bash
# Build script for Kanso Video Quick Look Generator
# Requires Xcode and macOS SDK

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="KansoQuickLook"
PROJECT_PATH="$SCRIPT_DIR/$PROJECT_NAME.xcodeproj"
OUTPUT_DIR="$SCRIPT_DIR/build"

echo "Building Kanso Video Quick Look Generator..."

# Check if Xcode is available
if ! command -v xcodebuild &> /dev/null; then
    echo "Error: xcodebuild not found. Please install Xcode."
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Build the project
xcodebuild \
    -project "$PROJECT_PATH" \
    -scheme "$PROJECT_NAME" \
    -configuration Release \
    -derivedDataPath "$OUTPUT_DIR/DerivedData" \
    -quiet

# Copy the built bundle to output directory
BUILT_BUNDLE="$OUTPUT_DIR/DerivedData/Build/Products/Release/$PROJECT_NAME.qlgenerator"
if [ -d "$BUILT_BUNDLE" ]; then
    cp -R "$BUILT_BUNDLE" "$OUTPUT_DIR/"
    echo "Build completed successfully!"
    echo "Output: $OUTPUT_DIR/$PROJECT_NAME.qlgenerator"
else
    echo "Error: Built bundle not found at $BUILT_BUNDLE"
    exit 1
fi
