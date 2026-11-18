# Help Center audit

**Purpose.** Find what the help registry (`src/help/HelpCenter.ts`) is missing or has wrong, before filling it in. The header help search will read this registry, so every gap here is a topic a user cannot find.

**Status.** Audit done. Three decided changes are already applied (section 2). Nothing else in `HelpCenter.ts` has changed. Fill-in work is in batches (section 7), each checked and reported before the next.

## 1. Method and limits

- **Cinema 2.0** was read from the code: every first-party preset declared in `Cinema2FirstPartyPresetCatalog.ts` was loaded and every parameter's label, type, default, range, parent group and in-code description recorded. This is exact.
- **Existing entries** were checked for one thing only: whether the entry's title appears anywhere in the app source. That finds entries about controls that no longer exist. It does **not** check that a retained entry's text, default or range is still right. That check is done per area, as each area's batch comes up.
- **Other areas** (Settings, the managers, header, engines other than Cinema 2.0) were compared at the level of the screens and tabs the app really has, not control by control. Their control-level inventory is the first step of their own batch.

## 2. Changes already made

| Change | Detail |
|---|---|
| Removed the Visualizer entries | 114 entries (`visualizer.*`). The Visualizer workspace is no longer in the app (`APP_VIEWS` is react, performanceManager, presetManager, showManager, lyrics, media). One link to a removed entry (from `react.shared.header.audioInput`) was dropped. No test or product code referenced them. |
| New areas in the registry types | `HelpView` now has `performanceManager`, `presetManager`, `showManager` and `settings` (and no longer `visualizer`); `HelpEngine` now has `cinema2`. |
| Removed the retired-engine entries | 30 entries (Shader Pads 9, Cinematic Worlds 21). Both engines are retired and kept only for restore/import compatibility, so their entries could not be reached. `shaderPads` and `cinematicWorlds` are gone from `HelpEngine`. No other entry linked to them. |

The registry went from 445 to 301 entries.

## 3. What the registry covers now

| Area | Entries |
|---|---:|
| React: CANVAS | 99 |
| React: Sound Drawing | 51 |
| React: PixGrid | 47 |
| React: shared (header, dock, track map, engine selection) | 29 |
| React: LaserDMX (workspace 7, Beam Matrix 10, Show Director 5) | 22 |
| Lyric Manager | 39 |
| Media Manager | 14 |
| **Cinema 2.0** | **0** |
| **Preset Manager, Show Manager, Performance Manager** | **0** |
| **Settings** | **0** |
| **Sound Drawing XY, HEADLINER** | **0** |

## 4. Entries that look out of date

**Titles found nowhere in the source (26 entries).** Most are overview or tab-group entries whose title is a description rather than a visible label (for example "Setup and Media"), so they are not necessarily wrong. Each needs a manual look in its area's batch:

| Entry | Title |
|---|---|
| `react.shared.engine.sourceSelection` | Engine source / scene / world selection |
| `react.soundDrawing.workspace.tabs` | Source, Media, and Fonts |
| `react.soundDrawing.presetLibrary` | Sound Drawing Presets |
| `react.canvas.sourceAndDisplay.sourceLink.overview` | CANVAS Source Link |
| `react.canvas.videoTiming.sectionTriggerMapping.overview` | Section Trigger Mapping |
| `react.canvas.reactControls.overview` | CANVAS React Controls |
| `react.canvas.fractures.effects.roleWeight.clean` | Clean Role Weight |
| `react.canvas.fractures.effects.roleWeight.glow` | Glow Role Weight |
| `react.canvas.fractures.effects.roleWeight.outline` | Outline Role Weight |
| `react.canvas.fractures.effects.roleWeight.glitch` | Glitch Role Weight |
| `react.canvas.fractures.effects.roleWeight.luma` | Luma Role Weight |
| `react.canvas.fractures.effects.roleWeight.displacement` | Displacement Role Weight |
| `react.canvas.fractures.effects.roleWeight.texture` | Texture Role Weight |
| `react.pixGrid.workspace.tabs` | Setup and Media |
| `react.pixGrid.design.grid.quality` | Grid Quality |
| `react.pixGrid.reactivity.workspace.tabs` | Routing, Events, Choreography, and Analysis |
| `lyricManager.aiExtraction.settings.extractionSettings.overview` | Extraction Settings |
| `lyricManager.manualEditor.cueTimeline` | Cue Timeline |
| `lyricManager.cueEditor.toolbar.waveformZoom` | Shared Waveform Zoom |
| `lyricManager.cueInspector.selectedCue.section` | Section association |
| `mediaManager.library.mediaTypeFilter` | Media Type Tabs |
| `mediaManager.library.collectionFilter` | Collection Browser Context |
| `react.shared.lowerWorkspace.outputActions` | Output and Stage Focus |
| `react.shared.trackMap.beatGridLane` | Beat Grid Lane |
| `react.shared.trackMap.sectionsLane` | Track Sections Lane |
| `react.shared.trackMap.cuesLane` | Cues and Presets Lane |

