# DRMVYZ SOUND DRAWING: GUIDE-TO-REPOSITORY GAP ANALYSIS

# Evidence protocol and source boundary

**Audit date:** 2026-11-16. **Primary code evidence:** uploaded `DRMVYZ-main (3)(1).zip`; root paths in citations are relative to `DRMVYZ-main/`. **Guide:** `Sound_Drawing_Complete_Recreation_Guide(1).md` (1,499 lines). **Visual references:** the eight submitted screenshot/storyboard JPEG files covering Sound Drawings 1, 2, 4 and 6. **Unavailable in this turn:** the four original `.mov` recordings, a separate instructional-package ZIP, actual audio tracks, a running packaged Electron app and installed `node_modules`. No tests, build, benchmark, media-output comparison or live UI operation was executed. Static inspection verifies code paths and conditions, **not** runtime correctness on a particular device.

Statuses: **EXISTS** = code plus inspected connection to a consumer; **REUSABLE** = existing suitable module; **PARTIAL** = partial implementation or missing integration, without asserting failure; **BROKEN** = demonstrable code defect with explicit reproduction hypothesis; **DUPLICATED** = overlapping implementations; **MISSING** = no implementation found after targeted source search, subject to runtime validation; **UNKNOWN** = cannot establish conclusively; **NEW COMPONENT** = proposed engineering work. A UI field or label alone does not prove functional behavior.

The guide distinguishes **literal stereo XY** (left and right PCM at the same sample index) from **author-created vectors modulated by arbitrary tracks**. They must not be conflated. Guide video attributions [V1–V4] are *visual observations/reconstruction*, and [ENGINEERING] denotes interpretation or proposed design rather than verified spoken narration. The supplied screenshots support scene shapes (circle, cubes, wireframes, glowing contours, Ableton/osci-render) but **cannot establish inter-frame timing or exact DSP parameter values**.

# Executive gap verdict

The engineering gap is **not** "DRMVYZ has no oscilloscope." Both legacy `oscilloscope` and standalone `xyScope` already contain meaningful geometry, live audio responsiveness and rendering. The missing product layer is a common **identity-preserving, event-addressable, versioned Sound Drawing contract** spanning those engines, with authoritative audio provenance and validation. Actual XY-signal generation is an advanced *separate* mode, not the architecture for preserving arbitrary words under arbitrary DJ tracks.

**P0 blockers:** canonical source/clock/feature adapter; consistent reset and event identities; cross-engine shared shape identity; deterministic behavior; input capability/provenance; baseline visual tests. Most P0 work should wrap or adapt existing components rather than delete them.

**P1:** normalized mappings, constrain-and-restore transform solver, independent-stroke authoring, import errors instead of silent substitution, shared UI ownership, readable default and smoothing. **P2/P3:** advanced projection, heterogeneous scene layers, physical XY synth/export, video reference fitting and performance hardening.

## P0: detailed capability matrix (14 items)

