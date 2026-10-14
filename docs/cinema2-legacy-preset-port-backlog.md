# Cinema 2.0 Legacy Preset Port Backlog

## Purpose

This document is the implementation and acceptance backlog for carrying the strongest ideas from the legacy Cinema catalog into native Cinema 2.0 presets.

The legacy catalog currently contains 40 user-facing entries:

- 8 Shader scenes;
- 32 Cinematic Worlds presets; and
- engineering-only Cinema reference compositions, which are intentionally excluded from this backlog.

The goal is not to reproduce every legacy entry as a separate Cinema 2.0 preset. Closely related entries should be consolidated into one native keeper with meaningful authored looks, design modes, or quality profiles. Every implementation must follow `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`: preserve the visual identity first, keep user controls authoritative, consume shared Audio Intelligence, and route temporary musical behavior through native choreography targets.

## Status legend

- [ ] Not started
- [~] In progress or partially incorporated
- [x] Complete and accepted
- **Port** — retain the legacy concept through native Cinema 2.0 ownership.
- **Rebuild** — retain the identity but replace legacy rendering, audio, lifecycle, or state ownership.
- **Enhance** — incorporate the concept into an existing Cinema 2.0 keeper.
- **Consolidate** — combine multiple related legacy entries into one keeper or authored mode.
- **Skip** — do not carry the entry forward as an independent preset.

## Master implementation checklist

### New native keepers

- [x] **Cathedral 2.0** — native keeper complete and accepted.
- [x] **Ancient Machine 2.0** — native keeper complete and accepted.
- [~] **Event Horizon 2.0** — native implementation complete; awaiting owner visual acceptance.
- [~] **Constellation 2.0** — native implementation complete; awaiting owner visual acceptance.
- [ ] **Rift Bloom 2.0** — consolidate the Fracture Rift family and Melodic Rift Bloom.
- [ ] **Liquid Forms 2.0** — rebuild Liquid Metaballs as a native depth-aware liquid world.
- [ ] **Mirror Dimension 2.0** — consolidate Sixfold Chamber, Crystal Mandala, and Infinite Gallery after the higher-priority keepers.

### Enhancements to existing Cinema 2.0 keepers

- [ ] **Depth architectural modes** — incorporate Prism Tunnel, Prism Transit, and Obsidian Vault.
- [ ] **Electric Storm environment modes** — incorporate Tempest Eye, Electric Front, and Ashen Cyclone.
- [ ] **Echowave/Echoform signal mode** — incorporate Signal DNA.
- [ ] **Interlock/Afterhours lattice mode** — incorporate Laser Lattice Overdrive where it remains visually distinct.
- [ ] **SAY IT deformation mode** — incorporate Wobble Glyph Forge.
- [ ] **Constellation orbital mode** — incorporate Orbital Prism Array.

### Existing completed ports

- [x] **Reactor 2.0** — native keeper is registered and productionized.
- [x] **Electric Storm 2.0 core** — native procedural lightning keeper is registered; the environment-mode enhancement remains open above.
- [x] **Afterhours 2.0 core** — native world-space laser keeper is registered; the lattice-mode evaluation remains open above.

---

## 1. Cathedral 2.0

**Status:** [x] Complete and accepted  
**Priority:** 1  
**Decision:** Consolidate + Rebuild + Enhance  
**Legacy sources:** Bass Cathedral, Cathedral Run

### Creative identity

A monumental, traversable cathedral of repeating arches and structural ribs. The architecture should feel physically large and mostly dark, with restrained haze and sharply controlled illumination. Musical energy should reveal the structure rather than flatten the scene into constant brightness.

### Visual composition

- Tall repeating arches frame a deep central aisle and strong vanishing point.
- A wide LED transition chamber fills the end-of-cycle interval before the next cathedral aisle begins, using Depth-style longitudinal, wall, ceiling, and threshold fixtures.
- Structural ribs, buttresses, floor rails, and occasional suspended elements establish scale.
- Cool architectural materials form the base; authored accent colors travel through selected ribs and arches.
- Fog separates near, middle, and far architecture without hiding the silhouette.
- Sparks or small debris remain secondary accents, not the primary visual.
- Quiet sections expose only a few guide lights; builds progressively reveal the vault; drops produce a large but bounded architectural rupture or expansion.

### Native 3D and geometry

- Use world-space instanced arch, rib, column, rail, and floor geometry.
- Reuse the proven endless-travel/repeat-offset approach from Depth where appropriate.
- Give every arch/rib a stable geometry address so choreography can target depth lanes, alternating sides, rings, or structural groups.
- Prefer procedural or instanced geometry over a monolithic imported model so density, spacing, width, and active span remain controllable.
- Use real depth, occlusion, bounded shadows, and reflective-floor interaction.
- Define wide, square, portrait, and narrow-stage safe camera bounds.

### Audio Intelligence inputs

