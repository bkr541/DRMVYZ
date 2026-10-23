# 06. Phase-by-Phase Implementation Plan with Hard Gates

**Latest pre-acceptance refinement:** The user subsequently requested larger cubes, brighter LEDs/Threshold-style atmosphere and Rotate Cubes. See [implementation and verification](27_LARGER_CUBES_ATMOSPHERE_ROTATION.md). These refinements are included in the current Phase 8 acceptance.

**Current checkpoint:** Phase 9 release review and documentation are recorded in [the sign-off report](29_P9_RELEASE_SIGNOFF_REPORT.md). The user approved the reviewed visuals/behavior, and Phase 8 automated evidence passes. Gate P9 remains **NO SHIP**: repository type/build/test release disposition and validation of a final committed candidate remain unresolved. The preset remains Preview.

**Subsequent user-directed LED change:** [LED bars and shared choreography](26_LED_BAR_CHOREOGRAPHY.md) replace the colored frame material after P7. The LED shader has its own focused functional validation; P7's earlier profiling figures remain historical. The current P8 run refreshes validation for this shader and the subsequent atmosphere/rotation changes.

**User-directed count revision:** BLOCKSHIFT now has fifteen permanent objects (fourteen Hallow Cubes and one Impossible Cube), superseding the earlier nine-object specification. See [current count revision](22_FIFTEEN_CUBE_FIELD.md). The six-object addition preceded the user's subsequent authorization of Phase 6.

**Current user-directed composition:** [Immersive field revision](19_IMMERSIVE_FIELD_REVISION.md) overrides the earlier distant sculpture framing. Preserve a camera inside the field, large near/peripheral cubes, varied distances and rear geometry. P4 evolves these spatial poses around the observer; P5 connects shared audio responses throughout the surrounding volume. Do not restore an outside camera to fit all fifteen objects in one image. Intentional peripheral cropping is part of this composition; camera/model penetration remains a failure.


**Source of truth:** root `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`. Follow its §§8–10, 11–20 and 23–25. Every phase must report files changed, test commands/results, real visual evidence where relevant, deviations, and explicit **STOP/GO**. Do not ship a render-only prototype as a complete keeper.

## 2026-10-22 sequencing correction

The root creation contract takes precedence over the original phase boundaries. P3 must prove six selectable native formations and a real BPM Sync consumer before proceeding; these foundations move forward from P4. Full pattern-specific trajectories and smooth transitions remain P4. The user subsequently authorized moving basic floating camera motion and controls into P4; P7 retains camera polish and effects. Audio Reactivity becomes visible in P5, Auto Performance in P6, and Bloom in P7, only with working consumers. Transition Length stays hidden until P4. Canonical event plumbing can exist in P3; the complete eleven-event music/transport matrix remains P5, as allowed by contract §23 Step 4.

An unfinished preset must be inspectable in the normal app as an explicitly labeled **reference preview**. Test-only registration is insufficient for user review. Promotion to keeper and release requires the full contract, including human acceptance; current milestone tests do not grant release approval.

## Phase 0 — Branch verification and feasibility (NO implementation)

**Tasks**
1. Compare current branch with the uploaded `(5)` snapshot; read `AGENTS.md` and any repository-specific implementation instructions if present.
2. Open all concrete files listed in [00_SOURCE_AUDIT.md](00_SOURCE_AUDIT.md). Confirm no existing BLOCKSHIFT, duplicate IDs or incompatible APIs.
3. Verify current manifest schema, real render provider, resource facet, target runtime and registry/capability contracts.
4. Verify canonical `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`, generic `Cinema2MainframePatternController`, shared rhythm identity resolver and effective Audio Dock Sync composition.
5. Run baseline `npm run typecheck`, `npm run build` and targeted existing Cinema2 tests if feasible; document pre-existing errors separately.
6. Decide actual browser harness technique from production app scripts, not a disconnected preview.