| Category | Guide capability | Guide | Current DRMVYZ / evidence | Status | Technical gap | Existing reuse | Required enhancement | Priority | Complexity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Literal XY | Paired left/right sample capture | §5, §20.2 | StereoScopeAudioTap.ts:64-185 | EXISTS | Capture is not public in MIFrame.raw | Stereo tap + frame | Expose readonly scope view with provenance | P0 | S |
| Literal XY | Axis matrix (L/R, mid/side, M/S) | §5, §6 | ScopeChannelMatrix.ts:18-113 | EXISTS | Multiple modes need unambiguous label | ScopeSignalCore | Keep measurement-vs-creative mode labels | P0 | S |
| Literal XY | Sample-accurate window and index | §5, §29 | ScopeSignalCore.ts:120-262 | EXISTS | End-to-end clock skew unmeasured | StereoScopeFrame.startFrame | Clock-alignment diagnostics | P0 | M |
| Geometry | Canonical path identity/version | §28, Appendix B | Multiple point/glyph structures | PARTIAL | No unified vertex-id/topology contract | Existing geometry records | Shared immutable ShapeDocument | P0 | L |
| Transformation | Repeatable event-seeded variation | §24 | XyScopeTextV2Performance.ts:126-133 | PARTIAL | Text V2 seeded; legacy random word path unseeded | Text V2 plans | All modes seeded by event identity | P0 | M |
| Audio intelligence | Band envelopes six ways | §22 | bandAnalysis.ts:21-164 | EXISTS | Weights must be source-normalized | MIFrame.bands | Typed feature map | P0 | M |
| Audio intelligence | Transient/kick/snare/hat events | §22 | rhythmAnalysis.ts:134-191 | EXISTS | Heuristic detector variation | MIFrame.rhythm | Event dedupe and confidence | P0 | M |
| Audio intelligence | Phrase/section moments for uploaded songs | §24 | MusicIntelligenceEngine.ts:787-907 | EXISTS | Depends on valid offline timeline | BeatGrid / timeline | Use confidence and revision | P0 | M |
| Audio intelligence | Multi-source source identity and provenance | §22 | AudioFeatureBus.ts:63-119 | PARTIAL | Full and partial updates have different authority semantics | AudioFeatureBus | Immutable capture/source identity | P0 | M |
| Timing | Single beat/phrase clock | §15.1 | Shared context and BeatGrid exist | PARTIAL | XY and classic per-frame state/auto toggle vary | SharedPerformanceContext | Canonical event IDs, clock adapter | P0 | L |
| Timing | Seek/loop reset | §15.1 | XyScopeSurface.tsx:120-149 | EXISTS | All mode trail/effect state need tests | XyScopeTransport | Central reset reason contract | P0 | M |
| Timing | Predictive events / output latency | §15.1 | No end-to-end timing measurement supplied | UNKNOWN | Cannot verify phase error | Transport + tap | Timestamp alignment probes | P0 | L |
| Authoring | Single preset schema and migration | Appendix B | reactStore.ts:6164-6401 | PARTIAL | Different stored settings for classic/xy | Zustand migration | Versioned shared nested schema | P0 | L |
| Validation | Automated golden visual and audio fixtures | §29 | src/audio/scope/__tests__ exist | PARTIAL | No supplied real multi-genre multi-resolution screenshot acceptance evidence | scope tests | Visual golden suite and sample fixtures | P0 | M |

## P1: detailed capability matrix (32 items)

