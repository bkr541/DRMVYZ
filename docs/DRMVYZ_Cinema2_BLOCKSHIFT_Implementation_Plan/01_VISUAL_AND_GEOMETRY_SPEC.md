# 01. Visual, Geometry, Camera and Motion Specification

**Latest user refinement (2026-10-23):** [Size, atmosphere and rotation revision](27_LARGER_CUBES_ATMOSPHERE_ROTATION.md) supersedes the older size ceiling/global clearance: Block Size 1.05–6.00; stable local radial clearance; finite field radius 600, far plane 840; brighter LEDs with shared Threshold atmosphere and optional full-axis cube spin. Camera position/FOV and the surrounding-field composition remain.

**User-directed LED revision:** Colored frame geometry on both supplied models is now an LED bar housing/diffuser surface with segmented self-emission and shared geometry/audio choreography. Original triangles, object scale and surrounding composition are preserved. See [LED bar construction and evidence](26_LED_BAR_CHOREOGRAPHY.md); earlier flat frame material captures are historical.

**Current count revision:** [Fifteen-cube field](22_FIFTEEN_CUBE_FIELD.md) supersedes every older nine-object limit below at the user's request. Fourteen Hallow Cubes plus one Impossible Cube; camera position, block scale, spacing controls and observer-centered framing remain.

**Authoritative visual revision — 2026-10-22:** The user wants the observer **inside** a spacious cube field, with massive nearby geometry on all sides. [Immersive field revision](19_IMMERSIVE_FIELD_REVISION.md) supersedes the older distant installation, camera, size/spread limits and all-nine-in-frame rules below. Preserve this surrounding-space concept in subsequent phases.


**Historical size checkpoint:** [Size correction](17_BLOCK_SIZE_CORRECTION.md) records an intermediate revision. The current immersive revision uses Size 1.05–3.00 at 6× physical scale; Phase 4 adds a 300-unit pose envelope, 2.5-unit observer exclusion and basic bounded camera float. See [the P4 report](20_P4_MOTION_AND_FLOATING_CAMERA_REPORT.md).


**2026-10-22 user-directed geometry revision:** The supplied `docs/BLOCKSHIFT/hallow_cube.glb` and `impossible_cube.glb` replace the procedural solid-box/twelve-rod meshes. Eight surrounding blocks use Hallow Cube; stable center `block-04` uses Impossible Cube. Both are centered and uniformly normalized to a unit bounding box before Block Size is applied. This supersedes the earlier no-imported-assets restriction and exact procedural mesh description. Nine identities, six formations, clearance limits and authored parameter authority remain. See [GLB integration report](16_GLB_OBJECT_INTEGRATION.md).


## Visual identity

**BLOCKSHIFT** is a sculptural 3D grid of **nine floating black geometric blocks**, each with sharply defined, independently colored luminous edges. The background is almost black and the scene's negative space is intentional. The scene should feel like a programmable gallery installation: controlled weight, depth and transformations, not a busy particle wall.

**Golden-frame criterion:** with audio stopped and bloom disabled, the viewer can clearly count the objects, read at least two distinct depth planes, distinguish individual cube faces from edges, and see a deliberate 3/4-camera composition. Audio effects must enhance this, never rescue a failed static geometry.

## Baseline geometry and limits (P1 proposed defaults)

| Property | Proposed initial specification | Rationale |
|---|---|---|
| Block count | **9 stable identities** (`block-00`…`block-08`) | Fixed 3×3 indexed rig avoids mesh rebuild complexity in v1 |
| Shape | Box/prism with dark opaque faces; emissive edge strips/line-prism geometry | Cheap native geometry; readable without glow |
| Nominal cube size | 1.05–1.80 normalized world units (default 1.35; revised in P1), validated in scene-space | Inspector can scale via instance transform |
| Nominal gap | Default about half a block width, with an enforced positive world-space clearance | Visually legible separation and safe reformation |
| Object transforms | Local position x/y/z, yaw/pitch/roll, limited uniform scale, edge emission | Independent choreography targets |
| Rotational movement | Bounded, never full random tumbling; clamp rotation and angular speed | Avoid chaos and intersection artifacts |
| Block surfaces | Opaque/solid, no per-block transparency/refraction | Simplifies sorting and depth |
| Edge material | Two base color bands + accent overlays, HDR emission optionally bloom-composited | Clear color-role differentiation |
| Draw approach | Small number of GPU instance batches (e.g. body + edge geometry), actual `gl.draw*Instanced` subject to renderer | GPU-efficient; no nine unrelated React/WebGL scenes |
| Physical lights | Ambient plus 0–2 subtle local lights recommended; respect 12-light cap | Emission is not a scene light per block |
| Background | Fixed dark gradient/solid scene background; no imported environment | Keeps motion easy to perceive |
| World floor | **Excluded from baseline** | Avoid reflections/shadow complexity and focus on kinetic cubes |
| Default camera | Stable perspective three-quarter composition, near frontal enough to read layouts | Ensure every formation reads as 3D |
| Camera motion | Optional low-amplitude drift or short drop push; hard-disableable | Geometry is the hero |

