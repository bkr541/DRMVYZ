# NIGHTSHIFT — reference analysis and behavior specification

Status: Steps 1–8 implemented and accepted, October 23, 2026. Registered as
**NIGHTSHIFT**, a keeper preset; stable ID and revision 2 preserve existing edits.
See [final acceptance](NIGHTSHIFT-final-report.md) for results and performance limits.
The user confirmed reference framing with optional subtle movement,
slow ball rotation, music-driven floor programs, the reference palette editable
under Palette, and club haze/fog. The user approved the authority matrix below
and selected Auto Performance OFF by default. See the
[Step 1 report](NIGHTSHIFT-step1-report.md) for the accepted static checkpoint and
[Step 2 report](NIGHTSHIFT-step2-report.md) and
[Step 3 report](NIGHTSHIFT-step3-report.md) and
[Step 4 report](NIGHTSHIFT-step4-report.md) and
[Step 5 report](NIGHTSHIFT-step5-report.md) and
[Step 6 report](NIGHTSHIFT-step6-report.md) and
[Step 7 report](NIGHTSHIFT-step7-report.md) for the current implementation.

### Spatial revision after Step 2 review

The user approved Step 2's controls/motion, then requested a larger-feeling room,
a slight zoom out, the ball farther back and higher, and ceiling lighting extended
backward and outward. This direction supersedes the original image's intentional
ball-crown crop and the initial camera/fixture coordinates.

- Camera: Z 13.5 → 14.5, vertical FOV 40° → 42°, same eye height/look-at target.
  Camera safety follows the new base position and permits FOV 41°–43°.
- Ball: center `(0, 4.84, 0)` → `(0, 5.7, -2.3)`, unchanged physical radius. Its
  apparent size decreases through actual depth, and its full crown now has room
  inside the frame. The light target and rim lights follow the new ball placement.
- Ceiling: side rails X ±3 → ±5.2, rear Z -1.5 → -7, rail length 9.5 → 16;
  the luminous strips sit at Y 6.35. The rear rail remains behind the ball.
- Floor: X/Z footprint scaled by 1.175 to maintain the foreground anchor under
  the pullback. The 100 tile addresses, instancing, and material controls persist.
- No new geometry families, textures, effects or musical behavior were added.
  Model triangle count and texture dimensions remain unchanged.

Latest capture: [larger room framing](NIGHTSHIFT-larger-room.png). The initial
reference and earlier phase captures are preserved as historical checkpoints.

### Step 2 implementation decisions

- The camera remains fixed by default. Camera Motion uses shared bounded drift
  on the host visual timeline, with zero roll and automatic restoration to the
  reference framing at zero. It does not yet receive music-driven choreography.
- NIGHTSHIFT now has its own native module and scene controller. Floor panels
  and frames are rendered as two instanced batches while retaining cell addresses.
- BPM Sync governs floor program timing and ball rotation through the shared
  `Cinema2BeatClock`. This preset's toggle is independent of Audio Dock BPM Sync;
  that host preference does not override NIGHTSHIFT's local timing choice.
- Sync OFF uses the declared 100-BPM authored rate. Motion Amount scales rate
  relative to its 0.35 default without jumping phase. Ball Rotation OFF holds the
  current angle; restoring ON resumes from that angle.
- With no track, the module supplies shared render-timestamp deltas to that same
  shared clock for decorative idle. Loaded/paused playback freezes its motion.
  Camera drift continues to follow the host visual timeline, not a local clock.
- The native Pattern Change consumer uses the canonical event resolver and
  advances only on shared events. It invents no musical boundaries. Step 3 now
  validates all eleven triggers and transport transitions on the native canvas.
- User edits have a nonpersisted revision identity, propagated through the
  generic parameter/target/module path. Reselecting the same Pattern or resetting
  it can therefore reclaim the authored base without disabling Pattern Change.
- Six palette roles are editable, including background. Reflection shader
  uniforms recolor the static IBL's chromatic contributions without rebuilding
  environment maps per frame; mirror tint remains separate. Light-rig colors
  also consume palette bindings. White glints remain specular highlights.
- Auto Performance is now exposed under Master Controls with its Step 6 consumer,
  OFF by default. Step 7 now implements the Effects controls; see its report.

