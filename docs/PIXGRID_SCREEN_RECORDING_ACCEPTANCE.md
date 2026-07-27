# PixGrid screen-recording acceptance

PixGrid is not release-accepted from route metadata, unit tests, or static screenshots alone. Completion requires both the automated full-pipeline thresholds and a human-reviewed recording that visibly demonstrates ordinary playback behavior.

## Gate order

1. Run `npm run verify:pix-grid:final` from a clean checkout and record the tested commit and completion time.
2. Copy `docs/pixgrid-screen-recording-manifest.example.json` into an evidence folder as `manifest.json`.
3. Record all three built-in presets with the same ordinary music passage. The passage must contain silence or a quiet lead-in, clear kick and snare hits, sustained bass, beat and bar movement, a build, pre-drop, first drop, breakdown, second drop, and outro.
4. Capture Canvas and GPU behavior. The pixels may differ because of presentation and post-processing, but scene choice, group masks, actions, envelopes, timing, Motion, Bass Reactivity, section choreography, and drop development must match.
5. Complete every manifest check only after watching the full recording at normal speed. A checkbox is evidence of human review, not an automated visual assertion.
6. Run `npm run verify:pix-grid:recording -- path/to/manifest.json`. Release acceptance requires this command and `verify:pix-grid:final` to pass.

## Recording setup

Record at 1920 × 1080 or higher and 60 FPS when available. Keep the complete PixGrid output and the relevant right-rail controls visible. Start each take before playback, select the preset once, and do not reselect it after playback begins. Use Bass Reactivity 1 and Motion 1 for the main take, then include short control demonstrations at 0 and 0.5 without changing hidden state. Do not use editor preview triggers, temporary manual locks, hidden developer controls, or post-production speed changes.

The analyser status, Shared Performance Core status, live source values, route activity, target-cell counts, Perceptual Response Meter, truthful status, current scene, motif, route bank, and renderer path should be readable during review. High-frequency metric changes are visual only and must not be announced continuously by assistive technology.

## Required visible evidence

Reviewers must see all of the following, not infer them from the inspector:

- Kicks produce clear localized changes.
- Snares produce clear changes in a different spatial or material role from kicks.
- Sustained bass remains visible between transients and settles after bass stops.
- Smart-group pixels move, recruit, brighten, reveal, or transform as authored.
- Beat and bar boundaries change the composition or rhythmic motion.
- Builds develop rather than merely recolor the whole matrix.
- Pre-drops become restrained or create negative space.
- Drops contrast materially with pre-drops and breakdowns.
- The second drop differs meaningfully from the first.
- Silence is calmer than active playback and does not freeze at a peak.
- Analyser loss settles safely and recovery resumes without preset reselection.
- Preset switching clears the previous preset before the next qualifying event.
- Canvas and GPU preserve equivalent musical choreography.
- Analyser loss releases transients and settles bass/energy instead of freezing a peak; recovery resumes without reselection.
- Switching presets clears previous envelopes, group actions, and scene ownership before the next preset reacts.

## Representative preset behavior

### Bass Beacon

Bass sustain should energize the central BASS body and pressure rings. Kicks should punch or expand the center-weighted material. Snares should strike side or edge accents rather than duplicating the kick. Hats and air detail may sparkle, while build density increases, the pre-drop contracts, the first drop lands with strong center and ring contrast, and the second drop develops additional recruitment or motif behavior.

### Geometric Reactor

The reactor should distribute kick, snare, bass, beat, and phrase behavior across distinct geometric regions. Builds should progressively recruit structured geometry. The pre-drop should reduce motion or density before impact. Drop choreography should use masks, rotations, frame or palette intent, and scene development without becoming a broad palette-only wash. The second drop must not be a copy of the first.

### Pixel Parade

Percussion should advance, reveal, alternate, or accent grouped rows, columns, clusters, or parade elements. Sustained bass should influence a different grouped field from snare accents. Phrase and bar boundaries should reorganize recruitment. Build, pre-drop, drop, breakdown, second-drop, and outro states should remain recognizable through shape, density, movement, and grouped-pixel behavior rather than color alone.

## Rejection conditions

Reject the evidence if the inspector says routes are active while pixels remain visually static, if only global palette changes are visible, if kick and snare appear functionally identical, if silence and playback look nearly identical, if a preset must be reselected after analyser recovery, if one renderer loses choreography, or if the recording omits a required song section. Do not mark the program complete until the failed implementation or evidence is corrected and both gates pass.
