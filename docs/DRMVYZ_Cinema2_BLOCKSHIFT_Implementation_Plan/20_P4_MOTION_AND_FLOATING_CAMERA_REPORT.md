# BLOCKSHIFT Phase 4 — Pattern motion, transitions and floating camera

2026-10-22. Branch `main`, base `9c2aa74831103c1589e589c8cedc5af5f94f1643`. **Implemented and validated for user review; no commit requested or created.** BLOCKSHIFT remains a normal-catalog reference preview, not a released keeper. Phase 5 has not begun.

## Delivered behavior

The approved immersive field remains the baseline: eight Hallow Cubes and one Impossible Cube, stable identities, large nearby peripheral geometry, readable mid-distance objects and a real rear volume. No all-nine-in-frame camera fitting was added.

Six pure motion programs now move actual native instance positions/rotations: Stack column lift/sway, observer-centered Orbit, delayed Stagger cascades, opposing Split breathing, vertical/depth Wave and bounded Collapse compression/release. Local XYZ rotation respects Rotation Range. The shared phase cycle is 32 effective beats divided by Motion Rate × Motion Amount (about 29.1 seconds at 120 BPM/default amount). No audio-reactive physical accents are claimed yet.

Transition Length now works at 0.5/1/2/4 beats. Pattern changes blend around the observer using azimuth/radius/height and eased local rotation. Mid-transition changes retarget from the current visible pose; duration changes preserve progress. Manual geometry edits apply immediately. With pause/master zero, a manual Pattern edit snaps to the requested safe pose; other motion/transitions freeze. Idle manual transitions use a 120 BPM preview fallback. Runtime pattern selection never overwrites the authored parameter.

At the user's request, basic camera movement moved from Phase 7 into Phase 4. **Master Controls** exposes Camera Motion (ON) followed by Camera Motion Intensity (0.60), visible only when the toggle is ON. **Effects > Camera** retains Float Speed (0.70, conditional on Camera Motion ON) and Field of View (85°, range 60–100); FOV always remains editable. Camera Motion OFF, Camera Motion Intensity zero and Master Motion Amount zero restore the authored base camera immediately. Shared runtime drift stays within ±[0.65, 0.4, 0.65] world units, less than one unit from the observer origin. There is no free-look/travel control in this phase.

The native module and shared camera honor pause/resume and reset transient timing on source/generation changes or forward/backward time discontinuities. The shared Pattern controller suppresses duplicate/stale events and respects manual selection. Full eleven-trigger music acceptance remains Phase 5.

## Safety and implementation

`Cinema2BlockshiftPatterns.ts` evaluates trajectories; `Cinema2BlockshiftLayout.ts` applies transformed XYZ AABB separation; `Cinema2BlockshiftOrchestration.ts` owns runtime-only transitions. `Cinema2BlockshiftNativeModule.ts` connects shared clocks/controller to actual GLB instance updates. The renderer still uses four instanced batches and existing resource ownership.

All animated/blended layouts maintain at least 1.5 units of transformed-box separation and 2.5 units of clearance outside each object's conservative sphere around the observer. A sampled envelope analysis covered 64 phases per pattern at size/spread/depth extrema, rotation 45°, plus all pattern pairs at multiple phases/blend positions. The largest sampled radius was **273.5134** world units (Orbit, maximum Size/Spread/Depth), so the finite guard is now **300**, with camera far plane **420**. This is sampled coverage, not a mathematical proof over every continuous input. These bounds do not shrink models or restore distant framing.

Optional typed camera bindings (`motionEnabled`, `motionSpeed`, `masterMotionAmount`) were added to the shared manifest/compiler/runtime. Existing camera controls remain supported. New clock hard-disables are opt-in, retaining legacy independent kick-zoom decay at general Motion Amount zero; the existing camera-tempo regression was extended for this case. Paused camera controls now update the base/lens while autonomous movement stays frozen. The preset manifest is revision 8. Registry/catalog/assets remain the previously integrated seams. Audio Reactivity, Auto Performance and Bloom remain hidden.

## Validation and evidence

- **54/54 focused Vitest tests PASS**, six files: BLOCKSHIFT Preset, Controls, Motion; shared CameraRuntime, CameraTempo and MainframePatternController. Includes six distinct trajectories, complete-cycle samples at geometry extrema, all 30 pattern transitions at five intermediate samples/two sizes, retarget continuity, duration choices/edits, pause/zero, manual/event precedence, source/seek reset and camera safety/control behavior.
- **Focused ESLint PASS** on BLOCKSHIFT source/tests, shared camera/schema/compiler and browser scripts/harness.
- **Scoped TypeScript:** zero changed-file diagnostics. Nine diagnostics remain in unchanged dependencies: texture/environment attribution narrowing, Constellation/Event Horizon choreography paths, PixGrid media dimensions, legacy persistence callback and Audio Dock native-scan diagnostics. Four were already present in the narrower prior scope; importing the production workspace includes five more. This is not a clean full-project typecheck. Known failing repository-wide typecheck/build were not repeated.
- **Production browser PASS**, fresh Vite bundle: normal chooser entry; successful model fetches; wide/square/portrait static captures; all nine uploaded instances/four batches; stable allocation/disposal/re-entry; conditional camera controls; FOV min/max visibly changes stopped output; authored camera values survive preset re-entry.
- **Actual Stage motion PASS:** each of six patterns changes GPU transforms and output pixels while Camera Motion is OFF; Stack→Orbit and Split→Collapse start/middle/end captures; enabled float changes camera position within safety; pause/master zero freeze physical pixels; FOV edits work while paused; camera OFF restores origin. Standard host transport fixture, 180 BPM, no analyzed audio/events.
- After the browser pass, the final compatibility guard was narrowed only for cameras without the new bindings; BLOCKSHIFT behavior is identical. The six-file focused suite and affected-file lint passed after that guard change, so the unchanged browser path was not rerun.
- Source/diff and evidence visually reviewed; `git diff --check` passed. No hardware frame-rate or full audio acceptance claim; browser uses software WebGL.

[Motion recording](evidence/p4-motion/phase4-motion.webm) · [Pattern frames](evidence/p4-motion/pattern-filmstrip.png) · [Transition frames](evidence/p4-motion/transition-filmstrip.png) · [Normal application view](evidence/p4-motion/production-inspector.png) · [Acceptance JSON](evidence/p4-motion/acceptance.json) · [Evidence notes/logs](evidence/p4-motion/README.md).

Reproduce with Node 22: `npm run test:e2e:cinema2-blockshift:p4`. Focused tests: `vitest run src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftMotion.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftControls.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2CameraRuntime.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MainframePatternController.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2CameraTempo.test.ts`.

**Gate:** engineering checks PASS for Phase 4 review. Human approval of these new motion/camera captures remains pending. Phase 7 retains camera polish, effects and hardware/lifecycle hardening. Phase 5 audio reactions and later automation/release gates remain incomplete and require the next phase request. All implementation and reports remain uncommitted alongside prior authorized phase work.

## Inspector placement follow-up

The user requested Camera Motion and its intensity slider in Master Controls. Both are now direct Master Controls entries, with intensity immediately after the toggle and shown only when ON. The existing parameter IDs, defaults, saved intensity and shared camera binding are preserved. Float Speed and FOV stay in Effects > Camera. Earlier browser captures precede this placement-only change; the focused Inspector-model tests verify the new parent, label, conditional visibility and retained authored intensity. Validation: 18 focused tests PASS, affected-file ESLint PASS and `git diff --check` PASS. No runtime behavior changed; no repeated browser build was needed. This follow-up is uncommitted.
