# 02. Native module architecture, exact integration seams and file map

## Proposed new source files (names are specifications until implemented)

```text
src/components/vyzualz/cinema2/
  presets/
    Cinema2LightfieldPreset.ts                # keeper manifest, IDs, validated parameter+effect+graph bindings
  modules/
    Cinema2LightfieldNativeModule.ts          # module type, validation, lifecycle, render provider, inspect
    lightfield/
      Cinema2LightfieldDomain.ts              # typed fixture/tile model, stable row/column IDs, clamps, authority limits
      Cinema2LightfieldLayout.ts              # centered XZ grid, deterministic instances/banks, transform buffers
      Cinema2LightfieldPatterns.ts            # six pure geometric phase evaluators
      Cinema2LightfieldOrchestration.ts       # shared timing, musical envelopes, pattern change, resets
      Cinema2LightfieldRenderer.ts            # instanced opaque/emissive WebGL2 programs/buffers and draw/dispose
  __tests__/
    Cinema2LightfieldPreset.test.ts
    Cinema2LightfieldLayout.test.ts
    Cinema2LightfieldPatterns.test.ts
    Cinema2LightfieldAudio.test.ts
    Cinema2LightfieldAuthority.test.ts
    Cinema2LightfieldRendering.test.ts
scripts/
  cinema2-assets/
    accept-lightfield-production.mjs         # OPTIONAL; only if existing harness can be reused
```

## Required shared edits

1. `modules/Cinema2ModuleRegistry.ts`: import and register `cinema2LightfieldNativeModuleDefinition` once; check result and throw on failure, same style as existing modules.
2. `presets/Cinema2FirstPartyPresetCatalog.ts`: import `CINEMA2_LIGHTFIELD_PRESET_MANIFEST`, add exactly one `defineCinema2FirstPartyPreset({role:'keeper', manifest: ...})` declaration. Avoid public exposure of an incomplete preset unless current app supports a safe feature gate.
3. Existing tests and optional browser-harness command. **Do not add LIGHTFIELD branches to shared Inspector, Audio Intelligence bridge, target resolver, Visual Director or global React components.** Fix documented generic defects separately with shared regression coverage.

## Proposed identifiers

- Preset: `cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.lightfield')`
- Native module type: `cinema2StableId<Cinema2ModuleTypeId>('lightfield-native')`, version 1
- Module: `lightfield-floor`; scene root `lightfield-root`; camera `lightfield-camera`
- All params / scene / pass / effects IDs use `lightfield-…` prefixes with `cinema2StableId` and typed refs. Confirm against actual source before coding.

## Graph and native module route

```text
existing audio bridge + shared transport/beat source
      |                    |
      v                    v
Visual Director   native host frame context
      |                    |
      +----> shared Choreography/Target Runtime <---- Parameter State (authored)
                      |
               resolved parameters/actions
                      |
    Cinema2LightfieldNativeModule lifecycle.update(frame)
                      |
       Orchestration: pattern controller + phase + envelopes
                      |
    deterministic 8×8 tile transforms, bank colors, emission
                      |
 native world render provider (execution.camera, depthAvailable)
                      |
       existing render graph, HDR bloom if enabled, output
```

- `create(context: Cinema2ModuleCreateContext)` allocates host-owned shader/buffer resources with `context.resources.acquire(...)`, calls `reportGpuBytes`, initializes deterministic tile model and frame state, and supplies `render.providers` with `intent:'world'`.
- The provider uses the engine's **final camera** matrices and rejects missing required depth attachment/camera. Only the host calls execution; **no private `requestAnimationFrame`, Three.js standalone scene, alternate WebGL canvas or audio listener**.
- `lifecycle.update` computes state at most once per `frame.frameId`; `render` only consumes prepared state and submits geometry, even if the host renders multiple passes. Handle `dispose` by clearing envelopes/state and releasing owned resources via documented resource registration.
- Use `handleAction` only for a real supported, typed manifest choreography route. Deduplicate by stable event ID. Never guess an incoming payload contract; tests must demonstrate dispatch-to-visual change.
- `inspect` exposes counts, pattern, current phase, per-bank emission summaries, max displacement, last event identity, estimated GPU bytes and frame ID. `inspect` aids testing; it **does not replace** browser visual proof.

## Manifest outline (not fictitious TypeScript)

Use existing `Cinema2NativePresetManifest` fields as shown in real preset manifests: schema ID/version, capability declarations, `modules`, `scene` root/camera/light definitions, `cameras`, `layers`, `renderGraph` color+depth target/pass/output, `parameters`, `parameterBindings`, `choreography` (where appropriate), and validated effect bindings. **Check actual type members** in `Cinema2NativePresetManifest.ts` for exact shapes and do not add unrecognized fields.

The native module's authored config contains a bounded default tile rig, not mutable user settings secretly duplicated outside `Cinema2ParameterState`. Every exposed parameter must bind to a real module/camera/effect/environment consumer. Use `parameterBindings` and the target-resolution path for cross-system modulation. Rendering logic should receive the final resolved value after user+choreography composition, not stale manifest defaults.

## Geometry and lighting rendering plan

- For the floor: instanced opaque cube/slab mesh; inset emissive quad/plate mesh; optional single inset/rim batch. Shader uses per-instance model matrix, bank role, emissive RGB/strength, and the final camera's view-projection. Correct depth/occlusion.
- Host-light count: target 0–2 non-ambient lights plus ambient environment. `CINEMA2_SHARED_LIGHT_LIMIT = 12` is an absolute shared maximum. **Not one real light per tile.**
- Start with emissive material whose boundaries remain readable **without bloom**. Standard post-processing comes later and must support OFF/default/MAX.
- Dynamic 4×4 to 12×12 topology changes should reallocate instances deterministically and dispose replaced resources safely; keep a persistent buffer capacity up to 144 if simpler.
- The native renderer must not mutate global GL state it fails to restore according to current module conventions. Compile/link failures must be surfaced through diagnostics. Benchmark GPU bytes, draw batches and quality tier behavior.

## Data/authority boundary

Audio Intelligence provides facts; Visual Director gives significance; Choreography maps those facts to temporary bounds; Parameter State stores user-authored base; Native Module defines LIGHTFIELD's actual tile arrangement and six motions. Auto Performance can adjust only declared domains. See [05](05_AUDIO_CHOREOGRAPHY_AND_AUTHORITY.md) for explicit resolution order and limits.
