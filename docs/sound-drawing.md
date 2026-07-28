# Sound Drawing

## Purpose

Sound Drawing turns waveform, shape, text, SVG, lyric, and generated sources into audio-reactive line art. It combines source preparation, authored clips, a timeline lane, Shared Performance programs, bounded simulation, Canvas2D rendering, and the Living Ribbon generator.

The React View engine ID is `oscilloscope`.

## Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| Renderer | `src/components/vyzualz/react/renderers/SoundDrawingRenderer.ts` |
| React stage integration | `src/components/vyzualz/react/ReactPlaceholderCanvas.tsx` |
| Timeline lane | `src/components/vyzualz/react/SoundDrawingTimelineLane.tsx` |
| Performance resolver | `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceEngine.ts` |
| Authored shows | `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceShows.ts` |
| Performance types and limits | `src/components/vyzualz/react/soundDrawing/SoundDrawingPerformanceTypes.ts` |
| Behavior runtime | `src/components/vyzualz/react/soundDrawing/SoundDrawingBehaviorRuntime.ts` |
| Source resolution | `src/components/vyzualz/react/soundDrawing/SoundDrawingSourceResolver.ts` |
| Control visibility | `src/components/vyzualz/react/soundDrawing/SoundDrawingControlVisibility.ts` |
| Visual size normalization | `src/components/vyzualz/react/soundDrawing/SoundDrawingVisualSize.ts` |
| Living Ribbon renderer | `src/components/vyzualz/react/renderers/LivingRibbonCanvas2DRenderer.ts` |
| Shared simulation rules | `docs/visual-simulation.md` |

## React View composition

Sound Drawing uses:

- **WORKSPACE → SOURCE** for engine source controls
- **MEDIA → SOURCE** for shared SVG media
- **FONTS → SOURCE** for text and font selection
- **PRESETS** for authored looks
- **DESIGN → ENGINE / SELECTION** for global and source-specific controls
- **REACT → ROUTING / ANALYSIS** for Music Intelligence behavior and diagnostics
- **OUTPUT → RECORDING** for browser capture
- Track Map, Performance Pads, and the Sound Drawing timeline in the lower workspace

## Source model

Supported source families include:

- Classic waveform and scope modes
- Built-in shapes
- Text and font geometry
- SVG artwork
- Lyric text
- Generated performance layers
- Living Ribbon

Expensive source preparation must occur at upload, selection, resolution change, or cache fill, not repeatedly inside the render loop. The renderer reads prepared SVG and glyph points from bounded caches.

A source identity must remain stable across ordinary section changes. Performance programs may transform presentation without silently replacing the selected text, SVG, shape, or lyric source.

## Timeline and clips

`SoundDrawingTimelineLane` is the canonical clip and lane editor. Clip time is resolved against the same Track Map duration and transport authority used by the renderer.

Timeline edits must preserve stable IDs, normalized ranges, deterministic ordering, and bounded clip counts. The lane is an authoring surface, not a second playback clock.

## Performance programs

`SoundDrawingPerformanceEngine` resolves authored show definitions against Shared Performance context. Programs may recruit bounded layers, traces, particles, treatments, and event actions while respecting source-aware locks and safety limits.

The performance resolver distinguishes:

- Continuous Music Intelligence routes
- Discrete kick, snare, hat, beat, downbeat, transient, and semantic events
- Section and phrase development
- Four-, eight-, and sixteen-bar evolution
- Deterministic seek, loop, track replacement, and source replacement

Transient envelope state is runtime-only and must reset when its authoritative track or source identity changes.

## Living Ribbon

Living Ribbon uses the shared visual-simulation foundation and a Canvas2D renderer. It must follow the shared fixed-step, deterministic seed, bounded node, bounded particle, pause, reset, and dispose contracts.

Living Ribbon controls are shown only when the authored show or explicit generator selection requires them. See `docs/living-ribbon-production-validation.md` for production acceptance.

## Rendering and caches

