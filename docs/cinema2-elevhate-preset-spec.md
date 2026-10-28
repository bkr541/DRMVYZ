# Elevhate — accepted Cinema 2.0 preset

Status: **human visual acceptance approved on 2026-10-27.**
The user approved the full-route preview and requested continuation with the
remaining phases. Implementation and automated acceptance are complete; Elevhate
is now registered as a first-party **keeper**. No commit was requested; changes
remain uncommitted alongside the earlier work.

## Reference examined

The supplied name resolves to `/Users/kodyrobinson/Desktop/Elevhate.mov`, rather
than Downloads. The recording is 12.05 seconds, 954 × 954, with H.264 video at
approximately 25.5 recorded frames/second and an AAC audio stream. Inspection
sampled the full clip and a denser eight-frames/second sequence of its first
three seconds. Reference captures are under `artifacts/elevhate-reference/`:

- `contact-sheet.jpg`: overview of the complete recording.
- `first-cycle.jpg`: closely spaced frames from the opening three seconds.
- `junction-3.5.jpg`: a full-resolution crossing/intersection view.
- `level-change-7.5.jpg`: a full-resolution stacked-bay view.

### Observed visual grammar

- The environment is almost entirely black and white. Large, nearly black
  rectangular faces occupy the foreground; thin white outlines define their
  edges. This is a mass-and-void composition, not just floating luminous rings.
- Cuboid surfaces extend into depth. Receding edges converge toward a central
  vanishing region, with many smaller square/rectangular openings visible
  behind the nearest structure.
- Strong horizontal and vertical gaps form cross-shaped junctions. Openings
  above, below and beside the current passage reveal a larger connected lattice.
- Foreground faces occlude distant outlines. That occlusion, together with
  parallax and changing views of top/bottom faces, makes the spaces feel solid.
- As near blocks pass outside the frame, other bays and stacked levels become
  visible. The route feels continuous; a level transition should read as the
  camera passing a physical ledge into another occupied level.
- The dominant orientation stays upright. The reference does not depend on
  barrel rolls, handheld shaking or kick-driven camera zooms.
- Dense distant edges converge into bright regions; the near geometry remains
  dark enough to preserve its silhouette. There is some fine speckling around
  highlights, which may include source rendering and recording compression.
- The back, fullscreen and replay buttons and the small frame-counter text are
  recording/player UI. They will not be reproduced.

The original generator, exact mesh layout, absolute camera coordinates and
music-control mapping cannot be recovered from a screen recording. Repeated
similar views are consistent with a regular/repeating 3D lattice; they do not
prove a particular fractal algorithm or an exact clip loop. The implementation
below is a reconstruction of the visible grammar, with the user's requested
multi-directional physical travel as an intentional extension.

## Proposed hero visual

Working preset name: **Elevhate**.

An endless-looking, solid black cubic megastructure with fine white emissive
edges. The camera travels through square passages and six-way junctions, climbs
above the current level, descends below it, and traverses left/right/backward
connections. The levels remain visible during each transition. White-on-black
is the authored default; independently editable colors remain available.

Mandatory reference characteristics:

1. Solid occluding cuboids with thin outlined edges.
2. Deep, repeated square openings and readable crossings.
3. Visible stacked levels, including the level just left behind.
4. Continuous physical camera translation, with no teleport or empty reset gap.
5. An upright, deliberate camera and strong perspective/parallax.

Inspirational rather than mandatory: the exact source travel speed, apparent
fine grain, blown-out distant pixels and precise arrangement of every block.
Heavy haze, wet-floor reflections, colored nightclub lights and giant bloom
halos are not part of the baseline composition.

## Geometry specification

- **Space:** real world-space geometry; +Y is up, the initial forward axis is
  −Z, and the initial left/right axes are −X/+X.
- **Grid:** a 12-unit cubic pitch. At the default opening, 8-unit black corner
  masses leave 4-unit clear passage bands. Shared corner masses are generated
  once rather than drawing overlapping copies of the same solid.
- **Major elements:** a local, deterministic lattice around the camera, with
  multiple populated bays in every direction. Initial quality budgets are
  approximately 9³ cells on Low, 11³ on Medium and 15³ on High, subject to the
  core-visual review and actual measured GPU budget.
