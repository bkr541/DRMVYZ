# Mobile Preview window

The iPhone launcher sits in the lower-left sidebar, below Layout Lab and directly above the expand/collapse control.

The sidebar phone button opens **DRMVYZ — Mobile
Preview**, a resizable desktop window initially requesting **1200 × 1000 content
pixels**. Both launchers use the sidebar's standard utility-button sizing and spacing.

A left navigation bar contains four selectable MVP concepts, each with
navigable Presets, Pads, Controls and Cast screens:

- **Option 1 — Classic controller:** persistent production engine card, a scrolling workspace and bottom underline navigation.
- **Option 2 — Scene deck:** top underline navigation, a full-width current preset poster and the two-column preset browser.
- **Option 3 — Live console:** compact status strip, full-width workspace and horizontal bottom navigation; there is no vertical phone navigation rail.
- **Option 4 — Session dashboard:** current preset and workspace shortcut windows open full-page workspaces, with a persistent session footer whose Home button returns to the dashboard.

Production presentation components are reused with local fixture state. Preset selection, search, individual favorites and the favorites filter, System/User tabs, pad strikes, collapsible control groups, sliders, toggles, quality selection and demo casting work within each concept. All four mockups omit the React application header (logo, title, next-preset and cast keys). Each has a text-only header that follows the current page (Home, Presets, Pads, Controls or Cast). Option 1 uses a left-aligned title with a fine underline; Option 2 a centered capsule; Option 3 a left accent rail; Option 4 a centered title between two rules. All use the shared heading typography. Window and group headings remain in place. No audio engine, renderer or cast session is mounted, and preview interactions do not mutate the production store. Switching concepts resets sample state; reopening starts on Option 1.

## Production audit and visual contract

Before implementation, the production token sheets, typography roles, preset artwork resolver, preset cards, engine identity card, tab rows, application/window/group headers, field controls and reusable performance pads were inspected. All four concepts now share that production contract; variant CSS changes composition and column counts only.

- **Colors:** `appearance.css` owns the theme. Dark background is `#090d0f`, panel `#0b1012`, panel/card `#151a1d`, cyan primary `#4ac7db`, with the existing muted/strong text and neutral border tokens. Concepts no longer substitute purple or green UI palettes.
- **Typography:** Space Grotesk is the UI face; Manrope is the field/tab/preset face. Shared roles in `typography.css` own all component text. Window and parent group headings use 12px/700 and .15em tracking; nested group headings use the shared 11px role. Fields and placeholders use the shared 11px/600 role. Tabs use 11px/700, with the existing nested selected role. Preset names use 12px/500 Manrope with .12em tracking.
- **Headers and tabs:** Each mockup replaces the application header with its own text-only current-page heading. `RailWindowHeader` supplies its two-tier slate gradient and 42px title row. `DualRailCollapsible` supplies parent/nested groups. `UnderlineTabs` and `PanelSubtabs` supply production states, spacing (including the canonical 25px tab lead), centered labels, cyan underline and selected nested dot.
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
Blocked browser popups show actionable feedback. Reopening starts on Option 1.

Electron permits only the named `drmvyz-mobile-preview` blank-window request.
The native window allows resizing/maximizing with a 800 × 960 minimum content
size, while retaining context isolation, sandbox, web security and disabled Node
integration. Other application popouts keep their existing window policies.
The preview never mounts another app, audio engine or renderer.

**Relaunch through `launch.command` after updating:** Electron main-process
window dimensions are not replaced by renderer hot reload. Close any old preview
before reopening it. Browsers may constrain popup dimensions to their display.

Validation is maintained in `scripts/verify-mobile-preview.mjs`. The browser-only pass verifies text-only current-page headings and the absence of application controls and checks all four options and all sixteen Presets/Pads/Controls/Cast screens against actual production component references, including header gradients, card typography/selection, tabs, pad typography and states, field labels and placeholders. It also checks filters, favorites, empty libraries, controls, popup dropdown ownership/bounds, Option 3 bottom navigation, fixed 393×852 phone geometry, compact-window scrolling, reuse, close/reopen/Escape, blocked-popup feedback and unchanged live application state.

The renderer browser pass, TypeScript and focused ESLint passed. A focused appearance check also verified portaled dropdown typography/colors, copied font stylesheet links/custom properties and live theme changes. All four layouts and representative Pads/Controls/Cast screens were visually reviewed. Contact sheets and individual screenshots are under ignored `artifacts/mobile-preview/`, including `four-options-review.png`, `screens-review.png` and `production-dropdown-review.png`.

The verifier's optional Electron pass retains the existing sizing/security checks. It was not rerun for these renderer-only changes. No production build, dependency or persistence migration was added. Changes remain uncommitted unless separately requested.
