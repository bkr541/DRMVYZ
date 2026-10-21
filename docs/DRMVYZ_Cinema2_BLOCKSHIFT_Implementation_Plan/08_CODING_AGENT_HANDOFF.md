# 08. Coding-Agent Handoff: Implement BLOCKSHIFT Against the Updated Source

Copy the following as the implementation instruction to your coding agent along with this Markdown package and the DRMVYZ source. Treat this package as planning; validate against your *current* checkout before coding.

---

## Instruction for Claude Code / Codex

Implement the new first-party **BLOCKSHIFT** preset in the **React Cinema 2.0** engine of DRMVYZ, using the repository root `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` as the mandatory normative standard and the accompanying BLOCKSHIFT Markdown planning package as the detailed spec.

**Do not create a demo, standalone app, second engine, legacy renderer, disconnected scene or mock controls.** The work must result in a production-registered keeper using the native manifest/module, existing scene/layer/render graph, Audio Intelligence, Visual Director, choreography, generic Inspector, parameter state, camera, effects and runtime/resource lifecycle.

### First, inspect and reconcile

Read `README.md`, `00_SOURCE_AUDIT.md`, and the root contract. Inspect the actual code paths named in `02_ARCHITECTURE_AND_FILE_MAP.md`. Confirm the latest APIs and first-party registry behavior. Check that no BLOCKSHIFT implementation or conflicting IDs exist. Record deviations and initial test health. **Do not invent APIs.**

### Visual goal and hard scope

Build **nine stable, distinct floating black 3D cubes with emissive edges**, clear world-space depth and a refined dark stage. Use instancing/combined buffers where supported and a standard Cinema 2.0 world render provider using engine camera/depth. No physics, collision simulation, imported model, independent RAF, independent music detector, slideshow or puzzle. Six distinct geometric formations: Stack, Orbit, Stagger, Split, Wave, Collapse. Physical transformations and transitions must remain visible with audio and bloom OFF.

### Required controls and behaviors

- **BPM Sync** boolean in **Design > Master Controls**, functionally controlling motion timing and having tested Sync ON/OFF behavior.
- **Pattern** enum, **Pattern Change** boolean default OFF, **Trigger** enum in precisely this order within **Design > Design**. At least six functional BLOCKSHIFT-native patterns. Trigger visible only when Pattern Change ON; preserve value while hidden. Import the exact eleven Afterhours trigger options, unmodified.
- Manual Pattern change immediately takes effect even when Pattern Change is ON, leaving it ON; only a *new qualifying* selected Trigger advances again. Deduplicate event IDs and handle pause, seek, loop, track swap, reset and preset re-entry. Runtime base selection never rewrites saved authored Pattern.
- At least **four individually effective** colors under **Design > Palette**; this package specifies five: Primary Edge, Secondary Edge, Impact Accent, Block Body, Background. Each changes its own rendered region.
- Generic Controls under the four allowed top-level groups only; don't add preset-name branches in React Inspector.
- Fully wired Spread/Depth/Block Size/Rotation Range/Motion Amount/Audio Reactivity, Master Intensity, scoped Auto Performance and any implemented optional camera/effect controls.
- Shared Audio Intelligence routing for sub/bass/mids/highs/vocals/energy, kick/snare/downbeat, phrase, section, build, drop, using real current engine features. No private beat or drop detection.
- Visual Director supplies bounded macro timing/intensity; choreography uses proper target operations and user-authority logic.
- Auto Performance can **temporarily** override a build/drop performing pattern without changing underlying persisted Pattern/Pattern Change/Trigger, undoing manual input, or disabling manual controls. Underlying pattern may advance on valid triggers and must resume after override.
- Native WebGL resources owned/cleaned via existing module resource lifecycle, stable instance IDs, resolved parameters read at runtime, no GL leaks.

### Execute phases exactly

Follow **P0 to P9** in `06_PHASED_IMPLEMENTATION.md`. At each gate show:

1. Files added/changed and reasons.
2. Which requirements/control IDs are satisfied and where they bind.
3. Focused tests executed and actual outcomes.
4. Production-canvas screenshots/motion or explicit gate blockers.
5. STOP/GO statement. **Do not silently move past failed visual gates.**

Author tests alongside the relevant phase. When implementing shader/native logic, reuse the Depth module's successful architecture instead of copying shaders without checking matrix/depth conventions. Reuse the generic pattern controller or documented shared successor. Keep all internal signals bounded, deterministic and physically visible.

### Mandatory final evidence

Produce stable idle screenshot with bloom OFF; six-pattern screenshots + ≥4-frame motion strips, transition recordings, an actual five-color separation proof, all eleven Trigger tests, Pattern Change manual-edit/Auto Performance authority test, audio kick/snare/build/drop evidence, BPM Sync ON/OFF contrast, hard-disable tests, portrait/square/wide views, renderer lifecycle/performance notes, and passing source/compiler/test commands. Use the production React Cinema 2.0 canvas, not an isolated demo. Do not claim pass without observed output.

### Final report format

```text
Preset ID and native type/version:
Changed code files:
Phase P0–P9 gates and evidence:
Manifest/compiler/typecheck/build/focused tests:
Production canvas screenshots/videos:
Manual Pattern Change / Trigger / Auto Performance authority proofs:
Audio routing and event dedup proofs:
Geometry, clipping and transform safety proofs:
Performance, GPU resource and re-entry checks:
Open defects and whether each blocks shipping:
SHIP / NO SHIP with rationale:
```

The implementation is **not done** if the cubes render but a mandatory control or standard audio/choreography path does not work.

---

## Interpretation policy

- If this plan names a proposed helper/file/API not present in current source, implement it within existing interfaces rather than fabricating framework behavior.
- If source conventions conflict with older preset implementations, follow the current **root creation contract**, report the discrepancy, and avoid broad unrelated refactors.
- Keep P0/P1 design decisions explicit, particularly time source, host BPM Sync composition, transition interruption, conservative collision envelopes and optional effects.
- Favor scoped medium complexity over aesthetic bloat.
