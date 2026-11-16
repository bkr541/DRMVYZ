# Sound Drawing XY

## Purpose

Sound Drawing XY draws a word as a single phosphor beam in the style of an analog XY scope. The letters answer each other in time with the loaded track, then dissolve along their outlines into a waveform and a series of oscillator figures, perform as them, and are drawn again as crisp, bold letters. Uploaded vector SVGs use the same beam, choreography and shared audio path. The OSCILATOR source draws the stereo scope signal; built-in shape authoring remains separate from this engine.

The engine ID is `xyScope` and its catalog label is **Sound Drawing XY**. It ships **side by side** with the legacy `oscilloscope` engine, which is untouched. When the new engine is approved in the full app, the legacy engine, its store slices and its presets are removed in one change and `oscilloscope` becomes a retired identity that restores as `xyScope`. That migration is deliberately not part of this document's scope.

## Choreography

Each Pattern is a complete repeating oscilloscope performance. The word is a
recurring destination, not a permanent overlay: it holds legibly, moves through
its letters, unravels into a full-field drawing, performs as that drawing, then the same
lit trace is drawn back into lettering. The letters never bob or sway on the way out: each letter in turn, slowly, unrolls its outline into its own chaotic sine trace (a sum of non-harmonic, frequency-modulated sines drifting with the clock, swelling with the music and carrying the live triggered signal, with a different set on each visit), and the traces then join the figure. The return runs the same route in reverse: figure, then the traces, then the letters. The beam is never blanked between the
word and the figure, in either direction, and no stationary word is left behind
during the figure.

**Pattern Change off still performs this entire sequence.** The toggle only
controls selection of another performance style. With it on, the canonical
Cinema 2.0 Trigger events queue a style through
`Cinema2MainframePatternController`. The latest queued style starts at the next
return to lettering, so fast triggers cannot interrupt every departure. A manual
Pattern selection starts a fresh performance from the word immediately. A seek
returns to the authored routine; it is not consumed as a trigger.

| Pattern | Performance between visits to the word |
| --- | --- |
| Word | Cycles through perimeter tracing, off-centre nested orbits, and a corner-to-corner signal sweep |
| Waveform | The live audio trace, triggered on a rising zero crossing like a scope (a steady tone holds still; a sine reads as a sine), sweeps through changing orientations across the field |
| Stereo Scope | The live mid/side trace travels across the stage; the fallback is disclosed when stereo is unavailable |
| Ring | Large expanding, tilting orbital rings with bass and snare detail |
| Rosette | Full-field rotating epicycle petals with a different variant on repeat visits |
| Weave | Evolving Lissajous drawings across the field |
| Pinwheel | Rotating crescent arms, with the beam blanked between separate strokes |

`XyScopeChoreography` reuses the same letter beam points for the figure, then
morphs them back into the word with the beam lit throughout. Whole outlines depart coherently,
with Answer Delay staggering the letters. Every fixed style varies over repeated
visits without requiring Pattern Change. The active routine has its own clock,
independent of style-switch events.

Transition Length controls performance phrasing (8 + 4 × Transition Length beats).
Motion Amount controls pacing; zero settles to the word. Audio Reactivity zero
also settles to the word. Playback pause freezes the performance clock and eases
back to readable lettering. BPM Sync follows the real beat clock; without an
available beat grid, active playback uses the existing steady-tempo fallback.
The references reviewed were Desktop `ref1.mov`, `ref2.mov` and `ref3.mov`, with
ref3 providing the lettering → full drawing → fade → lettering direction.

Every figure is in constant fine vibration, as a real scope's trace is: a smooth shimmer of a few percent of its size (quickening with the highs and snares, scaled by Line Vibration, driven by a free-running clock so it never stops while the figure is on screen) plus a trace of the live stereo signal. The figures' Lissajous phases drift continuously with the beat clock. With no stereo capture the Waveform trace is a clean moving sine.

## Why a new motion model

The legacy renderer drew a fixed outline and added audio as noise: a global centre offset from raw waveform samples, a per-point displacement by waveform index, and per-point jitter. Neighbouring points moved by unrelated amounts, so text only looked good with every reactive control near zero.

The XY engine never scatters points. Letters ring like a plucked string (a standing wave along the outline that starts on a hit and settles), ripple when answered, and dissolve along the outline into a slice of the track's real left/right signal. Neighbouring points always move together, and the word never translates as a whole.

## Canonical implementation

