# CONDUIT vs the production mockup: gap analysis and next steps

**Date:** 2026-09-30
**Status:** the preset is functionally complete: assets, per-segment lighting, controls and patterns all work. Visually it falls well short of the owner's mockup. This document records why, and what to do about it.

**Related:** `docs/cinema2-conduit-plan.md` covers the build plan and the step 1-4 results.

**Images compared** (in `~/Downloads/cinema2-3d-reference-images/conduit/`):

| Image | What it is |
|---|---|
| `current-preset-2026-09-30.png` | The preset as the owner sees it in the app. The Stage there is nearly square (1592×1470). |
| `20.png` | The owner's production mockup, "full" state: every LED lit, 16:9. |
| `19.png`, `21.png`, `22.png` | The partial, split and breakdown mockups. |
| `23.png`, `24.png` | The wall-only and tubes-only references. |

## 1. Verdict

The preset matches the mockup's **layout**: a circular chamber, a wordmark centre frame, four S-tubes from corner flanges, and LED segments on the rings and ribs.

It does **not** match its **look**. The mockup's appearance comes from light: hundreds of glowing LED segments that are the brightest things in the frame, bloom and warm spill on polished metal. It also comes from crisp, detailed hard-surface modelling. The current preset has neither, so it reads as a flat, pastel, toy-like version of the design.

Step 4 compared average brightness per region and reported the result as "much closer". That was misleading. Matching average brightness says nothing about whether the LEDs glow, whether edges are crisp, or whether the metal reads as metal. The acceptance test for the fixes below must be a side-by-side visual review with the owner, backed by the specific checks listed in section 5. A mean-brightness table is not an acceptance test.

## 2. Where the preset is lacking, and why

Ranked by how much each one contributes to the mockup's look.

### 2.1 The LEDs do not emit light (the biggest gap)

| | Mockup | Current |
|---|---|---|
| LED core | White-hot, clipped to near white | Flat orange/yellow fill, the same brightness edge to edge |
| Halo | A soft orange glow 10-40 px around every segment | None, or a few pixels at most |
| Spill | Warm light on the surrounding metal: ribs, ring faces, tube chrome | None; the metal is lit only by neutral room light |
| Floor | Long, vertical warm reflection streaks under every lit segment | Faint, sharp reflections of the flat dashes |
| Read | "Light sources" | "Painted stripes" |

**Why.**
- **8-bit render targets.** Every CONDUIT render target is `rgba8` (`viewportTarget(...)` in `Cinema2ConduitPreset.ts`). No pixel can be brighter than white, so an LED can never be "ten times brighter than the wall", which is exactly the relationship bloom and reflections need.
- **No tone mapping in the 3D module.** It renders with `THREE.NoToneMapping` (`Cinema2ThreeRendererHost.ts`), so bright colours clip channel by channel: amber turns yellow. Step 4's soft roll-off (`1 - e^-x`) was a workaround, not a fix.
- **A small bloom.** The bloom is a 13-tap blur whose reach is roughly 3.6 × radius px, with a knee of `smoothstep(threshold, min(1.0, threshold + 0.28), luma)`. It is built for LDR input, and on an 8-bit image it cannot separate LEDs from white letters and lit walls. A wide second bloom was tried; it smeared the wordmark.
- **No local warm light.** The only warm lights are three point lights, and they must stay dim so they don't flood the room.

**Correction to earlier statements.** The engine already supports float render targets: `rgba16f`/`rgba32f` in `Cinema2ResourceManager`, which require `EXT_color_buffer_float`. The final pass, `cinematic-finish`, already has an ACES filmic tone curve (`CINEMA2_TONE_MAP.filmic`). An HDR chain is therefore mostly a preset change plus two small engine fixes (see section 4, step 1), not the large engine project described in the previous reply.

### 2.2 The framing breaks at the owner's Stage aspect

| | Mockup (16:9) | App Stage (about 1.08:1) |
|---|---|---|
| Visible | The whole chamber: flanges at all four corners, full S-curves, floor ellipse | A cropped middle: the flanges and most of the tube curves are off-frame, the logo fills about 75% of the width, the floor is a grey slab |

