# Layout Lab design workbench

Layout Lab now opens a full workspace preview. Use **Design** in the upper-left toolbar to switch between **Current app** and **Design 01 — Audio Library**. Slots **Design 02–05** are disabled and explicitly marked *Awaiting reference*. They are extension points, not five invented visual directions.

Use **Workspace** to choose **Cinema 2.0**, **Lyric Manager**, or **Component reference**. The reference workspace retains the existing Template component studies, the three middle audio studies and the empty Cinema reference layout. Design comparison is disabled while viewing that legacy reference.

## Production components and state

Cinema uses the production `Cinema2Runtime`, `Cinema2InspectorPanel`, `Cinema2PresetsPanel`, `Cinema2LayersPanel` and runtime diagnostics. A private registry contains a small set of real first-party manifests plus one clearly labeled local saved-preset fixture. Shader/3D rendering, parameter controls, groups, preset scope/search and effects are the actual implementations. Source includes production audio-track cards with local callbacks and a local SVG for the preset's first media slot. Enable Media on Screens in Design to see it on VACANCY.

Lyric Manager uses production track browsing, version cards, live lyric preview, cue timeline, Cue inspector, document presentation controls, inspector tabs and review summary. Selection, cue text/timing/style, document defaults, version rename/duplicate/activation and sample-track removal use local fixture state. The small center cue selector is preview composition around these production components. This does not mount the live lyric store/editor workflow.

The bottom transport uses the shared track scrubber, button and icon components. It advances sample timeline time and lyric highlighting; it produces no audio. It does not load or play real saved tracks. AI extraction and external performance-output navigation are unavailable in this preview.

Design switching changes CSS classes on the same mounted workspace. It does not recreate the Cinema runtime, clear parameter edits, reset selected presets or remount the lyric inspector. Visited workspaces stay mounted when hidden; Cinema suspends its runtime while inactive. Cinema parameter state is cached per preset for the preview lifetime. Closing Layout Lab discards the preview state.

The preview never writes saved presets, audio tracks, media or lyric documents. Cinema receives an isolated empty Audio Intelligence source. The optional `sharedAudioAnalysis` inspector prop defaults to true in production and is false in the preview, preventing the shared Audio Dock's analysis controls from being mounted there. The optional preset `catalog` supplies the private preview list; production's shared catalog remains the default.

## Themes and popup styling

The design catalog is `layoutLabDesignCatalog.ts`; each authored design declares its CSS class there. Workbench structure is `LayoutLabDesignWorkbench.tsx`. The two workspace compositions are `LayoutLabCinemaPreview.tsx` and `LayoutLabLyricPreview.tsx`. Design 01's scoped palette comes from `templateAudioTheme.css`, with production-workspace integration in `layoutLabDesignWorkbench.css`.

Additional designs should add a scoped theme stylesheet and a catalog class, then enable their existing slot after references have been implemented. Keep workspace JSX and fixture data shared across designs. Do not copy the production pages or create separate controls per theme.

The popup mirrors stylesheet additions/updates from the opener, including styles loaded by lazy workspace imports. Design attributes on the popup document allow portaled dropdowns and palette controls to receive the selected preview theme. Attributes and style observers are cleaned up when their owners unmount.

## Validation

- Unit checks cover real lyric groups, local edits preserved across baseline/Design 01 changes, unchanged audio/lyric stores, honest disabled slots, and lazy stylesheet mirroring.
- Existing Template reference and Cinema inspector tests pass.
- Browser acceptance covers the real VACANCY render and controls, local user-preset activation, baseline comparison without canvas replacement, three-column lyric layout, cue edits retained across design/workspace switching, and all four disabled future slots.
- TypeScript, focused lint, CSS parsing and diff checks pass.
- Captures are in ignored `artifacts/layout-lab-workbench/`: `cinema-design01.png`, `cinema-baseline.png` and `lyrics-design01.png`.

Only Cinema 2.0 and Lyric Manager have full preview compositions in this first foundation. Other engine workspaces can be added using the same pattern. Final visual acceptance remains with the user.