- **Construction:** reusable instanced cuboids with depth-tested opaque faces
  and derivative-antialiased edge emission. Additional inset rims, ledges and
  split edge rails define the pattern families. Outline thickness has a minimum
  readable screen-space width; distant geometry must not dissolve into moiré.
- **Origins and pivots:** grid-cell and junction centers are world-space anchors.
  Pattern motion stays around those anchors, without rotating the whole world.
- **Reserved travel volume:** every route segment and rounded junction has a
  clear swept volume. Pattern variants and musical modulation cannot place
  geometry inside it. At minimum opening, retain at least one world unit of
  camera clearance, including the turn fillet and any permitted sway.
- **Endpoints:** passages meet through genuinely open junctions. A rendered
  portal is never a solid end cap. Upper/lower openings are backed by actual
  adjacent levels, not a texture or fade to another scene.
- **Depth:** opaque faces write/read depth; hidden rear edges do not show through
  them. HDR edge color and the same scene depth feed the finishing passes.
- **Repetition:** the active world window follows canonical grid coordinates.
  Populate the viewing region before turns and in all junction exits. Cell
  rebasing must preserve world identity and must not expose a dark boundary.
- **Aspect:** perspective projection adapts to square, landscape and portrait
  canvases. The geometry surrounds the camera rather than being frame-anchored.
  The reference composition is first checked at 1:1, then at production ratios.

Opening Width changes the solids/openings while grid pitch and route remain
fixed, so it has a visible result. Pattern interpolation must preserve the
reserved camera volume at every intermediate value.

## Camera and movement specification

The journey is authored and deterministic. It is not randomly steered by
musical hits. Horizontal changes use rounded junction turns; changes in height
use continuous translation through an occupied shaft/intersection. Movement
has continuous velocity and a stable horizon, without per-kick zoom or roll.

Default route, in world coordinates (one level/bay = 12 units):

| Point | Position | Incoming movement |
| --- | --- | --- |
| 0 | (0, 0, 0) | Start |
| 1 | (0, 0, −24) | Forward |
| 2 | (0, 12, −24) | Up to the next level |
| 3 | (−24, 12, −24) | Left |
| 4 | (−24, 12, −48) | Forward |
| 5 | (−24, 0, −48) | Down to the starting level |
| 6 | (0, 0, −48) | Right |
| 7 | (0, −12, −48) | Down below the starting level |
| 8 | (24, −12, −48) | Right |
| 9 | (24, −12, −24) | Backward |
| 10 | (24, 0, −24) | Up |
| 11 | (24, 0, 0) | Backward |
| 12 | (0, 0, 0) | Left into the next lap |

The route forms a loop with 20 bay lengths and visits upper, middle and lower
levels. Extra approach/exit samples and rounded fillets will make its closure
and junctions smooth; these table entries are anchors, not linear stop points.

- Default pacing: four shared beats per bay at Travel Speed 1. At 120 BPM the
  full route takes about 40 seconds. Speed remains user-adjustable.
- The gaze previews the next horizontal passage. During ascent/descent it keeps
  a horizontal reference with restrained vertical pitch, so the viewer can see
  the old level receding and the new level arriving. The baseline is an elevator
  transfer, not an uncontrolled flip to look exactly straight up/down.
- Shared Camera Runtime owns the final pose, view/projection matrices and lens.
  The native renderer and effects use that same camera. No shader-only camera.
- FOV starts around 80 degrees; final framing is chosen against the reference
  during the core review. Default roll is zero, and any optional banking is
  bounded to approximately one degree.
- Travel Speed 0 holds the camera. Music may continue to animate light programs.
  Camera Sway 0 is a hard zero. Neither control is re-enabled by automation.
- Both forward/vertical path joins and the loop closure are tested for position,
  orientation and velocity continuity. No shared camera API extension is
  assumed necessary until the real path is tested.

## Six native Pattern options

All options preserve the open route and the black-cuboid identity. They are
structural programs, not six aliases of the same brightness animation.

