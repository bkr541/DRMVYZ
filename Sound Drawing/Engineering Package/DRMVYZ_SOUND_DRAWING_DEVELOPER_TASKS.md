# DRMVYZ SOUND DRAWING: ACTIONABLE DEVELOPER TASKS

# Evidence protocol and source boundary

**Audit date:** 2026-11-16. **Primary code evidence:** uploaded `DRMVYZ-main (3)(1).zip`; root paths in citations are relative to `DRMVYZ-main/`. **Guide:** `Sound_Drawing_Complete_Recreation_Guide(1).md` (1,499 lines). **Visual references:** the eight submitted screenshot/storyboard JPEG files covering Sound Drawings 1, 2, 4 and 6. **Unavailable in this turn:** the four original `.mov` recordings, a separate instructional-package ZIP, actual audio tracks, a running packaged Electron app and installed `node_modules`. No tests, build, benchmark, media-output comparison or live UI operation was executed. Static inspection verifies code paths and conditions, **not** runtime correctness on a particular device.

Statuses: **EXISTS** = code plus inspected connection to a consumer; **REUSABLE** = existing suitable module; **PARTIAL** = partial implementation or missing integration, without asserting failure; **BROKEN** = demonstrable code defect with explicit reproduction hypothesis; **DUPLICATED** = overlapping implementations; **MISSING** = no implementation found after targeted source search, subject to runtime validation; **UNKNOWN** = cannot establish conclusively; **NEW COMPONENT** = proposed engineering work. A UI field or label alone does not prove functional behavior.

The guide distinguishes **literal stereo XY** (left and right PCM at the same sample index) from **author-created vectors modulated by arbitrary tracks**. They must not be conflated. Guide video attributions [V1–V4] are *visual observations/reconstruction*, and [ENGINEERING] denotes interpretation or proposed design rather than verified spoken narration. The supplied screenshots support scene shapes (circle, cubes, wireframes, glowing contours, Ableton/osci-render) but **cannot establish inter-frame timing or exact DSP parameter values**.

## Ticket rules

Every ticket below is an implementable work unit **conditioned on first running the baseline**; the file paths are actual unless explicitly labeled `NEW`. `.../core/` abbreviates `src/components/vyzualz/react/soundDrawing/core/`. Preserve both engine IDs, older preset state and existing interfaces. Don't delete old rendering paths until golden tests prove parity. Order dependencies before dependent work. Complete tickets with code, tests, acceptance screenshots/traces, perf impact and rollback notes. P0 and P1 constitute the first supported product milestone.

| ID | Priority | Phase | Task | Dependencies |
| --- | --- | --- | --- | --- |
| SD-001 | P0 | 0 | Baseline static source maps and golden frame fixtures | none |
| SD-002 | P0 | 0 | Stereo scope source contract acceptance | SD-001 |
| SD-003 | P0 | 1 | Single readonly audio adapter | SD-001, SD-002 |
| SD-004 | P0 | 1 | Scoped publisher ownership, safe partial updates | SD-003 |
| SD-005 | P0 | 1 | Canonical clock and event IDs | SD-003 |
| SD-006 | P0 | 2 | Immutable ShapeDocument + topology IDs | SD-001 |
| SD-007 | P0 | 2 | Renderer-neutral trace and pen-up semantics | SD-006 |
| SD-008 | P0 | 0 | Deterministic XY text choice and source resumption | SD-001 |
| SD-009 | P0 | 0 | Cross-engine test for BPM and Auto controls | SD-001 |
| SD-010 | P1 | 2 | SVG import error and cached source status | SD-006 |
| SD-011 | P1 | 2 | Adaptive vector resampling and bounds | SD-006 |
| SD-012 | P1 | 3 | Quantile normalization and silence policies | SD-003 |
| SD-013 | P1 | 3 | Typed per-feature modulation matrix | SD-003, SD-012 |
| SD-014 | P1 | 3 | Anchor registry and geometry constraints | SD-006, SD-013 |
| SD-015 | P1 | 3 | Readability score and reversible recovery | SD-014 |
| SD-016 | P1 | 4 | Seeded musical choreography director | SD-005, SD-015 |
| SD-017 | P1 | 4 | Master Auto and BPM contracts | SD-009, SD-016 |
| SD-018 | P1 | 4 | Share live effective values, diagnostics | SD-003, SD-016 |
| SD-019 | P2 | 5 | Beam/GPU fidelity comparison adapter | SD-007 |
| SD-020 | P2 | 5 | 3D wireframe to continuous XY paths | SD-006, SD-011 |
| SD-021 | P2 | 5 | Duplicator, echo, local FM artistic effects | SD-014, SD-019 |
| SD-022 | P2 | 6 | Performance/quality telemetry + soak | SD-019 |
| SD-023 | P3 | 5 | Independent shape-to-stereo PCM DSP | SD-006, SD-011 |
| SD-024 | P3 | 5 | Stereo XY WAV export + independent validation | SD-023 |
| SD-025 | P3 | 6 | Versioned portable preset bundle | SD-017, SD-020 |
| SD-026 | P3 | 6 | Full multigenre and accessibility acceptance | SD-015, SD-022, SD-025 |
| SD-027 | P3 | 6 | Reference frame reconstruction as opt-in offline tool | SD-006, SD-015 |

