# BLOCKSHIFT Phase 5 — Shared audio reactions and canonical triggers

**Subsequent visual revision:** [Six added cubes](22_FIFTEEN_CUBE_FIELD.md) bring the current field to fifteen objects. This report/evidence records the original Phase 5 nine-object checkpoint; the count-revision report records current geometry/render validation. Audio/trigger implementation remains the same.

2026-10-22. Branch `main`, base `9c2aa74831103c1589e589c8cedc5af5f94f1643`. Implementation remains uncommitted alongside the earlier authorized phases; no commit requested. BLOCKSHIFT remains a normal-catalog reference preview. **Phase 6 has not begun.**

## Implementation

Phase 5 adds eight continuous routes and eight event rules through the existing `Cinema2ChoreographyRuntime`, shared Audio Intelligence bridge and final-value resolver. Optional capabilities are declared for bands/features, vocals, build, sections and the existing rhythm/structural events. There is no new analysis, beat grid, detector, musical scheduler or render loop.

`Cinema2BlockshiftChoreography.ts` maps real supported source paths to internal module channels. Canonical event rules use the established Mainframe-style `spawn` action into a hidden runtime-only Musical Cue parameter, bound to the native module's `handleAction`. The shared runtime owns event selection/identities and dispatch. `Cinema2BlockshiftAudio.ts` owns only bounded visual envelopes, advanced from engine delta time, with bounded duplicate memory. This uses the existing supported action seam; it does not introduce an independent music engine or change persisted Inspector parameters.

The overlay is composed **after** the selected pattern and transition, followed by the existing observer/surface safety constraints. It is never fed back into the underlying pattern pose. No audio rule writes user-authored Size, Spread, Depth, Pattern, Trigger, palette or camera values.

| Shared input | Native consumer |
|---|---|
| Sub band | Outer-object radial pressure, at most 4.5% before user gains/safety; subtle frame emission |
| Bass band | Alternate outer objects move in depth, at most 0.8 world units |
| Mid band | Alternating pitch, at most 10% of Rotation Range |
| High band / spectral flux | Alternating frame glints; highs also add at most 2.5% of Rotation Range as roll |
| Overall energy | Ambient frame-emission level under the authored intensity ceiling |
| Vocal presence | Up to 45% kinetic restraint and center-frame emphasis |
| Build progress | Up to 1.8% radial tension and 0.35-unit opposing height offsets, without changing Pattern |
| Provided section type | Intro/breakdown/outro apply a restrained 0.65 kinetic profile; no local section classification |
| Kick | Center and alternate objects rise up to 0.9 units; canonical kick strength scales the visual envelope |
| Snare | Opposing bank yaw up to 18% of Rotation Range plus frame glint; canonical snare strength scales it |
| Beat / downbeat | Small 0.6% / 1.2% radial accents |
| Bar / phrase | Opposing 5%-of-range yaw / 0.45-unit height sweep |
| Section change | Bounded 4%-of-range pitch and frame emphasis from the shared Director's section-transition context |
| Drop | At most 5.5% radial reveal and frame impact; no pattern override |

Visual envelope release times (seconds to approximately 0.7% of peak) are kick 0.24, snare 0.32, beat 0.16, downbeat 0.45, bar 0.65, phrase 0.95, section 1.1 and drop 0.85. Events take the maximum of the current and new bounded peak, then decay, so simultaneous cues cannot accumulate without bound. Missing optional routes resolve to zero. Frame emission uses the existing packed instance alpha and the actual native shader, retains all five authored color roles and never exceeds the user's Master Intensity multiplier. No bloom is required.

## Controls, safety and transport

**Audio Reactivity** is now visible in **Master Controls**, range 0–1, default 0.80. Zero removes all audio transforms/emission modulation immediately; native pattern motion and separately enabled Pattern Change continue. Motion Amount scales physical audio response; zero holds the current physical/audio pose and consumes queued events without later replay. Explicit manual geometry/color/control edits remain authoritative. Camera Motion and conditional Camera Motion Intensity remain directly in Master Controls; no music camera choreography is introduced here.

Pattern Change OFF holds the authored pattern while ordinary audio reactions continue. All eleven canonical trigger values/labels remain imported unchanged: beat, kick, snare, downbeat, beat2, beat4, bar, bar4, bar8, phrase and drop. The existing canonical resolver and generic pattern controller remain responsible for their meanings. Local BPM Sync changes continuous timing; it does not fabricate musical trigger events.

A resolved trigger is cached per upstream publication/selection. A structural phrase and its coincident clock fallback are treated as one opportunity, including when a held boundary is republished. This fixes the duplicate phrase switch found during P5 testing. Activation, resume and discontinuity frames consume stale visual cues. Source replacement, seek/loop, bus discontinuity and re-entry reset transient state; pause holds the rendered pose and does not queue catch-up movement.

