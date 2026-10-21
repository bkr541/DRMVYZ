# 09. CANOPY Release Gate / Definition of Done

**Status in this artifact:** NOT IMPLEMENTED / NOT TESTED. These are future implementation acceptance conditions.

## A. Visual and geometry

- [ ] CANOPY appears in actual first-party keeper catalog under unique preset ID.
- [ ] Production visual is visibly 3D hanging rods, not 2D lines / flat equalizer.
- [ ] Default 8×8 rods, meaningful front/rear depth, mounting attachments, deterministic layout.
- [ ] No overshoot/clipped rods at min/max height, structure sizes, aspect ratios and resize.
- [ ] Bloom OFF still shows correct hero geometry and world-space depth.
- [ ] Independent physical transforms/positions/lengths respond to authored parameters.
- [ ] 16:9, square, portrait and window resize capture accepted by human reviewer.

## B. Native engine wiring

- [ ] Module definition versioned and registered with existing `Cinema2ModuleRegistry.ts`.
- [ ] Keeper manifest registered with existing first-party catalog + registry; compiler/authoring diagnostics clean.
- [ ] Manifest uses actual supported scene/layer/camera/environment/render/effect APIs.
- [ ] Engine final resolved parameter values drive module every frame; no alternate private state manager for user settings.
- [ ] GL resource tracking, GPU accounting, renderer disposal and context restoration verified.
- [ ] ≤ engine non-ambient light limit; LED emission instanced; performance data captured.

## C. Inspector and authority

- [ ] Controls only under allowed Design parent IDs; no CANOPY-specific Inspector UI fork.
- [ ] **BPM Sync boolean** under Design > Master Controls; functioning ON/OFF music-clock policy.
- [ ] **Pattern enum**, **Pattern Change boolean (default OFF)**, **Trigger enum** in order under Design > Design.
- [ ] Six genuine native physical patterns shown with representative screenshot/filmstrip each.
- [ ] Trigger hidden iff Pattern Change OFF, previous selected Trigger retained.
- [ ] Trigger dropdown values/labels exactly match the 11 canonical options.
- [ ] Pattern Change OFF never cycles patterns; ON changes only on new qualifying Trigger.
- [ ] Manual Pattern edit while ON immediately visible; does not disable ON or get stolen by stale event.
- [ ] Deterministic no-immediate-repeat / duplicate-event / pause/seek/loop/track-change semantics.
- [ ] Palette includes **≥4 independent editable color parameters** under Design > Palette (target CANOPY = 5).
- [ ] Every Palette role independently affects its real documented visual consumer.
- [ ] All other visible controls min/default/max and enum cases work on production canvas, no placeholders.
- [ ] Hard OFF/0 values remain effective with Auto Performance ON.

## D. Shared intelligence and musicality

- [ ] Shared Audio Intelligence provides musical facts; no preset-local beat/BPM/drop detector.
- [ ] Choreography uses target/value resolver with documented bounded actions, reset-safe event envelopes.
- [ ] Audio has at least one independently visible continuous energy response that physically changes geometry.
- [ ] Kick and snare affect distinct fixture groups/geometry; more than uniform brightness modulation.
- [ ] Build compresses/tensions geometry and drop produces a bounded visible release.
- [ ] Phrase/section produce meaningful structural variation/cleanup.
- [ ] Vocal restraint visibly changes occupancy/intensity without overriding authored settings.
- [ ] Visual Director only scales generic significance; does not choose CANOPY geometry or persist colors.
- [ ] Manual vs Auto Performance authority policy passes all property tests.
- [ ] If Auto uses temporary performing pattern override, it restores correct underlying base after expiration; if not, behavior documented.
- [ ] No-track/paused/playing/seek/loop/track replacement/re-entry work and stale envelopes clear.

## E. Rendering, tests and review

- [ ] Correct render graph scene target includes depth; final compositor output visible with camera/effects.
- [ ] Unit tests: geometry, patterns, timing, manifest, Inspector, trigger controls, audio/authority, renderer/resources.
- [ ] Production browser harness actually opens **React Cinema 2.0** and captures real canvas.
- [ ] Motion tests demonstrate visible frame-to-frame rod geometry change.
- [ ] Production test set covers silence, kick, snare, energy, vocals, build, drop, phrase and section.
- [ ] Bloom OFF/default/max verified; no effect hiding poor geometry.
- [ ] No shader/GL errors; stable frame-time and memory at default/max density on target hardware.
- [ ] Human review checks composition, scale, timing, musicality, effect taste, camera safe bounds and recognizes CANOPY identity.
- [ ] Focused tests/typecheck/build passed or exact blockers documented; code diff reviewed.
- [ ] No required FAIL or NOT VERIFIED remains before marking keeper production-ready.

## Stop-ship examples

**Do not release** if the preset is technically wired but visually static; an Inspector toggle doesn't affect the scene; fewer than six meaningfully distinct patterns exist; Trigger options or types mismatch; auto-stealing manual selection occurs; Palette colors alias each other; no-tracks/seek leak stale glow; music affects only brightness; frame spikes or GL leaks occur; production browser or human visual signoff is missing.

## Final handoff record

```text
Build/commit:
Implemented vs omitted scope:
Source files changed:
Tests run and PASS:
Tests FAIL with explanations:
Manual visual proofs (paths/frames):
Peak instance count, draw calls, GPU bytes, frame-time (method/device):
Known regressions and open risks:
Human review status:
Root preset contract sections checked:
Release decision: GO / NO-GO
```
