# Inertia — Phase One specification

Date: 2026-10-29  
Status: all implementation phases and final human visual acceptance are complete; Inertia is a keeper. See [the final implementation and acceptance report](cinema2-inertia.md). The specification below records the initial design; subsequent tuning is recorded in the phase/final reports.  
Scope: a new first-party Cinema 2.0 preset reconstructed procedurally from a video reference. This is not a legacy port or a video-texture preset.

## 1. Evidence and confidence

- Reference: `/Users/kodyrobinson/Desktop/Inertia.mov` (the requested `/Desktop/Inertia`).
- Contract: `../DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`.
- Movie metadata: 954 × 954 H.264, approximately 18.67 seconds total; 473 video frames over approximately 18.65 seconds. Nominal frame rate is 60 fps, but average captured rate is approximately 25.3 fps. AAC stereo audio is present.
- Inspection: one-second samples throughout the recording, quarter-second samples through its first five seconds, and an enlarged deformation frame around three seconds. Extraction sheets were temporary analysis outputs; they are not committed acceptance evidence.
- Observed: a centered dotted sphere, ordered cube-like lattice surfaces, larger corner/landmark points, fine connecting ribs, black background, and repeated rotation/shear/fold/recovery motifs. Similar states recur approximately every five seconds; this does not establish a mathematically seamless loop.
- Unknown: original topology, exact counts, source shaders, object-versus-camera rotation, soundtrack BPM, or causal audio-to-motion mapping. The audio track was identified in metadata; no measured soundtrack synchronization is claimed.

The counts, parameter values, timing, musical mappings, and six patterns below are authored reconstruction decisions. They must not be presented as recovered source settings.

### Mandatory identity

Preserve one readable spherical core inside one ordered deformable cage; a quiet monochrome default; fine dot rows; stronger anchors; layered depth; stable centered framing; smooth force/follow-through/recovery. The cage must return to a coherent structure after its folding gestures. Avoid uniform random particle scattering, solid opaque cage faces, or excessive glow that merges the dots.

Exclude the gray recording controls at the lower-right edge. Additional patterns and music response extend the reference and are subject to this specification's review.

## 2. Geometry and rendering contract

### Space, camera, and bounds

- Right-handed world space: +X right, +Y up, +Z toward the default camera. Sculpture origin and rotation pivot are `(0, 0, 0)`.
- Fixed orthographic camera at `(0, 0, 4)`, looking at the origin, +Y up. Initial near/far proposal: 0.1/10. Object transformations produce rotation; no camera motion or automatic zoom is authored.
- The shorter viewport dimension spans world coordinates -1 to +1. The longer dimension expands with aspect ratio. Thus world proportions are preserved in square, landscape, and portrait outputs.
- Reserve an outer projected radius of 0.92 world units, leaving at least 4% of the shorter viewport dimension as padding on each side. Include anchor radius and rib endpoints in this bound.
- Camera projection and fit do not change frame by frame. Do not normalize away breathing or collapse motion using automatic refitting.
- Cage half-extent starts at 0.45. A rigid rotation fits within radius `sqrt(3) * 0.45`, approximately 0.78. At the maximum Cage Size of 1.1, reserve the remaining space up to 0.92 for bounded deformation and sprite extent. Constrain displacement to the remaining geometric budget before projection; do not hide overflow by clipping points.
- Cube orientation for the first static checkpoint: approximately X=15°, Y=-20°, Z=20°, to be tuned against the reference before visual acceptance. This is a starting pose, not an exact measurement.
- Sphere radius starts at 0.26, giving a diameter approximately 26% of the shorter viewport dimension. Sphere and cage share an origin but have independent local transforms.
- Fixed camera is an intentional design choice. Weak perspective is a possible later user-approved revision only if orthographic production captures cannot preserve the reference's depth cues.

### Native primitives

1. **Core:** one hollow point surface sampled in structured latitude/longitude rows; initial balanced-quality proposal: 64 longitude samples × 33 latitude samples, with duplicate poles removed. Preserve a readable rim and dark interior.
2. **Cage:** six ordered grid surfaces on a cube; initial balanced-quality proposal: 33 × 33 samples per face, deduplicating coincident border points. Preserve row correspondence during deformation and transitions.
3. **Anchors:** eight brighter corner points. Eight is the chosen reconstruction topology; the recording does not prove every anchor count in every frame. Anchors follow their deformed corners exactly.
4. **Ribs:** selected thin boundary/row connections with an initial budget of approximately 384 segments. Endpoints use the same deformation function as cage points. No dangling lines or screen-edge projection.

