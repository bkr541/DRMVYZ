# Performance and casting audit — November 9, 2026

The strongest session evidence is an abnormal GPU-process exit shortly before shutdown. The source review also identifies avoidable casting work, expensive preset activation, and gaps in automatic quality control and persistent diagnostics. The short local samples did **not** reproduce the venue slowdown. They do not establish the cause of the GPU exit or certify every preset.

## Session logs

Reviewed the November 8–9 entries in `logs/main.log`, including multiline event payloads. Times below are the local timestamps written by Electron.

| Time on November 8 | Evidence | Interpretation |
| --- | --- | --- |
| 22:51:05, 22:59:29, 23:15:28 | Application launches with `devServer=true`, Electron 43.1.0, macOS arm64 | The recorded session used development mode. Production performance was not measured. |
| 22:52:36–22:52:39 | File media load takes 3,081 ms to reach metadata/canplay | A concrete file-readiness delay, preceding the later Live Input testing; not proof of render or casting trouble. |
| 23:00:23 and 23:16:10 | Audio/video device-list change warnings | Devices changed; the entries do not establish a disconnected microphone or failed audio analysis. |
| 23:22:54–23:23:03 | Three successful camera-open events | Camera sources were exercised. No camera failure is recorded here. |
| **23:42:08.106** | **`child-process-gone`, type `GPU`, reason `abnormal-exit`, exit code `8704`** | **Confirmed GPU-process failure.** It can disrupt graphics across engines and the video pipeline. The code does not identify a driver fault, out-of-memory condition, or specific preset as the cause. |
| 23:43:52.320 | Normal application shutdown begins | GPU failure preceded quitting by about 104 seconds; it was not merely normal shutdown cleanup. |

The GPU event starts at `logs/main.log:59580`. There is one error-level event and six warning-level entries in the reviewed November 8–9 interval. Three warnings simply report AudioContext becoming `running`; that state alone is not a failure. Historical `write EIO`, network, and renderer errors elsewhere in the same accumulated file must not be attributed to this performance.

No matching DRMVYZ/Electron GPU crash report was found in the available macOS DiagnosticReports inventory. There is no persisted active-preset/cast-state/FPS/memory timeline accompanying the GPU exit. The earlier transient canvas-copy recovery patch protects one cast failure path; it does **not** repair a GPU-process failure, and the log does not prove that transient copy errors caused the venue blackout.

## Findings in priority order

### 1. Casting copies substantially more frames than its output requires — measured

Both relay loops run `drawImage` on every `requestAnimationFrame`. Their capture/encoder frame-rate limits do not gate the copy loop. On this machine the retained samples measured about **120 relay copies/second** for both transports. WebRTC decoded about 56–60 FPS, while Google Cast requests 30 FPS encoding. Copy cadence was therefore about 2× the WebRTC cap and 4× the Google Cast cap.

| Path | Configured maximum relay size, landscape | Capture FPS | Video bitrate hint | Extra work |
| --- | --- | --- | --- | --- |
| Casting off | None | None | None | Engine still renders its preview/published output |
| Local display / DRMVYZ receiver, WebRTC | 1920×1080 | 60 | 12 Mbps | Relay copy, encode, transport, receiver decode and presentation; local displays use this pipeline too |
| Google Cast, WebM | 1280×720 | 30 | 6 Mbps | Relay copy, MediaRecorder encoding, 250 ms chunks, native transport, receiver playback |

These are caps/hints, not guaranteed throughput or quality. The measured sources were only 960×540. At a 120 Hz preview refresh, throttling the relay copies to the requested output rates would remove roughly half / three quarters of those copy calls; it would **not** necessarily reduce total application GPU/CPU cost by those percentages.

Authority: `src/components/vyzualz/react/output/OutputCastControl.tsx:106`, `:138`, `:343`, `:372`. No casting-rate optimization was implemented in this audit.

### 2. Cinema 2.0 Auto quality misses GPU and casting pressure — source-confirmed gap

Auto quality decisions use the moving average passed to `sampleCpuFrame`: reduce above 20 ms for 12 samples, increase below 13.5 ms for 90 samples. The runtime measures its own JavaScript render callback. GPU timer queries are exposed as telemetry but do not drive this decision; the total RAF interval, relay copying, and encoder work are outside that CPU measurement.

