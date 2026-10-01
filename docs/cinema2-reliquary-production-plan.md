# RELIQUARY: production plan

**Date:** 2026-09-30
**Status:** Phases 1-6 built (2026-09-30), awaiting the owner's review in the app. Phase 7 not started.

**Related:**
- `docs/cinema2-reliquary-cinematic-plan.md` is the earlier plan (Stage 1 steps 1-7 done, step 8 shadows blocked). This document takes over from it.
- `docs/cinema2-conduit-mockup-gap-analysis.md` covers the HDR chain, bloom and camera work that phase 1 reuses.

**Reference images** (shared by the owner on 2026-09-30):

| # | What it shows |
|---|---|
| 1 | The preset as it currently looks in Cinema 2.0, at the owner's nearly square Stage. |
| 2 | The production mockup: the target look. |
| 3 | The whole scene as a plain 3D model: where each element sits. |
| 4 | The background trees alone, as a plain 3D model. |
| 5 | The cloud logo and the golden tree supporting it, as a 3D model. |
| 6 | The background trees with the gold vines that light up with the music. |

## 1. The intended design

RELIQUARY shows the owner's DVYDRM cloud logo as clear cut crystal. A golden tree holds it up from below, and the logo stands in a dark, misty forest. The music drives the light.

**Composition** (mockup and image 3, 16:9):
- The logo is centred, about 40% of the frame's width, with its centre a little above the frame's middle.
- The golden tree rises from the floor under the logo. Its root flare spreads across the floor and sits on a round platform with ripple rings.
- Two huge trees frame the left and right edges, leaning and arching inward over the top.
- More trunks recede into the mist behind them.
- A shaft of light falls from the top centre, slightly right.
- Low fog lies across the floor.

**The logo** (mockup and image 5):
- Thick crystal ribbons with a smooth, rounded bevel, shaped as the cloud outline with the two inner swirls and the four-point star below.
- It is clear and bright: white highlights, faint rainbow edges, and refraction of the light behind it.
- There is no separate outer border ring.

**The golden tree** (image 5):
- A thick trunk made of twisted strands.
- Just under the logo it splits into two main limbs that rise along the lower lobes on either side.
- Smaller branches pass through the open spaces at the bottom of the logo and end in curls.
- A wide flare of thick roots spreads outward over the floor, getting thinner toward the tips.
- Many gold leaves grow along the branches and roots.
- The material is polished warm gold. When lit, light runs along its edges and cracks.

**The background trees** (images 4 and 6):
- Massive, twisted, gnarled trunks with visible bark.
- Heavy buttress roots merge into the floor.
- Thin leafy twigs grow off the trunks.
- Broad gold vines wrap around the trunks. These vines, with their leaves, are the parts that glow and react to the music.

**Light and atmosphere** (mockup):
- The gold glow is the brightest thing in the scene: white-hot cores, orange halos and sparkling leaves.
- Warm light spills onto the bark and the floor.
- The floor is a dark, wet mirror that reflects the glow.
- Embers and dust float in the light shaft.
- The far forest is soft and hazy.
- The grade is deep black, warm gold and clean white highlights.

**Behaviour** (unchanged from the current preset):
- The golden tree's glow and the tree vines react to the loaded track through Cinema 2.0's audio intelligence, using the existing Glow modes: Energy, Breathing, and Energy & Breathing.
- The six overhead spots chase across the crystal.
- The strobe hits on the drop.
- Every existing Design control keeps working.

## 2. What differs today

| Area | Mockup | Current |
|---|---|---|
| Light and glow | The gold is a light source: white-hot cores, wide halos, warm spill. | Thin neon-yellow lines, almost no halo, muddy brown scene. The targets are 8-bit and the old bloom is in use. |
| Logo | Clear, bright glass ribbons with a smooth bevel, no border. | Grey mirrored metal in large triangles, with a dark chrome outer ring. The openings read black. |
| Golden tree | A thick braided trunk, two limbs, a wide root flare, many leaves, polished gold with light in the cracks. | A thin strand trunk, short spiky roots, few leaves, dark bronze, with glow on separate yellow tubes. |
| Background trees | Massive gnarled bark trunks arching inward, broad glowing vines, leafy twigs, far trunks in mist. | Smooth glossy black tubes like plastic pipes, thin vine spirals, no canopy, no depth. |
| Atmosphere | A god-ray shaft, low ground fog, embers, soft far forest. | A flat dark background, faint haze, one spotlight pool. |
| Floor | A black mirror with ripple rings and bright reflections of the glow. | Blotchy, grainy reflections and no rings. |
| Framing | 16:9, logo about 40% of the width, trees framing the edges. | At the nearly square Stage the trees are cropped into edge bands and the tree base sits low. |
| Grade | Deep blacks, warm gold, white highlights. | Low contrast and brownish, with red and cyan fringing on edges. |

