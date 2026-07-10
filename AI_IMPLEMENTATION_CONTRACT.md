# DRMVYZ React View UI Audit and AI Implementation Contract

## Purpose

This file is a repo-native styling and implementation guardrail for future DRMVYZ React View work. Its job is to stop style drift, duplicate component systems, isolated feature islands, and accidental layout violations.

The core rule is simple:

> If DRMVYZ already has a component, layout pattern, store pattern, media flow, preset flow, or renderer pattern, future enhancements must reuse that first.

Do not invent a new slider, toggle, dropdown, preset card, media picker, rail layout, upload flow, or visual output wrapper unless the existing repo has been inspected and there is no appropriate native pattern.

---

## Required pre-coding process for future AI edits

Before implementing any DRMVYZ React View change, inspect these files first when relevant:

- `src/components/vyzualz/react/ReactView.tsx`
- `src/components/vyzualz/react/ReactControlRows.tsx`
- `src/components/vyzualz/react/ReactEnginePanel.tsx`
- `src/components/vyzualz/react/ReactFxPanel.tsx`
- `src/components/vyzualz/react/ReactPresetsPanel.tsx`
- `src/components/vyzualz/react/ReactCanvasEngineShell.tsx`
- `src/components/vyzualz/react/ReactWorkspacePanels.tsx`
- `src/components/vyzualz/react/ReactEngineBrowser.tsx`
- `src/components/vyzualz/media/MediaDeckPanel.tsx`
- `src/components/vyzualz/media/MediaLibraryBrowser.tsx`
- `src/components/vyzualz/MediaUploadModal.tsx`
- `src/stores/reactStore.ts`
- `src/stores/mediaStore.ts`
- `src/styles/reactView.css`
- `src/styles/vyzualz.css`

For rendering or visual effects, also inspect:

- `src/components/vyzualz/react/ReactShaderCanvas.tsx`
- `src/components/vyzualz/react/shaders/runtime/ShaderWebGLRuntime.ts`
- `src/components/vyzualz/react/renderers/CinematicPortalRenderer.ts`
- `src/components/vyzualz/react/renderers/CinematicWorldRenderer.ts`
- `src/components/vyzualz/react/renderers/cinematic/CinematicWebGLRuntime.ts`
- `src/components/vyzualz/react/renderers/cinematic/worlds/*`
- `package.json`

Never assume a renderer, dependency, component, or store exists. Confirm it from the repo.

---

## React View layout contract

### Header

Location:

- `src/components/vyzualz/react/ReactView.tsx`
- `src/styles/vyzualz.css`
- `src/styles/reactView.css`

Native pattern:

- Header uses `.vz-header`, `.vz-header-left`, `.vz-header-right`, `.vz-title`, `.vz-subtitle`.
- Header select/input styling may use `.az-select` inside `.vz-input-group`.

Rules:

- Do not place engine-specific control stacks in the header.
- Use the header only for high-level status, source selection, collapse controls, and global React View context.

### Left rail

Location:

- `src/components/vyzualz/react/ReactView.tsx`
- `src/components/vyzualz/layout/WorkspaceRail.tsx`
- `src/components/vyzualz/layout/RailTabs.tsx`
- `src/components/vyzualz/media/MediaDeckPanel.tsx`
- `src/components/vyzualz/media/MediaLibraryBrowser.tsx`

Native pattern:

- Left rail is a `WorkspaceRail` with `side="left"`.
- Left rail tabs use `RailTabs` and `.vz-panel-tabs`.
- Left rail is for engine/source/library selection, media decks, laser layers, fonts, and setup browsing.

Rules:

- Source selection belongs here.
- Media browsing belongs here.
- Library/upload entry points belong here or in existing media flows, not over the visualizer.
- Do not create new left rail tab markup unless `RailTabs` cannot support it.

### Center visualizer

Location:

- `src/components/vyzualz/react/ReactView.tsx`
- `src/components/vyzualz/react/ReactShaderCanvas.tsx`
- `src/components/vyzualz/react/CanvasEngineSurface.tsx`
- `src/components/vyzualz/react/ReactPlaceholderCanvas.tsx`

Native pattern:

- Center is render-only output.
- It can host renderer surfaces and output overlays that are part of the visual performance.

Rules:

- Do not put upload UI, media library UI, setup cards, or right-panel controls over the center visualizer.
- Empty states are allowed only when they describe the missing render input and do not become a control panel.
- If a visual effect needs controls, place them in the right rail.
- If a visual effect needs source selection, place it in the left rail.

