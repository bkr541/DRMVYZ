# Layout Lab blank canvas

Layout Lab opens from the existing application launcher into a separate 1600×1000 window. Its content is a single empty dark canvas. There are no headers, navigation, rails, tabs, controls, docks, galleries, design options, renderers, or media inside it.

`LayoutLabMockup.tsx` has no imports or state. `LayoutLabModal.tsx` only manages the popup and its React portal; it does not copy application styles or theme state. Closing the window or pressing Escape returns to the application. A blocked popup dismisses the launcher state.

The previous `layoutLab/` mockup directory and its tests were removed. Production did not import those mockups; their dependencies pointed outward to shared production controls and feature panels. Those production components are preserved. Icon coverage now keeps its inventory with shared icon test fixtures, and dock empty-space tests exercise the production helper directly. Production verification scripts no longer import deleted Lab samples.

The other `layout-lab-*.md` documents are archived descriptions of removed studies.

Validation: 25 focused popup, application-frame, icon and dock tests passed, covering the blank canvas, stylesheet isolation, popup closing and preserved production behavior. TypeScript checking, focused ESLint and diff whitespace checks passed. No production build or native-window visual review was run for this removal.

Changes remain uncommitted unless separately requested.
