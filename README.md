# 🔱 VST God — The God Realm

> v1.0.0 | A divine audio production plugin by **MixxTech**

VST God is a full-featured sampler, step sequencer, synthesizer, and mastering suite built with JUCE (C++ DSP backend) and React (WebView UI frontend).

---

## 📋 Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start — macOS](#quick-start--macos)
- [Quick Start — Windows](#quick-start--windows)
- [Building the Installer](#building-the-installer)
- [Project Structure](#project-structure)
- [License & Activation](#license--activation)
- [Troubleshooting](#troubleshooting)

---

## Architecture

```
┌─────────────────────────────────────────┐
│           JUCE C++ Host (DSP)           │
│  PluginProcessor.cpp + PluginEditor.cpp │
│  Sampler · Sequencer · Pantheon Synth   │
│  License · State · MIDI · Modulation    │
├─────────────────────────────────────────┤
│        WebView Bridge (JSON IPC)        │
├─────────────────────────────────────────┤
│         React + Vite Frontend           │
│  UI Components · Preset Vault · Forge   │
│  3D Visualizers · Settings · Browser    │
└─────────────────────────────────────────┘
```

The frontend is compiled by Vite into `dist/`, which is embedded as JUCE BinaryData at C++ compile time.

---

## Prerequisites

### All Platforms
- **Node.js** 18+ and **npm** 9+ → [https://nodejs.org](https://nodejs.org)
- **CMake** 3.24+ → [https://cmake.org/download](https://cmake.org/download)
- **Git** → [https://git-scm.com](https://git-scm.com)

### macOS Only
- **Xcode** 14+ (with Command Line Tools)
  ```bash
  xcode-select --install
  ```

### Windows Only
- **Visual Studio 2022** (Community edition is free)
  - Download: [https://visualstudio.microsoft.com/downloads/](https://visualstudio.microsoft.com/downloads/)
  - During install, select the **"Desktop development with C++"** workload
  - This installs MSVC compiler, Windows SDK, and CMake integration
- **Inno Setup 6** (for building the `.exe` installer)
  - Download: [https://jrsoftware.org/isdl.php](https://jrsoftware.org/isdl.php)
  - Install with defaults — the `ISCC.exe` compiler will be at `C:\Program Files (x86)\Inno Setup 6\ISCC.exe`

---

## Quick Start — macOS

```bash
# 1. Clone the repo
git clone https://github.com/mixclubonline-del/god-console-vst.git
cd god-console-vst

# 2. Install frontend dependencies
npm install

# 3. Build frontend (React → dist/)
npm run build

# 4. Configure & build C++ plugin
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --parallel 4

# 5. OR use the all-in-one script:
chmod +x scripts/build-production.sh
./scripts/build-production.sh
```

**Build output location:**
```
build/VSTGodTheGodRealm_artefacts/Release/
├── AU/         → VST God - The God Realm.component
├── VST3/       → VST God - The God Realm.vst3
└── Standalone/ → VST God - The God Realm.app
```

---

## Quick Start — Windows

> ⚠️ **IMPORTANT**: You MUST run these commands from the **"Developer Command Prompt for VS 2022"** or **"x64 Native Tools Command Prompt for VS 2022"** (NOT regular cmd.exe or PowerShell). This ensures the MSVC compiler is on your PATH.

### Step-by-Step

```batch
:: 1. Clone the repo
git clone https://github.com/mixclubonline-del/god-console-vst.git
cd god-console-vst

:: 2. Install frontend dependencies
npm install

:: 3. Build frontend (React → dist/)
npm run build

:: 4. Configure CMake (generates Visual Studio solution)
cmake -B build -DCMAKE_BUILD_TYPE=Release

:: 5. Build the C++ plugin
cmake --build build --config Release --parallel 4

:: OR use the all-in-one script:
scripts\build-windows.bat
```

### What Each Step Does

| Step | What It Does | Time |
|------|-------------|------|
| `npm install` | Installs React, Three.js, Vite, TypeScript, etc. | ~30 sec |
| `npm run build` | Compiles the React UI into `dist/` (embedded in plugin) | ~15 sec |
| `cmake -B build` | Downloads JUCE 8.0.6, configures build system | ~60 sec (first time) |
| `cmake --build` | Compiles all C++ source into VST3 + Standalone binaries | ~3-5 min |

### Build Output Location (Windows)
```
build\VSTGodTheGodRealm_artefacts\Release\
├── VST3\       → VST God - The God Realm.vst3
└── Standalone\ → VST God - The God Realm.exe
```

### Building the Windows Installer (.exe)

After a successful build:

```batch
:: Option A: Use Inno Setup GUI
:: Open scripts\installer.iss in Inno Setup → click Build → Compile

:: Option B: Command line (if ISCC.exe is on your PATH)
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" scripts\installer.iss
```

**Installer output:** `build\VST_God_The_God_Realm_Installer.exe`

The installer packages:
- ✅ Standalone `.exe` → `C:\Program Files\MixxTech\VST God\`
- ✅ VST3 plugin → `C:\Program Files\Common Files\VST3\`
- ✅ Factory sample library → User-selected folder (default: `C:\ProgramData\MixxTech\VST God\Samples\`)
- ✅ Desktop shortcut (optional)
- ✅ Start menu entry

---

## Building the Installer

### macOS (.pkg)
```bash
# Requires a successful build first
chmod +x scripts/create-pkg.sh
./scripts/create-pkg.sh

# Optional: code sign with Developer ID certificates
DEV_APP_CERT="Developer ID Application: Your Name" \
DEV_INST_CERT="Developer ID Installer: Your Name" \
./scripts/create-pkg.sh
```
**Output:** `build/VST_God_The_God_Realm_Installer.pkg`

### Windows (.exe)
```batch
"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" scripts\installer.iss
```
**Output:** `build\VST_God_The_God_Realm_Installer.exe`

---

## Project Structure

```
├── Source/                     # C++ JUCE plugin source
│   ├── PluginProcessor.cpp     # DSP, MIDI, sequencer, license, state
│   ├── PluginProcessor.h       # Structs: Track, Step, Slice, MidiCCEvent
│   ├── PluginEditor.cpp        # WebView host + JSON bridge
│   ├── PantheonSynth.h         # Polyphonic synthesizer engine
│   └── SacredSampler.h         # Multi-slot sampler with voice stealing
│
├── src/                        # React/TypeScript frontend
│   ├── components/             # UI components (sequencer, forge, dais, etc.)
│   ├── native/bridge.ts        # JUCE ↔ WebView communication bridge
│   ├── services/supabase.ts    # Cloud backend (presets, license, sync)
│   └── styles/                 # CSS modules
│
├── dist/                       # Vite build output (embedded as BinaryData)
│   └── fonts/                  # Bundled Inter + JetBrains Mono fonts
│
├── public/                     # Static assets (copied to dist/ on build)
│   ├── fonts/                  # Font source files
│   ├── kits/                   # Factory sample kits
│   ├── images/                 # UI images and textures
│   └── midi/                   # Factory MIDI patterns
│
├── scripts/
│   ├── build-production.sh     # macOS full build pipeline
│   ├── build-windows.bat       # Windows full build pipeline
│   ├── create-pkg.sh           # macOS .pkg installer builder
│   ├── installer.iss           # Windows Inno Setup installer script
│   └── Distribution.xml        # macOS pkg distribution descriptor
│
├── installer-resources/        # macOS installer branding (welcome, EULA, etc.)
├── docs/                       # Documentation
│   └── QUICK_START.md          # Beta tester quick start guide
│
├── CMakeLists.txt              # C++ build configuration (JUCE 8.0.6)
├── package.json                # Frontend dependencies and scripts
├── vite.config.ts              # Vite build configuration
└── index.html                  # Frontend entry point
```

---

## License & Activation

The plugin uses a server-validated license system:
- License keys are format `VSTGOD-XXXX-XXXX-XXXX-XXXX`
- Keys are validated via Supabase Edge Function
- Activated keys persist to `config.json` (per-machine, not per-project)
- Offline grace: keeps active session if network is unavailable
- **Demo mode**: Without a license, a periodic volume dip watermark is applied (every 45 seconds)

Generate and manage license keys via the **God Console** admin portal.

---

## Troubleshooting

### Windows: "CMake Error: No CMAKE_CXX_COMPILER could be found"
→ You're not in the Visual Studio Developer Command Prompt. Open **"x64 Native Tools Command Prompt for VS 2022"** from the Start Menu and try again.

### Windows: "npm is not recognized"
→ Node.js is not installed or not on your PATH. Download from [nodejs.org](https://nodejs.org) and restart your terminal.

### macOS: "xcrun: error: invalid active developer path"
→ Run `xcode-select --install` to install Command Line Tools.

### Build takes very long the first time
→ Normal! CMake downloads JUCE 8.0.6 (~50MB) on first configure. Subsequent builds are incremental and much faster.

### Plugin doesn't appear in DAW
→ Check the output paths above. For VST3, the plugin needs to be in:
- macOS: `/Library/Audio/Plug-Ins/VST3/`
- Windows: `C:\Program Files\Common Files\VST3\`

Copy the built `.vst3` bundle there manually, or run the installer.

---

## Development

```bash
# Run the React UI in dev mode (hot reload, port 3005)
npm run dev

# Validate the Divine Archive manifest
npm run validate:archive
```

---

*© 2026 MixxTech. All rights reserved.*
