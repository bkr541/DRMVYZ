# ATL HOE: Production Complexity Upgrade Guide

**Status:** In progress — fixes 1–6 implemented and focused validation complete

**Scope:** Upgrade the existing Cinema 2.0 `ATL HOE` preset without replacing its approved Atlanta/Waffle House art direction.  
**Order:** The ten work packages below are dependency ordered. Do not begin a later package until the preceding package's acceptance gate passes.

## Goal

Turn ATL HOE from a mostly static city diorama with grouped emissive reactions into a topology-aware, full-scene musical performance. The finished preset should have the authored depth, independent component behavior, musical interpretation, transition quality, and production validation found in Mainframe and CONDUIT while retaining ATL HOE's own visual identity.

This guide does **not** require ATL HOE to copy Mainframe's circuit-board appearance or CONDUIT's chamber. It requires comparable implementation depth:

- geometry that carries semantic performance data;
- six visually distinct full-scene programs;
- independent but coordinated sign, city, road, sky, atmosphere, and camera systems;
- stateful, confidence-aware audio interpretation;
- physically convincing reactive light spill;
- production validation with real music.

## Current implementation baseline

- Preset manifest and render stack: `src/components/vyzualz/cinema2/presets/Cinema2AtlHoePreset.ts`
- Controls, palette bindings, and current choreography: `src/components/vyzualz/cinema2/presets/Cinema2AtlHoeDesign.ts`
- Shared part inventory: `src/components/vyzualz/cinema2/presets/atlHoeParts.json`
- Model generator: `scripts/cinema2-assets/generate-atl-hoe.mjs`
- Current asset: `public/cinema2/models/atl-hoe.glb`
- Current tests: `Cinema2AtlHoePreset.test.ts`, `Cinema2AtlHoeDesign.test.ts`, and `Cinema2AtlHoeBehavior.test.ts`
- Existing browser validation entry point: `scripts/run-cinema2-atl-hoe-browser.mjs`

The current asset is approximately 74,000 triangles. Its reactions primarily target `<part>.emissiveIntensity` through generic choreography rules. That system can remain available for static material controls, but it must no longer be the primary performance engine.

## Proposed runtime architecture

Create an ATL HOE-specific runtime rather than continuing to expand a large list of generic per-part envelopes.

Recommended new files:

- `src/components/vyzualz/cinema2/modules/Cinema2AtlHoeNativeModule.ts`
- `src/components/vyzualz/cinema2/modules/atlHoe/Cinema2AtlHoeTopology.ts`
- `src/components/vyzualz/cinema2/modules/atlHoe/Cinema2AtlHoePatternEngine.ts`
- `src/components/vyzualz/cinema2/modules/atlHoe/Cinema2AtlHoePatternController.ts`
- `src/components/vyzualz/cinema2/modules/atlHoe/Cinema2AtlHoeMusicAdapter.ts`
- `src/components/vyzualz/cinema2/modules/atlHoe/Cinema2AtlHoeLighting.ts`
- Focused tests matching each file under `src/components/vyzualz/cinema2/__tests__/`

The native module should reuse the shared Cinema 2.0 context, asset cache, camera, lighting, choreography delivery, diagnostics, and Three.js bridge. It must not create a second renderer, canvas, animation loop, audio analyzer, or private beat detector.

---

## 1. Add semantic lighting topology

### Objective

Give every performance-capable surface a stable musical identity and spatial position so patterns can travel through the actual city rather than stepping through arbitrary material arrays.

### Required code changes

1. Extend `scripts/cinema2-assets/generate-atl-hoe.mjs` to write custom per-vertex attributes on reactive geometry:

   - `_ATL_ROLE`: sign, windows, crown, spire, streetlight, road, star, lightning, foliage accent, or atmosphere proxy.
   - `_ATL_ZONE`: stable screen/world zone such as far-left, left, center-left, center, center-right, right, or far-right.
   - `_ATL_ROUTE`: a stable logical route connecting sign cells, road lamps, buildings, crowns, and sky landmarks.
   - `_ATL_PHASE`: normalized progress along the assigned route or vertical building climb.
   - `_ATL_LEVEL`: normalized building floor/window-row height.
   - `_ATL_RANDOM`: stable seeded identity used for deterministic flicker and sparse selection.

2. Stop using material-part order as spatial meaning. Add an explicit topology contract in `Cinema2AtlHoeTopology.ts` containing role, zone, route, and landmark enums plus attribute names and validation.

