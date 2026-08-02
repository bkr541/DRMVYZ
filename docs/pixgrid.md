# PixGrid

PixGrid is DRMVYZ's programmable LED-pixel React View engine. It renders authored artwork, prepared user media, sparse cell edits, smart-group reactions, Shared Performance choreography, and Track Map actions into one deterministic logical framebuffer. A WebGL2 presentation pass then displays each logical texel as a crisp LED cell with dark physical gaps. Canvas2D remains the bounded fallback.

## Supported MVP media

PixGrid accepts PNG, JPEG/JPG, static WebP, and SVG files selected through the existing Media Library. Media references and conversion settings are persisted; decoded pixels, object URLs, `ImageBitmap` objects, and GPU textures are transient and cleaned up by their owning cache or renderer.

Animated GIF, animated WebP, video, sprite-sheet slicing, and image sequences are intentionally deferred. Invalid, deleted, unavailable, or revised media is reported without corrupting the authored PixGrid state.

## Quality and output

| Tier | Logical matrix | Intended use |
| --- | ---: | --- |
| Draft | 64 × 36 | Explicit lightweight preview |
| Low | 96 × 54 | Minimum adaptive live resolution |
| High | 160 × 90 | Default production quality |
| Ultra | 256 × 144 | High-detail output on capable GPUs |

Adaptive mode is the default. It first reduces diagnostics, glow/diffusion work, and secondary presentation effects. Only sustained pressure can reduce the logical matrix, never below 96 × 54. Recovery is gradual and hysteresis prevents rapid quality oscillation. The quality selector changes only the requested tier; only the explicit Adaptive Quality control changes fixed/adaptive mode. Requested and effective quality remain separate. Fixed GPU Draft stays 64 × 36 where supported, while adaptive safety-floor or Canvas2D promotion is published as effective Low without overwriting the saved Draft request. Thumbnail rendering has an independent renderer and does not influence live quality.

The logical framebuffer uses nearest sampling. The presentation shader preserves black/off texels, restrained glow, chromatic highlights, and dark cell gaps at 1080p and 4K. Recording and production output consume the same visible output canvas as normal React View playback.


## Canonical control hierarchy

PixGrid presentation controls use one store action and one authoring-history contract from every compact or advanced surface. A selector or slider must not reproduce quality-mode, normalization, or history policy inside a React component.

- **Output Intensity** is the primary PixGrid brightness control and persists in the legacy `globalIntensity` field.
- **Authored Performance Trim** is the React-wide automatable trim passed to the PixGrid renderer. It remains separate because presets and authored performance automation already target it.
- **Cell Calibration** is the advanced per-emitter compatibility/calibration factor persisted in `cellBrightness`.
- The renderer resolves final output once as `Output Intensity × Authored Performance Trim × Cell Calibration`; WebGL2 and Canvas2D consume the same resolved value, and Advanced diagnostics publish every factor plus the product.
- **Glow** controls halo strength. **Halo Radius** controls halo width. **Diffusion** controls emitter edge softness. These are mathematically distinct renderer inputs in both backends.

Persisted intensity and glow fields remain compatibility inputs. This contract does not add a state version because it introduces no new persisted field and performs no repeated load-time recombination.

The quick and Design quality selectors both call `setPixGridRequestedQuality`. `setPixGridQualityMode` is the only operation that changes fixed/adaptive policy. All duplicate presentation surfaces call `setPixGridPresentation` and therefore create equivalent validation and undo/redo transactions.

Program operations are intentionally separate:

- **Load Program Preset** loads the complete matching PixGrid preset and may replace artwork, presentation, and performance configuration. It updates active-preset provenance and creates a PixGrid history boundary by clearing incompatible PixGrid undo/redo snapshots, so a broad preset replacement cannot be partially undone into a hybrid preset.
- **Change Performance Program Only** changes only the Shared Performance Program ID and resets that program's route/section overrides. It preserves artwork, scenes, groups, Track Map cues, conversion settings, and unrelated presentation state, and marks the current PixGrid configuration as custom.

The compact Group Reaction editor is a non-destructive summary editor. It exposes a safe field subset using the same field definitions as the full route editor, visibly indicates advanced values, and never normalizes or deletes conditions, ranges, cooldown, quantization, blend, envelope precision, or priority merely because the compact panel opened. **Open Full Route Editor** transfers the same stable assignment ID to the canonical Routing or Events workspace.