## Source of intent

The user's request is to create a new Cinema 2.0 preset named **NIGHTSHIFT** using
the attached image as the desired result. The supplied
[creation contract](DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md) supplies the
implementation requirements. Asset metadata supplies provenance and technical
facts; imported animations are candidates, not instructions defining the preset.

The attached image is preserved as [NIGHTSHIFT-reference.png](NIGHTSHIFT-reference.png).
This is a new preset, not a legacy port. Legacy A/B requirements do not apply;
reference-to-production visual comparison does.

## Reference analysis

The reference is 1672 × 941, approximately 16:9. Coordinates below are approximate
measurements of this image, with origin at the top left. They are composition
targets for the default shot, not hardcoded pixel coordinates for other sizes.

| Element | Reference observation | Implementation consequence |
|---|---|---|
| Hero disco ball | Approximately x=633–1039, y=0–408; center near (836, 204). About 24% of frame width and 43% of height. Crown meets/is slightly clipped by the top edge. | One large upper-center hero with a reference-specific top crop; preserve its bottom and lateral silhouette. Do not shrink it to fit an arbitrary scene box. |
| Mirror surface | Dense latitude/longitude tile grid, thin dark seams, many dark facets, selective near-white specular highlights. Magenta lower half, warm upper-left edge, cool upper-right edge. | Preserve real facet structure and directional highlight variation. A uniformly emissive smooth sphere will miss the target. |
| Ceiling frame | Broad cyan luminous strips recede from the upper corners into a horizontal rear rail at about y=175–220, behind the ball. | Build a physical overhead frame with visible thickness and dark edge housing; ball must occlude its central rear segment. These are architectural light strips, not free-floating laser beams. |
| Dark separation | Ball bottom around y=408; floor rear edge around y=573. Approximately 17% of frame height remains between them. | Maintain this quiet region. Haze and broad bloom must not fill it into a bright wall. |
| Dance floor | Rear edge roughly x=395–1275 at y=573; widens beyond both sides near the bottom. Front lip around y=900. | Low frontal perspective, regular world-space tile grid, long receding rows, foreground tiles much larger than rear tiles. The floor is the base of the composition. |
| Floor surfaces | Saturated magenta, cyan, violet/blue, amber/yellow panels with narrow dark joints and subtly textured/glassy faces. | Independent cell color/intensity; retain tile seams and surface character at bright settings. No unbroken glowing plane. |
| Reflections | Bright central magenta/white path, cyan and warm glints, a narrow glossy foreground lip. | Use restrained glossy response that supports the floor; avoid a second full-size reflected ball competing with the hero. |
| Background | Near-black navy, strongest cool illumination overhead and faint purple spill near the floor. No visible club crowd or furniture. | Background is a deliberate configurable surface/color. Keep it subordinate to the three major elements. |
| Light hierarchy | Small white-hot highlights sit inside colored emissions; cyan structure and magenta hero/floor dominate, amber adds contrast. | Preserve local contrast and HDR headroom. Global exposure or bloom must not bleach all colors. |

The mood is polished, synthetic nightclub imagery: architectural symmetry,
strong depth, restrained scene content, glossy surfaces, and concentrated color.
The image does not establish motion speed, musical choreography, camera travel,
strobe behavior, or automatic pattern changes. Those are authored proposals below.

### Proposed mandatory identity

- One faceted disco ball, one tiled floor, one cyan overhead frame.
- Centered upper hero, broad foreground floor, substantial dark separation.
- Reference colors and spatial light balance as the default.
- Club haze/fog adds depth and makes light spill read as an indoor installation.
- No text, logos, people, extra fixtures, or lasers unless requested.
- The floor and ball remain physically in place during lighting programs.

Exact per-cell colors, individual specular highlights, and mirror tile count are
reference texture/detail targets rather than promises of pixel-identical rendering.

## Supplied asset audit

See [asset-audit.json](asset-audit.json) for source hashes, mesh names, materials,
bounds, animation targets, provenance, and inspection/validation results.
Memory figures below are the repository inspector's estimates, not measured
runtime allocations. MiB uses 1,048,576 bytes.

