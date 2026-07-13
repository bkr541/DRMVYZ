# Show Director Performance Programs

Show Director Performance Programs are deterministic, full-song choreography layers for the existing LaserDMX **2D Canvas2D** renderer. They do not replace Beam Matrix, create a second renderer, or introduce a separate audio-analysis engine.

## Architecture and authority

The persisted project owns two separate things:

1. The authored Show Director rig: fixtures, groups, targets, cues, and user edits.
2. The optional performance-program state: program definition or built-in ID, enabled state, tuning, seed, preset identity, and runtime invalidation identity.

Each render frame builds a transient runtime rig from the authored rig plus the active program. The resolver is pure with respect to persisted state. It never writes runtime fixture mutations back to Zustand and never turns temporary brightness, targeting, recruitment, color, or role changes into authored edits.

The runtime path is:

`Track analysis / manual Track Map sections -> Music Intelligence -> AudioFeatureBus -> performance context -> performance resolver -> Show Director compiler -> Beam Matrix compiler -> Canvas2D renderer`

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

Forward frame gaps still report any crossed absolute and performance four-, eight-, and sixteen-bar boundaries. An explicit seek, backward transport movement, loop wrap, track replacement, analysis replacement, preset reload, or seed/invalidation change reconstructs all block indexes from the target playhead instead of replaying missed mutations. Pausing does not advance choreography, and the Canvas2D renderer owns no independent animation loop.

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

Patch 1 fixture-local target geometry remains authoritative. The continuity resolver does not replace fixture-keyed target arrays with shared global targets, so projector origins, deliberate negative space, and the Cyan Mirror Cage center corridor survive phrase evolution, seeking, and looping.

## Section energy envelopes and full-song arc

Performance-program schema version 3 adds explicit `intro`, `verse`, `build`, `preDrop`, `drop1`, `breakdown`, `drop2`, and `outro` energy envelopes. Every built-in show declares target ranges for active fixture groups, estimated beam count, fixture brightness, fan spread, movement strength, global glow, normalized density, and negative space. Music Intelligence can modulate inside the authored architecture, while the resolver caps accidental overshoot and retains the section hierarchy.

The built-in arc follows these deterministic rules:

- Intros begin with one fixture family and recruit a second family later instead of opening at drop density.
- Verses remain visibly alive on every beat and retain authored negative space.
- Builds use one-based macro-section bar progression. Successive bars recruit groups, widen fans, increase endpoint motion and brightness, and reduce negative space. The final build beat contracts and freezes the composition for tension.
- Pre-drops narrow to a small spear or aperture allocation and may use only their authored bounded blackout window.
- Drop entry activates the primary bank immediately, adds a white impact layer, and then resolves into the existing Patch 3 beat-bank and four-/eight-bar drop-body choreography.
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

The compact status surface reports current section, occurrence, scene, four-bar variation, eight-bar recruitment stage, beam demand, and capability or fallback diagnostics. It uses a fingerprinted external-store snapshot rather than raw audio-frame React state. No center-canvas control overlay is used.

## Static Rig Layouts and rig-backed Performance Shows

A static Rig Layout remains an editable Show Director authoring preset. Loading one creates a normal authored rig, keeps its existing preset identifier and category, and clears any incompatible active Performance Show. Static layouts, saved user edits, and custom rigs are not rewritten by the performance system.

A rig-backed Performance Show is a separate authored show definition. It links a Performance Show identifier to one canonical built-in Rig Layout and one dedicated Performance Program identifier. The base rig is recreated through the existing Rig Layout factory, then normalized into an independent performance-owned instance. The performance runtime never mutates the source template, a saved static layout, or another loaded instance.

The seven conversion foundations are registered in `LaserDmxShowDirectorRigBackedPerformanceShows.ts` with status `foundation`:

1. Small Club Rig Performance
2. Festival Front Beams Performance
3. Dubstep Drop Lasers Performance
4. LED Bar Grid Performance
5. Moving Head Sweep Performance
6. Strobe + Blinder Hits Performance
7. Haze + CO₂ Drops Performance

Foundation-only definitions are intentionally omitted from the Performance Shows browser. A definition becomes selectable only after it has an authored program factory and its status changes to `available`. This preserves canonical preset selection and avoids empty or duplicate cards.

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

The planned sequence is: establish this shared foundation, author the laser-forward source shows, author the mixed movement/LED shows, author the impact/atmosphere shows, then perform final integration and visual validation. Each later conversion supplies its own scenes, transient choreography, palette hierarchy, recruitment order, budgets, negative-space rules, and blackout policy.

## Authored rig-backed laser Performance Shows

Patch 2 activates the three laser-forward source rigs as complete authored Performance Shows. Their original Rig Layout cards and identifiers remain unchanged. Selecting a Performance Show clones its canonical source rig into an independent transient working rig, then resolves the dedicated program through the existing musical clock, resolver, compiler, Beam Matrix, Canvas2D renderer, persistence, and safety-blackout path.

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