At a 954px square viewport, starting screen-size targets are approximately 1.1px cage dots, 0.9px core dots, 5px anchor diameter, and 0.75px ribs. Implement logical-pixel/DPR handling deliberately; tune these targets in Phase Two rather than accepting invisible points because their buffers exist.

Use soft antialiased point coverage and restrained premultiplied transparency. Opaque background is rendered first. Transparent cage/core surfaces must remain visible through one another: no opaque shell depth write that erases the far lattice. Test transparent draw order, depth testing, and any optional depth output on the actual render graph. Do not require atmosphere or depth effects simply because world space is used.

Quality modes may reduce regular sampling and rib count, while preserving the sphere, eight anchors, face topology, and pattern silhouettes. Density edits change real sampling; they must not merely dim unchanged geometry. Seed any point variation through engine randomness. No texture, model, or generated-image asset is required.

## 3. Pattern library and native motion

All patterns retain the same core/cage identity. Transitions interpolate corresponding geometry and deformation fields rather than spawning unrelated artwork. Use stable analytic or fixed-step damped responses; never frame-rate-dependent spring integration or unbounded accumulated rotation.

| ID / label | Authored movement and distinguishing result | Cycle at Speed=1 |
| --- | --- | --- |
| `reference-cycle` / Reference Cycle | Oblique coherent cage rotates through readable open/front views; a traveling shear folds several lattice sheets across the core, followed by recovery. The sphere remains legible throughout. | 8 beats or 5 seconds |
| `countertwist` / Countertwist | Upper and lower cage regions rotate in opposing directions with a neutral band near the equator; the core rotates more slowly. Distinct hourglass/torsion silhouette. | 8 beats or 5 seconds |
| `breathing-cage` / Breathing Cage | Opposing face pairs move inward/outward with delayed corners, then settle; minimal overall rotation. Reads as pressure and expansion rather than twisting. | 4 beats or 3 seconds |
| `torsion-wave` / Torsion Wave | Twist travels along the vertical axis through ordered rows; continuous phase differences produce a progressing helical bend. | 8 beats or 5 seconds |
| `slice-shear` / Slice Shear | Horizontal bands translate in alternating directions with smooth boundary blending; ribs follow the offset rows. Produces crossing sheets while the core stays centered. | 4 beats or 3 seconds |
| `collapse-release` / Collapse / Release | Cage compresses inward, briefly holds tension, opens with bounded overshoot, and returns to its original extent. Core remains visible and never collapses to a point. | 8 beats or 5 seconds |

Reference Cycle motion storyboard, expressed as normalized cycle position: 0–0.40 coherent rotation; 0.40–0.68 increasing shear/fold; 0.68–0.82 peak crossing sheets; 0.82–1.00 damped recovery. These authored windows are not exact source timestamps. Tune against the complete recording, avoiding a visible seam between cycles.

Motion Amount multiplies all geometric motion, including rotation, deformation, and geometric audio accents; zero produces a static selected-pattern pose. Deformation independently scales nonrigid movement. Motion Speed changes cycle rate. Damping changes follow-through/settling, not the selected geometry or displacement ceiling. Use a roughly 0.12–0.65 second settling range from low to high damping, with at most 10% overshoot inside the safe-bound budget. Deterministically reconstruct/reset any transient spring state at discontinuities.

No track: static coherent pose of the selected pattern, no simulated musical events. Loaded but paused: freeze the native pose and phase; clear transient audio contributions. On playback start, enter moving behavior with a 200ms blend. Low-energy playback retains restrained authored motion; active rhythmic/structural response must remain visibly distinguishable from it.

## 4. Parameter-to-visible-output map

All entries are persisted user parameters unless stated otherwise. Stable proposed IDs use `inertia-<key>`. Scalars are normalized unless a unit is supplied. Numeric starting values can be tuned during visual implementation, but ownership, placement, and semantic meaning require explicit documentation if changed.