## SD-001 [P0] Baseline static source maps and golden frame fixtures

**Phase:** 0 | **Depends on:** none.

**Existing code / interface:** `Source maps above; existing scope unit tests`.

**Change these existing modules:** `No production code in first PR`.

**Create (NEW):** `scripts/sound-drawing-golden.mjs`.

**Implementation objective and algorithm:** Capture rendered screenshots and source/analyser status from both engine IDs, record hashes and scene parameters.

**Tests/verification:** Run 44.1k,48k,96k static stereo fixture and SVG text, identify skipped cases.

**Acceptance criteria:** At least one reproducible checkpoint for each engine ID and source. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-002 [P0] Stereo scope source contract acceptance

**Phase:** 0 | **Depends on:** SD-001.

**Existing code / interface:** `StereoScopeAudioTap.ts:64-185; ScopeSignalCore.ts:120-263`.

**Change these existing modules:** `StereoScopeAudioTap.ts, scope status UI if needed`.

**Create (NEW):** `src/audio/scope/__tests__/stereoScopeSourceContract.test.ts`.

**Implementation objective and algorithm:** Test channel labels, startFrame alignment, disconnected/mono case, ring reset and drop accounting.

**Tests/verification:** Synthetic L=sin,R=cos; mono; missing channel; gap injection.

**Acceptance criteria:** Exact pair index and channel labels, no extra connection lines. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-003 [P0] Single readonly audio adapter

**Phase:** 1 | **Depends on:** SD-001, SD-002.

**Existing code / interface:** `AudioFeatureBus.ts:57-120; types.ts:233-280`.

**Change these existing modules:** `XyScopeSurface.tsx and ReactPlaceholderCanvas.tsx adapters`.

**Create (NEW):** `.../core/SoundDrawingAudioAdapter.ts`.

**Implementation objective and algorithm:** Read MIFrame once per frame, read stereo tap only when needed, expose immutable provenance and status.

**Tests/verification:** Unit synthetic bus; integration file/live; stale publisher.

**Acceptance criteria:** Identical canonical features across presentations and no source leakage. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-004 [P0] Scoped publisher ownership, safe partial updates

**Phase:** 1 | **Depends on:** SD-003.

**Existing code / interface:** `AudioFeatureBus.ts:81-119; MusicIntelligenceAnalyserFramePump.ts:126-208`.

**Change these existing modules:** `AudioFeatureBus.ts only if regression demonstrates bug`.

**Create (NEW):** `.../core/__tests__/PublisherAuthority.test.ts`.

**Implementation objective and algorithm:** Model frame vs partial publication and test live-input authority; preserve existing metadata updates when safe.

**Tests/verification:** Concurrent frame/partial update in StrictMode and on engine switch.

**Acceptance criteria:** No foreign full frame replaces authoritative mic and no false double beat event. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-005 [P0] Canonical clock and event IDs

**Phase:** 1 | **Depends on:** SD-003.