| Responsibility | Authority |
| --- | --- |
| Settings, parameter catalog, presets, normalization | `src/components/vyzualz/react/xyScope/XyScopeSettings.ts` |
| Outline source, flattening, resampling, layout | `XyScopeGeometry.ts` |
| Default font table (Anton Regular, OFL-1.1) | `XyScopeDefaultFont.generated.json`, generated by `scripts/xy-scope/generate-default-font.mjs` |
| Library font loading | `XyScopeFontLibrary.ts` |
| Conversation between letters | `XyScopeConversation.ts` |
| Motion model and live scope window | `XyScopeMotion.ts` |
| Patterns (the forms) | `XyScopePatterns.ts` |
| Complete beam performance, blanking and redraw | `XyScopeChoreography.ts` |
| Musical events and Trigger identities from the shared context | `XyScopeEvents.ts` |
| Beam drawing | `XyScopeBeam.ts` |
| Per-canvas runtime | `XyScopeRuntime.ts` |
| Surface and inspector panels | `XyScopeSurface.tsx`, `XyScopeWorkspace.tsx` |
| Persisted state | `xyScopeSettings` in `src/stores/reactStore.ts` |

## Audio ownership

In the app, music analysis is not published by a background service: whichever renderer-owned loop is active pumps the analyser into the one shared Music Intelligence engine (the Sound Drawing canvas, CANVAS, Cinema 2.0 and PixGrid each do). A surface that only *reads* the shared audio bus sees an empty frame forever, so no kick, beat or bar reaches it.

`XyScopeSurface` therefore owns the pump while it is the active engine, as PixGrid does:

- It samples the master analyser every frame through `MusicIntelligenceAnalyserFramePump` under the publisher id `react:xyScope`. The pump respects bus authority and skips duplicates; this is the shared analysis path, not a second one.
- It watches the transport itself (`XyScopeTransportTracker`, the same rule PixGrid applies) and passes seek, loop and timing identities to the performance context, so a seek returns to the authored performance and never advances it.
- It builds the performance context from the real track analysis and sections, and hands the runtime the context plus whether the frame is fresh.

ReactView passes the analyser, `isPlaying`, `isPaused`, `analysisActive` and the track duration, exactly as it does for PixGrid. This was missing in the first version: the engine worked against hand-fed frames in a test harness, but in the app the bus was empty and the letters never changed. `XyScopeWorkspace.test.tsx` now has a regression test that the surface publishes frames when nothing else does.

## Musical events

The engine reads the shared performance context built from the Music Intelligence frame. It has no beat grid, phrase clock or analyser of its own.

| Signal | Source | Result |
| --- | --- | --- |
| Kick | `context.kick` and `kickStrength` | Ring-down, pop and flash across the letters, left to right |
| Snare | `context.snare` and `snareStrength` | Travelling ripple and a light fray into the stereo scope, right to left |
| Trigger | The chosen Trigger (below) | Advances Pattern Change |
| Bass, mid, high | `context.bass`, `mid`, `high` | Drive the figures through Form Response |

The eleven Triggers resolve to a unique event identity per event: Beat, Downbeat, Every 2 Beats and Every 4 Beats from the beat boundary and beat index; Bar, Every 4 Bars and Every 8 Bars from the bar grid; Kick and Snare from the one-frame hit flags (numbered by fresh audio frame); Phrase from a new analysed phrase, or the 16-bar clock; Drop from a new drop occurrence. The controller advances exactly once per identity however many frames carry it.

Each fresh audio frame is processed once (`frame.frameId` changes), so a one-frame hit is never counted twice. A seek, loop wrap or track replacement (`seekDetected`, `loopWrapDetected`, `trackReplacementDetected`) resets every letter to rest and the controller to the authored pattern. A new track identity also clears the phosphor trail. Audio Reactivity scales event strength and figure response; zero settles to the readable word.

## Scope window

The dissolve cloud is a mid/side trace (`x = (R - L)/sqrt(2)`, `y = (R + L)/sqrt(2)`) of the last 2048 stereo samples from `StereoScopeAudioTap.readLatest()`. A centred signal is a vertical line, as on a real vectorscope. Gain drops at once and recovers slowly, so the trace never clips.

When no stereo capture is available the cloud is a slow procedural figure, and the surface says so ("No live stereo signal: dissolves use a stand-in figure instead of the track."). A mono-derived figure is never presented as a stereo measurement.

