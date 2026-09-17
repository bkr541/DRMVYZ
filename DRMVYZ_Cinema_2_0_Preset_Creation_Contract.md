# DRMVYZ Cinema 2.0 Preset Creation Contract

## Purpose

This document is the mandatory implementation contract for every new first-party Cinema 2.0 preset, whether:

1. an existing legacy Cinema preset is being ported into Cinema 2.0, or
2. a completely new Cinema 2.0 preset is being created from scratch.

Its purpose is to prevent the failure pattern seen in early Cinema 2.0 presets where the code is technically connected but the visual result is incorrect, static, weak, overridden by automation, or visibly unrelated to the intended design.

A preset is **not complete because it compiles, renders pixels, exposes controls, or receives Audio Intelligence**. It is complete only when the intended visual composition is correct and the user can visibly verify that controls, audio, choreography, intelligence, camera behavior, and effects work as designed.

---

# 1. Prime Directive: Preserve the Visual Result First

Cinema 2.0 systems exist to improve a preset, not replace its visual identity.

For every preset, implementation priority is:

1. **Correct visual composition**
2. **Correct manual controls**
3. **Correct motion**
4. **Correct audio response**
5. **Correct user/automation authority**
6. **Visual Director and Choreography enhancement**
7. **Camera, lighting, effects, layers, trails, depth, and other Cinema 2.0 enhancements**

Do not begin by wiring every Cinema 2.0 subsystem and assume the visual result will emerge afterward.

The preset's visual behavior must be authored intentionally first.

For a legacy port, the legacy preset is the behavioral reference. Cinema 2.0 may improve depth, smoothness, lighting, performance, effects, and intelligence, but those improvements must not destroy the recognizable composition or behavior users already expect.

---

# 2. The Non-Negotiable Cinema 2.0 Ownership Model

Every system must have one clear job.

## Audio Intelligence

Audio Intelligence is the shared source of musical facts.

It may provide:

- sub, bass, mids, highs, and air energy
- overall or track energy
- spectral movement
- vocal presence
- beats
- kicks
- snares
- downbeats
- bars
- phrases
- sections
- builds
- drops
- semantic moments

Audio Intelligence must **not** directly decide preset-specific visuals.

It answers:

> "What is happening in the music?"

It does not answer:

> "Which lasers should turn on?"  
> "Which Interlock layout should appear?"  
> "Where should this object move?"

Do not create a second preset-local beat detector, phrase detector, drop detector, BPM system, or alternate musical clock.

---

## Visual Director

Visual Director is the shared interpretation layer.

It converts musical information into broad performance meaning such as:

- intensity
- momentum
- build pressure
- impact
- variation significance
- structural transition significance

Visual Director is deliberately preset-agnostic.

It must not know that a preset contains lasers, LED bars, particles, rings, planets, mechanical structures, text, or any other specific artwork.

It answers:

> "How significant is this musical moment?"

It does not directly render anything and must not directly own preset parameters.

---

## Choreography

Choreography translates shared musical meaning into preset-specific temporary behavior.

Examples:

- kick adds a short brightness pulse
- snare accents side laser banks
- build temporarily narrows or compresses a composition
- drop increases movement range
- phrase boundary starts a pattern transition
- vocal presence temporarily reduces visual density
- section change resets trails
- director intensity adds bounded motion

Choreography must operate through the Cinema 2.0 target/value-resolution system.

It must not create a parallel hidden state system that bypasses user controls.

Choreography should normally **modulate** user-authored values rather than replace them.

---

## Parameter State

Parameter State owns the user's authored settings.

Examples:

- Beam Count = 10
- Spread = 0.65
- LED Intensity = 0.8
- Rotation Amount = 0.4
- Pattern = Wide Fan
- Symmetry = ON
- Atmosphere = 0.2

A user-facing control is not valid merely because it exists in the Inspector.

The renderer must consume its resolved value and the visualizer must visibly change when that value changes.

---

## Native Modules

A native module owns the preset-specific visual implementation.

It is responsible for the actual visual vocabulary:

- fixture positions
- beam geometry
- LED geometry
- particle layout
- scanner motion
- object animation
- material behavior
- local simulation
- pattern construction

The module must consume resolved Cinema 2.0 values. It must not silently cache authored defaults and ignore later user or choreography changes.

