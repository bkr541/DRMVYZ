# Bass Sigil — reference analysis and Cinema 2.0 preset plan

Status: **P4–P7 implemented. P8 automated production checks passed; the user approved the final environment and finishing captures. Representative real-track/human musicality acceptance remains open.**

Current authority: the [P4–P8 implementation and acceptance report](P4-P8-performance-and-acceptance.md) supplies the final geometry score, Director/Mood policy, finishing controls and acceptance status. The [P3 audio report](P3-audio-reactivity-report.md) remains the basic signal map; its highs→shell-opacity and downbeat→logo-scale routes supersede the proposals below. All performance uses the original supplied environment, omnidirectional camera and independent 3D logo.

## Camera/logo correction requested by the user

The camera must orbit the entire supplied sphere horizontally and vertically, with omnidirectional automatic travel and full manual viewing angles. The original 3D logo must independently rotate and sway. These requirements supersede all fixed-camera/stationary-hero statements below. See the camera/logo extension in the [current P2 report](P2-original-environment-and-native-motion.md).

## Authoritative correction after user review

The user did **not** authorize replacing the environment. The supplied GLB is the required visual foundation. The P1 substitute environment was withdrawn and removed from the runtime and shipped inventory. Any proposal below for newly generated cellular shells, extra particle fields, an extracted hero asset, cell-count geometry controls or a replacement environment is superseded. The current [P2 specification and report](P2-original-environment-and-native-motion.md) governs those details.

Use the original wordmark, three bars, diamond, textured sphere, glow plane and both particle meshes, with their textures, UVs and connectivity intact. Native programs may animate/deform those source meshes through manual controls. They must not introduce a different environment. Sector Crown and Tidal Twist replace the proposed separated-crown/ribbon concepts with bounded deformation of the original sphere. Source files remain byte-for-byte intact.

Scope: upgrade the existing Bass Sigil artifact into a customized, geometry-choreographed, music-reactive Cinema 2.0 preset. The existing reference entry now runs the complete native performance on the supplied GLB. The withdrawn P1 replacement is historical; the final report above governs the implementation.

Contract: [DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md](../../DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md), repository version read for this plan. Requirements come from the user's request and that explicitly requested contract. The recording's player controls, branding and incidental desktop UI are reference content, not instructions or preset UI requirements.

## 1. Reference findings

Source: `/Users/kodyrobinson/Desktop/Bass_Sigil_Ref.mov` (the requested extensionless path resolves to this file). The recording is approximately 14.60 seconds, 1550 × 856, with 786 video frames and an AAC audio stream. Its average video rate is approximately 53.96 fps; the nominal 120 fps metadata must not be treated as the observed motion rate.

Evidence:

- [Full-recording contact sheet](reference/contact-sheet.jpg): half-second samples across the recording.
- [Detailed hero frame at 2.6 s](reference/hero.png).
- [Bright flare at 5.5 s](reference/flare.png).
- [Motion study at 7.0–7.7 s](reference/motion-study.jpg): 0.1-second samples, read left to right, top to bottom.
- [Measured asset inventory](reference/asset-inventory.json): source hash, materials, geometry and animation channel ranges.
- [Reference provenance](reference/provenance.json).

### What is visibly happening

| Element | Appearance | Motion and visual function |
|---|---|---|
| Wordmark | Sharp, extruded angular lettering; dark metallic faces with thin icy highlights | Stays centered and mostly front-facing. Small tilt, vibration and scale changes give weight; it does not orbit out of view. |
| Red three-bar core | Three uneven red/pink luminous blades inside the lettering | Bars move independently up/down and slightly in depth. Their staggered motion gives the center a mechanical, equalizer-like character. |
| Diamond backing | Layered dark reflective plate behind the core | Subtle expansion and depth movement reinforce the central pulse without replacing the wordmark. |
| Cellular shell | Large irregular blue-white web with rounded dark openings | Rolls and twists around the hero. Near cells become large at the frame edges; smaller structures recede behind it. The appearance is organic and fluid rather than a regular polygon wireframe. |
| Particle field | Many electric-blue points, small facets and soft luminous spots | Different depths and opposing movement create a vortex/tunnel impression. The field surrounds the wordmark instead of forming a flat equalizer. |
| Flares and focus | Intermittent white/cyan highlights, soft background and edge color separation | Highlights sweep through the scene and briefly swell. The wordmark is usually sharper than the surrounding field. |
| Camera | Stable frontal presentation | Most apparent travel comes from the environment, not camera orbit. Preserve that hierarchy. |

The large flares visible around 1.5, 5.5, 6.5, 10.5 and 14.0 seconds are **recording-time observations**, not measured beat/drop timestamps. The player visibly loops its animation, and user interface overlays appear during the recording. Do not reproduce its transport UI or infer musical structure from those overlays.

### What the GLB confirms

The existing asset is `public/cinema2/models/crate/skrillex_-_vj_-_flash_warning.glb`: 1,666,412 bytes, 25 nodes, 11 meshes, 8 materials and 16,206 triangles. It includes one animation named `Animation`, with 16 transform channels sampled from approximately 0.04167 to 4.16667 seconds. This is an authored loop, not proof of live music analysis.

