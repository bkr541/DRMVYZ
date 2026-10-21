# 07. Tests, Deterministic Fixtures and Production Visual Acceptance

## Testing philosophy

Follow `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` §19–§20: a preset that compiles, returns pixels, passes unit tests or receives an Audio Intelligence frame is **not** complete. Its actual intended geometry and responses must be visible in the **production Cinema 2.0 canvas** and reviewed by a human.

## Proposed automated test files

| Target file | Tests |
|---|---|
| `src/components/vyzualz/cinema2/__tests__/Cinema2CanopyPreset.test.ts` | Registry keeper count, compile, module availability/version, caps, complete manifest references, Inspector parent hierarchy, Pattern/Change/Trigger order/types/conditions, color roles, saved values, visible consumers |
| `.../__tests__/Cinema2CanopyGeometry.test.ts` | Deterministic 8×8 topology, 4–12 axes and cap 144, stable fixture IDs, valid transforms, safe Y, aspect framing, six pattern distinctness + min/default/max physical geometry |
| `.../__tests__/Cinema2CanopyAudio.test.ts` | Audio fixture routing, event identities, all 11 triggers, deduplication, Pattern Change OFF/ON, manual Pattern while ON, no stale event; Sync ON/OFF; pause/seek/loop/re-entry/track changes; Auto authority |
| `.../__tests__/Cinema2CanopyNativeRendering.test.ts` | GL compile/buffers/resources, instanced draw calls, camera/depth requirement, GPU memory report, error handling, no per-rod lights, disposal/context recovery |
| `scripts/run-cinema2-canopy-browser.mjs` | Actual app production canvas render and pixel/scene-region changes, Inspector interactions, playback fixtures, resize, capture evidence |

Use test utils already available (`CinemaWebGLTestUtils`, Depth/Backstreet tests and existing browser harness patterns); do not invent a standalone visualizer and count it as production path.

## Case matrix and minimum evidence

| ID | Stimulus | Observe / assert | Evidence type |
|---|---|---|---|
| B01 | Load CANOPY with no audio | 64 suspended rods visible; caps readable; correct background, no false beat | Production screenshot + geometry count |
| B02 | 16:9, 1:1, 9:16 resize | No important tips/caps clipped; composition centered with depth | Three screenshots |
| C01 | All public controls min/default/max | Correct distinct physical, color, motion or effect change; no inert control | Automated Inspector + screenshot diff |
| C02 | Five color roles edited independently | Only intended semantic regions change; all five have real consumers | Five pairs of captures |
| C03 | BPM Sync toggle at 148 BPM | Sync phase/rate differs from OFF; other audio pulses still work | Trace + filmstrip |
| C04 | Pattern selection 6 values with Pattern Change OFF | Immediate six genuinely distinct geometry arrangements | Six captures at comparable time |
| C05 | Pattern Change OFF | Trigger is hidden and event stream never cycles | Parameter and active pattern trace |
| C06 | Pattern Change ON | Trigger appears with exactly 11 canonical options | UI + validation snapshot |
| T01 | Each canonical Trigger receives correct event | Exactly one advance per new qualified identity | 11 × deterministic fixtures |
| T02 | Repeat same event ID | No second advance or immediate repeat | Controller trace + render |
| T03 | Manual Pattern edit while ON, same active event | Manual pattern immediately visible, toggle stays ON, no stale auto advance | UI + production frames |
| T04 | Change Trigger or toggle ON with active event | No instant unintended switch | Controller trace |
| M01 | Advance 4+ frames while playing | Actual rod transforms and rendered pixels change | Motion filmstrip + numeric trace |
| A01 | Silence vs beat vs energetic bass | Real physical motion and light output differ | Equal-exposure screenshot comparison |
| A02 | Kick vs snare | Different fixture groups/geometry trajectories react | Event-timed captures |
| A03 | Build midpoint vs final build vs drop | Compression -> bounded physical release, not brightness alone | Sequence captures |
| A04 | Vocal section | Reduced density/glow while authored values remain visible | Captures + authority state |
| A05 | Phrase + section | Intended structure cue; no stale envelopes | Frames + event trace |
| O01 | Auto ON then manual Pattern edit | Immediate manual base; automation respects defined boundaries | UI + filmstrip |
| O02 | Temporary pattern override (only if implemented) | Override ends and restores current underlying base | Controller + screenshot |
| O03 | Hard control OFF (motion/intensity/camera/bloom) | Auto can't reenable disabled feature | Four captures |
| L01 | Play/pause/resume | Static on pause; correct resume, no catch-up pulse | Filmstrip |
| L02 | Seek forward/back, loop and replace track | Clears stale beat/drop/trigger state, deterministic placement | Timeline trace + captures |
| L03 | Leave CANOPY, select another keeper, return | No leaked old motion/texture/controller state; controls persist | App E2E + GPU/resource counters |
| L04 | WebGL context recreated / resize | Reinitialized buffers cleanly; no black frame | Harness result |
| P01 | Default and maximum supported fixture counts | No runaway draw calls/allocations; frame-time and GPU budget reported | Performance trace |
| F01 | Bloom OFF, nominal, max | Effect is optional and doesn't conceal rods | Three captures |
| H01 | Human review | Reviewer approves overall identity and musical timing | Signed review note |

