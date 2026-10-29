# Switch It — reference analysis and implementation proposal

Current status: all eight phases completed under subsequent user approvals. See `cinema2-switch-it-production.md` for the final specification and acceptance evidence. The proposal below is retained as design history.
Status: **Phase 1 visually accepted, including the supplied Demon Mask and 22% enlargement. Phase 2 manual controls/motion and the corrected solid-mask overlay were approved. Phase 3 Shared Audio Intelligence is implemented and technically validated for review; Phases 4–8 have not started.**

The user subsequently selected `demon_mask.glb` as the skull replacement: the current Phase 1 uses that supplied horned mask instead of the initial procedural reconstruction. Its authored tooth row and horns remain intact; it has no separate lower jaw. This explicit asset choice supersedes the original anatomical-skull construction proposal below.

Latest user-directed visual revision: enlarge the accepted mask another 30% (total scale 1.586 versus the first mask preview), remove the luminous/jagged divider, add a subtle projected contact shadow, keep eye sockets open to the actual character eyes, and retain the intact face/neck beneath a solid textured mask (opacity 1; the user clarified that the surface must not be translucent). This supersedes the earlier complementary opaque split, orb-eye and seam-control proposals below. The surface remains solid; the earlier Mask Opacity slider was removed. No audio/Director/automatic mode may fade that surface or remove the retained base character.

Current audio checkpoint: [Phase 3 Shared Audio Intelligence](cinema2-switch-it-phase3.md).

Approved manual-motion checkpoint: [Phase 2 controls and authored motion](cinema2-switch-it-phase2.md).

Static checkpoint, provenance and validation: [Phase 1 static visual core](cinema2-switch-it-phase1.md).

## 1. Artifacts inspected

- Requested `/Desktop/SwitchIt` resolves to `/Users/kodyrobinson/Desktop/SwitchIt.mov`.
- Requested `/DRMVYZ/DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` resolves to the repository-root contract at `/Users/kodyrobinson/Development/DRMVYZ/DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`.
- Movie: 954 × 954, approximately 14.61 seconds, H.264 video and AAC audio. The video stream reports 352 frames over 14.565 seconds, averaging approximately 24.14 fps. Its nominal rate is 60 fps; this is not evidence of 60 distinct captured frames each second.
- Inspected the entire clip as a three-samples-per-second contact sheet, the first six seconds at eight samples per second, and full-resolution human/skull/split/flare frames. Sample time labels are approximate selection times for a variable-rate source.
- Evidence: `artifacts/switch-it-reference/metadata.json`, `contact-sheet.jpg`, `first-six-seconds.jpg`, `key-states.jpg`, and the four full-resolution PNGs.

This is a new native preset reconstructed from a visual reference, not a port of an existing Cinema preset or a movie-texture player. The contract's new-preset specification and authority-approval requirements apply.

## 2. What the video actually shows

### Composition and character identity

A single centered, front-facing head-and-shoulders composition fills the square frame. The upper cranium sits near the top, the eyes remain near the same horizontal line and shoulders crop into the lower corners. The subject has two recognizable anatomical presentations:

1. **Faceted human shell:** dark graphite/navy triangular planes, pale silver-blue edge-facing facets, angular ears, nose, cheekbones, neck and shoulders. The front of the face stays substantially dark. The eyes are narrow, luminous white shapes rather than realistic eyeballs.
2. **Skull presentation:** a red translucent-looking skull with a rounded cranium, large dark orbital cavities, nasal opening, cheek structure, sutures/contours and individually readable teeth. In its projected state, the upper skull appears suspended above the neck; the red vertical light column bridges the negative space. The split/composite states reveal more of the jaw and lower teeth.

These read as two states of one registered subject, not two separate characters standing beside one another. The screen-left human/screen-right skull hybrid needs aligned brow, eye, nose and cheek landmarks. A third independent character is not established by the clip; the fragmented crown is a transition state.

### Surface construction and lighting

