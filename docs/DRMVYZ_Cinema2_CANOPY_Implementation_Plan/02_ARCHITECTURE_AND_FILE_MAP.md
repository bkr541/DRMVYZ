# 02. Native Architecture, Ownership, and Proposed File Map

## Preset placement and registry

Proposed TypeScript additions relative to repository root:

```text
src/components/vyzualz/cinema2/
  presets/
    Cinema2CanopyPreset.ts                 NEW: schema-valid manifest, exported CANOPY ID
    Cinema2FirstPartyPresetCatalog.ts      EDIT: keeper declaration and import
  modules/
    Cinema2CanopyNativeModule.ts           NEW: module definition/lifecycle, resolver, render provider
    Cinema2ModuleRegistry.ts              EDIT: import and explicit module registration
    canopy/
      Cinema2CanopyDomain.ts               NEW: types, fixture addresses, clamps, defaults
      Cinema2CanopyLayout.ts               NEW: deterministic row/column positions, GPU instance packing
      Cinema2CanopyPatterns.ts             NEW: six physical formations and phase sampling
      Cinema2CanopyOrchestration.ts        NEW: pattern controller, resets, performer state
      Cinema2CanopyRenderer.ts             NEW: one/few native instanced WebGL2 draw batches
  __tests__/
    Cinema2CanopyPreset.test.ts            NEW: compiler/Inspector/bindings/registration
    Cinema2CanopyGeometry.test.ts          NEW: layout, bounds, pattern distinctness, determinism
    Cinema2CanopyAudio.test.ts             NEW: trigger, choreography, sync, resets, authority
    Cinema2CanopyNativeRendering.test.ts   NEW: mocked GL lifecycle/render guarantees
scripts/
  run-cinema2-canopy-browser.mjs           NEW: reuse existing production browser harness style
package.json                               OPTIONAL EDIT: add test:e2e:cinema2-canopy script
```

Use a smaller file set if appropriate, but retain **separate testable geometry and music/authority domain logic**. Avoid modifying unrelated presets or the shared engine when a local implementation is sufficient.

## Required registration sequence

1. Author `CINEMA2_CANOPY_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.canopy')` and `CINEMA2_CANOPY_PRESET_MANIFEST` using existing `CINEMA2_NATIVE_PRESET_SCHEMA_ID/VERSION` and stable IDs.
2. Define/export `CINEMA2_CANOPY_NATIVE_MODULE_TYPE_ID`, `CINEMA2_CANOPY_NATIVE_MODULE_VERSION = 1`, and `cinema2CanopyNativeModuleDefinition` implementing `Cinema2ModuleTypeDefinition`.
3. Import and register the module in `modules/Cinema2ModuleRegistry.ts`, checking the registration result like other modules.
4. Import manifest and add `defineCinema2FirstPartyPreset({role:'keeper', manifest: CINEMA2_CANOPY_PRESET_MANIFEST})` to `presets/Cinema2FirstPartyPresetCatalog.ts`.
5. Assert the `Cinema2PresetRegistry` authoring gate and compiler both accept the manifest; assert exactly one catalog entry and no duplicate IDs.

## Manifest composition (actual supported fields)

`Cinema2NativePresetManifest` in current snapshot allows:

- `schemaId`, `schemaVersion`, `id`, `revision`, `metadata`
- `capabilities` (purpose + correct required/optional declarations)
- `parameters`, `modules`, `scene`, `layers`, `cameras`, optional `lighting`
- `environment`, `render`, optional `effects`, `choreography`, `defaults`, `output`

CANOPY should author **only the subsystems it visibly needs**. The minimum design includes: a world module node, world layer with depth policy, perspective camera with safety, background environment linked to Palette, scene color/depth render target, scene pass and final output, plus choreography rules. HDR bloom is optional until post-core phase; a modest bloom/finish pass can be added after visual tests pass.

## Specific wiring contract

