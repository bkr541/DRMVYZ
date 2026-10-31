# Cinema 2.0 — Trippy, Bro

Status: the October 31 audit rejected revision 3's reference fidelity. Revision 4 implements the five requested visual corrections; see `cinema2-trippy-bro-reference-rework.md`. Earlier phase acceptance is historical and does not replace review of the rebuilt moving output.

## 1. Reference and analysis boundary

- Video: `/Users/kodyrobinson/Desktop/TrippyBro.mov`.
- Format: 954 × 954, 60 fps, approximately 12.135 seconds; H.264 video with an AAC audio stream.
- Contract: `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` in the repository root.
- Analysis method: metadata inspection, overview frames, and 48 sequential visual samples at quarter-second intervals across approximately 12 seconds. Timing descriptions below are approximate visual observations, not a frame-exact reconstruction.
- The clip establishes visual language. Its embedded audio has not been auditioned or aligned against detected musical events; the proposed musical mappings are authored recommendations, not claims about the source's reactive implementation.
- This is a new preset inspired by a video, not a legacy preset port. The new-preset specification and acceptance rules apply; legacy pixel parity is not the objective.

## 2. What the reference does well

The image behaves like a luminous geometric instrument. Most frames are organized around a central point, bilateral reflections, and fourfold rotational balance. Thin colored lines remain readable because the background is almost black and substantial negative space survives between them.

The recurring sequence has several recognizable states:

| Approximate first occurrence | Visual observation | Useful design lesson |
|---|---|---|
| 0–1.5 s | A diagonal multicolor grid sits inside separated diamond outlines. Small center/cardinal jewels and a circular yellow orbit appear and intensify. | Establish a stable central scaffold; let small details and surrounding geometry change its emphasis. |
| 1.5–2.1 s | Golden comb-like chevrons grow around a tighter colored diamond; the center opens into a darker crossing. | Change occupied space and line orientation, rather than only increasing brightness. |
| 2–3.3 s | Four overlapping circular outlines contain cyan-white radial segments, bright hubs, and alternating open sectors. Some connecting diagonals become visible as the spokes dim. | Independent counter-rotating radial mechanisms provide a second visual family. Darkness between segments is part of the pattern. |
| 3.3–3.6 s | A large cyan/blue X and paired side accents take over the composition. | A simpler silhouette gives the eye a reset between denser states. |
| 3.6–4.3 s | Parallel colored curves form a woven central wave, with bright satellite accents and diagonal framing. | Elastic curvature contrasts with the rigid lattice and radial fans. |
| Approximately 4.3–12 s | The sequence returns to the diamond family and recurs with changing intermediate appearances; the clip ends in the circular family. | Repetition makes the visual identifiable; variation can come from phase, geometry, and light distribution. |

The perceived motion includes line travel, expansion/contraction, rotating fan sectors, alternating illumination, and geometric replacement. Some transitions preserve the center while substantially changing the silhouette. Short luminous echoes and soft halos provide persistence without filling the frame with fog.

Color has distinct jobs: amber/yellow outlines and chevrons; cyan/blue structural lines and fans; magenta/pink jewels and accents; pale white peak highlights. Their arrangement creates a rainbow impression without making every object a uniform rainbow.

The framing appears fixed and front-facing. The source contains interface icons in the corners; these are recording artifacts and are excluded from the preset artwork.

### Preserve as the identity

1. Centered geometric composition and fourfold balance.
2. Interplay between diamond lattices, circular fans, crosses, and woven curves.
3. Fine luminous strokes, a dark field, and localized bright nodes.
4. Color separation, deliberate empty spaces, and alternating dense/open states.
5. Continuous patterned motion with readable changes in silhouette.

### Treat as inspiration

The exact loop length, exact counts, source playback speed, particular hues, and transition ordering need not be copied. The footage does not establish how silence, vocals, builds, drops, manual controls, or other aspect ratios should behave; those require authored decisions.