## 5. Cinema 2.0

- **50 presets declared** (34 keeper, 15 reference, 1 foundation with no controls). **1,223 parameter definitions**, 560 distinct labels.
- **Parent groups.** Master Controls 213, Design 501, Effects 187, Palette 222; 100 parameters have none.
- **Built-in text already exists.** 842 of the 1,223 parameters carry a `description`. That text is a starting point for the shared entries; the audit does not judge its quality.
- **Scope.** The help is a guide to functionality, not to individual presets. No preset gets its own entry, and a control that only one preset has is not covered. Only the parent groups and the controls and concepts shared across presets are.
- **Most controls are one-offs.** 440 labels appear in only one preset, 85 in two to four, and 35 in five or more. Those 35 labels cover 561 of the 1,223 parameters (46%).

### Shared controls (a label used by 5 or more presets)

| Parent group | Controls (presets using it) |
|---|---|
| Master Controls | Auto Performance (46), BPM Sync (45), Master Intensity (39), Camera Motion (21), Motion Amount (15), Music Reactivity (12), Music Response (7), Motion Speed (6) |
| Design | Pattern Change (38), Trigger (38), Pattern (34), Model (6), Movement Amount (6), Movement Speed (6), Environment Reflection (6), Rotation Speed (5), Field of View (5) |
| Effects | Bloom (28), Cinematic Finish (17), Trails (9), Atmosphere (8), Opacity (6), Emission (6), Ground Mist (5), Floor Reflection (5), Glow (5) |
| Palette | Background (35), Primary (10), Accent (10), Secondary (9), Highlight (5) |
| No parent group | Quality / Performance (44), Musical Cue (10), Reactive Strength (6), Response Decay (6) |

Two things to handle when writing these:
- The same label can mean different things per preset (Master Intensity has 8 different defaults, Background 24, Pattern 31). A shared entry describes what the control does, not a default.
- There is no user-visible "Mood" control. Mood Conductor shows up as each preset's own strength control (labelled differently per preset), so its entry is a concept topic and must name where it appears.

### Entries to write

| Kind | Count | Source |
|---|---:|---|
| Parent groups: Master Controls, Design, Effects, Palette | 4 | What each group holds, read from the Inspector and the 1,223 parameters |
| Shared controls and concepts: the table above, Auto Performance (with the app-wide default), Pattern Change / Trigger behaviour while Auto Performance is on, Mood Conductor, Quality / Performance, Musical Cue | about 45 | Code and `docs/cinema2-auto-performance.md`, `docs/cinema2-mood-conductor.md` |

Not written: preset overviews and controls that belong to one preset.

## 6. Other missing areas

| Area | What the app has | Registry |
|---|---|---|
| Preset Manager | Preset library and store | none |
| Show Manager | Show builder, including LaserDMX and CANVAS show tools | none |
| Performance Manager | Performance pads | none |
| Settings | Six tabs: Account, Appearance, Brand Kit, System Settings, DJ Software, Developer | none |
| Header | Help search, Load / Save, Render / FPS, Quality / CPU | Only two header entries exist (Audio Input, Production Output). Help search, Load / Save, Render / FPS and Quality / CPU have none |
| Engines | Sound Drawing XY, HEADLINER | none |

## 7. Plan

Each batch: inventory from code, write entries, run the registry validator and tests, report, commit when told.

| Batch | Scope |
|---|---|
| 0 | Done: Visualizer entries removed, new areas added |
| 1 | Cinema 2.0 parent groups and shared controls and concepts (about 49 entries) |
| 2 | Preset Manager, Show Manager, Performance Manager |
| 3 | Settings (six tabs) |
| 4 | Header and navigation: add the help search, Load / Save, Render / FPS and Quality / CPU, and check the two existing header entries |
| 5 | Sound Drawing XY and HEADLINER |
| 6 | Reconcile the 26 suspect entries, spot-check defaults and ranges in CANVAS, PixGrid, LaserDMX and Sound Drawing |

## 8. Decisions needed

None open. Which entries to write next is decided entry by entry.