| Category | Guide capability | Guide | Current DRMVYZ / evidence | Status | Technical gap | Existing reuse | Required enhancement | Priority | Complexity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Literal XY | Trigger, hysteresis, period assist | §4, §5 | ScopeSignalCore.ts:135-198 | EXISTS | Actual jitter not measured | ScopeTrigger | Golden trigger fixtures | P1 | M |
| Literal XY | Sample-rate support | §3, §4 | StereoScopeAudioTap.ts:50-56 | EXISTS | Hardware device switching unmeasured | AudioContext sampleRate | Resample/measurement metadata | P1 | M |
| Literal XY | Lissajous / mono delay phase portrait | §7, §16 | scopeTypes.ts:15-70 | EXISTS | Creative mode often confused with real stereo | monoDelayXY | Label clearly and test ratio | P1 | S |
| Geometry | Built-in primitives | §6, §8 | SoundDrawingRenderer.ts:577-590 | EXISTS | Shape richness varies by source mode | generateBuiltinShapePoints | Shared primitive registry | P1 | M |
| Geometry | OpenType path glyphs | §13.4 | XyScopeGeometry.ts:81-108 | EXISTS | Font variation + topology portability need tests | Font loader | Versioned glyph serialization | P1 | M |
| Geometry | Per-letter independent contours | §13.4, §23 | XyScopeGeometry.ts:211-256 | EXISTS | No shared semantic anchor registry across engine IDs | GlyphGeometry | Canonical semantic stroke model | P1 | L |
| Geometry | SVG path support | §13.1 | XyScopeSvg.ts:7-58 | EXISTS | 2MB and 2048 point max; cache and UX differ | compileSvgToGlyphResult | Extend budgets adaptively | P1 | M |
| Geometry | Bézier flatten / arc-length resample | §13.2 | XyScopeGeometry.ts:108-208 | EXISTS | Approximation quality should be tiered | Resampler | Screen-space error control | P1 | M |
| Geometry | Disconnected subpaths / beam blanking | §13.3 | XyScopeSvg.ts:31-58 | PARTIAL | Independent paths present, physical output blanking not demonstrated | pathIndex | Explicit pen-up transition policy | P1 | M |
| Geometry | Semantic word topology and anchor points | §23 | TextV2 glyph/trajectory modules | PARTIAL | No shared proof of anchored identity for all styles | TextV2 geometry | Landmark registry and constraints | P1 | L |
| Transformation | Per-stroke translation / rotation | §15 | OSC1/OSC2 runtime and glyph settings | EXISTS | Cross-source parameter mismatch | OSC1 settings | Standardize ranges/adapters | P1 | M |
| Transformation | Nonuniform scale and shear | §15 | XyScopeOsc1Engine.ts:16-58 | EXISTS | Verify default max vs readability | OSC1 transform | Preserve centroid/stroke footprint | P1 | M |
| Transformation | Continuity-preserving path morph | §28 | XyScopeTextV2Trajectory.ts:4-16 | PARTIAL | Trajectory works in specific source not arbitrary imported SVG | Text V2 trajectory | Topology-aware morph operator | P1 | L |
| Transformation | Trace breakup and reassembly | §17, §23 | XyScopeChoreography.ts:128-163 | PARTIAL | One choreography style, no universal recoverability metric | Choreography | Explicit reversible state machine | P1 | L |
| Transformation | Safe independent glyph responses | §23 | XyScopeOsc1Performance.ts:87-129 | PARTIAL | Independent behavior exists; collision and contour guards not global | OSC1 per-letter | Constrained per-glyph transform solver | P1 | L |
| Rendering | Continuous sample trace | §5, §18 | ScopeSignalCore.ts:238-263 | EXISTS | GPU/Canvas and XY output differ | ScopeTrace | Unified beam vertex adapter | P1 | M |
| Rendering | Phosphor GPU accumulation / bloom | §18 | ScopePhosphorRuntime.ts:37-50 | EXISTS | Legacy renderer owns GPU; XY own beam path | GPU phosphor | Bridge via adapter, do not rewrite | P1 | L |
| Rendering | Persistence / frame-rate independence | §18 | soundDrawingPhosphorPlan.ts:... | EXISTS | Numerical equivalence under frame drops unmeasured | decay helper | dt-invariant regression | P1 | M |
| Rendering | Scan jumps / retrace visibility | §13.3, §18 | XyScopeBeam.ts:19-34 | PARTIAL | No single explicit blanking contract all modes | Path gap flags | Pen-up contract and controls | P1 | M |
| Audio intelligence | Robust per-track percentile baselines | §22.2 | energyAnalysis.ts:68-179 | PARTIAL | Current band running maxima differ from stable per-track percentiles | EnergyAnalyzer | Per-source quantile normalizer | P1 | M |
| Audio intelligence | Spectral centroid, rolloff, flatness | §22 | useAudioEngine.ts:669-695 | EXISTS | Getter freshness and source ID not explicit | Meyda + MI | Feature timestamps/capabilities | P1 | S |
| Audio intelligence | Live mic structural semantics | §24 | MusicIntelligenceEngine.ts:676-780 | PARTIAL | Intentionally absent: no valid live phrases/drops | LiveTempoAnalyzer | Event-based fallback; do not hallucinate | P1 | M |
| Timing | BPM Sync control contract | §15.1 | XyScopeRuntime.ts:289-301 | PARTIAL | Engine/Audio Dock legacy semantics unverified | BeatGrid and resolved context | One scope-specific beat policy | P1 | M |
| Performance | Auto Performance coherent state machine | §24 | TextV2Performance.ts:94-191 | PARTIAL | Present in select paths, not global to all modes | Existing conductor | Single engine-level lifecycle adapter | P1 | L |
| Performance | Readability constraint score | §23 | OSC1 has readability knobs | PARTIAL | No shared measured landmark/contour score | Font contours | Runtime metric with offline validation | P1 | L |
| Performance | Semantic/topology restoration | §23 | XyScopeChoreography.ts:128-163 | PARTIAL | Recovery per-pattern, not universal for imported SVG | XyScope choreography | State recovery contract | P1 | L |
| Performance | Manual state remains when Auto off | Appendix B | XyScopeRuntime.ts:383-402 | EXISTS | Cross-engine UI contract should be validated | existing manual settings | Snapshot manual-vs-auto tests | P1 | M |
| Performance | Per-letter readable default 65% | §23 | No global readability dwell contract | PARTIAL | Per-source variations; must codify target | Choreography phases | Per-window readable time contract | P1 | L |
| Authoring | Source selection and SVG upload | §25 | XyScopeWorkspace.tsx:120-199 | EXISTS | Import validation/cap limits | Media Manager | Source diagnostics/cap preview | P1 | M |
| Authoring | BPM/Auto controls | §25 | ReactEnginePanel.tsx:489-900 | PARTIAL | Two engine surfaces and differing ownership | ReactStore | Scoped controls with shared semantics | P1 | L |
| Authoring | Explain measured vs authored modes | §2, Appendix B | scopeTypes.ts:15-70 | PARTIAL | Engine IDs/modes may be hard to distinguish | scope labels | Mode badge + visualizer provenance | P1 | S |
| Validation | Accessibility reduced motion/flash | §23 | Not verified cross-engine | UNKNOWN | Requires UX/policy audit | app appearance config | Cross-source safety suite | P1 | M |

