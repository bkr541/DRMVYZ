# Performance issues: analysis and recommendations

Date: November 9, 2026

This document covers the four performance issues discussed after the venue test. The analysis and recommendations below record the original review; the implementation status describes the subsequent performance changes. The earlier transient canvas-copy recovery patch addresses a separate casting failure path.

## Implementation status

Implemented the following internal changes without modifying preset definitions, parameter schemas or stored values, audio-analysis algorithms, or performance-pad actions:

- **Casting:** source copies are gated to 60 FPS for WebRTC and 30 FPS for Google Cast. The stable relay, capture stream, and connection remain in place. Cinema marks replacement output pending until its first rendered frame, so casting skips setup clears and retains the previous relay frame during that handoff. Explicit unavailable output still follows the existing failure path.
- **Auto quality:** Cinema combines its CPU rolling average, frame pacing, and recent valid GPU timings. Auto reserves modest casting headroom; explicit Performance/Balanced/Quality choices retain their existing policies. Pause, suspension, first-frame discontinuities, and context loss reset adaptation windows. CPU telemetry remains available independently of adaptation.
- **Activation and buffers:** a 64-entry LRU caches deeply immutable Cinema compilation results by preset and capability set, including capability revalidation on a cache miss. Each activation retains fresh parameter, media, audio, and runtime ownership. Canvas reuses its composition surface across effect restarts, applies the shared UHD/edge budget while retaining the previous 2× DPR ceiling, and shrinks unused effect scratch storage to 1×1. No mutable GPU-runtime pooling or retained background engine was introduced.
- **Diagnostics:** lifecycle/activation/first-frame/quality/cast/context events are persisted. Frame summaries are emitted every ten seconds using fixed sample storage; cast summaries are rate limited. Passive renderer exception/rejection capture is burst limited and redacts URLs and credentials. Electron retains at most 16 recent performance records (8 KiB each) and includes them with GPU-process failure context.

Validation: 100 focused unit/integration tests passed across the affected suites, including all-six-engine pad actions, shared analyser behavior, repeated Cinema activation, parameter restoration, and Canvas media/Display continuity. TypeScript passed. Focused ESLint checks passed with one existing unrelated `recorder` dependency warning in ReactView. All 17 native diagnostics/preload tests passed. Three filesystem-watcher tests initially encountered sandbox `EMFILE` restrictions; those three passed when run with normal host permissions. Watcher implementation was not changed.

Real-browser evidence: 15 short 960×540 samples on the Apple M3 Pro measured approximately 60 relay copies/second for WebRTC and 30 for Google Cast, with preview scheduling near 120 FPS. Persistent parameter snapshots were unchanged during casting. A focused final check restored a real WebGL context, then switched Blockshift to Mainframe while keeping the same WebRTC peer and capture stream; rendering resumed and no pending replacement frame was copied. This simulated context loss, not a native GPU-process crash.

Limitations: no exhaustive preset/venue hardware matrix or sustained real-network soak was completed. The driver-level GPU exit remains unattributed. Existing context-restoration behavior is exercised and logged; these changes do not guarantee recovery from every GPU-process failure. Runtime creation and GPU-resource ownership remain isolated by activation; broad GPU-resource pooling was intentionally avoided to preserve behavior.

Evidence: [implementation measurements](performance-implementation-2026-11-09.json).

## Overview

| Issue | Current finding | Recommended direction |
| --- | --- | --- |
| Excess casting copies | Relay canvases are copied at display refresh cadence, exceeding their encoding frame-rate limits. | Limit copies to each transport's requested output frame rate. |
| Incomplete automatic quality control | Cinema 2.0 Auto quality responds to its own CPU rendering duration, missing other sources of frame delay. | Include actual frame pacing and valid GPU timing, with headroom for casting. |
| Preset switching and Canvas buffer costs | Cinema recreates its runtime during preset changes; Canvas continuously updates multiple intermediate surfaces. | Budget Canvas surfaces consistently and reduce measured activation work through safe resource reuse. |
| Missing diagnostic history | Persistent logs lack the correlated performance context needed to attribute the recorded GPU-process failure. | Record bounded performance summaries and lifecycle events, and verify output recovery. |

## 1. Excess casting copies

### Overview

Casting adds a source-to-relay canvas copy, video encoding, transport, and receiver playback. The relay copy loops currently execute on every browser animation frame, even when the requested encoder frame rate is lower.

### Current analysis

