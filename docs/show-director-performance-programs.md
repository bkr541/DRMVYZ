# Show Director Performance Programs

Show Director Performance Programs are deterministic, full-song choreography layers for the LaserDMX engine-neutral lighting scene. They do not replace Beam Matrix, create a second renderer, or introduce a separate audio-analysis engine. The production WebGL2 renderer and Canvas2D compatibility renderer consume the same evaluated program state.

## Architecture and authority

The persisted project owns two separate things:

1. The authored Show Director rig: fixtures, groups, targets, cues, and user edits.
2. The optional performance-program state: program definition or built-in ID, enabled state, tuning, seed, preset identity, and runtime invalidation identity.

Each render frame builds a transient runtime rig from the authored rig plus the active program. The resolver is pure with respect to persisted state. It never writes runtime fixture mutations back to Zustand and never turns temporary brightness, targeting, recruitment, color, or role changes into authored edits.

The runtime path is:

`Track analysis / manual Track Map sections -> Music Intelligence -> AudioFeatureBus -> performance context -> performance resolver -> Show Director compiler -> engine-neutral scene frame -> WebGL2 renderer or Beam Matrix / Canvas2D compatibility renderer`

The effective precedence is:

1. Authored fixture rig and manual fixture controls provide the baseline.
2. The performance program creates a transient overlay.
3. Existing automatic choreography is an underlay inside Show Director.
4. Authored cues and performance-pad requests apply according to the existing Show Director cue precedence rules.
5. Global blackout, output safety, cancellation, renderer disposal, and fail-dark production-output handling remain final authority.

A blackout already requested by the authored Matrix state or performance program cannot be reopened by a later cue in the same frame.

## Timing hierarchy and cadence anchors

The audio transport playhead is the only choreography clock. Wall time is not used to advance a show.

The context exposes two related timing layers:

- **Absolute track timing**: absolute beat, absolute track bar, and absolute four-, eight-, and sixteen-bar blocks.
- **Performance phrase timing**: bars since the current macro-section entry plus continuous four-, eight-, and sixteen-bar blocks anchored to that macro entry.

Beat mutations use canonical beat position and Music Intelligence events. Bar mutations use the active time signature. Four-bar variation, eight-bar recruitment, and sixteen-bar evolution use the performance phrase clock, so they count true musical bars rather than raw beats or render frames. `phraseLengthBars` remains correct outside 4/4.

Fine Track Map boundaries do not automatically restart the performance phrase clock. A verse split into 5-, 6-, and 7-bar analyzed segments can therefore reach its second eight-bar recruitment stage and later four-bar variations. A true macro-role change, such as verse to build, build to pre-drop, drop to breakdown, or an explicitly numbered Drop 1 to Drop 2 change, starts a new macro clock.

Forward frame gaps still report any crossed absolute and performance four-, eight-, and sixteen-bar boundaries. An explicit seek, backward transport movement, loop wrap, track replacement, analysis replacement, preset reload, or seed/invalidation change reconstructs all block indexes from the target playhead instead of replaying missed mutations. Pausing does not advance choreography, and neither renderer owns an independent animation loop.

## Fine sections, macro sections, and boundary classification

Manual Track Map sections remain authoritative over overlapping analyzed sections through the canonical Track Map resolver. The context first creates non-overlapping authoritative fine-section spans, then groups compatible adjacent spans into macro performance sections.

Macro grouping follows these rules:

- Related labels with the same musical role continue one clock, such as Verse A to Verse B, Build A to Build B, or Drop 1A to Drop 1B.
- Explicitly numbered role changes remain separate occurrences, so Drop 1 and Drop 2 never share a clock even when adjacent.
- A role change always creates a new macro section.
- Manual and user-edited sections keep their source priority while participating in the same deterministic grouping rules.

Each fine boundary is classified as:

- **Hard performance boundary**: the macro role or explicit occurrence changes, so cadence resets.
- **Continuation boundary**: the fine label family and intensity remain compatible, so motif and cadence continue.
- **Variation boundary**: the fine section remains in the same macro role but its label family or intensity meaningfully changes; the clock continues while the resolver may express a related variation.

Section identity includes ID, type, bounds, label, intensity, source, and confidence. Macro identity includes the authoritative span composition. Editing a Track Map array in place therefore invalidates stale fine and macro calculations instead of relying only on array identity.

Section occurrence is derived from ordered macro sections rather than render-time entries:

- Seeking directly into the second drop resolves Drop 2 and its own macro clock.
- Looping within Drop 1 continues to resolve Drop 1 and repeats the same phrase state.
- Looping bars 9 through 16 reconstructs the same four-bar variation and eight-bar recruitment stage on every pass.
- Unknown sections use the program fallback order or configured basic-timing fallback without borrowing stale section data.

Analysis identity covers beat markers, phrases, sections, energy and spectral curves, harmonic data, stems, lyrics, and semantic moments. Identity and sorted-grid work remain cached, while resolved-section caches are content-fingerprinted so manual edits cannot leave stale macro clocks behind.

## Motif continuity and recruitment

A four-bar block ordinarily owns one motif family. Beat and bar mutations change brightness, spread, endpoint emphasis, direction, focus, or bank balance inside that family rather than replacing the complete composition every beat. The built-in shows declare deterministic four-step motif sequences:

- Prism Cathedral: Open X, Nested Diamond, Mirrored Crown, Cathedral Cage.
- Cardinal Fan Reactor: Horizontal Opposing Fans, Vertical Opposing Fans, Cardinal Aperture, Diagonal Expansion.
- Cyan Mirror Cage: Outer Mirrored Walls, Inner Chevrons, Double X, Wide Cage Wings.

Eight-bar stages are indexed from the macro-section anchor. Recruitment mutations remain cumulative unless the authored stage opts out. Whenever a scene has recruitment stages, fixtures already active at the boundary also evolve deterministically through rotation, angle, spread, and travel direction changes. This prevents a new bank from appearing as an unchanged extra layer while the original architecture freezes.