| Source node / material | Confirmed role and reusable data |
|---|---|
| `Plane.002_2` / `textBlack`; `Plane.008_11` / `edge` | Wordmark and matching outline. They have matching translation/rotation/scale tracks; keep them registered under one pivot. Wordmark scale varies about 0.960–1.033. |
| `Plane.004_4`, `Plane.005_5`, `Plane.006_6` / `textRed` | Three separately addressable red bars with independent translation tracks. Preserve their meshes and silhouette. |
| `Plane_1` / `material`; `Plane.003_3` / `bgShine` | Backing/shine geometry with translation and scale channels. Backing scale reaches about 1.145. |
| `Sphere_8` / `sphere` | A 960-triangle sphere with a cellular image texture and rotation tracks. Its scale is effectively constant at 18.7376; its microscopic scale differences are floating-point noise, not a meaningful breathing animation. |
| `Icosphere_9`, `Icosphere.001_10` / `dots` | Two particle meshes, each 3,200 triangles. Only the second has an explicit rotation channel. Do not claim both are independently animated by the source. |
| `Plane.007_7` / `glowBg` | A textured glow plane. Source image-based glow is separate from the hero's solid geometry. |

The cellular openings are primarily **texture appearance on a sphere**, not individually modeled holes or ribs. The customized preset will preserve the appearance while adding an actual open 3D cellular structure that can compress, separate and unfold. Vertex-index connectivity counts in the inventory are not logical object counts: the export contains split vertices.

The recording's audio is low level (measured mean −57.4 dBFS, peak −33.7 dBFS). No claim is made that its flares or bar movement follow bass, kicks or drops. Live musical mappings below are new authored behavior. The source asset also does not supply the complete viewer lighting, focus and bloom configuration; matching those is a production-render task.

### Preserve versus extend

**Mandatory identity:** centered readable wordmark; three red bars; dark diamond backing; electric-blue particles; rounded blue-white cellular environment; deep black negative space; genuine depth; restrained hero movement surrounded by larger environmental movement.

**Authored extensions:** open cellular geometry, eight distinct geometry programs, independent core articulation, bounded audio deformation, deterministic musical transitions, six editable colors and shared Auto Performance.

**Excluded:** replacing the lettering with generic text; making the whole asset spin as one object; using exposure pulses as the only reaction; running the baked clip as the finished reactive show; turning the background into unrelated rings or a regular wireframe cage; copying video frames into the preset.

## 2. Product and integration decision

Upgrade the existing preset identity **`drmvyz.cinema2.crate-bass-sigil`** and retain the visible name **Bass Sigil**. Route that one catalog entry to a dedicated `Cinema2BassSigilPreset.ts` manifest; exclude only its generic crate descriptor from generic registration so there is one entry and no duplicate ID. Keep the other crate previews unchanged.

The current crate factory explicitly disables animation playback and supplies no parameters. This is an enhancement of an existing reference artifact, not a legacy Cinema engine port. Apply the new-preset specification sequence in contract §8/§23, plus reference A/B checkpoints. A legacy implementation inventory and legacy-engine A/B are not applicable; the video, GLB and current static preview are the relevant references.

Keep the source GLB immutable and its existing asset record/attribution available. Generate a separate named hero asset from its solid parts, retaining the recorded CC-BY-4.0 attribution to tamminen and source URL. Rebuild the shell and particles procedurally. Do not ship a second full copy of the original animation/textures when the derived hero needs neither. Use revision 1 unless a demonstrated state incompatibility requires an explicit migration; adding Mood drives alone is not a reason to bump revision. Test loading the old empty-parameter preview state.

## 3. Visual geometry specification

### Space, counts and framing

Use a world-space 3D scene with a compositionally fixed camera. Coordinates: +X right, +Y up, +Z toward the camera. Normalize the complete wordmark to width 6 world units; preserve its original proportions, bevels and extrusion. Center the **combined hero bounds**, not an arbitrary source node origin, at `(0,0,0)`.

Major elements: one wordmark/edge assembly, three independent core bars, one layered diamond backing, two complementary cellular shell layers, and two particle depth populations. Flares are secondary light accents, not additional hero objects.

Proposed initial camera: `(0,0,11.2)` looking at the origin, vertical FOV 40°, near 0.05, far 100. These are calibration starting values, not a claim of a finished visual match. Target wordmark width is 40–46% of the 16:9 frame; the full backing and glow must remain comfortably inside the frame. At rest, the hero should dominate without the background becoming a uniform bright wash.

Use the existing minimum-aspect camera fitting with a centered anchor to retain horizontal hero framing at 16:9, 4:3, 1:1 and 9:16. Fit the transformed hero bounds including maximum scale, tilt and bar travel, with at least 8% horizontal and vertical safe padding. Background structures may extend beyond the frame intentionally; the hero may not. Resize changes projection/fitting, not the musical phase or particle seed.

### Geometry and pivots

| Assembly | Geometry and motion rules |
|---|---|
| Wordmark + edge | Import actual extruded mesh; parent face and edge to the same centered pivot. Keep relative transforms. Maximum native recoil ±0.06 units, tilt ±3°, scale pulse +4%; no letter scrambling. |
| Core bars | Preserve each bar's mesh. Pivot each around its rest center; staggered vertical travel up to 18% of hero height, depth travel up to 0.10 units, tilt up to 4°. Maintain gaps; bars must not pierce the lettering or backing. |
| Diamond | Common center behind lettering, preserving source offsets. Compress/release by up to 12%, depth recoil up to 0.12 units; keep the hero's silhouette readable. |
| Cellular shell | Two rounded, irregular spherical cellular graphs, nominal radii 7.5 and 9.0, flattened in depth to approximately 0.55. Seed a spherical Voronoi-like graph; smooth its edges into real curved ribs with connected junctions and actual open cells. Match the source's rounded, varied cell sizes, not equal polygon faces. |
| Shell deformation | Deform shared graph vertices first and regenerate/evaluate connected ribs, so cell junctions do not tear accidentally. Use bounded axial compression, twist, radial opening and deliberate sector separation. Keep a rest graph to reconstruct every frame; never accumulate transform error. |
| Particles | Two seeded 3D populations: small crisp facets behind the hero and larger soft glints nearer the edges. Use instanced geometry for the former and depth-aware sprites for the latter. Wrap/recycle deterministically beyond visible bounds, with a fade at endpoints; no center teleport or random reseeding each frame. |
| Foreground clearance | Constrain foreground cells/particles to the outer field, protecting the hero's projected footprint plus a small margin. Actual depth testing remains enabled. Avoid painting a flat hero over intersecting geometry to conceal occlusion errors. |

