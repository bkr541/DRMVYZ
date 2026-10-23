# BLOCKSHIFT: Cinema 2.0 Implementation Package

**Phase 9 release review (2026-10-23):** Human visual/behavior approval is recorded. The release checklist, user guide, candidate notes and final scoped audit are complete; the decision remains **NO SHIP** because repository type/build/test disposition and final committed-candidate validation are unresolved. BLOCKSHIFT remains Preview. See [Phase 9 report](29_P9_RELEASE_SIGNOFF_REPORT.md), [release gate](09_RELEASE_GATE.md), [user guide](30_BLOCKSHIFT_USER_GUIDE.md) and [candidate notes](31_BLOCKSHIFT_RELEASE_NOTES.md).

**Phase 8 checkpoint (historical, preset revision 17):** The current production browser matrix passes, including the larger models, LED bars, atmosphere, faster cube spin, eleven triggers, transport, controls and neighboring-preset smoke checks. Acceptance fixed idle Pattern transitions and a shared context-loss timing race. See [results, review captures and remaining gates](28_P8_PRODUCTION_ACCEPTANCE_REPORT.md). The subsequent Phase 9 review recorded human approval; the repository release blockers remain open.

**Latest user refinement (2026-10-23):** Block Size now reaches **6.00**, and local clearance preserves the apparent growth of nearby cubes. LEDs are brighter, **Atmosphere** under Effects > Scene adds shared Threshold smoke/light spill, and **Rotate Cubes** under Design > Motion adds varied axes/directions to all fifteen cubes. See [refinement report and evidence](27_LARGER_CUBES_ATMOSPHERE_ROTATION.md). Human approval is now recorded in Phase 9; current automation is covered by Phase 8.

**Current LED revision:** The colored GLB frames now render as self-emissive LED bars with dark housings, diffusers and segmented cells. Twelve local circuits per cube follow its actual geometry and the six native patterns, using the existing shared Audio Intelligence/Director/event routes and beat clock. See [LED bar implementation and evidence](26_LED_BAR_CHOREOGRAPHY.md). Audio Reactivity zero leaves steady LEDs. Current Phase 8 evidence supersedes the earlier P7 shader/performance measurements.

**Camera orbit:** In **Design > Motion**, Camera Motion ON reveals **Orbit Camera**; enabling it reveals **Orbit Intensity**, which controls orbit speed alongside the existing float. See [orbit controls](23_ADDITIVE_ORBIT_CAMERA.md).

**Current object count: fifteen.** The user requested six additional cubes after Phase 5. Fourteen Hallow Cubes now surround the observer, with one deeper Impossible Cube; original IDs/settings and the close-up field are preserved. See [fifteen-cube revision](22_FIFTEEN_CUBE_FIELD.md). Earlier phase evidence records the previous nine-object checkpoint.

**Phase 7 checkpoint (historical):** **Bloom** is now available under Effects > Scene, default 0.30, through the shared HDR bloom effect. Zero restores the unbloomed image exactly. All six patterns have production captures at three aspect ratios, with camera safety, repeated preset switches and context recovery validated. Hardware profiling on Apple M3 Pro/Metal at 1920×1080 is recorded in the [Phase 7 report](25_P7_POLISH_AND_PERFORMANCE_REPORT.md). The large surrounding field and existing float/orbit controls are preserved.

**Audio/automation checkpoint:** Shared Director gain and **Auto Performance** (Master Controls, default OFF) remain as documented in the [Phase 6 report](24_P6_DIRECTOR_AUTO_PERFORMANCE_REPORT.md); [Phase 5](21_P5_SHARED_AUDIO_REPORT.md) retains the shared audio/eleven-trigger evidence. Manual Pattern/geometry edits cancel the temporary overlay and enforce a two-beat cooldown; automation never saves over user controls.

**Current visual target — immersive field:** The observer is inside a surrounding 3D cube field. Block Size extends to 6.00 and Spread to 3.00, models are larger, depth is varied and peripheral crops are deliberate. Read [the current visual revision](19_IMMERSIVE_FIELD_REVISION.md); earlier installation captures and framing rules are historical. Phase 8 automation is recorded above; human approval is recorded in Phase 9, while release approval remains blocked.

**2026-10-22 Spread fix:** Spread now changes the minimum surface gap across its entire range, independently of Block Size. See [fix and regression evidence](18_SPREAD_CONTROL_FIX.md) for current behavior.

**2026-10-22 size correction:** Existing Block Size values now produce three times larger physical models, with tighter box-based spacing and corrected in-app framing. Saved slider values are preserved. See [size correction and current capture](17_BLOCK_SIZE_CORRECTION.md). This supersedes earlier size/framing defaults.

**2026-10-22 model revision:** The user-supplied Hallow Cube and Impossible Cube GLBs replace the procedural geometry. Eight surrounding blocks use Hallow Cube and the center uses Impossible Cube. See [GLB integration](16_GLB_OBJECT_INTEGRATION.md) for current evidence; P2/P3 captures below describe the earlier meshes.

**2026-10-22 progress:** P0–P2 evidence is retained. P3 manual controls are implemented, including six selectable formations, five independent colors, basic shared-clock timing, and normal-app availability as **BLOCKSHIFT (Preview)** with reference status. Read [P3 report](15_P3_MANUAL_CONTROLS_REPORT.md) for verification and remaining work. [The corrected phase plan](06_PHASED_IMPLEMENTATION.md) follows the root creation contract: unfinished automation/effects controls stay hidden; P4 supplies pattern motion/transitions and camera float, and P5 now supplies shared audio reactions. Full keeper/release acceptance and human visual approval remain outstanding.