**Why.**
- **Height-based framing.** The camera uses a fixed vertical field of view (42°), so at a narrower aspect the horizontal view shrinks and the sides are cut away.
- **No fit-to-width option.** The camera runtime (`Cinema2CameraRuntime`) builds the projection from `fovDegrees` and the viewport aspect, and has no fit-to-width or minimum-horizontal-FOV setting.
- **Tuned at 16:9 only.** All tuning was done at 1280×720, so this was never seen.

### 2.3 The wordmark looks wrong

| | Mockup | Current |
|---|---|---|
| Letter faces | Flat, bright white faces with a crisp bevel and hard edges | A soft, lumpy "pillow" dome whose reflections ripple and wobble across each letter |
| Letter depth | Clearly thick extrusions with visible side walls | Shallow |
| Ring | A thick polished frame with a dark inner edge | Thin and wavy; reads as a grey outline |
| Glow | Strong orange light filling the gap between letters and ring, and glowing along the letter sides | A thin pale-yellow line that looks like a drawn outline, not light |
| Colour | Pure white letters, near-black shadows between shapes | Cream/grey letters with low contrast |

**Why.**
- **Wrong relief.** The letters use the shared kit's rounded relief (GO-TO's pearl logo style): a Delaunay surface lifted by distance from the edge. It is designed to be soft. Its jittered interior points plus smooth normals produce the rippled reflections.
- **Thin ring.** The ring is a thin, low-bevel extrusion (bevel 0.005, forced by thin sections of the SVG ring).
- **Too little glow geometry.** The rim glow is a 0.03-wide band on the back plate; it has no light of its own to spill onto the letter walls.
- **The same missing glow as 2.1.**

### 2.4 The tubes

| | Mockup | Current |
|---|---|---|
| Body | Heavy dark chrome with strong highlights and a visible rolled-edge profile | Light chrome that reads as grey plastic |
| Windows | Deep rectangular cut-outs in a dark channel, glowing from inside; the glow lights the channel walls | Thin curved patches painted on the surface |
| Coupler | A machined sleeve with grooves, rings and bolts; its gaps glow | Plain stacked cylinders; the band caps read as flat orange discs |
| Flanges | Large, thick, bolted, set into the wall with glowing rings | Small, thin discs, cropped off-frame in the app |

**Why.**
- **Simple geometry.** The tube generator builds plain swept cylinders, and the windows are thin patches, not recessed openings.
- **Wrong metal balance.** The chrome material is too bright and rough for the environment, and there is no dark reflected environment to give chrome its contrast.

### 2.5 The back wall

| | Mockup | Current |
|---|---|---|
| Detail | Dense hard-surface detail: beveled edges everywhere, stepped layers, inset panels, cable channels, dark gap lines between parts | Large flat shapes with small bevels; few layers; no panel lines |
| Shading | Many values from near-black gaps to bright edges, giving strong local contrast | A narrow mid-grey range; everything the same silver |
| LEDs | Thick, long, rounded bars recessed in dark tracks, with double bars on the pillar and ribs | Thin short dashes, mostly on a grey surface |
| Centre disc | A darker, recessed, layered iris | A flat light disc facing the camera: the brightest non-LED area in the frame |

**Why.**
- **Coarse, generic generator.** The chamber generator uses coarse primitives: extruded annuli, sectors and rectangles, with 2-3 bevel segments.
- **No detail geometry.** There are no panel seams, grooves, bolts or step layers, which is where the mockup gets most of its visual richness.
- **Uniform materials.** Material variation is limited to `shell` / `trim`; nearly everything is `shell`.

### 2.6 Floor

| | Mockup | Current |
|---|---|---|
| Surface | Bright, highly polished silver | Mid grey |
| Reflections | Long vertical streaks of warm light under every LED; soft stretched reflections of the tubes and wall | Sharp, faint reflections of the painted dashes |
| Grooves | Crisp inlaid rings that catch highlights | Thin dark lines |

**Why.**
- **Nothing bright to reflect.** Without HDR there are no bright sources to create streaks.
- **Wrong reflection shape.** The screen-space reflection blurs evenly, while polished floors stretch reflections vertically (anisotropy).
- **Floor base too dark.** The floor's base colour and albedo were set conservatively.

### 2.7 Lighting and camera lens

The mockup has the look of a wide lens with strong perspective (the flanges loom large at the corners) and deep contrast. The preset uses a 42° lens at z = 7 and flat, low-contrast lighting, because the lights were turned down to stop a white-out: an 8-bit consequence again.