| Source | Geometry | Estimated GPU memory | Finding / proposed role |
|---|---:|---:|---|
| `pretty_simple_discoball.glb` | 27,520 triangles; 2 meshes/materials | 2.0 MiB | Preferred first candidate. Separate mirror/backing materials, no textures, one 16.67-second rotation clip. One glTF animation-layout error must be repaired in a derivative. Recenter the rotation pivot and inspect orientation/silhouette before choosing final scale. |
| `animated_dance_floor_neon_lights.glb` | 27,730 triangles; 103 primitives, 14 materials | 4.9 MiB | Preferred floor candidate. One 10.42-second animation scales ten color-group nodes. Ten glTF animation-layout errors must be repaired in a derivative. Do not autoplay this as musical choreography; extract/map the floor cells and give lighting independent runtime ownership. |
| `disco_ball__dance_floor (1).glb` | 41,488 triangles; 3 primitives, 2 materials | 19.0 MiB | Alternate combined model. Duplicate ball node names; identify both primitives by hierarchy/material, not first name match. Floor uses a shared textured material, so per-cell control needs adaptation. |
| `disco_ball__dance_floor.glb` | Same counts/bounds as alternate | 99.0 MiB | Contains a 4096px texture, exceeds all inspector GPU tiers, and repeats the ball node name. Keep as a source/reference; do not ship unchanged. |

The two combined files are different binary files with different memory costs;
the `(1)` suffix does not mean an exact duplicate. Neither combined model contains
an animation. No asset contains a camera. The full set requires an authored
camera, light rig, and overhead cyan frame. Final geometry selection still needs
a rendered comparison; technical inspection alone does not prove visual fidelity.

The focused glTF Validator pass reports 10 errors in the separate floor and one
in the separate ball, all `ANIMATION_SAMPLER_ACCESSOR_WITH_BYTESTRIDE`. Their
animation sampler buffer views incorrectly declare a byte stride. Both combined
files report zero errors/warnings. Repair/repack animation buffers in derived
assets or remove unused clips and validate those derivatives before shipping;
retain the original supplied sources. Passing the structural inspector does not
override these format errors. Detailed results are recorded in the JSON audit.

### Attribution

All four models declare CC BY 4.0 in embedded metadata. Preserve that metadata
and include author, source, license, and modification notices in the shipped
asset attribution mechanism for any derived model actually used:

- WwWuengy — [Animated Dance Floor neon lights](https://sketchfab.com/3d-models/animated-dance-floor-neon-lights-440e71d520d94dccbb397a8a7df9bb47).
- pan.stasian — [Pretty simple discoball](https://sketchfab.com/3d-models/pretty-simple-discoball-6b1921865be14de982f9483040acaa2d).
- DittyDos — [Disco Ball & Dance Floor](https://sketchfab.com/3d-models/disco-ball-dance-floor-d6a822cc06d54e75bf81e7ef13283613).

## Render space, geometry, and camera

Use world-space geometry through the existing Three scene bridge. Perspective,
facet normals, occlusion, and specular response are part of the design. Use a
viewport-aware authored camera to preserve the composition rather than a
screen-space image pasted behind reactive elements.

- Right-handed, Y-up scene; floor on XZ at y=0, rear toward negative Z.
- Floor grid centered about x=0; its canonical top surface defines y=0.
- Ball pivot is its geometric center, rotating about world Y. No orbital motion,
  bouncing, or whole-scene rotation is proposed.
- Normalize source transforms once, with source scene roots/axis conversions
  accounted for; do not independently center every mesh and destroy assembly.
- Overhead frame lies behind and above the ball; depth testing enforces occlusion.
- Establish scale, camera position, target, and FOV together from projected
  reference landmarks. Do not freeze guessed world coordinates before preview.
- Default camera is static for reference matching. Optional later movement:
  at most ±2 degrees yaw, ±1 degree pitch, 3% dolly, and ±2 degrees FOV;
  roll stays zero. These are proposed ceilings, subject to the chosen camera mode.
- Ball lateral silhouette, bottom, floor rear edge, and negative-space gap are
  protected landmarks. Ceiling rails and front floor may leave the frame as in
  the image. Only the authored crown crop is allowed for the default ball.
- For narrower outputs, fit the hero and rear floor width; crop foreground sides
  rather than stretch the sphere. For wider outputs, extend dark margin/frame
  reach without shrinking the hero into insignificance.
- Verify 16:9, 4:3, 1:1, 9:16, and live resize through the actual production canvas;
  record any intentional portrait recomposition.

The user selected optional subtle camera movement; retain the exact static shot
as the default and expose an explicit movement permission/amount in Step 2.

Initial lighting uses colored local illumination and an authored reflection
environment with enough dark content to retain mirror-facet contrast. Real
mirror appearance cannot come from ambient light alone. If dynamic reflection
capture is needed, budget it explicitly; do not assume per-frame cube captures.
Keep ball emission restrained. The lighting core must read with bloom and haze OFF.
The final authored look includes the user's requested club haze/fog: a visible
depth-aware atmospheric veil with localized cyan/magenta/warm light scattering,
restrained near the camera so seams and facets remain sharp. It must read as
atmosphere in the room rather than a uniform gray overlay. Do not add lasers to
make fog visible. Tune density against the reference's dark gap, with an OFF state
and user-controlled maximum. The final fog treatment follows the base geometry
and controls per the contract's effects stage.

## Proposed movement and Pattern library

Slow axial ball rotation plus music-driven floor lighting is the recommended
default. Idle displays the authored multicolor arrangement with very slow ball
rotation; playback adds clear spatial/rhythmic changes. Loaded-and-paused playback
holds motion. A no-track idle presentation may use shared render elapsed time
for decorative rotation only. It must not fabricate musical events.

Each Pattern is a distinct lighting program on the same physical installation.
Names below are NIGHTSHIFT-specific draft choices, not changes to a shared catalog.

| ID / label | Floor behavior | Ball / ceiling relationship |
|---|---|---|
| `nightshift` / Nightshift | Reference-like multicolor mosaic, staggered slow cell crossfades. Default. | Continuous slow rotation, isolated moving facet glints, steady cyan rail. |
| `crossfade-checker` / Crossfade Checker | Two checker parities exchange bright/dim states and palette roles. | Alternating restrained cool/warm light accents. |
| `runway` / Runway | Discrete rows travel from the rear toward the viewer. | Rail emphasis travels toward the rear; ball stays in place. |
| `diamond-ripple` / Diamond Ripple | Manhattan-distance rings expand from the floor center. | A small facet-glint accent follows ring launches. |
| `diagonal-relay` / Diagonal Relay | Diagonal bands cross the grid in alternating directions. | Opposed left/right highlights, preserving cyan frame identity. |
| `quadrant-exchange` / Quadrant Exchange | Four floor quadrants trade active coverage in a defined sequence. | Highlight emphasis follows active sides without rotating the scene. |
| `midnight-sparse` / Midnight Sparse | Widely separated lit cells, longer dark rests, low active coverage. | Darker mirror body, selective glints, steady low cyan frame. |
| `full-house` / Full House | Broad multicolor activation with outward-expanding accent waves. | Brief denser glints, capped at the user's intensity ceiling. No default strobe. |

Temporal overlap and smooth envelopes keep pattern changes readable; never blur
the tile grid into a generic wash. Deterministic cell addresses/seeds prevent
per-frame random flicker. Geometry itself does not pop in and out with energy.

## Parameter-to-visible-output map

Defaults/ranges are initial proposals to tune against production captures.
All parameters use generic schema definitions and resolved target bindings.

| Design parent | Parameter | Proposed default / range | Visible consumer |
|---|---|---|---|
| Master Controls | Master Intensity | 0.85 / 0–1 | Ceiling for all installation light output; zero stays black. |
| Master Controls | BPM Sync | ON | Floor program clock and tempo-governed rotation. |
| Master Controls | Auto Performance | OFF initially | Authorizes temporary build/drop programs only. |
| Master Controls | Motion Amount | 0.35 / 0–1 | Ball angular speed and within-pattern travel/crossfade rate; zero holds continuous motion. |
| Design | Pattern | Nightshift / eight options | Spatial floor/fixture program; immediate manual selection. |
| Design | Pattern Change | OFF | Enables fresh-event base pattern advancement. |
| Design | Trigger | Every 4 Bars | Canonical musical event selector, shown only when Pattern Change is ON. |
| Design | Ball Rotation | ON | Hard permission for ball rotation; no automation override. |
| Design | Floor Intensity | 0.8 / 0–1 | Floor cells only, independent of mirror/ceiling. |
| Design | Ball Highlight Intensity | 0.75 / 0–1 | Mirror highlight rig only. |
| Design | Ceiling Intensity | 0.7 / 0–1 | Cyan structural strips only. |
| Design | Pattern Coverage | 0.75 / 0–1 | Fraction/width of active cells within the selected program. |
| Effects | Bloom | 0.35 / 0–1 | Bounded shared HDR bloom, preserving dark seams. |
| Effects | Club Haze / Fog | 0.35 / 0–1 | Normalized shared depth-aware atmosphere mix over bounded density 0.01; preserves dark separation. |
| Effects | Reflections | 0.25 / 0–1 | Subtle ground/foreground glossy response below the tile deck; avoids a duplicate hero image. |
| Palette | Background | #020411 | Configurable scene background. |
| Palette | Ceiling Cyan | #19EDFF | Architectural cyan strips and their light contribution. |
| Palette | Floor Magenta | #FF20D9 | Primary floor cell family and its contribution to the mirror rig. |
| Palette | Floor Blue | #323BFF | Cool floor cell family. |
| Palette | Floor Amber | #FFB31C | Warm floor cell family. |
| Palette | Ball Tint | #D64CFF | Independent mirror-body tint, keeping white specular highlights. |

These six colors have distinct visual roles; sharing a color deliberately with
its light spill does not make it an alias of another control. Store authored
colors using Cinema 2.0's existing color conventions, with explicit sRGB/linear
conversion at the Three material boundary. The listed hex values are starting
swatches, not exact pixel samples of HDR-lit materials.

Use existing Camera controls for the confirmed optional subtle movement and keep
any additional Design-tab permission under Master Controls. Movement defaults to
OFF/zero for the reference baseline; an enabled amount must have a real camera
consumer within the declared safe limits.

## Agreed authority matrix — Auto Performance OFF by default

| Property | Manual Control | Audio Modulation | Visual Director | Auto Performance | Manual Edit Behavior |
|---|---|---|---|---|---|
| Physical layout, ball scale, fixture placement | Authored geometry/camera | None | None | None | Never rearranged by automation. |
| Palette/background | Six independent colors | No hue replacement | None | None | Immediate, persistent base truth. |
| Master/zone intensities | User values and zero hard limits | Bounded gains under ceilings | Scales allowed gain only | No extra authority | New ceilings apply immediately; zero remains zero. |
| Pattern | Base dropdown | Trigger may advance runtime base only if enabled | Supplies event significance | Temporary build/drop substitution only | Immediate base selection; Pattern Change remains ON if already ON. Suppress already-active overrides. |
| Pattern Change / Trigger | Toggle and selector | Only selected fresh event advances base | Cannot rewrite controls | Cannot rewrite controls | Retain values; latch current event on edits to avoid stale switch. |
| Ball Rotation | Hard permission | None when OFF | No permission override | No permission override | OFF freezes ball rotation immediately. |
| Motion Amount | User base/rate | Bounded acceleration under rate cap | Bounded momentum gain | No independent speed ownership | Zero holds continuous motion; no hidden base replacement. |
| Pattern Coverage | User maximum | Energy changes coverage below cap | Build pressure shapes allowed coverage | Temporary program obeys cap | Maximum applies immediately. |
| Camera | Fixed by default; optional movement permission | Later, only if authorized | Later, bounded significance | No automatic shot switching proposed | Disabling movement restores/holds authored framing. |
| Bloom/haze/reflection | User effect level/permission | None initially | No replacement | None | Zero/OFF remains zero/OFF. |

Pattern precedence is: manual base -> fresh selected Trigger advancement when
enabled -> authorized temporary build/drop substitution -> current underlying
base resumes. Runtime progression never overwrites saved Pattern, Pattern Change,
or Trigger. Manual edits during an override cancel it and consume that event;
only a separate future event may override again. If the user reselects the same
enum value, a user-edit/action revision must still establish takeover; comparing
only old/new enum strings is insufficient.

Implemented Auto Performance build override: `diagonal-relay`, until the build ends,
with an eight-beat maximum. Drop override: `full-house`, four beats maximum.
The base controller keeps progressing behind overrides. Turning Auto Performance
OFF immediately restores the current base. It never changes camera, palette,
hard permissions, or saved state. Pattern Change OFF stops trigger cycling; an
explicitly enabled Auto Performance may still provide the documented temporary
build/drop performance.

Step 6 latches active moments on enable, activation and manual takeover. Shared
Director build context authorizes a fresh interval at 0.56 with confidence at
least 0.45, releasing below 0.42. Expiry uses the existing 300 ms restoration
blend; manual Pattern edits and Auto Performance OFF restore immediately.
Music Response, Pattern Change and Auto Performance are independent permissions.
The [Step 6 report](NIGHTSHIFT-step6-report.md) records implementation and validation.

## BPM Sync and shared event contract

Reuse `Cinema2BeatClock`, the shared transport/audio frame, and established trigger
identity resolution. No local BPM, beat, kick, phrase, or drop detector.

- Sync ON: floor travel/crossfade cycles use shared beat position; proposed slow
  ball speed is one turn per 128 beats at default motion.
- Sync OFF: the same program runs at a declared fixed 100-BPM reference rate;
  ball rotation is approximately one turn per 76.8 seconds at default motion.
  This is an authored non-musical rate via the shared clock, not a new detector.
- Sync state changes ease the phase through the shared clock. Reactivity remains
  enabled when beat locking is OFF. Shared Trigger events retain their meanings.
- Respect transport pause/animation authorization. Reset/reconstruct state on
  source or discontinuity generation changes, track changes, seeks, loops, and
  preset re-entry. Clear envelopes and latch current event identities on reset.
- The preset toggle owns its local timing domains. It must receive the shared
  transport timing source regardless of other presets' toggles. If a global host
  gate disables animation/sync upstream, expose that effective state rather than
  showing a false locked indication. Audit this composition in the production path.

Reuse `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` and established resolution semantics:
`beat` Beat; `kick` Kick; `snare` Snare; `downbeat` Downbeat; `beat2` Every 2 Beats;
`beat4` Every 4 Beats; `bar` Bar; `bar4` Every 4 Bars; `bar8` Every 8 Bars;
`phrase` Phrase; `drop` Drop. Exactly eleven options; Trigger visible only when
Pattern Change is ON. Deduplicate events and avoid immediate repeat patterns.

## Audio-to-visual choreography proposal

Step 3 connected shared facts and simple bounded native delivery responses.
Step 4 now adds shared continuous smoothing, eight spatial action vocabularies,
300 ms automatic pattern crossfades and restoration checks. Its
[implementation report](NIGHTSHIFT-step4-report.md) records the current values
and timings. The table below preserves the initial proposal; Step 4's documented
time constants and spatial rules supersede it. Step 5 now connects Director
intensity, momentum, build context and qualified impact through shared targets;
the [Step 5 report](NIGHTSHIFT-step5-report.md) specifies their current bounds.

All modulation uses resolved Cinema 2.0 targets. The renderer consumes resolved
values plus deterministic pattern state, not a competing hidden music layer.
Caps apply after composition, including master/zone/coverage ceilings. Values
below are proposed normalized maxima; tune only after the base visual is approved.

| Shared source | Target / operation | Maximum strength | Attack / decay | Conditions / ownership |
|---|---|---|---|---|
| Overall energy | Active cell coverage, multiply user cap | 0.55–1.0 × cap | 120 / 450 ms | Audio available; never exceeds user coverage. |
| Bass | Ball angular-rate gain, multiply | Up to 1.25 × base | 100 / 350 ms | Ball Rotation ON, Motion Amount > 0; no movement of pivot. |
| Kick | Floor program accent, additive envelope | +0.18 normalized under ceilings | 10 / 180 ms | Fresh kick event; current pattern chooses affected cells. |
| Snare | Mirror glint density, additive envelope | +0.12 normalized | 10 / 140 ms | Fresh snare; keeps glints sparse and capped. |
| High-frequency energy | Facet glint traversal speed, multiply | Up to 1.3 × base | 70 / 220 ms | Shared signal available; no global hue flicker. |
| Vocal presence | Accent density restraint, multiply | Down to 0.7 × base | 200 / 500 ms | Strong supported vocal signal; restore cleanly when absent. |
| Build pressure | Floor band convergence/width, bounded add | Up to 0.2 normalized convergence | 250 / 600 ms | Supported build; maintains chosen pattern unless Auto authorizes override. |
| Drop event | Outward floor accent front, envelope | +0.25 normalized under ceilings | 10 / 650 ms | Fresh drop; distinct spatial response, not only brightness. |
| Phrase/section boundary | Program transition significance | One qualified transition | 250–500 ms crossfade | Pattern changes only through selected Trigger or authorized override. |

Visual Director supplies intensity, momentum, build pressure, and impact meaning;
it does not know tile or mirror geometry. Missing/unavailable music signals use
the authored base. Never fabricate absent structural events from elapsed time.

## Verified architecture seams and proposed files

Inspected existing implementations before proposing these integration points:

| System | Existing seam | NIGHTSHIFT responsibility |
|---|---|---|
| Manifest/catalog | `presets/Cinema2PresetAuthoring.ts`, `Cinema2FirstPartyPresetCatalog.ts` | New native manifest; review/reference role until acceptance, then keeper. |
| Native runtime | `modules/Cinema2ModuleRegistry.ts`, `Cinema2ModuleContracts.ts` | Registered NIGHTSHIFT module with resource/lifecycle handling. |
| Three rendering | `modules/three/Cinema2ThreeSceneBridge.ts`, `Cinema2ThreeAssetCache.ts`, `Cinema2ThreeAssetManifest.ts` | Reuse GL/context/asset bridge; dedicated scene controller for floor, mirror, and frame. |
| Parameters/targets | `parameters/Cinema2ParameterState.ts`, `Cinema2TargetRuntime.ts` | Schema-driven grouped controls and final value resolution. |
| Music/timing | `audio/Cinema2AudioIntelligenceBridge.ts`, `modules/Cinema2BeatClock.ts` | Consume shared facts and clock; preserve availability/provenance. |
| Interpretation | `director/Cinema2VisualDirector.ts` | Broad significance only. |
| Choreography | `choreography/Cinema2ChoreographyRuntime.ts` | Bounded transient target contributions, reset-safe envelopes. |
| Camera | `spatial/Cinema2CameraRuntime.ts` | Authored projection/framing and optional bounded motion. |
| Render/effects | `runtime/Cinema2RenderGraphExecutor.ts`, `effects/Cinema2EffectRuntime.ts` | Scene color/depth and later shared finishing passes. |
| Reference implementation | MARQUEE native module, scene controller, domain and production harness | Reuse scene lifecycle/batching practices; audit authority behavior against the supplied contract. |

All paths above are relative to `src/components/vyzualz/cinema2/` except the
production harness at `src/test/browser/MarqueeProductionBrowserHarness.ts`.
Existing MARQUEE Pattern metadata disables Auto Performance on manual edits;
NIGHTSHIFT must not copy that behavior as its authority rule. Prefer the canonical
trigger list/resolver; keep NIGHTSHIFT pattern content preset-specific.

Proposed additions after design agreement:

- `presets/Cinema2NightshiftPreset.ts`
- `modules/Cinema2NightshiftNativeModule.ts`
- `modules/nightshift/` layout, scene controller, pattern library, authority controller
- Registered derived assets with attribution and asset budgets
- Focused domain/manifest tests and a production-path NIGHTSHIFT browser harness

Do not change shared Inspector behavior with preset-name conditions. Do not
register an unfinished implementation as a finished keeper.

## Implementation sequence and acceptance checkpoints

Follow the supplied contract's Section 23 order. Inspection, specification,
authority agreement, and the static visual implementation are now in place.
The user accepted the static visual composition after testing it in the app.
Step 2's camera, manual controls and native motion now have focused tests and
production-canvas validation. The core uses a NIGHTSHIFT native module and scene
controller with the shared Three bridge, clock, parameters, camera and render path.
Step 3 proves shared Audio Intelligence delivery and visible response. Step 4
adds shared choreography, pattern-specific actions and clean restoration. Step 5
adds Director significance under the agreed user authority limits. Step 6 adds
the agreed temporary performance domain and manual takeover. Step 7 adds shared
reflection, atmosphere and bloom passes with independent Effects controls, OFF
bypass and intensity gates. Full acceptance remains pending.

1. Resolve camera/motion/palette preferences and authority matrix. Render/compare
   asset candidates; choose source geometry and derive stable cell/facet mappings.
   Implement static visual core with automation and finishing disabled. Match
   ball/floor/frame landmarks on the production canvas.
2. Prove camera/framing first, then manual controls and native motion. Verify all
   eight programs, independent colors, zero/default/max values, Inspector groups,
   BPM Sync ON/OFF, and Trigger visibility/options.
3. Connect shared Audio Intelligence; prove quiet/groove/kick/snare/structural
   differences using a deterministic fixture or analyzed track.
4. Add bounded target-based choreography and verify envelope restoration.
5. Connect Visual Director significance without taking user-owned values.
6. Add scoped Auto Performance overrides and manual takeover. Test manual edit
   during active build/drop, including reselecting the current pattern; fresh vs
   stale/duplicate events; base advancement during an override; restoration.
7. Add shared bloom, subtle haze, and reflection finishing. Prove OFF/default/max
   and preserve tile seams and the dark separation region.
8. Run full acceptance once against the implemented scope: production canvas,
   control regions, motion frames, music response, pause/resume/seek/loop/track
   changes, re-entry/resource cleanup, aspect ratios/resize, and human review
   against the saved reference. Promote to keeper only after these pass.

Compare actual ball, floor, and frame regions separately; a bright background
must not pass hero visibility. Capture a no-audio baseline, quiet passage, steady
groove, build midpoint, drop impact, sustained drop, manual takeover, and re-entry.
Pixel changes prove behavior, while the user decides whether the composition,
material quality, motion character, and musicality match the intended result.

## Current handoff

- Completed: supplied contract/reference review, four-model technical audit,
  saved reference, composition/architecture/controls/patterns specification,
  agreed authority matrix, clean derived runtime assets with attribution, static
  native preset and real production-canvas captures at 16:9 and square; Step 2
  manual control schema, six colors, eight spatial programs, bounded camera drift,
  slow ball rotation, shared-clock timing and instanced floor rendering; Step 3
  shared Audio Intelligence, bounded native response, Music Response control,
  all eleven event triggers, deduplication and transport lifecycle checks; Step 4
  shared smoothing, eight spatial accent vocabularies, automatic crossfades,
  manual interruption and restoration checks; Step 5 bounded Director intensity,
  momentum, build context and impact with lifecycle/authority validation; Step 6
  opt-in bounded build/drop substitutions, hidden base progression and immediate
  manual/OFF restoration; Step 7 shared finishing, depth wiring, canonical
  Effects controls, palette bindings, intensity gates and OFF/default/max checks.
- Confirmed: optional subtle camera movement, slow axial rotation, music-driven
  floor, editable reference palette, and club haze/fog.
- Accepted: the user tested the static composition in the app and confirmed it
  looks good. The user subsequently authorized Step 2. The earlier live-session
  slowdown was not conclusively attributed to the preset; final performance
  acceptance remains separate from visual approval.
- Final acceptance: 284 production-canvas assertions across 108 captures pass.
  Keeper promotion is complete. The user accepted the Step 7 result; the final
  baseline matches that capture exactly. See the final report for limitations.
- Validation: native preset tests, TypeScript, focused ESLint, generated asset
  registry build, clean derivative glTF validation, and real production-canvas
  geometry visibility/dark separation/resize checks passed. Step 2 adds 28 focused
  tests and 95 production-canvas/Inspector assertions. Step 3 adds six focused
  audio tests and 68 production-canvas assertions. Step 4 has 14 focused tests
  and 63 production-canvas assertions, including 68 enabled visibility captures.
  Step 5 has 19 focused tests and 38 production-canvas assertions, including 30
  enabled ball-visibility captures. Step 6 has 27 focused tests and 78 canvas/
  Inspector assertions across 59 captures. Step 7 has 29 passing focused tests
  and 32 canvas/Inspector assertions across 19 captures, including OFF/default/max,
  dark separation, tile-edge contrast, paused edits and re-entry. Details in the phase reports.
- Commit: none requested or created. Original supplied artifacts remain intact.
