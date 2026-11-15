# NEON FOREST — implemented behavior specification

November 13, 2026. Native preset ID: `drmvyz.cinema2.neon-forest`, revision 1.
Implemented for in-app review; human visual acceptance remains pending. See the
[implementation report](NEON_FOREST-implementation-report.md),
[approved plan and reference analysis](NEON_FOREST-analysis-and-implementation-plan.md),
and [motion review](NEON_FOREST-motion-review.webm).

## World and source identity

A true Y-up world-space crystal grove preserves the faceted banks and circular
portal of **Neon Stage by AnixMoon**, CC BY 4.0. The source is immutable under
`scripts/cinema2-assets/sources/neon-forest/`; the reproducible builder verifies
its SHA-256. Runtime geometry bakes source transforms and recenters the portal
at `(0, 2.262, 0)`. The invalid enclosing sky is replaced by the authored
background and depth-aware atmosphere. Ground is an opaque 180-unit plane at
Y=-0.04, with the source ground texture resized to 512².

The prepared asset has 60,705 triangles in four material batches: crystals,
ground, portal, root filaments. Coherent source surface components receive
root/height/ID/role attributes; 194 obstructing components are removed to open
the travel corridor. There are 1,918 addressed components/fans, not a claimed
count of complete original crystals. New low-poly prism fans finish the grove
around and behind the portal. Source spires reach approximately 8.7 units high;
the portal core retains its 1.78-unit radius and gains physical rim depth and
12 moving rim segments.

All tiers retain the full geometry and 512² ground texture: the compressed asset
is 1,620,944 bytes, with an estimated 5.80 MiB decoded GPU footprint. Tier policy
changes render scale and shared effect quality rather than removing the grove.
Source geometry, textures and cached materials remain immutable during playback;
the Three bridge owns instance material clones. Native deformation uses matching
world coordinates through the asset's position-quantization transforms. Surface
normals are recomputed from the deformation; native depth/shadow materials use
the same position and occupancy functions. Main scene depth is written by the
actual deformed surface render.

## Camera contract

The shared Cinema2CameraRuntime is the sole camera owner. Four rig variants are
available: Aisle Travel, Grove Orbit, Elevated Passage, Fixed View. Travel is a
52-second reference lap, passing through the portal in both directions along
lanes X=-0.3/+0.3, with turns in the cleared front/back corridor. The orbit's
reference angular speed is 5°/second, giving a 72-second full revolution.
Elevated Passage follows a 72-second closed spline around the grove at roughly
15–17 units above ground. Fixed View uses `(0,3.2,14.5)` looking at the portal.
Paths use spline interpolation and constant-speed sampling.

FOV is limited to 45–75°. Orbit radius is 18–24 and elevation 35–60°. At the
lowest permitted orbit elevation/radius, camera height exceeds the source and
surrounding crystal deformation envelope. The builder clears a corridor wider
than the camera lanes plus their near plane, maximum 0.75-unit transient motion
and modest user scale expansion. Camera Motion OFF restores/holds the authored
pose for the selected mode; Fixed View is always static. Mode, heading, radius,
elevation and FOV are manual; neither Director nor Auto Performance selects
camera modes or shots. Off-axis/edge-on portal views are physically correct,
not camera-facing billboards.

## Controls and visible-output map

All parameters use generic Cinema 2.0 schema, Inspector and resolved targets.
Ranges are inclusive. Defaults follow the manifest; effect toggles are hard
authorizations and remain OFF under musical automation.

| Parent / controls | Default and range | Visible output |
|---|---|---|
| Master / Master Intensity | .85; 0–1 | Crystal/portal/filament emission, shared light strength and finishing mix |
| Master / Geometry Motion | ON | Enables native crystal and portal choreography; OFF returns to authored static geometry |
| Master / Motion Amount | .65; 0–1 | Rooted displacement magnitude within the safe envelope |
| Master / Motion Speed | 1; 0–2 | Native pattern/portal/particle phase rate; zero holds timing |
| Master / **BPM Sync** | **ON**, mandatory boolean | Shared beat-governed geometry, portal and camera timing versus authored reference timing |
| Master / Music Response | .8; 0–1 | Continuous/event/Director response strength; zero removes musical modulation |
| Master / **Auto Performance** | **OFF**, mandatory boolean | Fresh build/drop temporary pattern programs only |
| Master / shared Quality | Existing host policy | Real low/medium/high render scale and effect policy |
| Design / Pattern | Prism Tide; eight options | Native spatial program, immediate manual selection |
| Design / Pattern Change | OFF | Canonical event-driven runtime progression |
| Design / Trigger | Every 4 Bars; canonical 11 | Visible only with Pattern Change ON; determines when progression occurs |
| Design / Forest Density | 1; 0–1 | Deterministic crystal/fan occupancy, matched in depth |
| Design / Crystal Scale | 1; .8–1.1 | Whole-component scale about rooted pivots |
| Design / Portal Size | 1; .65–1.35 | Physical portal and segmented rim dimensions |
| Design / Portal Motion | ON | Portal rotation/segmented bloom, subordinate to Geometry Motion |
| Design / Camera Mode | Aisle Travel; four modes | Shared rig variant |
| Design / Camera Motion | ON | Shared camera movement authorization |
| Design / Camera Speed | 1; 0–2 | Travel/orbit/elevated timing; zero holds |
| Design / Field of View | 58°; 45–75° | Perspective framing |
| Design / Orbit Radius | 20; 18–24 | Conditional orbit distance |
| Design / Orbit Heading | 0°; −180–180° | Conditional manual azimuth; endpoints represent the same heading |
| Design / Orbit Elevation | 40°; 35–60° | Conditional viewing height/angle |
| Effects / Crystal Emission | .65; 0–1 | Crystal, portal and filament radiance |
| Effects / Particle Density | .45; 0–1 | Native depth-tested luminous particles |
| Effects / Scene Lights | ON | All authored surface/scattering lights; does not disable material emission |
| Effects / Light Strength | .8; 0–1 | Shared eight-light rig intensity |
| Effects / Atmosphere | ON | Depth-aware volumetric pass authorization |
| Effects / Fog Density | .45; 0–1 | Scales distance density and low-mist ceiling |
| Effects / Ground Mist | .08; 0–.2 | Drifting low-level smoke/mist amount |
| Effects / Mist Height | 1.8; .2–5 | Vertical mist distribution |
| Effects / Light Shafts | .65; 0–2 | Spatial light scattering strength |
| Effects / Bloom | ON | HDR bloom authorization |
| Effects / Bloom Amount | .45; 0–1 | Bloom mix |
| Effects / Ground Reflections | ON | Reflective-floor pass authorization |
| Effects / Reflection Amount | .3; 0–1 | Restrained depth/screen-based ground reflection mix |