Fixture-local target geometry remains authoritative. The continuity resolver does not replace fixture-keyed target arrays with shared global targets, so projector origins, deliberate negative space, and the Cyan Mirror Cage center corridor survive phrase evolution, seeking, and looping.

## Section energy envelopes and full-song arc

Performance-program schema version 3 adds explicit `intro`, `verse`, `build`, `preDrop`, `drop1`, `breakdown`, `drop2`, and `outro` energy envelopes. Every built-in show declares target ranges for active fixture groups, estimated beam count, fixture brightness, fan spread, movement strength, global glow, normalized density, and negative space. Music Intelligence can modulate inside the authored architecture, while the resolver caps accidental overshoot and retains the section hierarchy.

The built-in arc follows these deterministic rules:

- Intros begin with one fixture family and recruit a second family later instead of opening at drop density.
- Verses remain visibly alive on every beat and retain authored negative space.
- Builds use one-based macro-section bar progression. Successive bars recruit groups, widen fans, increase endpoint motion and brightness, and reduce negative space. The final build beat contracts and freezes the composition for tension.
- Pre-drops narrow to a small spear or aperture allocation and may use only their authored bounded blackout window.
- Drop entry activates the primary bank immediately, adds a white impact layer, and then resolves into the existing beat-bank and four-/eight-bar drop-body choreography.
- Breakdowns substantially reduce fixture count and movement but must retain visible authored beams unless `allowZeroBeamOutput` is explicitly set.
- Drop 2 preserves each show identity while adding fixture families and structural layers. The same 300-beam hard limit remains authoritative.
- Outros use non-cumulative bar snapshots to remove groups progressively, return to a simplified opening identity, and fade the final half beat without leaving stale runtime beams.

Bar-progression mutations pass through the same fixture-local geometry authoring step as beat, bar, four-bar, eight-bar, entry, body, and exit mutations. This prevents build and outro stages from accidentally restoring shared global polygons.

## Deterministic blackout policy and transitions

Blackout authority is deliberately separated into five concepts:

1. **Safety blackout** is renderer and output-safety authority. It is evaluated last and cannot be weakened by a performance program.
2. **User blackout** is the authored Matrix or Show Director blackout request and remains authoritative over program output.
3. **Programmed pre-drop blackout** is an authored transport-relative window, ordinarily one-half beat and bounded to one beat by the built-in policy.
4. **Programmed impact cut or fakeout blackout** is an authored short punctuation window with its own maximum duration.
5. **Section-transition fade** interpolates fixture brightness plus global dimmer, glow, haze, persistence, and beam width. It is not treated as a blackout.

Built-in policy limits are deterministic: pre-drop blackouts are capped at one beat, impact cuts at one-half beat, fakeouts at one beat, and total programmed blackout time at six percent of the authored show. Windows are anchored to macro-section start or end and reconstructed from the transport playhead, so seeking into a window restores only its remaining duration and looping cannot stretch it. Repeated retriggering is guarded by the authored window identity and transport position.

A missing or malformed fixture address cannot create darkness by itself. Unless a scene explicitly permits zero-beam output, the resolver restores a minimal deterministic set of authored laser fixtures at the policy brightness floor. Breakdown scenes therefore compile to sparse nonzero output rather than looking disconnected. Programmed blackout requests are applied only after this visibility safeguard and still remain subordinate to final safety authority.

Transitions interpolate target positions and fixture brightness rather than popping enabled state at the midpoint. Prism uses target and color continuity, Cardinal contracts or expands local fans, and Cage narrows or widens mirrored walls while preserving its protected corridor. Global dimmer, glow, and haze travel with the same transition progress.

## Music Intelligence reuse and fallback

Performance programs consume the existing canonical selectors. They do not duplicate BPM detection, beat-grid generation, section analysis, harmonic analysis, stem analysis, or lyric tracking.

Available sources include:

- BPM, time signature, beat, downbeat, beat phase, beat strength, and phrase timing
- kick, snare, hat, and general transients
- raw and normalized audio bands
- energy, intensity, trend, spectral features, build progress, and drop impact
- section type, progress, confidence, and occurrence
- build, drop, fakeout, vocal-hook, mood, and texture semantics
- key, mode, chord, note, pitch, and melody-contour features
- stem curves and stem transients when available
- lyric line, word, gap, and timing features when available
- capability flags, source confidence, and analysis readiness

Capability labels such as `Beat Grid`, `Live Bands`, `Sections`, `Track Energy Curve`, `Stem Curves`, and `Lyrics` are normalized at the adapter boundary. Unsupported advanced sources return neutral values and do not fabricate analysis. Conditions can read numeric, boolean, or categorical canonical values.

All built-in shows remain usable with transport time, BPM or a beat grid, basic amplitudes, and either basic sections or the energy fallback. Optional stems, lyrics, harmonic data, and richer spectral analysis add detail but are not required for scene identity.

AudioFeatureBus frames are accepted only when they match the active track identity. During track replacement, stale advanced values are discarded and the renderer rebuilds from current-track transport, amplitudes, and sections until the new Music Intelligence frame arrives.

## Beam-budget policy

The hard active-beam limit is 300. Allocation is deterministic and ordered by role:

1. Hero and impact beams
2. Primary architecture
3. Secondary fans
4. Detail lattice
5. Decorative accents

Within a role, semantic fixture key and fixture ID provide stable ordering. The resolver reports requested demand, bounded demand, and a budget warning. The Show Director compiler receives the same priority map, so lower-priority detail is shed before primary scene identity. Seeking to the same timestamp produces the same allocation.

## Built-in Performance Shows

### Prism Cathedral

A vertical, symmetrical cathedral identity built from cyan, violet, and prismatic architecture. Beats articulate columns and vaults; four-bar changes alter composition; eight-bar stages recruit or redirect architectural layers. Builds widen and rise, pre-drops narrow or freeze, breakdowns preserve sparse pillars, and Drop 2 expands the cathedral rather than merely increasing brightness.

