# LIGHTFIELD | DRMVYZ Cinema 2.0 implementation package

**Source snapshot:** `DRMVYZ-main (5).zip` (2026-10-21); contract: `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` in source root.  
**Deliverable:** source-grounded, phased Markdown plan. No application code has been modified; no production tests have been run.  
**Preset role:** first-party `keeper` (proposal). **Proposed ID:** `drmvyz.cinema2.lightfield`. **Complexity:** low–medium only under the bounded scope below; full contract integration/testing still carries real work.

## Intent

LIGHTFIELD is a **dark perspective floor of independently addressable luminous square panels**, with rhythmic, coordinated tile *light and shallow physical displacement*. The 8×8 default floor is an installation, not a terrain simulator, puzzle, MIDI keyboard, or conventional 2D equalizer. Patterns move through space as checked waves, radial ripples, traveling rows, diagonals, central crosses, and splitting planes. Every pattern has a different geometric signature, even when tile colors are held constant. Each light role is independently editable. Music affects motion, brightness, and staging, but never overwrites the user's authored layout.

### First-release scope lock

- World-space, shallow 3D floor; default **8×8 tiles**, configurable **4–12** rows and columns, **144 max**; opaque tile bodies and inset emissive panels; modest gap, depth, perspective camera.
- Native **WebGL2 instancing** (or an existing equally efficient module-compatible renderer if confirmed); bounded vertical offset and optional small tilt; zero simulated physics.
- **Six real authored patterns**: Checker Pulse, Center Ripple, Row Run, Diagonal Cut, Cross Axis, Split Plane.
- One static hero camera, optional tightly bounded camera motion; no mandatory mirror floor/reflection pipeline, asset packs, video, imported GLBs, custom lighting backend, per-tile lights, or new engine subsystem.
- Shared Cinema 2.0 Audio Intelligence, Visual Director, Choreography/Target Runtime, parameter ownership, render graph, resource lifecycle, and quality settings.
- **BPM Sync** in **Design > Master Controls**; **Pattern > Pattern Change > Trigger** under **Design > Design**; minimum four independent colors in **Design > Palette** (plan specifies five). Trigger must use the **exact eleven established options**.
- Source-first implementation, human-visible production-canvas approval, full reset/playback lifecycle checks and stop-ship gates.

## Read in this order

| File | Purpose |
|---|---|
| [00_SOURCE_AUDIT.md](00_SOURCE_AUDIT.md) | Actual source paths, standard, available APIs and uncertainties |
| [01_VISUAL_AND_GEOMETRY_SPEC.md](01_VISUAL_AND_GEOMETRY_SPEC.md) | LIGHTFIELD look, tile rig, safe geometry, camera and idle reference |
| [02_ARCHITECTURE_AND_FILE_MAP.md](02_ARCHITECTURE_AND_FILE_MAP.md) | Module/manifest registration, ownership and target/render design |
| [03_INSPECTOR_AND_PALETTE.md](03_INSPECTOR_AND_PALETTE.md) | Types, parent groups, exact control consumers, palette independence |
| [04_PATTERN_AND_TIMING.md](04_PATTERN_AND_TIMING.md) | Six independent patterns, event-driven switching, BPM Sync |
| [05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md](05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md) | Signals, Director, authority matrix and envelope budgets |
| [06_PHASED_IMPLEMENTATION.md](06_PHASED_IMPLEMENTATION.md) | **P0–P9** ordered implementation tasks and exit gates |
| [07_TEST_AND_VISUAL_ACCEPTANCE.md](07_TEST_AND_VISUAL_ACCEPTANCE.md) | Unit, compiler, browser pixel/video, fixture and human proof |
| [08_CODING_AGENT_HANDOFF.md](08_CODING_AGENT_HANDOFF.md) | Standalone Claude Code/Codex task with hard boundaries |
| [09_RELEASE_GATE.md](09_RELEASE_GATE.md) | Release blockers and evidence template |
| [10_REQUIREMENTS_TRACEABILITY.md](10_REQUIREMENTS_TRACEABILITY.md) | Contract-to-implementation/test crosswalk |
| [11_RISKS_AND_SCOPE.md](11_RISKS_AND_SCOPE.md) | Actual effort drivers, constraints and deliberate non-goals |

## Implementation principle

**Geometry → manual controls → native motion → shared audio → choreography → Visual Director → optional Auto Performance → camera/effects → production acceptance.** Follow the root contract, not merely compiler success or conventions copied from older noncompliant presets. The proposed numbers/IDs herein are product specifications, **not claims that corresponding TypeScript APIs exist**. Confirm the live checkout before implementation; do not invent schema fields.
