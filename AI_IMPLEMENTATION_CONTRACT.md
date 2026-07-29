# DRMVYZ React View AI Implementation Contract

## Purpose and authority

This file is the canonical implementation and UI contract for DRMVYZ React View. It exists to prevent parallel component systems, conflicting musical timelines, isolated media flows, duplicated render state, and layout drift.

The primary rule is:

> Reuse the existing DRMVYZ architecture before adding a new component, store, renderer, upload path, preset system, timing source, or visual surface.

When documentation and code disagree, inspect the current repository, update the documentation in the same patch, and do not preserve a known-stale statement merely because it appears in an older patch record.

Read [`docs/documentation-index.md`](docs/documentation-index.md) before treating a patch-history document as current architecture.

## Required pre-coding inspection

Before changing React View, inspect the files that own the affected boundary.

### Shell, engine registry, and workspace composition

- `src/components/vyzualz/react/ReactView.tsx`
- `src/components/vyzualz/react/reactEngineCatalog.ts`
- `src/components/vyzualz/react/reactWorkspaceComposition.ts`
- `src/components/vyzualz/react/reactWorkspacePreferences.ts`
- `src/components/vyzualz/react/reactRightPanelPersistence.ts`
- `src/components/vyzualz/react/panels/ReactWorkspacePanels.tsx`
- `src/components/vyzualz/react/PanelSubtabs.tsx`
- `src/components/vyzualz/layout/WorkspaceRail.tsx`
- `src/components/vyzualz/layout/RailTabs.tsx`
- `src/components/vyzualz/shared/VyzualzAudioDock.tsx`

`reactEngineCatalog.ts` is the selectable-engine registry. `reactWorkspaceComposition.ts` is the canonical engine-to-workspace mapping. Do not hard-code a second engine list or independently decide which rails, tabs, preset surfaces, Track Map tools, or authoring overlays an engine receives.

### Controls, presets, media, and state

- `src/components/vyzualz/react/ReactControlRows.tsx`
- `src/components/vyzualz/react/ReactPresetCard.tsx`
- `src/components/vyzualz/react/ReactPresetsPanel.tsx`
- `src/components/vyzualz/react/ReactEnginePanel.tsx`
- `src/components/vyzualz/react/ReactFxPanel.tsx`
- `src/components/vyzualz/react/ReactInspectorPanel.tsx`
- `src/components/vyzualz/media/MediaDeckPanel.tsx`
- `src/components/vyzualz/media/MediaLibraryBrowser.tsx`
- `src/components/vyzualz/MediaUploadModal.tsx`
- `src/stores/reactStore.ts`
- `src/stores/mediaStore.ts`

### Rendering, output, and lifecycle

- `src/components/vyzualz/react/ReactPlaceholderCanvas.tsx`
- `src/components/vyzualz/react/ReactShaderCanvas.tsx`
- `src/components/vyzualz/react/ReactCanvasEngineShell.tsx`
- `src/components/vyzualz/react/pixGrid/PixGridSurface.tsx`
- `src/components/vyzualz/react/renderers/ReactEngineRenderer.ts`
- `src/components/vyzualz/react/renderers/CinematicPortalRenderer.ts`
- `src/components/vyzualz/react/renderers/CinematicWorldRenderer.ts`
- `src/components/vyzualz/react/renderers/cinematic/CinematicWebGLRuntime.ts`
- `src/components/vyzualz/react/shaders/runtime/ShaderWebGLRuntime.ts`
- `src/hooks/useRecorder.ts`
- `src/components/vyzualz/react/output/ProductionOutput.ts`

Never assume that a renderer, dependency, store, bridge, capability, or output adapter exists. Confirm it in the repository.

## React View layout contract

The complete shell is documented in [`docs/react-view-architecture.md`](docs/react-view-architecture.md).

### Header

Canonical location:

- `src/components/vyzualz/react/ReactView.tsx`
- `src/styles/vyzualz.css`
- `src/styles/reactView.css`

Current structure uses `.vz-header`, `.vz-header-title-group`, `.vz-header-title`, `.vz-header-sub`, `.vz-input-group`, and `.az-select`.

Rules:

- Keep engine-specific control stacks out of the header.
- The header is for high-level audio source selection, persistence status, global output controls, app actions, and React View identity.
- Do not add a second transport. Transport and waveform ownership remain in the shared audio dock.

### Left rail

The left rail is a `WorkspaceRail` with `side="left"` and `RailTabs`.

It owns contextual setup and source surfaces:

- Engine selection and engine-specific setup.
- Media browsing through the existing media system.
- LaserDMX layers.
- Sound Drawing fonts.
- Other source or rig browsing explicitly declared by `reactWorkspaceComposition.ts`.

Rules:

- Add or remove engine-specific left tabs through `reactWorkspaceComposition.ts`.
- Reuse `MediaDeckPanel` and `MediaLibraryBrowser`.
- Do not place upload or library interfaces over the center stage.
- Do not create custom top-level rail tab markup when `RailTabs` supports the requirement.
- Keep the left rail compact: ordinary control descriptions use the shared
  `.rv-ctrl-description` output, and standalone explanatory helper copy uses
  `.rv-control-helper-copy`. React View removes both from the visible left-rail
  layout while preserving them for assistive technology. Do not apply the
  helper class to warnings, errors, empty states, or live diagnostics that the
  user must see.

### Center stage

Normal playback treats the center as visual output. Renderer controls, media libraries, setup cards, and general inspector UI do not belong there.

The current renderer ownership is:

- Shader Pads: `ReactShaderCanvas`
- CANVAS: `CanvasEngineSurface`, exported by `ReactCanvasEngineShell.tsx`
- PixGrid: `PixGridSurface`
- Cinematic Worlds, Sound Drawing, and LaserDMX live rendering: `ReactPlaceholderCanvas` and engine renderers

#### Explicit authoring-overlay exception

An engine may mount a center-stage authoring overlay only when all of the following are true:

- The user explicitly enabled an authoring mode.
- The overlay is scoped to the active engine.
- It edits the rendered spatial composition directly.
- It is not a replacement for left-rail source selection or right-rail controls.
- It cleans up listeners, transient resources, and selection state when hidden or when the engine changes.
- Recording and stage-focus behavior are deliberate and documented.

Current approved overlays are:

- `PixGridEditorOverlay`
- `LaserDmxShowDirectorCanvas` with `variant="stage"`
- `LaserDmxBeamMatrixEditorOverlay`

Do not generalize this exception into arbitrary center-stage UI.

### Right rail

The right rail is a `WorkspaceRail` with `side="right"`.

Top-level destinations are:

- `PRESETS`, or `SCENES` for Shader Pads
- `DESIGN`
- `REACT`
- `OUTPUT`

`src/components/vyzualz/react/panels/ReactWorkspacePanels.tsx` owns the canonical nested surfaces:

- DESIGN: `ENGINE` / `SELECTION`, with PixGrid and Show Director specialized design surfaces.
- REACT: `ROUTING` / `ANALYSIS`.
- PixGrid REACT: `ROUTING` / `EVENTS` / `CHOREOGRAPHY` / `ANALYSIS`.
- OUTPUT: `RECORDING` / `PRODUCTION`, with Production enabled only for LaserDMX.

Rules:

- Use `PanelSubtabs` for right-rail subnavigation.
- Keep controls, FX, parameters, presets, routing, diagnostics, recording, and production output in the right rail.
- Do not create a new parallel inspector shell.
- Keep right-panel content inside `.rv-workspace-panel`, `.rv-workspace-panel-body`, `.rv-inspector`, and `.rv-inspector-scroll`.

### Lower workspace and audio dock

The lower workspace owns Track Map, Sound Drawing timeline lanes, and Performance Pads. Its composition is controlled by `reactWorkspaceComposition.ts`.

The shared audio dock is mounted outside the main grid through `src/components/vyzualz/shared/VyzualzAudioDock.tsx`.

Rules:

- Timeline editors may use compact, timeline-specific controls.
- Do not copy `.rv-form-*`, `.rv-sd-*`, or timeline lane controls into ordinary right-rail panels.
- Stage Focus is session-only. It hides workspace surfaces and switches the audio dock to compact mode without rewriting persisted collapse preferences.
- The audio dock may persist its own user-collapse preference independently.