### Right rail

Location:

- `src/components/vyzualz/react/ReactView.tsx`
- `src/components/vyzualz/react/ReactWorkspacePanels.tsx`
- `src/components/vyzualz/react/ReactPresetsPanel.tsx`
- `src/components/vyzualz/react/ReactFxPanel.tsx`
- `src/components/vyzualz/react/ReactInspectorPanel.tsx`

Native pattern:

- Right rail is a `WorkspaceRail` with `side="right"`.
- Top-level rail tabs use `RailTabs` and `.vz-panel-tabs`.
- Right rail content uses `.rv-workspace-panel`, `.rv-workspace-panel-body`, `.rv-inspector`, and `.rv-inspector-scroll`.
- Control groups use `.rv-ctrl-group` and components from `ReactControlRows.tsx`.

Rules:

- Controls, FX, parameters, presets, output settings, and inspector panels belong here.
- Do not use one-off local sliders, toggles, number inputs, or selects for normal engine controls.
- Use `SliderRow`, `NumberInputRow`, `SelectRow`, `ToggleRow`, `TextInputRow`, `CtrlSection`, and `Collapsible`.

### Lower workspace and bottom dock

Location:

- `src/components/vyzualz/react/ReactView.tsx`
- `src/components/vyzualz/react/ReactTrackMapStrip.tsx`
- `src/components/vyzualz/react/SoundDrawingTimelineLane.tsx`
- `src/components/vyzualz/VyzualzAudioDock.tsx`

Native pattern:

- Lower workspace is for track maps, timeline lanes, and performance pads.
- Bottom dock is for audio transport and waveform/track controls.

Rules:

- Timeline editing may use compact editor-specific controls.
- Do not copy timeline-specific `.rv-form-*` or `.rv-sd-*` controls into right-panel engine controls.

---

## Canonical UI components

### Control rows

Location:

- `src/components/vyzualz/react/ReactControlRows.tsx`
- `src/styles/reactView.css`

Exports:

- `SliderRow`
- `NumberInputRow`
- `SelectRow`
- `ToggleRow`
- `TextInputRow`
- `CtrlSection`
- `Collapsible`

Standard classes:

- `.rv-ctrl-group`
- `.rv-ctrl-row`
- `.rv-ctrl-label`
- `.rv-ctrl-slider-hdr`
- `.rv-ctrl-val`
- `.rv-ctrl-slider`
- `.rv-ctrl-select`
- `.rv-ctrl-text-input`
- `.rv-ctrl-number-field`
- `.rv-ctrl-number-unit`
- `.rv-ctrl-toggle-row`
- `.rv-ctrl-toggle-line`
- `.rv-ctrl-toggle`
- `.rv-ctrl-toggle--on`
- `.rv-ctrl-section-label`
- `.rv-ctrl-collapsible`
- `.rv-ctrl-collapsible-hdr`
- `.rv-ctrl-collapsible-body`
- `.rv-ctrl-info`

Rules:

- Use these components for all normal right-panel controls.
- Do not create `EngineSlider`, `EngineToggle`, `EngineSelect`, or similar duplicates.
- If a missing control type repeats in multiple files, add it to `ReactControlRows.tsx` rather than creating multiple local one-offs.
- Good candidates for future additions: `TextareaRow`, `ColorRow`, and possibly `ActionRow`.

### Rails and tabs

Locations:

- `src/components/vyzualz/layout/WorkspaceRail.tsx`
- `src/components/vyzualz/layout/RailTabs.tsx`
- `src/components/vyzualz/react/ReactWorkspacePanels.tsx`

Standard classes:

- `.vz-inspector`
- `.vz-inspector--left`
- `.vz-inspector--right`
- `.vz-inspector-toggle`
- `.vz-inspector-inner`
- `.vz-panel-tabs`
- `.rv-right-subtabs`

Rules:

- Use `WorkspaceRail` for collapsible side rails.
- Use `RailTabs` for top-level rail tabs.
- Use the `PanelSubtabs` pattern in `ReactWorkspacePanels.tsx` for sub-tabs inside the right rail.
- Do not create custom pill/tab bars unless the existing rail/sub-tab patterns do not fit.

### Media and source selection

Locations:

- `src/components/vyzualz/media/MediaDeckPanel.tsx`
- `src/components/vyzualz/media/MediaLibraryBrowser.tsx`
- `src/components/vyzualz/MediaUploadModal.tsx`
- `src/stores/mediaStore.ts`
- `src/components/vyzualz/react/ReactCanvasEngineShell.tsx`

