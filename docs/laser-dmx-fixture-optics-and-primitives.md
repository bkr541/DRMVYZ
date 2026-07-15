# LaserDMX Fixture Optics and Professional Primitives

The WebGL renderer provides fixture-specific presentation and a high-level optical composition layer without changing the locked front-center camera or introducing venue geometry.

## Fixture optical models

- **Laser** uses the narrowest body/core profile, small divergence, strong projector aperture, temporal scanner persistence, beam-reactive haze, and optional restrained prism color separation.
- **Moving head** uses a volumetric spot cone with hot center, zoom, iris, frost, soft/hard edge control, deterministic gobo modulation, and optional prism side-lobe multiplication.
- **PAR / wash** uses a broad soft field with smooth falloff and stronger atmospheric spill. It intentionally has no razor-thin laser core.
- **Strobe** is a timed emissive panel plus exposure/atmosphere transient. The Canvas fallback uses one broad volumetric flash rather than four short lines.
- **Blinder** is a warm, high-energy source flare with the existing photographic exposure transient.
- **LED bar / tube** is an emissive physical strip with stable screen-space thickness, segmented pixels, local glow, and deterministic chase phase.
- **Haze** remains invisible as geometry and contributes local density to the depth-aware atmosphere system.
- **CO2** adds a deterministic short-lived directional plume, local atmosphere density, transient timing, partial beam-core occlusion through the plume, and a broad Canvas fallback cone.
- **Video wall** is a minimal emissive surface. It does not create a room, stage shell, wall, floor, ceiling, audience, or truss.

## High-level primitives

The scene/compiler layer supports:

- Fan and layered fan
- Parallel and cross banks
- Sheet
- Tunnel
- Upper-air canopy
- Front-air audience rake
- Diamond plane
- Mirrored corridor
- Rotating lattice
- Aperture burst
- Scanner wave
- Wash cone
- Blinder bank
- Strobe field
- CO2 burst

Each primitive is deterministic from authored fixture identity and canonical music/transport state. One fixture remains one meaningful source, while rays are generated with stable spacing, bounded depth planes, and deterministic beam-budget thinning.

## Inspector controls

Advanced Show Director inspection exposes only practical controls:

- Primitive
- Ray count
- Fan width
- Optical softness
- Source intensity
- Atmosphere response
- Zoom, iris, and frost for moving heads/washes
- Gobo texture for moving heads

`Auto / authored endpoints` preserves existing targets and behavior. Selecting a named primitive deliberately replaces endpoint layout with coherent generated geometry.

## Professional show migration

The migration boundary changes optical presentation metadata only. It preserves fixture IDs, semantic keys, groups, target data, trigger timing, program scenes, musical mutations, deterministic seeds, and selection behavior.

- **Prism Cathedral** gains layered fans, upper-air canopies, and diamond planes.
- **Cardinal Fan Reactor** gains cross banks, layered axial fans, and front-air rakes.
- **Cyan Mirror Cage** gains mirrored corridors, rotating middle lattices, and deep tunnels.
- Converted Rig Layout Performance Shows receive fixture-appropriate optics and safe fallback behavior.

The migration is applied when registered Performance Show rigs are created, so existing stored projects remain compatible and legacy non-migrated fixtures retain authored endpoints.

## Budget and fallback behavior

- Explicit primitives request their high-level `rayCount` through the existing role-aware 300-beam budget.
- Budget pressure preserves deterministic edges/center and source identity rather than deleting arbitrary rays.
- Canvas2D compiles named primitives to simpler stage/grid beams while preserving coherent target geometry.
- WebGL quality tiers may thin support rays after hero/primary geometry and at least one ray per source are protected.
- WebGL unavailability does not invalidate presets or saved projects.
