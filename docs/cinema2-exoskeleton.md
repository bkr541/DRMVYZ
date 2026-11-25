# EXOSKELETON | Adaptive mechanical armor

Status: selectable first-party reference; human visual acceptance pending. No keeper promotion. All assets are original procedural geometry and authored blueprint artwork; no remote asset dependency or external license.

## Design and ownership

A vertical service chamber with recessed hexagonal bays, six support ribs, overhead service ring, circular floor plinth, faceted fallback core and five independent armor banks. The open front is intentional. Beveled extruded armor panels have separate edge/face materials, inner backing, luminous seam, rail and hinge pin. A hinge rotates about its rail pivot rather than scaling the user's model. The native manifest owns the four Inspector parents, camera, lighting, effects and output graph; the module owns the Three bridge and private model slot; the scene owns procedural resources; performance owns ephemeral phase and shared controller/resolver instances. The shared transport, audio intelligence, director, conductor and choreography own musical facts and modulation. No new shared renderer, UI, clock, state store, dependency, storage schema or output adapter.

World units, right-handed Y-up, camera toward -Z. FOV 42°, position (.7,.85,10.8), near .12/far 65, minAspect 16:9; shared camera controls and safety limits; no separate editor-rail camera. Floor top -4.05. The imported asset is uniformly fitted to bounding radius 1.65; offsets max .18 units each, scale .5–1.2; original local orientation, UVs and texture maps retained. Cached world AABB includes original transforms, then its corners are transformed by the instance pose. Armor banks follow the resulting bounding box with extra separation max(.12, largest half extent × clearance) plus .05. Plate extrusion uses generated UVs; local +Z is outward; positive hinge rotation opens away from hero. Front bank is deliberately absent; aperture shortens the depth of the side/top/bottom banks. Count 12/18/24 rebuilds only when changed. Bottom travel capped at .30 for floor clearance. Actual projected aperture percentage and inter-bank/room collision extremes still require production visual verification.

## Authority and visible controls

All values authored and persisted via existing schema. `A` means authorized transient Audio/Director/Mood modulation, never persistence. User edit updates baseline immediately when unlocked. Shared Auto lock disables Master (except BPM Sync and Auto), Design, Effects and Reset; Palette stays editable; source manager remains canonical. Shared live values/notes are used unchanged. No new Inspector code.

| Property | Manual control / visible output | Audio | Director | Auto Performance | Manual edit |
|---|---|---|---|---|---|
| Quality | shared tier; pin detail | no | no | no | tier retained |
| Auto Performance | authorizes shared policy | no | no | gate | disables transient policy on OFF |
| BPM Sync | shared clock | tempo | no | no | phase continuous |
| Master Intensity | light and motion gain | A | A | mood/coverage | baseline |
| Music Reactivity | modulation strength | gate | gate | gate | zero removes routed strength |
| Motion Safety | full/reduced/lockoff | no | no | no | hard motion bound |
| Pattern | six pose programs | events if authorized | no | effective choices only | immediate |
| Pattern Change | event cycling | authorized | no | effective resolver | saved value retained |
| Trigger | canonical 11 options | event identity | no | effective resolver | next fresh event |
| Camera Motion | camera authorization | no | no | no | hard off |
| Camera Amount | camera excursion | no | no | shared coverage | baseline |
| Model binding | pinned asset | no | no | no | canonical selector |
| Model Visible | hero visibility | no | no | no | hard off |
| Model Scale | uniform safe fit | no | no | no | baseline |
| Model X | horizontal fit offset | no | no | no | baseline |
| Model Y | vertical fit offset | no | no | no | baseline |
| Model Z | depth fit offset | no | no | no | baseline |
| Model Yaw | local yaw | no | no | no | baseline |
| Model Pitch | local pitch | no | no | no | baseline |
| Model Roll | local roll | no | no | no | baseline |
| Material Mode | original/brushed/edge surface emission | no | no | no | original restored |
| Hero Motion | bounded float/lean | energy | no | coverage | baseline |
| Hero Emission | local rim light | no | no | coverage | baseline |
| Plate Count | 12/18/24 real panels | no | no | no | rebuild |
| Shell Clearance | fit separation | no | no | no | recompute |
| Plate Opening | hinge angle | A | build | mood | baseline |
| Deployment Travel | outward translation | A | impact | mood | baseline |
| Plate Thickness | extrusion | no | no | no | rescale |
| Seam Gap | separation | no | no | no | rescale |
| Motion Rate | hinge phase | BPM | no | mood | phase continuous |
| Front Aperture | open shell depth | no | no | no | rescale |
| Interior Emission | seam gain | highs, accents | build | mood | baseline |
| Relay Rate | packet phase | BPM | no | coverage | phase continuous |
| Bloom | HDR bloom | no | no | mood | zero remains off |
| Atmosphere | depth haze | no | no | coverage | zero remains off |
| Reflection Strength | environment response | no | no | coverage | zero remains off |
| Shadow Strength | key light contrast | no | no | coverage | baseline |
| Light Spill | bounded local lights | energy | no | mood | zero remains off |
| Cinematic Finish | output grade | no | no | coverage | zero remains off |
| Background | #070A10 sky | no | no | no | editable |
| Structural | #29313A plates/ribs | no | no | no | editable |
| Primary Energy | #48E8FF seams | gain only | no | no | editable |
| Secondary Energy | #9564FF housing/alternate seams | gain only | no | no | editable |
| Accent | #E8F1FF edges/pins/hero rim | gain only | no | no | editable |

