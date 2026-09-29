# RELIQUARY: plan to reach the cinematic mockups

Status: planned (2026-09-28). No step has started.
Owner decisions: add the wet reflective floor and low ground mist; follow the build order below.

Scope: the RELIQUARY preset (`src/components/vyzualz/cinema2/presets/Cinema2ReliquaryPreset.ts`), the assets it uses (golden roots, flanking trees, faceted crystal logo), and the parts of Cinema 2.0 it needs (the `three-scene` module, lighting, effects).

## The target

Three owner mockups show single frames of the finished preset with the music driving it. Compared with the current build (preset revision 2, commit `46ad2bef`), the mockups have:

- **Framing:** a wider shot. The logo takes about 40% of the frame width, huge dark trees fill both sides, and you can see the floor and several layers of forest behind.
- **Golden tree:** slender branches that rise from a thick twisted trunk and thread *through* the open spaces in the bottom of the logo (between the lower loops and the star). They end in small tendrils around the lower swirls. Nothing climbs above the logo's lower half.
- **Forest:** dark, gnarled trunks with deep bark, readable against a lit haze. Glowing gold veins trace the trunks, and each tree pulses at its own brightness.
- **Overhead lights:** spread across the top of the stage. Where a light hits the logo, that part is bright and the rest falls into shadow.
- **Crystal logo:** clear, bright cut crystal with long bevel facets, rainbow sparkle and star-shaped glints.
- **Atmosphere:** a bright light shaft from above with drifting dust, a wet mirror floor with glowing reflections, and a soft blur on the far trees.

## Current gaps

| # | Gap | Cause |
|---|---|---|
| 1 | Camera too close | Framed tight on purpose in revision 2. |
| 2 | Roots climb too high and wrap around the logo instead of through it | The roots geometry was built for an earlier "wrap the lower lobes" brief. |
| 3 | Background forest invisible | No light behind the trees, near-zero haze, thin sparse vines. |
| 4 | Overhead light hits barely change the picture | The crystal is lit evenly all the time by strong environment reflection (2.2), two panel lights and a base glow. |
| 5 | **Bug:** two lights silently dropped | The 3D module and the haze each take only the first 8 lights. RELIQUARY defines 9 spots and an ambient, so the fill and ambient never reach the models. Nothing warns about it. |
| 6 | Every tree glows identically | The glow system has one breath value and one set of climbing pulses for everything. |
| 7 | Trees are smooth tubes | The tree generator can only make round tubes; the models have no texture coordinates for bark detail. |
| 8 | Crystal reads grey and busy | Clear glass refracts the black background; the facets are random triangles; there's no glint effect. |
| 9 | No shadows | The 3D module doesn't cast or receive shadows (the unfinished 3D half of roadmap step #10). |
| 10 | Thin atmosphere | Matte floor, faint haze, no dust particles, no depth-of-field blur. |

## Build order

Stage 1 fixes what Cinema 2.0 can already do, and makes the biggest visual difference for the least risk. Stage 2 adds new capabilities. Each step is checked in real Chrome before the next, using the synthetic-music harness (a simulated 128 BPM track with a build and a drop) and brightness measured per region of the frame, and the frame cost is measured at 1080p.

### Stage 1: use what Cinema 2.0 already has

**Step 1: Fix the 8-light cap (gap 5)**
- Raise the light limit in the 3D module (`modules/three/Cinema2ThreeCameraLightMapping.ts`, `CINEMA2_THREE_MAX_LIGHTS`) and the haze (`effects/Cinema2VolumetricAtmosphereEffect.ts`, `CINEMA2_VOLUMETRIC_MAX_LIGHTS`) from 8 to 12.
- Add a diagnostic when a preset has more lights than the limit, naming the ones dropped, so this can't fail silently again.
- Result: the fill and ambient lights reach the models, and there's room for the back and rim lights in step 5.
- Check: measure the frame cost before and after (more lights cost more per pixel).