## 3. What is incorrect, and should be changed regardless of approach

1. **Every render target is `rgba8`.** CONDUIT needs HDR (see step 1).
2. **Height-based framing** breaks the composition at the owner's Stage aspect (see step 2).
3. **The wordmark uses the soft pillow relief** instead of a crisp bevelled extrusion (see step 3).
4. **The segment soft roll-off (`1 - e^-x`) in the bridge** is only correct for LDR. With HDR it must be removed for CONDUIT, or made optional, so LEDs can exceed 1.
5. **Master Intensity defaults to 1** only to hide the linear-to-sRGB lift of dim segments. Once HDR and tone mapping are in place, revisit this so the control behaves as described.
6. **The step 4 acceptance method** (mean-brightness regions) is replaced by the checks in section 5.

## 4. Next steps

Do these in order: each builds on the previous one. Each step ends with a side-by-side render at 16:9 and at the owner's Stage aspect (about 1.08:1), reviewed with the owner before moving on.

### Step 1: HDR light chain (the LEDs become light sources)

1. **Float targets.** In `Cinema2ConduitPreset.ts`, set the scene, floor, haze and bloom targets to `rgba16f`, and keep the output 8-bit.
2. **Fallback without float support.** `Cinema2ResourceManager` currently throws when `EXT_color_buffer_float` is missing. Either make the render graph fall back to `rgba8`, or give CONDUIT a quality-tier variant, so machines without the extension still run it. Test on the low tier.
3. **3D module into HDR.** Confirm the three-scene bridge writes linear values above 1 into a float target. It currently renders into the engine framebuffer flagged as an sRGB XR target, so check that the encode doesn't clamp. If it does, switch the bridge to write linear output for float targets.
4. **Segment light.** Remove the `1 - e^-x` roll-off for HDR targets (keep it for `rgba8`). Raise segment strength so lit LEDs are roughly 8-20× the wall's brightness. Energy colour stays saturated amber; the white core comes from tone mapping.
5. **Bloom.** Make the bloom HDR-aware:
   - fix the knee (`min(1.0, threshold + 0.28)` breaks for thresholds above 1);
   - use a threshold above 1, so only LEDs bloom;
   - add a wider, smoother kernel: a small downsample chain, or more taps with a proper falloff.

   Check RELIQUARY, GO-TO and Threshold, which also use `bloom`.
6. **Tone mapping.** Set `cinematic-finish` to `toneMap: filmic` with tuned exposure, so the LEDs roll to a white core with an orange edge and the metal keeps its mid tones.
7. **Warm spill.** Once LEDs are bright, add a few more warm lights placed along the ring and rib groups (within the 12-light limit), driven by the same pattern groups. As an option, add a cheap emissive "spill" term in the shell shader keyed to nearby segment brightness.

**Done when:**
- lit LEDs clip to a warm-white core with an orange halo of at least 10 px at 1080p;
- the letters and walls do not bloom;
- the metal near lit segments picks up visible warm light.

### Step 2: Framing that holds at any Stage aspect

1. **Fit-to-width camera.** Add a camera option (engine: `Cinema2CameraRuntime`) such as `fit: 'width'` or `minHorizontalFovDegrees`, so that at narrower aspects the vertical FOV widens instead of the sides cropping.
2. **Wider lens.** Re-frame CONDUIT with a wider, lower lens to match the mockup's perspective: flanges looming at the corners, the floor ellipse visible. Starting point: about 55° horizontal-equivalent, camera slightly lower and closer.
3. **Verify at several aspects:** 16:9, 16:10, 4:3 and the owner's about 1.08:1. The flanges must stay in frame at every one.

**Done when:** all four flanges and the full S-curves are visible at the owner's Stage aspect.

### Step 3: Rebuild the wordmark as a crisp bevelled extrusion

1. **Letters.** Replace the pillow relief with a true extrusion: flat front face, chamfer plus round bevel, visible side walls about 0.12-0.18 deep. Normals must be flat on the face (no rippling). Keep the relief kit for GO-TO; add an extrusion path to the wordmark generator.
2. **Ring.** Rebuild it as a thicker, taller frame with a rounded outer edge and a dark inner lip. Offset the ring outline outward where the SVG ring is too thin to bevel, instead of shrinking the bevel.
3. **Glow gap.** Replace the thin rim band with glow geometry that fills the gap between letters and ring, sitting slightly behind the letter faces. Add an emissive strip along the base of each letter's side walls, so light rises up the sides as in the mockup.
4. **Materials.** Letters get a bright white, low-metal, glossy material. The ring gets dark polished chrome. The back plate goes near-black.

