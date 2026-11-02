# PSYLO behavior and ownership specification

The user authorized the remaining phases on November 2, 2026. PSYLO's complete
implementation uses stable ID `drmvyz.cinema2.psylo`, revision **2**, visible name
**PSYLO**. The user approved the final handoff on November 2, 2026; PSYLO is now
registered as a **keeper**, with all eight phases complete. Implementation, automated results
and remaining review limits are recorded in [the final report](PSYLO-final-report.md).

## Geometry, assets and performance boundaries

A purple hero grove, companion forms and **167 mushroom placements** surround
continuous 150 × 150 terrain, groundcover, rocks and 28 mycelium paths. The prepared
high/low assets retain 19 material batches and 205,371 triangles, with smaller
textures at low quality. Source diorama bases/cards were removed; attribution,
original source hashes and prepared GLBs remain unchanged from Phase 1. No new
asset download or installer payload was added for finishing; smoke uses the
already-registered shared volume texture.

World space is Y up, hero root near [0,0,-8]. Normalized species carry world roots,
normalized heights, deterministic IDs/zones/species and cap regions. Quantization
node transforms restore world-space positions before deformation. The bottom 4%
remains rooted; negative IDs mark stationary ground/rocks/mycelium. Pattern and
event deformation is root-weighted and final-clamped to **0.75 × resolved motion
amount**, including transitions and Director contributions. Scale remains 0.8–1.1.
Normals use deformed world-space samples. Population masking protects the seven
hero/companion placements and changes appearance, not submitted triangle count.

Shaders preserve source UV/PBR artwork, strengthen gill emission and derive cap-spot
emission from source texture brightness/height masks. Emission, actual light spill
and scattering are separate consumers. This is not a collection of camera-facing
mushroom cards. Native spores use a bounded 128-point circular particle buffer;
geometry/material and shared renderer resources are disposed explicitly.

## Camera

One shared Camera Runtime supplies final projection and matrices to the native
renderer and atmosphere. No local/second camera or alternate render loop exists.

| Mode | Authored speed 1 / 100 BPM behavior |
|---|---|
| Forest Travel | Closed constant-speed spline, 52-second lap, eye Y 2.5–2.7 and X approximately 0.65–1.3 through the ground corridor. |
| Grove Orbit | True 360-degree grove orbit, 72-second revolution; editable radius 14–22, heading -180–180°, elevation 40–60°. |
| Canopy Passage | Closed elevated spline, 72-second lap, Y 13–16 around the forest. |
| Fixed View | Position [0,5.85,18.9], target [0,3.5,-8]. |

Mode edits cut to the selected authored shot and reset its progress. Camera Motion
OFF and speed zero hold; Fixed View is static. FOV is 45–75° (default 58), near/far
0.1/180, with shared min-aspect framing for narrow outputs. BPM Sync uses shared
transport/analysis tempo and bounded rate 0.5–2 before the user's speed multiplier;
OFF uses authored rates. No-source idle moves authored rigs, pause/stop holds.

Decoded-geometry tests cover full routes, joins and orbit extremes at scale 1.1,
the full 0.75 displacement allowance and a 0.3 camera margin. Auto Performance
**never owns the camera**. Editing camera controls always takes effect directly.
Optional automatic shot progression was not added; the original plan conditioned
that separate domain on its own approval. Full manual travel/orbit remains live.

## Inspector: parameter-to-output contract

All 39 controls use shared Inspector definitions and typography. No preset-specific
font overrides or inert controls are introduced. Values below are authored bases
and ceilings; zero/OFF never grants automation permission.

