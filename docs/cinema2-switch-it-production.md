# Switch It — completed production implementation

All eight phases are implemented. The user approved the supplied mask/character appearance and subsequently authorized completion of all remaining phases. `drmvyz.cinema2.switch-it` is registered as a first-party keeper using the shared native catalog, Inspector, camera, transport, target resolver, Choreography and Visual Director. No shared UI contains Switch It branches. No commit was requested.

## Visual and manual authority

The full MakeHuman faceted bust remains behind the solid supplied Demon Mask. Its original textured surface, open eye sockets and character eyes are preserved. Registration includes both approved enlargements (1.22 × 1.30 = 1.586), an effective mask width of 3.6478, and the soft projected contact shadow. The horns intentionally extend outside the square composition. There is no white dividing line, seam halo, replacement eye disk or translucent skull surface. The visible neck, shoulders and face regions around/through the actual mask openings satisfy the clarified request.

The six programs are Switch Cycle, Split Portrait, Twin Reveal, Facet Peel, Skull Projection and Crown Surge. The fixed frontal camera remains user-independent. Portrait Scale controls geometry around the eye line; narrow outputs fit portrait width. Audio/Director/Auto never change camera, palette, mask material opacity or stored manual values.

Design has exactly the four canonical parents: Master Controls, Design, Effects and Palette. The standard Quality / Performance control remains in Advanced. Six independent palette roles are Background, Human Shell, Facet Rim, Skull Mask, Energy and Projection Column. All have resolved consumers.

| Domain | Final behavior |
| --- | --- |
| Pattern / Pattern Change / Trigger | Pattern Change defaults OFF; all 11 canonical shared triggers are available: beat, kick, snare, downbeat, beat2, beat4, bar, bar4, bar8, phrase, drop. Fresh identities advance the underlying base only once. Manual Pattern edits/reselection preserve Pattern Change and consume the active event. |
| Reveal Position | Holds the authored split in Split Portrait. Editing it turns Auto Performance OFF through ordinary shared parameter metadata. Audio never shifts the saved split. |
| Timing | Uses Cinema2BeatClock: four beats/cycle when preset and host BPM Sync both authorize a valid shared tempo; otherwise 2.25-second authored cadence. Speed zero freezes cadence. Sync OFF leaves unrelated audio response available. |
| Geometry | Audio/Director affect the separate stable facet layer, bounded by Fragment Reach and Fragment Amount. Full base anatomy remains intact. Their zero values prohibit detached facets and flecks. Audio-only fragments exclude character eye regions. |
| Lighting / effects | Eyes Enabled OFF, zero Eye/Column intensity, Master zero and Flare OFF remain hard limits. Bloom defaults zero (exact engine bypass); Local Flecks defaults zero; flare defaults OFF. There is no persistent full-frame flash. |
| Source lifecycle | Event identities latch on initial/reset, disabled and held frames. Pause holds presentation; seek, loop, track/source/analysis revision and context changes reconstruct state. Missing/stale/mismatched facts cannot authorize new performance. |

## Phases 4–6: resolved choreography and scoped interpretation

All source channels come from the shared Audio Intelligence bridge. The preset defines no beat, BPM, drop or vocal detector. Choreography delivers resolved module targets; the module never mutates persistent controls to perform a gesture.

| Source → target | Operation and timing | Rendered consumer |
| --- | --- | --- |
| Overall energy → rawEnergy | Replace, smoothing 180 ms, clamp 0–1 | Local facet tension |
| Bass → rawBass | Replace, 140 ms | Facet lift |
| High band → rawHigh | Replace, 90 ms | Mask edge glint |
| Vocal presence → rawVocal | Replace, 260 ms | Discretionary fragment/gesture restraint |
| Shared build → rawBuild | Replace, 260 ms | Crown/upper-face tension |
| Kick → musicKick | Additive envelope, 15 ms attack / 140 ms release | Authorized character-eye accent |
| Snare / transient → musicSnare / musicTransient | Additive envelope, 15 ms attack / 180 ms release | Local facets and optional flecks |
| Semantic drop → musicDrop | Additive envelope, 20 ms attack / 40 ms hold / 550 ms release | Bounded crest/reconstruction and authorized flare |
| Director intensity / momentum / build | Replace, 200 / 240 / 240 ms | Bounded tension, glint and crest emphasis |
| Director impact → directorAccent | Threshold .45, confidence ≥ .45; 25 ms attack / 20 ms hold / 450 ms release | Bounded local impact emphasis |

Rhythmic/semantic envelopes require confidence ≥ .45 and once-per-event delivery. Event channels settle to zero; continuous routes settle to their current shared input. Director frames must match the accepted audio visual-frame ID and discontinuity generation. Director Influence defaults .35 and multiplies Audio Response (default .8). Zero response removes musical/Director emphasis. Maximum macro additions remain inside normalized lift/crest limits and user geometry ceilings; vocal restraint reduces discretionary emphasis.

Auto Performance defaults OFF. With explicit authorization, a newly rising build above .65 temporarily uses Facet Peel; it releases below .45. A fresh semantic drop or qualified Director impact in a shared drop section uses Crown Surge for one current shared-clock cycle. Drop takes priority. These use the existing motion cycle counter, not another musical clock. Temporary transitions blend over 240 ms.