Compact live status is limited to active program, owner, section, one warning/override summary, and the truthful requested/effective quality summary. Route banks, arcs, bindings, conditions, cue internals, and resolved compatibility products live in the canonical Analysis/Choreography diagnostics surfaces.

## Built-in presets

- **Bass Beacon** centers readable BASS typography, rings, bursts, impact chevrons, and percussion reactions.
- **Geometric Reactor** develops tunnels, rings, diamonds, chevrons, orbit nodes, and geometric build/drop structure.
- **Pixel Parade** combines an original pixel mascot, stars, wave lanes, equalizer movement, and later-drop evolution.

All built-in artwork is generated from the typed PixGrid asset manifest. Preset layers, scenes, masks, animations, groups, and performance programs remain engine-specific even though musical context comes from shared infrastructure.

## Editor workflow

1. Select **PixGrid** in React View and choose a preset.
2. Open **Edit PixGrid** to activate the visualizer overlay. Normal playback keeps the center render-only.
3. Add or select scenes and layers, then position, scale, rotate, mask, animate, hide, or reorder them.
4. Use pencil, eraser, line, rectangle, fill, marquee, move, pan, zoom, and eyedropper tools for sparse cell overrides.
5. Use Undo/Redo for bounded authoring transactions. Close the overlay to restore normal playback focus and shortcuts.
6. Select compatible media from the Media Library, adjust fit, sampling, palette, dithering, alpha, and image controls, then add it to the composition.

The future dedicated Visual Manager is not part of this MVP.

## Smart groups and audio routing

Smart groups compile compact masks from manual selections, layer alpha, foreground/background, color or luminance ranges, connected regions, borders, centers, quadrants, bands, alternating rows or columns, checkerboards, diagonals, radial rings, deterministic clusters, and safe SVG metadata.

Each group can route existing Music Intelligence or Shared Performance signals to brightness, palette, color, opacity, scale, position, reveal, hide, blink, outline, sparkle, displacement, frame advance, animation speed, reverse, dissolve, invert, or posterize behavior. Kick, snare, hat, beat, bar, phrase, section, energy, bands, semantic moments, and other supported sources remain independently assignable. PixGrid does not create a duplicate audio-analysis engine.

## Full-song choreography

Each built-in preset has an authored PixGrid Performance Program resolved through the engine-neutral Shared Performance Core. Programs react to song sections, section occurrence, entry/body/exit phases, beat and percussion events, 4/8/16-bar development, phrase boundaries, energy, and semantic moments. The resolver reconstructs state from authoritative musical time, so seeking, looping, pause, track replacement, and repeated playback remain deterministic.

Manual locks and Track Map actions take precedence over lower-priority automatic choreography without invoking LaserDMX fixture, beam, or runtime state.

## Structural choreography and post-composite magnitude

`PixGridStructuralChoreographer` converts authoritative section identity, section progress, beat, downbeat, bar entry, four/eight/sixteen-bar boundaries, and drop impact into bounded decaying envelopes. It produces a section-aware `motionScale`, smoothed structural energy, transient impact, development stages, and an ordered visual-effect plan. The section profile restores a readable energy arc in which drops exceed builds, builds exceed verses, and pre-drop suspension remains intentionally restrained.

The choreographer resets on timing discontinuity or track-identity change. Event responses decay over wall-clock time rather than existing for one animation frame, so a drop impact has a visible tail and remains consistent across supported genre tempos.

`PixGridVisualEffectStack` runs after logical composition and transition resolution. Its allocation-reusing operators include exposure, contrast, bloom, chroma shift, posterize, invert, strobe, scanline, and shake. Operators preserve transparent cells, clamp channel values, and are applied to the shared logical framebuffer before Canvas2D or WebGL2 presentation. They do not change the persisted layer graph, group assignments, or authored media.

Canvas2D and WebGL2 consume the same structural choreography and post-composite logical frame. A renderer must not invent its own section arc, effect timing, or magnitude calibration.

## State migration and live global controls

Persisted PixGrid documents carry an overall state schema version plus configuration metadata for their source preset, authored preset-configuration version, music-reactive configuration version, customization state, and last migration result. Rehydration does not use nonempty layers as proof that a document is complete. Built-in-derived states are merged with the current canonical preset by stable group and assignment IDs, while user layers, transforms, palettes, media, sparse cells, custom groups, route edits, program overrides, and scene selection remain intact. The merge is deterministic and idempotent.