- `kick` — short arch/rib impact and localized light hit.
- `snare`/`transient` — sparks, side accents, or sharp shaft illumination.
- `subBass`/`bass` — structural weight, rib thickness modulation, and restrained environmental pressure.
- `overallEnergy` — active architectural span and baseline illumination.
- `buildProgress` — progressive vault recruitment, forward pressure, and travel acceleration.
- `downbeat` — aisle sweep, large light-group hit, and bounded camera emphasis.
- `phrase`/`bar` — alternate leading side, depth direction, or arch program.
- `drop` — rupture/expansion gesture, full-depth reveal, bloom and atmosphere impact.
- `vocalPresence` — optional density restraint so vocals retain visual space.

### Geometry choreography

- Address near/mid/far arch groups independently.
- Support forward and reverse depth chases, alternating ribs, opposing-side hits, sparse guide mode, build recruitment, and drop rupture.
- Geometry motion must remain bounded: small rib separation, arch expansion, or segmented opening rather than arbitrary mesh distortion.
- A manual architecture or light-program selection must disable automation for that domain.
- Choreography should modulate the user's density, brightness, motion, and rupture settings rather than replace them.

### Camera, lighting, and effects

- Primary camera: endless fly-through or dolly down the aisle.
- Secondary shots: wide establishing view, low architectural approach, pre-drop compression, and drop reveal.
- Use named key, side, vault, aisle, and rear light groups with staggered choreography.
- Use volumetric atmosphere for readable shafts and depth separation.
- Use reflective floor selectively; it must support the architecture without becoming the brightest surface.
- Apply HDR bloom, cinematic finish, restrained chromatic effects, and optional depth of field.

### User controls

- Master Intensity, Auto Performance, BPM Sync, Camera Motion, Travel Speed.
- Architecture Style, Arch Density, Corridor Width, Rib Thickness, Active Span.
- Light Program, Pattern Change, Trigger, Direction, Stagger, Pulse Width.
- Rupture Amount, Spark Density, Haze, Shaft Strength, Floor Reflection, Bloom.
- Structure Color, Primary Light Color, Accent Color, Background/Atmosphere Color.

### Quality and performance

- Quality owns visible arch count, shadow resolution, atmosphere steps, sparks, and reflection resolution.
- Geometry remains instanced with a bounded draw-call count.
- Low quality preserves the aisle, major arches, musical light routes, and camera movement.
- All random layout and spark behavior is deterministic from the engine random service.

### Completion checklist

- [x] Native instanced pointed arches, columns, illuminated ribs, rails, and deterministic sparks implemented.
- [x] The former end-of-cycle dead zone is replaced by a large Depth-inspired LED transition room before the seamless aisle repeat.
- [x] Cathedral Run is the authored default with editable Background, Structure, Primary Light, and Accent Light controls.
- [x] Endless fly-through camera, real depth, reflective floor, volumetric atmosphere, HDR bloom, and cinematic finish are engine-owned.
- [x] Audio Intelligence routes energy, beat, kick, snare, downbeat, phrase, build, drop, and vocal presence through native choreography targets.
- [x] Manual Light Program selection disables Auto Performance for that domain.
- [x] Pattern Change and conditional Trigger controls use Mainframe's deterministic no-repeat cycle and Audio Intelligence event contract.
- [x] Focused manifest, compiler, deterministic-layout, production-runtime, render-pass, and GPU-resource checks pass.
- [x] Static composition accepted for the Cathedral 2.0 backlog item.
- [x] Quality behavior and production runtime path accepted for the Cathedral 2.0 backlog item.
- [x] Resource ownership and disposal use the native Cinema 2.0 lifecycle.
- [x] Final owner acceptance received.

---

## 2. Ancient Machine 2.0

**Status:** [x] Complete and accepted  
**Priority:** 2  
**Decision:** Consolidate + Rebuild + Enhance  
**Legacy sources:** Oracle Lock, Gear Sun, Epoch Engine

### Creative identity

A massive ceremonial mechanism made from concentric seals, gears, glyph rings, teeth, tracks, and a central spherical energy crystal. It should read as a physical machine with weight and hierarchy, not as a flat radial shader.

### Authored looks

- **Oracle Lock:** dense glyph rings, restrained movement, compressed energy crystal, bar-scale progression.
- **Gear Sun:** bright, fast, aggressive interlocking gears and beat-driven radial energy.
- **Epoch Engine:** deep layered machinery, slow geological rotation, section-scale unlocking.

### Native 3D and geometry

- World-space nested gear, ring, tooth, plate, glyph, and rail assemblies surrounding a faceted spherical energy crystal.
- Separate depth planes and mechanical layers with real occlusion and parallax.
- Stable named parts for outer seals, gear crown, glyph rings, lock pins, energy crystal, and rear chamber.
- Use instanced teeth/glyphs and procedural gear profiles; reserve imported assets for hero detail only.
- Support material variation between aged metal, dark stone/ceramic, emissive glyphs, and polished internal components.

### Audio Intelligence inputs

- `beat` — advance selected ring or gear cadence.
- `downbeat` — lock-pin strike and major ring alignment.
- `kick` — gear torque, crystal pulse, or radial light hit.
- `snare`/`highs` — glyph flare and tooth highlights.
- `bar` — advance the Oracle sequence or change active ring.
- `phrase` — change rotational relationship, camera side, or glyph program.
- `section` — long-form Epoch unlock state.
- `buildProgress` — increasing lock pressure, rotational convergence, and crystal tension.
- `drop` — bounded mechanical release, crystal expansion, and internal light reveal.
- `overallEnergy`/`bass` — directional debris vibration and expansion plus energy-crystal pressure.