The underlying Pattern Change controller continues processing its selected trigger during a substitution. Ending the substitution restores its current base, not a stale saved program. A manual Pattern edit cancels the substitution and blocks reuse of the active build/drop identity while leaving Pattern Change ON. A new qualifying event may perform again. Toggling Auto OFF/ON does not rearm an already-active build. Editing Reveal disables Auto until explicitly re-enabled.

## Phase 7: finishing, assets and quality

Bloom uses the shared engine-owned HdrBloom effect, threshold .75, knee .15, three levels, spread .2, clamp 3, user intensity 0–.6. Default zero preserves the approved baseline and avoids allocating its pyramid until requested. Local Flecks is 0–1, uses stable authored face centers and Energy color, excludes the eye regions, and requires nonzero fragment reach/amount, master and a gesture. Its phase comes from the same shared motion counter.

Quality reduces secondary content first. Low/medium/high use 40/96/160 flecks and 40%/70%/100% of the optional facet overlay. The complete 2,100-triangle human base, character eyes and 5,686-triangle supplied mask remain at full anatomy in every tier. Shared engine target scales are .67/.82/1.

The mask is bundled locally at `public/cinema2/models/switch-it-demon-mask.glb` (approximately 3.6 MB). Source topology, normals, UVs and material maps remain; embedded 4096px maps are resized to 1024px. Asset ID `switch-it` is in the generated asset registry and app attributions. `assets/cinema2/switch-it/asset.json`, provenance and preparation scripts document the source and modifications. Demon Mask: egorova.e, CC BY 4.0; character: MakeHuman hm08 CC0. Runtime requires no external asset service.

The module owns and disposes its geometry, materials, cloned textures and projected-shadow texture. It aborts unfinished fetches, releases a late-loaded source after disposal, reuses the shared Three renderer and rebuilds resources after context restoration. Camera matrices and GL state pass through established engine helpers.

## Phase 8: validation and evidence

- 43 focused tests pass: static geometry/registration (3), motion/triggers/control authority (20), Audio Intelligence delivery (10), and production/Director/Auto authority (10). Coverage includes all 11 trigger meanings, zero/OFF limits, event release/deduplication, manual takeover, underlying progression/restoration, held-event consumption, no-analysis manual transitions, and source/context resets.
- Production TypeScript/Vite build passed. Focused lint and `npm run assets:check` passed. Vite reports its existing large-chunk advisory; it does not fail the build.
- The production browser acceptance uses the global catalog and native runtime with the actual shared Inspector. Default no-audio output exactly matches the approved Phase 2 portrait. The canvas preserves all 1,112 measured bright eye-core pixels during audio facets (zero occluded). Region-specific checks prove separate bass, high-band, kick, snare, transient, build, semantic-drop, vocal-restraint and Director effects. Bloom/flecks have rendered OFF/maximum/restored-OFF comparisons; zero master removes all subject light.
- The registered production canvas additionally proves six distinct programs across three motion checkpoints each, and visible advancement for every one of the 11 Trigger options without changing saved Pattern/Pattern Change values. Production captures cover square 640×640, landscape 960×540 and portrait 360×640; three actual engine quality policies; manual state re-entry; cross-preset switching through Cathedral; and real WebGL loss/restoration. Retired/disposed engine leases and estimated managed GPU bytes return to zero. No browser/render errors occurred.
- Headless Chrome on the target Mac reported GPU samples of .27/.54/.66 ms and rolling CPU frame averages of .64/.60/.58 ms at low/medium/high in the focused quality pass. These are samples, not a sustained-frame-rate guarantee. Module GPU estimate is 19.50 MB plus managed scene/output surfaces of 2.21/3.31/4.92 MB in that pass; optional active bloom adds its pyramid. No tier degraded. See `quality-report.json` for actual snapshots. The separate initial acceptance pass pinned high quality; the focused pass removes that harness override and asserts low/medium/high resolution explicitly.
- Actual reference playback follows decoded source → shared offline analyzer → WebAudio analyser → MusicIntelligenceEngine → AudioFeatureBus → native engine. The completed recording rendered 866 analyzed frames over ~14.4 seconds, energy 0–.358, bass 0–1 and three kicks. The source supplies no reliable tempo grid, vocal stems, detected snares or varying high-band facts; fixtures cover those domains. Analyzer warnings remain in the report and no musical facts are fabricated.

Evidence under ignored `artifacts/switch-it-production/`: `report.json`, `quality-report.json`, `program-report.json`, `real-audio-preview.mp4`, `inspector.png`, default/response/effect comparisons, automatic build/drop/manual-takeover frames, aspect and quality captures, and context recovery captures. The earlier Phase 2 evidence retains all six authored programs and complete manual control/palette comparisons. Historical phase review scripts remain usable in their private registries.

Reproduce the production canvas pass with `node scripts/cinema2-assets/accept-switch-it-production.mjs`; use `--quality-only` for the bounded quality/switching/automatic-render pass, `--programs-only` for the six-program/11-trigger pass, or `--serve` for interactive review. The local review harness expects the original Desktop/SwitchIt.mov to analyze its audio; production playback has no dependency on that file. Focused unit files are `Cinema2SwitchItPhase1.test.ts`, `Cinema2SwitchItPhase2.test.ts`, `Cinema2SwitchItPhase3.test.ts` and `Cinema2SwitchItProduction.test.ts`.

The supplied mask is an intentional approved alternative to the reference skull. The later user instructions override the original plan’s seam halo and complementary base clipping: the solid textured mask overlays a complete character. Additional patterns are authored extensions of the source motif. No external release, packaging, commit or push was requested.