If a custom scene has visible artwork but no executable audio assignments, the live runtime attaches a small, stable fallback route set for bass, kick, and overall energy. These routes are runtime-only and do not replace or duplicate the user's persisted artwork or routing document.

Global **Bass Reactivity** is applied to bass-family Music Intelligence values before assignment and performance-action evaluation. Kick, bass, sub, low-mid, and bass-stem responses scale smoothly from suppressed at 0 to the authored response at 1; independent signals such as snare and phrase boundaries remain available. Global **Motion** multiplies scene and layer animation clocks without changing the Shared Performance clock. Motion 0 freezes autonomous motion while event-driven one-shots can still execute. WebGL2 and Canvas2D consume the same resolved PixGrid state, audio frame, and group effects.

## Track Map actions

PixGrid actions live in the existing Track Map cue architecture and snap to the authoritative Beat Grid. They can select scenes, show or hide layers/groups, flash or dissolve groups, reveal rows/columns, change palette/background, start/stop/reverse/jump animations, transform targets, freeze, clear/restore, toggle automatic performance, and apply bounded manual overrides.

Transitions include cut, crossfade, palette fade, row/column/checker wipes, pixel dissolve, radial reveal, and power on/off. Transition buffers are transient. Cue replay reconstructs the correct state after seeks and loops; no second timeline is created.

## Brand Kit modes

Imported artwork supports Original, Hybrid, Preset, and Brand color modes. Brand strength, palette size, dithering, black preservation, white preservation, contrast, brightness, saturation, edge enhancement, and background handling can be adjusted without embedding converted image data in persisted state.

## Performance, memory, and recovery

- Scene, layer, group, reaction, override, history, cue, cache, mask, and active-action counts are bounded.
- Prepared media uses deterministic LRU eviction and revision-aware invalidation.
- SVG parsing, fetched media size, framebuffer dimensions, group-mask atlases, and transition allocation are guarded.
- Framebuffers are reallocated only when dimensions actually change.
- Render loops reuse typed arrays and do not create store subscriptions.
- Renderer disposal releases programs, textures, framebuffers, vertex arrays, masks, observers, animation frames, and retry timers.
- Temporary WebGL creation or render failures fall back safely and retry with bounded backoff rather than becoming sticky.
- Context loss/restoration, missing media, media revision changes, invalid SVG, corrupt persisted state, unsupported quality values, empty analysis, pause/stop, and failed transition allocation have explicit repair or fallback paths.

For best results, keep High/Adaptive selected for normal production, use Ultra only when the output GPU has headroom, keep imported artwork high-contrast, and avoid stacking many full-screen additive layers when a compact smart group can express the same reaction.

## Perceptual Audio Intelligence calibration

Bundled PixGrid content is calibrated against ordinary live analyser distributions, not only source values of `1.0`. The canonical fixture profiles include silence, weak transients, normal and strong kick/snare events, low/medium/strong sustained bass, verse/build/drop energy, partial confidence, and live-analyser-only capability sets. The repository-owned analyser fixture first establishes a realistic running normalization peak, settles the production band and rhythm filters, then produces ordinary-strength events through `MultiBandAnalyzer` and `RhythmAnalyzer`.

Built-in assignments and Performance Program routes may carry three bounded calibration values:

- `perceptualGain` scales the authored route after normal source mapping and envelope evaluation.
- `minimumEffectiveStrength` establishes a progressive, activity-dependent material floor without turning silence into output.
- `maskSizeCompensation` raises per-cell legibility for compact masks and restrains very large masks.

These values are neutral by default for user-authored routes. They are persisted and migrated only as normal route fields, remain overrideable without rewriting custom routes, and are included in canonical signatures and compiler cache keys. Version-compatible legacy signatures allow untouched Patch 1 routes to receive the new authored calibration while a customized route remains byte-for-byte authored. Signed actions remain signed, so position, withdrawal, inversion, and alternating-direction routes are not forced into a positive-only range.

Discrete built-in routes map realistic event strength before the retained attack/hold/release envelope. They do not apply a second gate to the decaying envelope value. Normal kick and snare events therefore remain readable for their authored hold and release instead of collapsing into a one-frame flash. Cooldown remains independent from envelope duration, retrigger behavior remains bounded, seek reconstruction remains deterministic, and stop/analyser loss returns the image to the quiet baseline.