| Parent / control | Range / default | Visible output / authority |
|---|---|---|
| Master Controls / Master Intensity | 0–1 / .85 | Native emission, spores' opacity and accent light/effect ceilings. Minimal ambient/moon illumination leaves physical surfaces readable at zero; geometry is a separate domain. |
| Geometry Motion | ON | Hard deformation/spore-motion enable. OFF restores rooted undeformed growth. |
| Motion Amount | 0–1 / .5 | Final displacement range; zero restores geometry and holds phase/blends. |
| Motion Speed | 0–2 / 1 | Integrated pattern/spore phase; zero holds phase/blends and prevents event displacement. |
| BPM Sync | ON | Shared geometry/camera clock; OFF retains musical response and canonical Trigger events. |
| Music Response | 0–1 / .8 | Audio/Director modulation, applied once per contribution. Zero restores authored native response; independent Pattern Change and Auto Performance permissions remain available. |
| Auto Performance | OFF | Temporary build/drop Pattern presentation only; no camera, palette, layout or effect enable ownership. |
| Design / Pattern | Eight choices | Immediate manual base; never silently rewritten by runtime selection. |
| Pattern Change | OFF | Fresh selected Trigger advances the independent runtime base. OFF restores authored base; temporary Auto Performance remains a distinct permission. |
| Trigger | Eleven canonical options / Every 4 Bars | Conditional while Pattern Change ON; preserved while hidden. |
| Forest Density | 0–1 / 1 | Masks surrounding plant population, protecting hero/companions. |
| Mushroom Scale | .8–1.1 / 1 | Physical size around fixed roots. |
| Camera Mode | Forest Travel | Four authored rigs above. |
| Camera Motion / Camera Speed | ON / 0–2, default 1 | Hard shared camera movement gate/rate. |
| Field of View | 45–75 / 58 | Final projection. |
| Orbit Radius / Heading / Elevation | 14–22 / 18; -180–180 / 0; 40–60 / 45 | Real orbit-only controls, hidden in other rigs. |
| Effects / Cap / Gill Emission | 0–1 / .6 | Textured cap spots, source emission, gill undersides and mycelium radiance. Zero removes surface emission. |
| Spore Density | 0–1 / .6 | Native point population ceiling, up to 128. Zero removes all spores. |
| Scene Lights | ON | Accent point/spot hard enable; low ambient/moon fill remains separate. |
| Light Strength | 0–1 / .8 | Four local spill/fill points and two overhead shaft lights. Zero removes this authored rig. |
| Atmosphere | ON | Hard bypass of the shared volumetric fog/mist/shafts pass. |
| Fog Density | 0–1 / .45 | Multiplies distance fog extinction and ground-mist density together. Zero clears the whole participating medium, including shafts. |
| Ground Mist | 0–.2 / .08 | Independent physical ground-layer density before Fog Density; zero leaves distance fog only. |
| Mist Height | .2–5 / 1.8 | World-Y exponential falloff above floor .05; does not flatten/move geometry. |
| Light Shafts | 0–2 / .65 | In-scattering of real shared lights. Zero removes light beams while fog extinction/ambient mist can remain. |
| Bloom / Bloom Amount | ON / 0–1, default .45 | Hard HDR bloom bypass and wet/dry amount. Zero/OFF prevents halos; source emission remains independently editable. |
| Palette | Eight independent colors | Role consumers listed below. |
| Advanced / Quality / Performance | Shared enum / Auto | Existing tier policy, model texture variant, reduced volumetric resolution/steps and bloom chain. |

## Palette

| Color | Independent consumers |
|---|---|
| Background | Shared environment clear/sky color. |
| Cap Primary | Even-species cap texture ratio plus corresponding purple spill/shaft light colors. |
| Cap Secondary | Odd-species cap texture ratio plus teal spill color. |
| Stems | Lower plant source-texture ratio, separated from caps by height. |
| Gill Glow | Downward-facing upper surfaces' emitted light and left shaft color. |
| Mycelium | Both path material families' diffuse/emissive tint. |
| Spores | Circular point color. |
| Atmosphere | Shared volumetric haze/mist scattering tint, independently of lights/caps/background. |

Cap/stem/path edits multiply source artwork relative to authored defaults, retaining
texture detail. Palette choices are persistent user truth; no automatic hue mode
or derived palette replaces them.

## Eight spatial programs

| Pattern | Native motion / event interpretation |
|---|---|
| Mycelium Tide | Radial bends/lifts; traveling kick lift, tangential snare, inward build/outward drop and radial light fronts. |
| Gill Spiral | Root-relative torsion with angular offsets; tangential kick/drop, angular snare and rotating gill accents. |
| Spore Choir | Zone-staggered tilts/lifts; answering vertical banks and spore rises. |
| Canopy Breath | Slow upper-cap expansion; local opening/closing with short vertical accents and upper-canopy glow. |
| Fairy Ring | Angular banks lean/lift sequentially; inward gathering and rotating emission. |
| Root Relay | Directional Z-progressive pulses with X bends; traveling ground-path light. |
| Bloom Ascent | Rising growth/cap opening; vertical event responses and height-weighted glow. |
| Psylo Release | Inward/vertical preparation followed by a traveling outward/upward release. |

Automatic changes use a 350 ms smoothstep convex blend; interrupted changes begin
from the current mixture. Roots and the final displacement bound remain intact.
Manual edits/reselection, permission/Trigger edits and reset reconstruction are
immediate. Pause, motion OFF, amount zero and speed zero hold blend progression.

## Audio and Director

Only shared Audio Intelligence facts/events are consumed. Existing frame-validity,
track-identity and ±0.5-second freshness gates reject unsupported/stale delivery.
No local music analyzer, beat estimator, phrase/drop detector or fabricated event
stream exists. Shared `Cinema2BeatClock` supplies native phase and performance
budgets; valid playback/no-source idle continues through analysis gaps, while
explicit pause/stop holds.

Phase 4's six fact routes and four event envelopes remain: energy gain .6–1;
bass bend ≤.24; highs spore gain .55–1; vocal restraint to .65; supported build
convergence ≤.15 per axis; kick/snare/beat/drop maxima .12/.15/.06/.25. Their finite
attack/release times are 20/220, 10/180, 10/250 and 20/800 ms. Facts use shared
smoothing, unavailable sentinels and native freshness gates. Envelope amplitudes
belong to shared Choreography; native event windows supply travel/permission only.

