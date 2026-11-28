# FRACTURE: volumetric media rupture (FRA-02)

FRA-02 supersedes the FRA-01 side-biased rupture layout. It modifies the existing native FRACTURE reference preset, retaining the preset/module IDs, source slot, shared transport, pool authority and render graph. No new renderer or external assets. ANCIENT MACHINE is a movement reference only; its code is not changed.

## Scene and movement

- Forty-eight seeded environmental fragments form three staggered depth layers, with azimuthal spacing, irregular sizes, orientations and near/far depth. Density is a stable visibility selection (default .50 selects 36 of 48, zero hides all); low quality further reduces far-field debris. The near field is pushed outward when Media Readability is enabled. Rear fragments can sit behind the media.
- The existing 16–120 Voronoi cells retain their exact original-plane UVs and geometry. Their seeded depth latitude, radial axes and two-axis orbital transforms produce independent near/far travel, beat-phase vibration and tumbling. These are deterministic choreography, not collision simulation. Media caps contract only when displaced and return to their complete original UV coverage at rest.
- Source adjacency is traversed breadth-first from the cell nearest the center. The prefix is a connected island, returned progressively during reveal windows; phrase and vocal signals strengthen the reveal. A drop can override this restraint. Without event contributions, each pattern returns to its rest target by the end of a cycle. Reassembly remains eased by the existing time control.
- The existing shared beat phase and signals drive all six patterns; no local event detector or independent music clock.

| Pattern ID | Spatial program |
| --- | --- |
| fracture | Diagonal plate split, then independent depth and outward separation |
| suspension | Slow multi-axis suspension, tumbling and connected core reveal |
| scatter | Strong radial/depth release, orbital suspension and return |
| contour-chase | Traveling adjacency-driven light and physical lift; faster fronts during builds |
| reconstruction | Center-first connected restoration and continuing environmental motion |
| shatter-wave | Direction-changing coherent shockwave across the source plane |

Build charge compresses the opening before release; drop overrides the reveal restraint. Kick adds displacement; bass/sub add seeded vibration; mids and snare influence rotation, highs and energy influence exposed edges. Motion safety and lockoff remain in authority, including the existing camera controls. Field transforms are eased and freeze during pause; reset/lockoff restore deterministic targets. The camera now starts at Z 10.1 with FOV 42°, stronger bounded sway and shared build push-in/drop pullback/phrase recenter rules. The camera amount default changes from .25 to .55; stored explicit values are not migrated. Safety limits Z to 8.8–14.5 and FOV to 40–50°.

## Inspector and rendering

All previous control IDs, ranges and four parent groups are retained. Spread and Depth Travel now scale offsets up to ±5.8 X, ±4.1 Y and ±5.4 Z before intensity/safety/expansion scaling. Shard Rotation remains bounded by the authored angle (plus the existing mid boost, capped at 70°). Sphere Expansion scales additional travel; at zero it retains a smaller fracture. The new controls are:

| Control | Default | Ownership |
| --- | ---: | --- |
| Sphere Expansion | .75 | Design, shared shock modulation |
| Orbital Motion | .45 | Design, shared momentum modulation |
| Shard Vibration | .60 | Design, shared energy modulation |
| Debris Density | .50 | Design, manual structural/performance budget |
| Cluster Reconstruction | .70 | Design, shared calm modulation |
| Fracture Lighting | .65 | Effects, shared peak modulation |

All numeric ranges 0–1. Media Readability favors connected reveal and conservative near-field clearance rather than globally flattening motion. The body prism now separates emissive exposed side/bevel material from the structural cap. Per-shard side energy fades with reassembly; two bounded colored point lights supplement the existing central spill. The original media face shader, source UV and grouped/pool mapping are unchanged. Existing palette roles, bloom and finish remain. Side materials and lights are disposed alongside existing geometry; no new external textures. The extra material group and lights add render cost; performance requires measurement.

## Validation and handoff

Run `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2FracturePreset.test.ts` after installing the locked dependencies. Run the existing quality review harness (`cinema2-quality-review.html?preset=drmvyz.cinema2.fracture&quality=high&release=1`) and the release test `npm run test:e2e:cinema2-release -- --presets fracture` if supported by the checkout. Verify all six patterns, manual/Auto controls, image/video and grouped/pool UV orientation, partial and full reveals, near-plane crossings and occlusion at high intensity, silence/pause/seek, quality transitions, cast/recording parity, and GPU performance. Compare to the supplied recording at equivalent viewport and source. No catalog thumbnail or keeper promotion without rendered acceptance. No collision-free or pixel-perfect dynamic occlusion guarantee.
