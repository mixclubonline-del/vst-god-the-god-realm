#!/bin/bash
set -e

# VST GOD Production Build Pipeline
echo "🌌 Starting VST GOD Production Build Pipeline..."

# Move to script parent directory to be safe
cd "$(dirname "$0")/.."

echo "📦 1. Compiling React WebUI (Vite Production Build)..."
npm run build

echo "⚙️ 2. Configuring CMake for Release Build (excl. WAV samples from BinaryData)..."
cmake -B build -DCMAKE_BUILD_TYPE=Release

echo "🛠️ 3. Building JUCE plugin binaries..."
cmake --build build --config Release --parallel 4

echo "✅ WebUI and plugin binaries successfully built!"