- Human-shell triangles are solid shaded facets, not merely a wireframe grid.
- The skull combines dark/colored surface areas with fine bright anatomical contour lines; it is not an undifferentiated glowing blob.
- Narrow human eyes contrast with round, brighter exposed skull-eye/orb effects during hybrid and surge states. The fully projected skull often has dark eye sockets.
- An irregular, stepped/triangular white boundary separates human and skull regions. Its glow is concentrated on the moving seam.
- Small flecks appear beside the reveal region. Their source rendering cannot be separated perfectly from compression, so reconstruct a restrained local fragment effect rather than full-screen noise.
- A red vertical luminous column appears behind/through the skull state. The surrounding background remains almost black/navy.
- Brief peaks wash the face into white and break its crown into a sharp, rising silhouette. This is a short transition apex, not evidence that a continuous fire simulation is needed.

### Motion and approximate checkpoints

| Selection time | Visible state / change |
| --- | --- |
| 0.00–0.25 s | The recording begins mid-transition: fragmented red/white face, a bright crown-like flare, then skull projection. |
| 0.38–1.00 s | Red outlined skull holds in the vertical red column; bust/neck remains beneath it. |
| 1.13–1.63 s | A bright cap/reveal passes across the skull, then the human facets reappear. |
| 1.75–2.25 s | Human head holds; eyes transition from dim/slit-like to strong white emission. |
| 2.38–2.75 s | Bright irregular reveal enters from screen right, exposing the right-side skull while the left stays human; localized particles accompany the edge. |
| Around 2.88 s | Full projected skull returns. |
| 3.00–3.88 s | Another skull hold and bright reconstruction back to the human shell. |
| 4.00–5.25 s | Human hold, another right-side reveal, and a longer half-skull presentation. |
| 5.38–5.88 s | Fragmented composite, a near-white head flare, and a broken crown/red-skull transition. |
| Remainder of clip | The same vocabulary recurs with different hold/transition durations. |

There is no clearly demonstrated room traversal, camera orbit, continuous head spin or zoom-driven composition. Small pose changes may be part of the deformation/reveal. The scene reads primarily as a fixed frontal portrait with character/material changes.

### What cannot be recovered from the recording

The video supplies no source meshes, rigs, shader code, material maps or animation curves. It cannot establish whether the source was rendered geometry, compositing, generative imagery or a mixture. AAC audio is present, but this inspection does not claim a measured soundtrack BPM or a recovered beat-to-animation mapping. Shared music response below is a proposed authored behavior, not an assertion about the source's hidden implementation. Repeated motifs do not prove a seamless clip loop.

The white rounded back-arrow button in the top-left is recording/player UI and is excluded from the preset.

## 3. Proposed visual specification

**Name:** Switch It.

**Hero:** one faceted human bust that changes into an anatomically readable red skull through a luminous irregular reveal, with the reference's characteristic half-face state.

**Mandatory reference characteristics:** centered portrait; dark solid facets; registered skull anatomy; dark negative space; white eyes; red contour/projection state; irregular luminous seam; localized fragments; short transformation flares; fixed primary framing.

**Inspirational extensions requiring approval:** the additional native pattern families below, broader palette editing, rhythm/structure-aware transitions, bounded fragment choreography and optional finishing controls. They must preserve the two-state portrait identity.

### Geometry and camera

- Proposed world-space character geometry with frame-conscious presentation; screen-aligned glow/column support where appropriate. Avoid flattening the entire result into a prerecorded movie or a single uneditable image.
- Proposed coordinates: +Y up, +X viewer-right, +Z toward the camera. Shared facial center/brow landmarks anchor human shell, skull and eyes. These are implementation conventions, not recovered source coordinates.
- Separate controllable layers: human shell/bust, skull/teeth/contours, human eyes and skull orbs, reveal boundary, local fragments, background column.
- A common reveal field must drive complementary visibility of the human shell and skull so there are no accidental gaps, double faces or depth-fighting. Keep intentional projected-skull neck separation distinct from broken masking.
- Default camera remains frontal and fixed. No orbit, camera roll, beat zoom or fly-through is proposed. Phase 2 verifies that framing; it does not add movement to a fixed-camera concept.
- Initial square-frame targets: crown roughly 5–7% below the top; eye line around 42% of height; human chin around 83–87%; shoulders allowed to crop at the bottom corners. These are approximate observations, to be calibrated against the reference.
- Fit the head and eye line on 16:9, 16:10, 4:3, 1:1 and 9:16 outputs. Wide output adds dark side space; narrow output preserves the face and may crop shoulders. Never stretch anatomy to fill the frame.
- Lighting must expose real planar surfaces and skull detail without bloom. Bloom OFF cannot turn the face into an unreadable silhouette.

