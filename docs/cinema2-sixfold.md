# Cinema 2.0 Sixfold

Sixfold is the native Three.js successor to the legacy Sixfold Chamber mirror shader. Its production identity is a recursive mechanical mirror chamber rather than a collection of floating primitives.

## Stable identity

- Preset: `drmvyz.cinema2.sixfold`
- Module: `sixfold-native@1`
- Legacy source: `preset-sixfold-chamber`
- Resource: `sixfold:recursive-mirror-chamber:v2`

Existing pattern enum values and parameter IDs remain stable for saved-preset compatibility. The six visible pattern labels are Harmonic Expansion, Recursive Descent, Mirror Fold, Phase Cascade, Lockstep, and Singularity.

## Production environment

The renderer constructs one managed scene with six independently choreographed semantic systems. The original chamber is now the focal cell of a seven-cell honeycomb: six equal-size hexagonal chambers meet its six sides and extend the architectural pattern beyond the center.

1. A twelve-blade central iris with nested bearings and a dark optical aperture.
2. Six articulated mirror panels mounted on carriers, hinges, and actuators.
3. Five bevelled recursive hexagonal chamber frames.
4. Concentric iris bearings and quality-bounded gear detail.
5. Recessed illumination rails built from three individually housed LED segments per hexagon side, plus an aperture light.
6. Six structural locking arms joined to the chamber by longitudinal trusses.

Repeated pieces share geometry. Medium and high quality enable progressively finer trusses and gear detail without rebuilding the scene each frame. The renderer reports its geometry and shared environment estimate to the Cinema 2.0 GPU budget and disposes all module-owned materials, geometry, and targets through the managed resource lifecycle.

## Audio-reactive choreography

Sixfold consumes Cinema 2.0's canonical Audio Intelligence signals; it does not run a local beat or transient detector. A shared beat clock provides deterministic phase motion when BPM Sync is enabled, while the non-synced mode advances from render time.

Each system owns a different response lane:

1. The central iris opens and contracts from bass pressure, kick accents, and build energy.
2. Mirror facets fold and twist from snares, high-frequency content, and overall energy.
3. Recursive chamber layers travel in depth from phrase accents, bass, and energy.
4. Concentric mechanisms counter-rotate from mids, downbeats, and builds.
5. The 18 side/segment LED channels chase, mirror, descend, quantize, compress, and release from highs, kicks, and overall energy. Their choreography propagates through both the five central depth layers and the six surrounding cells.
6. Structural locks fold and release from downbeats, mids, and drop accents.

Vocal presence restrains mechanical travel so the chamber supports rather than competes with foreground vocals. All animation state is preallocated and applied to the persistent scene graph without per-frame geometry construction.

The six programs are intentionally different compositions rather than speed variants:

- Harmonic Expansion breathes the full chamber outward in harmonic rings.
- Recursive Descent sends a traveling depth wave through the chamber layers.
- Mirror Fold articulates opposing facet pairs around the iris.
- Phase Cascade relays movement clockwise through the six sectors.
- Lockstep quantizes the mechanisms and locks to the shared beat grid.
- Singularity compresses the chamber during a build and releases it on a drop.

Pattern Change and Trigger use the same trigger vocabulary and automatic-performance authority model as the established Cinema 2.0 presets. A direct Pattern edit disables Auto Performance, preserving manual performer control.

## Materials and lighting

The palette controls map to physical roles:

- Background
- Structural Metal
- Mirror Facets
- Illumination
- Iris / Core

The scene uses standard and physical PBR materials, the shared Three.js environment map, the engine-owned Three light rig, two quality-budgeted shadow-casting spotlights, a directional fill, and ambient light. Master Intensity controls performance emission while the physical chamber remains readable at zero intensity.

## Camera and composition

The default camera is a 43-degree frontal hero composition with width-safe framing for narrower stages. Camera motion is restrained drift and tempo motion rather than a continuous orbit. Perspective Reveal is an authored design control that exposes chamber thickness without changing the engine's single-camera ownership.

## Controls consumed by the renderer

Chamber Radius, Chamber Depth, Mirror Facet Scale, Mechanical Detail, Perspective Reveal, Resting Fold, Chamber Travel, Mechanical Drift, Chamber Rotation, Light Rail Intensity, Iris Intensity, and Fine Detail all reach the native module or renderer. Existing effects and palette controls remain wired through the Cinema 2.0 manifest.

## Production validation

Run:

```sh
node scripts/cinema2-assets/capture-sixfold-production.mjs
```

The harness renders the registered preset through `Cinema2Runtime`, publishes deterministic canonical Audio Intelligence frames, waits for managed GPU residency, rejects module/effect diagnostics, and captures frontal, perspective-reveal, recursive-depth, owner-stage, all six choreography programs, medium-quality, and low-quality frames in `artifacts/cinema2-sixfold-phase-c/`. It also verifies that the six program captures are pixel-distinct.

