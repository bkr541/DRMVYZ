# PURITY — native Cinema 2.0 architectural light instrument

Status: native first-party **reference** preset; not promoted to keeper. User-approved implementation scope combines two recordings: a cold industrial travelling light corridor and a stationary architectural installation with individually changing illuminated faces. Final in-app visual acceptance is separate from permission to implement all phases.

## Specification and ownership

| Owner | Responsibility |
| --- | --- |
| `Cinema2PurityPreset` | Stable IDs, parameter schema, world scene, camera, render graph, palette, musical rules and mood drives |
| `Cinema2PurityNativeModule` | Read final targets, shared beat clock, transport discontinuities, effective trigger policy, runtime phase and leased renderer |
| `Cinema2PurityPatterns` | Twelve pattern IDs, runtime-only base/performing selection, 320 ms crossfade, bounded temporary build/drop overrides |
| `Cinema2PurityRenderer` | Instanced 3D housings and UV-addressed faces, side/ceiling panels, peripheral angled beams, material lighting, depth testing and GPU disposal |
| Existing Cinema 2.0 runtime | Audio Intelligence, Visual Director, Mood Conductor, choreography evaluation, target resolution, camera safety, production canvas/output, quality and history |
| Existing effects | Depth-aware reflective floor → atmosphere → HDR bloom → horizontal glare → cinematic finish |
| Existing Inspector and catalog | Four Design parents, live values, automatic lock/choosing notes, preset registration and saved state |

No local FFT, detector, independent musical timeline, secondary canvas, video texture, custom Inspector, or output path. Architecture is procedural, with a clear central passage, three portal assemblies per bay, genuinely extruded metal supports, separate emissive front/side faces, and alternating thin diagonal beams. Floor uses the shared virtual reflective-plane effect; reflections are screen-space approximations, not ray-traced mirrors. Light patterns are UV masks on the actual physical faces rather than composited screen overlays. Metal details are procedural brushed/edge shading. The apparent camera traversal is achieved by advancing and recycling world bays along Z; camera itself stays near the origin to keep the shared depth and floor solution numerically stable. There is no copied reference-video content.

## Pattern library

| Pattern | Spatial lighting behavior |
| --- | --- |
| IGNITION | Upward progressive face reveals with phase offset per bay and portal |
| MONOLITH | Solid programmable faces and restrained perimeter light |
| STRATA | Moving horizontal bands on each face |
| PILLAR | Narrow vertical arrays |
| MATRIX | Intersecting horizontal and vertical cell boundaries |
| WIREFRAME | Bright physical face edges and perimeter trim |
| FRACTURE | Deterministic larger irregular cells, stepped with shared phase |
| CASCADE | Broken vertical streams with column-specific descent rates |
| RELAY | Structure-group and depth chases |
| SPINE | Isolated thin axial stripe down each addressed face |
| CROSSWIRE | Intersecting diagonal face bands and prominent peripheral angled beams |
| ECLIPSE | Near blackout, minimal outline and staggered reveals |

All patterns share the same physical geometry and may crossfade without resource rebuilds. Density changes rows/columns; contrast affects the difference between dormant and active elements. The eclipse pattern applies the blackout-depth control independently. Changing Pattern selects the base immediately, does not write Pattern Change, and rejects a held event. A new qualifying event advances the runtime base in the listed cycle only when effective Pattern Change is on. Trigger is shown only when saved/effective Pattern Change permits it according to shared Inspector policy. The exact shared 11 trigger values are beat, kick, snare, downbeat, beat2, beat4, bar, bar4, bar8, phrase, drop. The shared Afterhours event resolver identifies each event; publication and event ID checks reject repeated publications and activation/seek/resume events. Auto Performance uses the shared Pattern Control Resolver; a fresh build may substitute CASCADE for up to 4 s and a fresh drop MONOLITH for up to 1.2 s. The runtime base remains separate and resumes when the temporary override ends. No authored values are written by the module.

## Parameter-to-output and authority map

| Design parent | Controls | Visible role / authority |
| --- | --- | --- |
| Master Controls | Auto Performance; BPM Sync; Motion Safety; Flash Accents; Master Intensity; Music Reactivity; Motion Amount; shared quality | Shared policy; shared beat clock; bounded spatial motion; transient light gain permission; light emission; choreography strength; world travel amplitude; bay count/quality |
| Design / Pattern | Pattern; Pattern Change; Trigger | Runtime base, cadence and event identity |
| Design / Architecture | Tunnel Width; Tunnel Depth; Frame Thickness; Structural Detail; Surface Roughness | Corridor half-width, bay spacing, portal housing width, brushed material texture and reflective finish |
| Design / Movement | Travel Speed; Depth Wave | Apparent forward camera movement and peripheral beam sway |
| Design / Camera | Camera Motion; Camera Sway; Field of View; Camera Impact | Shared drift permission/amount, perspective and bounded drop FOV accent |
| Design / Lighting | Perimeter Lighting; Panel Lighting; Perimeter Intensity; Fixture Intensity; Fixture Density; Lighting Chase Speed; Lighting Contrast; Blackout Depth | Independent emitter permissions, intensity per role, address density, chase rate, pattern contrast, eclipse attenuation |
| Effects | Bloom; Bloom Spread; Horizontal Flares; Light Spill; Reflections; Atmosphere; Depth Falloff; Atmospheric Texture; Cinematic Finish; Contrast; Saturation; Vignette; Drop Strength | Shared effect intensity/extent, local spill and screen-space floor reflection, depth haze, distant attenuation, haze texture, finishing, and bounded drop strength |
| Palette | Background; Structural Metal; Panel Surface; Perimeter Light; Panel Light; Accent Light; Atmosphere | Seven separate color bindings; background/sky, housing/floor, wall panels, trim, programmable skins, diagonal accents, haze |

