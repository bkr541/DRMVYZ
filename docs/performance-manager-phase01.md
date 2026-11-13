# Performance Manager — Phase 1

Performance Manager is a new left-navigation workspace in the existing
ApplicationWorkspaceFrame. Its pad-grid icon uses the shared AppIcon system.
The shared application header/status cluster, RailWindowHeader, RailTabs,
WorkspaceRail, preset cards/search/scope controls and VyzualzAudioDock are reused.

## Current behavior

- Tab rows reuse React’s actual left/right layouts: the left uses `rv-workspace-tabs-wrap` and `rv-context-workspace-tabs` (7px internal padding, 18px gap); the right uses `rv-main-workspace-tabs` (22px gap). Both keep React’s normal 12px rail content inset, shared 25px top padding, centred labels and underline treatment. No Performance Manager tab geometry override remains.
- The left engine grid starts 18px below its tab row, matching Lyric Manager after removal of its 12px tab-bottom margin (8px panel inset + shared 10px library-body spacing).
- The left window has ENGINE and two disabled placeholder tabs. ENGINE lists all
  seven currently selectable engines in a two-column grid: Cinema 2.0, Sound
  Drawing, Sound Drawing XY, CANVAS, LaserDMX, PixGrid and HEADLINER. Retired
  Shader Pads/Cinema identities are not resurrected. Cards reuse React’s engine
  dropdown blueprint artwork, themed surfaces and shared identity typography,
  with wrapped names and the same selected outline/glow as shared preset poster cards.
- The main area edits the shared performance pad slots, initially twenty. Its expanded presentation uses the store-free `PerformancePad` element with stable slot accents, transparent empty pads, centered preset-card titles and outlined background shortcuts. Clicking a pad selects it for management without performing it or installing live keyboard triggers. Engine browsing stays local; explicit linking changes shared assignments only after confirmation.
- The lower area is an empty Configuration surface, 48px taller than its original 26% allocation (including a minimum height increase from 140px to 188px), with the canonical window
  title bar. It remains a blank canvas; assignment editing happens through the pad window and header actions.
- The right window has PRESETS, EDIT and one disabled placeholder. EDIT is empty.
  PRESETS filters the canonical engine definitions with the shared account scope
  and discovery search. Cinema uses the current native registry; Sound Drawing
  and PixGrid use live React presets; XY uses its own catalog; CANVAS, LaserDMX
  and Headliner reuse the Preset Manager's canonical source adapters. LaserDMX
  follows React's current Beam Matrix/Show Director mode. The search sits below
  SYSTEM/USER in the same rail structure as React's Cinema preset browser.
- Clicking a preset highlights it locally. It does not apply the preset, start a
  visualizer, assign a pad or change live authored state. Search and selection
  are local to the workspace session. No new cloud schema or save action exists.
- React's existing dock is mounted once, with expandable deck waveform and audio
  source controls. It uses the existing audio context/transport. Its waveform is
  the only canvas in this workspace; the main area has no visualizer renderer.
- Existing guarded navigation applies when entering from a dirty media, text or
  lyric editor. The new workspace has its own activity/notification page ID.

## Layout and ownership

The floating React geometry also applies to Performance Manager: equal side
rails, shared gap/insets, collapse handles, responsive rail sizes and a full-width
normal-flow second-row audio dock. Center content is a pad window and a smaller
Configuration window. `performanceManager.css` owns only these content layouts,
not shared typography or duplicate dock positioning.

Primary files: `performanceManager/PerformanceManagerView.tsx`,
`styles/performanceManager.css`, typed routes/navigation and page-status maps.
`ReactPerformancePads` gains an opt-in mirror prop; its normal React behavior is
unchanged. No dependency or migration is added.

## Validation

Run `node scripts/verify-performance-manager.mjs` for the isolated real-browser
application-shell review, with local repository boundaries and no authentication.
Evidence is under ignored `artifacts/performance-manager-phase01/`. This checks
all seven engine browsers, search/selection isolation, live pad mirroring,
non-triggering mirror clicks/keys, blank Configuration/Edit and placeholder tabs,
responsive widths, collapse identity, shared dock and sidebar routing. It also checks assigned slot colors, transparent empty pads, centred expanded type, shortcuts, shared engine/preset selected styling and compact React pads.

Focused tests cover typed routes, navigation/portal ownership and the existing
cross-engine pads. The older ReactPerformancePads test file has two stale
Reactive Constellation action expectations tied to a retired engine and remains
outside the green focused pass. Real audio hardware and authenticated account
preset discovery are not certified by this local UI phase.

Later phases may define assignment/editing, banks and persistence. They are not
implemented here. No commit was requested; changes remain uncommitted.

Original Phase 1 acceptance: 31 focused route/shell/cross-engine pad tests passed; the
real browser passed 12 behavior checks across seven engines and 1588×960,
954×844 and 800×844. It measured the search row at 163px from the right-window
origin in both React and Performance Manager, with no page errors. The reviewed
narrow layout retains a 64px minimum preset tile height. Focused ESLint and the
production TypeScript/Vite build passed. No live-account or physical audio-device
validation was performed, and repository-wide known failures were not rerun.