---

## Camera, Scene, Lighting, Effects, Layers, and Render Graph

These are supporting systems.

Use them when they improve the preset.

Do not force a preset to use every Cinema 2.0 subsystem merely to appear architecturally sophisticated.

A simple preset with correct composition, excellent audio response, and three correctly used systems is better than a broken preset routed through ten systems.

Every used subsystem must have a visible purpose.

---

# 3. Mandatory Control Authority Model

Every controllable visual property must declare exactly one authority mode at a time.

There are only three acceptable states.

## A. USER OWNED

The user's selected value is authoritative.

Automation must not replace it.

Examples:

- user chooses Wide Fan
- user disables overhead lasers
- user positions an object
- user selects a pivot
- user manually selects an Interlock segment pattern

Music may still provide a bounded additive or multiplicative reaction if the design explicitly allows it, but the user's setting remains the base truth.

---

## B. USER BASE + INTELLIGENCE MODULATION

The user's value defines the design and intelligence is allowed to temporarily move around it within a documented range.

Example:

User sets:

- Brightness = 0.70

Choreography may temporarily produce:

- 0.60 during vocal restraint
- 0.82 on a kick
- 0.90 on a drop

It may not silently turn the user's 0.70 into an unrelated permanent value.

This should be the default model for most reactive controls.

---

## C. INTELLIGENCE OWNED

Only Auto Performance or another clearly labeled automatic mode may own the property.

Examples:

- automatic pattern selection
- automatic scene family selection
- automatic camera shot choice
- automatic layout progression

The UI must make this ownership obvious.

If the user manually changes that property, the user must immediately reclaim control of that domain.

### Mandatory rule

**A manual edit to an auto-owned property must disable automation for that property or its clearly defined domain.**

Interlock already demonstrates the correct direction by turning Auto Performance off when the user manually selects Pattern or Segment Pattern.

This behavior must become a global first-party preset convention.

---

# 4. Automation Must Never Fight the User

The following behavior is prohibited:

1. User moves a control.
2. The control visibly moves in the UI.
3. Auto Performance or Choreography immediately replaces the visual value.
4. The visualizer appears unchanged.
5. The user concludes the control is broken.

If both the user and automation can affect the same property, the preset must explicitly define composition:

- user locked
- user base + additive modulation
- user base + multiplicative modulation
- auto-owned

Never rely on accidental target priority to decide this.

### Hard authorization controls

Some controls should behave as permissions, not suggestions.

Examples:

- Side Lasers OFF
- Overhead Lasers OFF
- Layer Visibility OFF
- Strobe OFF
- Camera Motion OFF
- Effect OFF

If a control is described as disabling a feature, Auto Performance must not re-enable it unless the UI explicitly says automation is allowed to override that control.

---

# 5. Visual Geometry Contract

Before writing reactive behavior, document the visual geometry.

Every preset must define:

- coordinate system
- screen-space vs world-space behavior
- safe bounds
- origin points
- endpoint rules
- pivot points
- scale behavior
- aspect-ratio behavior
- camera relationship
- clipping rules
- z/depth policy when applicable

## Geometry must be visually validated

Do not infer correctness from mathematical validity.

A beam can be mathematically valid and still begin halfway up the screen.

An LED bar can be correctly instanced and still be too thin to read.

A 3D target can be valid and still make a laser appear too short.

A camera can be technically correct and still destroy the reference composition.

The actual production canvas must be inspected.

---

# 6. Legacy Port Rule: Preserve the Original Visual Grammar

A legacy preset must be analyzed before any Cinema 2.0 implementation begins.

Create a **Legacy Behavior Inventory** containing at minimum:

- visual primitives
- fixture/object count
- start/origin positions
- endpoints or destination rules
- pattern families
- movement type for each pattern
- movement range
- movement speed
- idle behavior
- audio-reactive behavior
- build behavior
- drop behavior
- vocal behavior
- pattern-change behavior
- user controls
- control min/max meaning
- layer/compositing behavior
- effects
- camera behavior
- reset behavior

### Do not translate geometry blindly

If the legacy visual uses screen-edge projection, do not replace it with finite 3D endpoints simply because Cinema 2.0 supports 3D.

