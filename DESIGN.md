# OrbitWatch Design System & Specs

This document serves as the absolute "Source of Truth" for the OrbitWatch design implementation. The visual style is a **futuristic, high-density, data-dense Heads-Up Display (HUD)** combining **Glassmorphism** and a **Minimalist Technical** theme.

---

## 🎨 Color Palette & Tokens

| Token Name | CSS Variable | Hex Code | Purpose / Usage |
| :--- | :--- | :--- | :--- |
| **Base Background** | `--bg-space` | `#060d1a` | Deep space navy base background for high contrast |
| **Primary Accent** | `--accent-primary` | `#00d4ff` | Electric blue / cyan for active states, data highlights, safe paths |
| **Warning Accent** | `--accent-warning` | `#ffa500` | Orange for proximity alerts, medium risks |
| **Danger Accent** | `--accent-danger` | `#ff4b2b` | Red for high-intensity warning, critical items |
| **Success Accent** | `--accent-success` | `#34d399` | Green for low risk, stable objects |
| **Secondary Accent**| `--accent-secondary`| `#060d1a` | Darkest accents, panels |
| **Border Glow** | `--border-glow` | `#00d4ff` | Primary glowing border color |
| **Neutral Border** | `--border-neutral`| `#3c494e` | Outlines for inactive or secondary panels |
| **Text Primary** | `--text-primary` | `#d4e4fa` | High legibility text |
| **Text Secondary** | `--text-secondary`| `#859398` | Muted descriptions and labels |
| **Text Muted** | `--text-muted` | `#64748b` | Gray for deactivated/stable debris points |

---

## 🔤 Typography & Fonts

- **UI Font (Structural):** `Inter` or standard system sans-serif (`Geist` preferred if available).
  - Used for navigation, headers, tables, general text.
  - Ensures clean legibility during long monitoring shifts.
- **Telemetry Font (Coordinates & Numbers):** `Courier New` or `JetBrains Mono`.
  - Used for all coordinates, NORAD IDs, percentages, numeric tables, clocks.
  - Monospace prevents layout "jitter" during live telemetry updates.

### Typography Scale

- **Display Large (`display-lg`):** `48px`, Semi-bold (used for giant titles).
- **Headline Medium (`headline-md`):** `24px`, Semi-bold (used for page and section headers).
- **Body Base (`body-base`):** `14px`, Regular (used for standard body text).
- **Telemetry Medium (`data-mono-lg`):** `18px`, Medium, Monospace (used for prominent telemetry).
- **Telemetry Small (`data-mono-sm`):** `12px`, Monospace, letter-spacing `0.05em` (used for data tables/badges).
- **Caps Label (`label-caps`):** `10px`, Bold, Monospace, uppercase, letter-spacing `0.1em` (used for small headers and badges).

---

## 📐 Layout & Spacing Grid

- **Visible Grid:** A subtle `32px` square grid pattern visible in the background to provide a technical structure and scale.
- **Rhythm Philosophy:** Strict **4px base unit** (`unit = 4px`).
- **Gutters & Spacing:**
  - Standard panel padding: `16px` (`4 * unit`)
  - Desktop margins: `24px`
  - Mobile margins: `12px`
- **Sidebar Width:** Fixed at `60px` for icon navigation, providing maximum screen real estate for the Cesium 3D Globe and data grids.

---

## 🔮 Glassmorphism & Elevation Tiers

Depth is established via transparency and outlines rather than drop shadows:
1. **Background Blurs:** `backdrop-filter: blur(12px)` to `blur(20px)` on all panels.
2. **Surface Overlay:** Background colors use semi-transparent overlays (e.g. `rgba(6, 13, 26, 0.6)` or `rgba(18, 33, 49, 0.7)`).
3. **Interactive Borders:** Focus or hover states glow with `box-shadow: 0 0 10px rgba(0, 212, 255, 0.4)`.
4. **Z-Index Tiers:**
   - Base Globe / Background: `0`
   - Data Panels: `10`
   - Fixed Sidebar & Header: `20`
   - Critical Warning Modals / Overlays: `30`

---

## 🦾 Shape Language & Accents

- **Strict Corner Philosophy:** **Sharp 90-degree corners (`border-radius: 0px`)** across all buttons, cards, list items, and input elements. No rounded corners!
- **Dog-Ear Clipped Corners:** Top-right corners of major panels may have a decorative 45-degree clip (`clip-path`) to evoke engineering schematics.
- **Decorations:** Use `+` crosshairs in panel corners or subtle bracket graphics (`[` and `]`) to frame telemetry.

---

## 🧩 Key Interactive Components & States

### 1. Header Bar
- **Logo:** `OrbitWatch` in `display-lg` scale but smaller, accompanied by a satellite emoji 🛰️.
- **Clock:** Active live-updating UTC and Local clock in `data-mono-sm`.
- **System Dot:** Pulsing green indicator showing active database/backend connection status.

### 2. Left Navigation Sidebar
- Fixed 60px wide sidebar.
- Ghost icons with 1px border. Hovering changes border to `var(--accent-primary)` and adds a subtle glow.

### 3. Ghost Buttons
- Outlined buttons with a 1px border (`border: 1px solid var(--accent-primary)`).
- **Hover State:** Background fills with a 10% opacity cyan glow (`rgba(0, 212, 255, 0.1)`) and applies a sharp text-shadow.

### 4. Alert Cards & Feed
- **Critical Badges:** Blinking animations with red background, red left border, and pulsing red text.
- **High Alert Borders:** Bright orange left border with warning glow.
- **Fade-In Transition:** Alert items fade in smoothly on update.

### 5. Status Badges
- **CRITICAL:** Glowing red `#ff4b2b`, blinking text, Courier/JetBrains font.
- **HIGH:** Orange `#ffa500`.
- **MEDIUM:** Yellow/Amber `#fbbf24`.
- **LOW:** Green `#34d399`.

---

## 🖥️ Screen Layout Mockups (Stitch Reference)

### A. Dashboard (/dashboard)
1. **Stats Bar (Top):** Horizontal layout. 4 cards: Total Objects, Total Debris, Active Satellites, Critical Events. Each has an animated count-up.
2. **observation Panel (Center):** 3D Cesium globe displaying orbits.
   - Debris: Red `#f87171` dots
   - Satellites: Cyan/Blue `#00d4ff` dots
   - Rocket Bodies: Slate/Gray `#64748b` dots
3. **Live Alert Feed (Right):** List of 50 active warnings with dynamic age calculation (e.g. "3s ago").
4. **Altitude Histogram (Bottom):** Recharts bar chart showing objects stacked by orbital shell, color-coded.

### B. Cascade Simulation (/cascade)
1. **Object Selector:** Double searchable search box to select collision candidates.
2. **Trigger:** Massive "SIMULATE COLLISION" button with heavy red glow.
3. **Simulation Canvas:** Interactive node tree tracing debris generation cascading outward.

### C. Conjunctions Risk Log (/conjunctions)
1. **Filter Header:** Quick toggle buttons (ALL / LOW / MEDIUM / HIGH / CRITICAL).
2. **Dense Telemetry Table:** Columns for object pairings, miss distance, probability, and relative velocity.

### D. Polluter Leaderboard (/leaderboard)
1. **Theme:** Debris rank with skull emoji 💀.
2. **Medal Rows:** Gold, silver, bronze indicators for the top three polluters.