Keep the shell's maximum front extent below Z=6.5 and behind the camera/near plane at every advertised state. Extent and depth controls clamp against tested safe bounds. Source geometry may need an explicit imported-axis normalization; verify it visually before freezing transforms. No continuous full-asset bounding-box fit may shrink the hero when background particles spread.

### Materials, light and depth

Use graphite metallic faces, separate bright edge material, red/pink emissive core and a glossy dark diamond. The shell has cool softly lit ribs with selective blue-white emission; its openings remain dark. Particle hue is independently editable. Use an actual background surface/clear color bound to Background.

Use a restrained cool key and rim to reveal bevels and moving normals. Flares follow existing highlight locations and depth; they do not replace surface lighting. Every role needs an absolute color/material consumer: multiplying a new tint into the source's zero-valued black material would leave Wordmark Color inert.

Opaque hero and ribs write depth. Transparent glints/glow depth-test but do not write depth; bound their overdraw and sort populations deliberately. The background is continuous beyond all visible edges. No floor, horizon, club or unrelated environment is introduced.

## 4. Eight native geometry programs

All programs retain the centered hero and the cellular/blue-particle vocabulary. They differ in trajectories and spatial organization, not just speed, hue or phase. Each has a dry, bloom-off acceptance capture and a motion filmstrip.

| Pattern ID / label | Geometry choreography | Core / particle behavior | Distinctness proof |
|---|---|---|---|
| `reference-vortex` / Reference Vortex — default | Two organic shell layers roll on different axes around a stable center; background cells pass through perspective. | Three-bar stagger; opposed particle depth currents. | Closest to the recording: rolling cellular volume and layered depth. |
| `countercurrent` / Countercurrent | Shell sectors form two interleaved helical streams with opposite handedness. | Left/right particle lanes counterflow; alternating bar pairs. | Two simultaneous opposite winding directions, not whole-scene spin. |
| `axial-pressure` / Axial Pressure | Cells compress along Z toward a shallow lens, then recover; the outer frame stays open. | Particles gather toward the depth axis; bars perform a short sequential piston stroke. | Depth compression and release, with little global rotation. |
| `orbital-weave` / Orbital Weave | The same cellular graph stretches into four interlaced elliptical bands that precess around the hero. | Particles follow alternating orbital planes; bars hold a restrained traveling ripple. | Recognizable intersecting orbital paths and exposed depth gaps. |
| `broken-crown` / Broken Crown | Twelve connected sector groups peel outward and tilt into a staggered crown; rounded cell structure remains within each sector. | Particle spokes move between the sectors; bars open in a stepped sequence. | Deliberate sector separation and articulated hinges. |
| `tidal-ribbon` / Tidal Ribbon | Cell rows unfurl into two continuous corkscrew ribbons that pass around, not through, the hero. | Particle streams follow the ribbon curvature; bars respond in a soft traveling wave. | Long connected ribbon paths rather than scattered sectors or orbits. |
| `lens-collapse` / Lens Collapse | Shell aperture tightens into a cellular iris, storing tension; it remains open enough to preserve the lettering. | Particles converge in depth; bars draw inward with staggered offsets. | Inward contraction and held pressure; proposed temporary build program. |
| `shock-bloom` / Shock Bloom | Eight cellular petal groups release outward, then reassemble through their original rest positions. | One outward particle wave and strong three-bar release, followed by a settling current. | Outward geometry release with a bounded recovery; proposed temporary drop program. |

Transitions use persistent seeded element identities and rest positions. Blend positional/rotation/radius fields over one beat with continuous interpolation; manually selected patterns become recognizably active immediately (first frame, with a short ≤120 ms pose handoff), not after a bar-long queue. Density/topology changes allocate at an explicit edit/quality boundary and crossfade stable populations; do not rebuild the whole scene every frame. Avoid passing transition geometry through the protected hero zone.

For repeating programs, define a closed native motion cycle. Shock Bloom repeats a restrained open/reassemble cycle when selected manually; its temporary drop version starts with one stronger release and settles. Lens Collapse breathes within safe limits when manually selected; a build override uses the shared build charge for sustained compression. These are real manual patterns, not effects that only work during a drop/build.

## 5. Controls and parameter-to-visible-output map

All controls live in the **Design tab**, with exactly the four allowed top-level parents. Numeric bounds below are proposed authored limits and must be tuned only through visible-output checks. Every row requires a real resolved-value consumer.