- Both transports copied approximately 120 frames per second in the retained local samples.
- WebRTC requests a maximum of 60 FPS, with a landscape relay capped at 1920×1080 and a 12 Mbps video bitrate hint.
- Google Cast requests 30 FPS, with a landscape relay capped at 1280×720 and a 6 Mbps video bitrate hint.
- Applying a capture or encoder frame-rate limit does not throttle the separate JavaScript canvas-copy loop.
- At the observed 120 Hz cadence, the copy loops therefore ran about twice as often as the WebRTC cap and four times as often as the Google Cast cap.
- The samples did not reproduce the venue slowdown. They establish redundant copy work, not its contribution to the venue failure.

Implementation authority: `src/components/vyzualz/react/output/OutputCastControl.tsx`.

### Recommendation

Gate relay copies using elapsed animation-frame timestamps and each transport's requested frame rate: currently 60 FPS for WebRTC and 30 FPS for Google Cast. Skip copies until the next frame is due, without running catch-up bursts after a stall.

Keep the relay canvas, capture stream, encoder, and cast session stable across preset changes. Preserve transient canvas-copy recovery and ensure that source replacement and resizing still produce a usable next frame. This change should limit casting work without imposing a new frame-rate limit on the engine preview.

Validate copy counts at 60 Hz and 120 Hz, output frame delivery, preset transitions, and shutdown cleanup. At 120 Hz, the expected reduction is roughly 50% of WebRTC copy calls and 75% of Google Cast copy calls. Those percentages do not represent expected reductions in total application CPU or GPU usage.

## 2. Incomplete automatic quality control

### Overview

Automatic quality should reduce rendering cost when the application cannot maintain its target frame delivery. Cinema 2.0 currently makes this decision from a narrower measurement: time spent in its own CPU render callback.

### Current analysis

- Cinema's Auto policy reduces quality after its CPU-time moving average exceeds 20 ms for 12 samples.
- It increases quality after that average remains below 13.5 ms for 90 samples.
- GPU timer queries are available as telemetry where supported, but they do not drive these decisions.
- Overall animation-frame spacing, relay-copy work, and video-encoder load are not directly included in that CPU measurement.
- Asynchronous GPU or encoding pressure can therefore delay delivered frames while the measured CPU callback remains relatively short.
- Adaptive behavior differs across engines: Headliner already considers elapsed frame intervals.

Implementation authorities: `src/components/vyzualz/cinema2/runtime/Cinema2PerformanceDiagnostics.ts`, `src/components/vyzualz/cinema2/runtime/Cinema2Runtime.ts`, and `src/components/vyzualz/react/headliner/HeadlinerCompositor.ts`.

### Recommendation

Use actual frame intervals alongside CPU rendering time and valid, supported GPU timing. Treat casting as an additional headroom requirement rather than assuming the engine's callback duration describes the entire workload.

Reduce rendering resolution or supported effect quality after sustained missed frame budgets. Restore quality more slowly after sustained recovery. Exclude initialization, suspension, context loss, and other discontinuities from ordinary steady-state samples so they do not cause inappropriate quality changes. Preserve explicit user-selected quality modes.

Calibrate thresholds against the intended frame-rate target and actual venue output size. Verify GPU-bound and CPU-bound scenarios, casting on and off, unsupported GPU timers, and repeated quality changes. The expected outcome is steadier frame delivery; this is not yet a demonstrated remedy for the GPU-process exit.

## 3. Preset switching and Canvas buffer costs

### Overview

Preset changes can require resource teardown, initialization, and media restoration. Canvas also maintains intermediate composition surfaces continuously, including while casting is off. Both costs reduce the headroom available during a live transition.

### Current analysis

**Cinema 2.0:** The Stage effect depends on the preset and restore state. Changing them retires the current runtime, captures workspace state, disposes services, creates the replacement, restores media, resizes, and starts rendering. Depending on the preset, this can involve shaders, render targets, textures, models, and asynchronous loading.

Single observations measured approximately 31 ms until canvas publication for Mainframe and 334 ms for Blockshift. These cold/warm observations are not comparable preset rankings and do not measure when every visual asset becomes ready.

**Canvas:** The direct-source compositor maintains capture, composition, and effects canvases at up to 2× device pixel ratio and updates them on every animation frame. That sizing path does not use the shared canvas-resolution pixel budget. At a 1280×720 CSS stage and DPR 2, three RGBA backing stores represent approximately 42 MiB of pixel storage before source media, effect history, textures, or driver copies. Actual allocation and residency can differ.

