# DRMVYZ

DRMVYZ is a desktop-first VJ and audio-reactive visualization system for DVYDRM. It combines a six-engine live performance workspace, track-aware choreography, media and brand libraries, lyric tooling, recording, and a classic modular audio-visualizer workspace.

The default performance workspace is **React View**. The older modular **Visualizer** remains available for analyzer-style layouts and social-format capture.

## Implementation contract

Before changing the application, read:

- [`AI_IMPLEMENTATION_CONTRACT.md`](AI_IMPLEMENTATION_CONTRACT.md)
- [`docs/documentation-index.md`](docs/documentation-index.md)
- [`docs/react-view-architecture.md`](docs/react-view-architecture.md)

Historical patch records are useful evidence, but they are not automatically current architecture.

## Application workspaces

| Workspace | Purpose |
| --- | --- |
| **React** | Main VJ workspace with six visual engines, Track Map, performance controls, recording, and production output |
| **Visualizer** | Classic modular spectrum, waveform, meter, and social-layout workspace |
| **Media Manager** | Shared image, SVG, video, audio, and Brand Kit asset management |
| **Lyric Manager** | Lyric extraction, timing, cue styling, editing, and preview |

## React View engines

The selectable engine registry is `src/components/vyzualz/react/reactEngineCatalog.ts`.

| Engine | Role |
| --- | --- |
| **Shader Pads** | Authored WebGL shader scenes with native performance programs and modulation |
| **Cinematic Worlds** | Directed immersive worlds with camera, atmosphere, post-processing, and audio intelligence |
| **Sound Drawing** | Waveform, text, font, SVG, glyph, and Living Ribbon drawing |
| **CANVAS** | User media compositions, transitions, effect recipes, and authored full-song shows |
| **LaserDMX** | Virtual fixture rigs, Beam Matrix compatibility, Show Director, cues, and production-output preparation |
| **PixGrid** | Programmable LED-cell artwork, media conversion, smart groups, routing, and full-song pixel choreography |

React View is organized into an engine-aware left rail, a live center stage, a role-based right rail, a lower Track Map/Performance Pads workspace, and a shared audio dock. See [`docs/react-view-architecture.md`](docs/react-view-architecture.md).

## Quick start

### Requirements

- Node.js `>=22.12 <23`
- npm with the committed `package-lock.json`
- A modern Chromium or WebKit browser for browser development
- Electron for native desktop features

Use the Node version declared by `package.json` and `.nvmrc`.

### Desktop app

```bash
npm ci
npm run electron:dev
```

On macOS, `launch.command` starts the same development workflow.

The Electron shell enables native Rekordbox USB scanning, including `export.pdb` and `PIONEER/USBANLZ` cue and beat-grid metadata.

### Browser development

```bash
npm ci
npm run dev
```

Open `http://localhost:5173`.

The browser build supports the main visual workspaces. Native Rekordbox USB database scanning is unavailable in browser-only mode; use Rekordbox XML for cue hydration.

### Desktop packages

```bash
npm run desktop:pack
npm run desktop:dist:mac
npm run desktop:dist:win
npm run desktop:dist:linux
```

Desktop artifacts are written to `release/`. Production distribution should add platform signing and notarization. Cross-platform installers are normally built on their target operating system.

## Audio sources

| Source | Behavior |
| --- | --- |
| **File** | Loads supported audio files into the shared audio engine and offline-analysis pipeline |
| **Microphone** | Uses `getUserMedia`; the browser or desktop shell requests permission |
| **Demo** | Uses synthetic analysis input for development without normal program audio output |

System audio from another application still requires operating-system routing such as BlackHole on macOS or VB-Cable on Windows, or capture through OBS.

## Music Intelligence and performance timing

DRMVYZ uses one shared analysis and timing authority:

1. The audio engine and loaded-track analysis publish Music Intelligence data.
2. Shared Performance Core resolves authoritative beat, bar, phrase, section, occurrence, confidence, and transport state.
3. Engine-specific performance programs interpret that context.
4. Renderers consume engine-normalized state without creating competing beat grids or section detectors.

See:

- [`docs/music-intelligence.md`](docs/music-intelligence.md)
- [`docs/loaded-audio-analysis.md`](docs/loaded-audio-analysis.md)
- [`docs/shared-performance-core.md`](docs/shared-performance-core.md)

## Recording and production output

React View records the active output canvas through `HTMLCanvasElement.captureStream()` and `MediaRecorder`.

- Video export is WebM.
- Recording can use 30 or 60 FPS.
- The active program-audio track is added when available.
- Recording falls back to video-only when no program-audio stream is available.
- PNG frame export uses the same active output canvas.
- Recorder state lives at React View level so an active recording survives right-panel tab changes.

LaserDMX also exposes a Production Output surface. Virtual Output is the executable default. Art-Net and sACN are protocol-ready descriptors, but physical transmission requires a trusted host boundary and explicit safety work.

See [`docs/react-recording-and-output.md`](docs/react-recording-and-output.md).

## Media and Brand Kit

React View engines use the shared Media Library rather than engine-specific upload silos. Media capability filters decide whether an item can be selected by Sound Drawing, CANVAS, PixGrid, or another surface.

Brand Kit supplies persisted palettes, assets, effective engine palettes, branded preset resolution, and optional stage overlays. See [`docs/brand-kit.md`](docs/brand-kit.md).

Sound Drawing control ownership, Pro Scope Trace Size and linked-axis semantics, preset provenance, and versioned trail-lock compatibility are documented in [`docs/sound-drawing-control-ownership-and-provenance.md`](docs/sound-drawing-control-ownership-and-provenance.md).

## Classic Visualizer

The Visualizer workspace retains the modular analyzer system:

- Spectrum, spectrogram, waveform, vectorscope, and oscilloscope
- Loudness, L/R, Mid/Side, phase correlation, band, level, and related meters
- Reorderable and resizable modules
- Dashboard, landscape, quad, stack, square, and vertical layouts
- Themes, color maps, display density, FFT, smoothing, sensitivity, and peak settings
- Preset import/export and screen-recording layouts

The LUFS and true-peak displays are approximate visual tools, not broadcast-compliance meters.

## Verification

Use the scripts as the command authority:

```bash
npm run verify:fast
npm run verify
npm run verify:clean
```

The full workflow, Node baseline, CI behavior, specialized engine verification, and source packaging are documented in [`docs/verification.md`](docs/verification.md).

## Source packaging

Do not zip a working directory containing `node_modules`, `dist`, coverage, logs, or browser output.

```bash
npm run package:source
```

See [`docs/source-packaging.md`](docs/source-packaging.md).

## Technology

- React 18, TypeScript, Vite 6, Zustand
- Electron desktop shell
- Web Audio API, Canvas 2D, WebGL2
- Meyda, Essentia.js, Pitchy, Tonal, and web-audio-beat-detector
- Supabase database, storage, and Edge Functions
- Groq Whisper for new server-side lyric transcription jobs
- Playwright, Vitest, ESLint, and Node native tests

## Current architecture documentation

Start with [`docs/documentation-index.md`](docs/documentation-index.md). It separates canonical current documentation from historical patch and acceptance records.

_Last touched: a lava lamp is basically a slow-motion GPU fluid sim._