**Step 2: Reframe the camera (gap 1)**
- Move the camera back and slightly lower in the preset so the logo is about 40% of the frame width, the foreground trees sit inside the frame edges, and the floor is visible.
- Move the foreground trees if needed (`scripts/cinema2-assets/generate-reliquary-trees.mjs`) so they frame the logo at the new distance.
- Result: the composition matches the mockups, with the forest visible on both sides.
- Check: compare against the mockups side by side.

**Step 3: Re-author the golden tree to thread through the logo (gap 2)**
- Rewrite the limbs in `scripts/cinema2-assets/generate-golden-roots.mjs`. Two slender branches leave the trunk top just under the star, pass *through* the two open spaces at the bottom of the logo (in front of and behind the ribbons, so they visibly weave), and end in small curling tendrils around the lower swirls.
- Remove the outer wrap around the lower lobes and the vines that climb to the lobe tops. Nothing goes above the swirls.
- Fewer, smaller leaves, mostly along the branches below the logo.
- Keep the thick twisted trunk and the wide root flare, and keep the glow phase value (0 at root tips, 1 at branch tips) so the Energy pulse still climbs.
- Result: the tree holds the logo from beneath instead of covering it.
- Check: front and angled views, to confirm the branches pass through the openings without cutting into the logo.

**Step 4: Make the overhead hits read (gap 4)**
- Lower the crystal's environment reflection share (currently 2.2) so it isn't evenly bright all the time.
- Turn the two soft panel lights down or off.
- Keep the resting level of the overhead spots low and the hits bright, and narrow or re-aim any cones that overlap.
- Keep the front fill dim, so unlit parts of the logo fall into shadow.
- Result: when a spot hits a lobe, that lobe is clearly the brightest part and the rest is darker.
- Check: per-part brightness across a burst of frames. Target: the lit part at least 2× the unlit parts.

**Step 5: Make the background forest visible (gap 3)**
- Add a back light behind the forest and low rim lights, so the trunks separate from the dark as silhouettes against lit haze.
- Raise the haze density enough to show depth layers and the overhead beams.
- In the tree generator, make the gold vines thicker and denser so they trace the trunk shapes, and add more glowing buds.
- Darken the bark so the vines stand out.
- Result: the mockups' layered, readable forest.
- Check: the trees must be distinguishable from the background in a resting frame.

**Step 6: Give each tree its own glow (gap 6)**
- Bake a random per-tree value into the trees and golden roots models (a new vertex value, like the existing glow phase).
- Extend the glow shader hook in the 3D module (`modules/three/Cinema2ThreeSceneBridge.ts`) so each tree's breath and pulses get their own offset and strength, plus a faint ember flicker on the buds.
- The Glow Mode dropdown (Energy / Breathing / Energy & Breathing), BPM Sync and Master Intensity keep working as they do now.
- Result: the trees pulse at different brightness, as in the mockups.
- Check: glow brightness sampled on two different trees over time must differ.

**Step 7: Wet reflective floor and ground mist (gap 10, approved)**
- Change the ground effect (the existing `reflective-floor` effect) from matte to wet: stronger reflections of the logo, the glowing roots and the lights, with the existing wet-concrete surface texture breaking the reflection up slightly.
- Faint rings on the floor around the tree base, if the floor effect can carry them cheaply. Otherwise defer to step 10.
- Add low ground mist around the roots and the tree bases using the haze effect's existing mist (`mistAmount`, `mistHeight`), kept low and thin so it doesn't wash out the logo or the floor reflections.
- Result: the mirror floor with glowing reflections and the low mist from the mockups.
- Check: the floor shows the logo and glow reflected, the mist sits below the logo; measure the frame cost.

### Stage 2: new capabilities

