# 07. Tests, Production Visual Evidence and Acceptance Matrix

## Testing principle

Manifest/compiler and unit tests catch wiring defects; **production-canvas screenshots/recordings** catch the invisible-feature failure mode. Both are mandatory. Do not report BLOCKSHIFT passed until the new implementation has actually been run in the production Cinema 2.0 React renderer.

## Test file roadmap

| Proposed test | Minimum assertions |
|---|---|
| `Cinema2BlockshiftPreset.test.ts` | Manifest schema/capabilities, first-party registration, compiler, native module availability, render graph refs, required Design grouping, canonical trigger options |
| `Cinema2BlockshiftGeometry.test.ts` | 9 stable IDs, deterministic grouped transforms, finite/clamped bounds, perspective/depth, edge/body independent channels |
| `Cinema2BlockshiftPatterns.test.ts` | 6 unique silhouettes and animated transforms, per-pattern object count, transition continuity, no unsafe overlap, repeatable same seed/time |
| `Cinema2BlockshiftAudio.test.ts` | Shared signal mapping, event-ID dedupe, kick vs snare vs build vs drop, safe missing-audio behavior |
| `Cinema2BlockshiftAuthority.test.ts` | Manual Pattern while ON, stale Trigger protection, Auto overlay restoration, hard disables, palette independence |
| `Cinema2BlockshiftRendering.test.ts` | World provider depth/camera dependency, GL instancing path, valid draw states, resource dispose/re-entry, GPU bytes report |
| Production browser script | Real app choose BLOCKSHIFT, Control UI→observable pixels, all 6 patterns, transport, 3 aspect ratios, screenshot sequences |

Use existing testing patterns from `Cinema2DepthPreset.test.ts`, `Cinema2Backstreet.test.ts` and `Cinema2AfterhoursPatterns.test.ts`. Run actual `npm run typecheck`, `npm run build`, `npm run test` or focused Vitest as suitable; adding a CLI script does not prove it works until executed.

## Mandatory visual coverage

**V01. Idle hero:** no audio, stationary camera, effects OFF. Nine recognizable floating solid cubes, readable edges, intentional 3D depth and negative space.

**V02. Six pattern snapshots:** Stack, Orbit, Stagger, Split, Wave, Collapse under same non-reactive conditions. Each shows distinct *geometric silhouette*.

**V03. Six pattern filmstrips:** ≥4 frames per pattern at normalized phases 0, .25, .5, .75, same settings. Movement is visible and smooth, not a single static layout with changing brightness.

**V04. Transition proof:** Stack→Orbit and Split→Collapse with middle-frame capture; no teleport, NaN, clipping or perpetual overlap.

**V05. Manual Inspector proof:** min/default/max for each numeric, each enum selection, both boolean states; pixel-difference evidence from the actual canvas, with a human-readable expected change.

**V06. Independent colors:** Primary/Secondary/Accent/Body/Background assigned five distinct diagnostic hues. Each independently changes only its intended visible consumer.

**V07. Hard-disables:** Motion Amount=0 freezes physical animation, Audio Reactivity=0 removes audio modulation, Camera Motion OFF freezes automatic camera, Bloom=0 suppresses bloom. These remain disabled with Auto Performance ON.

**V08. Continuous audio:** silence vs sustained bass vs high/mid-vocal passages. Geometry reacts proportionally and remains bounded.

**V09. Event audio:** kick impulse, snare bank twist, downbeat accent, build tension, drop release, phrase and section change. Fresh event once -> one envelope.

**V10. Pattern and Trigger authority:** with Pattern Change OFF, all 11 trigger events do not change the authored pattern. ON advances only on selected new event; exact 11 labels and values; duplicate event does not double-cycle.

**V11. Manual edit during ON:** user selects Orbit while Pattern Change ON and an event is active. Orbit visibly takes effect, toggle stays ON, old event does not undo it, next separate valid trigger may cycle.

**V12. Auto Performance:** temporary build/drop override, edit during override, underlying controller progress, eventual restoration to current base, without modifying saved Pattern/Trigger/Pattern Change.