Consequently, Auto can retain high quality when asynchronous GPU work or video encoding is the bottleneck. This is a plausible contributor to insufficient headroom, not a demonstrated cause of the GPU exit. For comparison, Headliner adapts from elapsed frame intervals, so adaptive behavior differs across engines.

Authority: `cinema2/runtime/Cinema2PerformanceDiagnostics.ts:122`, `Cinema2Runtime.ts:873` and `:935`, `react/headliner/HeadlinerCompositor.ts:273` (paths under `src/components/vyzualz/`).

### 3. Preset switching includes real teardown and initialization work — source-confirmed

Cinema2Stage's effect depends on `presetId` and `restoreState`. Selecting another preset retires the runtime, captures workspace state, disposes its services, creates the replacement, restores media, resizes, and starts rendering. This can involve render targets, shaders, textures, models, and asynchronous asset loading. The previous visual is not maintained as a prepared transition while this happens.

In the samples, time until canvas publication was about 31 ms for Mainframe and 334 ms for Blockshift; these single cold/warm observations are **not** comparable preset rankings or times until every asset is ready. Canvas selected-preset publication was 39–55 ms in the corrected run. Casting continues to need frames during these handoffs and adds ongoing load, reducing the initialization headroom available.

The existing live-owner coordinator synchronously retires the preceding owner before another initializes. That is a useful protection against overlapping loops. Ownership bookkeeping returning to zero is not proof that all native GPU allocations have immediately been reclaimed.

Authority: `react/Cinema2Stage.tsx:136`, `:151`, `:260`; `react/renderers/ReactLiveEngineOwnership.ts:32`.

### 4. Canvas has a separate, continuously active capture-composition cost — source-confirmed

The direct-source compositor maintains capture, composition, and effects canvases; it sizes all three at up to 2× DPR and draws on every RAF even when casting is off. That specific sizing path does not use the shared `resolveCanvasResolution` pixel budget. At a 1280×720 CSS stage and DPR 2, three RGBA backing stores alone represent about **42 MiB** of pixel storage, excluding source images, effect history, GPU textures, and driver copies. Actual allocation and residency can differ.

The general resolver used elsewhere caps quality/DPR and backing pixels; these policies are not uniformly applied to this Canvas compositor. Larger stage windows, display changes, and multiple effect surfaces can therefore change the cost substantially. An engine that looks inexpensive at the audit's DPR 1 / 960×540 size can be much heavier on the venue layout.

Authority: `react/ReactCanvasEngineShell.tsx:2040`, `:2060`, `:2242`; `react/rendering/canvasResolution.ts:6`.

### 5. Google Cast has a potential backlog under slow native publishing — source-confirmed risk

Each recorder chunk is appended to a serial promise chain. There is no explicit pending-byte/chunk bound or latency budget at that queue. If publication takes longer than chunk production, queued blobs can accumulate latency and memory. This was **not** reproduced: the local benchmark used an immediate in-memory sink and deliberately excluded native IPC/network/receiver costs.

Authority: `react/output/OutputCastControl.tsx:502`.

### 6. Current diagnostics cannot attribute the venue failure — confirmed limitation

Transport stats are sampled every two seconds and stored on the active native session, then emitted to renderers. They are not written as a historical performance trace. Engine/preset activation and quality transitions similarly lack a persistent correlated timeline. Renderer logging persists explicit `createLogger` entries, while the reviewed startup path does not install a catch-all renderer-console/error recorder. Some render failures become notifications or development-console messages without equivalent persistent context.

The next investigation should record bounded, low-frequency engine/preset/cast/quality/resolution identifiers, frame-time percentiles, encoded FPS, drops, estimated resources, activation latency, and GPU-process recovery events. Log transitions and summaries rather than every frame; omit media URLs, tokens, and raw audio.

Authority: `native/output/outputTargetManager.cjs:304`; `react/output/OutputCastControl.tsx:313` and `:531`; `src/lib/logger.ts:26`; `electron/main.cjs:227`.

## Engine coverage