### Geometry choreography

- Counter-rotate ring groups with deterministic ratios.
- Advance lock state in discrete musical steps rather than frame-rate-dependent accumulation.
- Use choreography targets for ring rotation, gear phase, glyph brightness, lock progression, crystal expansion, and mechanical depth.
- Build choreography converges rings toward alignment; drop choreography releases crystal pressure and expands internal depth.
- Manual progression or crystal-expansion edits reclaim authority from Auto Performance.

### Camera, lighting, and effects

- Wide dormant view, inspection orbit, build dolly, pre-drop lock close-up, drop opening reveal, and outro retreat.
- Warm internal light contrasts with cool or neutral exterior metal.
- Spot and rim lights expose mechanical depth; glyph emission must not wash out material detail.
- Use haze inside the mechanism, controlled bloom, cinematic finish, and optional floor/reflection only when compositionally justified.

### User controls

- Master Intensity, Auto Performance, BPM Sync, Camera Motion.
- Machine Look, Ring Count, Gear Density, Glyph Density, Tooth Density.
- Rotation Speed, Counter-Rotation, Mechanical Depth, Lock Progress, Crystal Expansion.
- Progression Mode, Pattern Trigger, Unlock Response, Drop Release.
- Metal Color, Glyph Color, Internal Light Color, Background Color.
- Haze, Bloom, Finish, Vibration, Camera Distance.

### Completion checklist

- [x] Oracle Lock, Gear Sun, and Epoch Engine are represented as authored Machine Looks.
- [x] Native instanced rings, teeth, glyphs, pins, plates, and spherical energy-crystal geometry have stable addresses and real depth.
- [x] Pattern Change and conditional Trigger controls use Mainframe's persistent, deterministic, no-repeat event contract.
- [x] Pause, seek, track, context-generation, and playback resets return pattern authority safely.
- [x] Manual Machine Look edits reclaim authority and Auto Performance remains separately user-controlled.
- [x] Native authoring, compiler, production runtime, render-pass, resource, persistence, and focused lint checks pass.
- [x] Low/medium/high geometry and atmosphere behavior are visually approved.
- [x] Real-browser aspect-ratio acceptance and preset-switch/context-loss checks pass.
- [x] Owner approves the static machine and its full-song progression.

---

## 3. Event Horizon 2.0

**Status:** [~] Implemented; awaiting owner visual acceptance  
**Priority:** 3  
**Decision:** Consolidate + Rebuild + Enhance  
**Legacy sources:** Singularity Crown, Quasar Maw, Binary Collapse

### Creative identity

A compact gravitational core surrounded by an angled accretion structure, layered stars, debris, lensing, and controlled shockwave behavior. The core must remain readable at all times.

### Authored looks

- **Singularity Crown:** cyan/gold, compact core, balanced crown, controlled motion.
- **Quasar Maw:** crimson/violet, larger turbulent disk, aggressive pressure and drops.
- **Binary Collapse:** emerald/white split-color disk, smaller core, deep stars, restrained motion.

### Native 3D and geometry

- World-space, camera-facing volumetric accretion particles form a tilted structure around the core.
- Six disk bands, twelve sectors, and five depth layers provide stable choreography addresses and front/back separation.
- Instanced 3D stars and orbital debris occupy deterministic world-space volumes.
- A tessellated depth-writing core provides real scene occlusion rather than a screen-space mask.
- A world-camera orbit rig provides true parallax, bounded drift, tempo motion, and motion-safety modes.
- A dedicated lensing pass consumes scene color and depth before atmosphere, HDR bloom, and cinematic finish.
- Quality profiles own disk/star/debris counts, lensing resolution, atmosphere, and the existing render-resolution policy.

### Audio Intelligence inputs

- `subBass`/`bass` — core pressure, disk thickness, and restrained lensing modulation.
- `kick` — core contraction or short gravitational pulse.
- `snare`/`transient` — disk flare, debris glint, or chromatic accent.
- `overallEnergy` — accretion brightness and orbital activity.
- `buildProgress` — contraction, increasing rotation pressure, and camera approach.
- `downbeat` — ring pulse or controlled lensing wave.
- `phrase` — orbital direction/look variation and camera composition change.
- `drop` — shockwave, disk expansion, debris impulse, and bounded camera impact.

### Geometry choreography

- Build compresses the visible system toward the core while preserving a safe minimum radius.
- Drop releases a radial shockwave and briefly expands debris/accretion spacing.
- Choreography can alternate disk sectors, orbital bands, or split-color emphasis.
- User controls remain the base for core radius, disk radius, tilt, thickness, lensing, and motion.

### Camera, lighting, and effects

- Locked establishing shot, slow orbit, pre-drop focus, drop reveal, and optional post-drop retreat.
- Emissive accretion provides most local illumination; subtle rim/fill lighting reveals debris.
- Use HDR bloom, restrained aberration, depth-aware lensing, cinematic finish, and optional trails.
- Star layers must preserve depth without competing with the core.