**Existing code / interface:** `XyScopeTransport.ts; authoritativeTimeline.ts; MIFrame.rhythm`.

**Change these existing modules:** `XyScopeRuntime.ts; SoundDrawingPerformanceEngine.ts`.

**Create (NEW):** `.../core/SoundDrawingClock.ts`.

**Implementation objective and algorithm:** Event key source+revision+boundary index; reset on seek/loop; no independent competing beat clock.

**Tests/verification:** Loop, seek, pause resume, non-4/4, live no-sections.

**Acceptance criteria:** Exactly once event per boundary and no fabricated live structural cues. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-006 [P0] Immutable ShapeDocument + topology IDs

**Phase:** 2 | **Depends on:** SD-001.

**Existing code / interface:** `XyScopeGeometry.ts:81-256; XyScopeSvg.ts:7-58`.

**Change these existing modules:** `Existing compilers adapter only`.

**Create (NEW):** `.../core/ShapeDocument.ts`.

**Implementation objective and algorithm:** Normalized typed path groups, stable contour/stroke/letter IDs, no mutation during deformation.

**Tests/verification:** Text glyph holes, SVG multiple subpaths, open lines.

**Acceptance criteria:** Original reference hash same after any performance render. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-007 [P0] Renderer-neutral trace and pen-up semantics

**Phase:** 2 | **Depends on:** SD-006.

**Existing code / interface:** `SoundDrawingRenderer.ts:1694-1743; XyScopeBeam.ts`.

**Change these existing modules:** `SoundDrawingRenderer.ts and XY runtime adapters`.

**Create (NEW):** `.../core/BeamTrace.ts`.

**Implementation objective and algorithm:** Encode typed XY, stroke gaps, dwell and source provenance as shared trace interface.

**Tests/verification:** Compare Canvas/GPU and XY images for same contour; break on gap.

**Acceptance criteria:** No accidental edge between disconnected strokes. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-008 [P0] Deterministic XY text choice and source resumption

**Phase:** 0 | **Depends on:** SD-001.

**Existing code / interface:** `XyScopeRuntime.ts:58-59, 250-257; TextV2Performance.ts:191-200`.

**Change these existing modules:** `XyScopeRuntime.ts`.

**Create (NEW):** `.../core/__tests__/SeededWordSelection.test.ts`.

**Implementation objective and algorithm:** Replace Math.random select and fixed unrequested hold with event-seeded optional transition policy.

**Tests/verification:** Run same audio and state twice; seek/reload exact frame state.

**Acceptance criteria:** Identical chosen words with same seed and event history. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-009 [P0] Cross-engine test for BPM and Auto controls

**Phase:** 0 | **Depends on:** SD-001.

**Existing code / interface:** `ReactEnginePanel.tsx; XyScopeSettings.ts; reactStore.ts`.

**Change these existing modules:** `Unit tests around engine UI`.

**Create (NEW):** `.../core/__tests__/MasterControlsParity.test.tsx`.

**Implementation objective and algorithm:** Trace Audio Dock and engine-level BPM Sync plus effective controls and persisted options.

**Tests/verification:** Toggle each while beat clock active, while paused, Auto disabled.

**Acceptance criteria:** Report actual behavior and regressions for two IDs without semantic guessing. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-010 [P1] SVG import error and cached source status

**Phase:** 2 | **Depends on:** SD-006.

**Existing code / interface:** `XyScopeSvg.ts:11-29; SoundDrawingRenderer.ts:637-668`.

**Change these existing modules:** `SoundDrawingRenderer.ts; XyScopeWorkspace.tsx`.

**Create (NEW):** `.../core/__tests__/SourceFallback.test.ts`.

**Implementation objective and algorithm:** Differentiate pending/invalid/deleted/cache miss; preserve prior source or show explicit missing source instead of circle.

**Tests/verification:** Invalid SVG, stale cache, oversized SVG, removed asset.

**Acceptance criteria:** No silent artwork substitution on new mode; legacy compatibility documented. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-011 [P1] Adaptive vector resampling and bounds

**Phase:** 2 | **Depends on:** SD-006.

**Existing code / interface:** `XyScopeGeometry.ts:108-208; SVG compiler`.