### Independent palette roles

Seven actual `color` parameters live under Design > Palette:

| Role | Default RGBA (sRGB) | Consumer |
|---|---|---|
| Background | .009, .004, .027, 1 | Environment clear color and reflection sky tint |
| Crystal Primary | .08, .88, 1, 1 | Left crystal bank, selected portal/filament regions and linked spill |
| Crystal Secondary | .68, .12, 1, 1 | Right bank, alternating filaments and linked spill |
| Portal Accent | 1, .08, .43, 1 | Independent portal gradient regions and portal-colored lights |
| Ground | .18, .27, .38, 1 | Textured terrain tint and reflection base |
| Particles | .6, .93, 1, 1 | Native particle color |
| Atmosphere | .22, .42, .52, 1 | Volumetric haze tint |

These roles have independent canvas consumers and remain user-owned. There is no
automatic recoloring mode. No sky mesh hides the Background control.

## Eight geometry programs

| Pattern | Native motion vocabulary |
|---|---|
| Prism Tide | Lateral rooted bend wave across X |
| Root Resonance | Radius-phased anchored vertical growth/contraction |
| Aisle Cascade | Depth-row radial fan wave along Z |
| Crown Spiral | Height-weighted crown twist around each component root |
| Portal Bloom | Radial crystal fan opening with articulated portal-rim bloom |
| Crosscurrent | Opposing diagonal group counter-leans |
| Crystal Choir | ID-group call/response tiers of rooted growth |
| Supernova Grove | Bounded radius-delayed outward fan release |

Native pattern displacements blend with convex weights over 350 ms; interrupted
transitions start from the current mixture. Manual edits snap immediately.
Combined transient crystal displacement is clamped to `0.75 × Motion Amount`
world units, further reduced by music/vocal restraint; roots remain fixed.
User scale is a separate authored base. Portal motion is bounded, with at most
12% extra rim expansion before the user's size scale. Root filaments stay on the
ground; particles supply restrained depth cues.

## Timing, audio and resets

BPM Sync is a required persistent boolean under Master Controls. ON uses the
shared beat clock/analyzed grid/transport timing; OFF uses the existing shared
clock's authored 100-BPM-equivalent free-running path. This local preset setting
is independent of Audio Dock BPM Sync, explicitly documented in its control.
Sync OFF does not disable musical events, Music Response or Pattern Change.
Switching Sync changes the rate without resetting current native phase.

No-track idle reduces geometry amplitude to 35% of the user's amount and phase
rate to 22% of authored speed. It is distinct from a playing track temporarily
missing analysis, which retains normal authored motion. Explicit pause holds
native phase, blends, camera, accepted musical response and atmosphere time.
Resume consumes held identities without replaying stale events. Seek, loop,
track/source/context changes reconstruct/reset transient clocks and envelopes;
analysis replacement and reappearance latch current event identities. Re-entry
restores persisted controls while rebuilding volatile state and resources.

Audio comes exclusively from the shared bridge. The freshness adapter validates
publisher/track/timeline identity; it is not a beat, BPM or drop detector.
Choreography owns signal smoothing and envelopes; the native module consumes the
resolved transient targets and maps them spatially.

