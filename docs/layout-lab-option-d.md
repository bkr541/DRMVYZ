# Layout Lab Option D — Tilework

Option D owns a new presentation architecture. It is independent of A, B, C and E, of the Layout Lab selector, and of the production interface. It is the same disconnected fixture study as the other options: no production store, audio decoder, output controller or renderer is touched.

## Reference analysis

Two supplied images are the visual authority.

| Dimension | Reference 1 (printer-control app) | Reference 2 (widget home screen) | Synthesis in D |
| --- | --- | --- | --- |
| Composition | Separate rounded tiles on a bare canvas; short labels sit outside the tiles; pill CTA paired with a round secondary key | Bento grid of tiles; list rows with outlined round icons; a floating pill dock | Everything is a tile on a bare canvas. Chrome is floating capsules, not full-width bars |
| Colour | Charcoal, one lime signal, dark-green tinted fills with lime text | Blue-slate tiles, white monochrome | Blue-charcoal `#0e1113` canvas, `#181d21` tiles, one lime signal `#66d46b`, green-tinted selected fills |
| Type | Large bold numerals with a small unit and a caption beneath | Large light numerals, small captions | 46px Manrope 300 numerals with lime unit and caption beneath; UI in the system sans |
| Controls | Segmented control with tinted selected segment; round chevron discs | Outlined pill button; thin line icons | Segmented tracks, 36px disc keys, outlined filter pills, line icons (shared outline set) |
| Rows | — | Outlined round icon, two lines of text | Layers, notices, list-view media and queue rows use outlined rings with two-line text |

Where the references differ (bold vs light numerals, saturated vs monochrome) D follows their shared structure — tiles, numerals-with-caption, discs, capsules — and takes the lime signal from reference 1 and the cool slate surfaces and light numerals from reference 2.

## Research

No external design research was performed for this task: web research tools were not used, so no source links are cited and none are claimed. Decisions rest on the two supplied references, the existing application source, and the established patterns of Options B and C in this repository.

## Design system (D-only)

| Role | Contract |
| --- | --- |
| Surfaces | canvas `#0e1113`, tile `#181d21`, raised `#20262b`, well `#111518`, disc `#262d33` |
| Signal | Lime `#66d46b` for selection, position and “on”; tint `#213a29` for selected fills. Semantic warn/danger/info reserved for notices |
| Type | System sans (`--font-ui`); Manrope for numerals only. Parent group headings 12px/700/.15em with icon; nested 11px/700 with text aligned to the parent's text; tabs 12px; fields and placeholders 12px/400. Roles live in `src/styles/typography.css` behind `data-ui-typography='tile'` and propagate into portals |
| Geometry | 22px tiles, 16px wells, 12px fields, pill filters and capsules, circular keys |
| Interaction | Native ranges, switches, tabs and disclosures; visible lime focus ring; short transitions; reduced-motion support |
| Responsive | Grid rebalances at 1700, 1360, 1150, 900px and below 820px height; below 900px the work area scrolls horizontally |

## Composition

- **Header** — three floating capsules: brand + option tag; an output capsule (Output Preview, Reveal, Blackout, all disabled as before); a status capsule (save state and two numeral readouts for FPS/frame time and quality/CPU) — plus disc keys for Layout Lab, notifications and a lime profile disc.
- **Navigation** — a vertical capsule of five destinations with a divider before the managers. The Layout Lab A–E selector is placed unchanged beneath it.
- **Left** — a bare section label, an engine status tile, a three-segment control (Source / Layers / Notice) and a Media Library tile with outlined filter pills, a pill search field and a two-column cover grid. List view uses outlined round thumbnails in pill rows.
- **Centre** — a persistent stage tile (recessed monitor, floating status chips, a capsule of working grid and safe-area guides) above an editing tile with its own segmented control: Sequence, Track Map, Settings, Dialogs. The stage stays in view while the editing tile scrolls.
- **Right** — a five-segment tab control, a context tile with an Engine/Selection segmented control, then group tiles. Master Controls is a 2×2 bento: two numeral readouts with their slider docked in the tile, and two whole-face switch tiles that tint when on. Nested groups are recessed wells.
- **Dock** — one capsule: record identity with a spinning ring while playing, a transport capsule with a lime Play pill, time numeral + waveform + zoom + position range, a 38px tempo numeral with tap/cue/sync/reset keys, source/playlist/timeline/collapse keys and level.