3. Preserve the new attributes through GLB generation and asset loading. Reuse the optional custom-attribute support in `scripts/cinema2-assets/cinema2-tube-kit.mjs` rather than creating another exporter.

4. Add an ATL HOE shader path to `Cinema2ThreeSceneBridge.ts`, parallel to its Mainframe and segment-lighting paths:

   - add an `atlHoe` semantic-role configuration;
   - validate that required attributes exist before enabling the shader;
   - install shared ATL HOE uniforms once per material family;
   - evaluate illumination on the GPU without creating one material or draw call per window.

5. Update `atlHoeParts.json` so it remains the material and visibility inventory, while the new topology contract becomes the authoritative source for spatial choreography.

6. Add generator and bridge tests that reject missing, invalid, or out-of-range topology attributes.

### Checklist

- [x] Every sign face has a stable cell index and row identity.
- [x] Every building window group has a building, floor/level, horizontal zone, route, and random identity.
- [x] Every streetlight has an individual position along the road.
- [x] Every crown and spire has a landmark and vertical phase.
- [x] Stars and lightning have stable sky zones and identities.
- [x] The bridge renders the approved static frame when topology strength is zero.
- [x] Semantic lighting does not increase draw calls in proportion to the number of windows.

### Acceptance gate

Render a diagnostic mode for each role, zone, route, and phase. A reviewer must be able to identify the intended city pathway from the diagnostic colors alone. The normal zero-reactivity frame must remain visually equivalent to the approved baseline.

---

## 2. Replace brightness variations with six distinct full-scene programs

### Objective

Replace the current four sign-centric brightness sequences with six programs that have different spatial logic, timing, component ownership, negative space, and drop behavior.

### Required code changes

1. Define six pattern IDs in `Cinema2AtlHoePatternEngine.ts`. Recommended production set:

   1. `city-pulse` — grounded pulse behavior, with sign, road, windows, and crowns assigned different frequency/event responsibilities.
   2. `waffle-marquee` — sign-cell chase that hands energy into streetlights and receives a skyline response.
   3. `interstate-flow` — road and lamp routes travel across the foreground before feeding vertical building climbs.
   4. `skyline-rise` — window floors climb individual buildings, resolve at crowns, then echo through the sign.
   5. `neon-brownout` — deterministic local outages, asynchronous recovery, and protected focal elements rather than uniform random dimming.
   6. `storm-takeover` — staged sky darkening, lightning, city power response, sign interruption, environmental flash, and recovery.

2. Return one immutable per-frame state containing, at minimum:

   - route fronts and widths;
   - zone weights;
   - role/system gains;
   - building-level climb position;
   - sign-cell selection;
   - outage/recovery masks;
   - sky and lightning state;
   - environmental and practical-light gains;
   - transition weights for the outgoing and incoming programs.

3. Move program timing out of `atlHoeChoreographyRules`. Keep generic choreography rules for engine-owned cue delivery and simple effect/light envelopes, but let `Cinema2AtlHoePatternEngine` own persistent and multi-stage behavior.

4. Add deterministic pattern evaluation tests at multiple beats, sections, and event states. Assert spatial differences, not merely different aggregate brightness.

5. Crossfade pattern state over approximately 0.3–0.6 seconds. Do not snap every surface to a new program on selection.

### Checklist

- [x] Exactly six full-scene program IDs are exposed in the Pattern dropdown.
- [x] Each program activates at least four component families.
- [x] No two programs produce the same spatial selection at representative checkpoints.
- [x] Each program defines a rest state, active state, buildup state, drop state, and recovery state.
- [x] Each program preserves deliberate dark regions and focal hierarchy.
- [x] Pattern changes crossfade without a black frame or global white flash.
- [x] Active emitters retain at least their authored visibility and routed accents rise above it instead of compounding selector values into near-black output.

### Acceptance gate

Capture every program at rest, ordinary beat, downbeat, buildup midpoint, drop impact, and release. Each contact sheet must be identifiable without reading its label.

---

## 3. Turn the city into a performance surface

### Objective

Make the skyline, road, lamps, crowns, and foreground accents as musically meaningful as the Waffle House sign.

### Required code changes

1. Refactor the generator so visible city lights are addressable by semantic attributes instead of only the current broad window material groups.