The three bundled identities use distinct spatial roles:

- **Bass Beacon:** kick concentrates on the core and inner beacon, sustained bass pressures the lower field and rings, snare favors edge and mirrored-side accents, downbeats widen recruitment, and section plans narrow before drops then expand radially.
- **Geometric Reactor:** kick drives the core/rings, snare favors crosses and perimeter geometry, bass energizes tunnel/checker regions, beats pulse hero geometry, bars and phrases alter motif ordering, and later drops change symmetry and recruitment.
- **Pixel Parade:** kick favors lower lanes and impact banks, snare favors upper lanes and props, hats remain restrained on detail banks, bass fills the ground/lower banks, and bar/phrase plans change formations and quantized chase order.

Beat and downbeat routes now have explicit pulse and recruitment roles. Autonomous time-clocked layer animation is reduced at authoring time while beat/bar/cue-clocked animation retains its musical clock. Motion 0 therefore freezes drift, rotation, bounce, and cycling without disabling kick, snare, bass, phrase, section, or cue actions. Bass Reactivity continues to scale only the bass-family source set and has distinct outputs at 0, 0.5, and 1.

The perceptual contract measures material changed-cell ratio, channel/color distance, luminance contrast, spatial localization, envelope duration, onset-to-pixel correlation, section contrast, Bass Reactivity scaling, Motion scaling, deterministic replay, and shared Canvas/GPU semantic inputs. A nonzero byte difference alone is not a passing result.

## PixGrid Deck production ownership

PixGrid Decks use one project-persisted definition and one generated Preset ID per Deck. Source bytes remain owned by the Media system; project export packages normalized Deck definitions plus validated source files and excludes signed URLs, object URLs, compiled frames, transition plans, workers, canvases, and renderer resources. Import validates source fingerprints, reuses an existing canonical media item when the bytes already exist, remaps every successfully restored Deck item, and then replaces the project Deck collection and generated Preset references atomically. Missing or conflicting sources remain explicit in the import result.

The compiler coordinator owns prepared frames at the effective logical matrix resolution. Concurrency remains bounded at three, obsolete expectations abort their jobs, and prepared-frame entries are retained only while reachable from the active Deck collection. Runtime shutdown clears prepared frames, transition plans, compiler status, and the surface-owned adaptive resolution. The sequence clock and transition planner remain independent of renderer FPS and presentation path; Canvas2D and WebGL consume the same logical Deck frame.

Generated Preset deletion and project replacement remove stale Performance Pad assignments, Track Map preset cues, and favorite IDs. Runtime-only Deck editor changes are rebuilt from the generated Preset when it is selected again. The release browser harness exercises the real Show Manager upload, validation, compiler worker, selected-track Audio Intelligence, explicit Preset creation, React selection, source-media export/import, recompilation, and transition readiness path.

Production budgets are intentionally bounded rather than wall-clock promises: at most three image compile jobs run concurrently; prepared-frame and transition caches enforce entry and byte ceilings; no heavy pixel loop or per-frame project-store write belongs on the main thread; and removing, replacing, or closing a project must return cache diagnostics to the reachable working set. Run `npm run verify:pix-grid:deck` for the canonical automated gate.

## Verification

PixGrid coverage includes versioned and idempotent state migration, customized-state preservation, empty-route fallback, Bass Reactivity and Motion control wiring, normalization, media conversion, SVG lifecycle, smart groups, audio routing, performance choreography, structural magnitude, post-composite effects, Track Map actions, renderer ownership, WebGL shader/resource behavior, adaptive quality, deterministic logical framebuffer scenarios, and browser WebGL pixel readback. The pixel suite covers all three presets, imported raster/SVG content, Brand Kit conversion, percussion reactions, four-bar evolution, Track Map transitions, pause, and seek reconstruction.

`PixGridPerceptualMagnitude.test.ts` is the acceptance guard for visible magnitude. It measures sustained and drop luminance, drop frame-change bands, choreography gain over the bare composite, section-energy ordering, decaying impact envelopes, transparent-cell preservation, deterministic output, and stability from 70 through 180 BPM. It is included in both `npm run test:pix-grid:final` and `npm run test:pix-grid:perceptual`.

