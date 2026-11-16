# Cinema 2.0 Mood Conductor

A shared conductor for Auto Performance. The Visual Director already reads the audio intelligence into a phase, an intensity, a momentum, a build and a section context, and the choreography runtime already turns music events into transient contributions. What was missing is one coherent, smoothed reading of **how the passage feels**, plus the **impact of a drop** that rises at once and decays, so a preset's whole look can move together instead of through a few unrelated accent rules. The Mood Conductor computes that, once per frame, for every preset.

Adopted so far by **Mainframe, Depth and Electric Storm** (their own Auto Performance toggle gates everything; no preset gained a parameter and no revision changed). Sound Drawing XY's conductors (`XyScopeWireConductor`, `XyScopeStandardPerformance`) are the same idea for that engine; this one is built on Cinema 2.0's own director and target runtime.

## What it is, and what it is not

- `cinema2/conductor/Cinema2MoodConductor.ts`. It reads **only** the shared audio-intelligence frame and the Visual Director's frame. It analyses no audio and has **no drop detector of its own**: a drop is `cinema2CanonicalDropEvents` (exported from the choreography runtime, which now uses the same function for its `drop` signal), and a phrase is `cinema2CanonicalPhraseEvents`. This keeps the rule in `cinema2-auto-performance.md`: no new analyzers or drop detectors.
- The runtime captures the mood right after the director and puts it on the frame (`frame.mood`, null whenever the director is, so with no analysed track or live features it is null and nothing is invented). `Cinema2Runtime.getMoodFrame()` exposes it for diagnostics. It holds still while the transport is paused (no time passes) and starts again on a seek, loop or track change.
- Deterministic: no randomness, a pure function of the frames and the time between them.

## The mood frame (`Cinema2MoodFrame`)

All 0..1, smoothed (fast to rise, slower to fall):

| Field | From |
| --- | --- |
| `energy` | director intensity (else track or overall energy) |
| `tension`, `complexity`, `brightness` | the audio features (brightness is the spectral centroid) |
| `build`, `momentum` | the director's build and momentum |
| `calm`, `drive`, `tense`, `peak` | the section's kind when the analysis has one (intro, verse, build, preDrop, drop, breakdown, bridge, outro), else the signal alone; they melt from one passage into the next |
| `shock` | jumps to the drop's strength (at least .75) on the frame a drop lands, then falls with a 1.7 s time constant |
| `activity` | .4 energy + .2 tension + .15 build + .15 momentum + .2 drive + .3 peak + .3 shock − .2 calm |
| `feel` | `peak` (peak or shock above .45), `tense`, `calm`, else `driving` |
| `section`, `drop`, `boundary` | the section id, type and progress; whether a drop landed; and the musical boundary of this frame (a drop, a section change or a phrase, in that order of authority) |

## Two ways a preset uses it

**Continuously, as choreography sources.** Twelve new continuous paths: `mood.energy`, `.tension`, `.build`, `.momentum`, `.complexity`, `.brightness`, `.activity`, `.calm`, `.drive`, `.tense`, `.peak`, `.shock`. `createCinema2MoodRules` (and `withCinema2MoodDrives` for a manifest, or the `mood` field of a `withCinema2AutoPerformance` spec) turns a list of drives into gated rules:

```ts
{ id: 'rate', target: cinema2AutoTargets.module('depth-tunnel', 'rate'), source: 'mood.activity', operation: 'add', value: 0.7 }
```

`add` contributes `value × source` (negative values take away); `multiply` scales from ×1 to ×`value`. The contribution is transient: the authored value is the baseline and is never rewritten, the target runtime clamps the result to the control's own range, drives that share a source become one rule, and the rules exist only while the preset's Auto Performance toggle is on (and scale by its reactivity or intensity control, so a control at zero silences them). With the toggle off the preset is identical to one without the conductor (a test checks this for Electric Storm).

**Discretely, through `Cinema2MoodChooser`.** For choices among a preset's own options (patterns, programs, looks): it changes only on a musical boundary, holds a choice at least `minHoldSec` (4 s) unless a drop lands, never repeats the current choice, and picks by a hash of the track and the boundary, so the same track gives the same show. It does nothing without a mood frame.

## What each preset does with it

| Preset | Continuous drives (gated by its Auto Performance toggle) | Discrete |
| --- | --- | --- |
| **Electric Storm** | Strike Rate: + activity, − calm, + shock. Branching: + tense. Thickness: + peak. Glow: + activity, − calm. Master Intensity: + peak, − calm. Flash Intensity, Impact Shake and Zoom Punch: + shock. The existing four accent gestures (build rise, pre-drop strikes, drop barrage, every fourth bar) are kept. | none (the storm has no pattern) |
| **Depth** | Rate: + activity, − calm, + shock. Light Spill: + activity. Route Density: + tense, + peak. Intensity: + peak, − calm. Bloom intensity: + shock. Its own program choice and accents are unchanged. | its own orchestration (unchanged) |
| **Mainframe** | Master Intensity: + activity, − calm, + shock. | Between builds and drops, a pattern chosen by feel on boundaries: calm: Radar Sweep, Inward Boot; driving: Bank Alternator, Quadrant Relay, Outward Bus; tense: System Surge, Quadrant Relay; peak: Outward Bus, Bank Alternator, Quadrant Relay. It acts only while **Pattern Change is off**, never while the Trigger is choosing, and editing the Pattern cancels it at once. The build program (System Surge) and the drop program (Outward Bus) still take the stage for their moments, and the chosen pattern resumes after them. |

Values are bounded by each target's range. The exact numbers are in the preset files and are meant to be tuned by eye on a real track.

## Adding it to another preset

1. Pick the targets that should move with the passage and a baseline-relative drive for each (`add` or `multiply`, a source, a value).
2. For a preset with `withCinema2AutoPerformance`, add a `mood: [...]` list to the spec. For one with its own toggle (Depth, Mainframe), wrap its manifest with `withCinema2MoodDrives({ idPrefix, enabledParameter, strengthParameter?, drives })`.
3. For a preset with a pattern controller, give `Cinema2PatternAutoPerformance` a `mood: { options }` config and pass `mood`, `deltaTimeSec`, `basePattern`, `patternChange` and `seed` from the module frame (see the Mainframe module).
4. Keep the revision; add tests in the style of `Cinema2MoodConductorPresets.test.ts` (the twin-engine differential: the same music into the preset with the toggle on and off).

## Tests

`Cinema2MoodConductor.test.ts` (the conductor against the real audio bridge and director, and the chooser) and `Cinema2MoodConductorPresets.test.ts` (the authoring, and Electric Storm, Depth and Mainframe against their real choreography runtimes: calm and peak, a drop's shock and its decay, off, no music, reactivity zero, and the Mainframe pattern chooser). The existing Auto Performance rule and inventory tests pass unchanged except that Depth and Mainframe's authored rule lists now include the mood rules.

## Not done

Tuned only against synthetic music in tests, never watched on a real track in the app. The other 43 presets are untouched; Depth's program choice is not mood-aware yet; the conductor has no UI readout.
