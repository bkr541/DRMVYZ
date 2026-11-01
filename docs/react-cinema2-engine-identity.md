# React Cinema 2.0 engine identity

The Cinema 2.0 engine selector in the React left rail follows the supplied blueprint reference: a cyan hairline frame over a dark technical grid, a decorative wireframe cube on the left, an Engine eyebrow, a bold uppercase engine name, and the current preset right-aligned beneath it.

`ReactEngineBrowser` keeps the existing engine picker behavior and accessible selection label. The preset name remains live data; long names truncate visually and retain their full text in the tooltip and accessible button label. The decorative SVG is hidden from accessibility APIs. Other engines retain their existing appearance.

Layout and artwork rules live in `src/styles/reactView.css`; the display typography roles live in `src/styles/typography.css`. The title scales with the selector's available width.

Validation: seven Cinema 2.0 production-path tests, focused ESLint, and 351 shared typography browser checks passed. The actual selector was visually reviewed at compact, normal and wide widths with short and long preset names; menu switching and Escape dismissal were also checked in Chromium.