**Deliverable:** dated audit/decision log, validated implementation paths, verified initial branch state.

**Gate P0:** All API/ID assumptions verified. **STOP** if unresolved architecture conflicts would make the plan fictional.

---

## Phase 1 — Author complete BLOCKSHIFT visual/authority specification

**Tasks**
1. Lock fifteen indexed cubes and two visible material layers (opaque face + glowing edge). Define fixed rig, object tags, camera, max movement, minimum clearance and pattern bounding boxes.
2. Lock exact geometry targets for six patterns and transition policy; ensure **Stack/Orbit/Stagger/Split/Wave/Collapse are six genuine spatial programs**.
3. Approve the complete Inspector matrix, including BPM Sync, Pattern/Pattern Change/Trigger, five independent colors and strict hard disables.
4. Define source-signal → resolved target mapping, event envelope bounds, Director gain caps and temporary Auto Performance precedence.
5. Approve golden static composition before costly shader implementation. Select target screenshot aspect ratios and human approver.
6. Record optional effects and motion controls; remove any proposed option without a planned consumer.

**Deliverables:** signed visual specification, block identity map, baseline/stress spatial envelopes, control authority matrix, screenshot plan.

**Gate P1:** Patterns are distinguishable as **geometry** under a stationary camera; fifteen stable blocks and no physics engine. The later user-authorized GLB integration supersedes the original no-assets proposal. **STOP** if visual language relies on bloom or hidden complex machinery.

---

## Phase 2 — Native geometry/module/static production render

**Tasks**
1. Build `Cinema2BlockshiftDomain.ts` and `Cinema2BlockshiftLayout.ts`: fifteen stable IDs and rigs, typed grouping, validated defaults and finite transforms.
2. Build `Cinema2BlockshiftRenderer.ts`: minimal WebGL2 instanced body/edge geometry, depth-tested world render, buffers, shaders, resource disposal and GPU accounting.
3. Build `Cinema2BlockshiftNativeModule.ts`: definition ID/version, validation, engine-owned resources, world provider, module inspection, lifecycle.
4. Create minimum valid `Cinema2BlockshiftPreset.ts` manifest with proper world scene, camera, layer, depth/color render pass and module bindings.
5. Register the module and a clearly labeled reference preview through the existing registry seams so the user can inspect it in the normal app. Promote to keeper only after final acceptance.
6. Visually validate the native renderer with **bloom OFF, audio OFF, motion OFF** on the actual app canvas.

**Tests/evidence**
- Stable fifteen IDs and finite matrices; IDs persist across render frames; depth and camera required.
- Authoring/compiler validation and graph references; no GL/shader/resource warnings.
- Screenshots of visible face/edge separation at 16:9, 1:1, 9:16, resize.

**Gate P2:** Correctly lit, readable static 3D cube installation in production canvas. **STOP** if merely shader colors/2D rectangles show, or cubes vanish without bloom.

---

## Phase 3 — Inspector/control/palette parity (BEFORE automation)

**Tasks**
1. Implement all required generic Inspector parameters and module parameter bindings; four parent groups only.
2. Bind BPM Sync to a functioning clock consumer and prove ON/OFF output in P3; Pattern, Pattern Change boolean OFF and conditional Trigger in required order and group.
3. Implement **five independent Palette colors**, including visibly distinct Primary/Secondary/Accent/Body/Background output regions.
4. Implement Block Size, Spread, Depth, Rotation Range, Master Intensity, Motion Amount and Motion Rate. Implement the six distinct manual formations and basic timing foundation. Keep later-phase audio/automation/transition/effect controls hidden until functional.
5. Persist authored settings through existing parameter state; avoid manifest-default reads that ignore resolved overrides.
6. Re-run safe layout validation at min/max for geometry controls; test zero and hard disables.