2. Add structured detail where the camera can resolve it:

   - window rows and vertical columns on hero buildings;
   - crown tiers and mast sections;
   - individually indexed streetlight emitters and pools;
   - lane-edge, guardrail, or road-route lights;
   - selective foliage edge glints;
   - building facade strips that remain dark until recruited by a program.

3. In `Cinema2AtlHoeLighting.ts`, map musical responsibilities by component rather than sending one signal to the entire city:

   - sub/bass: sign cabinet weight, road pools, and low facade rows;
   - mid: general window population and building climbs;
   - high/flux: crown edges, mast tips, star detail, and sparse window sparkle;
   - kick: sign cells and selected foreground lamps;
   - snare/transient: window columns, crown accents, and brief foliage rim hits;
   - phrase/section: route handoffs and broad city reorganizations;
   - drop: staged whole-city response, never an undifferentiated single-frame blaze.

4. Ensure distant city motion remains readable at the embedded Stage size. Avoid tiny changes that only appear in 4K captures.

### Checklist

- [x] At least three hero buildings have independent vertical and horizontal choreography.
- [x] Streetlights animate individually or in topology-aware routes.
- [x] Road lighting participates in at least three programs.
- [x] Crowns and spires do more than flash together on downbeats.
- [x] The sign is not the only readable reactive object at Stage size.
- [x] City behavior remains spatially coherent at narrow and 16:9 aspects.

### Acceptance gate

With the sign temporarily forced dark in a diagnostic build, the city alone must still deliver a recognizable, musically structured performance for all six programs.

---

## 4. Make reactive light reshape the environment

### Objective

When an emitter becomes bright, nearby geometry and atmosphere must respond so the event reads as light entering a physical environment rather than a material color changing.

### Required code changes

1. Add named light groups in `Cinema2AtlHoePreset.ts`:

   - sign spill;
   - left/center/right city spill;
   - road pools;
   - crown/sky flash;
   - optional foliage rim.

2. Keep the light count within the quality-tier budget. Use a fixed pool of representative lights; do not create one point light per window or streetlamp.

3. Drive light-group intensity and color from the ATL HOE pattern frame through engine choreography bindings or the native module's supported lighting output.

4. Coordinate emitter brightness with:

   - volumetric density, mist, and beam intensity;
   - fog brightness/density;
   - exposure with strict clamping;
   - bloom threshold/intensity where supported;
   - localized road and foliage response.

5. Add multi-stage drop lighting: impact, short hold, city afterglow, and controlled return. Avoid a single global exposure flash as the primary drop response.

6. Review shadow casting and receiving for the sign cabinet, letters, road structures, and nearby foliage. Enable shadows only on tiers where the cost is acceptable.

### Checklist

- [x] Bright sign events visibly affect the cabinet, supports, nearby foliage, and haze.
- [x] Road-lamp events create localized pools rather than only glowing lamp meshes.
- [x] Crown and lightning events affect the skyline atmosphere without washing out the sign lettering.
- [x] Drop afterglow persists after emitters begin to decay.
- [x] HDR peaks retain color and detail instead of clipping to uniform white.
- [x] Low quality retains a simplified but coherent spill response.

### Acceptance gate

Compare emissive-only and full-lighting diagnostic captures. The full-lighting version must show clear, localized environmental response while preserving readable letters, windows, and skyline silhouettes.

Implementation record (2026-10-14): `Cinema2AtlHoeLighting.ts` now produces independent sign, three-zone city, two-zone road, crown, foliage, fog, and recovery-afterglow channels. `Cinema2ThreeSceneBridge.ts` maps those channels to an eight-member fixed point-light pool, reduced to six lights on medium and three on low, with bounded exponential-fog modulation. `Cinema2AtlHoeDesign.ts` adds restrained energy modulation plus an impact/hold/afterglow/return envelope across volumetrics, bloom, and exposure. The sign's authored spot supplies tier-budgeted shadows for the cabinet/letter/road/foliage receiver set.

Focused validation: 58 ATL HOE/PBR tests passed, including independent spill routing, recovery persistence, tier limits, and Master Intensity shutdown. The deterministic high-quality capture at `artifacts/cinema2-atl-hoe-visual-acceptance/run-am5yj9/before-primary-16x9-high.png` retains readable dark letters and distinct amber/cyan skyline detail (`p99` luma `0.8482`, maximum `0.9949`) while the cabinet, city, road, and foliage remain spatially separated.

---

## 5. Add Auto Performance, Pattern Change, and Trigger workflow

### Objective