All final poses retain nine stable identities, supplied GLBs and physical sizes, 1.5-unit transformed-box separation, 2.5-unit observer exclusion and the existing 300-unit finite bound. If an extreme audio overlay would exceed that bound, only its displacement/rotation is attenuated by a bounded search; the authored geometry is preserved. Safety tests cover maximum combined continuous/event input across six patterns, geometry extrema and intermediate transitions. This is sampled coverage, not a proof over every continuous input.

## Validation

- **59/59 focused tests PASS**, six files: BLOCKSHIFT Audio, Controls, Motion, Preset; shared ChoreographyRuntime and MainframePatternController. Tests cover real shared bridge/choreography routing, all eleven triggers, activation/duplicate/manual-edit/OFF/pause/resume behavior, structural/fallback deduplication, source/seek reset, held pose at master zero, audio zero, distinct physical kick/snare signatures, vocal restraint, finite geometry/sizes and sampled transition safety. Persistent state stays unchanged by music.
- **Focused ESLint PASS** on affected source, tests, browser fixtures and scripts.
- **Scoped TypeScript:** zero changed-file diagnostics, nine known diagnostics in unchanged dependencies (same baseline as P4). Repository-wide failing typecheck/build were not repeated. The focused browser entry is freshly bundled with Vite.
- **Final production browser PASS:** normal chooser and successful GLB fetches; wide/square/portrait static output; four instanced batches/nine objects; no reported page/GL errors; stable resource disposal/re-entry. Camera toggle/intensity remain in Master Controls and authored camera settings survive re-entry.
- **Fourteen upstream audio profiles PASS:** silence, verse, bass, mids, highs, vocals, build, kick, snare, downbeat, bar, phrase, section and drop. At fixed transport/camera, every active profile visibly differs from Audio Reactivity zero. Bass/mids/build and all physical event profiles also change actual uploaded transforms. Kick and snare have distinct GPU signatures. Decay is observed; pause/master zero freeze actual pixels; source reset remains healthy.
- **All eleven trigger ON/OFF comparisons PASS on actual GPU output and pixels**, with Audio Reactivity zero to isolate pattern selection. Persisted Pattern remains Stagger in both runs; the event-selected runtime pattern alone changes. No private event injection or authored Pattern mutation is used.
- Fixtures explicitly publish synthetic `MusicIntelligenceFrame` data through `AudioFeatureBus`; they exercise the production bridge, choreography, catalog/module and GLB renderer. They do not claim real-song analysis quality or hardware performance. The final browser bundle includes the phrase deduplication fix and valid fixture provenance. Prior failing trigger cases were repaired and the focused suite rerun; known broad repository failures were not repeated.

Implementation files: `modules/blockshift/Cinema2BlockshiftAudio.ts`, `presets/Cinema2BlockshiftChoreography.ts`, native module, preset revision 9 and native frame shader. Focused tests and `Cinema2BlockshiftAudioFixtures.ts` cover the shared signal path. `Cinema2BlockshiftAudioBrowserFixture.tsx` and `scripts/cinema2-blockshift-audio.mjs` extend the existing production entry/runner.

Reproduce with Node 22: `npm run test:e2e:cinema2-blockshift:p5`. Focused unit command: `vitest run src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftControls.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftMotion.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2ChoreographyRuntime.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MainframePatternController.test.ts`.

## Remaining scope

Director **significance gain**, Auto Performance and manual-takeover overlays remain Phase 6. Bloom, camera finishing and hardware performance/context-loss review remain Phase 7. Final keeper/release acceptance and human review of motion with real music remain outstanding. The preview can now be inspected and tuned with a loaded source in the normal application; fixture evidence is not a release sign-off.

## Evidence and gate

[Motion/reaction recording](evidence/p5-audio/phase5-audio.webm) · [Audio comparison frames](evidence/p5-audio/audio-filmstrip.png) · [Normal application view](evidence/p5-audio/production-inspector.png) · [Audio/trigger acceptance JSON](evidence/p5-audio/audio-acceptance.json) · [Evidence notes and logs](evidence/p5-audio/README.md).

Source/diff and captures were reviewed for scope and unintended changes; `git diff --check` passed. Phase 5 introduces no changes to the shared camera, compiler or global choreography engine beyond the existing earlier-phase working tree. The user-edited root creation contract was preserved.

**Gate: engineering PASS for Phase 5 review.** Implementation, focused checks and documentation are complete; human music/visual review and final keeper acceptance remain pending. No Phase 6 work or commit was performed.