## 3. Proposed creative direction

**A psychedelic neon drawing machine: diamonds interlace, four optical fans counter-rotate, and luminous threads bend into impossible woven forms.**

The hero remains graphic and centered. Richness comes from precise motion, light hierarchy, and geometric relationships. The initial design uses screen-space composition with a fixed view. Perspective flight, orbiting cameras, opaque central objects, and volumetric scenery would weaken this particular reference.

### New supporting elements

- **Orbiting tracers:** a few small lights follow existing circles or diamond boundaries, making direction and counter-motion easy to read.
- **Traveling intersection pulses:** brief accents move through selected grid crossings. They connect peripheral motion to the central jewel without illuminating the entire grid at once.
- **Geometric echoes:** one or two faint delayed contours reinforce a release or structural transition. They are bounded, short-lived, and removable.
- **Braided connectors:** slender curves link the four fan hubs during selected phases, making the four mechanisms feel like one instrument.
- **Peripheral tick arcs:** sparse broken segments frame open compositions and provide a restrained high-frequency response.

These elements remain subordinate to the active hero. Their counts and brightness are capped; they do not all run at maximum simultaneously. No general-purpose particle cloud is needed.

## 4. Geometry and rendering proposal

- Use a dedicated native module and GPU-rendered procedural strokes/segments. Select the precise stroke implementation during Phase 1 after checking the module and render-provider contracts.
- Define local artwork coordinates with origin at the center, X right and Y up. Convert explicitly into the engine's screen coordinate convention at the renderer boundary.
- Scale equally in X and Y from the shorter canvas dimension. Circles stay circular; diamonds do not stretch with the viewport.
- Updated after Phase 1 review: use uniform cover framing at 1.65× the longer canvas dimension and double authored stroke widths. The outer diamond radius reaches about 71% of the longer dimension from center and deliberately continues off all four sides. Keep the central anchor visible; peripheral cropping is intentional.
- Diamond family: one central lattice, up to three outline bands, one core jewel, and four cardinal accent positions. Density controls line subdivision within a fixed budget.
- Circular family: four hubs on a symmetric 2 × 2 arrangement, each with a ring and bounded radial segment bank. Prototype 16–24 segments per hub and settle the count by visual review.
- Curve family: one centered bundle of mirrored parametric curves, plus at most four satellite accents.
- Rotations pivot at the composition origin or the relevant fan hub. Line endpoints terminate on authored masks/boundaries; no accidental half-screen cutoffs.
- On wide and portrait outputs, preserve the centered anchor and isotropic geometry while cropping the oversized artwork to cover the canvas. Do not stretch or tile the hero.
- Base geometry must read with bloom, trails, distortion, and secondary accents disabled. Use a small, explicit compositing order: background → faint scaffold → hero strokes → nodes → finishing.
- Default camera is fixed. No camera controls are proposed because the composition does not require camera movement.

## 5. Eight proposed native patterns

The first five develop the observed vocabulary. The last three extend it. All eight must differ in geometry or motion, not merely palette.

| Pattern | Composition and motion | Distinct role |
|---|---|---|
| **Prism Lattice** | Diagonal woven grid, segmented diamond borders, central jewel, and traveling intersection accents. Opposing line banks slide in counterphase. | Default identity and steady groove. |
| **Golden Fold** | Four comb-like chevron banks hinge inward and outward around a dark diamond opening; cyan inner lines counter-travel. | Compression, anticipation, and rhythmic articulation. |
| **Quad Bloom** | Four circular fan mechanisms with independently phased sectors, counter-rotation, and linking diagonals. | Expansive circular movement and release. |
| **Neon Cross** | Four luminous arms form a large X, with line packets traveling toward and away from the core. | Sparse, punchy silhouette. |
| **Liquid Weave** | Mirrored curve bundles form a breathing woven lens; satellite jewels punctuate its outer lobes. | Fluid contrast, vocals, and melodic passages. |
| **Orbital Lace** | Interlocked elliptical paths wrap a restrained diamond core; a few tracers create braided crossings. | New smooth, hypnotic orbital family. |
| **Prism Echo** | Several separated diamond contours ripple outward with alternating line windows and sparse intersection flares. | New measured recursion without a perspective tunnel. |
| **Chromatic Knot** | Four curved arms weave around a central negative-space aperture, unfolding into a compact rosette. | New high-energy synthesis of curves and fourfold geometry. |