If the legacy visual uses scanner-style trajectories, do not replace them with generic sine-wave motion.

If the legacy visual uses fixed edge-mounted emitters, do not place them in visually different locations because the new stage model is mathematically cleaner.

First preserve the visual grammar.

Then enhance it.

---

# 7. Mandatory Legacy Port Sequence

A legacy port must be implemented in this order.

## Stage 1: Static visual parity

No Audio Intelligence.  
No Visual Director.  
No automatic choreography.

Render the preset at rest and match:

- element count
- placement
- scale
- framing
- orientation
- color
- overall composition

If the static composition is wrong, stop.

Do not proceed to audio intelligence.

---

## Stage 2: Manual parameter parity

Wire every user-facing design control.

For every parameter:

1. set minimum
2. capture output
3. set middle
4. capture output
5. set maximum
6. capture output

The expected visual property must clearly change.

If the parameter value changes in state but the canvas does not visibly change, the parameter is broken.

Do not accept "the value reaches the module" as proof.

---

## Stage 3: Native motion parity

Recreate the legacy movement vocabulary.

Examples:

- scanner trajectories
- pivot rotation
- bank movement
- segment movement
- object orbit
- sweep behavior
- opening/closing behavior
- retrace behavior

Do not substitute one generic motion function for every pattern.

---

## Stage 4: Audio parity

Connect the existing Cinema 2.0 Audio Intelligence signals to recreate the legacy musical behavior.

At this stage, Cinema 2.0 should behave recognizably like the legacy preset during real playback.

Required tests must include:

- quiet passage
- steady beat
- kick-heavy passage
- snare/transient passage
- build
- drop
- vocal section
- phrase or section transition where relevant

---

## Stage 5: Cinema 2.0 intelligence enhancement

Only after parity is achieved should Visual Director and expanded Choreography improve the preset.

Enhancements may include:

- better structural transitions
- better camera choices
- more nuanced vocal restraint
- stronger build/drop shaping
- bounded density changes
- richer effect timing
- better phrase-aware variation

These enhancements must preserve the recognizable preset.

---

## Stage 6: Camera, depth, lighting, effects, and finishing

Add Cinema 2.0-only improvements last.

Never use camera movement, depth, bloom, haze, trails, or other finishing effects to disguise incorrect base geometry.

---

# 8. New Preset Creation Sequence

A preset created from scratch does not have a legacy reference, so it requires an authored reference specification before coding.

## Required Visual Specification

Define:

- hero visual
- composition
- number of major elements
- placement
- motion vocabulary
- pattern/layout vocabulary
- idle state
- build behavior
- drop behavior
- vocal behavior
- expected audio responsiveness
- manual controls
- automatic controls
- camera role
- effects role

If reference images or video concepts exist, define which characteristics are mandatory and which are inspirational only.

---

## Required Authority Matrix

Before implementation, create a table containing:

| Property | Manual Control | Audio Modulation | Visual Director | Auto Performance | Manual Edit Behavior |
|---|---|---|---|---|---|

Every important property must have an entry.

Examples:

- layout
- brightness
- beam count
- rotation
- movement speed
- density
- segment program
- color
- camera
- trails
- bloom
- haze
- background intensity

This matrix must be agreed before code is written.

---

# 9. Parameter Contract

Every user-facing parameter must satisfy all of the following.

## Wiring requirement

The parameter must have a real consumer through:

- a module parameter binding
- effect binding
- camera binding
- environment/lighting binding
- scene binding
- choreography route
- supported authored target

The existing Cinema 2.0 authoring validator already checks whether a user-facing parameter is connected to a consumer.

That is necessary but not sufficient.

---

## Perceptual requirement

Every parameter must also pass a **visible-output test**.

Changing the parameter must measurably and visibly alter the intended property on the production canvas.

Examples:

- Beam Count changes actual visible beams.
- Spread changes beam distribution.
- Rotation changes visible bar orientation.
- Atmosphere changes the background atmosphere.
- Bloom changes bloom.
- Pivot changes the real pivot.
- Segment Density changes visible segment occupancy.
- Camera Motion changes camera motion.

### No placebo controls

A control that changes internal state but cannot be observed visually is a release-blocking defect.

---

# 10. Audio Reactivity Contract

A music-reactive preset must visibly move or change while a track is playing.

