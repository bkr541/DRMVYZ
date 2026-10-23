# BLOCKSHIFT controls and patterns

BLOCKSHIFT places you inside a field of fifteen cubes: fourteen Hallow Cubes and one deeper Impossible Cube. Near cubes can extend beyond the picture edges, with others beside and behind the camera. The supplied GLB models retain their shapes; their frames become segmented, audio-reactive LED bars. This guide describes revision 17, currently **BLOCKSHIFT (Preview)**.

Choose BLOCKSHIFT in Cinema 2.0's System presets. Load and play a track for automatic movement and musical reactions. With no track loaded, you can still adjust the composition, colors, lens and effects and select patterns manually. Every control lives under one of four Inspector parents: Master Controls, Design, Effects or Palette.

## Master Controls

| Control | Default / range | Behavior |
|---|---|---|
| BPM Sync | ON | Uses available shared musical tempo/grid information for synchronized timing, with the existing authored-tempo fallback. OFF uses the fixed performance timing path. This local control governs BLOCKSHIFT even when the host Sync setting differs. |
| Master Intensity | 1.00 / 0–2 | Scales cube illumination and atmospheric mix. At zero, cube/LED output and atmospheric glow are extinguished; the Background palette color remains. |
| Auto Performance | OFF | Permits temporary build tension and drop release around the current pattern. Saved Pattern, Trigger, palette and geometry settings retain their authored values. |
| Motion Amount | 55% / 0–100% | Governs physical pattern/audio/Auto movement, added cube spin and camera movement. Zero holds physical animation. Manual edits still apply. |
| Audio Reactivity | 80% / 0–100% | Controls musical geometry/LED modulation and the Auto overlay contribution. Zero leaves steady LEDs and the nonmusical pattern movement. |
| Camera Motion | ON | Enables the floating camera. OFF restores its base position and forward view. |
| Camera Motion Intensity | 60% / 0–100% | Appears when Camera Motion is ON. Sets camera travel within Motion Amount and the observer's safe volume. Zero restores the base view. |
| Quality / Performance | Quality | Quality favors detail; Balanced and Performance reduce render cost; Auto adapts the shared engine's quality policy. The three fixed modes have current hardware observations in the acceptance report. |

## Design

**Pattern** contains the formation and event-cycling controls.

| Control | Default / choices | Behavior |
|---|---|---|
| Pattern | Stagger / six patterns below | Chooses the underlying formation. Manual selection takes priority over a held/stale event or active Auto overlay. |
| Pattern Change | OFF | ON allows fresh events of the selected Trigger to cycle the underlying formation. The saved Pattern selection remains unchanged. |
| Trigger | Every 4 Bars | Appears when Pattern Change is ON. Choices: Beat, Kick, Snare, Downbeat, Every 2 Beats, Every 4 Beats, Bar, Every 4 Bars, Every 8 Bars, Phrase and Drop. Its selection is retained while hidden. |

**Blocks** controls the size and space around you.

| Control | Default / range | Behavior |
|---|---|---|
| Block Size | 1.35 / 1.05–6.00 | Changes each model's physical scale. The maximum gives a 36-unit normalized model span. Nearby cubes grow in view; the local clearance solver moves conflicting cubes as needed. |
| Spread | 1.00 / 0.50–3.00 | Increases separation independently of model size. Large sizes and orientations can require additional safety clearance. |
| Depth | 45% / 0–100% | Changes foreground/background separation throughout the surrounding field. |
| Rotation Range | 16° / 0–45° | Limits the small pattern/audio tilts. Added full cube spin is controlled separately by Rotate Cubes. |

**Motion** contains formation speed, additional cube spin and optional camera orbit.

| Control | Default / range | Behavior |
|---|---|---|
| Motion Rate | 1.00 / 0.25–2.00 | Sets the speed of the physical pattern cycle and added cube spin, together with Motion Amount. |
| Transition Length | 1 beat / 0.5, 1, 2 or 4 beats | Sets formation blending time. Idle manual changes also transition; edits while paused or at Motion Amount zero apply immediately. |
| Rotate Cubes | OFF | Adds distinct signed rotations around different axes to all fifteen cubes. OFF holds the added orientation while normal pattern tilts can continue. At 120 BPM and default Motion Amount/Rate, primary-axis speeds are approximately 12–22°/second. |
| Orbit Camera | OFF | Appears when Camera Motion is ON. Adds a turning view to the existing float while the observer remains inside the field. |
| Orbit Intensity | 35% / 0–100% | Appears when Camera Motion and Orbit Camera are both ON. Controls orbit speed. Zero or Orbit Camera OFF holds its heading while float continues. Camera Motion OFF resets the base view. |

