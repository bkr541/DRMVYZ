# 08. Standalone coding-agent implementation handoff (Claude Code / Codex)

## Copyable task

Implement a **new first-party Cinema 2.0 keeper preset named LIGHTFIELD** against the current branch of DRMVYZ. Use this package's Markdown files as the product/architecture/acceptance plan, and the live repository's `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` as the mandatory authority. Do not silently replace the contract with conventions from older presets. Work through phases **P0–P9**, show evidence, and **STOP** at any unsuccessful phase exit gate rather than moving to later enhancements.

LIGHTFIELD must be a native world-space **8×8 default dark tile floor**, expandable from 4 to 12 rows and columns (maximum 144), with matte shallow 3D slabs, individually addressable emissive inset panels, deterministic group IDs, a perspective camera, true depth testing, and a minimal supported render graph. Tiles undergo small **real** vertical/tilt motions and targeted light animation. Geometry must remain visibly correct and readable with bloom disabled. No imported model, reflection engine, audio detector, rigid-body simulation, individually rendered spotlights, or new 3D application engine should be necessary.

### Required native pattern library

Implement six distinct physically realized geometric choreographies, each different with colors equalized and bloom OFF:

1. Checker Pulse: alternating parity-bank lift.
2. Center Ripple: outward radial raised ring.
3. Row Run: front-to-back moving full-row ridge.
4. Diagonal Cut: diagonal traveling raised band.
5. Cross Axis: raised central cross arms with timed propagation.
6. Split Plane: opposing shallow lifts/tilts of left and right halves.

All six must respect Motion Amount, Lift Range and grid dimensions; a pattern cannot be merely the same shader with a different hue.

### Required shared controls

- In **Design > Master Controls**, a real **BPM Sync** boolean; ON follows the shared musical clock/beat-grid when available, OFF runs documented authored free timing; no independent BPM detector, no frozen behavior on pause/seek/loop.
- In **Design > Design**, in order: **Pattern** enum (six real choices), **Pattern Change** boolean OFF by default, **Trigger** enum conditionally visible only when Pattern Change ON; import the canonical 11 options from `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` or the project's confirmed successor.
- Pattern Change OFF holds authored Pattern; ON advances only on new qualified shared Trigger events, suppresses duplicates; manually choosing Pattern while ON **immediately changes the base, leaves Pattern Change ON** and holds until next **fresh** event.
- At least four independent actual `color` settings within **Design > Palette**. Implement five roles: Background, Tile Surface, Primary Panels, Secondary Panels and Accent Hits, each with separate visible consumers.
- Real Grid controls (Rows, Columns, Tile Size/Gap/Thickness), Motion Amount/Rate/Lift Range/Wave Focus, Master Intensity, Audio Sensitivity, Hit Strength, Idle Glow and only optional camera/bloom controls with proven runtime consumers.
- Exact four standard Inspector top-level groups only; never special-case the shared React Inspector.

### Required engine architecture

Create `Cinema2LightfieldPreset.ts` and a versioned `Cinema2LightfieldNativeModule.ts`, plus small private `modules/lightfield/` helpers for domain/layout/patterns/orchestration/renderer. Register the first-party keeper only through `Cinema2FirstPartyPresetCatalog.ts`, and the native module only through `Cinema2ModuleRegistry.ts`; use type-safe IDs/schema refs, validated `parameterBindings`, scene/camera/world layer/color+depth render graph, engine-provided camera and host resource acquisition/report/disposal. Compute state at most once per host frame. No alternate RAF, direct WebAudio analysis, hidden React canvas, TypeScript `any` escape hatches or global runtime branching for LIGHTFIELD.

All audio features and events must originate from shared **Audio Intelligence**; **Visual Director** only provides macro significance, **Choreography/Target Runtime** owns bounded music-to-parameter actions, **Parameter State** owns authored user bases, and the native module owns tile geometry/material/animation. Kick, snare, sustained bass, highs, vocals, phrase, build and drop need distinct observable destinations as specified in `05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md`. Avoid mapping everything to brightness. All automated values return to the user's base after event decay, with hard authorizations respected.

`Auto Performance` is OFF by default. In v1 it may apply bounded lift/brightness/camera-with-permission significance, but **does not** override Pattern, tile layout, palette, hard OFFs or the Pattern Change toggle. Preserve the mandatory manual-pattern exception and future temporary build/drop override rules if scope later changes.

### Mandatory execution sequence

1. **P0** inspect current source/types/harness, confirm collisions, commit/branch state and baseline failures.
2. **P1** approve static reference/look, 6 physical patterns, parameter+palette+authority matrix and camera-safe bounds.
3. **P2** create native instanced geometry and minimal host world render; capture bloom-OFF hero proof before wiring audio.
4. **P3** implement all Inspector parameters/palette with real consumers and min/default/max visual proofs.
5. **P4** implement six pure geometry patterns, generic Pattern Change controller, BPM Sync ON/OFF, resets and timing tests.
6. **P5** wire shared Audio Intelligence events/continuous/structural actions; prove all eleven triggers and meaningful audio output.
7. **P6** connect bounded Director/Choreography/Auto Performance while proving exact manual authority.
8. **P7** add only useful optional camera/effects, optimize renderer, test resize, quality and re-entry.
9. **P8** run actual browser production-canvas acceptance matrix and human visual review, not just compilation.
10. **P9** publish only with explicit release evidence and signed STOP/GO traceability.

### Required response from coding agent at each phase

Report: **phase / files changed / architecture choices / commands + raw PASS/FAIL / evidence path(s) / unresolved concerns / GO or STOP**. Never label a unit-only render test as production visual acceptance. Do not claim a defect fixed solely because code compiles; do not claim a screenshot/video exists unless actually captured. Do not proceed across a STOP gate without resolving the defect.

### Scope control

No terrain simulation (separate TERRAFORM concept), sliding-tile puzzle (SHIFTGRID), Canopy rod mechanics, independent Auto Pattern Director, animation libraries, full scene environment, new asset pipeline, backend schema or user preset ownership changes. If required to introduce such systems, stop and propose a scoped alternative with rationale rather than quietly changing this plan.

## Reading checklist for agent

- [ ] `00_SOURCE_AUDIT.md` and live contract
- [ ] `01_VISUAL_AND_GEOMETRY_SPEC.md`
- [ ] `02_ARCHITECTURE_AND_FILE_MAP.md`
- [ ] `03_INSPECTOR_AND_PALETTE.md`
- [ ] `04_PATTERN_AND_TIMING.md`
- [ ] `05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md`
- [ ] `06_PHASED_IMPLEMENTATION.md`
- [ ] `07_TEST_AND_VISUAL_ACCEPTANCE.md`
- [ ] `09_RELEASE_GATE.md`
- [ ] `10_REQUIREMENTS_TRACEABILITY.md`
- [ ] `11_RISKS_AND_SCOPE.md`