**Tests/evidence**
- Inspector schema, labels/groups/types/visibility and unchanged canonical trigger option values.
- Min/default/max per numeric parameter; distinct pixels per palette role; zero-motion proof.
- Trigger choice preserved while hidden; Pattern selection visible with toggle OFF/ON.

**Gate P3:** Every advertised control visibly affects *its intended native consumer*. **STOP** on placebo controls, parent-group drift or wrong Pattern Change type.

---

## Phase 4 — Pattern motion, transitions, clock hardening and basic floating camera

**Tasks**
1. Extend the P3 six-formation foundation with the full authored trajectories, using pure pattern evaluation from stable IDs, phase and authored geometry; split into `Cinema2BlockshiftPatterns.ts` when needed.
2. Implement `Cinema2BlockshiftOrchestration.ts` to resolve user base, runtime selected pattern, phase/time, current/previous pose, bounded interpolation and safety.
3. Connect selected Pattern to real GPU instance position/rotation/scale updates; ensure animated motion and **spatial identity** with effects OFF.
4. Harden the P3 shared Pattern controller: no immediate repetition; no stale or duplicate event switching; user change while ON takes effect and preserves ON.
5. Extend the P3 timing foundation: BPM Sync ON uses valid engine tempo/grid as defined; OFF uses free-run timing; no local beat detector. Honor pause/seek/loop/re-entry/track change.
6. Implement transition-length option and retarget from the last visible pose when a new selection arrives mid-transition.
7. **User-approved scope change:** implement basic floating camera motion here through the shared camera runtime, with Camera Motion, Float Amount, Float Speed and Field of View controls. Preserve the approved observer-centered field; no camera orbit outside the field or automatic fit of all nine objects. OFF and Master Motion Amount zero restore the base camera.
8. Keep geometry separated and outside the observer volume through animation and transitions; deliberate peripheral crops are part of the current visual target.

**Tests/evidence**
- Six geometry snapshots and animation filmstrips; no two patterns collapse to the same positions.
- Stack→Orbit, Split→Collapse transition clips, no overlaps/clipping/jitter.
- Tempo contrast, BPM Sync toggle, pause/resume/seek and runtime pattern precedence.
- Camera controls visibly effective, conditional controls/persistence, bounded drift, stationary OFF view and paused FOV editing.

**Gate P4:** Six visibly distinct **3D geometry** patterns; deterministic timing and transformations. **STOP** if only emission/labels/camera movement changes.

---

## Phase 5 — Shared Audio Intelligence routing and canonical event switching

**Tasks**
1. Consume shared frame audio/transport and existing Director section-transition context; declare actual manifest capabilities and attach choreography continuous mappings and event rules via supported schema. Director significance gain remains Phase 6.
2. Connect sub/bass/mids/highs/energy/vocals/build/section signals to bounded physical/edge channels.
3. Connect kick/snare/downbeat/phrase/section/drop envelopes with unique object groups and decay behaviors; no custom analysis.
4. Wire canonical eleven Trigger options using tested shared resolver and new event identities. Pattern Change OFF blocks auto cycling while other audio reactivity works.
5. Prevent duplicate envelope fires and overlap with pattern transitions; ensure audio absence degrades gracefully.

**Tests/evidence**
- Audio fixtures with state and screenshot/recording proof; distinct kick/snare spatial response.
- Trigger matrix all 11 options; duplicate event, stale manual-edit event, new track/seek and pause cases.
- No unexpected switch at activation, no new music facts when input absent.

**Gate P5:** Verified *actual* audio-driven movement and all trigger behavior. **STOP** on inferred/local events or parameter mutation.

---

## Phase 6 — Visual Director, Auto Performance and manual authority

**Tasks**
1. Apply Director significance only as a bounded gain on approved transform/emission channels.
2. Add Auto Performance OFF default and strictly transient build compression / drop release without persisting Pattern or changing Pattern Change / Trigger.
3. Preserve progression of underlying Pattern while temporary overlay is active; restore proper current base when override ends.
4. Enforce manual takeover/hard-disable table, especially a Pattern selection while toggle ON during build/drop.
5. Test automation/gesture ordering at same frame and repetitive events with reset behavior.

