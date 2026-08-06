# Cinema Stage 7: WebGL Runtime and Render-Target Pool

Cinema Stage 7 activates the first production renderer-owned boundary for Cinema. It adds one visible output canvas, one WebGL2 context, one requestAnimationFrame loop, one descriptor-aware render-target pool, opaque texture handles, centralized resolution changes, and context-loss recovery. Composition graph execution remains intentionally deferred to Stage 8.

## Production route

```text
React engine selection / persisted restore
→ ReactView active engine branch
→ CinemaWorkspace stage surface
→ CinemaCanvas live ownership claim
→ CinemaRuntime
→ neutral premultiplied clear frame
→ ReactView output-canvas callback
→ recording and Cast Output consumers
```

`ReactLiveEngineOwnership` remains the arbiter for the single live renderer. Selecting another engine synchronously invokes Cinema cleanup before that engine claims ownership. Cinema does not wrap `ReactShaderCanvas`, start a Cinematic Worlds runtime, or create any per-node canvas, context, or loop.

## Runtime ownership

`CinemaCanvas` is the only production component that creates `CinemaRuntime`. It observes the visible canvas through the shared canvas-resolution utilities, forwards the Stage 6 immutable frame snapshot, reports the canvas through the existing output callback, and retires resize, visibility, animation, diagnostics, texture, framebuffer, and context resources on switch or unmount.

The runtime clears the default framebuffer to transparent black using premultiplied alpha. This is a deliberate safe output, not graph execution. WebGL2 unavailability produces structured diagnostics and leaves the React tree mounted without creating an uncontrolled alternate renderer.

## Render targets and textures

`CinemaRenderTargetPool` allocates WebGL2 framebuffers from normalized descriptors containing color space, alpha mode, format, depth and mask flags, resolution scale, filter, wrap, clear color, and lifetime. Matching released allocations are reused. The free pool is bounded, target dimensions are clamped to the device maximum texture size, incompatible pooled allocations are released during resize, and active leases are rebuilt at their new dimensions.

Nodes receive only `CinemaTextureView` identifiers. Raw `WebGLTexture`, framebuffer, and renderbuffer objects remain private to runtime services and cannot enter persisted Cinema state. Stage 8 can resolve raw resources only inside the runtime boundary.

## Context loss and restoration

A `webglcontextlost` event is prevented, stops the scheduled frame, abandons invalid GPU handles, and emits `CINEMA_CONTEXT_LOST`. Restoration rebuilds active render targets from their descriptors, reapplies the last canvas resolution, increments the context generation, emits `CINEMA_CONTEXT_RESTORED`, and schedules at most one new animation frame.

No Cinema persisted schema changes are introduced in this stage. Runtime snapshots, diagnostics buffers, target leases, texture handles, frame counters, and context generations remain transient.

## Stage 8 handoff

Stage 8 receives stable entry points for:

- the single `CinemaRuntime` loop and visible output canvas
- descriptor-aware target acquisition, release, clearing, and ping-pong swapping
- opaque texture publication and input resolution
- normalized frame delivery
- resize and context-reconstruction lifecycle hooks

Stage 8 must execute compiled graphs through these services rather than introducing another canvas, WebGL context, animation loop, or GPU-resource owner.
