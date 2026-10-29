# Switch It — Phase 3 Shared Audio Intelligence

Status: completed historical Phase 3 checkpoint. Subsequent production work is documented in `cinema2-switch-it-production.md`.

Scope: shared audio delivery and initial bounded visual mappings only. The approved solid mask, 30% enlargement, open eye sockets, full character base, soft contact shadow, fixed camera and user palette remain authoritative. Director interpretation, automatic performance families and later finishing remain deferred.

## Audio source → resolved module target → visible response

All fact channels default to zero. Exact authoring addresses use `{kind:'module', ref:{$ref:'switch-it-audio-study'}, property:<target in table>}`; the compiler supplies the stable runtime handles. Continuous routes use the existing Choreography resolver; transient routes use its existing once-per-event envelopes. The module consumes resolved channels only after validating the bridge frame, source identity, track/time freshness, capability and signal availability. No local beat, BPM, drop or phrase detector is introduced.

| Shared source | Module target | Delivery / bounds | Visible response at Audio Response 1 |
| --- | --- | --- | --- |
| `audio.features.overallEnergy` | `rawEnergy` | replace, 0..1, 180 ms shared smoothing | Up to 0.08 of authorized fragment lift; up to +16% column gain. |
| `audio.bands.bass` | `rawBass` | replace, 0..1, 140 ms | Up to 0.22 of authorized fragment lift. |
| `audio.bands.high` | `rawHigh` | replace, 0..1, 90 ms | Up to +35% of the existing user-colored mask rim term. |
| `audio.features.vocalPresence` | `rawVocal` | replace, 0..1, 260 ms | Reduce discretionary facet density by up to 40% and audio lift/crest by up to 50%. |
| `audio.features.buildProgress` | `rawBuild` | replace, 0..1, 260 ms | Up to 0.18 upper-head crest lift and +20% column gain. |
| Shared kick | `musicKick` | additive envelope, 15 ms attack / 0 hold / 140 ms release; confidence >=0.45 | Up to +35% character eye intensity, capped at the existing 2.0 maximum. Eyes OFF/zero stays off. |
| Shared snare/transient | `musicSnare` / `musicTransient` | additive envelope, 15 ms attack / 0 hold / 180 ms release; confidence >=0.45 | Maximum of the two channels adds up to 0.28 local facet lift, within user Fragment Reach/Amount. No divider or white crack is restored. |
| Shared semantic drop | `musicDrop` | additive envelope, 20 ms attack / 40 ms hold / 550 ms release; confidence >=0.45 | Up to 0.45 upper crest lift, +20% column gain and an optional face-local accent at 0.25 of the authorized flare ceiling. |

Audio Response is a user-owned 0..1 control under Master Controls, default 0.8. Its zero state restores the exact authored pose/controls immediately, even while paused. All transient events are latched while response is off, while paused, on reset and on activation; only a new qualifying event can authorize another accent.

Geometry signals affect only the separate optional facet layer. Audio-only facets exclude the eye regions so character eyes stay readable. Combined authored/audio lift is clamped to the existing maximum; the complete character base and its eyes are never clipped. Fragment Reach 0 or Fragment Amount 0 prevents all detached audio facets. Vocal reduction never exceeds the authored density. No audio source changes the reveal position, pattern, camera, mask opacity, palette or saved manual values. BPM Sync governs cadence only; switching it off leaves these audio responses available.

Drop delivery additionally requires an actual fresh shared semantic-drop identity; a Director-only interpretation cannot activate Phase 3 drop visuals. Missing/unavailable facts remain neutral. Pause holds the current delivered visual state, with an 80 ms visual handoff on resume; that handoff is not a musical clock.

## Validation and artifacts

Completed validation:

- All 33 focused Switch It tests pass (23 existing plus 10 Phase 3 tests), including resolved fact delivery, event release, unavailable/stale/mismatched sources, pause/disabled-event latching, vocal restraint and manual hard limits. TypeScript and targeted lint pass.
- The native canvas passes nine region/eye-clearance checks plus response-zero, hard-OFF, pause/resume, manual-state re-entry and cleanup checks. Its no-audio frame matches the approved Phase 2 output exactly. No browser or render failures were recorded, and retired/disposed resource leases and GPU estimates return to zero.
- Test fixtures distinguish quiet, bass/energy, high-band, kick, snare, shared transient, build, semantic drop and supported vocal content. No synthetic fixture is presented as real audio analysis.
- Real reference playback uses audio extracted without re-encoding from `/Users/kodyrobinson/Desktop/SwitchIt.mov`, decoded by WebAudio, analyzed by the existing `analyzeTrackBuffer` (analysis version `auto-6.2`), then sampled through the existing `MusicIntelligenceEngine.updateFromAnalyser` → `AudioFeatureBus` → shared Cinema bridge/resolver → native module.
- The completed real run rendered 847 analyzed frames over approximately 14.4 seconds. Shared energy varied from 0 to about 0.376, bass from 0 to 1, and two kicks were observed. The source yielded **no reliable BPM grid or vocal-stem data**, no detected snares and no high-band variation during this run. Those dimensions are covered by explicit fixtures; the real run does not fabricate them. The analyzer's BPM/fixed-bar warnings are retained in the report and the authored free cadence is used.

Run `node scripts/cinema2-assets/accept-switch-it-phase3.mjs` to reproduce the focused native checks and actual source playback. It extracts the reference audio into ignored artifacts and records the native canvas with the source audio. `--serve` opens the development preview at the printed local URL; it starts paused, and **Analyze and play reference audio** runs the actual analyzer/playback path. The supplied source must remain at the documented Desktop path.

Artifacts in `artifacts/switch-it-phase3/`:

- `report.json`: target-region differences, source checksum, source-analysis warnings/capabilities, real playback samples and disposal evidence.
- `real-audio-preview.mp4`: native canvas recording with the actual reference audio (H.264/AAC); it is not the original reference video.
- `audio-response-comparison.png`: labeled deterministic fixture comparison.
- `no-audio.png`, `quiet.png`, `bass-energy.png`, `high-band.png`, `kick.png`, `snare.png`, `transient.png`, `build.png`, `drop.png`, `vocal-restraint.png`, hard-limit/zero/pause captures and five actual playback checkpoints.
- `inspector.png`: the real Inspector with Audio Response under Master Controls, preserving four parent groups.

At this checkpoint the preset used its private development registry. Later authorized phases added the production catalog entry, Director interpretation and Auto Performance; see `cinema2-switch-it-production.md`. Changes remain uncommitted; no commit was requested.