| Parent | Parameter / type / default / range | Visible consumer and acceptance observation |
|---|---|---|
| Master Controls | Auto Performance / bool / OFF | Shared Mood drives and temporary performance programs. Off removes that authority; ordinary authored audio response remains. |
| Master Controls | BPM Sync / bool / ON | Shared beat clock governs shell, particles, bar cycles and transition timing. ON/OFF differ at 90/150/180 BPM. |
| Master Controls | Intensity / float / 0.90 / 0–2 | Master visual output gain; zero makes the visual nearly off rather than leaving unscaled emissive layers. |
| Master Controls | Reactivity / float / 0.65 / 0–1 | Scales audio contributions and all Mood drives; zero yields the same authored geometry motion without reactive additions. |
| Design | Pattern / enum / Reference Vortex | Eight actual native programs listed above. |
| Design | Pattern Change / bool / OFF | Authorizes event-based underlying pattern advancement. |
| Design | Trigger / enum / Every 4 Bars | Exact canonical options below; visible only when the **saved** Pattern Change is ON. |
| Design | Geometry Motion / bool / ON | Hard authorization for all positional/rotational/scale animation, including geometry reactions. OFF displays the selected program's authored rest pose. Lighting reactions may continue. |
| Design | Motion Rate / float / 1 / 0–2 | Scales continuous native cycles; zero holds authored cycle phase. It does not disable discrete Trigger selection or light accents. |
| Design | Geometry Extent / float / 0.35 / 0–1 | Amount of program-specific shell deformation, up to the tested safe deformation bound (initially 25% of radius). Zero retains the program's distinct rest layout. |
| Design | Core Travel / float / 0.25 / 0–1 | Independent three-bar stroke and diamond recoil. Zero suppresses their displacement, including audio additions. |
| Design | Cell Density / float / 0.65 / 0–1 | Actual visible cellular graph complexity; approximately 64–180 cells per shell on high quality. Minimum still retains the cellular identity. |
| Design | Particle Density / float / 0.60 / 0–1 | Actual particle occupancy; zero hides both populations. High-quality maximum initially 1,800 instances/sprites combined. |
| Design | Tunnel Depth / float / 1 / 0.5–1.5 | Shell/particle Z distribution; hero remains fixed. |
| Design | Hero Scale / float / 1 / 0.75–1.15 | Complete wordmark/core/backing assembly scale, with projection-safe limits. |
| Effects | Bloom / float / 0.30 / 0–0.8 | Shared HDR bloom amount; zero bypasses bloom without erasing emissive geometry. |
| Effects | Flare Amount / float / 0.20 / 0–0.65 | Secondary spatial glints; zero prevents new flares and immediately clears their contribution. |
| Effects | Trails / float / 0.08 / 0–0.45 | Background-only particle/cell persistence; hero never smears. Zero bypasses and clears history. |
| Effects | Background Focus / float / 0.25 / 0–0.6 | Depth-aware background softness with hero focus held; zero is a sharp dry scene. |
| Palette | Background / color / `#000104` | Independent background/clear surface. |
| Palette | Wordmark / color / `#151A26` | Metallic face material; bright test colors must visibly recolor the face. |
| Palette | Edge / color / `#DCEBFF` | Letter edge highlights only. |
| Palette | Core / color / `#FF1748` | Three bars and their local red glow. |
| Palette | Membrane / color / `#B3D9FF` | Cellular ribs and their spatial highlights. |
| Palette | Particles / color / `#1769FF` | Both particle populations; does not recolor the ribs or core. |

Use nested groups only where useful, maintaining shared typography. Do not add a camera control to a fixed-camera specification. Quality uses the existing Cinema 2.0 performance mechanism rather than another preset-specific quality system.

Trigger options come directly from **`CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`**, unchanged:

| Value | Label | Value | Label |
|---|---|---|---|
| `beat` | Beat | `kick` | Kick |
| `snare` | Snare | `downbeat` | Downbeat |
| `beat2` | Every 2 Beats | `beat4` | Every 4 Beats |
| `bar` | Bar | `bar4` | Every 4 Bars |
| `bar8` | Every 8 Bars | `phrase` | Phrase |
| `drop` | Drop | | |

## 6. System ownership and architecture

The relevant existing implementations were inspected; this plan does not assume a new music analyzer or a generic clip player exists in the current Three scene module.

| System | Sole responsibility / integration |
|---|---|
| `Cinema2AudioIntelligenceBridge` | Shared musical facts and publication/discontinuity identities. Module consumes available facts, with explicit unavailable fallbacks. |
| `Cinema2VisualDirector` | Broad build pressure, intensity, momentum and impact significance. Never knows bar meshes or cellular petals. |
| `Cinema2MoodConductor` | Shared passage feel, silence, boundary and effective pattern-control policy. Consume `frame.mood`; no local mood tiers, silence threshold or Trigger ladder. |
| `Cinema2ChoreographyRuntime` + `Cinema2TargetRuntime` | Own temporary signal-to-target contributions and final composition. Event/mood rules target controls bound to real module/effect consumers; no invisible material mutator bypass. |
| `Cinema2ParameterState` | Persistent authored controls. Never receive automatic writes. |
| Dedicated `bass-sigil-native` module | Pure geometry programs, pose interpolation, material-role application, instancing and render state. Read resolved targets each frame, not cached defaults. |
| `Cinema2BeatClock` | Shared musical phase for loops; use the preset's BPM Sync, not a new clock/analyzer. |
| `Cinema2PatternControlResolver` | Exactly one instance; resolve effective Pattern Change/Trigger once per frame before event resolution. Spread `inspect()` into module inspection; reset with the module. |
| `Cinema2MainframePatternController<BassSigilPattern>` | Reuse its generic pattern-list control semantics: fresh canonical events, manual base, deterministic nonrepeat progression and edit suppression. No copied controller fork. |
| `Cinema2PatternAutoPerformance<BassSigilPattern>` | Shared bounded build/drop override mechanism, configured for Lens Collapse and Shock Bloom. It does not own persisted values. |
| Three integration | Reuse `Cinema2ThreeSceneBridge` loading/material/lighting/camera/resource boundaries and its named-model-controller hook where sufficient. The dedicated module supplies resolved draw state and named pivots; procedural buffers have explicit ownership/disposal. Do not patch all crate previews to animate. |
| Camera / render graph / effect registry | Existing camera projection/fitting, scene color/depth, shared HDR bloom, focus and trails, then final composition. Every enabled pass has a visible purpose. |

Proposed files: `presets/Cinema2BassSigilPreset.ts`, `modules/Cinema2BassSigilNativeModule.ts`, and `modules/bassSigil/{Cinema2BassSigilGeometry,Cinema2BassSigilPatternEngine,Cinema2BassSigilModelController}.ts`; corresponding focused tests and production browser harness. A small source-extraction script generates the named hero asset and records hashes and attribution.

