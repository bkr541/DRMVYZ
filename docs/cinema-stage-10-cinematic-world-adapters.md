# Cinema Stage 10: Cinematic World and Canvas2D Adapters

Stage 10 brings the existing Cinematic Worlds renderer families into Cinema without transferring their standalone host ownership. The adapters are registered through the same persisted-definition and runtime-plugin boundaries used by the production Cinema graph executor.

## Production path

```text
React engine selection
→ CinemaCanvas
→ CinemaRuntime
→ CinemaGraphExecutor
→ CINEMA_PRODUCTION_RUNTIME_REGISTRY
→ CinematicWorldNodeAdapter or CinemaCanvas2DNodeAdapter
→ Cinema-owned render target
→ Cinema output node
→ visible Cinema canvas
```

The existing `cinematicPortal` engine remains registered and selectable. Its standalone canvas and runtime continue to serve legacy projects until the explicit retirement stage.

## WebGL world adapter

`CinematicWorldNodeAdapter` maps each built-in WebGL Cinematic World to a stable namespaced Cinema procedural-node type. It reuses the verified world renderer itself, but does not instantiate `CinematicWebGLRuntime`, a visible canvas, a WebGL context, or an animation loop.

Cinema supplies:

- the WebGL2 context;
- the destination framebuffer and dimensions;
- the normalized Cinema frame;
- resize, reset, disposal, and context-reconstruction lifecycle;
- graph diagnostics and safe-output behavior.

The adapter preserves world settings, seed and quality values, camera capability metadata, authored direction and shot metadata, safe camera ranges, post-processing capability metadata, and legacy renderer capability declarations. Common, environment, material, and world-specific settings are exposed through stable parameter IDs.

## Reactive Constellation

Reactive Constellation remains its existing specialized procedural renderer. It is not flattened into a fullscreen shader. Its geometry passes, topology, beams, trails, deterministic seed, quality behavior, and reset lifecycle remain behind the same renderer contract. The Cinema definition declares high CPU/GPU cost and a deterministic `reset-at-position` seek policy using musical-position seed scope.

## Canvas2D compatibility boundary

`CinemaCanvas2DNodeAdapter` provides the explicit compatibility path for `legacyPortal`:

1. Create one node-local offscreen Canvas2D surface.
2. Invoke the existing legacy renderer once per Cinema frame.
3. Upload the canvas into a node-local WebGL texture using premultiplied-alpha unpacking.
4. Composite the texture into the Cinema-owned target.
5. Dispose the Canvas2D renderer, texture, shader program, fullscreen pass, and backing surface with the node.

The adapter never appends a visible canvas and never schedules `requestAnimationFrame`. Missing Canvas2D support is reported as a structured capability diagnostic and the graph executor supplies safe output.

## State and compatibility

Stage 10 does not increment the Cinema persisted-store schema because the existing versioned definition and composition contracts already support adapter definitions. Canonical built-ins now include all built-in Cinematic World definitions and a representative Event Horizon composition. Reconciliation refreshes those built-ins while preserving authored compositions, active selection, and unrelated state.

No GPU object, Canvas2D context, renderer instance, transient frame, or upload texture is persisted.

## Stage 11 handoff

The stable extension points for the next stage are:

- `CinematicWorldNodeAdapter`;
- `CinemaCanvas2DNodeAdapter`;
- stable Cinematic World node and parameter IDs;
- normalized frame-to-legacy compatibility mapping;
- deterministic reset translation;
- production registry and graph-execution coverage.

Stage 10 intentionally does not centralize camera control or post-processing into reusable Cinema nodes and does not expose the final built-in Cinema catalog.