Transitions preserve the central anchor. Related geometries can interpolate their shared attributes; unrelated topologies use a brief, controlled dissolve or collapse/reveal. Avoid long superimpositions of two full-density patterns.

## 6. Inspector and visible-output contract

These are proposed controls, subject to perceptual proof before finalizing the manifest. Keep every control under the required four parents and use shared typography and generic Inspector definitions.

| Parent | Proposed controls | Required visible result |
|---|---|---|
| **Master Controls** | Master Intensity, Music Reactivity, BPM Sync, Auto Performance | Output ceiling, musical response strength, motion timing, and permission for temporary performance choices. |
| **Design** | Pattern → Pattern Change → Trigger; Composition Scale, Line Density, Stroke Width, Motion Speed, Motion Amount, Secondary Detail | Distinct native pattern, qualified switching, framing, subdivision, thickness, travel rate, travel range, and supporting geometry. |
| **Effects** | Bloom, Trails, Chromatic Separation, Geometric Echo | Halo size/strength, finite persistence, restrained channel displacement, and additional delayed contours. Zero is a hard off for each effect. |
| **Palette** | Background, Cyan Structure, Blue Weave, Magenta Accent, Amber Orbit, Highlight | Six independent actual color parameters, each with a distinct rendered consumer. |

Proposed defaults: Prism Lattice; Pattern Change OFF; stored Trigger Phrase; Auto Performance OFF; BPM Sync ON; moderate motion and low finishing. Pattern Change and Auto Performance are separate permissions. Custom colors remain authoritative; no automatic hue cycling is proposed.

Each control needs a documented type, unit, minimum/default/maximum, binding, ownership, and expected image change. Zero Motion Amount stops procedural geometric motion; zero Motion Speed stops its phase travel. Neither silently disables permitted light-only musical accents. Secondary Detail zero removes the supporting details. Master Intensity zero extinguishes emitted artwork while retaining the authored background.

### Pattern switching

Reuse `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` or its canonical successor: Beat, Kick, Snare, Downbeat, Every 2 Beats, Every 4 Beats, Bar, Every 4 Bars, Every 8 Bars, Phrase, Drop. Preserve their exact existing values and meanings.

Trigger is visible only while Pattern Change is ON and retains its selection while hidden. Advance using fresh shared event identities, avoid immediate repetition, and suppress duplicate/stale events. Manual Pattern selection always acts immediately, keeps Pattern Change ON if enabled, and holds until the next fresh qualifying event. Runtime progression must not overwrite persisted authored Pattern.

## 7. Proposed authority matrix