## Deferred post-MVP features

- Video-to-pixel conversion
- Animated GIF/WebP import
- User sprite sheets
- Image sequences
- Dedicated Visual Manager
- Expanded built-in asset packs

## Advanced Audio Intelligence workspace

When PixGrid is active, the Reactivity workspace is PixGrid-native and contains four subtabs. It does not create a second window or make the center visualizer interactive. The center remains render-only unless **Edit PixGrid** is explicitly enabled.

### Routing

**Routing** exposes continuous assignments from the shipped preset and from the user. Sources are grouped by Frequency, Energy, Musical Development, Progress, Stem and Vocal, and Optional Analysis rather than flattened into one list. Each route shows its origin, target role/bank/scope, enable state, and modification state. Users can add, duplicate, disable, delete, reset, and safely preview routes; edit source, target scope, target, operation, amount, ranges, polarity, curve, smoothing, threshold, hysteresis, attack, hold, release, cooldown, confidence, fallback, Bass Reactivity participation, section/occurrence conditions, priority, and blend; and open a selected smart group in the PixGrid editor with its mask overlay.

Shipped routes are immutable baselines. Edits are stored as compact program overrides, compiled only when the performance configuration changes, and removed by **Reset Route**. User routes remain normal authored assignments. Preset resets clear only performance overrides and locks, preserving imported media and unrelated scene work.

### Events

**Events** exposes beat, downbeat, kick, snare, hat, transient, bar, four/eight/sixteen-bar, phrase, section, drop-impact, semantic, and Track Map event sources. Event routes include attack, hold, release, cooldown, decay curve, quantization, retrigger behavior, confidence, capability fallback, Bass Reactivity participation, conditions, priority, and blend. **Test Trigger** creates a short editor-only preview source identity. It never persists a Track Map cue or changes the authoritative timeline.

### Choreography

**Choreography** presents the active PixGrid Performance Program through native controls and compact inspectors rather than raw JSON. It exposes Auto Performance, intensity, section plans, entry/body/exit action counts, visual roles, role bindings, banks, continuous and event route banks, four-bar motifs, eight-bar recruitment, sixteen-bar evolution, occurrence rules, transitions, density, palette, motion, negative-space targets, capability fallback information, and live runtime stages. Shipped structures can be inspected and enabled, disabled, or adjusted through bounded overrides. **Clear Override** releases temporary layer/route locks; **Reset Performance Configuration** removes program overrides without touching media or scene artwork.

Track Map cue state is shown separately from preset defaults, user changes, and manual locks. Runtime precedence remains Shared Performance Program, replayed Track Map cue state, continuous routes, event envelopes, temporary manual overrides, then transition resolution. Same-time cue ordering continues to use Track Map's normalized order.

### Analysis

**Analysis** displays only authoritative PixGrid input and runtime status. It shows audio-input and analyser state, Shared Performance Core availability, source age and identity, beat/downbeat/bar/phrase/section position, kick/snare/hat strength, bass and overall energy, stem availability, aggregate confidence, active routes with effective amount and envelope phase, inactive-route reasons, affected group IDs and cell counts, smart-group mask status and overlap, active performance actions, scene/motif state, Bass Reactivity gain, Motion multiplier, fallback routes, compiler warnings, validation findings, migration details, renderer path, logical resolution, and FPS.

Each signal is marked Available, Unavailable, Degraded, Using Fallback, or Blocked by Confidence. Missing analysis is displayed as unavailable; the interface does not synthesize diagnostic values. The inspector publishes a throttled status snapshot rather than rerendering React at raw analyser frequency, and its live regions remain quiet unless a concise status change is useful to assistive technology.

## Preset defaults and precedence

PixGrid keeps four kinds of state visibly distinct:

1. **Shipped preset defaults** are the authored baseline program and route banks.
2. **User modifications** are persisted assignments or compact per-route/per-section program overrides.
3. **Temporary live overrides** are layer/route locks and preview triggers.
4. **Track Map cue state** is reconstructed from authoritative track time and never merged into preset defaults.

Reset actions use the existing PixGrid authoring history path where practical. Imported media references, conversion settings, and unrelated sparse pixel edits are not destroyed by a performance reset.

## Advanced routing limits and troubleshooting