## P2: detailed capability matrix (12 items)

| Category | Guide capability | Guide | Current DRMVYZ / evidence | Status | Technical gap | Existing reuse | Required enhancement | Priority | Complexity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Geometry | 3D mesh edge projection | §14 | Three.js exists; no unified XY mesh edge import established | PARTIAL | No common wireframe authoring pipeline wired to XY source | Three.js / Cinema2 | 3D projector + edge ordering | P2 | XL |
| Geometry | Path-order optimizer | §13.3 | XyScopeSvg.ts:31-58 | PARTIAL | Independent paths ordered but not scan-cost optimized | Path groups | Offline reorder with topology locks | P2 | L |
| Transformation | Harmonic/phase warp | §16 | XyScopeOsc1Engine.ts:128-273 | EXISTS | Not necessarily sample-accurate musical phase modulation | OSC1 modulation | Separate DSP from geometric semantics | P2 | M |
| Transformation | Duplicator / trace echoes | §16 | SoundDrawingRenderer.ts:3830-3875 | PARTIAL | Classics support duplicates; unified XY shape duplication unproven | duplicateTraces | Common duplication operator | P2 | M |
| Rendering | Dwell-sensitive beam intensity | §18 | XyScopeBeam.ts:19-34 | EXISTS | Cross-backend comparative fidelity tests missing | Beam brightness | Photometric golden fixtures | P2 | M |
| Rendering | CRT grids and analog look | §18 | ScopePhosphorRuntime.ts:102-138 | EXISTS | Accessibility and flash budgets need expansion | CRT settings | Reduced motion/profile compatibility | P2 | M |
| Rendering | Adaptive quality under multi-engine load | §29 | ScopePhosphorQualityController.ts | EXISTS | Combined resource budget not proven | Scope quality controller | Shared performance telemetry | P2 | L |
| Audio intelligence | Harmonic/pitch confidence | §7, §22 | harmonicAnalysis.ts:166-305 | PARTIAL | Low confidence dense mixes; must not steer anchors blindly | HarmonicAnalyzer | Confidence gate + neutral fallback | P2 | M |
| Audio intelligence | Stereo width and correlation into mapper | §22 | ScopeSignalCore.ts:249-262 | PARTIAL | Stereo measurement not advertised as canonical MI feature | ScopeSignalCore | Optional stereo descriptor adapter | P2 | M |
| Audio intelligence | Offline analysis in dedicated worker | §20, §29 | offlineTrackAnalyzer.ts:408-409 | PARTIAL | Cooperative yielding is not true isolation | analyzeTrackBuffer | Workerize after profiling | P2 | L |
| Performance | No repetitive fixed effect loop | §24 | Text V2 seeded plans, legacy phrase cycle | PARTIAL | Different modes use different selection policies | Text V2 event plan | Policy for recency/variety | P2 | M |
| Validation | 30+ minute soak and telemetry | §29 | scope status and diagnostics exist | PARTIAL | No measured performance profile provided | capture diagnostics | Perf HUD and long-run test | P2 | M |

