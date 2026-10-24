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
   an additional top-level brand, navbar, or header.
3. Compose actual panels, collapse/drawer rules, stage and scroll ownership
   **within the feature**. Reuse shared `--fw-*` tokens and scope styles to
   `[data-workspace-layout='floating'][data-app-workspace='…']`.
4. Extend router, header, rail, dock and breakpoint tests before enabling it.
   Review at 1588×960, 954×844 and a narrow desktop, including expanded rails,
   drawers, overlays and stage/transport DOM identity.

Never reuse legacy `.rv-shell` / `.az-dock` viewport-fixed dock positioning,
`bottom` or sidebar-width offsets in a floating workspace. React and Show
Manager explicitly place their existing docks in grid row 2. Do not add a
blanket `.vz-inspector` override, `overflow: hidden` to shared regions, or
new renderer/transport instances to perform a cosmetic layout change.

**Verification boundary:** jsdom/source tests catch route ownership, action
portaling, selectors and DOM identity, not real canvas sizing, audio accuracy
or WebGL throughput. Browser smoke needs an explicitly authorized login state;
real WebGL/audio hardware and output-device validation remain separate.