**Tests/evidence**
- Auto ON/OFF vs low/high energy; build/drop overlay beginning/end.
- Edit Pattern during build: immediate visible change and no stale-cue reversal; next independent authorized event may change performance.
- Motion Amount 0, Audio Reactivity 0, Camera Motion OFF, Bloom 0 each remain effective under Auto ON.

**Gate P6:** Audio/Director enhances and never fights manual user ownership. **STOP** if temporary override becomes persistent or user edit loses.

---

## Phase 7 — Camera polish, effects and performance hardening

**Tasks**
1. Polish the shared floating camera introduced in Phase 4 within the approved immersive field. Tune framing/safety across patterns and aspects; any additional camera choreography remains a later, explicitly validated change.
2. Add engine-owned HDR bloom/atmosphere/finish only when needed; all toggle/intensity values visually honored.
3. Validate wide/square/portrait clipping and camera framing for all six patterns.
4. Profile CPU/GPU/memory, frame time, draw calls, shader compilation, resource destruction/recreation, seek/re-entry, WebGL context-loss recovery.
5. Keep fifteen stable objects, the two user-supplied GLB assets and body/frame batching; no per-block spotlights or new asset import UI.

**Tests/evidence**
- 3 aspect ratios × 6 patterns; bloom 0 vs on; all camera settings.
- GPU resource and frame-time evidence on reference hardware, no progressive leak after repeated preset switches.

**Gate P7:** Stable, clean native rendering; visual polish must not hide structural/authority regressions. **STOP** on unsafe light count, GL errors or lifecycle leaks.

---

## Phase 8 — Full production browser + regression acceptance

**Tasks**
1. Implement/extend a production app browser script modeled on existing Cinema2 harnesses; explicitly enter BLOCKSHIFT via production preset chooser.
2. Automate Inspector checks (all groups, five palettes, Pattern Change/Trigger, 11 options), persistence and visible control-to-pixel effects.
3. Test playback, pause, seek, loop, track swap and preset re-entry using supported fixtures/sources.
4. Record static golden, six-pattern filmstrips, continuous/event audio contrasts, build/drop overrides, aspect/resizing and zero-disable comparisons.
5. Run `npm run typecheck`, `npm run build`, focused Vitest and existing Cinema2 regression suite; document environment-dependent failures separately.
6. Have a human review production captures, not only assertion counts.

**Gate P8:** Full mandatory acceptance and unchanged neighboring presets. **STOP** if no verified real canvas evidence or if new changes break Depth/Backstreet/Afterhours runtime.

---

## Phase 9 — Release sign-off and documentation

**Tasks**
1. Fill [09_RELEASE_GATE.md](09_RELEASE_GATE.md) with PASS/FAIL and linked screenshots/videos/logs for every criterion.
2. Re-run validation at final commit hash. Verify IDs, module resource disposal and declared capabilities one final time.
3. Document user-facing controls and all six geometry patterns. Add concise release note and any approved follow-on scope.
4. Deliver concise file diff, tests/commands, visual proof, performance metrics, known issues, and a ship/no-ship decision.

**Gate P9:** All required items PASS; any unresolved hard blocker means **NO SHIP**. No 'looks fine' substitute for witnessed behavior.

---

## Phase report template (required for each P0–P9)

```text
Phase number/name:
Branch/commit:
Files created/modified:
Requirement IDs satisfied:
What changed on real canvas:
Evidence artifact paths:
Tests run and PASS/FAIL:
Pre-existing failures, if any:
New blockers and scope changes:
Gate: PASS / FAIL
Next phase authorized:
```

**The build order is deliberate.** Do not start with bloom, audio intensity, or flashy camera motions before geometry, manual controls and six distinct patterns are demonstrably correct.