## 3. Phases

Do these in order. Each phase ends with a side-by-side render against the mockup at 16:9 and at the owner's Stage aspect (about 1.08:1), and the owner reviews it before the next phase starts.

### Phase 1: HDR light chain, framing and grade

The biggest visual change, mostly reusing work already built for CONDUIT.

1. **Float targets.** Switch every RELIQUARY render target to `rgba16f` with `fallbackColorFormat: 'rgba8'`, so machines without float render targets still run.
2. **HDR glow.** Extend the three-scene module's `config.hdr` to the audio glow shader (`Cinema2ThreeAudioGlow` / the bridge's glow hook), not just the segment lighting. With HDR on and float targets available, the glow emits at full strength above white; otherwise it keeps an 8-bit-safe roll-off. Set `hdr: true` on RELIQUARY.
3. **Bloom.** Replace `bloom` with `hdr-bloom`, with a threshold above the white crystal and the gold wood, so only the glowing parts bloom. Keep the existing Bloom control bound to its intensity.
4. **Tone mapping.** Set `cinematic-finish` to `toneMap: filmic`. Tune the exposure so the glow rolls to white cores with orange edges while the bark keeps its dark tones.
5. **Glow colour and strength.** Re-derive the default Glow Color and Glow Intensity through the filmic curve, as was done for CONDUIT: lit gold should read warm white in the core and orange-peach in its halo, not lemon yellow.
6. **Framing.** Add `minAspect: 16 / 9` to the camera, so the nearly square Stage widens the view vertically instead of cropping the trees. Reframe slightly lower and wider to match the mockup, with the logo at about 40% of the width.
7. **Grade.** Lower `aberration` (0.15 → about 0.04) and `grain` (0.12 → about 0.05), and let the filmic curve set the contrast.
8. **Tests.** Update the RELIQUARY preset tests for the effect list (`hdr-bloom`), the target formats and the camera.

**Result (2026-09-30):** built; checked in the render harness against the mockup at 16:9 and at 1100×1016. Not yet reviewed by the owner in the app.

- **Targets:** all four render targets are `rgba16f` with an `rgba8` fallback.
- **Glow:** `config.hdr: true`. The bridge's audio glow was already emitted without a ceiling, so on float targets it now goes above white as-is. A new `uCinema2GlowRolloff` applies a soft roll-off only when an HDR preset falls back to 8-bit targets. Presets without `hdr` are unchanged.
- **Bloom:** `hdr-bloom` with threshold 1.1 and knee 0.6. The Bloom control still drives its intensity.
- **Finish:** filmic tone curve, `aberration` 0.04 (was 0.15), `grain` 0.05 (was 0.12). The red and cyan edge fringing is gone.
- **Glow colour and strength:** default Glow Color (1, 0.54, 0.28) (was (1, 0.52, 0.12)), Glow Intensity 2.2 (was 1.1). Through the filmic curve a resting vine reads amber-gold and a pulse goes warm-white, following the mockup's measured glow ramp. At higher strengths or a paler colour, the resting glow read cream.
- **Vine and bud reflections:** their environment reflection is now 0.12 (was 0.45). Mirroring the white studio environment made them read pale cream.
- **Framing:** the camera has `minAspect: 16 / 9` and moved from z 6 to z 4.9. At 16:9 the logo is about 37% of the width; on the nearly square Stage the whole composition, both framing trees included, stays in view.
- **Haze veil:** new light option `config.scatter: false`, which keeps a light out of the volumetric haze while it still lights the models and the floor. The front fill uses it. Aimed from the camera, it had been glowing into the lens as a white veil behind the tree.
- **Tests:** the RELIQUARY tests cover the HDR targets, `config.hdr`, the filmic finish, `minAspect` and the fill's `scatter`. The CONDUIT effect-list test now expects `hdr-bloom`; it had failed since the CONDUIT commit.
- **Full suite:** no new failures. All remaining failures also fail on the committed code.

Still open for later phases: the vines are thin tubes (phase 4); the halos are modest because the vines are small on screen (phase 4 widens them); the crystal is unchanged (phase 2); the floor keeps its grit (phase 5).

**Done when:**
- Lit vines and roots show a warm-white core and an orange halo at least 10 px wide at 1080p.
- The crystal and the gold wood do not bloom.
- Both trees stay in frame at the owner's Stage aspect.
- No colour fringing is visible.