### Cardinal Fan Reactor

A red and white radial fan identity centered on reactor-like expansion. Beat and drum layers rotate or snap fan geometry, four-bar blocks change fan composition, and eight-bar stages recruit outer reactor groups. Builds increase radial pressure, pre-drops contract or blackout, breakdowns remove most fan mass, and Drop 2 uses a larger, more aggressive reactor assignment.

### Cyan Mirror Cage

A cyan mirrored-cage identity with crossing, reflected, and lattice motion. Beat changes move mirror relationships, four-bar variations change cage topology, and eight-bar stages recruit or reassign cage walls. Builds tighten and multiply reflections, pre-drops use narrow or frozen geometry, breakdowns leave genuine negative space, and Drop 2 adds a denser but still recognizable mirrored enclosure.

The three shows intentionally use different fixture families, addressing patterns, palettes, geometry, and recruitment plans. They are not skins over one generic choreography graph.

## Preset and UI workflow

`Performance Shows` and `Rig Layouts` are separate preset categories. Beam Matrix looks remain in the Matrix workflow. Performance cards use the canonical preset-card component and expose truthful active, favorite, reload, and dirty states.

Loading a Performance Show installs its authored rig and a cloned program definition. Reloading reapplies the built-in rig and program, increments runtime invalidation, and clears stale runtime state. Disabling or clearing a program restores authored Show Director behavior without deleting the rig. User fixture edits mark the loaded preset dirty but are never overwritten by transient runtime mutations.

The compact status surface reports current section, occurrence, scene, four-bar variation, eight-bar recruitment stage, fixture-aware effect counts, and capability or fallback diagnostics. Laser shows retain beam-demand reporting. LED shows report active fixtures, rows, columns, colors, impact duration, and brightness hierarchy. Moving-head shows report active heads, movement banks, representative spread, mirrored-pair participation, bounded impact duration, and only the beam geometry legitimately produced by moving heads. It uses a fingerprinted external-store snapshot rather than raw audio-frame React state. No center-canvas control overlay is used.

## Static Rig Layouts and rig-backed Performance Shows

A static Rig Layout remains an editable Show Director authoring preset. Loading one creates a normal authored rig, keeps its existing preset identifier and category, and clears any incompatible active Performance Show. Static layouts, saved user edits, and custom rigs are not rewritten by the performance system.

A rig-backed Performance Show is a separate authored show definition. It links a Performance Show identifier to one canonical built-in Rig Layout and one dedicated Performance Program identifier. The base rig is recreated through the existing Rig Layout factory, then normalized into an independent performance-owned instance. The performance runtime never mutates the source template, a saved static layout, or another loaded instance.

The seven conversion definitions are registered in `LaserDmxShowDirectorRigBackedPerformanceShows.ts`. All seven are complete, selectable, and backed by dedicated authored Performance Programs:

1. Small Club Performance
2. Festival Front Beams Performance
3. Dubstep Drop Lasers Performance
4. LED Bar Grid Performance
5. Moving Head Sweep Performance
6. Strobe + Blinder Performance
7. Haze + CO2 Performance

All seven use the existing Performance Shows browser, canonical preset selection, persistence, resolver, musical clock, seeking, looping, and final safety-blackout authority. Their original static Rig Layouts remain separate, editable presets.

### Canonical source-rig linkage

Each definition records its source Rig Layout identifier, supported fixture kinds, version, migration metadata, authored fixture banks, validation metadata, and canonical rig factory. Fixture IDs are created per instance. Performance-facing semantic fixture keys are deterministically derived from the source fixture labels, so bank membership remains stable without changing the static template definition. Unknown source layouts fail closed and are not registered.

### Authored fixture banks

Fixture banks are explicit metadata, not runtime geometry guesses. Shared roles include hero, primary, secondary, texture, impact, kick, snare, hat/transient, downbeat, left/right, top/bottom, center, inner/outer, atmosphere, movement, strobe, blinder, and CO₂ impact. Programs may retain the compact `bankRoles` address map while also carrying richer `fixtureBanks` labels and descriptions. The resolver accepts either representation.

### Mixed-fixture action boundaries

Performance payloads may include typed `fixtureActions` for beam fixtures, moving heads, LED bars/tubes, strobes, blinders, washes, haze, and simulated CO₂ fixtures. Each action is applied only to compatible fixture kinds and only maps to properties already present in Show Director. Bounded strobe, blinder, and simulated CO₂ actions normalize their durations and feed existing trigger or component duration fields. Unsupported action-to-fixture combinations are reported in runtime diagnostics rather than being treated as laser behavior. No physical DMX or laser-output capability is added.

### Musical clock and authority order

Rig-backed shows reuse the existing Performance Context and macro musical clock: beat, downbeat, bar, four-bar, eight-bar, sixteen-bar/phrase, Track Map section, repeated-section occurrence, drop occurrence, seek, and loop identities. They do not create another timing engine.

Output authority remains: safety blackout, explicit cue/transport or authored blackout, Performance Program behavior, fixture-authored values, then renderer defaults. Performance global overrides can add blackout or reduce output but cannot clear an authoritative blackout.

### Development inspection and planned conversion sequence

`LaserDmxShowDirectorRigPerformanceInspection.ts` produces development/test reports for all seven sources, including fixture IDs and semantic keys, fixture kinds, groups, beam/non-beam counts, supported authored properties, local targets, candidate authored banks, and unsupported-property warnings. It does not create a production overlay.

The implemented sequence is: shared foundation, three laser-forward source shows, the LED-grid and moving-head shows, then the impact and atmosphere shows. Each conversion supplies its own scenes, transient choreography, palette hierarchy, recruitment order, budgets, negative-space rules, and blackout policy.

## Authored rig-backed laser Performance Shows

