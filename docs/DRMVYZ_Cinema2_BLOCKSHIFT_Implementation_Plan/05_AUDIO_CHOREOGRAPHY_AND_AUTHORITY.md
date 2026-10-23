# 05. Standard Audio Intelligence Routing, Choreography, Visual Director and Authority

**User-directed LED revision:** The same shared routes now also drive geometry-aware LED bar circuits, alongside whole-cube movement/emission. Kick selects longitudinal circuits on alternating cubes; snare selects cross circuits on the opposite bank; continuous levels, build/drop, bar/phrase/section and Director shape bounded occupancy/chases/core accents. LED programs follow the selected six-pattern geometry and its existing shared-clock phase. See [LED mapping and validation](26_LED_BAR_CHOREOGRAPHY.md). No additional detector or independent timing source is introduced.

**P6 status:** Eight continuous audio routes, three shared Director routes and nine musical cues (including a shared build edge) now drive the native module. Auto Performance is visible in Master Controls, default OFF. Director motion gain is capped at 1.25×; emission remains below Master Intensity. Build/drop overlays last at most four/two performance beats, with weights at most 0.25/0.35 and quarter-beat attack/release. Pattern or geometry edits cancel them immediately, consume coincident cues and start a two-beat cooldown; held cues cannot restart after it. See [Phase 6 report](24_P6_DIRECTOR_AUTO_PERFORMANCE_REPORT.md). [Phase 5](21_P5_SHARED_AUDIO_REPORT.md) retains the audio/eleven-trigger evidence.

## Non-negotiable ownership boundary

Use Cinema 2.0's **shared audio bridge, shared events, shared choreography runtime, Visual Director and authored parameter resolver**. BLOCKSHIFT must *not* sample audio, detect drops, infer BPM independently, keep a second section classifier, calculate a private beat grid, or mutate persisted Inspector values through music logic.

## Continuous signals and actual geometry consumers

Values below are intended **bounded modulation suggestions**, not hardcoded assumptions about the source API shape. At P5, map actual available audio/director fields and manifest signal IDs from `Cinema2AudioIntelligenceBridge`, `Cinema2ChoreographyRuntime` and an existing tested preset; list required/optional capabilities accurately.

| Signal | Concrete BLOCKSHIFT visual result | Bounds / manual authority |
|---|---|---|
| Sub | Slow outward micro-expansion of outer blocks, coupled to edge emission | ≤10% user spread; does not rewrite Spread |
| Bass | Pulsing offset/scale on a selected spatial group (e.g. near-bank), not whole-scene uncontrolled scaling | ≤12% of safe displacement envelope |
| Mids | Alternating rotational micro-tilts on rows/banks | Limited by user Rotation Range |
| Highs / spectral change | Short edge glints on alternating cubes, tiny face angular accents if enabled | Never shakes the whole formation continuously |
| Overall energy | Smooth ambient edge-emission multiplier / bounded movement rate | Capped by Master Intensity and Audio Reactivity |
| Vocal presence | Lower kinetic agitation, emphasize center block and stable edge treatment | Does not stop user-requested manual transitions |
| Build progress | Gradual bank compression/height tension plus higher edge density | Temporary reversible offset; does not change base Pattern |
| Section context | Choose tasteful modulation profile/intensity envelope | No hidden persistence or direct Pattern replacement |

**Visual requirement:** when effects/bloom are OFF, significant bass and midrange passages must still change object transforms, not just shader brightness. No source should be connected to an unused placeholder channel.

## Musical event choreography

| Existing event | Bounded event envelope and geometry target | Distinguishing proof |
|---|---|---|
| Kick | Short y-axis rise or depth bump of center and alternate blocks | Sharp physical displacement, smooth decay |
| Snare | Brief opposing yaw of left/right banks + accent color edge flash | Visibly different from kick |
| Beat/downbeat | Small periodic formation pulse; downbeat bigger but not a second kick | Distinct amplitude/targets |
| Bar / phrase | Slow reorientation or synchronized reset/sweep where the current pattern permits | Works without switching Pattern |
| Section-change | Slow intensity/motion-character blend | Bounded, no sudden user-control loss |
| Drop | Short dramatic outward reveal/formation emphasis then settle | Real geometric movement and controlled impact |

