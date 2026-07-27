# React View recording and production output

## Scope

DRMVYZ has two distinct output paths:

1. Browser recording and still capture of the visible React View canvas.
2. LaserDMX Production Output, which compiles normalized fixture frames for a virtual adapter and protocol-ready trusted-host adapters.

These paths must not be conflated. Recording captures pixels and optional program audio. Production Output compiles fixture-channel intent and applies fail-dark safety rules.

## Browser recording

### Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| Recorder hook | `src/hooks/useRecorder.ts` |
| React View recording panel | `src/components/vyzualz/react/ReactRecordingPanel.tsx` |
| Shared recording panel | `src/components/vyzualz/recording/RecordingPanel.tsx` |
| Stage ownership | `src/components/vyzualz/react/ReactView.tsx` |

### Canvas ownership

React View owns one recorder instance and records the active engine's published live canvas. Preview, thumbnail, editor-helper, and offscreen canvases must not replace the selected recording target.

Each engine surface must publish the canvas that corresponds to the visible stage. Engine changes must update the target without leaving a stale canvas reference.

### Video capture

`useRecorder` uses `HTMLCanvasElement.captureStream()` and `MediaRecorder`.

Supported choices are 30 or 60 FPS. Codec selection prefers supported WebM VP9 or VP8 variants and falls back to generic WebM.

When the shared program-audio stream exposes an audio track, recording mode is `video-audio`. Otherwise, recording continues as `video-only` and the UI must identify that fallback truthfully.

The recorder stops only capture tracks it created. It must never stop the shared application audio stream.

### Still and audio export

The recorder supports:

- PNG export from the active live canvas
- WAV export from the shared ring buffer for the requested duration

PNG fallback canvas discovery is a last resort. React View should pass the active canvas explicitly.

### Error and lifecycle rules

Recording must:

- Refuse duplicate starts
- Report unsupported `MediaRecorder` or capture failures
- Stop created tracks after completion or error
- Clear timers and recorder references on unmount
- Preserve the shared audio stream
- Avoid continuing a hidden recorder after the React View is destroyed

Browser recording availability depends on browser support. Chrome or Edge is the expected fallback recommendation when WebM recording is unavailable.

## LaserDMX Production Output

### Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| Output types, protocols, adapters, controller, and safety | `src/components/vyzualz/react/output/ProductionOutput.ts` |
| React control panel | `src/components/vyzualz/react/output/ProductionOutputPanel.tsx` |
| Normalized rig and fixture frames | `src/components/vyzualz/react/LaserDmxProductionRig.ts` |
| Architecture | `docs/laser-dmx-production-rig-architecture.md` |
| Output summary | `docs/laser-dmx-production-output.md` |

### Security model

The executable default is the in-process virtual adapter. It opens no network socket.

Art-Net and sACN entries are protocol descriptors in the renderer code. Physical UDP transmission requires a trusted Electron main-process or equivalent host bridge. Renderer UI must not open arbitrary network sockets or bypass the trusted-host boundary.

### Session and arming

Production Output distinguishes:

- Connected
- Armed
- Blackout
- Rehearsal
- Error or unavailable

Physical output is not enabled merely by choosing a protocol. A session must satisfy adapter availability, explicit physical-output enablement, network binding, validation, arming, and safety requirements.

### Safety contract

The output controller enforces bounded universe and channel mapping, profile and footprint validation, overlap detection, exclusion zones, stale-frame detection, heartbeat timeout, hardware master intensity, strobe limits, atmospheric cooldown rules, rehearsal restrictions, and fail-dark behavior.

Emergency blackout and fail-dark paths have priority over authored output. Stale or invalid frames must not remain latched on physical fixtures.

### Single normalized source

Virtual rendering and Production Output must compile from the same normalized rig and fixture-frame authority. The physical path must not reinterpret a visually similar but semantically different show.

## UI placement

Browser recording is available under **OUTPUT → RECORDING** for React engines.

LaserDMX additionally exposes **OUTPUT → PRODUCTION**. Other engines must not display physical fixture-output controls unless they adopt the normalized rig and safety architecture.

## Verification

Recording changes require unit coverage for MIME selection, combined-stream construction, track cleanup, errors, and active-canvas ownership.

Production Output changes require controller, mapping, stale-frame, heartbeat, blackout, fixture-profile, network-boundary, and safety validation. Physical transmission must never be claimed as complete based solely on the renderer-side protocol descriptors.