## Pattern and musical behavior

Armor closes in staggered banks; Deployment opens in a radial sequence; Retraction pulls back; Exposure alternates diagonal banks; Mechanical Relay sends a hinge/lighting wave; Full Assembly closes in a synchronized latch then releases. All use bounded hinge rotation 0–65° and outward travel 0–.60. Pattern controller and auto override helper share canonical trigger identities, reset, saved/effective separation and temporary overrides; resolver inspect exposes the effective trigger. BPM Sync combines host and preset permissions using `Cinema2BeatClock`; free-run reference 90 BPM, 8-beat main hinge cycle (~5.33s), 4-beat relay cycle, stagger ~0.4s. Transport pause freezes phase, reset on discontinuity, idle slower. No local musical inference.

| Signal | Destination / bound | Shared smoothing or attack / hold / release (ms) |
|---|---|---|
| Sub/bass | +.20 travel, bounded | 160/120 smoothing |
| Mid | +.15 opening | 150 smoothing |
| High/air | +.15 seam contribution per band | 100/125 smoothing |
| Energy | local spill / hero motion | 180 smoothing |
| Vocal | up to 30% motion reduction | 220 smoothing |
| Director build | -.20 opening | 200 smoothing |
| Director impact | drop release multiplier .7–1 | 150 smoothing |
| Kick | +.25 opening alternating pairs | 30/25/240 |
| Snare | +.20 alternating seam gain | 20/20/180 |
| Downbeat | +.38 seam accent | 55/50/380 |
| Phrase | +.20 seam accent | 150/100/800 |
| Drop | +.45 opening, +.35 travel, seam impact | 170/100/1230 |

Choreography routes replace normalized private signal inputs, then scene adds bounded contributions to authored resolved bases. Strength Music Reactivity; geometric response also scales Master Intensity and safety. Non-drop musical events/continuous inputs carry not-silent; drop remains ungated. Auto Performance mood drives use the shared helper, clamped and reactivity-gated: Opening .55 +.15 energy; Travel .45 +.20 shock; Motion Rate 1 ×1–1.30 momentum; Interior Emission .55 +.15 build; Bloom .25 ×1–1.4 peak; Spill .30 ×1–1.4 brightness (multipliers preserve zero hard-off); Intensity .75 -.35 silence. Shared coverage supplies remaining eligible drives, with fit/geometry exemptions. Calm Retraction/Exposure; driving Relay/Deployment; tense Armor/Full Assembly; peak Deployment/Full Assembly. Optional build Armor/drop Deployment via existing helper. Saved parameter values are not changed.

## Model, quality and lifecycle

Hidden model binding uses existing model manager/source selection, version pin, cache/lease, cancellation and account invalidation. Fallback core on missing/loading/default, no stale selected asset. Bridge owns instance-local material clones; original mode restores PBR properties, brushed changes roughness/metalness, edge is surface emission plus rim rather than a dedicated outline shader. Geometry/textures remain lease-owned. Procedural resources use shared geometries and bounded materials, two spill lights and hero rim; low quality drops alternating hinge pins. No measured performance claim. Production preview, casting and recording use the common render graph.

## Validation and outstanding gates

Focused tests cover authored/covered schema, parent groups, canonical triggers, palette, model binding, exact plate counts, fit-relative clearance math, distinct poses, pose bounds, manual pattern selection, pause and track reset. Production browser capture, actual imported asset pixel verification, all trigger/seek/account scenarios, Inspector marker and lock measurements, full build, FPS/resource stability and human acceptance remain required. Dependency installation blocked by unavailable npm registry DNS in the implementation environment. Do not promote this reference to keeper until those gates pass. No captures are supplied or claimed.
Source-level checks: global TypeScript 5.8.3 transpileModule syntax validation passed for 11 changed TS/TSX files. A Node assertion harness executed the actual transpiled geometry domain: 5,760 pose samples, exact counts, fit clearance cases and six distinct pose signatures passed. These are not semantic typechecking, Vitest or pixel evidence.
