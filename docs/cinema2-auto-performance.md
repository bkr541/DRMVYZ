# Cinema 2.0 Auto Performance

Every user-facing Cinema 2.0 performance preset has an **Auto Performance** toggle under **Design → Master Controls**. The runtime foundation, hidden diagnostics, and static reference scenes omit it. CHAMBER is a static reference with four empty Design groups. `Cinema2AutoPerformanceInventory.test.ts` enforces this distinction across the first-party catalog.

Auto Performance never changes authored values. It adds temporary, music-driven behavior on top of the preset's own reactions, and turning it off removes exactly that and nothing else: normal animation, existing audio reactions, BPM Sync and independently enabled Pattern Change and Trigger keep running.

## Master Controls placement

Cinema 2.0's shared Inspector projection puts the standard boolean **BPM Sync**
control followed by **Auto Performance** in the final two slots of Master
Controls, matching Glassfall. All other controls retain their authored relative
order. This presentation rule changes no parameter IDs, values, bindings,
persistence, musical behavior or other parent groups.

The catalog audit covered all 45 user-facing presets: 27 required reordering,
17 already matched, and War Of Worlds has no BPM Sync parameter; its existing
Auto Performance control remains last. Internal foundations/diagnostics have no
user-facing toggle requirement. Future registered presets are included in the
catalog-wide placement test automatically.

Validation: 46 catalog-order checks, 30 Auto Performance inventory/persistence
checks, the updated Electric Storm Inspector projection check, and focused
ESLint passed (77 focused tests). The broader Inspector suite also exposed its
unrelated jsdom `hidePopover` limitation; that production-selector case was not
changed or rerun. No production build was run for this ordering-only change.

## Inventory

**Already had the toggle (each keeps its own implementation, unchanged):** Submerge, Orbital, PSYLO, Glassfall, Ifrit, Inertia, Trippy Bro, Switch It, Nightshift, Blockshift, Atmosphere Reference (Crystalized), Afterhours, HUM:N, SAY IT, Depth, Conduit, ATL HOE, Marquee, Echoform, Echowave, Cathedral, Ancient Machine, Event Horizon, Constellation, Sixfold, Hypnotize, Starters, BWC, Canopy, Vacancy, Elevhate, Neon Forest.

**Received the toggle with this work (off by default):** Mainframe, Backstreet, the six 3D model previews (Form, Shatter, Dust, Hologram, Slices, Voxel), Electric Storm, Reactor, Threshold, GO-TO, Reliquary, War Of Worlds.

## Two implementations, chosen by how the preset is built

### Pattern substitution (Mainframe, Backstreet, the 3D model previews)

These presets run on the shared pattern controller (`Cinema2MainframePatternController`) with Pattern, Pattern Change and Trigger. Reference implementation: **BWC** (`Cinema2BwcAutoPerformance`). The shared `Cinema2PatternAutoPerformance` generalises its rules with two programs supplied by the preset:

| Preset | Build program | Drop program |
| --- | --- | --- |
| Mainframe, Backstreet | System Surge | Outward Bus, restarted from the drop |
| 3D FORM | Breathing Form | Rocking Plinth |
| 3D SHATTER | Rejoined Clusters | Radial Burst |
| 3D DUST | Compressed Mist | Twin Plumes |
| 3D HOLOGRAM | Scan Sweep | Signal Pulse |
| 3D SLICES | Collapsed Layers | Fan Sections |
| 3D VOXEL | Compact Blocks | Column Lift |

Rules: a confidently detected build puts the build program on stage while it charges (bounded at 32 beats); a new drop puts the drop program on stage for 8 beats, restarted from the drop; the base controller (authored Pattern, Pattern Change, Trigger) keeps running underneath, so what resumes already includes any advance. Choosing a Pattern during an override ends it at once and the build in progress is spent. Switching on mid-build does not yank the pattern, and drops are consumed whether or not they are used, so enabling later never replays one. Pause, stop, a seek back, a track change and switching off all release the override.