### Phase 2: The crystal logo

1. **Geometry.** Rebuild the crystal in `generate-dvydrm-logo.mjs` (the faceted variant) as a thick extrusion with a smooth rounded bevel, using the extrusion path built for the CONDUIT wordmark (`buildExtrusion` with a flat-face split). Replace the coarse triangle faceting with a few subtle long cuts along the ribbons, or none if the owner prefers a smooth crystal.
2. **Outer ring.** Remove the dark chrome `outline` ring from RELIQUARY: hide the part, or make it the same crystal. GO-TO uses the shared logo asset, so the change must not affect GO-TO; keep it a RELIQUARY-only override or a separate asset.
3. **Material.** Retune the glass: high transmission, low roughness, a slightly cool white body, a little dispersion for rainbow edges, and a higher environment intensity on the crystal only.
4. **Something to refract.** Place a bright panel light or light shaft behind and above the logo, so the glass refracts light instead of the dark forest. This ties in with phase 5's light shaft.
5. **Budget.** Keep the asset within the 150k-triangle limit (`npm run assets:check`).

**Result (2026-09-30):** built; checked in the render harness against the mockup. Not yet reviewed by the owner in the app.

- **Geometry:** `generate-dvydrm-logo.mjs --faceted` now builds a thick cut-glass ribbon: a flat top, four flat cut bands round every edge reaching 0.045 in, and 0.05-deep straight side walls. It replaces the jittered triangle facets. Tried and rejected: a finer gem-cut relief, which sparkled but read as grey glitter.
- **Outer ring:** removed. The faceted asset has only the `crystal` part now, and RELIQUARY no longer sets or binds any `outline.*` property.
- **Material:**
  - body (0.9, 0.92, 0.95) (was mid-grey 0.62);
  - roughness 0.03 (was 0.08);
  - environment 1.8 (was 1.1);
  - clarity kept at 0.9.

  A white body used to clip flat on 8-bit targets; with the HDR chain it keeps the cut bands readable.
- **Control descriptions:** Crystal Color, Crystal Sparkle and Crystal Roughness updated for the cut ribbon.
- **Shared asset:** GO-TO's smooth logo (`dvydrm-logo.glb`) is byte-identical after regeneration.
- **Budget:** the logo went from 31k to 75k triangles (2.6 MB). Regenerating the asset manifest, which had been committed out of date, showed CONDUIT at 21.3 MB against its 20.1 MB low-tier asset budget. CONDUIT's tubes (coarser sweep and turned-part segments) and its wordmark glow bands (sample spacing 0.03 → 0.04) were trimmed with no visible change, and every preset is now within budget (`npm run assets:check` passes).
- **Tests:** the RELIQUARY test checks there's no outline part, in the preset or the asset. The full Cinema 2.0 suite shows the same failures as the committed code.

Deferred: item 4, a bright light for the glass to refract. The ribbon already reads bright, and phase 5's light shaft will add it. Still short of the mockup: its crystal is clearer, with bright edges and darker, see-through ribbon centres, where ours is more evenly white. Tune clarity and environment in phase 7 once the scene around it is lit.

**Done when:**
- The logo reads as clear bright glass with a smooth bevel.
- There is no border ring.
- The inner openings show refracted light, not black.
- GO-TO looks unchanged.

### Phase 3: The golden tree

All in `generate-golden-roots.mjs`.

1. **Trunk.** Make it thicker, from fewer and fatter strands braided tighter, with a clear waist and a strong flare at the base, as in image 5.
2. **Limbs.** Keep the two main limbs rising along the lower lobes, but thicken them. Keep the branches that pass through the logo's bottom openings, and add a curled tip to each.
3. **Root flare.** Make it about twice as wide, with thicker roots that fork toward their tips and lie flat on the floor, so they read as merging into it. Add a ring of shorter roots all round, including toward the camera.
4. **Leaves.** Add two to three times as many gold leaves along the limbs and roots, at varied sizes and angles, as in images 3 and 5.
5. **Material.** Use a brighter polished warm gold (higher base colour, lower roughness).
6. **Glow placement.** Move the glow from the separate vein tubes into the wood: either a glow mask along crack lines (needs the phase 4 texture pipeline) or an emissive edge term on the gold. Until then, make the veins thinner and sink them into the surface so they read as cracks, not tubes.
7. **Glow phase.** Keep `_GLOW_PHASE` running from the root tips up to the limb tips, so the Energy mode still climbs the tree.

**Result (2026-09-30):** built; checked in the render harness against the mockup and image 5, at 16:9 and at 1100×1016. Not yet reviewed by the owner in the app.