## Canonical engine and workspace composition

The selectable engines are defined only in `REACT_ENGINE_IDS` and `REACT_ENGINE_CATALOG`:

| Engine ID | Label | Primary center renderer |
| --- | --- | --- |
| `shaderPads` | Shader Pads | `ReactShaderCanvas` |
| `cinematicPortal` | Cinematic Worlds | Cinematic renderer through `ReactPlaceholderCanvas` |
| `oscilloscope` | Sound Drawing | Sound Drawing renderer through `ReactPlaceholderCanvas` |
| `canvas` | CANVAS | `CanvasEngineSurface` |
| `laserDmx` | LaserDMX | LaserDMX renderer through `ReactPlaceholderCanvas` |
| `pixGrid` | PixGrid | `PixGridSurface` |

`resolveReactWorkspaceComposition()` decides:

- Left-rail tabs and their labels.
- Whether Performance Pads are available.
- Whether Sound Drawing timeline is mounted.
- Whether the LaserDMX layers tab and Beam Matrix editor are available.
- Whether the preset surface is engine presets or Shader scenes.

Track Map is shared by every React engine. Shader Pads intentionally omit React Performance Pads because Shader scenes use an independent scene system.

## Canonical UI components

### Control rows

Use exports from `src/components/vyzualz/react/ReactControlRows.tsx` for normal right-panel controls:

- `SliderRow`
- `NumberInputRow`
- `SelectRow`
- `ToggleRow`
- `TextInputRow`
- `ColorRow`
- `CtrlSection`
- `Collapsible`

Rules:

- Do not create `EngineSlider`, `EngineToggle`, `EngineSelect`, or similar duplicates.
- Add a repeated missing control type to `ReactControlRows.tsx`.
- Keep complex editors, such as shader gradients, texture inputs, timeline timecode, and multi-stop palettes, specialized and scoped.
- Inline CSS variables for slider fill or runtime colors are allowed. Static layout belongs in CSS.

### Preset cards

`src/components/vyzualz/react/ReactPresetCard.tsx` is the shared engine-preset card.

It is used by standard React presets and Beam Matrix presets and supports:

- Active, modified, and favorite state.
- Thumbnails.
- Chips and palettes.
- Expanded details.
- Secondary actions.
- Keyboard grid navigation.

Rules:

- Route new engine preset collections through `ReactPresetsPanel` or reuse `ReactPresetCard`.
- Shader scene cards remain a separate library/editor concept and must not become the general preset language.
- Presets are complete visual recipes. Small parameter changes normally belong in DESIGN or REACT.

### Searchable libraries

Use the existing media search pattern for library surfaces:

- `.vz-md-search-wrap`
- `.vz-md-search-icon`
- `.vz-md-search-input`
- `.vz-md-search-clear`

This pattern is for browsers and libraries, not ordinary control rows.

### Source card selectors

Use `.rv-sound-source-grid`, `.rv-sound-source-card`, and `.is-active` for visual source-card choices. Use `SelectRow` for normal dropdown behavior.

### Buttons and action groups

Prefer existing classes:

- `.rv-reset-btn`
- `.rv-glyph-upload-btn`
- `.rv-glyph-upload-btn--danger`
- `.vz-btn`
- `.vz-btn-ghost`

Repeated action layouts should receive a shared CSS class or component. Do not use static `style={{ flex: 1 }}` or margin styles to assemble ordinary action rows.

## Media and Brand Kit contract

The app-wide media system is authoritative:

- `MediaDeckPanel` wraps `MediaLibraryBrowser` for React View.
- Media capabilities determine which assets are selectable.
- CANVAS uses the shared library and its CANVAS capability contract.
- PixGrid accepts compatible still images and SVG through the shared library.
- Sound Drawing uses compatible SVG media through the shared library.

Rules:

- Do not create an engine-only upload bucket.
- Do not persist decoded pixels, `ImageBitmap`, object URLs, GPU textures, or large media blobs.
- Keep legacy session media cards only for compatibility cleanup.
- Brand Kit integration must use the personalization store, effective-palette helpers, branded preset resolver, and active overlay flow. Do not fork engine-specific brand ownership without a documented capability reason.

