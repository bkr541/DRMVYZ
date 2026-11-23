# Performance pressure, cast load shedding and freeze recovery

The engines already lower their own quality when their frame rate drops (Cinema 2.0's Auto quality, PixGrid's adaptive quality). Both measure frames **inside their render loop**, so they can react to a loop that is slow but not to one that has stopped, and neither sees what the cast stream or the GPU process is doing. This adds three things that watch from outside.

## 1. Shared performance pressure (`src/lib/performancePressure.ts`)

One signal, three levels: `0` none, `1` elevated, `2` severe. Sources (`cast`, `gpu`, `recovery`) set or clear their own level; the app uses the highest. A source can pass `holdMs`, so a source that dies without clearing never leaves the app degraded for good.

| Consumer | Level 1 | Level 2 |
| --- | --- | --- |
| Cinema 2.0 **Auto** quality (`Cinema2PerformanceDiagnostics.getPolicy`) | at most Medium | Low |
| PixGrid **Adaptive** quality (`PixGridAdaptiveQualityController`) | at least stage 1 (effects reduced) | stage 3 (logical resolution lowered) |
| WebRTC cast relay (`bindCadenceToPressure`) | unchanged | at most 30 fps copied and encoded |

Pressure only lowers quality, and never overrides an explicit choice: Cinema 2.0's Performance/Balanced/Quality modes and PixGrid's Fixed mode ignore it. When it ends, the engines return to where their own frame-rate logic has them.

## 2. Cast load shedding (`src/lib/castLoadShedding.ts`, `OutputCastControl.tsx`)

A WebRTC cast whose measured frame rate falls well below what the relay is asked for means the GPU is rendering, copying and encoding more than it can. `CastLoadShedder` turns the stats the cast already reports (about every 2 s) into a level: poor (< 75 % of the target) twice in a row steps up, severe (< 40 %) twice in a row goes to level 2, and four healthy samples (>= 90 %) step down one level. It judges against the relay's **current** target (60 fps, or 30 at level 2), so the halved relay is not itself read as a failure. A hidden window and unknown readings are ignored. Google Cast is not measured (its reported rate is the configured one). Each change is logged as a `load-shedding` event.

## 3. Freeze recovery (`native/system/rendererRecovery.cjs`, `src/lib/rendererRecovery.ts`)

Electron's main process used to only log `renderer unresponsive`, `render-process-gone` and a dead GPU process. Now, for the main window:

- the renderer stays unresponsive for 10 s after Electron reports it (Chromium itself takes about 16 s to report a hang) -> the renderer process is ended and the window loads again;
- the renderer process is gone (crashed, killed, out of memory...) -> the window loads again (a clean exit is the window closing, not a failure);
- the GPU process dies while the renderer is unresponsive -> the window loads again at once;
- the GPU process dies and the renderer is fine -> nothing is reloaded (the engines recover their own graphics contexts); the renderer is told and holds level 1 for 60 s.

A recovery load adds `?recovery=<reason>` to the page address. The renderer reads it once, removes it (a manual reload is a normal start), and starts safely: it opens **Inertia** (the cheapest Cinema 2.0 preset in the app's own render telemetry, about 2 ms a frame against 5-6 ms for the default) and holds level 2 for 2 minutes, then posts a notice on the React page. The previous preset is not deleted; it is one click away in the Preset Manager. If Inertia is ever renamed, `recoverySafePresetIsAvailable()` (tested) fails and a recovery start falls back to reduced quality on the current preset.

Safeguards: at most 3 recoveries in 5 minutes (after that the window is left as it is and one error is logged); nothing is recovered while the app is quitting; `DRMVYZ_RENDERER_RECOVERY=off` turns recovery off. Recovery and its reasons are logged under `system:recovery`.

## Checking it

- `node --test native/system/rendererRecovery.test.cjs` covers the main-process rules with a fake window.
- The real behavior was checked on Electron 43 by hanging a visible renderer in an endless loop: it was reported unresponsive after about 16.5 s, then terminated and reloaded in about 0.1 s. A hidden window is never reported unresponsive (Chromium only watches a window that is on screen), so a test of this has to show the window and keep sending input.
- `src/lib/rendererRecovery.store.test.tsx` runs the safe start against the real React store.
