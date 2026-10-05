# ATL HOE: visual-fidelity implementation plan

**Status:** Phases 0–3 implemented. The visual baseline, composition, hero sign, and four landmark towers are complete; city depth and infrastructure begin in Phase 4.

## Goal

Rebuild the `ATL HOE` Cinema 2.0 preset so that its static frame closely matches the supplied nighttime Atlanta reference before adding audio-reactive behavior.

The approved direction is:

- a large, dimensional **WAFFLE HOUSE** roadside sign in the left foreground;
- an Atlanta skyline that recognizably includes **Westin Peachtree Plaza Hotel, Truist Plaza, Promenade II, and Georgia-Pacific Tower**;
- a dense city extending across the frame rather than a small cluster of generic towers;
- cool blue nighttime ambience with controlled warm sign and window light;
- atmospheric depth, layered elevated roads, and a substantial dark tree canopy in the lower-right foreground;
- real 3D geometry and Cinema 2.0 lighting/post-processing, not a flat reference image used as the rendered background.

## Current baseline

The first implementation establishes the production path but falls short visually:

- the scene reads as a stylized low-poly illustration;
- the sign is nearly front-on and lacks cabinet depth, construction detail, and correct lettering;
- the first `W` reads incorrectly and the type is too condensed;
- the sign faces and crowns are overexposed;
- the composition is vertically loose and contains too much empty black space;
- the skyline is sparse, clustered, and only weakly resembles the requested landmarks;
- windows are uniform emissive pixels rather than parts of believable façades;
- the scene lacks cool ambient illumination and useful aerial perspective;
- the freeway and foliage are placeholders;
- the technically 3D scene does not present enough perspective, overlap, or material response to *look* three-dimensional.

The existing prototype remains useful as a registration, rendering, and asset-pipeline foundation. It should be revised in place rather than retained as a competing preset.

## Non-negotiable acceptance rules

1. **Static visual approval comes first.** Do not add audio choreography until the static composition, geometry, materials, and lighting pass the final visual review.
2. **The sign must read `WAFFLE HOUSE` immediately.** No ambiguous glyphs, bloom-obscured strokes, or incorrect letter proportions.
3. **The four named towers must be identifiable by silhouette and façade cues**, not only by their relative positions or window colors.
4. **Warm emitters must retain detail.** Sign faces, letters, bezels, crown tiers, and windows must remain distinguishable at final exposure.
5. **The scene must remain convincingly 3D at rest.** Perspective, visible side faces, overlaps, depth fog, shadowing, and material highlights must communicate depth without requiring camera movement.
6. **The composition must work in both the tall embedded Stage preview and a 16:9 output.** The preview may reveal more vertical scene, but it must not crop the sign text or collapse the intended foreground/background relationship.
7. **Every phase ends with a visual checkpoint.** Passing schema tests alone is not sufficient.

## Reference composition targets

These are visual guides rather than pixel-perfect measurements. They provide a stable target for implementation and review.

| Element | Target |
|---|---|
| Waffle House sign | Occupies roughly the left half of a 16:9 frame; upper-left edge enters near the frame edge; strong oblique perspective exposes the cabinet top and left side. |
| Sign text | Six top cells and five lower cells, with the lower row offset by about one cell; heavy, wide black letters with consistent optical margins. |
| Westin Peachtree Plaza | Left of Truist Plaza; cylindrical glazed body, luminous round crown, thin mast. |
| Truist Plaza | Dominant center-right landmark; tall vertically ribbed body and a detailed stepped golden crown rather than a solid triangle. |
| Promenade II | Right of Truist Plaza; slender stepped massing with restrained cyan horizontal accents. |
| Georgia-Pacific Tower | Farther right; broad, dark stepped slab with recognizable setbacks and limited warm windows. |
| City density | Mid- and low-rise buildings fill the skyline from left to right, with overlapping depth layers. |
| Roads | Multiple elevated decks with perspective, columns, underside depth, and localized sodium pools. |
| Foliage | Large textured silhouette occupying much of the lower-right foreground and overlapping the city. |
| Color | Cool blue sky and ambient fill; warm yellow-orange sign, crown, windows, and street lighting. |

## Phase 0 — Establish a repeatable visual baseline

**Status:** Implemented. Run `npm run test:e2e:cinema2-atl-hoe` to write a unique, git-ignored baseline set under `artifacts/cinema2-atl-hoe-visual-acceptance/`. The harness captures the three named checkpoints below at an exact two-second visual time and verifies duplicate image hashes. An optional development-only overlay can be generated with `--reference=/absolute/path/to/reference.png`; the reference is passed to the browser in memory and is not copied into the preset or repository.

### Purpose

Prevent subjective drift and make every later phase comparable to the same reference.