Bring ATL HOE to the standard Cinema 2.0 performance workflow used by Mainframe and CONDUIT.

### Required code changes

1. Add these parameters in `Cinema2AtlHoeDesign.ts`:

   - **Auto Performance** toggle under Master Controls;
   - **Pattern** dropdown containing all six programs;
   - **Pattern Change** toggle;
   - conditional **Trigger** dropdown using the standard trigger set: beat, kick, snare, downbeat, 2 beats, 4 beats/bar, 4 bars, 8 bars, phrase, section, and drop.

2. Use parameter metadata so manually selecting Pattern disables Auto Performance, and enabling Pattern Change also disables Auto Performance.

3. Implement `Cinema2AtlHoePatternController.ts` using deterministic no-immediate-repeat cycling, stable event identities, and explicit reset behavior for seek, track replacement, context replacement, stop, and source loss.

4. Auto Performance should choose programs from real musical state. Recommended policy:

   - breakdown/quiet/vocal: `city-pulse` or restrained `neon-brownout`;
   - buildup: `skyline-rise` or `interstate-flow`;
   - ordinary high-energy section: `waffle-marquee` or rotating route programs;
   - high-confidence drop: `storm-takeover` or a drop-capable selected program;
   - avoid switching more than once per qualified boundary except for a confirmed drop.

5. Reuse Mainframe's audio-source selection, beat clock, trigger identity, and continuity/reset utilities where their contracts apply. Do not duplicate them under ATL-specific names without a behavior difference.

### Checklist

- [x] Auto Performance appears in Master Controls and defaults to an approved value.
- [x] Pattern lists exactly six programs.
- [x] Pattern Change exposes Trigger only while enabled.
- [x] Manual Pattern edits disable Auto Performance.
- [x] Pattern Change and Auto Performance cannot fight for ownership.
- [x] Trigger delivery is deduplicated.
- [x] Seeking and changing tracks clear stale pattern/drop state.
- [x] Program changes crossfade and never immediately repeat in automatic cycles.

### Acceptance gate

Run deterministic controller tests for every trigger option, seek/reset behavior, manual ownership, Auto Performance decisions, and no-immediate-repeat cycling.

---

## 6. Integrate sky behavior into the six full-scene programs

### Objective

Remove the conceptual split where Sign Pattern and Sky Pattern operate as unrelated systems. The sky must become one coordinated layer of every full-scene program.

### Required code changes

1. Replace the current `skyPatternEnabled` and `skyPattern` performance ownership with one of these approaches:

   - preferred: remove them from the primary UI and let each full-scene program author its own sky state;
   - optional: retain a secondary **Sky Override** control for manual forcing, with `Program`, `Stars`, and `Thunderstorm` values.

2. Add sky state to the pattern frame:

   - gradient/sky exposure gain;
   - star density and brightness;
   - star zone selection;
   - cloud/haze or storm darkness;
   - active bolt identities and branch progression;
   - lightning flash and recovery;
   - city power response to a strike.

3. Integrate lightning with city choreography. A strike should have a spatially related skyline flash, window response, sign interruption or reinforcement, and atmospheric decay.

4. Upgrade fixed whole-bolt flashes so a bolt can reveal from top to bottom using `_ATL_PHASE`. Retain the twelve authored bolt shapes, but animate progression within each shape.

5. Ensure non-storm programs still use the sky meaningfully through star motion, gradient breathing, controlled negative space, or phrase-level changes.

### Checklist

- [x] Every program defines a sky state.
- [x] Sky events are spatially coordinated with city zones.
- [x] Lightning grows along its authored path rather than appearing as one flat object.
- [x] Storm Takeover changes sign, city, road, atmosphere, and sky together.
- [x] Calm programs preserve negative space and do not keep the sky constantly active.
- [x] The disconnected manual sky override was removed, leaving one unambiguous program owner.

### Acceptance gate

Capture every program with the city hidden and then with the full scene. The isolated sky behavior must be distinct, and the full-scene capture must demonstrate deliberate synchronization rather than simultaneous unrelated flashes.

---

## 7. Deepen musical interpretation

### Objective

Consume the same class of shared Audio Intelligence and Visual Director data that gives Mainframe and CONDUIT section-aware behavior.

### Required code changes