The three laser-forward source rigs are active as complete authored Performance Shows. Their original Rig Layout cards and identifiers remain unchanged. Selecting a Performance Show clones its canonical source rig into an independent transient working rig, then resolves the dedicated program through the existing musical clock, resolver, compiler, engine-neutral scene frame, WebGL2 or Canvas2D renderer, persistence, and safety-blackout path.

### Small Club Performance

**Source Rig Layout:** `small-club-rig`

Small Club Performance is a compact mirrored club architecture. The lower club lasers form kick-driven tunnel walls and floor fans. The upper moving heads create snare crowns and secondary tunnel depth. Left-call and right-response banks alternate without replacing the active motif. LED bars, wash, and haze provide a low-priority texture layer, while the center strobe is a bounded impact only.

The authored bank responsibilities are:

- `lowerKick`: paired lower laser fans for kicks.
- `upperSnare`: moving-head crown plus bounded center-strobe accent.
- `leftCall` and `rightResponse`: side-specific call-and-response architecture.
- `outerHero`: primary fan edges and compact tunnel walls.
- `innerPrimary`: upper crown and secondary depth.
- `texture` and `hatTexture`: LED, wash, haze, and high-frequency detail shed first under pressure.
- `boundedImpact`: short-lived center-strobe events.

The intro starts with a paired spear or narrow tunnel. Verse holds a mirrored local-fan identity. Build recruits upper and side fixtures. Pre-drop compresses to a narrow central aperture and permits only a final half-beat blackout. Drop 1 opens a compact fan, diamond, or lower-wing structure. Breakdown returns to sparse lavender or white spears. Drop 2 adds a second tunnel layer, diagonals, LED depth, wash, and haze without filling the protected center. Outro reduces the architecture to paired spears and a final slit.

Ordinary scenes use cyan and violet or magenta with white reserved for crowns and bounded impacts. The declared program ceiling is 160 compiled beams, below the global 300-beam limit.

### Festival Front Beams Performance

**Source Rig Layout:** `festival-front-beams`

Festival Front Beams Performance turns the four front-line beam fixtures into a wide audience-facing fan with explicit left and right hero edges. The two inner beams own the dominant primary fan, the moving heads own the upper snare crown and four-bar subdivisions, and the stage washes remain a shed-first texture layer.

The authored bank responsibilities are:

- `leftHeroEdge` and `rightHeroEdge`: wide outer fan anchors and impact edges.
- `innerPrimary`: dominant front-facing fan body.
- `lowerKick`: inner expansion rays dedicated to kick events.
- `upperSnare`: moving-head crown dedicated to snare events.
- `fourBarSubdivision`: moving-head diagonal and radial mutations.
- `eightBarRecruitment`: outer hero edges and stage washes.
- `texture`: low-priority stage wash support.
- `boundedImpact`: short white or warm outer-edge accents.

The intro uses sparse outer framing. Verse establishes a broad but restrained fan. Build recruits outer edges, washes, and the upper crown across macro eight-bar stages. Pre-drop collapses into a clean center aperture with a bounded final half-beat blackout. Drop 1 opens a large cyan-magenta festival fan with clear outer anchors. Breakdown uses sparse lavender or white spears. Drop 2 starts with inner, outer, crown, and wash layers already differentiated, then evolves into diagonal and radial structures rather than merely raising brightness. Outro narrows the fan and releases outer, inner, and crown banks cleanly.

Cyan and magenta own the ordinary fan, violet supports the crown, and white is limited to snare or impact accents. The declared program ceiling is 220 compiled beams, and no scene may exceed the global 300-beam limit.

### Dubstep Drop Lasers Performance

**Source Rig Layout:** `dubstep-drop-lasers`

Dubstep Drop Lasers Performance uses the gate lasers as the kick and outer-hero bank, the cross lasers as the snare and inner-primary bank, and the strobe, blinder, and simulated CO₂ fixtures only as bounded event layers. Every beat animates the current gate, cross, or diamond motif rather than selecting a random replacement.

The authored bank responsibilities are:

- `kick`: paired gate lasers with hard local fan openings.
- `snare`: cross lasers plus bounded snare strobes.
- `hatTexture` and `transientTexture`: high-frequency cross detail.
- `downbeatImpact`: short warm-blinder accents.
- `outerHero`: primary gate walls and hero fan edges.
- `innerPrimary`: controlled cross and diamond architecture.
- `fourBarMutation`: motif evolution that preserves gate identity.
- `eightBarRecruitment`: secondary cross and bounded impact readiness.
- `boundedImpact` and `co2Impact`: duration-limited strobe, blinder, and simulated CO₂ events.

The intro uses ominous paired spears. Verse establishes restrained red gates and cyan crosses. Build recruits gate, cross, and snare layers while increasing spread. Pre-drop compresses to a violet or white slit and allows only a purposeful final half-beat blackout. Drop 1 makes kick gates and snare crosses visibly distinct on every beat. Breakdown remains visibly intentional with sparse lavender or white geometry. Drop 2 introduces radial gates, wider diagonal crosses, and a secondary layer while keeping impacts bounded. Outro releases from four lasers to the outer gate pair instead of freezing a full-rig frame.

Red and cyan own the main body, magenta or violet supplies motif accents, orange is reserved for selected phrase or Drop 2 evolution, and white remains an impact color. The declared program ceiling is 220 compiled beams, below the global 300-beam limit.

### Shared musical and visual rules

All three programs respond deterministically to beat, kick, snare, available hat or transient events, downbeat, bar, four-bar, eight-bar, sixteen-bar or phrase, section, and repeated-drop occurrence. Fine Track Map sections that belong to the same macro role do not restart four- or eight-bar progression. Seeking and looping reconstruct the same program state from the playhead, section identity, seed, and lifecycle identities.

