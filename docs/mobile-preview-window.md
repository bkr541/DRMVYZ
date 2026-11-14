# Mobile Preview window

The iPhone launcher sits in the lower-left sidebar, below Layout Lab and directly above the expand/collapse control.

The sidebar phone button opens **DRMVYZ — Mobile
Preview**, a resizable desktop window initially requesting **1200 × 1000 content
pixels**. Both launchers use the sidebar's standard utility-button sizing and spacing.

The left navigation has one **Mobile** group (collapsible) with five screens: **Auth**, **Perform**, **Remote**, **Pads** and **Visualizer**. The earlier Option 1–4 concept mockups were removed.

- **Auth:** the real sign-in screen, rendered by loading the app in a 393 px frame with `?mobilePreview=auth`. It is inert: submit is swallowed before the form handlers run, so previewing never signs anyone in, out or up. It has no header and no bottom navigation.
- **Perform, Remote, Pads, Visualizer:** each has a centred, icon-free header (38 px, the shared `RailWindowHeader` surface at 17 px) and the shared bottom navigation (61 px; Perform, Remote, Pads, Visualizer). The left submenu and the bottom navigation stay in sync.
- **Perform:** the production engine dropdown (84 px, `ReactEngineBrowser` in controlled mode; its options cascade in over a darker backdrop), then a Presets / Controls tab row. Presets holds SYSTEM / USER, search with the favorites key, and the engine's presets; Controls holds Master Controls and Design. The engine card, tab row and search stay fixed; only the list below scrolls.
- **Notifications:** notice cards never sit in a page. Each page header has the production Notifications bell at its right edge (the title stays centred); it opens the shared right-hand `NotificationDrawer`, scoped to the phone screen, listing that page's notices (for Perform: No user presets / No matching presets / No presets; for Remote and Visualizer: their notes). Escape closes the drawer first, and only then the preview window.
- **Visualizer:** the output edge to edge, then a Design / React tab row and the production Cinema 2.0 inspector (`MobileVisualizerInspector.tsx` renders `Cinema2InspectorPanel` over the selected preset's real compiled parameters and a real parameter state, with no renderer). Design always shows the four production parent groups (Master Controls, Design, Effects, Palette) with their icons. Most presets declare nothing on the React surface, so when the selected preset has none the React tab borrows the 3D FORM preview's real Model Response controls; ANALYSIS is disabled because it needs the live audio engine.
- **Remote:** a placeholder for controlling a desktop from the phone.

A separate sidebar button above Layout Lab, **Mobile App Preview**, opens the whole running app in a phone-sized window (`mobileAppPreview.ts`); it is a second instance of the app on the same origin.

## Production audit and visual contract

Before implementation, the production token sheets, typography roles, preset artwork resolver, preset cards, engine identity card, tab rows, application/window/group headers, field controls and reusable performance pads were inspected. The Mobile screens share that production contract; mockup CSS changes composition only.

- **Colors:** `appearance.css` owns the theme. Dark background is `#090d0f`, panel `#0b1012`, panel/card `#151a1d`, cyan primary `#4ac7db`, with the existing muted/strong text and neutral border tokens. Concepts no longer substitute purple or green UI palettes.
- **Typography:** Space Grotesk is the UI face; Manrope is the field/tab/preset face. Shared roles in `typography.css` own all component text. Window and parent group headings use 12px/700 and .15em tracking; nested group headings use the shared 11px role. Fields and placeholders use the shared 11px/600 role. Tabs use 11px/700, with the existing nested selected role. Preset names use 12px/500 Manrope with .12em tracking.
- **Headers and tabs:** Each page replaces the application header with its own text-only current-page heading. `RailWindowHeader` supplies its two-tier slate gradient and 42px title row. `DualRailCollapsible` supplies parent/nested groups. `UnderlineTabs` and `PanelSubtabs` supply production states, spacing (including the canonical 25px tab lead), centered labels, cyan underline and selected nested dot.
- **Presets:** `ReactPresetCard` supplies responsive two-column poster cards, centered titles, 6px corners, favorites and the cyan selected outline/glow. Its artwork resolver chooses authored blueprint SVGs or production edge-filtered preview frames. Real registry IDs and metadata are used for Nightshift, Glassfall, Reactor, Sixfold, Threshold, Afterhours, Psylo and Starters; internal presets are excluded. The full-width current-preset poster uses the same responsive production geometry.
- **Pads:** the store-free `PerformancePad` renders all twenty default slots. Compact pads retain the production 40px height, 5px corners, 8.5px labels, inset vertical accent, 32px outlined shortcut floating right/middle, normal/selected borders and immediate press halo with a 60ms release. Empty slots retain their actual disabled treatment. Mobile layouts change column count, rather than rescaling the component.
- **Controls/output:** actual `SliderRow`, `ToggleRow`, `SelectRow`, `IconChipButton`, `PresetSearchRow` and `NoticeCard` components supply their production appearance and states. BPM Sync and Auto Performance are last in Master Controls. The quality dropdown portals into the popup document and is bounded by the phone screen.

`mobilePreviewProductionStyles.ts` injects the actual production CSS dependencies into the separate document: foundation/theme, Vyzualz/search, React cards and fields, floating surfaces, canonical controls, dropdowns, group/window/application headers, pads, icons, tabs and typography. The opener's font stylesheet links, font-face definitions and computed root variables are copied; root theme/style changes are observed and mirrored. Teardown disconnects that observer. The phone's variant stylesheet does not override shared component fonts or selected-state styling.

The iPhone screen retains its **393 × 852 logical-pixel** layout, Dynamic Island,
rounded corners and home indicator. The rendered phone stays at exactly 393 × 852 CSS pixels regardless of the
sidebar or window size. It centers when there is space; smaller windows scroll
the preview area horizontally/vertically instead of shrinking the phone. The
left navigation remains outside that scrolling area.
Shared production typography roles, application icons, theme tokens and presentation CSS are used in the popout.

The launcher reuses/focuses its existing window and can reopen after manual
close. Escape closes it; parent teardown removes listeners and closes the child.
Blocked browser popups show actionable feedback. Reopening starts on Auth.

Electron permits only the named `drmvyz-mobile-preview` blank-window request.
The native window allows resizing/maximizing with a 800 × 960 minimum content
size, while retaining context isolation, sandbox, web security and disabled Node
integration. Other application popouts keep their existing window policies.
The preview never mounts another app, audio engine or renderer.

**Relaunch through `launch.command` after updating:** Electron main-process
window dimensions are not replaced by renderer hot reload. Close any old preview
before reopening it. Browsers may constrain popup dimensions to their display.

Validation is maintained in `scripts/verify-mobile-preview.mjs` (`--browser-only` skips Electron). It checks the Mobile submenu, that Auth shows the real sign-in screen at 393 px and cannot submit, the header and bottom-navigation geometry and sync on every page, the 84 px engine dropdown, that presets follow the engine, SYSTEM/USER, the fixed/scrolling split, Controls, fixed 393×852 phone geometry at smaller window sizes, reuse, close/reopen/Escape, blocked-popup feedback and unchanged live application state.

The verifier's optional Electron pass retains the existing sizing/security checks. It was not rerun for these renderer-only changes. No production build, dependency or persistence migration was added. Changes remain uncommitted unless separately requested.