### Asset strategy and the main dependency

The repository already has a MakeHuman-derived faceted figure implementation in `modules/humn/Cinema2HumNMesh.ts`, described there as using a CC0 MakeHuman base. Evaluate its head/neck/bust geometry and provenance as a starting point rather than rebuilding a humanoid blindly. It is not automatically approved as a close-up likeness match.

A filename/catalog search did not locate a named skull asset suitable for this reference. Phase 1 must author or obtain a suitable reusable skull, verify its provenance, align it to the human head and retain editable anatomical regions. If source character meshes become available, evaluate them first. A generic sphere, smooth mannequin or skull silhouette painted over an unrelated face will fail visual approval.

Recommended rendering direction: a new native character module using the existing shared Three renderer/asset facilities for layered meshes and custom materials, with selected HUM:N mesh/facet concepts reused where useful. Do not instantiate a new WebGL renderer on every preset entry. Final material/depth technique is validated during Phase 1; the source clip does not justify claiming a particular original technique.

## 4. Proposed native Pattern library

Pattern chooses a complete behavior family. Pattern Change OFF holds that family; it does **not** freeze the family's internal animation during playback.

| Pattern | Distinct native behavior |
| --- | --- |
| **Switch Cycle** — proposed default | Closest reference sequence: human hold → irregular lateral reveal → hybrid → projected skull hold → bright reconstruction. |
| **Split Portrait** | Holds a registered half-human/half-skull composition. User controls Reveal Position; musical response affects eyes/facets without moving that authored split. |
| **Twin Reveal** | Two complementary reveal fronts enter from opposite sides and converge/recede around the facial center. Different topology from the single-front reference cycle. |
| **Facet Peel** | Human-shell triangles lift away locally, expose skull regions, then reassemble with stable per-face identities. |
| **Skull Projection** | Suspended outlined skull and red column dominate, with subdued bust/neck geometry; dark sockets and readable teeth remain distinct from the hybrid's luminous orbs. |
| **Crown Surge** | A face-centered crest of facets rises/breaks, briefly exposes the skull and reconstructs. The face remains the anchor; this is not a generic particle explosion. |

All six require separate native rendering/motion results and reference captures. The additional five are authored extensions, not six different patterns proven to exist in the movie. Pattern names and details remain reviewable.

Pattern Change defaults OFF. Trigger is shown only when Pattern Change is ON and reuses the exact canonical shared options: `beat`, `kick`, `snare`, `downbeat`, `beat2`, `beat4`, `bar`, `bar4`, `bar8`, `phrase`, `drop`, with their existing labels and meanings.

## 5. Proposed Design inspector and palette

The only top-level parent groups are **Master Controls**, **Design**, **Effects**, **Palette**. All values must have real resolved consumers; the table is a proposed surface, to be calibrated in Phase 1 before implementation proceeds.

| Parent | Proposed controls / purpose |
| --- | --- |
| Master Controls | Master Intensity, Motion Speed, Audio Response, **BPM Sync**, Auto Performance. Sync proposed ON; Auto Performance proposed OFF. |
| Design | **Pattern / Pattern Change / Trigger** together; Portrait Scale; Reveal Position (Split Portrait); Seam Width; Facet Relief; Fragment Reach; Eye Intensity; Eyes Enabled; Column Intensity. Pattern Change proposed OFF. |
| Effects | Bloom; Seam Glow; Fragment Amount; Flare Enabled; Flare Strength. No permanent full-frame flash or heavy feedback by default. |
| Palette | Background; Human Shell; Facet Rim; Skull Contour; Energy (eyes/seam); Projection Column. Six independent `color` parameters with separate visible consumers. |

