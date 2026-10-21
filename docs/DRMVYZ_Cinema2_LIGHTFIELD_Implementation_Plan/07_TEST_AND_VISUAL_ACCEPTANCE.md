# 07. Test plan, deterministic fixtures, production-path pixel proof

## Evidence labels

- **UNIT:** pure geometry/timing/authority and resource tests.
- **INTEGRATION:** existing manifest authoring/compiler/registry/target resolution and audio/choreography wiring.
- **BROWSER:** actual production Cinema 2.0 render canvas, with screenshots/cropped ROI or filmstrips. A mock canvas/shader snapshot alone is not sufficient.
- **HUMAN:** signed-off visual and musical review. Pixel differences cannot prove that the desired floor aesthetic was achieved.

Test names below are **suggestions** for files the coding agent will create. They are not preexisting test suites. Confirm current Vitest/browser tooling and scripts from the live repo.

## Minimum acceptance matrix

| Test ID | Level | Fixture/action | Hard pass criterion |
|---|---|---|---|
| LF-001 | UNIT | 4×4, 8×8, 12×12, 4×12 topology | Unique row-major IDs, correct count 16/64/144/48, bounded dimension/matrices |
| LF-002 | INTEGRATION | Manifest compile, keeper registration, module version lookup | No diagnostics, unique schema IDs/refs, valid render graph and real module type |
| LF-003 | BROWSER + HUMAN | Idle, no audio, bloom OFF | Floor slabs, inset lights, gaps, depth and perspective visible and composition approved |
| LF-004 | BROWSER | 16:9 / 1:1 / 9:16 + resize | Entire floor stays within intended safe padding, no incorrect clipping/overlap |
| LF-005 | BROWSER | Set Rows/Columns, Size/Gap/Thickness min/default/max | Correct geometry/count/property visibly changes, no repeated stale instances |
| LF-006 | INTEGRATION + BROWSER | Verify four top-level parent groups and controls | Every UI parameter nested under Design > one of Master Controls/Design/Effects/Palette; no placebo |
| LF-007 | INTEGRATION + BROWSER | Pattern trio control inspection | Pattern enum + Pattern Change boolean OFF + conditional Trigger enum ordered within Design > Design |
| LF-008 | INTEGRATION | Trigger visible ON, hidden OFF and selection persisted | Exact **11 canonical** values/labels/meaning unchanged |
| LF-009 | UNIT + BROWSER | Every Pattern same palette, bloom OFF at 3 phases | Six visibly distinct **geometry transform** signatures, not merely emissions |
| LF-010 | INTEGRATION + BROWSER | Pattern Change OFF, feed repeated events | Base remains fixed; ordinary audio still modulates selected pattern |
| LF-011 | INTEGRATION + BROWSER | ON, issue one event + duplicate same ID + second fresh ID | Exactly one advance per fresh event, no accidental repetition |
| LF-012 | INTEGRATION + BROWSER | Manual Pattern edit during ON while same event active | Immediate new base, toggle stays ON, no instant reversion, next fresh Trigger advances |
| LF-013 | BROWSER + UNIT | BPM Sync ON/OFF at 100/120/150 BPM | Governed continuous pattern phase changes appropriately, musical event accents remain; no stale phase at toggle |
| LF-014 | INTEGRATION + BROWSER | Five Palette colors changed individually | Five independent real roles; A/B/Accent simultaneously legible; no aliases |
| LF-015 | BROWSER | Master Intensity 0, Motion Amount 0, Camera Motion OFF, Bloom 0 | Hard lock remains authoritative even on drop/Auto; fixture dark where expected |
| LF-016 | INTEGRATION + BROWSER | Silence → low energy → high energy | Distinct steady-motion/emission output; no fabricated beats |
| LF-017 | INTEGRATION + BROWSER | Kick-only versus snare-only fixtures | Different spatial/temporal outcome; correctly timed and bounded |
| LF-018 | INTEGRATION + BROWSER | Vocal versus nonvocal | Visible, temporary restraint; user pattern/colors not replaced |
| LF-019 | INTEGRATION + BROWSER | Build midpoint, final build, drop, phrase/section | Bounded contraction/release, structural variation without unauthorized pattern change |
| LF-020 | UNIT + INTEGRATION | All Trigger options incl beat2, bar4, bar8, phrase, drop | Qualifying shared event source used, no private detector, correct edge behavior |
| LF-021 | UNIT + BROWSER | Pause, resume, seek, loop, track change, analysis replacement | No stale burst, duplicate Trigger or uncontrolled time drift |
| LF-022 | INTEGRATION + BROWSER | Leave preset and re-enter repeatedly | No resource leak/stuck buffer, persisted user settings valid, music reactivity resumes |
| LF-023 | BROWSER + HUMAN | Bloom OFF, normal, max; optional camera OFF/ON | Geometry still legible bloom OFF; finishing doesn't conceal base failures |
| LF-024 | UNIT + BROWSER | Auto Performance OFF/ON and manual edits during drop | Only approved bounded macro effects, hard locks and manual authority preserved |
| LF-025 | INTEGRATION | GPU resources, draw count and context lifecycle | No per-tile lights, no per-frame allocations/program compile, real dispose and byte reporting |
| LF-026 | HUMAN | Hero composition and 6-pattern filmstrip review | Viewer recognizes restrained perspective LED floor and distinct choreography, approves movement quality |

