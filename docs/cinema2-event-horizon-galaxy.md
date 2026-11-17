# Event Horizon: the galaxy, the camera and Auto Performance

2026-11-17. Uncommitted.

## The galaxy replaces the procedural stars

`public/cinema2/models/event-horizon-space.glb` is the owner-supplied `space.glb`: a spiral galaxy of 50,000 colored points ("Need some space?" by Loïc Norgeot, CC BY 4.0, credited in `public/cinema2/attributions.json`). It is a point cloud, not a mesh, so it is parsed and drawn by Event Horizon itself (`modules/eventHorizon/Cinema2EventHorizonSpaceField.ts` and the renderer's `SpaceField` program), not through the Three.js asset path.

- **Fit to the budget.** The original is 1.34 MiB and pushed the shipped assets over the installer budget. `scripts/cinema2-assets/pack-event-horizon-space.mjs <space.glb>` repacks it to 0.57 MiB (positions to 16 bits with `KHR_mesh_quantization`, colors to 8 bits). Every star is within 0.00005 galaxy units of the original and every color is identical. Shipped assets are now 130.97 of 131.0 MB: **there is almost no headroom left for the next asset.**
- **Placement.** The galaxy is recentered on its center of mass, where the black hole sits, and scaled so 99% of the stars are within 30 world units. Its axis is Y. The stars are in a fixed random order, so a quality tier or Star Density draws a fair sample (12,000 / 28,000 / 50,000 at the full density).
- **Loading.** The galaxy loads in the background; the black hole draws on its own until the stars arrive. A failed load is reported as a module diagnostic (`CINEMA2_EVENT_HORIZON_SPACE_LOAD_FAILED`) and the preset keeps running.
- **What stayed.** The black hole core, accretion disk, lensing and orbital debris, the three looks and Pattern Change.

## Audio-reactive stars (the standard geometry choreography)

The stars read the module channels the shared choreography rules already write (no new analysis): energy and bass lift the whole field (the bulge most); a kick lights an angular sector of the galaxy; a downbeat sends a bright shell out from the black hole; the snare sparkles a subset of stars; a phrase swells the core; a build gathers the galaxy toward the center; a drop throws it outward and flashes it toward the Accent color. Colors are the model's own, lightly tinted by the Primary and Secondary palette colors. The galaxy turns with Rotation Speed, faster in the bulge than at the rim.

## Camera

Camera Mode (Design > Camera) selects one of three rigs; Camera Speed, Field of View, and (for Orbit) Orbit Radius and Heading are bound to the camera.

- **Orbit**: the original close orbit of the black hole.
- **Fly Through**: a 96 s looping spline flight weaving through the bulge and across the disk, two close passes by the black hole, looking ahead and in toward the core.
- **Deep Space**: a 170 s drift high above the disk, seeing the whole galaxy turn around the black hole.

All modes share idle motion, drift and roll, banking into turns, a tempo-locked sway and a kick zoom, and obey Camera Motion (Full / Reduced / Lock Off).

## Auto Performance and the Mood Conductor

Migrated like the other presets (see `cinema2-mood-conductor.md`). Horizon Look, Pattern Change and Trigger moved from Effects to Design, and the old "editing the look turns Auto Performance off" rule was removed (the Auto Performance lock makes it unreachable). With Auto Performance on and music playing, the music chooses Pattern Change and the Trigger.

## Checking it

`node scripts/run-cinema2-event-horizon-browser.mjs --out <dir>` renders the preset in headless Chromium (software GL) and saves frames at rest, with quiet music, on a kick, and in each camera mode. These frames were reviewed by eye; the preset has not been checked in the running app.