**Change these existing modules:** `XyScopeGeometry.ts adapter`.

**Create (NEW):** `.../core/PathCompiler.ts`.

**Implementation objective and algorithm:** Arc-length sampling with viewport error/dwell budget, cap adaptively by quality tier.

**Tests/verification:** Complex SVG 2048+ vertices, scaled viewport, loops/holes.

**Acceptance criteria:** Same topology and visual landmarks at 512/2048/4096 points. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-012 [P1] Quantile normalization and silence policies

**Phase:** 3 | **Depends on:** SD-003.

**Existing code / interface:** `bandAnalysis.ts:21-164; energyAnalysis.ts:68-179`.

**Change these existing modules:** `SoundDrawingAudioAdapter.ts`.

**Create (NEW):** `.../core/SourceRelativeNormalizer.ts`.

**Implementation objective and algorithm:** P10/P90 per band, rolling baseline and silence freeze; no genre labels.

**Tests/verification:** Low/loud mastered tracks, long silence, reentry, source switch.

**Acceptance criteria:** Same preset has bounded response without full-scale saturation. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-013 [P1] Typed per-feature modulation matrix

**Phase:** 3 | **Depends on:** SD-003, SD-012.

**Existing code / interface:** `scopeMusicMapping.ts:20-135; SoundDrawingPerformanceEngine.ts:646-816`.

**Change these existing modules:** `Existing mapping callsites only via adapter`.

**Create (NEW):** `.../core/SoundDrawingModMatrix.ts`.

**Implementation objective and algorithm:** Target envelopes per feature, confidence gate, min/max and auto/manual isolation.

**Tests/verification:** Test kick->width, snare->brightness, bass->local scale.

**Acceptance criteria:** No single generic energy control replaces all mappings. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-014 [P1] Anchor registry and geometry constraints

**Phase:** 3 | **Depends on:** SD-006, SD-013.

**Existing code / interface:** `XyScopeGeometry.ts; OSC1 engine; Text V2 geometry`.

**Change these existing modules:** `XyScopeRuntime.ts adapters`.

**Create (NEW):** `.../core/ConstrainedDeformer.ts`.

**Implementation objective and algorithm:** Per-glyph anchor constraints, contour continuity, gap and counter-area collision tests.

**Tests/verification:** Generate extreme transient input on word with A/O/R/S.

**Acceptance criteria:** Source lettering readable at default and topology stable. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-015 [P1] Readability score and reversible recovery

**Phase:** 3 | **Depends on:** SD-014.

**Existing code / interface:** `TextV2Trajectory.ts; XyScopeChoreography.ts`.

**Change these existing modules:** `Text V2 and classic adapters`.

**Create (NEW):** `.../core/ReadabilityGuard.ts`.

**Implementation objective and algorithm:** Landmark displacement + contour overlap + hole area with constraint projection and source lerp.

**Tests/verification:** Back-to-back transient and hard stop; validate perceptual review.

**Acceptance criteria:** Exact source contour after release, min recognizable time validated. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-016 [P1] Seeded musical choreography director

**Phase:** 4 | **Depends on:** SD-005, SD-015.

**Existing code / interface:** `TextV2Performance.ts:94-191; XyScopeChoreography.ts`.

**Change these existing modules:** `XyScopeRuntime.ts; SoundDrawingPerformanceEngine.ts`.

**Create (NEW):** `.../core/ChoreographyDirector.ts`.

**Implementation objective and algorithm:** READABLE, ACCENT, BUILD, ABSTRACT, REASSEMBLE, REST; event-keyed PRNG, recency filter.

**Tests/verification:** Repeated playback, high-confidence section, low-confidence mic.

**Acceptance criteria:** State/event trace reproducible, bounded abstract intervals. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-017 [P1] Master Auto and BPM contracts

**Phase:** 4 | **Depends on:** SD-009, SD-016.

**Existing code / interface:** `ReactEnginePanel.tsx; XyScopeWorkspace.tsx; reactStore.ts`.

**Change these existing modules:** `ReactEnginePanel.tsx; XyScopeWorkspace.tsx`.

**Create (NEW):** `.../core/__tests__/AutoManualToggle.test.tsx`.

