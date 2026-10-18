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

If the user manually changes that property, the user must immediately reclaim control of that domain according to its explicitly declared authority rule.

### Mandatory rule

**By default, a manual edit to an auto-owned property must disable automation for that property or its clearly defined domain.**

The mandatory **Pattern / Pattern Change / Trigger** controls in Section 9 have one explicitly defined exception: selecting a Pattern while Pattern Change is ON immediately establishes the user's chosen base pattern **without turning Pattern Change OFF**. The selected pattern remains the base until the next *new, qualifying* Trigger; any authorized Auto Performance build/drop override must remain temporary and must not overwrite the authored Pattern or Pattern Change setting.

Other automatic domains continue to follow the manual-takeover rule unless their authority is explicitly specified otherwise. No automation may instantly cancel a manual Pattern edit using the same already-active musical event.

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
- BPM/tempo synchronization behavior, including whether timing is free-running or beat-locked
- palette/color roles and how each color affects the visual
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

In addition to legacy parity, every port must add and validate the mandatory shared Design controls defined in Section 9: **BPM Sync** under **Master Controls**, at least **four independently configurable color controls** under **Palette**, and **Pattern / Pattern Change / Trigger** together under **Design** with at least six native patterns, even when the legacy preset did not expose equivalent controls. Their authored defaults must preserve the approved baseline composition and behavior.

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
- pattern/layout vocabulary, including at least six original preset-appropriate Pattern options (with no fixed maximum) and how automatic changes use the shared Trigger events
- idle state
- build behavior
- drop behavior
- vocal behavior
- expected audio responsiveness
- BPM Sync behavior, including which timing/motion domains become beat-locked when enabled and what authored/free-running behavior is used when disabled
- manual controls
- automatic controls
- palette role map containing at least four independently configurable color roles
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
- Pattern / Pattern Change / Trigger ownership and any temporary Auto Performance build/drop override
- color
- camera
- trails
- bloom
- haze
- background intensity

This matrix must be agreed before code is written.

---

# 9. Parameter Contract

## Inspector parent-group requirement

Every user-facing parameter rendered within a Cinema 2.0 preset's Design inspector hierarchy, including any nested group of parameters, must be contained under exactly one of these four top-level parent groups:

- **Master Controls**
- **Design**
- **Effects**
- **Palette**

Nested groups are allowed beneath these parent groups. This requirement defines only the top-level Inspector hierarchy. It must not hard-code or whitelist parameter names, subgroup names, parameter counts, control types, ranges, behaviors, runtime bindings, ownership modes, or preset-specific implementation details. A Cinema 2.0 preset may introduce whatever parameters and nested groups its design requires, provided their Design-inspector placement resolves under one of the four parent groups.

Do not satisfy this requirement by matching specific parameter labels or preset-specific names in shared Inspector code. The grouping mechanism must remain generic enough for current and future Cinema 2.0 presets.

## Mandatory shared Design controls

The following controls are required for **every first-party Cinema 2.0 preset**, whether it is a legacy port or a new preset created from scratch. These are preset-authoring requirements and must not be implemented as preset-name special cases in shared Inspector code.

### BPM Sync

Every preset must expose a user-facing **BPM Sync** toggle in the **Design** tab under the top-level **Master Controls** parent group.

The BPM Sync control must:

- be a boolean toggle available as a primary user control
- have a real runtime consumer and must not be a placebo or Inspector-only value
- govern the preset's tempo-synchronized motion/timing domains that are intended to lock to musical timing
- when enabled, use Cinema 2.0's shared transport and/or Audio Intelligence timing sources rather than creating a preset-local BPM detector, beat detector, or competing musical clock
- when disabled, remove BPM/beat locking for the governed timing domains and use a deliberate authored/free-running timing behavior without unintentionally disabling unrelated audio reactivity
- behave deterministically across play, pause, resume, seek, loop, track change, preset re-entry, and BPM Sync state changes
- produce a perceptibly different timing result between appropriate Sync ON and Sync OFF test cases whenever the preset contains time-varying motion or timing behavior

If an engine-wide or host-level BPM Sync state also exists, the preset must explicitly define how its BPM Sync control composes with that state. Two independent toggles must not silently fight each other, and the user-facing preset control must not imply synchronization that the rendered preset ignores.

A preset with no meaningful tempo-aware behavior is not exempt. It must define at least one appropriate visual timing or motion domain for BPM Sync before it can be considered complete.

### Palette minimum

Every preset must expose at least **four independently configurable user-facing color controls** in the **Design** tab under the top-level **Palette** parent group.

