# FRACTURE: cinematic volumetric media rupture (FRA-03)

FRA-03 replaces the FRA-02 geometry and native pose programs without replacing the preset, module, shared musical authorities, media pipeline or render graph. The visual target is an irregular hierarchy of dark, thin crystalline media plates forming the nucleus of a volumetric rupture, with sparse supporting splinters and colored exposed edges. ANCIENT MACHINE provides the mathematical inspiration for independent rotation, bass vibration and radial/tangential/perpendicular motion only. Its files and renderer are not used or modified. No reference imagery is included in runtime assets.

## Geometry and composition

Right-handed world space, Y up, camera looks down -Z. The complete media surface is the original 8 × 4.5 rectangle, centered at (0,0,0). Each of seven seeded root regions is a convex polygon; recursive straight-line cuts partition the roots into 16–120 leaves, with priority weighting and two protected large regions. Areas and proportions vary. Shared overlapping edges, including T junctions, determine graph adjacency. The pivot of each leaf and root is its area centroid. Original XY and UV remain immutable. The root turn is rigid during structural fracture until secondary release. Every leaf has an absolute 3D target (large leaves near the nucleus, other leaves distributed across a staggered ellipsoidal shell), seeded spin components, and orbit frequency. There is no textured sphere or duplicate intact image. A leaf can cross its original XY coordinates as it moves toward its absolute target. Displacement bounds are ±9.5 X, ±6.3 Y, ±5.8 Z, and authored rotation up to 70 degrees per component; reduced safety scales amplitude, lockoff yields exact rest. These are displacement ceilings, not intended projected frame edges.

The bevel prism uses matched ring topology, sharp silhouettes, narrow bevels and controlled thin depth; full-source caps retain their original UVs and cover the source at rest. During the initial plate split the child caps stay contiguous; during secondary release their display caps contract slightly around the pivot without changing source UV coordinates. The source shader (image/video, fit, grouped layout, Pool channels and transition semantics) remains in place. No per-frame media texture duplication or geometry reconstruction. A field of 72 normalized small splinters uses the same angular geometry, with different orientations/depth/size and stable density selection. Foreground clearance during readable states moves intrusive debris behind the media instead of creating columns. Some small splinters can be cropped intentionally. Low quality reduces the rear-field population and shadow casters. Seed/count/gap changes rebuild media geometry; seed changes rebuild debris; all resources remain disposed via the native scene lifecycle.

The default camera is (0,0,10.4), 40° vertical FOV, near .12, far 65, minAspect 16/9. Existing bounded camera drift, build approach, drop pullback and phrase recentering are retained/enhanced, with Z range 9.4–14.5, FOV 40–50°, no extra camera authority. Phrase recenter is gated by Media Readability. Output aspect policy is unchanged. Foreground parallax comes from real geometry, not a screen-space effect. Overlap, near-field cropping and camera composition must be evaluated in a real production canvas; collision-free motion is not guaranteed.

## Native pattern library and reveal behavior

| Pattern ID | Physical program |
| --- | --- |
| fracture | Seven coordinated structural regions move and turn about their root centroids; secondary leaves release into depth, then reform. |
| suspension | Ellipsoidal suspension with independent multi-axis orbital motion and periodic center-first connected reveals. |
| scatter | Strongest absolute volumetric target blend, with near/rear expansion, independent tumbling and bass vibration. |
| contour-chase | Route-based forward/reverse/diagonal illumination fronts drive local displacement, depth and rotation; builds accelerate the front. |
| reconstruction | Start dispersed, then restore connected leaves and merge islands according to cumulative source area, culminating in exact rest. Alternate center, left, right, top, bottom, diagonal and dual-front graph orders across successive cycles. |
| shatter-wave | Physical traveling shock fronts across radial/horizontal/vertical/diagonal coordinates, with stronger/repeated waves during builds and impact release. |