### Code and tooling work

- Add an ATL HOE visual-acceptance harness that can select the preset and capture stable frames at:
  - 1920×1080 (primary composition);
  - the embedded Stage's tall/narrow aspect ratio;
  - one lower-quality tier for degradation review.
- Hold exposure, render quality, camera state, and time constant during captures.
- Save a small metadata record with camera transform, FOV, aspect policy, effect settings, and asset revision.
- Capture the current prototype as the explicit `before` baseline.
- Add an optional reference-overlay mode to the development harness only. The supplied image must never ship as part of the rendered preset.

### Likely files

- `scripts/run-cinema2-atl-hoe-browser.mjs`
- `src/test/browser/Cinema2AtlHoeVisualAcceptanceBrowserHarness.tsx`
- `src/components/vyzualz/cinema2/__tests__/Cinema2AtlHoePreset.test.ts`

### Exit criteria

- The same code revision produces reproducible captures.
- Both target aspect ratios are reviewed before asset remodeling begins.
- The current visual gaps are represented by named checkpoints rather than memory or ad hoc screenshots.

## Phase 1 — Correct camera, perspective, and large-scale composition

**Status:** Implemented. The sign is now translated into the upper-left foreground and rotated as one rigid assembly to expose cabinet depth; the landmark anchors are spread across the background; and the locked camera uses a 16:9 fit-width policy for narrow Stage previews.

### Issues addressed

- excessive empty space;
- centered horizontal-band composition;
- weak foreground/background scale separation;
- frontal, flattened sign presentation;
- fragile tall-preview framing.

### Implementation

- Recompose the scene in a 16:9 world frame first.
- Move the sign closer to the camera, farther left, higher in frame, and rotate it so its top, left side, and cabinet thickness are visible.
- Set the camera slightly below the sign's center and aim through the gap between the sign and skyline, matching the reference's upward urban viewpoint.
- Re-space the four landmark anchors across the background before remodeling their detail.
- Replace the single hard-coded framing compromise with an aspect-aware camera strategy:
  - preserve the full sign width in the embedded Stage;
  - retain the authored 16:9 composition in output;
  - avoid large unused vertical regions.
- Use temporary landmark proxy volumes during this phase so composition can be approved independently of fine geometry.

### Exit criteria

- The sign occupies the correct foreground scale and is not cropped in either target aspect ratio.
- The skyline fills the background width.
- The image reads as foreground sign, middle-distance roads/buildings, and distant skyline even with flat diagnostic materials.
- No detailed modeling proceeds until this silhouette composition is accepted.

## Phase 2 — Rebuild the Waffle House sign as the hero asset

**Status:** Implemented. The approved 50° oblique assembly now uses purpose-built geometry for every letter, layered illuminated cells, dimensional cabinets and bezels, corner hardware, rear rails, and heavy steel supports. The scene and skyline remain unchanged by this phase.

### Issues addressed

- incorrect `W` and condensed lettering;
- weak panel proportions and optical spacing;
- flat sign presentation;
- missing cabinet, bezel, fastener, and support detail;
- bloom erasing letter and border detail.

### Implementation

- Replace the generic Anton-derived sign lettering with a dedicated in-house letter set authored specifically for the eleven sign cells.
  - Match the reference's wide, heavy block construction.
  - Adjust each glyph optically rather than applying one automatic fit scale.
  - Test the `W`, `A`, `H`, `O`, `U`, and `S` counters at final output size.
- Rebuild each cell with separate geometry for:
  - rear metal cabinet;
  - outer black metal frame;
  - inset yellow face;
  - thin orange/yellow inner border;
  - raised or slightly inset black letter;
  - bevels and corner hardware.
- Give the full sign a structural rear frame, top/bottom rails, cross-members, and heavy angled supports with believable thickness.
- Use physically plausible material separation: painted black metal, slightly rough illuminated acrylic, and non-emissive black lettering.
- Keep the sign face emissive enough to motivate bloom, but make the panel's visible yellow come from material color plus controlled emission—not clipping.
- If needed, split the current monolithic `cinema2-atl-hoe` asset into a dedicated sign asset and city asset so their materials, bounds, and revisions can be inspected independently.

### Likely files

- `scripts/cinema2-assets/generate-atl-hoe.mjs`, or new focused generators under `scripts/cinema2-assets/atl-hoe/`
- `assets/cinema2/cinema2-atl-hoe-sign/asset.json` if the asset is split
- `src/components/vyzualz/cinema2/presets/Cinema2AtlHoePreset.ts`

### Exit criteria

- `WAFFLE HOUSE` is legible without bloom and remains legible with final bloom.
- The first letter is unmistakably `W`.
- Side walls, bevels, panel layers, and supports create clear depth in a static frame.
- The sign alone is a close structural match to the reference before skyline detail is evaluated.

