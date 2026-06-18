# VST God — The God Realm v1.0.0
## Beta Tester Quick Start Guide

---

## System Requirements

| Requirement | Minimum |
|-------------|---------|
| **macOS** | 11.0 (Big Sur) or later |
| **Windows** | 10 (64-bit) or later |
| **DAW** | Any VST3/AU host (Logic Pro, Ableton Live, FL Studio, Reaper, etc.) |
| **RAM** | 8 GB (16 GB recommended for large sample libraries) |
| **Disk** | 500 MB for plugin + sample library |

---

## Installation

### macOS
1. Double-click `VST-God-The-God-Realm-v1.0.0.pkg`
2. Follow the installer wizard (Welcome → License → Install)
3. The installer places files in:
   - **AU**: `/Library/Audio/Plug-Ins/Components/`
   - **VST3**: `/Library/Audio/Plug-Ins/VST3/`
   - **Standalone**: `/Applications/`
4. Restart your DAW

### Windows
1. Run `VST-God-The-God-Realm-v1.0.0-Setup.exe`
2. Follow the Inno Setup wizard
3. Default install locations:
   - **VST3**: `C:\Program Files\Common Files\VST3\`
   - **Standalone**: `C:\Program Files\MixxTech\VST God\`
4. Restart your DAW

---

## First Launch & License Activation

### Step 1: Open the Plugin
- Insert **VST God - The God Realm** on any track in your DAW
- The first-run **Divine Setup Wizard** will appear

### Step 2: Locate Your Sample Library
- Click **Browse** and point to your sample library folder
- Default location: `~/Library/Audio/Samples/VST GOD/` (macOS)
- The plugin scans for `.wav` and `.aiff` files recursively

### Step 3: Activate Your License
- The **License Activation** modal will appear
- Enter your key in format: `VSTGOD-XXXX-XXXX-XXXX-XXXX`
- Click **Activate**
- You'll see the "REALM UNLOCKED" confirmation

> **Note**: Without activation, the plugin runs in **Demo Mode** — a periodic volume dip (~15% every 45 seconds) is applied as a watermark. All features remain accessible.

### Step 4: Your license is persistent
- Your key is saved to `~/Library/Application Support/MixxTech/VST God/config.json`
- It survives across DAW projects, plugin reloads, and restarts
- It re-validates online on each plugin load (with offline grace if no internet)

---

## Plugin Overview

| Tab | Feature |
|-----|---------|
| **Sampler** | 6-slot sample player with Layer, Round Robin, and Random modes |
| **Sequencer** | 8-track step sequencer with polymetric patterns, probability, micro-timing |
| **Preset Vault** | Browse, save, import/export presets |
| **Celestial Browser** | Browse sample library with waveform preview |
| **Multi-Realm** | Macro controls (Energy, Divinity, Width, Realm, Aura, Age) |
| **Celestial Forge** | Mastering chain (dynamics, heat, stereo, color) |
| **Relic Lab** | Sample deconstruction and re-synthesis |
| **Morph Matrix** | Modulation routing (2 LFOs, Aftertouch, Mod Wheel, Env 2) |
| **Electric Pantheon** | Polyphonic synthesizer with Vortex morphing |

---

## MIDI Controller Support (Arturia KeyLab)

Native CC mapping for Arturia KeyLab controllers:
- **Faders 1-6**: Slot volumes (Sampler) / ADSR (Pantheon) / Dynamics (Mastering)
- **Knobs 1-6**: Slot pans (Sampler) / Macros (Pantheon) / Effects (Mastering)
- **Knobs 7-9**: Global macros
- **Fader 9 (CC 85/7)**: Master volume

Mappings are context-aware — they change based on the active tab.

---

## Known Issues (Beta)

1. **Offline license**: If you stay offline indefinitely after initial activation, the license remains active without re-validation. This will be tightened in v1.1.
2. **Library path change**: After the first-run wizard, the sample library path can only be changed by editing the config file. A settings panel browse button is coming in v1.1.
3. **Large sessions**: With all 8 sequencer tracks active and complex patterns, CPU usage may spike. Freeze tracks if needed.
4. **Windows default paths**: The default sample library path shown in the wizard is macOS-formatted. Windows users should browse to their preferred location manually.

---

## Feedback & Bug Reports

Please include the following when reporting issues:
- **DAW name & version**
- **OS version**
- **Steps to reproduce**
- **Console/crash log** (if applicable)
- **Plugin version** (shown in the Morph Matrix tab)

---

*© 2026 MixxTech. VST God — The God Realm v1.0.0. All rights reserved.*
