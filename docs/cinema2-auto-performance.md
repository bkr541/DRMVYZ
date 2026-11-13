# Cinema 2.0 Auto Performance

Every user-facing Cinema 2.0 preset has an **Auto Performance** toggle under **Design → Master Controls**. A preset is user-facing when it is not tagged `internal` (the runtime foundation, `reference-visual`, `spatial-reference` and `three-model-reference` are hidden diagnostics and have none). `Cinema2AutoPerformanceInventory.test.ts` enforces this for the whole first-party catalog, so a new preset cannot ship without it.

Auto Performance never changes authored values. It adds temporary, music-driven behavior on top of the preset's own reactions, and turning it off removes exactly that and nothing else: normal animation, existing audio reactions, BPM Sync and independently enabled Pattern Change and Trigger keep running.

## Inventory

**Already had the toggle (each keeps its own implementation, unchanged):** Submerge, Orbital, PSYLO, Glassfall, Ifrit, Inertia, Trippy Bro, Switch It, Nightshift, Blockshift, Atmosphere Reference (Crystalized), Afterhours, HUM:N, SAY IT, Depth, Conduit, ATL HOE, Marquee, Echoform, Echowave, Cathedral, Ancient Machine, Event Horizon, Constellation, Sixfold, Hypnotize, Starters, BWC, Canopy, Vacancy, Elevhate.

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

## Saved settings

The preset revision is **not** bumped: saved parameter state is bound to the revision and would fail to restore. A state saved before the toggle existed restores with it at its authored default (off). Adding a parameter does change the serialized state the deterministic random seed is derived from, so tests that depend on a specific seeded outcome may need a different seed.

## Adding Auto Performance to a new preset

Use the pattern controller approach if the preset has Pattern, Pattern Change and Trigger; otherwise call `withCinema2AutoPerformance` with a `gestures` description. Either way: default off, `designParentGroup: 'master-controls'`, no new analyzers or drop detectors, and add the preset to the lists in `Cinema2AutoPerformanceInventory.test.ts` and the behavior tests.

## Tests

`Cinema2PatternAutoPerformance.test.ts` (controller and the Mainframe and Backstreet modules), `Cinema2UserModelAutoPerformance.test.ts` (the six previews), `Cinema2AutoPerformanceRules.test.ts` (the six rule-based presets, differentially against the preset without the toggle) and `Cinema2AutoPerformanceInventory.test.ts` (catalog guard, inspector placement, persistence and reset).