## Phase 3 — Rebuild the four landmark towers

**Status:** Implemented. Westin Peachtree Plaza now has segmented cylindrical glazing and rooftop rings; Truist Plaza has deep ribbed bays and an edged tiered crown; Promenade II has a reflective stepped ziggurat profile; and Georgia-Pacific Tower has broad offset slabs, split setbacks, deep piers, and restrained office lighting.

### Issues addressed

- generic tower silhouettes;
- inaccurate crowns and setbacks;
- weak façade identity;
- uniform, textureless building surfaces.

### Implementation

Model each landmark as a deliberate subassembly with named parts and separate material controls.

#### Westin Peachtree Plaza Hotel

- Build a segmented cylindrical glass façade with visible vertical mullions and alternating dark/lit room bands.
- Rebuild the top as a luminous circular crown with a dark rim and a thin mast.
- Use curved reflections and restrained highlight bands so the body reads as glass rather than a dark cylinder.

#### Truist Plaza

- Add strong vertical façade ribs, recessed window bays, and a darker structural base.
- Replace the solid triangular crown with multiple stepped tiers, each with a dark edge and controlled warm emitter.
- Preserve individual tier silhouettes after bloom.

#### Promenade II

- Rebuild its slender body, progressive upper setbacks, crown geometry, and vertical structure.
- Use cyan accents selectively; they should be façade lights among mostly dark glass, not continuous game-like stripes.

#### Georgia-Pacific Tower

- Model the broad slab, stepped upper massing, and offset volumes that distinguish it from the surrounding generic blocks.
- Keep the building darker and less emissive than the central landmarks.

### Shared façade system

- Replace thousands of identical window boxes with building-specific window modules or emissive façade panels.
- Introduce deterministic variation in floor occupancy, color temperature, intensity, and dark floors.
- Add mullions, spandrels, setbacks, parapets, roof structures, and side-face treatment.
- Use level-of-detail variants if the increased geometry threatens the asset budget.

### Exit criteria

- Each named landmark can be identified from an unlit silhouette capture.
- A lit capture preserves façade structure and crown detail.
- No landmark is identifiable solely because of its window color.
- Landmark placement continues to satisfy Phase 1 framing.

## Phase 4 — Build a dense layered city, roads, and foliage

### Issues addressed

- sparse skyline concentrated on the right;
- placeholder background blocks;
- flat, uniform windows;
- two-strip freeway placeholder;
- small, featureless tree silhouette.

### Implementation

- Create three city depth bands:
  - near mid-rise buildings around the roads;
  - middle-distance towers that overlap the landmarks without hiding them;
  - distant low-contrast silhouettes that close gaps at the horizon.
- Vary building width, height, roofline, façade rhythm, window density, and color temperature by band.
- Build the elevated roadway as multiple perspective-aware decks with edge barriers, beams, columns, ramps, and visible underside structure.
- Add localized warm light pools under the roadway instead of evenly spaced emissive dots.
- Rebuild the lower-right canopy from layered branch and leaf-cluster silhouettes:
  - broad enough to match the reference's large foreground mass;
  - irregular outer contour;
  - multiple depth layers so rim light and haze reveal texture without making it bright.
- Add small foreground occluders and overlapping geometry to reinforce parallax and scale.

### Exit criteria

- No large skyline gaps remain behind the sign or at either edge.
- Buildings become lower-contrast with distance.
- The road has visible depth, support logic, and localized lighting.
- The tree canopy occupies the intended lower-right area and has a readable irregular silhouette.

## Phase 5 — Establish believable materials and lighting

### Issues addressed

- black-and-orange color dominance;
- missing blue ambient illumination;
- weak material distinction;
- emissive surfaces acting like flat colored shapes;
- insufficient shadow and highlight cues.

### Implementation

- Establish a cool blue ambient/night environment before enabling warm emitters.
- Tune materials by role:
  - painted sign metal;
  - yellow acrylic sign faces;
  - black letter faces;
  - glass curtain walls;
  - concrete and stone building structure;
  - steel roadway supports;
  - dark organic foliage.
- Add restrained cool key/fill lighting that reveals building side faces and sign construction.
- Use a limited number of warm practical lights near the sign and roads to motivate local spill.
- Enable targeted shadows for the sign letters, frame, supports, and the most important building recesses within Cinema 2.0's shadow budget.
- Tune environment reflections per part instead of applying one broad reflection value to the entire city.
- Confirm that emission is not being used to compensate for missing diffuse or specular lighting.

### Exit criteria

- A grayscale capture still separates sign, glass, concrete, metal, roads, and foliage.
- The dark sides of buildings remain visible against the sky.
- Warm light is localized and the scene's overall balance remains cool.
- Sign faces, crown tiers, and windows retain shape at final exposure.