## Inspector standard

The Design tab follows the same hierarchy as the Cinema 2.0 and Headliner Design inspectors: every user-visible control sits under exactly one collapsible parent group, with nested collapsible groups inside Design, the shared control rows (`SliderRow`, `ToggleRow`, `SelectRow`, `PaletteColorRow`), a one-sentence description on every control, and a **Reset Parameters** action.

| Group | Controls |
| --- | --- |
| Master Controls | Master Intensity, Audio Reactivity, Motion Amount, BPM Sync |
| Design › Pattern | Pattern, Pattern Change, Trigger (only while Pattern Change is on), Transition Length |
| Design › Letters | Text Size, Letter Spacing, Ignore Small Pieces |
| Design › Beam | Phosphor Trail, Glow |
| React | Form Response, Line Vibration, Snare Fray, Answer Delay |
| Palette | Beam Core, Beam Glow, Background |

Cinema 2.0 and Headliner use **Effects** as the third group. Sound Drawing XY uses **React** there because the music's effect on the word is this engine's effects. The REACT tab keeps the shared music-analysis panel and points to Design → React.

Pattern Change defaults to **on** so the engine performs when it is first opened. The Clean Scope preset turns it off, retaining the Word performance; Motion Amount or Audio Reactivity at zero provides a still word.

The left rail has SOURCE and MEDIA tabs. SOURCE has TEXT, SVG and OSCILATOR cards with persisted selection. TEXT holds the standard **Input** group with the word (up to 16 characters, drawn in capitals) and Font dropdown. SVG holds its own **Input** group with an uploaded SVG selector and processing mode. MEDIA remains a disabled placeholder; uploads are managed in Media Manager; a disabled tab can never be the open tab (`disabledLeftTabs` in `reactWorkspaceComposition.ts`). The PRESETS tab follows the selected source. TEXT includes Text V2, Converse, Clean Scope, Storm, OSC 1 and OSC 2; OSCILATOR includes INIT and OCTA alongside the three shared parameter presets. SVG offers the three shared parameter presets. The TEXT card stays active for Text V2, OSC 1 and OSC 2; OSCILATOR stays active for INIT and OCTA. Clicking an already active source card keeps its current instrument. A shared parameter preset returns an instrument to its base source (TEXT or OSCILATOR), sets Master Controls, the Pattern group, and React values and leaves the word, font, letters, beam and palette alone. A manual edit keeps the preset id and the card shows Modified.

`XY_SCOPE_PARAMETERS` is the single source of truth for labels, ranges, defaults and visibility; the panel, the store normalizer and the runtime all read it.

## Fonts

The SOURCE font dropdown previews each font name in its actual typeface, including
the bundled Anton default. Library previews use the shared background font cache;
names use the standard UI font while loading or when a preview cannot be loaded.
Previewing does not select a font or change the drawing. The closed selector,
placeholders and ordinary dropdowns retain shared UI typography; font specimens
keep the same option size, weight and spacing. The shared dropdown honors an
option's font family through its typography variable, including in portaled menus.

- The default font is Anton Regular, baked to path commands so the runtime never fetches or parses a font for it. The license text ships at `public/cinema2/licenses/Anton-OFL-1.1.txt`. Regenerate with `node scripts/xy-scope/generate-default-font.mjs`.
- A font from the user's library uses the same cache and storage as the rest of the font system (`getFontFromCache`, `downloadFontFile`, `storeFontRuntime`). While it loads, or if it fails or has been removed, the word keeps drawing in the default font and the surface shows why.
- Outlines are flattened from path commands with sharp corners kept as mandatory points. Contours smaller than **Ignore Small Pieces** (a share of the cap height) are dropped. The point count is bounded (12,000), and ornate fonts thin their spacing until they fit.
- Letter spacing uses a uniform advance; font kerning is not applied.
- Fonts built from large broken fragments (grunge fonts) stay dirty even with the small-piece filter. That is a property of the font, not a bug.
- The legacy "canvas fallback" (pixel edge scan) is not used: it has no outlines.

## Lifecycle and limits