Inspect the bridge's available scene/depth outputs before implementing the final graph. Proposed graph: background color/depth → optional background focus/trails → hero color/depth with correct foreground occlusion → shared HDR bloom → restrained final grade/output. If that requires a narrow preset-owned background pass, build it through existing module/pass contracts. Do not claim that the current one-pass crate factory already supplies isolated background history or selective focus. At the dry visual gate, render everything directly without those finishing passes.

## 7. User and automation authority matrix

`U` means user-owned; `B` means user base plus explicitly bounded modulation; `A` means temporary automatic domain. Values resolve as authored base → permitted signal contributions → clamp → hard authorization. Hard zero/disable wins after resolution. Nothing writes saved values.

| Property | Manual control / mode | Ordinary audio | Director / Mood / Auto Performance | Manual edit behavior |
|---|---|---|---|---|
| Palette and background | Six colors / U | None | None | **Editable**, including while Auto Performance is on. |
| Auto Performance, BPM Sync | Toggles / U | None | Neither changes its own toggle | **Editable** at all times. |
| Master intensity/reactivity | Sliders / B | Defined gain/strength only | Drives scaled by Reactivity; intensity bounded | Locked while Auto Performance is on; saved values restored on off. |
| Hero position/camera | Fixed authored composition / U | No camera response | No automatic orbit/dolly/FOV | No advertised camera controls or hidden shot changes. |
| Hero scale | Slider / U | No audio modulation; ≤4% authored native pulse within fitted bounds | No macro scale drive | Locked while Auto Performance is on; off edits apply immediately. |
| Geometry Motion | Toggle / U, hard permission | Cannot animate when OFF | Cannot re-enable | Locked while Auto Performance is on; an already saved OFF remains OFF. |
| Motion Rate / Extent / Core Travel / Depth | Sliders / B | Bounded geometry reactions below | Baseline-relative bounded drives | Locked while Auto Performance is on; zero motion/travel permission remains a hard zero. |
| Cell Density | Slider / U | None | No topology-count drive | Locked while Auto Performance is on; stable graph allocation after edits. |
| Particle Density | Slider / B | Vocal restraint only | Bounded activity/silence drive | Locked while Auto Performance is on; saved zero remains zero. |
| Bloom / Flare / Trails / Focus | Sliders / B except Focus U | Only declared accents/restraint | Bounded Effects drives; no focus takeover | Locked while Auto Performance is on; zero bypass remains zero. |
| Pattern | Dropdown / U base, temporary A display | No implicit switching | Effective Trigger advances base; bounded build/drop display override | Locked while Auto Performance is on. With it off, immediate manual selection leaves Pattern Change ON and spends the already-active event. |
| Pattern Change / Trigger | Saved U; effective A while Auto Performance has mood/grid | Canonical selected event only | Shared conductor/resolver chooses effective controls; never saves them | Locked while Auto Performance is on. Off/no mood/no grid restores exact saved inputs. |

Inspector lock is shared and tag-based: Design, Effects and Master Controls are disabled/grayed in place except Auto Performance and BPM Sync; Palette remains editable. Reset Parameters is disabled. Turning Auto Performance off releases all controls immediately to saved values. Test disabled/ARIA state and refused edits, not just visual dimming.

The saved Pattern Change controls Trigger visibility even while effective values differ. Use shared live readouts/yellow slider markers and the shared “Auto Performance is choosing” note. Never add a new readout row; prove unchanged row, group and window dimensions in a real browser.

Pattern precedence: manual base → canonical fresh Trigger progression while effective Pattern Change is ON → bounded Auto Performance build/drop display override → current underlying base. Base progression continues during the override. No accidental immediate repetition. On edit/toggle/Trigger change, consume the already-present event identity rather than replaying it.

## 8. Timing and lifecycle contract

BPM Sync defaults ON and is the preset's authoritative motion-sync choice, declared as `choreography.tempoSyncParameter`. Feed its resolved boolean explicitly to the shared beat clock. A host BPM toggle does not secretly AND/OR against it; the host supplies transport/tempo facts. Test the cross-product of host and preset toggles.

Initial loop vocabulary at Motion Rate=1: rolling shell approximately 8 beats, secondary shell/particle current 16 beats, bar ripple 2 beats. Pattern-specific strokes may use subdivisions of the same phase. At Sync OFF, use the shared clock's fixed 120-BPM reference path: approximately 4 s, 8 s and 1 s respectively, independent of analyzed tempo. Keep phase continuous during a Sync toggle. Actual kick/snare/drop events and selected Pattern Change triggers still come from shared music events, including when Sync is OFF.

| State | Required visible behavior and reset policy |
|---|---|
| No source | Deliberate very low ambient field drift (about 8% normal rate), red core at rest, no simulated kicks or flares. No mood behavior. |
| Loaded but paused | Hold the last settled geometry, particle positions, pattern phase and accent state; no accumulating trails. A newly loaded paused source starts from authored rest. |
| Playing | Shared clock and distinct continuous/event mappings become visible. |
| Pause / resume | Freeze/resume without a phase jump or delayed queued accents; do not consume a paused held event twice. |
| Silent passage during playback | Shared silence weight reduces motion/light contributions below base and holds automatic pattern progression. No local silence detector. A real drop is never silence-gated and releases the stop. |
| Seek / loop / track or analysis revision change | Clear event envelopes, temporary overrides, transition poses and history; reset canonical event consumption and reconstruct stable seeded geometry. Never replay all crossed events on a large seek. |
| Preset re-entry | Rebuild/reset transient state, retain authored controls, reseed from engine-owned stable inputs, reacquire only owned resources. |
| Context loss/restore | Dispose/reacquire GPU buffers and targets through runtime facilities; restore the current valid authored pose without old history. |

