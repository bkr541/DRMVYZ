# FRACTURE — native Cinema 2.0 review preset

ID `drmvyz.cinema2.fracture`, revision 1. Selectable reference, not a keeper. Procedural geometry and blueprint are original repository-local code; no external assets, licenses, dependencies or network services added.

> The scene, motion, camera and visual controls described below are historical FRA-01/initial-reference details. See [FRA-02 volumetric media rupture](cinema2-fracture-spatial-rupture.md) for the current implementation and validation handoff. The source and shared authority contracts still apply.

## Visual and geometry specification (historical)

A coherent 8 × 4.5 world-unit display centered at the origin is cut into 16–120 convex irregular Voronoi cells. Right-handed Y-up, front +Z, camera looks toward origin. Seeded jittered sites are clipped against every pairwise bisector and the outer rectangle. Adjacency is identified by shared endpoints; breadth-first graph distance from leftmost cell drives contour travel. Each shard uses its area centroid pivot and outward axis. Uniform inset is capped by centroid clearance; four matched rings form chamfer, shoulder, thickness and rear cap. Dark metal backs/sides and a separate front shader retain media readability. Front UV = `(restXY / (8,4.5)) + .5`, never transformed with motion. Actual width gap, bevel and thickness create dark seams; no rectangular tile mesh or alpha-only fracture. Changing seed/count/gap rebuilds geometry; thickness scales depth; media changes do not rebuild geometry. Full rectangle area before gaps = 36.

The asymmetric side bulkheads, recessed angular violet rear plates/fissures, offset header and floor tracks are built from physical world-space meshes. White crack line geometry and cyan structural accent are separate from the purple rear fissures. Real spot shadow and local point spill; existing IBL floor/metal reflection, HDR bloom, atmosphere and finish passes. Low quality halves shard shadow casters, not hero geometry. Background, structural, primary, secondary and accent colors remain independently authored.

Camera: centered at (0,0,10.8), FOV 42°, near .12, far 65, minAspect 16/9 fit-to-width from canonical camera runtime. Motion safety uses canonical full/reduced/lockoff rather than a second boolean. Drift restricted by position safety box and no authored roll. Target extents at maximum ±1.35 X, ±.78 Y, ±1.2 Z; rotation ±70° scaled by motion/readability/safety. Rest pose is exact target and eased approach snaps within .0001. No collision physics; radial axes and alternating depth limit interference but overlap during intense poses is possible. This needs real visual review, especially portrait, maximum motion and dense cells. No separate editor/output aspect code.

## Patterns and ownership

| Pattern | Physical program |
|---|---|
| Fracture | subtle local release and brightening cracks |
| Suspension | layered axial wave with mild tilt |
| Scatter | radial separation, alternating depth, pivot rotation, return |
| Contour Chase | stationary geometry and adjacency-based edge light sweep |
| Reconstruction | staggered graph-distance return to exact rest target |
| Shatter Wave | traveling release through adjacency layers and depth |

Shared BeatClock: host and preset BPM Sync must both authorize grid synchronization; OFF follows reference 120 BPM seconds clock with continuity. Native phase uses eight beats per cycle at rate 1. Pause freezes transforms; no-source idle assembles, silence returns toward rest. Track, analysis, timeline, source, generation and time discontinuities reset volatile phase. Shared PatternControlResolver supplies effective trigger/permission and inspect values, MainframePatternController maintains saved/manual/trigger precedence, PatternAutoPerformance owns bounded four-beat drop and build/mood substitutions. No preset-local musical detection or saved writes. Pool event permission/cadence is independent. Standard Inspector owns lock, live values, reset and trigger visibility. Auto OFF retains the authored state. Camera hard disable and Media Visible are not automated. Source and palette remain user-owned. No new recording/cast or preview surface.

## Authority and visible consumers

U = user-owned, B = authored base with bounded transient contribution, E = effective runtime-only decision. Manual edits update authored value when allowed by shared Inspector; E never persists. All five color roles remain editable under Auto; other locked rows follow shared Inspector. The table lists every manifest control, its output and authority.

| Control | Manual | Audio | Director | Auto | Consumer / manual edit |
|---|---|---|---|---|---|
| Quality | U | no | no | no | shared quality tier / shadow caster budget |
| Auto Performance | U | gate | gate | gate | shared policy, lock, effective values |
| BPM Sync | U | clock | no | no | shared clock + camera |
| Master Intensity | B | scale | scale | coverage | movement / edge energy |
| Music Reactivity | U | scale | scale | scale | shared rule strength |
| Motion Safety | U | no | no | no | hard lock / reduced extents |
| Pattern | U | event E | no | E | six programs; manual choice cancels override |
| Pattern Change | U | E | no | E | shared controller |
| Trigger | U | E | no | E | eleven canonical events |
| Camera Motion | U | no | no | no | hard camera authorization |
| Camera Amount | B | no | no | coverage | bounded camera drift |
| Shard Count | U | no | no | no | rebuild cell count |
| Seed | U | no | no | no | rebuild tessellation |
| Crack Width | U | no | no | no | polygon inset |
| Shard Thickness | U | no | no | no | physical depth |
| Spread | B | bass/hits | impact | energy/silence | radial displacement |
| Depth Travel | B | bass/hits | impact | shock | axial displacement |
| Shard Rotation | B | mids/hits | impact | coverage | local pivot angle |
| Motion Rate | B | clock | no | momentum | phase speed |
| Reassembly Time | U | no | no | no | rest easing duration |
| Crack Emission | B | highs/hits | build | tension/silence | shard rim energy |
| Shard Media | U | no | no | no | existing Source tab slot |
| Source Mode | U | no | no | no | auto/procedural/single/pool |
| Media Visible | U | no | no | no | hard face visibility |
| Media Fit | U | no | no | no | contain/cover/fill |
| Media Layout | U | no | no | no | continuous/grouped UV |
| Grouping | U | no | no | no | quadrants/horizontal bands |
| Media Scale | U | no | no | no | uniform UV scale |
| Media X Offset | U | no | no | no | UV translation |
| Media Y Offset | U | no | no | no | UV translation |
| Media Rotation | U | no | no | no | UV rotation |
| Media Opacity | U | no | no | no | blend to neutral base |
| Media Brightness | U | no | no | no | source exposure |
| Transition Duration | U | no | no | no | fade from fallback |
| Media Readability | U | vocal restraint | no | no | reduce extents |
| Pool Automation | U | E | no | no | authorized runtime advancement |
| Pool Trigger | U | E | no | no | independent CANVAS event cadence |
| Bloom | B | no | no | peak | HDR effect |
| Atmosphere | B | no | no | build | depth haze |
| Reflection Strength | B | no | no | coverage | native environment response |
| Shadow Strength | B | no | no | coverage | shadow key light |
| Light Spill | B | no | no | coverage | point illumination |
| Cinematic Finish | B | no | no | coverage | tonal pass |
| Background | U | no | no | no | environment |
| Structural | U | no | no | no | body/walls |
| Primary Energy | U | intensity only | no | no | edges/light |
| Secondary Energy | U | intensity only | no | no | rear fissures |
| Accent | U | no | no | no | structural edges |