- **Ownership:** `XyScopeSurface` creates the runtime on mount and disposes it on unmount. It owns one `requestAnimationFrame` loop and one `ResizeObserver`, publishes its canvas for recording through `onCanvasReady`, and clears both on unmount.
- **Store:** the animation loop never subscribes to Zustand. Settings and the resolved font reach the runtime through an effect, so dragging a slider does not recreate the runtime or drop the trail.
- **Paused audio:** the word keeps drawing and settles to its crisp rest state; an unavailable or unselected SVG instead clears the stage and reports its status.
- **Beam:** brightness falls with beam speed and is normalised per length of line, so a tightly packed figure is as bright as a letter. The segment that closes a letter's contour fades as its points move into a form, and the beam lifts between the arms of a pinwheel.
- **Rendering:** Canvas2D only. The phosphor trail is capped at 300 ms. An 8-bit canvas rounds a slow fade to "no change" a few levels above the background, which left a grey ghost of every earlier figure on screen, so each frame also takes one level off (`color-burn`) and clamps to the background (`lighten`); a trail then reaches the background exactly. The shared GPU phosphor pipeline can replace the stroke passes later without changing the motion model.
- **Not implemented:** Auto Performance, user-authored pattern cycles, a stationary noise-blob or parked-dot pattern, quality tiers, multi-line text, kerning, built-in shape authoring, preview thumbnails for the preset cards, Preset Manager and Help Center entries, and the Sound Drawing timeline lane. The engine has no context-loss path because Canvas2D has none.

## Persistence

`xyScopeSettings` (source mode, SVG media id, processing mode, word, font id, preset id and every parameter) persists as project data with the other engine settings and passes through `normalizeXyScopeSettings` on merge, migration, mutation and reset. Values are clamped to the catalog ranges, enums and colours are validated, and text is one line of at most 16 characters. Runtime state (letter states, trail, scope window) is never persisted.

## Validation

- Unit tests in `src/components/vyzualz/react/xyScope/` cover settings and the four-group standard, geometry, the conversation, the motion model, event derivation, the beam brightness rules, and the panels and surface lifecycle.
- `src/stores/xyScopePersistence.test.ts` covers selection, normalization, persistence, migration and reset.
- The surface integration test feeds the real analyser pump, shared music context and runtime through a complete pattern cycle, and checks kick delivery and changing beam coordinates. Pattern Change is needed only to switch styles; a fixed style still performs the entire departure, figure, blank and word-return sequence.
- Current browser verification exercised all seven fixed-pattern performances with Pattern Change off, including departures, non-text figures, pixel-empty blank frames and readable word returns. It also covered subsequent Word variants, a portrait canvas and long transitions. Reviewed frames/results are in ignored `artifacts/xy-scope-choreography/`.
- Earlier browser verification used temporary harnesses that rendered the real surface, runtime and panels with the app's CSS against a synthetic audio-feature feed driven from a real track. They confirmed kick ring-downs, snare frays, a still word while paused, the original pattern controller cycle (Word → Waveform → Stereo Scope → Ring → Rosette → Weave → Pinwheel → Word), and that the Design inspector matches the Headliner Design inspector's structure and row styling.

### SOURCE cards

SOURCE begins with TEXT, SVG and OSCILATOR cards, using the shared Sound Drawing
source-card styling. TEXT is selected initially and shows the existing Input
group with Text and Font controls. SVG replaces those fields with its uploaded-file
and processing selectors. Returning to TEXT preserves its settings. OSCILATOR
draws the live stereo trace, with the existing procedural stand-in when no stereo signal is available.

### Dropdown window bounds

Font and parameter dropdowns use the shared dropdown’s optional ancestor
boundary and stay inside their owning inspector window. The Font menu always
opens below its field; parameter menus choose the side with more room. Menus
retain their existing width and height limit, cap to the available window space,
and scroll their options internally. Window resizing updates the bounds; font previews/search are kept.

The shared dropdown omits the redundant heading above its options. Search, when
enabled, is the first visible menu row; the menu name remains available to
assistive technology. Field labels and option-group labels are retained.


## Uploaded SVG oscillator drawing

Selecting SVG shows the canonical Input group with a searchable **SVG** dropdown and **SVG Processing** selector. The file list uses the shared SVG media eligibility predicate over the user's Media Library items: genuine SVG uploads only, excluding pending uploads, failed uploads, deleted files, raster-wrapped SVGs and files merely named `.svg`. No built-in shapes or font assets are mixed into it.

Processing modes are **Outline**, **Dashed Trace** and **Point Trace**. `useXyScopeSvg.ts` downloads the selected file, retries an expired/unavailable URL through the existing signed media URL service, compiles it outside the animation loop, and ignores aborted or outdated requests. File identity/revision changes reload it. Missing, invalid and unsupported selections clear the old geometry and show source status plus the standard error notice; they never substitute a circle or the previous word.

