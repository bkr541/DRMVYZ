# Layout Lab blank canvas

Layout Lab opens a blank canvas shaped like the React View: an **empty left window**, an **empty middle visualizer**, an **empty right window**, and the **bottom audio dock**.

There are no dropdowns or other selectors anywhere: no design picker, no engine picker, no inspector tabs, and no title bar. The windows and visualizer contain no content, and the rails have no collapse handles.

The dock is the existing disconnected dock mockup (`TemplateAudioDockMockup`), which uses the production dock classes and has local-only state. It is placed outside the three-region grid and spans the full width, as in production. It contains no dropdowns. The shell carries `ll-template-audio-theme`, the scoped stylesheet this dock mockup was authored against; without it the production dock grid (which expects a Source control the mockup does not have) misplaces the TAP / CUE / SYNC keys.

The canvas mounts no production rendering, audio, or media runtimes and makes no changes to saved projects. Closing Layout Lab discards its local state.

Structure lives in `LayoutLabDesignWorkbench.tsx`; popup stylesheet mirroring (`LayoutLabModal.tsx`) is unchanged. The earlier component studies and workspace previews (`LayoutLabReferenceMockup`) remain in the source as references and are no longer mounted by Layout Lab.

`__tests__/LayoutLabDesignWorkbench.test.tsx` covers the absence of any dropdown, tabs or selector roles, the three empty regions above the dock, and the absence of canvas, audio and video elements.