```text
Design Inspector (schema-backed parameters)
       |  authored persistent values
       v
Cinema2ParameterState
       |  refs / bindings
       v
Cinema2TargetRuntime / final resolved values <---- Cinema2ChoreographyRuntime
       |                                     ^
       v                                     | canonical signals
CANOPY native module                       AudioIntelligenceBridge + VisualDirector
       |  indexed fixture geometry + per-instance transforms/emission
       v
World Render Pass (engine-owned target/depth)
       | optional engine-owned bloom/finish
       v
Cinema2 production compositor/output
```

`Cinema2ModuleCreateContext.parameters.get(name)` supplies resolved values (see `Cinema2ModuleContracts.ts`); `getAuthored`/`resolve` are also present. Declare an explicit `parameterBindings` entry for every exposed control that is consumed by the module. For background color use `environment.controls.backgroundColor`, not a pretend native module-only color. For effect/camera controls, bind to real effect/camera/environment properties when supported by the schema. Internal choreography-only channel names belong in module `parameters` (not Inspector primary controls) and need valid action targets.

## Native module lifecycle

- `validate(module)`: finite/allowed geometry config, quality guardrails, unique addresses.
- `create(context)`: compile/reuse instancing shader, acquire GL buffers/VAOs/program using `context.resources.acquire`, publish GPU byte estimates, initialize seeded deterministic procedural state.
- `lifecycle.update({frame,parameters,targets})`: resolve current user base, shared timing, pattern controller, music envelopes (resolved targets), calculate immutable/typed per-fixture state; reset when track identity or context changes.
- `render.providers[0]`: `{id, moduleId, intent:'world', execute(ctx)}` draws against engine-owned target with `ctx.camera`, `ctx.depthAvailable` and `ctx.lightingEnvironment`; no private framebuffer or independent RAF.
- `lifecycle.dispose()`: reset local controllers, references; host releases owned resources via resource facet. Confirm precise lease disposal semantics with module registry tests.
- Optional `handleAction(action,event)`: use only if choreography rule explicitly binds a module action. Most scalar channels should instead resolve through the normal target/value pipeline.

## Geometry + render strategy

Use the **Depth** pattern as reference for a dedicated native instanced renderer:

- shared rod/cap primitive vertex/index buffers;
- stable per-instance indices and row/column metadata;
- per-instance `position`, `length`, optional `rotation`, `colorRole`, `emission` packed in typed arrays;
- shader reads normal, camera matrix and indexed emission; diffuser emissive output distinguishable from nonemissive dark cap;
- update buffer sub-data each frame or batched dirty changes; clamp all values;
- normal depth test/write and alpha handling suited to opaque + emissive rods;
- bright rod data should be lit independent of per-rod scene spotlights;
- no shadow map needed for first release (avoid hidden shadow cost).

If using THREE in a native module, prove that it interoperates with engine-owned WebGL2 state and resource lifetime before committing to it. The existing Depth renderer is a safer initial reference than introducing a new Three scene/renderer layer.

## Capability declarations

Declare `render.webgl2`, `render.depth`, `scene.3d`, `camera.world` required, with specific purposes, and add whichever shared music/visual-director capabilities the manifest actually uses as optional. Declare renderer/effect capabilities such as history **only if** actually used. Validate with `validateCinema2PresetAuthoringConventions` and `compileCinema2NativePreset`.

## Boundaries: do not violate

| Domain | Owns | Must **not** own |
|---|---|---|
| Shared Audio Intelligence | musical facts, published event IDs and clocks | rod selection, CANOPY choreography, preset appearance |
| Visual Director | generic intensity, impact/build significance | native geometry, pattern persistence, authoring choices |
| Choreography | transient bounded target contributions | rewriting persisted user controls, local beat detection |
| Parameter State | authored user values and reset/persistence | hidden performance decisions |
| Native CANOPY module | fixture positions, transform/easing, per-fixture light, specific six patterns | audio detector, separate camera runtime, private animation loop |
| Scene/Camera/Effects/Render | compositing, lights, projection, engine-owned targets | compensating for missing/bad hero geometry |

## Source validation before editing

The exact `Cinema2NativePresetManifest` types, available effect IDs, renderer conventions, and pattern controller API must be checked in the current branch at implementation time. This plan is prescriptive about required behavior, **not** a claim that all CANOPY-specific functions already exist.
