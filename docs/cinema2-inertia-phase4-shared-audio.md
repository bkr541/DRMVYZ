# Inertia — Phase Four shared Audio Intelligence

Date: 2026-10-29  
Status: accepted by the user's instruction to proceed with the next phase. [Phase Five bounded choreography](cinema2-inertia-phase5-choreography.md) is now implemented for review. Inertia remains a reference preset. This report records the Phase Four checkpoint; its initial envelope timings are superseded by the Phase Five report.

## Delivered behavior

Inertia consumes the existing Cinema 2.0 Audio Intelligence bridge. Nine shared target channels deliver musical facts and initial rhythmic/structural envelopes; the native module reads their resolved values. No preset-local audio, beat, BPM, phrase, or drop detector was added.

**Audio Response** is now a real user-editable 0–1 slider, default 0.65, under **Design > Master Controls**. Zero immediately restores native, unmodulated artwork without stopping the native motion clock or disabling Pattern Change. The shared analysis itself continues normally; the slider controls Inertia's visual contribution.

| Shared source | Resolved channel | Visible consumer / maximum contribution |
| --- | --- | --- |
| Overall energy | `energyMotion` | Existing motion drive ranges from 80% to 100%, interpolated by Audio Response; cannot exceed the user's motion ceiling |
| Bass | `bassPressure` | Inward radial cage pressure, up to 0.025 world units × R × M × D |
| High band | `pointSparkle` | Up to 10% × R local coverage gain on a stable spatial point mask, capped below the authored color/intensity ceiling |
| Vocal presence | `vocalRestraint` | Up to 25% × R reduction of discretionary deformation drive; no topology, palette, or count replacement |
| Shared build progress | `buildCompression` | Inward tension, up to 0.035 world units × R × M × D |
| Kick | `kickDisplacement` | Outward cage displacement up to 0.035 world units × R × M × D, plus up to 3.5% × R × M core-radius pulse |
| Snare | `shearAccent` | Local row shear up to 0.025 world units × R × M × D |
| Transient | `transientAccent` | Same shear domain; compose with snare using maximum rather than summing two forces for one hit |
| Shared drop | `dropRelease` | Outward release up to 0.05 world units × R × M × D; does not substitute Pattern |

R = Audio Response, M = Motion Amount, D = Deformation. Combined radial contributions are clamped to ±0.06 world units, then share the established final safe-radius budget with native motion and sprite size. Core pulse is independently bounded. Motion Amount zero blocks musical geometry; Deformation zero blocks nonrigid cage accents while retaining the separately documented core pulse and rigid native motion. Intensity zero still extinguishes the hero geometry against the default black background.

Initial event envelopes use shared-runtime attacks/releases: kick 15/220ms, snare/transient 10/160ms, drop 20/450ms. Continuous shared-target smoothing is 120ms energy, 80ms bass, 30ms highs, 180ms vocals, and 200ms build. Event delivery is once-per-event with a 0.45 confidence threshold. These are the initial Phase Four delivery routes needed to use the normal target/value-resolution path; Phase Five remains responsible for choreography refinement and perceptual tuning. No temporary direct-parameter bypass was introduced.

## Authority and lifecycle

- Colors, structural controls, speed, damping, camera, and ceilings remain authored user state. Runtime musical channels never rewrite saved parameters.
- Source validation rejects incomplete/reset publications and foreign-track frames. Missing source authority produces no dependent response.
- Pulse permissions are fenced at activation, pause/resume, disabled/re-enabled Audio Response, seek/loop, source/analysis changes, and re-entry. Existing envelopes cannot silently return as a fresh musical accent.
- Structural pulse fencing uses shared **audio** timestamps. A regression test covers host transport running 200ms ahead of analyzer publication, so a delivered drop is not lost due to comparing unrelated timestamp positions.
- Pausing clears musical contribution while retaining native pose/phase and base Pattern. Source removal and timeline discontinuities reconstruct the authored base and discard stale transient state.
- The native selection controller now retains a bounded history of canonical event identities, in addition to the shared controller's current-event fence. Repeated/held publications cannot advance twice. Resume fences already-present events without replacing the maintained base Pattern.
- Manual Pattern selection, including reselecting the persisted value after runtime advancement, takes effect immediately, keeps Pattern Change ON, and holds until a fresh qualifying event. Trigger/toggle edits retain the shared controller's rebasing behavior.
- Pattern Change remains independent of Audio Response. All musical pattern-selection tests run with response and geometry motion at zero to prove that they are separate domains.
- No Auto Performance ownership exists at this milestone. Build/drop responses are bounded modulation of the current Pattern, not automatic substitution.

## Canonical musical Pattern Change

The exact shared IDs/labels and event meanings remain unchanged:

`beat`, `kick`, `snare`, `downbeat`, `beat2`, `beat4`, `bar`, `bar4`, `bar8`, `phrase`, `drop`.

Each was checked against the real rendered native output, not only a changed state ID. The test caches manual static Pattern output, injects a qualifying shared event, and compares the resulting canvas with the expected next Pattern. It then verifies duplicate suppression, same-value manual takeover, unchanged saved parameters, and resumption on another fresh event.