## Phase 6 — Rebuild atmosphere and post-processing around depth

### Issues addressed

- mostly black sky;
- localized orange halos instead of aerial perspective;
- weak distance separation;
- excessive bloom and clipped highlights.

### Implementation

- Create a blue sky gradient or geometry-backed night dome with restrained stars; avoid a flat black background.
- Use depth fog to desaturate and soften distant buildings progressively.
- Add low, warm city haze near the horizon and road level while keeping upper atmosphere cool.
- Reduce volumetric beam contribution unless a visible practical light justifies it.
- Retune HDR bloom after all emissions are finalized:
  - higher threshold;
  - tighter radius;
  - lower intensity;
  - no joining of neighboring sign cells or crown tiers.
- Retune cinematic finish for the reference's cooler shadows, controlled golden highlights, and mild vignette.
- Verify exposure with highlight diagnostics so the sign and crowns do not clip into undifferentiated yellow-white.

### Exit criteria

- The skyline has obvious near/middle/far depth separation.
- The sky reads as deep blue rather than black.
- Golden light softly occupies the lower city without tinting the entire frame orange.
- Letter edges, panel borders, windows, and crown tiers remain crisp through bloom.

## Phase 7 — Quality tiers, performance, and final visual acceptance

### Issues addressed

- risk that improved fidelity only works at one aspect ratio or quality level;
- risk of asset or frame-time regression;
- lack of a formal visual sign-off boundary.

### Implementation

- Create high, medium, and low model variants where geometry or window density requires them.
- Measure triangle counts, shipped size, GPU memory, and frame time against Cinema 2.0 budgets.
- Validate the production render graph for failed passes, failed module nodes, and resource leaks.
- Capture final frames for:
  - 1920×1080 high quality;
  - embedded Stage aspect high quality;
  - 1920×1080 medium quality;
  - a no-bloom diagnostic frame;
  - an unlit silhouette diagnostic frame.
- Compare the final 16:9 frame with the owner reference using an overlay and a side-by-side contact sheet.
- Record remaining deviations honestly in this document rather than masking them with heavier bloom or haze.

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

## Phase 8 — Audio-reactive routing, only after static approval

This phase is intentionally deferred. It must not be used to distract from or compensate for missing static fidelity.

Potential restrained routes after approval:

- bass energy gently lifts sign and street-light spill without changing letter contrast;
- downbeats produce a small crown/window brightness swell;
- musical intensity adjusts city-window occupancy or haze within narrow bounds;
- camera drift or parallax remains subtle and can be reduced to zero;
- no beat behavior changes the landmark silhouettes, sign wording, or approved composition.

Audio behavior requires its own owner review and acceptance criteria when this phase begins.

## Issue-to-phase map

| Finding | Owning phase |
|---|---:|
| Low-poly, illustrative appearance | 2, 3, 4, 5 |
| Flat sign and weak perspective | 1, 2 |
| Incorrect `W` and condensed typography | 2 |
| Sign and crown overexposure | 5, 6 |
| Excess empty space and centered composition | 1 |
| Weak static depth cues | 1, 4, 5, 6 |
| Sparse, right-clustered skyline | 1, 4 |
| Inaccurate landmark identities | 3 |
| Black/orange rather than blue/gold balance | 5, 6 |
| Haze behaving as orange glow | 6 |
| Uniform pixel windows | 3, 4 |
| Placeholder freeway | 4 |
| Inadequate foliage | 4 |
| Missing material distinction | 2, 3, 4, 5 |
| Tall-preview framing weakness | 0, 1, 7 |

## Recommended execution order

Execute the phases strictly in this order:

1. baseline harness;
2. silhouette composition and camera;
3. hero sign;
4. landmark towers;
5. city/roads/foliage;
6. materials and lighting;
7. atmosphere and finish;
8. quality/performance/final static approval;
9. audio reactivity.

This order prevents expensive detailed assets from being authored against the wrong camera, and prevents post-processing from hiding unresolved geometry or lighting problems.

## Definition of complete

ATL HOE's static environment is complete only when:

- the visual hierarchy matches the supplied reference at 16:9;
- `WAFFLE HOUSE` is crisp, correctly shaped, and structurally convincing;
- the four named Atlanta landmarks are recognizable;
- the city is dense and layered across the whole frame;
- the freeway and tree canopy contribute meaningful foreground depth;
- the night is cool blue with controlled golden practical light;
- haze separates distance rather than washing the scene orange;
- the embedded Stage and output framing both work;
- focused tests, asset checks, browser rendering, and performance checks pass;
- the owner explicitly approves the static frame before Phase 8 begins.