Reference-like defaults: near-black/navy background, graphite shell, cool silver facet rim, red skull, cool white energy, red column. Background and column remain separate colors. No automatic palette replacement is proposed.

Every control needs an explicit min/default/max visible result. Master Intensity 0, Fragment Amount/Reach 0, Eyes Enabled OFF, Flare Enabled OFF and effects OFF must remain hard authorization limits. Do not expose controls whose intended consumer is not implemented.

## 6. Proposed audio/timing behavior

### BPM Sync

- Govern reveal-cycle phase, peel/reassembly cadence and crown-surge timing using the shared transport/Audio Intelligence and the existing `Cinema2BeatClock` where appropriate. No new BPM, beat, phrase or drop detector.
- Explicit composition with the host: effective lock is preset BPM Sync AND host `transport.bpmSync` when that host authorization is supplied. Isolated hosts without that flag use the preset toggle. A missing valid tempo yields the authored timing path, not a false claim of beat lock.
- Proposed synchronized baseline: a normal switch cycle over four shared beats, with adjustable Motion Speed. Free-running baseline: approximately 2.25 seconds for an ordinary switch cycle, with longer hybrid holds/short surge phrases authored into their relevant programs. These are proposed timings; the video does not establish soundtrack BPM.
- Sync OFF removes beat-phase locking from these motion domains while leaving continuous/rhythmic audio response enabled.
- Start with a static intact head before playback; no active-audio state is implied by an idle animation. Freeze the current native pose when paused, return to a deliberate baseline on track/preset reset and reconstruct state safely on seeks/loops. Mode changes preserve phase continuity.

### Distinct musical dimensions

| Shared source | Proposed visual response | Bounds / behavior |
| --- | --- | --- |
| Continuous bass/energy | Facet relief and peel tension | Bounded by user geometry/fragment limits; never merely overall brightness. |
| Kick | Short eye/seam accent | Fast attack, roughly 100–180 ms return; eyes OFF remains off. |
| Snare/transient | Local seam flecks / edge crackle | Short bounded burst, returns to the authored fragment amount. |
| High-band energy | Fine contour shimmer / small fleck activity | Does not recolor the palette or obscure anatomy. |
| Build context | Brief narrowing/tension before a switch | Preserves the portrait and user hard limits. |
| Drop / significant impact | Authorized crown/reassembly gesture | Bounded face-local burst; brief optional flare rather than sustained whiteout. |
| Vocal presence | Reduce discretionary fragment density | Preserve readable face/skull detail and user colors. |
| Phrase / selected trigger | Pattern advancement if enabled | Fresh canonical events only; never a parallel local musical clock. |

Exact target IDs, attack/decay curves, operations and maximum strengths are deliverables before those rules are implemented. Prefer additive/multiplicative contributions through the target resolver, returning cleanly to authored values. Missing shared features disable the dependent response instead of inventing musical facts.

## 7. Proposed authority matrix — review required before code

