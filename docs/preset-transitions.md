# Transitions between presets and engines

Changing what is on stage is a hard cut today: a preset change in any engine, or a switch from one engine to another, replaces the picture at once. This is the plan for blending instead, and what exists so far.

## Status

- **Done: the setting.** Settings > System Settings > **Transitions**: a **Transitions in React** toggle (off by default) and, when it is on, a **Style** dropdown with five styles (Dissolve, Flash, Wipe, Zoom, Dip to Black) and **Random**. Stored in the visual store as `transitionsEnabled` and `transitionStyle`, saved with the other System Settings and synced to the account (`user_settings.system_settings`; no migration, the column is JSON and unknown or missing keys are ignored or filled from the device).
- **Done: choosing the style for a change.** `src/lib/presetTransitions.ts` turns the setting into the style for one change with `resolvePresetTransition({ enabled, choice, override, previous })`. Random never repeats the previous style back to back.
- **Done (first version): the transitions.** With the toggle on, any change of what is on stage blends instead of cutting, for every engine and for engine-to-engine, and the operator's screen and the cast show the same blend.
  - `activeEnginePresetName.ts` (`resolveStageIdentity` / `useStageIdentity`): the engine plus its selected preset, as one value. `ReactView` passes it to the layer; any change starts a transition.
  - `StageTransitionLayer.tsx` (renders the blend canvas over the stage, picks the style with `resolvePresetTransition`, works out the length) and `StageTransitionController.ts` (the frame tap, the snapshot, the blend and its timing; frames are copied the way the cast relay copies them, see `output/relayFramePump.ts`).
  - `lib/stageTransition.ts`: the length in beats and the five drawings, as pure functions with tests.
  - The cast: while a transition runs `ReactView` gives `OutputCastControl` the blend canvas instead of the engine canvas, and switches back when it ends (the relay already follows a changed source).
  - Skipped on purpose: when the machine is overloaded (performance pressure level 2), and when nothing was drawn in the last 2.5 s (nothing to fade from). With reduced motion on, every style is a plain dissolve. A flash never lasts less than 300 ms and peaks below full white.
  - A second change straight after the first (an engine and then its preset, within 150 ms) is one transition; a later one continues from what is on screen.
  - The new picture is waited for before the blend starts (a preset still building, an engine that has no canvas yet), so a switch holds the old picture instead of showing a gap; after 0.9 s it runs anyway.
- **Length.** Each style lasts a number of beats (Dissolve 2, Dip 2, Flash 1, Wipe 1, Zoom 1), converted with the tempo and clamped to 150 ms-2.5 s. The tempo is used when it can be trusted: a track grid, Rekordbox or a manual tempo almost always; live analysis only at confidence 0.6 or more. Otherwise a loaded track's tempo (never for live input), otherwise a fixed 100 BPM (a beat is 600 ms).
- **Not done:**
  - **Starting on the beat** (quantizing). The blend starts when the change happens; see "Quantized start" below.
  - **Per-pad and per-cue overrides.** The resolver takes an override already; no pad or cue stores one yet.
  - **Recordings.** The recorder captures the engine's own canvas (a canvas stream cannot change source mid-recording), so a recording does not contain the blend.
  - **Measuring the cost.** Only checked in software-rendered Chromium, where it works but frames are too slow to judge cost. Watch frame time on the real GPU, with a cast running, before a gig.

## Per-pad and per-cue overrides (planned, designed for now)

Every caller must go through `resolvePresetTransition` instead of reading the setting, so overrides can be added without touching them. `PresetTransitionOverride` is `inherit` (follow the setting), `off` (a hard cut for this change) or a specific style or `random`. A pad or a cue would carry one of these. The **master switch wins**: with Transitions off in Settings, no override brings them back (a performer who turns them off gets hard cuts everywhere). When overrides are added, their editing UI belongs on the pad and on the cue, and their stored value must be validated with `isPresetTransitionOverride`.

## Design for the transitions

It must work for every engine and for engine-to-engine, and the operator's screen must show the blend, not only the cast.

- **One layer above the engines, not inside any renderer.** Every engine already hands the React view a single output canvas, and the stage, the cast relay and the recording all read it. A transition layer that blends two pictures into one canvas therefore covers all of them with no change to any engine.
- **Detecting a change.** One "what is on stage" key: the engine plus that engine's active preset (the same values `activeEnginePresetName.ts` already resolves). Any change to it, from a click, a pad, an automation cue, Show Manager or an engine switch, starts a transition from one place.
- **The outgoing picture.** A WebGL canvas cannot be read back after the fact, so a light frame tap keeps the last frame in a 2D canvas (about 15-20 fps, only while transitions are on). Cinema 2.0 and PixGrid already announce each finished frame for the cast (`lib/canvasFrameReadiness.ts`); the other engines draw to 2D canvases that can be read at any time. Measure the tap's cost on the real GPU before settling the rate.
- **The blend.** A 2D compositor canvas draws the snapshot and the live engine canvas for the length of the transition: dissolve (alpha), flash (additive), wipe (clip), zoom (scale and fade), dip (through black). While it runs the operator's view shows the compositor on top, and the cast and recording sources switch to it; when it ends they switch back, so there is no cost outside a transition.
- **Engine to engine.** The old surface unmounts and the new one mounts. The snapshot stays up until the new engine has produced its first frame (Cinema 2.0 has a first-frame flag; for the others the first announced or drawn frame, with a timeout). This also removes the brief black gap the cast shows on a switch.
- **Length follows tempo.** The length is in beats (for example half a beat, one beat, one bar), converted to milliseconds with the current BPM, clamped to about 150 ms to 2.5 s. Tempo comes from the audio engine and the music analysis (BPM, confidence, beat position, downbeat), not from any renderer.
  - Tracks and Rekordbox have a reliable beat grid: the transition starts on the beat, and for an automation cue it can be made to land on the cue's downbeat.
  - Live input with a trusted tempo (confidence high enough): use the live tempo.
  - Live input without a trusted tempo: a fixed length of about 600 ms, started on the next kick or transient with a short maximum wait.
- **Quantized start (second step).** Holding a change until the next beat or bar needs a hook where the change is requested (preset select, pad, cue), not only after it happens. The first version blends after the change with no quantizing; the second adds "immediate / next beat / next bar".

## Limits

- The outgoing side is a frozen picture. Two different engines cannot both run live on one GPU; a live blend would be a per-engine feature for later, for example Cinema 2.0 to Cinema 2.0.
- PixGrid has its own transitions between deck frames; keep them and make sure the two do not stack.
- The frame tap and compositor cost is small but unmeasured.

## Related

- `docs/cast-survives-page-switch.md`: why a WebGL canvas can only be copied in the task that drew it, and how engines announce frames.