## Signal and mood routing

Shared choreography outputs bounded 0–1 channels, strength Music Reactivity. Continuous uses replace on signal channel, not-silent; event envelopes once-per-event/restart, all non-drop events gated not-silent. Native pose adds and clamps displacement, angle and light. No new analyzer. Drop is ungated and contributes even under shared silence while active. No local clock.

| Source | Channel timing | Native contribution |
|---|---|---|
| sub/bass | 160/120 ms smoothing | +.20 spread/depth |
| mids | 150 ms | +8° rotation |
| highs/air | 100/125 ms | +.15 edge light |
| energy | 180 ms | +.05 edge light |
| vocals | 220 ms | up to 30% restraint |
| Director build | 200 ms | +.12 tension/release |
| Director impact | 150 ms | drop multiplier .78–1 |
| kick | .03/.025/.24 s attack/hold/release | +.22 local release, +.25 depth |
| snare | .02/.02/.18 | +.18 wave edge |
| beat | .03/.02/.20 | +.05 edge |
| downbeat | .055/.05/.38 | +.15 sweep |
| phrase | .15/.10/.80 | +.08 edge |
| drop | .17/.10/1.50 | bounded structural release and eased return |

| Target | Base | Mood source | Operation/bound |
|---|---:|---|---|
| Spread | .50 | energy | +.20 |
| Depth Travel | .45 | shock | +.15 |
| Motion Rate | 1 | momentum | ×1.25 |
| Crack Emission | .45 | tension | ×1.3333 |
| Bloom | .25 | peak | ×1.4 |
| Atmosphere | .10 | build | ×1.7 |
| Spread | .50 | silence | ×.3 |
| Crack Emission | .45 | silence | ×.375 |

All mood rules gated by shared Auto Performance and Music Reactivity. Existing coverage helper covers remaining eligible numeric controls, with explicit geometry and presentation exemptions. Calm candidates Fracture/Contour Chase; driving Shatter Wave/Suspension; tense Fracture/Contour Chase; peak Scatter/Reconstruction. Saved pattern underlies all temporary choices.

## Source, quality and lifecycle

Existing Source panel, Media Library and named CANVAS active pool are reused. Auto mode prioritizes selected pool; direct mode uses `fracture-shard-media`, procedural uses fallback, pool mode uses existing pool only. Existing `Cinema2EverywherePool` owns at most three managed decoded channels; continuous maps one selected feed across the rest rectangle, grouped divides into four quadrants (fourth wraps to first with three feeds) or three horizontal bands. Region mapping is based on original UV, including across fragments; no texture per shard. This follows existing global active pool selection/persistence and ordering; it does not add per-preset independent pool assignment storage. Pool step uses canonical events; it does not rewrite source IDs. Fade from procedural fallback is not a true two-source crossfade. Resource loading and removal reuse shared slot owner and generation cancellation; Three wrappers borrow same-context GL handles and remove properties before disposal. Procedural fallback is neutral and contains no private images. No media audio or extra storage. Repeated entry, source loss, mixed media, color/orientation and account switching still require production testing. Scene allocates 3 drawables per shard plus chamber; low quality reduces shadow casters. No measured frame rate or resource-growth claim.

## Validation / release blockers

- `npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0`: failed, registry DNS EAI_AGAIN and npm exit handler error. Dependencies unavailable. Full TypeScript semantic checking, Vitest, lint, Vite build, browser render/GL, live Inspector lock and marker, actual media and named pool playback, recording, cast and hardware performance not verified.
- Global TypeScript transpile hook plus direct Node assertions: 21,420 cells across 315 count/seed combinations, exact area and deterministic repeatability, positive inset area, connected adjacency; 17,280 pose samples, six distinct signatures, bounds and idle targets passed. Actual repository authoring and native compiler (authored and coverage manifests) returned zero diagnostics. Hook substitutes Vite import.meta.env for Node. These are not production rendering results.
- Manual pattern edit and analysis discontinuity reset passed via actual performance controller under the same hook. Syntax transpilation passed on all 10 changed TypeScript/TSX files.
- Added focused Vitest tests for geometry, schema, triggers, pose and manual/discontinuity behavior. Real browser matrix and all eleven trigger-event runs remain open; no screenshots or human approval. Do not promote to keeper. Collision-free maximum spread, exact grouped playback and full source acceptance remain unverified.
