# PURITY — native Cinema 2.0 architectural light instrument

Status: native first-party **reference** preset; not promoted to keeper. User-approved implementation scope combines two recordings: a cold industrial travelling light corridor and a stationary architectural installation with individually changing illuminated faces. Final in-app visual acceptance is separate from permission to implement all phases.

## Specification and ownership

| Owner | Responsibility |
| --- | --- |
| `Cinema2PurityPreset` | Stable IDs, parameter schema, world scene, camera, render graph, palette, musical rules and mood drives |
| `Cinema2PurityNativeModule` | Read final targets, shared beat clock, transport discontinuities, effective trigger policy, lighting phase, camera travel diagnostics and leased renderer |
| `Cinema2PurityPatterns` | Eighteen pattern IDs, runtime-only base/performing selection, 320 ms crossfade, bounded temporary build/drop overrides |
| `Cinema2PurityMaze` / `Cinema2PurityArchitecture` | Shared closed route, corridor and junction coordinates, eight architectural silhouettes |
| `Cinema2PurityRenderer` | Instanced 3D housings and UV-addressed faces, side/ceiling panels, peripheral angled beams, material lighting, depth testing and GPU disposal |
| Existing Cinema 2.0 runtime | Audio Intelligence, Visual Director, Mood Conductor, choreography evaluation, target resolution, camera safety, production canvas/output, quality and history |
| Existing effects | Depth-aware reflective floor → atmosphere → HDR bloom → horizontal glare → cinematic finish |
| Existing Inspector and catalog | Four Design parents, live values, automatic lock/choosing notes, preset registration and saved state |

No local FFT, detector, independent musical timeline, secondary canvas, video texture, custom Inspector or output path. A stationary, closed maze contains Threshold, Crosswire, Prism, Zigzag, Cathedral, Obsidian, Slalom and Nexus zones. The shared world camera follows a constant-distance spline through open junctions, at 1.7 units above the existing floor. The opt-in POV controls integrate pace smoothly and preserve the path position on pause, zero speed and Lock Off. Reduced Motion scales rate, not path position. Camera Motion only governs gait/lens accents. Manual walk/jog/run use saved speed; Adaptive uses the shared resolved mood speed. All post effects receive the actual shared camera. The four layout choices change fixture silhouettes without moving the route. The reflective floor is still the existing screen-space approximation. Local light spill is an analytical distance falloff from a nearby fixture and its current pattern; it is not ray-traced global illumination. No reference media is copied.

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
| GUIDANCE | Light wave ahead of the viewer |
| PURSUIT | Fast traveling wave overtakes the viewer |
| INTERLOCK | Alternating diagonals and complementary groups |
| DOMINO | Accumulating sequential structure selection |
| CONVERGENCE | Counter-propagating pulses |
| AFTERIMAGE | Diminishing illumination behind the viewer |

All patterns share the same physical geometry and may crossfade without resource rebuilds. Density changes rows/columns; contrast affects the difference between dormant and active elements. The eclipse pattern applies the blackout-depth control independently. Changing Pattern selects the base immediately, does not write Pattern Change, and rejects a held event. A new qualifying event advances the runtime base in the listed cycle only when effective Pattern Change is on. Trigger is shown only when saved/effective Pattern Change permits it according to shared Inspector policy. The exact shared 11 trigger values are beat, kick, snare, downbeat, beat2, beat4, bar, bar4, bar8, phrase, drop. The shared Afterhours event resolver identifies each event; publication and event ID checks reject repeated publications and activation/seek/resume events. Auto Performance uses the shared Pattern Control Resolver; a fresh build may substitute CASCADE for up to 4 s and a fresh drop MONOLITH for up to 1.2 s. The runtime base remains separate and resumes when the temporary override ends. No authored values are written by the module.

## Parameter-to-output and authority map