Geometry Motion OFF overrides displacement and rotation from every source, including build/drop programs; program selection may still change the static layout. Core Travel=0 disables bar/diamond stroke; Motion Rate=0 freezes continuous phase but explicit extent changes can still deform the rest pose. Effects at zero cannot be brought back by additive automation. These distinctions belong in control descriptions and tests.

## 9. Audio-to-geometry choreography

All amounts below are **maximum contributions at Reactivity=1**, multiplied by the actual available signal. Numeric targets bind to the controls in §5 so the shared live display reports the performing value. Availability false contributes zero. Envelopes use the shared choreography engine; the module interprets the resolved amount as the pattern's geometry, not a second hidden audio envelope. Any material-light response also uses an explicit bound target.

| Shared source | Target / composition / maximum | Attack / hold / release | Conditions and visible purpose |
|---|---|---|---|
| Bass/sub continuous energy | Geometry Extent ×1.25 maximum | Upstream signal smoothing; no duplicate analysis | Playing, geometry authorized; fuller cell bulge/twist, not just brighter pixels. |
| Overall continuous energy | Motion Rate ×1.20 maximum | Upstream continuous value | Playing; particle/current travel gains momentum within user-authored rate. |
| High-frequency energy | Flare Amount ×1.20 maximum | Upstream continuous value | Playing, Flare Amount nonzero; small glint activity at existing sites. |
| Vocal presence | Particle Density ×0.65 and Trails ×0.65 at full vocal activity | Follow shared continuous vocal signal | More negative space and cleaner hero; cannot increase density. |
| Kick | Core Travel +0.16; geometry maps it to short alternating bar recoil | 0.025 / 0.025 / 0.22 s | Fresh shared kick, playing, `not-silent`, Core Travel nonzero and Geometry Motion ON. |
| Snare | Geometry Extent +0.10, mapped to lateral shell shear/sector recoil | 0.02 / 0.02 / 0.18 s | Fresh shared snare, playing, `not-silent`, motion authorized. Keep the hero fixed. |
| Downbeat | Flare Amount +0.10 | 0.02 / 0.03 / 0.25 s | Fresh shared downbeat, `not-silent`, effect authorized; larger spatial highlight, not a full white screen. |
| Phrase / section boundary | Underlying Pattern advance only when the effective selected Trigger qualifies | One-beat transition | Shared event identities; `not-silent` for grid/phrase accents. A section boundary alone does not secretly replace Pattern. |
| Shared build pressure, Auto Performance only | Tunnel Depth ×0.78; optional Lens Collapse display program | Ease in 2 beats; release 2 beats; override maximum 32 beats | Shared build significance, `not-silent`; create tension by depth compression. Shared override helper owns eligibility, not a local build detector. |
| Shared drop, Auto Performance only | Geometry Extent +0.25; optional Shock Bloom display program; Flare Amount +0.18 | Geometry 0.04 s attack, 0 hold, 2 beats release; flare 0.02/0.02/0.30 s; program max 8 beats | Fresh shared drop; **never `not-silent` gated**. Release geometry outward; retain wordmark and palette. Restore current underlying program. |

Ordinary continuous/rhythm reactions operate with Auto Performance OFF; macro build/drop program substitution and Mood drives require it ON. Reactivity=0 removes reactive additions, drives and automatic performance substitutions, while the independently authorized Pattern Change controller can still advance. Manual Pattern selection remains available with Auto Performance off regardless of Reactivity.

Bound simultaneous contributions before rendering. Additions cannot defeat a hard zero/disable. A duplicate kick/downbeat/drop does not restart its envelope. Beat-quantized durations follow the declared shared tempo-sync path; second-based micro-accents retain a consistent physical snap.

## 10. Mood drive table and automatic domains

Use **`withCinema2MoodDrives`** with `idPrefix`, `enabledParameter`=Auto Performance, `strengthParameter`=Reactivity, and `patternControls: { patternChange, trigger }`. Let the helper apply all three `moodPolicy` tags. Do not hand-write a Trigger ladder or conductor threshold.

| Bound control target | Authored baseline | Shared source | Operation / maximum contribution | Intent / bound |
|---|---|---|---|---|
| Motion Rate — Design | 1 | `mood.momentum` | multiply 1.30 | Faster field current; final range 0–2. |
| Geometry Extent — Design | 0.35 | `mood.energy` | add +0.18 | Larger actual deformation; final range 0–1 and spatial safety clamp. |
| Core Travel — Design | 0.25 | `mood.drive` | add +0.12 | Greater bar articulation; nonzero authorization required. |
| Tunnel Depth — Design | 1 | `mood.build` | multiply 0.85 | Baseline-relative pressure; final range 0.5–1.5. |
| Particle Density — Design | 0.60 | `mood.activity` | add +0.12 | Bounded occupancy, no reseed; saved zero remains zero. |
| Bloom — Effects | 0.30 | `mood.peak` | add +0.10 | Highlight expansion, with the dry hero still visible. |
| Flare Amount — Effects | 0.20 | `mood.shock` | add +0.12 | Decaying spatial highlight after impact. |
| Trails — Effects | 0.08 | `mood.calm` | multiply 0.70 | Cleaner, quieter field; never hero persistence. |
| Motion Rate / Core Travel / Particle Density / Intensity / Flare / Bloom / Trails | Their saved bases | `mood.silence` | multiply toward 0.10 | Show becomes nearly off during a real silent stop; restore as shared silence releases. |

