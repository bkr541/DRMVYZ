# Inertia — implementation and final acceptance report

Date: 2026-10-29  
Preset ID: `drmvyz.cinema2.inertia`  
Manifest revision: 6  
Status: complete and user-approved. Automated production acceptance passed, and the user granted final human visual acceptance with “All approved.” on 2026-10-29. Inertia is registered as a first-party keeper; the review-candidate description and tag have been removed.

## Use Inertia

Open Cinema 2.0's **SYSTEM** preset list and select **Inertia**. Its stable manifest ID is registered in the normal first-party catalog; no external asset download is needed. Inertia is available as an approved first-party preset.

The default appearance preserves the approved black-and-white dotted sphere and surrounding lattice. With no active track it stays in its authored static pose. During playback, native motion follows the selected Pattern and shared music provides bounded force/recovery. Palette, sizes, density, camera framing, and user ceilings remain authored state.

- **BPM Sync:** locks native timing only when host Sync is also enabled. OFF uses authored seconds while musical response remains available. Missing usable shared timing falls back to seconds.
- **Motion Amount:** geometric motion allowance; zero stops geometric motion, including musical recoil. **Deformation** limits nonrigid cage behavior. **Damping** reduces recoil and shapes native follow-through.
- **Audio Response:** musical modulation strength; zero preserves native motion and does not turn Pattern Change off.
- **Pattern Change:** OFF by default. When ON, the selected canonical Trigger advances the runtime base among the six authored Patterns. Manual Pattern selection takes effect immediately, leaves Pattern Change ON, and holds until the next fresh qualifying event.
- **Auto Performance:** OFF by default. Allows finite build/drop presentations, with manual takeover and automatic return to the maintained base. It does not own palette, camera, sizes, density, effect enables, or the saved Pattern/Trigger settings.
- **Bloom / Trails:** both OFF by default. Their amount controls appear only while enabled. Maximum amounts are 0.35 bloom and 0.20 trails. OFF retires the effect; trail history is released rather than resurfacing later.

Patterns are Reference Cycle, Countertwist, Breathing Cage, Torsion Wave, Slice Shear, and Collapse / Release. Five independent palette colors address Background, Lattice, Core, Anchors, and Ribs. All Design-inspector controls resolve under Master Controls, Design, Effects, or Palette using existing generic definitions and shared typography.

## Remaining phases delivered

### Phase Six — Director meaning

Four optional routes deliver shared `director.intensity`, `director.momentum`, `director.build`, and `director.impact` into resolved native targets. They use 180/220/200/90ms shared smoothing respectively. Inertia contains no replacement Director implementation or local significance detector.

- Intensity/momentum scale the existing musical drive by at most 15% × Audio Response, then clamp it to 1. This adds nuance without exceeding Motion Amount.
- Build significance increases the existing compression envelope by at most 15% × Audio Response, clamped to its established maximum.
- Impact significance strengthens the existing drop-release envelope by at most 15% × Audio Response, clamped to its established maximum. It does not dispatch a second drop or add a second force.
- Unavailable meaning adds no gain. Audio Response zero gates Director enhancement. No Director route replaces the user's Pattern, palette, camera, placement, density, or effect authorization.

A diagnostic production comparison removes only these four authored routes while keeping the same real renderer, runtime, and shared audio. The enhanced and unenhanced outputs differ perceptibly while retaining the same geometry vocabulary and bounds.

### Phase Seven — Auto Performance

The native base-pattern controller remains independent of the temporary performance controller. All selected performance values pass through the module's declared `performancePattern` target using the normal final-value resolver. Temporary contributions do not modify persistent Pattern, Pattern Change, Trigger, or other user parameters.

| Condition | Temporary presentation | End / restoration |
| --- | --- | --- |
| New shared build entry with adequate shared build confidence | Countertwist | Ends when build ends, a drop supersedes it, or eight shared beats/five seconds expire, whichever is earlier |
| New canonical shared drop event | Collapse / Release | Ends after at most four shared beats/two seconds, whichever is earlier |
| Manual Pattern edit/reselection | Immediate authored base | Cancels current override and fences already-present build/drop; only a separately fresh event can start another |
| Auto Performance OFF or Audio Response zero | Current maintained base | No hidden automatic re-enable |
| Pause, source/timeline/context discontinuity | Clear temporary override | Existing events cannot replay on resume/re-entry |

Pattern Change continues advancing the underlying base during a visible override. On expiry, the **current** base resumes, including valid advancements during that interval. Enabling automation during an already-held build does not immediately seize the Pattern. A held build cannot repeatedly restart expired authority. Runtime event history is bounded.