Use shared `Cinema2ChoreographyRuntime` rules with valid signal capabilities, `handleAction` event envelopes and module-resolved channels. P5 uses the established Mainframe-style supported `spawn` action into a hidden runtime-only trigger: the shared runtime selects/deduplicates events, while BLOCKSHIFT owns only bounded visual decay state, advanced from engine frame delta. This introduces no second musical clock or detector. Every rule should specify signal, target, operation, envelope timing, maximum magnitude, blending, reset behavior, and priority/authority. Do not use frame-local random toggles, competing host-timers or a universal constant beat multiplier.

## Event identity guarantees

- Store and consume unique source/track/time-aware event IDs, not raw `kick=true` every frame.
- Deduplicate multi-frame events, process one envelope per legitimate event, and clear stale IDs on discontinuity.
- Pattern Change Trigger is separate from normal kick/snare modulation: when Pattern Change OFF, kicks can still animate cubes; they simply cannot advance Pattern.
- A Pattern Change Trigger can coincide with regular choreography. Sequence is deterministic and does not double-apply an accidental unbounded transform.
- Missing optional audio features -> deterministic idle/manual scene, never invented music facts.

## Visual Director's exact role

The Director interprets build significance, impact and context. It may widen or deepen transient choreography **within bounds** (and may activate a brief Auto Performance override only when authorized). It must not change user-authored Spread, Block Size, palette or Pattern behind the Inspector's back.

## Authority matrix

| Domain | Authored user base | Continuous audio | Auto Performance (when ON) | Manual edit behavior |
|---|---|---|---|---|
| Pattern | Selected option persists | Pattern's *internal movement* can react | **Temporary build/drop performance overlay only**; underlying base unaffected | Takes effect immediately even with Pattern Change ON; stale event cannot cancel it |
| Pattern Change | Explicit boolean | Only event-driven selection advances underlying base | Does not change the boolean | User toggle always wins |
| Trigger | Persisted one of 11 IDs | Selects next valid new event | Does not rewrite Trigger | New selection arms next fresh event |
| Spread / Depth / Block Size | Manual geometry values | Bounded offsets around base | May temporarily add ≤ safe envelope, not replace authored value | Manual edit visible immediately; no value overwrites |
| Rotation Range | Manual safety bound | Rotational offsets within that bound | May intensify inside bound, never exceed hard safety | Edit immediately clamps subsequent modulation |
| Motion Amount | Manual multiplier, 0 is hard stop | Modulation multiplied by it | Cannot bypass 0 | User always wins |
| Audio Reactivity | Manual multiplier, 0 removes music response | Every music channel multiplied by it | Cannot force back ON | User always wins |
| Camera Motion OFF | Hard-disable | No movement | Cannot re-enable | User always wins |
| Five palette colors | Five independent authored color values | Emission/intensity accents can modulate, not replace base hue | No automatic palette mode in v1 | Each color edit visible immediately |
| Master Intensity | User ceiling | Energy/Director bounded intensity | Macro multiplier subject to authored limits | User still owns the base intensity |
| Bloom/Atmosphere | User amount including zero | Optional bounded brightness variation, NOT hidden reactivation | Cannot bypass OFF | User always wins |

**Optional Auto Performance implementation:** OFF by default. When ON, *fresh* authorized build/drop events temporarily bias the performing geometry toward e.g. *Collapse tension* (build) and *Split release* (drop). This is a temporary **performance override**, not a persisted Pattern mutation. Underlying Pattern Change continues to process selected fresh Triggers; when override ends, current underlying pattern resumes. Manual Pattern edit during overlay must visibly take effect and block immediate stale restoration of the same overlay. Decide exact resume/cooldown policy in P1 and cover it in tests.

## Recommended bounded composition pipeline

```text
Authored parameters + base pattern targets
   -> current runtime Pattern / transition
   -> continuous modulator (audio levels + sections) x Audio Reactivity x Motion Amount
   -> one-shot kick/snare/downbeat/drop envelopes (event-ID protected)
   -> Director's bounded significance gain
   -> optional authorized temporary Auto Performance overlay
   -> safety envelopes and anti-overlap
   -> visible instance transforms + 5 palette materials + engine effects
```

The motion-cap hard stop runs after all automation. Prevent the familiar bug where two independent systems both modulate a transform and one silently cancels or doubles the other.

## Fixture cases required

Silence, low-energy verse, active vocal passage, bass-heavy sustained section, kicks-only pulse, snare-led accents, buildup, drop, new phrase, section change, pause/resume, seek backward, loop and source swap. Each case needs numerical state assertions **and** production-render pixels or recording evidence where applicable.