### User controls

- Master Intensity, Auto Performance, BPM Sync, Camera Motion.
- Look, Core Radius, Disk Radius, Disk Thickness, Tilt, Lensing Strength.
- Rotation Speed, Turbulence, Debris Density, Star Depth, Shockwave Strength.
- Build Contraction, Drop Expansion, Bloom, Aberration, Trails, Finish.
- Core, Disk Primary, Disk Secondary, Accent, and Background colors.

### Completion checklist

- [x] Singularity Crown, Quasar Maw, and Binary Collapse are represented as distinct authored looks.
- [x] Accretion is a world-space, camera-facing volumetric structure, not a fullscreen illustration.
- [x] Six addressable bands, twelve sectors, and five depth-separated disk layers support choreography.
- [x] Stars and orbital debris use deterministic instanced 3D geometry.
- [x] The tessellated core writes depth and occludes the accretion, debris, and star volumes.
- [x] The world-camera orbit rig produces parallax and supports full, reduced, and lock-off motion.
- [x] A dedicated lensing/composite pass consumes scene color and scene depth.
- [x] Build contraction, drop expansion, band emphasis, and sector emphasis are bounded and Audio Intelligence driven.
- [x] Low/medium/high quality profiles own geometry counts, particle counts, atmosphere behavior, and lensing render resolution.
- [x] Camera, debris, stars, and disk motion are deterministic and transport-time seek-safe.
- [x] Pattern Change and conditional Trigger controls use Mainframe's deterministic no-repeat event contract.
- [x] Native compiler, production runtime, five-pass render graph, GPU lifecycle, focused lint, and real-browser shader checks pass.
- [ ] Owner approves the three looks and their full-song progression.

---

## 4. Constellation 2.0

**Status:** [~] Implemented; awaiting owner visual acceptance  
**Priority:** 4  
**Decision:** Consolidate + Rebuild + Enhance  
**Legacy sources:** Crimson Collapse, Cyan Reverie, Monolith Breaker, Trapwire, Prism House, Industrial Lattice, Aurora Bloom, Minimal Skeleton, Crystal Synapse, Helix Reliquary, Polyhedral Supernova, Orbital Prism Array

### Creative identity

A native 3D field of floating faceted elements and deterministic formations that can breathe, collapse, burst, orbit, and evolve with musical structure. The camera continuously orbits the depth-separated field so it reads as a physical spatial system rather than screen-space particles. Connection lines are intentionally omitted.

### Required authored looks

- **Crimson Collapse:** compact build contraction and elastic crimson drop launch.
- **Cyan Reverie:** melodic branching bloom with graceful trails and recovery.
- **Monolith Breaker:** large dark masses, hard impacts, minimal drift.
- **Trapwire:** asymmetric split clusters, fast inward snaps, short trails.
- **Prism House:** stable polished ring, bar breathing, phrase rotation.
- **Industrial Lattice:** rigid dense spatial formation with phase-locked evolution.
- **Aurora Bloom:** colorful open-format topology changes and broad camera sweeps.
- **Minimal Skeleton:** low-cost profile with a small stable network and no decorative curtains.
- **Legacy looks:** Crystal Synapse, Helix Reliquary, and Polyhedral Supernova retained as optional authored variations, not separate keepers.
- **Orbital mode:** central hero prism, orbital rings, depth shards, and star field derived from Orbital Prism Array.

### Native 3D and geometry

- World-space polyhedron nodes with quality-owned geometry complexity.
- Stable formation topology and deterministic seeded element placement.
- Instanced floating polyhedron meshes with doubled per-tier element budgets and no connection-line pass.
- Engine-owned history for trails; no preset-owned framebuffer lifetime.
- Optional curtains, shards, and background particles with strict per-tier budgets.
- Spatial camera and lighting must preserve front/back relationships and prevent dense looks from collapsing into a flat glow mass.

### Audio Intelligence inputs

- `subBass`/`bass` — node mass, spread, collapse pressure, or breathing.
- `kick` — burst impulse, network snap, or radial launch.
- `snare` — facet accent.
- `highs`/`highMid` — glimmer, edge brightness, or node spin.
- `overallEnergy` — active formation intensity and element response.
- `beat`/`bar` — breathing, topology step, or orbital phase.
- `phrase` — topology morph and camera/leading-color change.
- `buildProgress` — contraction and trail recruitment.
- `drop` — burst, fracture, launch, or hard network reconfiguration.
- `vocalPresence` — optional density reduction and central focus.

### Geometry choreography

- Choreography targets: formation spread, element scale, topology morph, collapse force, burst impulse, element spin, facet brightness, trail length, orbital phase, and camera impulse.
- Rewiring occurs only at authored musical boundaries and remains deterministic.
- Continuous energy routes must be smoothed; triggers use bounded attack/hold/release envelopes.
- User topology and shape choices remain authoritative unless Auto Performance is explicitly enabled.

### Camera, lighting, and effects