All drives are toggle-gated, scaled by Reactivity, baseline-relative, range-clamped, bound to visible controls, and removed entirely when Auto Performance is OFF. Test stacked contributions, not just each table row separately. Null mood contributes nothing; no mood/no grid means the pattern resolver returns the exact saved Pattern Change and Trigger.

Automatic domains are only bounded passage-level Design/Effects modulation, the shared effective Pattern Change/Trigger choice, and temporary Lens Collapse/Shock Bloom performance programs. Camera, palette, source identity, hard permissions and persisted controls remain outside automatic ownership.

Do not add a separate feel-based pattern chooser in the initial implementation: the shared effective Trigger progression plus the two temporary programs provide a complete automatic show without competing pattern selection. This keeps the ownership and restoration proof small.

## 11. Effects, quality and resource budget

Dry geometry is the baseline acceptance target. Only afterward add background-only depth softness/persistence, bloom and restrained spatial flares. Test every effect OFF/default/max, including transitions to OFF that clear history. Focus never blurs the wordmark. No full-frame exposure flash is needed to reproduce the reference's localized glints.

Proposed quality ceilings, to be measured during implementation:

| Tier | Cellular detail | Particles | Finishing |
|---|---|---|---|
| High | Up to 180 cells/layer, smooth rib segments | Up to 1,800 | Half-resolution focus/trails/bloom where appropriate |
| Medium | Up to 120 cells/layer, fewer curve segments | Up to 1,000 | Reduced-resolution supporting passes |
| Low | Up to 72 cells/layer, simplified ribs | Up to 450 | Preserve clear hero/core and all eight programs; simplify focus/trails kernels |

Density controls remain perceptible at every tier, normalized within that tier's cap. Do not silently drop the core, a palette role or a pattern family. Initial total geometry ceiling: 120k triangles on high; scene draw-call goal under 40 through instancing/batching; preset-owned GPU allocation goal under 64 MiB. These are proposed budgets, not measured results or device guarantees. Report GPU bytes through runtime ownership, check the existing total asset budget, and profile the production path once after the accepted geometry exists.

Dispose derived geometry/materials, instance buffers, render targets and histories on exit; never dispose shared source resources from the controller. Restore resources after context recovery. Clear particle/trail histories on resize if their target dimensions change.

## 12. Implementation phases and exit gates

Implement only the phase requested in a follow-up. Do not wire all systems first or treat a compile pass as visual acceptance.

| Phase | Work | Required gate before proceeding |
|---|---|---|
| P0 — specification | This plan, evidence, ownership/authority and contract mapping | Review proposed design and authority before coding. Planning completion is not production signoff. |
| P1 — dry visual core | Normalize named hero meshes; build actual cellular ribs and particles; fixed frontal composition; no audio, conductor or automation | Real production canvas A/B against recording: hero silhouette, scale, materials, cell shapes, negative space and depth. Bloom off. |
| P2 — camera/framing, manual controls, native motion | Verify fixed camera first; wire all controls/palette; implement all eight programs and transitions | Min/default/max and every enum visibly work; aspect bounds pass; meaningful frame-to-frame motion; BPM Sync proven with shared timing fixtures without reactive choreography. |
| P3 — Audio Intelligence | Continuous bass/energy/highs/vocals and canonical timing/event delivery | Quiet/steady/kick/snare/build/drop/vocal fixtures and actual analyzed playback visibly affect their intended regions. No local analysis. |
| P4 — Choreography | Target-bound event envelopes, conditions and Pattern Change event progression | Every canonical Trigger, duplicate/stale suppression, manual Pattern edit while Pattern Change stays ON, bounded restoration, zero/disable rules. |
| P5 — Visual Director | Broad build/impact significance only | Structural behavior strengthens the same visual idea; no topology/parameter takeover. |
| P6 — Auto Performance | Shared Mood drives/tags/resolver/lock; bounded temporary programs | Differential, silence, strength-zero, saved/effective controls, no-mood fallback, compiler failures, Inspector live display and real-browser no-layout-shift tests. |
| P7 — finishing | Focus, trails, bloom and glints; tune quality | OFF/default/max and quality comparisons; readable dry hero; resource cleanup. |
| P8 — production acceptance | Browser/control/audio/re-entry/context tests, real-track review and reference comparison | Human review of appearance, motion, musicality and authority; all contract stop-ship conditions clear before promoting catalog role from reference to finished first-party preset. |

A weak visual gate sends work back to geometry/material/framing, not forward to more bloom or automation. Do not run the full acceptance matrix after every small edit: use focused checks while building, then one full acceptance pass after integration; repeat only cases invalidated by subsequent fixes.

## 13. Acceptance and evidence matrix

Use the actual `Cinema2Runtime`, preset/module/effect registries and real Inspector. Follow existing production harness patterns such as `Cinema2HypnotizeProductionBrowserHarness.ts` and `Cinema2OpenDecksBrowserHarness.ts`; a mocked canvas or a snapshot of parameter values is insufficient.

