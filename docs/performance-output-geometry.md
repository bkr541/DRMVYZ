# Performance output geometry

An active managed cast owns the visualizer's aspect ratio, not the React workspace. The existing engine remains mounted; its stage has fixed logical dimensions and the operator preview is scaled uniformly to fit the available center area. Left/right rail changes, Stage Focus, timeline changes and application resizing only affect preview scale. No second engine renderer is created. When output ends the stage returns to responsive sizing.

`performanceOutputGeometry.ts` defines all six profiles. WebRTC and Google Cast allocate their respective fixed relay canvases before capture; neither may resize the relay based on a source frame. The native WebRTC registration message carries the validated aspect ratio for that session. The geometry is set before a direct cast or retry and from the managed session for Google Cast picker sessions. Source frames that are not yet ready or whose aspect differs materially are withheld; the relay keeps its last valid picture (initially black). This avoids stretching or showing an incorrectly framed engine during a handoff. Renderer quality scales may still reduce allocation; integer rounding is tolerated. A locked viewport caps effective render DPR at 1 to avoid rendering above the logical output resolution on Retina/high-DPI operator displays. Transitions invalidate old-format snapshots, use exact-ratio bounded canvases and wait for compatible source frames.

| Aspect | WebRTC relay / logical viewport | Google Cast relay |
|---|---|---|
| 16:9 | 1920x1080 | 1280x720 |
| 16:10 | 1728x1080 | 1152x720 |
| 4:3 | 1440x1080 | 960x720 |
| 3:2 | 1620x1080 | 1080x720 |
| 1:1 | 1080x1080 | 720x720 |
| 9:16 | 1080x1920 | 720x1280 |

Engine renderers must measure via `measurePerformanceSurface` when reading a stage's CSS dimensions; transformed `getBoundingClientRect()` dimensions are presentation coordinates only. Pointer interaction still uses screen-space rects and converts back to logical coordinates where needed. Physical LaserDMX fixture output is not changed. OS-level whole-desktop mirroring is outside the managed cast contract: use an extended display and choose its managed output target. A differently shaped physical screen may have intentional letterbox/pillarbox space. The receiver must contain, never stretch, the program frame.

## Regression checks

Run `npm run typecheck`, `npm run build`, the output and stage transition Vitest tests and `node --test native/output/*.test.cjs`. On actual hardware, cast each format to a local display, STAGELESS receiver and Google Cast where configured. Record transport frame dimensions and compare a static reference composition across all rail combinations, timeline resizing, Stage Focus, desktop window resizing, engine/preset swaps, preset transitions, page navigation, pause/live input and cast recovery. Check that both picture geometry and transport session are unchanged by layout changes, that the correct format returns after retry, and that stopping restores normal responsive behavior. Check GPU/FPS on the performance machine; the fixed logical viewport uses the WebRTC profile while renderer quality scales and existing load-shedding policies remain in effect.