| Pattern | Visible construction/behavior |
| --- | --- |
| Crossgrid | Regular corner blocks and single outlined square passages; closest to the recording. Default. |
| Nested Bays | Repeated inset square rims create a layered threshold inside each bay. |
| Crossroads | More pronounced open hub chambers, with emphasized perpendicular passage frames and branch sightlines. |
| Terraced Stacks | Strong horizontal ledges and open vertical framing make successive levels especially readable. |
| Offset Blocks | Alternating outward setbacks and block depths create an asymmetric, staggered silhouette while preserving the route. |
| Split Frames | Paired edge rails and split corner assemblies produce a segmented square framework around the solids. |

Manual changes begin visibly on the next frame with a short, bounded transition
(approximately 0.35 seconds). Topology/shape interpolation cannot obstruct the
camera. Pattern Change defaults OFF. When enabled, the canonical Trigger can
advance the underlying base through the six programs without immediate repeats.

## User controls and palette map

Every visible control belongs to one of the four canonical parents.

| Parent | Proposed controls |
| --- | --- |
| Master Controls | Master Intensity (0–1.5, default 1), Travel Speed (0–2, default 1), Music Response (0–1, default .8), BPM Sync (ON), Auto Performance (OFF) |
| Design | Pattern / Pattern Change / conditional Trigger; Opening Width (3–6, default 4); Edge Thickness (.6–3 px, default about 1.15); Camera Sway (0–.2, default .025) |
| Effects | Bloom (0–1, default .2); Depth Haze (0–.05, default .004) |
| Palette | Void, Structure, Primary Edges, Junction Edges, Secondary Edges |

The palette starts monochrome: near-black void/solids, white primary/junction
edges and slightly quieter secondary edges. The five controls have separate
consumers: background, solid faces, ordinary structural outlines, hub frames,
and secondary/inset rails. No automatic color mode replaces these choices.

Control ranges are targets for the initial visual implementation. A range may
be narrowed if its extreme cannot preserve camera clearance or readable geometry;
such a change must be documented rather than leaving a broken control extreme.

## Audio, timing and system ownership

Audio Intelligence provides facts; Visual Director supplies significance;
Choreography routes/smooths facts and owns event envelopes; the native module
constructs geometry and interprets resolved program inputs. Parameter State
owns saved values. Shared camera, resources, depth, effects and render graph
remain the production authorities.

No new detector, local BPM estimator, audio analyzer or competing event clock.
The required preset BPM Sync uses shared Cinema 2.0 timing and is independent
of the host dock toggle: ON follows an available track tempo/grid; OFF uses
120 BPM. It governs travel pacing and light-wave timing without disabling other
music responses. Phase/rate changes are eased rather than snapping position.
Without audio the geometry remains visible and the authored journey continues;
explicit pause/stop holds motion. Seek, loop and source changes reconstruct
volatile timing/envelopes deterministically.

| Shared source | Visual response | Bounds and timing |
| --- | --- | --- |
| Overall energy | Secondary edge coverage/weight | Up to +15%; about 180 ms smoothing. Does not steer the camera. |
| Bass | Small inset-rim depth/width pressure | Up to 8% of its authored cosmetic range; cannot change route clearance. |
| Kick | Local primary-edge pulse | Up to +.45 emission and a small width accent; ~20 ms attack, .25 s release. |
| Snare/highs | Orthogonal edge-bank accents and sparse glints | Up to +.35 accent / +.1 shimmer; ~.3 s snare release. |
| Downbeat | Traveling hub-to-hub light wave | Traverses existing geometry; shared beat timing, no camera jump. |
| Build | Bounded inset compression and junction tension | Up to 8% compression; ~.4 s smoothing; releases to the user's setting. |
| Drop | A larger outward edge wave | Up to +.65 emission / 8% cosmetic relief; ~1.2 s release, no mandatory strobe. |
| Vocal presence | Restraint of secondary decorations | Up to 20%; load-bearing blocks and navigation outlines remain readable. |
| Director intensity/momentum | Bounded secondary detail and light-wave speed | Approximately ±10% detail / +15% light-wave rate; does not own travel. |

All strengths are scaled by Music Response and Master Intensity. Zero values
remain zero. Only available, confidence-qualified structural facts can authorize
a build/drop performance substitution; no new musical facts are inferred here.