- Continuous world-camera orbit around the floating formation, with reduced-motion and lock-off safety modes.
- PBR or controlled faceted materials with internal emissive accents.
- HDR bloom, managed trails, restrained haze, depth of field where useful, and cinematic finish.
- Avoid excessive camera motion in already chaotic looks such as Trapwire or Monolith Breaker.

### User controls

- Master Intensity, Auto Performance, BPM Sync, Camera Motion, Look.
- Element Count, Topology Style, and Polyhedron Style.
- Formation Spread, Depth Spread, Element Scale/Variation, Stability.
- Collapse, Burst, Elasticity, Drift, Turbulence, Orbit, Spin.
- Facet Rim, Trail Length/Decay, Internal Glow, Color Variation, and Background Density.
- Primary, Secondary, Accent, Highlight, and Background colors.

### Quality and performance

- Minimal Skeleton defines the required low-tier visual floor.
- Quality owns doubled element-count caps, mesh complexity, trail samples, curtains, particles, and render scale.
- Topology generation and GPU buffers must be bounded and reusable.
- No quality tier may fabricate unavailable audio inputs.

### Completion checklist

- [x] Core renderer supports every required topology and polyhedron class.
- [x] Required authored looks are visually distinct, not palette-only variants.
- [x] Minimal Skeleton meets the low-tier budget while preserving audio response.
- [x] Topology changes are deterministic, seek-safe, and non-destructive to user settings.
- [x] Trails use the engine-owned transport-aware history path and reset with runtime lifecycle events.
- [~] Quality-owned budgets and real-browser rendering pass; owner visual acceptance remains pending.

---

## 5. Rift Bloom 2.0

**Status:** [ ] Not started  
**Priority:** 5  
**Decision:** Consolidate + Rebuild + Enhance  
**Legacy sources:** Glass Wound, Wildspace Tear, Prismatic Fault, Melodic Rift Bloom

### Creative identity

A dimensional opening with an independently rendered interior world, fractured foreground boundary, refractive shards, spreading cracks, and either crystalline, turbulent, prismatic, or melodic internal behavior.

### Authored looks

- **Glass Wound:** narrow vertical crystalline tear and luminous grid interior.
- **Wildspace Tear:** diagonal organic rupture, red/gold internal weather, restless debris.
- **Prismatic Fault:** radial polygonal opening, striped alternate surface, sparse colored shards.
- **Melodic Rift Bloom:** petal-like dimensional bloom, aurora flow, and ember release shaped by melody and phrases.

### Native 3D and geometry

- Separate foreground fracture mesh, edge/crack system, shards, and interior scene layer.
- Real thickness on the rift boundary so camera movement reveals parallax.
- Depth-aware compositing between exterior architecture and the interior world.
- Instanced shards with deterministic fracture seeds and bounded motion.
- Optional petal/bloom geometry for the melodic look.

### Audio Intelligence inputs

- `kick`/`bass` — opening pressure and shard displacement.
- `snare`/`transient` — crack propagation, shard glint, and ember release.
- `melodyHeight`/`mid` — bloom spread and interior color movement.
- `vocalPresence` — gentle opening or focus behavior where appropriate.
- `buildProgress` — crack growth and increasing aperture tension.
- `phrase` — aurora flow, interior-world change, or petal progression.
- `drop` — major opening, burst impulse, camera impact, and debris release.
- `overallEnergy` — internal-world activity and edge brightness.

### Geometry choreography

- Crack propagation must be deterministic and derived from authored fracture paths.
- Build increases edge activity and opening pressure without prematurely triggering the full reveal.
- Drop expands the opening and releases shards through bounded envelopes.
- Choreography may target exterior edge, interior world, shards, petals, and camera independently.

### Camera, lighting, and effects

- Distant establish, orbit inspection, pre-drop focus, impact/handheld drop shot, and retreat.
- Exterior remains darker than the interior so the opening reads immediately.
- Use refraction, HDR bloom, controlled aberration, depth-aware haze, and optional trails.
- Interior light should illuminate the rift edge and nearby shards.

### User controls

- Master Intensity, Auto Performance, BPM Sync, Camera Motion, Look.
- Opening Amount/Shape, Edge Complexity, Crack Progress, Rift Thickness.
- Shard Density, Shard Drift, Inner Depth, Interior Style, Petal Count.
- Turbulence, Aurora Flow, Ember Density, Refraction, Distortion, Bloom.
- Exterior, Edge, Interior Primary/Secondary, Accent, and Background colors.

### Completion checklist

- [ ] Foreground, edge, shard, and interior layers have correct depth and parallax.
- [ ] Four authored looks retain distinct silhouettes and behavior.
- [ ] Build/drop choreography is visible, bounded, and deterministic.
- [ ] Interior rendering and refraction stay within per-tier render-target budgets.
- [ ] Lifecycle, context recovery, real-browser acceptance, and owner review pass.

---

## 6. Liquid Forms 2.0

**Status:** [ ] Not started  
**Priority:** 6  
**Decision:** Rebuild + Enhance  
**Legacy source:** Liquid Metaballs

### Creative identity

Viscous luminous forms that merge, separate, breathe, and deform smoothly. Motion should communicate mass and viscosity rather than flicker or arbitrary noise.

