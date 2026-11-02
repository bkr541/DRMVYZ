# PSYLO behavior and ownership specification

The user authorized Phase 3 after the Phase 2 handoff on November 1, 2026.
The current stable preset ID is `drmvyz.cinema2.psylo`, revision 2, visible name
**PSYLO**, catalog role **reference**. Camera, manual design, native motion and shared-audio response are
implemented; the preset is not yet a finished keeper. The original static asset
and geometry source contract remain unchanged.

## Geometry and composition

A purple hero grove, companion forms and 167 mushroom placements surround a
continuous 150 × 150 world-unit terrain. Groundcover, stones and 28 mycelium paths
are actual depth-tested geometry. Source display bases/cards were removed during
Phase 1. The prepared asset has 19 material batches and 205,371 triangles; both
quality variants preserve all of that geometry.

World space uses Y up, with the hero rooted near [0,0,-8]. Species were normalized
after imported transforms and grounded using the bottom 4% of their vertices.
Every vertex retains world root, normalized height, ID, zone, species and cap-region
attributes. Negative IDs identify stationary terrain/groundcover/stone/mycelium.
Quantized glTF node transforms restore world-space positions before deformation;
root attributes remain world-space. Source UV artwork and PBR materials remain.

The native shader applies per-species scale around each root, then pattern-specific
world-space displacement capped at 0.75 units. Motion weights approach zero at
stem contact. Surface normals use local deformed samples. Individual controls do
not transform the terrain or move roots. Forest Density masks the surrounding
population while retaining the seven hero/companion placements; it controls
appearance rather than reducing the submitted triangle count.

## Camera contract

The shared camera runtime selects an authored rig variant. There is one final
camera authority and no renderer-local camera or alternate render loop.

| Camera Mode | Behavior at speed 1, reference 100 BPM |
|---|---|
| Forest Travel | A closed, constant-speed spline through the ground corridor; 52-second lap. X stays approximately 0.65–1.3, eye height 2.5–2.7. |
| Grove Orbit | A true 360-degree orbit around the grove; 72-second revolution. Radius 14–22, elevation 40–60 degrees, editable initial heading. |
| Canopy Passage | An elevated closed spline around the forest; 72-second lap, authored heights 13–16. |
| Fixed View | The accepted static framing near [0,5.85,18.9], looking toward [0,3.5,-8]. |

Manual mode selection cuts to the selected authored shot and resets that rig's
progress. Motion OFF and Camera Speed zero hold the current position; they do not
keep advancing a hidden camera. Fixed View remains fixed. Field of View is 45–75
degrees. Near/far are 0.1/180 and narrow aspects use shared min-aspect framing.

Ground travel is deliberately offset to clear a left canopy at maximum growth and
motion. Orbit is elevated to keep a full revolution clear of the giant caps.
Focused source-geometry checks sweep all routes, loop joins and orbit radius/
elevation extremes. They conservatively cover scale 0.8–1.1, the full 0.75-unit
deformation allowance, a 0.3-unit camera margin and all stationary geometry height.

The generic camera additions are `rigVariants`, `controls.rigMode` and opt-in
`motion.idleMotion`. Presets without these declarations retain their existing
behavior. The compiler validates every alternative rig and selector option.

## Manual parameter-to-visible-output map

All controls use generic Inspector definitions and shared typography. User values
remain the authored base; native musical modulation is bounded by those limits.
Director, shared Choreography rules and Auto Performance are not active.