## Deterministic Audio Intelligence fixture plan

Author fixture inputs via the real public frame shape in `Cinema2ModuleFrameReadContext`, following tests like `Cinema2DepthPreset.test.ts`:

- timeline `0–4s`: idle/silent with no source;
- `4–12s`: steady 120 BPM, sparse kicks/snares and bar boundaries;
- `12–20s`: bass-heavy 148 BPM pattern phase;
- `20–28s`: high vocal presence, reduced density;
- `28–32s`: buildProgress ramp 0→1 plus director build;
- `32s`: new drop identity with director impact, then energetic release;
- `36s`: new phrase and section boundary;
- `38s`: reverse seek to 10s (must reset);
- `40s`: loop wrap;
- `42s`: switch track ID and analysis generation;
- `44s`: pause, then resume;
- `46s`: switch Pattern and Trigger while current qualifying event is still present;
- `48s`: Auto ON/OFF and hard user-zero checks.

Construct **canonical** beat/bar indexes/IDs and analyzed moments in fixtures. Do not fabricate event detection inside CANOPY. Test with real analyzed track in production when available; fixture-only routing cannot replace human musicality sign-off.

## Pixel / perceptual tests

- Define hero region of interest using rod projected bounds so a bright background cannot falsely satisfy "visual exists".
- Compare fixed-exposure screenshots from production renderer (not log values) with appropriate structural/perceptual thresholds; don't demand exact pixels across unrelated GPU drivers.
- For six patterns, use geometry state/fixture transform distribution assertions plus frame captures; pure pixel difference alone might register light flicker without physical movement.
- Clamp test metrics to stable viewport, Dpr, seed, camera and preset parameter values.
- Ensure all four mandatory Palette colors, plus proposed fifth, can be modified independently and are not alias targets.
- Save sample render captures under a clearly named evidence folder (e.g. `artifacts/cinema2-canopy/`, **not required in source**). Never mark acceptance complete if these captures have not been produced.

## Production harness requirements

Model it on the existing scripts `run-cinema2-afterhours-browser.mjs` and `run-cinema2-atl-hoe-browser.mjs` in the updated ZIP. It must enter the **actual React Cinema 2.0 workspace**, select CANOPY, use the real Inspector, verify real render canvas and if available inject the same deterministic host Audio Intelligence fixture through supported test infrastructure. Avoid mock DOM controls that bypass target resolution. If the current browser harness cannot deliver audio fixtures, split a faithful production canvas visual test and an integration-style framed audio test, and state precisely which coverage remains unverified.

## Commands

Commands exist in reviewed `package.json`: `npm run typecheck`, `npm run build`, `npm run test`, `npm run test:e2e`, `npm run test:e2e:cinema2-afterhours`. For new tests:

```bash
npm run typecheck
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2CanopyPreset.test.ts   src/components/vyzualz/cinema2/__tests__/Cinema2CanopyGeometry.test.ts   src/components/vyzualz/cinema2/__tests__/Cinema2CanopyAudio.test.ts   src/components/vyzualz/cinema2/__tests__/Cinema2CanopyNativeRendering.test.ts
npm run build
# This command exists only AFTER creating the new harness:
node scripts/run-cinema2-canopy-browser.mjs
```

Existing browser scripts should be run as smoke/regression checks when CANOPY changes shared modules. Do not rerun full repo checks repeatedly when failures are already known unrelated, consistent with `AGENTS.md`.

## Human review worksheet

```text
Reviewer:
Build/ref:
Hero composition and depth (pass/fail):
Does it read as suspended rods, not a flat equalizer? (pass/fail):
Six unique physical patterns (pass/fail):
Idle vs steady beat vs kick/snare vs build/drop vs vocals (pass/fail):
Controls feel immediate, no auto fight (pass/fail):
BPM Sync ON vs OFF (pass/fail):
Palette colors independently legible (pass/fail):
16:9 / 1:1 / 9:16 safe framing (pass/fail):
Bloom OFF still strong visual? (pass/fail):
Motion smooth and not excessively busy? (pass/fail):
Approved screenshots / links:
Known visual compromises:
Final decision: APPROVE / REJECT
```
