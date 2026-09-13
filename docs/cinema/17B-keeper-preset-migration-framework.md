# Cinema 2.0 Stage 17B keeper preset migration framework

Stage 17B establishes the authoring and registration gate for future native Cinema 2.0 keeper presets. It does not migrate the Cinema 1 catalog and it does not introduce a Cinema 1 compatibility contract.

## Production registration path

First-party native presets are declared in `Cinema2FirstPartyPresetCatalog.ts`. Production startup routes each declaration through two gates before the preset is available to the workspace:

1. `validateCinema2PresetAuthoringConventions()` checks first-party authoring conventions that are stronger than the generic native schema.
2. `Cinema2PresetRegistry.register()` runs the native compiler and stores only successfully compiled manifests.

The runtime and Inspector remain preset-agnostic. A future keeper adds its native manifest to the first-party catalog; keeper-specific controls remain authored in the parameter schema and appear through the existing Inspector projection without preset identity branches.

## Authoring gate

For reference and keeper declarations, the authoring gate requires:

- `render.webgl2` to be declared as a required top-level capability;
- every top-level capability to include a short authored purpose;
- nested module, parameter, media and choreography capability use to be declared at the preset boundary, without weakening a nested required capability to optional;
- user-facing parameters to be consumed through native module/effect bindings, camera/light/environment controls, choreography routes/targets, or the shared engine-owned quality parameter; and
- native compiler validation to remain the authority for IDs, references, target compatibility, render/scene graphs and authored combinations.

Resource ownership is not represented by an author-attestation flag. Module implementations receive WebGL only through the existing tracked `context.resources.acquire()` boundary, and runtime lifecycle tests verify that leases are retired on disposal/failure. Render targets, history and media continue to use their existing engine-owned services.

## Migration decision vocabulary

Before implementing a Cinema 1 candidate as a Cinema 2.0 keeper, record one of these decisions in the relevant stage/design note. This is guidance, not runtime state:

| Decision | Use when |
|---|---|
| **Port** | The creative behavior is worth retaining and already maps cleanly to native Cinema 2.0 ownership/contracts. |
| **Rebuild** | The identity is worth retaining, but legacy ownership, audio analysis, lifecycle or rendering structure must be replaced with native Cinema 2.0 mechanisms. |
| **Enhance** | The keeper should retain its identity while taking advantage of native Cinema 2.0 capabilities such as tracked resources, Visual Director, deterministic randomness, media ownership, camera or effects. |
| **Consolidate** | Multiple legacy concepts should become one native keeper because their meaningful behavior overlaps and separate ports would duplicate architecture or UI. |
| **Skip** | The candidate is obsolete, redundant, low-value, incomplete, or would require preserving legacy ownership/compatibility debt. |

A decision does not automatically migrate anything. Each future keeper remains a separately justified implementation.

## Next-preset gate

A future keeper is ready to enter the first-party catalog only when all applicable items are true:

- it is a native `Cinema2NativePresetManifest`, not a Shader Scene/Cinematic World compatibility wrapper;
- capabilities are explicit and unavailable optional inputs degrade as unavailable rather than fabricated zeroes;
- user-facing controls are schema-authored and connected through generic bindings/targets;
- preset-specific algorithms remain in module/preset code while shared lifecycle, camera, targets, effects/history, media and diagnostics remain engine-owned;
- module GPU objects use tracked resource scopes and clean up under disposal/failure/context loss;
- choreography writes only to compiled shared targets and does not become an alternate parameter source of truth;
- registration succeeds through the first-party declaration catalog and native compiler;
- at least one test enters the real `Cinema2Runtime.create()` service path; and
- Cinema 1 behavior remains untouched unless a separately justified low-level utility extraction is required.

Reference Visual, Spatial Reference, Reactor 2.0 and Electric Storm 2.0 remain the concrete examples for these conventions. They are examples, not special cases in generic runtime or Inspector code.
