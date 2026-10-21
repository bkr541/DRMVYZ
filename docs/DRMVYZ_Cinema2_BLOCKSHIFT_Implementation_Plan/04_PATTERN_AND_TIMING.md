# 04. BLOCKSHIFT Patterns, Transitions, Trigger Logic and BPM Sync

## Pattern design rule

**Six actual geometry programs**, not six color masks. Every pattern must look distinctive with edge/bloom/audio OFF and a static camera at a representative phase. Each program returns exactly nine finite object targets against the same nine immutable IDs. Public names are BLOCKSHIFT-specific; no shared universal pattern taxonomy.

## Six canonical patterns

| Pattern | Formation geometry | Native animation grammar | Distinctive screenshot proof |
|---|---|---|---|
| **Stack** | Three separated vertical towers of three cubes, varied depth | Alternating height offsets and restrained tower sway | Three unmistakable towers, not a flat grid |
| **Orbit** | Eight outer blocks distributed on an elliptical ring around a central cube | Bounded orbital position rotation and coordinated face yaw; center remains anchored | Circle/ring silhouette plus visible central cube |
| **Stagger** *(default)* | Asymmetric stepped rows with alternating z-depth | Lateral shifts and diagonal cascading local travel | Uneven stair-step silhouette and perspective offset |
| **Split** | Distinct left and right banks, center cube near middle | Banks translate in opposing directions and recede/approach on z | Wide negative-space seam with two separate groups |
| **Wave** | Serpentine 3D ribbons of blocks | Phase-delayed vertical/depth oscillations, paired yaw variation | Wavy multi-row silhouette, nonuniform y values |
| **Collapse** | Compact, still-separated cube cluster, center-focused depth | Controlled converge/expand pulses using minimum distance constraints | Tight but nonintersecting cluster clearly distinct from Split |

**Default** is Stagger, because it visually shows 3D and separated cubes with no audio. A silent idle preview must show one clearly authored pose; motion when playing should use conservative, bounded paths. **Orbit** must not require physics, and **Collapse** must never actually intersect cubes.

### Per-pattern geometry addressability

Maintain a typed `BlockId`, stable `row`, `column`, `bank`, `ringOrder`, `sequenceIndex`; create deterministic `targetTransform(blockId, pattern, phase, authoredGeometry)` and `groupMask(blockId, cue)` helpers. Allow the choreography mapper to modulate bank/row/outer/center addresses while preserving per-pattern composition.

## Transition contract

- A pattern switch changes **current runtime pattern**, not persisted authored Pattern (unless caused by explicit user selection).
- Capture the last fully evaluated *visible* pose (not only the previous static layout) when a transition begins. Interpolate toward new pattern targets with beat-relative easing. This prevents jumps during audio-driven motion.
- Keep transitions short and deliberate, e.g. 1 beat default, adjustable 0.5/1/2/4. With BPM Sync OFF, a documented fixed wall-time duration should replace beat durations.
- Deterministic stagger by stable ID, not `Math.random()` per frame. Avoid collision in interpolated middle states; apply safety shrink/path correction when necessary.
- New event during transition: either schedule the next transition or retarget from the current visible pose. Choose one policy in P1 (recommend retarget from current pose, with minimum transition spacing), test closely spaced triggers.
- If performance audio is absent, transitions still work when user changes Pattern; user does not need audio to configure geometry.

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
- **Global Audio Dock Sync:** decide in P0/P1 whether local BPM Sync works independently using shared analyzed grid (`requireHostSync: false` pattern) or requires host Sync; document the chosen user-visible meaning and test all combined ON/OFF combinations. **Recommended**: the preset BPM Sync is authoritative for its native motion and uses analyzed/transport tempo if valid, while global host Sync still controls transport as designed.
- `Cinema2SyncedMotionClockResolver` supports BPM-scaled continuous motion but is not automatically beat/grid quantization. For accurate beat-aligned transitions read confirmed engine rhythmic context; don't implement local detection.
- Missing tempo/grid: keep a clearly documented stable fallback; do not synthesize fake kick/drop/phrase events. If only BPM rate is available, motion may be tempo-scaled but must not pretend to be beat-locked.

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

Capture each pattern at the same camera, palette, effects OFF, no audio, and at three representative normalized phases. Capture two transitions with mid-frame evidence (Stack→Orbit, Split→Collapse). A motion-less static image for all six with only different colors is an automatic P4 FAIL. Actual transform matrices/positions and real output pixels must change.
