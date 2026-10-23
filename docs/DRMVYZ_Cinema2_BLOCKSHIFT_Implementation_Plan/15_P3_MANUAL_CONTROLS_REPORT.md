# P3 — Manual controls and in-app preview

Date: 2026-10-22. Branch: `main`; base commit `9c2aa74831103c1589e589c8cedc5af5f94f1643`. Changes are uncommitted; no commit requested.

## Authoritative guide and corrected scope

The current checkout contains the root `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`, rather than a folder of that name. Its §23 Step 4 requires working six-pattern selection, BPM Sync and independent palette controls before full motion/audio work. The original phase plan deferred too much of this to P4 and permitted a test-only P2 entry that the user could not inspect in the normal app. The phase plan now explicitly corrects those boundaries.

This milestone implements manual controls, six static formation targets and the basic shared-clock consumer needed to prove BPM Sync. Full pattern-specific positional trajectories and interpolated transitions remain P4. Shared audio response and the complete eleven-event trigger matrix remain P5; Director/Auto Performance P6; effects/camera polish P7. These later controls remain hidden until their consumers exist. This report does not approve the full preset for release.

## What the user can inspect

In Cinema 2.0, open **Presets → System → BLOCKSHIFT (Preview)**. It is in the normal first-party catalog with `reference` role, not promoted to keeper. The production browser test uses the same catalog entry; it performs no special registration.

- Nine stable cubes retain the larger 1.35 default size (editable 1.05–1.80).
- Stack, Orbit, Stagger, Split, Wave and Collapse immediately select distinct real geometry.
- Block Size, Spread, Depth and Rotation Range alter the native instance transforms; Master Intensity alters face/edge output.
- Five independent colors target primary edges, secondary edges, center accent, opaque faces and engine background.
- BPM Sync, Motion Amount and Motion Rate drive a shared `Cinema2BeatClock` rotation foundation during active playback. Zero Motion Amount freezes phase; no source holds the static pose. This is not the final authored six-pattern movement vocabulary.
- Pattern Change defaults OFF, exposes the canonical eleven-choice Trigger only when ON, preserves hidden Trigger selection, and stays ON after manual Pattern selection. Existing generic pattern controller and shared event resolver own runtime progression; no persistent authored Pattern mutation occurs.
- Authored values use existing parameter persistence and resolved parameter reads, including switching to another preset and back.

Spread is clamped by the documented sphere-clearance floor; small values can intentionally share a safe geometry result. All six formations are tested at 27 combinations of size/spread/depth extrema. No extra physics system, local audio analyzer, beat detector, camera stack or render loop was introduced.

## Implementation and integration

`Cinema2BlockshiftPreset.ts` defines the schema, parameter bindings and static engine camera. `Cinema2BlockshiftNativeModule.ts` reads resolved parameters, uses the shared clock/controller/event resolver and uploads changed instances. `modules/blockshift` contains stable IDs, pure layouts and the two-batch instanced body/edge renderer. Existing module registry and first-party catalog provide normal app registration.

The renderer retains one instance buffer and updates it with `bufferSubData`; fixed geometry and GPU resource ownership remain engine managed. Later-phase Auto Performance, Audio Reactivity, Transition Length and Bloom have hidden schema entries, with no advertised placeholder widgets. Effects remain off for this milestone.

## Verification

Final results and captures are stored in [evidence/p3](evidence/p3/), including [the production Inspector](evidence/p3/production-inspector.png), [wide static output](evidence/p3/idle-bloom-off-16x9.png), [acceptance results](evidence/p3/acceptance.json) and [timing results](evidence/p3/timing-acceptance.json). Commands use Node 22.23.3 (`/opt/homebrew/opt/node@22/bin/node`) to match the repository's supported runtime.

- Focused BLOCKSHIFT Vitest: **16/16 passed**, covering manifest/catalog, renderer lifecycle, resolved controls, six formations and geometry bounds, visibility/persistence, clock contrasts/rate, pause/zero-motion and idle behavior. Existing generic pattern-controller tests passed during integration (4 tests).
- Focused ESLint across BLOCKSHIFT source/tests/harness/scripts and the two integration seams: **passed**.
- TypeScript program rooted in the eight BLOCKSHIFT TS/TSX files: **0 changed-file diagnostics**, **9 existing transitive dependency diagnostics**. This is not a repository-wide typecheck pass. The known P0 baseline still blocks the normal full build's `tsc` step; it was not rerun.
- The real workspace browser entry bundled with Vite. Browser acceptance uses Chromium/ANGLE SwiftShader, not reference GPU hardware; no frame-rate/performance claim is made.
- Production browser acceptance: **PASS**. Actual chooser/Inspector controls, min/default/max geometry and intensity, six distinct formations, five independent color masks, canonical eleven options and conditional Trigger, preserved Pattern Change and re-entry persistence.
- Static canvas passes at **16:9 / 1:1 / 9:16**: nine separated outlines, no clipping, identical stopped pixels, two instanced draws, no per-frame buffer allocation, no GL/page errors, and balanced GPU objects after switching away and back.
- Production Stage timing: **PASS** at 60/180 BPM with local Sync ON/OFF and host Sync ON/OFF; actual GPU poses and pixels change during playback. Pause and zero Motion Amount freeze physical pixels. Exact timing ratios and Motion Rate contrasts are covered by focused tests.

The controlled timing fixture mounts the production `Cinema2Stage` and supplies standard host transport/BPM. It does not analyze a track or inject musical events; it proves the clock's visible consumer, not audio-reactivity acceptance. Complete event-driven and transport-discontinuity acceptance belongs to subsequent phases.

Reproduction: `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftControls.test.ts` and `npm run test:e2e:cinema2-blockshift:p3`, using the supported Node runtime. The final browser run reused its already successful Vite bundle after adapting only the test script to the shared Palette color popover UI. Working tree and integration diff reviewed; `git diff --check` passed. No unrelated source files were changed.

## Remaining acceptance and handoff

The preview is available for user visual review. Human visual acceptance remains outstanding, as do the later-phase full movement/audio/authority/effect requirements. Automated pixel changes cannot establish aesthetic approval. No keeper promotion, merge or release is authorized by this report.

P3 implementation and automated acceptance gate: **PASS** for the corrected manual-control scope; user visual review remains pending. Next implementation scope is P4 only after this milestone, without prematurely adding audio/automation/effects.