The four-color minimum must:

- use actual `color` parameters
- provide semantically meaningful visual roles appropriate to the preset, such as **Background**, **Primary**, **Secondary**, **Accent**, **Highlight**, **Atmosphere**, **Emission**, or another preset-specific role
- include a configurable background color when the preset renders or owns a configurable background surface
- allow each color to be edited independently by the user
- connect each color to a real visual consumer so changing that color produces the intended visible result
- preserve manual color edits as the authored base truth unless a clearly labeled automatic color mode is explicitly granted authority to modulate or replace them

A Color Mode selector, palette preset selector, gradient selector, derived color, hidden runtime color, or duplicate alias does **not** count toward the four-color minimum. Multiple controls that merely write the same undifferentiated color target also do not satisfy the requirement.

Preset-specific labels are allowed and encouraged. The contract requires the four configurable color roles and their placement under **Palette**; it does not require every preset to use identical color names.

### Mandatory Pattern / Pattern Change / Trigger controls

Every newly created or newly ported first-party Cinema 2.0 preset **must expose all three controls together** in the **Design** tab under the top-level **Design** parent group, in this order: **Pattern**, **Pattern Change**, and **Trigger**. They may be organized in a nested **Pattern** group within **Design**, but must not be scattered across Master Controls, Effects, or Palette. Implement these through generic Cinema 2.0 parameter definitions, bindings, and existing Inspector conditional-visibility mechanisms; do not special-case preset names or build an alternate control system.

#### 1. Pattern (dropdown)

- Provide a user-facing enum/dropdown labeled exactly **Pattern**, with **at least six distinct, working pattern options** and **no fixed maximum**.
- Each option must be expressly designed for the **new preset's own visual engine, rendering, purpose, composition, atmosphere, and overall identity**. Preserve creative freedom: **do not prescribe, copy, or hard-code universal pattern names, choreography styles, geometry arrangements, visual effects, movement sequences, or specific pattern content** into the shared contract or Inspector. The preset author defines its own appropriate options.
- Every advertised pattern must have a genuine native runtime consumer and produce its intended, verifiable preset-specific visual result. Six differently labeled aliases of the same behavior do not satisfy the minimum.
- Manual Pattern selection must take effect immediately, whether Pattern Change is OFF or ON. The selected Pattern is the authored base selection; automatic runtime changes must not silently overwrite its persisted parameter value.

#### 2. Pattern Change (toggle)

- Provide a user-facing **boolean toggle** labeled exactly **Pattern Change**, following the established Cinema 2.0 pattern-control behavior; default to **OFF**.
- **OFF:** the manually authored Pattern stays selected. No Trigger-driven pattern cycling may occur, and the Trigger control must not appear as an active user option. Ordinary audio-reactive modulation of the selected pattern may continue.
- **ON:** the runtime can advance from the current base Pattern to another authored Pattern when the selected Trigger receives a **new qualifying musical event**. Changes must be real and visibly reflected in the render output, not only in an internal ID.
- **Manual selection while ON is intentionally allowed:** choosing a Pattern immediately makes it the active base pattern **without disabling Pattern Change**. The manually chosen pattern remains the base until the **next new qualifying Trigger event**, when automatic advancement resumes. Do not let an event already present when the user edited Pattern cause an immediate unwanted jump.
- Follow the established shared Cinema 2.0 event-driven switching conventions, including no accidental immediate repetition, duplicate-event suppression, deterministic playback/timeline handling, and safe behavior on pause, resume, seek, loop, track change, Trigger edits, toggle changes, and preset re-entry. The choice and choreography of the preset-specific patterns remain entirely up to the preset author.

#### 3. Trigger (dropdown)

- Provide a user-facing enum/dropdown labeled exactly **Trigger**, visible and selectable **only when Pattern Change is ON**. Preserve its selected value when the toggle is OFF so it is restored when enabled again.
- Use the **exact same 11 option values, labels, and meanings** as the established shared Cinema 2.0 Pattern Change trigger dropdown. Reuse the existing `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` or its canonical shared successor rather than retyping or inventing a competing list:

  | Value | Display label |
  |---|---|
  | `beat` | Beat |
  | `kick` | Kick |
  | `snare` | Snare |
  | `downbeat` | Downbeat |
  | `beat2` | Every 2 Beats |
  | `beat4` | Every 4 Beats |
  | `bar` | Bar |
  | `bar4` | Every 4 Bars |
  | `bar8` | Every 8 Bars |
  | `phrase` | Phrase |
  | `drop` | Drop |

