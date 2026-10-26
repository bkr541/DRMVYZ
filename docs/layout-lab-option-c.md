# Layout Lab Option C — Afterglow

Option C now owns a new presentation architecture. The supplied image informed broad graphite surfaces, circular instruments, quiet lighting and restrained orange/teal signals. The redesign changes composition, navigation, media geometry, control construction, editor organization and the audio dock; it is independent of A, B, D, E and the production interface.

## Design rationale and research

The reference uses asymmetric rounded panels, large areas of near-black, low-saturation layered materials, thin monochrome icons, soft circular relief, fine borders, simple sentence-case typography and rare warm accents. Its orange playback line and teal indicator dots establish a useful distinction between actions/position and state. It does not justify neon frames, decorative charts, glass blur across the workspace or a simulated visualizer.

Afterglow translates those qualities into a practical creative workspace:

- A full-width masthead separates branding, output controls, save state, performance readings and account utilities. All original output actions remain disabled in this disconnected lab.
- A circular navigation family sits beside an independent workspace. The A–E selector's existing component, labels, dimensions, colours, typography and selection behavior are preserved.
- The media shelf combines a circular engine identity, icon/text navigation, compact filter chips and a two-column collection of rounded covers with captions. List view has its own horizontal construction.
- The central stage has a deliberately quiet monitor with useful grid and safe-area guides. Sequence, Track Map, Settings and Dialogs occupy a new editing workspace. Editors remain mounted when switching workspaces, preserving local cue edits and selections.
- The inspector starts with two circular readouts and their accessible native range controls. Automation switches, recessed selectors, nested disclosure groups, lighting sliders and circular palette swatches form one instrument family. Landscape preset covers replace the old poster grid. Lyric-version actions sit below full-width identities rather than squeezing their names into narrow rows.
- A single wide audio deck integrates record identity, a circular transport cluster, a waveform/seek instrument, precise tempo input, source tools, playlist and level controls. The deck retains both explicit and blank-space collapse behavior.

Research consulted actual primary-source documentation rather than unverified mood-board screenshots:

- [Ableton Live: Arrangement View](https://www.ableton.com/en/manual/arrangement-view/) — separate overview, timing and editing responsibilities; preserve dense, aligned lanes, locators and zoom controls.
- [Apple Logic Pro: Control bar and view control bar](https://support.apple.com/en-ie/guide/logicpro-ipad/devc8a6b875d/ipados) — distinguish stable transport/status commands from navigation between working areas.

These informed workflow organization. The supplied image remains the visual authority; no other application's artwork, assets or visual identity were copied.

## C-only design system

| Role | Contract |
| --- | --- |
| Material | Near-black `#080808`, graphite `#151515`, raised `#222221`, inset `#101010`; fine neutral highlights and restrained radial relief |
| Signals | Orange `#f77b3d` for authored changes, position and selection; teal `#54aaa7` for enabled state; existing authored cue/section/severity colours retained |
| Type | System Helvetica Neue / Helvetica / Arial; 30px stage display, 22–25px panel introductions, 12px/700 parent group titles with icon and .15em tracking, 11px nested groups, 11px labels/values/placeholders, tabular technical values |
| Hierarchy | Shared control roles live in `src/styles/typography.css` behind the explicit `graphite` opt-in, propagated into portals. Nested heading text aligns with parent text at 24px. The Lab selector restores its existing shared type role. |
| Geometry | 24px workspace surfaces, 12–18px inset fields/media cards, circular instrument and action faces, pill navigation and compact status indicators |
| Rhythm | 16px workspace gutters, 20–26px main surface insets, 49px group headers, 36px fields, 32px icon targets |
| Interaction | Native ranges/number inputs, keyboard-operable tabs and disclosures, visible orange focus, restrained hover transitions, reduced-motion support; original disabled/severity states retained |
| Responsive | Rebalanced rails at 1250/1050px, tighter navigation on short windows; below 900px the dense work area deliberately scrolls horizontally to retain usable controls |

## Source audit and behavior boundaries

`LayoutLabMockup` mounts `LayoutLabDesignWorkbench`. The catalog maps C to `design-03`. The existing workbench lazily mounts a design on first visit and keeps it mounted/hidden after switching; that lifecycle and its selector are unchanged. A and B already had independent presentations in the supplied working tree; D and E retain their original React frame.

The original C assembled `LayoutLabReactHeader`, `LayoutLabReactNav`, `LayoutLabElectricStormLeftWindow`, `LayoutLabMarqueeRightWindow`, `LayoutLabLyricManagerWindows`, `LayoutLabReactTrackMap`, Settings, Pop-ups & Dialogs and `LayoutLabReactAudioDock`. It uses local fixtures/state rather than production stores, audio decoding, output controllers or media services. The new C imports the existing fixture exports, registry, compiler and feature components; no backend, audio engine or rendering logic was changed.

## Component coverage audit

| Existing area / controls | C presentation and coverage |
| --- | --- |
| Brand, option name, output status/preview/reveal/blackout | Reconstructed masthead and output capsule; original unavailable output behavior retained |
| Loading/save, FPS, frame time, quality, CPU, notifications/profile, Lab key | New quiet readouts, icon controls and scoped popovers; readings remain available at checked widths; Lab key focuses the original selector |
| React, Managers, Preset/Show/Lyric/Media Manager, licence/version | Circular navigation with original local selection; existing A–E selector preserved |
| React Workspace, Cinema 2.0 / Electric Storm identity | New editorial header and circular engine medallion; identity remains read-only |
| Source / Layers / Notice | New keyboard-operable C navigation |
| All / Collections / Favorites / Images / Videos, search, grid/list, all 24 media fixtures, selected/favorite/type metadata | Reconstructed cover grid and list, filter chips, native search and explicit empty states |
| Layer visibility, opacity, blend, role, label | New layer identity surface, populated from the original compiler result; read-only as before |
| Info/Success/Warning/Error, four notice variants per tone, dismiss/open | New C notice markup, all 16 variants, severity indicators, working dismissal; original Open no-op retained |
| Inspector Presets / Design / React / Audio / Tracks; Engine / unavailable Selection | New tab strip/context selector; all five panels accessible |
| Master Intensity, Camera Motion, BPM Sync, Auto Performance/help | New circular readout + range instruments and C switch family; original defaults/state retained |
| Pattern, explanation, Pattern Change and conditional Trigger | Reconstructed inset selectors and switch; direct pattern edits still disable Auto Performance |
| Three marquee text fields, 32-character limits, sign illumination | C fields and range; original defaults/limits retained |
| Six lighting zones | C instrument controls with original ranges and names |
| Bloom, Haze, reflections, cinematic finish | C controls; Haze remains 0–0.03 in .001 steps with a three-decimal readout |
| Five palette colours, labels and full colour editor | New swatch/hex composition; existing editable portal receives C materials/type |
| Presets: System/User, registry, search, activation, empty state | Existing registry-driven body in C adapter; rebuilt landscape cover/caption geometry and selected state |
| React: Routing/Analysis, effects/media routes, automation/pool dependencies, Motion/Preset FX | Original behavior-owning body in C adapter; nested groups, tabs, ranges, switches, dropdowns and input family covered |
| Audio: Track plus bands, rhythm, beat grid, phrases, energy, measurements, sections/structure, events, harmonic, stems, lyrics, semantic | Original diagnostics fixture in C adapter; rounded instruments, neutral metadata and teal meter construction |
| Tracks: search/filter, selection/load/play states, AI/overflow, versions/rename/duplicate/active/new/import, legacy documents, Load More | Original local browser in C adapter; rounded track identities, full-width version titles, separate action strip, badge and field families |
| Stage, empty state, frame, composition/safe guides | New stage markup and functional guide toggles; explicitly disconnected monitor, no fake scene |
| Track Timeline: time/beat/section/audio, lyrics lanes, seek/zoom, select/drag/resize/add/context menus, playhead | Existing editor in the new Sequence workspace; rounded lane shell and C selection/control treatment, original pointer geometry retained |
| Cue list: count/search/filter/table/status/warnings, timing/text/word editor and undo/redo contract | Retained linked cue editor; new table, fields, inset editor, action and selected-state materials |
| Track Map / Performance Pads, row key, Cast/Stage Focus, collapse/resize, sections/detail, cues/phrases/moments/actions and ruler | Existing local feature in its own editing workspace; new surface/tools/lanes/selection treatment; original empty Pads state retained |
| Settings: Account, Appearance, Brand Kit, System, DJ Software, Developer/logs, Sign Out, close | Original fixture in C adapter; horizontal wrapping navigation, inset fields, rounded shell, scrollable technical table |
| 18 confirmation samples, 7 lyric dialogs, 6 editors, 6 menu/panel samples | All existing categories retained in Dialogs; C materials, field/button/menu families, geometry and typography |
| Dock identity/artist/Replace, previous/play/next, waveform/cue markers/seek/zoom, time, volume/dB | Reconstructed integrated deck using the original analysis fixture and waveform implementation; keyboard-accessible position range added |
| BPM/override/reset, source metadata, TAP/CUE/SYNC, source and playlist keys, external Track Timeline key, collapse | New tempo/utility grouping with original choices; precise bounded native BPM input and reset; original demonstration no-ops preserved |
| Source Input / Rekordbox tools; playlist settings/selection/removal | Dedicated C popovers; original three input choices, three import-tool choices, append/replace and automatic-advance preferences retained; nested menu stacking verified; track action menus and cascading flyouts receive the explicit C portal context |
| Dropdowns, palette popovers, tooltips, empty/loading/disabled/warning states, focus, scrolling | Explicit C portal opt-in and scoped adapters; native title tooltips retained; fixture sample states remain available |

No major existing feature area is omitted. Complex behavior-owning editor internals deliberately retain their markup and event handlers under a bounded C presentation adapter; they are not claimed as newly implemented production features.

## Existing limitations retained

This remains a disconnected Layout Lab study. Transport advances a synthetic playhead without decoding audio; header output controls do not drive an output. Fixture artwork is the original generated gradient artwork. Analysis is fixed fixture data. No new backend calls or persistence were added.

The original fixture's no-ops remain: engine identity, Replace Track, Tap/Cue keys, external Track Timeline launch, Rekordbox tool actions, queue removal, some destructive/AI track actions, and dialog sample actions. React Analysis and Performance Pads remain empty; Brand Kit remains its existing placeholder. Editing tabs reorganize access rather than deleting these surfaces. The shared Settings internals retain their pre-existing fixed input IDs when multiple lab designs are mounted.

## Modified-file scope

All paths below are relative to the repository root. This list describes the C task delta against the exact supplied working tree, including its pre-existing uncommitted A/B work.

| File | Reason |
| --- | --- |
| `src/components/vyzualz/react/layoutLab/LayoutLabDesignWorkbench.tsx` | One C-only render branch and C-only outline icon opt-in; selector and lifecycle preserved |
| `src/components/vyzualz/react/layoutLab/__tests__/LayoutLabDesignWorkbench.test.tsx` | Limit old React-frame assertions to D/E; include C's new chrome/dock in existing shared regression checks |
| `src/components/vyzualz/context-menu/ContextActionMenu.tsx` | Optional presentation/owner-document context for C action menus and cascading flyouts; defaults unchanged |
| `src/components/vyzualz/transport/RgbWaveformCanvas.tsx` | Optional owner-document sizing for C’s popup waveform; drawing and default observer behavior unchanged |
| `src/styles/typography.css` | Explicit `graphite` role contract and unchanged Lab-selector role inside C; no existing workspace opts in |
| `src/components/vyzualz/react/layoutLab/optionC/OptionCWorkspace.tsx` | Independent composition and persistent editing navigation |
| `src/components/vyzualz/react/layoutLab/optionC/OptionCChrome.tsx` | C header, navigation and monitor |
| `src/components/vyzualz/react/layoutLab/optionC/OptionCLeft.tsx` | C media, layer and notice reconstruction |
| `src/components/vyzualz/react/layoutLab/optionC/OptionCInspector.tsx` | C inspector navigation and Design instruments |
| `src/components/vyzualz/react/layoutLab/optionC/OptionCDock.tsx` | C transport deck and local source/queue state |
| `src/components/vyzualz/react/layoutLab/optionC/ocControls.tsx` | C keys, tabs, groups, ranges, switches and fields |
| `src/components/vyzualz/react/layoutLab/optionC/optionC.css` | C materials, geometry, responsive composition, primitives and portal styling |
| `src/components/vyzualz/react/layoutLab/optionC/optionCFeatures.css` | Bounded C adapters for behavior-owning feature bodies |
| `src/components/vyzualz/react/layoutLab/optionC/OptionCWorkspace.test.tsx` | Focused interaction and preservation tests |
| `docs/layout-lab-option-c.md` | Rationale, inventory, scope, evidence and verification record |

The shared waveform component gains optional owner-document sizing used only by C, fixing an otherwise unpainted popup canvas. Its default sizing path and waveform drawing remain unchanged. The shared context-menu component gains an optional presentation context for theme, typography and owner-document portals. C alone supplies it; default rendering, state, item callbacks and other layouts remain unchanged. Shared typography additions require `data-ui-typography='graphite'`; portal materials require `data-ui-theme='graphite'`. All other new selectors use C-owned classes. Pre-existing A/B changes are excluded from the C patch. Generated screenshots/reports and the patch are under ignored `artifacts/option-c/` and do not enter the application bundle.

## Verification and evidence

| Check | Result |
| --- | --- |
| `npm run build` | Passed (`tsc` + Vite); existing large-bundle warnings remain |
| `npm run typecheck` after context-menu integration | Passed |
| Final `npx vite build` | Passed after the final presentation changes |
| Focused ESLint: C components/tests, workbench integration/regression tests, context-menu integration | Passed |
| Workbench regression suite + C behavior suite | 23 tests passed across two files; includes non-opted-in menu behavior and iframe owner-document isolation. jsdom reports its known missing canvas implementation; actual drawing is evaluated in Chromium |
| Responsive visual review | Finished screenshots at 1440×900, 1920×1080, 1280×800 and 1000×760; no horizontal overflow in the major workspace regions, and short-window navigation fits vertically |
| Browser interaction review | Passed media filters/search/selection/list, layers/notices/dismiss, all inspector tabs, preset activation, pattern dependencies, conditional Trigger, text/light/effect/palette controls, linked cue selection, Track Map/detail, Settings/Developer, all dialog categories, play/pause, queue/source, BPM/reset, waveform zoom and dock collapse |
| Typography | Checked headings/nesting, labels/values, placeholders and portaled menu text; parent 12px/700, nested 11px/700, fields/menu 11px regular; dial captions use the supporting-label size |
| Actual Layout Lab popup | Exercised `LayoutLabModal` / `window.open` with mirrored application styles, selected C, and verified action-menu and source/dropdown portals stay in the popup document |
| Browser errors | None in the completed workspace review |
| Other layouts | Computed comparisons across A (2,046), B (1,993), D (2,010) and E (2,010) elements: no geometry, typography or non-hover style differences. Three selector hover-colour differences came from pointer placement and were reviewed against the existing canonical hover rules |
| Production isolation | Source review: no production workspace, store, audio engine or renderer changed. The three shared integration points require explicit C opt-in. Full production output/audio flows and Electron were not exercised end to end |
| Source/diff review | C changes reviewed against the supplied working-tree snapshot; pre-existing A/B edits preserved. Temporary browser harness and generated tracked build-index changes removed |
| Patch | One patch against the exact supplied working-tree snapshot, including its existing A/B work; forward application and reverse application checked |
| Commit | No commit requested or created; changes remain uncommitted |

The final screenshot set is in `artifacts/option-c/final/`. It includes complete workspaces at all four widths, the actual popup, media list/layers/notices, every inspector tab, expanded text/lighting/effects/palette states, cue editing, Track Map, Settings/Developer, dialog categories, source/playlist popovers, collapsed dock and the portaled track-actions menu. `artifacts/option-c/before-1440.png` records the original C. `browser-verification.json` records the measured regions, interaction results, typography and scope comparisons. `option-c-visual-evidence.zip` packages the finished screenshots, original comparison, report and this document.

The workspace still has three simultaneous creative regions, which is appropriate for this workflow. Its masthead, navigation faces, engine identity, cover grid, inspector instruments, landscape presets, persistent editing navigation, version-action layout and integrated transport are new constructions. Removing the palette would still leave those structural differences. Shared editor internals retain their functional geometry rather than being replaced by illustrations.