| Property | Manual control | Audio modulation | Visual Director | Auto Performance | Manual edit behavior |
| --- | --- | --- | --- | --- | --- |
| Base Pattern | Pattern enum | Only selected Trigger may advance it when enabled | Significance only | May temporarily substitute a documented build/drop performance family | New choice takes effect immediately; Pattern Change stays ON if enabled; already-active events cannot cancel the edit. |
| Pattern Change / Trigger | Toggle and canonical enum | Fresh events advance the underlying base | No direct ownership | Must preserve toggle and selected Trigger | Toggle/Trigger edits rebase event tracking; no stale or duplicate switch. |
| Split Portrait reveal | Reveal Position | No displacement of the authored split | No replacement | An authorized temporary family may differ, without changing the stored split | Editing reveal takes manual pose authority and disables Auto Performance until explicitly re-enabled. |
| Portrait scale / placement | User geometry controls | No framing takeover | None | None | Immediate visible user value; no automatic crop or zoom. |
| Facet relief / fragment reach | User base and hard maximum | Bounded geometry accents | Bounded intensity/context | Bounded gesture shaping | User zero/ceiling respected; no silent base mutation. |
| Eye / column intensity | User base and authorization | Bounded accents | Bounded gain only | No enable takeover | Disabled eyes/zero column stay disabled. |
| Master intensity / flare ceiling | User limits | Operates inside those limits | No replacement | No limit bypass | Zero/OFF is hard; all envelopes settle back. |
| Motion speed / BPM Sync | User speed and sync authorization | Shared phase/tempo only when authorized | No competing clock | Cannot change sync or saved speed | Smooth handoff; pause/reset/discontinuity behavior deterministic. |
| Six palette roles | Independent user colors | No replacement | None | None | Immediate persistent authored color. |
| Camera | Fixed authored framing | None | None | None | No automatic camera domain; no camera motion control is invented. |
| Effects | User amounts and OFF permissions | Only explicitly allowed bounded accents | Broad significance only | Cannot enable disabled effects | OFF remains off; base geometry stays readable. |

If Auto Performance supports temporary build/drop pattern substitution, the underlying Pattern Change controller keeps progressing on valid new triggers. When the override ends, resume the current underlying base. Never overwrite persisted Pattern/Trigger or disable Pattern Change to achieve an override. A manual Pattern edit suppresses reuse of the already-active override event; a fresh qualifying event is required for another override. The Reveal Position takeover rule is the ordinary manual-domain rule, separate from the contract's explicit Pattern exception.

## 8. Existing implementation seams inspected

| Responsibility | Existing source / planned use |
| --- | --- |
| Musical facts and discontinuities | `audio/Cinema2AudioIntelligenceBridge.ts`; consume availability/provenance and canonical event IDs. |
| Macro significance | `director/Cinema2VisualDirector.ts`; intensity, momentum, build context and impact/variation authority. |
| Temporary behavior | `choreography/Cinema2ChoreographyRuntime.ts`; resolved target contributions/actions. |
| Authored/resolved authority | `parameters/Cinema2TargetRuntime.ts`, including `Cinema2FinalValueResolver`. |
| Native renderer lifecycle | `modules/Cinema2ModuleContracts.ts`; update/render, managed resources, context generation and diagnostics. |
| Shared Three lifecycle | `modules/three/Cinema2ThreeRendererHost.ts`, `getCinema2ThreeRenderer`; reuse the renderer for the context lifetime. |
| Frontal humanoid / facet precedent | `modules/humn/Cinema2HumNMesh.ts`, `Cinema2HumNNativeModule.ts`; evaluate geometry and stable per-triangle attributes. |
| Shared motion clock | `modules/Cinema2BeatClock.ts`; no preset-local music detector. |
| Pattern authority precedent | `modules/sayIt/Cinema2SayItPatternController.ts`; manual edits, trigger changes, event deduplication. Audit compatibility before reuse/adaptation. |
| Trigger options | `presets/Cinema2AfterhoursPreset.ts`, `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`; import the canonical list. |
| Camera and render graph | `spatial/Cinema2CameraRuntime.ts`, `runtime/Cinema2RenderGraphExecutor.ts`; explicit fixed framing and engine-owned passes. |
| Registration / catalog | `modules/Cinema2ModuleRegistry.ts`, `presets/Cinema2FirstPartyPresetCatalog.ts`. |
| Production acceptance precedent | `scripts/cinema2-assets/accept-elevhate.mjs` and existing Cinema 2.0 browser fixtures; adapt for portrait-region assertions rather than generic nonblack pixels. |

