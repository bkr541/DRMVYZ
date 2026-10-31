# Floating workspace shell contract

The single application shell is `ApplicationWorkspaceFrame` (selected by
`VyzualzView` and `FLOATING_APP_VIEWS` in `appView.ts`). Its
`FloatingWorkspaceFrame` marks `[data-workspace-layout="floating"]`, with
`data-app-workspace` naming the current view. The frame owns **one** 60px
header, the brand/sidebar toggle, the navigation rail and the content slot.
`ApplicationHeaderControls` portals feature-owned actions into that header;
it does **not** copy, recreate or rebind those actions.

`WorkspaceRegion` marks a semantic layout **region** (`header`, `navigation`,
`stage`, `left`, `right`, `lower`, `audio`, `tools`); it is not a styled panel
or scroll boundary. `WorkspaceSurface` is an optional, unclipped **visual
surface**. Common inset/gap/radius/border/elevation tokens live in
`src/styles/floatingWorkspace.css`. Workspaces must explicitly opt in.

## Current compositions

| View (`data-app-workspace`) | Composition owner | Notes |
| --- | --- | --- |
| `react` | `ReactView.tsx`, `reactView.css` | Rails + live canvas/stage + lower workspace; original `VyzualzAudioDock` owns a separate second grid row. |
| `presetManager` | `PresetManagerView.tsx`, `presetManager.css` | Preset rail + detail stage + Inspector; no redundant feature header. |
| `showManager` | `ShowManagerView.tsx`, `showManager.css` | Library + visualizer/Track Map + Inspector, with its own second-row audio dock. |
| `lyrics` | `LyricManagerView.tsx`, `lyricManager.css`, `lyricLayoutMode.ts` | Independent track/timeline/cue surfaces; rails become drawers at manager-width breakpoints. |
| `media` | `MediaManagerView.tsx`, `mediaManager.css` | Library + existing preview/stage + Inspector, retaining feature-owned header actions. |

## Adding a workspace

1. Declare its typed route and label in `appView.ts`; wire navigation and the
   guarded route in `VyzualzView.tsx`, then explicitly opt into the shared frame.
2. Keep feature actions in their existing provider tree, using
   `ApplicationHeaderControls` when the shared header needs them. Do not mount
   an additional top-level brand, navbar, or header. A portaled header is no
   longer a descendant of the feature root, so selectors such as
   `.feature-root[data-layout='narrow'] .feature-header` stop matching: put any
   state the header's CSS needs on the header itself (Lyric Manager's header
   carries `data-layout` from its single `useLyricLayoutMode` value).
3. Compose actual panels, collapse/drawer rules, stage and scroll ownership
   **within the feature**. Reuse shared `--fw-*` tokens and scope styles to
   `[data-workspace-layout='floating'][data-app-workspace='…']`.
4. Extend router, header, rail, dock and breakpoint tests before enabling it.
   Review at 1588×960, 954×844 and a narrow desktop, including expanded rails,
   drawers, overlays and stage/transport DOM identity.

Never reuse legacy `.rv-shell` / `.az-dock` viewport-fixed dock positioning,
`bottom` or sidebar-width offsets in a floating workspace. React and Show
Manager explicitly place their existing docks in grid row 2. The dock is one
full-width surface (a `::before` spanning every column) behind its three
transparent regions; do not give a region its own card surface. Do not add a
blanket `.vz-inspector` override, `overflow: hidden` to shared regions, or
new renderer/transport instances to perform a cosmetic layout change.

**Verification boundary:** jsdom/source tests catch route ownership, action
portaling, selectors and DOM identity, not real canvas sizing, audio accuracy
or WebGL throughput. Browser smoke needs an explicitly authorized login state;
real WebGL/audio hardware and output-device validation remain separate.

## Browser smoke (`floatingWorkspaceAuthenticated.spec.ts`)

The spec drives the real application through all five workspaces at 1588×960,
1280×800, 954×844 and 800×844. It checks one shared header/brand/navigation,
the stage's presence and geometry, the 11px surface radius, left/right rail
collapse (the stage node must survive), the React and Show Manager dock (own
grid row, collapse/expand by blank-gap click, bottom edge fixed), the Lyric
Manager drawers, and that the page never scrolls horizontally.

Per-workspace responsive facts the spec encodes (change them here and in the
spec together): Preset Manager intentionally hides `.pmv-stage` at viewport
widths of 900px and below (the preview stays mounted; both rails remain), and
Lyric Manager's rails become drawers at the manager-width breakpoints.

**Running it.** It needs a production build served on the preview origin and an
approved Playwright storage state for a signed-in user (never commit it):

```bash
npm run build   # with the project's VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
DRMVYZ_FLOATING_WORKSPACE_BROWSER=1 \
DRMVYZ_E2E_AUTH_STORAGE_STATE=/path/to/approved-state.json \
npx playwright test src/test/e2e/floatingWorkspaceAuthenticated.spec.ts --project=chromium
```

Without both variables the test is **skipped**; a skip is not a pass, and a
report that does not show it as passed means the browser smoke has not been
established for that build.

Primary top headers in React, Preset Manager, Show Manager, Media Manager and
Lyric Manager share `--workspace-header-height: 44px`, including borders. Floating
header surfaces use the same value via `--fw-header-height`. Panel title bars and
collapsible group headers retain their own sizing.