### Native 3D and geometry

- Use a bounded SDF/raymarch volume or another depth-aware native liquid representation.
- Provide correct scene depth so haze, floor, camera, and later effects can interact with the liquid.
- Support multiple stable emitters/blobs with deterministic trajectories.
- Materials should expose diffuse color, emissive core, reflection/specular response, opacity/transmission where supported, and surface distortion.
- Optional floor proximity or suspended-volume modes may be evaluated during visual design.

### Audio Intelligence inputs

- `kick` — short merge/scale impulse.
- `snare`/`highs` — specular highlight and surface ripple.
- `subBass` — viscosity and mass pressure.
- `overallEnergy` — motion speed and baseline activity.
- `buildProgress` — increasing turbulence and merge pressure.
- `phrase` — slow breath or arrangement change.
- `drop` — large surface displacement and bounded expansion.

### Geometry choreography

- Choreography targets: scale, separation, merge pressure, viscosity, turbulence, surface ripple, emissive core, and highlight intensity.
- Continuous signals must be heavily smoothed to preserve a fluid read.
- Triggered impacts must decay without causing topology popping.
- User-defined blob count, base scale, viscosity, and material remain authoritative.

### Camera, lighting, and effects

- Locked hero composition, slow orbit, gentle dolly, and restrained Auto Director options.
- Studio/HDR environment reflections and a small authored light rig.
- Reflective floor only if it materially improves the composition.
- Use HDR bloom, cinematic finish, and minimal aberration; avoid trails that undermine the liquid surface.

### User controls

- Master Intensity, Auto Performance, BPM Sync, Camera Motion.
- Blob Count, Scale, Separation, Viscosity, Merge Strength.
- Motion Speed, Turbulence, Surface Detail, Reflection, Emission.
- Floor/Environment controls if retained after visual prototyping.
- Primary, Secondary, Core, Highlight, and Background colors.

### Completion checklist

- [ ] Static liquid reads as volumetric, reflective, and physically coherent.
- [ ] Merge/separation remains temporally stable with no topology flicker.
- [ ] All audio routes preserve smooth fluid motion.
- [ ] Raymarch/geometry cost is bounded by quality tier and measured in a real browser.
- [ ] Depth, lifecycle, context recovery, visual acceptance, and owner review pass.

---

## 7. Mirror Dimension 2.0

**Status:** [ ] Not started  
**Priority:** Second wave  
**Decision:** Consolidate + Rebuild  
**Legacy sources:** Sixfold Chamber, Crystal Mandala, Infinite Gallery

### Creative identity

A readable mirrored architectural space that folds, repeats, and snaps into radial relationships while preserving a strong center and navigable depth.

### Authored looks

- **Sixfold Chamber:** six-way room, moderate recursion, readable facet locking.
- **Crystal Mandala:** twelvefold radial crystal mechanism with dense rotation and sharp musical snaps.
- **Infinite Gallery:** four mirrored corridors with slow travel and architectural depth.

### Native 3D, audio, and choreography

- Build real chamber/corridor geometry first; use engine-owned history or bounded reflection passes for repetition.
- Do not depend on unlimited recursive mirrors.
- `beat` controls facet snap; `bass` controls fold pressure; `bar`/`phrase` change symmetry or chamber relationship; `build` increases fold/recursion pressure; `drop` performs the major reveal.
- Camera options: locked center, orbit, slow gallery travel, and Auto Director within strict safe ranges.
- User controls: symmetry, chamber depth, fold, snap, feedback/repetition, drift, rotation, reflection strength, haze, bloom, and palette.

### Completion checklist

- [ ] Reflection/repetition technique is selected from measured prototypes.
- [ ] Three authored looks remain readable at their intended symmetry counts.
- [ ] Render-history use is engine-owned and resets correctly.
- [ ] Quality tiers bound reflection resolution, recursion approximation, and geometry.
- [ ] Real-browser visual acceptance and owner review pass.

---

## 8. Depth architectural modes

**Status:** [ ] Not started  
**Decision:** Enhance + Consolidate  
**Destination:** Existing Depth keeper  
**Legacy sources:** Prism Tunnel, Prism Transit, Obsidian Vault

### Planned modes

- **Prism Tunnel:** radial prism field, curvature/warp, glow impacts, phrase-scale rotation.
- **Prism Transit:** fast pillar tunnel, lateral camera movement, alternating light lanes, thin haze.
- **Obsidian Vault:** slow broad octagonal vaults, heavy fog, sparse white/green guide lights.

### Required work

- [ ] Decide whether modes alter only layout/materials or require new procedural geometry families.
- [ ] Preserve Depth's existing light-program addressing and Auto Performance authority rules.
- [ ] Map kick to depth/radius, snare to warp or lane accent, bass to travel, build to acceleration/recruitment, phrase to rotation/layout, and drop to bounded warp/reveal.
- [ ] Add geometry and camera modes without regressing the existing square-portal composition.
- [ ] Verify all modes across Depth's quality tiers and seamless repeat boundary.
- [ ] Complete visual acceptance and owner review.

---