Hero beams retain outer architecture and dominant anchors. Primary beams own the central motif. Secondary beams add depth. Texture is discarded first under budget pressure. Impact fixtures are short-lived and bounded. Source blooms remain fixture-local and deduplicated. Each program authors a central aperture rather than relying on accidental darkness, and fixture-keyed targets prevent shared global polygons or wireframe webs.

Static Rig Layout preservation is contractual: the seven original template definitions, names, identifiers, fixture properties, and Rig Layout browser cards are not modified by program playback or registration. The new shows appear only in the Performance Shows category and use canonical preset selection and the existing performance controls.

## Authored LED-grid and moving-head Performance Shows

The two non-laser architectural source rigs are active as complete authored Performance Shows. They use the same macro musical clock, section occurrence model, resolver, persistence, seeking, looping, and safety-blackout authority as the laser shows, but their actions remain fixture-native. LED fixtures are not converted into laser rays, and moving heads are not given simulated capabilities beyond the existing target, spread, focus, rotation, color, brightness, and movement-style fields.

### LED Bar Grid Performance

**Source Rig Layout:** `led-bar-grid`

LED Bar Grid Performance is a rhythmic architectural wall. The ten canonical LED fixtures are addressed through stable semantic keys rather than inferred coordinates. Its primary banks are:

- `lowerRowKick`: the three middle bars and lower side tubes.
- `upperRowSnare`: the three top bars and upper side tubes.
- `leftColumnResponse` and `rightColumnResponse`: mirrored call-and-response columns.
- `innerGridPrimary`: the two center bars used for restrained scenes and pre-drop compression.
- `outerGridHero`: the outer bars and four tubes that form broad drop architecture.
- `diagonalA`, `diagonalB`, `checkerA`, and `checkerB`: four-bar and Drop 2 structural variations.
- `textureTransient`: narrow high-frequency detail.
- `fullGridImpact`: all ten LEDs, reserved for a maximum quarter-beat white impact.

The intro begins with the center bars and recruits only a quiet outer whisper. Verse establishes cyan and emerald row-column ownership. Build recruits center, upper, lower, and outer banks across successive macro bars. Pre-drop compresses toward the center strip and permits only the authored half-beat final cut. Drop 1 uses broad row, column, and mirrored architecture with separated kick and snare ownership. Breakdown isolates a sparse row or column while remaining visibly intentional. Drop 2 adds diagonal and checker alternation rather than merely raising brightness. Outro releases the grid in ordered stages.

Ordinary scenes use one or two dominant colors, usually cyan and emerald, with blue, violet, or magenta used as a subordinate accent. Full-grid white is bounded to 0.25 beat. Runtime validation reports active LED fixture count, distinct active rows and columns, simultaneous colors, maximum impact duration, and minimum/average/maximum brightness. It intentionally does not expose the Beam Matrix segment total as an LED beam count.

Representative full Drop 2 validation resolves all 10 LED fixtures across 4 source rows and 5 source columns, with no more than 3 simultaneous colors and a non-flat brightness hierarchy. All LED actions are limited to enabled state, brightness, color, and the existing LED chase-direction field. No target points, fan spread, beam travel, or laser appearance actions are authored.

### Moving Head Sweep Performance

**Source Rig Layout:** `moving-head-sweep`

Moving Head Sweep Performance is a phrase-driven four-head movement system with a subordinate PAR wash. Its authored banks are:

- `leftMovement` and `rightMovement`: distinguishable side ownership.
- `innerPrimary` and `outerHero`: restrained center motion versus broad hero expansion.
- `upperRear`: the rear pair used for phrase depth and intro recruitment.
- `kickAccent` and `snareAccent`: separate beat-response pairs that modify brightness or color without replacing the active path.
- `downbeatImpact`: all four heads for a bounded quarter-beat impact.
- `breakdownIsolation`: a single rear head that keeps breakdown motion intentional.
- `washTexture`: the existing PAR wash, kept subordinate to the moving-head architecture.

The intro uses one rear head, then recruits its mirrored partner. Verse establishes a stable mirrored phrase sweep. Build progressively recruits the rear and front pairs while compressing targets inward. Pre-drop holds a narrow fixed center position. Drop 1 expands all four heads into a broad synchronized path with side-specific beat accents. Breakdown returns to one isolated slow bank before a restrained answer. Drop 2 changes to crossing, radial, and figure-eight path families with wider spread and full mirrored-pair participation. Outro returns smoothly toward the opening mirrored shape and releases banks in stages.

Movement targets are changed at bar, four-bar, eight-bar, sixteen-bar, or section timescales. Beat, kick, and snare mutations accent brightness and color, preserving the current phrase path and avoiding random teleportation. Seeking and looping reconstruct target points, spread, focus, rotation, movement style, color, and brightness deterministically from the playhead and lifecycle identities.

Representative Drop 2 validation resolves 4 active moving heads, all 4 members of the two mirrored pairs, at least 2 active movement-bank classifications, a representative spread above 20 degrees, a maximum impact duration of 0.25 beat, and 4 legitimate moving-head beam sources. The PAR wash is reported as texture rather than a moving-head or laser beam.

### Supported-property and preservation boundaries

Both programs are schema-version-3 authored programs with complete intro, verse, build, pre-drop, Drop 1, breakdown, Drop 2, and outro scenes. They respond at beat, rhythm-event, bar, four-bar, eight-bar, phrase, section, and repeated-drop timescales. Capability inspection must report no unsupported fixture-action warnings. Resolver diagnostics must report no incompatible writes. The original `LED Bar Grid` and `Moving Head Sweep` static Rig Layout templates remain byte-equivalent before and after performance registration, cloning, playback, seeking, and looping.

## Authored impact and atmosphere Performance Shows

The two impact and atmosphere source rigs are active as complete authored Performance Shows. Both remain virtual DRMVYZ visualizations. They add no physical output path, fixture-control claim, new compositor, new timing engine, or renderer replacement.

### Strobe + Blinder Performance

