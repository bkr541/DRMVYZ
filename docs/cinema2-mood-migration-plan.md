# Cinema 2.0 migration to the shared Mood Conductor and Auto Performance enhancements

Audit of every first-party preset (50 declarations: 4 internal references with no Auto Performance, 4 already migrated, 8 deliberately skipped, 34 to migrate). Produced by reading each manifest and its module code; no preset was changed. The contract is `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`.

**Skipped by decision:** War Of Worlds (a preview), the six 3D model previews (Form, Shatter, Dust, Hologram, Slices, Voxel) and BWC (it may be removed). They keep their current Auto Performance unchanged. If BWC is kept, it joins Batch 2 (it uses the Mainframe pattern controller); the previews, if ever wanted, are one code path (`Cinema2ThreeSceneModule`).

## Findings that affect the plan

1. **46 user-facing presets, 4 migrated** (Electric Storm, Depth, Mainframe, Ifrit), 8 skipped, 34 to migrate. Each has an Auto Performance toggle in Master Controls.
2. **Three kinds of Auto Performance exist today.** (a) Gated choreography rules (`withCinema2AutoPerformance`; for example Submerge 15 rules, Glassfall 12, Cathedral 9). (b) A pattern controller in the module that substitutes builds and drops (Mainframe, Backstreet, Echoform). (c) Auto Performance in module code with no gated rules at all. **15 of the 34 remaining presets have no gated Auto Performance rules** (ATL HOE, Backstreet, Conduit, Sixfold, Switch It, Inertia, Vacancy, Marquee, PSYLO, Neon Forest, Nightshift, Blockshift, Trippy Bro, Elevhate, Atmosphere Reference), so silence and Pattern Change handling must be added in module code for them, not as rules.
3. **28 of the 34 remaining presets have Pattern Change and Trigger, and all 28 already offer the full canonical 11-option Trigger list**, including the five values the music chooses between, so no preset needs a Trigger list change. Six remaining presets have no Pattern Change at all (Reactor, Threshold, GO-TO, Reliquary, HUM:N, Starters; Electric Storm, already migrated, is the seventh): they take the Auto Performance-tag-only path.
4. **Three trigger mechanisms in the modules.** The Afterhours trigger-id helper (Afterhours, Ancient Machine, Blockshift, Cathedral, Constellation, Event Horizon, Say It, Sixfold, Trippy Bro), the shared Mainframe pattern controller (Backstreet, Canopy, Echoform, Switch It and the Afterhours-family looks), and bespoke performance classes using the same helper (Glassfall, Inertia, Marquee, Neon Forest, Nightshift, PSYLO, Vacancy). Every one takes the saved trigger and pattern-change values in one place, so the resolver goes there.
5. **16 of the 34 default Auto Performance to ON** (Submerge, Orbital, HUM:N, Say It, Conduit, ATL HOE, Marquee, Echoform, Echowave, Cathedral, Ancient Machine, Event Horizon, Constellation, Sixfold, Hypnotize, Starters). Under the planned lock these would start with Design and Effects grayed. Depth was changed to default off; the same decision is needed for these. **Resolved (2026-11-17):** System Settings > Auto Performance now sets one default for every preset's toggle (off for a new install), overriding the authored defaults.
6. **Contract placement problems that exist today** (independent of the mood work): the Pattern controls are in the Effects group, not Design, for 10 presets (Orbital, Say It, Backstreet, Echoform, Echowave, Cathedral, Ancient Machine, Event Horizon, Constellation, Sixfold), and Afterhours has Trigger in Effects. Moving them is a parameter-group change only (ids and saved settings are unaffected); it is cheap to do inside each preset's batch.
7. **Pattern naming and count problems** against Section 9 (a dropdown labeled exactly Pattern with at least six patterns): Cathedral calls it Light Program (5 options), Ancient Machine calls it Machine Look (3 options), Event Horizon and Constellation use their own look selectors, and Atmosphere Reference has 4 patterns. These need a decision (rename, add options, or an exemption) and are listed per batch.
8. **Interim manual-edit rules** (`userEditSetParameters` turning Auto Performance off when a pattern is picked) exist in several of these presets (Ancient Machine for one). They become unnecessary once the shared lock ships.
9. **Camera.** Most remaining presets have camera controls (`motionAmount`, `motionSafety`, orbit and FOV controls). Mood can scale only what is bound to a module or effect target, not a camera control, so camera movement is not driven in the first pass.
10. **Pre-existing failing tests** (10 files in the cinema2 suite) fail the same way on a clean checkout and are not affected by migration; each batch is compared against that list.

## Prerequisites (Batch 0)