## Component coverage

| Area | Status |
| --- | --- |
| Header, branding, output controls, save/loading, FPS/quality/CPU, notifications, profile, Lab key | Rebuilt |
| Navigation and selector placement | Rebuilt; selector component, labels and behaviour unchanged |
| Engine identity; Source / Layers / Notice; Media Library (filters, search, grid/list, 24 items, selection, favourites); layers; four notice tones × four variants | Rebuilt |
| Stage and guides | Rebuilt |
| Track Timeline, Cue list, Track Map, Settings, Pop-ups & Dialogs | Existing behaviour-owning editors inside a D adapter (`optionDFeatures.css`): tile/well groups, segmented tabs, pill fields and buttons, lime playhead and selection, retained semantic cue colours |
| Inspector: Design tab (Master, Pattern, Marquee Copy, Lighting Zones, Effects, Palette) | Rebuilt, including readouts, switch tiles, selects, fields, ranges and swatch tiles |
| Inspector: Presets, React, Audio, Tracks | Existing bodies in the D adapter: poster tiles with a lime ring, switch pills, lime meters, round-art track rows with version stacks |
| Dock: identity, transport, waveform, zoom, position, BPM/override/reset/tap/cue/sync, source and playlist popovers, level, collapse | Rebuilt; blank-space collapse retained |
| Dropdowns, popovers, palette editor, action menus | Scoped portal presentation (`data-ui-theme='tile'`) |

Not rebuilt from scratch: the behaviour-owning editor internals listed above (timeline lane geometry, cue table and word editor, Track Map, Settings panels, dialogs, preset registry cards, audio-intelligence diagnostics, track browser). They keep their markup and handlers so their behaviour is unchanged, and receive D materials, geometry and type through the adapter.

## Scope and isolation

| File | Reason |
| --- | --- |
| `src/components/vyzualz/react/layoutLab/LayoutLabDesignWorkbench.tsx` | D render branch and outline-icon opt-in for `design-04`; selector and lazy-mount lifecycle unchanged |
| `src/components/vyzualz/react/layoutLab/__tests__/LayoutLabDesignWorkbench.test.tsx` | Old React-frame assertions now apply to E only; D joins the chrome and dock checks |
| `src/styles/typography.css` | Explicit `data-ui-typography='tile'` role block and unchanged selector role inside D |
| `src/components/vyzualz/react/layoutLab/optionD/*` | All D components, styles and tests |
| `docs/layout-lab-option-d.md` | This document |

No shared component was edited: the dropdown, info popover, palette editor and context menu already copy `data-ui-theme` / `data-ui-typography` into their portals, and the context-menu presentation context and waveform owner-document sizing were added for Option C. Every D rule is scoped to `.od-root` or to a portal carrying `data-ui-theme='tile'`.

## Verification

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| ESLint on `optionD/`, the workbench and its test | Passed, no warnings |
| `OptionDWorkspace.test.tsx` (6) + `LayoutLabDesignWorkbench.test.tsx` (18) | 24 passed (jsdom's missing-canvas notice only) |
| A / B / C / E at 1440×900, with and without D's changes | Pixel-identical screenshots |
| Browser review at 1440×900, 1920×1080, 1280×800, 1000×760 | Reviewed; no horizontal overflow at 1000 or wider; short-window stage hides its caption |
| Browser interaction review | Inspector tabs, editing workspaces, media list, notice tabs, dropdown, playlist popover and dock collapse exercised; no console errors in the captured sessions |
| Typography | Computed: parent headings 12px/700/1.8px tracking, nested 11px/700, fields and placeholders 12px/400, readout 46px/300; nested heading text starts at the parent's text start |
| Not performed | Full production application, Electron, the `LayoutLabModal` pop-up window, a full-repository test/lint run, external design research |

Screenshots are in `artifacts/option-d/final/` (ignored by git) with the original D at `artifacts/option-d/before-1440.png`.

## Known limits

Remains a disconnected study: transport advances a synthetic playhead; output controls, Replace Track, Tap/Cue keys, external timeline launch, Rekordbox actions and queue removal are the original no-ops. The Brand Kit settings tab remains a placeholder. Production-bodied editors use fixed element ids shared across mounted options.