Build truth comes from available shared build progress/confidence and section identity, not a local energy threshold. Drop identities come from the canonical shared resolver. The controller owns only a documented temporary visual domain; it creates no new musical facts.

### Phase Eight — restrained finishing

The render graph is: native world scene -> shared feedback trails -> shared bloom -> output. Disabled effects bypass normally. Bloom and trails are schema-bound to their own enables/amounts; no audio or Director rule can enable them or exceed the amount.

- Bloom uses a small radius (1.4), threshold 0.12, intensity 0.7, and user mix 0–0.35. It adds a restrained highlight halo without merging the point lattice.
- Trails use persistence 0.70, no spatial drift, transport-aware history, and user mix 0–0.20. Disabling or zeroing retires the effect and releases history. Pause/source discontinuities bypass/reset temporal content through shared services.
- Scene geometry, transparent depth-read policy, fixed orthographic camera, core identity, and monochrome defaults are unchanged. No atmosphere, extra lighting rig, moving camera, depth blur, or distortion was added without a visual purpose.

### Phase Nine — production acceptance

The final implementation passed **37 focused unit tests**: 3 static geometry/manifest tests, 5 native timing/control tests, and 29 shared audio/choreography/Director/Auto Performance tests. Coverage includes bounds/topology; actual target delivery; force/recoil settlement; all 11 canonical events; duplicate suppression; manual same-value reselection; pause/source/reset rules; Director bounds; finite override expiry; underlying progression/restoration; and fully consumed final controls. The finished manifest also passes keeper-level authoring conventions, and its catalog role is now keeper following final user approval.

Final production browser passes contain **157 perceptual comparisons/checkpoints**:

| Evidence | Count | Main coverage |
| --- | --- | --- |
| [Final controls/motion report](../artifacts/inertia-final-controls/report.json) | 51 | Six moving Patterns; 15 cross-pattern pairs; numeric min/default/max; five independent colors; shared tempo; manual controls; actual Inspector hierarchy/portals; quality-dependent density |
| [Final audio/event report](../artifacts/inertia-final-audio/report.json) | 77 | Continuous/rhythmic/structural response; Audio Response limits; all 11 Trigger meanings; held/duplicate suppression; manual reselection; pause/resume; seek/loop; analysis/track replacement; re-entry; actual soundtrack delivery |
| [Director/automation/effects/lifecycle report](../artifacts/inertia-final/report.json) | 28 | Temporary overrides and restoration; Director comparison; effect OFF/normal/max; hard disable and trail retirement; multiple aspect ratios; context loss/restoration; actual Inspector and DPR 2 at every quality tier |
| [Additional review/framing report](../artifacts/inertia-final/review-report.json) | 1 | Supported 16:10 output, completing the output control's aspect-ratio set; real-canvas preview export |

These counts exclude additional non-pixel assertions in the runners. They do not count historical phase passes again. The final manual/audio passes ran against the finished render graph and Director routes. The last additional unit cases cover finite build expiry and same-value reselection during automatic overrides; no production change followed those tests.

All six production output aspect options are covered: 16:9, 16:10, 4:3, 3:2, 1:1, and 9:16. Extra portrait and ultrawide cases were also inspected. Combined size/deformation/sprite extremes retain safe padding. Low/medium/high native sampling and DPR 2 output render successfully. WebGL context loss/restoration recreated the module with one active resource owner, and preset re-entry retired the previous RAF/context owner.

Real playback used the reference video's extracted soundtrack, Web Audio PCM, the existing canonical analyzer frame pump/engine, AudioFeatureBus, and Cinema 2.0's bridge. The final pass recorded eight snapshots and 143 shared analyzer samples, with nonzero resolved energy/bass. Deterministic shared fixtures cover structural events whose offline timeline cannot be recovered merely from the short recording. No soundtrack BPM or source implementation was invented.

Type checking, targeted ESLint, and diff whitespace checks passed. Full unrelated repository suites/builds were not needed. Production performance snapshots reported no degradation and remained within the engine budgets: for example, the balanced 954px scene used approximately 7.34 MB of pooled render targets plus its small native buffers. Measured frame timings are machine/run-specific diagnostics, not a guaranteed frame rate.

## Final visual review artifacts

