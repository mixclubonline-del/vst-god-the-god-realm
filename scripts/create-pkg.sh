#!/bin/bash
set -e

echo "🌌 Starting VST GOD macOS Installer Packaging..."

# Move to scripts directory
cd "$(dirname "$0")"

# Output directory for component packages
STAGING_DIR="staging"
mkdir -p "$STAGING_DIR"

# Paths to the built assets
STANDALONE_PATH="../build/VSTGodTheGodRealm_artefacts/Release/Standalone/VST God - The God Realm.app"
VST3_PATH="../build/VSTGodTheGodRealm_artefacts/Release/VST3/VST God - The God Realm.vst3"
AU_PATH="../build/VSTGodTheGodRealm_artefacts/Release/AU/VST God - The God Realm.component"
SAMPLES_PATH="../public/kits"

# Optional Developer ID Application & Installer certificates
DEV_APP_CERT=${DEV_APP_CERT:-""}
DEV_INST_CERT=${DEV_INST_CERT:-""}

# Check if builds exist
if [ ! -d "$STANDALONE_PATH" ] || [ ! -d "$VST3_PATH" ] || [ ! -d "$AU_PATH" ]; then
    echo "❌ Error: Release builds not found! Run ./build-production.sh first."
    exit 1
fi

if [ -n "$DEV_APP_CERT" ]; then
    echo "🔏 Signing Standalone, VST3, and AU binaries with certificate: $DEV_APP_CERT..."
    codesign --force --options runtime --deep --sign "$DEV_APP_CERT" --timestamp "$STANDALONE_PATH"
    codesign --force --options runtime --sign "$DEV_APP_CERT" --timestamp "$VST3_PATH"
    codesign --force --options runtime --sign "$DEV_APP_CERT" --timestamp "$AU_PATH"
fi

echo "📦 1. Building Standalone component package..."
pkgbuild --component "$STANDALONE_PATH" \
         --install-location "/Applications" \
         "$STAGING_DIR/standalone.pkg"

echo "📦 2. Building VST3 component package..."
pkgbuild --component "$VST3_PATH" \
         --install-location "/Library/Audio/Plug-Ins/VST3" \
         "$STAGING_DIR/vst3.pkg"

echo "📦 3. Building AU component package..."
pkgbuild --component "$AU_PATH" \
         --install-location "/Library/Audio/Plug-Ins/Components" \
         "$STAGING_DIR/au.pkg"

echo "📦 4. Building Factory Samples component package..."
pkgbuild --root "$SAMPLES_PATH" \
         --identifier "com.mixxtech.vstgod.samples" \
         --version "1.0.0" \
         --install-location "/Library/Audio/Samples/VST GOD" \
         "$STAGING_DIR/samples.pkg"

echo "🔨 5. Compiling unified installer package..."
if [ -n "$DEV_INST_CERT" ]; then
    echo "  (Signing package with certificate: $DEV_INST_CERT)"
    productbuild --distribution Distribution.xml \
                 --resources ../installer-resources \
                 --package-path "$STAGING_DIR" \
                 --sign "$DEV_INST_CERT" \
                 "../build/VST_God_The_God_Realm_Installer.pkg"
else
    productbuild --distribution Distribution.xml \
                 --resources ../installer-resources \
                 --package-path "$STAGING_DIR" \
                 "../build/VST_God_The_God_Realm_Installer.pkg"
fi

echo "✅ Success! Installer built at: build/VST_God_The_God_Realm_Installer.pkg"
