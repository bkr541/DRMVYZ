# Cinema 2.0 SYS-03: shared camera and pattern authority

## Ownership and compatibility

The production frame order remains Audio Intelligence -> Visual Director -> Mood Conductor -> choreography/target contributions -> camera -> native module -> render graph. No independent audio detector, clock, persisted automation state, preset IDs, schema versions or Inspector controls have been added.

* `motionEnabled` (boolean, default remains per preset): hard permission. OFF restores the base rig/manual view, suppresses additive camera target motion, drift, orbit, bank and kick zoom. The normal FOV slew limiter cannot prolong a disabled accent.
* `motionSafety` (enum, default remains per preset): full = 1x; reduced = 0.22x travel / 0.35x additive amplitude; lockoff = 0x. Centered orbit now uses the existing travel multiplier. `masterMotionAmount` (0..1) also bounds centered orbit and kick zoom. Manual placement is retained.
* `kickZoom` (boolean, default remains per preset): still independent of the sway amount, but subordinate to the hard permission. A kick observed while disabled does not restart the envelope on re-enable.
* `orbitMotionSpeed` (0..1, default remains per preset): affects the existing orbit travel clock. A dedicated room-pan control can remain independent of the general sway amount, as in Nightshift, but not a declared hard stop or lockoff.
* Pattern Change and Trigger retain their saved values. Both the Mainframe-family and typography-family controllers now share a bounded per-trigger event latch. Null event frames and manual edits are not an event reset. A source/seek reset starts a new event history. `reselect` reapplies the authored selection (including the same saved value) without discarding that history. Named preset adapters use this distinction; the remaining existing consumers that pass `reset` continue to have their existing reset semantics.
* Auto Performance still resolves its effective controls through the shared Mood Conductor and Inspector lock. It does not persist effective Pattern Change or Trigger. Existing four-group layout is unchanged.

## Scene-specific motion profiles for follow-up authoring

| Preset / profile | Existing implementation | Direction for its local visual task |
| --- | --- | --- |
| Colossus / hero | Static perspective, bounded drift and tempo sway, reduced motion default | Keep the hero and arms readable; use constrained dolly and parallax, with deliberate drop emphasis within safe framing. |
| Livewire / typography | Static Say It-derived camera; its replacement choreography routes LED events, not the inherited camera accents | Add native shared camera bindings or appropriately gated target contributions; use restrained lateral movement/push that preserves word readability and reflection framing. Do not restore unrelated Say It motion. |
| Honey / spatial parallax | Close static camera with tempo weave, master motion gain and existing camera toggle | Author restrained parallax and drop depth appropriate to the tiled wall; preserve substrate coverage and avoid generic orbiting. |
| Wireframe Portal / forward flight and orbital | Authored path/fly/orbit variants with existing manual mode, BPM sync and kick zoom | Preserve the distinct flythrough/orbit paths; check near clearance, first-frame lockoff and lens safety. |
| Purity / forward perspective | Static tunnel camera with bounded sway and drop FOV contribution | Keep the vanishing point readable and let native tunnel travel supply the visual depth. |

Profiles are design guidance, not approved new camera animations. SYS-03 fixes common authority failures; it does not tune preset-local choreography or update catalog thumbnails without rendered evidence.

## Verification

`Cinema2SharedAuthority.test.ts` exercises the actual shared camera runtime, compiler, parameter state, resolver, pattern controllers, canonical structural trigger routing, and Colossus/Honey native pattern functions. Numerical tests are not rendered-frame acceptance. Run it with the existing Vitest runner and related preset/camera suites, then use the project's browser harnesses (e.g. `npm run test:e2e:cinema2-purity`) and actual Electron playback to inspect matching viewport/quality, camera OFF/ON, safety modes, no-track, pause, seek, BPM Sync, build/drop and track changes. Capture comparable frames and timed playback before approving any preset-local amplitude or framing changes.