Program override normalization is bounded to 256 routes and 128 section plans. Assignment, group, event-envelope, action, transition, history, diagnostics, media-cache, framebuffer, and GPU resource limits remain enforced by their owning runtime. Compilers cache normalized signatures; they are not recreated in the animation hot loop. Group masks use deterministic cache keys and are rebuilt only when dimensions, mask input, or source revision changes.

If a route is silent, inspect **Analysis** in this order: source availability, confidence, fallback state, section/occurrence conditions, target existence, group mask compilation, active cue/manual override state, then renderer status. A missing optional source can use its configured fallback; a route configured with **Disable** remains blocked rather than inventing data. Corrupt persisted overrides are normalized or discarded on load. Missing/deleted media, invalid SVG, missing groups/layers, empty analysis, stopped playback, WebGL context loss, and failed transition allocation retain the existing bounded fallback and recovery paths.

## Audio-frame flow and final diagnostics

The live path is deliberately single-source:

1. Music Intelligence publishes analyser or shared-bus data.
2. Shared Performance Core resolves authoritative track, beat, bar, phrase, section, occurrence, confidence, and boundary state.
3. PixGrid creates one typed audio frame and applies the global Bass Reactivity gain while retaining the unscaled values for routes explicitly authored to bypass that control.
4. `PixGridUnifiedPerformanceRuntime` resolves scenes, performance-program actions, Track Map state, route eligibility, and the structural choreography produced by `PixGridStructuralChoreographer`.
5. `PixGridReactionRuntime` evaluates the same compiled assignments used by the compositor and records whether each route fired, fell back, was disabled, missed a condition, lacked confidence, or remained below threshold.
6. `PixGridCompositor` applies the resolved scene and group behavior, scales authored motion by the structural `motionScale`, resolves transitions, and applies the bounded `PixGridVisualEffectStack` to the logical framebuffer.
7. Canvas2D and WebGL2 present that same logical state and choreography. No renderer performs its own audio routing or structural effect timing.

Diagnostics separate seven reasons for visible change: autonomous layer animation, beat/cue-clocked animation, audio-envelope group actions, performance-program actions, scene/phrase transitions, structural choreography, and post-composite effects. The global Motion multiplier is reported separately from route intensity and structural magnitude, so an author can tell whether a quiet moving layer is autonomous, routed, or section-driven.

Route activity is frame-bounded. The runtime retains only assignment state needed for smoothing, cooldown, and bounded envelopes; the inspector retains no unbounded analyser history. Assignment compilation and group-mask compilation remain signature-cached.

## Validation and bundled-preset audit

`validatePixGridState` is the canonical structural validator. Errors cover missing groups/routes/targets, duplicate stable IDs, invalid masks, unsupported operations, invalid numeric ranges, impossible conditions, broken performance-program references, duplicated migration routes, current-version states missing required configuration, and Canvas/GPU semantic-plan divergence. Warnings identify artistically weak but structurally usable configurations such as ineffective amounts, optional sources without a fallback, bass-sensitive routes that intentionally bypass Bass Reactivity, or a built-in configuration without a common live-source path. Error and warning labels are textual and do not rely on color.

`auditPixGridPresetRenderedReactivity` renders standardized silence, kick, snare, bass sustain, high-energy, build, pre-drop, drop, breakdown, phrase-boundary, second-drop, and outro scenarios. Every bundled preset must compile, validate, change actual rendered pixels, distinguish silence from music, distinguish kick from snare, respond monotonically to Bass Reactivity, respond to Motion, develop drops differently from breakdowns and later drops, and repeat deterministically. Metadata alone does not satisfy the audit.

The separate perceptual-magnitude acceptance test prevents a structurally valid but near-black or near-static result. It asserts readable luminance and bounded frame change for the three built-in presets, verifies that choreography materially exceeds the bare composite, and checks consistent behavior across the supported tempo range.

Source-backed masks such as layer alpha, color, luminance, connected-region, and SVG masks are reported as **resolves during render** until prepared pixels are available. A missing source layer or an authored empty run mask is reported as invalid. Raw matrix-sized masks are never printed in the normal inspector.

## Migration inspection and recovery

Advanced diagnostics expose the current state schema, preset configuration version, original built-in preset ID, whether migration ran in the current session, groups/routes restored or preserved, programs upgraded, customization preservation, conflicts, skipped upgrades, and whether runtime fallback routing was installed. Normal launches remain quiet; lifecycle logging reports actionable validation errors only when development logging is enabled.