**V13. Transport:** play, pause, resume, seek forward/back, loop boundary, track swap, preset exit/re-entry and BPM Sync toggle. No stale repeat events or accelerating animations.

**V14. Aspect:** screenshots in **16:9, 1:1 and 9:16**, plus live resize, for all 6 patterns; no missing cubes or severe crop.

**V15. Performance/lifecycle:** sustained session, repeated entering/leaving and GL context interruption. No growing persistent GPU memory, duplicate callbacks, unbounded instance allocations or shader errors.

## Functional trigger matrix (canonical eleven)

| ID | Meaning | One event positive test | Duplicate / stale negative test |
|---|---|---|---|
| beat | Beat | One distinct new beat event advances | Same beat ID reused does not advance |
| kick | Kick | Fresh kick ID advances | Sustain/duplicated kick frames do not |
| snare | Snare | Fresh snare ID advances | Non-snare kick alone does not |
| downbeat | Downbeat | New downbeat advances | Other beats do not |
| beat2 | Every 2 Beats | New 2-beat boundary advances | Non-boundary beat does not |
| beat4 | Every 4 Beats | New 4-beat boundary advances | Non-boundary beat does not |
| bar | Bar | New bar event advances | Ongoing bar state does not retrigger |
| bar4 | Every 4 Bars | Qualified boundary advances | Other bars do not |
| bar8 | Every 8 Bars | Qualified boundary advances | Other bars do not |
| phrase | Phrase | Fresh phrase advances | Old phrase label/state does not |
| drop | Drop | New detected drop advances | Existing drop state does not double-fire |

All test events must be supplied through the **existing validated Cinema 2.0 event seam**. Don't invent frame shapes or fake internal booleans that bypass actual wiring.

## Acceptance performance targets (measure, do not assume)

These are proposed P1 targets, **not measurements or promised guarantees**:

- Baseline 9 blocks; no instance-buffer reallocation per frame; few draws for sculptural module (target ≤4 module draw calls where technically possible).
- Scene **≤12 non-ambient shared lights** by contract; target 0–2 BLOCKSHIFT-specific physical lights; emission via geometry/shader.
- Memory steady after repeated activate/deactivate cycles; module reports approximate GPU byte ownership.
- Stable frame time on reference hardware relative to baseline; define maximum acceptable incremental frame time empirically during P0/P7, record p50/p95 and device configuration.
- Zero WebGL errors, unresolved program/link exceptions, nonfinite transforms, persistent collisions, or leaked event handlers.
- Preserve rendering at normal 16:9, square and portrait dimensions; no unintended offscreen cube loss.

## Evidence artifact naming (suggested)

```text
artifacts/blockshift/
  source-audit.md
  static/idle-bloom-off-16x9.png
  patterns/stack-{00,25,50,75}.png
  patterns/orbit-{00,25,50,75}.png
  patterns/stagger-{00,25,50,75}.png
  patterns/split-{00,25,50,75}.png
  patterns/wave-{00,25,50,75}.png
  patterns/collapse-{00,25,50,75}.png
  transitions/stack-to-orbit.mp4
  audio/kick-vs-snare.mp4
  audio/build-drop.mp4
  authority/manual-on-auto-override.mp4
  inspectors/all-required-controls.png
  palette/independent-five-colors.png
  responsive/portrait-all-patterns.png
  performance/activation-reentry-metrics.md
  test-results.md
```

**All filenames above are planned evidence slots**, not generated files in this package. The implementation agent must populate them with true evidence and list the app/commit/environment. Do not fabricate PASS status or screenshots.

## Stop conditions during tests

Visible geometry is incorrect; any mandatory control is a placebo; six patterns lack physical difference; audio uses private detection; stale events steal Pattern; Auto Performance overrides a manual edit improperly; camera/effects ignore hard-disable; non-deterministic seek/reentry; missing real canvas evidence; or any manifest/module/runtime contract validation fails. Each is release-blocking, even if unit tests pass.
