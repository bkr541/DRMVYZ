# 10. Requirements-to-Implementation Traceability Matrix

Use this matrix as the agent's control-to-code audit. Refer to the **actual source contract**, not just this artifact. Proposed symbol names are illustrative until live TypeScript schema is confirmed.

**P7 checkpoint:** BS-R18 and the scoped P7 portion of BS-R19 have production camera/effect/aspect, hardware timing and lifecycle evidence in the [Phase 7 report](25_P7_POLISH_AND_PERFORMANCE_REPORT.md). Current P8 automation is documented below; human/release gates remain pending.

**P8 checkpoint:** [Full production acceptance](28_P8_PRODUCTION_ACCEPTANCE_REPORT.md) covers BS-R04–R19 with actual chooser/Inspector/canvas evidence, all eleven triggers, six normalized filmstrips, shared audio/Auto authority, transport, aspect/resize, repeated context recovery and neighboring-preset checks. Phase 9 now records user visual/behavior approval for BS-R20; final release validation remains open, and BS-R01 remains a reference preview until release sign-off. Existing repository-wide failures and unavailable fresh GPU timing are recorded rather than marked PASS.

| ID | Required behavior | Proposed owner / binding | Proof / phase | Gate |
|---|---|---|---|---|
| BS-R01 | First-party keeper, schema-valid manifest and module ID | `Cinema2BlockshiftPreset.ts`, `Cinema2FirstPartyPresetCatalog.ts`, `Cinema2ModuleRegistry.ts` | Compiler/registry tests P2 | P2 |
| BS-R02 | Native world 3D geometry and depth-tested render | `Cinema2BlockshiftRenderer`, native module render provider, render graph | Production bloom-OFF static screenshot P2 | P2 |
| BS-R03 | Fixed fifteen addressable identities (user count revision), typed groups, finite buffers | `Cinema2BlockshiftDomain`, `Layout`, renderer | Deterministic geometry tests P2 and current count revision | P2 |
| BS-R04 | All editable Design parameters nested in four generic groups | Manifest parameter `designParentGroup` values | Inspector DOM/model test P3 | P3 |
| BS-R05 | Working BPM Sync under Master Controls | Manifest `blockshift-bpm-sync` → clock/orchestrator | Sync ON/OFF under differing BPM P4 | P4 |
| BS-R06 | `Pattern` dropdown with six real options | Manifest → orchestration → instance matrices | Six silhouettes + filmstrips P4 | P4 |
| BS-R07 | Boolean `Pattern Change` default OFF, persists edits | Manifest → generic runtime pattern controller | OFF/ON and manual edit P3–P5 | P5 |
| BS-R08 | Conditional 11-option `Trigger` exact shared IDs | `visibleWhen`, imported `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` | DOM and 11 event cases P3/P5 | P5 |
| BS-R09 | Base Pattern protected from stale Trigger and auto takeover | Generic controller + authority state | Manual while ON and dedup P5–P6 | P6 |
| BS-R10 | Five actual colors, minimum four required | Primary/Secondary/Impact/Body/Background → distinct shaders/backdrop | Diagnostic palette P3 | P3 |
| BS-R11 | No placebo user settings | Every manifest parameter → a distinct module/effect consumer | Min/max and pixel diffs P3/P8 | P8 |
| BS-R12 | Geometry-configured choreography | Typed block banks/indices → bounded transform ops | Independent groups moving under cues P4–P5 | P5 |
| BS-R13 | Shared Audio Intelligence with appropriate capability wiring | Bridge signals and manifest choreography → module targets | Controlled silent/kick/snare/build/drop fixtures P5 | P5 |
| BS-R14 | Visual Director adds bounded significance | Director input → envelope gains | Same base, different significance proof P6 | P6 |
| BS-R15 | Scoped Auto Performance & base restoration | Orchestrator temporary overlay layer | Build/drop + edits + restoration recording P6 | P6 |
| BS-R16 | User hard-disable authority | Motion, Reactivity, Camera, Bloom resolved values in final composition | 0/OFF under Auto ON P6–P8 | P8 |
| BS-R17 | Deterministic lifecycle/timing | Shared frame transport, context generation, canonical event IDs | play/pause/seek/loop/track/re-entry P4–P8 | P8 |
| BS-R18 | Engine camera/lighting/effects | Manifest and stock camera/effect runtime | 3 aspect ratios, OFF/ON comparisons P7 | P7 |
| BS-R19 | GPU/resources/performance safe | Engine resource facet, instanced renderer, dispose | Performance capture + repeated re-entry P7–P8 | P8 |
| BS-R20 | Human visual sign-off and complete evidence | Production browser and reviewer | Screenshot/filmstrip matrix P8 and signed gate P9 | P9 |

## Actual controls-to-consumers trace

All IDs below are `blockshift-<suffix>` except shared `quality-mode`. Module keys are resolved through `parameterBindings`; camera/effect keys are manifest bindings into the shared runtimes. Defaults/ranges and conditional visibility are in the [user guide](30_BLOCKSHIFT_USER_GUIDE.md).