| Parent / key / label | Type; range; default | Actual visual or runtime consumer |
| --- | --- | --- |
| Master Controls / `bpm-sync` / BPM Sync | boolean; true | Native rotation, deformation cycle, and normal pattern-transition timing |
| Master Controls / `intensity` / Intensity | number; 0–1; 0.7 | Overall visual gain and hard brightness ceiling; zero is black except Background |
| Master Controls / `motion-speed` / Motion Speed | number; 0.25–2; 1 | Pattern cycle frequency multiplier |
| Master Controls / `motion-amount` / Motion Amount | number; 0–1; 0.65 | Rotation and geometric motion envelope; zero disables geometric motion |
| Master Controls / `audio-response` / Audio Response | number; 0–1; 0.65 | Gain on all music-driven modulation; zero removes it without stopping native motion |
| Master Controls / `auto-performance` / Auto Performance | boolean; false | Permission for Phase Seven's temporary build/drop substitutions only |
| Design / `pattern` / Pattern | enum; six IDs above; `reference-cycle` | Native base pattern |
| Design / `pattern-change` / Pattern Change | boolean; false | Permission for selected shared events to advance runtime base |
| Design / `trigger` / Trigger | canonical enum; `bar4` | Fresh-event selection; visible only while Pattern Change is ON |
| Design / `cage-size` / Cage Size | number; 0.65–1.1; 1 | Cage coordinates and anchors; no camera compensation |
| Design / `core-size` / Core Size | number; 0.65–1.4; 1 | Sphere radius multiplier only |
| Design / `lattice-density` / Lattice Density | number; 0.35–1; 0.8 | Ordered cage row/sample count within quality budget |
| Design / `point-size` / Point Size | number; 0.5–2; 1 | Core/cage dot diameter multiplier; anchors excluded |
| Design / `anchor-size` / Anchor Size | number; 0.4–1.6; 1 | Corner sprite diameter only |
| Design / `deformation` / Deformation | number; 0–1; 0.45 | Nonrigid cage motion and geometric audio allowance; zero retains rigid motion |
| Design / `damping` / Damping | number; 0–1; 0.65 | Delay/settling response; bounded overshoot as specified above |
| Effects / `bloom-enabled` / Bloom | boolean; false | Hard permission for shared bloom finishing |
| Effects / `bloom-amount` / Bloom Amount | number; 0–0.35; 0.08 | Shared effect mix, active only when Bloom is enabled |
| Effects / `trails-enabled` / Trails | boolean; false | Hard permission for shared feedback trails |
| Effects / `trails-amount` / Trails Amount | number; 0–0.2; 0.06 | Shared trail persistence/mix, active only when Trails is enabled |
| Palette / `background-color` / Background | color; `#000000` | Owned background surface |
| Palette / `lattice-color` / Lattice | color; `#B0B0B0` | Cage dots |
| Palette / `core-color` / Core | color; `#D0D0D0` | Sphere points |
| Palette / `anchor-color` / Anchors | color; `#FFFFFF` | Corner anchors |
| Palette / `rib-color` / Ribs | color; `#C0C0C0` | Thin connecting segments |

Use generic schema bindings, `designParentGroup`, and conditional visibility. Put Pattern, Pattern Change, and Trigger consecutively in a nested Pattern group under Design. Do not special-case Inertia in shared Inspector code. Preserve shared typography roles and nested heading alignment; later acceptance includes dropdown portals, placeholders, and affected workspace variants.

Do not expose future controls before their consumers exist. Effects controls are introduced in Phase Eight and Auto Performance in Phase Seven. Density is bounded by quality, but every advertised supported quality must retain a perceptible density range; test each supported tier rather than letting clamping make the slider inert.

### Palette independence

Five real color parameters address five separate consumers. Their default luminance hierarchy preserves the recording's monochrome identity. Colors are converted through the engine's color-management convention, without treating UI hex values as already-linear shader inputs. No palette cycling or automatic color ownership is planned. Every color must pass an isolated edit test with the other four unchanged.

## 5. BPM Sync and transport contract

Effective tempo lock is `preset BPM Sync && host BPM Sync` when the host explicitly publishes a boolean. If the host omits that optional preference, the preset toggle governs. Describe this in BPM Sync help text: host Sync must also be enabled. Report timing provenance through existing runtime diagnostics; do not imply confirmed synchronization when timing is absent.