Receiving Audio Intelligence data is not enough.

The production visualizer must prove a visible difference over time.

## Required mapping categories

Every music-reactive preset must explicitly document which visual property responds to:

- continuous energy
- rhythmic events
- structural events

### Continuous examples

- bass drives rotation amplitude
- overall energy drives movement range
- highs drive shimmer
- vocal presence reduces density
- build progress compresses or increases tension

### Event examples

- kick pulses lower structures
- snare accents side structures
- downbeat causes a larger accent

### Structural examples

- phrase changes variation
- section changes layout family
- drop releases tension or selects a hero state

Do not map every signal to brightness.

Different musical information should influence different visual dimensions.

---

# 11. Playback and Timing Contract

A preset must behave correctly when:

- no track is loaded
- a track is loaded but paused
- playback starts
- playback pauses
- playback resumes
- the user seeks
- the track loops
- the track changes
- analysis changes
- the preset is switched away from and back to

Volatile movement and choreography state must reset or reconstruct deterministically at discontinuities.

Do not allow stale envelopes, old pattern transitions, prior track timing, or previous preset state to leak into the new state.

---

# 12. Idle Motion Contract

A music-reactive preset must define what happens without active audio.

The options are:

- truly static
- very low authored ambient motion
- free-running decorative motion

This behavior must be deliberate.

It must not be confused with musical reactivity.

When audio begins, the preset must visibly transition into audio-driven behavior.

A preset that continues exactly the same motion before and during music has failed its reactivity requirement unless that behavior is explicitly intended.

---

# 13. Visual Director Contract

Visual Director should provide broad performance meaning, not replace preset design.

Preferred uses:

- scale movement range
- scale density within bounds
- scale effect amount
- influence camera energy
- choose whether a structural transition is significant enough
- provide build/impact context to choreography

Avoid using Visual Director to continuously replace manual pattern, color, placement, or user-selected topology.

Visual Director is an enhancer, not a hidden preset operator unless Auto Performance explicitly grants it that authority.

---

# 14. Choreography Contract

Choreography must be:

- bounded
- deterministic
- reset-safe
- musically meaningful
- visible
- subordinate to declared user authority

Every choreography rule must document:

- source signal
- target
- operation
- maximum strength
- attack
- decay
- conditions
- ownership behavior

Avoid unrestricted replacement operations on user-owned values.

Use additive or multiplicative modulation where possible.

Event envelopes must return cleanly to the user's authored base.

---

# 15. Auto Performance Contract

Auto Performance must never simply mean "automation can change anything."

Every preset must explicitly define its Auto Performance domains.

Example:

Auto Performance may own:

- pattern selection
- segment program selection
- phrase-level camera choices

while the user still owns:

- color
- maximum beam count
- brightness ceiling
- side/top fixture authorization
- atmosphere ceiling
- strobe enable
- effect enable

### Manual takeover

If a user manually edits a property that Auto Performance owns:

- disable Auto Performance for that domain, or
- switch that domain to Manual

The result must be immediate and visible.

---

# 16. Render-Space Selection Rule

A preset must deliberately choose between:

- screen-space
- world-space
- hybrid

Do not automatically convert legacy screen-space artwork to 3D.

## Use screen-space when

The composition is fundamentally tied to the frame:

- edge emitters
- UI-like geometric structures
- full-frame symmetry
- exact border reach
- graphic installations

## Use world-space when

Actual depth is part of the design:

- orbiting objects
- volumetric environments
- perspective-dependent structures
- true camera movement
- spatial lighting

## Use hybrid when

The main design must stay compositionally locked while supporting depth-aware enhancements.

The choice must be based on the intended visual result, not on which Cinema 2.0 feature is newer.

---

# 17. Camera Contract

Camera movement must never repair bad composition.

Before enabling automatic camera behavior:

- prove the preset works from its default authored camera
- define camera safe bounds
- define maximum dolly/orbit/FOV changes
- verify important objects cannot leave frame
- verify screen-edge elements remain where intended

Camera choreography should normally be subtle unless the preset concept specifically calls for large camera motion.

---

# 18. Effects Contract

Effects are finishing systems.

Every effect must pass three states:

- OFF
- normal authored value
- maximum allowed value