## P3: detailed capability matrix (6 items)

| Category | Guide capability | Guide | Current DRMVYZ / evidence | Status | Technical gap | Existing reuse | Required enhancement | Priority | Complexity |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Literal XY | Shape-to-stereo-PCM synthesizer | §8, §11 | Targeted repo scan: no sound drawing synthesis output found | MISSING | No sample-clock path-to-audio export | SVG path geometry | Build isolated AudioWorklet synth | P3 | XL |
| Literal XY | Stereo WAV/FLAC XY export | §11, §26 | Targeted repo scan: no authored XY exporter found | MISSING | No verified render-to-stereo PCM encoder | PCM encoder can be added | Offline float32 render + WAV | P3 | L |
| Literal XY | Oversampling / anti-alias limit | §4, §16 | ScopeSignalCore.ts:238-263 (display, not synthesis) | MISSING | No dedicated authoring sound low-pass pipeline | Scope arc resampling | DSP oversample+LPF for synthesis | P3 | L |
| Geometry | Image raster to traceable vector | §13.5 | SVG compiler rejects embedded raster | PARTIAL | Raster image vectorization is separate media feature | Media Manager tools | Offline raster conversion integration | P3 | L |
| Authoring | SVG/reference-video reconstruction | §28 | No automated frame-path extraction established | MISSING | Reference files not converted to editable path-time tracks | SVG compiler | Separate offline fitting pipeline | P3 | XL |
| Authoring | Self-contained portable preset bundle | Appendix B | ReactStore saved state exists | PARTIAL | No portable bundle of source + path topology + seed shown | existing store | Versioned export/import manifest | P3 | L |

## Root-cause analysis (not just feature labels)

### 1. Different engine identities and authoring objects

`ReactTypes.ts:42` defines two engine IDs. The existing Sound Drawing renderer mixes a scope source, text/SVG sources, and a performance-show layer abstraction; `xyScope` has a distinct multi-source runtime. Distinct sources have different settings, path buffers, reset paths, and beam engines. A single checkbox for "Sound Drawing" cannot automatically harmonize all of these. Root cause: historical feature growth around specialized renderers rather than a shared geometry/feature contract.

### 2. Two different meanings of an audio-responsive XY drawing

In **literal XY**, the music's PCM `L[n],R[n]` *is* the geometry. In **authored reactive vector**, a font/SVG/mesh *is* the geometry and features only control it. Those outputs can look similar but differ in fundamental guarantees. The app correctly supports creative mono-delay XY as a separate label; preserve this precision in UI and export. Root cause of “unreadable under aggressive music” is commonly over-driving an arbitrary raw signal or unrestricted deformation, not a lack of spectral energy.

### 3. Confidence and capability are not the same as a nonzero feature

The `MusicIntelligenceFrame` has `capabilities` and confidence fields; live-input mode explicitly withholds higher-level music structure. A scene director that falls back from unavailable sections to the *same state transitions* using raw volume effectively invents song structure. Use typed fallback semantics per mapping and event, with visible provenance.

### 4. Stroke continuity is a topology problem

Source paths already carry `pathIndex` and independent subpath layout. However, project-wide topology and semantic anchor registry, point identity, drawing-order constraints, collision limits and measurable readability are not unified. Pixel-level postprocessing alone cannot solve this. A source path should remain immutable and reconstructible after every phrase transition, including fully abstracted intermediate frames.

