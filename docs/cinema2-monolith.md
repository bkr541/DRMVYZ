# MONOLITH | Alien energy reactor

## Visual specification and acceptance boundary

Selectable first-party **reference** preset, not a keeper. The supplied written specification is the visual target; no separate concept image was attached to this implementation request. Geometry-derived near-field shadow projections, independently shaded solid struts, a luminous heart, a world-space architectural chamber and shared camera movement are required. No static image, video, new engine or separate audio clock.

## Native implementation and design

- Sculpture: Three counter-rotating nested seven-level lattice cages, eight articulated blade trusses, central elongated cage/core and three independently tilted segmented rings.
- Environment: 32-sided radial reactor chamber with radial columns, concentric floor and overhead ring structures.
- Shared preset-family infrastructure: `modules/artifacts/ArtifactDomain.ts`, `ArtifactRenderer.ts`, `ArtifactSelection.ts`, `Cinema2ArtifactNativeModule.ts`, and `Cinema2ArtifactPresets.ts`. The geometry and parameter/pattern specification lives in its own `Monolith.ts`; the four independent manifest and native type IDs are not variations of ORGANISM.
- Three instanced cylinder batches: primary structural metal, secondary braces, emissive channels. Each is a true shadow caster. Independent core mesh, chamber wall/floor materials, shared atmospheric tint. Chamber color also supplies the environment background. No per-frame GPU geometry or material recreation; sampled CPU point arrays are currently regenerated each frame.
- Two independently orbiting physical spotlights, position driven by the projection distance, profile, shared rhythmic/Director accents and phase. Fixed 256/512/1024 shadow maps at low/medium/high quality. Bias and normal bias, PCF radius control, controlled ambient/overhead fill. These lights target different wall regions, not guaranteed simultaneous whole-chamber coverage. Actual projected contrast and visibility must be reviewed on the production canvas.
- Camera uses shared static, director path, orbit and close-detail rigs. FOV 42–74 degrees, near .12 and far 60; bounded shared positions and small offset. Close-detail approaches stay outside the intended central envelope where possible; there is no collision solver or verified interior traversal. The camera hard motion toggle and shared motion safety remain authoritative.
- The native world provider renders into the existing depth-enabled scene pass, followed by shared depth-aware atmosphere, HDR bloom and cinematic finish. Existing production output/casting path is used; casting itself has not been exercised.

## Eight pattern profiles

STANDBY: compact; IGNITION: rising energy profile; TELESCOPE: tall extension; GYROSCOPE: ring speed and tilt; UNLOCK: blade deployment; CONVERGENCE: contracting cage; OVERDRIVE: high extension and rotation; DISCHARGE: broad release and close projectors.

Manual pattern selection rebases immediately. Automatic transitions interpolate the profile over .55 seconds (PARADOX also interpolates sampled path positions), using the shared mainframe pattern controller. Pattern Change defaults OFF; the saved Trigger is hidden while OFF, not reset. The eleven canonical triggers are Beat, Kick, Snare, Downbeat, Every 2 Beats, Every 4 Beats, Bar, Every 4 Bars, Every 8 Bars, Phrase and Drop. Shared resolver selects effective values; qualified identities are deduplicated, and drop is not silence-gated. Auto build/drop overrides are temporary (4/1.5 seconds), never write saved parameters, and restore the base. Patterns are profile-driven structural compositions; the exact cinematic sequencing and visual fidelity are not established by the offline tests.

## Authority and musical mapping

| Domain | Manual authority | Shared music / Auto Performance |
|---|---|---|
| Master gain, reactivity, motion | Authored base; motion safety and flash settings limit spatial or transient motion | Shared envelope strength and mood drives. Auto locks numeric controls; Auto and BPM remain editable. |
| Pattern/Pattern Change/Trigger | Authored base, conditional Trigger, canonical shared events | Effective pattern policy; temporary build/drop override. Manual takeover cancels stale override. |
| Structure, articulation, core | Authored parameter ranges; optional geometry enable is a hard permission | Bounded structural response, shared Director and mood contributions; no saved edits. |
| Shadows | Authored distance, speed, intensity, softness | Bass/Director magnification, kick/snare direction, phrase travel and drop accent. |
| Camera | Authored rig, motion permission, speed, amount, FOV | Shared tempo path, shared drop FOV envelope and Auto coverage; no separate camera clock. |
| Effects | Authored mix, exposure, haze, bloom, contrast, vignette | Shared effect targets and mood coverage. |
| Palette | Six independent authored colors | Never automatically rewritten; editable during Auto. |