The difference must be visible without destroying the underlying visual.

Bloom, trails, haze, feedback, distortion, and other effects may not be used to compensate for weak or invisible base geometry.

---

# 19. Mandatory Production-Canvas Testing

Do not validate a preset only through unit tests or internal data.

Every first-party preset must have production-path browser tests against the real rendered canvas.

The test suite must include:

## Baseline visibility

The intended primary visual is actually visible.

A bright background alone must not satisfy this test.

Tests should measure the preset's actual hero geometry or relevant regions when possible.

---

## Control-effect tests

Every primary user-facing control must demonstrate a perceptible output difference.

At minimum:

- minimum
- default
- maximum

For discrete controls:

- every important enum option must produce the expected family of visual change.

---

## Motion test

Capture multiple frames while motion should be active.

The frames must show meaningful visual change.

A running RAF loop is not proof of motion.

---

## Audio-reactivity test

Run with an analyzed track or deterministic Audio Intelligence fixture.

Prove that:

- quiet and energetic sections differ
- at least one rhythmic event changes the expected visual region
- at least one structural event changes the expected structural property
- visual change follows audio timing

---

## Manual-authority test

With Auto Performance enabled:

1. identify an auto-owned property
2. manually edit it
3. verify the user takes control according to the preset contract
4. verify automation stops overriding that property

---

## Re-entry test

Switch to another preset and back.

Verify:

- output returns correctly
- controls remain functional
- stale motion state is cleared
- resources are correct
- audio reactivity resumes

---

## Aspect-ratio and resize test

At minimum validate the supported production aspect ratios and resize behavior.

For frame-anchored presets, explicitly verify:

- bottom elements stay bottom
- top elements stay top
- edge elements stay at their intended edge
- safe padding remains correct

---

# 20. Human Visual Acceptance Is Mandatory

Pixel metrics can prove change.

They cannot prove that the change looks correct.

Every new or ported first-party preset must receive a human visual review against its reference.

For legacy ports, compare legacy and Cinema 2.0 side by side.

Review:

- composition
- scale
- placement
- visual weight
- timing
- movement quality
- musicality
- control responsiveness
- build/drop behavior
- camera behavior
- overall identity

If a user familiar with the preset would say "this no longer looks or behaves like that preset," the port is not complete.

---

# 21. Required Legacy A/B Acceptance

A legacy port must include reproducible comparison checkpoints.

Recommended checkpoints:

1. idle / no audio
2. low-energy verse
3. vocal section
4. steady groove
5. build midpoint
6. final build moment
7. first drop impact
8. sustained drop
9. phrase transition
10. section transition

Cinema 2.0 does not need identical pixels.

It must preserve the same visual idea, hierarchy, behavior, and recognizable performance vocabulary unless a deliberate product change has been approved.

---

# 22. Strict Stop-Ship Conditions

A preset must not be marked complete, merged as production-ready, or exposed as a finished first-party preset if any of the following are true:

- hero visual is incorrectly positioned
- required geometry is missing
- user-facing control has no visible result
- multiple unrelated controls change the same thing accidentally
- music plays but the intended visual does not react
- only brightness changes when richer behavior is required
- Auto Performance prevents manual edits from taking effect
- automation re-enables something the user explicitly disabled
- movement exists only in code values but not visibly on canvas
- generic motion replaced authored pattern-specific motion
- camera movement breaks the composition
- effect output hides the base visual
- preset fails after switching away and back
- seek/track changes leave stale choreography
- idle behavior is indistinguishable from intended music response
- legacy port is recognizably worse than the legacy behavior without an approved design reason
- only unit tests pass while visual acceptance has not been performed

Any one of these is a release blocker.

---

# 23. Required Implementation Order for AI/LLM-Generated Preset Work

When an AI coding system is asked to create or port a Cinema 2.0 preset, the implementation request must require it to perform the following sequence.

## Step 1: Inspect

Inspect the current:

- preset manifest
- module runtime
- parameter system
- target resolver
- Audio Intelligence bridge
- Visual Director
- Choreography runtime
- render graph
- camera runtime
- effect runtime
- relevant existing presets
- production browser harnesses
- visual acceptance tests

Do not assume an API or subsystem exists.

---

## Step 2: Write the behavior specification before code

Document:

- visual target
- geometry
- movement
- control mapping
- audio mapping
- authority matrix
- system ownership

For legacy ports, document legacy behavior first.

---

## Step 3: Implement the visual core first

Build the actual geometry/rendering.

No automation is allowed to mask missing visual behavior.

---

## Step 4: Prove every manual control

Add production-canvas acceptance tests.

Do not continue while primary controls are perceptually inert.

---

## Step 5: Prove motion

Verify actual frame-to-frame visual change.

---

## Step 6: Connect Audio Intelligence

Use the shared source.

Do not create local analysis.

Prove the output changes with real or deterministic music input.

---

## Step 7: Add Choreography

Map musical information to bounded preset-specific actions.

---

## Step 8: Add Visual Director meaning

Use Director output for macro significance and structural behavior.

---

## Step 9: Add Auto Performance

Declare exactly which domains it owns.

Add manual takeover behavior.

---

## Step 10: Add camera/effects/depth enhancements

Only after the base preset is already correct.

---

## Step 11: Run full acceptance

Unit tests + production browser tests + perceptual output checks + human A/B review.

---

# 24. Required Deliverables for Every Preset Implementation

Every implementation must produce or update:

1. Preset behavior specification
2. System ownership map
3. User/automation authority matrix
4. Parameter-to-visible-output map
5. Audio-signal-to-visual-response map
6. Native module/render implementation
7. Production-path control tests
8. Production-path motion tests
9. Production-path audio-reactivity tests
10. Manual takeover tests
11. Preset re-entry/reset tests
12. Visual acceptance captures or checkpoints
13. Legacy A/B comparison when porting
14. Known intentional differences from legacy, if any

---

# 25. Definition of Done

A Cinema 2.0 preset is complete only when all of the following are true.

### Visual

- [ ] Base composition is correct.
- [ ] Primary visual elements are correctly positioned.
- [ ] Required safe bounds are respected.
- [ ] Resize/aspect behavior is correct.
- [ ] Visual identity matches the approved reference.

### Controls

- [ ] Every primary control visibly works.
- [ ] Minimum/default/maximum states are validated.
- [ ] Discrete options visibly produce their intended result.
- [ ] Disabled features remain disabled.
- [ ] No placebo controls exist.

### Motion

- [ ] Idle motion matches the specification.
- [ ] Pattern-specific motion is actually pattern-specific.
- [ ] Frame-to-frame motion is visible.
- [ ] Movement does not depend on hidden stale state.

### Audio

- [ ] Shared Audio Intelligence is used.
- [ ] Playback causes visible reactive change.
- [ ] Rhythmic response is visible.
- [ ] Continuous energy response is visible.
- [ ] Structural response is visible where intended.
- [ ] Pause/seek/loop/track-change behavior is correct.

### Authority

- [ ] Every major property has declared ownership.
- [ ] Manual edits take effect immediately.
- [ ] Auto Performance cannot silently fight the user.
- [ ] Hard-disable controls are respected.
- [ ] Automation returns cleanly to authored values.

### Cinema 2.0 Enhancements

- [ ] Visual Director is used only for broad significance.
- [ ] Choreography owns transient preset-specific modulation.
- [ ] Camera behavior respects visual safe bounds.
- [ ] Effects enhance rather than conceal the visual.
- [ ] Optional systems are used only when they have a clear purpose.

### Reliability

- [ ] Preset survives switching away and back.
- [ ] Runtime state resets correctly.
- [ ] No resource/lifecycle errors occur.
- [ ] Production browser path is tested.
- [ ] Human visual acceptance is complete.

### Legacy Ports

- [ ] Legacy behavior inventory exists.
- [ ] Static composition parity is approved.
- [ ] Manual behavior parity is approved.
- [ ] Motion vocabulary is preserved.
- [ ] Audio-response vocabulary is preserved.
- [ ] Cinema 2.0 enhancements do not erase the legacy identity.

---

# Final Rule

**Cinema 2.0 intelligence must enhance an already-correct visual preset. It must never be used as a substitute for correctly implementing the preset itself.**

A successful Cinema 2.0 preset should give the user both:

- stronger authorship when they want manual control, and
- smarter musical performance when they explicitly allow automation.

If either side weakens the other, the preset architecture is wrong.
