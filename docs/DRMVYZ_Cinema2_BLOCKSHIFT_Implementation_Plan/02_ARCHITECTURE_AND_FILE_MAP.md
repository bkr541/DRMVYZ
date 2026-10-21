# 02. Architecture and Concrete Integration/File Map

## Proposed new files

Place all preset-specific implementation under the existing Cinema 2.0 folder:

```text
src/components/vyzualz/cinema2/
  presets/
    Cinema2BlockshiftPreset.ts            # native manifest; schema, modules, Design parameters, effects, graph
  modules/
    Cinema2BlockshiftNativeModule.ts      # definition; create/update/render/dispose/action/inspect
    blockshift/
      Cinema2BlockshiftDomain.ts          # 9 immutable IDs, bounded configuration, group masks, types
      Cinema2BlockshiftLayout.ts          # base positions, instance pack, static safety envelopes
      Cinema2BlockshiftPatterns.ts        # six pure formation evaluators and stable pattern IDs
      Cinema2BlockshiftOrchestration.ts   # shared-time, pattern controller, envelope and authority composition
      Cinema2BlockshiftRenderer.ts        # owned WebGL2 geometry/instancing/shaders, draw and dispose
  __tests__/
    Cinema2BlockshiftPreset.test.ts
    Cinema2BlockshiftGeometry.test.ts
    Cinema2BlockshiftPatterns.test.ts
    Cinema2BlockshiftAudio.test.ts
    Cinema2BlockshiftAuthority.test.ts
    Cinema2BlockshiftRendering.test.ts
scripts/
  run-cinema2-blockshift-browser.mjs      # optional, modeled on existing native harnesses
```

Naming is a **proposal**. Import paths, manifest fields and method signatures must be checked against the checked-out live TypeScript definitions before implementation.

## Modify only these shared registration seams (unless a proven defect requires more)

1. `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts`: import + register `cinema2BlockshiftNativeModuleDefinition`, with existing fail-on-invalid-registration convention.
2. `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts`: import manifest, then add `defineCinema2FirstPartyPreset({ role: 'keeper', manifest: CINEMA2_BLOCKSHIFT_PRESET_MANIFEST })` exactly once.
3. Optional `package.json` entry for a dedicated browser harness only after the script exists.
4. Tests/docs as needed. **No preset-specific conditionals in React Inspector or audio bridge.**

## Manifest construction checklist

Use `CINEMA2_NATIVE_PRESET_SCHEMA_ID`, `CINEMA2_NATIVE_PRESET_SCHEMA_VERSION`, `cinema2NamespacedId`, `cinema2StableId`, and `cinema2Ref` from existing contracts. Suggested new identifiers (verify uniqueness):

- `CINEMA2_BLOCKSHIFT_PRESET_ID = drmvyz.cinema2.blockshift`
- native type ID `blockshift-native`, version `1`, exported from module file
- module ID `blockshift-sculpture`, scene root `blockshift-root`, camera `blockshift-camera`
- parameter IDs with `blockshift-` prefix, stable layer/render-target/pass IDs

The manifest must declare validated capabilities for WebGL2, depth-tested world rendering, 3D scene, camera and the actual audio features used; mark optional music capabilities as such when degraded behavior exists. Define a module declaration, authored module config (nine-block rig), module parameter bindings, camera/lighting scene nodes, a world layer, render color+depth attachments and the minimal supported post-processing pipeline. All refs must pass authoring and compiler diagnostics.

**Important:** A module-local parameter property name (`motionAmount`, etc.) must match each manifest `module.parameters` and `parameterBindings` target. Don't fabricate new top-level manifest fields for fixed transforms or arrays.

## Native runtime path

```text
Audio Bridge + host transport + Visual Director
                 |                |
                 v                v
    Cinema 2.0 Choreography / Target Runtime
                 |
       resolved generic parameters
                 |
      Native Module lifecycle.update(frame)
                 |
      BLOCKSHIFT choreography evaluator
        - authored pattern selection
        - persistent user base geometry
        - deterministic timing + transitions
        - continuous audio + event envelopes
        - bounded Auto Performance overrides
                 |
       9 instance transforms + colors
                 |
     world render provider (depth + camera)
                 |
       engine render graph/effects/output
```

**Module contract:** `create(context: Cinema2ModuleCreateContext)` obtains `context.parameters`, `context.targets`, `context.resources`, `context.randomness`. Its returned module exposes lifecycle `update` and `dispose`, world `render.providers`, optional `handleAction` for manifest-dispatched choreography events, and `inspect` for test visibility. The provider must use `execution.camera` and check `execution.depthAvailable`. Gate state updates once per `frame.frameId`, not once per render pass. No new animation loop.

**Resource lifecycle:** create WebGL2 buffers/programs through engine resource acquisition (`context.resources.acquire`), report GPU bytes, dispose on module destruction; never put long-lived WebGL handles in React component state or leak across preset switches. If reallocation is not needed because nine blocks are fixed, keep static geometry/buffers and update only per-frame instance data.

## Native geometry implementation

- One immutable indexed canonical cube rig with deterministic layout and group masks.
- GPU instance payload packs model matrix or TRS, face color, edge color and emission factors (same native renderer may draw body and edge batches).
- Body mesh opaque; edges luminous but must remain visible with bloom disabled.
- Depth test/write and shader matrix multiplication use the final provided camera; no hidden orthographic projection.
- Use standard world pass and engine-owned color/depth render targets; optional HDR bloom/cinematic finish only after visually complete geometry.
- Keep draw batches few (target <=4 for sculpture, excluding standard engine passes, to validate), and avoid per-cube spotlights and per-cube framebuffers.

## Choreography inputs/outputs: do not create a parallel architecture

- Continuous audio features and structural cues come from the frame's shared `audio`/`director` contexts and from manifest choreography-target bindings.
- Pattern advancement uses canonical event identities and **existing generic** `Cinema2MainframePatternController<Pattern>` behavior; do not copy its state machine unless unavoidable and tests make behavior identical.
- `handleAction` should only process typed, validated, deduplicated action/event identities the manifest actually emits. Do not trigger pattern changes from local wall-clock guesses.
- Choreography to native module must be **bounded** and target-addressable. Declare appropriate runtime channels for overall spread/rotation, bank offsets, selected-block offsets and color emission, then combine safely in the native orchestrator.
- The Visual Director supplies build/drop significance; it must **not** silently replace the user's Pattern or Color state.

## Other repositories/feature boundaries

This is a Cinema 2.0 first-party keeper, **not** Canvas Engine, legacy Cinema, the separate SHIFTGRID mosaic preset, or Afterhours 2.0. No backend database schema or user preset ownership changes are required for the baseline.