| Control / suffix | Actual consumer | Production proof |
|---|---|---|
| BPM Sync / `bpm-sync` | Module `bpmSync` → `Cinema2BeatClock.update`; camera `controls.tempoSync` | [Evidence](evidence/p8-acceptance/timing-acceptance.json) |
| Master Intensity / `master-intensity` | Module `masterIntensity` → renderer `u_intensity`; atmosphere `parameterBindings.mix` | [Evidence](evidence/p8-acceptance/refinement-acceptance.json) |
| Auto Performance / `auto-performance` | Module `autoPerformance` → `Cinema2BlockshiftPerformance.update.enabled` | [Evidence](evidence/p8-acceptance/performance-acceptance.json) |
| Motion Amount / `motion-amount` | Module `motionAmount` → phase/spin/audio/Auto gain; camera `controls.masterMotionAmount` | [Evidence](evidence/p8-acceptance/phase8-acceptance.json) |
| Audio Reactivity / `audio-reactivity` | Module `audioReactivity` → audio/Auto application and `writeCinema2BlockshiftLeds` | [Evidence](evidence/p8-acceptance/led-acceptance.json) |
| Camera Motion / `camera-motion` | Camera `controls.motionEnabled` → shared `Cinema2CameraRuntime` | [Evidence](evidence/p8-acceptance/orbit-acceptance.json) |
| Camera Motion Intensity / `camera-float-amount` | Camera `controls.motionAmount` → bounded travel/float | [Evidence](evidence/p8-acceptance/phase8-acceptance.json) |
| Quality / Performance / `quality-mode` | Shared `Cinema2PerformanceParameters` → runtime performance policy/render-target scale | [Evidence](evidence/p8-acceptance/polish-acceptance.json) |
| Pattern / `pattern` | Module `pattern` → generic controller → `buildCinema2BlockshiftLayout` and LED program | [Evidence](evidence/p8-acceptance/motion-acceptance.json) |
| Pattern Change / `pattern-change` | Module `patternChange` → `Cinema2MainframePatternController.update` | [Evidence](evidence/p8-acceptance/audio-acceptance.json) |
| Trigger / `trigger` | Module `trigger` → `resolveCinema2AfterhoursTriggerEventIdentity` and controller | [Evidence](evidence/p8-acceptance/audio-acceptance.json) |
| Block Size / `block-size` | Module `blockSize` → layout model size / packed instance scale | [Evidence](evidence/p8-acceptance/refinement-acceptance.json) |
| Spread / `spread` | Module `spread` → layout spacing / clearance solver | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Depth / `depth` | Module `depth` → `evaluateCinema2BlockshiftPattern` depth placement | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Rotation Range / `rotation-range` | Module `rotationRange` → pattern/audio/Auto tilt bounds | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Motion Rate / `motion-rate` | Module `motionRate` → phase advance and `Cinema2BlockshiftRotation.update` | [Evidence](evidence/p8-acceptance/phase8-acceptance.json) |
| Transition Length / `transition-length` | Module `transitionLength` → `Cinema2BlockshiftOrchestration.update.durationBeats` | [Evidence](evidence/p8-acceptance/phase8-acceptance.json) |
| Rotate Cubes / `rotate-cubes` | Module `rotateCubes` → `Cinema2BlockshiftRotation.update.enabled` | [Evidence](evidence/p8-acceptance/refinement-acceptance.json) |
| Orbit Camera / `orbit-camera` | Camera `controls.orbitMotionEnabled` → shared camera orbit angle | [Evidence](evidence/p8-acceptance/orbit-acceptance.json) |
| Orbit Intensity / `orbit-intensity` | Camera `controls.orbitMotionSpeed` → shared angular-speed gain | [Evidence](evidence/p8-acceptance/orbit-acceptance.json) |
| Bloom / `bloom` | HDR bloom `parameterBindings.intensity` | [Evidence](evidence/p8-acceptance/polish-acceptance.json) |
| Atmosphere / `atmosphere` | Volumetric atmosphere `parameterBindings.enabled`; scene color/depth inputs | [Evidence](evidence/p8-acceptance/refinement-acceptance.json) |
| Float Speed / `camera-float-speed` | Camera `controls.motionSpeed` → shared flight/float time | [Evidence](evidence/p8-acceptance/phase8-acceptance.json) |
| Field of View / `camera-fov` | Camera `controls.fovDegrees` → final perspective matrix | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Primary Edge / `primary-edge` | Module `primaryEdge` → primary identity group packed RGB / LED `v_edge` | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Secondary Edge / `secondary-edge` | Module `secondaryEdge` → secondary identity group packed RGB / LED `v_edge` | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Impact Accent / `impact-accent` | Module `impactAccent` → Impossible Cube packed RGB / LED frame | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Block Body / `block-body` | Module `blockBody` → renderer `u_body`, faces/housings | [Evidence](evidence/p8-acceptance/acceptance.json) |
| Background / `background` | Module palette value and environment `controls.backgroundColor` → shared scene background | [Evidence](evidence/p8-acceptance/acceptance.json) |

Hidden runtime-only `blockshift-musical-cue` is an action binding, not a user control: shared choreography dispatches `musicalCue` into the native module cue queue. The module adds no private musical detector or timer.

**Phase 9 disposition:** The [release gate](09_RELEASE_GATE.md) records explicit human approval, passing preset checks and the remaining repository validation/final-commit requirements. The [checkpoint](evidence/p9-signoff/checkpoint.json) identifies the current source snapshot. Keeper promotion and release remain blocked.