The existing live-owner coordinator helps prevent overlapping engine loops. Its ownership counters are bookkeeping and cannot establish that all native GPU memory has been reclaimed.

Implementation authorities: `src/components/vyzualz/react/Cinema2Stage.tsx`, `src/components/vyzualz/react/ReactCanvasEngineShell.tsx`, `src/components/vyzualz/react/rendering/canvasResolution.ts`, and `src/components/vyzualz/react/renderers/ReactLiveEngineOwnership.ts`.

### Recommendation

First apply the shared resolution policy and explicit pixel budgets to Canvas intermediate surfaces. Reuse correctly sized buffers and avoid redundant composition where the source, settings, and output have not changed. Keep required audio-reactive and temporal effects updating correctly.

Then profile Cinema activation by phase: retirement, compilation, resource allocation, asset loading, and first usable frame. Reuse compatible renderer resources, shader programs, and assets only where measurements justify it and ownership is explicit. Any cache should have a bounded memory budget. Cancel or ignore superseded asynchronous work during rapid selection changes.

Retain a completed output frame during the handoff until the replacement can publish usable output. Preserve the one-active-owner rule; keeping a transition image must not require leaving multiple full engine runtimes rendering indefinitely.

Validate cold and repeated activation, rapid preset cycling, output continuity, and resource usage over a sustained run. Include Live Input, file media, actual venue resolutions, and casting on and off. Avoid broad resource-reuse changes until activation measurements identify the expensive phases.

## 4. Missing diagnostic history

### Overview

Logs record some important errors but lack a persistent, correlated timeline of engine selection, casting activity, performance, and resource state. This prevents reliable attribution of failures seen during a show.

### Current analysis

The session log records an abnormal GPU-process exit on November 8 at **23:42:08.106**, with exit code `8704`. Normal application shutdown began at **23:43:52.320**, about 104 seconds later. This is the strongest failure evidence from the session.

The log does not identify the active engine, preset, output resolution, casting state, or recent frame-time history at the moment of failure. It therefore cannot establish whether the cause was a driver problem, memory pressure, a particular preset, encoding, or another condition.

Transport statistics are sampled every two seconds and stored on the active session, but are not persisted as a historical performance trace. Explicit application logger calls reach the persistent log; some renderer errors instead appear in development-console output or notifications without equivalent persistent context.

Implementation authorities: `src/lib/logger.ts`, `native/output/outputTargetManager.cjs`, `src/components/vyzualz/react/output/OutputCastControl.tsx`, and `electron/main.cjs`.

### Recommendation

Persist a bounded, low-frequency timeline containing:

- Engine and preset activation, activation duration, cancellation, and first usable output.
- Casting start/stop/failure, transport, resolution, requested frame rate, and available measured output statistics.
- Quality transitions, frame-time summaries, dropped frames, and resource estimates, clearly distinguishing estimates from measured memory.
- GPU-process failure, context loss/restoration, and output-recovery attempts and results.
- Relevant renderer exceptions and rejected promises through the persistent diagnostics path.

Record transitions immediately and steady-state summaries at a modest interval, using bounded storage and log rotation. Capture recent context around failures. Exclude tokens, signed URLs, raw audio, and unnecessary personal or media information.

Add a dedicated GPU-failure recovery test: verify that affected renderers recover or report failure clearly, republish usable output when recovery succeeds, and preserve the cast session where the transport remains healthy. Instrumentation explains failures; it does not by itself prevent a GPU crash.

## Evidence limits and implementation order

The current evidence includes source review and 15 short local samples across five selected presets at 960×540, DPR 1. The local renderer reported Apple M3 Pro through ANGLE Metal. WebRTC used real local encoding/decoding with mocked native signaling; Google Cast used real MediaRecorder encoding with an in-memory sink. The comparison excluded venue receivers and networks, live audio, full-size output, sustained load, and an exhaustive preset sweep. It did not reproduce the reported slowdown.

Recommended sequence:

1. Add bounded diagnostics and GPU-recovery coverage, and throttle casting copies.
2. Improve automatic quality decisions using actual frame delivery and available GPU timing.
3. Budget Canvas buffers consistently, then optimize the measured expensive phases of preset activation.
4. Verify the changes across all six engines with repeated preset switching and sustained casting at the venue's actual output settings.

Supporting evidence: [Performance audit](performance-audit-2026-11-09.md) and [retained measurements](performance-audit-2026-11-09.json).