| Property | Manual control | Audio modulation | Visual Director | Auto Performance | Manual edit behavior |
|---|---|---|---|---|---|
| Pattern | Authored base selection | Selected Trigger advances runtime base only when enabled | Significance informs authorized temporary choices | Temporary build/drop substitution only | Immediate visible base; do not disable Pattern Change; suppress already-active override until a new qualifying event. |
| Pattern Change / Trigger | Exclusive permissions and timing choice | Shared events only | No ownership | Cannot change either setting | Rebase event tracking; no immediate stale switch. |
| Composition scale | Authored framing | Proposed maximum ±5% local breathing within safe bounds | May attenuate permitted response | Cannot replace base scale | Immediate new base; existing bounded response remains subordinate. |
| Density | Authored maximum | Restraint may reduce occupancy by up to 25% | May reduce detail during restraint | Cannot exceed user ceiling | Immediate new ceiling. |
| Motion speed / amount | Authored rate and range | Proposed maximum +20% speed and +15% range; zero remains zero | Scales response within these same bounds | Cannot replace manual settings | Immediate new base; no cumulative modulation. |
| Master intensity | Authored ceiling | Pulses allocate brightness below ceiling | May shape contrast below ceiling | Cannot exceed ceiling | Immediate ceiling; zero remains dark. |
| Secondary detail | Authored budget | Highs activate existing permitted details | May reduce detail | Cannot re-enable zero | Immediate budget; zero removes details. |
| Palette / background | Exclusive authored colors | No hue replacement | No ownership | No ownership | Immediate color change. |
| BPM Sync | Exclusive timing mode | Supplies timing facts | No ownership | Cannot change toggle | Preserve phase continuity while changing rate source. |
| Camera / framing policy | Fixed authored view | None | None | None | No automatic camera domain. |
| Bloom / trails / separation / echo | Authored amounts and ceilings | No automatic changes in initial design | None | Cannot re-enable zero | Immediate exact effect setting; clear history when disabled. |
| Auto Performance | Exclusive opt-in | Fresh build/drop events qualify actions | Supplies broad significance | Owns only documented temporary pattern substitution | OFF ends override and returns to current runtime base. |

Numbers above are initial design limits to tune by visual evidence, not claims about existing engine defaults. Modulation uses resolved targets and documented composition rules. Native animation phase and geometry state are legitimate module state; hidden competing parameter ownership is not.

## 8. Musical direction and timing

| Musical fact | Proposed visual response | Initial envelope / bound |
|---|---|---|
| Overall energy | Increase permitted travel and selectively fill line windows. | Smooth over roughly 150–300 ms; remain within motion/density limits. |
| Bass | Gentle lattice breathing or fan aperture expansion. | Up to 5% local displacement; smoothed, centered, and frame-safe. |
| Kick | Send a short packet outward from the core along the current pattern. | Approximately 15 ms attack, 180 ms decay; one packet per event identity. |
| Snare | Accent alternate diagonals or opposing fan sectors. | Approximately 10 ms attack, 140 ms decay; no full-frame flash. |
| Highs / air | Sparse tracer and tick activation. | Bounded by Secondary Detail; no background noise blanket. |
| Vocal presence | Reduce secondary occupancy and emphasize the central silhouette. | Up to 25% restraint; slow onset/release avoids chatter. |
| Build | Compress motion around the center and tighten occupied space. | Maximum 5% compression; never substitute a pattern without Auto Performance permission. |
| Drop | Release compression and launch an outward geometric accent. | Proposed 20 ms attack, 450 ms release, within authored limits. |
| Phrase / section | Qualify a selected pattern trigger or reset transition residue at a true discontinuity. | No unconditional layout replacement when Pattern Change is OFF. |

Every final choreography rule must state source, target, operation, strength, attack/decay, conditions, and ownership. These mappings are separate dimensions of performance; they must not collapse into eight ways to increase brightness.

**BPM Sync ON:** fan rotation, line packet travel, chevron articulation, and curve breathing use shared beat position/phase with authored cycle lengths. Use existing shared transport/timing infrastructure; add no local beat detector or competing BPM clock.

**BPM Sync OFF:** the same motion uses explicitly authored seconds-based rates. Audio energy and event accents continue. Pattern Change remains driven by its selected musical Trigger, because that toggle grants a separate event-switching permission.

Timing decision from Phase 1: the preset toggle governs these preset motion domains; host timing supplies facts rather than a second hidden veto. The existing shared beat-clock API accepts that explicit toggle and resolves analyzed BPM before the host fallback. Phase 2/3 must prove both timing paths when motion/audio are implemented. Missing timing must use an explicit fallback with no claim of beat lock.