`XyScopeSvg.ts` uses the shared SVG vector compiler for paths, rectangles, circles, ellipses, lines, polylines/polygons and transforms. It centers the entire artwork by its bounds and applies one uniform scale, preserving aspect ratio and subpath placement. Geometry is bounded to 2,048 sampled points. Separate paths become independent beam strokes; open paths stay open. Text-only or raster-only files need conversion to vector outlines; excessively complex files report a simplification request rather than entering the frame loop.

SVG contours feed the existing XY motion, conversation, departure/blank/return choreography, phosphor, palette and audio feature pipeline. Pattern Change off continues the selected routine; the SVG replaces the word as the returning source. Outline traces continuous contours; Dashed Trace lifts the beam between runs; Point Trace samples visible vertices. Processing and geometry changes clear stale trails. Text-only spacing is hidden for SVG, while the shared Size control is labeled SVG Size under SVG Geometry.

The Design tab retains **Master Controls → Design → React → Palette**. React includes an **Audio Intelligence** subgroup with Bass Response, Mid Response, High Response, Kick Response and Snare Response (0–200%, defaults 100%). They scale the existing `SharedPerformanceContext` bands and shared kick/snare events. Master Audio Reactivity remains the overall control; no second analyser or independent beat clock is introduced. The REACT tab continues using the standard `ReactAudioPanel`, including shared analysis diagnostics and Live Input sensitivity/noise gate.

Source mode, SVG media ID, processing and response controls persist through the existing project settings normalizer. Old projects default to Text/Outline with unit response gains; changing source or preset preserves text/font values and the SVG selection.

Validation: focused XY tests cover geometry centering, transforms, open/closed strokes, all three beam modes, SVG choreography with Pattern Change off, kick-response gain, filtering, late-response cancellation, errors and deletion. Store tests verify the new fields and response gain survive project persistence. The actual browser verified the uploaded-only dropdown, visible SVG pixels and centered bounds, processing changes, standard group order, response controls, deleted-file blanking and text preservation. Screenshots were reviewed at `artifacts/xy-svg-outline.png`, `xy-svg-dashed.png`, `xy-svg-points.png` and `xy-svg-design.png` (ignored). No dependency, cloud schema or production build change is required.

Final validation: 155 XY/persistence tests passed across the focused runs, along with TypeScript, focused ESLint, browser workflow checks and diff checks. SVG rendering and processing screenshots were visually reviewed. Changes are uncommitted; no production build was run.

## Multiple text inputs

The centered **+** beneath the font dropdown in SOURCE → TEXT → Input adds another text field, up to five total. All entries share the selected font and the 16-character limit. During playback (including Live Input), a different nonblank entry is randomly selected every four seconds. Blank entries and duplicate words are skipped. In TEXT and TEXT V2, hover or focus an additional input to reveal its floating clear icon. Clicking it clears and removes that entry, collapses its row, and frees a slot for another input. The initial input has no remove action. Pausing holds the word and timer, and a track change returns to the first nonblank entry. Changing words preserves the current oscillator choreography.

The original `text` and up to four `additionalTexts` persist in project settings, including empty editing slots. Older projects restore with one input. Presets preserve the entries. Random selection and its timer remain runtime state and never overwrite saved text.

### TEXT V2

**Text V2** is a preset within **TEXT**, sharing the five editable text inputs and font library with the original text presets, OSC 1 and OSC 2. Selecting it activates its original signal-driven oscillator performance and compact controls; selecting Converse, Clean Scope or Storm returns to the original text behavior. Each instrument retains its own configuration when switching presets. V2 keeps its persisted `sourceMode: 'textV2'` and separate `textV2` configuration; older projects with that source automatically select the Text V2 preset without resetting authored settings. INIT and OCTA remain presets within OSCILATOR.

#### Text V2 oscillator and Auto Performance