**Source Rig Layout:** `strobe-blinder-hits`

Strobe + Blinder Performance is a transient-owned impact show whose default scene body remains dark. Its authored banks are:

- `kickStrobeBank`: center strobe only.
- `snareStrobeBank`: paired left and right strobes.
- `downbeatStrobeBank`: all three strobes for bounded structural accents.
- `leftBlinderBank` and `rightBlinderBank`: alternating warm side impacts.
- `fullImpactBlinderBank`: all three blinders for short section impacts.
- `buildPulseBank`: paired side strobes recruited through the build.
- `breakdownIsolationBank`: center strobe and center blinder for sparse punctuation.

The intro uses isolated eight-beat ticks. Verse limits activity to restrained kick, snare, and occasional side-blinder accents. Build recruits side strobes first, then center and alternating blinder banks as build progress rises. Pre-drop uses an isolated center hold followed by a maximum half-beat authored blackout. Drop 1 separates kick, snare, downbeat, side-call, and selected strong-transient ownership. Breakdown returns to sparse center events. Drop 2 increases response frequency and bounded duration rather than leaving fixtures active. Outro falls back to an eight-beat center pulse and then disables all impact fixtures.

Authored limits and validation metrics are:

- Maximum strobe action: **96 ms**.
- Maximum blinder action: **240 ms**.
- Maximum full-frame white strobe duration: **96 ms**.
- Maximum scheduled beat-envelope activation ratio: **0.24 of one beat**.
- Kick bank: **1 center strobe**.
- Snare bank: **2 side strobes**.
- Downbeat bank: **3 strobes**, with side-blinder accents scheduled separately.
- Drop entry: up to **6 active impact fixtures**, immediately bounded by action duration and response envelopes.
- Breakdown representative body frame: **0 active impact fixtures**, with isolated events capped at one bank.
- Maximum compiled impact representation: **24 Beam Matrix segments** under the existing compiler.

Tests assert kick-to-snare bank difference, downbeat difference, build escalation, bounded pre-drop blackout, Drop 1 impact, sparse breakdown, faster Drop 2 recruitment, continuous-on prevention, full-frame luminance duration, static-rig immutability, deterministic seeking and looping, and final blackout authority.

### Haze + CO2 Performance

**Source Rig Layout:** `haze-co2-drops`

Haze + CO2 Performance is an atmosphere-and-impact companion with two haze fixtures and three simulated CO2-style plume fixtures. Its authored banks are:

- `baseHazeBank`: restrained intro, verse, breakdown, and release atmosphere.
- `buildHazeBank`: progressively rising build atmosphere.
- `dropHazeBank`: capped Drop 1 and Drop 2 atmosphere.
- `leftCo2ImpactBank` and `rightCo2ImpactBank`: alternating virtual side plumes.
- `downbeatCo2ImpactBank`: center plume for major downbeats and transitions.
- `drop2ExpandedImpactBank`: all three virtual plumes for selected Drop 2 structure.
- `outroReleaseBank`: both haze fixtures, explicitly released to zero.

The global haze envelope is intentionally non-monotonic: intro **0.10**, verse **0.22**, build **0.40 plus up to 0.18 build-progress modulation**, pre-drop **0.08**, Drop 1 **0.48**, breakdown **0.14**, Drop 2 **0.58**, and outro **0.10** before the final release. Fixture haze intensity is capped at **0.62**. This keeps atmosphere supportive without turning the frame into permanent gray output or hiding fixture origins and protected negative space.

Simulated CO2-style bursts are short and deterministic. Drop 1 alternates one left or right plume on an eight-beat cycle. Drop 2 retains that alternation and adds a selected sixteen-beat three-plume impact. The maximum authored burst is **650 ms**, and the maximum scheduled burst-envelope activation ratio is **0.32 of one beat**. No scene body continuously enables a plume. The expanded virtual impact compiles to at most **3 plume sources**.

Tests assert haze occupancy and cap, build growth, pre-drop reduction, a breakdown-to-Drop 1 haze ratio below **0.35**, stronger capped Drop 2 atmosphere, alternating one-fixture left and right bursts, three-fixture Drop 2 recruitment, continuous-burst prevention, renderer fog contribution caps, clean outro release, static-rig immutability, deterministic seeking and looping, and final blackout authority.

### Safety, persistence, and preservation boundaries

Both programs use schema version 3 and the existing transient scheduler, Track Map section model, musical clock, performance resolver, compiler, persistence state, seek identity, loop identity, and lifecycle invalidation. Program blackout may add a bounded cut but cannot clear user, authored, or safety blackout. Registry hydration recognizes all ten built-in Performance Program identifiers, including the impact and atmosphere programs. The original `Strobe + Blinder Hits` and `Haze + CO₂ Drops` static Rig Layout templates remain unchanged and independently selectable.

## Persistence and migration

Projects created before performance programs normalize to a disabled default state. Program definitions normalize to schema version 3, including bounded blackout windows, section energy envelopes, and bar-progression stages. A legacy built-in ID-only project hydrates a fresh cloned program from the current built-in registry. A missing or removed built-in ID is suppressed safely instead of appearing enabled without an executable program.

Malformed program data normalizes to a disabled or safely suppressed state. Stable semantic fixture and group keys survive recreation and preset reload. Clearing a program leaves the authored rig intact.

## Performance and lifecycle

- No persisted store write occurs per animation frame.
- The resolver returns transient data and does not subscribe React components to raw AudioFeatureBus cadence.
- Normalized authored rigs, analysis identities, sorted beat grids, and already-resolved section arrays are cached by immutable object identity.
- Thumbnail rendering does not own a hidden continuous animation loop and cannot arm production output.
- Pause, engine switching, Show Director exit, context loss, disposal, and renderer shutdown clear transient state and fail dark at the production-output boundary.
- Preset, track, analysis, seek, and loop identities invalidate stale state deterministically.

## Known limitations and safety statement

