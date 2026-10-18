# DVYDRM Theater · Cinema 2.0 Visual Validation Package

**Baseline:** 2026-10-18  
**Current review state:** **NOT YET VISUALLY APPROVED** (procedural 3D asset is structurally present, but does not yet match the cleaned reference closely enough).  
**Purpose:** provide Codex/Claude Code with a reference-locked, actionable QA plan for the GLB, future Blender-built `.blend`, and integrated Cinema 2.0 preset. This is a validation baseline, **not a claim that all tests have passed**.

## Read these PNGs first

1. **`DVYDRM_Visual_Validation_Comparison.png`**: side-by-side, *unaltered* approved cleaned image and existing GLB-render preview, with numbered findings and severity.
2. **`DVYDRM_Reference_Zones_and_Text_Contract.png`**: mapped theater zones A–H, three distinct sign faces, and the independent text replacement contract.

The images use *original, differently framed captures*, so this is **visual/structural comparison, not pixel-diff or equal-camera proof**. Don't cite a numerical image-similarity score from this package.

## Verified source files and integrity

| Asset | Source file | Dimensions / format | SHA-256 |
|---|---|---|---|
| Reference | `art_deco_theater_marquee_at_night.png` | 1448×1086 | `e838e6ec783f741a6f469a6abe0cd08b82718a962a1401e01ad69dbf980ae73a` |
| GLB model preview | `DVYDRM_Cinema2_Theater_Model_Preview.png` | 1440×820 | `c6acef4a76a58bddb366ab4a7fd8a5369e141bc2ed8bd599ba0c45dfeca79ddc` |
| GLB 3D source | `DVYDRM_Cinema2_Theater.glb` | glTF 2.0 GLB | `746cedbf0d6ee1e8ad2e308975d2ca5b55e47ee4d0c5dd6b88fb2dd5b85541ed` |


The approved cleaned reference is the **visual authority** for building proportions, three visible sign faces, marquee massing, rounded Art Deco neon, canopy underside, bulbs, curtain, door glazing, and warm night lighting. The SVG blueprint and GLB manifest are **implementation aids**, not automatically proof of visual fidelity.

## Automated asset inspection (verified without Blender)

Read directly from the existing `DVYDRM_Cinema2_Theater.glb` JSON chunk:

| Inspection | Result | Status |
|---|---:|---|
| glTF 2.0 GLB header | Valid signature, version 2 | **Pass** |
| GLB scene nodes | **1,833** | **Present** |
| GLB meshes / materials | **43 / 31** | **Present** |
| GLB cameras | **4** | **Present** |
| GLB embedded animations | **0** | **Not present** (host-side animation is still required) |
| Individual canopy bulb nodes | **718** | **Present** |
| Individual marquee-trim bulb nodes | **216** | **Present** |
| Individual tower bulb nodes | **152** | **Present** |
| Left / right LED cell nodes | **160 / 160** | **Present** |
| Total named bulb + LED fixtures | **1,406** | **Present** |
| `marquee.front.TEXT_SURFACE` | Exactly 1 | **Pass: named node exists** |
| `marquee.left.TEXT_SURFACE` | Exactly 1 | **Pass: named node exists** |
| `marquee.right.TEXT_SURFACE` | Exactly 1 | **Pass: named node exists** |
| Runtime-editable sign text | Not embedded in GLB | **Not tested / host integration required** |
| Native Blender `.blend` render | Blender unavailable here | **Not tested** |
| Live WebGL / GPU appearance | Not executed in a real GPU browser here | **Not tested** |
| Audio Intelligence, patterns, Trigger toggle/dropdown | Not embedded in GLB | **Not tested / host integration required** |

**Nuance:** the glTF node names allow objects to be *addressed*. The presence of thousands of fixture nodes does **not**, by itself, prove separately animated per-fixture light output. Shared emissive materials may need cloning, per-instance shader attributes, or a dedicated light-choreography layer in Cinema 2.0. The emissive mesh is not equivalent to a real point light. Check performance with emissive materials + selective light sources and bloom.

## Actual geometry/visual issues to fix

Priority P0 = must resolve for acceptable reference fidelity; P1 = substantially improves fidelity; P2 = optional polish.