**Implementation objective and algorithm:** Single user-facing Master Auto semantics without removing separate engine-specific looks; Snap-to-beat controls motion only.

**Tests/verification:** Manual baseline value before/after Auto; two toggle positions.

**Acceptance criteria:** Auto Off preserves baseline, sync applied only when valid clock. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-018 [P1] Share live effective values, diagnostics

**Phase:** 4 | **Depends on:** SD-003, SD-016.

**Existing code / interface:** `Existing live publish methods; scope status`.

**Change these existing modules:** `XyScopeSurface.tsx; ReactEnginePanel.tsx`.

**Create (NEW):** `.../core/SoundDrawingDiagnostics.ts`.

**Implementation objective and algorithm:** At 5-10Hz publish status and provenance to inspector; no React full-frame updates.

**Tests/verification:** Simulate missing stereo, low-confidence beat, dropped blocks.

**Acceptance criteria:** User sees accurate mode/state/source and no render-loop rerender storm. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-019 [P2] Beam/GPU fidelity comparison adapter

**Phase:** 5 | **Depends on:** SD-007.

**Existing code / interface:** `ScopePhosphorRuntime.ts; XyScopeBeam.ts; ScopePhosphorQualityController.ts`.

**Change these existing modules:** `Only backend adapters`.

**Create (NEW):** `.../core/BeamRenderAdapters.ts`.

**Implementation objective and algorithm:** GPU/Canvas/XY consume same BeamTrace, frame-rate-independent decay and dwell.

**Tests/verification:** Golden images at 30/60/120Hz and HDR fallback.

**Acceptance criteria:** Stable centerline and bounded luminance differences. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-020 [P2] 3D wireframe to continuous XY paths

**Phase:** 5 | **Depends on:** SD-006, SD-011.

**Existing code / interface:** `Three.js; Cinema2 meshes`.

**Change these existing modules:** `XyScopeWorkspace.tsx source picker`.

**Create (NEW):** `.../core/ProjectedMeshPaths.ts`.

**Implementation objective and algorithm:** Mesh edges camera transform, clip, hidden-edge policy, order into disjoint contours.

**Tests/verification:** Rotating cube, intersecting meshes, motion under different viewpoints.

**Acceptance criteria:** Recognizable 3D projected edges and stable identities. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-021 [P2] Duplicator, echo, local FM artistic effects

**Phase:** 5 | **Depends on:** SD-014, SD-019.

**Existing code / interface:** `OSC1/OSC2 and legacy trace duplication`.

**Change these existing modules:** `Existing renderers parameter adapters`.

**Create (NEW):** `.../core/VectorEffects.ts`.

**Implementation objective and algorithm:** Deterministic duplicates with individual opacity/gap, bounded local harmonic displacement.

**Tests/verification:** 8 duplicates with 60fps, stereo and mono.

**Acceptance criteria:** Original outline remains readable and undisturbed under default. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-022 [P2] Performance/quality telemetry + soak

**Phase:** 6 | **Depends on:** SD-019.

**Existing code / interface:** `Existing renderer stats, scope tap status and quality controller`.

**Change these existing modules:** `ReactView.tsx perf hook`.

**Create (NEW):** `.../core/QualityMonitor.ts`.

**Implementation objective and algorithm:** Frame CPU/GPU capture, buffer drops, backlog, dynamic glow/resolution quality tiers.

**Tests/verification:** 30-min file DJ set, 30-min live mic and 10 source switches.

**Acceptance criteria:** No unbounded memory; quality recovers after load drops. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-023 [P3] Independent shape-to-stereo PCM DSP

**Phase:** 5 | **Depends on:** SD-006, SD-011.

**Existing code / interface:** `ScopeSignalCore sample frame concept; ShapeDocument`.

**Change these existing modules:** `No existing audio graph replaced`.

**Create (NEW):** `src/audio/scope/ShapeToXyAudioSynth.ts; public/worklets/shape-to-xy-processor.js`.

**Implementation objective and algorithm:** Fractional sample phase and arc-length LUT, anti-aliased transition, safe gain/mute.

