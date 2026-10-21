# 04. Six Native CANOPY Patterns, Canonical Trigger and BPM Sync

## Design rule

Each option defines a **genuinely different geometric formation and movement path**, not merely which LEDs light up. Color/emission choreography is secondary to visible rod heights/lengths/position. All six use the same rod address set with distinct mathematical shape and timing functions. Avoid collision and whipping motion by smooth interpolations, clamped heights and reset-safe phase.

## Pattern library (MVP six)

| Value (proposed enum) | UI label | Authored formation | Native movement | Independent audio accents / visual proof |
|---|---|---|---|---|
| `waterfall` | **Waterfall** | Front rows high, successive back rows progressively lower | Repeating row-by-row downward/recovery wave | On kicks the currently traveling row briefly deepens its descent; front-to-back cascade visible |
| `crosswave` | **Crosswave** | Height phase follows diagonals `row+col` | Two diagonal waves cross across canopy | Snare accents opposite diagonal; motion direction not equivalent to Waterfall |
| `crown` | **Crown** | Center rods hang lower; outer ring lifted to form visible bowl/crown negative space | Radius-dependent breathing while preserving center/edge contrast | Sub expands bowl depth; visible center-vs-perimeter difference |
| `splitWings` | **Split Wings** | Left/right halves separated into high/low banks | Mirrored opposing lift paths, alternating on bars | Kicks land asymmetrically in the two wings; distinct central division |
| `checkerLift` | **Checker Lift** | Interleaved checker groups at two elevation bands | Discrete alternating tier lifts with easing | Snares switch which checker group is elevated; visible checker sculpture |
| `downpour` | **Downpour** | All rods near a high/tension formation, with subtle deterministic individual offsets | Synchronized descending curtain, then a calm recovery | Drop produces the whole-array release; bounded, not teleporting |

**Acceptance:** fixed camera + fixed palette + fixed audio fixture must show six materially different rod-position distributions and movement trajectories. Pattern phase cannot collapse into six aliases at rest or over one bar. Each selected Pattern should still look good with Color Accents OFF and Bloom OFF.

## Pattern-specific equations (design guidance)

- Normalize fixture coordinates `u=(col/(cols-1))×2−1`, `v=(row/(rows-1))×2−1`, radius `r=min(1,sqrt(u²+v²)/sqrt(2))`.
- `waterfall`: base offset by row with a periodic band envelope `pulse(beatPhase×N−row)`, bounded to ±Height Range.
- `crosswave`: superposition of two modest traveling diagonals using `u+v` and `u−v`; avoid excessive sum by normalization.
- `crown`: static negative-space sculpt `height ~ f(r)` plus slow bounded breathing; don't erase the bowl shape at phase 0.
- `splitWings`: sign(u) defines banks, with opposite easing and subtle bar-boundary swap.
- `checkerLift`: parity `(row+col)%2` owns two tiers; ease swap across beat boundaries, never snap position.
- `downpour`: all rods descend from high tension with stagger ≤small fraction of a beat, then ease toward baseline.

Use normalized phase and a pure function `evaluateCanopyPattern(pattern, fixtureAddress, sharedTime, authoredParameters, resolvedTransientTargets)` whenever possible. Patterns need not rely on historic GPU state or uncontrolled `Math.random()`.

## Pattern switching ownership and precedence

1. `Pattern` defines **saved authored base**.
2. Pattern Change OFF: active base equals Pattern; no Trigger-driven changes. Audio modulation within the pattern stays active.
3. Pattern Change ON: a fresh qualifying selected Trigger advances runtime active base to a different pattern, without persisting it over Pattern.
4. Manual Pattern edit, even with Pattern Change ON: immediately show the selected pattern, preserve ON state, and set a guard so the event already present cannot steal it.
5. Trigger change ON: update future trigger matching, do **not** immediately cycle.
6. Auto Performance (if enabled) may temporarily replace the **performing** view on a separately qualifying build/drop moment; keep the underlying base controller advancing appropriately and restore the latest base afterward.
7. Never replay a stale `drop` on seek/re-entry, never advance multiple times for the same event identity, never force immediate duplicate pattern.