**Done when:**
- the letters read as flat white faces with crisp bevels;
- no reflection ripples on the faces;
- the gaps glow orange with light visibly reaching the letter sides.

### Step 4: Tube detail

1. **Windows.** Cut real recessed openings into a dark channel along the front of each pipe. Put the glow inside, on an inner cylinder or window floor, so the channel walls catch it.
2. **Couplers.** Model them properly: grooves, stepped rings, bolt heads, and glowing gap rings visible from the side, not flat caps.
3. **Flanges.** Make them bigger and thicker, with bolt circles and a glowing inner ring, set into a housing on the side wall.
4. **Materials.** Dark polished chrome body (dark base, high metalness, low roughness) against a darker, higher-contrast environment, so chrome reads as chrome.

### Step 5: Back wall detail and contrast

1. **More geometry.** Add stepped layers to every ring (2-3 levels) and bevels on every edge (more bevel segments or a chamfer plus round profile), plus dark gap lines between parts (thin trim insets). Add panel seams and small hardware: bolts, vents, cable channels on the ribs.
2. **LED shape.** Make the segments longer, thicker, rounded bars recessed in dark tracks, as in the mockup. Add double bars on the top pillar and T-ribs, and radial bars in the panels, matching `20.png`'s count and placement.
3. **Centre.** Make the disc a darker, recessed, layered iris with its own material, so it stops being the brightest surface.
4. **Materials.** Split `shell` into at least a light brushed silver (raised faces), a darker steel (recesses) and near-black (gaps and tracks), so the wall gets the mockup's range of values.

### Step 6: Floor

1. **Surface.** A brighter polished base with higher reflectivity, now that there is HDR light to reflect.
2. **Streaks.** Add vertical stretch (anisotropy) to the floor's reflection blur, to get the mockup's long streaks: a `reflective-floor` enhancement, useful for other presets too.
3. **Grooves.** Crisp, raised, bevelled groove rings that catch highlights.

### Step 7: Tune and review with the owner

- **Each pattern against its mockup:** Partial, Full, Split and Breakdown against `19`-`22`, at both aspects.
- **Split:** extend it so the room lights on the unlit side dim too (the mockup darkens the whole half).
- **Performance:** re-measure frame times per tier at 1080p after HDR. Float targets and wider bloom cost fill-rate; the budget is 60 fps on the owner's MacBook.

## 5. Acceptance checks, replacing mean-brightness matching

For each mockup state, at 16:9 and at the owner's Stage aspect:

1. **Composition:** all four flanges, the full tube curves, the wordmark and the floor ellipse are in frame, in the same relative positions as the mockup.
2. **LEDs:**
   - lit segments have a near-white core;
   - there is a visible orange halo;
   - warm spill is visible on adjacent metal and the floor.
   Judged by eye and confirmed by a pixel profile across a segment: peak near white, then an orange falloff over at least 10 px.
3. **Wordmark:** flat white faces, crisp bevel, no rippling; orange glow in the gaps; a dark ring edge.
4. **Contrast:** the wall shows near-black gaps and bright edges, not a single mid-grey band.
5. **Patterns:** each state is recognisably the mockup's state (partial / full / split / breakdown) at a glance.
6. **Owner review:** the owner compares the two side by side and signs off. The numbers support that review; they do not replace it.

## 6. Honest limits that will remain

- **Not photoreal.** Real-time rendering will not match an offline render's bounce light, soft shadows and micro-detail exactly.
- **Warm spill is approximate.** It comes from a handful of lights plus the bloom, not true light from every LED.
- **Reflections are screen-space.** The floor only reflects what is on screen.
- **Hand-coded detail has a ceiling.** Geometry detail written in code (no hand-modelled assets) can get close to the mockup's density but will be simpler. If the owner wants the exact wall and tube detail, hand-modelled assets are the way to get it.

## 7. Proportions pass (2026-10-01)

