# Trippy, Bro — implementation and acceptance

Status: revision 4 implements the October 31 reference rework following the user's rejection of revision 3. The earlier approval and acceptance below describe the historical implementation, not proof of current reference fidelity. See `cinema2-trippy-bro-reference-rework.md` for the new motion, transitions, emission and moving validation. Visual review of this rework is pending.

## Visual implementation

The native WebGL2 module renders eight genuinely different geometric programs:

| Pattern | Geometry and movement |
|---|---|
| Prism Lattice | Opposing diagonal line banks slide in counterphase inside three diamond borders; central/cardinal jewels and an amber orbit anchor the image. |
| Golden Fold | Four comb-like chevron banks hinge around an open diamond, with a smaller lattice inside. |
| Quad Bloom | Four radial fan banks counter-rotate around separate jewel hubs, with open fan sectors and overlapping amber rings. |
| Neon Cross | Multicolored crossed line banks carry inward/outward packets around a compact prism. |
| Liquid Weave | Parallel mirrored waveforms bend into a woven lens with four satellite jewels. |
| Orbital Lace | Interlocked rotating ellipses create braided crossings around a central aperture. |
| Prism Echo | Nested separated diamonds ripple with alternating angular windows. |
| Chromatic Knot | Four-lobed contours weave around a dark center and a small jewel. |

All use the approved uniform cover framing: the artwork span is `1.65 × max(canvas width, canvas height) × Composition Scale`. The center stays fixed and shapes preserve their proportions. Peripheral cropping is intentional. Stroke half-widths retain the approved doubling. Fan spokes divide angular distance by its gradient factor so they have comparable screen weight rather than becoming hairlines as segment count grows.

Secondary Detail controls four moving tracers and sparse perimeter tick arcs. Each pattern has a jewel/highlight consumer. Geometry reads with every effect disabled. The fixed screen-space view needs no camera control or automated camera domain.

## Controls and defaults

All controls use generic parameter definitions/bindings and the existing Inspector. Parent groups are Master Controls, Design, Effects, and Palette. No preset-specific Inspector logic or font override was added.

| Parent | Control | Minimum / default / maximum or choices |
|---|---|---|
| Master Controls | Master Intensity | 0 / 1 / 1; zero extinguishes emission, preserving Background |
| Master Controls | Music Reactivity | 0 / 0.65 / 1 |
| Master Controls | BPM Sync | ON by default |
| Master Controls | Auto Performance | OFF by default |
| Design | Pattern | Eight choices above; Prism Lattice default |
| Design | Pattern Change | OFF by default |
| Design | Trigger | Canonical 11 choices; Bar default; visible only while Pattern Change is ON |
| Design | Composition Scale | 0.55 / 1 / 1.25, relative to approved cover framing |
| Design | Line Density | 5 / 13 / 21 subdivisions; pattern-specific equivalent |
| Design | Stroke Width | 0.6 / 1 / 2 × approved stroke widths |
| Design | Motion Speed | 0 / 1 / 2; zero stops phase travel |
| Design | Motion Amount | 0 / 0.45 / 1; zero stops procedural deformation |
| Design | Secondary Detail | 0 / 0.3 / 1; zero removes supporting details |
| Effects | Bloom | 0 / 0.42 / 0.7 |
| Effects | Trails | 0 / 0 / 0.65 |
| Effects | Chromatic Separation | 0 / 0 / 1; bounded stroke-edge separation |
| Effects | Geometric Echo | 0 / 0.2 / 1; two local contour echoes |
| Palette | Background, Cyan Structure, Blue Weave, Magenta Accent, Amber Orbit, Highlight | Six independently editable RGBA color parameters |

The default intensity remains 1 to preserve the approved static geometry's weight. The outer warm border derives from Amber Orbit, rather than retaining an uneditable unrelated color. Colors stay user-owned under all performance modes.

## Timing and lifecycle

`Cinema2BeatClock` supplies motion timing, using the preset BPM Sync toggle explicitly. Analyzed beat timing/BPM is preferred; the host BPM is the shared fallback. The host Sync preference does not silently veto the preset toggle. No local beat, BPM, drop, or phrase detector was introduced.

Sync OFF uses the shared utility's deliberate 120-BPM reference rate as seconds-based authored motion. The native phase integrates that rate, Motion Speed, and bounded musical significance. Toggling Sync changes the rate/phase source without replacing the native phase. Pattern Change continues to use its selected musical event independently of motion Sync.

Idle is intentionally static. A paused track holds phase and pattern progress. This replaces the proposal's optional low ambient idle; musical motion has a clear onset on playback. Discontinuities reset the shared clock adapter, native phase, and pattern/override state, and watermark current events. Re-entry uses persisted authored controls rather than stale runtime pattern state. The engine owns effect history invalidation and resource disposal.

## Ownership and musical mapping

The detailed authority matrix in `cinema2-trippy-bro-implementation-plan.md` remains the governing design. Parameter State owns authored values. Shared Audio Intelligence supplies facts; the Visual Director remains preset-agnostic. Choreography writes bounded transient module channels through existing target resolution. The module translates those channels into its native artwork.

| Channel | Shared source | Smoothing / envelope | Visible consumer |
|---|---|---|---|
| energy | Overall energy | 180 ms | Up to +15% procedural range and bounded contrast; user zero remains zero |
| bass | Bass band | 120 ms | Up to 5% local geometric breathing, scaled by Motion Amount |
| highs | High band | 90 ms | Brightness of permitted tracers |
| vocal | Vocal presence | 250 ms | Restrained subdivision/detail occupancy |
| kick | Kick event, once per identity | 15 ms attack, 180 ms release | Traveling circular packet through the active composition |
| snare | Snare event, once per identity | 10 ms attack, 140 ms release | Opposing diagonal accent banks |
| build | Shared build progress | 200 ms | Up to 5% geometric compression |
| drop | Shared drop event, once per identity | 15 ms attack, 450 ms release | Up to 5% release/expansion |
| Director intensity/momentum | Shared significance | 200 ms | At most +20% phase rate; no independent parameter ownership |
| Director build/impact | Shared significance | 200 / 90 ms | Bounded compression/release context |

