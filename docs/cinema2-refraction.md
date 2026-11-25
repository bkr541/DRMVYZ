# REFRACTION | Media inside architectural glass

Status: selectable first-party **reference**, pending production visual acceptance. ID `drmvyz.cinema2.refraction`, revision 1, native module `refraction-native`. No external scene assets: original procedural shapes, original fallback optical shader and original blueprint drawing are authored in this patch. No new dependency or migration.

## Visual and spatial contract

Right-handed Three world coordinates; Y up, +Z toward camera, local origin at center of gallery. A triptych of alternating upright/inverted optical prisms is suspended in front of staggered upper and outer banks and rectangular optical slabs. Up to 18 anchors are allocated at creation, default 12. Angular ribs, inset back wall, floor and recessed rails establish an architectural hall, not a wall of tiles. Geometry is in relative world units. Shared shape geometry is generated for upright, inverted and slab forms; the extruded backing and beveled hollow glass housing have physical thickness. A clipped triangular/rectangular aperture is behind the translucent face and in front of the opaque backing. Media coordinates run 0–1 from aperture bounds and invert image V for the managed texture. Grouped fits the complete image into the aperture bounding rectangle before clipping; continuous samples a common composition. Geometry intentionally masks the corners of triangle apertures. Default palette: #070B15 background, #263447 structure, #36E7FF edge, #8954FF rails, #F1E6FF glass and accent.

Camera is owned by the existing perspective runtime (45° nominal vertical FOV, near .12, far 65, centered slightly offset position [.35,.3,9.2], target origin). Minimum 16:9 aspect widens FOV on narrower output without stretching content. Existing motion controls and safety bounds apply; maximum spacing and portrait composition still need real capture review. Prism translation and pivot angles are smoothed, with no direct camera writes. Production, preview, recording and casting reuse the normal output path. No editor UI in the stage.

Optics are explicitly a performance-safe approximation, not ray tracing: physically beveled geometry, PBR clearcoat, translucent surfaces, environment highlights and a bounded UV distortion (maximum .035 times resolved distortion, before fit/clipping). Glass Transmission changes opacity rather than invoking Three's transmission pass; Reflection Strength changes environment reflections, not planar mirrors. Shadow Strength controls the real shadow-casting key light; the renderer quality policy owns shadow resolution. Depth writes are disabled for translucent faces; backing and aperture remain opaque, face render order 3. Low tier suppresses rear decorative glass overlays, retaining media and hero geometry. No measured visual or performance acceptance yet.

## Pattern library and timing

| Pattern | Render response |
|---|---|
| Prism Rotation | Opposed bank pivot movement with small depth sway and returning frontal shot |
| Spectral Split | Bounded outward diagonal/depth separation, optical edge tension |
| Transparency | Modulates front-layer opacity without changing selected media |
| Convergence | Eases the banks toward the center, near-frontal release |
| Glass Relay | Traveling bevel emission, shallow alternating bank motion |
| Refraction | Optical sweep, controlled UV displacement, small pivot motion |

The shared `Cinema2BeatClock` follows host and preset BPM Sync jointly, otherwise reference 120 BPM; phase is advanced by pi/4 per beat (8-beat cycle), relay travels twice per cycle. Motion Rate scales phase. Slow idle uses .18 of normal phase when the transport permits animation. Paused transport freezes pose; reset/discontinuity clears clock, controller and phase. `Cinema2MainframePatternController` owns runtime pattern changes, seeded non-repeating cycle and manual edit/trigger suppression. Canonical Afterhours event identity is used for all eleven trigger options. `Cinema2PatternControlResolver` resolves effective Pattern Change/Trigger once per frame; shared `Cinema2PatternAutoPerformance` supplies optional temporary build/drop overrides and mood choices only under authorized Auto Performance. No saved parameter writes or local music analysis. Calm: Transparency/Prism Rotation; drive: Glass Relay/Prism Rotation; tense: Spectral Split/Refraction; peak: Convergence/Spectral Split. Build Spectral Split, drop Convergence for four beats.

## Ownership and authority matrix

