# 04. BLOCKSHIFT Patterns, Transitions, Trigger Logic and BPM Sync

## Pattern design rule

**Six actual geometry programs**, not six color masks. Every pattern must look distinctive with edge/bloom/audio OFF and a static camera at a representative phase. Each program returns exactly nine finite object targets against the same nine immutable IDs. Public names are BLOCKSHIFT-specific; no shared universal pattern taxonomy.

## Six immersive patterns — current P4 implementation

These programs evolve around the observer inside the approved field. The earlier three-tower/ring installation silhouettes are superseded by [the immersive revision](19_IMMERSIVE_FIELD_REVISION.md). Not all nine objects should be visible at once; rear objects and peripheral crops are intentional.

| Pattern | Spatial pose and animated grammar |
|---|---|
| **Stack** | Taller surrounding columns; column-offset lift, restrained horizontal sway and depth movement |
| **Orbit** | The surrounding field rotates around the observer on the Y axis, with coordinated local yaw and subtle height breathing |
| **Stagger** *(default)* | Asymmetric front/rear depths with delayed three-axis travel cascading through stable object IDs |
| **Split** | Opposing left/right banks breathe laterally and move in depth, preserving the negative-space seam |
| **Wave** | Phase-delayed vertical and depth waves with small horizontal travel |
| **Collapse** | Bounded compression/release about the observer, retaining open eye space and surface clearance |

Each trajectory preserves its approved static pose at normalized phase zero. One cycle is 32 effective beats divided by Motion Rate × Motion Amount: at 120 BPM, rate 1 and amount 0.55, approximately 29.1 seconds. Motion Amount zero freezes the current cube pose; it does not snap all cubes back to phase zero. Rotation Range controls local pitch/yaw/roll; Orbit also has coordinated field rotation. All layouts and blended poses receive transformed-box clearance and observer-exclusion checks without changing object sizes.

### Per-pattern geometry addressability

Maintain a typed `BlockId`, stable `row`, `column`, `bank`, `ringOrder`, `sequenceIndex`; create deterministic `targetTransform(blockId, pattern, phase, authoredGeometry)` and `groupMask(blockId, cue)` helpers. Allow the choreography mapper to modulate bank/row/outer/center addresses while preserving per-pattern composition.

## Transition contract — implemented in P4

- Runtime pattern changes do not overwrite the persisted authored Pattern.
- Retarget from the last fully evaluated visible pose. Interpolate camera-centered azimuth, horizontal radius and height with smoothstep easing; use coherent turn directions and shortest local rotation angles. Straight lines through the observer are avoided.
- Transition Length is 0.5/1/2/4 effective beats, default 1. BPM Sync OFF and missing valid tempo use the shared 120 BPM fallback (0.25/0.5/1/2 seconds). Idle manual changes also use 120 BPM; this preview timing never creates musical events.
- Duration edits preserve current progress. A new selection during a transition starts from the last visible pose. Geometry edits apply their newly selected safe target immediately.
- Paused or zero-motion manual Pattern edits snap to the selected pose so manual authority remains effective. Otherwise pause/master zero freeze an in-flight transition.
- Apply the same 1.5-unit transformed AABB separation and 2.5-unit observer exclusion throughout blends. Full pose bounds are 300 world units, camera far plane 420; no shrink-to-fit or all-nine-in-frame policy.

**P5 trigger hardening:** The canonical resolver remains authoritative for all eleven options. BLOCKSHIFT caches the resolved identity per upstream publication and suppresses the clock fallback of an already consumed structural phrase, preventing one musical boundary from switching twice. Pattern Change is independent of Audio Reactivity: disabling the latter removes modulation, not the separately enabled trigger selection.

## Shared Pattern Change controller

