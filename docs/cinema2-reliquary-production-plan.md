# RELIQUARY: production plan

**Date:** 2026-09-30
**Status:** Phases 1 and 2 built (2026-09-30), awaiting the owner's review in the app. Phases 3-7 not started.

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