- **Visible controls:** Auto Performance, Oscillator Grouping, Master Intensity, Abstraction, Text Size, Letter Spacing, Audio Response and the three palette colors. Auto defaults on. Grouping defaults to **Both**, letting audio-evidence decisions select and blend whole-word and individual-letter oscillators; the dropdown also offers Single Word Oscillator and Individual Letter Oscillators.
- **Five response families:** Orbit / Live Beam, Stereo / XY Weave, Harmonic / Ribbons, Transient / Impact, and Fold / Reform. Auto chooses on musical evidence and eases between families. With Auto off, a Response Style dropdown appears and live audio continues driving the selected manual family.
- **Live lettering and stage:** signed waveform samples deflect font contours along their normals even at zero departure; bass/impact envelopes expand the letters and band-focused channels move them independently. Three beam-lifted signal sweeps/orbits use the surrounding stage during playback. Silence returns exact font contours. The field opens with musical energy and spectral activity; all paths remain coherent and bounded.
- **One oscillator beam:** a fixed 3,072-sample XY stream forms the font outlines, leaves them completely for an orbit, Lissajous weave, epicycle ribbon, pulse ring or figure-eight, and then reforms the destination word. Letter channels can lead or lag inside the transition while all lettering samples reach the same departure endpoints; there is no persistent text layer or protected font pass during an oscillator formation. Signed waveform samples and musical envelopes shape the continuous carriers, rather than scattering points. Beam lifts preserve contour gaps in lettering and separate independent oscillator channels.
- **Musical lifecycle:** audio onset and trusted beat/transient/structural cues start departure; an evidence-seeded decision can hold, redirect, depart or reform, with dwell limits biased by musical state. Ordinary beats do not mandate a return. A queued destination word reforms after a complete departure. Transition clocks only ease those cued changes. A requested new word is queued and committed exclusively when morph reaches 100% oscillator, so words of different lengths can resolve from the same stable beam stream. Full formations clear outgoing lettering phosphor. Pause/silence returns the selected word and cancels an uncommitted replacement. Abstraction controls formation complexity rather than retaining a fixed font anchor.
- **Hidden controls:** Auto coordinates deflection, stroke protection, folds, attack, damping, sensitivity, departure, reform, protected passes, transient readability, deflection angle, stereo coupling, X/Y scale, cross modulation, waveform detail, intensity, phosphor decay, focus width, scan rate, letter-channel depth/offset/frequency focus, and palette mixing. Effective values are smoothed runtime overlays, never writes into manual settings. Abstraction and Audio Response bound the performance; authored text, font, grouping choice and palette remain user choices.
- **Audio intelligence variation:** section/phrase/drop changes, credible drum/transient attacks and spectrally active trusted beats seed weighted effect-family choices, secondary-family blends, frequency ratios, folds, phase, stage position, spread, grouping, field density and all hidden control targets. Bands, flux, complexity, build, drop impact and energy trend bias those choices and continuously drive their envelopes. Event identities are deduplicated, targets glide, and the same musical event is reproducible; no per-frame random point noise or repeating preset sequence is used.
- **Word changes:** V2 has no seconds-based timer. A confident section or phrase change, drop occurrence, or a significant spectral/energy change at a trusted bar boundary can queue a different nonblank entry, which commits while the beam is completely in its oscillator formation. Events are deduplicated. Pausing holds the word, seeks/loops suppress stale events, and track replacement resets the performance. Word selection is stable for the same event and variation seed and never immediately repeats the current entry. The original TEXT source retains its four-second behavior.
- **Audio path:** uses the existing shared performance context, confidence values and stereo tap. If the stereo worklet is unavailable, V2 reads the existing master analyser’s actual signed waveform and labels it as mono, without changing the analyser or monitoring path. If neither sample source is available, coherent audio-feature-driven contours replace the procedural scope cloud. A notice identifies the fallback. No audio means resting text. Pause and zero Audio Response ease back to the original outlines.
- **Implementation:** `XyScopeTextV2Settings.ts`, `XyScopeTextV2Performance.ts`, `XyScopeTextV2Plan.ts`, `XyScopeTextV2Geometry.ts`, `XyScopeTextV2Trajectory.ts`, `XyScopeTextV2Audio.ts` and `XyScopeTextV2DesignPanel.tsx`, integrated through the existing runtime, surface, store normalizer and beam renderer. The beam's V2 width/scan fields are optional for other sources.

Focused tests cover musical decisions versus elapsed time, confidence, duplicate/stale events, pause/seek/track changes, all hidden controls, manual restoration, signed samples, each grouping, coherent stage-bounded formations for all five styles, complete independence from letter geometry at full formation, continuous unequal-length word changes, one-stream rendering, compact UI and project persistence.

### OSC 1 preset

