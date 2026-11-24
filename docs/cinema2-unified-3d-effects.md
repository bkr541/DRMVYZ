# Cinema 2.0 unified private-model effects (Phase 01)

## Architecture audit and ownership

The six user-model previews are registered first-party reference presets, built by `Cinema2UserModelPresetFactory` and compiled by the native preset registry. They already shared the Three scene module, model resolver/cache/slot, prepared model geometry and several effect-specific builders. The preset's `userModelPreview` config previously fixed the effect for the lifetime of the scene. This phase keeps that config as a compatibility default, not a restriction on the live representation.

The Media Manager's existing model records and immutable version references remain the source of truth. The scene module continues to select a pinned `user-model:<asset-id>:<version>` via `Cinema2UserModelSlot` and its resolver/cache; changing a mode does not change that selection. The Three scene bridge still owns the model lease, normalized source tree, quality-tier texture copies, scene camera, lighting, render graph and output. No changes to the asset repository, renderer output or casting are required.

`Cinema2UnifiedUserModelEffects` is the scene's single model-effects controller. It prepares one bounded root-local rest pose on attachment, maintains the common model pivot, and uses the existing `Cinema2UserModelPreviewEffects` as a reusable representation implementation. The effect subtree clones node transforms and materials but shares imported geometry and textures. The actual source remains available for fallback. Existing fracture geometry, surface sampling/dissolve, hologram geometry/scan shader, capped horizontal slices and 3D occupancy grids remain the mode implementations. Preparation buffers are read-only to the effects. Each representation owns only its derived buffers/materials; releasing a mode must never release the resolver's geometry, texture or version lease. On model replacement or unmount the wrapper releases all modes and the shared preparation, then restores the source children for bridge teardown.

The wrapper publishes one beat-clock sample to its resident representations per module update. Existing pattern controllers, triggers, Auto Performance and shared music publication remain in use. No new analysis or transport is introduced. Mode changes do not reactivate the preset or restart the scene clock.

## Operation and persisted state

Open any of the six existing model previews and choose a model in the existing Source workflow or Design inspector. In Design, choose Default Representation or select a live Representation. `Default` follows the stored default, initially the original preset's mode. Model Position is measured in half-extents, Model Rotation is XYZ degrees, and existing yaw and scale controls are retained. The native orbit rig provides azimuth, elevation, radius and target offset with the original neutral framing as the default. Mode changes do not edit these camera settings. The four existing Design parent groupings are retained; the additional groups and properties use standard inspector definitions.

Musical Cycle preserves the original representation/reassembly behavior. Hold Representation holds the selected transformed pose while the existing pattern animates it. The six modes have their own pattern selections; the original preset's Pattern parameter ID remains intact. Effects controls expose Form material selection, shard count/spread/rotation, dust density/drift/flow, hologram glow/transparency/scan density, slice separation/direction, and block detail/separation. Slice direction is the separation motion axis, not a new cutting-plane algorithm. Voxel detail is bounded by the current render quality. The original palette and shared controls remain available.

The six preset IDs and revision 1 are unchanged. The existing parameter-state restore path initializes newly introduced properties from authored defaults and overlays old values, including pinned model/version, pattern, and transforms. No asset or saved workspace migration is needed for older records. All new controls use normal persistent parameters.

## Transition and lifecycle policy

Transition Duration defaults to zero (immediate) with optional linear or smoothstep opacity blending up to three seconds. Transitions advance using the module's frame timestamp rather than audio transport; per-frame elapsed time is capped to avoid large jumps on suspension. A reverse selection reverses the transition. A third selection retains the dominant visible mode and retires the other to bound residency to two mode subtrees. This is an opacity transition, not a geometric morph; transparent-surface ordering and cold construction cost are limitations of this phase. New mode construction is synchronous and can be expensive for complex geometry. Mode construction failures retain or select Form, or the original source if preparation itself fails; unsupported source geometry is not repaired. Diagnostics report the failure. Quality-tier texture changes follow the existing bridge-owned texture tier rather than allocating duplicate textures. No output aspect-ratio policy changes are included.

## Verification

`Cinema2UnifiedUserModelEffects.test.ts` covers all ordered mode pairs on procedural car and extruded-logo geometry, stable shared transforms and version identity, nonempty visible scene trees, reverse/third-target transitions, model replacement, resource ownership, remount, unsupported geometry and serialization of every compatibility preset. `Cinema2UserModelPreviews.test.ts` retains the existing mode and pattern tests and checks the exposed model selector. These are CPU-side scene tests, not visual output comparisons.

Run from the repository root after `npm ci`:

```sh
npx vitest run src/components/vyzualz/cinema2/model/Cinema2UnifiedUserModelEffects.test.ts src/components/vyzualz/cinema2/model/Cinema2UserModelPreviews.test.ts
npm run typecheck
npm run test
npm run build
```

A GPU/browser review is required before asserting seamless frames, visual fidelity, production/cast stability or performance on large real-world imports. The implementation environment could not resolve the npm registry, so dependency installation and dependency-backed checks were blocked; no before/after WebGL captures were produced.