This feature is a **2D visual performance system**. It does not model real-world projector placement, audience scanning, optical power, divergence, venue geometry, interlocks, regulatory zones, or physical beam paths.

These presets do **not** claim physical laser safety compliance. They do **not** provide compliant physical laser hardware output merely by being selected or rendered. Any future physical output requires independently engineered hardware, venue review, trained operators, jurisdiction-specific compliance, exclusion zones, interlocks, and appropriate safety certification.

The application remains virtual-first. WebGL2 or Canvas2D display output and deterministic beam budgeting are visual/runtime safeguards, not a substitute for physical laser-safety engineering.

## Final rendered visual hierarchy and validation

The final rig-backed conversion has one deterministic acceptance path for all ten built-in Performance Shows. It audits authored state, transient runtime state, the Show Director compiler, Beam Matrix compilation, the production WebGL2 light pipeline and Canvas2D compatibility beam/fog renderers, persistence boundaries, and static source-rig immutability. Fixture-state tests remain useful, but they are not accepted as a substitute for rendered inspection.

### Canonical ten-show library

The `Performance Shows` category contains exactly these stable built-in definitions:

| Performance Show | Program identifier | Source Rig Layout |
| --- | --- | --- |
| Prism Cathedral | `prism-cathedral` | Authored showcase rig |
| Cardinal Fan Reactor | `cardinal-fan-reactor` | Authored showcase rig |
| Cyan Mirror Cage | `cyan-mirror-cage` | Authored showcase rig |
| Small Club Performance | `small-club-rig-performance` | `small-club-rig` |
| Festival Front Beams Performance | `festival-front-beams-performance` | `festival-front-beams` |
| Dubstep Drop Lasers Performance | `dubstep-drop-lasers-performance` | `dubstep-drop-lasers` |
| LED Bar Grid Performance | `led-bar-grid-performance` | `led-bar-grid` |
| Moving Head Sweep Performance | `moving-head-sweep-performance` | `moving-head-sweep` |
| Strobe + Blinder Performance | `strobe-blinder-hits-performance` | `strobe-blinder-hits` |
| Haze + CO2 Performance | `haze-co2-drops-performance` | `haze-co2-drops` |

The seven source Rig Layout cards remain in `Rig Layouts`, retain their original identifiers and editable fixture data, and never receive transient playback mutations. Loading, seeking, looping, reloading, or switching a Performance Show creates an independent rig instance and cannot alter a source template or a saved static project.

### Render hierarchy, palette, and negative space

Semantic beam roles survive the resolver, Show Director compiler, engine-neutral scene frame, WebGL2 renderer, Beam Matrix compiler, and Canvas2D compatibility renderer:

- **Hero** owns outer architecture, dominant fan edges, and major anchors.
- **Primary** owns the readable motif body.
- **Secondary** adds depth and supporting banks.
- **Texture** is decorative detail and is removed first under budget pressure.
- **Impact** is a bounded transient layer with a brighter core and controlled source bloom.

The renderer uses a narrow glow pass, a saturated body pass, and a tinted bright core. White mixing is role dependent rather than universal. One deduplicated source bloom is emitted per fixture or co-located bank, preventing multi-ray origins from accumulating into oversized blurry clouds. Ordinary scenes prefer one or two dominant colors plus one subordinate accent. White is reserved for bounded impacts, crowns, spears, strobes, blinders, and virtual plume highlights.

Negative space is authored geometry, not accidental darkness. Prism Cathedral protects a composed center, Cardinal Fan Reactor protects a four-bank aperture, Cyan Mirror Cage protects its central corridor, Small Club protects a compact tunnel opening, Festival Front Beams frames a clean stage center, and Dubstep Drop Lasers keeps gate and cross banks locally sourced rather than forming a global wireframe web.

The compiler remains hard-capped at 300 beams. Hero and primary survive first, secondary follows, and texture is shed before structural rays. Haze, persistence, glow, cone opacity, and source bloom stay scene bounded. Safety blackout, user blackout, renderer disposal, and fail-dark output authority remain final.

### Mixed-fixture boundaries

Mixed-fixture programs use only properties already supported by their fixture kinds:

- LED bars and tubes use enabled state, brightness, color, and the existing chase direction. Row, column, diagonal, checker, and full-grid ownership is authored through stable fixture banks.
- Moving heads use existing target, spread, focus, rotation, movement style, color, and brightness. Beat accents preserve phrase motion rather than replacing the active path.
- Strobes and blinders are scheduler-owned transient actions. Strobes are capped at 100 ms in the dedicated show, blinders at 250 ms, and neither is continuously enabled as a scene body state.
- Haze is capped below 0.65 in validation, with authored fixture haze capped at 0.62. Simulated CO2-style bursts are capped at 700 ms in validation and three simultaneous virtual plume sources.

These are virtual performance visualizations with WebGL2 production output and Canvas2D compatibility output. They do not add or imply physical lighting, laser, DMX, or atmospheric-effect control.

### Deterministic 100-frame review

Run the complete review with one command:

```bash
npm run visual:show-director
```

The command extends the existing Playwright and Canvas2D review path. It bundles the review page with the repository's existing esbuild dependency, launches the existing Chromium project, renders production Beam Matrix and fog output, and writes uncommitted artifacts to:

```text
artifacts/show-director-visual-review/
```

Generated artifacts are ignored by the repository and are not committed. The output contains 100 PNG screenshots, 100 per-frame JSON reports, `report.json`, and `counts.json`.

Every show is evaluated at:

1. Intro
2. Verse
3. Build
4. Pre-drop
5. Drop 1 impact
6. Drop 1 body
7. Breakdown
8. Drop 2 impact
9. Drop 2 body
10. Outro

