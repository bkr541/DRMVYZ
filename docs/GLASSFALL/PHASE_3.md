# GLASSFALL phase 3 — shared audio and pattern events

Scope: connect existing Audio Intelligence and event-driven Pattern Change to the
approved all-triangle visual engine. No new musical detector/clock, Director
interpretation, Auto Performance or authored choreography envelopes.

## Implemented ownership

- Pattern / Pattern Change / Trigger are enabled through generic parameter
  definitions. Pattern Change defaults OFF; Trigger is visible only ON and
  retains the exact 11 canonical shared choices.
- Shared Afterhours event resolution supplies identities. Shared Mainframe pattern
  selection advances the six native programs without changing persisted Pattern.
- Manual selections, including selecting the same authored value again, take
  visible effect immediately without disabling Pattern Change. Current/duplicate
  events cannot undo them. The next fresh selected event resumes progression.
- Trigger/toggle edits prime the current event. Pause watermarks held events;
  resume cannot replay them. Loop, seek, source/analysis revision and re-entry
  reset runtime selection to the authored base and re-prime event identities.
- Music Reactivity is an independent 0–1 user base. Zero removes the basic audio
  mapping without disabling explicitly authorized Pattern Change.

## Basic native audio mapping

Shared available signals are read once per frame and passed to the renderer.
Foreign-track signals are rejected. No local analysis or synthetic musical event
is created. Paused playback holds the sampled facts; discontinuities clear them.

| Shared fact | Visible consumer / maximum added response at Reactivity=1 |
|---|---|
| Overall energy | Illumination activity +30%, clamped to master ceiling |
| Bass | Physical relief +18% of the authored base |
| Highs | Prism Trace contour phase offset up to 0.12 cycles |
| Vocal presence | Reduce competing illumination by up to 40% |
| Build progress | Physical relief +12% of the authored base |
| Kick | Upright-slot accent up to +0.45 illumination |
| Snare | Inverted-slot accent up to +0.45 illumination |
| Shared drop marker | Broad impact accent up to +0.35 illumination |

Rhythm samples are accepted only within 80ms of their shared timestamp; drop
markers within 250ms. These are direct observation windows, not local event
attack/decay envelopes. Phase 4 owns authored choreography/envelopes through the
shared target system. Relief changes also update the mounting-post lengths.
The reference layout, palette bases and fixed camera remain under user authority.

## Review and acceptance

```sh
node scripts/cinema2-assets/accept-glassfall-phase3.mjs --serve
```

The review harness publishes deterministic test-only upstream Music Intelligence
frames through AudioFeatureBus and consumes them through the real bridge/runtime.
It reuses the existing Ifrit fixture; no fixture/detector code enters production.

Focused tests cover source availability, same-value/manual takeover, duplicate
suppression, pause/resume watermarks and activation/OFF behavior. Production
canvas tests cover all 11 trigger options, correct next rendered patterns, manual
selection with Pattern Change ON, continuous/rhythmic/structural responses,
Reactivity range/zero, Sync independence, loop reset, source/analysis reset,
re-entry, Inspector choices and resource disposal. Validation passed: TypeScript; nine focused tests; and the phase 3
production-canvas acceptance script. Final audio-drop and Inspector-trigger
captures visually inspected. Machine report/captures are in
`artifacts/glassfall-phase3/`. Tests use deterministic upstream fixtures; a real
track listening session and final human musical/visual acceptance remain pending.

Phase 3 remains a private review preset. Phases 4–8 and human visual acceptance
are still required before production release. No commit requested or created.
