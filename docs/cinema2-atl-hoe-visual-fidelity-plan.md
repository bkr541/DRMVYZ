# ATL HOE: visual-fidelity implementation plan

**Status (revision 2):** Phases 1 (sign), 2 (sky and atmosphere base), 3 (skyline), 4 (facades and emitters) and 5 (road and street lamps), 6 (foliage), 7 (light and finish) and 8 (quality, performance and checks) are implemented; the static frame awaits owner approval before Phase 9. The foreground canopy is still the earlier version and does not yet match the reference. The skyline and the road/bridge layer are switched off in the generator (`includeCityAndRoad = false`) and must be rebuilt in Phases 3 to 5. This revision replaces the earlier phase list (see [Prior implementation history](#prior-implementation-history)) with a gap analysis against the current reference and eight new phases.

## Goal

Rebuild the `ATL HOE` Cinema 2.0 preset so that its static frame closely matches the supplied nighttime Atlanta reference before adding audio-reactive behavior.

The approved direction is:

- a large, dimensional **WAFFLE HOUSE** roadside sign in the left foreground;
- a dense Atlanta skyline that follows the silhouettes in the reference image (see [Open decisions](#open-decisions) on building identities);
- cool blue nighttime ambience with controlled warm sign, crown, window, and street-lamp light;
- atmospheric depth, an elevated lit roadway, and dark tree canopy framing both lower corners;
- real 3D geometry and Cinema 2.0 lighting/post-processing, not a flat reference image used as the rendered background.

## Non-negotiable acceptance rules

1. **Static visual approval comes first.** Do not add audio choreography until the static composition, geometry, materials, and lighting pass the final visual review.
2. **The sign must read `WAFFLE HOUSE` immediately.** No ambiguous glyphs, bloom-obscured strokes, or incorrect letter proportions.
3. **Each skyline landmark must be identifiable by silhouette and crown/facade cues in the reference**, not only by relative position or window color.
4. **Warm emitters must retain detail.** Sign faces, letters, frames, crown tiers, and windows must remain distinguishable at final exposure.
5. **The scene must remain convincingly 3D at rest.** Perspective, visible side faces, overlaps, depth fog, and material highlights must communicate depth without requiring camera movement.
6. **The composition must work in both the tall embedded Stage preview and a 16:9 output.** The preview may reveal more vertical scene, but it must not crop the sign text or collapse the foreground/background relationship.
7. **Every phase ends with a visual checkpoint** captured at 16:9 and at the embedded Stage aspect and compared with the reference. Passing schema tests alone is not sufficient, and the next phase does not start until the owner approves the checkpoint.

## Current reference vs. current render

Findings from comparing the owner's reference image with a capture of the preset as it renders in Cinema 2.0 (Stage preview, about 1.82:1). The reference is 16:9.

| Area | Current render | Reference |
|---|---|---|
| **Skyline** | None. The city layer is disabled. | Dense skyline across the whole frame. Left to right: a dark tower with a red beacon; a round-crowned tower with a white crown ring and a thin mast; a tall ribbed tower with a stepped gold pyramid crown and a red beacon; a smaller stepped tower with a tiered gold crown; an angular glass building with a yellow triangular facet; many mid-rise blocks. Facades are dark blue-grey with warm amber window grids. |
| **Roads and lamps** | None. | Elevated roadway with columns low in the frame and glowing orange street lamps on poles. |
| **Sign cell faces** | Each yellow face has an orange ring inside it. | Flat, bright yellow. No orange ring. Faces sit in thin black cell frames with narrow dark gaps between cells. |
| **Sign letters** | Thinner, with visible extrusion and bevel sides. | Heavier and wider, filling about 80% of the cell, reading as flat black. |
| **Sign cabinet** | Blue-grey metal with a thick rail around each row. | Near-black with a thin frame and a faint cool rim light. The lower cabinet sits in front of the upper one. Rivets only at the corners. |
| **Sign supports** | Three near-parallel vertical posts. | One centre post and two splayed legs forming a V that narrows toward the ground, all black. |
| **Sign tilt and scale** | Top edge drops about 9° left to right. | About 17°, with stronger perspective. The top-left corner sits almost on the frame edge. |
| **Sky** | Flat, saturated royal blue. Many bright stars. | Deep navy at the top, lighter and slightly warmer toward the horizon behind the city. Fewer, finer stars concentrated in the upper frame. |
| **Foliage** | Smooth teal-grey blobs, right side only. | Near-black clumps with a leafy outline at both bottom corners. The right mass rises higher and overlaps the skyline. Faint warm rim light on lit edges. |
| **Light and finish** | Hard-edged cells, jagged letter edges, no glow around the sign. Lower frame is flat dark blue. | Soft glow around the sign, warm haze low in the frame, cool upper frame, clean edges. |

## Reference composition targets

These are visual guides rather than pixel-perfect measurements.

| Element | Target |
|---|---|
| Waffle House sign | Occupies roughly the left half of a 16:9 frame (about 52% of the width, about 60% of the height). Upper-left edge enters near the frame edge. Strong oblique perspective, top edge dropping about 17° to the right, exposing the cabinet top and left side. |
| Sign text | Six top cells and five lower cells, the lower row offset by about one cell. Heavy, wide, flat black letters with consistent optical margins. |
| Sign construction | Black cabinet and thin frames, flat yellow faces, corner rivets, a black base rail, a centre post and two splayed legs. |
| Skyline | Reference silhouettes: round-crowned tower center-left, tallest ribbed tower with gold pyramid crown center-right, smaller tiered gold-crowned tower right, angular glass building low-center, dark tower with beacon at the left edge, mid-rise blocks filling the gaps. |
| City density | Overlapping depth layers from left to right; no gaps at either edge or behind the sign. |
| Roads | Elevated decks with perspective, columns, and localized sodium pools; orange lamp orbs on poles. |
| Foliage | Near-black leaf-cluster silhouettes in both lower corners; the right mass overlaps the skyline. |
| Color | Cool blue sky and ambient fill; warm yellow-orange sign, crowns, windows, and street lighting only. |

## Phase 0 — Establish a repeatable visual baseline

**Status:** Implemented. Run `npm run test:e2e:cinema2-atl-hoe` to write a unique, git-ignored baseline set under `artifacts/cinema2-atl-hoe-visual-acceptance/`. The harness captures named checkpoints at an exact two-second visual time and verifies duplicate image hashes. An optional development-only overlay can be generated with `--reference=/absolute/path/to/reference.png`; the reference is passed to the browser in memory and is not copied into the preset or repository.

Every phase below uses this harness for its checkpoint. Extend its checkpoint list when a phase needs a new diagnostic frame (for example an unlit silhouette frame in Phase 3). The supplied reference must never ship as part of the rendered preset.

## Phase 1 — Sign

**Status:** Implemented; awaiting owner approval of the checkpoint. A 50% overlay against the reference registers the sign's position, scale, tilt, and cell layout closely at 16:9, and the tall Stage preview shows the full sign uncropped. Details of what was built:

- Pose: yaw 47°, roll −8.5° (top edge drops about 17° on screen), moved up and left so the upper-left corner sits near the frame edge.
- Faces: flat yellow, no orange lip (the `signGlowWarm` part and its material are removed from the generator, the preset, and the preset test). Thin black cell frames.
- Letters: heavier strokes, taller in the face, extrusion cut to 0.06 with a token bevel so they read as flat.
- Cabinet: near-black `signMetal`, `signBorder`, and `signTrim`; the lower cabinet is set 0.34 forward of the upper; corner rivets kept on the exposed left end.
- Supports: a centre post plus two legs that splay out under the rail and meet it at one foot, so they form a V in the tall Stage preview instead of crossing.
- Pose constants (`SIGN_YAW_DEG`, `SIGN_ROLL_DEG`) and the lower-row offset (`LOWER_ROW_DZ`) are named at the top of the sign section of the generator.

The sign is the hero asset. It is self-contained, so it is done first and can be reviewed against the reference without the skyline.

### Issues addressed

- orange ring inside each face;
- thin, extruded letters;
- blue-grey cabinet with thick rails;
- three parallel posts;
- shallow tilt and perspective.

### Implementation

- Increase the sign's roll and yaw so the top edge drops about 17° left to right, with stronger perspective. Move it up and left so the upper-left corner nearly meets the frame edge. Keep it uncropped at both target aspect ratios.
- Cell faces: flat, bright yellow; remove the orange lip; thin black cell frames with narrow dark gaps.
- Letters: redraw the outline polygons heavier and wider, filling about 80% of the cell; flat black with minimal extrusion and no visible bevel sides. Re-check the `W`, `A`, `H`, `O`, `U`, and `S` counters at final output size.
- Cabinet: near-black painted metal with a thin frame and a faint cool rim light. Set the lower cabinet in front of the upper one. Rivets at the corners only. Black base rail.
- Supports: one centre post and two splayed legs forming a V that narrows toward the ground, all black, with believable thickness, replacing the three parallel posts.

### Likely files

- `scripts/cinema2-assets/generate-atl-hoe.mjs`
- `src/components/vyzualz/cinema2/presets/Cinema2AtlHoePreset.ts` (sign transform, material parameters)
- `public/cinema2/models/atl-hoe.glb` and `Cinema2AssetManifest.generated.ts` (regenerated with `npm run assets:build`)

### Exit criteria

- `WAFFLE HOUSE` is legible and the first letter is unmistakably `W`.
- Faces are flat yellow with no orange ring; letters read flat and heavy.
- Cabinet is black, legs form the V, tilt and scale match the reference.
- The sign alone is a close structural match to the reference.

## Phase 2 — Sky and atmosphere base

**Status:** Implemented. The sky is a stack of about 40 thin emissive strips plus top and bottom caps, authored in the colours the rendered frame should show (sampled from the reference): deep navy at the top lightening to a cool blue near the horizon, then a faint warm-grey haze just below it. At 16:9 the rendered sky matches the reference gradient to within about 2 levels per channel. Stars are fewer (120), finer, and thin out toward the horizon. The strips' emissive values were fitted against measured captures; `SKY_CORRECTION` in the generator holds that fit and must be re-measured if exposure, fog, or the cinematic finish change. The old `sky`/`skyMid`/`skyHorizon` step bands and their preset parameters are gone.

Also added: a generic camera setting, `minAspectAnchor` (0 to 1), that decides how much of the extra height a taller Stage reveals goes above the composition. ATL HOE uses 0.5 so the sign and trees sit lower in the tall preview. 0 keeps the view centred; 1 pins the 16:9 composition to the bottom edge.

Remaining for later phases: the low haze band is only a hint until the city stands in it (Phases 3 and 7).

Needed before the skyline so buildings have something to silhouette against.

### Implementation

- Replace the flat blue with a gradient: deep navy at the top, slightly lighter and warmer toward the horizon behind the city.
- Reduce the star count and size; concentrate stars in the upper frame.
- Add a low warm haze band at the horizon, kept subtle so the upper atmosphere stays cool.

### Exit criteria

- The sky reads as a deep navy gradient, not a flat saturated blue.
- Stars are fine and sparse.
- A horizon band exists to separate distant silhouettes.

## Phase 3 — Skyline massing

**Status:** Implemented (silhouettes only). The four landmarks, named by the owner as Bank of America Plaza (pyramid-roofed shaft, left), Westin Peachtree Plaza (round tower with ring crown and mast), Truist Plaza (five-tier crown) and Georgia-Pacific Tower (stepped slab, right edge), plus an angular glass block and three bands of fill buildings (far, mid, near), are authored in reference-image pixels through `refPoint`/`refBlock` helpers in the generator, so they register with the reference regardless of depth. A 50% overlay of the new reference confirms the outlines line up. They use plain dark materials; windows, glowing crowns and beacons are Phase 4, and the warm city light currently tints the walls orange until Phase 7. The road remains off until Phase 5.

The city generator is currently switched off because its earlier output did not match the reference. This phase is a rewrite, not a re-enable.

### Implementation

- Author the landmark silhouettes from the reference first, as proxy volumes with their crowns:
  - the round-crowned tower (glazed cylinder, white crown ring, thin mast);
  - the tallest ribbed tower with a stepped gold pyramid crown;
  - the smaller stepped tower with a tiered gold crown;
  - the angular glass building;
  - the dark tower with a beacon at the left edge.
- Add three depth bands of mid-rise buildings: near mid-rises around the roads, middle-distance towers overlapping the landmarks without hiding them, and distant low-contrast silhouettes closing the horizon.
- Vary width, height, roofline, and setbacks by band.
- Capture an **unlit silhouette frame** and compare it with the reference silhouette before adding windows.

### Exit criteria

- Each landmark is identifiable from the unlit silhouette frame.
- No gaps at either edge or behind the sign.
- Near, middle, and far bands are visibly separated.

## Phase 4 — Facades and emitters

**Status:** Implemented. Windows are flat emissive panels (two triangles each) on grids read from the reference, with a deterministic share left dark, on all four landmarks (including windows wrapped around the round Westin shaft), the fill buildings, and the extra buildings past both edges. The Bank of America roof and the Truist tier edges use the `crown` emitter, the Westin ring uses `crownWhite`, and six red `beacon` lights mark the tallest points. Windows as boxes tripled the model to 116k triangles and made the browser capture time out, so they are flat panels; the model is now about 44k triangles and 2.1 MB. Georgia-Pacific Tower was then remodelled from an owner close-up: a windowless warm-grey stone tower whose left face is straight, with three sections stepping outward to the right as they descend, a dark recessed slot in each, and a notched crown (parts `gpStone`, `gpSlot`). The Westin tower was then reworked from an owner photo: a steel-blue glass shaft covered in a fine grid of cool panels with a bright cyan reflection down its left-centre, a pale rim over a deep dark crown band slightly wider than the shaft, and a tall slender white mast with a red beacon (parts `glassWindows`, `cyanWindows`, `crownCool`). Truist Plaza was rebuilt from an owner-supplied 3D model: a shaft of seven vertical columns of different heights (a tall central pylon, dark piers, a cyan glowing band per floor), a stair-stepped crown of three broad setbacks, a narrow sign tower with a lit TRUIST bar, and a round drum with a spire and red beacon (parts `truistBody`, `truistCrown`, `truistWindows`). Bank of America Plaza was rebuilt from an owner-supplied model and night render, and its crown was then re-traced from an owner elevation drawing: a ribbed shaft (wide granite piers with long thin dark glass ribs between them), a projecting cornice, and a crown of three stacked truncated pyramids (about 20°, 24° and 17° walls) with granite shelves between them, each an open gold lattice of horizontal bands, converging verticals and X bracing over a dim amber core, then a flat platform, a faceted two-stage mast and a thin antenna (parts `bofaCore`, `bofaRib`). Earlier version: a very slender rose-granite shaft with dark glass between vertical piers (one lit orange along an edge), a single setback to a narrower upper shaft, a platform, a gold pyramid roof and a gold spire; it is the tallest building in the scene (parts `bofaGlass`, `bofaStone`, `bofaGlow`). Known gaps for Phase 7: the Bank of America roof is one flat glowing colour (the reference shows darker ribs), the windows read slightly larger and more yellow than the reference's small amber ones, and the warm city light still tints the tower walls.

### Implementation

- Dark blue-grey facade materials so buildings stay visible against the sky.
- Warm amber window grids with deterministic variation in occupancy, intensity, and color temperature, including dark floors; building-specific window modules rather than uniform emissive boxes.
- Glowing crown tiers and rings; red aviation beacons on the tallest towers and the left-edge tower.
- Mullions, spandrels, setbacks, parapets, and roof structures.
- Level-of-detail variants if the window density threatens the asset budget.

### Exit criteria

- A lit capture preserves facade structure and crown tier detail.
- Warm light is localized; the scene's overall balance stays cool.
- No landmark is identifiable solely by its window color.

## Phase 5 — Roadway and street lamps

**Status:** Implemented. Two dark matte decks (a far deck behind a nearer one) run low across the frame and far past both edges, each with a thin sodium-orange lit edge, a dark understructure, and small beams. About 30 street lamps (the reference's eight, then a steady run in both directions) stand on dark poles with orange orbs. The decks' top faces blazed orange under the warm city light until the road material was made matte and near-black; wide bands also drifted thick because a row's world height varies with the column, so block rows are now read at the middle column (`refUy`). Remaining for Phase 7: the lamps are small and do not yet cast localized light pools on the decks, and the foliage in Phase 6 will cover part of the road at both ends.

### Implementation

- Elevated decks with perspective, edge barriers, beams, and columns, low in the frame.
- Orange lamp orbs on poles with localized light pools rather than evenly spaced dots.

### Exit criteria

- The road has visible depth and support logic.
- Lamps read as glowing sodium sources and pools of light, not flat dots.

## Phase 6 — Foliage

**Status:** Implemented. The foliage is four masses placed from reference contours (lower-left and lower-right in front of the road and behind the sign's legs, a tree line behind the road, low clumps along the bottom edge), each a filled near-black body under its contour. Following a close-up of the reference, whose trees are clusters of rounded petals, every mass is dressed with flat rosette cards (a centre disc ringed by six petal discs, facing the camera): two staggered rows of dark rosettes carry the silhouette, fainter blue rosettes (`foliageFaint`, lit by emission so they stay a steady dim blue-green) are scattered inside the mass to give the reference's interior pattern, and sparse amber flecks (`foliageLit`) stand in for city light glinting through. The masses run far past both edges for wide Stages and below the frame for the tall Stage. The model is about 68k triangles. Remaining shortfall, for Phase 7: the dark edge rosettes are near-black against buildings that are themselves dark, so the leafy silhouette only reads clearly against sky; once the city behind the trees is lit it will read as in the reference. The amber glints are also sparser and smaller than the reference's rim light.

### Implementation

- Rebuild the canopy as near-black leaf-cluster silhouettes with an irregular, leafy outline, replacing the smooth teal-grey blobs.
- Place masses in both lower corners: the left behind and around the sign's legs, the right rising higher and overlapping the skyline.
- Add a faint warm rim light on edges facing the city.

### Exit criteria

- The canopy frames both lower corners with a readable leafy contour.
- Foliage is near-black, not blue-teal.
- The right mass overlaps the skyline as in the reference.

## Phase 7 — Light and finish

**Status:** First pass implemented (preset values only, no model change). The orange city spot light is cut from 0.38 to 0.1 and the cool moon key raised from 0.95 to 1.25, so the tower walls (Truist crown, Georgia-Pacific stone, Bank of America shaft) read cool blue-grey instead of pink-orange; the fill buildings' environment response is raised (far 0.22, mid 0.4, near 0.55) so the city behind the trees is more visible; depth fog density goes from 0.008 to 0.011 for stronger distance separation; bloom threshold rises to 1.3 and intensity falls to 0.46 so edges stay crisp; grain 0.02, aberration 0.005, vignette 0.32. Second pass: each street lamp now has a small halo behind its orb and an amber pool on the near deck's face below it (`lampGlow`); bloom is retuned (threshold 1.0, intensity 0.75, spread 0.62) so the sign, crowns and lamps glow without merging the sign's cells; atmosphere mist is raised (amount 0.09, height 4) for a low haze; the Bank of America piers glow brighter (emissive 2.8, wider lit edge). The sky gradient was re-measured against the Phase 7 finish: the visible sky rows are within 2 levels of the target, so `SKY_CORRECTION` is unchanged (rows below the horizon are now hidden by the city and can no longer be measured). A highlight check on the 16:9 capture finds well under 1% near-white pixels, so faces and crowns are not clipping. Not done: a no-bloom diagnostic frame (the capture harness has no bloom toggle), and the low warm haze barely shows in the render, so it may need a stronger or geometry-based treatment.

### Implementation

- Keep the upper frame cool and put warm light only low in the frame.
- Add a soft glow around the sign that does not merge neighbouring cells or crown tiers.
- Tune bloom after all emission is final (higher threshold, tighter radius, lower intensity).
- Smooth the jagged letter and cell edges (anti-aliasing).
- Add a mild vignette and cooler shadows.
- Verify with highlight diagnostics that faces and crowns do not clip into undifferentiated yellow-white.
- Use depth fog to soften distant buildings progressively.

### Exit criteria

- Letter edges, cell frames, windows, and crown tiers stay crisp through bloom.
- Warm light occupies the lower city without tinting the whole frame.
- No visible aliasing on the sign at final output.

## Phase 8 — Quality tiers, performance, and final static approval

**Status:** Implemented, awaiting owner approval of the static frame. Measured on the final model: 70,441 triangles, 4.06 MB file, 3.98 MB of shipped-asset GPU memory (the low-tier asset budget is 20 MB and the per-asset triangle limit 150k), so no separate medium or low model is needed; the quality tiers differ in render scale (1.0 / 0.82 / 0.67) only. The full capture set (16:9 high, medium and low, the tall Stage, and a 2:1 wide Stage) renders with zero failed or degraded modules, one active resource lease, CPU frame time about 2–3.5 ms (GPU timing is unsupported in the harness), and 9–11 MB estimated module GPU memory. A low-quality checkpoint was added to the capture script, the generator's unused helpers were removed (ESLint is clean), and the asset description was refreshed. Not produced: a no-bloom diagnostic frame (the harness cannot switch effects off) and a separate unlit-silhouette frame (the Phase 3 silhouette check was done during Phase 3 and the model has not changed shape since).

Remaining deviations from the owner reference, recorded honestly rather than masked: the sign sits lower and a little flatter than the reference (the owner asked for the flatter tilt); the Truist crown and Georgia-Pacific tower follow owner-supplied models rather than the reference render, so they differ from it; the reference's city is denser and brighter on the left and between the towers; the foliage reads as dark rosette clusters but without the reference's soft warm rim glow; the lamp pools are flat ovals; the warm haze low in the frame barely shows; and the tall Stage's bottom third is flat black foliage.

### Implementation

- Create high, medium, and low model variants where geometry or window density requires them.
- Measure triangle counts, shipped size, GPU memory, and frame time against Cinema 2.0 budgets. The model is currently about 1.2 MB without the city.
- Validate the production render graph for failed passes, failed module nodes, and resource leaks.
- Capture final frames: 1920×1080 high quality, the embedded Stage aspect, 1920×1080 medium quality, a no-bloom diagnostic frame, and an unlit silhouette diagnostic frame.
- Compare the final 16:9 frame with the owner reference using an overlay and a side-by-side contact sheet.
- Record remaining deviations honestly in this document rather than masking them with heavier bloom or haze.
- Update the ATL HOE preset tests for the new part names and material parameters.

### Automated validation

- ATL HOE preset contract and first-party catalog tests.
- Asset manifest and triangle-budget validation.
- Deterministic asset-generation test or GLB structure audit.
- Browser render smoke test confirming non-empty output and zero failed nodes.
- Focused lint and TypeScript validation for changed production files.
- Existing unrelated repository-wide failures must be listed separately and must not be represented as ATL HOE failures.

### Exit criteria

- The owner approves the static scene at the primary 16:9 checkpoint.
- The embedded Stage presents the same visual hierarchy without text cropping.
- High and medium tiers preserve the landmark silhouettes and sign construction.
- The preset is stable in the production Cinema 2.0 path and all ATL HOE-focused checks pass.

## Phase 9 — Audio-reactive routing, only after static approval

**Status:** Implemented as the Design tab and audio-reactive controls; see `cinema2-atl-hoe-design-tab-plan.md`.

This phase is intentionally deferred. It must not be used to distract from or compensate for missing static fidelity.

Potential restrained routes after approval:

- bass energy gently lifts sign and street-lamp spill without changing letter contrast;
- downbeats produce a small crown/window brightness swell;
- musical intensity adjusts city-window occupancy or haze within narrow bounds;
- camera drift or parallax remains subtle and can be reduced to zero;
- no beat behavior changes the landmark silhouettes, sign wording, or approved composition.

Audio behavior requires its own owner review and acceptance criteria when this phase begins.

## Issue-to-phase map

| Finding | Owning phase |
|---|---:|
| Skyline missing | 3, 4 |
| Roads and street lamps missing | 5 |
| Orange ring inside sign faces | 1 |
| Thin, extruded sign letters | 1 |
| Blue-grey cabinet with thick rails | 1 |
| Three parallel sign posts | 1 |
| Shallow sign tilt and perspective | 1 |
| Flat saturated sky, too many stars | 2 |
| No horizon separation | 2, 7 |
| Smooth teal foliage, right side only | 6 |
| Hard edges and jagged letters | 7 |
| No glow around the sign | 7 |
| Facades and windows flat or absent | 4 |
| Overexposure and clipped highlights | 7 |
| Tall-preview framing weakness | 0, 1, 8 |

## Recommended execution order

Execute the phases strictly in this order:

1. sign;
2. sky and atmosphere base;
3. skyline massing;
4. facades and emitters;
5. roadway and street lamps;
6. foliage;
7. light and finish;
8. quality, performance, and final static approval;
9. audio reactivity.

The sign goes first because it is self-contained and the most visible gap. The sky comes before the skyline so silhouettes can be judged against the right backdrop. Light and finish come last so post-processing cannot hide unresolved geometry or materials.

## Open decisions

1. **Building identities (resolved).** The owner named the four landmarks (Bank of America Plaza, Westin Peachtree Plaza, Truist Plaza, Georgia-Pacific Tower) and they are modelled from the reference. The previous plan named four landmarks (Westin Peachtree Plaza, Truist Plaza, Promenade II, Georgia-Pacific Tower). Identifying real buildings from the image alone is unreliable, so this plan models the silhouettes shown in the reference. Confirm if specific real buildings should be matched instead, and which silhouette is which.
2. **Starting phase.** Phase 1 (sign) is recommended first. Phases 3 to 5 are the largest piece of work.

## Prior implementation history

The earlier plan used a different phase list. Its outcomes, kept for context:

| Earlier phase | Outcome |
|---|---|
| 0 — Visual baseline harness | Implemented and retained as Phase 0 above. |
| 1 — Camera and composition | Implemented. Sign moved into the upper-left foreground and rotated as one rigid assembly; locked camera uses a 16:9 fit-width policy for narrow Stage previews. Superseded in part by the stronger tilt in Phase 1 above. |
| 2 — Sign | Implemented and restyled once to an earlier reference: gloss-black cabinet, six-over-five cells, gold faces with an orange lip, raised flat black letters, rivets, three converging legs. Superseded by Phase 1 above, which removes the orange lip and replaces the legs. |
| 3 — Landmark towers | Implemented, then removed at the owner's request. Rebuilt in Phases 3 and 4 above. |
| 4 — City, roads, foliage | Implemented, then the city and road layer were removed at the owner's request (generator flag `includeCityAndRoad = false`). The foliage remains and is rebuilt in Phase 6 above. |
| 5–7 — Materials, atmosphere, quality | Not completed against the earlier reference. Folded into Phases 4, 7, and 8 above. |
| 8 — Audio reactivity | Deferred. Now Phase 9. |

## Definition of complete

ATL HOE's static environment is complete only when:

- the visual hierarchy matches the supplied reference at 16:9;
- `WAFFLE HOUSE` is crisp, correctly shaped, and structurally convincing, with flat yellow faces, flat black letters, a black cabinet, and V-shaped legs;
- the skyline silhouettes match the reference and the city is dense and layered across the whole frame;
- the elevated roadway and street lamps contribute low-frame depth, and the foliage frames both lower corners;
- the night is cool blue with controlled golden practical light;
- haze separates distance rather than washing the scene orange;
- the embedded Stage and output framing both work;
- focused tests, asset checks, browser rendering, and performance checks pass;
- the owner explicitly approves the static frame before Phase 9 begins.


Georgia-Pacific Tower windows (added in Phase 7 from a daytime photo): the left half of each section carries a grid of small lit punched windows, the right-hand panels stay blank stone, and the recessed slot has horizontal louvres.
