# DRMVYZ v2.0 — DVYDRM Signal System

A screen-recordable, modular audio visualization dashboard for DVYDRM track teasers.
MiniMeters-inspired feature set in a DVYDRM neon cyan/green dark dashboard theme.

## AI Implementation Rule

Before making code changes, read `AI_IMPLEMENTATION_CONTRACT.md` and follow its layout, styling, component, media, preset, and rendering rules.

## Quick Start

```bash
npm ci
npm run dev
# or double-click launch.command
```

Open [http://localhost:5173](http://localhost:5173)

For the complete locked-install, unit, production-build, Chromium smoke, and audit workflow, see [`docs/verification.md`](docs/verification.md).

---

## Audio Sources

| Source | How it works |
|--------|-------------|
| **File** | Upload MP3, WAV, AIFF, M4A, OGG, FLAC via drag-drop or "Add Track" |
| **Microphone** | Uses `getUserMedia` — browser will prompt for permission |
| **Demo** | Synthetic oscillators feeding the analysers — no audio output |

> **Browser limitation:** System audio (e.g., Spotify, system sounds) cannot be captured via Web Audio API without OS-level virtual routing (e.g., BlackHole on macOS, VB-Cable on Windows) or using OBS for screen+audio recording.

---

## Modules

All modules are **audio-reactive** and show idle animations when no source is active.

| Module | Description |
|--------|-------------|
| **Spectrum** | FFT analyzer — bars / line / filled / smooth curve modes |
| **Spectrogram** | Scrolling time-frequency display with 6 color maps |
| **Waveform** | Time-domain waveform — centered or scrolling mode |
| **Vectorscope** | Stereo Lissajous figure (L=X, R=Y) |
| **Oscilloscope** | Time-domain signal — L, R, Mid, or Side channel |
| **Loudness** | Approx. LUFS: Momentary (M), Short-term (S), Integrated (I) |
| **L/R Meters** | Per-channel RMS level with peak hold |
| **Mid/Side** | Mid=(L+R)/√2 and Side=(L−R)/√2 meters + width indicator |
| **Phase Correlation** | Pearson correlation between L/R (-1 to +1) |
| **Band Meters** | Bass (<250 Hz), Mid (250–4 kHz), High (>4 kHz) energy |
| **Level** | Configurable: RMS / Peak / True Peak (approx) / VU (needle or bar) |

> **LUFS note:** The loudness meter uses a simplified K-weighted RMS approximation. It is NOT ITU-R BS.1770-4 compliant and should not be used for broadcast loudness compliance.

> **True Peak note:** The true peak meter uses 4× linear interpolation. It is not a full ITU-R BS.1770 true peak implementation. Labeled "approx." in the UI.

---

## Module System

- **Enable/Disable:** Click **⊞ Modules** in the top bar → toggle checkboxes
- **Reorder:** Use ↑↓ arrows in the Module panel, or drag module headers in edit mode
- **Resize:** Width (S/M/L/XL) and Height (C/N/T) buttons appear in each module header when edit mode is on

---

## Layout Presets

| Preset | Description |
|--------|-------------|
| Dashboard | Multi-column with sidebar |
| 16:9 | Landscape optimized |
| Quad | 2-column equal grid |
| Stack | All modules full-width |
| 1:1 | Square social format |
| 9:16 | Vertical TikTok/Reels format |

---

## Settings

- **Themes:** Cyan/Green · Cyan/Blue · Green/Gold · Purple/Cyan
- **Color maps** (per module): Cyan-Green · Fire · Ice · Mono · Rainbow · Plasma
- Glow intensity, scanlines, grid, logo, module borders, transparent background
- Font density (compact / normal / large)
- FFT size (512–8192), smoothing, sensitivity, peak hold + decay speed
- Display name override for the now-playing title

---

## Presets

Visual presets save the full state: theme, all module settings, layout, and color maps.

- Click **⊙ Presets** → type a name → Save
- Load, delete, or export to JSON from the same panel
- Import JSON preset files from other devices

---

## Recording & Export

### Screen Recording (recommended)
1. Select a layout preset matching your target platform
2. Click **◉ REC MODE** to hide all UI chrome
3. Use OBS, QuickTime, or any screen recorder to capture the window
4. Click **EXIT REC** to return to editing mode

### PNG Export
Click **● Record** → **Export frame as PNG** — captures the largest canvas.

### WAV Export (ring buffer)
A 60-second audio ring buffer continuously captures your audio at native sample rate.
- Works with File and Microphone sources
- Click **● Record** → **Export last 10s / 30s / 60s WAV**

### Live Audio Recording
Records the active microphone stream as `.webm` audio.
Requires the Microphone source to be active.

> **Video export:** Not currently supported in-browser. Use OBS or screen recording software to capture visualizer clips.

---

## Tech Stack

React 18 · Vite 6 · TypeScript · Web Audio API · Canvas 2D API

No backend · No paid APIs · No external audio processing libraries

---

## Browser Compatibility

Tested in Chrome 120+ and Safari 17+. Firefox works but AudioWorklet/ScriptProcessor behavior may differ slightly. All core features work in any modern browser that supports Web Audio API.