**Coordinate convention:** Author one clear rig-local right/up/depth coordinate system; choose left-to-right indexed blocks and stable base positions. Calculate transforms in rig local-space and let the engine scene/camera apply world-space matrices. All patterns must share the **same object IDs**, not rebuild/reindex on every pattern switch.

## Geometry-configured choreography ownership

Define a typed `BlockAddress` (stable index + optional row/column/group). Group membership should be derived deterministically, e.g. `leftBank`, `rightBank`, `topRow`, `center`, `alternating`, `nearDepth`, `farDepth`, `outerRing`. Choreography can target (a) whole formation, (b) bank, (c) individual block and (d) edge/accent channels.

Each block instance must have:

- Immutable identity + base dimensions + canonical rig position.
- **Pattern target transform** (selected by pattern and normalized pattern phase).
- **Resolved user base parameters** (spread, size, depth, twist, height amplitude).
- **Transient event envelopes** (kick impulse, snare twist, drop expansion).
- **Continuous audio modulation** (clamped translation, rotation and emission).
- A final, finite transform and color passed once per frame to the native renderer.

Do not use the RenderGraph, React state or Visual Director to directly edit arbitrary GPU instance transforms. Keep a block-to-instance compiler in the native module, driven by resolved engine parameters and choreography targets.

## Transformation composition (strict order)

```text
Immutable block rig and stable ID
  -> chosen six-pattern authored formation (local target transforms)
  -> eased transition from previous formation to current formation
  -> resolved manual geometry parameters (bounded scale/spread/twist)
  -> bounded continuous audio and one-shot event offsets
  -> optional temporary Auto Performance build/drop macro (authorized only)
  -> hard safety clamps / exclusion and camera frustum bounds
  -> GPU instance matrices + body/edge/accent material channels
```

Do **not** simply add offsets until blocks overlap. Apply safety *after* all modulation and validate intermediate transition states; if a candidate path intersects neighboring cubes, reduce travel amplitude, stagger timing, or reroute the path deterministically. No runtime physics engine is needed for these nine IDs.

## Motion/safety guarantees

1. Validate all transforms as finite at every frame; clamp dimensions to positive values.
2. Precompute conservative allowed envelopes per pattern, including transition intermediate states. Use conservative oriented-box approximations or swept checks in unit tests, not hidden real-time collision physics.
3. Preserve a visible separation between cubes in intended hero states. Transient passes may overlap in screen-space perspective, but must not become persistent geometric intersections.
4. Limit rotation speed, z-depth and lateral displacement so the camera does not lose most of the formation.
5. When **Motion Amount = 0**, no automatic physical translation, rotation or camera movement may occur; authored static pattern formations and emissive/audio lighting may remain visible.
6. **Hard-disable controls are authoritative**. Camera Motion OFF disables all automatic camera impulses; Auto Performance cannot turn it on.
7. Silence and paused transport have intentionally different behavior: quiet idle motion may be allowed while transport is playing if documented; pause freezes motion exactly. No unlimited idle drift.

## View and framing targets

- 16:9 hero view, 1:1 square, 9:16 portrait, and resizing without object clipping.
- The default camera must show at least two faces of outer cubes, plus the spaces between banks.
- Every formation is readable with bloom, haze and camera drift disabled; distinctive **geometry silhouettes**, not just edge colors.
- Camera support must use standard Cinema 2.0 camera runtime and world render provider; avoid a module-owned private camera loop.
- Prefer no floor. If an optional floor is later added, it must not consume multiple reflected passes or alter current acceptance signatures.

## Do not implement in v1

Rigid-body physics, collision audio, procedural fracturing, user-imported model replacement, arbitrary block counts, glTF asset packs, ray-traced reflections, real-time shadows for each block, a sliding-tile puzzle, camera-through-object flight, or independent per-cube sub-scenes. See [11_RISKS_AND_SCOPE.md](11_RISKS_AND_SCOPE.md).