When effective lock is ON, prefer available shared beat position/phase, then shared analyzed BPM/host BPM tied to transport time using established engine timing semantics. No preset-local BPM detector or musical clock. Distinguish confirmed grid from tempo-estimated timing. Without usable shared timing, use the authored seconds path and identify it as unsynchronized fallback.

When lock is OFF, use pattern seconds from Section 3, independent of track BPM. Audio reactivity and shared Pattern Change events remain available. Speed divides the duration of the selected native cycle. Normal pattern crossfade is half a shared beat in effective-sync mode, or 0.25 seconds in free-run mode, bounded to 0.12–0.5 seconds. Manual Pattern selection begins affecting geometry on the next rendered frame; no musical-boundary wait.

Mode/tempo changes preserve pose continuity by rebasing visual phase, then align to shared phase over the next cycle without creating musical events. A visual phase accumulator is permitted for continuity, not as an alternate source of beats or triggers. Test Sync ON/OFF at contrasting BPMs, such as 90 and 150, against the same free-run speed.

| Situation | Required state behavior |
| --- | --- |
| No track / missing transport | Static selected-pattern pose; clear music/override state; no autonomous trigger cycling |
| Loaded paused / pause | Freeze phase and native pose; clear transient music envelopes; retain authored controls and runtime base pattern |
| Resume | Continue retained phase; fence current event identities so a held event does not retrigger |
| Seek / loop | Clear transient envelopes and overrides; restore authored Pattern as runtime base, seed/rebase native phase from the new shared timeline or seconds position, and fence current events. A deliberate short reset blend is allowed; stale spring state is not |
| Track change / preset re-entry | Reset runtime base to authored Pattern; clear prior source identities, phase offsets, transitions, and effects history; reconstruct from the current transport |
| Analysis revision / context generation change | Revalidate source identity; clear stale event/envelope state and rebase timing; preserve authored controls |
| Sync / Speed edit | Preserve current pose and rebase phase progression; do not advance Pattern |
| Pattern / Trigger / Pattern Change edit | Apply the authority rules in Section 6; fence all events already present at the edit |

Only fresh events after the new timeline/edit fence qualify. Resetting the runtime base on seek/loop is intentional, rather than pretending to replay all historical pattern events. Paused manual edits must still visibly update the frozen composition.

## 6. Pattern Change and temporary performance precedence

Reuse `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` (or its actual canonical shared successor), including unchanged IDs, labels, and event meanings:

| Value | Label |
| --- | --- |
| `beat` | Beat |
| `kick` | Kick |
| `snare` | Snare |
| `downbeat` | Downbeat |
| `beat2` | Every 2 Beats |
| `beat4` | Every 4 Beats |
| `bar` | Bar |
| `bar4` | Every 4 Bars |
| `bar8` | Every 8 Bars |
| `phrase` | Phrase |
| `drop` | Drop |

Pattern Change OFF holds the authored base and hides Trigger while preserving its value. ON advances one step through the six-pattern order in Section 3 on each new qualifying canonical event. Do not repeat the current pattern, mutate the persisted Pattern, or implement preset-local phrase/bar/drop definitions. Missing event authority means no switch, not synthetic substitute beats.

Track authored Pattern, runtime base Pattern, and temporary performing Pattern separately within the existing control/value-resolution architecture. These are explicit runtime authority states, not a hidden parameter bypass.

Manual Pattern selection immediately establishes the runtime base, even while Pattern Change remains ON. Use edit revision information where available so reselecting an authored value can reclaim a runtime-advanced selection. Fence events already active on that frame. Evaluate the generic Mainframe controller for reuse; its value-change comparison alone is not sufficient proof of same-value reselection handling.

Auto Performance is optional permission distinct from Pattern Change. Proposed allowed substitutions:

- Fresh authorized build entry: temporarily perform Countertwist with a bounded compression envelope.
- Fresh authorized drop: temporarily perform Collapse / Release for at most four shared beats or two seconds if beat timing is unavailable. Drop supersedes a build override.
- Build override ends when the shared build ends, a drop supersedes it, or eight shared beats/five seconds elapse, whichever happens first. A still-held build cannot restart the expired override.

While an override is visible, valid Trigger events continue advancing the runtime base. Restore that current base when the override ends. Disabling Auto Performance restores it immediately with a short pose blend. Editing Pattern cancels the current override and fences the already-active build/drop; only a subsequent separately qualifying automatic event can start another. Pattern Change and Trigger are never rewritten by Auto Performance.