Native pattern:

- App-wide media library and browser exist.
- `MediaDeckPanel` wraps `MediaLibraryBrowser` for React View.
- `MediaLibraryBrowser` already supports context modes including `react` and `canvas`.
- CANVAS-specific capabilities already exist via `CANVAS_MEDIA_LIBRARY_CAPABILITIES`.

Rules:

- Do not create a separate CANVAS-only upload bucket.
- Do not store large media blobs in localStorage.
- Do not place upload/library UI over the center visualizer.
- Use `MediaLibraryBrowser` or extend its capabilities when the feature needs media selection.
- Legacy session media cards may remain only for legacy cleanup or compatibility, not as the primary new media UX.

### Presets

Locations:

- `src/components/vyzualz/react/ReactPresetsPanel.tsx`
- `src/components/vyzualz/react/ReactPresetBrowser.tsx`
- `src/components/vyzualz/react/ReactPresetThumbnail.tsx`
- `src/components/vyzualz/react/LaserDmxBeamMatrixPresetBrowser.tsx`

Native pattern:

- `ReactPresetsPanel.tsx` has the strongest standard preset card pattern.
- It uses `.rv-preset-card`, `.rv-preset-card--active`, `.rv-preset-card--with-thumb`, `.rv-preset-card-layout`, `.rv-preset-card-content`, `.rv-preset-chip-row`, `.rv-preset-mode-chip`, `.rv-preset-desc`, `.rv-preset-palette`, and preset thumbnail classes.
- CANVAS presets already reuse this local `PresetCard` through `CanvasPresetCollection`.

Rules:

- Do not create custom preset card styling for CANVAS or new engines.
- If a new engine needs preset cards, either route it through `ReactPresetsPanel` or extract the local `PresetCard` into a shared `ReactPresetCard.tsx`.
- Presets should be complete visual recipes that apply parameter bundles.
- Small effects should usually be right-panel controls, not tiny one-effect preset buttons.

### Source card selectors

Location:

- `src/components/vyzualz/react/ReactEnginePanel.tsx`

Native pattern:

- Sound Drawing source selection uses `.rv-sound-source-grid`, `.rv-sound-source-card`, and `.is-active`.

Rules:

- Use this pattern for engine source card grids.
- Do not use this pattern for normal dropdowns.
- Normal single-choice controls should be `SelectRow`.

### Buttons and action rows

Common classes observed:

- `.rv-reset-btn`
- `.rv-glyph-upload-btn`
- `.rv-glyph-upload-btn--danger`
- `.vz-btn`
- `.vz-btn-ghost`

Rules:

- Prefer existing button classes.
- Do not use static inline button layout styles like `style={{ flex: 1 }}`.
- If a button row pattern repeats, add a shared class or small action row component.

---

## Current React View UI drift audit

The following items differ from the standard control, preset, media, or layout patterns. Some are acceptable specialized editors. Others are good cleanup candidates.