- Trigger changes determine **when** a different pattern is selected, **not** which geometry, animation, or audio-reactive choreography the chosen pattern contains. Individual patterns continue reacting to the shared Audio Intelligence signals between pattern transitions.
- Consume Cinema 2.0's shared beat, rhythmic, structural, and drop event sources and established trigger-resolution semantics. Do not implement a second beat clock, drop detector, phrase detector, or independent preset-local event definition.

#### Pattern selection authority and Auto Performance interaction

- **Pattern Change and Auto Performance are distinct controls.** Enabling Pattern Change does **not** automatically disable Auto Performance, and manually choosing a Pattern does **not** turn Pattern Change OFF.
- If the preset has Auto Performance, it **may temporarily override the currently performing pattern during an authorized build or drop**, even while Pattern Change is ON. Such an override must be explicitly scoped to the musical moment, visually purposeful, and bounded. It must **not** permanently replace the user's authored Pattern, disable Pattern Change, mutate the saved Trigger, or take indefinite ownership of the pattern domain.
- While a temporary override is visible, keep the underlying Pattern Change controller's scheduled progression well-defined. When the override ends, render the current underlying base pattern, including any valid Trigger-driven advancement that occurred during the override.
- A manual Pattern edit must not be instantly undone by an already-active build/drop event. The edit must take visible effect; another temporary override can begin only on a subsequent separately qualifying Auto Performance event. This is the express pattern-specific exception to the default manual-takeover conventions in Sections 3 and 15.
- The preset must document this precedence clearly in its authority matrix: **manual selection establishes base Pattern -> selected Trigger may advance the base while Pattern Change is ON -> Auto Performance may temporarily substitute a build/drop performance pattern -> underlying base resumes afterward**.

**Completion condition:** a preset fails this mandatory control requirement if the three controls merely appear in the Inspector, fewer than six meaningful native patterns exist, the Trigger options differ from the canonical list, manual Pattern selection wrongly disables Pattern Change, or the specified musical switching and temporary-override behavior is not demonstrated in the real production render.

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

The preset's required **BPM Sync** control must also transition cleanly between synchronized and unsynchronized timing without a visible discontinuity, stale phase, frozen motion, or competing-clock behavior unless a deliberate hard reset is part of the authored design.

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

If a user manually edits a property that Auto Performance owns, the default response is to:

- disable Auto Performance for that domain, or
- switch that domain to Manual.

The result must be immediate and visible.

**Exception for the required Pattern control:** while Pattern Change is enabled, a manual Pattern choice must immediately take effect as the base pattern **without disabling Pattern Change**, and the next new qualifying Trigger may advance it. Auto Performance may still provide **temporary build/drop overrides** under the explicit precedence, restoration, and non-interference rules in Section 9. This exception does not authorize silent overrides of other manual controls.

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

## Mandatory shared-control tests

Every preset must additionally prove on the production path that:

- **BPM Sync** is present under **Design > Master Controls**, is user-editable, reaches a real timing consumer, and changes the governed motion/timing behavior between appropriate Sync ON and Sync OFF cases
- at least **four independently configurable color controls** are present under **Design > Palette**
- each required Palette color can be changed independently and visibly affects its documented visual role
- no required Palette color is only a duplicate alias, hidden derived value, or unconsumed state
- **Pattern**, **Pattern Change**, and conditionally visible **Trigger** exist together under **Design > Design**, with the correct control types and wiring
- the Pattern dropdown offers **at least six** distinct preset-specific choices, each of which produces the authored visual result on the production canvas
- the Trigger dropdown exposes **exactly the 11 canonical shared options**, with unchanged values, labels, and event meanings, and is displayed only when Pattern Change is ON
- Pattern Change OFF holds the selected base Pattern; Pattern Change ON advances it only on a new qualifying event and does not double-switch on duplicate events
- manually choosing a Pattern while Pattern Change is ON immediately displays the chosen base, **leaves Pattern Change ON**, and holds that selection until the next fresh qualifying Trigger
- if Auto Performance is supported, a build/drop override is temporary, does not immediately cancel a manual edit, and restores the correctly advanced underlying pattern when it ends
- all pattern/toggle/trigger behavior remains correct through pause, resume, seek, loop, track change, preset re-entry, and control changes

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
- BPM Sync is missing, placed outside Design > Master Controls, or does not control a real synchronization/timing path
- any of the required Pattern / Pattern Change / Trigger controls is missing, is placed outside Design > Design, has the wrong type, or has no real runtime consumer
- fewer than six distinct preset-specific working Pattern options are available, or pattern options are visually inert aliases
- Trigger omits or alters any of the 11 canonical options, is not conditional on Pattern Change, or does not advance patterns at qualified shared musical events
- manually selecting a Pattern incorrectly disables Pattern Change, or a stale/duplicate Trigger causes an immediate unwanted switch
- Auto Performance permanently steals pattern ownership, cancels a manual edit using an already-active build/drop event, or fails to restore the underlying pattern after a temporary override
- fewer than four independently configurable user-facing color controls exist under Design > Palette
- any required Palette color is visually inert, unconsumed, or only aliases the same undifferentiated target as another required color
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
- BPM Sync timing contract
- preset-specific Pattern library (at least six, no fixed maximum) and shared Pattern Change / Trigger behavior specification, without prescribing the option names or choreography content
- palette role map with at least four independently configurable colors
- authority matrix, including Pattern Change and any temporary Auto Performance build/drop ownership
- system ownership