Music Reactivity scales all these musical contributions. It does not change the user's selected timing mode, pattern permission, palette, or effect settings. Effects receive no automatic musical replacement. Master Intensity additionally gates effect mix so retained trails cannot bypass a zero emission setting.

## Pattern authority

The runtime reuses the canonical shared trigger resolver and generic `Cinema2MainframePatternController` with this preset's five reference-family automatic cycle and eight manually selectable patterns. It does not create alternate event definitions. The dropdown imports `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` verbatim.

1. Manual Pattern establishes the authored base immediately. Pattern Change remains ON if it was enabled.
2. With Pattern Change ON, only a fresh qualifying selected Trigger advances the runtime base. Duplicate events, trigger edits, toggles, resets, and manual edits watermark current events rather than causing stale transitions. Persisted Pattern is never overwritten by cycling.
3. Auto Performance is a separate permission. A new build section may temporarily perform Golden Fold for at most four seconds; a new shared drop event may perform Quad Bloom for at most 1.2 seconds. Section exit also ends a build override.
4. The base controller continues to receive valid selected triggers while an override performs. The current base resumes when the override expires.
5. A manual Pattern edit immediately cancels the visible override and suppresses the already-active event. A later separately qualifying event may override again. Turning Auto Performance OFF returns to the current base immediately, including while paused. Pattern Change permission edits also update the visible base without depending on transport time advancing.
6. Automatic changes use staged 480–640 ms component withdrawal and reveal. Manual selection is immediate. The central anchor remains; complete drawings are never dissolved together.

Automatic progression uses the five reference families, with no immediate repetition; supplemental looks remain manually selectable. It deliberately uses no random scene selector.

## Finishing and resource policy

Bloom and Trails use the existing shared effects and authored render graph: scene → feedback trails → bloom → output. Trails have finite 0.8 retention, no drift, and bypass/clear on inactive transport. Mix zero writes clean base output and removes old retained contours. Native chromatic separation changes the distances sampled by RGB channels by at most 0.003 local units; Geometric Echo renders two local distance-offset contours at 18% and 7% strength, under the user's effect amount, without repeating the scene.

The module acquires ShaderProgram and FullscreenPass through host resource leases. Render targets/history belong to the engine. No imported model, external texture, new dependency, separate canvas, or private WebGL context was needed. Native loops have fixed 21-subdivision bounds; low quality uses engine render-resolution policy without changing hero topology.

A generic Inspector correction suppresses the empty-workspace message when declarative Design parent groups contain controls. Existing Inspector tests cover the correction and unchanged shared group behavior.

## Validation and remaining acceptance

Focused commands:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2TrippyBroPreset.test.ts
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2InspectorPanel.test.tsx --environment jsdom
npx tsc --noEmit
node scripts/run-cinema2-trippy-bro-browser.mjs
```

The production runner writes captures and reports to `artifacts/cinema2-trippy-bro/acceptance/`. Coverage includes distinct patterns, control extrema, independent palette roles, timing, canonical triggers, manual authority, continuous/rhythmic/structural channels, envelope return, pause/resume, seek/loop/track replacement, missing analysis, preset re-entry, effect OFF/maximum behavior, master-off authority, three aspect ratios, and disposal. The harness mounts the real Cinema2InspectorPanel and publishes deterministic upstream Music Intelligence fixtures into the shared bus; it does not bypass target resolution with renderer-only values.

The historical revision 3 performance snapshot is a measurement from the local browser test environment, not a frame-rate guarantee for live hardware. Reference-video audio was not used to infer undocumented source behavior. Musical mappings are authored and verified with deterministic fixtures.

Historical revision 3 validation results (new revision 4 evidence is documented separately):

- Five focused preset/controller tests passed.
- Eight existing Inspector tests passed in the DOM environment, including the new empty-state regression assertion.
- TypeScript and focused ESLint checks passed.
- Production design checks passed for all eight patterns, control extrema, six independent colors, visible motion, and square/landscape/portrait framing.
- `report-musical.json` records the 11 actual trigger transitions, real portaled dropdown interaction, matched Sync ON/OFF inputs, analysis-revision reset, continuous/rhythmic/vocal response, envelope return, manual takeover, transport cases, effect OFF/max/zero behavior, re-entry, and disposal. No browser errors occurred.
- `report-authority.json` records base advancement under a visible build override, restoration to that advanced base, the four-second build timeout, and immediate automation-off takeover while paused. No browser errors occurred.
- Captures of all patterns, the real Inspector and Trigger menu, and effect extrema were inspected. `patterns.png` is the labeled eight-pattern contact sheet.
- Resource measurement at 720 × 720/high quality reported approximately 4.15 MB of pooled render-target memory and no quality degradation; GPU timing was unavailable, so this is not a GPU throughput or hardware frame-rate certification.

The full command runs all checks; `--music-only` and `--authority-only` narrow later verification without repeating already-passed design capture work.

Historical revision 3: the user's October 29, 2026 approval cleared that implementation's human visual acceptance gate. The October 31 audit subsequently rejected its reference fidelity; revision 4 requires a new moving visual review. The catalog identity remains stable, but the rebuilt rendering needs new moving acceptance evidence; revision 3 pixel captures do not validate revision 4. No commit was requested; implementation remains uncommitted.