## 7. System ownership and integration seams

| System | Inertia responsibility boundary |
| --- | --- |
| Audio Intelligence bridge | Shared musical facts, availability, provenance, rhythmic/structural event identity; no new local analysis |
| Visual Director | Broad intensity, momentum, tension, impact, and significance; no Inertia geometry knowledge |
| Choreography runtime | Bounded preset-specific temporary target contributions and envelope dispatch |
| Parameter State / target resolver | Authored controls, edit revisions, permissions, composition, and resolved values |
| Inertia native module | Geometry, pattern deformation, native phase, local visual simulation, drawing, and resource lifecycle; consume current resolved values |
| Camera runtime | Fixed orthographic framing; no automatic shot ownership |
| Render graph / effects | Scene/background composition and optional shared finishing with explicit hard enables |

Verified repository seams (relative to repository root):

- `src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts`: manifest contract.
- `src/components/vyzualz/cinema2/modules/Cinema2ModuleContracts.ts`: resolved parameter reads, edit revisions, frame transport, camera execution, and managed resources.
- `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts`: native module registration.
- `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts`: first-party registration, including reference versus keeper status.
- `src/components/vyzualz/cinema2/presets/Cinema2PresetAuthoring.ts`: consumed controls and generic Design-parent validation.
- `src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframePatternController.ts`: generic pattern-list controller and canonical trigger integration; assess edit-revision compatibility before reuse.
- `src/components/vyzualz/cinema2/modules/mainframe/Cinema2MainframePatternEngine.ts`: existing beat timing/provenance behavior; explicitly compose the host Sync permission rather than assuming the helper does so.
- `src/components/vyzualz/cinema2/audio/Cinema2AudioIntelligenceBridge.ts`, `parameters/Cinema2TargetRuntime.ts`, `choreography/Cinema2ChoreographyRuntime.ts`, `director/Cinema2VisualDirector.ts`: shared ownership path.
- `src/components/vyzualz/cinema2/spatial/Cinema2CameraRuntime.ts`, `render/Cinema2RenderGraph.ts`, `effects/Cinema2EffectRuntime.ts`: supporting runtimes.
- `src/test/browser/Cinema2VacancyProductionBrowserHarness.ts`: example of deterministic real-runtime production-canvas testing, including transport/audio publication and target diagnostics.

Proposed new boundaries: `presets/Cinema2InertiaPreset.ts`, `modules/Cinema2InertiaNativeModule.ts`, and focused geometry/renderer/pattern helpers under `modules/inertia/`. Split further only when implementation needs it. No general engine refactor is planned. Register as a review/reference entry in Phase Two; promote to keeper only after final acceptance.

## 8. Authority matrix

| Property | Manual control | Audio modulation | Visual Director | Auto Performance | Manual edit behavior |
| --- | --- | --- | --- | --- | --- |
| Pattern | Authored enum/base | Selected fresh Trigger advances runtime base only when allowed | Significance only | Temporary build/drop substitution | Immediate base selection; leave Pattern Change ON; cancel/fence current override |
| Pattern Change / Trigger | Full user authority | Event consumer only | None | Cannot alter | Rebase event fence; retain saved Trigger while hidden |
| BPM Sync / Speed | User timing choice; host Sync permission composes as above | Shared timing source only | Cannot change | Cannot change | Rebase phase continuously |
| Motion Amount / Deformation | User maximum motion allowance | Bounded within allowance | Bounded gain/context | Bounded gestures within same allowance | Immediate effect; zero cannot be re-enabled by music |
| Damping | User response characteristic | No replacement | None | Cannot change | Reconstruct response continuously with new settling time |
| Cage/Core Size | Exact user structure | Transient displacement uses separate documented allowances | No base replacement | Cannot alter authored size | Immediate visible scale; bounds still enforced |
| Density / Point Size / Anchor Size | Exact user style within quality budget | No count or size takeover | None | None | Immediate visible edit |
| Intensity | User base and hard ceiling | Bounded gain, never above ceiling | Bounded gain | No permission takeover | Immediate visible ceiling; zero stays zero |
| Audio Response | User modulation gain | Multiplies all musical contributions | Musical Director contributions share this gate | Zero also suppresses musical substitutions | Zero restores native selected/base behavior without automatic substitution |
| Palette/background | Five independent user colors | No hue replacement | None | None | Immediate visible color; no auto color mode |
| Camera/framing | Fixed authored camera | None | None | None | No camera control or takeover domain is advertised |
| Bloom / Trails | Hard enable and amount ceilings | Optional bounded amount only after Phase Eight | Bounded significance only | Cannot enable | OFF immediately bypasses; trails history clears on disable/reset |
| Auto Performance | Explicit permission, default OFF | Fresh event eligibility only | Context only | Only the Section 6 domain | OFF cancels active override; manually editing Pattern fences current event |