- **Trunk:** six strands (was four). It flares wide at the base, pinches to a waist about a quarter of the logo's width, and the strands lean out at the top toward the limb they feed, so the trunk flows into the two limbs.
- **Limbs:** the two main limbs keep their paths through the logo's openings but are thicker (base radius about 0.11, was 0.075), tapering to 0.02.
- **Twigs and leaves:** seven twigs per side, each with one or two leaves, plus nine more leaves along the limbs and a leaf on every minor root. The leaves are larger, and their glow share went from 0.55 to 0.3 so they read gold, not pale.
- **Root flare:** 30 roots (was 14), alternating major and minor. Major roots reach 1.45-1.85 units, about 1.7 times the logo's width across, and fork three times. Minor roots reach 0.8-1.15 and fork once.
  - They are rope-like: thick most of the way, rounding off at the tip.
  - They arch over the floor in low humps, so they read as roots and not flat blades from the low camera.
  - Roots toward the camera are cut back less than before, so the flare fills in toward the viewer.
- **Glow:** the veins now follow the grain, two per trunk strand and per limb and one on each major root. Each is a thin seam half sunk into the surface. Before, one fat vein per strand spiralled across it and read as a crossing yellow ribbon. The veins' glow share went from 1 to 1.2.
- **Gold:** brighter and more polished: base colour (0.78, 0.53, 0.2) (was (0.6, 0.39, 0.13)), roughness 0.22 (was 0.34).
- **Merge:** the meshes are merged per material, 3 draw calls instead of about 260, like the forest. The model is now 84k triangles and 2.7 MB (was 1.9 MB). Roots and twigs are sampled less densely to make room for the extra roots. `npm run assets:check` passes.
- **Tests:** the golden-roots test now checks the per-material merge. The full Cinema 2.0 suite shows the same failures as the committed code.

Deferred: light inside the gold via a texture crack mask needs phase 4's texture pipeline; the veins stand in for it until then. Still short of the mockup: its roots are finer and more numerous, with bright seams along every one; ours are fewer and heavier, and only the major roots carry a seam near the trunk.

**Done when:**
- The tree matches image 5's silhouette: a thick braided trunk, two limbs, a wide root flare and plenty of leaves.
- The gold reads polished.
- The glow reads as light inside the gold.

### Phase 4: Background trees

All in `generate-reliquary-trees.mjs`, plus a new texture pipeline.

1. **Silhouette.** Make the foreground trees much bigger and more twisted. Lean them inward, with upper limbs arching over the top of the frame to form a canopy (images 2 and 4).
2. **Buttress roots.** Heavy roots that spread and merge into the floor.
3. **Twigs.** Thin leafy twigs growing off the trunks (image 4).
4. **Gold vines.** Replace the thin spiral tubes with broad, flattened gold vines wrapping around the trunks, with leaves along them (image 6). These carry the glow.
5. **Depth.** Add more far trunks, paler and further back, for the haze to fade out.
6. **Bark texture.** Replace the hand-written model writer with glTF Transform (`@gltf-transform/core`, MIT) so the models can carry texture coordinates and embedded textures. Generate a bark texture set in-house (surface relief, roughness and a crack glow mask). This is the earlier plan's step 10.
7. **Bark material.** Dark, slightly glossy bark that picks up the warm spill.
8. **Budget.** Stay within the triangle limit and the installer size budget (`npm run assets:check`), and measure the frame cost.

**Result (2026-09-30):** built; checked in the render harness against the mockup and image 3, at 16:9, at 1100×1016 and on the low tier. Not yet reviewed by the owner in the app.

