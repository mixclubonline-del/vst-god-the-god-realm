@echo off
echo 🌌 Starting VST GOD Windows Build Pipeline...

cd %~dp0\..

echo 📦 1. Compiling React WebUI (Vite Production Build)...
call npm run build

echo ⚙️ 2. Configuring CMake for Release Build...
cmake -B build -DCMAKE_BUILD_TYPE=Release

echo 🛠️ 3. Building JUCE plugin binaries...
cmake --build build --config Release --parallel 4

echo ✅ WebUI and plugin binaries successfully built!