| Area | Location | Current UI | Difference from standard | Recommendation |
|---|---|---|---|---|
| Beam Matrix preset cards | `src/components/vyzualz/react/LaserDmxBeamMatrixPresetBrowser.tsx` | Local `PresetCard` uses `.rv-preset-card` plus many inline styles, custom chip rows, and `.rv-glyph-upload-btn` actions. | It does not reuse the stronger `ReactPresetsPanel` preset card structure. Inline layout styles make it easier to drift. | Extract `ReactPresetsPanel` local `PresetCard` into shared `ReactPresetCard.tsx`, then convert Beam Matrix presets to use it or mirror its class structure with no inline layout styles. |
| Beam Matrix filters | `src/components/vyzualz/react/LaserDmxBeamMatrixPresetBrowser.tsx` | Category/tag chips use `rv-preset-mode-chip` with inline cursor, border, and active background styles. | Active state is partly CSS class and partly inline styles. | Move active and clickable chip styling into CSS, such as `.rv-preset-mode-chip--active` and `.rv-preset-mode-chip--button`. |
| Beam Matrix search spacing | `src/components/vyzualz/react/LaserDmxBeamMatrixPresetBrowser.tsx` | Search wrapper uses `style={{ marginBottom: 6 }}`. | Static spacing should live in CSS. | Add a class like `.rv-bm-preset-search` and move spacing into `reactView.css`. |
| Trigger timing inputs | `src/components/vyzualz/react/ReactModulationPanel.tsx` | Uses `.rv-timing-num-input` and `.rv-timing-bars-input`. | Duplicates `NumberInputRow` and `TextInputRow` for normal-looking inputs. | Replace simple rows with `NumberInputRow` and `TextInputRow` where possible. If timing parsing/commit behavior requires custom inputs, create a reusable `TimingNumberRow` instead of scattered raw inputs. |
| Sound Drawing timeline active toggle | `src/components/vyzualz/react/SoundDrawingTimelineLane.tsx` | Manually builds `.rv-ctrl-row` with `.rv-ctrl-toggle`. | Standard toggle rows use `ToggleRow`, `.rv-ctrl-toggle-row`, and `.rv-ctrl-toggle-line`. | Replace with `ToggleRow` unless timeline layout requires a compact variant. If compact is needed, add a `compact` option to `ToggleRow`. |
| Sound Drawing timeline time fields | `src/components/vyzualz/react/SoundDrawingTimelineLane.tsx` | Manual time fields use `.rv-ctrl-text-input rv-ctrl-text-input--time`. | Not using `TextInputRow`. | Acceptable for timeline timecode inputs because they parse/commit on blur and Enter. Do not copy this pattern into right-panel engine controls. |
| Sound Drawing multiline text | `src/components/vyzualz/react/SoundDrawingTimelineLane.tsx` | Uses `.rv-sd-textarea`. | No standard `TextareaRow` exists. | If multiline text recurs, add `TextareaRow` to `ReactControlRows.tsx`. Until then, keep `.rv-sd-textarea` scoped to Sound Drawing timeline. |
| Track Map edit forms | `src/components/vyzualz/react/ReactTrackMapStrip.tsx` | Uses `.rv-form-row`, `.rv-form-label`, `.rv-form-select`, `.rv-form-input`, `.rv-form-range`, `.rv-form-actions`. | This is a separate form system from `ReactControlRows`. | Acceptable for timeline/track-map editing. Do not copy `.rv-form-*` into right-panel engine controls. For future right-panel forms, use `ReactControlRows`. |
| Track Map inline intensity row | `src/components/vyzualz/react/ReactTrackMapStrip.tsx` | Uses static inline flex style in the section edit form. | Static layout is inline instead of CSS. | Move to a class in `reactView.css`, such as `.rv-form-range-row`. |
| Timeline lane select | `src/components/vyzualz/react/ReactTrackMapStrip.tsx` | Uses `.rv-timeline-lane-select`. | Separate from `.rv-ctrl-select`. | Acceptable for dense timeline lane controls. Do not copy to right rail. |
| Font preview input | `src/components/vyzualz/react/FontLibraryPanel.tsx` | Uses `.rv-font-preview-input`. | Custom input rather than `TextInputRow` or `.rv-ctrl-text-input`. | Acceptable if it is intentionally larger for font preview. If it behaves like a normal text control, switch to `TextInputRow` or at least reuse `.rv-ctrl-text-input`. |
| Font search input | `src/components/vyzualz/react/FontLibraryPanel.tsx` | Uses media-deck search classes `vz-md-search-input`. | Search components are not in `ReactControlRows`. | Acceptable for library/search surfaces. Use the media deck search pattern consistently for searchable libraries. |
| Show Director color fields | `src/components/vyzualz/react/LaserDmxShowDirectorInspector.tsx` | Raw `input type="color"` inside `.rv-show-director-color-field`. | No shared color control exists. | If color inputs recur, add `ColorRow` to `ReactControlRows.tsx`. Until then, keep this scoped to Show Director. |
| Show Director palette search | `src/components/vyzualz/react/LaserDmxShowDirectorPalette.tsx` | Uses `.rv-show-director-search` and raw search input. | Not using media deck search or `TextInputRow`. | Acceptable because it is a specialized component palette. Do not copy to engine controls. |
| Shader color control | `src/components/vyzualz/react/shaders/ShaderColorControl.tsx` | Raw color input plus alpha slider. | Specialized color editor rather than standard rows. | Acceptable for shader parameters. If generic color rows are needed, extract a shared `ColorRow`. |
| Shader gradient control | `src/components/vyzualz/react/shaders/ShaderGradientControl.tsx` | Custom stop list, raw range inputs, color buttons. | Complex editor, not standard control rows. | Acceptable as a specialized shader editor. Do not use this for normal sliders or color toggles. |
| Shader texture input | `src/components/vyzualz/react/shaders/ShaderTextureInputControl.tsx` | Uses custom texture row with badge/clear action and a standard select class. | More complex than a simple `SelectRow`. | Acceptable for texture inputs. Extract only if more texture controls appear. |
| Shader library search and category select | `src/components/vyzualz/react/ShaderLibraryPanel.tsx` | Uses `.rv-ctrl-text-input rv-shader-library-search-input` and raw `.rv-ctrl-select rv-shader-library-cat`. | Uses standard classes but not row components. | Acceptable for compact search/filter header. Keep search/filter surfaces consistent. |
| Shader scene cards | `src/components/vyzualz/react/ShaderLibraryPanel.tsx` | Uses `.rv-shader-scene-card`. | Different from preset cards. | Acceptable because shader scenes are a library/editor concept, not general engine presets. Do not reuse for normal presets. |
| Shader code editor | `src/components/vyzualz/react/ShaderCodeEditor.tsx` | Uses custom tabs, code textareas, editor name input. | Specialized editor UI. | Acceptable. Do not use shader editor tab styles for main rail tabs. |
| CANVAS legacy session media cards | `src/components/vyzualz/react/ReactCanvasEngineShell.tsx` | Uses `.rv-canvas-media-card` for `canvasMediaItems`. | Separate card style from `MediaLibraryBrowser`. | Keep only for legacy session media cleanup. New CANVAS media selection should use `MediaLibraryBrowser`. |
| CANVAS section trigger chips | `src/components/vyzualz/react/ReactCanvasEngineShell.tsx` | Uses `.rv-canvas-section-trigger-chip`. | Custom multi-select pill group. | Acceptable for multi-select section triggers. Do not use this as a replacement for dropdowns or toggles. |
| CANVAS reset/action row | `src/components/vyzualz/react/ReactCanvasEngineShell.tsx` | Uses manual `.rv-ctrl-toggle-line` with `.rv-reset-btn`. | Not a reusable action row. | Acceptable locally. If action rows recur, add `ActionRow` or a standard `.rv-ctrl-action-row`. |
| Inline static styles | Multiple files, especially `LaserDmxBeamMatrixPresetBrowser.tsx`, `ReactTrackMapStrip.tsx`, and small places in `ReactEnginePanel.tsx` | Uses inline layout styles for margins, flex, chip color, and widths. | Static styling should be CSS classes, not inline. | Move static layout and active-state styling into `reactView.css`. Reserve inline styles for dynamic CSS variables, canvas coordinates, measured transforms, and user-selected colors. |
| CSS duplicate selector | `src/styles/reactView.css` around the preset thumbnail fallback glow block | Duplicate `.rv-preset-thumb-fallback-glow {` appears near the same selector block. | Likely accidental CSS duplication or malformed block. | Verify and clean up the duplicate selector before large preset styling work. |