**Status:** phased implementation in progress. **Source snapshot:** `DRMVYZ-main (5).zip` (the uploaded updated project). **Preset:** `BLOCKSHIFT`. **Target role:** first-party Cinema 2.0 keeper. **Priority:** scoped medium complexity, not a physics simulator or a sliding-tile puzzle.

## Executive intent

Create a striking, economical native 3D installation of **nine individually addressable, dark floating cubes with emissive edges**. Cubes form and animate between six purposeful arrangements: **Stack, Orbit, Stagger, Split, Wave, Collapse**. They respond to the shared Cinema 2.0 Audio Intelligence and Visual Director without owning a new beat detector, scheduler, rendering engine, camera stack or Inspector framework. Movement remains observable with bloom OFF, and user-authored parameters stay authoritative.

The original proposal below was based on the uploaded ZIP. Current implementation and actual validation are recorded in the dated phase reports; the original proposal alone is not evidence of completion.

## Critical design choice

BLOCKSHIFT is **not SHIFTGRID** or a texture mosaic: no user images, image-to-image transitions, 2D sliding puzzle rules or material morphing. It uses a *small permanent identity-stable 3D object set*, authored transform targets, and meaningful audio-reactive movement. This strict scope keeps it near medium rather than medium-high complexity.

## Read the package in order

| Artifact | What it decides |
|---|---|
| [00_SOURCE_AUDIT.md](00_SOURCE_AUDIT.md) | Exact inspected source files, integration points, verified caveats |
| [01_VISUAL_AND_GEOMETRY_SPEC.md](01_VISUAL_AND_GEOMETRY_SPEC.md) | Appearance, 3D coordinate assumptions, cube rig, camera, collision safety |
| [02_ARCHITECTURE_AND_FILE_MAP.md](02_ARCHITECTURE_AND_FILE_MAP.md) | Native manifest/module/registry/render graph integration blueprint |
| [03_INSPECTOR_AND_PALETTE.md](03_INSPECTOR_AND_PALETTE.md) | Required controls, all four parent groups, 5 independent colors, user authority |
| [04_PATTERN_AND_TIMING.md](04_PATTERN_AND_TIMING.md) | Six movement formations, Pattern Change/Trigger, BPM sync, transitions |
| [05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md](05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md) | Audio mapping, event envelopes, Director, Auto Performance and takeover |
| [06_PHASED_IMPLEMENTATION.md](06_PHASED_IMPLEMENTATION.md) | **P0–P9** implementation with hard STOP/GO exit gates |
| [07_TEST_AND_VISUAL_ACCEPTANCE.md](07_TEST_AND_VISUAL_ACCEPTANCE.md) | Deterministic tests, audio fixtures, production-browser captures and performance |
| [08_CODING_AGENT_HANDOFF.md](08_CODING_AGENT_HANDOFF.md) | Standalone handoff instruction for Claude Code/Codex |
| [09_RELEASE_GATE.md](09_RELEASE_GATE.md) | Auditable sign-off and strict no-ship conditions |
| [10_REQUIREMENTS_TRACEABILITY.md](10_REQUIREMENTS_TRACEABILITY.md) | Requirements → owners → tests → evidence mapping |
| [11_RISKS_AND_SCOPE.md](11_RISKS_AND_SCOPE.md) | Complexity safeguards, phased deferrals, failure-mode mitigations |

## Source of truth and implementation order

1. **Repository root `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` is authoritative**, particularly §§8–10, 11–20 and 23–25. When a planning detail conflicts with live code or an updated contract, document the discrepancy, implement the newer authority and revise this plan.
2. Follow order **visual core → manual controls → six native patterns/timing and basic camera float → shared Audio Intelligence → choreography/Director → Auto Performance → camera polish/effects → production acceptance**.
3. Every phase creates evidence and ends with STOP or GO; no phase gets a pass on manifest compilation alone.
4. Keep preset-specific geometry/patterns in BLOCKSHIFT's native module. Use existing module registry, first-party catalog, native compiler, parameter state, shared rhythm/event inputs, render graph and effect primitives.
5. Never silently change any user's Pattern, Pattern Change, Trigger, palette, or geometric base settings through automation.

## Proposed baseline (to approve in P1)

- **15 cubes, stable IDs**, surrounding the observer in a varied-depth field; one native world-space module; opaque dark cube faces and emissive edge lines.
- **Six physical motion patterns** as named above; transformations bounded by validated spatial envelopes; no physics or collisions as a runtime subsystem.
- Four required top-level Design groups: **Master Controls, Design, Effects, Palette**.
- Required **BPM Sync**, **Pattern**, **Pattern Change** boolean (default OFF), conditional **Trigger** dropdown with the canonical 11 options, **five independently effective color roles**, plus scoped **Auto Performance**.
- Target an economical render with instanced/combined meshes (body and edges), a small set of scene lights, the two user-supplied GLB assets, no extra rendering loop.

## Completion

A coding agent should finish only when it can supply **real production-canvas screenshots and motion recordings**, a parameter-to-pixel proof matrix, passing focused code tests, clean creation/re-entry/disposal, and a completed [release gate](09_RELEASE_GATE.md). The original planning ZIP included no implementation code.