For legacy ports, document legacy behavior first.

---

## Step 3: Implement the visual core first

Build the actual geometry/rendering.

No automation is allowed to mask missing visual behavior.

---

## Step 4: Prove every manual control

Add production-canvas acceptance tests.

Explicitly prove the mandatory **BPM Sync** control, the minimum four independently configurable **Palette** color controls, and the complete **Pattern / Pattern Change / Trigger** control set (including all six-or-more real patterns and correct Inspector placement) before continuing. Complete automatic trigger and override testing once Audio Intelligence and Auto Performance are connected.

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

Add manual takeover behavior, respecting the Section 9 exception for Pattern selection while Pattern Change stays enabled. Prove temporary build/drop overrides return to the current base pattern without clobbering authored choices.

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
6. BPM Sync timing contract
7. Pattern library specification documenting at least six genuinely distinct preset-specific options, with no prescribed pattern names or choreography styles
8. Pattern Change / Trigger behavior and authority specification, including temporary Auto Performance build/drop overrides when supported
9. Palette role map documenting at least four independently configurable user-facing colors
10. Native module/render implementation
11. Production-path control tests, including all required Pattern controls and the 11 Trigger options
12. Production-path motion tests
13. Production-path audio-reactivity and event-driven pattern transition tests
14. Manual takeover and Pattern Change preservation tests
15. Preset re-entry/reset tests
16. Visual acceptance captures or checkpoints
17. Legacy A/B comparison when porting
18. Known intentional differences from legacy, if any

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
- [ ] **BPM Sync** exists in **Design > Master Controls**, is user-editable, is wired to a real timing consumer, and has validated Sync ON/OFF behavior.
- [ ] **Pattern**, **Pattern Change**, and **Trigger** are correctly implemented together under **Design > Design**, with Trigger conditionally visible only when Pattern Change is ON.
- [ ] **Pattern** contains at least six genuine, independently working preset-specific choices, with no imposed upper limit, pattern names, or choreography templates.
- [ ] **Trigger** contains the exact 11 shared Cinema 2.0 musical-event options and selects when to advance the pattern.
- [ ] At least **four independently configurable color controls** exist in **Design > Palette**.
- [ ] Each required Palette color visibly controls its documented visual role and is not a duplicate alias or derived-only value.
- [ ] Minimum/default/maximum states are validated.
- [ ] Discrete options visibly produce their intended result.
- [ ] Disabled features remain disabled.
- [ ] No placebo controls exist.

### Motion

- [ ] Idle motion matches the specification.
- [ ] Pattern-specific motion is actually pattern-specific.
- [ ] Switching between every required Pattern option produces its intended visible output.
- [ ] Frame-to-frame motion is visible.
- [ ] Movement does not depend on hidden stale state.

### Audio

- [ ] Shared Audio Intelligence is used.
- [ ] Playback causes visible reactive change.
- [ ] Rhythmic response is visible.
- [ ] Continuous energy response is visible.
- [ ] Structural response is visible where intended.
- [ ] Pattern Change advances on the selected new qualifying Trigger event, without stale or duplicate transitions, and leaves the base pattern unchanged when OFF.
- [ ] Pause/seek/loop/track-change behavior is correct.
- [ ] BPM Sync uses shared Cinema 2.0 timing sources when enabled and a deliberate non-synced timing path when disabled.

### Authority

- [ ] Every major property has declared ownership.
- [ ] Manual edits take effect immediately.
- [ ] Manually selecting a Pattern while Pattern Change is ON updates the base immediately, leaves Pattern Change ON, and holds until the next fresh qualifying Trigger.
- [ ] If Auto Performance supports build/drop pattern overrides, those overrides are bounded and temporary and resume the correctly maintained base selection afterward.
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