`SoundDrawingRenderer` owns bounded per-canvas runtime maps for trails, beat envelopes, rotation phase, prepared paths, lyric runtime, Shared Performance temporal state, and Living Ribbon instances.

The renderer must:

- Reuse offscreen canvases and cached geometry
- Bound path and glyph caches
- Reset trails and transient state on authoritative discontinuities
- Pause simulation without advancing hidden time
- Dispose behavior and Living Ribbon runtimes when the canvas is replaced
- Avoid parsing SVG or rasterizing text each frame

## Professional scope signal core

A dedicated signal core sits underneath the creative Sound Drawing systems and supplies measurement-grade waveform and vectorscope geometry. It is signal only: it owns no rendering concepts, so the Canvas2D path and the GPU phosphor pipeline consume the same resolved trace.

| Responsibility | Current authority |
| --- | --- |
| Capture worklet | `public/worklets/stereo-scope-processor.js` |
| Capture tap and lifecycle | `src/audio/scope/StereoScopeAudioTap.ts` |
| Synchronized ring buffer | `src/audio/scope/StereoScopeRingBuffer.ts` |
| Channel matrix and correlation | `src/audio/scope/ScopeChannelMatrix.ts` |
| Conditioning (coupling, gain, offset, invert, swap) | `src/audio/scope/ScopeSignalConditioner.ts` |
| Trigger | `src/audio/scope/ScopeTrigger.ts` |
| Period estimation | `src/audio/scope/ScopePeriodEstimator.ts` |
| Timebase | `src/audio/scope/ScopeTimebase.ts` |
| Orchestration | `src/audio/scope/ScopeSignalCore.ts` |
| Persisted state and normalization | `src/audio/scope/scopeStateNormalization.ts` |
| Canvas geometry bridge | `src/components/vyzualz/react/renderers/soundDrawingScopeGeometry.ts` |
| Factory presets | `src/audio/scope/scopePresets.ts` |
| Music Intelligence mapping | `src/audio/scope/scopeMusicMapping.ts` |
| GPU phosphor plan | `src/components/vyzualz/react/renderers/soundDrawing/soundDrawingPhosphorPlan.ts` |
| GPU runtime | `src/components/vyzualz/react/renderers/soundDrawing/ScopePhosphorRuntime.ts` |
| GPU render targets | `src/components/vyzualz/react/renderers/soundDrawing/ScopePhosphorTargets.ts` |
| Phosphor shaders | `src/components/vyzualz/react/renderers/soundDrawing/scopePhosphorShaders.ts` |
| Adaptive quality | `src/components/vyzualz/react/renderers/soundDrawing/ScopePhosphorQualityController.ts` |
| Beam packing | `src/components/vyzualz/react/renderers/soundDrawing/soundDrawingBeamPacking.ts` |
| Controls | `src/components/vyzualz/react/soundDrawing/SoundDrawingProScopeControls.tsx` |

### Capture

`StereoScopeAudioTap` runs one `AudioWorkletNode` that reads left and right from the same input render quantum, so `left[i]` and `right[i]` are a genuine stereo sample pair. This is the property a vectorscope depends on and that `analyserL`/`analyserR` cannot provide: each analyser snapshots on its own read with no alignment contract between them.

The tap is a pure observer connected in parallel to `masterGain`, never into the monitoring chain, so it cannot alter or delay what the user hears. Blocks are transferred to the main thread as pooled `Float32Array` pairs that the main thread returns for reuse, so steady-state capture allocates on neither thread. `SharedArrayBuffer` was not used because cross-origin isolation is not guaranteed across every DRMVYZ host.

Capture is best-effort. When AudioWorklet is unavailable or the module fails to load, the tap reports an unavailable reason, `readLatest()` returns null, and the renderer falls back to the existing analyser waveform. High-quality scope capture is never a requirement for engine availability.

The ring buffer resets on any gap or rewind in the capture frame counter, and on seek, stop, and track change, so no display window can straddle a transport jump.

