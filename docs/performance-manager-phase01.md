# Performance Manager — Phase 1

Performance Manager is a new left-navigation workspace in the existing
ApplicationWorkspaceFrame. Its pad-grid icon uses the shared AppIcon system.
The shared application header/status cluster, RailWindowHeader, RailTabs,
WorkspaceRail, preset cards/search/scope controls and VyzualzAudioDock are reused.

## Phase 1 behavior

- The left window has ENGINE and two disabled placeholder tabs. ENGINE lists all
  seven currently selectable engines in a two-column grid: Cinema 2.0, Sound
  Drawing, Sound Drawing XY, CANVAS, LaserDMX, PixGrid and HEADLINER. Retired
  Shader Pads/Cinema identities are not resurrected. Cards reuse React’s engine
  dropdown blueprint artwork, themed surfaces and shared identity typography,
  with wrapped names and a highlighted selected border in the two-column grid.
- The main area mirrors the current twenty performance pads from the live store,
  including labels, colors, active state and contextual engine actions. It
  subscribes to the same state as React. Its mirror mode does not fire actions,
  switch presets or install keyboard triggers. Engine browsing does not replace
  the live engine used to resolve the mirrored pad group.
- The lower area is an empty Configuration surface with the canonical window
  title bar. It has no editor or assignment functionality in this phase.
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
responsive widths, collapse identity, shared dock and sidebar routing.

Focused tests cover typed routes, navigation/portal ownership and the existing
cross-engine pads. The older ReactPerformancePads test file has two stale
Reactive Constellation action expectations tied to a retired engine and remains
outside the green focused pass. Real audio hardware and authenticated account
preset discovery are not certified by this local UI phase.

Later phases may define assignment/editing, banks and persistence. They are not
implemented here. No commit was requested; changes remain uncommitted.

Executed acceptance: 31 focused route/shell/cross-engine pad tests passed; the
real browser passed 12 behavior checks across seven engines and 1588×960,
954×844 and 800×844. It measured the search row at 163px from the right-window
origin in both React and Performance Manager, with no page errors. The reviewed
narrow layout retains a 64px minimum preset tile height. Focused ESLint and the
production TypeScript/Vite build passed. No live-account or physical audio-device
validation was performed, and repository-wide known failures were not rerun.