Styling update acceptance: 7 cross-engine pad tests, 13 real-browser behavior
checks and focused ESLint passed. The production TypeScript/Vite build passed before the final tab/empty-pad correction and was not rerun for that correction. Browser
checks cover 1588×960, 1280×844 and 1180×844 (the desktop app’s minimum width); stable standard colors for assigned slots and transparent empty pads;
12–18px centred labels with 11px shortcuts below; main tabs matching measured React row/button CSS and rail-relative geometry;
engine/preset selection parity; compact React pad typography; and the portaled
engine dropdown. Updated screenshots are in the same ignored evidence directory.

React parity correction: the browser check now measures the real React left and
right tab rows at each supported desktop review width and compares Performance Manager against
those measurements, including padding, margins, gaps, font, flex sizing, row
width, height, side insets and label centring. Empty pads are explicitly checked
for transparent backgrounds and no slot color. The additional 48px Configuration
height and scrolling, non-overlapping pad rows are retained.

## Reusable production pad

`react/controls/PerformancePad.tsx` owns only rendering, pointer/keyboard press
feedback and activation callbacks. `ReactPerformancePads` owns assignments,
contextual action routing and physical shortcut-key state. Performance Manager
uses its read-only mirror mode; React uses the live mode. The manager uses expanded density: preset-title typography, outlined background
numbers, 8px corners and 94px-minimum rows. Its base surface is #10171b, slightly darker than the group background; selected pads mix their accent into that same dark base. React uses compact density, preserving
its original 40px-minimum cards, 8px embedded grid padding, 5px corners, 8.5px
labels. React’s reusable compact pads now follow Layout Lab’s Accent Rail: left-aligned white titles, an inset vertical color marker and a 32px outlined shortcut, right-aligned and vertically centered. Both densities share activation and fast strike handling.

Layout Lab remains an independent study, with no production component import.
The existing compact/expanded API explicitly selects these two presentations. Empty slots remain transparent and disabled. Performance Manager uses an 8px gap between pads; React retains its compact 4px gap.

Compact correction validation: the browser compared React's rendered pads with
an inert reference using the original repository CSS. Both measured exactly
147.796875×40px at 1600×1000. The same check retained manager/Lab row-02 parity
at two widths, keyboard release and inert manager activation. Eleven focused
component/cross-engine tests and focused lint passed. The earlier broader action
suite has an unrelated jsdom contentEditable assertion failure; it was not rerun.

Accent Rail production validation: 11 focused component/engine tests and focused ESLint passed. Browser comparisons at 1600×1000, 1280×844 and 1180×844 verified matching normal/selected colors, card geometry, typography, inset marker and right-aligned vertically centered numbers against the Lab study. A focused final check verified matching press halos and immediate pointer/shortcut release. Expanded Full typography and corners were retained. Screenshot: `artifacts/layout-lab-tabs/react-accent-rail.png` (ignored).

Reusable pad border contrast: compact and expanded pads use a 25% white border (`#ffffff40`) normally and a 44% white border (`#ffffff70`) when selected, giving clearer separation from the dark surface. The bright press border and pad geometry are retained. Focused CSS and diff checks passed.

## Shared assignment workflow and toolbar

The canonical `HeaderControlGroup` places Add, Clear, Clear all, Delete and Reset immediately after the brand divider, using `HeaderIconKey` and shared header action glyphs.

- Add links the selected preset to the selected pad, or the first empty pad, through the same confirmation flow. With no selected preset, it restores the next missing default slot; otherwise it explains how to select or drag a preset.
- Clear unlinks the selected pad. Clear all confirms before clearing every assignment while keeping the slots.
- Delete confirms before removing the selected pad slot. Add can restore a missing slot. Reset confirms before restoring the default layout and assignments.

Preset cards in the right rail carry a typed drag payload containing engine and preset IDs. Drops on assigned or empty pads resolve the current canonical preset and open the standard `ConfirmDialog`, naming the preset and pad shortcut. Cancel leaves assignments unchanged. Link updates the persisted `reactStore.performancePads` entry; browsing and linking do not activate the preset. Target and catalog membership are checked again on confirmation. Invalid drops and unavailable presets produce an error notice.

Cinema 2.0 and native CANVAS, HEADLINER, Sound Drawing XY and LaserDMX destinations are supported alongside live React preset IDs (including Sound Drawing and PixGrid). Native destinations are validated and use their existing store activation actions when performed. Explicit assignments take precedence over contextual engine actions for both clicks and shortcuts. The saved `assignmentOverridesAction` flag preserves this choice across navigation and persistence.

`notify('performance-manager', ...)` records review, cancellation, success and failure cards in the existing Notifications drawer and unread bell system. The confirmation also uses the standard informational NoticeCard to explain the shared assignment. No new notification UI or cloud schema is introduced.

Validation: 19 focused component, workflow and engine tests passed, as did TypeScript, focused ESLint and diff checks. The real browser workflow verified the five canonical header keys after the divider, empty/assigned pad drops, Cancel/Link, workflow cards in Notifications, shared React activation, and a CANVAS link overriding contextual pad actions. Reviewed screenshots: `artifacts/performance-manager-phase01/pad-link-confirm.png` and `pad-link-notifications.png` (ignored). No production build was run. Changes are uncommitted.
