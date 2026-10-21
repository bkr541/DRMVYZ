# 10. Requirements-to-Implementation Traceability Matrix

Use this matrix as the agent's control-to-code audit. Refer to the **actual source contract**, not just this artifact. Proposed symbol names are illustrative until live TypeScript schema is confirmed.

| ID | Required behavior | Proposed owner / binding | Proof / phase | Gate |
|---|---|---|---|---|
| BS-R01 | First-party keeper, schema-valid manifest and module ID | `Cinema2BlockshiftPreset.ts`, `Cinema2FirstPartyPresetCatalog.ts`, `Cinema2ModuleRegistry.ts` | Compiler/registry tests P2 | P2 |
| BS-R02 | Native world 3D geometry and depth-tested render | `Cinema2BlockshiftRenderer`, native module render provider, render graph | Production bloom-OFF static screenshot P2 | P2 |
| BS-R03 | Fixed nine addressable identities, typed groups, finite buffers | `Cinema2BlockshiftDomain`, `Layout`, renderer | Deterministic geometry tests P2 | P2 |
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

## Controls-to-pixels trace (to fill in implementation)

| Control | Expected resolved target | Observable proof |
|---|---|---|
| BPM Sync | `motionClock.sync` (or verified current equivalent) | Changed phase speed/beat alignment at new tempo |
| Pattern | `orchestration.underlyingPattern` | Different block arrangement |
| Pattern Change | `controller.enabled` | Event cycling only when ON |
| Trigger | `controller.selectedEventIdentity` | Chosen events cycle, others don't |
| Block Size | `instance.bodyScale` and `edgeScale` | Apparent object dimensions |
| Spread | `formation.baseSpread` | Space among cubes |
| Depth | `formation.zSeparation` | Observable foreground/background difference |
| Rotation Range | `formation.rotationLimit` | Maximum yaw/pitch envelope |
| Motion Rate | `formation.phaseRate` | Animated movement rate |
| Motion Amount | Final *physical* transform modulation gain | All automatic physical change stops at zero |
| Audio Reactivity | Audio gain before final modulation | Silence vs reactive contrast disappears at zero |
| Master Intensity | `materials.emissionMaster` | Edge light output intensity |
| Auto Performance | Macro overlay authorization | Temporary build/drop formation only |
| Primary Edge | `materials.edgePrimary` | Selected primary edges change |
| Secondary Edge | `materials.edgeSecondary` | Opposing edges change separately |
| Impact Accent | `materials.impactAccent` | Baseline preview accent and impact regions change |
| Block Body | `materials.bodyFace` | Cube face color changes |
| Background | Scene clear/background color | Background changes independently |
| Bloom | Engine stock HDR bloom strength | Halo absent at zero |
| Atmosphere (optional) | Engine atmosphere strength | Air glow/fog absent at zero |
| Camera Motion (optional) | Shared camera choreography gate | Camera remains static when OFF |

**Implementation rule:** replace illustrative target names with exact `cinema2Ref`/manifest parameter and module property names and include working tests. Every row should have a real consumer and evidence path, not a TODO-only implementation.
