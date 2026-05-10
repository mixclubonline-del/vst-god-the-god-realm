# Design System: Midnight Ember (Celestial Forge)

## 1. Overview & Creative North Star
**Creative North Star: The Celestial Forge**
This design system is inspired by the raw power of solar energy and ancient alchemy. It visualizes a "God Realm" where sound is forged within a massive solar kiln. The aesthetic is heavy, tactile, and highly interactive, using "Midnight Ember" (deep obsidian and glowing plasma) as its core visual language.

## 2. Colors & Surface Logic
The palette focuses on extreme contrast between cold, dark stone and intense, burning heat.

### Core Palette
- **Obsidian (Background):** `hsl(0, 0%, 4%)` (#0a0a0a). Deep, dark base with subtle stone textures.
- **Solar Flare (Primary Glow):** `hsl(25, 100%, 50%)` (#ff6600). Used for active states, indicators, and primary visualizers.
- **Ember (Secondary Glow):** `hsl(15, 100%, 40%)` (#cc3300). Used for "hot" saturation and drive states.
- **Celestial Gold (Accents):** `hsl(40, 80%, 45%)` (#c29623). Used for labels, readouts, and "premium" markers.
- **Ether (UI Borders):** `rgba(255, 255, 255, 0.05)`. Subtle edges that define regions without boxing them.

### Surface Hierarchy
1.  **The Forge (Background):** `surface_dim`. Deep obsidian stone.
2.  **Etched Glass (Panels):** `surface_container`. Dark glass with `20px` backdrop-blur and a subtle stone-etched border.
3.  **Molten Core (Indicators):** `primary_container`. Intense radial glows that pulse with audio.

## 3. Typography
- **Inter (Labels & Navigation):** Bold, uppercase, widely spaced (`0.15em`) to feel like industrial engraving.
- **JetBrains Mono (Data):** For all numerical readouts (Gain, dB, Hz). Ensures precision and a "high-tech" instrument feel.

## 4. Components

### God-Knob v2 (Signature Control)
- **Visual:** A large, thick glass dial with a brushed metal center.
- **Internal Glow:** An orange "ember" glow at the base of the knob that intensifies with the value.
- **Value Ring:** A thin, high-precision SVG arc around the knob that tracks the parameter value.

### Sun Disk (Master Meter)
- **Visual:** A massive, multi-layered circular visualizer.
- **Outer Corona:** A pulsing, fractal-like solar flare that reacts to peak levels.
- **Inner Arcs:** High-speed Peak and RMS indicators.
- **Active Gem:** A central faceted stone that glows when the limiter/saturation is active.

### Aether Saturation Grid
- **Visual:** A dark, etched grid containing "laser" transfer curves.
- **Interaction:** The curves bend and glow as 'Drive' and 'Bias' parameters are adjusted.

## 5. Animations
- **Solar Pulse:** Background glows should have a subtle, slow "breath" at idle, and a fast "impact" on transients.
- **Molten Flow:** Transitioning between tabs or modules should feel like liquid metal shifting across the interface.