For bar-based triggers, a later publication in the same canonical bar is still the same event. Test fixtures advance to the next qualifying beat/bar index rather than inventing a second bar identity. Interval semantics remain owned by the established shared resolver.

## Validation and production evidence

Passed **24 focused unit tests** across static geometry, native motion, and shared audio/event behavior (3 + 5 + 16). The audio tests exercise the actual bridge, shared choreography runtime, target resolver, and native response gate. Coverage includes all 11 triggers, shared delivery/return to base, snare/transient composition, zero controls, unavailable/foreign source handling, manual reselection, timing resets, and analyzer/transport latency.

Production browser validation completed in two focused segments:

1. **15 response comparisons:** quiet/energetic passages; isolated bass, vocals, build, highs, kick, snare, transient, and drop; Audio Response minimum/default/maximum; response OFF; unavailable analysis; same-hit snare/transient composition; and Motion Amount zero. This segment was rerun after the structural-latency correction, without repeating the unaffected event matrix.
2. **62 event/lifecycle comparisons:** all 11 canonical triggers and their rendered Pattern changes, repeated/held event suppression, same-value manual selection and fresh-event resumption, pause/resume, seek, loop wrap, analysis update, track replacement, and switching through the foundation preset back to Inertia. Saved parameters remain unchanged through runtime advancement. Re-entry retires the previous RAF owner and reconstructs authored state.

The intensity-zero assertion checks the entire canvas. The real production Inspector also confirms Audio Response under Master Controls. Its existing shared typography/styles are reused; no shared control typography was changed.

### Real reference soundtrack

The soundtrack was extracted locally from the user-supplied `Inertia.mov` to an ignored test artifact. Browser Web Audio decoded real PCM, played a segment through an AnalyserNode, and fed the existing `MusicIntelligenceAnalyserFramePump` / canonical `MusicIntelligenceEngine` / `AudioFeatureBus` / Cinema 2.0 bridge chain. Output was muted during validation; analyzer processing remained active.

Eight real-playback snapshots recorded **139 shared analyzer samples**. Resolved energy, bass, and highs reached approximately 0.556, 0.962, and 0.988 respectively in this run. The native renderer remained active without browser/module errors. These values demonstrate real signal delivery, not a performance benchmark or recovered source BPM.

Real playback validates the continuous/live analysis path. Deterministic shared fixtures validate structural build/drop/phrase timing; this phase does not claim that the short reference soundtrack has a fully analyzed structural timeline.

Artifacts, all local and Git-ignored:

- [Response report](../artifacts/inertia-phase4/response-report.json)
- [Event/lifecycle report](../artifacts/inertia-phase4/report.json)
- [Real-audio provenance and channel report](../artifacts/inertia-phase4/real-audio-report.json)
- [Quiet](../artifacts/inertia-phase4/quiet.png) / [energetic](../artifacts/inertia-phase4/energetic.png)
- [Build tension](../artifacts/inertia-phase4/build-tension.png) / [drop release](../artifacts/inertia-phase4/drop-release.png)
- [Kick response](../artifacts/inertia-phase4/pulse-kick.png)
- [Snare response](../artifacts/inertia-phase4/pulse-snare.png) / [transient shear](../artifacts/inertia-phase4/transient.png)
- [Vocal restraint](../artifacts/inertia-phase4/vocal-restraint.png) / [high sparkle](../artifacts/inertia-phase4/high-sparkle.png)
- [Actual soundtrack playback](../artifacts/inertia-phase4/real-soundtrack.png)
- [Audio Response Inspector](../artifacts/inertia-phase4/audio-response-inspector.png)
- [Re-entry](../artifacts/inertia-phase4/reentry.png)

Pulse captures use a separate filename prefix from event-driven Pattern captures so subsequent validation does not overwrite one with the other.

### Reproduce

```sh
mkdir -p artifacts/inertia-phase4
ffmpeg -hide_banner -loglevel error -i /Users/kodyrobinson/Desktop/Inertia.mov -vn -c:a copy artifacts/inertia-phase4/reference-audio.m4a -y
npx vitest run --config vitest.node.config.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaMotion.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaStatic.test.ts
npx tsc --noEmit --pretty false
node scripts/run-cinema2-inertia-audio-browser.mjs
```

`--responses-only` and `--events-only`, after the output-directory argument, reproduce the focused segments independently. The latter also runs real playback and Inspector checks; its report scope explicitly records that segmentation. Targeted ESLint and `git diff --check` passed. No unrelated broad build/test suite was run.

## Handoff and remaining scope

Shared musical response and canonical event-driven Pattern Change are implemented. Production audio/structure captures were inspected; user acceptance of this checkpoint remains pending. Next is Phase Five bounded choreography refinement, followed by Director meaning, Auto Performance, finishing, and final acceptance in their planned phases. No keeper promotion occurred.

No commit was requested or created. All Inertia work remains uncommitted. This phase changes Inertia-specific code/tests/documentation and updates its review-entry comment; no shared detector or runtime behavior was changed.
