# 01. CANOPY Visual and Geometry Specification

## Visual identity (author this before Audio Intelligence)

A black, understated concert-installation space contains an 8×8 field of suspended luminous rods. The viewer sees underside surfaces and deep rows. No visible foreground clutter. The rods hang from a faint overhead mounting grid, with a short solid mount/cap at their tops and a uniformly thin luminous diffuser along each rod's lower length. Alternate rows/columns may carry a subtle secondary hue; musical accents temporarily pick out selected groups. Background remains dark but visible as a distinct user-settable color.

**Mandatory qualities**: spatial repetition, recognizable overhead suspension, parallax between front and rear banks, legible rod lengths and elevations, disciplined beams of light without lasers, clean silhouettes with effects OFF, no crowd of many independently simulated physical spotlights.

**Proposed default hero frame:** perspective three-quarter view from below, showing all 64 rods without cropped edges; enough variation in length/height to convey a hanging sculptural light canopy. Artistic intention resembles Canopy in earlier conversation, not the Marquee theater's bulbs of the same name.

## Coordinate contract (proposed, finalize with captures)

| Choice | CANOPY contract |
|---|---|
| Render space | World-space, right-handed as used by current Cinema 2.0 world-camera modules; confirm axis/sign conventions in Depth before coding |
| Local origin | Array centered around `(0, 0, 0)` on X/Z plane; Y positive up |
| Rod count | Default 8 rows × 8 columns = 64 fixtures; adjustable 4–12 per axis subject to **max 144 total** |
| Arrangement | Centers `x=(col-(cols-1)/2)×xSpacing`, `z=(row-(rows-1)/2)×zSpacing`; stable row-major fixture ID |
| Spacing | Proposed X/Z 0.85–1.45 world units; defaults X=1.08, Z=1.0 |
| Suspension | Rod top cap/anchor from an overhead mounting plane near Y=4.6; roots fixed; rod bodies below |
| Length | Default 1.45 units, configurable 0.6–2.1; all modifications clamped to avoid floor/camera collision |
| Shape | Narrow cuboid or low-segment cylinder diffuser, dark top cap, tiny overhead attachment point; skip physical strings unless visually necessary |
| Position | Default lower tips above an authored minimum safety Y; rod height offsets ±0.55 units from baseline, with clamping |
| Emission | One per-instance intensity/color, with distinct lit diffuser and dim physical body; color roles map to different groups/treatments |
| Scale | Form remains centered and fully framed at supported aspect ratios; adjust camera distance/FOV within bounded policy, not dynamically distort geometry |
| Z/depth | Real depth with depth attachment, stable back/front occlusion; rear rods must not hide the entire front layer |
| Clip policy | No rod tip, mounting cap or effect source intersects the near plane or leaves approved safe frame bounds during authorized motion |
| Lighting | Emissive per-instance rods; at most 1–3 shared area/point-style scene lights if needed, under 12 non-ambient engine light budget |

Numbers are **starting art-direction settings**, not claims about proven production camera bounds. Final values require Phase 2/3 captures.

## Suggested authored camera

Single stable perspective camera at approximately `(7.5, 2.5, 13.5)` aiming at `(0, 2.7, 0)`, FOV roughly 46–52°, near 0.1 and far 100. Confirm composition with the current camera convention and production stage; refine based on screen-safe width and rod legibility. Optional gentle orbit is a **late-phase enhancement** with minimal amplitude, 100% disableable by a user Camera Motion toggle. Camera should not fly through fixtures.

## Static state and idle behavior

- No track: visually appealing at rest, rods static in a mild sculpture (slight deterministic row/column length variations), 20–35% of authored light output; no false beat/kick pulse.
- Paused: freeze time-based choreography and do not keep consuming queued event identities; show stable frame.
- Playing: evolving heights and addressed light, with clear difference from idle.
- Audio unavailable: optional subdued free-running motion **only if explicitly allowed by idle setting**; do not pretend to have analyzed musical cues.
- Song changed/re-entry: clean reset to authored pattern, predictable per-fixture arrangement and no stale glow/envelopes.

## Structural components and targetable geometry

Every rod gets a stable address `(row, column, index)`. Expose **aggregate choreography channels through the module target/value resolver** and interpret them over indexed geometry:

- `array.heightOffset`: resolved, bounded added lift to participating rods.
- `array.lengthScale`: resolved, bounded length change.
- `array.tiltAmount`: optional bounded visual tilt, **only after** length and lift are correct.
- `array.emissionPulse`: transient intensity, not a permanent color rewrite.
- `array.wavePhase`: synchronized/free-run procedural pattern phase.
- `array.buildCompression`: temporary vertical/lateral visual concentration.
- `array.dropRelease`: temporary expanded movement/lighting envelope.
- `array.vocalRestraint`: reduces visual occupancy/emission without disabling authored lamps.

Do **not** expose 64–144 individual Inspector sliders. Address fixtures procedurally inside the native module using these resolved channels, fixture coordinates and current Pattern. If addressable row/bank target IDs are practical within existing generic targets, document them and test binding; don't invent a new target-kind schema.

## Appearance constraints / performance targets

- Default 64 fixtures, ≤144 optional high-density fixtures (adjust down for actual production-tier budgets).
- One or very few instanced draw batches (diffusers, optional caps); avoid 64 separate shaders or 64 lights.
- Reuse GPU geometry and CPU-side preallocated instance buffers; update a compact transform/emission buffer per frame without unbounded allocations.
- Use the current render target, camera matrices and engine resource lifetime. Declare GPU estimate with `resources.reportGpuBytes`.
- Emissive brightness stays legible with bloom OFF; use a restrained engine HDR bloom pass if added.
- No GLB/GLTF/model manifest needed in MVP. If art direction later demands a high-fidelity fixture, treat it as **separate optional scope** with asset attribution/budget gates.

## Reference acceptance shots

1. **Hero idle, 16:9:** rod count, mounting origin, depth and clean light shape unmistakable.
2. **Hero idle, 9:16:** no geometry clipping or black/empty frame.
3. **Pattern extremes:** six side-by-side captures at identical camera/exposure/time to validate distinct geometry.
4. **Motion filmstrip:** 4+ frames on steady rhythm with measurable rod-position changes.
5. **Build / drop before-after:** clear height compression and physical release; not just brighter lights.
6. **Bloom OFF/ON:** geometry remains legible OFF; ON improves mood without washing out edges.
7. **Full dark controls:** user hard-disabled motion/effect does not get re-enabled by automation.

## Product acceptance question

Before moving past static geometry, a human reviewer must be able to answer: **"Does this unmistakably look like an array of suspended physical LED rods, with useful depth and strong composition, before music or effects?"** If not, do not proceed to more audio logic.
