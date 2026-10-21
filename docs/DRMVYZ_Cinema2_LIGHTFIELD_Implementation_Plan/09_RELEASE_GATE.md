# 09. LIGHTFIELD release gate | mandatory stop-ship criteria

**Status for this package: NOT IMPLEMENTED, NOT PRODUCTION VALIDATED.** Fill these boxes during actual implementation, with links to evidence. The Markdown plan itself is not acceptance evidence.

## Visual identity and geometry

- [ ] At-rest floor looks like an intentional low-profile emissive tile installation with correct center/perspective, readable tile body and light inset; approved from actual production canvas.
- [ ] 4×4, 8×8, 12×12 and non-square grid remain stable and unclipped; no more than 144 tiles.
- [ ] Camera framing and tile occlusion correct at 16:9, square, portrait and resize; bloom OFF still shows hero geometry.
- [ ] No collisions, excessive tile tilts, missing/duplicated instances or NaN shader attributes.

## UI, mandatory shared controls and independent colors

- [ ] BPM Sync boolean is in **Design > Master Controls**, works in real time and has measured Sync ON/OFF difference.
- [ ] Pattern, Pattern Change, Trigger are ordered and all under **Design > Design**; Pattern Change is boolean and OFF by default.
- [ ] Pattern enum provides ≥6 distinct native options and each has its intended visible physical geometry motion.
- [ ] Trigger is only visible when Pattern Change ON; exact 11 shared values/labels/meanings. Its hidden value persists.
- [ ] Pattern Change OFF holds user base; ON advances only at new selected shared event. Duplicates/stale events don't re-advance.
- [ ] Manual Pattern edit while Pattern Change ON immediately takes effect, leaves ON, and persists until next fresh Trigger.
- [ ] Five independent Palette `color` controls each visibly affect separate named roles under **Design > Palette**.
- [ ] All additional controls under one of four allowed Design parents and have real runtime output consumers; min/default/max or each option proved.
- [ ] No placebo controls; hard OFFs (Master Intensity, Motion Amount, Camera Motion, Bloom) can't be bypassed.

## Music, timing, authority

- [ ] Continuous, rhythm and structural Audio Intelligence produce separate, purposeful, visible responses; no local BPM/beat/drop detector.
- [ ] Kick, snare, vocals, build, drop and phrase have correct timing and bounded envelopes; not all mapped to brightness.
- [ ] All 11 Trigger identities supported with correct event origin and duplicate suppression.
- [ ] Pause/resume/seek/loop, track/analysis/context changes, no-source state and preset re-entry reset or reconstruct coherently.
- [ ] Visual Director affects significance, not user colors/count/Pattern; Choreography uses shared target resolution and respects bounds.
- [ ] Auto Performance OFF doesn't mute ordinary audio or Pattern Change; Auto ON is limited to declared domains and never fights user settings.

## Runtime quality and evidence

- [ ] Authoring and compiler validations PASS; versioned native registry lookup resolves correctly, without duplicate IDs.
- [ ] Typecheck, relevant unit suites, production browser acceptance, build and targeted regression tests PASS, or preexisting unrelated failures are clearly documented with acceptance decision.
- [ ] WebGL render uses host camera/world pass/depth and host resources; correct `dispose`, no additional RAF or leaked per-tile resources.
- [ ] No per-tile physical lights, repeated shader compilation, unbounded GPU memory growth or unacceptable FPS/frame-time regression at agreed devices/quality tiers.
- [ ] Production screenshots, pattern filmstrips, Inspector screenshots, audio cue traces and browser run logs are archived and linked.
- [ ] Human has reviewed musicality, look, geometry pattern differentiation and usability.
- [ ] Source diff limited to approved new LIGHTFIELD files, standard registries and justified tests/harness changes; known deviations signed off.

## Evidence index (complete when working on source)

| Artifact | Exact file/URL or PR reference | Reviewer | Pass/Fail |
|---|---|---|---|
| Source audit + baseline | TBD | TBD | NOT VERIFIED |
| Static hero 16:9 / portrait / square, bloom OFF | TBD | TBD | NOT VERIFIED |
| Six pattern filmstrips | TBD | TBD | NOT VERIFIED |
| Inspector groups and 5-color proof | TBD | TBD | NOT VERIFIED |
| Eleven-trigger and manual takeover recording | TBD | TBD | NOT VERIFIED |
| BPM Sync and lifecycle recordings | TBD | TBD | NOT VERIFIED |
| Quiet/kick/snare/vocal/build/drop cues | TBD | TBD | NOT VERIFIED |
| Browser test / typecheck / build output | TBD | TBD | NOT VERIFIED |
| Resource/FPS/quality and re-entry logs | TBD | TBD | NOT VERIFIED |
| Human visual approval | TBD | TBD | NOT VERIFIED |

**Release rule:** a required missing proof or outstanding blocker means **STOP / NOT SHIPPABLE**. Do not mark complete based on an attractive still, successful TypeScript compile or unit-only assertions.