OSC 1 is a preset card in the TEXT source’s Presets tab. Choosing it switches the engine to the directional oscilloscope text instrument ported from XY / Text Lab 05 (`sourceMode: 'osc1'`, `presetId: 'osc1'`); choosing Converse, Clean Scope or Storm returns to the standard text source, while Text V2 and OSC 2 activate their own instruments. The left SOURCE window is unchanged: the same Input group with the text field(s) and font dropdown, so any library font drives the letter contours.

- **Engine** (`XyScopeOsc1Engine.ts`): anchored contours that only ever stretch outward. Eight frequency regions map to eight directions, with transient bursts, stereo axis extension, triggered-PCM detail and a legibility cap. No free-running motion, springs, rotation or noise.
- **Five response systems**: Band / deflection, Stereo / vectors, Harmonic / fans, Transient / burst, Resonance / rays. Each keeps its own sixteen control values and phosphor colour.
- **Analysis** (`XyScopeOsc1Analysis.ts`): the Text Lab's feature extractor. The shared stereo scope window supplies the PCM; each channel is Blackman-windowed and transformed as an unsmoothed analyser would, then reduced to the eight-band spectrum, per-band onsets, flux, centroid, flatness, stereo width/correlation/balance, peaks and crest. Without stereo samples it uses the labelled mono waveform, then the shared Music Intelligence levels.
- **Auto Performance** (`XyScopeOsc1Performance.ts`): the Text Lab's conductor. It coordinates all sixteen controls, the phosphor colour and each letter's gain, direction offset and focus from live audio plus build / drop / breakdown evidence. The Text Lab read a precomputed map of its three embedded tracks; here that role is played by the shared performance context of the loaded track (`osc1StructureFromContext`), and with no analysed track the conductor uses its live fallback. Manual values are never mutated; switching Auto off simply shows them again.
- **Renderer** (`XyScopeOsc1Renderer.ts`): 18k samples/s per letter with blanked retraces into a decaying energy raster capped at 1,200 px wide, bloom and an optional graticule.
- **Inspector** (`XyScopeOsc1DesignPanel.tsx`): Master Controls (Auto Performance with state/evidence/signal rows, Response System, Grid, Hold Trace), Design (XY Geometry, Beam & Phosphor, Letter Channels), React (Live Response) and Palette (Phosphor Color). With Auto on every control shows its live effective value and is read-only. Reset Signals, Restore Response System and Reset OSC 1 sit below.
- **Words**: with several text inputs filled, the next word is chosen on each detected drop.