1. **Auto Performance lock: DONE** (built and verified in the real Inspector; opt-in by tagging the toggle, which the migrated presets already do). (Design and Effects disabled and grayed while Auto Performance is on; Palette, Auto Performance and BPM Sync stay editable; no collapse; Reset Parameters disabled). The contract requires it and every migrated preset needs it for its tests.
2. **Decide the default** for the 16 presets that default Auto Performance on.
3. **Allow the Auto Performance tag alone** in the authoring helper `withCinema2AutoPerformance` (done for the compiler; the helper itself should tag the toggle), so rule-based presets are identified by the lock without Pattern controls.
4. **A reusable migration test**: a parameterized twin test (Auto Performance on and off on the same music) that checks drives, silence, bounds, saved values never rewritten, tags compile, and the live readout.
5. **Decide the Section 9 exemption** for presets with no patterns (6 remaining, plus Electric Storm).

## Per-batch checklist

For every preset: adopt `withCinema2MoodDrives` (or the `mood` list on `withCinema2AutoPerformance`) with drives across Design and Effects bound to user-facing controls; add the `moodPolicy` tags (all three where it has Pattern Change and Trigger, `autoPerformance` alone otherwise); add `Cinema2PatternControlResolver` where the module reads Pattern Change or Trigger and act on the effective values; add `not-silent` to beat-grid accents or the equivalent in module code; move Pattern controls into Design where needed; run the twin differential test; compile; then the focused suite. After each batch: full cinema2 run compared with the 10 known failing files, one real-app check by you on one or two presets, and a single commit.

## Batches

### Batch 1A: Rule-based Auto Performance, no patterns, default off (4) — DONE (uncommitted; awaiting your real-app check)

Lowest risk. Electric Storm is the working example: add a `mood` drive list to `withCinema2AutoPerformance`, tag only the Auto Performance toggle, add `not-silent` where beat-grid gestures exist. GO-TO and Reliquary run on the shared three-scene module but their Auto Performance is rule-based, so this is still the same change.

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| reactor | reactor | off | none | - | 4 | 10 | no Pattern Change (tag-only) |
| threshold | threshold | off | none | - | 4 | 10 | no Pattern Change (tag-only); camera controls |
| go-to | three-scene | off | none | - | 4 | 14 | no Pattern Change (tag-only); camera controls |
| reliquary | three-scene | off | none | - | 4 | 11 | no Pattern Change (tag-only) |

### Batch 1B: Rule-based Auto Performance, no patterns, default ON (2) — DONE (uncommitted; awaiting your real-app check)

Same work as 1A, but both default Auto Performance on, so they are the first to meet the lock and the default decision.

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| hum-n | hum-n | on | none | - | 6 | 11 | default on; no Pattern Change (tag-only); camera controls |
| starters | starters | on | none | - | 7 | 16 | default on; no Pattern Change (tag-only) |

### Batch 2: Pattern controller family (Mainframe pattern controller) (5) — DONE (uncommitted; awaiting your real-app check)

Same controller class as Mainframe and Backstreet: add the resolver, tags and drives. Echoform and Echowave are twins. Backstreet, Echoform and Echowave have their pattern controls in Effects.

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| backstreet | backstreet | off | effects; Pattern (6) | 11 options | 0 | 3 | move to Design |
| echoform | echoform | on | effects; Pattern (6) | 11 options | 2 | 11 | move to Design; default on; camera controls |
| echowave | echowave | on | effects; Pattern (6) | 11 options | 2 | 11 | move to Design; default on; camera controls |
| switch-it | switch-it | off | design; Pattern (6) | 11 options | 0 | 14 |  |
| canopy | canopy | off | design; Pattern (6) | 11 options | 1 | 14 | camera controls |

### Batch 3A: Afterhours-family looks and programs, default ON (4) — DONE (uncommitted; Event Horizon was done earlier with its galaxy upgrade)

Selector names and counts were kept as they are (Machine Look 3, Light Program 5, Constellation Look 12, Horizon Look 3): the pattern controls moved to Design and the music chooses them, with no rename or new options. Hypnotize and Sixfold derive from Constellation's manifest, so they now derive from its authored manifest (without the mood drives) until they are migrated in Batches 3B and 5.

Use the Afterhours trigger helper plus a program controller. All four default Auto Performance on, have their pattern controls in Effects, and name the selector something other than Pattern (Machine Look has 3 options).

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| ancient-machine | ancient-machine | on | effects; selector not named Pattern | 11 options | 9 | 11 | move to Design; look selector, check count and name; default on; camera controls |
| cathedral | cathedral | on | effects; Light Program (5) | 11 options | 9 | 10 | move to Design; rename to Pattern; fewer than 6 patterns; default on; camera controls |
| event-horizon | event-horizon | on | **DONE out of order (uncommitted), 2026-11-17** | 3 looks (kept: Horizon Look) | 12 | - | pattern controls moved to Design; galaxy (space.glb) replaces the procedural stars; Camera Mode Orbit / Fly Through / Deep Space; see docs/cinema2-event-horizon-galaxy.md |
| constellation | constellation | on | effects; selector not named Pattern | 11 options | 9 | 17 | move to Design; look selector, check count and name; default on; camera controls |