Auto Performance off: authored controls are editable, Pattern Change/Trigger use saved values. Auto on: shared lock disables Design/Effects/Master Controls (except BPM Sync and Auto Performance) and Reset Parameters, retaining layout. Palette is always editable. Numeric driven values use the shared transient target system and live readouts; Pattern Change/Trigger show the shared choosing note. Structural width, spacing and housing thickness are fixed-layout exemptions; Music Reactivity and Camera Impact are user-owned strengths. Hard-disable booleans are not switched on by the module. Turning Auto off restores authored values rather than saving temporary mood drives. Manual Pattern edits while Pattern Change remains enabled rebase immediately.

## Timing, music and mood

`Cinema2BeatClock` supplies motion phase. With BPM Sync and host sync both on it locks to shared analysed/host tempo; otherwise uses its 120 BPM reference timing. Host paused/inactive transport freezes motion; activation/seek/track, publisher, analysis or discontinuity generation changes clear event identity, overrides and travel. The module does not infer beats from wall-clock time. Camera controls remain on the shared camera path.

| Shared signal | Resolved target and visible contribution |
| --- | --- |
| Overall energy, sub | Global emissive strength and halo; sub adds depth-wave rate |
| Bass, low-mid, mid | Local light spill, angled beam gain, panel body and spill |
| High, air, spectral flux | Panel gain and high-band chase speed |
| Vocal presence | Reduced peripheral panel recruitment |
| Beat, kick | Bounded panel/trim accent (flash permission) |
| Snare | Stronger lateral portal accent than center |
| Downbeat | Trim emphasis |
| Bar, phrase | Chase rate, peripheral sweep and phase |
| Section change | Addressable face phase shift |
| Director intensity, momentum, build, impact, variation | Panel recruitment, travel rate, build lift, trim emphasis, phase variation |
| Drop | Bounded panel emphasis, travel boost, shared camera FOV envelope and optional MONOLITH override |

Choreography is sourced solely from existing audio capabilities; non-drop event rules use `not-silent`, all event rules use `once-per-event`, and the drop is not silence-gated. Shared Mood Conductor drives are gated by Auto Performance and scaled by Music Reactivity. Authored drives (default → at full source, before final clamping):

| Control | Baseline | Mood / operation and direction |
| --- | ---: | --- |
| Travel Speed | .7 | momentum ×1.64, calm ×.64 |
| Depth Wave | .45 | build ×1.78 |
| Perimeter Intensity | 1 | peak ×1.3, calm ×.8 |
| Fixture Density | .65 | complexity +.2 |
| Lighting Chase Speed | .6 | drive ×1.58 |
| Light Spill | .65 | brightness ×1.31 |
| Master Intensity | 1 | silence ×.1 |
| Fixture Intensity | .85 | silence ×.06 |
| Bloom | .45 | peak ×1.44 |
| Atmosphere | .012 | tense ×1.67 |
| Horizontal Flares | .22 | peak ×1.4 |

Remaining eligible numeric controls are handled by canonical `withCinema2AutoCoverage` (catalog expansion, range-clamped and baseline-relative, zero-preserving for zero-based controls). `computeCinema2AutoCoverage` returns the exact source, value and target for those drives. The native manifest plus coverage both compile. Silence reduces light and travel under Auto; no private analyser or mood generator. The shared Inspector receives the same parameter bindings the actual render and effects consume.

## Performance and lifecycle

One world draw uses a fixed 2,048-instance allocation; 10/16/22 bay tiers; at default controls the maximum 22-bay stream is 1,716 boxes = 20,592 triangles, with no per-frame GPU allocation. Shared quality also controls post-processing. Renderer resources are leased from the runtime; partially allocated resources cleaned on setup failure and disposal idempotent. Scene depth is required; the target requests HDR with rgba8 fallback. No asset upload or external content.

## Validation and release gate

- Focused TypeScript/Vitest file: `src/components/vyzualz/cinema2/__tests__/Cinema2PurityPreset.test.ts`.
- Production browser harness: `npm run test:e2e:cinema2-purity`, captures all 12 patterns, static control/palette extremes, motion, audio, BPM Sync, pause, seek, 11 triggers, duplicate suppression, manual selection, Inspector locking/no row shift, resize and re-entry. Run after dependency and Chromium installation.
- In this implementation environment the real authoring gate, native compiler (raw and coverage-expanded), finite instance bounds, and 11 controller trigger identity cases were executed through a dependency-free TypeScript loader and passed. The actual vertex and fragment shaders also compiled and linked in an isolated Mesa OpenGL ES 3.2 context. The cumulative Git patch passed a clean-baseline `git apply --check --whitespace=error-all`. Registry-level Vitest and the production browser suite could not be executed: package registry DNS was unavailable (`EAI_AGAIN`), and browser WebGL2 creation returned null. Full typecheck, app casting, actual GPU budget, real production pixel captures, full Inspector acceptance and human comparison to the reference remain required.
- Do not promote the catalog role to keeper until the production checks pass and the user reviews the actual preset. There is no legacy preset to port or A/B compare.
