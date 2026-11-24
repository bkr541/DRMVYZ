# Cinema 2.0 unified model effects: Phase 02

This is an additive upgrade to [Phase 01](cinema2-unified-3d-effects.md). The six compatibility preset IDs, revision 1, private model version lease, normalized model pivot, camera, shared quality tier, beat clock, Pattern/Pattern Change/Trigger and Auto Performance authority are unchanged. No extra runtime package is required: Three's existing wide-line addons load with the lazy Three library.

## Representations and controls

| Mode | Implementation | New controls |
| --- | --- | --- |
| Form | Original cloned PBR/physical slots, shared textures and authored normals; optional volume-balanced affine flex with normal-matrix shading | Surface Flex |
| Shatter | Recursive irregular planar partitions of real source triangles and closed cut caps where topology permits; seeded pivots, independent rotation and smaller secondary shards | Fracture Detail (Auto/48/96/192 plus legacy 4/12/24), Secondary Debris, Fine Crack Separation |
| Dust | Area-stratified rest samples in progressive order, two immutable point buffers with spatial ranks and independent seeds, GPU motion/soft grain alpha, analytic turbulence and exact rest interpolation | Particle Size, Turbulence, Opacity; existing Density, Drift, Flow |
| Hologram | Geometry-derived wide edge ribbons and sampled structural triangle lines, directional surface scan, view-space rim light, translucent source and pattern-driven echoes | Structural / Scan Line Density, Thickness, Scan Band Width, Rim Intensity, Scan Speed and Direction |
| Slices | Source triangle clipping and capped sections in any of the three model axes, exact rest reconstruction | Slice Count, Cut Orientation; legacy Separation Direction works in cut-local axes (Y is the cut normal) |
| Voxel | Real triangle/box intersection, closed-solid flood-fill or open-shell occupancy; instanced blocks with seeded spin and size variation | Block Rotation, Block Size Variation; existing Block Detail and Separation |

All controls use the existing factory/parameter binding route and four Design parent groups. Geometry-build controls are authored rather than continuously modulated; the inexpensive runtime effect floats are available to existing modulation/choreography consumers. Existing saved shard detail values keep their legacy counts; new defaults use Auto. The shared palette remains configurable. Transition Duration retains the saved range and easing; crossfades attenuate pose displacement and Form pivot motion near the blend, not a physical topology-to-topology morph.

## Budgets and lifecycle

| Tier | Shatter maximum target | Dust drawn grains at full density | Max authored slices | Voxel longest-axis cells |
| --- | ---: | ---: | ---: | ---: |
| Low | 48 | 4,096 | 14 | 12 |
| Medium | 96 | 16,384 | 24 | 22 |
| High | 192 | 32,768 | 24 | 28 |

Fracture detail also caps at 96 above 15k source triangles, 48 above 40k and 24 above 100k. Each successive complete fracture stage is bounded to 64 MiB, 400k derived triangles and 1,024 material draw groups; failure keeps the last complete stage. Slices retry lower counts; voxel construction retains the highest completed grid (30k cells per grid, 8 million cumulative intersection tests). Non-manifold cuts are diagnosed; no invented solid volume for open shells. Hologram budgets are 120k source triangles, 200k edge vertices; smaller quality tiers draw progressive subsets. Dust's 32,768 grains use 20 bytes per grain (640 KiB immutable position/rank/seed attributes); runtime changes upload uniforms instead of per-frame position/alpha arrays. Voxel instance colors are written only when tint changes; unchanged poses skip matrix updates.

Heavy cold representation builds are deferred through the browser idle callback, canceled on model replacement/selection changes; the previous representation or original source stays visible until preparation completes. The controller retains at most two representations. This is **main-thread idle preparation**, not a worker or a guarantee of uninterrupted rendering: a cold high-complexity cut or voxel grid may still block the next frame. Geometry buffers are cached only while resident, not persisted across model leases. Closed cuts use the existing planar clipping/contour triangulation algorithm; no physics solver, Voronoi library or collision simulation was added. No third-party acceleration package was introduced because its compatibility and performance could not be measured in this environment.

## Verification and acceptance

Run the focused suite and repository verification after installing dependencies:

```sh
npm ci
npx vitest run --config vitest.node.config.ts src/components/vyzualz/cinema2/model
npm run typecheck
npm run verify:fast
```

The new `Cinema2AdvancedUserModelEffects.test.ts` exercises deterministic sampling, quality resolution, fracture rest transforms, shader uniform wiring/immutable point buffers, axis-specific cuts, wide lines, open voxel shells, cached matrix uploads, source texture ownership and parameter bindings. Phase 01's existing procedural car/extruded logo transition and lifecycle tests remain, and legacy tests are updated for immutable GPU buffers and the new point budget. Shader hook tests are not GPU shader compilation. Human production-canvas testing with an actual textured vehicle, logo, complex import and non-manifold model is still required; compare each stage, all mode transitions, quality tier changes, cast performance, and verify visual continuity against the reference.