Use and test the generic `Cinema2MainframePatternController<Pattern>` from `modules/mainframe/Cinema2MainframePatternController.ts` if compatible; it already supports runtime-only pattern cycling, deterministic no-immediate-repeat, changed authored selection and stale-trigger suppression. It relies on a canonical trigger ID and unique event identity; adapt the resolve helper only as allowed by the existing shared source semantics.

Precedence is explicit:

```text
Persisted Pattern user selection
   -> runtime underlying base Pattern
      -> fresh Trigger may advance base ONLY while Pattern Change ON
         -> temporary, event-qualified Auto Performance overlay allowed
            -> overlay ends, reveal current underlying base Pattern
```

Do not switch on persistent build progress alone. Do not let an event present at the moment of a manual Pattern edit immediately switch away from it. Pattern Change OFF always holds the authored Pattern and suppresses trigger-driven cycling without suppressing continuous audio dynamics.

## Exact trigger source

Import and present **`CINEMA2_AFTERHOURS_TRIGGER_OPTIONS`** (11 unchanged IDs and labels: beat, kick, snare, downbeat, beat2, beat4, bar, bar4, bar8, phrase, drop). Follow the canonical event resolver behavior from `Cinema2AfterhoursNativeModule.ts`; where an existing generic resolver can be reused, do so rather than coding a second beat/drop detector. Event **identity**, source/track/time, fresh boundary, and transport validity matter more than a raw boolean.

## BPM Sync domain and global Sync composition

- **BPM Sync ON:** formation oscillation phase and pattern-transition duration should follow confirmed music beat/bar timing when available; apply intentional quantization only to domains defined in this spec. Tempo change changes the length/speed of motion in a visible way. Pattern Change triggering still uses canonical event identities.
- **BPM Sync OFF:** formation motion uses deterministic unsynced elapsed-time phase; triggered pattern change still waits for selected real musical Trigger when Pattern Change ON, since disabling motion tempo lock must not silently replace the trigger source with a fake timer.
- **Global Audio Dock Sync:** the preset BPM Sync controls its native motion independently, using the shared grid/tempo when valid; host Sync continues to govern transport. The P3 browser matrix covers local/host ON/OFF combinations. No local detector or synthetic musical event source exists.
- `Cinema2SyncedMotionClockResolver` supports BPM-scaled continuous motion but is not automatically beat/grid quantization. For accurate beat-aligned transitions read confirmed engine rhythmic context; don't implement local detection.
- Missing tempo/grid: use the shared 120 BPM fallback for continuous timing; do not synthesize fake kick/drop/phrase events. If only BPM rate is available, motion may be tempo-scaled but must not pretend to be beat-locked.

## Transport/discontinuity matrix

| Input | Required behavior |
|---|---|
| Play | Resume valid time source; no duplicate event on entry frame |
| Pause | Freeze object motion and transition phase exactly; no cycling |
| Resume | Advance only with fresh qualified events, no catch-up burst |
| Seek forward/back | Rebase or deterministically reconstruct phases; discard stale events |
| Loop | Clear event identity/phase at the boundary and prevent false double-firing |
| Track change | Reset pattern event history, tempo reference, temporary envelopes and active overlays |
| Context generation change | Recreate/rebase runtime state and GPU where needed |
| Preset exit/re-entry | Reinitialize transient state; restore authored control values from engine state |
| BPM Sync toggle | Preserve current pose/phase continuity while changing clock rate |
| Pattern Change toggle | OFF returns to authored base; ON arms only the next fresh qualifying event |
| Trigger edit | Keep currently visible pattern; ignore already present qualifying event |

## Pattern quality proof

Capture each pattern with the camera stationary, fixed palette and effects OFF, with actual changing poses/pixels. P4 pairs of frames and a continuous recording use a controlled standard host transport without analyzed audio; numerical tests cover whole cycles and geometry extrema. Capture two transitions with mid-frame evidence (Stack→Orbit, Split→Collapse). A motion-less static image for all six with only different colors is an automatic P4 FAIL. Actual transform matrices/positions and real output pixels must change.