**Tests/verification:** 120Hz circle/triangle, 44.1k/48k/96k, Nyquist sweep.

**Acceptance criteria:** Output sample pair produces expected shape; existing track playback untouched. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-024 [P3] Stereo XY WAV export + independent validation

**Phase:** 5 | **Depends on:** SD-023.

**Existing code / interface:** `New XY synthesizer; existing media/export components`.

**Change these existing modules:** `Optional export UI`.

**Create (NEW):** `src/audio/scope/xyPcmWavExport.ts`.

**Implementation objective and algorithm:** Offline render Float32 L/R, scale, clamp, WAV encode, verify with independent scope.

**Tests/verification:** Export 5s WAV and import back into test viewer; measure SNR.

**Acceptance criteria:** Round-trip aligns sample phase with shape reference. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-025 [P3] Versioned portable preset bundle

**Phase:** 6 | **Depends on:** SD-017, SD-020.

**Existing code / interface:** `reactStore.ts:6164-6401 and legacy migration`.

**Change these existing modules:** `reactStore.ts; store tests`.

**Create (NEW):** `.../core/SoundDrawingPresetBundle.ts`.

**Implementation objective and algorithm:** Serialize shape source/hash, source-specific controls, mapping, seed, geometry version and asset provenance.

**Tests/verification:** Import/export old, new and missing font/media.

**Acceptance criteria:** No lost user content and visual reproducibility for matching inputs. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-026 [P3] Full multigenre and accessibility acceptance

**Phase:** 6 | **Depends on:** SD-015, SD-022, SD-025.

**Existing code / interface:** `Existing audio golden, all new core tests`.

**Change these existing modules:** `No production change unless failure found`.

**Create (NEW):** `scripts/sound-drawing-acceptance.mjs`.

**Implementation objective and algorithm:** Fixtures for house, dubstep, melodic bass, DnB, ambient, vocal and synthetic PCM; human legibility reviews.

**Tests/verification:** Compare repeatability, flash limits, FPS, readability, source switch.

**Acceptance criteria:** Published measured report with known failures and signed-off waivers. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## SD-027 [P3] Reference frame reconstruction as opt-in offline tool

**Phase:** 6 | **Depends on:** SD-006, SD-015.

**Existing code / interface:** `Guide §28; existing SVG compiler`.

**Change these existing modules:** `Media Manager import path (future)`.

**Create (NEW):** `.../core/ReferenceFrameFitter.ts`.

**Implementation objective and algorithm:** Fit stable SVG-like path trajectories to user reference frames using registered landmarks and regularization; not built from stills alone.

**Tests/verification:** Ground truth synthetic rotating stroke fixture with timecodes.

**Acceptance criteria:** Editable deterministic vector keyframes; no claim of exact unknown source DSP. Any numerical threshold not established by existing code is a proposed validation target until independently measured; save logs and test assets.

**Developer handoff:** Include a concise source-diff summary, screenshots/sample arrays as appropriate, paths and line ranges for modified symbols, rollback procedure, and reason for any change to a public/persisted setting.

## Suggested PR sequence and dependency management

- **PR A:** SD-001, SD-002, SD-009. Audit-only and tests, establish change-control baseline.
- **PR B:** SD-003, SD-004, SD-005. Read-only shared feature and event contracts.
- **PR C:** SD-006, SD-007, SD-008, SD-010, SD-011. Source-path identity, deterministic text, backend-neutral geometry.
- **PR D:** SD-012 through SD-015. Normalization and bounded per-glyph response; ship MVP validation.
- **PR E:** SD-016 through SD-018. Unified choreographic state with manual controls and inspector diagnostics.
- **PR F:** SD-019 through SD-022. Visual parity, 3D projection and performance tiers (optional before initial release).
- **PR G:** SD-023, SD-024, SD-025, SD-026, SD-027. Separate PCM generation/export, portability and full production qualification.

**Never enable unsupported automatic section behavior on live-input frames as a shortcut.** Use tempo/onset-only controls with confidence gates, then allow authoritative manual cues if the user adds them. Do not introduce direct use of raw left/right PCM into geometry deformations as a replacement for the source's immutable path. The guide's separation of the two systems is non-negotiable.