U = saved user authority, B = saved base with bounded runtime modulation, A = runtime-only automatic authority. All Design and Effects controls, and Master Controls except Auto Performance and BPM Sync, use the existing shared Inspector lock when Auto Performance is enabled. Palette remains editable; Reset is governed by existing policy. Every manual edit writes authored base only; shared controller handles manual Pattern edits; source edits use the existing source manager. No alternate UI.

| Property/control | Manual | Audio | Director | Auto Performance | Visible consumer / edit behavior |
|---|---|---|---|---|---|
| Quality | U | no | no | no | shared quality policy |
| Auto Performance | U | no | no | gates A | shared mood tag/lock |
| BPM Sync | U | no | no | no | shared clock and camera |
| Master Intensity | B | no | no | coverage | scales pose and edge output |
| Music Reactivity | U | strength | strength | strength | rule scaling; zero removes musical drives |
| Motion Safety | U | no | no | no | full/reduced/lockoff canonical safety |
| Pattern | U | no | no | temporary A | six native programs; saved value retained |
| Pattern Change | U | event | no | effective A | shared trigger controller |
| Trigger | U | event | no | effective A | shared eleven choices; visibility follows saved value |
| Camera Motion | U | no | no | no | hard shared camera authorization |
| Camera Amount | B | no | no | coverage | shared drift amount |
| Prism Count | U | no | no | no | 6–18 existing allocations enabled |
| Prism Depth | U | no | no | no | physical backing/housing depth |
| Bevel | U | no | no | no | rebuilds three shared geometry variants only on edit |
| Spacing | U | no | no | no | anchor separation |
| Glass Transmission | B | pattern | no | coverage | translucent face and casing opacity |
| Glass Roughness | B | no | no | coverage | clearcoat/specular appearance |
| Refraction Strength | B | restrained | no | mood tension | bounded UV shift; zero off |
| Edge Emission | B | highs/hits | impact | mood brightness/silence | bevel line energy; zero off |
| Rotation Extent | B | mids/snare | no | coverage | eased pivot; zero off |
| Depth Separation | B | bass/kick/build | release | mood energy/silence | axial movement |
| Motion Rate | B | shared timing | no | momentum | phase rate |
| Prism Media | U | no | no | no | standard Source slot |
| Source Mode | U | no | no | no | auto/procedural/single/pool |
| Media Visible | U | no | no | no | hides aperture content; environment remains |
| Media Fit | U | no | no | no | contain/cover/fill |
| Media Layout | U | no | no | no | grouped/continuous UV map |
| Grouping | U | no | no | no | front/mid/rear or upright/inverted |
| Media Scale | U | no | no | no | uniform fitted source scale |
| Media X Offset | U | no | no | no | horizontal UV shift |
| Media Y Offset | U | no | no | no | vertical UV shift |
| Media Rotation | U | no | no | no | source rotation |
| Media Opacity | U | no | no | no | screen blend |
| Media Brightness | U | no | no | no | source exposure |
| Transition Duration | U | no | no | no | fade from procedural fallback upon source switch |
| Media Readability | U | vocal restraint | no | no | bounds optical/pivot motion |
| Pool Automation | U | event | no | no | independent permission |
| Pool Trigger | U | event | no | no | standard Canvas pool event choices |
| Bloom | B | no | no | mood peak | native HDR bloom |
| Atmosphere | B | no | no | coverage | shared depth-aware haze |
| Reflection Strength | B | no | no | coverage | Three environment reflection |
| Shadow Strength | B | no | no | coverage | real key light |
| Light Spill | B | no | no | mood shock | local point light |
| Cinematic Finish | B | no | no | coverage | existing tonal pass |
| Background | U | no | no | no | environment background |
| Structural | U | no | no | no | wall, housing, rails base |
| Primary Energy | U | intensity only | no | no | edges, local light, fallback |
| Secondary Energy | U | intensity only | no | no | optical rails and fallback |
| Accent | U | no | no | no | glass color and structural accent rails |

## Musical mapping

Shared choreography supplies normalized transient channels with `reactivity` strength, then the native domain composes them within bounds (all times seconds except smoothing milliseconds). All continuous and non-drop events require not-silent; drop is ungated. Event actions use once-per-event + restart. No local analyser. `Master Intensity` scales motion/emission; vocal restraint reduces physical motion and distortion up to 30%.

