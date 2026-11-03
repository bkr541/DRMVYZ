# CANVAS

## Purpose

CANVAS is the media-performance engine for still images, SVG, and video. It combines the shared Media Library with authored composition templates, media roles, section-aware playback, effects, transitions, preloading, and Shared Performance orchestration.

The React View engine ID is `canvas`.

## Preset specifications

Data Bleed, Phase Drag, Cellular, Terminal, Fluidity, Divinity and VHS are selectable presets.

- [Data Bleed — data moshing](canvas-data-bleed.md)
- [Phase Drag — slit scan](canvas-phase-drag.md)
- [Cellular — reaction diffusion](canvas-cellular.md)
- [Terminal — ASCII effect](canvas-terminal.md)
- [Fluidity — liquid glass](canvas-fluidity.md)
- [Divinity — god rays](canvas-divinity.md)
- [VHS — CRT and analog treatment](canvas-vhs.md)

## Canonical implementation

| Responsibility | Current authority |
| --- | --- |
| React shell and live surface | `src/components/vyzualz/react/ReactCanvasEngineShell.tsx` |
| Performance resolver | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceEngine.ts` |
| Authored shows | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceShows.ts` |
| Performance types and limits | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceTypes.ts` |
| Composition templates | `src/components/vyzualz/react/canvasPerformance/CanvasCompositionTemplates.ts` |
| Effect recipes | `src/components/vyzualz/react/canvasPerformance/CanvasEffectRecipes.ts` |
| Media roles | `src/components/vyzualz/react/canvasPerformance/CanvasMediaRoles.ts` |
| Playback resolver | `src/components/vyzualz/react/canvasPerformance/CanvasPlayback.ts` |
| Preload manager | `src/components/vyzualz/react/canvasPerformance/CanvasPreloadManager.ts` |
| Transitions | `src/components/vyzualz/react/canvasPerformance/CanvasTransitions.ts` |
| Orchestration stage | `src/components/vyzualz/react/canvasPerformance/CanvasOrchestrationStage.tsx` |
| Validation | `src/components/vyzualz/react/canvasPerformance/CanvasPerformanceValidation.ts` |
| SHIFTGRID foundation | `src/components/vyzualz/react/renderers/shiftgrid/` |
| MUTAGEN direct image renderer | `src/components/vyzualz/react/renderers/mutagen/` |

## React View composition

CANVAS uses:

- **WORKSPACE → SOURCE** in the left rail
- **PRESETS** for authored looks
- **DESIGN → ENGINE / SELECTION** for global and selected-media controls
- **REACT → ROUTING / ANALYSIS** for Shared Performance behavior and diagnostics
- **OUTPUT → RECORDING** for browser capture
- Track Map and Performance Pads in the lower workspace

The CANVAS shell owns its Media Library browser and performance pool inside the engine workspace.

## Media authority

The shared Media Library is the canonical persistent source for CANVAS media. Supported runtime types include common video, still-image, and SVG formats accepted by `getCanvasLibraryMediaType`.

CANVAS maps shared media records into runtime `CanvasMediaItem` values. Storage URLs, proxy URLs, timing metadata, and media roles are resolved through the shared media model.

Legacy session media remains visible only as a compatibility path for older in-memory or blob-URL sessions. New features must not deepen that legacy path or treat session blob URLs as durable storage.

## Performance pool and roles

The performance pool defines the media available to authored CANVAS shows. Each item may receive explicit or inferred roles through `CanvasMediaRoles.ts`.

Manual media selection can establish a lock. Shared Performance orchestration must respect that lock until the user clears it. Automatic selection and authored recruitment must not silently override a current manual lock.

## Authored performance

`CanvasPerformanceEngine` resolves the active show against the authoritative Shared Performance context. It may select media, composition, effects, playback behavior, and transitions based on section, phrase, event, and track state.

Authored behavior is split into reusable domains:

- Composition templates
- Media-role resolution
- Effect recipes
- Playback decisions
- Transitions
- Preload candidates

The resolver must remain deterministic across seek, loop, pause, stop, track replacement, and media-library changes.

## Playback and preloading

`CanvasPlayback.ts` owns section-aware playback intent. The UI and renderer must not create separate playback clocks.

`CanvasPreloadManager.ts` owns bounded preload candidates and lifecycle. It must release stale resources and avoid downloading or decoding the complete library merely because CANVAS is selected.

Unavailable, deleted, unsupported, or inaccessible media must produce a clear fallback rather than an endless loading state.

## Rendering and effects

The live output is mounted by `CanvasEngineSurface` exported from `ReactCanvasEngineShell.tsx`.

Layout and effect values that change every frame may use CSS custom properties or runtime styles. Static layout belongs in React View CSS.

Effects and transitions must:

- Preserve the selected source aspect policy
- Stay within authored intensity and safety clamps
- Avoid per-frame DOM node growth
- Bound trail and overlay layers
- Keep video playback and visibility synchronized
- Release media listeners and timers on replacement

## SHIFTGRID

`canvas-shiftgrid` is a dedicated CANVAS preset with renderer kind
`shiftgrid`. It does not reuse Fractures geometry, CUTBANK composition, or the
generic authored-layer renderer. One SHIFTGRID renderer owns the complete tile
grid, so its source count is independent of the four-layer CANVAS compositor.

SHIFTGRID is a dedicated Canvas preset with a complete Design inspector,
deterministic puzzle choreography, multi-image mosaics, shared Audio
Intelligence routing, and motion-derived rendering effects:

- `ShiftgridSettings.ts` owns the versioned persistent preferences and strict normalization.
- `ShiftgridTileGeometry.ts` owns stable row/column tile identity, supported/automatic grid selection, and square or rectangular geometry.
- `ShiftgridSourceMedia.ts` resolves up to ten eligible images from the existing active CANVAS Media Pool, preserving pool order or deterministic selection without adding a media library or pool pointer.
- `ShiftgridGridState.ts` owns deterministic, validated permutations and transient animated movement state that is never persisted.
- `ShiftgridChoreography.ts` owns eight distinct permutation planners, staggered movement queues, timeline playback, seeking, pausing, interruption safety, magnetic reconstruction, and valid directional kick/snare impulses.
- `ShiftgridPerformanceController.ts` owns manual, Pattern Change, and Auto Performance precedence; canonical musical-event identity and deduplication; deterministic pattern cycles; section-level Auto direction; and independent audio routing. It reads `SharedPerformanceContext` and never creates a parallel analyzer or preview metronome.
- `ShiftgridMosaic.ts` owns the independent per-tile source-assignment timeline, deterministic target selection, six mosaic behaviors, and complete-image source resolution. Source ownership never mutates spatial tile position.
- `ShiftgridEffects.ts` gates tile edge glow, light trails, directional blur, RGB separation, beat pulse, snap flash, and tile gap independently, while preserving a zero-effect clean path.
- `ShiftgridRenderPlan.ts` maps stable, per-source crop coordinates to animated destination slots, carries current/pending source identity independently from spatial movement, and emits batched motion, trail, gap, pulse, and snap metadata.
- `ShiftgridTextureAtlas.ts` bounds one shared RGBA atlas to the device texture limit; `ShiftgridWebGLRenderer.ts` draws dual-source tile transitions and P5 effects in one batched WebGL2 call and `ShiftgridCanvas2DRenderer.ts` provides the alpha-aware equivalent fallback.
- `CanvasShiftgridLayer.tsx` uses the canonical Canvas preload manager, stages its five-item queue up to the ten-handle budget, handles source/pool revisions and failures, publishes output, falls back on context loss, and cleans up retained resources.
- `ShiftgridControls.tsx` owns one canonical four-section Design surface built from shared Canvas control rows. It conditionally exposes Media Pool, Mosaic Type, Trigger, reconstruction, and effect-strength controls; the REACT tab retains shared analysis/routing rather than duplicating SHIFTGRID authoring.

P2 adds Row Runner, Column Cascade, Checker Shift, Domino Chain, Center Collapse,
Edge Expansion, Wave Relay, and Magnetic Resolve. Each produces a distinct,
validated movement topology. Continuous Puzzle, Phrase Resolve, Drop Resolve,
Progressive Resolve, and Manual Resolve share the same deterministic timeline;
phrase/drop boundaries are routed from shared Audio Intelligence.
P3 adds Image Takeover, Hybrid Mosaic, Traveling Image Wave, Visual
Call-and-Response, Progressive Identity Reveal, and Auto Mosaic. These source
assignment modes remain combinable with every P2 choreography pattern. PNG,
JPEG, WebP, SVG, and transparency are supported; pool video sources are ignored.
Manual Pattern owns the runtime when both automatic modes are off. Pattern
Change has precedence over Auto Performance and advances only on a new selected
event identity. Auto Performance may choose a temporary runtime pattern at
section, phrase, or drop structure without overwriting the authored Pattern.
The canonical trigger vocabulary is Beat, Kick, Snare, Downbeat, Every 2 Beats,
Every 4 Beats, Bar, Every 4 Bars, Every 8 Bars, Phrase, and Drop. Missing grids,
paused transport, seeks, and track replacement do not synthesize trigger events.
Master Intensity scales performance motion and transient effect accents but does
not alter source identity, crop coordinates, grid dimensions, or authored tile
gap. Every P5 effect is opt-in; with Effects disabled (the default), assembled
output takes the clean source-image path with no overlays or sampling shifts.

### SHIFTGRID patterns

| Pattern | Visible behavior |
| --- | --- |
| Row Runner | Whole rows cycle horizontally in alternating directions with staggered starts. |
| Column Cascade | Columns cycle vertically in a progressive cascade. |
| Checker Shift | Alternating checkerboard groups exchange horizontally and vertically across multiple phases. |
| Domino Chain | Neighbor swaps propagate along a deterministic serpentine route. |
| Center Collapse | Outer tiles exchange toward central positions before reconstruction. |
| Edge Expansion | Coordinated exchange bands expand from the center toward the edges. |
| Wave Relay | A relay wave passes coordinated swaps from column to column. |
| Magnetic Resolve | A deterministic scatter progressively locks every tile back into its original slot. |

### SHIFTGRID Mosaic Types

| Mosaic Type | Visible behavior |
| --- | --- |
| Image Takeover | Corresponding regions are replaced in groups until one target owns the complete grid. |
| Hybrid Mosaic | Checker-distributed regions retain multiple source identities in one occupied composition. |
| Traveling Image Wave | A horizontal, vertical, or serpentine wave replaces corresponding source regions. |
| Visual Call-and-Response | Alternating tile groups trade dominance between sources before resolving. |
| Progressive Identity Reveal | Many source identities are reduced step-by-step until only the target remains. |
| Auto Mosaic | Deterministically selects among the five authored modes without immediately repeating one. |

Single Image remains a separate Media Mode. Mosaic Type changes source
assignment only; the selected Pattern continues to control spatial motion.
Show Manager shows and previews retain compositor authority while active, so a
selected SHIFTGRID direct preset cannot hide authored show output.

SHIFTGRID and Fractures intentionally have different visual contracts.
SHIFTGRID always uses a regular, fully occupied grid, moves stable tile
identities through validated permutations, and can reconstruct one exact image
or exchange corresponding regions across sources. Fractures retains its own
fragment geometry and runtime; SHIFTGRID imports none of it and does not use
mask rectangles to imitate it.

### SHIFTGRID production validation

Run the focused unit and regression suite with Vitest. For driver-level WebGL2
captures and timing, start Vite and run
`node scripts/validate-shiftgrid-p7-browser.mjs`. The validator creates
synthetic graffiti, glitch, chrome, neon, transparent SVG, low-contrast, wide,
and portrait fixtures and uses the repository wordmark and neon mockup when
available. It writes individual captures, pattern and mosaic contact sheets,
pixel comparisons, texture-atlas memory, and GPU timing to
`/tmp/shiftgrid-p7-validation` by default. Set `SHIFTGRID_P7_OUTPUT_DIR` to use
another destination. The command fails if a clean WebGL capture exceeds the
configured tolerance or if an opaque moving-pattern fixture exposes a hole.

## Data Bleed

`canvas-data-bleed` applies block-based GPU displacement to the active CANVAS
source. Motion mode estimates local movement between consecutive decoded video
frames. Procedural mode animates a seeded block field. Mixed combines both, and
still images use the procedural field. The direct preset uses Media Manager,
the current source decoder, and the existing fit, transform and output controls.

Data Bleed adds a version 1 nested recipe to CANVAS schema 15. Its Design controls
cover flow mode, bleed amount, block size, motion sensitivity, flow speed,
retention, source refresh, direction, freeze, reconstruction, audio response,
BPM sync, Auto Performance, seed and quality. Clear History resets the live
buffer. Shared Performance supplies bass/sub, kick, snare, transient and
qualified section cues. Authored media and Flow Mode retain their authority.

The renderer keeps two reduced source-frame targets and two reusable feedback
targets, with at most one recursive update per frame. Data Bleed publishes the
same processed frame through the existing CANVAS capture compositor. Authored
layers and active Shows retain stage ownership. See the [Data Bleed
specification](canvas-data-bleed.md) for the reset rules, quality budgets and
verification limits.


## Phase Drag

`canvas-phase-drag` is a direct slit-scan preset for video and animated stills.
Vertical, Horizontal, Radial and Map scans select different moments from a
timestamped GPU texture ring and interpolate neighboring samples. The existing
video decoder supplies the frames. Animated Still Movement generates variation
before history sampling. Zero movement on stills, zero Drag Amount, and full
Source Reconstruction show the native source.

The version 1 recipe was introduced in CANVAS schema 16. Freeze History holds the
published frame. Seek, source replacement, transport discontinuity, resize and
Clear History restart from the current drawable source. Qualified audio accents
change temporal depth and slit width. Auto Performance can change runtime scan
direction at a phrase boundary. Authored layers and active Shows retain output
ownership. See the [Phase Drag specification](canvas-phase-drag.md).


## Cellular

`canvas-cellular` is a direct reaction–diffusion preset that seeds an evolving
Gray–Scott field from the selected image or decoded video. Design controls tune
growth, reaction rates, source injection, edges and color. CANVAS stores the
version 1 recipe in settings schema 17. Shared audio features modulate growth
and edge detail, and Auto Performance can add section-based reconstruction.

Source alpha is confined by default. Zero Growth Amount and full Source
Reconstruction use the native source. The direct GPU result feeds CANVAS
capture, while authored layers and active Shows retain ownership of their
output. See the [Cellular specification](canvas-cellular.md).

## Terminal

`canvas-terminal` rebuilds the selected image or video as a grid of actual
monospace glyphs. ASCII, Numbers and Symbols families use measured ink
coverage to map local brightness to character density. Design controls set
cell size, edge weighting, substitution speed, palette, glow and
reconstruction. The nested recipe is version 1 in CANVAS settings schema 18.

Shared audio features can accent coverage and substitutions. BPM Sync is
independent of Audio Reactivity. Auto Performance can temporarily change the
runtime family at a qualified phrase without changing the authored selection.
The direct GPU output feeds CANVAS capture, and active Shows and authored
compositions keep their stage and output ownership. See the
[Terminal specification](canvas-terminal.md).

## Fluidity

`canvas-fluidity` treats the selected image or video as an optical glass surface.
Source Contours, Ripples, Lenses and Ribs each supply a distinct animated normal
field. Design controls refraction, bevel, lighting, frost and optional dispersion.
The nested recipe is version 1 in CANVAS settings schema 19.

Qualified audio can change curvature and drive traveling pressure rings or rim
accents. BPM Sync is independent of Audio Reactivity. Auto Performance can
reconstruct the source during quieter sections while preserving the authored
surface. The direct GPU output feeds CANVAS capture, and active Shows and
authored compositions keep their stage and output ownership. See the
[Fluidity specification](canvas-fluidity.md).

## Divinity

`canvas-divinity` casts screen-space light shafts through the selected image
or video. A luminance or alpha mask defines where the light originates. The
Design controls move the light origin and shape its reach, spread, density,
decay and tint. Light can contribute alpha outside the source silhouette or
stay clipped to it. The nested recipe is version 1 in CANVAS settings schema 20.

Qualified audio can expand shafts and accent their intensity or spread.
BPM Sync is independent of Audio Reactivity. Auto Performance reduces the
effect in quieter sections without changing the authored mask. Divinity is
a direct renderer. Its GPU output feeds CANVAS capture, while active Shows
and authored compositions keep their own output. See the
[Divinity specification](canvas-divinity.md).

## VHS

`canvas-vhs` treats the selected image or video as an analog signal. Tape
adds tracking errors, chroma lag and seeded dropouts. CRT adds a curved
display, scanlines, a phosphor mask and optional afterglow. Hybrid combines
both in signal order. The nested recipe is version 1 in CANVAS settings schema 21.

Qualified audio can intensify tracking, dropouts and phosphor brightness.
BPM Sync is independent of Audio Reactivity. Auto Performance softens the
effect during quieter sections while preserving the authored Treatment.
Preview and capture use the same direct frame. Authored compositions and
active Shows keep their own output. See the [VHS specification](canvas-vhs.md).

## MUTAGEN

`canvas-mutagen` is one visible CANVAS preset with renderer kind `imageMutation`.
It consumes the existing `activeCanvasMediaId` through the shared Media Manager
runtime mapping. PNG (including alpha), opaque JPEG, WebP, and SVG are primary
image inputs; authored-overlay transparency admission does not apply. Selecting
or resetting the recipe preserves the selected image and its library ID.
There is no new uploader, media collection, engine, or analysis pipeline.

`MutagenSettings.ts` owns version 3 of the nested `mutagen` recipe in CANVAS
settings schema 21. Strict normalization supplies missing defaults, validates
the eight pattern IDs and Auto/Low/Balanced/High quality enums, clamps Mutation, Feedback Trails, and
Source Reconstruction to 0–1 and Flow Speed to 0–4, and strips runtime fields.
The canonical Design controls reuse the shared control rows and Reset action;
the existing Display controls supply contain/cover/stretch, scale, translation,
rotation, and output opacity. Preserve Colors defaults on; feedback defaults off.
The preset provenance comparison includes the entire authored settings record.

`MutagenRenderer.ts` extends the Phase 1 WebGL2 renderer, source upload, and
capture handoff. `MutagenShaders.ts` provides eight independently compiled
mathematical paths, with shared aspect/transform mapping, immutable source
sampling, premultiplied alpha, reconstruction, and optional temporal history.
Programs compile on demand and are cached in the same GL context (eight pattern
programs plus one crossfade/glow program at most). No pattern imports SHIFTGRID
or Fractures state. There remains exactly one MUTAGEN preset card.

| Pattern ID | Mathematical path and visible behavior | Conditional Design control |
| --- | --- | --- |
| `liquify` | Phase 1 multi-scale smooth-noise UV advection produces continuous molten ribbons. | None |
| `vortex` | Aspect-correct polar twist and bounded radial compression create concentric swirling depth. | Vortex Twist |
| `particulate` | Luminance-sized, antialiased halftone cells reconstruct the image using colors/alpha sampled from each cell center. | Cell Size |
| `terraform` | A front-to-back parallax-occlusion raycast intersects the source luminance heightfield, interpolates the crossing, and computes relief normals and contour lines. | Terrain Height |
| `fracture` | Inverse-transformed Voronoi polygons sample their original image regions while separating, rotating, and closing in a periodic reconstruction cycle. | Shard Separation |
| `spectralTear` | Distinct spatial frequency waves offset image slices and independently displace source R/G/B channels. This is geometric processing, not another audio analyzer. | Tear Bands |
| `recursion` | A bounded stack of nested, rotating source-image windows forms an image-within-image tunnel. | Recursion Depth |
| `morph` | Image pixels continuously interpolate into rotating circle/diamond signed-distance shapes colored by the source. | Shape Detail |

Common controls are Mutation, Flow Speed, Feedback Trails, Source Reconstruction,
Pattern Transition (0.1–2 seconds, default 0.55), Glow (off by default), Preserve
Colors, and Quality. Pattern-specific sliders appear only for their owning mode.
Colors always originate in the source: Terraform shades that palette to describe
relief, and Spectral Tear recombines independently sampled source channels.
Preserve Colors disables additional channel-rotation treatment; it does not
remove those defining relief or RGB-separation behaviors.

Mutation 0 or Source Reconstruction 1 takes the same exact source-sampling branch
in every program and bypasses glow/history/crossfade. Direct preview/capture uses
the native original-image contribution at either endpoint, hiding the GPU
contribution so even large clean outputs avoid internal quality downsampling.
The controller continues running, preserving its musical authority. The layer uses its normal
pixel scale for this clean path even when Low/High processing selects another
scale. Transparency is sampled and composited as premultiplied RGBA, rather than
replaced with a synthetic opaque background. Optional glow extends source alpha
around edges; with glow off there is no added halo.

`MutagenRenderPlan.ts` owns finite quality budgets and transition state. One
crossfade uses at most two GPU outputs and three draw passes (two modes plus one
composite). Fast selections coalesce to the latest request after the current
pair finishes, rather than allocating more outputs or snapping halfway. The
outgoing mode normally stays live; if feedback was active its last processed
frame is frozen into the outgoing target so trails fade out continuously. The
incoming mode never samples the outgoing mode's history.

There are at most **four transient targets**, distinct from the number of
feedback passes: two reusable transition/glow targets plus two reusable temporal
ping-pong targets. Ping-pong reads one prior frame and writes one current frame;
that is **one feedback pass**, honoring `MAX_CANVAS_FEEDBACK_PASSES = 1`, not two.
Transitions suspend temporal feedback entirely and clear history on both ends.
Normal history retention remains capped at 0.85 and scaled by mutation and source
mix, so every new frame is anchored to immutable source pixels. The optional glow
and crossfade share one bounded postprocess; neither is another feedback pass.

| Quality | Internal pixel scale / longest edge | Maximum halftone rows | Heightfield steps | Voronoi rows | Tear bands | Recursion levels | History scale |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Low | 0.75× / 960 px | 48 | 10 | 5 | 12 | 3 | 0.5× |
| Balanced | 1× / 1920 px | 80 | 16 | 8 | 24 | 4 | 0.75× |
| High | 1.25× / 2560 px | 120 | 24 | 11 | 48 | 6 | 1× |

Pixel scales multiply device pixel ratio before the edge cap. Auto deterministically
chooses a tier from area: up to 960×540 pixels uses High, up to 1920×1080 uses
Balanced, and larger areas use Low. The same logical stage area selects internal
resolution, shader complexity and history scale; the reduced internal canvas must
not accidentally upgrade Auto back to High. History and transition
buffers are additionally capped at a 1920-pixel edge and device limits. At worst,
four square 1920 RGBA8 buffers use about 56.3 MiB, plus the one immutable source
texture (at most 64 MiB), the output canvas, and its existing 2D capture snapshot.
Voronoi evaluation uses a fixed 3×3 candidate search and fixed 3×3 ownership search;
all shader loops have static ceilings. No CPU pixel reads occur in the renderer.

`CanvasMutagenLayer.tsx` owns the RAF, GPU lifecycle, and current 2D snapshot.
The direct shell replaces the dry image only after a processed snapshot is ready,
and copies that snapshot into its existing published recorder/output canvas.
Dry Source Mix 0 therefore still shows and captures the mutation, without a
second copy of the original beneath transparent pixels. The normal CANVAS
output-opacity/background policy still applies. Active Show Manager compositions
and authored stages retain precedence; MUTAGEN does not process their layers.

Resize releases feedback targets; source URL/revision and track replacement
recreate local resources. Shared Performance seek/loop/discontinuity changes and
visibility transitions clear history. Hidden or zero-size canvases skip GPU
frames. Unmount and context loss cancel RAF and dispose programs, textures, and
framebuffers. WebGL2 initialization, upload, or capture failure reveals the
original image and reports a warning. A restored context gets one automatic retry
per source/track identity; a second loss keeps the drawable original until the
preset is re-entered. Reselecting MUTAGEN also retries. Video is an
explicit unchanged-source fallback with a still-image-only notice.

MUTAGEN remains a direct still-image processor. Playback motion reads the canonical
audio position; stopped ambient motion uses elapsed animation time. Pause freezes
the visual snapshot and performance advancement. A seek while paused reconstructs
the new position once, then freezes again; resize/DPR/transform edits also refresh
the paused snapshot. The existing 50 ms Core-context adapter publishes forward
position jumps above 0.5 seconds as timing-discontinuity identities for MUTAGEN;
while paused, any position change above Core's 0.00001-second tolerance also
refreshes the snapshot. Core's existing backward-position/loop detection remains authoritative. This
samples the existing audio position and adds no independent musical clock.
Authored/manual and musical
Pattern authority are described below. Source uploads are capped at a 4096-pixel longest edge (or the
device limit); quality limits can reduce fine detail on larger inputs. Terraform
is a 2.5D heightfield, not a freely orbiting 3D mesh. Voronoi shards are planar
image regions without rigid-body collisions, and recursion is limited to six
levels. Rapid manual selections may wait up to the current transition duration
before the latest requested mode begins. Feedback is volatile and is not
reconstructed as an exact historical simulation after seeking.

Run the focused MUTAGEN Vitest tests and, with Vite running,
`node scripts/validate-mutagen-p1-browser.mjs`. `MUTAGEN_BASE_URL` overrides the
local server URL and `MUTAGEN_OUTPUT_DIR` overrides `/tmp/mutagen-p1-validation`.
The browser check compares premultiplied RGBA against a clean Canvas2D reference:
mean error must be at most 1/255 per channel, with fewer than 2% of channels over
8/255 (3% for rotated minification). It checks all aspect policies and transforms,
zero mutation after feedback, temporal animation, bounded allocations/disposal,
the shell's published capture, MediaRecorder, preset switching, and context-loss
fallback. It emits PNG/SVG/JPEG/WebP fixture captures, a contact sheet, and metrics.

The unchanged Phase 1 validator remains a regression check. To generate all-eight
mode comparisons, run `node scripts/validate-mutagen-patterns-browser.mjs` against
the same Vite server (`MUTAGEN_BASE_URL`). It writes individual renders, three
3×3 contact sheets from identical per-row source fixtures, dropdown/Design
captures, pairwise visual differences, zero/source-mix reconstruction errors,
alpha checks, midpoint crossfade errors, all-quality GPU smoke checks, and finite
allocation/disposal counts to `/tmp/mutagen-pattern-validation` (override with
`MUTAGEN_OUTPUT_DIR`). `MUTAGEN_PHOTO_PATH` accepts an offline JPEG; otherwise the
script downloads the attributed Fronalpstock photograph from Wikimedia Commons
and writes its attribution/license alongside the transformed captures. Fixture
pixel reads and comparisons are confined to these acceptance scripts.

### MUTAGEN musical performance and authority

`MutagenPerformanceController.ts` consumes `SharedPerformanceContext`, the
canonical transport position, and existing Performance Core deterministic hash,
transport-transition, smoothing, and envelope helpers. It has no Zustand writes,
analyzer, beat detector, private beat grid, or fallback metronome. Its trigger
adapter follows the SHIFTGRID behavior contract but owns MUTAGEN-only pattern
types, seeded cycles, cursors, and audio envelopes. It imports no SHIFTGRID tile
or Fractures fragment state. The shell passes its existing context ref and
canonical `getAudioTime` into the existing MUTAGEN layer.

The v3 nested recipe adds Pattern Change, Trigger, Auto Performance, BPM Sync,
Audio Reactivity, and Deterministic Seed. Migrating v1/v2 settings preserves their
authored values and supplies defaults: Pattern Change off, Auto Performance off,
Trigger Every 4 Bars, BPM Sync off, Audio Reactivity 0.65, Seed 91817. The nested migration does not require a separate parent migration. CANVAS schema
15 adds the independent Data Bleed recipe. The explicit preset provenance list already compares `mutagen`
as a whole, so these preferences persist and participate in Exact/Modified status;
per-frame recipes, envelopes, and pattern cursors never do.

Authority matches SHIFTGRID:

- **Pattern Change > Auto Performance > Manual.** Ambiguous persisted documents
  with both automatic toggles on normalize to Pattern Change on / Auto off.
- Choosing Pattern disables Auto Performance. It preserves Pattern Change if that
  mode was already enabled, re-anchoring the current runtime pattern to the new
  authored choice until the next eligible event.
- Enabling Pattern Change disables Auto Performance; enabling Auto Performance
  disables Pattern Change. With both off, the authored Pattern remains locked.
- The visible Pattern dropdown always displays the authored selection. Auto
  Performance chooses temporary runtime patterns and never overwrites it.
- Pattern Change initially holds the authored/current pattern. Only a **new**
  selected Trigger advances one step through a seeded eight-pattern permutation,
  including a non-repeating wrap. Polling, toggles, manual edits, Trigger changes,
  and resume/reset-frame boundaries do not synthesize a change. A Trigger edit
  holds the current pattern rather than re-selecting the authored one.

| Trigger | Shared Performance event |
| --- | --- |
| Beat (`beat`) | Qualified published beat boundary |
| Kick (`kick`) | Qualified kick rising edge |
| Snare (`snare`) | Qualified snare rising edge |
| Downbeat (`downbeat`) | Qualified bar boundary with downbeat identity |
| Every 2 / 4 Beats (`beat2`, `beat4`) | Beat boundary whose absolute beat index is divisible by 2 / 4 |
| Bar (`bar`) | Qualified published bar boundary |
| Every 4 / 8 Bars (`bar4`, `bar8`) | Bar boundary whose absolute bar index is divisible by 4 / 8 |
| Phrase (`phrase`) | Qualified bar boundary with a changed shared phrase index |
| Drop (`drop`) | Qualified drop-section entry or rising qualified semantic drop impact |

Beat/bar/phrase/downbeat events require `beatGrid` and confidence above 0.15;
rhythm events require `rhythmEvents` and rhythm confidence above 0.15. Section
routing requires `sections` and section confidence above 0.15. Semantic drops
require semantic confidence above 0.15. Transient ripples additionally require
transient confidence above 0.15. Each event kind retains a bounded last-identity
slot, so re-polling a sticky boundary cannot restart a pulse. Seeks, loops,
replacement and timing discontinuities consume the current sample without
inventing kick/drop/phrase events. None of these triggers reuse
`CanvasVideoTimingSettings.triggerOn` (video restart authority).

Musical routing is independent of Pattern authority:

- Bass and sub increase bounded warp strength, fluid phase velocity, and image
  expansion. Midrange varies morphology/cell/fragment density. Highs add only a
  restrained source-colored edge detail, preserving sampled alpha.
- Kick owns a short displacement envelope; snare/transient owns a short tear or
  ripple envelope. Drop owns a larger, bounded impulse. Build Progress and
  qualified build-section progress progressively raise deformation.
- Intro retains recognizable source identity; verse restrains mutation; build
  progresses from Morph through Liquify into Vortex in Auto mode; late pre-drop
  applies a tension hold. Drop occurrences cycle seeded liquid/fragment/vortex
  looks, with Drop 1 capped at `1 + 0.7 × response` and Drop 2 reserving
  `1 + 1.05 × response` minimum gain (global ceiling 2.2), so build residue cannot
  exhaust the later drop's headroom. Drop 2 also uses a distinct pattern. Breakdown/outro gradually
  increase source reconstruction (0.6-second smoothing); reconstruction releases
  with a 0.08-second release as the music returns, so a prior breakdown cannot suppress the
  next drop. Manual Pattern still owns the visual type
  when automatic modes are off.
- Bands require live-band capability and overall confidence above 0.05. Without
  qualified rhythm/sections there are no manufactured events or structural
  changes; the authored pattern keeps steady animation, optionally responding to
  available live bands. Full-track analysis is not required.
- Audio Reactivity 0 immediately yields neutral routing. It does not disable the
  independently authored Pattern Change/Auto/BPM Sync preferences. With BPM Sync
  off, the flow runs at manual time-based speed; with BPM Sync on and a qualified
  grid, the authoritative beat position controls its speed (120 BPM is 1×).
  Missing/invalid grids fall back to ordinary animation time, never an invented BPM.
- All modulation is smoothed and clamped. Mutation 0 and Source Reconstruction 1
  remain exact clean-source endpoints, including expansion and audio accents.

The controller holds volatile phase, smoothing states, event identities, pulse
origins, and pattern cursor outside Zustand. It resets/rebases on preset/source
replacement, seed changes, authoritative track/seek/loop/timing identities, and
visibility recovery. Pause preserves the current pattern, phase, envelopes, and
published snapshot; resume cold-resets envelopes/history and consumes the
resume-frame event. Auto reconstructs its section/occurrence decision from the
same seeded time context after a seek. Pattern Change deliberately re-anchors to
the authored pattern on transport/source resets, then waits for the next new
selected event. Given the same reset position and event sequence, its subsequent
pattern choices are repeatable.

Feedback policy is explicit: every history reset (including source, resize,
pattern transition, pause/resume, and transport discontinuity) starts **six
successful feedback renders at zero history weight**, each freshly sampling the
immutable source. Normal one-pass ping-pong feedback then resumes. Context-loss
fallback and the four-target bound remain unchanged. Exact historical GPU frame
replay is **not** supported: temporal history, integrated fluid phase and smoothed
envelopes depend on the path taken between resets. Pattern authority/section
choices are deterministic; a cold seek never claims to reconstruct old feedback.

Run the MUTAGEN suites plus `ShiftgridP4Performance.test.ts`,
`ShiftgridFoundation.test.ts`, and the focused Shared Performance tests. For
repeatable browser evidence run `node scripts/validate-mutagen-performance-browser.mjs`
with Vite running (`MUTAGEN_BASE_URL`). It replays the repository's stored
`aint-no-other-man-social-club-remix.chromium.json` production analysis through
Performance Core using the existing feature-curve sampler, emits analyzed-track
and arrangement contact sheets, and compares isolated bass/kick/snare/mid/high/
drop profiles on the same source. Its test-only structural publications separately
cover confident build/drop labels absent from that golden track. It also checks
real shell capture changes without replacing the media/GL layer, paused capture
identity, Audio Reactivity 0, and actual Design authority interactions. No original
music file or new analysis job is required. Artifacts and metrics default to
`/tmp/mutagen-performance-validation` (`MUTAGEN_OUTPUT_DIR` overrides it).

## Persistence

CANVAS settings, selected media, pool membership, role assignments, authored-show settings, and timing metadata use the React engine store and shared media records.

Any persisted schema change requires normalization or migration. SHIFTGRID's
settings are nested in the normalized CANVAS preset document; its tile state,
pattern cursor, source handles, and audio envelopes are runtime-only. Runtime
media elements, blob URLs, object references, preload handles, and diagnostics
must not be persisted.

## Diagnostics and validation

Shared Performance diagnostics expose the selected show, media lock, role resolution, section and phrase context, effect decisions, and fallback state.

Current tests cover the performance foundation and authored shows. Changes to media recruitment, limits, effects, playback, or transitions should extend `CanvasPerformanceValidation.ts` and the relevant tests rather than adding a disconnected validator.

### MUTAGEN production ownership and output

MUTAGEN processing is **direct-only**. There is no implicit or opt-in MUTAGEN
Show/layer effect in the current schema. `CanvasLayerEffectRuntime` accepts the
existing bloom/echo/glitch/melt/stutter effect IDs; the specialized authored
processor contract is Fractures-specific. Adding a complete versioned per-layer
MUTAGEN recipe, lifecycle, history/transition budgets and semantic-frame routing
would extend that compositor architecture. Selecting the direct preset therefore
never inserts MUTAGEN into an authored or Show Manager composition.

The existing authored order remains: resolve the layer media handle; sample it
with crop/fit/source transforms and layer opacity; apply an optional alpha mask;
run the layer's existing effect stack; blend into the composition; apply the
owner's final output contract. The MUTAGEN selection passes an authored
composition through unchanged rather than multiplying it by the direct preset's
zero Dry Source Mix. A single-source authored effect stack also retains this
ownership. Active Show Manager output uses its existing Show output contract and
never the selected direct preset's mutation, opacity or dry mix. An owner handoff
waits for a frame identifying the requested Show/authored owner and unpublishes
the old direct canvas while pending. Leaving a Show restores direct rendering.

For direct MUTAGEN, the GPU samples the immutable image with the existing source
transform and fit policy. Its premultiplied result replaces the dry contribution;
there is no original image underneath it. `dryOnly` means processed alpha 1 even
when Dry Source Mix is 0. `legacyComposite` retains Dry Source Mix as a single
multiplier on the processed result (or original fallback). Final CANVAS opacity
applies once after composition/background. The existing alpha-aware stage
background policy is preserved. Scoped MUTAGEN DOM background styling matches
the capture compositor, including partially transparent output opacity.

The shell publishes its current output canvas, drawing the current GPU snapshot
via Canvas2D without per-frame GPU/CPU pixel readback. The same published canvas
is used for screenshots, recording and visual-output casting. `ProductionOutput`
is the LaserDMX hardware adapter and is not a CANVAS processor. A missing,
failed, expired or deleted primary source clears/unpublishes capture and reports
output unavailable. A drawable original remains a truthful available fallback
when WebGL2, shader compilation, allocation, capture or context restoration fails.
Signed media URLs are used verbatim and remain outside the preset recipe.

Texture uploads check allocation errors and downsample sources to at most
4096×4096/device limits. Render output has a 2560-pixel maximum edge, and at most
four RGBA8 transient targets have a 1920-pixel maximum edge. These give a
conservative source-plus-transient texture ceiling of 120.25 MiB, excluding the
GL drawing buffer, driver overhead and Canvas2D capture canvases. Lower Auto tiers
reduce this substantially. Nine cached programs and one VAO are the maximum;
there is one GL context per mounted direct layer, not per pattern. Targets are
reused between steady frames and disposed on resize/unmount/error. Feedback resets
on source revision, pattern transition, seek/loop/discontinuity, visibility and
resize. Its six successful feedback-frame warmup uses zero history weight; exact
historical feedback replay remains unsupported.

The reproducible Phase 4 smoke command is documented in
[Verification](verification.md#mutagen-production-smoke). It uses generated alpha
PNG, opaque JPEG, SVG, portrait/panoramic fixtures and a deterministic upstream
semantic context; it does not upload assets or run another audio analyzer. It
records real GPU profiles at logical 1280×720, 1920×1080 and 3840×2160, bounded
steady-playback allocations, eight-pattern/strength/arrangement/fallback PNGs,
a contact sheet, a WebM, reload persistence and live-versus-published pixel parity.
This Chromium component harness is not an authenticated cloud-library, native
Electron cast-device, or multi-hour GPU endurance certification.
