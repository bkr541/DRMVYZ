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

## Persistence and migration

Projects created before performance programs normalize to a disabled default state. A legacy built-in ID-only project hydrates a fresh cloned program from the current built-in registry. A missing or removed built-in ID is suppressed safely instead of appearing enabled without an executable program.

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