Sub and kick increase telescope pressure; bass widens the cage; snare alternates blade tilt; mid and high drive sequential luminous pathways; build deploys blades; drop extends the assembly. Shared high/air/mid/flux drive selective strut illumination, vocal reduces movement, Director momentum/variation modifies phase, intensity modifies the core, impact affects projection distance and energy. Idle uses reduced free-running phase. BPM Sync requires preset and dock permission for the native beat clock; shared camera uses its canonical tempo controls. Native free-running reference is 100 BPM. Source, track, publication, analysis and seek discontinuities rebase clock, selection and event identities. Pause freezes phase; no previous-track event should advance the base.

Shared choreography defines continuous replacement of dedicated zero-default transient channels, with reactivity as strength and not-silent condition: overall energy 200 ms; sub 140; bass 90; low-mid 140; mid 110; high 65; air 120; flux 85; vocal 220; Director intensity 120, momentum 95, build 140, impact 45 and variation 120. Shared once-per-event envelopes (attack/hold/release seconds): beat .02/.025/.18; kick .015/.04/.32; snare .015/.03/.25; downbeat .025/.08/.35; bar .05/.1/.4; phrase .08/.2/.65; section .1/.1/.75; drop .03/.15/1.1. Drop is not silence-gated. Camera drop FOV add -3 degrees, .08/.1/.8 seconds, gated by camera motion. All target values are transient and bounded by runtime resolution.

### Mood drive table

| Target | Source | Operation | Strength at full mood |
|---|---|---|---:|
| telescope | mood.build | add | 0.35 |
| bladeExtension | mood.peak | add | 0.35 |
| ringSpeed | mood.momentum | multiply | 1.5 |
| motionRate | mood.momentum | multiply | 1.4 |
| motionRate | mood.calm | multiply | 0.65 |
| projectionIntensity | mood.peak | multiply | 1.25 |
| intensity | mood.silence | multiply | 0.12 |
| bloom | mood.peak | multiply | 1.25 |
| haze | mood.tense | multiply | 1.35 |

Shared catalog Auto coverage supplies remaining numeric drives. Reactivity scales authored mood drives; the shared pattern-control resolver receives automatic authority only with reactivity above zero. The shared Inspector owns locking, live resolved values and reset availability. Neither local inspector code nor persistence is modified.

## Parameter inventory (authored manifest)