1. Implement `Cinema2AtlHoeMusicAdapter.ts` to read and preserve:

   - sub, bass, mid, high;
   - overall energy and spectral flux;
   - vocal presence;
   - build progress, confidence, and intensity as separate values;
   - section type, section progress, section confidence, and section intensity;
   - phrase progress;
   - Director significance, momentum, impact, and variation;
   - canonical kick, snare, transient, beat, downbeat, bar, phrase, section, and drop events.

2. Confidence-gate structural behaviors. A weak section classification must not launch a full takeover, and build confidence must never be substituted for build progress.

3. Add event envelopes with component-specific attack, hold, and release values. Do not use one envelope shape for the whole scene.

4. Coordinate drop detection through one canonical delivery path and deduplicate section-derived and semantic-moment drop evidence.

5. Preserve provenance and event time so late or repeated events cannot retrigger stale visual state.

6. Define a documented signal-to-component matrix and test it. At minimum, independent component families must respond differently rather than all scaling from overall energy.

### Checklist

- [ ] Sub, bass, mid, high, flux, and vocal presence have visibly different responsibilities.
- [ ] Verse, breakdown, buildup, drop, and unknown sections produce different activity policies.
- [ ] Build behavior uses progress, confidence, and intensity correctly.
- [ ] Kick, snare, transient, downbeat, phrase, section, and drop have separate envelopes.
- [ ] Low-confidence structural events cannot force major visual changes.
- [ ] A drop is delivered once even when multiple upstream signals describe it.
- [ ] Paused, stopped, seeking, and source-replacement states reset cleanly.

### Acceptance gate

Add synthetic-frame tests covering every signal and event independently, plus combined section scenarios. Each test must assert the intended component family and verify that unrelated families remain below their activation threshold.

---

## 8. Make motion visible by default without destabilizing the composition

### Objective

Use camera and limited environmental motion to increase depth while preserving the approved sign/skyline framing and readable lettering.

### Required code changes

1. Raise Camera Movement from `0` to a restrained nonzero authored default after visual approval. Start evaluation around `0.25–0.4`, not at full motion.

2. Expand the camera motion definition in `Cinema2AtlHoePreset.ts`:

   - slow lateral parallax between sign, road, skyline, and sky;
   - subtle target drift;
   - small phrase-level FOV breathing;
   - optional kick or impact punch with a separate toggle or bounded strength;
   - a drop move that resolves smoothly rather than repeatedly punching.

3. Add limited scene motion where appropriate:

   - haze drift tied to time and energy;
   - tiny star parallax;
   - restrained foliage shimmer on high-frequency energy;
   - lightning-specific camera impulse only at safe intensity.

4. Clamp motion for the embedded Stage and 16:9 output independently so the sign text, skyline crowns, and road do not leave safe framing.

5. Respect reduced-motion/flash policy already supplied by Cinema 2.0.

### Checklist

- [ ] The default preset visibly moves during playback.
- [ ] Motion demonstrates foreground/background parallax.
- [ ] Sign text remains fully readable throughout the motion envelope.
- [ ] Camera movement remains independent from lighting Master Intensity.
- [ ] Kick/impact motion can be disabled separately if introduced.
- [ ] Pause freezes tempo-driven motion without a jump on resume.
- [ ] Tall Stage and 16:9 captures retain the approved composition.

### Acceptance gate

Record a 30-second camera path at quiet, ordinary, buildup, and drop intensities in both target aspect ratios. No protected landmark or sign cell may cross the safe-frame boundary.

---

## 9. Increase visual-density budget deliberately

### Objective

Add screen-resolvable construction detail and material separation where it improves the performance. Do not chase triangle count for its own sake.

### Required code changes

1. Prioritize new geometry in the foreground and hero skyline:

   - sign cabinet seams, rear structure, brackets, fasteners, wiring housings, and face diffusers;
   - road guardrails, beams, lane markers, lamp housings, and understructure;
   - facade mullions, setbacks, crown tiers, antenna hardware, and roof equipment on hero buildings;
   - better foliage silhouette variation and a limited number of dimensional foreground clusters.

2. Improve material hierarchy:

   - separate painted steel, black letter faces, yellow diffuser, glass, concrete, asphalt, foliage, and emissive practicals;
   - tune roughness, metalness, clearcoat, environment intensity, and normal detail per family;
   - keep unlit surfaces readable under physical lighting instead of relying on emission.

3. Introduce asset quality variants if performance requires them. A reasonable evaluation target is approximately 130,000–180,000 triangles for high quality, with explicitly reduced medium and low variants. Final budgets must be based on profiling, not the target number alone.