See [`docs/brand-kit.md`](docs/brand-kit.md).

## Musical-time and analysis authority

Music Intelligence and loaded-track analysis own audio features and structural analysis. Shared Performance Core owns the authoritative performance context used by engine programs.

Rules:

- Do not add an engine-local beat grid, section detector, phrase clock, or replacement transport.
- Engine programs interpret shared context and emit engine-specific actions.
- Seeking, looping, track replacement, analysis replacement, and timing discontinuities must reset or reconstruct volatile runtime state deterministically.
- Per-frame simulation and renderer state must not live in Zustand.
- High-frequency consumers should read frame data without creating React render loops.

See:

- [`docs/music-intelligence.md`](docs/music-intelligence.md)
- [`docs/loaded-audio-analysis.md`](docs/loaded-audio-analysis.md)
- [`docs/shared-performance-core.md`](docs/shared-performance-core.md)

## Rendering and lifecycle contract

Every live renderer must define:

- Mount and disposal ownership.
- Canvas or WebGL context-loss behavior.
- Bounded retry or fallback behavior.
- Quality-tier behavior.
- Track, preset, and engine-switch reset boundaries.
- Deterministic seek and loop behavior.
- Thumbnail or preview isolation.
- Output-canvas publication for recording.

Rules:

- A renderer must not subscribe to Zustand inside its animation loop.
- A renderer must not create a second audio-analysis path.
- Canvas2D and WebGL paths for the same engine must consume the same resolved semantic frame.
- Preview and thumbnail renderers must not mutate live production output or live renderer state.
- Transient buffers, textures, workers, observers, animation frames, timers, and object URLs must be disposed by their owner.

## Persistence contract

Persist authored state and user preferences, not volatile runtime state.

Current application preferences persist:

- Appearance theme (`dark`, `light`, or `cdj`) uses a local-first cache and authenticated Supabase reconciliation.

Current React workspace preferences persist:

- Left rail collapsed.
- Right rail collapsed.
- Lower workspace collapsed.
- Track Map versus Performance Pads.
- Preferred left tab, subject to active-engine availability.

The right-rail top-level destination persists separately.

Do not persist:

- Stage Focus.
- Per-frame diagnostics.
- Active envelopes.
- WebGL lifecycle state.
- Output arming, heartbeat, emergency blackout, or network runtime state.
- Decoded media or renderer caches.

All persisted input must pass through current normalizers and migrations before use.

## Styling contract

### Static layout belongs in CSS

Do not use inline styles for static:

- Margin, gap, padding, or flex layout.
- Width or height that is not measured or renderer-driven.
- Border and active-state background.
- Opacity, font size, or fixed semantic color.

Inline styles are allowed for:

- Runtime CSS variables.
- User-selected colors and palette swatches.
- Canvas or WebGL dimensions.
- Measured positions.
- Timeline geometry.
- Dynamic transforms required by rendering.

### Reuse existing tokens

Prefer existing variables and established palette values in `src/styles/reactView.css` and `src/styles/vyzualz.css`. Do not create a one-feature color language.

### Selected states

Reuse existing state classes:

- `.rv-preset-card--active`
- `.rv-preset-mode-chip--active`
- `.is-active`
- `.rv-ctrl-toggle--on`
- Existing active tab classes

## Current implementation audit

### Resolved and now canonical

The following items were previously listed as future cleanup and are now implemented:

- Shared `ReactPresetCard`.
- Beam Matrix conversion to the shared preset card.
- Beam Matrix filter/search class cleanup.
- Shared `ColorRow`.
- Track Map inline intensity-row cleanup.
- Duplicate preset fallback-glow selector cleanup.
- Trigger timing controls no longer use the old timing input classes.

Do not reintroduce these items as future work.

### Remaining bounded cleanup opportunities