## 9. Electric Storm environment modes

**Status:** [ ] Not started  
**Decision:** Enhance + Consolidate  
**Destination:** Existing Electric Storm 2.0 keeper  
**Legacy sources:** Tempest Eye, Electric Front, Ashen Cyclone

### Planned modes

- **Tempest Eye:** dense spiral clouds, deep central eye, debris, branching lightning.
- **Electric Front:** thin fast cloud front with frequent transient-driven bolts.
- **Ashen Cyclone:** slow black ash vortex, heavy debris and fog, infrequent lightning.

### Required work

- [ ] Add quality-bounded cloud/vortex and debris layers without adding a second lightning authority.
- [ ] Retain native Electric Storm strike topology and thunder envelope.
- [ ] Route bass to vortex/cloud pressure, snare/transients to strike intent, volume to debris/wind, build to storm organization, and drop to major strike tier plus camera/environment impact.
- [ ] Use deterministic particles and engine-owned volumetric resources.
- [ ] Verify that low quality preserves the storm silhouette and strike readability.
- [ ] Complete visual acceptance and owner review.

---

## 10. Echowave/Echoform signal mode

**Status:** [ ] Not started  
**Decision:** Enhance + Consolidate  
**Destination:** Existing Echowave or Echoform keeper, selected during design review  
**Legacy source:** Signal DNA

### Required work

- [ ] Preserve branded signal ribbons, deliberate repetition, interruption, scanning, echo spacing, and logo refraction.
- [ ] Determine whether the mode best extends Echowave's wordmark point cloud or Echoform's reconstruction language.
- [ ] Map kick to echo spacing, snare to refraction, hats/highs to scanning, energy to repetition, vocals to logo focus, phrase to echo expansion, and drop to interruption.
- [ ] Use native media/vector assets, scene depth, camera, and managed effects.
- [ ] Complete user-authority, quality, visual acceptance, and owner review.

---

## 11. Interlock/Afterhours lattice mode

**Status:** [ ] Not started  
**Decision:** Enhance or Skip after prototype  
**Destination:** Interlock or Afterhours 2.0  
**Legacy source:** Laser Lattice Overdrive

### Required work

- [ ] Prototype a genuine world-space lattice of precise planes/blades and verify it is visually distinct from current Interlock segments and Afterhours beams.
- [ ] Preserve geometry recruitment in musical blocks, quantized rotation, depth steps, blade intersections, and drop scatter.
- [ ] Map kick to depth, snare to blade width, hats to rotation, energy to density, build to overdrive, phrase to depth step, and drop to bounded scatter.
- [ ] If the prototype is not distinct, mark the independent concept skipped and retain only useful choreography vocabulary.
- [ ] Complete quality, safety, visual acceptance, and owner review if retained.

---

## 12. SAY IT deformation mode

**Status:** [ ] Not started  
**Decision:** Enhance + Consolidate  
**Destination:** Existing SAY IT keeper  
**Legacy source:** Wobble Glyph Forge

### Required work

- [ ] Add an authored deformation/forge motion family without compromising text readability.
- [ ] Preserve bass wobble, body scale impacts, symmetry cadence, ornament/detail recruitment, controlled fragmentation, and brand-core focus.
- [ ] Map kick to body scale, bass to wobble, snare/highs to detail, build to fragmentation, phrase to symmetry, vocals to focus, and drop to bounded displacement.
- [ ] Manual motion/deformation selection must disable automation for that domain.
- [ ] Verify one-line/two-line limits, safe framing, quality tiers, visual acceptance, and owner review.

---

## 13. Legacy disposition matrix

This table accounts for every active legacy source and provides the single checkbox used when its planned disposition is complete.

### Shader scenes

| Done | Legacy preset | Decision | Cinema 2.0 destination |
|---|---|---|---|
| [ ] | Prism Tunnel | Enhance | Depth architectural modes |
| [ ] | Liquid Metaballs | Rebuild | Liquid Forms 2.0 |
| [ ] | Signal DNA | Enhance | Echowave/Echoform signal mode |
| [x] | Reactor | Ported | Reactor 2.0 |
| [x] | Bass Cathedral | Consolidated | Cathedral 2.0 |
| [ ] | Laser Lattice Overdrive | Enhance/Skip after prototype | Interlock/Afterhours lattice mode |
| [ ] | Wobble Glyph Forge | Enhance | SAY IT deformation mode |
| [ ] | Melodic Rift Bloom | Consolidate | Rift Bloom 2.0 |

### Cinematic Worlds

