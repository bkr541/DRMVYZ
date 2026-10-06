# Contextual help icons: where each one floats today

**Purpose.** Inventory of every contextual-help icon currently wired into DRMVYZ, so the floating icons can be replaced by a header search that opens a larger technical pop-up. It records exactly which element, group or section each icon floats over, where that is in the app, which help entry it opens, and how the icon is positioned.

**Status.** Sections 1–7 describe the icons **as they were before removal**; file:line references are to the tree before Pass 1. Everything was read from the source, not inferred.

**Pass 1 (done, uncommitted):** every `HelpInfoTrigger` was removed from the 16 product files, together with the props, maps and helpers that only fed them (`CANVAS_REACT_CONTROL_HELP_IDS`, the Fractures role `helpId`s, and several label formatters). The wrapper elements and their CSS were left in place so layout is unchanged. The Layout Lab mockups still use the icon.

**Pass 2 (not started), once the header search exists:**
- Remove `drm-help-overlay-anchor` and the per-surface offset CSS (`InfoPopover.css`, `reactView.css`, `vyzualz.css`).
- Delete `HelpInfoTrigger` / `HelpLabel` and update the Layout Lab mockups and `HelpInfoTrigger.test.tsx`.
- Collapse wrappers that no longer do anything: `CanvasHelpControl` is now a plain wrapper div, and `getLowerSurfaceHelpId` in `ReactView.tsx` now only decides which lower-workspace tabs get the wrapper class.
- Decide what the Contextual Info setting becomes.

---

## 1. How the system works today

| Piece | What it is | Where |
|---|---|---|
| `HelpInfoTrigger` | The round graduation-cap icon button. Takes a `helpId`, optional current value / status line, and a popover placement. Renders nothing if the ID is missing from the registry or Contextual Info is off. | `src/components/shared/InfoPopover/HelpInfoTrigger.tsx` |
| `InfoPopover` | The small anchored pop-over (376 px wide, max 540 px high) opened by the icon. Shows title, summary and up to five labelled sections: **Current value / Status**, **What it does**, **Range**, **Recommended range**, **When to use**, **Tip**. Only one can be open at a time. | `src/components/shared/InfoPopover/InfoPopover.tsx` |
| Help registry | One bundled TypeScript array of 445 entries (`PRIORITY_ONE_HELP_ENTRIES`), keyed by a dotted `id`. Not loaded from a database. | `src/help/HelpCenter.ts` |
| Contextual Info switch | A user setting, "Contextual Info" in Settings. When off, no icon is rendered anywhere. Saved per user (local cache plus database). | `src/features/contextualHelp/contextualHelpStore.ts`, `settings/SettingsModal.tsx` |
| `drm-help-overlay-anchor` | CSS class on the wrapper element the icon floats over. The icon is `position: absolute` at the wrapper's top-right corner, so it never changes layout. It is **hidden until the wrapper is hovered or keyboard-focused**, or while its pop-over is open. | `InfoPopover.css` lines 434–470 |