| Parent | Control | Default | Range / step | Visible target |
|---|---|---|---|---|
| shared | Quality / Performance | `"auto"` | discrete/color | Auto adapts render cost to frame time. Performance favors headroom; Quality favors detail. |
| master-controls | Auto Performance | `false` | discrete/color | Let the shared Mood Conductor control the show. |
| master-controls | BPM Sync | `true` | discrete/color | Lock mechanical phase when the Audio Dock permits it; camera uses the shared tempo control. |
| master-controls | Motion Safety | `"full"` | discrete/color | Limit or freeze spatial animation. |
| master-controls | Flash Accents | `"reduced"` | discrete/color | Restrict direct transient illumination. |
| master-controls | Music Reactivity | `1` | 0–1 / 0.01 | Shared audio envelopes and mood response. |
| master-controls | Motion Amount | `0.8` | 0–1 / 0.01 | Extent of breathing and camera movement. |
| master-controls | Master Intensity | `1` | 0–1.6 / 0.01 | Core, luminous struts and projection light gain. |
| design | Pattern | `"standby"` | discrete/color | Select the authored pattern; automatic changes never save over it. |
| design | Pattern Change | `false` | discrete/color | Advance on new qualifying musical events. |
| design | Trigger | `"bar4"` | discrete/color | Canonical shared event that advances the runtime pattern. |
| design | Reactor Height | `1` | 0.7–1.18 / 0.01 | Vertical extent of reactor cage. |
| design | Reactor Width | `1` | 0.7–1.2 / 0.01 | Radial extent of outer lattice. |
| design | Layer Separation | `0.5` | 0–1 / 0.01 | Distance between inner and outer cages. |
| design | Outer Cage Rotation | `0.6` | 0–1 / 0.01 | Rotation rate of counter-rotating cages. |
| design | Blade Extension | `0.5` | 0–1 / 0.01 | Radial deployment of blades. |
| design | Blade Articulation | `0.5` | 0–1 / 0.01 | Blade hinge angle. |
| design | Telescope Amount | `0.6` | 0–1 / 0.01 | Vertical extension of mechanical sections. |
| design | Ring Rotation Speed | `0.65` | 0–1 / 0.01 | Independent ring rotation rate. |
| design | Ring Separation | `0.5` | 0–1 / 0.01 | Vertical spacing of containment rings. |
| design | Axis Variation | `0.6` | 0–1 / 0.01 | Tilt of ring axes. |
| design | Ring Enable | `true` | discrete/color | Enable independently rotating containment rings. |
| design | Structural Density | `0.85` | 0–1 / 0.05 | Amount of secondary diagonal bracing. |
| design | Mechanical Motion Speed | `0.7` | 0–1.5 / 0.01 | Rate of the shared mechanical phase. |
| design | Strut Thickness | `0.045` | 0.018–0.075 / 0.001 | Actual radius of solid lattice rods. |
| design | Core Scale | `1` | 0.7–1.3 / 0.01 | Scale of central cage and heart. |
| design | Core Intensity | `1` | 0–1.6 / 0.01 | Emission gain of central heart. |
| design | Projection Intensity | `0.85` | 0–1.6 / 0.01 | Light illuminating the walls through the lattice. |
| design | Projection Distance | `5.8` | 4.8–7.8 / 0.05 | Move the two light sources closer to enlarge the wall projections. |
| design | Projection Speed | `0.5` | 0–1.2 / 0.01 | Speed of the shadow-casting fixtures around the sculpture. |
| design | Shadow Softness | `1` | 0–3 / 0.05 | Filter radius of the real geometry shadow maps. |
| design | Camera Mode | `"director"` | discrete/color | Select cinematic reveal, horizontal orbit, macro or locked composition. |
| design | Camera Motion | `true` | discrete/color | Hard permission for camera travel. |
| design | Camera Speed | `0.72` | 0–1.4 / 0.01 | Rate of the shared cinematic path. |
| design | Camera Motion Intensity | `0.9` | 0–1 / 0.01 | Scale of the shared camera motion. |
| design | Field of View | `55` | 42–74 / 1 | Base perspective angle. |
| effects | Bloom | `0.55` | 0–1 / 0.01 | Halo from luminous truss edges. |
| effects | Atmosphere Mix | `1` | 0–1 / 0.01 | Blend the shared atmospheric effect. |
| effects | Finish Mix | `1` | 0–1 / 0.01 | Blend the shared cinematic finish. |
| effects | Atmosphere | `0.018` | 0–0.06 / 0.001 | Depth-aware atmospheric scattering. |
| effects | Contrast | `1.13` | 0.8–1.4 / 0.01 | Shared cinematic contrast. |
| effects | Exposure | `1` | 0.55–1.5 / 0.01 | Shared cinematic exposure multiplier. |
| effects | Vignette | `0.25` | 0–0.65 / 0.01 | Peripheral darkening. |
| palette | Reactor Facility | `[0.11, 0.13, 0.16, 1]` | discrete/color | Independent Reactor Facility color. |
| palette | Outer Structural Geometry | `[0.43, 0.47, 0.51, 1]` | discrete/color | Independent Outer Structural Geometry color. |
| palette | Inner Structural Geometry | `[0.28, 0.38, 0.49, 1]` | discrete/color | Independent Inner Structural Geometry color. |
| palette | Energy Pathways | `[0.77, 0.91, 1, 1]` | discrete/color | Independent Energy Pathways color. |
| palette | Reactor Core | `[0.87, 0.96, 1, 1]` | discrete/color | Independent Reactor Core color. |
| palette | Atmosphere | `[0.3, 0.4, 0.55, 1]` | discrete/color | Independent Atmosphere color. |

## Validation and release status

- Actual repository authoring validator and native compiler passed for each authored and shared Auto-covered manifest in the available offline TypeScript execution path; Auto coverage reported zero skipped targets.
- Strict standalone TypeScript check of the pure geometry modules passed. Eight distinct coordinate signatures and 24 pattern/quality combinations per preset with high audio channels were checked for finite bounded geometry and rod counts. Shared pattern controller was checked for all eleven trigger IDs, duplicate suppression and manual takeover.
- `npm ci --offline` failed with ENOTCACHED (zustand); online `npm ci` failed with registry DNS EAI_AGAIN. Attempting the full native registry import offline was blocked by missing `@supabase/supabase-js`. Full TypeScript typecheck, Vitest, production browser and WebGL tests, runtime/cast/resize/Inspector visual acceptance and GPU profiling remain unexecuted.
- Added `Cinema2ArtifactPresets.test.ts` and a production runtime/Inspector browser harness for the four presets. With dependencies and Playwright Chromium installed, run:

```bash
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2ArtifactPresets.test.ts
node scripts/run-cinema2-artifacts-browser.mjs
```

Review static, idle, quiet/vocal, driving, build, drop, phrase, wide, close detail and monumental shadow captures, control extrema and all 32 pattern transitions. Verify actual shadow fidelity, light clipping, camera clearances, per-control visible changes, pause/seek/loop, shared Auto and Inspector semantics, production output and casting; repeat switching including ORGANISM. No capture was fabricated. The preset remains an unapproved reference. No shared-engine changes other than additive registration/exports.
