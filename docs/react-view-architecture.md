# React View architecture

## Purpose

React View is DRMVYZ's default live VJ workspace. It composes engine-specific authoring and rendering inside one stable shell rather than allowing each engine to create its own page layout, transport, media system, or output workflow.

Canonical shell:

- `src/components/vyzualz/react/ReactView.tsx`

Canonical registries:

- `src/components/vyzualz/react/reactEngineCatalog.ts`
- `src/components/vyzualz/react/reactWorkspaceComposition.ts`

UI and implementation rules:

- `AI_IMPLEMENTATION_CONTRACT.md`

## App typography

The primary UI font is Space Grotesk. The secondary font is Manrope, loaded
through `index.html` and applied through the existing `--font-mono` token and
its `--az-font-data` alias. The legacy token name remains for compatibility;
secondary text now uses a proportional sans-serif face. Shared dropdown and
popover fallbacks, timeline canvas text, and authentication visualizer labels
use Manrope as well.

Main inspector tabs use the same canonical 11px size as the left library tabs.

`styles/typography.css` owns the shared UI typography contract. Field labels
use Manrope 11px/600; every field value (text, textarea, search, dropdown,
numeric and color values, placeholders and dropdown option values) uses that
same face, size and weight, built from the same three tokens, so a value always
matches its label (value line height is 1.2, label 1.0; muted color
distinguishes placeholders). Native `<input>`, `<textarea>` and `<select>`
elements get the role through a safety net in the same file even when they do
not use a reusable component; only `.type-exempt` opts out (the shader code
editor and the dock's BPM readout editor). Tabs and shared action
buttons use Manrope 11px/700. Parent group headings share the window-title
role, Space Grotesk 12px/700 with 0.15em tracking; nested group headings use
Space Grotesk 11px/800 at every nested depth, determined by the reusable
`.drc-group` hierarchy. Every parent group header also leads with an icon
(`DualRailCollapsible` chooses one from the label via `groupHeaderIcon.ts`
unless a call site passes `icon`, or `icon={false}`); nested groups never do. A first-level nested heading is indented so its first letter lines up with the parent heading's first letter (`--drc-nested-inset`, keyed off `data-drc-depth`; bodies with no side padding restate it). Groups inside a body are all 22px below whatever precedes them (the first gets it from 10px body padding + 12px group padding; later ones trim the 2px surplus of row gap + group padding via `--drc-group-gap-trim`); a panel's own group margin, such as the Preset Manager info panel's, is added on top of that. Compact and dense controls keep
their geometry but use the same typography as their standard counterparts.
Read-only fields follow the same rules as editable fields. These rules also
cover portaled dropdown menus and take precedence over legacy font overrides.
Authored media and lyric presentation fonts are not UI typography roles.
Run `node scripts/audit-text-inputs.mjs` to audit every native text field in
`src/`, and `node scripts/verify-input-typography.mjs` to render the reusable
components and every native field shape and check their computed fonts.
Run `node scripts/verify-shared-typography.mjs` to check the rendered contract
across seven workspace contexts, dropdown sizes, read-only/disabled fields,
placeholders, portaled menus, and late stylesheet loading.
`node scripts/verify-input-typography.mjs` mounts the actual reusable React
components and verifies text, number, textarea, preset search, searchable
dropdowns, selected/empty dropdowns in every size, and real portaled options.
The control styles import the shared typography contract directly so isolated
component mounts receive the same fonts as the main app.

Horizontal tab rows share a 25px top gap, matching the Inspector below its
window header. `styles/tabRows.css` owns this spacing through
`--workspace-tab-top-gap`, including React engine Source/Layers tabs,
library filters, manager inspectors, lyric workspace tabs, nested panel tabs,
timeline toolbars, Brand Kit, media Drop Points, shader editors, and the
horizontal Settings navigation on narrow screens. Leading wrappers remove
their top inset so it does not compound with the row's spacing. The Settings
sidebar remains a vertical navigation list on wider screens.

## Shell regions

`styles/groupSpacing.css` aligns the audited Lyric and Preset inspectors,
React left control groups, Brand Kit editor, and lyric Versions content to
their tab content edges. Reusable group bodies (`.drc-body`, parent and
nested groups alike) keep their own padding, `--workspace-group-body-padding`:
10px top, 16px left, 8px right, 16px bottom. Surfaces that bleed their rows to
the rail edge, such as the Lyric Tracks library, zero it on their own selector.

React View has five persistent architectural regions.

### Header

The header owns:

- React View identity
- Shared audio source selection
- Persistence status
- Global output controls
- Global application actions

It does not own engine-specific control stacks or a second transport.

### Left rail

The left `WorkspaceRail` owns contextual source and setup surfaces.

`resolveReactWorkspaceComposition()` decides the available tabs, so engine code must not mount left-rail tabs independently.

The left rail uses compact description density. Control labels, values, actions,
warnings, errors, empty states, and live diagnostics remain visible, while
long explanatory helper copy is visually removed from the layout and retained
for assistive technology. Right-rail descriptions are unaffected.

Across app workspaces, `RailWindowHeader` uses its bottom border to separate
the title bar from the content. It casts no outer shadow, so the tab rows
below retain their panel background without a dark fade.

### Center stage

The center stage owns the active visual output canvas and approved spatial authoring overlays.

Normal playback is output-focused. General controls, media libraries, and setup cards remain outside the stage.

### Right rail

The right `WorkspaceRail` uses four role-based destinations:

- PRESETS
- DESIGN
- REACT
- OUTPUT

Nested composition is owned by:

- `src/components/vyzualz/react/panels/ReactWorkspacePanels.tsx`
- `src/components/vyzualz/react/PanelSubtabs.tsx`

### Lower workspace and audio dock

The lower workspace owns:

- Track Map
- Sound Drawing timeline
- Performance Pads
- Visual-output cast control beside Stage Focus

The audio dock is mounted outside the grid:

- `src/components/vyzualz/shared/VyzualzAudioDock.tsx`

This keeps transport, waveform, cue, BPM, Rekordbox, and track controls shared across engines.

## Selectable engine registry

`REACT_ENGINE_IDS` is the user-facing engine registry. `REACT_KNOWN_ENGINE_IDS` additionally contains the retired `shaderPads`, `cinematicPortal`, and `cinema` identifiers for persisted-project and import compatibility; those aliases must not be rendered as selector choices. `REACT_ENGINE_CATALOG` retains metadata for both public and compatibility IDs.

| ID | Label | Live renderer ownership |
| --- | --- | --- |
| `cinema2` | Cinema 2.0 | `Cinema2Stage` → `Cinema2Runtime` |
| `oscilloscope` | Sound Drawing | `ReactPlaceholderCanvas` → Sound Drawing renderer |
| `canvas` | CANVAS | `CanvasEngineSurface` from `ReactCanvasEngineShell.tsx` |
| `laserDmx` | LaserDMX | `ReactPlaceholderCanvas` → LaserDMX renderer |
| `pixGrid` | PixGrid | `PixGridSurface` |
| `headliner` | HEADLINER | `HeadlinerStage` camera-effects renderer |

Legacy Cinema, Shader Pads, and Cinematic Worlds IDs remain restore aliases only; none owns a public canvas, animation loop, or selectable workspace. Historical content is migrated into Cinema 2.0.

Adding an engine requires updating the typed engine ID, catalog, workspace composition, state defaults and migrations, renderer routing, controls, presets or scene surface, diagnostics, tests, and documentation.

## Workspace matrix

Current composition is resolved centrally:

| Engine | Left rail | Preset surface | Lower workspace | Authoring overlay |
| --- | --- | --- | --- | --- |
| Cinema 2.0 | SOURCE + LAYERS | Native Cinema 2.0 presets | Track Map | None |
| Sound Drawing | SOURCE + MEDIA + FONTS | PRESETS | Sound Drawing timeline + Track Map + Performance Pads | None |
| CANVAS | SOURCE + LAYERS | PRESETS | Track Map + Performance Pads | None |
| LaserDMX | RIG + LAYERS | PRESETS | Track Map + Performance Pads | Show Director stage editor or Beam Matrix editor when enabled |
| PixGrid | SETUP + MEDIA | PRESETS | Track Map + Performance Pads | PixGrid editor when enabled |
| HEADLINER | SETUP | PRESETS | None | None |

Track Map is shared by every React engine.

Former Shader Pads and Cinematic Worlds identities are migration inputs only.
They resolve to mapped Cinema 2.0 presets or a recoverable archive and never
mount separate React-engine surfaces.

## Right-rail composition

### PRESETS / SCENES

- Standard engine presets use `ReactPresetsPanel` and `ReactPresetCard`.
- Cinema 2.0 uses `Cinema2PresetsPanel`, backed directly by the native preset registry.
- Preset resolution remains within the active public engine family.
- Legacy Cinema, Shader, and Cinematic identifiers resolve through the isolated
  compatibility migration instead of activating a retired preset surface.

### DESIGN

Default engines use:

- ENGINE → `ReactFxPanel`
- SELECTION → `ReactInspectorPanel`, enabled only for a concrete inspectable object

Specialized surfaces:

- PixGrid → `PixGridDesignPanel`
- LaserDMX Show Director → `LaserDmxShowDirectorControls`

### REACT

Default engines use:

- ROUTING → `ReactModulationPanel`
- ANALYSIS → `ReactAudioPanel`

PixGrid uses:

- ROUTING
- EVENTS
- CHOREOGRAPHY
- ANALYSIS

through `PixGridReactivityWorkspace`.

### OUTPUT

- RECORDING is available to every engine.
- PRODUCTION is enabled only for LaserDMX.
- Recorder ownership remains in `ReactView` so active recording survives right-rail tab changes.

## Center-stage authoring overlays

The center remains output-focused during ordinary playback.

Approved overlays are mounted only through explicit engine authoring state:

- `PixGridEditorOverlay`
- `LaserDmxShowDirectorCanvas` with stage variant
- `LaserDmxBeamMatrixEditorOverlay`

Overlay visibility must be derived from active-engine and authoring-mode state. Engine switches must hide or dispose incompatible overlays.

An overlay may edit stage geometry, pixels, masks, fixtures, beams, or other spatial content. It must not become a general control panel or media library.

## Renderer selection and lazy loading

Large engine-specific surfaces are lazy-loaded only when their workspace becomes visible:

- Track Map
- Sound Drawing timeline
- LaserDMX layers
- Media Manager and other modal workspaces

The center renderer selection occurs in `ReactView.tsx`.

All live renderers publish their active output canvas through `onCanvasReady`. They also publish bounded FPS diagnostics through `onLiveFps`.

Engine switches clear stale FPS and engine-specific output-canvas references.

## Audio, Track Map, and section authority

React View resolves one current section timeline by combining:

- Offline analyzed sections
- Manual sections
- Suppressed automatic sections

The resolved timeline is shared by:

- Track Map
- Preset automation
- Engine renderers
- Shared Performance context
- PixGrid cues
- Recording-visible output

No engine should independently reinterpret a different section map.

Timeline duration is normalized to a finite positive value before lower-workspace and renderer use.

## Media selection

React View uses engine media capabilities rather than mounting the full library for every engine.

Current contextual media paths include:

- Sound Drawing SVG media
- PixGrid still-image and SVG media

CANVAS owns its source flow inside `ReactCanvasEngineShell` but still uses the shared Media Library and media records.

See `docs/brand-kit.md` for personalization and overlay flow.

## Persistence

Cinema 2.0 authored state is stored in the versioned `cinema2Workspace`
document. A data-only compatibility reader may read `drmvyz:cinema-store`,
archive the complete historical document, and map known built-in provenance;
it cannot import or construct the retired runtime, store, or workspace. Invalid
archives produce explicit diagnostics and the raw legacy storage is left intact
for recovery.

`reactWorkspacePreferences.ts` persists:

- Left rail collapsed
- Right rail collapsed
- Lower workspace collapsed
- Track Map or Performance Pads selection
- Preferred left tab

The preferred left tab is validated against the active engine. Engine changes return to that engine's primary workspace tab.

`reactRightPanelPersistence.ts` persists the top-level right destination after runtime validation.

Stage Focus is intentionally session-only.

The audio dock owns a separate collapse preference.

## Stage Focus

Stage Focus maximizes the live stage by hiding rail and lower-workspace presentation through React View state and CSS behavior. The adjacent cast control opens the output-window and device chooser without changing Stage Focus state.

It also switches the audio dock to compact mode.

Stage Focus must not:

- Rewrite saved rail preferences
- Change the active engine
- Change authored state
- Arm production output
- Create a second recording canvas

## Recording and output

`useRecorder` lives in React View and records the active output canvas. Cinema
2.0 publishes its `Cinema2Stage` canvas through the same ownership contract as
every other live engine. `OutputCastControl` consumes that published canvas and
relays it to a local display or discovered DRMVYZ receiver without creating a
second renderer.

The selected engine must publish the actual visible live canvas. Preview and thumbnail canvases must not replace it.

LaserDMX Production Output is a separate normalized frame and adapter boundary. See `docs/react-recording-and-output.md`.

## Shared diagnostics lifecycle

React View retains shared performance diagnostics only for engines that publish through that store. Engine switches clear incompatible snapshots so one engine's status cannot remain visible as another engine's live state.

High-frequency diagnostics should avoid React state churn and unbounded history.

## Extension checklist

When adding or changing an engine surface:

1. Update the canonical engine or workspace registry rather than branching in multiple files.
2. Reuse `WorkspaceRail`, `RailTabs`, `PanelSubtabs`, control rows, preset cards, and media flows.
3. Keep center-stage UI limited to output and explicit spatial authoring.
4. Use the shared audio, Track Map, Music Intelligence, and Shared Performance authorities.
5. Define persistence and migration behavior.
6. Define renderer cleanup, context loss, quality, seek, loop, pause, and replacement behavior.
7. Publish the correct output canvas for recording.
8. Update the engine document, this document when shell composition changes, and the implementation contract.
9. Add architecture and lifecycle tests.
10. Run the verification appropriate to the changed engine.