## Six geometry patterns

| Pattern | Shape and movement |
|---|---|
| Stack | A taller, narrower arrangement with gentle lateral and vertical sways. |
| Orbit | The cube field rotates around the observer, bringing side and rear cubes into view, with a small vertical breathing motion. This is separate from Orbit Camera. |
| Stagger | Alternating offsets and varied depth, with different lateral/vertical/depth trajectories across cubes. |
| Split | Wider left/right banks with contrasting depth offsets and a rhythmic opening movement. |
| Wave | A traveling ripple through height and depth, with phase offsets across the cubes. |
| Collapse | Bounded compression and expansion of the field, with staggered depth movement. Safety clearance preserves the observer space and cube separation. |

All six retain the same fifteen identities and use the shared performance clock. Changing a pattern changes actual geometry. Rotate Cubes adds its separate orientations to whichever pattern is active.

## Effects

| Group / control | Default / range | Behavior |
|---|---|---|
| Scene / Bloom | 0.30 / 0–1 | Adds shared HDR glow around bright LED surfaces. Zero restores the image without bloom. |
| Scene / Atmosphere | ON | Adds shared Threshold smoke/haze and colored light spill gathered from visible LEDs. OFF bypasses it. Light spill follows the LED source image; this uses depth-aware haze and screen-space shafts. |
| Camera / Float Speed | 0.70 / 0.25–2.00 | Appears when Camera Motion is ON. Changes floating movement speed. Orbit Intensity independently controls turning speed. |
| Camera / Field of View | 85° / 60–100° | Changes the lens. Smaller values narrow the view and enlarge visible objects; larger values reveal more surrounding space. |

## Palette

| Color | Default | Visible role |
|---|---|---|
| Primary Edge | `#55e6ff` | The primary group of Hallow Cube LED frames. |
| Secondary Edge | `#7866ff` | The second Hallow Cube LED group. |
| Impact Accent | `#fff1d6` | The deeper Impossible Cube's frame/accent role. |
| Block Body | `#151a24` | Cube faces and LED housings. |
| Background | `#050811` | The scene background. |

## Musical behavior and manual authority

Shared Audio Intelligence provides bass/energy, mids/highs, vocals, rhythmic events and section/build/drop information. These drive bounded cube movements and geometry-aware LED circuits: kick and snare address different banks/circuits, high-frequency passages add glints, vocal passages focus accents and restrain movement, and structural cues shape occupancy and chases. The Visual Director adjusts significance within these existing routes.

With Auto Performance ON, a fresh build can add a brief compression bias and a fresh drop a release bias. The overlay expires back to the current underlying pattern, including legitimate Trigger advancement during the overlay. A manual Pattern, Size, Spread, Depth or Rotation Range edit cancels the active overlay immediately and starts a two-performance-beat cooldown; already-held cues stay consumed.

Pause holds physical animation and resume continues without catch-up. Seeks, track/context changes and preset disposal reset transient spin/event/automation state. Inspector values persist through preset re-entry, while transient performance state is rebuilt. Motion/audio/camera/effect hard disables remain effective under Auto Performance.

## Review material and status

[Visual comparison](evidence/p8-acceptance/phase8-visual-review.png) · [six-pattern filmstrips](evidence/p8-acceptance/six-pattern-filmstrips.png) · [LED recording](evidence/p8-acceptance/led-bars.webm) · [camera orbit](evidence/p8-acceptance/orbit-camera.webm) · [Auto build/drop](evidence/p8-acceptance/phase6-performance.webm).

Recordings use explicit synthetic upstream fixtures and controlled transport. The user approved the reviewed visuals and behavior during Phase 9. See the [release gate](09_RELEASE_GATE.md) for the current decision and [Phase 9 report](29_P9_RELEASE_SIGNOFF_REPORT.md) for validation and unresolved items.