| Done | Legacy preset | Decision | Cinema 2.0 destination |
|---|---|---|---|
| [~] | Singularity Crown | Consolidate | Event Horizon 2.0 — implemented, awaiting visual acceptance |
| [~] | Quasar Maw | Consolidate | Event Horizon 2.0 — implemented, awaiting visual acceptance |
| [~] | Binary Collapse | Consolidate | Event Horizon 2.0 — implemented, awaiting visual acceptance |
| [x] | Cathedral Run | Consolidated | Cathedral 2.0 |
| [ ] | Prism Transit | Enhance | Depth architectural modes |
| [ ] | Obsidian Vault | Enhance | Depth architectural modes |
| [ ] | Glass Wound | Consolidate | Rift Bloom 2.0 |
| [ ] | Wildspace Tear | Consolidate | Rift Bloom 2.0 |
| [ ] | Prismatic Fault | Consolidate | Rift Bloom 2.0 |
| [ ] | Sixfold Chamber | Consolidate | Mirror Dimension 2.0 |
| [ ] | Crystal Mandala | Consolidate | Mirror Dimension 2.0 |
| [ ] | Infinite Gallery | Consolidate | Mirror Dimension 2.0 |
| [~] | Oracle Lock | Consolidate | Ancient Machine 2.0 — implemented, awaiting visual acceptance |
| [~] | Gear Sun | Consolidate | Ancient Machine 2.0 — implemented, awaiting visual acceptance |
| [~] | Epoch Engine | Consolidate | Ancient Machine 2.0 — implemented, awaiting visual acceptance |
| [ ] | Tempest Eye | Enhance | Electric Storm environment modes |
| [ ] | Electric Front | Enhance | Electric Storm environment modes |
| [ ] | Ashen Cyclone | Enhance | Electric Storm environment modes |
| [x] | Electric Storm | Ported | Electric Storm 2.0 core |
| [x] | Afterhours | Ported | Afterhours 2.0 core |
| [~] | Orbital Prism Array | Consolidate | Constellation 2.0 orbital mode — implemented, awaiting visual acceptance |
| [~] | Crimson Collapse | Consolidate | Constellation 2.0 — implemented, awaiting visual acceptance |
| [~] | Cyan Reverie | Consolidate | Constellation 2.0 — implemented, awaiting visual acceptance |
| [~] | Monolith Breaker | Consolidate | Constellation 2.0 — implemented, awaiting visual acceptance |
| [~] | Trapwire | Consolidate | Constellation 2.0 — implemented, awaiting visual acceptance |
| [~] | Prism House | Consolidate | Constellation 2.0 — implemented, awaiting visual acceptance |
| [~] | Industrial Lattice | Consolidate | Constellation 2.0 — implemented, awaiting visual acceptance |
| [~] | Aurora Bloom | Consolidate | Constellation 2.0 — implemented, awaiting visual acceptance |
| [~] | Minimal Skeleton | Consolidate | Constellation 2.0 low-quality profile — implemented, awaiting visual acceptance |
| [~] | Crystal Synapse | Consolidate | Constellation 2.0 legacy look — implemented, awaiting visual acceptance |
| [~] | Helix Reliquary | Consolidate | Constellation 2.0 legacy look — implemented, awaiting visual acceptance |
| [~] | Polyhedral Supernova | Consolidate | Constellation 2.0 legacy look — implemented, awaiting visual acceptance |

---

## Definition of done for every open item

An item may be marked complete only after all applicable requirements below are satisfied:

- [ ] The intended static visual composition is approved before reactive behavior is treated as complete.
- [ ] The implementation is a native `Cinema2NativePresetManifest` or a deliberate enhancement to an existing native keeper.
- [ ] Visual geometry, coordinate space, pivots, safe bounds, and scale behavior are documented.
- [ ] Every user-facing control visibly affects a consumed native target.
- [ ] Audio Intelligence is the sole source of musical facts; no preset-local beat, BPM, phrase, section, build, or drop detector exists.
- [ ] Choreography uses compiled Cinema 2.0 targets and bounded modulation envelopes.
- [ ] User-owned, user-base-plus-modulation, and intelligence-owned domains are explicit.
- [ ] Manual edits reclaim authority from automatic control for the edited domain.
- [ ] Camera, lighting, environment, effects, media, render targets, history, and GPU resources remain engine-owned.
- [ ] Random behavior uses deterministic engine-owned streams and survives pause, seek, restart, and export correctly.
- [ ] Low, medium, and high quality modes have authored budgets and meaningful degradation behavior.
- [ ] Missing optional capabilities degrade as unavailable rather than fabricated zero-value data.
- [ ] Focused compiler, runtime, choreography, parameter-authority, lifecycle, and resource tests pass.
- [ ] At least one test enters the real `Cinema2Runtime.create()` production service path.
- [ ] Real-browser visual acceptance covers static composition, representative music states, aspect ratios, and quality tiers.
- [ ] Preset switching, disposal, failure, and context loss/recovery leave no leaked resources or stale history.
- [ ] Documentation and first-party catalog registration are updated.
- [ ] Final owner visual review is complete.

## Recommended execution order

1. Cathedral 2.0
2. Ancient Machine 2.0
3. Event Horizon 2.0
4. Constellation 2.0
5. Rift Bloom 2.0
6. Liquid Forms 2.0
7. Depth architectural modes
8. Electric Storm environment modes
9. Echowave/Echoform signal mode
10. SAY IT deformation mode
11. Interlock/Afterhours lattice prototype
12. Mirror Dimension 2.0

The order intentionally starts with concepts that can reuse proven Cinema 2.0 architecture and then proceeds toward systems requiring specialized simulation, refraction, liquid rendering, or bounded recursive-reflection techniques.