**Idle and transport:** no track uses a static authored pose without fabricated beats (final implementation choice). A loaded but paused track holds motion and pattern progression. On play, musical behavior is visibly stronger than idle. Seek, loop, track change, analysis revision, and re-entry clear stale envelopes and event identities and reconstruct timing deterministically. Sync toggles preserve current geometric phase and change its subsequent timing source. Accumulating effects are cleared where needed to prevent old frames leaking across discontinuities.

## 9. Existing architecture and intended integration

Initial inspection confirmed native module interfaces, resolved parameter/target facilities, shared Audio Intelligence and choreography runtimes, screen-space coordinate support, effect/render graph facilities, a first-party catalog, and production browser harness examples.

Relevant existing seams:

- `src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts`
- `src/components/vyzualz/cinema2/modules/Cinema2ModuleContracts.ts`
- `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts`
- `src/components/vyzualz/cinema2/parameters/Cinema2TargetRuntime.ts`
- `src/components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge.ts`
- `src/components/vyzualz/cinema2/choreography/Cinema2ChoreographyRuntime.ts`
- `src/components/vyzualz/cinema2/director/Cinema2VisualDirector.ts`
- `src/components/vyzualz/cinema2/render/Cinema2RenderGraph.ts`
- `src/components/vyzualz/cinema2/effects/Cinema2EffectRuntime.ts`
- `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts`
- Existing Afterhours trigger definitions and Hypnotize/Sixfold pattern/runtime examples.
- `src/test/browser/Cinema2SixfoldProductionBrowserHarness.ts` as an example of deterministic fixtures driving the real runtime.

Suggested new identities: display name **Trippy, Bro**, stable preset ID `drmvyz.cinema2.trippy-bro`, and module type `trippy-bro-native`, subject to collision checks in Phase 1.

Suggested new files: `Cinema2TrippyBroPreset.ts`, `Cinema2TrippyBroNativeModule.ts`, a small `modules/trippyBro/` geometry/pattern/render implementation, focused tests, and a real-runtime browser harness. Keep module-specific artwork local. Reuse shared timing/event utilities after verifying their semantics; do not copy an unrelated preset's visual renderer or assume its controller satisfies all current authority rules.

No imported movie playback is required. No external models, bitmap assets, new dependencies, shared Inspector special cases, or new musical analysis systems are currently justified.

## 10. Implementation phases and completion gates

### Phase 1 — Final specification, architecture, and static visual core

Confirm this creative direction and authority matrix, inspect the remaining runtime seams in detail, resolve host/preset BPM Sync policy, and finalize parameter ranges and geometry budgets. Implement the preset/module skeleton and the default Prism Lattice at a frozen phase, without audio, Director, choreography, or finishing effects. Keep it a development/review entry rather than a finished catalog preset.

**Deliverables:** behavior specification, ownership/parameter maps, baseline native renderer, and one production-canvas capture set showing the clean hero at square, landscape, and portrait sizes.

**Gate:** recognizable lattice, correct cover framing, bold stroke hierarchy and negative space, intentional four-edge overscan without stretching. Review the static composition before proceeding. Phase 1 does not include the remaining seven animated patterns or musical automation.

### Phase 2 — Fixed framing, manual controls, eight patterns, and native motion

Prove the fixed camera first. Implement all eight native patterns and their distinct movement vocabulary. Wire the four Inspector parents, independent palette roles, mandatory control trio, timing toggle, and all geometric controls. Add restrained supporting geometry. Use deterministic shared timing fixtures to demonstrate Sync ON/OFF; live music integration follows in Phase 3. Deferred effect controls must not appear functional until Phase 7 supplies their consumers.

**Deliverables:** pattern contact sheet, short native-motion captures, and production-path minimum/default/maximum control evidence, including dropdowns and placeholders where applicable.

**Gate:** eight visibly distinct patterns; every exposed manual control works; geometry is readable without finishing; zero/hard-off behavior holds. Trigger options and conditional visibility are correct, with automatic event behavior completed next.

### Phase 3 — Shared Audio Intelligence and event-driven progression