---

## Native patterns to reuse by feature type

### Adding a normal right-panel control

Use:

- `SliderRow`
- `NumberInputRow`
- `SelectRow`
- `ToggleRow`
- `TextInputRow`
- `CtrlSection`
- `Collapsible`

Do not use:

- Local `input type="range"`
- Local `select`
- Local toggle buttons
- Inline label/value layouts
- New CSS for one-off slider, toggle, or select rows

### Adding a preset or preset browser

Use one of these approaches:

1. Route the new preset collection through `ReactPresetsPanel.tsx`.
2. Extract the local `PresetCard` from `ReactPresetsPanel.tsx` into `ReactPresetCard.tsx` and reuse it.
3. Reuse the same class structure if extraction is not part of the patch scope.

Do not create a new card language for engine presets.

### Adding media/source selection

Use:

- `MediaDeckPanel`
- `MediaLibraryBrowser`
- existing media store records
- existing media thumbnails, filters, capabilities, and upload modal flows

Do not:

- Add upload UI to the visualizer surface
- Store large media blobs in localStorage
- Create isolated media records when the app-wide library can be used

### Adding a source card grid

Use the Sound Drawing source grid pattern:

- `.rv-sound-source-grid`
- `.rv-sound-source-card`
- `.is-active`

Only use this for visual card choices. Use `SelectRow` for normal dropdown behavior.

### Adding a searchable library

Prefer the existing media deck search pattern:

- `.vz-md-search-wrap`
- `.vz-md-search-icon`
- `.vz-md-search-input`
- `.vz-md-search-clear`

This is appropriate for libraries and browsers. It is not a replacement for `TextInputRow` in a control panel.

### Adding color controls

Current state:

- Color controls exist, but they are specialized in Show Director and shader components.
- There is no generic `ColorRow` in `ReactControlRows.tsx`.

Rule:

- If only one specialized color editor is needed, keep it scoped.
- If color picking appears in multiple engines or panels, add `ColorRow` to `ReactControlRows.tsx` and update repeated local color inputs.

### Adding multiline text

Current state:

- Timeline text uses `.rv-sd-textarea`.
- There is no generic `TextareaRow`.

Rule:

- If multiline fields appear in more than one panel, add `TextareaRow` to `ReactControlRows.tsx`.

---

## Styling rules

### No static inline layout styles

Do not use inline styles for static layout values like:

- margin
- gap
- flex direction
- width
- border
- background for active states
- opacity
- font size

Use CSS classes in `src/styles/reactView.css`.

Inline styles are allowed for:

- CSS variables based on runtime values
- user-selected colors
- canvas or WebGL render dimensions
- measured element positions
- dynamic transforms required by render logic

### Use existing tokens and variables

Observed palette and variable patterns include:

- Cyan/accent: `#4ac7db`
- Emerald/secondary accent: `#61d6aa`
- Deep background: `#060d10`
- Primary text: `#e8f4f8`
- Muted text: `rgba(232, 244, 248, 0.6)` and similar
- Gold/yellow section color: `#d8b95a`
- Danger/red: `#c0314a`
- Purple/reactive accent: `#b84fc9`
- Control height variable: `--ui-control-height`
- Control radius variable: `--ui-control-radius`

Rules:

- Prefer existing CSS variables and rgba patterns.
- Do not introduce a new color palette for one feature.
- If a new state color is needed, add it once as a variable or consistent CSS class.

### Use existing selected states

Use these before inventing new ones:

- `.rv-preset-card--active`
- `.rv-preset-mode-chip--active`
- `.is-active`
- `.rv-ctrl-toggle--on`
- `.vz-panel-tab.active` or existing tab active classes

---

## Recommended cleanup sequence

These are not required for every future patch, but they are the highest-value cleanup items found in the current audit.

1. Extract `ReactPresetCard.tsx` from the local `PresetCard` inside `ReactPresetsPanel.tsx`.
2. Convert `LaserDmxBeamMatrixPresetBrowser.tsx` to use the shared preset card or match its class structure without inline styles.
3. Replace the manual active toggle in `SoundDrawingTimelineLane.tsx` with `ToggleRow`, or add a compact toggle option to `ReactControlRows.tsx`.
4. Replace simple timing inputs in `ReactModulationPanel.tsx` with `NumberInputRow` and `TextInputRow`, or extract a timing-specific row component.
5. Move static inline layout styles from Beam Matrix preset/filter UI and Track Map forms into CSS classes.
6. Add `TextareaRow` to `ReactControlRows.tsx` if multiline text fields expand beyond Sound Drawing timeline.
7. Add `ColorRow` to `ReactControlRows.tsx` if color controls expand beyond specialized shader and Show Director editors.
8. Verify and clean up the duplicate `.rv-preset-thumb-fallback-glow` selector in `src/styles/reactView.css`.
9. Keep `.rv-canvas-media-card` limited to legacy CANVAS session media. New CANVAS source selection should continue through `MediaLibraryBrowser`.

---

## Future patch response contract

When returning any future DRMVYZ patch, the response should state:

- Which existing components and styling patterns were reused.
- Which files were changed.
- Whether the patch changes layout, styling, state, rendering, dependencies, or data/storage.
- What could not be validated locally.
- Whether any new UI pattern was introduced and why it was unavoidable.
- Whether the center visualizer remains render-only.
- Whether the feature reuses existing media, preset, control, and engine architecture.

If the repo is available, do not answer with conditional architecture guesses. Inspect the code first, then answer from the actual files.

---

## Short future prompt preamble

Use this at the top of future implementation prompts:

```text
Before implementing, read and follow DRMVYZ_REACT_VIEW_UI_AUDIT_AND_AI_CONTRACT.md if present.

Inspect the existing React View layout, control components, media flow, preset flow, engine architecture, stores, renderers, and styling before coding. Reuse existing DRMVYZ components and CSS patterns first. Do not create new UI styles, parallel upload flows, isolated engine systems, or center-visualizer setup UI unless the existing repo has no suitable native pattern.

If a requested change conflicts with existing DRMVYZ patterns, choose the DRMVYZ-native pattern and explain the conflict before implementing.

Return one single downloadable .patch file only.
```