### Signal modes and honesty rules

`ScopeSignalMode` separates measurement modes (`stereoXY`, `midSideXY`, `sumDifferenceXY`, `dualWaveform`, `left`, `right`, `mono`) from creative portrait modes (`monoDelayXY`, `bandSplitXY`, `proceduralFallback`).

Two rules are load-bearing:

- A mono-derived figure is never presented as a stereo measurement. The controls surface a notice when capture is unavailable, and when a stereo measurement mode is selected over a genuinely single-channel source.
- Mid/side uses the energy-preserving `(L ± R) · 1/√2` conversion, not `(L + R)/2`, so a hard-panned and a centred source of equal level produce comparable trace amplitudes.

### Trigger, period, and timebase

Triggering is Schmitt-style: for a rising trigger the signal must fall below `level − hysteresis` before a crossing above `level + hysteresis` counts. Holdoff suppresses candidates inside one complex period, and the crossing point is interpolated to sub-sample resolution so a short timebase does not twitch by a pixel every frame.

Continuity is judged in **absolute capture-frame coordinates**, not within-window indices. The capture window advances every frame, so two equal window indices are different instants; comparing them would make the trigger chase the window rather than the signal.

Period estimation uses a local normalized square difference function. `fftMagnitudes` in `offlineTrackAnalyzer.ts` was evaluated and not reused: it returns magnitudes only, with no inverse transform, and allocates per call. No new dependency was added.

The timebase is independent of `pathResolution`. Path resolution controls how many points are plotted; the timebase controls how much audio those points span. Beat-relative mode uses the canonical effective BPM and falls back to a fixed time window when BPM is unknown rather than assuming a tempo.


### GPU phosphor pipeline

The professional scope renders through an offscreen WebGL2 context that the
runtime owns and composites into the existing Sound Drawing 2D output with
`drawImage` — the same boundary `WebGL2Renderer` uses for CANVAS. That keeps
`ReactPlaceholderCanvas` the center-stage owner, leaves the recording output
canvas untouched, and makes Canvas2D the natural fallback: when the runtime is
unavailable nothing is composited and the existing beam path draws as before.

Pass chain: beam emission (additive, HDR) → persistence (ping-pong) → bloom
levels (separable Gaussian, two passes each) → tone-mapped composite → optional
CRT.

Both presentations consume one array. `buildProfessionalScopeSegments` resolves
the trace and beam optics once; the Canvas2D rasterizer strokes that array and
the GPU path packs the same one for `GeometryPass`. Falling back changes how the
geometry is drawn, never the geometry.

Composed from existing engine infrastructure rather than reimplemented:
`GeometryPass` for instanced segments, `ShaderFramebuffer` and
`ShaderPingPongBuffer` for targets and persistence, `ShaderCapabilities` for the
float-target policy, and `WebGLContextLifecycle` for context ownership.

Constraints worth stating, because each was a bug before it was a rule:

- **HDR requires `EXT_float_blend`, not only renderability.** Beam emission is an
  additive pass into the HDR target; a device that can render float but not blend
  into it must take the RGBA8 path rather than fail at draw time.
- **Emission must be scaled into the HDR band.** The beam profile's own peak sits
  near 0.5 after the exposure and intensity terms, which is not high dynamic
  range at all — tone mapping would return a dim third of display white and the
  bloom threshold would barely trigger.
- **Bloom extraction happens per tap, inside the kernel.** Thresholding the
  blurred result against the destination fragment's own brightness deletes the
  halo entirely, since that brightness is zero exactly where the glow belongs.
- **Bloom levels are independent, not cascaded.** Chaining each level off the
  previous compounds the kernel's averaging loss until the widest level is a
  fraction of a percent of the trace.
- **The blur is a separable Gaussian, and never strides more than one texel.** A
  single-radius ring kernel convolves with a circle rather than blurring; a
  Gaussian that strides further than a texel becomes a sparse comb and shows as
  an axis-aligned lattice. Width comes from the downsample, which is why bloom
  target scales are chosen to keep each level's sigma near 2–3 texels.