Most properties are user owned or user base plus bounded modulation. There are no extra auto-owned camera/color/layout domains requiring takeover switches. The only performing-pattern substitution follows the mandatory Pattern exception. No hidden auto re-enables are permitted.

## 9. Audio-to-visible-response and choreography contract

Proposed target names below are module property keys, not claims that Inertia targets already exist. Add them through normal manifest bindings/resolver targets when their phase is implemented. `R` means Audio Response, `M` Motion Amount, and `D` Deformation. Geometry allowances are further clamped to the Section 2 bound. Brightness accents operate inside Intensity's ceiling; use a baseline gain around 0.72 to reserve accent headroom.

| Source -> proposed target | Operation / maximum at full source strength | Attack / release | Conditions and visible purpose |
| --- | --- | --- | --- |
| Overall energy -> `energyMotion` | Add up to 0.20 × R to normalized native-motion drive, bounded by M | 120ms / 350ms | Playing, available energy; broader cage activity, not brightness alone |
| Bass/sub -> `bassPressure` | Add inward cage displacement up to 0.025 world units × R × M × D | 80ms / 240ms | Playing; ordered faces respond to pressure |
| Kick -> `kickDisplacement` | Add outward displacement up to 0.035 world units × R × M × D | 15ms / 220ms | Fresh shared kick; damped cage release |
| Kick -> `corePulse` | Multiply core radius by up to 1 + 0.035 × R × M | 15ms / 180ms | Fresh shared kick; preserve visible spherical form |
| Snare/transient -> `shearAccent` | Add local row displacement up to 0.025 world units × R × M × D | 10ms / 160ms | Fresh event; coalesce same-hit snare/transient; no duplicate double accent |
| High-band energy -> `pointSparkle` | Add local luminance gain up to 0.10 × R within intensity ceiling | 30ms / 100ms | Playing; stable engine-seeded point subset, no palette mutation |
| Vocal presence -> `vocalRestraint` | Multiply discretionary deformation by 1 - 0.25 × R × source | 180ms / 350ms | Playing and available vocals; preserve geometry/counts |
| Shared build -> `buildCompression` | Add inward displacement up to 0.035 world units × R × M × D | 200ms / 250ms | Actual shared build available; continuous tension without changing Pattern |
| Shared drop -> `dropRelease` | Add outward allowance up to 0.05 world units × R × M × D | 20ms / 450ms | Fresh shared drop; bounded release, not sustained flash |
| Selected Trigger -> runtime base Pattern | Discrete next pattern | Transition per Section 5 | Pattern Change ON; canonical event identity, no local detector |
| Director intensity/momentum -> `directorMotionGain` | Multiply existing drive by up to 1 + 0.15 × R × source, within M | 180ms / 400ms | Phase Six; broad meaning only |
| Director build/impact -> existing build/drop target gains | Up to 1.15 of existing allowed response, still clamped to original displacement limits | Reuse source envelope | No second build/drop dispatch or duplicated force |

Use one combined deformation budget, not the sum of independently unconstrained maxima. R=0 cancels music/Director modulation and temporary substitutions; it does not disable the separately authorized Pattern Change event controller. M=0 blocks geometry motion; event-driven brightness and Pattern Change may still operate according to their own controls. D=0 blocks nonrigid cage accents while allowing rigid rotation and core pulse. Missing source availability produces no dependent contribution; never infer missing vocals/builds/drops from local energy thresholds.

Phase Four establishes these responses using the shared source and resolved target path; Phase Five formalizes and tunes their bounded envelope choreography. Do not introduce a temporary direct-parameter bypass in Phase Four. Phase Six uses Director only to shape existing responses. Phase Seven alone adds pattern substitutions.

