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

## Shell regions

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

### Center stage

The center stage owns the active visual output canvas and approved spatial authoring overlays.

Normal playback is output-focused. General controls, media libraries, and setup cards remain outside the stage.

### Right rail

The right `WorkspaceRail` uses four role-based destinations:

- PRESETS, or SCENES for Shader Pads
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

`REACT_ENGINE_IDS` is the user-facing engine registry. `REACT_KNOWN_ENGINE_IDS` additionally contains the retired `shaderPads` and `cinematicPortal` identifiers for persisted-project and import compatibility; those aliases must not be rendered as selector choices. `REACT_ENGINE_CATALOG` retains metadata for both public and compatibility IDs.

| ID | Label | Live renderer ownership |
| --- | --- | --- |
| `cinema` | Cinema | `CinemaWorkspace` → single Cinema canvas/WebGL runtime |
| `oscilloscope` | Sound Drawing | `ReactPlaceholderCanvas` → Sound Drawing renderer |
| `canvas` | CANVAS | `CanvasEngineSurface` from `ReactCanvasEngineShell.tsx` |
| `laserDmx` | LaserDMX | `ReactPlaceholderCanvas` → LaserDMX renderer |
| `pixGrid` | PixGrid | `PixGridSurface` |

Shader Pads and Cinematic Worlds content is cataloged as stable Cinema compositions. Their old IDs remain restore aliases only; neither owns a public canvas, animation loop, or selectable workspace after Cinema Stage 23.

Adding an engine requires updating the typed engine ID, catalog, workspace composition, state defaults and migrations, renderer routing, controls, presets or scene surface, diagnostics, tests, and documentation.

## Workspace matrix

Current composition is resolved centrally:

| Engine | Left rail | Preset surface | Lower workspace | Authoring overlay |
| --- | --- | --- | --- | --- |
| Cinema | Composer Visuals/Library | Cinema library + Composer | Track Map + Performance context | Graph editor when selected |
| Sound Drawing | SOURCE + MEDIA + FONTS | PRESETS | Sound Drawing timeline + Track Map + Performance Pads | None |
| CANVAS | SOURCE | PRESETS | Track Map + Performance Pads | None |
| LaserDMX | RIG + LAYERS | PRESETS | Track Map + Performance Pads | Show Director stage editor or Beam Matrix editor when enabled |
| PixGrid | SETUP + MEDIA | PRESETS | Track Map + Performance Pads | PixGrid editor when enabled |

Track Map is shared by every React engine.

Former Shader Pads and Cinematic Worlds visuals are selected from Cinema rather than separate React-engine surfaces.

## Right-rail composition

### PRESETS / SCENES

- Standard engine presets use `ReactPresetsPanel` and `ReactPresetCard`.
- Cinema uses its canonical composition library and Composer surfaces.
- Preset resolution remains within the active public engine family.
- Legacy Shader/Cinematic identifiers resolve through the Stage-23 compatibility migration instead of activating a legacy preset surface.

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

- Shader renderer
- Track Map
- Sound Drawing timeline
- LaserDMX layers
- Shader scene library

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

`useRecorder` lives in React View and records the active output canvas. `OutputCastControl` consumes that same published canvas and relays it to a local display or discovered DRMVYZ receiver without creating a second renderer.

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