The owner's comparison: the four tubes are about 2.5 times too thick and swallow the wordmark's corners; the wordmark should be larger on screen; the letters lack contrast and shading. Agreed order:
1. automatic tube attachment points;
2. scale the wordmark;
3. resize and reroute the tubes;
4. framing check, then owner review;
5. letter contrast and lighting;
6. final grade and checks.

**Step 1: done.**
- **What changed:** `generate-conduit-wordmark.mjs` now writes the tube attachment points (the frame's outer edge nearest the mockup's tube ends, left side, mirrored for the right) to `scripts/cinema2-assets/conduit-layout.json`. `generate-conduit-tubes.mjs` reads them instead of hand-typed values. The file is written only when generating the shipped model, not for a custom output path.
- **How to regenerate:** run the wordmark generator first, then the tubes.
- **Check:** both regenerated models are byte-identical to the committed ones, so the preset is unchanged.

**Step 2: done.**
- **Wordmark size.** 5.4 units wide (was 4.23, about 1.28x), centred where it was. Depths, bevels and glow widths stay in absolute units, so the bigger letters keep crisp edges and thinner seams of light.
- **Tube attachments.** The mockup-derived targets scale with the width; the layout file now gives upper-left (-2.075, 2.818) and lower-left (-2.685, 1.776).
- **Post removed.** The back wall's pedestal under the centre read as a post holding the wordmark up; in the mockup it floats.
- **Result:** the wordmark spans about 53% of the frame width at 16:9 (mockup about 51%) and about 50% on the owner's 1594×1460 Stage (was about 39-46%).
- **Budget.** The bigger mark pushed CONDUIT 147 KB over its low-tier asset budget, so the glow bands are sampled every 0.05 (was 0.04). `npm run assets:check` and the CONDUIT and asset-budget tests pass.
- **Tubes.** They were regenerated to the new attachment points, but are still the old size and route, so they still overlap the outer letters; that is step 3.

**Step 3: done.**
- **Style.** Kept the current design: chrome pipe, LED channel and machined couplers. The owner did not choose the mockup's glass glowing-core style, which can still be done later.
- **Size.**
  - Pipe radius 0.145 (was 0.235): a tube's diameter is now about 18% of the wordmark's height (was nearly half), close to the mockup's 16%. The channel, LED bars and coupler rings follow the radius.
  - Couplers 0.7 long (was 1.15), sinking 0.04 into the frame (was 0.08). LED bars 0.26 long with 0.045 ribs, lips 0.011.
  - Flanges scaled to 0.6 of their modelled size, with the neck still matching the pipe.
- **Route.**
  - Flanges at the upper and lower corners (y 4.6 and 0.45), angled slightly toward the wordmark. Each tube sweeps in one smooth diagonal S and meets the wordmark's end at about 30°.
  - The spline's middle point is computed between the two ends, replacing the hand-placed points.
  - A first try at 20°, with the flanges moved toward the middle, ran the tubes nearly flat with kinks.
- **Result.** At 16:9 and on the owner's Stage, the tubes no longer cover any letters, and their proportions match the mockup.
- **Budget.** 78k triangles; `npm run assets:check` and the CONDUIT and asset-budget tests pass.