Preset switching, track replacement, stop/end-of-track, and stopped-to-playing boundaries reset transient route, cue, performance, and compiled-mask runtime state. A stopped frame uses neutral audio data and clears temporary group effects and transitions. Pause remains distinct: it holds the current visual and envelope state. Analyser loss decays inputs toward neutral rather than freezing maximum reaction; restoring the analyser or a fresh shared-bus frame resumes routing without requiring preset reselection. GPU recovery can render the same frame through Canvas2D without accepting the same discrete trigger twice.

Cooldown is tracked independently from envelope lifetime, so a short flash cannot retrigger before its authored cooldown expires. Timing discontinuities clear future trigger state and rebuild from the available authoritative event identity, keeping backward seeks and loop re-entry deterministic.

## Bass Reactivity and Motion semantics

**Bass Reactivity** scales sub, bass, low-mid, bass-stem activity, and kick before normal route evaluation. Each route has an explicit participation flag. The default is enabled; disabling it is an intentional authored bypass and is visible in validation and the inspector. Capability fallbacks for a participating bass route receive the same effective gain.

**Motion** scales autonomous and beat/cue-clocked layer animation without changing Shared Performance musical time or route-envelope intensity. Motion 0 freezes autonomous movement but does not suppress percussion flashes, route envelopes, performance actions, or phrase/section transitions. This distinction is enforced by rendered-pixel audit scenarios at 0, 0.5, and 1.

## Live perceptual response and truthful status

The Analysis workspace measures the compositor output, not just authored metadata. Both Canvas and GPU publish the same logical frame to a bounded perceptual tracker before renderer-specific presentation. The tracker samples at a controlled diagnostic cadence and retains only one previous framebuffer plus fixed-size onset and response windows.

The Perceptual Response Meter reports changed visible cells and percentage, mean and peak brightness delta, mean perceptual color distance, localized smart-group change, current onset strength, recent onset-to-pixel correlation, active envelopes, scene-transition activity, silence-baseline difference, and visible versus targeted cell counts. High-frequency values use `aria-live="off"`. A separate polite live region announces only meaningful status transitions.

Truthful status never treats route presence as proof of music reaction. The state machine distinguishes audio unavailable, audio with no valid routes, fallback routing, below-threshold routes, empty target masks, likely imperceptible output, visible music reaction, performance-program transitions, autonomous motion only, incomplete migration, and a fully active canonical preset. Warnings include a direct remediation path through source availability, fallback, conditions, target visibility, mask coverage, amount, or migration integrity.

Route inspection exposes stable assignment identity, raw and Bass Reactivity-adjusted source values, threshold, curve output, envelope phase, effective amount, target group, compiled and visible target cells, action, capability fallback, execution state, suppression reason, and estimated perceptibility. Smart-group inspection reports stable ID, source and mask kind, source layers, compiled and visible cells, overlap, current route intensity, affected cells, and hidden or missing content status.

## Final acceptance matrix

The canonical rendered-preset audit now covers fresh canonical state, simulated legacy migration, user overlays surviving migration, analyser-only input, offline-enhanced input, missing advanced sources, silence, beat, downbeat, kick, snare, sustained bass, ordinary energy, build, pre-drop, first drop, breakdown, phrase entry, second drop, outro, Bass Reactivity 0/0.5/1, Motion 0/0.5/1, Canvas/GPU semantic parity, and Draft/Standard/High/Ultra logical resolutions. Response coverage is normalized across logical resolution so quality changes cannot silently weaken choreography.

Renderer parity is audited from a shared semantic plan containing scene, visible layer order, active groups, route-envelope values, affected cells, palette and frame intent, Motion, Bass Reactivity, section, and phrase position. Pixel-perfect equality is not required, but musical semantics must match.

Automated acceptance still does not certify the human-visible result by itself. Follow `docs/PIXGRID_SCREEN_RECORDING_ACCEPTANCE.md`, complete an evidence manifest based on `docs/pixgrid-screen-recording-manifest.example.json`, and run `npm run verify:pix-grid:recording -- path/to/manifest.json`. The release gate is `npm run verify:pix-grid:release -- path/to/manifest.json`; it must not be reported as complete without real recording files and reviewer signoff.
