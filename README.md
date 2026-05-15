# DRMVYZ — DVYDRM Signal System

A screen-recordable music visualizer dashboard for DVYDRM track teasers.
Dark sci-fi HUD aesthetic with real-time audio-reactive visuals.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Audio upload** — drag & drop or click "Add Track" (MP3, WAV, AIFF, M4A)
- **Playback** — play/pause/stop, previous/next, seek bar, volume slider
- **Spectrum analyzer** — real-time FFT bars with peak hold
- **L/R level meters** — per-channel RMS with peak hold segments
- **Waveform overview** — time-domain waveform with playhead
- **Output scope** — stereo Lissajous figure (L on X, R on Y)
- **Recording Mode** — hides UI chrome, adds pulsing REC indicator
- **Layout presets** — 16:9 / 9:16 / 1:1 for social recording
- **Settings panel** — display name override, accent intensity, scanlines, glow, grid, logo, 4 themes

## Screen Recording

1. Select a layout preset matching your target platform
2. Click **● REC MODE** to hide all file controls
3. Use OBS, QuickTime, or any screen recorder to capture the window
4. Click **EXIT REC** to return to editing mode

## Themes

| Name | Colors |
|------|--------|
| Cyan / Green (default) | #00e5ff / #00ff88 |
| Cyan / Blue | #00e5ff / #448aff |
| Green / Gold | #00ff88 / #ffcc00 |
| Purple / Cyan | #bb86fc / #00e5ff |

## Tech Stack

React 18 + Vite + TypeScript, Web Audio API, Canvas 2D, no backend.