Proposed production implementation files (Phase 1 uses separate private development registries): `Cinema2SwitchItPreset.ts`, `Cinema2SwitchItNativeModule.ts`, `switchIt/Cinema2SwitchItRenderer.ts`, `switchIt/Cinema2SwitchItPatternController.ts`, and `Cinema2SwitchItChoreography.ts`, plus asset provenance/build inputs and focused tests. Reuse generic Inspector parameter grouping/visibility; add no preset-name conditions to shared Inspector code.

## 9. Implementation phases and review gates

### Initial specification review gate — approved for Phase 1

Review the character reconstruction, mandatory reference characteristics, six proposed patterns, palette roles, fixed camera, timing proposal and authority matrix. Contract Section 8 requires agreement on the matrix before code. Approval of a phase is scoped to that phase; it does not automatically approve later work or production release.

### Phase 1 — Design, architecture and static visual core

Work:
- Finalize approved behavior/geometry/ownership specification and parameter-to-visible-output map.
- Evaluate/reuse the existing humanoid source; author/source the skull and document provenance, source transforms, landmarks, region masks and quality tiers.
- Build a development-only native preview through the production rendering path, with manual diagnostic snapshots for human, projected skull, hybrid and crown/composite states.
- Establish flat-shaded facets, anatomical contours/teeth, complementary reveal masks, eyes and the red column. Bloom and musical automation remain off for baseline proof.

Deliverables: asset manifest/provenance; registered native development module/manifest; reference-matched static captures; resource/lifecycle basics; documented material/depth approach.

Gate: recognizable human/skull anatomy, correct scale/framing and a clean registered hybrid at the actual canvas resolution. Review the static visual before continuing. Wrong anatomy or mismatched eye/skull landmarks stop the work here; effects cannot repair them.

### Phase 2 — Fixed camera, manual controls and authored motion

Work:
- Verify frontal framing and aspect fitting first; no camera movement is added.
- Wire all approved manual controls through resolved values under the four parent groups, including six independent colors and the complete Pattern/Pattern Change/Trigger UI.
- Build the six native programs with deliberate holds, reveal traversal, shard motion and reconstruction. Stable face/fragment identities prevent random popping between frames.
- Prove BPM Sync ON/OFF with the existing shared transport/clock fixtures; music-reaction rules come later.

Deliverables: control-to-output table; min/default/max and six-pattern captures; multi-frame motion evidence; aspect/resizing checks.

Gate: each control affects its intended visible property; patterns are visibly distinct; no duplicate aliases or placebo controls; manual split truly holds position; phase handoffs do not jump.

### Phase 3 — Shared Audio Intelligence

Work:
- Consume bridge-provided continuous, rhythmic and structural facts with availability checks.
- Add initial bounded mapping to distinct geometry, eye/seam and fragment dimensions through existing resolved target paths; use the shared transport rather than a local detector. Phase 4 formalizes the full transient envelope program.
- Test no audio, quiet, steady beat, bass-heavy, snare/transient, build, drop and vocal inputs; include real analyzed playback and deterministic fixtures where reproducibility is needed.

Deliverables: audio-source-to-target map with bounds; region-specific audio-response captures and timing evidence.

Gate: energetic/quiet passages differ, rhythm produces the expected local response, structural context changes a structural property, and Sync OFF does not disable unrelated reactivity.

### Phase 4 — Choreography and event-driven pattern changes — complete

Work:
- Implement explicit target-resolved rules with source, target, operation, strength, attack, decay, conditions and ownership.
- Connect Pattern Change to all 11 shared Trigger meanings; deduplicate events and define pattern phase/rebase behavior.
- Prove manual Pattern edits while Pattern Change remains ON, including fresh-event-only progression after the edit.

Deliverables: choreography manifest/rules; event/authority tests; loop/seek/pause/preset-reentry captures.

Gate: no stale event switches, double-switches, fighting controls, zero-limit bypasses or envelopes that fail to settle.

### Phase 5 — Visual Director interpretation — complete