The current browser application remains virtual-first. Canvas2D display output and deterministic beam budgeting are visual/runtime safeguards, not a substitute for physical laser-safety engineering.

## Final rendered visual hierarchy and validation

The final Canvas2D finish carries semantic beam roles from the performance resolver through the Show Director compiler and Beam Matrix compiler into the renderer. The roles are not interchangeable brightness labels:

- **Hero** beams own the main architecture, fan edges, and structural anchors. They receive the strongest saturated body, brightest controlled core, and highest ordinary beam priority.
- **Primary** beams form the readable fan body and repeated architectural lines. They retain a saturated body and clear core without competing with hero beams.
- **Secondary** beams add depth, diagonal banks, cage edges, and supporting geometry with narrower cores and lower glow.
- **Texture** beams provide the quietest detail layer. They are the first visual layer removed under beam-budget pressure.
- **Impact** beams are bounded transient accents with a whiter core and slightly stronger source bloom. Impact styling does not replace the surrounding bank colors and does not promote the entire frame to gray-white haze.

The renderer uses three controlled line passes: a narrow screen-composited glow, a saturated source-over body, and a tinted bright core. Core white mixing is role dependent instead of universal. Fog and persistence are capped by the active performance scene, so dense frames retain ray separation rather than relying on wider blur. Performance haze may reduce an authored static fog level, but safety blackout and user blackout authority remain unchanged.

Fixture origins use one deduplicated source bloom per fixture or co-located fixture bank. The bloom selects the strongest active role at that source, scales with beam intensity, fixture brightness, and global intensity, and remains below the renderer's bounded source radius. Multiple rays sharing one origin therefore read as attached to a small bright lens rather than accumulating into a large diffuse cloud.

### Palette and negative-space rules

Prism Cathedral uses cyan and magenta as the dominant pair, lavender as support, and white only for bounded crowns, spears, or impacts. Cardinal Fan Reactor keeps quadrant ownership: cyan or blue above, orange or red below, blue or violet left, magenta right, with one white impact ray per principal bank. Cyan Mirror Cage uses cyan and icy blue walls plus restrained lavender or white accents.

Ordinary scenes prefer one or two dominant colors and one accent. Full multicolor allocation is reserved for evolved Drop 2 structures or bounded impact moments. The local target geometry from the first remediation patch remains authoritative after every visual-role mutation.

Negative space is authored as structure:

- Prism Cathedral protects a composed center around its X, diamond, crown, and lower-wing geometry.
- Cardinal Fan Reactor protects a central aperture between top, bottom, left, and right local fan banks.
- Cyan Mirror Cage protects a dark central corridor while upper, middle, and lower mirrored roles remain visible.

### Deterministic rendered review

Run:

```bash
npm run visual:show-director
```

The command bundles only the visual-review entry with the repository's existing esbuild dependency, launches the existing Playwright Chromium project, renders through the production Canvas2D fog and Beam Matrix functions, and writes uncommitted artifacts to:

```text
artifacts/show-director-visual-review/
```

Each preset receives ten 640×360 PNG frames plus entries in `report.json`:

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

The deterministic synthetic track uses 120 BPM, 4/4 time, seed `0x5a17cafe`, and explicit section spans from 0 to 108 seconds. Every report entry records preset and frame IDs, time, section, macro bar, authored fixture count, active source count, compiled beam count, active motif, recruitment stage, geometry metrics, and rendered pixel metrics.

Geometry assertions cover distinguishable origins, active source count, angular diversity, protected-zone occupancy, central aperture or corridor preservation, left/right symmetry, saturation, luminance, black-frame ratio, adjacent-beat difference, four-bar difference, Drop-to-Verse density, Drop 2 structural growth, dominant-color count, and hero-to-texture brightness ratio. Browser assertions additionally measure visible-pixel luminance, lit-pixel ratio, black-frame ratio, saturation, and high-luminance source-bloom occupancy.

Generated PNGs and reports are review artifacts and are not production UI overlays. They are not committed unless a future repository-wide visual-baseline convention explicitly adopts them.

### Built-in acceptance criteria

**Prism Cathedral** must render mirrored cyan and magenta architecture, a readable X or diamond, lower wings, bright controlled origins, and a composed center. Its breakdown uses sparse white or lavender full-length spears.

**Cardinal Fan Reactor** must render four identifiable local origins and fan banks around a clean aperture. Drop 1 owns strong quadrant colors. Drop 2 adds diagonal banks and radial density while preserving source and aperture clarity.

**Cyan Mirror Cage** must render balanced mirrored cyan walls, inward arrowheads or X geometry, distinct upper, middle, and lower roles, and a protected dark corridor. White impacts may punctuate the frame but cannot erase the corridor.

All three shows remain under the 300-beam hard limit. Hero and primary identity survive budget pressure, secondary structure follows, and texture or decorative detail is shed first.
