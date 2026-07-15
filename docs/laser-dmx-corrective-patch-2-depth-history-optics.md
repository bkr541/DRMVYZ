# LaserDMX WebGL Corrective Patch 2

## Scope

Corrective Patch 2 replaces the binary rear/front light partition with bounded continuous depth slicing, isolates temporal scanner history to laser light, and expands fixture-specific WebGL optics. The locked front-center camera, black-void presentation, Canvas2D fallback, deterministic transport behavior, clean output modes, and existing HDR/post pipeline remain intact.

## Continuous depth compositing

The WebGL renderer now projects every beam endpoint through the locked camera, splits only beam spans that cross depth-slice boundaries, and batches the resulting segments by slice. Slices are accumulated from far to near with additive sharp light, laser-only temporal light, atmosphere scatter, and per-layer extinction. Local haze and CO2 sources are assigned to the same continuous slice space, so their extinction applies only to light behind or within the affected depth range rather than dimming the complete frame.

Depth quality is bounded and independent from sharp beam-core resolution:

| Quality | Depth slices | Behavior |
| --- | ---: | --- |
| Low | 3 | Simplified extinction and reduced plume precision |
| Medium | 5 | Standard continuous far-to-near atmosphere |
| High | 7 | Finer beam/plume depth intersection |
| Ultra | 9 | Highest bounded precision and temporal stability |

When the required WebGL texture-unit capability is unavailable, the planner falls back to a two-layer compatibility mode. Render targets are reused and resized. Laser history pairs are allocated only for slices carrying current or retained laser energy, with aggregate history resolution bounded to the memory footprint of one legacy full-resolution ping-pong pair. All targets are released on context loss and recreated on restoration.

## Render graph

The production order is now:

1. Current nonlaser fixtures for the active depth slice
2. Current sharp laser/scanner light for the active depth slice
3. Current atmosphere, local haze, and CO2 illumination
4. Laser-only temporal history update
5. Far-to-near depth-layer accumulation with extinction
6. HDR bloom, exposure, tone mapping, glare, and final output

Temporal history never receives the final HDR composite. Aperture glow, washes, LEDs, video surfaces, haze, CO2, strobe exposure, blinder lift, and post bloom remain current-frame effects.

## Fixture optics

- Moving heads use projected cones with zoom, iris, frost, edge softness, hot-center control, deterministic pan/tilt, analytic gobo masks, authored gobo rotation, and bounded 3/5-facet prism copies.
- Gobos include open, circle, dots, bars, triangle, star, breakup, radial, and grid patterns. No manufacturer artwork is embedded.
- PAR/wash fixtures use broad soft volumes without laser-style white cores.
- LED bars and tubes retain orientation and physical thickness, with continuous, segmented, chase, and gradient behavior plus bounded haze lift.
- Video-wall fixtures compile as emissive aspect-preserving surfaces. Unavailable media, camera, or React Visual inputs receive a safe procedural fallback.
- CO2 uses a deterministic expanding plume with attack, widening, turbulence, decay, bounded lifetime, local scatter, and partial depth attenuation.
- Strobes remain short sharp flashes with exposure impulses. Blinders remain larger warm or authored-color sources with broader controlled release.

## Diagnostics and regression states

Outside Capture mode, runtime diagnostics report the active depth mode, slice count, slice-accumulation status, laser-history input count, and active laser-history slices.

The actual WebGL regression harness includes baseline coverage plus dedicated states for depth-crossing beams, foreground haze veil, partial CO2 attenuation, laser-only scanner trails, moving-head gobos, moving-head prisms, LED pixel chase, video-wall emissive output, and strobe/blinder distinction.

## Deferred to Corrective Patch 3

This patch intentionally does not add quality-dependent hero fan count expansion, broad Vitest hang remediation, or WebGL retry-state management changes.