| Test family | Required proof / saved evidence |
|---|---|
| Reference composition | A/B crops at quiet, normal and flare moments; aligned hero footprint; baseline screenshot with all finishing OFF; source UI excluded. Human review decides visual quality. |
| Geometry | Correct source-axis/scale normalization; face/edge registration; independent core pivots; connected shell rest graph; depth/clip safety under all patterns and maximum controls; no accumulated drift. |
| Hero visibility | Measure wordmark/core regions, not whole-frame brightness. Bright background alone must fail. Preserve recognizable letter edges at maximum allowed effects. |
| Numeric controls | Deterministic min/default/max captures for every numeric control, expected regional change and intended property measurement (positions/count/depth/blur), not only image hash differences. |
| Palette | Six independent color swaps with stable geometry/time. Each affects its documented role only; specifically test recoloring the black source face. |
| Patterns and motion | All eight program rest/mid/end captures; filmstrips showing distinct paths; each pair differs geometrically; motion off, rate zero, extent zero, core travel zero and density zero behave as specified. |
| BPM Sync | ON/OFF at 90, 150 and 180 BPM; source-vs-host toggle cross-product; phase-continuous switching; pause/resume/seek/loop/re-entry. Prove motion rate changes, not just BPM state. |
| Canonical Triggers | All 11 exact values/labels, each with a matching new event. OFF holds; ON advances once; no immediate repeats; Trigger visibility follows saved toggle; edits/toggles/duplicate events do not cause stale jumps. |
| Manual Pattern authority | With Auto Performance off and Pattern Change on, edit during an active event; chosen program appears immediately, toggle stays on, duplicate event cannot undo it, next fresh qualifying event can advance. |
| Audio | Same clock/random seed for no audio, quiet, steady groove, bass-only, kicks, snares, highs, build, first/sustained drop, vocals, phrase/section and silent stop. Compare geometry regions and event latency, not just luminance. |
| Build/drop override | Correct bounded episode, no replay when enabling mid-event, underlying base continues advancing, correct current base returns; palette and saved controls unchanged. Drop wakes silence. |
| Shared Mood differential | One persistent upstream bridge/director/conductor feeds staged ON/OFF cases with identical facts. ON changes Design and Effects across calm/energetic passages; OFF equals the no-conductor rendering; Reactivity zero removes drives. |
| Mood pattern policy | Effective values follow shared feel/build/shock/section-progress ladder and debounce/drop exception. Saved values never change. OFF/no mood/no beat grid restores saved values. Inspect the three required effective-policy fields. |
| Compiler | Valid manifest passes. Invalid mood tag, wrong tagged type, missing paired tag and missing ladder value fail with the matching `CINEMA2_PRESET_MOOD_POLICY_*` diagnostic. |
| Inspector | Four parents; exact Pattern/Pattern Change/Trigger order; six actual color parameters; lock and refused edits; Palette/Auto Performance/BPM Sync remain editable; Reset disabled; live marks/readouts/choosing note appear. Measure identical row/group/window sizes in a real browser. |
| Lifecycle | Switch away/back, no-source/paused start, seek forward/back, loop, new track/analysis, resize, context loss/restore. No stale envelopes, doubled triggers, old histories, GPU leaks or console/WebGL errors. |
| Aspect/quality | 16:9, 4:3, 1:1, 9:16 plus live resize; high/medium/low. Hero stays in safe bounds, edges feel populated, every program and color role remains visible. |
| Real music and human review | Representative quiet/steady/kick-heavy/snare/build/drop/vocal/structural passages; A/B reference plus dry and finished renders; user review of visual weight, timing, movement quality, control responsiveness and overall identity. |

Evidence package: deterministic fixture/seed/timestamp settings; named captures/filmstrips; measurements and production diagnostics; effect OFF/default/max comparisons; saved versus resolved parameter snapshots; resource before/after counts; reference review notes; intentional-difference list. Do not mark a gate passed before its evidence exists. The [P1 report](P1-dry-core-report.md) records completed dry-core validation; later control, motion, audio, intelligence and human acceptance evidence remains pending.

## 14. Contract coverage and final implementation deliverables

| Contract sections | Where addressed / required implementation deliverable |
|---|---|
| §1, §5, §8 | Reference analysis, dry geometry, counts, bounds, pivots, projection/depth and P1 visual gate (§1–4, §12). |
| §2–4 | Single system ownership map, resolved target flow, full authority matrix, hard permissions (§6–7). |
| §6–7, §21 | No legacy engine port. GLB/video inventory and source A/B replace legacy-engine parity; intentional differences explicitly recorded (§1–2, §13). |
| §9 | Four Inspector parents, real BPM Sync, eight patterns, canonical 11 Triggers and six color roles (§4–5, §7–8). |
| §10–14 | Distinct motion, continuous/rhythm/structure maps, deterministic timing/lifecycle, bounded choreography and Director use (§8–9). |
| §15 | Shared Mood drives, helper tags, effective resolver, domains/lock/live display, silence and differential tests (§6–7, §10, §13). |
| §16–18 | Deliberate world-space/fixed-camera choice, safe bounds, dry first, effect OFF/default/max (§3, §11). |
| §19–20 | Production-path matrix, regional/perceptual checks and human review (§13). |
| §22–23 | Stop at failed visual/authority gates; ordered implementation and no premature production promotion (§12). |
| §24–25 | This specification supplies the planned maps; implementation must supply the native module, production tests, captures and actual signoff below. |

Implementation handoff must contain all contract §24 deliverables: behavior specification; ownership and authority matrices; parameter/audio maps; BPM contract; pattern/Trigger specification; palette role map; native renderer/module; production control/motion/audio/event tests; manual authority and preservation tests; re-entry/reset tests; visual checkpoints; reference A/B and intentional differences; Mood drive/domain table; shared Auto Performance/compiler/Inspector/no-layout-shift tests. Legacy-engine A/B is explicitly not applicable; video/asset A/B is mandatory here.

The preset is not finished until the full §25 checklist has evidence: correct composition and safe resize; every real control including mandatory shared controls; distinct visible motion; rhythmic, continuous and structural response; preserved manual authority and hard disables; shared Mood/Director/Choreography correctness; clean restoration; no lifecycle/resource errors; production browser tests and human visual acceptance. Any §22 stop-ship condition blocks release.

Proposed intentional differences to approve at the dry/behavior gates: actual open 3D cell ribs instead of only a textured sphere, live rather than baked musical timing, eight native geometry programs, configurable colors, restrained capped flares, and a quieter idle state. The wordmark, three bars, black/blue/red hierarchy and stable hero composition remain the reference anchor.