- [Six-second native preview](../artifacts/inertia-final/inertia-review.mp4) — 720 × 720, 90 real production-canvas frames at 15 fps; shared synthetic build/drop inputs, silent. This demonstrates the authored implementation, not recovered soundtrack synchronization.
- [Director-enhanced hero](../artifacts/inertia-final/director-enhanced.png)
- [Auto build](../artifacts/inertia-final/auto-build.png), [auto drop](../artifacts/inertia-final/auto-drop.png), [underlying base restored](../artifacts/inertia-final/auto-restored.png)
- [Clean artwork](../artifacts/inertia-final/effects-off.png), [maximum allowed bloom](../artifacts/inertia-final/bloom-max.png), [maximum allowed trails](../artifacts/inertia-final/trails-0.2.png)
- [Final Pattern dropdown](../artifacts/inertia-final/inspector-pattern-menu.png), [effects and five-color palette](../artifacts/inertia-final/inspector-effects-palette.png)
- [DPR 2 / high quality](../artifacts/inertia-final/dpr2-high.png), [restored graphics context](../artifacts/inertia-final/context-restored.png)
- [Final real soundtrack capture](../artifacts/inertia-final-audio/real-soundtrack.png) and [audio provenance](../artifacts/inertia-final-audio/real-audio-report.json)

Captures were visually inspected for core readability, point-row structure, bright anchors, safe framing, restrained finishing, and readable shared Inspector controls. Reference identity was accepted through the preceding phases. The user subsequently approved the complete performance on 2026-10-29, satisfying the final human review requirement in Section 20 of the creation contract.

Intentional reference differences remain explicit: procedural cube-surface reconstruction rather than known source topology; a sampled sphere silhouette for legibility; six authored patterns rather than a recovered source algorithm; independently configurable colors with a monochrome default; bounded shared musical response; and optional finishing. The recording UI is excluded. Camera/object ambiguity was resolved as object motion under a fixed orthographic camera. No legacy preset was ported, so a legacy engine A/B is inapplicable; supplied-video comparison is the visual reference.

## Reproduce checks

```sh
npx vitest run --config vitest.node.config.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaMotion.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaStatic.test.ts
npx tsc --noEmit --pretty false
node scripts/run-cinema2-inertia-motion-browser.mjs artifacts/inertia-final-controls
INERTIA_REFERENCE_AUDIO_PATH=artifacts/inertia-phase4/reference-audio.m4a node scripts/run-cinema2-inertia-audio-browser.mjs artifacts/inertia-final-audio
node scripts/run-cinema2-inertia-final-browser.mjs artifacts/inertia-final
node scripts/run-cinema2-inertia-final-browser.mjs artifacts/inertia-final --review-only
ffmpeg -hide_banner -loglevel error -framerate 15 -i artifacts/inertia-final/preview-frames/%03d.png -c:v libx264 -crf 19 -pix_fmt yuv420p -movflags +faststart artifacts/inertia-final/inertia-review.mp4 -y
```

The reference-audio extraction command is in [Phase Four](cinema2-inertia-phase4-shared-audio.md). Browser runners use installed Chrome or `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Artifacts are local, ignored, and reproducible; source, tests, and reports are ordinary repository files. `--review-only` exports fresh preview frames and the remaining 16:10 check without repeating unrelated acceptance work.

## Source and handoff

Primary boundaries:

- `presets/Cinema2InertiaPreset.ts`: manifest, controls, scene/camera, effects, and render graph.
- `presets/Cinema2InertiaAudioRoutes.ts`: shared cue profiles, Director routes, response bounds.
- `modules/Cinema2InertiaNativeModule.ts`: current resolved values and native resource ownership.
- `modules/inertia/Cinema2InertiaGeometry.ts` / `Cinema2InertiaRenderer.ts`: procedural topology and rendering.
- `modules/inertia/Cinema2InertiaMotion.ts`: native patterns, shared timing, base selection, performance transitions.
- `modules/inertia/Cinema2InertiaAudio.ts`: bounded musical/Director response composition and event fences.
- `modules/inertia/Cinema2InertiaPerformance.ts`: finite automatic presentation authority and restoration.

Shared source edits are the additive module/preset registrations and export of the existing raw timing helper. No shared detector, Inspector special case, or typography override was added. The final diff/working tree was reviewed for unintended changes.

All requested implementation work and final visual acceptance are complete. The user’s “All approved.” instruction authorized keeper promotion, which is recorded in the catalog and the revision-6 manifest. The focused static/registration suite was rerun for this metadata/role-only change; rendering and musical behavior are unchanged. No commit, merge, or deployment was requested or created. The accumulated Inertia source, tests, harnesses, and documentation remain uncommitted.