- **Persistence decay is `exp(-dt / tau)`, converted every frame.** A per-frame
  retention constant makes a trail twice as long at 120fps as at 60fps.

### Quality and lifecycle

`ScopePhosphorQualityController` selects a tier from frame timing with
deliberately asymmetric hysteresis: the upshift cooldown is roughly three times
the downshift cooldown, and each tier's headroom threshold is strictly tighter
than the tier above's downshift threshold. That gap is what prevents two-tier
oscillation, which reads worse than sitting one tier low.

Targets rebuild only when the *layout* changes — format, persistence scale, bloom
scales — so an Ultra-to-High change costs nothing and cannot flash. Context loss
releases targets while keeping the runtime alive; restore re-probes capabilities,
because a restored context may be a different GPU.

### Presets

`scopePresets.ts` holds fifteen factory presets in three groups: measurement,
analog character, and signature. They are partial patches layered over the
defaults, so a preset states only what it changes and a field added later reaches
every preset through the defaults.

The grouping is enforced, not descriptive. A measurement preset must not apply
treatment that misrepresents the signal it reads, so measurement presets hold
bass width response and curvature at or near zero — a trace that thickens with
the music changes the reading with it. `violatesMeasurementDiscipline` asserts
this in tests.

### Auto-gain, and why version 5 breaks the appearance rule

Every other migration preserved how an existing project looks, because the
existing behaviour was correct. Version 5 does not, because the existing
behaviour was the defect.

The trace was drawn at the audio's own amplitude. A master at -12 dBFS therefore
spanned about 11% of the tube and a quieter one about 5% — a dot, not a trace.
Hardware scopes solve this with a gain knob set once per source; auto-gain does it
continuously, which is what keeps a scope usable across a whole set. Peak tracking
is fast-attack and slow-release so a snare cannot clip off-screen and the figure
does not pump between beats, and the gain is bounded so a near-silent passage
cannot amplify noise into a full-screen scribble.

Leaving it off by default to preserve the old look would have preserved the wrong
thing.

### One point per sample

The core never resamples a window down onto fewer points. Decimation leaves
consecutive plotted samples uncorrelated on broadband material, and the trace
becomes straight chords across the figure rather than the continuous curve a real
beam draws. The display window is therefore clamped to the point budget: showing
less time is the correct trade, showing invented geometry is not.

### Music Intelligence mapping

`scopeMusicMapping.ts` is the seam that keeps the scope part of DRMVYZ rather than a bolted-on instrument. It maps beat, kick, bass, build progress, and drop impact onto **presentation only** — glow, beam width, exposure, and persistence.

Nothing in it touches geometry, signal path, or trigger. That boundary is structural rather than stylistic: a measurement display that moved with the music would no longer be measuring anything. The returned shape is the enforcement, and a test pins its keys.

Everything returned is a multiplier, so the user's own tuning stays authoritative and the music scales it. Every amount defaults to zero, which is exactly the identity — that is what makes the version-4 migration appearance-preserving. Presets are what dial it in, and only the signature group does.

Multipliers are hard-bounded. Music Intelligence values come from live analysis, and a transient mis-detection should cost a slightly wrong frame rather than an unreadable one.

MI reports section *type* and *progress* rather than build/drop scalars, so the renderer reads the section directly and passes -1 or 0 for "not in one". The mapping treats those as no contribution rather than as a zero value, so an ordinary passage does not read as the beginning of a build.

### Performance budgets

`__tests__/scopePerformanceBudget.test.ts` asserts the structural budgets rather than relying on "looks smooth": per-tier pass counts, geometry point counts, and total fill expressed as a multiple of one full-resolution pass.

Two constraints are load-bearing. No bloom level runs at full resolution — full-res blur is the most expensive thing this pipeline could do, and it is also what keeps each level's texel-space sigma small enough for the tap budget to reach its tail. And the entire six-pass bloom pyramid costs less than one full-resolution pass, which is only possible because every level is downscaled.