## Authority matrix — approved

| Property | Manual control | Audio modulation | Visual Director | Auto Performance | Manual edit behavior |
| --- | --- | --- | --- | --- | --- |
| World layout/openings | Opening Width; Pattern | Cosmetic insets only, at most 8%; never blocks the path | Bounded secondary detail only | Temporary Pattern substitution only | Opening edits remain authoritative; Pattern edits reclaim the base immediately |
| Camera route/level transfers | Authored multi-axis journey | None | None | No authority | Route stays deterministic; no audio-driven rerouting |
| Travel rate | Travel Speed; BPM Sync | Shared tempo only when authorized by BPM Sync | None | No authority | Immediate/eased rate change without teleport; zero holds the camera |
| Sway/lens/horizon | Camera Sway; authored lens | None | None | No authority | Sway zero stays off; no kick zoom or barrel roll |
| Pattern/base program | Pattern | Current program reacts within bounds | Build/drop significance may qualify a temporary override | Optional temporary Nested Bays on build / Crossroads on drop | Immediately sets visible base; leaves Pattern Change ON if already ON; suppresses the already-active auto episode |
| Base pattern cycling | Pattern Change and canonical Trigger | Only a new qualifying selected event advances the base | Cannot invent a trigger | Underlying base continues well-defined cycling during a temporary override | Toggle/Trigger edits latch existing events; no stale replay or duplicate switch |
| Brightness | Master Intensity | Bounded additive pulses under the user ceiling | Bounded significance gain | Cannot break the ceiling or a zero | User base retained; zero extinguishes geometry/effects |
| Palette | Five role colors | No replacement | No replacement | No authority | Direct user ownership |
| Edge thickness/decorations | Edge Thickness; selected Pattern | Small, bounded accents | Bounded detail restraint/lift | Cannot replace the user's thickness or route clearance | Direct user base, with hard minimum/maximum respected |
| Bloom/haze | Independent effect amounts | Bounded lift proportional to the user's amount | May scale within the authored cap | Cannot re-enable an OFF effect | Zero bypasses the effect; returns to user amount after events |

Pattern precedence: manual selection establishes the base → a fresh selected
Trigger may advance that base while Pattern Change is ON → authorized Auto
Performance may temporarily substitute a build/drop program → the current
underlying base resumes. No persisted Pattern, toggle, Trigger or palette value
is rewritten. A manual selection is not canceled by the already-active event.

## Implementation sequence and acceptance checkpoints

1. **Core:** native instanced solid cuboids and occluded antialiased edges, no
   audio/automation/effects hiding geometry. Compare default square-canvas views
   against the recording's close blocks, cross junctions and receding openings.
2. **Camera:** complete the physical multi-axis loop and prove level transfers.
   Capture before/mid/after ascent and descent, plus left/right/backward travel.
   Verify reserved-volume clearance and populated neighboring levels.
3. **Manual controls:** show minimum/default/maximum states, all six patterns,
   all five independent colors, speed zero, sway zero and the real Inspector.
   Verify parent/nested/portaled typography through the shared roles.
4. **Timing/audio:** validate BPM Sync ON/OFF with distinct tempos; quiet/groove,
   kick, snare, build, drop and vocals must affect their intended regions.
5. **Authority:** all 11 canonical triggers, duplicate suppression, edits while
   cycling, manual takeover during a build/drop, automatic restore, effect OFF
   and master blackout. Verify no saved values are overwritten.
6. **Reliability:** pause/resume, analysis gaps, seeks, loops, track changes,
   preset re-entry, square/landscape/portrait/resize, quality tiers and resource
   disposal. Inspect at least two complete route boundaries for black gaps.
7. **Finishing:** add restrained HDR bloom/depth haze only after the core passes;
   test OFF/default/max. Preserve the reference's black mass and white linework.
8. **Human visual review:** present actual production captures and motion clips
   against the reference. Compilation/pixel metrics alone cannot establish
   completion. User visual acceptance is required before finished-preset status.

The implementation will use the existing native module registry, shared
parameter/target resolver, canonical Trigger options, Choreography and Camera
Runtime. The existing Depth/Cathedral instancing and resource patterns provide
relevant construction references; their straight-ahead camera/geometry loops
must not be mistaken for a ready-made multi-axis solution.