| Design parent | Controls | Visible role / authority |
| --- | --- | --- |
| Master Controls | Auto Performance; BPM Sync; Motion Safety; Flash Accents; Master Intensity; Music Reactivity; Motion Amount; shared quality | Shared policy; shared beat clock; bounded spatial motion; transient light gain permission; light emission; choreography strength; world travel amplitude; structural detail quality |
| Design / Pattern | Pattern; Pattern Change; Trigger | Runtime base, cadence and event identity |
| Design / Architecture | Maze Layout; Corridor Width; Zone Length; Frame Thickness; Structural Detail; Surface Roughness | Installation vocabulary, corridor half-width, fixture spacing, portal housing width, brushed material texture and reflective finish |
| Design / Movement | Traversal Mode; Travel Speed; Acceleration; Corner Anticipation; Head Bob; Depth Wave | Shared world-camera gait, speed easing, look-ahead, vertical motion and stationary accent modulation |
| Design / Camera | Camera Motion; Camera Sway; Field of View; Camera Impact | Shared drift permission/amount, perspective and bounded drop FOV accent |
| Design / Lighting | Perimeter Lighting; Panel Lighting; Perimeter Intensity; Fixture Intensity; Fixture Density; Lighting Chase Speed; Lighting Contrast; Blackout Depth; Light Localization | Independent emitter permissions, intensity per role, address density, chase rate, pattern contrast, eclipse attenuation and distance-based light falloff |
| Effects | Bloom; Bloom Spread; Horizontal Flares; Light Spill; Reflections; Atmosphere; Depth Falloff; Atmospheric Texture; Cinematic Finish; Contrast; Saturation; Vignette; Drop Strength | Shared effect intensity/extent, local spill and screen-space floor reflection, depth haze, distant attenuation, haze texture, finishing, and bounded drop strength |
| Palette | Background; Structural Metal; Panel Surface; Perimeter Light; Panel Light; Accent Light; Atmosphere | Seven separate color bindings; background/sky, housing/floor, wall panels, trim, programmable skins, diagonal accents, haze |

Auto Performance off: authored controls are editable, Pattern Change/Trigger use saved values. Auto on: shared lock disables Design/Effects/Master Controls (except BPM Sync and Auto Performance) and Reset Parameters, retaining layout. Palette is always editable. Numeric driven values use the shared transient target system and live readouts; Pattern Change/Trigger show the shared choosing note. Structural width, spacing and housing thickness are fixed-layout exemptions; Music Reactivity and Camera Impact are user-owned strengths. Hard-disable booleans are not switched on by the module. Turning Auto off restores authored values rather than saving temporary mood drives. Manual Pattern edits while Pattern Change remains enabled rebase immediately.

## Timing, music and mood

`Cinema2BeatClock` supplies lighting phase; shared camera runtime integrates world traversal. With BPM Sync and host sync both on it locks to shared analysed/host tempo; otherwise uses its 120 BPM reference timing. Host paused/inactive transport freezes motion; activation/seek/track, publisher, analysis or discontinuity generation changes clear event identity, overrides and travel. The module does not infer beats from wall-clock time. Camera controls remain on the shared camera path.

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
| Travel Speed | .7 | momentum ×2.15, calm ×.64, build ×1.65, peak ×2.1, silence ×.1 |
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

One world draw uses the fixed 2,048-instance allocation. Geometry has yaw and roll transforms and per-instance fixture spill data. Distant bays are conservatively culled only beyond the shared camera-relative fade distance. Quality changes optional structural ribs, not the route or primary light installations. No extra model assets or post passes. GPU buffers are leased and released using existing lifecycle rules.

## Validation and release gate

- Focused TypeScript/Vitest file: `src/components/vyzualz/cinema2/__tests__/Cinema2PurityPreset.test.ts`.
- Production browser harness: `npm run test:e2e:cinema2-purity`, captures all 18 patterns, static control/palette extremes, motion, audio, BPM Sync, pause, seek, 11 triggers, duplicate suppression, manual selection, Inspector locking/no row shift, resize and re-entry. Run after dependency and Chromium installation.
- Validate raw and auto-expanded manifest compilation, eight-zone clearance at minimum width and all layout variants, stationary fixture transforms, bounded instance counts and path hold/resume. Run the full production browser harness and compare the in-app visual against the recordings before promotion. No full application visual acceptance is implied by isolated checks.
- Do not promote the catalog role to keeper until the production checks pass and the user reviews the actual preset. There is no legacy preset to port or A/B compare.