- **Texture pipeline, no new dependency.** Instead of glTF Transform, the shared model writer (`cinema2-tube-kit.mjs` `writeGlb`) now embeds PNG textures (a material's `textures: { normal, metallicRoughness, normalScale }`) and writes `TEXCOORD_0`, using the repo's existing in-house PNG encoder (now shared as `encodePng`).
- **Tube options.** `buildTaperedTube` gained opt-in `uv` (texture coordinates, with a duplicated seam vertex so the texture wraps cleanly) and `surfaceNormals` (shade the lumpy bark surface instead of the smooth radial direction). Without them the output is byte-identical; the golden tree was regenerated and checked.
- **Bark texture.** A tileable 512 px texture made in-house: vertical fibre grooves, broad lumps and a few deep cracks, as a normal map plus a roughness map (rougher in the crevices). It is embedded in the forest model and mapped along the grain of every trunk, limb, root and twig. The low tier drops the normal map, as with other assets, and still renders.
- **Foreground trees.** Four strands twisting harder (1.3 turns), leaning in toward the logo in an S-curve. Two limbs each climb and arch inward over the top of the frame. Eight heavy buttress roots settle into the floor, and four leafy twigs grow off the trunk toward the logo. Trunks sit at x = ±3.2, about 15% of the frame width each, like the mockup.
- **Mid and far trees.** Four mid trees (the inner pair moved out from x = ±2.7 to ±3.7, so the depth around the logo stays open, as in the mockup) and eight far trunks (was four) for the haze to fade.
- **Vines.** Broader gold vines centred on the bark's surface, so half sinks in and they read as raised bands (image 6). Every vine on a strand winds the same way: crossing vines read as a gold X. They carry leaves, as do the twigs on the limbs.
- **Glow.** The vines' glow share went from 1.4 to 2.2 and the leaves' from 1.1 to 1.5, so the vines read warmer against the dark bark.
- **Budget.** The forest is 128k triangles and 6.8 MB (was 127k and 5.8 MB). The leaves were most of an earlier 219k-triangle draft, so vines carry three to five leaves each. `npm run assets:check` passes.
- **Tests.** The forest test checks for the embedded bark textures and texture coordinates. The full Cinema 2.0 suite shows the same failures as the committed code.

Deferred:
- **Crack glow:** the bark's crack glow mask (light inside the bark) needs a glow shader change to read an emissive mask. It stays for later, since the mockup's glow is mostly on the vines (image 6).
- **Glow strength:** in the mockup the vines blaze with sparkle points, where ours are warm gold with pulses. Tune in phase 7, once phase 5's light shaft and fog and phase 6's embers are in.

**Done when:**
- The trees read as massive twisted trunks framing the scene.
- Broad gold vines wrap them and glow with the music.
- The far forest fades into the mist.

### Phase 5: Atmosphere and floor

1. **Light shaft.** A spot from high above, top centre and slightly right, with volumetric beams in the haze (the existing `volumetric-atmosphere` beams).
2. **Ground fog.** Lower and denser mist across the floor (`mistHeight`, `mistAmount`), thinner higher up.
3. **Floor rings.** Add concentric groove rings to the golden-roots asset, around the tree base on the floor, as a round platform (mockup and image 3).
4. **Floor reflections.** Lower `grit` (0.22 → about 0.05), use the new `streak` option for polished-wet reflections, and let HDR make the glow reflect as light.
5. **Warm spill.** Add a few warm lights near the tree base and along the vines, driven by the glow group, within the shared light limit.

**Result (2026-09-30):** built; checked in the render harness against the mockup at 16:9 and at 1100×1016, while playing and on a drop. Not yet reviewed by the owner in the app.

- **Light shaft.** The back light moved to (2.4, 7.5, -5.6), aimed far behind the tree at (-1.6, -1.55, -9.8), with a 9° cone at intensity 10 (was 1.4). The haze's beam brightness default went from 1.4 to 2.2. It now reads as a diagonal shaft falling from the top of the frame, right of centre, down behind the logo, like the mockup's.
  - Aimed closer, the spot where it lands lit a white pool around the trunk.
  - Aimed further right, the shaft ran behind the right-hand tree.
- **Ground fog.** Mist amount 0.7 → 1.0, height 0.45 → 0.32: lower and denser.
- **Warm spill.** The two rim spots (intensity 0.018, barely visible) were replaced by two warm spill point lights by the foreground trees. They carry the Glow Color, rest at 0.25 and swell on each downbeat (a new "Warm Spill" light group). They light the bark, the floor and the low mist round the tree bases: the mockup's warm fog. The light count stays at 12.
- **Floor rings.** Three thin ripple rings (radius 1.95, 2.3, 2.75), half sunk in the floor round the root flare, added to the golden-roots asset as a new `rings` part. They take a little of the glow, so a pulse leaves the tree as a ripple.
- **Floor.** Grit 0.22 → 0.05 (the grainy blotches are gone), plus `streak` 0.5, `edgeFallback` 0.6 and a thicker trace (2.5), with reflectivity 0.72 and roughness 0.2. The gold and the crystal reflect as streaked light.
- **Strobe.** Peak 6 → 3.5. On HDR targets the drop strobe at the old peak lit the denser mist into a full white-out; it still flashes the scene white.
- **Glow Color.** Its description no longer mentions the removed rim light.
- **Tests.** The RELIQUARY tests cover the spill lights (Glow Color, downbeat rule), the polished floor (low grit, streak), the rings part and the glow list. The full Cinema 2.0 suite shows the same failures as the committed code. `npm run assets:check` passes.

Still short of the mockup:
- **Shaft source:** the mockup's shaft has a bright glare where it enters the frame, which needs phase 6's glints.
- **Patch under the shaft:** where the shaft passes through the low mist behind the tree it lights a bright patch left of the trunk. Review it with the owner.
- **Mist:** the mockup's mist is wispier and brighter across the mid-ground.

**Done when:**
- The light shaft is visible.
- Fog lies low across the floor.
- The rings show around the roots.
- The floor reflects the glowing gold as bright, clean light.

### Phase 6: Embers, glints and depth of field

New engine capabilities: the earlier plan's steps 11-13.

1. **Embers and dust.** A particle option in the three-scene module using Three.js points or instancing (no new library): dust drifting in the light shaft, and slow glowing embers around the trees whose brightness follows the music. Low quality gets fewer or none.
2. **Glints.** A new built-in effect that turns the brightest highlights (crystal edges, strobe hits) into star-shaped glints and soft streaks.
3. **Depth of field.** A new built-in effect that blurs by distance, using the frame's depth, so the logo and the tree stay sharp while the far forest goes soft.
4. **Cost.** Measure the frame cost of each at 1080p per quality tier.

**Result (2026-09-30):** built; checked in the render harness against the mockup at 16:9, at 1100×1016 and on the low tier, with frame times measured at 1080p. Not yet reviewed by the owner in the app.

- **Particles.** A new `config.particles` option in the three-scene module (`modules/three/Cinema2ThreeParticles.ts`): fields of glowing points drifting through a box, animated entirely in the shader (one draw call per field, no per-frame upload).
  - Each point wraps round the box, fading at its edges so nothing pops, and sways and twinkles on its own.
  - `tint: 'glow'` takes the Glow Color, and `reactivity` lets the audio glow's breath brighten the field.
  - High quality draws the full field, medium half, low none.
  - RELIQUARY has three fields: embers through the scene (260), thicker embers rising from the golden tree's base (110), and dust in the light shaft (180).
- **Glare.** A new built-in `glare` effect: four-point star glints on only the hottest highlights. Threshold 8 in linear light, so the crystal's brightest glints, strobe heads and pulsing leaves catch it, and ordinary highlights don't. Streaks are 3.5% of the frame height. It is drawn at half resolution; low quality skips it.
- **Depth of field.** A new built-in `depth-of-field` effect: blur by distance from the frame's depth. RELIQUARY focuses at 5 units (the logo and tree) ±2.2. The far forest softens over 5 units to 7 px at 1080p, and the foreground trees stay sharp.
  - A golden-angle disc gathers the blur, and each sample counts only as far as its own blur reaches, so the sharp logo does not smear onto the soft background.
  - Samples: 20 on high, 12 on medium, none on low.
- **Render graph.** scene → floor → haze → depth of field → HDR bloom → glare → finish.
- **Performance fix (engine).** The first build measured 46.6 ms of GPU time per frame at 1080p on high, about 42 fps. Phase 5 alone had already been 34.8 ms.
  - Switching off one effect at a time showed the haze was the cost: it evaluated every light at every march step, including the two strobe heads, which are off between hits.
  - The haze now skips lights that are off this frame (`packCinema2VolumetricLights`, scattering only); the floor still lights from every light.
  - With depth of field reduced from 28 to 20 samples, high measured 10.6-18.2 ms of GPU time (varying between runs) and medium 5.9-6.3 ms, against 24.6 ms for the committed phase 5 in the same harness.
  - The harness's frame loop stays above 50 fps on high and at 60 on medium. The owner's MacBook remains the real check (phase 7).
- **Tests.** New `Cinema2Phase6Effects.test.ts`: glare and depth-of-field registration and validation, tier scaling, particle parsing and the module's validation of them, and the haze's light packing. The RELIQUARY tests cover the new render graph (depth of field reads the depth) and the ember fields. The full Cinema 2.0 suite shows the same failures as the committed code.

Still short of the mockup:
- **Embers:** the mockup has more embers, concentrated along the glowing vines, and its light shaft has a bright source glare where it enters the frame.
- **Medium glints:** on medium the glints are shorter (fewer taps).

**Done when:**
- Embers and dust drift in the light.
- The crystal sparkles.
- The far forest is soft while the logo stays sharp, within the frame budget.

### Phase 7: Tuning and owner review

1. **Side by side:** compare the render with the mockup at 16:9 and at the owner's Stage aspect.
2. **Behaviour:** check each Glow mode (Energy, Breathing, Energy & Breathing), the overhead spot chase and the drop strobe with a loaded track.
3. **Controls:** check that every Design control still does what its description says after the retune: Glow Intensity, Glow Color, the tint controls, Bloom, Haze and Master Intensity.
4. **Performance:** re-measure frame times per tier at 1080p. The budget is 60 fps on the owner's MacBook.
5. **Docs:** update this document and `docs/cinema2-reliquary-cinematic-plan.md` with the results.

**Done when:** the owner compares the two side by side and signs off.

### Phase 6b: Pre-tuning fixes (after the owner's review of phase 6)

Comparing the owner's screenshot of the app (nearly square Stage) with the mockup showed four structural gaps to fix before phase 7:
1. framing on the Stage;
2. the crystal reads as chrome, not clear cut glass;
3. the golden tree's limbs should sweep along the outer lobes, and its roots should be many thin glowing tendrils, not a pile of blades;
4. the background vines should be thin with sparkle points, not broad ribbons, and the bark should not reflect pale.

**1. Framing: done (2026-09-30).**
- **Problem:** `minAspect` was 16:9, so on the owner's ~1.09:1 Stage the whole 16:9 width was fitted and the logo shrank to about a third of the frame width, with empty floor below.
- **Fix:** `minAspect` is now 1.3. A narrower Stage first crops the outer trees off the sides and only widens vertically below 1.3:1, and the camera target moved from y -0.4 to -0.42.
- **Result:** at 1594×1460 the logo is about 45% of the frame width (was about 33%), with the root flare and the inner edges of the framing trees in view. 16:9 is unchanged.
- **Limit found:** going tighter (1.15 or 1.05) pushes the roots off the bottom before the logo reaches the mockup's size. Our golden tree's trunk is about 77% of the logo's height from the logo to the floor, against about 45% in the mockup. Closing that is part of item 3: a shorter trunk with the logo lower on it.

**2. Crystal: done (2026-09-30).**
- **Cause:** the logo read as chrome because it reflected the shared soft studio room: every facet mirrored the same pale grey, and with a white body and strong reflections it read as polished metal.
- **New environment.** A third room from the existing generator (`generate-studio-environment.mjs ... gem`), asset `cinema2-studio-environment-gem` (71 KB + 22 KB). It is a near-black room scattered with 48 small hard lights, like a jeweller's display case, so each flat facet reflects either black or a brilliant point. RELIQUARY uses it; the other two rooms regenerate byte-identical, and GO-TO and CONDUIT are untouched.
- **Geometry.** The cut-crystal ribbon is sampled coarsely along its length (4 samples per curve, was 10), so the three cut bands break into flat panels that each catch a different light. Crease angle 8°, depth 0.06, 24k triangles (was 75k).
- **Material.**
  - body pure white (was (0.9, 0.92, 0.95));
  - clarity 0.95 (was 0.9);
  - thickness 0.35 (was 0.14);
  - roughness 0 (was 0.03);
  - environment 2.5 (was 1.8).
- **Glare.** Threshold 8 → 16, intensity 0.55 → 0.4, length 0.035 → 0.03: fewer, smaller stars.
- **Variants rejected, for the record:**
  - fully clear glass in the soft room read as black obsidian (it refracts the dark forest);
  - lower clarity read as milky porcelain;
  - a bevel of 0.07 for a central ridge inverted the logo's thin sections and filled its holes.
- **Result:** the crystal reads as clear glass with dark centres and point sparkles. It is still less brilliant than the mockup, where offline rendering lights the glass from inside, and its ribbons have no central ridge (the thin sections cannot take a wider bevel).
- **Tests.** RELIQUARY uses the gem room and clear-glass settings. The full Cinema 2.0 suite shows the same failures as the committed code. `npm run assets:check` passes.

**3. Golden tree shape: done (2026-09-30).**
- **Proportions.** The golden-roots model now has its floor at y -1.3 in the logo's frame (was -1.55), so the trunk below the split is about half the logo's height, like the mockup. The preset lowers the logo and the tree together by `TREE_DROP` = 0.25, so the tree stands on the scene floor, and the camera follows to (0, -0.65, 4.6) aimed at (0, -0.57, 0). On the owner's Stage the logo is larger than before, with the root flare and the floor rings in view.
- **Limbs.** The two main limbs rise diagonally from the split, across the front of the logo's bottom band and up into the outer lower lobes, ending in curls inside them (base radius 0.115). The first try ran them flat along the logo's bottom edge and read as a crescent. The branches through the inner openings are now slender (base 0.057, was 0.11).
- **Roots.** 32 roots (was 30): every fourth a short buttress off the trunk base, the rest long, thinner, wavier tendrils (radius 0.05-0.075, reaching 1.2-2.0). Each forks twice and carries a glowing seam along most of its length (only the major roots had one, near the trunk). The small leaves on the roots, which read as gold balls, are gone.
  - Tried and rejected: 44 very thin roots read as scattered straw.
- **Leaves.** Smaller and pointed (0.05-0.08, was 0.085-0.13); more of them on the main limbs, fewer on the inner branches.
- **Budget and tests.** 86k triangles, 2.6 MB; `npm run assets:check` passes. A new RELIQUARY test checks that the logo and tree are lowered together. The full Cinema 2.0 suite shows the same failures as the committed code.
- **Still short of the mockup:** its roots are finer, more numerous and interwoven, glowing along every strand. From the low camera ours still fan out from the base somewhat like spokes. This is near the ceiling of hand-coded geometry.

**4. Background vines and bark: done (2026-10-01).**
- **Vines.** Thin glowing strands (radius 0.014 near, was 0.034 broad half-sunk bands) riding just proud of the bark, three per foreground strand and two per mid-tree strand. Dark burnished gold (0.4, 0.24, 0.08), so an unlit vine is a dark line and the glow gives the color.
  - A bright gold picked up the warm haze and read pale beige.
  - The vines' glow share is 0.7 (was 2.2); stronger, the tone curve rolled the amber to pale peach.
- **Sparkle points.** 8-13 tiny glowing crystals (octahedra, 8 triangles each) along every vine, in the `buds` part, with glow share 4 (was 1.5). They give the mockup's white-hot points. Leaves on the vines are smaller (0.045-0.075, was 0.07-0.12) and fewer.
- **Bark.** Environment reflection 0 (was 0.15): the trunks no longer read pale grey-cream and stay near black, as in the mockup.
- **Budget.** The forest is 133k triangles, 7.5 MB; `npm run assets:check` passes.
- **Frame time.** Medium measured 11.6-14.8 ms of GPU time, but the committed code measured 16-20 ms in the same session, so the harness's GPU timer varies with the machine's load. Medium holds 60 fps in every run.
- **Tests.** The full Cinema 2.0 suite shows the same failures as the committed code.
- **Still short of the mockup:** its bark has glossy highlights from the glow, and its vines are denser. The warm orange haze over the foreground trees (the spill lights lighting the mist) dulls them; that is phase 7 tuning.

**5. Depth and framing: done (2026-10-01).** After items 1 and 3 the owner saw the logo and tree too large on the Stage (about 60% of the width) with the foreground trees pushed out of frame.
- **Trees.** Foreground trees moved in from x ±3.2 to ±2.45 (and back from z -1.2 to -1.5), leaning in less (-0.25, was -0.55). The outer mid trees moved from ±4.9 to ±4.1.
- **Camera.** (0, -0.6, 4.1) aimed at (0, -0.5, 0), with `minAspect` 1.7 (was 1.3).
- **Result:** at 16:9 the logo is about 39% of the width (mockup about 43%) with both trees framing it; at 1594×1460 about 37%, with the trees at the edges.
- **Why cropping can't work:** cropping the sides on a near-square Stage cannot keep both the logo at the mockup's size and the framing trees in view, so the Stage widens vertically instead and shows more floor and sky.

## 4. Acceptance checks

For the mockup, at 16:9 and at the owner's Stage aspect:

1. **Composition:** the logo, the golden tree, both framing trees, the light shaft and the floor rings sit where they are in the mockup, and nothing important is cropped.
2. **Glow:** lit gold has a near-white core, an orange halo and visible warm spill on the bark and the floor. Confirm with a pixel profile across a lit vine: peak near white, then an orange falloff over at least 10 px.
3. **Logo:** clear, bright glass with a smooth bevel, no border ring, and refracted light in the openings.
4. **Trees:** twisted, textured trunks arching inward, with broad glowing vines.
5. **Contrast:** deep blacks in the forest, bright highlights on the crystal and the gold, no colour fringing.
6. **Owner review:** the owner compares the two side by side and signs off. The numbers support that review; they do not replace it.

## 5. Known constraints

- **Shadows stay off.** The earlier plan's step 8 (spot-light shadows) is still blocked: any shadow map turns the glass milky white. RELIQUARY does not use shadows until that is fixed.
- **Not photoreal.** Real-time rendering will not match an offline render's bounce light and micro-detail exactly.
- **Reflections are screen-space.** The floor only reflects what is on screen.
- **Hand-coded geometry has a ceiling.** Trees and roots written in code will be simpler than hand-sculpted models. If the owner wants the exact detail of images 4 and 5, hand-modelled assets are the way to get it.
- **Shared assets.** The logo asset is shared with GO-TO: every logo change must keep GO-TO unchanged.