| Engine | Reviewed performance characteristics | Runtime sampling in this audit |
| --- | --- | --- |
| Cinema 2.0 | Multipass GPU rendering, asset/target allocation, full preset runtime activation, CPU-driven Auto quality | Blockshift and Mainframe |
| CANVAS | Source/effect/capture composition, multiple buffers, effect-specific loops, variable sizing policies | Clean Playback, MUTAGEN, Terminal selected surfaces |
| Sound Drawing | Waveform/geometry processing, bounded layers/traces/particles, scope GPU path and cleanup | Source review only |
| LaserDMX | Fixture/beam planning, GPU rendering/composition, adaptive quality and teardown | Source review only; no physical output |
| PixGrid | GPU versus Canvas2D fallback, frame diagnostics and pause-aware scheduling | Source review only; no deck compilation benchmark |
| Headliner | Camera capture, effect processors, temporal buffers, frame-interval adaptation, camera/compositor cleanup | Source review only; no camera opened for the audit |

Live Input has a shared analyser publication loop that survives engine changes and uses reusable buffers/authority checks. It still consumes main-thread analysis time and competes with frame work. There is no log evidence proving duplicate live analysis or an audio-only cause; no live audio was captured in this audit.

## Bounded local comparison

Hardware renderer reported `ANGLE Metal Renderer: Apple M3 Pro`. Used an isolated headless Chromium context against the existing Vite server, production surface components and OutputCastControl, a synthetic still image / synthetic advancing transport, DPR 1, 960×540 backing stores, and approximately 1.3 seconds per retained scenario. WebRTC used actual encoding and local peer/video decoding in the same page with mocked native signaling. Google Cast used actual MediaRecorder encoding with an in-memory chunk sink, without native IPC or receiver playback.

| Selected preset | RAF cadence: off / WebRTC / Google encoding | WebRTC decoded FPS | Relay copies/sec: WebRTC / Google |
| --- | --- | --- | --- |
| CANVAS Clean Playback | 119 / 119 / 119 | 60 | 120 / 120 |
| CANVAS MUTAGEN | 119 / 119 / 120 | 60 | 120 / 121 |
| CANVAS Terminal | 119 / 119 / 119 | 56 | 120 / 120 |
| Cinema 2.0 Blockshift | 118 / 119 / 119 | 59 | 120 / 120 |
| Cinema 2.0 Mainframe | 119 / 119 / 119 | 60 | 120 / 120 |

RAF cadence measures browser callback scheduling, **not** independently verified changed visual frames or end-to-end venue FPS. Retained samples had roughly 8.7–9.3 ms p95 RAF intervals. WebRTC inbound counters reported zero dropped frames in these short samples. The samples show substantial local headroom under this controlled load; they do not establish that casting has no cost. JavaScript draw-call timings exclude asynchronous GPU completion and cannot be treated as total GPU copy cost.

The initial Canvas harness omitted production CSS, caused invalid canvas-size growth, and was discarded. Canvas was then measured with production CSS and an explicit 960×540 size assertion. Retained Cinema samples were correctly sized but came after that initial work; they cannot support cross-engine ranking. The initial harness also had a signaling teardown race during invalid Canvas scenarios; corrected Canvas sampling had no cast failures. Isolated-harness Vite HMR local-network warnings are not venue errors. No user account, live camera, microphone, casting device, or existing application session was modified.

Raw retained metrics and limitations: [performance-audit-2026-11-09.json](performance-audit-2026-11-09.json). This is five sampled presets, not an exhaustive preset sweep, sustained soak, full-resolution comparison, or real-network benchmark.

## Recommended work order

1. Persist bounded performance/activation/cast context around GPU failures and exercise recovery after GPU-process loss. This is necessary to attribute the confirmed failure.
2. Gate relay copies to the transport's requested frame rate; preserve the previous session and the existing transient-copy recovery behavior.
3. Make Cinema Auto quality respond to actual frame pacing and available GPU timing, with casting-aware headroom and conservative hysteresis.
4. Apply a consistent size budget to Canvas intermediate surfaces and reduce redundant composition. Measure at the actual venue resolution/DPR before choosing defaults.
5. Profile cold and repeated preset activation; reuse safe assets/programs and avoid unnecessary recreation where measurements justify it. Bound the Google Cast publishing backlog.
6. Validate the resulting changes with all six engines, repeated preset cycling, Live Input and file media, actual venue output sizes, cast off/on, and a sustained run. No such full matrix was completed here.

This request produced analysis and evidence only; no additional application behavior was changed. The preceding uncommitted canvas-copy patch remains in the working tree. No commit was requested or created.
