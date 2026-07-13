# LaserDMX musical choreography contract

LaserDMX automatic choreography is a consumer of Music Intelligence. It is not an analyzer and must not create a second track clock, BPM detector, beat grid, phrase model, or section detector.

## Canonical musical data

Runtime choreography reads the current `MusicIntelligenceFrame` published through `AudioFeatureBus` by `MusicIntelligenceEngine`.

- `frame.rhythm` is canonical for BPM confidence, beat and downbeat hits, bar indices, phrase boundaries, kick/snare events, and transient envelopes.
- `frame.section` is canonical for the current section. Music Intelligence already resolves manual section edits ahead of analyzed sections.
- `frame.energy` and `frame.semantics` are canonical for energy percentile, drop impact, and semantic drop confidence.
- `frame.capabilities` and confidence fields decide whether a layer may run.
- The audio transport playhead remains the choreography clock.

Offline cue placement continues to use the existing Music Intelligence track analysis, beat grid, downbeats, phrases, sections, energy curve, and semantic moments through Show Director. Automatic choreography never substitutes a fixed BPM when those sources are missing or low-confidence.

## Layered timescales

Automatic choreography intentionally separates musical timescales:

1. Sections influence the broad production look, overall dimmer, and haze posture.
2. Phrase boundaries may change reusable group movement programs.
3. Bars and downbeats may rotate palettes, reveal geometry, or create brief negative space.
4. Beats drive limited, selected-family pulses.
5. Canonical kick and snare events drive separate accent families.
6. Confident drop impacts may coordinate white accents, center-out movement, blinders or strobes when permitted, and fog or cryogenic fixtures when permitted.
7. Impact envelopes always release into a defined post-impact recovery.

Defaults reserve white for impacts, keep strobes and atmospheric bursts opt-in, and limit simultaneous transient reactions.

## Priority and override policy

Automatic choreography is an underlay. Show Director applies cue layers after it on every evaluation.

- Authored timeline cues therefore override automatic choreography wherever they write the same state.
- Performance-pad and other manual Show Director requests suppress new automatic events for the configured hold interval.
- `authoredFirst` is the default manual precedence: manual requests are applied first, then authored cues, so authored timeline intent wins conflicts.
- `manualFirst` applies authored cues first, then manual requests, allowing a performer action to win the conflict.
- Automatic section posture may continue underneath an override, but it cannot overwrite the later authored or manual write in the same evaluation.

This order is deterministic and does not depend on object iteration or render timing.

## Seeded variation

`locked` variation derives choices from the user seed, track identity, and musical event identity. Repeated playback therefore selects the same looks, fixture families, and movement programs.

`controlled` variation additionally incorporates the transport pass and the configured variation amount. It changes choices only between playback passes, not continuously within a pass.

## Missing analysis

When no Music Intelligence frame is available, automatic choreography returns the unchanged normalized rig state and reports `missingAnalysis`. When all relevant capabilities are unavailable or below confidence thresholds, it reports `lowConfidence` and emits no timing-derived event. It never silently falls back to an unrelated BPM.

Full-song Show Director performance-program architecture, true-bar timing, section occurrence, beam budgeting, migration, and the three built-in shows are documented in `show-director-performance-programs.md`.
