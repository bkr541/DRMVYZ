# MOSAIC | Kinetic modular media wall

Status: first-party native **reference** preset. Human visual acceptance is pending. No external assets or new dependencies. All scene geometry and procedural media are original repo-local code; the catalog illustration is original SVG/React paths. No user content enters the artwork.

## Scene and camera

The right-handed Three world has Y up, the hero centered at (0,0,0), and the viewing direction toward negative Z. The display rectangle is 8.7 × 4.45 world units, nominally 8 × 5 modules. The 4–12 column and 3–8 row ranges share a maximum capacity of 96 instances. The individual chamfered extruded housings have a front frame, independent screen plane and telescoping rear mount; the room has a recessed service wall, cross channels, deep columns, a floor and overhead strips. The screen sits in front of the frame to avoid coincident faces. Thin seams are intentional; all screens maintain stable fractional UV crops as their matrices move. Border and seam widths are additionally bounded by the tile's short side to prevent negative face dimensions at extreme densities. UV origin is lower-left in the mesh, flipped vertically when sampling top-origin managed textures. Grouped rows/columns/2×2 blocks use local UV rectangles. The three feed wrappers borrow only same-context managed WebGL handles, without a per-tile video element or pixel readback. Missing media has an original procedural waveform/ring image; media disabled displays dark powered-off faces.

The canonical camera starts at (0,.25,7.8), aims at the origin, has a vertical FOV of 42°, near/far .12/65 and minAspect 16:9 fit to width. A small bounded drift is scaled by Camera Amount, the shared safety enum, and BPM Sync; Camera Motion is the hard motion gate. This uses the existing Cinema camera runtime and production projection. Portrait fit widens vertical FOV instead of stretching the grid. No separate editor camera or cast path. Floor/metal reflection is environment-map response, not a planar screen reflection. The key spot casts real Three shadows; the shadow slider adjusts key strength (not an independent shadow-opacity postpass). Actual shadow appearance and all aspect extremes need live verification.

## Authority and parameter-to-output map

All authored values use stable `mosaic-*` IDs (except canonical quality-mode), with the four existing Design parents. The generic Inspector owns lock, live markers, reset, visibility and persistence. The actual Source panel retains the slot/pool actions; no custom overlay or new storage. The media slot is `mosaic-wall-media`. Source and pool selection are user-owned. No code writes back performance values. `U` = user owned; `R` = bounded runtime resolution; `A` = temporary Auto authority; `—` = no ownership. All manual changes affect authored values immediately through the standard schema when unlocked. The camera uses the canonical three-state Motion Safety control, not a separate boolean.

| Property | Manual | Audio | Director | Auto | Manual edit / visible target |
|---|---|---|---|---|---|
| Quality | U | — | — | — | Shared quality policy / shadow and render budget |
| Auto Performance | U | — | — | A grant | Disabling restores authored values, cancels pattern override |
| BPM Sync | U | — | — | — | Shared phase clock, host BPM authority |
| Master Intensity | U | — | — | R | Motion amplitude and frame light |
| Music Reactivity | U | strength | strength | strength | Zero removes rule contributions; exempt from coverage |
| Motion Safety | U | — | — | — | Full/reduced/lockoff, lockoff freezes tile pose and camera |
| Pattern | U | — | — | A | Six programs; shared controller; edit cancels temporary override |
| Pattern Change | U | — | — | A | Effective runtime cycling permission |
| Trigger | U | events | — | A | Eleven canonical options; visibility uses saved Pattern Change |
| Camera Motion | U | — | — | — | Hard disable for drift |
| Camera Amount | U | — | — | R | Bounded camera motion amplitude |
| Columns | U | — | — | — | Instance count and UV layout |
| Rows | U | — | — | — | Instance count and UV layout |
| Gap | U | — | — | — | Physical seams |
| Tile Thickness | U | — | — | — | Extruded body depth, rear attachment |
| Frame Width | U | — | — | — | Screen border width |
| Extrusion | U | R bass/kick | R build | R energy | Depth excursion |
| Tile Rotation | U | R mid/snare | — | R | Angular pivot limit |
| Wave Rate | U | clock | — | R momentum | Phase propagation |
| Scatter Extent | U | R vocal restraint | — | R shock | Lateral offsets |
| Wall Media | U | — | — | — | Existing library slot / stable media ID |
| Source Mode | U | — | — | — | Auto, procedural, single, pool |
| Media Visible | U | — | — | — | Hard disable content and pool loading |
| Media Fit | U | — | — | — | Contain/cover/fill within wall or group |
| Media Layout | U | — | — | — | Continuous or grouped UVs |
| Grouping | U | — | — | — | Rows, columns or blocks, grouped only |
| Media Scale | U | — | — | — | Uniform source UV scale |
| Media X Offset | U | — | — | — | Horizontal source offset |
| Media Y Offset | U | — | — | — | Vertical source offset |
| Media Rotation | U | — | — | — | Source rotation in degrees |
| Media Opacity | U | — | — | — | Blend content against dark screen |
| Media Brightness | U | — | — | — | Content exposure without palette tint |
| Transition Duration | U | — | — | — | Fade from fallback on ready feed change |
| Media Readability | U | R restraint only | — | — | Bounds movement, never disables source |
| Pool Automation | U | event grant | — | — | Separate from Pattern Change; off holds feeds |
| Pool Trigger | U | events | — | — | Eight CANVAS trigger options |
| Frame Emission | U | R high/air | R impact | R build | Frame channel emission |
| Bloom | U | — | — | R peak | Shared HDR output pass |
| Atmosphere | U | — | — | R | Shared depth-aware atmosphere pass |
| Reflection Strength | U | — | — | R | Metal/floor environment intensity |
| Shadow Strength | U | — | — | R | Shadow-casting key strength |
| Light Spill | U | — | — | R brightness | Local point light |
| Cinematic Finish | U | — | — | R | Shared output grade mix |
| Background | U | — | — | — | Environment color #080C12 |
| Structural | U | — | — | — | Housings/wall #25313B |
| Primary Energy | U | — | — | — | Frame and point light #00D8E5 |
| Secondary Energy | U | — | — | — | Rear channels #8460FF |
| Accent | U | — | — | — | Architectural strips #E7F6FF |
| Active named pool ID | U | — | — | — | Existing shared CANVAS pool setting, not a new per-preset record |
| Runtime pool feed indices | — | R | — | — | Authorized pool event only; transient and deterministic |