| ID | Priority | Observation based on the two included images | Acceptance criteria |
|---|---|---|---|
| V01 | **P0** | Reference: clearly exposed canopy underside with long radial/parallel rows of bulbs. Current model preview: underside is almost completely hidden. | Use a matching low-enough hero camera and/or adjust canopy geometry so the underside, deep projection, and many bulb rows are unmistakable while preserving entrance visibility. |
| V02 | **P0** | Reference: large, layered, rounded, glowing red/orange/blue Art Deco crown in front of a curtain. Model: much smaller, thin, angular wire-like lines. | Rebuild crown as thick curved/stepped dimensional elements with distinct red, amber, blue illuminated sections, correct overlaps, and silhouette. |
| V03 | **P0** | Reference: marquee dominates composition with strongly visible three-sided depth and dramatic side projection. Model: sign reads flatter and less dominant; framing is wider and higher. | Align world/camera framing and scale to reference silhouette; both left and right faces remain fully visible and obviously angled, with canopy depth and upper facade retained. |
| V04 | **P1** | Reference: warm see-through lobby and side windows with visible framed posters, reflective glass, door depth. Model: simplified poster panels and relatively opaque dark doorway. | Add glazed reflections, believable lobby depth and lighting, poster display/recesses, believable dark green frames and door pulls. |
| V05 | **P1** | Reference: shiny wet roadway has vivid orange/red/blue reflections and streaks. Model: large matte-looking tiled forecourt dominates lower image. | Separate sidewalk from dark wet road; add a reflective material layer and image-matched colorful stretched light reflections without mirror-like exaggeration. |
| V06 | **P1** | Reference: bright edge trim, warm facade washes, strong red neon emission and bloom. Model: weaker, more diffuse lighting and flat wall/roof shading. | Add restrained bloom and bounced warm washes, preserve readable signage, and maintain night contrast. |
| V07 | **P1** | Reference lettering is crisp with substantial dark outlines/bevels on center face. Existing 3D preview has relatively flat red text. | Use real generated runtime typography or native mesh/texture letterforms with correct face-specific treatment, baseline, stroke, and spacing. No baked/fused letter geometry. |
| V08 | **P2** | Curtain material has smaller-scale vertical folds than the reference; facade brick/stone ornament are simplified. | Refine curtain folds, surface roughness, brick orientation/scale, and decorative corner elements if performance permits. |

## Runtime behavior acceptance contract: editable marquee signs (critical)

**Authoritative glTF node IDs** (all present in source):

- FRONT: `marquee.front.TEXT_SURFACE` — default `DVYDRM`, outward normal +Z.
- LEFT: `marquee.left.TEXT_SURFACE` — default `SHOWINGS`, outward normal approximately (-0.683, 0, +0.730).
- RIGHT: `marquee.right.TEXT_SURFACE` — default `SHOWINGS`, outward normal approximately (+0.683, 0, +0.730).

Each face is a UV-mapped geometry surface with a **distinct texture material** in the GLB. Recommended runtime text method: clone the face-specific material (so changing one sign cannot update the others), create a canvas/atlas texture with visible text, update only that face, and preserve the panel border/bulb objects. Supplied source sign textures use **2048×440** pixel canvases. Confirm `flipY=false` for Three.js CanvasTexture on glTF UVs where applicable; visually validate rather than hardcoding it without testing.

| Test ID | Procedure | Pass condition | Result |
|---|---|---|---|
| T01 | Enter `FRONT TEST` on front face only. | Front reads precisely `FRONT TEST`. Both side faces retain `SHOWINGS`. | ☐ Not run |
| T02 | Enter `LEFT TEST` on left face only. | Left reads precisely `LEFT TEST`. Front remains `DVYDRM`, right remains `SHOWINGS`. | ☐ Not run |
| T03 | Enter `RIGHT TEST` on right face only. | Right reads precisely `RIGHT TEST`. Other two faces unchanged. | ☐ Not run |
| T04 | Enter 1 character, then 12 characters, then 24 characters, per face. | Auto-fit, wrap, or intentionally documented max-length treatment keeps text centered and fully inside letterboard boundaries, never cuts through bulbs/trim. | ☐ Not run |
| T05 | Test mixed case, digits, spaces, punctuation, and blank value. | Consistent font, no unsupported glyph artifacts; blank value follows defined behavior. | ☐ Not run |
| T06 | Swing cameras to left/right 3/4 and closeup; move lights. | Text stays legible, correctly oriented (not mirrored), z-fighting-free, and attached to its own physical sign face. | ☐ Not run |
| T07 | Trigger beat, build, drop, and change patterns. | Only lighting/emission choreography changes; text values persist until the user explicitly edits them. | ☐ Not run |
| T08 | Reload preset / seek / restart / pause-resume and update text again. | Text controls and face-specific materials remain valid; no stale references or shared updates. | ☐ Not run |

**Blender-only nuance:** the `.py` builder creates separate FONT objects `C2_TEXT_FRONT_EDITABLE`, `C2_TEXT_LEFT_EDITABLE`, and `C2_TEXT_RIGHT_EDITABLE`. The Blender FONT objects are for native editing/look development; browser runtime cannot directly modify Blender FONT objects. The WebGL preset must update the preserved three `*.TEXT_SURFACE` meshes.

## Camera and reference-view acceptance

Recommended capture names (render **one complete set** for a single release candidate):

| Capture | Required view | What reviewer checks |
|---|---|---|
| `CAM_01_front_hero_16x9.png` | Front hero 16:9 | Crown and top present, marquee fills frame, canopy underside visible, entrance fits, no cut-off text. |
| `CAM_02_left_three_quarter.png` | 30–40° camera toward model's left side | Correct outward-facing LEFT letterboard, marquee depth, side bulbs and canopy rows. |
| `CAM_03_right_three_quarter.png` | 30–40° camera toward model's right side | Correct outward-facing RIGHT letterboard and mirrored architectural balance. |
| `CAM_04_marquee_closeup.png` | Sign detail closeup | Typography readability, discrete trim lamps, layered sign construction, no coplanar flicker. |
| `CAM_05_low_angle.png` | Under-canopy low angle | Bulb rows are clearly visible; canopy has depth, no floating light bulbs. |
| `CAM_06_neon_crown_closeup.png` | Curtain, crown, blue strip detail | Thick smooth neon geometry, stepped profiles, glow containment, no missing material. |

