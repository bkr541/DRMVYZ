# 01. LIGHTFIELD visual, coordinate and geometry contract

## Authored hero composition

A slightly elevated, forward-looking camera surveys a dark **square grid floor** of thick, nearly black square tiles. Each tile has a matte physical base, a recessed luminous top panel and a narrow readable border/seam. Most of the scene is negative space. Choreography passes through the floor as controlled waves of **actual height/tilt changes plus independently colored light**, making the grid resemble a kinetic stage installation rather than a flat checkerboard image. The floor must remain legible with bloom OFF.

- **World axes:** X = left/right, Y = up (tile normal), Z = front/back. Default grid centered at world origin, row-major stable IDs `r0c0 … r7c7`. Define front/back Z direction once; camera and motion patterns must agree on it.
- **Default topology:** 8 rows × 8 columns, 64 tiles, configurable 4–12 each, hard cap 144. For an M×N layout, center positions `x=(c-(N-1)/2)*(tileWidth+gap)`, `z=(r-(M-1)/2)*(tileWidth+gap)` with signs chosen consistently. Use deterministic index `r*N+c`.
- **Suggested proportions:** tileWidth 0.78 world units (range 0.55–0.95), gap 0.10 (0.05–0.20), physical slab thickness 0.12 (0.08–0.22), inset luminous top 0.64–0.74 proportional to tileWidth; baseline body y=0.0; border thickness must remain visible at portrait/square aspect.
- **Movement:** per-tile vertical lift up to 0.22 world units and shallow ±7° tilt max; default effective peak at ~0.14. No horizontal tile collision or independent navigation. Preserve visible gaps when tilting; clamp per-tile bounds and top surface intersection.
- **Composition:** perspective view with foreground tiles large enough to perceive edge profiles and rear tiles fading gently in scale. Proposed camera starting region `(0, 6.4, 11.7)` looking toward `(0, 0, -0.3)` and FOV around 42–48°; calibrate in production canvas, not mathematically alone. Camera choice is an authored target, not an existing exported constant.
- **Screen framing:** entire outermost row/column stays within 5–8% pixel padding at 16:9, 1:1 and 9:16, adjusted with aspect-aware camera distance/FOV and no severe depth cutoff.
- **Z/depth:** opaque tile bodies depth-test and write; emissive insets depth-test so rear tiles cannot incorrectly float in front. Bounds/near/far planes must include maximum positive lift/tilt and camera travel.
- **Environment:** dark flat floor/surrounding black; no required mirrored reflections, particles, ceiling, extensive city scenery, text, laser emitters, skybox or texture atlas.

## Draw model and object ownership

For each tile create stable authored state `{id, row, col, basePosition, size, primaryBank, secondaryBank, orientation}`. Render a small number of GPU-instanced batches: opaque slab, emissive inset and optional subtle seam/rim. Dynamic per-instance payload includes transform matrix or TRS, emitted RGB + intensity and bank mask. **No per-tile GL program, WebGL texture, spotlight, React node or physics body.** Rebuild buffers only when topology/dimensions change, not each audio frame; stream compact transform/emissive attributes each frame. Clamping and finite value checks are mandatory.

## Exactly what must remain visible

| Scenario | Expected look |
|---|---|
| Idle / no track | Static calm floor with softly glowing inset panels, distinct matte body and visible grid perspective; optional subtle non-beat drift only when Motion Amount > 0 and specifically authored |
| Pattern selected, bloom disabled | Immediate spatial signature visible through small physical lifts, not solely the color/intensity |
| Quiet music | Sparse, readable motion; no fake constant beat or endless drop |
| Kick | Short, targetable physical lift/luminance pulse; returns smoothly to user base |
| Snare | Alternate/diagonal tile response different from kick |
| Build | Bounded contraction/height tension; doesn't replace user's tile count or authored pattern |
| Drop | A broad outward release or spatial wave within max lift/brightness; not an unbounded strobe |
| Vocal | Temporary restraint in secondary-bank intensity and/or lift amplitude, not a complete scene blackout |
| Master Intensity 0 | No emitted light (tile bodies can remain darkly visible); Auto Performance cannot bypass |
| Motion Amount 0 | All geometry remains still while permitted audio light response still works |

## Color role map (5 proposed, 4 minimum)

1. **Background**: environment/clear/floor behind tiles; changing it does not recolor tile surfaces.
2. **Tile Surface**: opaque body + inset non-emissive base; distinguish with bloom disabled.
3. **Primary Panels**: tile luminous insets in a defined spatial bank, e.g., alternating row/column group A.
4. **Secondary Panels**: bank B independently lit; intentionally visible in baseline; not merely a derived version of Primary.
5. **Accent Hits**: transient rim/outlines or special impact accents, independently changed and intentionally visible when deterministic event fixture plays.

A palette test must simultaneously display Primary, Secondary and Accent in different positions, otherwise apparent independence may be hidden by mutually exclusive masks.

## Motion & safety rules

- Always compute physical placement from immutable base coordinates **plus** a bounded pattern delta and a bounded shared/audio overlay. Never integrate unbounded position on the GPU.
- Default motion profiles should avoid visible intersection and preserve enough tile spacing for high-angle, low-angle and extreme aspect rendering.
- **Geometry-not-just-brightness rule:** six patterns should be distinguishable using the same neutral light color and disabled bloom, with a scrubbed sequence of stills for each.
- Aspect ratio, DPI, resize and quality tier must not alter semantic tile group IDs or pattern definitions; only presentation and cost may change.

## Approval references to capture during P1/P2

- Default hero, 16:9, idle with bloom OFF; 1:1 and 9:16 crops; low-angle tile edge inspection.
- Six 4-frame pattern filmstrips at two representative progress points and maximum safe displacement.
- Independent five-color role test; before/after parameter min/default/max; one example of a real kick and one drop response.
- Human must confirm the result reads as a floor installation and not a particle wall, random checkerboard or TERRAFORM's large rising columns.