The shared coverage exemptions protect media placement, opacity, brightness, transition, grid alignment and reactivity from synthesized mood drives. The other uncovered numeric design/effect controls receive existing generic coverage; colors and hard enables are never covered.

## Patterns and musical authority

| Pattern | Geometry and light |
|---|---|
| Mosaic | Mostly aligned wall, shallow traveling pulses |
| Extrusion | Opposed row depth bands and frame pulses |
| Fragmentation | Eased outward displacement, split then reassemble, same UV crop |
| Wave | Traveling sine depth and restrained angular response |
| Reconstruction | Ordered retreat from offsets to planar grid |
| Pixel Relay | Mostly aligned faces with ordered frame light route |

`Cinema2BeatClock` uses host/analyzed BPM, both preset and Audio Dock sync permission, and a 120-BPM fallback (eight beats = four seconds). Wave Rate scales phase; seek, track, analysis/timeline changes reset the volatile clock. Tile positions are damped instead of teleporting when program changes; pause freezes poses. Shared `Cinema2MainframePatternController`, `Cinema2PatternControlResolver` and `Cinema2PatternAutoPerformance` own cycling and overrides. Mood candidates: calm Mosaic/Pixel Relay, driving Wave/Extrusion, tense Reconstruction/Extrusion, peak Fragmentation/Reconstruction. Shared helper handles hold and deterministic boundary choice. Build uses Extrusion, drop Fragmentation for four beats, restoring the underlying program. No local music analysis. Shared silence suppresses ordinary musical event consumption; drop remains ungated. User edit cancels overrides through shared controller. No automatic media ID selection outside the authorized pool.

### Shared audio routes

Continuous paths use shared smoothing, replace a runtime-only 0–1 signal, and are scaled by Music Reactivity. Event envelopes use the existing engine, once per event, and replace their transient signal. Ordinary routes are not-silent; drop is ungated. Final poses apply master intensity, readability and safety bounds.

| Signal | Smoothing or attack / hold / release (ms) | Visible result |
|---|---|---|
| Sub, bass | 160 / 120 | Up to +.20 extrusion contribution |
| Mid | 150 | Up to +6° rotation, bounded by 35° |
| High, air | 100 / 125 | +.15 frame light |
| Overall energy | 180 | +.07 frame light |
| Vocal | 220 | Up to 30% restraint |
| Director build | 200 | +.15 depth pressure, build program when authorized |
| Director impact | 150 | Drop frame accents up to .18 |
| Kick | 30 / 25 / 240 | +.22 alternating row depth |
| Snare | 20 / 20 / 180 | ±.20 normalized tilt |
| Beat | 30 / 20 / 200 | +.07 frame light |
| Downbeat | 55 / 50 / 380 | +.20 spatial frame pulse |
| Phrase | 150 / 100 / 800 | +.12 frame accent |
| Drop | 170 / 100 / 1500 | +.22 depth wave and authorized fragmentation |