**Step 8: Shadows from the 3D models (gap 9)**
- Turn on Three.js shadow maps in the 3D module for one or two chosen lights (the main overhead key and one cue spot), not all of them.
- The roots, branches and trees cast shadows, and the logo and floor receive them.
- Quality tiers: high gets both lights, medium one, low none.
- Result: branches shadow the logo and unlit areas fall off naturally.
- Check: shadows visible on the logo; measure the frame cost per tier.

**Step 9: Clearer crystal (gap 8)**
- Add a bevel-facet mode to the logo generator (`scripts/cinema2-assets/generate-dvydrm-logo.mjs --faceted`): long, clean cuts running along each ribbon instead of random triangles, like the mockups' cut crystal.
- Retune clarity and body color now that a lit background (step 5) gives the glass something bright to refract.
- Result: brighter, clearer crystal with readable cuts.
- Check: compare the logo region with the mockups.

**Step 10: Textured bark and glowing cracks (gap 7)**
- Replace the hand-written 3D model writer in the asset generators with **glTF Transform** (`@gltf-transform/core`, MIT). It can write models with texture coordinates and embedded textures.
- Generate a bark texture set in-house, like the existing wet-concrete texture: surface relief, roughness, and a glow mask for the cracks.
- Twist the trunks harder, with wider buttress roots.
- Extend the glow so it can light the crack mask as well as the vines, so light runs *inside* the bark as in the mockups.
- Result: massive, gnarled trees with glowing cracks.
- Check: asset size and triangle budgets (`npm run assets:check`), and the frame cost.

**Step 11: Dust and fireflies (gap 10)**
- Add a particle option to the 3D module using Three.js's built-in point and instanced rendering (no new library): drifting dust in the light shaft and slow glowing motes around the trees.
- Their brightness follows the music.
- Result: the dust in the light shaft and the embers from the mockups.
- Check: the frame cost; low quality gets fewer or none.

**Step 12: Glare effect (gap 8)**
- A new built-in effect in Cinema 2.0's effect system that turns the brightest highlights into star-shaped glints and soft streaks.
- Result: the sparkle on the crystal and strobe hits from the mockups.
- Check: glints appear only on bright highlights; measure the frame cost.

**Step 13: Depth of field (gap 10)**
- A new built-in effect that blurs by distance, using the depth information each frame already has. The logo and tree stay sharp; the far forest goes soft.
- Result: the mockups' depth and focus.
- Check: the frame cost; off on low quality.

**Step 14 (optional): Diamond-quality crystal (gap 8)**
- Port a ray-traced crystal shader into the 3D module using **three-mesh-bvh** (MIT), so light bounces around inside the crystal and it sparkles like a cut diamond.
- High quality only.
- Only if steps 9 and 12 don't get the crystal close enough.

**Step 15: Performance pass and final check**
- Set a per-tier budget for everything added (shadows, particles, glare, depth of field, bark textures) so high holds 60 fps at 1080p and medium and low scale down.
- Test in real Chrome with the synthetic-music harness: localized overhead hits, the drop strobe, all three glow modes, and per-tree variation.
- Update the roadmap (`docs/cinema2-advanced-3d-roadmap.md`) and the preset's tests.

## Performance

RELIQUARY takes about 12 ms of GPU per frame at 1080p on high, against the 16.7 ms that 60 fps allows (the timer is coarse). Stage 1 should stay close to that. Stage 2 will not all fit at full quality: each step sets its own per-tier budget, and the background forest may need a lighter version on medium and low.

## New dependencies

| Library | License | Used for | Step |
|---|---|---|---|
| `@gltf-transform/core` (and its extensions package) | MIT | Writing textured 3D models from the asset generators | 10 |
| `three-mesh-bvh` | MIT | Ray-traced crystal (optional) | 14 |

Everything else uses what's already in the app: Three.js (shadows, particles), Cinema 2.0's effect system (floor, haze, glare, depth of field) and its choreography (the overhead cues and strobe). No third-party post-processing library: Cinema 2.0 runs its own effect chain, and a second one would conflict with it.