**Default placement:** `top: -8px; right: -8px` relative to the wrapper (the icon straddles the wrapper's top-right corner). Each surface overrides two CSS variables, `--drm-help-overlay-top` and `--drm-help-overlay-right`; the exact value for every wrapper class is shown in the tables below as "(top / right)". The two screenshots you sent are the header **Production Output** group (-12 / -9) and the audio dock **left deck card** (-8 / -8).

**Registry fields available per entry:** `id`, `priority`, `view`, `engine`, `group`, `title`, `componentType`, `summary`, `whatItDoes[]`, `whenToUse`, `affects[]`, `doesNotAffect[]`, `defaultValue`, `range`, `recommendedRange`, `tip`, `relatedHelpIds[]`, `tags[]`, `auditMismatch`. The pop-over currently shows only `summary`, `whatItDoes`, `range`, `recommendedRange`, `whenToUse` and `tip`. `affects`, `doesNotAffect`, `defaultValue`, `relatedHelpIds` and `tags` are stored but never displayed.

---

## 2. At a glance

- **151 icon sites** in product code (plus 32 in Layout Lab mockups, which are not product UI). They resolve to **150 distinct help entries**, out of 445 in the registry.
- **295 entries have no icon anywhere**: they exist only as text in `HelpCenter.ts`. Every entry used by a Layout Lab mockup is also used by real UI.
- Surfaces with **no help icons at all** in product code: Cinema 2.0, Cinema (legacy), Headliner, Lyric Manager, Media Manager, and Settings. The Show Manager has icons only through the shared audio dock and the reused PixGrid Design panel.
- One entry is opened from two controls: `drySourceMix` is used by both the "Dry Source Mix" and "Source Visibility" CANVAS sliders.
- Several icons only exist conditionally (a specific engine, preset, authoring mode or media type). The "Where it is in the app" column states the condition.

### Coverage by registry group

| Registry group (`view / engine`) | Entries | With a live icon | No icon anywhere |
|---|---:|---:|---:|
| lyricManager | 39 | 0 | 39 |
| mediaManager | 14 | 0 | 14 |
| react / canvas | 99 | 86 | 13 |
| react / cinematicWorlds | 21 | 0 | 21 |
| react / laserDmx | 7 | 4 | 3 |
| react / laserDmx.beamMatrix | 10 | 9 | 1 |
| react / laserDmx.showDirector | 5 | 4 | 1 |
| react / pixGrid | 47 | 22 | 25 |
| react / shaderPads | 9 | 0 | 9 |
| react / shared | 29 | 7 | 22 |
| react / soundDrawing | 51 | 15 | 36 |
| visualizer | 114 | 3 | 111 |

---

## 3. Inventory of live icons

"Icon floats over" names the element the wrapper encloses (the icon sits at that element's top-right corner). "Anchor class" is the wrapper's CSS class and its (top / right) offset in px. Engine names use the product names; Sound Drawing is `oscilloscope` in code.

### 3.1 App header

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 1 | the **Production Output** group in the header (power / eye / eye-off buttons) | Production Output | `shared.header.productionOutput` | App header | `rv-header-output-help` (-12 / -9) | ReactGlobalOutputControls.tsx:150 |

### 3.2 Left rail

**Workspace tab strip.** One icon per engine, only for these three engines (others have none):

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 2 | the **left-rail workspace tab strip** (Sound Drawing) | Source, Media, and Fonts | `soundDrawing.workspace.tabs` | Left rail · directly under the engine browser, above the tab body | `rv-sound-drawing-workspace-tabs-help` (-7 / -3) | ReactView.tsx:891 |
| 3 | the **left-rail workspace tab strip** (PixGrid) | Setup and Media | `pixGrid.workspace.tabs` | Left rail · directly under the engine browser, above the tab body | `rv-pix-grid-workspace-tabs-help` (-7 / -3) | ReactView.tsx:898 |
| 4 | the **left-rail workspace tab strip** (CANVAS) | CANVAS Source | `canvas.workspace.tabs` | Left rail · directly under the engine browser, above the tab body | `rv-canvas-workspace-tabs-help` (-7 / -3) | ReactView.tsx:905 |

**Sound Drawing setup panel** (left rail):

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 5 | **Auto Performance** toggle | Auto Performance | `soundDrawing.authoredPerformance.autoPerformance` | Left rail · SOURCE tab · Sound Drawing · **Authored Performance** section | `rv-sound-drawing-control-help` (-8 / -5) | ReactEnginePanel.tsx:571 |
| 6 | **Performance Show** dropdown | Performance Show | `soundDrawing.authoredPerformance.performanceShow` | Left rail · SOURCE tab · Sound Drawing · **Authored Performance** section | `rv-sound-drawing-control-help` (-8 / -5) | ReactEnginePanel.tsx:610 |
| 7 | the **Engine Mode** source-type card grid (Classic / Text / SVG / …) | Engine Mode | `soundDrawing.engineMode.overview` | Left rail · SOURCE tab · Sound Drawing · **Engine Mode** section (only while no Performance Show is selected) | `rv-sound-drawing-source-grid-help` (-8 / -5) | ReactEnginePanel.tsx:828 |
| 8 | **Visual Size** slider | Visual Size | `soundDrawing.engineMode.visualSize` | Left rail · SOURCE tab · Sound Drawing · **Engine Mode** section (only while no Performance Show is selected) | `rv-sound-drawing-control-help` (-8 / -5) | ReactEnginePanel.tsx:849 |
| 9 | **Follow Track Sections** toggle | Follow Track Sections | `soundDrawing.engineMode.followTrackSections` | Left rail · SOURCE tab · Sound Drawing · Engine Mode · Classic Scope source (only with Auto Performance off) | `rv-sound-drawing-control-help` (-8 / -5) | ReactEnginePanel.tsx:874 |
| 10 | **Classic Mode** dropdown | Classic Mode | `soundDrawing.engineMode.classicMode` | Left rail · SOURCE tab · Sound Drawing · Engine Mode · Classic Scope source (only when Follow Track Sections is off, or Auto Performance on) | `rv-sound-drawing-control-help` (-8 / -5) | ReactEnginePanel.tsx:908 |

**LaserDMX setup panel** (left rail):

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 11 | the whole **Program** collapsible block (beam/group counts, Add Beam, Dup, Del, Desel, All, Reset Matrix) | Program | `laserDmx.beamMatrix.programAndCanvas.program.overview` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-section-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:124 |
| 12 | **Beam Matrix Design** section/group | Beam Matrix Design | `laserDmx.beamMatrix.programAndCanvas.design.overview` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-section-heading-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:136 |
| 13 | **Show Beam Editor** toggle | Show Beam Editor | `laserDmx.beamMatrix.programAndCanvas.canvas.showBeamEditor` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-control-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:151 |
| 14 | **Snap to Grid** toggle | Snap to Grid | `laserDmx.beamMatrix.programAndCanvas.canvas.snapToGrid` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-control-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:165 |
| 15 | **Show Grid** toggle | Show Grid | `laserDmx.beamMatrix.programAndCanvas.canvas.showGrid` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-control-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:180 |
| 16 | **Show Beam Paths** toggle | Show Beam Paths | `laserDmx.beamMatrix.programAndCanvas.canvas.showBeamPaths` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-control-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:196 |
| 17 | **Overscan** slider | Overscan | `laserDmx.beamMatrix.programAndCanvas.canvas.overscan` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-control-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:214 |
| 18 | **Reaction Groups** section/group | Reaction Groups | `laserDmx.beamMatrix.programAndCanvas.reactionGroups.overview` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-section-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:228 |
| 19 | **Cue List** section/group | Cue List | `laserDmx.beamMatrix.programAndCanvas.cueList.overview` | Left rail · RIG tab · LaserDMX · **Matrix** surface | `rv-laser-section-help` (-8 / -5) | LaserDmxBeamMatrixPanel.tsx:241 |
| 20 | the **Matrix / Show Director** surface tab toolbar | LaserDMX Workspace | `laserDmx.workspace.overview` | Left rail · RIG tab · LaserDMX · top of the panel | `rv-laser-workspace-mode-help` (-8 / -5) | LaserDmxEnginePanel.tsx:34 |

**PixGrid setup panel** (left rail):

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 21 | the **Edit PixGrid / Close PixGrid Edit** toggle button | Edit PixGrid | `pixGrid.authoring.editOverlay` | Left rail · SETUP tab · PixGrid | `rv-pix-grid-authoring-control-help` (-8 / -5) | PixGridAuthoringPanel.tsx:47 |
| 22 | **PixGrid scenes** section/group | Scenes | `pixGrid.authoring.scenes` | Left rail · SETUP tab · PixGrid | `rv-pix-grid-authoring-section-help` (-8 / -5) | PixGridAuthoringPanel.tsx:89 |
| 23 | **PixGrid layers** section/group | Layers | `pixGrid.authoring.layers` | Left rail · SETUP tab · PixGrid | `rv-pix-grid-authoring-section-help` (-8 / -5) | PixGridAuthoringPanel.tsx:124 |
| 24 | **PixGrid built-in artwork** selection list | Built-in Artwork | `pixGrid.authoring.builtIns` | Left rail · SETUP tab · PixGrid | `rv-pix-grid-authoring-section-help` (-8 / -5) | PixGridAuthoringPanel.tsx:144 |

**CANVAS setup panel** (left rail):

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 25 | the **CANVAS Media Library** browser block | CANVAS Media Library | `canvas.source.mediaLibrary` | Left rail · SOURCE tab · CANVAS | `rv-canvas-source-help` (-8 / -5) | ReactCanvasEngineShell.tsx:5002 |

### 3.3 Right rail

**PRESETS tab.** Each icon floats over the whole preset list block of one engine and is only mounted for that engine:

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 26 | the **Sound Drawing preset library** (whole preset list block) | Sound Drawing Presets | `soundDrawing.presetLibrary` | Right rail · **PRESETS** tab | `rv-sound-drawing-presets-help` (-9 / -7) | ReactPresetsPanel.tsx:725 |
| 27 | the **LaserDMX preset library** (whole preset list block) | LaserDMX Presets | `laserDmx.presetLibrary` | Right rail · **PRESETS** tab | `rv-laser-presets-help` (-8 / -7) | ReactPresetsPanel.tsx:735 |
| 28 | the **PixGrid preset library** (whole preset list block) | PixGrid Presets | `pixGrid.presetLibrary` | Right rail · **PRESETS** tab | `rv-pix-grid-presets-help` (-8 / -7) | ReactPresetsPanel.tsx:745 |
| 29 | the **CANVAS preset library** (whole preset list block) | CANVAS Presets | `canvas.presetLibrary` | Right rail · **PRESETS** tab | `rv-canvas-presets-help` (-8 / -7) | ReactPresetsPanel.tsx:755 |

**DESIGN tab:**

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 30 | **Performance Program** toggle | Performance Program | `laserDmx.showDirector.performanceProgram.enabled` | Right rail · **DESIGN** tab · LaserDMX · Show Director authoring mode · **Performance Program** | `rv-laser-performance-control-help` (-8 / -7) | LaserDmxShowDirectorControls.tsx:261 |
| 31 | **Program Intensity** slider | Program Intensity | `laserDmx.showDirector.performanceProgram.programIntensity` | Right rail · **DESIGN** tab · LaserDMX · Show Director authoring mode · **Performance Program** | `rv-laser-performance-control-help` (-8 / -7) | LaserDmxShowDirectorControls.tsx:279 |
| 32 | **Variation Amount** slider | Variation Amount | `laserDmx.showDirector.performanceProgram.variationAmount` | Right rail · **DESIGN** tab · LaserDMX · Show Director authoring mode · **Performance Program** | `rv-laser-performance-control-help` (-8 / -7) | LaserDmxShowDirectorControls.tsx:295 |
| 33 | **Audio Intelligence Response** toggle | Audio Intelligence Response | `laserDmx.showDirector.performanceProgram.audioIntelligenceResponse` | Right rail · **DESIGN** tab · LaserDMX · Show Director authoring mode · **Performance Program** | `rv-laser-performance-control-help` (-8 / -7) | LaserDmxShowDirectorControls.tsx:308 |
| 34 | **Active Scene** dropdown | Active Scene | `pixGrid.design.editingContext.activeScene` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:147 |
| 35 | **Edit Target** dropdown | Edit Target | `pixGrid.design.editingContext.editTarget` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:166 |
| 36 | the **Grid Quality** control | Grid Quality | `pixGrid.design.grid.quality` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:184 |
| 37 | **Cell Gap** slider | Cell Gap | `pixGrid.design.grid.cellGap` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:193 |
| 38 | **Cell Roundness** slider | Cell Roundness | `pixGrid.design.grid.cellRoundness` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:201 |
| 39 | **Glow** slider | Glow | `pixGrid.performanceAndMatrix.ledMatrix.glow` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:210 |
| 40 | **Diffusion** slider | Diffusion | `pixGrid.performanceAndMatrix.ledMatrix.diffusion` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:218 |
| 41 | **RGB Subpixels** toggle | RGB Subpixel Mode | `pixGrid.performanceAndMatrix.ledMatrix.rgbSubpixelMode` | Right rail · **DESIGN** tab · PixGrid (also reused inside the Show Manager) | `rv-pix-grid-design-control-help` (-8 / -7) | PixGridDesignPanel.tsx:226 |
| 42 | **Trigger On** dropdown | Trigger On | `canvas.videoTiming.triggerOn` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3251 |
| 43 | **Clip Start Time** numeric field | Clip Start Time | `canvas.videoTiming.clipStartSeconds` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3265 |
| 44 | **Clip End Time** numeric field | Clip End Time | `canvas.videoTiming.clipEndSeconds` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3281 |
| 45 | **Loop Clip Range** toggle | Loop Clip Range | `canvas.videoTiming.loopClipRange` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3300 |
| 46 | **Loop Full Video** toggle | Loop Full Video | `canvas.videoTiming.loopFullVideo` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3314 |
| 47 | **Restart on Drop** toggle | Restart on Drop | `canvas.videoTiming.restartOnDrop` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3328 |
| 48 | **Restart on Section Change** toggle | Restart on Section Change | `canvas.videoTiming.restartOnSectionChange` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3342 |
| 49 | **Restart on Manual Preset Change** toggle | Restart on Manual Preset Change | `canvas.videoTiming.restartOnManualPresetChange` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3356 |
| 50 | **CANVAS section trigger mapping** section/group | Section Trigger Mapping | `canvas.videoTiming.sectionTriggerMapping.overview` | Right rail · **DESIGN** tab · CANVAS · **Video Timing** (only when the active media is a video) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3370 |
| 51 | **Composition** dropdown | Composition | `canvas.performanceOrchestration.composition` | Right rail · **DESIGN** tab · CANVAS · Composition (hidden in layer scope) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3474 |
| 52 | **Fracture Intensity** slider | Fracture Intensity | `canvas.fractures.structure.intensity` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3927 |
| 53 | **Fracture Mode** dropdown | Fracture Mode | `canvas.fractures.structure.mode` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3930 |
| 54 | **Anchor Mode** dropdown | Anchor Mode | `canvas.fractures.structure.anchorMode` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3933 |
| 55 | **Focus Protection** slider | Focus Protection | `canvas.fractures.structure.focusProtection` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3936 |
| 56 | **Focus X** slider | Focus X | `canvas.fractures.structure.focusX` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3939 |
| 57 | **Focus Y** slider | Focus Y | `canvas.fractures.structure.focusY` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3942 |
| 58 | **Composition** slider | Composition | `canvas.fractures.structure.composition` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3945 |
| 59 | **Placement Mode** dropdown | Placement Mode | `canvas.fractures.structure.placementMode` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3948 |
| 60 | **Variation Seed** numeric field | Variation Seed | `canvas.fractures.structure.variationSeed` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3951 |
| 61 | **Quality** dropdown | Quality | `canvas.fractures.structure.quality` | Right rail · **DESIGN** tab · CANVAS · Fractures preset only · **Fractures Controls** › Structure | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3954 |
| 62 | **Fit Mode** dropdown | Fit Mode | `canvas.sourceAndDisplay.display.fitMode` | Right rail · **DESIGN** tab · CANVAS · **Display** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:5074 |
| 63 | **Scale** slider | Scale | `canvas.sourceAndDisplay.display.scale` | Right rail · **DESIGN** tab · CANVAS · **Display** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:5089 |
| 64 | **Position X** slider | Position X | `canvas.sourceAndDisplay.display.positionX` | Right rail · **DESIGN** tab · CANVAS · **Display** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:5101 |
| 65 | **Position Y** slider | Position Y | `canvas.sourceAndDisplay.display.positionY` | Right rail · **DESIGN** tab · CANVAS · **Display** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:5113 |
| 66 | **Rotation** slider | Rotation | `canvas.sourceAndDisplay.display.rotation` | Right rail · **DESIGN** tab · CANVAS · **Display** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:5125 |
| 67 | **Canvas Output Opacity** slider | Canvas Output Opacity | `canvas.sourceAndDisplay.display.outputOpacity` | Right rail · **DESIGN** tab · CANVAS · **Display** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:5137 |
| 68 | **Preview Output Trim** slider | Preview Output Trim | `laserDmx.design.previewOutputTrim` | Right rail · **DESIGN** tab · LaserDMX · ENGINE sub-tab · master controls | `rv-laser-design-control-help` (-8 / -7) | ReactFxPanel.tsx:115 |
| 69 | **Preview Glow Trim** slider | Preview Glow Trim | `laserDmx.design.previewGlowTrim` | Right rail · **DESIGN** tab · LaserDMX · ENGINE sub-tab · master controls | `rv-laser-design-control-help` (-8 / -7) | ReactFxPanel.tsx:164 |

**REACT tab:**

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 70 | the **Routing / Events / Choreography / Analysis** sub-tab strip | Routing, Events, Choreography, and Analysis | `pixGrid.reactivity.workspace.tabs` | Right rail · **REACT** tab · PixGrid | `rv-pix-grid-reactivity-tabs-help` (-8 / -7) | ReactWorkspacePanels.tsx:173 |
| 71 | the **Continuous Routes** section (Routing sub-tab) | Continuous Routes | `pixGrid.reactivity.continuousRoutes` | Right rail · **REACT** tab · PixGrid · Routing / Events sub-tab | `rv-pix-grid-route-section-help` (-8 / -7) | PixGridReactivityWorkspace.tsx:556 |
| 72 | the **Event Routes** section (Events sub-tab) | Event Routes | `pixGrid.reactivity.eventRoutes` | Right rail · **REACT** tab · PixGrid · Routing / Events sub-tab | `rv-pix-grid-route-section-help` (-8 / -7) | PixGridReactivityWorkspace.tsx:556 |
| 73 | **SMART GROUP INTEGRATION** section/group | Smart Group Integration | `pixGrid.reactivity.smartGroupIntegration` | Right rail · **REACT** tab · PixGrid · Routing / Events sub-tab | `rv-pix-grid-route-section-help` (-8 / -7) | PixGridReactivityWorkspace.tsx:573 |
| 74 | **Change Performance Program Only** dropdown | Change Performance Program Only | `pixGrid.performanceProgram.programSelection` | Right rail · **REACT** tab · PixGrid · Choreography sub-tab | `rv-pix-grid-react-control-help` (-8 / -7) | PixGridReactivityWorkspace.tsx:639 |
| 75 | **Auto Performance** toggle | Auto Performance | `pixGrid.performanceProgram.autoPerformance` | Right rail · **REACT** tab · PixGrid · Choreography sub-tab | `rv-pix-grid-react-control-help` (-8 / -7) | PixGridReactivityWorkspace.tsx:648 |
| 76 | **Performance Intensity** slider | Performance Intensity | `pixGrid.performanceProgram.performanceIntensity` | Right rail · **REACT** tab · PixGrid · Choreography sub-tab | `rv-pix-grid-react-control-help` (-8 / -7) | PixGridReactivityWorkspace.tsx:658 |
| 77 | **Section Plan** dropdown | Section Plan | `pixGrid.performanceProgram.sectionPlan` | Right rail · **REACT** tab · PixGrid · Choreography sub-tab | `rv-pix-grid-react-control-help` (-8 / -7) | PixGridReactivityWorkspace.tsx:668 |
| 78 | **Auto Select** toggle | Auto Select | `canvas.sourceAndDisplay.sourceLink.autoSelect` | Right rail · **REACT** tab · CANVAS · Performance Automation group (Auto Select) | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3150 |
| 79 | **Auto Performance** toggle | Auto Performance | `canvas.performanceOrchestration.autoPerformance` | Right rail · **REACT** tab · CANVAS · **Performance Automation** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3557 |
| 80 | **Performance Show** dropdown | Performance Show | `canvas.performanceOrchestration.performanceShow` | Right rail · **REACT** tab · CANVAS · **Performance Automation** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3603 |
| 81 | **Layer Complexity** slider | Layer Complexity | `canvas.performanceOrchestration.layerComplexity` | Right rail · **REACT** tab · CANVAS · **Performance Automation** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3616 |
| 82 | **Transition Density** slider | Transition Density | `canvas.performanceOrchestration.transitionDensity` | Right rail · **REACT** tab · CANVAS · **Performance Automation** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3619 |
| 83 | **Effect Intensity** slider | Effect Intensity | `canvas.performanceOrchestration.effectIntensity` | Right rail · **REACT** tab · CANVAS · **Performance Automation** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3622 |
| 84 | **Motion Intensity** slider | Motion Intensity | `canvas.performanceOrchestration.motionIntensity` | Right rail · **REACT** tab · CANVAS · **Performance Automation** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3625 |
| 85 | **Cut Density** slider | Cut Density | `canvas.performanceOrchestration.cutDensity` | Right rail · **REACT** tab · CANVAS · **Performance Automation** group | `rv-canvas-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3628 |
| 86 | **Motion** slider | Motion | `canvas.fractures.motion.amount` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3986 |
| 87 | **Transition** dropdown | Transition | `canvas.fractures.motion.transition` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3989 |
| 88 | **Transition Speed** slider | Transition Speed | `canvas.fractures.motion.transitionSpeed` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:3992 |
| 89 | **Stagger** slider | Stagger | `canvas.fractures.motion.stagger` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4001 |
| 90 | **Zoom** slider | Zoom | `canvas.fractures.motion.zoom` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4004 |
| 91 | **Topology Change** dropdown | Topology Change | `canvas.fractures.structure.topologyInterval` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4007 |
| 92 | **Layout Change** dropdown | Layout Change | `canvas.fractures.structure.layoutInterval` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4010 |
| 93 | **Refracture** button | Refracture | `canvas.fractures.motion.refracture` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `—` (-8 / -8) | ReactCanvasEngineShell.tsx:4014 |
| 94 | **Shuffle Layout** button | Shuffle Layout | `canvas.fractures.motion.shuffleLayout` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `—` (-8 / -8) | ReactCanvasEngineShell.tsx:4027 |
| 95 | **Freeze Layout** toggle | Freeze Layout | `canvas.fractures.motion.freezeLayout` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4038 |
| 96 | **Return to Anchor** toggle | Return to Anchor | `canvas.fractures.motion.returnToAnchor` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Motion / Evolution | `—` (-8 / -8) | ReactCanvasEngineShell.tsx:4055 |
| 97 | **Effects Intensity** slider | Effects Intensity | `canvas.fractures.effects.intensity` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4069 |
| 98 | **Glow** slider | Glow | `canvas.fractures.effects.glow` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4072 |
| 99 | **Glitch** slider | Glitch | `canvas.fractures.effects.glitch` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4075 |
| 100 | **Texture** slider | Texture | `canvas.fractures.effects.texture` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4078 |
| 101 | **Trails** slider | Trails | `canvas.fractures.effects.trails` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4081 |
| 102 | **Depth** slider | Depth | `canvas.fractures.effects.depth` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4084 |
| 103 | **Duplication** slider | Duplication | `canvas.fractures.effects.duplication` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4087 |
| 104 | **Color Treatment** slider | Color Treatment | `canvas.fractures.effects.colorTreatment` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4090 |
| 105 | **Color Source** dropdown | Color Source | `canvas.fractures.effects.colorSource` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4093 |
| 106 | **Manual Primary Color** colour picker | Manual Primary Color | `canvas.fractures.effects.manualPrimaryColor` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4098 |
| 107 | **Manual Supporting Color** colour picker | Manual Supporting Color | `canvas.fractures.effects.manualSupportingColor` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Fractures FX | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4101 |
| 108 | **Audio Response** slider | Audio Response | `canvas.fractures.audio.response` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Audio Reactivity | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4133 |
| 109 | **Bass Motion** slider | Bass Motion | `canvas.fractures.audio.bassMotion` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Audio Reactivity | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4136 |
| 110 | **Transient Glitch** slider | Transient Glitch | `canvas.fractures.audio.transientGlitch` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Audio Reactivity | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4139 |
| 111 | **Structural Response** slider | Structural Response | `canvas.fractures.audio.structuralResponse` | Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › Audio Reactivity | `rv-canvas-react-control-help` (-8 / -7) | ReactCanvasEngineShell.tsx:4142 |
| 112 | **Displace Mode** dropdown | Displace Mode | `soundDrawing.audioReactivity.displaceMode` | Right rail · **REACT** tab · Sound Drawing · **Audio Reactivity** group | `rv-sound-drawing-react-control-help` (-8 / -7) | ReactModulationPanel.tsx:763 |
| 113 | **Displacement** slider | Displacement | `soundDrawing.audioReactivity.displacement` | Right rail · **REACT** tab · Sound Drawing · **Audio Reactivity** group | `rv-sound-drawing-react-control-help` (-8 / -7) | ReactModulationPanel.tsx:773 |
| 114 | **Bass → Scale** slider | Bass → Scale | `soundDrawing.audioReactivity.bassScale` | Right rail · **REACT** tab · Sound Drawing · **Frequency Response** group | `rv-sound-drawing-react-control-help` (-8 / -7) | ReactModulationPanel.tsx:836 |
| 115 | **Mid → Twist** slider | Mid → Twist | `soundDrawing.audioReactivity.midTwist` | Right rail · **REACT** tab · Sound Drawing · **Frequency Response** group | `rv-sound-drawing-react-control-help` (-8 / -7) | ReactModulationPanel.tsx:846 |
| 116 | **Alternate** toggle | Alternate | `soundDrawing.audioReactivity.alternate` | Right rail · **REACT** tab · Sound Drawing · **Frequency Response** group | `rv-sound-drawing-react-control-help` (-8 / -7) | ReactModulationPanel.tsx:861 |
| 117 | **High → Jitter** slider | High → Jitter | `soundDrawing.audioReactivity.highJitter` | Right rail · **REACT** tab · Sound Drawing · **Frequency Response** group | `rv-sound-drawing-react-control-help` (-8 / -7) | ReactModulationPanel.tsx:873 |
| 118 | **Beat → Bloom** slider | Beat → Bloom | `soundDrawing.audioReactivity.beatBloom` | Right rail · **REACT** tab · Sound Drawing · **Frequency Response** group | `rv-sound-drawing-react-control-help` (-8 / -7) | ReactModulationPanel.tsx:883 |

**CANVAS preset controls resolved through a map.** These icons are created by a shared helper (`renderCanvasPresetControl`) from the `CANVAS_REACT_CONTROL_HELP_IDS` map (`ReactCanvasEngineShell.tsx:3052`). Each control is a slider or dropdown wrapped in `rv-canvas-react-control-help` (-8 / -7). Which of them appear depends on the selected CANVAS preset (`canvasPresetSupportsControl`):

| # | Control key | Icon floats over | Registry title | Help ID | Where it is in the app | Source |
|---|---|---|---|---|---|---|
| 119 | `drySourceMix` | **Dry Source Mix** control | Dry Source Mix | `canvas.reactControls.sourceAndReactivity.drySourceMix` | Right rail · **DESIGN** tab · CANVAS · **Source + Reactivity** group | ReactCanvasEngineShell.tsx:3053 |
| 120 | `sourceVisibility` | **Source Visibility** control | Dry Source Mix | `canvas.reactControls.sourceAndReactivity.drySourceMix` | Right rail · **DESIGN** tab · CANVAS · **Source + Reactivity** group (same help entry as Dry Source Mix) | ReactCanvasEngineShell.tsx:3054 |
| 121 | `intensity` | **Visual Intensity** control | Visual Intensity | `canvas.reactControls.sourceAndReactivity.visualIntensity` | Right rail · **DESIGN** tab · CANVAS · **Source + Reactivity** group | ReactCanvasEngineShell.tsx:3055 |
| 122 | `bassReactivity` | **Bass Reactivity** control | Bass Reactivity | `canvas.reactControls.sourceAndReactivity.bassReactivity` | Right rail · **DESIGN** tab · CANVAS · **Source + Reactivity** group | ReactCanvasEngineShell.tsx:3056 |
| 123 | `beatPulse` | **Beat Pulse** control | Beat Pulse | `canvas.reactControls.sourceAndReactivity.beatPulse` | Right rail · **DESIGN** tab · CANVAS · **Source + Reactivity** group | ReactCanvasEngineShell.tsx:3057 |
| 124 | `glow` | **Glow** control | Glow Amount | `canvas.reactControls.fx.glowAmount` | Right rail · **REACT** tab · CANVAS · **Preset FX** group | ReactCanvasEngineShell.tsx:3058 |
| 125 | `trailAmount` | **Trail Amount** control | Trail Amount | `canvas.reactControls.fx.trailAmount` | Right rail · **REACT** tab · CANVAS · **Preset FX** group | ReactCanvasEngineShell.tsx:3059 |
| 126 | `rgbSplit` | **RGB Split** control | RGB Split | `canvas.reactControls.fx.rgbSplit` | Right rail · **REACT** tab · CANVAS · **Preset FX** group | ReactCanvasEngineShell.tsx:3060 |
| 127 | `glitchAmount` | **Glitch Amount** control | Glitch Amount | `canvas.reactControls.fx.glitchAmount` | Right rail · **REACT** tab · CANVAS · **Preset FX** group | ReactCanvasEngineShell.tsx:3061 |
| 128 | `stutterRate` | **Stutter Rate** control | Stutter Rate | `canvas.reactControls.fx.stutterRate` | Right rail · **REACT** tab · CANVAS · **Preset FX** group | ReactCanvasEngineShell.tsx:3062 |
| 129 | `lumaThreshold` | **Luma Threshold** control | Luma Threshold | `canvas.reactControls.fx.lumaThreshold` | Right rail · **REACT** tab · CANVAS · **Preset FX** group | ReactCanvasEngineShell.tsx:3063 |
| 130 | `motionAmount` | **Motion Amount** control | Motion Amount | `canvas.reactControls.motionAndParticles.motionAmount` | Right rail · **REACT** tab · CANVAS · **Motion** group | ReactCanvasEngineShell.tsx:3064 |
| 131 | `turbulence` | **Turbulence** control | Turbulence | `canvas.reactControls.motionAndParticles.turbulence` | Right rail · **REACT** tab · CANVAS · **Motion** group | ReactCanvasEngineShell.tsx:3065 |
| 132 | `particleDensity` | **Particle Density** control | Particle Density | `canvas.reactControls.motionAndParticles.particleDensity` | Right rail · **REACT** tab · CANVAS · **Particles** group (Particle Aura preset only) | ReactCanvasEngineShell.tsx:3066 |
| 133 | `particleSize` | **Particle Size** control | Particle Size | `canvas.reactControls.motionAndParticles.particleSize` | Right rail · **REACT** tab · CANVAS · **Particles** group (Particle Aura preset only) | ReactCanvasEngineShell.tsx:3067 |
| 134 | `particleColorMode` | **Particle Color Mode** control | Particle Color Mode | `canvas.reactControls.motionAndParticles.particleColorMode` | Right rail · **REACT** tab · CANVAS · **Particles** group (Particle Aura preset only) | ReactCanvasEngineShell.tsx:3068 |
| 135 | `particleQuality` | **Particle Quality** control | Particle Quality | `canvas.reactControls.motionAndParticles.particleQuality` | Right rail · **REACT** tab · CANVAS · **Particles** group (Particle Aura preset only) | ReactCanvasEngineShell.tsx:3069 |

**Fractures effect-role weights.** Seven sliders created from `CANVAS_FRACTURE_EFFECT_ROLE_OPTIONS` (`ReactCanvasEngineShell.tsx:2875`, rendered at line 4106), each wrapped in `rv-canvas-react-control-help` (-8 / -7). Location: Right rail · **REACT** tab · CANVAS · Fractures preset only · **Fractures Controls** › **Fractures FX**.

| # | Icon floats over | Registry title | Help ID | Source |
|---|---|---|---|---|
| 136 | **Clean Role** slider | Clean Role Weight | `canvas.fractures.effects.roleWeight.clean` | ReactCanvasEngineShell.tsx:2877 |
| 137 | **Glow Role** slider | Glow Role Weight | `canvas.fractures.effects.roleWeight.glow` | ReactCanvasEngineShell.tsx:2878 |
| 138 | **Outline Role** slider | Outline Role Weight | `canvas.fractures.effects.roleWeight.outline` | ReactCanvasEngineShell.tsx:2879 |
| 139 | **Glitch Role** slider | Glitch Role Weight | `canvas.fractures.effects.roleWeight.glitch` | ReactCanvasEngineShell.tsx:2880 |
| 140 | **Luma Role** slider | Luma Role Weight | `canvas.fractures.effects.roleWeight.luma` | ReactCanvasEngineShell.tsx:2881 |
| 141 | **Displacement Role** slider | Displacement Role Weight | `canvas.fractures.effects.roleWeight.displacement` | ReactCanvasEngineShell.tsx:2882 |
| 142 | **Texture Role** slider | Texture Role Weight | `canvas.fractures.effects.roleWeight.texture` | ReactCanvasEngineShell.tsx:2883 |

### 3.4 Lower workspace (Track Map strip)

Applies to the React view only. The lower workspace shows only the surfaces the current engine composition needs, so the TRACK MAP and PERFORMANCE PADS tab icons appear only when those tabs exist (`getReactLowerSurfaces`). The Sound Drawing timeline tab has no icon.

| # | Icon floats over | Registry title | Help ID | Where it is in the app | Anchor class (top / right px) | Source |
|---|---|---|---|---|---|---|
| 143 | the **Beat Grid** lane row of the Track Map | Beat Grid Lane | `shared.trackMap.beatGridLane` | Lower workspace · **TRACK MAP** surface (expanded, embedded strip) | `rv-timeline-lane rv-timeline-lane--beats` (-8 / -8) | ReactTrackMapStrip.tsx:2432 |
| 144 | the **Sections** lane row of the Track Map | Track Sections Lane | `shared.trackMap.sectionsLane` | Lower workspace · **TRACK MAP** surface (expanded, embedded strip) | `rv-timeline-lane rv-timeline-lane--sections` (-8 / -8) | ReactTrackMapStrip.tsx:2508 |
| 145 | the **Cues / Presets** lane row of the Track Map | Cues and Presets Lane | `shared.trackMap.cuesLane` | Lower workspace · **TRACK MAP** surface (expanded, embedded strip) | `rv-timeline-lane rv-timeline-lane--cues` (-8 / -8) | ReactTrackMapStrip.tsx:2620 |
| 146 | the **TRACK MAP** tab label | Track Map | `shared.trackMap.overview` | Lower workspace · tab row (only when the engine shows a Track Map) | `rv-lower-workspace-tab-wrap` (-8 / -8) | ReactView.tsx:181 (rendered at ReactView.tsx:1145) |
| 147 | the **PERFORMANCE PADS** tab label | Performance Pads | `shared.performancePads.overview` | Lower workspace · tab row (only when the engine shows Performance Pads) | `rv-lower-workspace-tab-wrap` (-8 / -8) | ReactView.tsx:182 (rendered at ReactView.tsx:1145) |
| 148 | the **Cast + Stage Focus** button cluster (right end of the lower-workspace tab row) | Output and Stage Focus | `shared.lowerWorkspace.outputActions` | Lower workspace · right end of the tab row | `rv-lower-workspace-output-actions` (-10 / -9) | ReactView.tsx:1163 |

### 3.5 Audio dock

The dock is shared: it appears at the bottom of the React view **and** the Show Manager, so these three icons appear in both. The three cards are each wrapped in `vz-dock-help-region` (`vyzualz.css:2763`, z-index 16); the collapsed dock has its own extra rule for the icon (`reactView.css:7325`).

| # | Icon floats over | Registry title | Help ID | Anchor class (top / right) | Source |
|---|---|---|---|---|---|
| 149 | the **left deck card** (play button, track title, load/replace, volume) | Track Player | `visualizer.audioDeck.trackPlayer` | `vz-dock-help-region` (-8 / -8) | VyzualzAudioDock.tsx:773 |
| 150 | the **centre deck card** (waveform + zoom buttons) | Track Waveform | `visualizer.audioDeck.waveform` | `vz-dock-help-region` (-8 / -8) | VyzualzAudioDock.tsx:804 |
| 151 | the **right deck card** (BPM readout, tap, cue, BPM Sync, reserved keys) | Tempo, Rekordbox, Cue, and Sync | `visualizer.audioDeck.tempoAndSync` | `vz-dock-help-region` (-8 / -8) | VyzualzAudioDock.tsx:1067 |

---

## 4. Icons that appear in more than one place

- **Show Manager** reuses the PixGrid Design panel (`ShowManagerView.tsx:2767`), so the ten PixGrid Design icons (3.3 Design tab) also appear there, and it embeds the shared audio dock (`ShowManagerView.tsx:2991`).
- **`react.canvas.reactControls.sourceAndReactivity.drySourceMix`** is opened by two different CANVAS sliders (Dry Source Mix and Source Visibility).
- **Right-rail CANVAS controls** are produced twice by design: the Source + Reactivity group on the Design tab and the FX / Motion / Particles groups on the React tab both call `renderCanvasPresetControl`.

## 5. Layout Lab mockups (not product UI)

These files import `HelpInfoTrigger` for design mockups. They are listed so the new search design knows to ignore them; they should not be indexed as places to find help.

| File | Icons |
|---|---:|
| react/layoutLab/PixGridMockup.tsx | 5 |
| react/layoutLab/PixGridRightRailMockup.tsx | 10 |
| react/layoutLab/SoundDrawingMockup.tsx | 7 |
| react/layoutLab/SoundDrawingReactivityMockup.tsx | 7 |
| react/layoutLab/TemplateAudioDockMockup.tsx | 3 |

---

## 6. What this means for the header search and detail pop-up

Facts from the registry and the wiring above that the new design has to account for. These are findings, not decisions.

1. **295 of 445 entries cannot be reached from any icon today.** A search over the registry would surface help for controls that currently have none (the whole Lyric Manager, Media Manager, Cinema Worlds, Shader Pads and most Visualizer, PixGrid and Sound Drawing entries).
2. **The registry does not know where a control lives.** `group` is a topic label ("Engine and workspace selection"), not a UI path. The "Where it is in the app" column in section 3 exists only because it was read from the component tree. A result that says "Open this control" or "Show me where" needs a location (view, engine, tab, group, and any visibility condition) added per entry.
3. **No search keywords exist.** `tags` is empty on all 445 entries, and every entry is `priority: 1`. A smart search can use `title`, `summary`, `whatItDoes`, `group` and `componentType` today; synonyms and common phrasings would need to be added.
4. **Titles are not unique.** 53 titles are shared by 130 entries (for example Auto Performance ×4, Intensity ×4, Scale ×4, BPM ×5, Color ×4). Results need an engine and tab qualifier to be distinguishable.
5. **Rich fields are stored but never shown.** `affects` (all 445 entries), `defaultValue` (205), `range` (163), `doesNotAffect` (159), `tip` (101), `relatedHelpIds` (50) and `recommendedRange` (3). These are the natural content for a larger technical pop-up. `relatedHelpIds` would give "related controls" links.
6. **Icons show live values; a search result would not.** About 126 of the icon sites pass a live "Current value" or "Status" line (for example the current slider percentage or Sync on/off). The detail pop-up would show static text only unless it is given access to the control's state.
7. **Icons are conditional.** Many exist only for one engine, one preset (Fractures, Particle Aura), one authoring mode (LaserDMX Show Director), or one media type (Video Timing). Search results should respect the same conditions or label them.
8. **Turning the icons off.** The "Contextual Info" setting currently hides every icon. When the icons are removed, that setting either needs a new meaning (for example, whether the header search is shown) or should be retired.
9. **Layout Lab and tests.** Thirty-two icon sites in Layout Lab mockups and the `HelpInfoTrigger` / `InfoPopover` tests would need to change or be removed with the icons.

## 7. Decisions needed before building

- Do all 445 entries become searchable on day one, including those for controls that have no icon today?
- Where does a result take the user: only open the detail pop-up, or also switch engine/tab and highlight the control?
- Should the existing small pop-up be replaced entirely, or kept as a quick preview inside the search results?
- What happens to the Contextual Info setting once the floating icons are gone?
- Which surfaces get help content next (Cinema 2.0, Headliner, Lyric Manager and Media Manager currently have none wired)?