Director intensity/momentum/build/impact and a finite section-transition route
shape those actions within the same limits: range restraint ≤15%, light restraint
≤10%, momentum restores ≤.10 range factor (total ≤1), build ≤.15, qualified existing
event gain ≤1.25, section settling accent ≤.04 (120/600 ms), additional supported
vocal restraint ≤8%. Final resolved movement gain stays .4–1. Director frame and
discontinuity IDs must match selected audio. Missing/invalid context is neutral;
Director never selects patterns, writes design state or invents a drop. Full route
records remain in [Phase 4](PSYLO-phase4-report.md) and [Phase 5](PSYLO-phase5-report.md).

Phase 7 adds **22 parameter-only finishing rules**: fog/mist multiplication,
effect master gates and light strength/master/OFF factors. These run with no music
and use multiplication rather than replacement, so hard gates compose correctly.
All temporary values resolve through the shared target/value system.

## Pattern precedence and Auto Performance

Canonical Trigger IDs remain `beat`, `kick`, `snare`, `downbeat`, `beat2`, `beat4`,
`bar`, `bar4`, `bar8`, `phrase`, `drop`, with shared meanings/labels. Pattern Change
and Trigger edits rearm and consume current identities; duplicates cannot advance.
Manual Pattern selection/reselection establishes a visible base without turning
Pattern Change OFF. Only a later fresh selected Trigger advances that base.

Precedence: **authored manual base → enabled Trigger progression → permitted
finite build/drop substitution → current underlying base resumes**. The underlying
controller keeps progressing throughout an override. Auto Performance writes none
of Pattern, Pattern Change, Trigger, camera, palette or feature controls.

A fresh supported Director build episode (confidence ≥.45, value ≥.56; release
hysteresis .42) temporarily uses Canopy Breath, or Gill Spiral if the base is already
Canopy Breath. It ends with the episode or after eight shared-clock beats. A fresh
canonical semantic drop takes priority for four beats, using Psylo Release, or
Bloom Ascent when already on Psylo Release. Expired moments cannot restart until
new evidence arrives. Music Response zero does not revoke this separate permission.

Manual edits/reselection, OFF, context/source/seek/track reset and playing analysis
loss immediately cancel an override. Already-active build/drop identities are
latched and cannot undo a manual edit; a separately qualifying future event may
start another. Host pause holds the active presentation/budget even when audio is
hidden, and resume consumes current event identities before accepting later ones.
Analysis refresh/return preserves ordinary base/phase but clears stale presentation.
Re-entry restores saved controls and latches activation rather than replaying a
previous performance. No automatic camera domain is implemented.

## Lighting, atmosphere and finishing

The graph is **HDR scene color + real depth → volumetric atmosphere → HDR bloom →
cinematic finish → output**. Scene and intermediates use RGBA16F; scene depth is
Depth24. Final grading uses fixed exposure .96, contrast 1.08, saturation 1.05 and
restrained vignette, with no grain/aberration. Global exposure is not a substitute
for source radiance.

Three independent layers remain observable: textured emissive cap/gill/path
sources; real point/spot illumination on terrain/stems; and volumetric scattering
through a world-space medium. Four point lights and two overhead spots share final
lighting state with the native renderer and atmosphere. Ambient/moon fill is kept
low. Controls and Master multiply the accent rig without overriding zero/OFF.

Distance extinction begins at .009 × Fog Density. Ground density begins at
Ground Mist × Fog Density, with exponential world-height falloff above Y=.05.
Shared 3D noise adds layered billows/wisps and slow drift; rays reconstruct the final
camera and stop at scene depth. Screen-space radial shaft blur is disabled. Shafts
come from the authored light cones, not a flat overlay. Shadow-map carving is not
added; these are depth-terminated, unshadowed volume light cones.

A generic opt-in `config.idleMotion` lets this atmosphere advance authored drift and
smoke fade-in through missing analysis/no-source idle while holding pause/stop.
Other presets retain their previous timing. Tier profiles retain atmosphere/hero:
18/26/40 march steps and 0.4/0.5/0.5 reduced resolution at low/medium/high, with
existing bloom chain/texture quality policies. No mandatory hero feature vanishes
at low quality.

## Verification and acceptance

Run commands and exact counts, reference-region brightness measurements, quality
profiles and retained review captures are in [the final report](PSYLO-final-report.md).
Tests cover assets/clearance, controls, all programs/triggers, override precedence,
manual authority, transport, finishing gates, quality/aspect/re-entry/recovery and
cleanup. Earlier phase reports remain historical checkpoints.

Revision remains 2 so Phase 2–5 saved values still restore; new controls use authored
defaults when absent. Original assets/provenance remain immutable. No commit was
requested. Final acceptance was explicitly granted by the user on November 2, 2026;
automated pixels and timing measurements are retained as supporting evidence.