**Fix after the owner's review of step 3: coupler slimmed (2026-10-01).**
- **Problem:** the owner's screenshot showed the tube ends still covering the wordmark's corners. The analysis found four causes: the tube ends in front of the letters; the bulky coupler sits at the very end; it runs over the frame's face; and the collars are wide. Of the four fixes proposed, the owner chose only the coupler slimming for now.
- **Change:** `COUPLER_BULGE` = 0.48 scales the couplers' bulge past the pipe, so the widest collars are 1.3x the pipe radius (were 1.62x). Grooves, rings, slotted blocks (now 0.035) and glow rings keep their proportions. The turned profile uses 40 segments (was 44), keeping CONDUIT within its low-tier asset budget (it went 9 KB over otherwise).
- **Result:** the couplers are visibly slimmer and cover less of the corners.
- **Still open:** the coupler still overlaps the upper "D" and "M" corners and the lower swash ends, because it still ends in front of the letters. The other three fixes (end the tube behind the wordmark, move the coupler back along the tube with a short plain pipe into the frame, and push the attachment points to the outline's outer extremities) would clear it.

**Rerouted to the owner's sketch (2026-10-01).**
- **The sketch:** the owner drew each tube running inward above (or below) the wordmark and plugging into its top (or bottom) edge near the ends, at the upper left of the "D" and under the left swash, mirrored on the right. Confirmed: mirror the right side exactly; keep the ribbed coupler, set back from the word.
- **Attachment points.** In `generate-conduit-wordmark.mjs` they are the outline points nearest targets set as fractions of the mark's half width and height (upper (-0.66, 1.6), lower (-0.66, -1.6)). The layout file now gives upper-left (-1.75, 2.878) on the top edge and lower-left (-1.848, 1.406) on the bottom edge.
- **Route.** Each tube leaves its corner flange, runs inward at about the flange's height and sweeps through a smooth two-point bend onto a straight end that comes down onto the top edge (or up into the bottom edge), leaning a little inward. Its last part is:
  - the slim coupler;
  - a 0.3 plain pipe (`PLAIN_LENGTH`) with a slim collar;
  - the plug into the outline's edge 0.07 behind the wordmark's centre plane, sinking only 0.02.

  The upper tubes have a longer straight run before the bend (0.75) than the lower ones (0.3), which run close to the floor.
- **Overlap check (new).** The wordmark is rendered as a flat red mask with and without the tubes. The covered share of its silhouette, eroded 7 px to exclude the bloom fringe and floor reflection, is 0.26% at 1594×1460 and 0.37% at 1280×720: only the contact at the four joints.
- **Budget.** The longer tubes went 468 KB over CONDUIT's low-tier budget, so their sampling was eased (row pitch 0.06, 24 sides, 8×8 LED bars): 76k triangles. `npm run assets:check` and the CONDUIT and asset-budget tests pass.

**Sketch reroute reverted; tubes now enter through the back (2026-10-01).**
- **Owner's review:** the top/bottom-edge reroute looked bad and was reverted to the diagonal route. The eased tube sampling stayed, since CONDUIT's budget needs it.
- **Change.** The last stretch of each tube turns toward the camera (`BACK_TURN` 0.7) and plugs into the back of the wordmark's lip (z -0.2), at a point moved 0.42 in from the frame's outer edge toward the centre (`BACK_INSET`). The joint and the coupler are hidden behind the letters; from the front the tubes run diagonally from the corner flanges and pass behind the wordmark's ends.
- **Checks.** `npm run assets:check` and the CONDUIT and asset-budget tests pass.

**Step 5: letter contrast and lighting (2026-10-01).** Compared on a close-up of the wordmark against the mockup after each change.
1. **Dark sides and thin seams.**
   - The letters' side walls no longer glow (`walls` removed from `config.segments`). They are a darker bronze-grey (0.3, 0.27, 0.25), and the frame is darker chrome (0.42).
   - The gap glow bands narrowed to 0.028 (were 0.05) and the outer lip line to 0.025 (was 0.035).
   - Each letter now has a defined dark edge and only a thin seam of light.
2. **Key light.** Intensity 0.08 → 1.2 from (0.6, 8, 5), range 14. The range matters: a shorter range makes the light fade faster, which first dimmed the whole frame.
3. **Letter material and shape.**
   - Letters a soft white (0.74, was 0.92) with a full glossy clearcoat and environment 0.6.
   - A wider rounded edge: bevel 0.042 with 4 segments (was 0.016 with 3), depth 0.21.
   - Measured on the white surfaces: the median went from 236 to about 226 (mockup 218), with highlights standing out against it. Faces no longer sit in one band of near-white.
4. **Shadows.** The key light casts shadows (`threeShadow`, medium and high), with letters and walls casting and the letters, frame, lip, gaps and walls receiving. Measured on and off, they change only about 1,400 pixels.
   - **Why:** the whole mark is one flat layer. The frame is only the thin outer ring, and every letter plus the swashes and sweeps sit at the same height, so a shadow has nowhere to fall.
   - In the mockup the letters stand clearly above a lower swash layer; that height difference is most of its depth and shadow. Raising the letters above that layer is the next fix, and needs the owner's decision on which shapes form the lower layer.
- **Budget.** The wider bevel pushed CONDUIT 628 KB over its low-tier budget, so letter outlines are sampled 9 per curve (were 12). `npm run assets:check` and the CONDUIT and asset-budget tests pass.