Work:
- Use shared significance to shape macro tension, variation strength, impact and vocal restraint.
- Keep Director unaware of skull/head implementation and keep authored palette/camera/geometry permissions intact.

Deliverables: before/after macro-performance checkpoints for low, building, peak and release passages.

Gate: richer performance preserves the portrait and user settings; Director does not directly replace manual parameters.

### Phase 6 — Explicit Auto Performance — complete

Work:
- Add only the approved automatic domains from the matrix: bounded temporary build/drop performance substitution and gesture emphasis.
- Continue underlying Pattern Change progression during overrides; restore the correct current base afterward.
- Implement manual takeover for Reveal Position and suppress an already-active override after a manual Pattern edit without turning Pattern Change OFF.

Deliverables: manual/automatic interaction tests and visible takeover/restoration captures.

Gate: manual edits are immediately visible; disabled features stay disabled; automatic modes neither mutate authored settings nor capture permanent ownership.

### Phase 7 — Finishing and performance — complete

Work:
- Add restrained bloom and localized particles, then calibrate the brief face-local white flare against the reference. The later user instruction removes the dividing seam/halo entirely.
- Validate every effect OFF/default/maximum. Preserve eye sockets, teeth and dark facets outside deliberate short flare peaks.
- Profile GPU time, asset size and allocations on the actual target system; define quality tiers that reduce secondary particles/contour cost before sacrificing anatomy.
- Test repeated entry/exit and context loss/restoration; dispose module resources and reuse engine/shared renderer resources correctly.

Deliverables: final-look captures, measured quality/performance report, effects matrix and lifecycle checks.

Gate: finishing improves an already correct base; no persistent whiteout, background-only visibility pass, resource leak or geometry disappearance.

### Phase 8 — Full acceptance and release — complete

Work:
- Run authoring validation, focused unit tests and real production-canvas control/motion/audio/authority/lifecycle tests.
- Verify all six patterns, all required Trigger semantics, all color roles, Sync behavior, hard OFFs and min/default/max effects.
- Compare source and preset at human, skull, hybrid, reconstruction and peak checkpoints. Review motion quality and musical performance with the user.
- Validate supported aspect ratios and resizing; account for no-track, pause/resume, seek, loop, track/analysis change, context restore and preset switching.
- Register as a finished first-party preset only after visual acceptance and contract stop-ship checks pass. Until then, keep it explicitly in the development/review path.

Deliverables: production preset/catalog entry, final behavior/authority documentation, asset provenance, test evidence, screenshots/short captures, performance limitations and explicit intentional deviations.

Gate: human visual acceptance plus technical acceptance. Rendering pixels, successful compilation or detecting nonblack output alone is insufficient.

## 10. Primary risks to resolve early

1. **Skull/head asset quality and alignment:** the largest dependency; must be settled before audio or effects work.
2. **Reveal technique:** complementary clipping/displacement/contours must handle nose, teeth, ears and jaw without z-fighting or hollow gaps. Prototype before promising the final effect.
3. **Native reconstruction versus baked imagery:** the reference's exact likeness and source rendering process are unknown; approve recognizable reconstructed forms rather than promise pixel identity.
4. **Glow clipping:** bright face transitions must be brief and controlled; skull detail must survive ordinary authored exposure.
5. **Timing truth and state:** repeat motifs do not prove a BPM or an exact loop; shared transport/event identity and deterministic reset rules remain authoritative.
6. **Portrait framing across outputs:** preserve face scale/landmarks rather than stretch the square source into arbitrary aspect ratios.

Phases 1–3 were implemented and reviewed. The user then authorized all remaining phases and production completion. Phases 4–8 are now implemented and technically accepted; see `cinema2-switch-it-production.md` for the final behavior, validation evidence and intentional deviations. The supplied solid mask and registered character appearance remain the accepted visual baseline.

## Review handoff

This document retains the original proposal and phase gates as design history. The final production specification is `cinema2-switch-it-production.md`. All eight phases are complete under the user’s subsequent approvals. Changes remain uncommitted; no commit was requested.