## Implementation and review handoff

The user approved this specification and authority matrix with “Approve and
build.” Native files are `modules/elevhate/Cinema2ElevhateGeometry.ts`,
`Cinema2ElevhateRenderer.ts`, `Cinema2ElevhatePerformance.ts`,
`modules/Cinema2ElevhateNativeModule.ts`, `presets/Cinema2ElevhatePreset.ts` and
`Cinema2ElevhateChoreography.ts`, under `src/components/vyzualz/cinema2/`.
The user subsequently approved the production preview (“Approved. Please continue
with the next phases.”). The catalog now registers Elevhate as **keeper**, and
the manifest carries the matching keeper tag. Its stable preset ID and saved
control IDs remain unchanged.

The shared Camera Runtime now treats a bound Travel Speed of zero as a hold
for its sway phase as well as its travel clock. Cameras with a speed control
also reset volatile flight timing on seeks, source changes and context changes.
Existing camera controls retain their ownership and separate native light
clocks continue during a camera hold.

Structural meshes use 9³ / 11³ / 15³ masses on Low / Medium / High. Nearby
collars use a separate bounded shared instance window and disappear before
that window rebases. All buffers are allocated through the native resource
pool; no per-frame geometry is allocated. The densified rounded path avoids
Catmull–Rom overshoot caused by uneven straight/corner knot spacing.

Automated evidence:

- `Cinema2Elevhate.test.ts`: six-pattern manifest, four parent groups, five
  palette roles, all eleven canonical triggers, duplicates/manual takeover,
  temporary auto overrides with maintained base, pause/gaps/seek/track reset,
  shared tempo/free timing and two-loop camera clearance/heading continuity.
- `accept-elevhate.mjs`: the actual Cinema 2.0 runtime, native renderer, shared
  camera, finishing passes, AudioFeatureBus fixture and React Inspector. Covers
  two populated loop boundaries; structural programs; independent palette;
  opening/edge/master/bloom/haze extremes; energy, rhythmic and structural
  response; all eleven triggers; auto restoration/manual takeover; BPM Sync;
  zero speed; pause; square/landscape/portrait resize; re-entry; quality tiers;
  and zero active leases/estimated target bytes after disposal.
- Shared camera regression checks include CameraTempo, BlockshiftMotion,
  ThresholdCamera and NightshiftPanRoom.

Commands:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Elevhate.test.ts
node scripts/cinema2-assets/accept-elevhate.mjs
node scripts/cinema2-assets/accept-elevhate.mjs --preview
```

`--music` and `--lifecycle` run focused browser subsets while iterating.
Generated captures/reports are ignored artifacts under
`artifacts/cinema2-elevhate-loop/`; `elevhate-journey.mp4` records the full
40-second native journey. Reference captures remain under
`artifacts/elevhate-reference/`.

Review the preview against the source for black-face visual weight, thin
outline density, upright turns, physical ascent/descent and the expanded
left/right/back route. The source's exact generator and timing remain unknown;
this is the approved reconstruction with intentional multi-directional travel.
**Human visual acceptance is complete.** Elevhate is a finished first-party
keeper implementing the approved reconstruction, rather than a claim to reproduce
the unknown original generator exactly.


Final automated result: **44 unique focused tests passed** across Elevhate,
CameraTempo, BlockshiftMotion, ThresholdCamera and NightshiftPanRoom. TypeScript
`--noEmit`, focused ESLint and `git diff --check` passed. The complete browser
acceptance passed with no captured shader/WebGL/page errors; detailed values
are in `artifacts/cinema2-elevhate-loop/report.json`. No commit was created.


## Acceptance closure — 2026-10-27

All implementation phases (geometry, camera/controls, Audio Intelligence,
Choreography, Director, Auto Performance, finishing and acceptance) were already
implemented and validated before the human-review checkpoint. The user's visual
approval closes that final gate. This phase promotes the catalog role and tag,
records acceptance, and validates the actual keeper declaration against the
shared authoring gate and native compiler. The focused Elevhate suite also
protects keeper registration. No deployment or commit is part of this handoff.