Signals are the shared ones: the build charge is `computeCinema2MainframeBuildCharge` (the Mainframe engine's own formula, now exported), and drops are the choreography engine's canonical drop identity (`Cinema2MainframeDropCoordinator` for Mainframe and Backstreet, the Afterhours trigger contract's drop for the model previews).

### Gated choreography rules (Electric Storm, Reactor, Threshold, GO-TO, Reliquary, War Of Worlds)

These presets' reactions are choreography rules. `withCinema2AutoPerformance` (`presets/Cinema2AutoPerformanceAuthoring.ts`) adds the toggle and four rules, each gated by `enabledParameter`, so with the toggle off they do not exist at runtime. They read the Visual Director's build and the engine's drop and downbeat events (once per event) and write only transient contributions through the shared target runtime. Reference implementations: the Cathedral and Event Horizon build/drop rules for extra accents, and each preset's own existing rules for what moves.

| Moment | Source | Electric Storm | Reactor | Threshold | GO-TO | Reliquary | War Of Worlds |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Build (continuous) | Director build | strike rate, branching | core contraction, build response | shafts, haze, floor glare | beams, key and side lights | haze beams, cue and spill lights | camera push-in |
| Pre-drop downbeats (build at least 0.7) | downbeat | strong strikes | refraction pulse | bloom, floor glare | beams | spill light | exposure |
| Drop | drop | hero barrage, shake, zoom punch | burst, shockwave, bloom flare | bloom, glare, shafts | beams, key, sides | beams, cues, spill | camera push, exposure flash |
| Every fourth bar | downbeat on a 4-bar boundary | strike-rate surge | slow shockwave | shaft swell | beam swell | beam swell | gentle push |

Rules scale by the preset's own reactivity or intensity control (Electric Storm Music Reactivity, Reactor Reactivity, Threshold Master Reactivity, GO-TO and Reliquary Master Intensity), so a control set to zero silences them. War Of Worlds has no such control: it is a static review scene, so Auto Performance only moves its camera and exposure, never the scene or its materials. Threshold, GO-TO and Reliquary deliberately leave the camera alone: Threshold's flight is authored without per-hit camera moves, and GO-TO's Motion Amount stays the only authority over its camera.

Switching the toggle off releases everything at once, including a pulse still in flight. A seek, loop or track change clears transient contributions through the engine's normal discontinuity reset.

## The shared Mood Conductor

Electric Storm, Depth and Mainframe also use the **Cinema 2.0 Mood Conductor** (`docs/cinema2-mood-conductor.md`): a shared reading of how the passage feels (calm, driving, tense, peak) and a decaying drop shock, from the Visual Director, used both to drive parameters continuously (`mood.*` choreography sources, gated by the same toggle) and to choose among a preset's own patterns on musical boundaries. It adds to, and never replaces, the gestures and programs described here. For Depth and Mainframe it also **chooses Pattern Change and Trigger** from the music (feel, build, drop impact, section progress, silence) instead of the saved values, which are never rewritten and apply again when the toggle is off; with no beat grid the saved values stand. The inspector shows what it is choosing under those two controls. In a silent stop the conductor's drives are pulled out by 90% and the beat-grid gestures (build, pre-drop downbeats, bar lift) and Depth's accents wait for sound (the `not-silent` condition); a drop is never gated.

## Saved settings

The preset revision is **not** bumped: saved parameter state is bound to the revision and would fail to restore. A state saved before the toggle existed restores with it at its authored default (off). Adding a parameter does change the serialized state the deterministic random seed is derived from, so tests that depend on a specific seeded outcome may need a different seed.

## The user's Auto Performance default (System Settings)

Settings > System Settings > **Auto Performance** has one toggle: the default for every Auto Performance toggle in the app. It is stored in `visualStore.autoPerformanceDefault` (off for a new install), synced to the account with the other System Settings, and published through `src/lib/autoPerformanceDefault.ts` so no engine imports a store. The setting wins on load: a toggle flipped by hand lasts until the app, preset or engine is loaded again.

- **Cinema 2.0:** `Cinema2ParameterState` replaces the authored default of every boolean tagged `moodPolicy: 'autoPerformance'`, or labelled "Auto Performance" (presets not migrated yet), with the user's value. That covers a new state, Reset and Reset All; `restore()` skips the saved value of that toggle, and a running preset follows a change through its `Cinema2Runtime` subscription.
- **CANVAS renderers and XY Scope:** `reactStore` applies it (`stores/autoPerformanceDefaultReact.ts`) to the ten CANVAS renderers, the six XY Scope instruments and the XY Scope parameter when the app hydrates, when a preset or engine is chosen, and when the setting changes.
- **Sound Drawing:** its toggle only works while a show is selected, so the default is applied when a show is chosen and when the setting changes while one is.

## Adding Auto Performance to a new preset

Use the pattern controller approach if the preset has Pattern, Pattern Change and Trigger; otherwise call `withCinema2AutoPerformance` with a `gestures` description. Either way: default off, `designParentGroup: 'master-controls'`, no new analyzers or drop detectors, and add the preset to the lists in `Cinema2AutoPerformanceInventory.test.ts` and the behavior tests.

## Tests

`Cinema2PatternAutoPerformance.test.ts` (controller and the Mainframe and Backstreet modules), `Cinema2UserModelAutoPerformance.test.ts` (the six previews), `Cinema2AutoPerformanceRules.test.ts` (the six rule-based presets, differentially against the preset without the toggle) and `Cinema2AutoPerformanceInventory.test.ts` (catalog guard, inspector placement, persistence and reset).

## The Auto Performance lock (Inspector)

While Auto Performance is on, a preset that has tagged its toggle (`moodPolicy: 'autoPerformance'`, done by `withCinema2AutoPerformance`, `withCinema2MoodDrives` and by hand in Depth, Mainframe and Ifrit) shows what the music is doing and does not let the user fight it. In the Design tab every control in Master Controls, Design and Effects is disabled and grayed in place, except the Auto Performance toggle and BPM Sync; the Palette stays editable; Reset Parameters is disabled; group headers still open and close. Saved values are shown unchanged, and where the music is moving a control its live readout and yellow marker stay visible. Turning Auto Performance off re-enables everything exactly as it was. Nothing changes size or position (checked in the real Inspector), and no visible text is added (the reason is a tooltip).

It is generic: `resolveCinema2AutoPerformanceLock` in `Cinema2InspectorModel.ts` decides, the panel (`Cinema2InspectorPanel.tsx`) renders it (`.rv-ctrl-lock`, `display: contents`) and also ignores edits to locked controls. BPM Sync is the preset's declared `choreography.tempoSyncParameter`, or the standard boolean Master Controls control of that label. A preset that has not tagged its toggle is not locked, so the lock reaches each preset as it is migrated (`docs/cinema2-mood-migration-plan.md`).

Tests: `Cinema2AutoPerformanceLock.test.ts` (the model for six tagged presets, opt-in and identification), `Cinema2AutoPerformanceLockUi.test.tsx` (the rendered control), and `node scripts/run-cinema2-lock-browser.mjs` (the real Inspector: what is disabled and editable, every control's position and size identical locked or not, and exact restoration).


## Full coverage: every numeric control takes part (2026-11-18)

With Auto Performance on, every numeric control in Master Controls, Design and Effects is moved by the music. The authored drives of each preset (above and in `cinema2-mood-conductor.md`) are the choreography; `presets/Cinema2AutoCoverage.ts` finishes the job for every control they did not reach. The catalog (`Cinema2FirstPartyPresetCatalog.ts`) passes every user-facing preset through it, so a new control is covered the moment it is added.

- **A control counts as covered** only when a rule gated by the preset's Auto Performance toggle moves the property it is bound to from a *continuous* source (the mood or the build). A drive that fires on a kick or a downbeat moves a control for an instant, so a control with only those is still given a mood drive.
- **Reach.** The drive goes to whatever the control is bound to: a module or effect property, a light's intensity, the environment's exposure and fog density, or a camera control (field of view, motion amount and speed, orbit radius, heading and elevation). The camera controls are new targets (`control.<name>` on the camera) that `Cinema2CameraRuntime` reads through the resolver, so the saved value is never rewritten and the inspector shows the live value like any other.
- **Role by name.** A speed follows how active the passage is; a glow, haze or reflection flares on a peak and a drop; a size or spread swells with the energy and settles in a calm passage; a surface quality eases the other way; Cinematic Finish opens up on energy. Amounts are fractions of the control's own range.
- **Zero stays off.** A control whose minimum is zero (a glow, a trail, a static layer, a camera lock-off) is *multiplied*, so a control the user set to zero is never switched on by the music. Everything else adds.
- **Never out of range.** Each control's drives are kept inside the headroom its authored value has, and a control already near a limit moves the other way. A test checks every preset at the strongest peak and the calmest passage.
- **Rule ids** are `<preset>-cover-drive-<source>`, so they are easy to tell from the mood drives (`-mood-`).

### What is still not moved, and why

`Cinema2AutoCoverage.test.ts` lists every numeric control left out, so nothing is skipped silently:

- **Authority controls** (Music Reactivity, Camera Motion on Say It, Master Intensity on GO-TO and others): they set how strongly the choreography acts, so they are the scale of the drives, not something the drives move.
- **Counts and seeds** (Frame, Blade, Satellite and Fragment counts on Ifrit, Laser Count, Element Count, Rows and Columns, Random Seed): changing them live would rebuild or reshuffle the scene.
- **Module changes still to make** (`Cinema2AutoCoverageExemptions.ts`, each with its reason): Blockshift's Block Size, Spread, Depth and Rotation Range (the module rebuilds the layout and treats a change as a manual edit); Say It, Orbital and Submerge's Tracking, Line Spacing and Glyph Scale (the text layout is rebuilt on every change); Canopy's spacing and rod controls (the rod structure is rebuilt); Light Strength and Fog Density on Neon Forest and PSYLO and City Atmosphere on ATL HOE (a rule maps the saved value, so there is no property to add to).

### Inspector policy spacing

Pattern Change and Trigger render live policy status only when a status is present. Manual mode and unavailable policy do not reserve blank lines. Active status uses its natural text height, retaining the shared field-value typography without clipping.