Connected orders are precomputed; prefixes grow through shared adjacency (dual-front can grow two islands until merged). Source area, rather than number of leaves, determines the reconstruction threshold. Media Readability lengthens the connected reveal window, strengthens vocal/phrase restraint and protects the foreground; Cluster Reconstruction controls the area threshold. The reconstruction pattern can always restore the whole image regardless of cluster setting. The quiet end of each cycle is exact rest. Environmental motion remains subtly active during playing reconstruction holds. The scene uses position easing and quaternion slerp, snapping to the exact target; silence/stop settles, pause freezes geometry, and transport identity/time discontinuities reset phase through the existing native performance controller. No new timing source.

## Controls, authority, palette and signals

All existing control IDs and their four Design parent groups are retained. No migration or saved-config rewrite: authored explicit values retain their meaning within the new scene and may need Reset to authored defaults to see the new composition. The existing master/trigger/Auto Performance, Beat Clock, Mood Conductor, Visual Director, source/pool and output authorities described in [FRACTURE native preset](cinema2-fracture.md) remain unchanged. Existing mood drive definitions and bounds remain unchanged. No new shared system or parameters.

| Changed default | Value | Runtime purpose |
| --- | ---: | --- |
| Master Intensity | .88 | Scales motion and light |
| Shard Count | 40 | Media leaf count |
| Crack Width | .002 | Narrow contracted body/cap gap |
| Shard Thickness | .025 | Thin physical prism depth |
| Spread / Depth Travel | .82 / .85 | XY / Z authorization and blend toward absolute targets |
| Shard Rotation | 42° | Bounded independent rotation |
| Reassembly Time | .75 | Exact-rest easing time |
| Sphere Expansion | .94 | Absolute volumetric target blend; zero removes that contribution |
| Orbital Motion | .65 | Independent orbit and tumble |
| Shard Vibration | .60 (unchanged) | Seeded radial/tangential/perpendicular vibration |
| Debris Density | .72 | Stable splinter visibility; zero removes them |
| Cluster Reconstruction | .70 (unchanged) | Connected source area |
| Fracture Lighting | .85 | Selective emissive surfaces and point spill |
| Crack Emission | .68 | Fracture energy gate |
| Bloom / Atmosphere | .33 / .04 | Controlled HDR glow and minimal haze |

Sub and bass drive breath and deterministic vibration; kick creates local impulse; snare and mids drive angular motion; high/air, energy and beat drive selective edge energy; vocals increase reveal restraint; downbeat adds displacement; phrase supports reconstruction; Director build compresses the field and accelerates waves/vibration, and drop overrides reconstruction restraint for volumetric release. Breakdown/calm uses the existing mood/pattern authority and lower signal energy, not another section detector. The original continuous and event rule channels and shared controls remain authoritative. Background is nearly black, structural dark obsidian, primary lavender, secondary violet, accent cyan by default. All are still independently customizable. Directional and two localized colored point lights, exposed side emissive materials and selected partial edge segments provide contrast without uniformly outlining every shard. The media face retains its source colors.

## Verification and acceptance

Dependency-free regression: `node --experimental-strip-types --test scripts/cinema2-fracture-domain.test.mjs` (Node 22.12+). The checks cover all 315 count/seed combinations, area, graph connectivity, rigid root regions, actual-media depth at defaults, connected reconstruction, alternate routes, finite bounds, six pattern programs, signal sensitivity, hard lock and deterministic thin debris. Full repository checks after locked dependency installation:

```sh
npm ci
npm run typecheck
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2FracturePreset.test.ts
```

Production visual acceptance remains required. In the existing quality-review harness and real application, capture assembled media, structural fracture, volumetric scatter, orbital suspension, contour/shatter waves, partial and complete reconstruction, build/drop at authored defaults; use deterministic high-contrast media (not the reference artwork as a substitute for geometry). Check image/video and grouped/Pool playback, all six patterns and shared trigger/Auto authority, pause/seek/track change, cast/recording/resize/aspect ratios, near-plane clearance, lighting and GPU performance. The domain test cannot prove appearance, frame-rate, WebGL compilation, or full application integration. Do not promote catalog/keeper status before actual visual acceptance.