### 5. Legacy randomness and repeated loops

General XY runtime has a fixed 4-second hold and an unseeded choice; Text V2 has a more sophisticated evidence-driven, seeded plan. These must converge through stable event IDs and persisted seeds if the same audio/track/preset should export identically on a second run. Stop reading current frame wall-clock randomness for semantic decisions.

### 6. Existing rendering tech deserves reuse

The phosphor core already implements GPU emission, persistence, bloom and a Canvas fallback. A shared `BeamTrace` adapter can interoperate with both classic and XY presentation without forcing rewriting shaders. Optimization only after measured baselines; avoid replacing the GPU stack because of stylistic differences between screenshots.

## Representative video stills and fidelity goals

| Evidence set | Visible goal | What code must produce | What stills cannot prove |
|---|---|---|---|
| Sound Drawing 1 | sampled waves, triangle/fractal, single point, stroke | correct per-sample coordinate mapping, signal fidelity | exact patch code, DSP coefficients or original audio trace |
| Sound Drawing 2 | point/circle, branching rectangular figure, cube collections | ordered strokes, continuous transforms, projection | precise audio-channel routing or real-time shape parameter values |
| Sound Drawing 4 | glowing square and loudspeaker SVG in DAW | editable text/SVG source plus audio/parameter automation | numerical settings on tiny UI or precise transient envelopes |
| Sound Drawing 6 | heart, polytopes, phaser/reverb effects, Lissajous, 3D | separate genuine XY, authored geometry and sound effects semantics | author claims spoken only in audio, exact relative phase |

### Audit of required behavior by music class

House/tech house: periodic beat events should NOT force unnecessary 4/8-bar cycles; follow confident grid and actual onsets. Melodic bass: harmonic texture can modulate micro-curvature without pulling anchors. Dubstep/tearout: transients can increase beam brightness, duplicate effects and local expansion while readability remains independent of loudness. Drum and bass: fast beats demand refractory/dedupe rules and subdivision budget. Ambient: no false percussion or auto-fabricated drops; low-motion readable scene. Vocals/acoustic: gate semantically unreliable pitch estimates and use volume/phrase changes when known. All are *test cases*, not genre-to-deformation rules.

## Prioritized implementation change register

| Gap ID | Priority | Change | Verification |
| --- | --- | --- | --- |
| SD-P0-01 | P0 | Read-only SoundDrawingAudioContext adapter around AudioFeatureBus, stereo tap and timeline | Source switch, bus authority, live/no markers, same-frame publication tests |
| SD-P0-02 | P0 | Versioned ShapeDocument preserving contour IDs, anchor sets and stroke index | Replay original exact path from any deformed state |
| SD-P0-03 | P0 | Seeded event identity across both engine IDs | Bit-identical decisions under repeated playback/seek/export |
| SD-P0-04 | P0 | Scope/source capability and fallback reason contract | No false stereo/section reports; no accidental stale track data |
| SD-P0-05 | P0 | Golden fixtures for 2-channel PCM and 4 differing musical tracks | Measured errors and annotated visual reviews |
| SD-P1-01 | P1 | Genre-neutral per-source normalization + modulation map | Compare identical preset across loud, quiet and sparse tracks |
| SD-P1-02 | P1 | Readability/geometry constraint solver + recovery | Contour anchor bounds and minimum readable dwell |
| SD-P1-03 | P1 | Shared pen-up/stroke ordering and import diagnostics | No unintended connecting lines; transparent cache misses |
| SD-P1-04 | P1 | Coherent manual/Auto/BPM UI across both engine IDs | Every control changes actual renderer and survives preset reload |
| SD-P2-01 | P2 | Shared BeamTrace adapter + relative quality benchmarks | Visual parity across Canvas and phosphor modes |
| SD-P2-02 | P2 | 3D projected geometry and advanced duplicator | Recognizable rotating cube with 2D projected edges |
| SD-P3-01 | P3 | Shape-to-stereo-PCM synthesis and export | Triangle 120Hz output aligns left/right sample indices; no clipping/alias regression |