| Parent / control | Range / default | Real visible consumer |
|---|---|---|
| Master Controls / Master Intensity | 0–1 / 0.85 | Cap/gill/mycelium emission and spore opacity; physical surfaces remain readable at zero. |
| Geometry Motion | ON | Hard enable for geometry deformation; OFF restores undeformed plant shapes and holds spores. |
| Motion Amount | 0–1 / 0.5 | Root-weighted deformation amplitude. Zero restores geometry and holds phase. |
| Motion Speed | 0–2 / 1 | Integrated native pattern/spore phase. Zero holds the current phase. |
| BPM Sync | ON | Shared geometry and camera timing domains described below; OFF leaves audio accents active. |
| Music Response | 0–1 / 0.8 | Bounded shared energy, bands, vocal, rhythmic and structural responses. Zero restores authored native output without disabling Pattern Change. |
| Design / Pattern | Eight options | Native deformation vocabulary, selected immediately. |
| Pattern Change | OFF | Allows new qualifying shared musical events to advance the runtime base. OFF restores the authored Pattern. |
| Trigger | Eleven canonical options / Every 4 Bars | Visible only when Pattern Change is ON; selects the shared musical event used to advance. Retained while hidden. |
| Forest Density | 0–1 / 1 | Surrounding plant occupancy; protects hero/companion forms. |
| Mushroom Scale | 0.8–1.1 / 1 | Actual plant size about fixed roots. |
| Camera Mode / Motion / Speed | Four modes / ON / 1 | Shared final camera rig, hard movement gate and 0–2 rate. |
| Field of View | 45–75 / 58 | Shared projection. |
| Orbit Radius / Heading / Elevation | 14–22 / 18; -180–180 / 0; 40–60 / 45 | Orbit-only controls, conditionally visible in Grove Orbit. |
| Effects / Cap / Gill Emission | 0–1 / 0.6 | Source emission plus independently colored underside/gill surface emission. |
| Spore Density | 0–1 / 0.6 | Zero to 128 depth-tested circular point particles, animated through native phase. |
| Advanced / Quality | Shared enum / Auto | Existing quality policy and high/low texture variants. |

Effects here are native bioluminescent geometry/particles. Full fog, shafts, bloom
and final grading are still Phase 7; no inert finishing controls are exposed.

## Independent palette roles

| Palette control | Consumer |
|---|---|
| Background | Shared environment clear color. |
| Cap Primary | Even-species cap surfaces, including the purple hero. |
| Cap Secondary | Odd-species cap surfaces. |
| Stems | Lower mushroom surfaces, separated from caps by a smooth height mask. |
| Gill Glow | Downward-facing upper growth surfaces' emissive contribution. |
| Mycelium | Both ground-path material families. |
| Spores | Particle color, independent of density and cap colors. |

Cap/stem/mycelium edits multiply source texture artwork relative to authored color
bases; original detail remains visible. Gill and spore colors have separate
consumers. Stems is the seventh current live role; the proposed Atmosphere color
will be introduced with its real consumer in Phase 7.

## Native Pattern vocabulary

All patterns consume resolved controls and deform geometry, rather than only
changing brightness. Manual choices take effect immediately; when Pattern Change
is enabled, the selected new qualifying Trigger advances the runtime base through
the same eight programs. Transitions are immediate in Phase 3; authored musical
transition choreography is a later phase.

| Pattern | Native action |
|---|---|
| Mycelium Tide | Radial traveling bends and cap lifts. |
| Gill Spiral | Root-relative torsion with angular phase offsets. |
| Spore Choir | Zone-staggered tilts/lifts and answering spore rises. |
| Canopy Breath | Slow upper-cap expansion and height breathing. |
| Fairy Ring | An angular relay of outward lean and lift. |
| Root Relay | Directional Z-axis pulses with alternating X/Z bends. |
| Bloom Ascent | Rising growth and gradual upper-cap opening. |
| Psylo Release | Inward/outward preparation-release waves with distinct vertical timing. |

## Timing, idle and authority

Both camera and native motion use the existing `Cinema2BeatClock` and shared
transport/BPM facts. BPM Sync ON locks to available shared timing; OFF uses the
authored 100 BPM reference. Camera tempo rate is bounded to 0.5–2 before its user
speed multiplier. The preset toggle is authoritative for these domains; the host
BPM Sync preference is not a second hidden gate. No local beat/drop/phrase detector
or musical event source is created.

No-source idle deliberately runs authored motion. Playing through an analysis gap
continues at valid timing; explicit pause/stop holds. Timestamp deltas recover
procedural motion when the host's analysis-gated animation delta is zero. The
shared clock supplies tempo phase. Source/track/context changes and seeks reset
native phase; toggling Sync preserves the current position rather than jumping.
Re-entry reconstructs clean motion while preserving saved authored controls.

