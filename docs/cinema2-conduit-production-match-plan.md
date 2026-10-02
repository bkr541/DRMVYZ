# Cinema 2.0 CONDUIT — production visual match plan

## Scope and visual authority

This plan compares the current CONDUIT render supplied with the request (image 1) with the desired production visual (image 2). The supplied `wordmark_clean_master.svg` is the authority for the *two-dimensional wordmark shape*; image 2 is the authority for lighting, materials, visual hierarchy, and composition. If a stylized detail in image 2 conflicts with the SVG contour, preserve the SVG contour.

This is an implementation plan only. It does not claim that the current render already meets the reference, and it does not change the preset or generated assets.

### Findings from the attachments and source

| Area | Current render | Desired visual | Consequence |
| --- | --- | --- | --- |
| Chamber and tube housing | Broad cream/white surfaces, hot highlights, and similarly bright concentric wall rings | Midtone silver/bronze housing, dark recesses, localized highlights | The current room competes with the logo and LEDs instead of framing them. |
| Tube, wall, and logo LEDs | Orange bars are visible, but many are less prominent than adjacent white metal; some are dark in the captured pattern | Bright warm-white cores, orange glow, clear separation from dark channels and housing | Improve local LED contrast and verify equivalent music/energy states before comparing brightness. |
| Wordmark | Pale faces, orange seams, and a bright surrounding wall merge at a glance; the layered bevel/glow can make strokes look heavier | Pearl-white, clearly legible faces separated by dark bronze sidewalls, counters, and shadow | Restore tonal separation around the letters, not simply more brightness on them. |
| Floor | Large, pale beige foreground with low-detail reflections | Darker metallic stage with controlled, warm reflected light | The floor should support the LEDs and logo without becoming the brightest continuous surface. |
| Overall image | High, fairly uniform exposure; some fine detail is lost in bright surfaces | More directional light, shadow depth, reflective material contrast, and restrained bloom | Adjust the scene's light/material balance before final post-processing. |

The supplied master SVG is a `2006 × 585` vector with eight filled body paths plus an even-odd outer-outline ring. Its SHA-256 is `0ac33e757c07ed5e13b04b72d8c5f90403628531adb4632973729fd05df566f9`. The repository copy at [`scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg`](../scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg) has the **same hash**. [`generate-conduit-wordmark.mjs`](../scripts/cinema2-assets/generate-conduit-wordmark.mjs) already reads that copy. Therefore, an SVG replacement alone cannot correct issue 3. The likely sources of *perceived or actual rendered* shape differences are cubic-curve sampling (currently 8–9 samples per curve), the front-face inset and bevel, the extruded frame/lip, glow width, material highlights, and camera projection. A geometry-versus-SVG overlay is needed to separate these causes rather than assuming the source art is wrong.

Two comparison limits matter: the screenshots have different aspect ratios, and the current image shows a mixed LED pattern while the desired image appears broadly illuminated. Reference comparisons must first use the same 16:9 framing, quality tier, Energy Color, camera motion, and steady/full-energy lighting states.

## Ordered implementation steps

### 1. Establish repeatable reference captures and isolate the overexposure

- Capture the current preset at 16:9 and in the narrower in-app Stage, at low/medium/high quality, with camera movement held still. Include a steady state and a full-energy state; record the actual control values and quality tier.
- Capture diagnostic passes: raw 3D scene before effects; scene without environment or area panels; scene without bloom, haze, or floor; and material/part masks for letters, frame, chamber, tubes, and LEDs.
- Measure or inspect highlight clipping and the relative luminance of LED cores, metal housing, letter faces, recesses, and floor. This identifies whether the washout originates in scene lighting/PBR, environment reflections, bloom, tone mapping, or a combination.
- Use the target as a *directional visual reference*, not a literal pixel-difference target, until camera, aspect ratio, and animation state are aligned.

### 2. Make the projected 3D wordmark faithful to the master SVG

- Render an unlit, front-on orthographic silhouette of the generated wordmark with bloom, outline emission, shadows, and perspective disabled. Overlay it on a rasterization of the attached SVG at the same viewBox and scale, comparing each of the eight body paths, counters, lower sweeps, four-point symbol, and outer ring separately.
- If contour mismatch is measurable, adjust the SVG-to-mesh conversion in [`cinema2-svg-relief-kit.mjs`](../scripts/cinema2-assets/cinema2-svg-relief-kit.mjs) and the wordmark generator: sample Bézier curves to a bounded geometric error, preserve the SVG's even-odd holes, and keep the visible front-face contour on the source path. Do not redraw, mirror, or substitute letter shapes by eye.
- Tune bevel width and extrusion depth *behind/inside* that front silhouette so the 3D treatment does not swell strokes, close counters, blunt the lower flourish, or distort the four-point symbol. Keep the dark plate and lit rim visually outside the white letter fill.
- Regenerate the wordmark GLB and its shared attachment layout, then regenerate/check the tube GLB so all four sockets still meet the new silhouette without covering a letter. Add automated source-hash/path, contour, and asset-generation checks; use an image overlay as the final visual gate.

