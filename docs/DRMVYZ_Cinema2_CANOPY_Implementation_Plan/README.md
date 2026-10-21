# CANOPY: Cinema 2.0 Implementation Package

**Target repository:** `DRMVYZ-main (5).zip` (user-provided updated source, reviewed 2026-10-21)  
**Deliverable type:** phased Markdown implementation specification, **not** implemented TypeScript or a working preset  
**Preset:** CANOPY, a suspended volumetric array of individually addressable luminous rods  
**Proposed preset ID:** `drmvyz.cinema2.canopy`  
**Status:** DESIGN PLAN / NO SOURCE CHANGES APPLIED

## Start here

1. Read `00_SOURCE_AUDIT.md`: exact current source integration seams and source-derived constraints.
2. Read `01_VISUAL_AND_GEOMETRY_SPEC.md`: the approved proposed look, objects, composition, camera, performance envelope.
3. Read `02_ARCHITECTURE_AND_FILE_MAP.md`: manifest, native module, render and registry architecture.
4. Read `03_INSPECTOR_AND_PALETTE.md`: required Design inspector controls, defaults, bindings, visual output.
5. Read `04_PATTERN_AND_TIMING.md`: six genuine geometric patterns and Pattern Change / Trigger / BPM Sync semantics.
6. Read `05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md`: canonical Audio Intelligence, Visual Director, authority and resets.
7. Execute `06_PHASED_IMPLEMENTATION.md` **one phase at a time**, stopping at every exit gate.
8. Prove completion using `07_TEST_AND_VISUAL_ACCEPTANCE.md` and `09_RELEASE_GATE.md`.
9. Use `08_CODING_AGENT_HANDOFF.md` as the standalone implementation request for a coding agent.

## Concept in one paragraph

CANOPY is an art-installation-like ceiling array of 8 × 8 dark suspended LED rods, each with a luminous vertical diffuser and attachment cap. Seen from a slightly low, off-axis perspective, the hanging field forms moving waves, diagonal sweeps, center/edge sculptural arrangements, and restrained synchronized drops. Motion is deterministic, bounded, and geometric; audio modulates both **object position/length** and emission. The mood is mostly black with selectively colored illumination, not a dense laser show, particle effect, or static equalizer. It should remain visible and recognizable with bloom disabled.

## Non-negotiable technical brief

- New **first-party keeper** manifest registered in `Cinema2FirstPartyPresetCatalog.ts` and a **new native module type** registered in `Cinema2ModuleRegistry.ts`.
- Native world-space GL2 instanced geometry (no mandatory Blender, GLB, third-party library, physics, animation engine, new asset pipeline, or engine architecture).
- Reuse existing `Cinema2NativePresetManifest` schema, `Cinema2ModuleContracts`, `Cinema2ParameterState`, target runtime, Audio Intelligence bridge, Visual Director and choreography rules.
- At least six distinct, **physical geometry** patterns (not just color patterns).
- **BPM Sync** boolean under **Design > Master Controls** with real synced and unsynced timing.
- **Pattern** enum, **Pattern Change** boolean (default OFF), **Trigger** enum under **Design > Design** in that order, Trigger visible only when Pattern Change ON.
- Canonical **11** trigger options imported from `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` or canonical successor.
- At least **four independent** user-editable `color` controls under **Design > Palette**, each with a unique real visual role; proposed design has five.
- Optional Auto Performance can temporarily modify performance, but never rewrite saved authored selections or silently override hard user locks.
- Use no more than the engine's `CINEMA2_SHARED_LIGHT_LIMIT` (12) non-ambient lights; use shader emission for individual rods.
- Production canvas proof: visible primary geometry, every required control, music response, lifecycle, resize, performance and human visual review.

## Scope vs non-goals

| In scope | Explicitly out of scope for first release |
|---|---|
| Rod array topology, geometric patterns, audio-reactive choreography, manual Inspector, single primary world camera, restrained bloom | Cable simulation, swinging rigid-body physics, moving-head lasers, individual physical spotlights per rod |
| Deterministic 8×8 default; controlled 4–12 row/column range with a total cap | Procedural floor reflections, elaborate room architecture, extensive camera paths, video media slots |
| Existing Cinema 2.0 native GL renderer and production canvas | Changing shared Audio Intelligence or Visual Director definitions, rewriting Inspector, alternate mini-engine |

## Architecture decision

The hero visual is world-space because true layered depth and suspended geometry are essential. Render the rods with a GPU-instanced native module using a small number of reusable primitive meshes and per-instance transforms/emission. Use engine-owned camera/environment/render graph; effects are finishing only. Preset-owned choreography logic maps shared event/continuous **facts** into module-resolved targets; it must not detect music independently.

## Complexity discipline

Target **medium engineering effort relative to existing Cinema 2.0 modules**, not necessarily a short or one-file change. A compliant full preset still requires manifest/compiler integration, native renderer, six real patterns, schema-valid controls, audio/target routing, resets, tests, production captures and review. If scope grows beyond the documented geometry, **defer features** rather than weakening mandatory behavior.

## Files included

| File | Role |
|---|---|
| `00_SOURCE_AUDIT.md` | Current code research, evidence and caveats |
| `01_VISUAL_AND_GEOMETRY_SPEC.md` | Intended output/reference and geometry |
| `02_ARCHITECTURE_AND_FILE_MAP.md` | Integration and ownership boundaries |
| `03_INSPECTOR_AND_PALETTE.md` | Control schema, bindings, Palette and visible effects |
| `04_PATTERN_AND_TIMING.md` | Six patterns, canonical triggers, synchronization and continuity |
| `05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md` | Signal map, ownership matrix, directors and resets |
| `06_PHASED_IMPLEMENTATION.md` | Nine execution phases with gates |
| `07_TEST_AND_VISUAL_ACCEPTANCE.md` | Test coverage, fixtures and visual acceptance |
| `08_CODING_AGENT_HANDOFF.md` | Copyable implementation-agent prompt |
| `09_RELEASE_GATE.md` | Stop-ship checklist and handoff template |

**Authority:** The repository's `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` governs when this plan and the implementation differ. All parameter names, pattern names, sizes and numeric ranges below are **proposed product specifications** unless explicitly labeled as observed existing APIs. Review the latest source before beginning each phase.
