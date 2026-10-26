# Layout Lab Option B — Signal Desk

Option B now has a dedicated presentation architecture in `src/components/vyzualz/react/layoutLab/optionB/`. Select **B** in the existing Layout Lab selector. The shared selector and lazy-mount/state-retention mechanism remain in `LayoutLabDesignWorkbench`; C–E still render their original React View frame, and A still renders its existing Instrument Rack.

## Design rationale

The first supplied reference establishes broad charcoal planes, inset fields, quiet monoline navigation, restrained green selection marks, and light, carefully spaced type. Its apparent depth comes from overlapping surfaces and small value changes rather than luminous outlines. The second uses a narrow navigation spine, aligned data rows, separated captions, teal telemetry and clear primary/secondary surfaces. Both have compact professional controls, muted inactive states and accent colour reserved for useful signals.

Signal Desk combines those characteristics into one graphite-and-teal system. The cooler teal from the second image replaces the first image's yellow-green; the graphite structure common to both is retained. The references' perspective views are presentation photography, not a usable screen layout, so the application remains flat and readable.

Research consulted:

- [Linear's interface redesign](https://linear.app/changelog/2024-03-20-new-linear-ui): hierarchy, density, quieter headers and separation of current view, actions and metadata informed the open inspector rows and restrained command strip.
- [Ableton's Session View manual](https://www.ableton.com/en/manual/session-view/): persistent musical position and random-access performance controls informed keeping transport continuously available and preserving the editor's timeline interactions.

These are design interpretations of those sources, not claims that their components were copied.

### System and composition

- **Structure:** a full-height 80px navigation spine (72px at smaller widths); an editorial header; unequal media, stage and inspector columns; a continuous two-level audio deck. At 1920px the media/inspector widths are 300/370px. At 1440px the center receives most of the available space. Each rail and the editing rack scroll independently.
- **Materials:** page `#171c20`, panel `#252c33`, raised `#2b333c`, recessed `#20262d`; fine `#353e47` boundaries. Small 3–7px corners and restrained shadows separate functional planes. No backdrop blur or animated decoration.
- **Colour:** teal `#2bc3ac` identifies activation and direct manipulation. Authored artwork, waveform cue flags, timeline section colours and notice severity remain meaningful content.
- **Typography:** the existing opt-in `midnight` roles in `src/styles/typography.css` supply Helvetica Neue/Helvetica/Arial. New presentation components use the same role family: 21–23px regular workspace titles, 12px/700/0.15em parent group titles with icons, 11px nested titles, 12px control labels/fields, small supporting metadata, tabular numerals and large light tempo/time figures. First-level nested group text aligns with its parent's text. No global typography file or font asset changed.
- **Geometry:** media uses landscape contact sheets with metadata below the artwork; preset posters have a distinct caption band; inspector groups are open rows rather than stacked rounded cards; numeric readouts sit above fine faders; switches use a compact sliding mark; palette rows pair swatches with hex values. The stage has a monitor title strip, inset screen and status footer. The waveform spans the deck above transport, time, tempo, volume, source and queue actions.
- **Interaction:** native range/field semantics, visible focus rings, arrow/Home/End tab navigation, controlled dropdowns, hover/selected/disabled states and reduced-motion support. The two guide buttons work locally. Header notifications/profile reveal local-session popovers.

Removing the palette still leaves changed navigation, header construction, contact sheets, monitor frame, inspector grouping and two-tier transport geometry. The transformation is structural as well as visual.

## Source inventory and coverage

This inventory was taken from the existing B composition, its fixture components and their behavior contracts. No production services, stores, audio engines or renderers were moved into the lab.

| Original area / behavior | Signal Desk equivalent | Coverage |
| --- | --- | --- |
| Midnight header: brand, output preview/reveal/blackout, Saved, FPS, frame time, quality/CPU, lab key, notification and profile keys | `OptionBHeader`, plus spine brand | Rebuilt. Output controls retain their disabled preview state. Nothing-loading status remains accessible with Saved. |
| React navigation: React and four manager destinations; license/version | `OptionBNav` | Rebuilt with labelled icon destinations and the same local highlight behavior; no routing added. |
| Shared A–E option selector | Existing switcher passed as a React node | Preserved; original B selector dimensions, colours and interaction styles are frozen separately from new design tokens. |
| Left rail title and Cinema 2.0 / Electric Storm identity | `OptionBLeft` header and engine strip | Rebuilt. Engine identity remains read-only, as before. |
| Source / Layers / Notice tabs | `ObTabs` | Rebuilt, including keyboard navigation. |
| Media filters: All, Collections, Favorites, Images, Videos | Catalog filter strip | Rebuilt with original filters and empty collection state. |
| Search, grid/list, 24 fixture tiles, selection, type and favorite metadata | Contact-sheet/list browser | Rebuilt with native buttons, explicit selection and no-result feedback. Uses original media fixtures and gradient artwork. |
| Compiled Electric Storm layers: label, visibility, opacity, blend and role | Compact layer list | Rebuilt from the original compiled layer definitions; stays read-only. |
| All four notice tones, four variants per tone, dismiss/open actions | Notice samples within `ObGroup` | Group presentation rebuilt; `NoticeCard` retained with B-scoped material/geometry. Dismissal works; Open retains its original no-op. |
| Inspector Presets / Design / React / Audio / Tracks | `OptionBInspector` and `ObTabs` | Navigation rebuilt; original feature bodies remain accessible. |
| Engine / unavailable Selection surface | Context strip | Rebuilt; unavailable Selection remains unavailable. |
| Master intensity, BPM Sync, Auto Performance and help, camera motion | `ObRange`, `ObSwitch` | Rebuilt using original values and local state. |
| Pattern selector, description, Pattern Change, conditional Trigger | Nested Pattern group and `ObSelect` | Rebuilt. Direct pattern edits disable Auto Performance; Trigger follows Pattern Change. |
| Three marquee text fields and illumination | Nested Marquee Copy group | Rebuilt; original max lengths and values retained. |
| Six lighting-zone controls | Nested Lighting Zones group | Rebuilt with native range inputs. |
| Bloom, haze (0–0.03 at 0.001), reflections, cinematic finish | Effects instrument group | Rebuilt; original numeric contracts preserved. |
| Five named palette colours and full editor | Swatch/hex list with existing palette editor | Row composition rebuilt; hue/saturation/lightness/hex editor retained and themed across its portal. |
| System/User presets, registry discovery/search, activation | Existing `LayoutLabCinema2PresetsTab` in B adapter | Behavior retained; poster/caption composition, geometry, search, tabs and states adapted only in B. |
| React Routing/Analysis; effect routes; performance automation; pool dependency rules; motion and preset FX | Existing `LayoutLabCanvasReactTab` in B adapter | Behavior retained; group, field, slider, switch and nested-tab families adapted. Analysis remains the existing empty live-diagnostics surface. |
| Audio Intelligence: track identity, bands, rhythm, beat grid, phrases, energy, measurements, sections/structure, events, harmonic, stems, lyrics and semantic data | Existing diagnostics in B adapter | All fixture sections retained; data cells, segmented meters, titles and surfaces adapted. |
| Tracks search/filter, cards, versions, selected/loaded/playing badges, Load, AI Extract, overflow, rename/duplicate/active/new/import, unattached documents, Load More | Existing lyric track browser in B adapter | All existing local behaviors retained; cards, version stacks, fields, badges and actions adapted. |
| Empty visualizer | `OptionBStage` | Frame rebuilt, blank renderer retained and explicitly identified; optional grid and safe guides work. No simulated scene added. |
| Track Timeline: timing/beat/section/audio rows, lyrics lanes, seek/zoom, cue movement/resizing, add/context menu, playhead | Existing `LayoutLabLyricManagerWindows` inside editing rack | Editor and geometry retained; frame, title strip, inset lanes and cue states adapted. |
| Cue list: search/filter, statuses/issues, selection, timing and word editor, undo/redo contract | Same editor with new rack/table materials | All controls retained; table rows, editor fields, actions, selection and surfaces adapted. Timeline and list still share one cue editor. |
| Track Map / Performance Pads, lane key, Cast, Stage Focus, collapse, resize, sections/detail, cues/phrases/moments/actions, time ruler | Existing `LayoutLabReactTrackMap` in rack | Existing local interactions retained; title/tools, lanes, selection and frames adapted. Pads retain their original empty state. |
| Settings: Account, Appearance, Brand Kit, System, DJ Software, Developer/logging, Sign Out, close | Existing Settings fixture in rack | All existing panels retained; navigation, form controls, sections and shell adapted. |
| Confirmations (18), lyric dialogs (7), editors (6), menus/panels (6) | Existing Pop-ups & Dialogs fixture in rack | All sample categories retained; frames, type, inputs, buttons, menus, notices and drawer materials adapted. |
| Dock track identity, Replace, previous/play/next, volume, waveform/cues, seek/zoom, time, BPM override, source, TAP/CUE/SYNC, Playlist, Track Timeline key | `OptionBDock` two-tier deck | Rebuilt with the existing track fixtures, analysis, timer and local state behavior. |
| Source and Playlist popovers, source selector, queue selection and preferences/removal keys | Dedicated B popover layouts | Rebuilt; existing local selection/preferences retained, including originally nonfunctional actions. |
| Dropdowns, tooltips, focus, disabled/loading/error states, scrollbars and separators | B primitives and explicit portal adapters | B-only controls/overlays; authored severity/state semantics retained. Existing native title tooltips preserved. |

### Reuse boundaries and unchanged limitations

The header, spine, left browser, Design inspector, control primitives, monitor frame and dock are new markup. Large behavior-owning surfaces (lyric editing, Track Map, routing, diagnostics, Tracks, Settings and dialog samples) are deliberately retained in B-specific presentation adapters. Their editor internals were not rewritten. `optionBAdapted.css` is a bounded adapter for these surfaces; it is not the workspace's layout architecture.

The original lab has synthetic transport and local fixture data: Play advances the playhead without decoding or playing audio. No output, project persistence or backend work happens. Existing demonstration no-ops remain: Replace Track, Tap, the external Track Timeline key, queue removal, some track/destructive/AI actions and dialog sample buttons. Header output controls remain disabled. These are not newly claimed production capabilities.

Brand Kit remains the pre-existing placeholder. Media Upload/Preview flows, New Show, native Cast integration and external OS windows were not part of this lab and were not added. Settings' shared panel internals retain their pre-existing fixed field IDs when multiple designs are mounted. The existing media artwork is a fixture of coloured gradients; no reference-product content or fake charts were introduced.

## File scope

Only the following files are part of this change, relative to the supplied working-tree snapshot:

| File | Purpose |
| --- | --- |
| `src/components/vyzualz/react/layoutLab/LayoutLabDesignWorkbench.tsx` | Select B's dedicated workspace, retire its old style import and unused old chrome path; retain selector/lifecycle and A/C/D/E behavior. |
| `src/components/vyzualz/react/layoutLab/__tests__/LayoutLabDesignWorkbench.test.tsx` | Update B-specific composition expectations and keep C–E's original-frame assertions. Existing A behavior assertions retained. |
| `src/components/vyzualz/react/layoutLab/optionB/OptionBWorkspace.tsx` | B-only composition and integration of all existing feature bodies. |
| `src/components/vyzualz/react/layoutLab/optionB/OptionBChrome.tsx` | Header, navigation and monitor presentation. |
| `src/components/vyzualz/react/layoutLab/optionB/OptionBLeft.tsx` | Browser, layers and notice composition. |
| `src/components/vyzualz/react/layoutLab/optionB/OptionBInspector.tsx` | Inspector navigation and reconstructed Design controls. |
| `src/components/vyzualz/react/layoutLab/optionB/OptionBDock.tsx` | Two-tier transport deck and popovers. |
| `src/components/vyzualz/react/layoutLab/optionB/obControls.tsx` | Reusable B-only keys, tabs, groups, range, switch, select and text field. |
| `src/components/vyzualz/react/layoutLab/optionB/optionB.css` | Scoped tokens, new component construction, portals and responsive behavior. |
| `src/components/vyzualz/react/layoutLab/optionB/optionBAdapted.css` | B-only adaptations of behavior-owning shared bodies. |
| `src/components/vyzualz/react/layoutLab/optionB/OptionBWorkspace.test.tsx` | Focused behavioral coverage for media, dependencies, portals, keyboard navigation and transport. |
| `docs/layout-lab-option-b.md` | Design rationale, component inventory, verification and limitations. |

The pre-existing uncommitted Option A work and its documentation/fixture exports are excluded from the supplied patch. The old B stylesheet/chrome files are left intact as unused source history. Shared controls, global typography, production runtime logic and A/C/D/E component implementations were not edited.

## Verification and evidence

Final results are recorded below after the focused checks. Screenshots and the machine-readable browser report are supplied alongside the patch under `artifacts/option-b/`; generated evidence is not application source.

| Check | Result |
| --- | --- |
| `npm run build` (`tsc` + Vite) | Passed. Existing large-bundle warnings remain; no build errors. |
| Final CSS packaging after Settings refinement | `npx vite build` passed. |
| Focused ESLint for B, workbench integration and workbench tests | Passed with no warnings. |
| Workbench regression suite + B behavior suite | 21 tests passed across 2 files. jsdom reports its known missing canvas implementation; real canvas rendering was checked in Chromium. |
| Actual Layout Lab component rendered in a local Vite browser harness with production styles | Passed at 1440×900, 1920×1080, 1280×800 and 1000×760. No horizontal overflow in the major workspace regions. |
| Browser interactions | Passed for media filters/list/selection, read-only layers, hover-dismiss notices, all inspector tabs, preset scope/activation, pattern/automation dependency, text edits, palette portal, composition grid, transport, BPM, waveform seek/zoom, source/playlist portals, linked cue selection, Track Map, Settings tabs and all dialog sample categories. |
| Header Lab key | Focuses the unchanged B selector using the anchor's own document. |
| Developer logging layout | Verified 900px scrollable table within a 653px viewport, with a readable 420px message column. |
| Browser page errors | None in the completed review. |
| Other-option comparison at 1440×900 | Zero differences in the recorded computed properties across A: 2,047 elements; C, D and E: 2,011 each. Compared tag/class, display, position, width/height, padding/margin/gap, background/text colour, border/radius, font family/size/weight/tracking. This is a computed-layout comparison, not a pixel-diff of every alternate state. |
| Production isolation | Source review: no production component, global stylesheet, store, runtime or service changed. New selectors require B's namespace or its explicit `midnight` portal opt-in. Production itself was not exercised end to end. |
| Patch | Applies to a fresh reconstruction of the exact starting files, excluding pre-existing A changes; reverse-application check passes against the finished workspace. |
| Diff review | No unintended task changes; temporary browser harness removed. |
| Commit | No commit requested or created. All B implementation changes remain uncommitted. |

Visual evidence (paths relative to the repository root):

- `artifacts/option-b/before-1440.png`: original B for comparison.
- `artifacts/option-b/workspace-1440.png` and `workspace-1920.png`: complete workspace.
- `artifacts/option-b/workspace-1280.png` and `workspace-1000.png`: smaller windows.
- `artifacts/option-b/media-list.png`, `layers.png`, `notices.png`: alternate left-panel states.
- `artifacts/option-b/inspector-presets.png`, `inspector-react.png`, `inspector-audio.png`, `inspector-tracks.png`, `track-versions.png`: inspector variants.
- `artifacts/option-b/inspector-expanded.png`, `pattern-menu.png`, `palette.png`, `palette-editor.png`: nested controls and portaled editor.
- `artifacts/option-b/source-popover.png`, `playlist-popover.png`: dock popovers.
- `artifacts/option-b/cue-editor.png`, `track-map.png`: editing states.
- `artifacts/option-b/settings.png`, `settings-developer.png`, `dialogs.png`, `menus-and-notifications.png`: Settings and dialog samples.
- `artifacts/option-b/browser-verification.json`: browser checks, region geometry and other-option comparison results.

The separate OS popup was not automated: the browser harness mounted the actual `LayoutLabMockup` with the application's production styles. Native output/audio flows remain outside this disconnected lab's capabilities. No claim is made that the pre-existing placeholders/no-ops listed above became production functionality.
