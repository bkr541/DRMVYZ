# Layout Lab design workbench

Layout Lab opens a fresh, empty canvas. Its **Design** dropdown contains five enabled options: **Design One**, **Design Two**, **Design Three**, **Design Four**, and **Design Five**. Design One is selected initially.

Each option owns a separate blank canvas. Switching designs shows the selected canvas and hides the others, keeping their mounted elements independent. The canvas contains no component studies, workspace previews, inspector panels, timeline, or transport. The toolbar contains only the Layout Lab title and the design selector.

The workbench mounts no production rendering or audio runtimes and makes no changes to saved projects. Closing Layout Lab discards its local selection.

The options are defined in `layoutLabDesignCatalog.ts`; canvas structure and styling live in `LayoutLabDesignWorkbench.tsx` and `layoutLabDesignWorkbench.css`. Earlier component studies and workspace preview modules remain in the source as references and are no longer mounted by Layout Lab. Popup stylesheet mirroring remains in place.

Focused workbench tests cover the blank initial state, exact dropdown labels, all five enabled options, and switching between independent empty canvases, including returning to Design One.