### 3. Rebuild chamber and tube tonal separation at the material/light level

- In [`Cinema2ConduitPreset.ts`](../src/components/vyzualz/cinema2/presets/Cinema2ConduitPreset.ts), lower the environment contribution and front-facing wash on the large `shell`, `hull`, `steel`, `iris`, and tube-housing surfaces. Retain selective chrome highlights, but give raised metal a midtone and recessed tracks/panels a clearly darker value.
- Tune roughness/metalness and the studio reflection panels so the tubes read as curved reflective objects instead of pale lines against a pale wall. Revisit the chamber geometry's material assignments only where a supposedly recessed area still renders as a broad bright surface.
- Rebalance wall washes, ambient fill, and the logo key light instead of lowering the whole image with global exposure. Preserve shadow depth and local highlight detail on the radial wall and tube couplers.
- Check quality-tier light selection: the runtime keeps only the **first two non-ambient lights on low**, and CONDUIT currently lists both wall washes before its logo key. If low quality reproduces the weak wordmark, reprioritize or provide a cheaper logo-facing fill so the logo remains dimensional at every tier, while keeping wall illumination symmetrical.

### 4. Give the DVYDRM letters a distinct foreground hierarchy

- Keep the SVG-derived letter faces pearl-white, but reduce flat, uniform illumination and overly broad clearcoat/environment reflections. Use a controlled key and fill to reveal the bevel and a gentle face gradient without clipping the faces to white.
- Keep sidewalls, counters, backing plate, and the space immediately behind the mark sufficiently dark and warm for the face contour and internal shapes to separate. Preserve useful contact and cast shadows from the extruded letters; avoid a bright wall hotspot directly behind the mark.
- Narrow or dim only the glow that intrudes onto letter faces. The outer perimeter may stay luminous, but it must not visually thicken the letters or obscure the SVG's small cusps and four-point symbol.
- Judge readability both at the full 16:9 output and at the actual smaller Stage size, including the all-LEDs-on state.

### 5. Restore the LEDs as the focal light source

- Keep the tube windows, logo perimeter, and chamber bars linked to the existing Energy Color/music system. Tune their emissive core and adjacent dark channels as a pair, so the apparent gain comes from contrast as well as light intensity.
- Give lit segments a compact warm-white core with an orange/amber falloff and restrained local spill on nearby metal. Avoid using broad bloom or extra wall light to fake brighter LEDs; those approaches recreate the current washout.
- Tune the segment pattern's resting brightness and full-energy peaks independently. Verify visible paths through all four tubes and across the logo in steady, pulse, and color-change states; do not make the production look depend on one lucky animation frame.
- Reassess the LED geometry and channel depth only if light/material changes cannot match the target's apparent tube thickness and luminous surface area.

### 6. Finish the floor, grade, framing, and acceptance checks

- Give the reflective floor a darker, cooler metallic base and controlled rough reflection/streaks, with localized warm pools beneath active LEDs. Keep the large foreground from becoming a flat cream slab or a noisy mirror of the whole logo.
- After the scene and emitters are balanced, tune HDR bloom threshold/knee/spread, haze, tone mapping, contrast, and color temperature. Preserve detail in the white letters and metal while allowing LED peaks to glow. Treat global exposure as the last, small adjustment.
- Match the target's 16:9 composition and breathing room; then verify the narrower Stage separately so tube flanges, logo edges, and floor are not accidentally cropped or made too small.
- Run asset generation and validation tests, focused Cinema 2.0 tests, and a real-browser render check at each quality tier. Review side-by-side captures with the requester before calling the visual match production-ready.

## Acceptance criteria

1. A front-on unlit silhouette of the wordmark follows the supplied master SVG's body paths, counters, lower sweeps, symbol, and outer ring with no visible overlay discrepancy at the master SVG's native resolution; any remaining anti-aliasing tolerance is documented. The SVG—not image 2—is authoritative for the contour.
2. At rest and at full energy, the DVYDRM letters are immediately readable against their backing, and all four tube-to-logo contacts remain clear of the letter faces.
3. Lit tube, logo, and wall segments are visibly brighter than their adjacent housings, with a common controllable hue; neither the chamber nor the floor becomes a larger white highlight than the emitters.
4. Bright metal and pearl letter faces retain visible bevel/shadow detail, dark recesses remain distinct, and bloom does not merge neighboring components.
5. The composition works at 16:9 and in the narrower app Stage, with no low-quality regression in logo illumination or 3D loading. Final sign-off requires direct comparison to the desired image, not test results alone.
