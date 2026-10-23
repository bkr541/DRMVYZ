# Phase 4 production-canvas evidence

Generated 2026-10-22 with Node 22, headless Chromium ANGLE SwiftShader. These are actual Cinema2Stage/VyzualzView captures using the normal BLOCKSHIFT catalog entry and supplied GLBs.

- `production-inspector.png`: normal workspace, approved close-up field preserved. Camera controls are farther down the Inspector under Effects > Camera.
- `fov-60.png`, `fov-100.png`: stopped normal-workspace output with Camera Motion OFF, different manual lens values.
- `pattern-filmstrip.png`: two output frames per pattern, left-to-right in named pairs, camera OFF, continuous pattern motion ON.
- `transition-filmstrip.png`: Stack→Orbit and Split→Collapse start/middle/end frames.
- `phase4-motion.webm`: continuous actual Stage recording covering all six patterns, two transitions, camera motion and freeze checks.
- `acceptance.json`: normal chooser, model fetches, three static aspects, real GPU uploads/draws and disposal/re-entry checks; includes camera Inspector/persistence and motion results.
- `motion-acceptance.json`: focused transport-fixture results; no analyzed music or fabricated musical events.
- `tests.log`, `lint.log`, `camera-lint.log`, `types.log`, `browser.log`: validation output. An empty lint log means success; scoped types have zero changed-file errors and nine dependency diagnostics.

The host fixture uses real production timing/runtime paths at authored 180 BPM. It proves movement/control behavior, not music analysis or hardware performance. The recording has a stationary camera during six-pattern comparisons; later it enables float. Cropped and temporarily off-screen objects belong to the surrounding field. Human motion/visual acceptance remains pending.