| Shared source | Response / bound | Attack, release / smoothing |
|---|---|---|
| Energy | Movement/light range inside user limits | 180 ms |
| Bass | Height-weighted lateral bend, ≤.2 units before combined clamp | 120 ms |
| Highs | Particle activity and fine accents | 90 ms |
| Vocal presence | Reduces motion/particle activity | 200 ms |
| Supported build progress/confidence | Inward crystal tension, ≤.15 response | 250 ms; confidence ≥.45 |
| Kick | Lower/radially traveling lift, ≤.12 response | 20 ms / 220 ms |
| Snare | Crown/alternating-group accent, ≤.15 | 10 ms / 180 ms |
| Beat | Small vertical accent, ≤.06 | 10 ms / 250 ms |
| Drop | Outward spatial release, ≤.25 | 20 ms / 800 ms |
| Director intensity/momentum | Bounded range, light and bass-motion significance | 240 / 320 ms |
| Director build | Supported macro tension, ≤.15 response | 300 ms |
| Director impact | Qualifies existing fresh envelopes, never a second drop detector | Immediate identity; finite accepted window |
| Qualified section change | Small finite accent, ≤.04 | 120 ms / 600 ms |

Every reaction is scaled by Music Response once, composed through declared
module targets, gated for freshness and user authorization, and clamped. Event
envelopes restore zero transient contribution. No event directly persists a
user parameter or indiscriminately maps every musical source to brightness.

## Pattern Change, Auto Performance and authority

Pattern, Pattern Change and conditional Trigger appear together under Design in
that order. Reuse the canonical 11 values/labels unchanged: beat/Beat, kick/Kick,
snare/Snare, downbeat/Downbeat, beat2/Every 2 Beats, beat4/Every 4 Beats, bar/Bar,
bar4/Every 4 Bars, bar8/Every 8 Bars, phrase/Phrase, drop/Drop.

Pattern Change OFF holds the authored selection. ON advances the runtime base
through the eight programs on fresh canonical events, suppressing duplicates and
immediate repeats. Runtime changes do not overwrite the persisted authored
Pattern. Manual edits/reselection are immediate, keep Pattern Change enabled,
and latch the current event so only a subsequent qualifying event advances it.

Auto Performance is mandatory in the Inspector but opt-in in operation. Its sole
automatic ownership domain is temporary build/drop pattern presentation:

- A fresh supported build episode selects Portal Bloom (or Root Resonance if the
  underlying base is already Portal Bloom), for at most eight shared beats.
- A fresh canonical drop selects Supernova Grove (or Crystal Choir if already
  selected), for four shared beats.
- Base progression continues during an override; expiry restores its current
  value, including Trigger-driven advancement during the override.
- Manual Pattern edits cancel active overrides immediately. The held build/drop
  cannot steal the selection back; a subsequent independently qualifying event
  is required. Enabling Auto Performance latches the already-active moment.

| Domain | Owner | Automation composition / manual-edit result |
|---|---|---|
| Palette, camera mode/framing, enables | User | Exclusive; OFF stays OFF |
| Scale, size, density | User base | Spatial program respects authored dimensions and occupancy |
| Motion/emission/light/effect strength | User base and ceiling | Bounded musical gains; zero remains zero |
| Pattern | Authored base + explicit Trigger progression | Immediate manual edit; Pattern Change preserved |
| Temporary build/drop presentation | Auto Performance while enabled | Bounded override; manual cancellation and correct restoration |
| Timing facts | Shared Audio Intelligence/transport | Preset-local detectors/clocks prohibited |
| Transient target values | Shared choreography/resolver | Add/multiply/replace only on declared transient channels, not saved controls |
| Actual geometry/material behavior | Native module | Consumes final resolved values, preserves roots and bounds |
| Camera, light, effects/render targets | Shared runtimes | Native module does not create competing owners |

## Lighting and render ownership

Eight shared lights (ambient, directional, four points, two spots) provide surface
readability, colored spill and spatial scattering within the 12-light limit.
Scene Lights, Light Strength and Master Intensity gate the entire rig. Emission
is a separate native material domain. No imported empty Point node is treated as
an existing working light. The initial rig does not request shadow maps.

Render order: depth-backed HDR scene → optional restrained ground reflection →
noise-volume volumetric atmosphere → HDR bloom → tone mapping/output. All
finishing passes support OFF/default/maximum states. Volumetrics use the actual
camera, light list and scene depth, with independently controlled low mist,
height, density and scattering. Quality policy lowers sampling/render scale.
Reflections are the existing depth/screen-based effect, not a complete mirror of
objects outside the view.

GPU assets and materials are released on disposal, including controller-owned
particle geometry/material and custom depth materials. The shared cache retains
only its normal immutable asset ownership. Context recovery rebuilds resources.

## Verification

Use Node 22.12–22.x as required by the repository.

- `npm run assets:neon-forest` regenerates the prepared asset and provenance report.
- `npm run assets:build` regenerates the manifest/attributions after asset changes.
- `npm run test:e2e:cinema2-neon-forest` runs both production-canvas suites.
- `node --test scripts/cinema2-assets/neon-forest-geometry.test.mjs` verifies source
  integrity, semantic geometry, validation and reserved source corridor.
- Focused Vitest files are `Cinema2NeonForest{Preset,Audio,Choreography,Director,AutoPerformance}.test.ts`.

Full suite evidence and known limits are in the [implementation report](NEON_FOREST-implementation-report.md).