Tests: `XyScopeOsc1.test.ts` (ported from the Text Lab's `verify.cjs` and `performance.cjs`) and an OSC 1 case in `XyScopeWorkspace.test.tsx`.

### OSC 2 preset

OSC 2 is a second instrument preset (`sourceMode: 'osc2'`, `presetId: 'osc2'`) that treats the oscilloscope as a 3D environment. Like OSC 1 it keeps the same left SOURCE window (text input(s) and font dropdown) and reuses OSC 1's analyser, phosphor raster and Auto Performance conductor; only the geometry is new. The beam still draws everything as a single moving point, now through a perspective camera.

- **Solid letters** (`XyScopeOsc2Engine.ts`): each letter is a stack of 2–8 contour slices. Every slice answers one frequency region (rotated per letter), so bass pushes its slice toward the camera and swells it, with onsets adding short thrusts.
- **Waveform terrain**: the last ten moments of the live waveform are kept as rows that scroll away behind the word, brighter when near and fading into the distance.
- **Floor grid**: an optional perspective floor.
- **Camera**: sweeps around the word at a pace set by the music's level, pushes in on kicks, slides with stereo balance, and settles straight-on when the music pauses or is silent.
- **Auto Performance** (`XyScopeOsc2Performance.ts`): the shared conductor supplies build / drop / breakdown evidence and beam character; builds pull the camera up and back, drops push it in and open the solid. Manual values are never overwritten; with Auto on the sliders show the live values and are read-only.
- **Inspector** (`XyScopeOsc2DesignPanel.tsx`): Master Controls (Auto Performance, Floor Grid, Hold Trace), Design (Scene, Camera, Beam & Phosphor), React (Band Depth, Kick Dolly), Palette (Phosphor Color).
- The shared beam scanner (`XyScopeOsc1Renderer.ts`) now accepts any engine whose streams report absolute screen positions.

Tests: `XyScopeOsc2.test.ts` and an OSC 2 case in `XyScopeWorkspace.test.tsx`.

## INIT

INIT is a preset of the OSCILATOR source (Presets tab → INIT). Choosing it switches the engine to `init`; the OSCILATOR card in the Sources tab stays lit, and an **Input** group below the source cards holds the **Oscillators** dropdown (1, 2 or 3 oscillators), which sets how many oscilloscope lines are drawn.

Each oscilloscope is a straight line with a start and an end point carrying a triggered slice of the live waveform. The left window has the four standard groups:

- **Master Controls:** Master Intensity, Audio Reactivity, BPM Sync (line moves follow the track's beat grid; off, a free-running clock that runs only while audio plays), Auto Performance and Hold Trace.
- **Design:** Layout (Stacked, Side by Side, Overlay, Omnidirectional), Signal (Frequency Bands, Stereo Channels, Timebase Zoom), the **Free Endpoints** toggle, then Scope (Wave Height, Trace Length, Time Window), Endpoints (Change Every, Glide) and Beam & Phosphor (Beam Width, Glow, Phosphor Decay).
- **React:** Wave Response, Kick Response, Snare Response.
- **Palette:** a colour per visible oscillator, and Background.

Free Endpoints lets each oscillator start and end away from horizontal: each re-picks a random angle, length and position around its layout slot every Change Every beats. Omnidirectional always does this, anywhere on screen including diagonals. Signals come from the shared stereo window (mono tap, then shared analysis as fallbacks); with no signal the lines are flat. Auto Performance uses the shared conductor to raise height, glow and line speed on drops and calm them in breakdowns, and shows the live values in the inspector.

Code: `XyScopeInitSettings.ts` (values, ranges), `XyScopeInitEngine.ts` (layout, endpoint picking, waveform bands), `XyScopeInitRenderer.ts` (phosphor canvas), `XyScopeInitPerformance.ts`, `XyScopeInitDesignPanel.tsx`.

## OCTA

OCTA is a preset of the OSCILATOR source (Presets tab → OCTA) that reproduces the Reference Video (`~/Desktop/Reference Video.mov`): a plus-shaped cluster of five wireframe octahedra (one in the centre, one above, below, left and right), each with its three axes, drawn by one green phosphor beam that hops from octahedron to octahedron. Choosing it switches the engine to `octa`; the OSCILATOR card stays lit.

What the video shows, and how it is built:

- **Clean cluster:** the figure at rest, turning slowly about its vertical axis, with the live waveform rippling along the axis lines. Each octahedron is a continuous beam path (an Eulerian circuit of its twelve edges, then its three axes), and the beam spends equal time per edge so every edge is equally bright while the hops between octahedra stay faint.
- **Tumble:** the octahedra spin apart on their own axes and tangle.
- **Loops:** the beam's finite bandwidth, modelled as a resonant low-pass on the beam position, overshoots every corner and rounds the cluster into loops.
- **Cage:** every edge bends toward a sphere (each point is pushed onto the octahedron's circumscribed sphere), so the edges become great circles, and the cluster draws in.
- **Dots:** the beam dwells at each corner far longer than it spends on the lines, so the lines fall faint and the corners flare.

The audio drives the distortion by **energy**: the track's level (with bass and mids) is normalised to the track's own recent range, so every stage is reachable on any material, eased by Energy Response, and scaled by Audio Reactivity and Distortion Amount. As the energy climbs the figure passes through clean, tumble, loops, cage and dots in order, and returns to clean in silence. Paused, or with Audio Reactivity or Distortion Amount at zero, it stays clean. Auto Performance adds the shared conductor's builds and drops to the energy.

The left window has the four standard groups: Master Controls (Master Intensity, Audio Reactivity, Distortion Amount, Auto Performance, Hold Trace, with live Distortion, Energy and Signal readouts), Design (Cluster: size, spread, tilt, spin, axis lines; Beam & Phosphor: width, glow, decay, scan frequency), React (Energy Response, Tumble, Beam Inertia, Dot Scan, Signal Wiggle) and Palette (Beam Color, Glow Color, Background). The renderer is the shared phosphor scanner with a wide tinted halo (`halo` option) so the bloom matches the video.

Code: `XyScopeOctaSettings.ts`, `XyScopeOctaEngine.ts` (geometry, distortion, beam), `XyScopeOctaDesignPanel.tsx`, `XyScopeOctaLive.ts`; rendering in `XyScopeOsc1Renderer.ts`, wiring in `XyScopeRuntime.ts` (`renderOcta`).