## 10. Acceptance checkpoints and phase boundaries

| Phase | Deliverable | Focused exit gate |
| --- | --- | --- |
| One — current | This specification, maps, ranges, authority, lifecycle, and test plan | Documentation consistency/path review; user agreement before rendering code |
| Two — static core | Native geometry/renderer, manifest, review entry, minimal real-runtime capture surface | Core/cage/anchors/ribs readable with animation, music, automation, bloom, and trails OFF |
| Three — camera/controls/motion | Fixed-camera proof, live design controls, six native motions and BPM timing | Min/default/max and discrete visual differences; Sync ON/OFF; actual Inspector placement/typography |
| Four — Audio Intelligence | Shared continuous/rhythm/structure mappings and canonical pattern events | Quiet/energetic, kick, snare, vocals, build/drop fixtures and real playback differ in intended regions |
| Five — Choreography | Bounded, reset-safe response envelopes | Force/recovery visible; authored values restored; all zero/ceiling rules respected |
| Six — Director | Macro significance shaping | Improvement without palette/topology/framing takeover |
| Seven — Auto Performance | Authorized temporary substitutions and restoration | Manual edit, same-value reselection, active-event fencing, underlying advancement, and cancellation |
| Eight — finishing | Optional shared bloom/trails and quality tuning | OFF/normal/max remain readable; no unwanted effects after hard disable |
| Nine — release acceptance | Tests, captures, documented differences, human review | Full contract acceptance before keeper promotion |

### Reproducible visual evidence

Capture reference frames near 0s (oblique cage/core), 1.25s (open/front cage), 2.75–3.25s (crossing sheets), and 3.75–4.25s (recovered/open cage). These are approximate frame-selection windows, not audio annotations or mandatory event times. Compare composition and movement vocabulary across a complete cycle rather than requiring identical pixels at identical timestamps.

Phase Two captures: neutral static pose; a rotated coherent pose; diagnostic folded pose; independent core/cage/anchor/rib isolation. Effects OFF in every baseline. Use hero-region occupancy, row readability, anchor placement, and core silhouette as metrics; a bright background cannot pass visibility.

Later production-path cases:

- Every primary numeric control at minimum/default/maximum, colors edited independently, each enum option, and both states of toggles. Disabled amount controls are explicitly conditional.
- All six patterns under identical time, quality, palette, and camera conditions; frame-to-frame motion and meaningful motion differences.
- Exact canonical trigger ID/label list and actual event behavior for all 11 choices. Assert fresh events switch once, held/duplicate events do not, OFF holds, and Trigger edits do not jump.
- Manual selection while Pattern Change ON, including selecting the persisted value after runtime advancement. It stays ON and holds until the next fresh selected event.
- Auto build/drop override with base advancement underneath, restoration, manual cancellation during an already-active event, expiration, and disable.
- Preset/host Sync truth table, grid versus tempo fallback versus missing timing, contrasting BPMs, pause/resume, seek/loop, analysis updates, track replacement, and re-entry.
- 1:1, 16:9, and 9:16 as initial viewport cases, plus all additional production-supported aspect ratios discovered during implementation. Resize/DPR checks must preserve proportions, safe bounds, and point readability.
- Managed-resource disposal/re-entry, context recreation, and quality tiers. Set a measured performance budget on the development machine during rendering implementation rather than inventing an unmeasured frame-rate guarantee now.
- Human comparison of reference and procedural output for composition, depth, folding quality, recovery, musicality, and authority. Metrics alone do not establish visual acceptance.

Run proportional checks once per materially changed phase, rerunning only invalidated checks. Do not run builds/browser tests for this documentation-only phase. A preset remains a review entry until the production canvas, control/audio behavior, lifecycle, and human visual acceptance meet the creation contract.

## 11. Phase One handoff

Completed: reference inventory; mandatory versus proposed characteristics; geometry and render-space decisions; six-pattern specification; parameter/output and palette maps; BPM/transport contract; system ownership; full authority matrix; bounded audio/choreography proposal; phase-specific acceptance plan.

At the Phase One handoff, Inertia manifest/module, geometry, runtime targets, Inspector controls, audio routes, automation, effects, and browser harness were not implemented or visually accepted. No source assets were copied, existing presets changed, or commits requested during Phase One. Subsequent static implementation and validation are recorded in the Phase Two report linked above.