**Implementation recommendation:** adopt `Cinema2MainframePatternController<CanopyPattern>` with a CANOPY pattern cycle generated through `createCinema2MainframePatternCycle` and engine-owned `context.randomness.sample(...)`, or factor a shared generic helper only if necessary and with regression tests. `resolveCinema2AfterhoursTriggerEventIdentity` can supply canonical event identity; validate its preconditions and end-to-end behavior with actual audio frames. There is no need for a preset-local beat detector.

## Canonical Trigger dropdown (exact 11)

Import `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` (or same canonical shared successor). Do not manually replicate in implementation. For documentation only:

| Value | Display |
|---|---|
| `beat` | Beat |
| `kick` | Kick |
| `snare` | Snare |
| `downbeat` | Downbeat |
| `beat2` | Every 2 Beats |
| `beat4` | Every 4 Beats |
| `bar` | Bar |
| `bar4` | Every 4 Bars |
| `bar8` | Every 8 Bars |
| `phrase` | Phrase |
| `drop` | Drop |

Canonical beat and bar subdivisions use event identities/index, not a rolling local timer. Phrase/drop rely on published structural event context. Exclude duplicate-event re-consumption.

## Timing and BPM Sync contract

| Situation | Required behavior |
|---|---|
| BPM Sync ON + analyzed beat grid | Drive periodic geometric motion from shared beat indices + phase (or shared equivalent) and cadence; reproduce same positions for the same track time |
| BPM Sync ON + no usable grid, BPM available | Use one documented transport/clock fallback; do not claim exact beat alignment |
| BPM Sync ON + no BPM | Graceful documented reference free-run fallback with no fake music hit events |
| BPM Sync OFF | Free-run authored geometric cycle (e.g. 0.5 seconds per reference beat, equivalent to nominal 120 BPM), detached from analyzed beat phase; **not** audio-reactivity OFF |
| Global Audio Dock Sync disagrees | Apply one documented policy; recommended: preset timing toggle is authoritative for this preset's pattern motion while transport supplies musical facts; verify product policy |
| Pause | Freeze procedural motion and envelopes; no event advancement |
| Resume | Advance from valid track-time phase without time jump; do not retro-trigger events |
| Seek forward/back | Reconstruct state at playhead, clear stale event identity/envelopes, do not burst/switch spuriously |
| Loop | Reset or reconstruct phase and event guards deterministically; no once-only pattern starvation |
| Track change | Reset active runtime selection/impulses and do not leak old track's BPM/event IDs |
| Preset re-entry | Correct authored base restored, one controller only, GPU resources valid |
| BPM Sync toggle | Explicit phase rebase or short smooth transition, no huge visual teleport |

### Tempo handling caution

`Cinema2SyncedMotionClockResolver` in source scales elapsed seconds by BPM/120 and handles transport discontinuities; this is useful for continuous procedural time. For **beat-exact** row/column choreography, prefer canonical beat index+phase when available. Do not advance two separate clocks simultaneously. Either derive a unified phase per frame or choose one source with clearly bounded fallback. Prove ON/OFF difference at e.g. 148 BPM and fallback at no beat grid.

## Motion bounds / transitions

- Clamp rod tip Y above safe floor/occlusion plane and cap Y below mounting plane.
- Initial pattern selection may snap to a new base on explicit user choice (must be immediate), but smooth transitions between formations within a short bounded musical interval; never allow unsafe geometry overshoot.
- Define deterministic phase-origin after pattern change (e.g. `patternStartBeat` supplied by controller) rather than mixing unrelated absolute and relative phases.
- Motion Amount 0 is a hard geometry-motion disable; lighting/music accents can still function.
- Hard Camera Motion OFF always wins even if Auto Performance ON.

## Focused tests

1. Every pattern produces unique position vectors over multiple time samples.
2. Pattern Change OFF never advances on all 11 triggers.
3. Every 11 Trigger values advances only on its correct qualifying new event.
4. Manual Pattern selection while ON wins instantly and stays until next fresh event.
5. Same event ID processed twice advances once; repeated ID after seek does not spuriously advance.
6. Change Trigger or ON/OFF toggle with an already-live event does not advance.
7. Auto build/drop temporary override restores current underlying pattern.
8. BPM Sync ON and OFF differ at nonreference BPM, and both pause/seek/re-entry safely.