| Shared signal | Native response | Attack/hold/release or smoothing | Max normalized contribution |
|---|---|---|---|
| sub/bass | depth excursion | 160/120 ms | +.20 |
| mids | pivot extent | 150 ms | +6° |
| highs/air | edge light | 100/125 ms | +.15 |
| energy | edge light | 180 ms | +.05 |
| vocal presence | motion and optical restraint | 220 ms | ×.70 |
| Director build | separation anticipation | 200 ms | +.15 |
| Director impact | release edge accent | 150 ms | +.16 × drop |
| kick | alternate depth and optics | .03/.025/.24 | +.25 depth, ×1.15 optical |
| snare | inverted edge accents | .02/.02/.18 | +.08 |
| beat | edge pulse | .03/.02/.20 | +.06 |
| downbeat | relay accent | .055/.05/.38 | +.14 |
| phrase | edge accent | .15/.10/.80 | +.08 |
| drop | bounded depth release | .17/.10/1.50 | +.24 |

Mood drives use the canonical helper, gate Auto Performance, strength Music Reactivity; default-equivalent multipliers preserve off-at-zero settings. Extra numeric coverage drives come from the existing catalog helper, exempting user-owned structural/media alignment controls.

| Target | Base | Source | Drive |
|---|---:|---|---|
| Depth Separation | .45 | mood.energy | +.20 |
| Motion Rate | 1 | mood.momentum | ×1.30 |
| Edge Emission | .40 | mood.brightness | ×1.375 |
| Refraction Strength | .25 | mood.tension | ×1.40 |
| Bloom | .25 | mood.peak | ×1.32 |
| Light Spill | .30 | mood.shock | ×1.40 |
| Depth Separation | .45 | mood.silence | −.35 |
| Edge Emission | .40 | mood.silence | ×.375 |

## Media and lifecycle

The generic Source panel recognizes `refraction-prism-media` alongside existing media-capable presets. Select a library image/video or the existing named active pool; auto mode prioritizes that pool, explicit single/procedural/pool modes are supported. Existing store owns selection and persistence. No new pool schema. The existing `Cinema2EverywherePool` manages at most three channels and resolves via the stage's shared media pool source. Pool events are separate from pattern events, suppressed on enable/trigger changes, reset on source/transport discontinuity; no local beat detection. Managed media slot runtime owns GPU texture/video lifecycle. Native Three wrappers borrow same-context texture handles and remove renderer properties before disposal. Repeated prisms share geometry; materials are allocated at entry, not each frame. Fallback is procedural on missing feeds; transition is a fade from fallback, not a two-source crossfade. Low tier reduces rear glass overlays. This inherits the existing active-pool persistence and ordering behavior rather than adding preset-local pool storage or changing CANVAS. Account change, pool mutation and mixed video decode behavior require production verification.

## Validation record

- `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0`: failed with registry DNS `EAI_AGAIN` and npm exit-handler error. No runnable local Vitest/Vite/Three dependencies; full typecheck, lint, browser, build, real GL, recording/cast and performance measurements are **not verified**.
- Global TypeScript 5.8.3 transpilation and direct Node execution of the actual domain: six distinct signatures, 6,480 bounded pose samples, 216 UV/channel cases, zero optical/edge checks passed.
- Actual repository authoring validator and native compiler invoked via local TypeScript transpile hook (Vite `import.meta.env` substituted for Node execution): zero diagnostics for authored and Auto Coverage manifests. This is not a production Vite build.
- Direct Node execution of the native performance controller verified manual Pattern selection, phase advancement, discontinuity reset and saved value preservation. Syntax transpilation returned zero diagnostics on 11 changed TypeScript/TSX files.
- `git apply --check` and actual application on independently extracted original ZIP paths passed; all touched files matched the edited tree byte-for-byte.
- Focused Vitest test file included for schema, controls, patterns, UVs, hard zero settings and timing reset. Run after installing dependencies; existing shared coverage tests must also run.
- No captures or human approval. Do not promote to keeper until real images/video and named pools, all eleven triggers, Inspector live markers/lock, output aspect/cast/record, effects extremes, quality tiers, repeat switching, GL errors and frame-time distribution have been reviewed. Release readiness is not claimed.