4. Update the generated asset manifest and asset-budget checks after regeneration.

5. Add visual-density only after semantic topology is stable; otherwise topology attributes and identifiers will repeatedly need regeneration.

### Checklist

- [ ] Added detail is visible at the embedded Stage size.
- [ ] Hero areas receive more detail than distant silhouettes.
- [ ] Materials remain distinguishable with emission disabled.
- [ ] High, medium, and low tiers retain every primary reactive landmark.
- [ ] Triangle, draw-call, GPU-memory, and shader costs remain within Cinema 2.0 budgets.
- [ ] No added detail compromises sign lettering or focal hierarchy.

### Acceptance gate

Approve emission-off material captures, normal performance captures, and high/medium/low comparison sheets. Profile sustained playback rather than accepting the asset based only on successful loading.

---

## 10. Perform real-track tuning and production acceptance

### Objective

Replace synthetic-only confidence with evidence that the preset performs musically and reliably against real material.

### Required code changes

1. Add a dedicated production acceptance script, modeled on Mainframe's gate:

   - `scripts/cinema2-assets/accept-atl-hoe-production.mjs`
   - package command such as `visual:atl-hoe:production`

2. Extend `scripts/run-cinema2-atl-hoe-browser.mjs` or the new acceptance script to support:

   - user-supplied local audio tracks;
   - deterministic capture timestamps;
   - program and control overrides;
   - both embedded Stage and 16:9 output sizes;
   - frame sequences/contact sheets, not only isolated stills;
   - diagnostics and failed-pass collection;
   - CPU/GPU timing and memory reporting.

3. Build a real-track tuning matrix covering at least:

   - quiet intro or breakdown;
   - vocal passage;
   - percussion-dense section;
   - sustained buildup;
   - clean drop;
   - ambiguous or false-drop transition;
   - tempo change or half-time feel where available.

4. Tune event thresholds, envelope shapes, pattern duration, crossfade time, reactive-light strength, camera motion, bloom, and exposure using the matrix.

5. Add long-run, resize, pause/resume, seek, track replacement, quality-tier, context-recovery, and missing-asset checks.

6. Update this guide with measured final budgets and remaining limitations after acceptance.

### Checklist

- [ ] Every program has been reviewed against real music in the actual app.
- [ ] Auto Performance makes appropriate choices across the tuning matrix.
- [ ] Transients do not produce constant visual chatter.
- [ ] Builds progress instead of looping a fake buildup.
- [ ] Drops are strong, staged, deduplicated, and recover cleanly.
- [ ] No source, silence, pause, and stopped playback remain visually stable.
- [ ] High, medium, and low quality pass sustained playback.
- [ ] Resize and context recovery do not lose topology or pattern state.
- [ ] No module diagnostic, failed pass, shader failure, or unhandled rejection occurs.
- [ ] Owner approval is recorded for all six programs at both required aspect ratios.

### Acceptance gate

The upgrade is complete only after the production gate passes and the owner approves real-track recordings or captures of all six programs. Synthetic tests and schema checks are necessary but are not sufficient.

---

## Final completion checklist

- [x] 1. Semantic topology is embedded, validated, and used by the GPU lighting path.
- [x] 2. Six distinct full-scene programs replace the four brightness variations.
- [x] 3. The city independently performs without relying on the sign.
- [x] 4. Reactive emitters reshape surrounding light, haze, and surfaces.
- [x] 5. Auto Performance, Pattern Change, and Trigger work with deterministic ownership.
- [x] 6. Sky behavior is integrated into every full-scene program.
- [ ] 7. Full shared Audio Intelligence drives independent component responsibilities.
- [ ] 8. Restrained, safe motion is visible in the authored default.
- [ ] 9. Screen-resolvable detail and material hierarchy meet the approved density target.
- [ ] 10. Real-track tuning and the production acceptance gate pass.
- [x] Focused tests pass after each package.
- [x] Asset manifests and documentation are updated after regeneration.
- [x] Final diff is reviewed for unrelated changes.
- [ ] Final implementation is committed only when requested.

## Definition of done

ATL HOE must no longer read as a static city with blinking material groups. At Stage size, a viewer should be able to follow energy moving through the sign, road, skyline, crowns, sky, atmosphere, and camera; recognize which of the six programs is active; and see the scene make different decisions during quiet passages, vocals, builds, impacts, drops, and recovery. That behavior must be deterministic, performant, visually approved, and verified with real tracks in the production application.