### Explicit mood drives

All use the shared mood helper, Auto Performance gating, Music Reactivity scaling, target clamping and baseline-relative contributions. Additional non-exempt numeric controls use the standard catalog coverage.

| Target | Default | Path | Contribution |
|---|---:|---|---|
| Extrusion | .45 | mood.energy | +.20 |
| Scatter Extent | .35 | mood.shock | +.15 |
| Wave Rate | 1 | mood.momentum | ×1–1.35 |
| Frame Emission | .35 | mood.build | +.15 |
| Bloom | .25 | mood.peak | +.08 |
| Light Spill | .30 | mood.brightness | +.10 |
| Extrusion | .45 | mood.silence | −.35 |
| Frame Emission | .35 | mood.silence | −.25 |

## Source workflow and lifecycle

In Source, import/choose existing Media Library images/videos or activate an existing named Pool in Pools. Automatic source mode uses the active pool if present, otherwise the single selected slot; explicit Procedural/Single/Pool modes override this choice. Use Design for presentation, layout, grouping and independent Pool Automation. Pool Trigger uses CANVAS's Beat, 4/6/8/16 bars, Track Sections, Kick Hit, Snare Hit options mapped to authoritative Cinema events. The existing three-channel EVERYWHERE runtime is reused as a local resource lease (not an additional store, decoder per panel, or duplicated pool CRUD). It holds ready resources during decode, ignores stale async work on reset, and disposes on scene exit. Pool automation off loads the initial eligible feeds and holds them. Continuous mode shows one feed at a time with up to three managed pool feeds prepared; grouped mode distributes up to three across logical groups. A separately assigned single slot may remain loaded by the shared host. The source bridge keeps CANVAS's globally active named pool, not a separate MOSAIC preset-local pool ID. Transition is a fade from the procedural image into the new feed, not simultaneous old/new video crossfade. Pool load/empty state currently uses shared Source UI and procedural fallback; detailed per-channel errors are not exposed. These limitations need acceptance review.

The same native module is used by preview and production output. All tiles share one housing geometry, one box geometry and one screen geometry; dynamic transforms reuse instance buffers; gallery geometry and original fallback require no remote assets. No per-tile decoder. Actual frame rate, GL errors, video memory, quality tiers, stale media replacement, actual image orientation and source persistence across account changes remain unverified. Quality is the host's existing render/shadow quality policy; there is no new dedicated grid LOD. The shared bridge owns GL context and output; the module owns/disposes scene resources and wrappers while the media runtime owns textures.

## Validation record / pending gates

- Native compiler and `validateCinema2PresetAuthoringConventions` were executed directly against the raw and Auto Coverage-expanded manifests using a local Node TypeScript transpile harness (no project dependencies installed; `import.meta.env` replaced in the harness for CommonJS only). Both returned `ok:true`, zero diagnostics. This is not full TypeScript semantic checking or a Vite production build.
- Local Node assertions against actual source: 54 supported grid sizes / 2,376 UV tile rectangles cover the unit square; six distinct pattern signatures; manual pattern edit and timeline reset; grouped layout channel bounds; 240 extreme poses. Focused Vitest suite included at `src/components/vyzualz/cinema2/__tests__/Cinema2MosaicPreset.test.ts` for rerun in a full checkout.
- `npm ci --offline --ignore-scripts --no-audit` failed with ENOTCACHED (zustand tarball); `npm ping --fetch-retries=0 --fetch-timeout=4000` failed EAI_AGAIN (registry DNS). No authenticated browser or dependency-backed WebGL/production tests, full tests, build, cast/record verification or screenshots were obtained. No performance claim or keeper promotion. The actual media/pool integration, every control's production visual behavior, all trigger/discontinuity paths, lock/live markers and visual output are stop-ship gates pending validation.
- `npm run typecheck -- --pretty false` failed with TS2688 (missing `vite/client` types); `npm run test:cinema2-everywhere` failed because Vitest was not installed. `git diff --cached --check`, `git apply --check` and an actual apply against the clean baseline succeeded; the direct Node checks passed again on that applied copy.
- Run after installing dependencies: `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2MosaicPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2EverywherePool.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2AutoCoverage.test.ts`; `npm run typecheck`; `npm run build`; then production browser/source/record/cast and performance acceptance with actual local images and videos. Do not treat successful manifest validation as visual approval.
