# PSYLO — Phase 3 shared audio and musical switching

November 1, 2026. Phase 3 implementation and focused automated validation are
complete. Human review of the musical response remains the next gate. **Phase 4
has not begun.** PSYLO remains a reference preset, revision 2; no commit was
requested or created. Existing Phase 2 controls restore without a revision reset.

## Implemented

- Shared Audio Intelligence delivery with the established frame-validity gate,
  track identity and timeline freshness. No preset-local analyzer, beat clock,
  phrase/drop detector or synthetic musical events were added.
- Music Response under Master Controls, default 0.8, range 0–1. Zero restores native
  authored output while enabled musical Pattern switching remains independent.
- Energy and bass shape bounded motion range/bending; highs and vocals shape spore
  activity and restraint. Kick/snare/downbeat facts produce distinct spatial
  geometry accents. Supported builds gather/compress the grove; semantic drops
  release an outward traveling wave. Emission accents remain under authored limits.
- Native response channels compose through declared Cinema 2.0 module targets.
  Geometry stays within the Phase 2 displacement/scale safety envelope. Colors,
  roots, physical scale, camera permissions and saved design values remain owned
  by the user. No Choreography rules, Director meaning or Auto Performance were
  introduced; expanded choreography remains Phase 4.
- All eleven canonical Trigger modes advance the same eight native programs only
  on new qualifying shared events. Pattern Change defaults OFF. Trigger stays
  conditional and its saved selection is preserved while hidden.
- Manual Pattern edits, including same-value reselection, take effect immediately
  while Pattern Change remains ON. Already-active/duplicate events cannot undo
  the edit. Automatic progression changes only the runtime base, never the saved
  Pattern, Pattern Change or Trigger settings.
- Pause holds the last audio response and native phase even though the host hides
  audio snapshots while paused. Resume latches active identities and continues the
  existing envelope without replaying paused hits. Music Response zero still wins
  immediately during pause.
- Playing through an analysis gap preserves procedural motion and uses authored
  response fallback. Data return and analysis/timeline refresh rearm current events
  while preserving the runtime base and motion phase. Seeks, loop restarts, track
  changes and re-entry reconstruct clean state.

## Visual response checkpoints

[Quiet](PSYLO-phase3-quiet.png), [energetic](PSYLO-phase3-energetic.png),
[build](PSYLO-phase3-build.png), [drop](PSYLO-phase3-drop.png).

These are real production renders. Continuous response and build comparisons hold
camera and native phase constant; differing pixels cannot be attributed solely to
normal camera/animation progress. Trigger renders are compared against manual
program renders at the same held phase, with modulation disabled, proving that
actual native geometry changed rather than just an internal Pattern ID.

## Focused validation

- **33 focused Vitest checks pass:** 26 audio/event/authority tests, 3 preset tests
  and 4 camera/clearance regressions. Coverage includes positive and nonqualifying
  trigger subdivisions, stale/mismatched/unavailable inputs, target composition,
  bounded outputs, event release/deduplication, paused host gating and manual edits.
- **131 production assertions across 43 captures pass** against the real Cinema 2.0
  renderer/Inspector and shared AudioFeatureBus. The final combined gate includes
  quiet/energetic/vocal/build/rhythmic/drop response, Music Response minimum/default/
  maximum, independent high-frequency spore response and BPM Sync OFF reactivity.
- All eleven Trigger types visibly select the expected native program. Duplicate
  publications do not double-switch; permission OFF holds the authored program.
  Saved Pattern, Pattern Change and Trigger values remain unchanged by cycling.
- Manual edit/reselection, stale active events, pause/resume, analysis refresh/gap/
  return, seek, loop, track change and saved-setting re-entry pass. Hard geometry,
  emission and spore disables remain effective under a strong drop publication.
- The paused image matches the preceding frame exactly (mean pixel difference 0)
  and the final camera pose remains unchanged. Analysis-gap motion is sampled at
  a non-repeating phase to avoid mistaking a complete motion cycle for a freeze.
- No browser/shader errors, failed/degraded modules or failed render passes remain.
  Final disposal reports zero active module resource leases.
- TypeScript, scoped ESLint, whitespace and documentation-reference checks pass.
  The Phase 1 model files, source hashes, attribution and asset budgets are unchanged;
  the decoded-geometry camera safety regression still passes.

Run:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2PsyloAudio.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2PsyloCamera.test.ts
node scripts/cinema2-assets/accept-psylo-phase3.mjs
```

The final combined evidence is `artifacts/cinema2-psylo-phase3/report.json`.
The optional `--lifecycle` argument runs only the lifecycle/response section for
focused diagnosis; it does not replace the full acceptance command above.

## Handoff and remaining scope

PSYLO is ready for Phase 3 musical review. Music Response controls modulation;
Pattern Change independently permits shared-event program advancement. Test a
manual Pattern choice while Pattern Change stays ON, then wait for the selected
fresh Trigger to resume cycling.

The browser harness publishes deterministic test-only music frames through the
shared bus. It is not independent evidence of live desktop playback or a hardware
performance benchmark. The response/controller code consumes the same production
bridge used by real music; live musicality and final full-app acceptance remain
human/later acceptance gates.

Phase 4 will add expanded, pattern-specific target-based choreography. Director,
Auto Performance, full fog/shafts/bloom and final brightness matching against
MAINFRAME/NIGHTSHIFT/Cathedral remain in their planned later phases.

The final diff review covers only intended PSYLO audio delivery, native shader/
module/manifest integration, fixtures, harness, tests and documentation. Existing
unrelated user edits remain untouched. All Phase 1–3 work remains uncommitted.

See [the current behavior specification](PSYLO-behavior-spec.md) and
[the implementation plan](PSYLO-implementation-plan.md).
