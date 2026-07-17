# PixGrid Unified Performance Runtime

PixGrid resolves every musical frame through `PixGridUnifiedPerformanceRuntime`. The runtime never writes modulation, transient envelopes, transition progress, or renderer resources into persisted project state.

## Composition order

1. Normalize authored PixGrid state.
2. Resolve the active scene and authored layers.
3. Resolve the Shared Performance Program at the current musical position.
4. Reconstruct and apply persistent Track Map cue overrides through the current track time.
5. Evaluate continuous Audio Intelligence assignments.
6. Evaluate retained discrete event envelopes using authoritative audio time.
7. Apply temporary manual overrides.
8. Select one transition owner.
9. Compile layer, group-mask, and framebuffer instructions.
10. Render the logical framebuffer, then present it as physical LED cells.

The source-of-truth order is exported as `PIX_GRID_RUNTIME_COMPOSITION_ORDER`.

## Runtime state separation

- **Authored persistent state:** scenes, layers, sparse pixel overrides, groups, reaction assignments, and saved performance settings.
- **Derived persistent automation state:** replayed Track Map cues and the current Shared Performance Program scene/actions.
- **Continuous modulation state:** smoothed Audio Intelligence values held by `PixGridReactionRuntime`.
- **Transient envelope state:** bounded attack/hold/release records held by the reaction and Performance runtimes.
- **Transition state:** one audio-time transition selected by deterministic precedence.
- **Manual override state:** temporary cue patches and authored lock routes.
- **Final frame state:** normalized state plus bounded compiled group effects passed to the compositor.

## Group-mask behavior

Group-targeted Performance and cue actions become `PixGridGroupFrameEffect` instructions. The compositor applies them through compiled bitsets, never by converting a group target into its associated layer IDs. Explicit layer targets continue to operate on whole layers. Effects are bounded, sorted by stage, group priority, effect priority, and stable ID, so overlap does not depend on object iteration order.

## Transition precedence

1. Active Track Map PixGrid cue transition, including a manual cue action.
2. Active Shared Performance Program transition.
3. Scene/preset cut fallback when no authored transition exists.

Cue and Performance progress use audio time. Pause holds progress, seek reconstructs it, loop wrapping resets track-local transient state, and track replacement clears the complete track-local runtime.