**Capture comparability:** use the same aspect ratio and deliberate camera matching before computing side-by-side similarity. Save exposure/tone mapping/bloom settings alongside the captures. Do not upsample a low-res preview and call it a final render.

## Lighting behavior + audio validation matrix (Cinema 2.0, not proven by GLB)

| Zone | Required visual behavior | Suggested signal / choreography validation |
|---|---|---|
| Canopy (718 fixture nodes) | Distinct row or sequential bulb waves, ambient base distinct from kick surge | Kick/downbeat/sub/drop; static silence and rapid transients |
| Marquee trim (216 fixture nodes) | Perimeter chase, left/right sweep, independent corner accents | Beat, bar, phrase, drop |
| Towers (152 fixture nodes) | Large white bulbs pulse separately from trim | Snare, bar, drop |
| Entry LEDs (160 nodes on each side) | Left/right independence, equal layout, no unintended mirroring | Mid/energy/transient and manual overrides |
| Crown neon | Red/amber/blue channels separately dimmable | Build progress, drop, phrase |
| Sign text | Readable above nearby emissive bulb/neon brightness | Compare quiet, build, drop, blackout modes |

*Source GLB uses **4 embedded cameras** and **0 embedded animation channels**. Blender builder separately proposes **5 cameras** and demo timeline animation, but the builder has not been run/validated in Blender in this environment.*

### Required preset controls (integrated contract check)

- [ ] Pattern dropdown with **at least 6** theater-specific patterns (not a generic placeholder set).
- [ ] Pattern Change toggle, same semantics as existing Cinema 2.0 presets.
- [ ] Trigger dropdown, same available trigger choices/behavior as existing Cinema 2.0 presets.
- [ ] Manual pattern persists until next trigger even if Pattern Change is ON; verify per your accepted contract.
- [ ] Auto Performance may temporarily override patterns during builds/drops, then restore deterministic manual behavior.
- [ ] Audio delivery tested on play/pause/seek/restart/loop, including duplicate-drop prevention.
- [ ] Master Intensity, individual lighting groups, bloom and lighting limiter remain responsive.
- [ ] All three sign fields are visible/editable independently in the Inspector with persistence.

No claim is made that the GLB or Blender builder alone provides these runtime controls.

## Suggested non-negotiable pass gate

**Do not mark this preset visually approved** until V01–V03 are fixed and CAM_01 through CAM_05 are provided from the **actual integrated scene**, not from a mockup. Treat V04–V07 as strong reference-fidelity requirements for a final polish pass. The sign behavior T01–T08 and the complete integrated pattern/trigger checklist require separate pass/fail evidence from Cinema 2.0.

### Practical acceptance order for Codex / Claude Code

1. Lock the cleaned image as the source of truth; keep it unchanged.
2. Match camera and rough geometry silhouette first: V01–V03. Capture front/side/low-angle evidence.
3. Restore architectural materials and lighting: V04–V08. Capture bloom-off and bloom-on stills to detect oversaturation.
4. Implement and test three independent editable sign surfaces (T01–T08). Use exact node names.
5. Implement and exercise at least six theater-specific choreography patterns and inherited Pattern Change / Trigger controls.
6. Run runtime performance test at 1920×1080 over a sustained playback period; test renderer fallback and GPU load. Set an explicit FPS budget agreed for the target hardware (avoid invented universal performance thresholds).
7. Attach screenshots and a filled QA checklist; fail rather than silently accepting deviations.

## Important limitations

- **No Blender render was performed here.** The existing model preview supplied alongside the earlier GLB was used for visual observations, and must not be mislabeled as the output of the later Blender scene-builder.
- Visual gaps are judgments based on the supplied two PNGs; no camera-normalized pixel similarity score, ray tracing, animation behavior test, or engine code audit was completed.
- GLB signatures, node counts, naming, and three independent materials are verifiable from the file, but live text editing, effects, patterns, routing, point lighting, and performance require host execution.
- Source image is AI-refined concept art, not a real surveyed building. Blueprint scene units are arbitrary (X right, Y up, +Z toward street) and are not real-life meters.

## Source relationships

- Original source image: `art_deco_theater_marquee_at_night.png`
- Existing preview: `DVYDRM_Cinema2_Theater_Model_Preview.png`
- Mesh: `DVYDRM_Cinema2_Theater.glb`
- Plan: `DVYDRM_Cinema2_Theater_Geometry_Blueprint.svg`
- Blender builder: `DVYDRM_Cinema2_Theater_Blender_Builder.py`
- Manifest: `Cinema2_Theater_Node_Manifest.json`

The ZIP includes the two validation sheets, this document, and the two image sources to keep the visual comparison reproducible. The GLB and builder are referenced by name but not duplicated in this lightweight QA ZIP.
