# BLOCKSHIFT: Cinema 2.0 Implementation Package

**Status:** implementation plan only. **Source snapshot:** `DRMVYZ-main (5).zip` (the uploaded updated project). **Preset:** `BLOCKSHIFT`. **Target role:** first-party Cinema 2.0 keeper. **Priority:** scoped medium complexity, not a physics simulator or a sliding-tile puzzle.

## Executive intent

Create a striking, economical native 3D installation of **nine individually addressable, dark floating cubes with emissive edges**. Cubes form and animate between six purposeful arrangements: **Stack, Orbit, Stagger, Split, Wave, Collapse**. They respond to the shared Cinema 2.0 Audio Intelligence and Visual Director without owning a new beat detector, scheduler, rendering engine, camera stack or Inspector framework. Movement remains observable with bloom OFF, and user-authored parameters stay authoritative.

This plan is based on inspection of source-file structures in the uploaded ZIP. It does **not** claim that BLOCKSHIFT has been implemented, that code was executed, or that visual acceptance has been passed. A coding agent must re-verify its current worktree and execute the gates.

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
2. Follow order **visual core → manual controls → six native patterns/timing → shared Audio Intelligence → choreography/Director → Auto Performance → camera/effects → production acceptance**.
3. Every phase creates evidence and ends with STOP or GO; no phase gets a pass on manifest compilation alone.
4. Keep preset-specific geometry/patterns in BLOCKSHIFT's native module. Use existing module registry, first-party catalog, native compiler, parameter state, shared rhythm/event inputs, render graph and effect primitives.
5. Never silently change any user's Pattern, Pattern Change, Trigger, palette, or geometric base settings through automation.

## Proposed baseline (to approve in P1)

- **9 cubes, stable IDs**, arranged nominally in a 3 × 3 formation; one native world-space module; opaque dark cube faces and emissive edge lines.
- **Six physical motion patterns** as named above; transformations bounded by validated spatial envelopes; no physics or collisions as a runtime subsystem.
- Four required top-level Design groups: **Master Controls, Design, Effects, Palette**.
- Required **BPM Sync**, **Pattern**, **Pattern Change** boolean (default OFF), conditional **Trigger** dropdown with the canonical 11 options, **five independently effective color roles**, plus scoped **Auto Performance**.
- Target an economical render with instanced/combined meshes (body and edges), a small set of scene lights, no imported 3D assets, no extra rendering loop.

## Completion

A coding agent should finish only when it can supply **real production-canvas screenshots and motion recordings**, a parameter-to-pixel proof matrix, passing focused code tests, clean creation/re-entry/disposal, and a completed [release gate](09_RELEASE_GATE.md). No implementation code is included in this ZIP.
