# Stable React header readouts

The React header status stacks reserve fixed label/value columns and two rows.
Quality, FPS, frame time, CPU and persistence updates no longer change stack
widths or move adjacent controls. Loading stays in the first row even when the
Saved row is initially absent. Save-error retry actions have a fixed slot.

Unusually long readouts ellipsize within their slot while existing title/ARIA
text preserves the full reading. Existing shared font families, sizes, weights
and tabular numeral styling are retained. Other workspaces' status chips are
unaffected because the layout is scoped to `.rv-header-status-stack`.

Validation: eight existing focused component tests passed. Run
`node scripts/verify-react-header-stability.mjs` for real Chrome measurements:
18 telemetry/persistence combinations at 1440, 1280 and 1024 pixels, plus two
CPU updates. It compares label, stack and adjacent-control rectangles, captures
shared typography, and saves screenshots/report under the ignored
`artifacts/react-header-stability/` directory. All 20 checks passed with no page
errors. Focused lint and diff whitespace checks passed. No commit was requested.

The spacing was subsequently tightened in response to visual review: row padding
is 4px per side, label/value and stack gaps are 5px, and the reserved value widths
are 128px (save state), 68px (FPS/frame time), and 50px (quality/CPU). This removes
104px of excess cluster width while preserving the fixed layout. All 20 browser
checks passed again, including full visibility of normal quality/save values.
Shared typography is unchanged. Lint and diff whitespace checks passed; changes
remain uncommitted.

The React engine selector briefly sat at the horizontal centre of the top header.
It has been moved back into the left React window, above the tab row, and the
header-only placement variant and its CSS were removed. The header now holds only
the left action toolbar and the right status cluster.

Selector relocation validation: 89 browser checks passed, including centering and
telemetry clearance at 1440/1280/1024px, shared typography, engine selection, Escape
and outside-click dismissal. The rendered header screenshot was reviewed. TypeScript,
focused lint and diff checks passed (ReactView retains its existing recorder hook warning).

React's right-side readings now inherit the same shared 28px bordered chip surfaces,
subtle background, rounded corners and typography as the Lyric Manager CPU/activity
controls. The compact two-row arrangement, fixed label/value columns, live readings,
state colors and save retry behavior are preserved. React-specific rules that stripped
those chip surfaces and enlarged their value typography have been removed.

Style alignment validation: 10 focused component tests passed. Browser verification
compared React's chip surface, sizing and typography directly with the production
Lyric Manager CPU chip and passed all 90 checks. All 18 telemetry/save-state stability
cases and both CPU updates passed, including retry states. Screenshot reviewed;
focused lint and diff checks passed. Changes remain uncommitted.

## Current header presentation: Layout Lab Option E

The React status area now follows Option E's `OptionEHeader` readouts: LOAD / SAVE,
RENDER / FPS and QUALITY / CPU. Each group has a 37px high surface with only a left
separator, an 8px caption and paired 11px primary/10px secondary values. The previous
stacked chip presentation is superseded. Shared readout typography roles live in
`src/styles/typography.css`. Fixed group widths preserve layout stability and leave
the engine selector centered. Loading, dirty/saving/saved states, timestamps, CPU,
FPS, measured frame time and quality remain live; errors retain Retry and their
notification notice. Idle reads Ready rather than claiming a successful save.

Option E validation: 91 browser checks passed, including direct comparisons against
its actual rendered readout dividers, sizing and typography. Header centering and
clearance passed at 1440/1280/1024px; screenshot reviewed. All 18 state/telemetry
stability cases, two CPU updates and five focused component/save-retry tests passed.
Focused lint and whitespace checks passed. Changes remain uncommitted.