## Deterministic audio fixture catalog

1. **No source:** audio=null, transport paused/not active. Expected static or explicitly authored subtle idle state.
2. **Quiet verse:** low sub/bass and intermittent soft transients. Expected mostly low, quiet tile field.
3. **Four-on-floor:** recurring shared beats/kicks with validated event IDs. Expected crisp pulses and correct pattern timing.
4. **Snare hits:** on backbeats, separate from kick. Expected diagonal/alternate accents and shorter decay.
5. **Bass sustain:** continuous low-end high / transient low. Expected spatial lift bias and emission, not fake kick pulses.
6. **High/shimmer section:** highs prominent, bass low. Expected narrow edge/inset emphasis.
7. **Vocal passage:** high vocal presence. Expected modest secondary/lift restraint only.
8. **Build:** build fraction around 0.5 then 0.9; no drop yet. Expected controlled height/spacing tension within bounds.
9. **Drop:** one unique shared drop event plus high energy. Expected synchronized controlled outward release and accent, not full-white frame.
10. **Phrase/section:** new qualifying shared event identity. Expected structural cue and optional Pattern Change if Trigger=phrase; OFF prevents switches.

Fixtures must be adapted to **actual** source types (`Cinema2ModuleFrameReadContext`, audio bridge frame etc.). Do not invent property paths to force a test. Use shared analyzer fixtures when available, plus one real analyzed track in production.

## Browser proof procedure

- Build/open *actual* production React Cinema 2.0 canvas. Keep identical viewport and camera for apples-to-apples frames; verify display/input path routes through selected keeper manifest.
- Capture a **baseline PNG** at idle with bloom OFF, and per-Pattern **4-frame contact sheets** at quarter-cycle positions. Include screenshots of Inspector controls in correct groups.
- For **controls**: set min/default/max, capture target ROI (center/edge/tile base/empty background), attach perceptual explanation; for color roles set strongly distinct test colors and keep other roles fixed.
- For **timing**: record host transport time, BPM, sync state, selected Pattern/Trigger, shared event ID, frame ID and per-tile transform summaries. Corresponding videos/frames must match.
- For **audio**: capture before/after with exact event timestamps and region overlays. Visual difference alone is not enough: show the *correct region and property* changed.
- For **re-entry**: measure inspection counts, GPU bytes, GL errors before/after repeated switches. Preserve saved authored selection with no stale event envelopes.
- Keep capture artifacts and code/tests separate from this planning ZIP; produce them during implementation and list paths + commit/PR references in `09_RELEASE_GATE.md`.

## Human review questions

Does LIGHTFIELD read as a deliberate sculptural illuminated floor when bloom is OFF? Do the six patterns have a recognizable geometric personality? Is the floor stable in narrow portrait view? Do kicks/snares/build/drop feel linked to music instead of unrelated animation? Can every Inspector control be understood by the **visible** outcome? If any answer is no, fail the gate regardless of green TypeScript/unit tests.