Connect existing shared audio facts and transport. Implement continuous/rhythmic response through resolved targets, canonical Trigger progression, duplicate suppression, manual selection while cycling, timing modes, and reset/re-entry handling. Do not introduce new analysis or a local musical clock.

**Deliverables:** deterministic quiet/groove/kick/snare/build/drop/vocal fixtures and short real-playback evidence; focused timing/event tests.

**Gate:** music visibly changes the appropriate geometry; Pattern Change OFF holds; ON advances only on fresh selected events; manual Pattern selection remains visible until the next fresh trigger. Missing capabilities degrade deliberately.

### Phase 4 — Bounded choreography

Author the precise core packets, alternating sector accents, vocal restraint, build compression, and drop release through existing choreography and target resolution. Tune envelope shapes and confirm clean return to authored settings. Keep Auto Performance OFF.

**Deliverables:** final signal/target/envelope table and event-focused production captures.

**Gate:** responses are visibly distinct, deterministic, and bounded; manual ceilings and hard-off controls remain authoritative; no persistent drift from authored values.

### Phase 5 — Visual Director meaning

Use shared intensity, momentum, build, and impact significance to scale the already-authored responses. Leave object-specific decisions in the preset's choreography/native implementation.

**Deliverables:** matched low/high-significance comparisons and documented limits.

**Gate:** Director adds musical hierarchy without continuously changing user colors, topology, camera, or selected patterns.

### Phase 6 — Explicit Auto Performance

Implement optional, temporary build/drop pattern substitutions. Keep the underlying Trigger-driven runtime base advancing while a substitute performs. On release, return to that current base. A manual Pattern edit cancels the visible substitute and suppresses that already-active event; a later separately qualifying event may authorize another override.

**Deliverables:** authority tests and production comparisons covering manual edits during builds/drops, valid base advancement during an override, and disabling automation mid-event.

**Gate:** no persisted Pattern/Trigger mutation, no forced Pattern Change toggle, no stale-event takeover, and no indefinite temporary override.

### Phase 7 — Finishing and supporting accents

Add restrained bloom, finite trails, chromatic separation, and geometric echoes. Tune tracer/tick brightness and transition cleanup. Use existing effects where they provide the required visible result; avoid parallel feedback systems.

**Deliverables:** OFF/default/maximum effect comparisons and one proportional performance/resource measurement at the agreed production resolution and quality.

**Gate:** no effect conceals weak geometry; black gaps survive; zero clears the effect and its history; quality reduction removes subordinate detail before damaging the hero. Do not invent a universal frame-rate promise without measuring target hardware.

### Phase 8 — Acceptance and production catalog promotion

Complete focused unit checks plus a production-path acceptance pass for all controls, eight patterns, all 11 triggers, musical cases, authority, timing discontinuities, resize/aspect behavior, preset switching, and resource cleanup. Inspect the actual application Inspector as well as the canvas harness. Reuse earlier evidence unless later changes invalidate it.

**Deliverables:** visual acceptance gallery/clips, final behavior and authority documentation, focused validation report, and known intentional differences from the source.

**Gate:** human visual review confirms identity, motion quality, musicality, and usable controls. Promote the review entry to the finished first-party catalog only after acceptance. Passing type checks or rendering non-black pixels alone does not qualify.

## 11. Review scope and current state

This proposal recommends eight patterns, a fixed centered screen-space composition, six independent palette roles, moderate native motion, and opt-in automatic performance. The default stays close to the diamond-lattice identity, with the other families available immediately through manual selection once Phase 2 is complete.

The native module now includes eight patterns, complete bound controls, shared musical/choreography/Director integration, optional bounded Auto Performance, and finishing. The approved thick strokes and four-edge overscan remain the default. `cinema2-trippy-bro-phase1.md` records the historical static checkpoint; `cinema2-trippy-bro-production.md` documents the current implementation and acceptance. No commit has been requested.