| Area | Current state | Contract direction |
| --- | --- | --- |
| Sound Drawing timeline active toggle | A compact manual toggle remains in `SoundDrawingTimelineLane.tsx`. | Keep it timeline-scoped or add a deliberate compact variant to `ToggleRow`; do not copy it into right panels. |
| Static inline layout | Small static margins and flex layouts remain in `ReactModulationPanel.tsx`, `FontLibraryPanel.tsx`, and `output/ProductionOutputPanel.tsx`. | Move static layout into named CSS classes when those files are next touched. Preserve runtime geometry and user-color inline styles. |
| Show Director fixed color fields | Simple raw color inputs remain inside a specialized fixture inspector. | Reuse `ColorRow` where the layout is a normal row; keep genuinely compound fixture color editors specialized. |
| Dead timing CSS | `.rv-timing-num-input` and `.rv-timing-bars-input` remain in `reactView.css` without TSX consumers. | Remove after confirming no compatibility or dynamically generated markup depends on them. |
| CANVAS legacy media cards | Compatibility cards remain for session media. | Do not use them as the primary media selection path. |
| Specialized editors | Shader gradients, shader textures, timeline time fields, scene cards, and Track Map forms use scoped systems. | Keep them specialized. Do not promote them into general engine controls. |

## Documentation contract

Any patch that changes one of these boundaries must update its canonical documentation in the same patch:

- React shell or workspace composition: `docs/react-view-architecture.md`
- Engine behavior: the engine's current architecture document
- Music Intelligence or analysis authority: `docs/music-intelligence.md` or `docs/loaded-audio-analysis.md`
- Shared performance behavior: `docs/shared-performance-core.md`
- Recording or production output: `docs/react-recording-and-output.md`
- Brand Kit: `docs/brand-kit.md`
- Verification scripts, Node baseline, or CI: `docs/verification.md`
- Source packaging: `docs/source-packaging.md`

Historical patch records should remain historical. Add a correction note or update the documentation index instead of rewriting history unless the record itself contains a broken link that prevents use.

## Future patch response contract

A DRMVYZ implementation response must state:

- Existing components and patterns reused.
- Files changed.
- Whether layout, styling, state, rendering, dependencies, storage, migrations, or output behavior changed.
- Validation commands actually run and their result.
- Validation that could not be completed.
- Any new UI pattern and why the native patterns could not support it.
- Whether normal center-stage playback remains output-only and whether any authoring overlay changed.
- Whether existing media, preset, engine, Music Intelligence, Shared Performance, and persistence architecture were reused.

When the repository is available, inspect it. Do not answer with conditional architecture guesses.

## Reusable prompt preamble

```text
Before implementing, read and follow AI_IMPLEMENTATION_CONTRACT.md and docs/documentation-index.md.

Inspect the current React View shell, engine catalog, workspace composition, controls, media flow, preset flow, stores, renderers, Music Intelligence, Shared Performance, persistence, output, tests, and styling before coding. Reuse existing DRMVYZ components and contracts first. Do not create parallel UI systems, upload flows, engine registries, timing authorities, renderer state, or center-stage setup UI.

If the request conflicts with a current DRMVYZ contract, use the canonical architecture and explain the conflict.

Return one single downloadable Git-compatible .patch file.
```

## Sound Drawing control ownership and preset provenance

Sound Drawing manual/program/lock ownership must be derived through `src/components/vyzualz/react/soundDrawing/SoundDrawingOwnership.ts`. Do not add scattered `autoPerformance` disable rules. Controls are disabled only when their domain resolves to Program or Unavailable; Locked and Mixed controls remain editable and must explain their resolved ownership through accessible descriptions.

Pro Scope uses `pathScale` as the primary **Trace Size** presentation control. `gainX` and `gainY` remain independent, smoothed signal-domain **Post Auto-Gain Trim** values with explicit link metadata. Trigger Stability is a macro over independent Continuity and Period Assist costs and must not collapse the runtime algorithms.

Scope and generic React preset IDs are stable provenance. Exact/Modified/Custom/Unknown Legacy status is derived by comparison and must survive manual edits, Track Map changes, automation, persistence, seek, and reset. Never clear stable preset IDs merely to display a modified state.

Trail lock behavior follows the versioned contract in [`docs/sound-drawing-control-ownership-and-provenance.md`](docs/sound-drawing-control-ownership-and-provenance.md). Historical recipe locks are preserved and truthfully labeled; new manual trail protection owns the final Trail Decay composition step.