The full authority matrix remains in the reviewed implementation plan. Manual
Pattern selection is the authored base and never turns Pattern Change OFF. Runtime
Trigger advancement never rewrites saved Pattern/Pattern Change/Trigger. Same-value
reselection is a real manual edit; already-active events cannot immediately undo
it. Future bounded build/drop substitutions must preserve that base, and manual
camera edits must take over any future auto-camera domain. Zero/OFF permissions
remain hard gates throughout later phases.

## Shared-audio response map

All facts come from the existing Audio Intelligence bridge. The established shared
frame-validity gate rejects reset/empty frames, wrong tracks and data more than
0.5 seconds away from transport. Unavailable signals retain authored fallback;
there is no preset-local detector, BPM estimator or fabricated phrase/drop.

| Shared source | Native consumer / limit |
|---|---|
| Overall energy | Motion-range gain from 0.55–1 of the user's amount at full response, combined with bounded vocal restraint. |
| Bass | Root-weighted lateral bending, at most 0.24 world units before user amount and the final displacement clamp. |
| High energy | Spore occupancy from 0.55–1 of the authored spore ceiling; unavailable highs use the authored count. |
| Vocal presence | Up to 0.15 additional range/spore restraint; never replaces the user's settings. |
| Kick | Root-to-cap lift with a radial travel front, 0.36-second release. |
| Snare | Tangential zone accents and bounded spore displacement, 0.2-second release. |
| Beat/downbeat | Root-weighted vertical accent, 0.25-second release. |
| Supported build progress | Inward gathering (up to 0.3 units) and vertical compression (up to 0.18), before user amount/clamp. |
| Shared semantic drop | Outward traveling release and cap lift, 0.8-second release. No Director-derived substitute is used. |
| Continuous energy + rhythmic accents | Surface-emission level within the authored emission/master ceiling; never global exposure or hue replacement. |

Motion stays within 0.75 × resolved motion amount. Geometry Motion OFF, amount zero
and speed zero prevent audio displacement. Emission/master/spore zero remains off.
Colors, physical scale, population roots and camera authorization are never replaced.
Each native response channel is declared as an internal module target and composed
through the existing target resolver, using multiply around neutral 1 or add around
neutral 0. Expanded choreography routes remain Phase 4.

The canonical Trigger values are `beat`, `kick`, `snare`, `downbeat`, `beat2`,
`beat4`, `bar`, `bar4`, `bar8`, `phrase`, `drop`. The shared resolver owns their
meanings. Events are freshness checked and deduplicated; the module does not use a
fallback local musical clock to switch patterns. Pattern Change and Trigger edits
rearm and latch already-active events. Pause consumes/latches available identities;
the first resumed publication is latched too. A source/seek/loop reset restores the
authored base. Analysis refresh or return after a gap preserves the current runtime
base and latches current identities without resetting the motion phase.

The host intentionally hides audio snapshots while paused. Native delivery holds
its last response in that state, honors Music Response zero immediately, and
resumes the existing envelope without replaying paused hits. An actual playing
analysis gap clears unsupported response to authored fallback while procedural
motion continues. New valid data is rearmed on return. Track/context changes and
transport seeks clear volatile event state deterministically.

## System ownership and reproduction

The builder/source hashes/attribution remain Phase 1's immutable asset pipeline.
The native module owns resolved controls, shared clock consumption, target-resolved
audio delivery, canonical event selection and reset-safe native phase. Its scene controller owns shader uniforms and a bounded spore buffer.
The shared bridge owns source material clones, lighting/depth integration and
context access. The shared runtime owns camera rigs, targets, parameters, render
loop and resource leases. Spore geometry/material are explicitly disposed.

Revision remains 2 so existing Phase 2 authored state still restores; the new
Music Response control is filled from its authored default when absent.

Current checks:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2PsyloAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloCamera.test.ts
node scripts/cinema2-assets/accept-psylo-phase3.mjs
```

Results and review captures are documented in
[the Phase 3 report](PSYLO-phase3-report.md). Earlier phase reports/captures are
retained as historical checkpoints. Phase 4 has not begun.
