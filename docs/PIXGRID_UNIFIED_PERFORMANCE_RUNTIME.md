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

## Resolved reaction ledger

The compositor-owned `PixGridReactionRuntime` publishes one compact `routeActivity` record per compiled route per frame. Each record contains the stable route ID, source, target, scope, target ID, active/idle/fallback/disabled/blocked state, resolved value, perceptually calibrated effective amount, confidence, fallback state, envelope phase, affected group IDs, and a human-readable reason. Multiple evaluations of one route in a frame are merged by stable ID and never create unbounded diagnostic history.

`mergePixGridReactionRuntimeDiagnostics` replaces the eligibility-only view with the actual compositor evaluation after either Canvas2D or WebGL2 renders. Affected cells are derived from the active shared group masks. Whole-frame targets report the full logical matrix. This merged snapshot is the source used by the Analysis inspector and renderer diagnostics.

## Transport and recovery boundaries

Track replacement, built-in preset switching, entering or leaving the stopped state, and renderer disposal reset transient performance, cue, route, and mask state. Stop/end-of-track is not treated as pause: the surface evaluates a neutral frame, removes temporary group effects and transitions, and reports an idle envelope phase. Pause holds the resolved frame. Resume, analyser recovery, and GPU-to-Canvas fallback reuse the same authoritative audio time and event identities.

Discrete cooldown uses `lastAcceptedTriggerTimeSec`, not the current envelope tail. Expired envelopes therefore cannot bypass cooldown. On timing discontinuity, future triggers are discarded, event identity is released for deterministic re-entry, smoothing/quantization state is reinitialized, and the same target position produces the same resolved plan when the same authoritative inputs are available.

## Renderer parity contract

Canvas2D and WebGL2 may differ in rasterization and glow, but they must agree on scene ID, visible layers, active groups, route-envelope values, affected cells, palette intent, frame selection, Motion multiplier, Bass Reactivity gain, section, and phrase. `comparePixGridRendererSemanticPlans` is the canonical parity assertion. Any mismatch is a structural validation error because audio routing belongs above both renderers.

## Validation and performance bounds

Validation runs when authored state changes, not at analyser frequency. The React status store remains throttled and uses selector snapshots. Group masks and assignments remain cache-keyed; diagnostics are frame-bounded; renderer plans reuse typed buffers; and migration is not rerun in the animation hot loop. Bundled-preset audits prove reactivity with rendered pixels across standardized musical scenarios rather than checking for route metadata alone.

## Perceptual route resolution

Built-in perceptual calibration is resolved once above the compositor and both renderer paths. Source range mapping, confidence/fallback handling, threshold/hysteresis, smoothing, retained event envelopes, Bass Reactivity, per-route gain, minimum effective strength, and mask-coverage compensation all feed one signed action value. Group-targeted compensation uses the compiled logical mask cell count and current matrix size; whole-layer, scene, output, palette, and transition routes use the same calibration without mask compensation. Canvas2D and WebGL2 never perform independent source normalization or event routing.

The calibration floor is proportional to actual mapped activity and is exactly zero for silence. It cannot create stale events, bypass conditions, defeat cooldown, or grow stacks beyond the existing limits. Built-in event curves remain linear after envelope evaluation so release tails are preserved. User-authored routes default to gain 1, floor 0, and coverage compensation 0.

Rendered audits use ordinary analyser values and compare material cell changes rather than byte inequality. Normal kick and snare scenarios must exceed changed-cell and color-distance minimums, differ spatially, survive long enough to read, and remain deterministic under seek/loop reconstruction. Sustained bass must separate Bass Reactivity 0, 0.5, and 1; silent playback must remain materially calmer than ordinary playback; build, pre-drop, drop, breakdown, later-drop, and outro states must resolve distinct plans and pixels.
