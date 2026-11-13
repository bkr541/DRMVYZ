# Layout Lab tab workspace

Layout Lab opens from the existing application launcher into a separate 1600×1000 window. Its outer canvas has 48px top/bottom padding and 128px left/right padding. It contains seven standard underline tabs. The first permanent slot, currently named Performance Pad, contains five pad-design comparison rows; the other six panels are empty. It mounts no production feature components, stores, audio services or renderers. Shared canonical-control, tab-spacing and typography CSS is injected into the popup explicitly; application styles and theme state are not mirrored.

Click a tab to select it. Click the selected tab again, double-click a tab, or press F2 to rename it. Enter or leaving the input saves; Escape cancels the edit without closing the popup. Blank names are discarded, and names are limited to 80 characters. Arrow keys, Home and End select tabs.

Names and the selected slot persist in localStorage under `drmvyz.layoutLab.tabs.v1`, as `{ version: 1, tabs: [{ id, name }], activeTabId }`. Storage belongs to this browser/application origin; clearing its data removes saved names. If saving fails, Layout Lab displays a session-only message.

## Permanent content references

| Default name | Permanent tab ID | Permanent panel ID |
| --- | --- | --- |
| Tab 1 | `layout-lab-tab-01` | `layout-lab-tab-01-panel` |
| Tab 2 | `layout-lab-tab-02` | `layout-lab-tab-02-panel` |
| Tab 3 | `layout-lab-tab-03` | `layout-lab-tab-03-panel` |
| Tab 4 | `layout-lab-tab-04` | `layout-lab-tab-04-panel` |
| Tab 5 | `layout-lab-tab-05` | `layout-lab-tab-05-panel` |
| Tab 6 | `layout-lab-tab-06` | `layout-lab-tab-06-panel` |
| Tab 7 | `layout-lab-tab-07` | `layout-lab-tab-07-panel` |

Renaming changes only `name`. Future elements must be associated with these permanent IDs, never a label or a slug derived from a label. Tab wrappers and panels expose `data-layout-lab-tab-id`; each tab's `aria-controls` points to its panel. Panels remain mounted while switching tabs. To locate a renamed study in a later session, read its current label and permanent ID from the DOM or the stored mapping above. This storage schema saves tab metadata, not study data.

The previous mockup directory was removed. The `layoutLab/` directory contains the local tab metadata, workspace styles, pad studies and tests. Production components remain outside this feature. Other `layout-lab-*.md` documents describe archived studies.

Validation: five focused tab/popup tests, TypeScript and focused ESLint passed. The actual popup browser check verified seven equally sized tabs with shared 11px/700 typography, rename/cancel, focus restoration, saved names and selection after reopening, and permanent panel references. Its screenshot is under ignored `artifacts/layout-lab-tabs/`. No production build was run for this local workspace change.

## Performance Pad studies

`layout-lab-tab-01-panel` owns five locally rendered rows: Edge glow, Signal strip, Hardware keys, Cut corners and Type grid. Each row has the same four fixtures: Reactor, Drop Cage, Infinity and Tunnel. These compare perimeter lighting, side markers, raised keycaps, angular scan-line frames and open typographic dividers at a consistent tile size. The empty-pad column and right-aligned descriptions have been removed. Clicking an assigned pad changes only that row's local selected styling; no production component, store or performance action is used.

`data-pad-study` identifies each design (`edge`, `signal`, `hardware`, `cut`, `type`); `data-pad-study-item` identifies a particular tile, such as `signal-drop-cage`. The entire gallery remains attached to tab ID `layout-lab-tab-01` when its label changes.

Pad-study validation: all five rows were visually reviewed in the running native Layout Lab window. Five focused tab/popup tests and focused ESLint passed, including four pads per row, independent selection and content identity after a tab rename.

Changes remain uncommitted unless separately requested.
