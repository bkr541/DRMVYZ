# 04. Six native geometric patterns, BPM Sync and canonical Trigger behavior

## Pure per-tile model

For tile `(r,c)` at fixed base position, every pattern evaluates a **normalized bounded profile** `H(pattern,r,c,phase,focus)` (0–1) plus optional signed tilt angle within ±7°. Convert to world transform with `baseY + LiftRange * MotionAmount * H`, then apply any **additional bounded** musical envelope without exceeding the configured/hard physical maximum. Compute emission mask independently. No cumulative per-frame Y integration, random velocity, collision physics or time-dependent remapping of tile IDs. Color palette remains constant when switching patterns unless the user changes it.

## Required six original patterns

| Pattern / proposed enum ID | Geometric footprint and motion | Why visually distinct | Sound/shape role |
|---|---|---|---|
| **Checker Pulse** / `checkerPulse` | Alternating parity banks `(r+c)%2` rise in opposite on/off phases, with zero/small tilt | Whole floor flickers in an ordered black/bright checker relief | Beat and snare parity interplay; ideal default |
| **Center Ripple** / `centerRipple` | Circular ring of raised tiles expands from floor center, measured by grid distance from center; one or two trailing rings | Radial outline, not horizontal/diagonal bars | Kick wave origin; builds contract wave width |
| **Row Run** / `rowRun` | One or two entire tile rows rise and recede, traveling front-to-back over the full grid | Bold parallel transverse ridge | Bass/downbeat front-to-back choreography |
| **Diagonal Cut** / `diagonalCut` | Traveling ridge along constant `r+c` (with mirrored opposite diagonal variant at alternate phrase if enabled by authored design) | Oblique raised slash traverses floor | Snare/high-frequency directional motion |
| **Cross Axis** / `crossAxis` | Raised middle row and column form a crossing plus; pulses propagate to their endpoints, with four quadrants remaining low | A standing plus-sign geometry, not a sweep | Central energy and phrase emphasis |
| **Split Plane** / `splitPlane` | Left and right halves rise/tilt in opposing bounded shallow angles, briefly opening a central V groove; return to flat rest | Broad symmetrical hinged-panel silhouette, not individual tile waves | Build contraction and drop opening |

**Geometry requirement:** Each pattern must generate a detectably different per-tile transform field at meaningful non-identical phases, even with identical luminance, colors, camera and bloom OFF. A 6-way naming change applied to the same brightness wave is a hard FAIL.

### Pattern interpolation

- Use smooth cubic/sine/cosine envelopes with finite derivatives and defined start/end. Avoid abrupt 1-frame transform teleports at pattern switching.
- On manual selection: active base pattern changes **immediately** (first visual effect starts within same render update); optionally crossfade transform fields over ~0.12–0.25 sec or a bounded beat fraction, without delaying ownership. Visible base selection must not be swallowed by an already active event.
- Freeze on pause (without time creep), reconstruct or reset deterministic phase on seek, loop, analysis context replacement, track change, preset re-entry. No prior track envelope leaks.
- For a non-square 4×12 grid, normalize geometry coordinates and radial distance by actual row/column extent to retain the pattern silhouette; avoid row/col index division by zero.

## Canonical eleven Trigger values (reuse constant in application)

`CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` or an explicitly confirmed canonical successor is authoritative. The options are:

| Value | Label |
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

These determine **when** the base Pattern changes, not the geometry of each Pattern. Resolve a **new** event identity via shared existing helpers (`resolveCinema2MainframeTriggerEventIdentity` and/or the Afterhours resolver, according to accepted current signatures). Reuse `Cinema2MainframePatternController<LightfieldPattern>` or equivalent verified generic behavior with a deterministic no-repeat cycle.

## Pattern Change exact rules

- **OFF:** selected Pattern is the performing base, Trigger hidden; no event-driven cycling. Normal continuous kick/snare effects still run *inside* that pattern.
- **ON:** on a new selected Trigger event, advance to a different base pattern. Suppress duplicates for a single event ID and don't advance during paused/no-source state.
- **Manual Pattern while ON:** immediately make that new choice the base, **leave Pattern Change ON** and consume the already-active event identity so it cannot immediately undo the manual edit. Only the *next fresh* qualifying Trigger can advance again.
- **Change Trigger while ON:** preserve current base until a new event of the new kind; no auto-jump from stale event.
- **Toggle OFF → ON:** consume current in-flight event on toggle, preserve authored base, await new event.
- **Pause / seek / loop / track/context change / re-entry:** state resets/reconstructs consistently; no extra unexpected change from stale/duplicated events.
- **Auto Performance:** v1 explicitly does **not** replace the current Pattern. It only modulates bounded performance amplitude/intensity/optional camera with permission. Thus no temporary automatic Pattern override is needed. If added later, implement the strict contract for temporary build/drop override and restoring the underlying base.

## BPM Sync ownership and timing domains

Two domains must be distinguished:

1. **Pattern-change event selection:** always consumes shared detected musical Trigger events, independent of decorative clock toggles. Pattern Change OFF still gates this.
2. **Continuous pattern phase / wave propagation:** toggled by user-facing **BPM Sync**.

When BPM Sync is **ON**, use the shared transport/Audio Intelligence beat phase/grid when available to quantize pattern cycles (e.g., one ridge sweep every 4 shared beats at Motion Rate=1). If the available source offers BPM but not a verified grid, use supported tempo-scaled continuous time **and document it as tempo-following rather than beat-quantized**; do not invent local onset detectors. When BPM Sync is **OFF**, move using deliberate authored free-running seconds (e.g., one sweep every ~2.0 s at Motion Rate=1) while musical kick/snare/phrase events remain reactive.

`Cinema2SyncedMotionClockResolver` exists; its `requireHostSync` default composes preset Sync with host Audio Dock Sync. Before P4 decide and document the product-facing policy. Proposed LIGHTFIELD choice: `requireHostSync: false` for the continuous speed clock so this preset toggle is the explicit timing authority, subject to actual host semantics and tests. Do **not** let the toggle say ON while host quietly prevents visible synchronization. The helper scales elapsed time by BPM/120; it alone **does not** guarantee beat-exact boundary alignment. Validate at 100, 120 and 150 BPM and in a source with missing BPM (document sensible fallbacks).

Sync changes must preserve visual phase continuity or perform a deliberately safe boundary transition; no large single-frame pop. On seek/backward/discontinuity derive or reset from shared transport and current context instead of accumulating stale clocks. Pausing freezes simulation; resume continues from coherent phase.

## Example deterministic evaluation tests

- At phase 0.15, 0.45 and 0.8, inspect 8×8 displacement masks: six patterns must be observably different on geometry alone.
- Symmetry properties for Checker, Cross and Split; radial monotonic ring peak for Center; front-back row order for Row Run; diagonal index order for Diagonal.
- Motion Amount 0 gives identical transforms across time, while primary/secondary/accent color events still change emissive payload as allowed.
- Same fixture/source identity + same parameters + same transport position produces same transforms after re-entry, independent of frame processing order.
- Freeze/resume/seek/backward loop and manual Pattern Change ON with stale event identity is explicitly asserted.