The synthetic review track is 140 seconds at 120 BPM and 4/4, with deterministic seed `0x5a17cafe`. It deliberately uses four-second fine Track Map entries grouped into longer macro sections. This verifies that short fine sections do not reset the four-bar clock or prevent the second eight-bar recruitment stage. Macro spans are Intro 0-16, Verse 16-32, Build 32-48, Pre-drop 48-52, Drop 1 52-76, Breakdown 76-92, Drop 2 92-124, and Outro 124-140 seconds.

Each report entry records show name, source Rig Layout when applicable, Performance Program identifier, track assumptions, deterministic seed, fine and macro section, beat, absolute and macro bar, four-bar index, eight-bar index, sixteen-bar index, drop occurrence, recruitment stage, active motif, active fixture count, compiled and visible beam counts where applicable, fixture-native effect counts, visual metrics, and screenshot/report paths.

The harness performs a deterministic compiler pre-roll before the captured boundary and then evaluates the higher-energy hit or bounded release sample. This mirrors production travel and release envelopes without advancing by wall time, prevents isolated first-frame grow routes from collapsing to their origins, and remains reproducible across seeks and repeated runs.

### Visual and choreography metrics

State, geometry, and rendered-pixel assertions cover:

- Distinguishable fixture origins and active source count
- Active fixture count, compiled beam count, and semantic beam-role counts
- Beam angular diversity and geometry signature
- Protected-zone occupancy and center aperture or corridor preservation
- Frame luminance, visible luminance, saturation, dominant-color ownership, and black-frame ratio
- Left-right and top-bottom symmetry
- Hero-to-texture brightness ratio and source-bloom occupancy
- Beat-to-beat, kick-to-snare, four-bar, and eight-bar differences
- Drop-to-Verse density and Drop 2-to-Drop 1 structural difference
- LED row, column, color, and brightness ownership
- Moving-head bank, target, spread, and path signatures
- Strobe, blinder, and virtual plume activation counts and durations
- Haze occupancy and outro release
- Static source-rig immutability and cross-show runtime isolation

The assertions detect long accidental darkness, many-bar state stagnation, shared global wireframe geometry, hidden origins, washed sustained body color, oversized source blooms, missing event distinction, unreachable recruitment, duplicate Drop 2 structure, continuous impact fixtures, excessive haze, and transient state leaking into static rigs.

A bounded Drop 1 or Drop 2 white impact may use a slightly higher bright-pixel allowance than a body frame. The next body frame remains subject to the stricter saturation and wash thresholds, so a legitimate short impact cannot disguise a sustained gray or pastel scene.

### Acceptance criteria by show

**Prism Cathedral** renders deliberate cathedral X, diamond, crown, and lower-wing architecture; keeps local origins and a composed center; maintains sparse visible breakdown spears; and returns with an evolved Drop 2.

**Cardinal Fan Reactor** renders identifiable top, bottom, left, and right local fan banks around a protected aperture; preserves quadrant color ownership; and uses a bounded white impact before returning to saturated Drop 2 structure.

**Cyan Mirror Cage** renders balanced mirrored cyan walls, distinct upper, middle, and lower roles, inward chevrons or X geometry, and a protected dark corridor through both drops.

**Small Club Performance** renders compact local fans, mirrored tunnel or aperture geometry, distinct upper and lower roles, controlled dense drops, a sparse breakdown, and a second-drop tunnel expansion.

**Festival Front Beams Performance** renders wide local fan banks, hero outer edges, layered primary rays, clean stage-center framing, progressive recruitment, and a larger diagonal or radial Drop 2.

**Dubstep Drop Lasers Performance** renders visibly different kick gates and snare crosses, perceptible every-beat motion, aggressive coherent local geometry, short purposeful cuts, bounded strobe/blinder/plume accents, and an evolved second drop.

**LED Bar Grid Performance** renders stable row and column ownership, separated kick and snare regions, progressive build recruitment, a broad Drop 1, sparse breakdown, and diagonal, checker, or mirrored Drop 2 structure. Full-grid white remains quarter-beat bounded.

**Moving Head Sweep Performance** renders smooth phrase paths, distinguishable left and right banks, beat accents that preserve motion, build compression, drop expansion, deterministic seek positions, and an eight-bar outer-bank path evolution in both drops.

**Strobe + Blinder Performance** renders no continuous activation, separate kick, snare, downbeat, and side ownership, short full-frame impacts, a sparse breakdown, explicit four-bar call/response, reachable eight-bar bank expansion, bounded sixteen-bar evolution, and a larger but still capped Drop 2.

**Haze + CO2 Performance** renders restrained atmosphere, progressive build haze, bounded drop-support plumes, reduced breakdown haze, explicit four-bar plume motifs, reachable eight-bar atmosphere expansion, capped sixteen-bar evolution, stronger Drop 2 support, and a clean zero-haze outro release.

### Persistence, seeking, looping, and regression contract

Program identity, intensity, variation, seed, source linkage, selection, reload state, and invalidation identity use the existing persistence model. Seeking or looping reconstructs the same section occurrence, motif, recruitment stage, fixture targets, effect envelopes, and compiled output from transport time and lifecycle identity. Runtime compiler state is isolated per review resolution and per loaded show. No production debug overlay, center-canvas control, renderer replacement, dependency, or second timing engine is introduced.

The final regression contract is:

1. Seven static Rig Layouts remain static, editable, and independently selectable.
2. Seven rig-backed Performance Shows load separately from their source layouts.
3. All ten Performance Shows resolve deterministically and preserve local geometry.
4. Four-bar continuity and eight-bar recruitment survive short Track Map entries.
5. Beat behavior animates coherent motifs, with distinguishable kick and snare ownership where supported.
6. Breakdowns stay intentional, blackouts stay short, and outros release cleanly.
7. Drop 2 changes structure rather than merely increasing brightness.
8. Beam hierarchy, negative space, mixed-fixture property boundaries, bounded effects, and the 300-beam ceiling remain enforced.
9. Safety blackout remains dominant.
10. The three original showcase Performance Shows remain regression protected by the same 100-frame rendered review.
