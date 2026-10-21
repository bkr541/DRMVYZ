# 09. BLOCKSHIFT Production Release Gate (Unfilled Checklist)

**Not yet evaluated.** Every box is initially UNVERIFIED. A coding agent must fill exact test commands, commit, screenshot/video paths and outcome. This artifact is a sign-off form, not proof the preset exists.

## Gate record

```text
Repository/branch:
Commit SHA:
Contract revision:
Date/time:
Test environment (OS/browser/GPU):
Reviewers:
Overall: NOT VERIFIED / PASS / FAIL
Evidence index:
```

## P0/P1: source and visual specification

- [ ] Latest source and root standard inspected; no conflicting BLOCKSHIFT preset IDs.
- [ ] Authored spec, nine-addressable-cube geometry and module ownership approved.
- [ ] Six formations approved as visually distinct, physically realizable within safe envelopes.
- [ ] Manual authority, BPM Sync and all standard audio/camera/effect consumers specified.

## P2: native pipeline / visuals

- [ ] Manifest and module registered once, valid compiler/authoring output.
- [ ] Nine stable ID blocks have faces and emissive edges; world/depth camera correct.
- [ ] Visual renders in actual production canvas with audio and bloom OFF.
- [ ] No per-frame GPU allocation, shader errors or unresolved resources.

## P3: Inspector and controls

- [ ] Exactly four top-level parent group classes (Master Controls, Design, Effects, Palette).
- [ ] BPM Sync is user-editable under Master Controls, connects to real time consumer.
- [ ] Pattern, Pattern Change, Trigger placed together and ordered under Design.
- [ ] Pattern Change is **boolean OFF by default**; Trigger conditional visibility and value preservation work.
- [ ] Canonical eleven Trigger options are identical in value/label/meaning.
- [ ] Five Palette roles independently change actual pixel regions; at least four mandatory minimum satisfied.
- [ ] Every visible other control has a real rendered consumer; min/default/max tested.

## P4: motion/tempo/six patterns

- [ ] Stack, Orbit, Stagger, Split, Wave, Collapse are six visibly different geometric programs.
- [ ] Motion observable without lighting tricks; all nine identities remain stable.
- [ ] Transitions ease correctly, don't teleport or persistently intersect.
- [ ] BPM Sync ON and OFF behave differently and correctly at distinct BPM; no competing host Sync.
- [ ] Pause/resume/seek/loop/source swap/re-entry deterministic.

## P5: audio/events

- [ ] Uses shared Audio Intelligence / choreography: no private audio analysis.
- [ ] Kick, snare, beat/downbeat, bars/phrases, sections, build/drop produce meaningful bounded change.
- [ ] All 11 triggers only advance on new qualifying musical events; duplicate events ignored.
- [ ] Pattern Change OFF maintains authored base while normal audio modulation continues.
- [ ] Manual Pattern change while Pattern Change ON is immediate; toggle stays ON and stale event cannot cancel edit.

## P6: authority/Auto Performance

- [ ] Auto Performance OFF default; documented limited domains only.
- [ ] Temporary build/drop overlay does not change saved Pattern, Pattern Change, Trigger, palette or manual geometry.
- [ ] Current underlying base resumes after override including legitimate Trigger advancement during overlay.
- [ ] Manual edits take effect immediately; hard disables survive Auto mode.

## P7/P8: camera, effects, performance and real browser

- [ ] Camera and depth correct at 16:9, 1:1 and 9:16 for all six patterns.
- [ ] Bloom/camera/atmosphere OFF genuinely disables those effects.
- [ ] All tests on real production React Cinema 2.0 renderer with authentic app controls.
- [ ] Renderer respects 12 non-ambient light limit and module efficiency target.
- [ ] No GPU resource leak, stale event subscriptions or corrupted state across re-entry.
- [ ] Typecheck, build, focused tests and relevant adjacent Cinema 2.0 regressions pass (or issues classified before release).
- [ ] Human reviewer approved 6 pattern filmstrips, audio contrast recordings and authority demonstration.

## Absolute no-ship defects

Any of the following is an automatic **NO SHIP**: wrong hero visual; fake/flat 2D geometry; fewer than six actual patterns; missing BPM Sync / wrong group; wrong Pattern/Pattern Change/Trigger behavior; fewer than four independent colors; placebo settings; no genuine audio-reactive geometry; local duplicate detector/clocks; stale event stealing manual Pattern; Auto takeover without restoration; missed hard-disable; absence of production screenshots; intermittent GL/frame/render errors; unsafe repeated re-entry.

## Sign-off

```text
Contract coverage:
Core visuals reviewer/evidence:
Audio/choreography reviewer/evidence:
Inspector authority reviewer/evidence:
Browser/performance reviewer/evidence:
Known unresolved issues:
Decision: SHIP / NO SHIP
Reason:
```