### CRT presentation

Optional, off by default, and runs after tone mapping on display-range colour:
curving or scanlining HDR values before compression would let a bright
intersection survive a scanline that should have dimmed it.

Flicker, vertical roll, and horizontal jitter are **absent from the settings
shape entirely** rather than shipped present-and-zeroed. Those are the CRT
effects carrying photosensitivity risk, and a control that only ever hurts when
raised is still a control someone raises. The shader has no time uniform, so
animated artifacts cannot be reintroduced by setting a value.

Phosphor models are named for the look, not for a specific tube — claiming exact
emulation would be a measurement claim this engine has not earned. The graticule
is a reference overlay, not calibrated measurement.

### State and migration

`SoundDrawingScopeState` is versioned and persists under `OscillatorSettings.scope`, following the existing oscillator normalization path. Only serializable configuration is stored — never ring buffers, trigger history, GPU resources, or telemetry.

Version history, each following the same rule — migrating forward must never change how an existing project looks:

| Version | Adds | Migration behaviour |
| --- | --- | --- |
| 1 | Signal, conditioning, trigger, timebase | Legacy `lissajous` becomes `monoDelayXY`, which renders identically |
| 2 | CRT presentation | Defaults arrive disabled, so a v1 project renders unchanged |
| 3 | Beam and phosphor tuning | Defaults reproduce the previously hardcoded values exactly |
| 4 | Music Intelligence mapping | Every amount defaults to zero, which is the identity mapping |
| 5 | Auto-gain | **Deliberately changes appearance** — see below |

The pre-existing `lissajous` classic mode plotted one half of a mono time-domain buffer against the other, which is a delayed mono phase portrait rather than stereo. It migrates to `monoDelayXY`, which routes to the identical draw path, so existing projects keep their exact appearance under an accurate name. Legacy values are never promoted to `stereoXY`, and the professional core stays disabled until the user selects it.

## Size and identity controls

Visual size is normalized through `SoundDrawingVisualSize.ts`. Classic Scope, Built-In Shape, text, SVG, and generated sources should use the same normalized size contract rather than separate incompatible scale semantics.

Source treatments may alter contour, repetition, deformation, color, trail, and motion while retaining source identity unless the user explicitly chooses an abstracting mode.

## Diagnostics and validation

Shared Performance diagnostics report active routes, event reasons, locks, clamps, source identity, and bounded runtime statistics. A visual moving autonomously must not be reported as proof of music reaction.

Tests under `src/components/vyzualz/react/soundDrawing/` cover performance sources, deterministic identity, limits, temporal routing, Living Ribbon control visibility, and authored shows. Shared simulation and Living Ribbon validation remain separate required gates for changes to that generator.

GPU phosphor behaviour is covered by mock-context tests under `src/components/vyzualz/react/renderers/soundDrawing/__tests__/`: pass ordering, additive blend state and its teardown, absence of shader recompilation or target reallocation during steady playback, context loss and restore including capability re-probing, ping-pong feedback-loop rejection, and full resource release. Shader maths that cannot run in a unit test is pinned in `soundDrawingPhosphorPlan.ts` and `soundDrawingBloom.ts` and hand-transcribed into the GLSL.

Professional scope DSP is covered by deterministic analytic fixtures under `src/audio/scope/__tests__/`, which assert the mathematically derivable result for each signal relationship rather than a recorded render: in-phase stereo plots the positive diagonal, anti-phase the negative diagonal, a 90° phase shift a circle, and unequal channel gain a compressed diagonal. Trigger, timebase, ring-buffer, and migration behavior are covered alongside. Screen-space mapping and classic-mode routing are covered by `src/components/vyzualz/react/renderers/__tests__/soundDrawingProfessionalScope.test.ts`; persistence behavior by `src/stores/soundDrawingScopeMigration.test.ts`.