### Batch 3B: Afterhours-family patterns (4) — DONE (uncommitted; awaiting your real-app check)

Orbital and Submerge derive from Say It's manifest (a string rewrite), so they now derive from its authored manifest (before the mood migration) until Batch 5. Say It's own changes (Pattern controls to Design, the module reading the Auto Performance toggle) are applied as a transform on top of the authored manifest for that reason.

Same trigger helper. Say It and Sixfold default on and have their controls in Effects; Blockshift and Trippy Bro default off.

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| say-it | say-it | on | effects; Pattern (6) | 11 options | 11 | 19 | move to Design; default on |
| sixfold | sixfold | on | effects; Pattern (6) | 11 options | 0 | 17 | move to Design; default on; camera controls |
| blockshift | blockshift | off | design; Pattern (6) | 11 options | 0 | 13 | camera controls |
| trippy-bro | trippy-bro | off | design; Pattern (8) | 11 options | 0 | 12 |  |

### Batch 4A: Bespoke performance classes, native-render family (4) — DONE (uncommitted; awaiting your real-app check)

PSYLO, Neon Forest and Nightshift keep their manual-edit check on the *saved* Pattern, Pattern Change and Trigger, so the music's choice never counts as a manual edit and cancels their own Auto Performance.

Each has its own performance class and trigger logic. Do one at a time inside the batch.

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| inertia | inertia | off | design; Pattern (6) | 11 options | 0 | 13 |  |
| nightshift | nightshift | off | design; Pattern (8) | 11 options | 0 | 12 | camera controls |
| psylo | psylo | off | design; Pattern (8) | 11 options | 0 | 19 | camera controls |
| neon-forest | neon-forest | off | design; Pattern (8) | 11 options | 0 | 21 | camera controls |

### Batch 4B: Bespoke performance classes, others (3) — DONE (uncommitted; awaiting your real-app check)

Glassfall's Bloom and Reflection Strength are not driven (the preset states that automation cannot change them), and Vacancy leaves the screens themselves (Static, Scanlines, media) to the user.

Own timelines and audio files; Glassfall has the heaviest existing Auto Performance (12 gated rules).

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| glassfall | glassfall | off | design; Pattern (6) | 11 options | 12 | 10 |  |
| vacancy | vacancy | off | design; Pattern (8) | 11 options | 0 | 13 | camera controls |
| marquee | marquee | on | design; Pattern (7) | 11 options | 0 | 13 | default on; camera controls |

### Batch 5: Special cases, one at a time (8)

Each has something unusual: Afterhours has 39 patterns and a show planner; Hypnotize its own pattern engine; Orbital and Submerge are default on with different module wiring; Conduit's module reads nothing from Pattern/Trigger; Elevhate has its own performance class; Atmosphere Reference has only 4 patterns; ATL HOE is default on and has its own pattern controller on the shared three-scene module.

| Preset | Module | Auto Performance (default) | Pattern controls | Trigger list | Gated AP rules | Drive candidates | Notes |
|---|---|---|---|---|---|---|---|
| afterhours | afterhours | off | design; Pattern (39) | 11 options | 7 | 9 |  |
| hypnotize | hypnotize | on | design; Pattern (6) | 11 options | 3 | 22 | default on; camera controls |
| orbital | orbital | on | effects; Pattern (6) | 11 options | 14 | 17 | move to Design; default on |
| submerge | submerge | on | design; Pattern (6) | 11 options | 15 | 23 | default on |
| conduit | conduit | on | design; Pattern (6) | 11 options | 0 | 6 | default on; camera controls |
| elevhate | elevhate | off | design; Pattern (6) | 11 options | 0 | 8 | camera controls |
| atmosphere-reference | crystalized | off | design; Pattern (4) | 11 options | 0 | 15 | fewer than 6 patterns; camera controls |
| atl-hoe | three-scene | on | design; Pattern (6) | 11 options | 0 | 8 | default on; camera controls |

### Already migrated

Electric Storm, Depth, Mainframe, Ifrit, and (Batch 1A) Reactor, Threshold, GO-TO, Reliquary, and (Batch 1B) HUM:N, Starters.

### Skipped by decision

war-of-worlds (a preview), user-model-form (model preview), user-model-shatter (model preview), user-model-dust (model preview), user-model-hologram (model preview), user-model-slices (model preview), user-model-voxel (model preview), bwc (may be removed entirely).

### Not migrated (no Auto Performance)

Runtime foundation, Reference Visual, Spatial Reference, Three Model Reference (internal diagnostics).

## Order and rationale

1A and 1B first (one working example, no patterns, no module changes), then 2 (one controller class across five presets), then 3A and 3B (the Afterhours family, which also needs the naming decisions), then 4A and 4B (bespoke classes, one at a time), then 5 (special cases). A batch starts only after the previous one has been checked in the app. Batch 0 should finish before Batch 1B, because those two default Auto Performance on.
