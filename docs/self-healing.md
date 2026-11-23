# Self-healing, HEALTH chips and the red alert frame

During a performance, a problem the operator is not looking at is a problem that is not noticed. Three things make failures visible and fix the common ones without the operator.

## HEALTH chips (header status group)

`HealthReadout` is the fourth readout in the header's status group (after LOAD / SAVE, RENDER / FPS, QUALITY / CPU), on every page that shows the group. One chip each for **CAST**, **AUDIO** and **GFX**, in the readout's existing typography roles (no new font rules). The light:

| State | Meaning | Light |
| --- | --- | --- |
| idle | nothing to watch (no cast running) | dim grey |
| ok | working | green |
| degraded | working at reduced quality (shared performance pressure above 0) | amber |
| healing | failed a moment ago; being repaired | amber, pulsing |
| failed | automatic repair gave up | red |

Hovering the readout lists each system with its detail. State lives in `src/stores/healthStore.ts`; only `src/lib/selfHealing.ts` writes it.

## Self-healing

| System | Detector | Repair | Gives up |
| --- | --- | --- | --- |
| Cast (`castSelfHealing.ts`, `OutputCastControl.tsx`) | the session reports `failed` | restarts the cast the user started, same target, window mode and aspect ratio | after 3 tries (1.5 s, 4 s, 10 s) |
| Audio output (`audioSelfHealing.ts`, `useAudioEngine.ts`) | the AudioContext was running and stopped | resumes it | after 3 tries |
| Audio track (same) | the media element fails to load a track | loads the same file once more after 1.5 s; the error is shown only if that also fails | after 1 retry |
| Graphics (`graphicsSelfHealing.ts`, `Cinema2Stage.tsx`) | the stage reports `unavailable`, or `context-lost` for 8 s | rebuilds the stage | after 3 tries |
| Graphics process (`rendererRecovery.ts`) | main reports the GPU process died | the engines rebuild their own contexts; shown as a repair for 8 s | n/a |

It never acts on something the user did: a stop, closing the cast control, a session that simply ended, or an audio context that has not started yet (waiting for the first click). Freeze recovery (`docs/performance-recovery.md`) is separate and unchanged.

## Notices

Each episode posts one **Self-healing started: ...** warning in the Notifications tab, then one **Self-healing complete: ...** success when the system works again, or one error if it could not be fixed. Retries do not post again.

## Red alert frame

While any system is `healing` or `failed`, `<html data-health-alert>` is set (`healthAlertFrame.ts`) and `src/styles/healthAlert.css` draws a pulsing red frame around the visualizer panel and along the left rail, including its curved notch (it recolours the rail's existing edge stroke). It is an overlay: nothing moves or resizes. `prefers-reduced-motion` turns the pulse off. Reduced quality alone does not trigger it.

## Checking it

- `src/lib/selfHealing.test.ts` covers reporting, the alert attribute, cast reconnect (including a user stop), audio resume and track retry, and graphics rebuild, with fake timers.
- `src/test/browser/health-chips.html` renders the real header cluster, the notched rail and the stage panel with the app's stylesheets; set states from the console with `window.__health.beginHealing('cast', 'x')`, `markFailed`, `markHealed`.
