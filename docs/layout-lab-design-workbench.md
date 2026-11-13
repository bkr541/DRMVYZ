# Layout Lab tab workspace

Layout Lab opens from the existing application launcher into a separate 1600×1000 window. Its outer canvas has 48px top/bottom padding and 128px left/right padding. It contains seven standard underline tabs. The first permanent slot, currently named Performance Pad, contains Full and four compact variations; the other six panels are empty. It mounts no production feature components, stores, audio services or renderers. Shared canonical-control, tab-spacing and typography CSS is injected into the popup explicitly; application styles and theme state are not mirrored.

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

`layout-lab-tab-01-panel` contains **Full** (the former row 02) followed by four compact variations: **Compact**, **Underline**, **Accent Rail**, and **Glow**. The previously removed rows 01, 03, 04 and 05 remain removed. The remaining row retains its stable `data-pad-study="signal"` identity and four fixtures: Reactor, Drop Cage, Infinity and Tunnel. Individual pads retain IDs such as `signal-drop-cage`. Renaming the tab does not change these references.

The centered row retains its existing dimensions, rounded corners, preset-card titles, oversized outlined background numbers and horizontal colored accent. The accent is pad height minus 34px long, 2px thick and positioned at 50% + 16px. Its styling remains local to Layout Lab, with no production component, store or performance action imports.

Pointer-down and held Space/Enter show an immediate perimeter halo. Release clears the strike immediately with a 60ms CSS fade. Cancellation, focus loss and unmount clear pending feedback; assistive clicks receive a 40ms pulse. Clicking selects a pad locally.

The production `PerformancePad` component remains separate. Removing these Lab rows does not change Performance Manager or React pads.

The four new rows use React's compact 40px outer height, 5px corners and responsive pad width at the same viewport with the standard collapsed app navigation and expanded side rails. Their independent sizing accounts for React's 8px grid inset and 4px gaps, rather than Full's 20px inset. Each row contains four fixtures at actual size, centered without stretching. Labels use the shared compact pad typography role. All four retain Full's dark surface, colored signal and decorative outlined shortcut, with centered, long-underline, inset-rail and glass-glow variations. Stable row IDs are `compact`, `underline`, `accent-rail` and `glow`; local selection and instant press previews are independent per row. No production components are imported.

Validation: six focused pad/tab tests, focused ESLint and diff checks passed. Browser comparisons against actual React pads passed at 1600×1000 (147.796875×40px), 1280×844 (111.953125×40px), and 1180×844 (100.75×40px), with matching 5px corners and 8.5px labels. Pointer and keyboard release passed for all four new rows. The reviewed screenshot is `artifacts/layout-lab-tabs/compact-full-variations.png` (ignored).

Full retains its original right-aligned, vertically centered numeral. Number placements differ across the compact rows: Compact centers its background numeral horizontally and vertically; Underline uses a cropped lower-center numeral; Accent Rail keeps its numeral right-aligned and vertically centered; Glow uses a cropped upper-center numeral. Titles, signals, pad dimensions and production pads are unchanged.

Number placement validation: the browser verified the compact watermark anchors and retained compact heights at 1600×1000 and 1180×844. The final screenshot was reviewed at `artifacts/layout-lab-tabs/pad-number-placements.png` (ignored); diff checks passed.

Correction: Full's original numeral placement is restored (right: 4px, top: 50%, translateY(-50%)). Only the four compact studies use the new placements. A focused CSS comparison verified the Full rule matches its original declaration and the compact rules remain intact.

Compact placement adjustment: its background character uses left/top 50% with translate(-50%, -50%). Full and the other compact variations retain their existing placements. Focused CSS and diff checks passed.

Accent Rail adjustment: its background numbers remain right-aligned at 4px and float vertically in the middle using top: 50% and translateY(-50%). Other rows retain their existing placement. Focused CSS and diff checks passed.

React's existing store-free `PerformancePad` now uses Accent Rail for compact density: 40px height, 5px corners, left-aligned 8.5px titles, a 2px vertical inset marker, and a 32px outlined shortcut at right: 4px/top: 50%. Compact and Lab type roles share canonical typography rules. Expanded density retains Performance Manager's Full styling. The Lab continues rendering its own isolated mockups; it imports no production pad component.

Accent Rail production validation: 11 focused component/engine tests and focused ESLint passed. Browser comparisons at 1600×1000, 1280×844 and 1180×844 verified matching normal/selected colors, card geometry, typography, inset marker and right-aligned vertically centered numbers against the Lab study. A focused final check verified matching press halos and immediate pointer/shortcut release. Expanded Full typography and corners were retained. Screenshot: `artifacts/layout-lab-tabs/react-accent-rail.png` (ignored).
