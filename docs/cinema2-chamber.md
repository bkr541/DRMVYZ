# CHAMBER (Cinema 2.0)

Rowan Design's *Darkspore Editor Chamber* (CC BY 4.0, credited in the asset records). The shipped file is `public/cinema2/models/chamber.glb`, byte for byte the supplied `dark chamber.glb` (23 meshes, 10 materials, one embedded 1024 px emissive texture, 44,650 triangles, no animation). The preset (`Cinema2ChamberPreset.ts`, revision 5) is built on the native module `Cinema2ChamberNativeModule.ts`.

## What is in the model

The glowing elements, which the module drives. Their authored emission is the default look:

| Element | Material | Cells |
| --- | --- | --- |
| Platform ring | `turquoise_glow` | 12 arcs |
| Floor ticks | `Turquoise`, the pieces on the floor | 8 radial dashes |
| Corner beacons | `blue_screen_glow` | 4 |
| Arm lamps | `Turquoise`, the pieces on the device's arms | 6 (3 per arm) |
| Core lamp | `White`, `White_0` (textured) | the lamp under the device |

Everything else (the glossy blue-grey walls, pillars, ceiling arches, the platform base, the device body and arms) is left exactly as authored; it reads through the six manifest lights and the studio environment. The device's arms are separate static meshes, not a rig.

The module hides each glowing mesh and draws per-element copies in its place (the model's geometry and materials are never modified), so any arc, tick, beacon or lamp can be lit on its own. Cells are ordered by angle round the platform, so a program runs the same way round every ring.

## Controls

- **Master Controls:** **BPM Sync** (locks the camera drift and the light programs to the track tempo; off, a steady 120 BPM), **Intensity** (scales every glowing element), **Audio Reactivity** (0 means the music moves nothing), **Zoom on Kick** (a 1.6 degree lens punch on every kick; only the field of view changes) and **Auto Performance** (off by default).
- **Design → Pattern:** **Pattern**, **Pattern Change**, **Trigger**, with eight programs: **Standby** (the authored look and the default), **Ring Chase**, **Pulse Ripple**, **Sentinel Sweep**, **Countdown**, **Core Breath**, **Charge Ring** (a build) and **Lockdown Flash** (a drop). Selection uses the shared Mainframe pattern controller and trigger list: a manual pick shows at once, a Trigger-driven change eases in over two beats.
- **Design → Emission:** Platform Ring, Floor Ticks, Corner Beacons, Arm Lamps, Core Lamp.
- **Design → Device:** **Arm Motion** (how far the device's two arms swing and turn in the programs; Standby keeps them still) and **Kick Ripple** (how strongly each kick sends a ripple outward through the glowing elements).
- **Design → Lights:** Floor Pool, Platform Glow, Device Glow, Window Spill, Rim Light, Ambient Fill, Reflections. Each starts at the preset's authored level.
- **Design → Camera:** **Camera Mode** (Home View, the original fixed framing and the default; Interior Drift, a 40 second arc of about 26 degrees either way round the platform that runs at bpm / 120 of its speed with BPM Sync on; Manual View), View Motion Speed, Camera Heading (±60°), Camera Elevation (−10° to 40°), Camera Distance (6 to 9.4) and Field of View. A safety box keeps every view between the pillars' ring and the walls.
- **Effects:** Bloom, Exposure, Vignette.
- **Palette:** Platform Ring, Floor Ticks, Corner Beacons, Arm Lamps, Core Lamp and Window Spill. The glow colors are stored so that the defaults reproduce the file's own emission exactly.

## The device's arms

The two robot arms hang from ceiling brackets. Every triangle of the structural meshes (and of the white lamp meshes) inside an arm's box, relative to the platform's centre, moves with that arm, and the cyan arm lamps move with it. The arm swings from its bracket (tilt out or in) and turns about it. Each program sets the pose (Sentinel Sweep swings the active arm out on each beat; Charge Ring spreads both as the build climbs; Lockdown Flash snaps them on the beat). In Standby the pose is zero, so the arms are exactly where the model has them.

## Audio, choreography and Auto Performance

Every route targets one of the preset's own controls or lights (so the Inspector shows each moving and Auto Performance locks it) and scales with Audio Reactivity.

- **Continuous:** bass lifts the ring and the platform glow, the mids the arm lamps, the highs the floor ticks and corner beacons, overall energy Intensity and Arm Motion, and vocal presence the device glow and the core lamp.
- **Events:** a kick hits the core lamp and sends a pulse through the floor lights (a light-group action staggered a quarter beat apart), and taps the arms; a snare flashes the beacons and the window spill; a downbeat lifts the rim light; a drop lifts Bloom, Intensity and the room lights (center out).
- **Kick ripple:** on every kick the glow runs outward, each element an eighth of a beat after the last: core lamp, arm lamps, ring, floor ticks, beacons.
- **Auto Performance:** the shared Mood Conductor moves the controls (calm relaxes the lamps, arms and window spill; a build raises the floor pool and core lamp; a peak lights the ring and lamps and lifts Bloom; a shock flares the beacons and rim; silence fades the lights and bloom), chooses how often the Pattern changes, puts **Charge Ring** on stage for a build and **Lockdown Flash** for a drop (between them, a program chosen by the passage's feel on musical boundaries), and the shared coverage step drives any other numeric control. The saved Pattern, Pattern Change and Trigger are never written to; the saved values apply again the moment Auto Performance is off, and a manual Pattern edit is never undone by an event already present.

## Atmosphere

One field of 160 very faint dust motes drifts in the room's air (high quality draws all of them, medium half, low none). It is tuned to be barely perceptible: the default look is the model's own.

## Verified and not verified

Checked in Chromium against the real model: the default matches the original framing and look; every program, a palette change, the manual camera, the arms swinging in Sentinel Sweep, and kick-driven glow through the real Audio Intelligence bridge with a deterministic fixture. Not done: tuning against real music. The audio amounts are set by reasoning and the shared checks, and need listening with real tracks.
