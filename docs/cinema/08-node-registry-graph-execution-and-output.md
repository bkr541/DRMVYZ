# Cinema Stage 8: Node Registry, Graph Execution, and Output

Cinema Stage 8 turns the Stage 7 single-owner WebGL2 foundation into a production graph renderer. A persisted Cinema composition now flows through the existing compiler, a runtime-only renderer plugin registry, Cinema-owned targets and texture handles, fault-isolated node instances, and exactly one authorized output node.

## Production route

```text
React engine selection / persisted restore
→ ReactView Cinema branch
→ CinemaWorkspace canonical active composition and instance
→ CinemaCanvas live ownership claim
→ CinemaRuntime.setGraph + normalized Cinema frame
→ CinemaGraphExecutor
→ persisted definition registry + compiled execution plan
→ runtime renderer plugin instances
→ Cinema-owned offscreen targets and texture bindings
→ one output node on the Cinema default framebuffer
→ preview / recording / Cast Output canvas callback
```

`ReactLiveEngineOwnership` remains the arbiter for the live canvas. Stage 8 does not wrap Shader Pads, start a Cinematic Worlds runtime, create a per-node canvas or context, or introduce another animation loop.

## Runtime renderer registry

`CinemaRuntimeNodeRegistry` is separate from `CinemaNodeDefinitionRegistry` and from persisted Cinema definitions. Persisted records retain stable type IDs, plugin IDs, schemas, capability declarations, and quality metadata. The runtime registry retains executable factories only. It validates external identifiers, rejects duplicate type or plugin ownership, and exposes a deterministic fingerprint used by compiled-plan invalidation.

Before a node initializes, the executor verifies that the runtime plugin matches the persisted type/version/ports/parameters/output contract, that declared platform requirements are available, and that the factory returned the complete initialize/resize/render/reset/dispose lifecycle. Runtime factories and instances are never serialized.

## Graph executor

`CinemaGraphExecutor` compiles the active composition against the persisted definition registry and caches bounded plans by composition revision plus definition and runtime-registry fingerprints. A graph replacement aborts and disposes the previous reachable instances before creating the new plan. Only nodes in the compiled execution order are instantiated.

For every frame the executor:

1. dispatches declared reset actions for seek, loop, track, visibility, timing, resolution, activation, and context-recovery boundaries;
2. resolves instance-overridden stable asset bindings for each authored node;
3. leases Cinema-owned targets for non-output nodes;
4. resolves compiled input bindings through opaque texture views;
5. retains bounded Cinema-owned history targets for explicit temporal-feedback edges;
6. invokes each ready renderer in deterministic plan order;
7. publishes node outputs only through the Cinema texture manager;
8. authorizes only the compiled output node to bind the default framebuffer; and
9. releases transient leases and clears frame-local texture routes.

Compiled plans, node instances, abort controllers, GPU programs, leases, texture views, diagnostics buffers, and frame snapshots remain transient. Feedback history uses bounded persistent runtime targets sized from the compiler contract; seek and other reconstruction resets clear that history before the next node execution. Asset bindings remain stable-ID metadata at this stage. Media decoding and adapter-specific asset upload stay with later renderer adapters rather than creating a second asset source of truth.

## Native foundation composition

Fresh Cinema state contains one built-in `foundation-gradient` composition. It uses:

- `drmvyz.cinema.generator.gradient`, a native premultiplied solid/two-color gradient renderer;
- `drmvyz.cinema.output.main`, the one default-framebuffer output renderer; and
- one typed color-texture connection from the generator to the output.

The foundation composition is normal persisted Cinema data. It is compiled and rendered through the same production route as future user-authored graphs, rather than through a test-only or hard-coded canvas bypass. Explicitly loaded older empty Cinema state remains empty, preserving prior schema semantics.

## Fault isolation and safe output

Factory, capability, initialization, resize/reset, render, and disposal failures create structured diagnostics attributed to the composition and node. A failed renderer is aborted and disposed once. Its offscreen output becomes transparent, downstream nodes can continue, and the output node remains able to present a defined fallback. If compilation or output ownership fails, Cinema clears the default framebuffer to premultiplied transparent black without unmounting the React tree or mutating canonical state.

Context loss disposes node-local runtime resources and abandons invalid target handles. Restoration rebuilds targets, recompiles/reinstantiates the active graph from persisted state, dispatches the context-restoration reset action, and resumes the existing single loop.

## Persistence and compatibility

The Stage 8 runtime introduces no persisted schema-version increment. The built-in definitions and foundation composition use the existing Stage 4 store schema. Runtime plugins and GPU objects are not added to Zustand persistence or package JSON. Shader Pads, Cinematic Worlds, Sound Drawing, CANVAS, LaserDMX, PixGrid, shared transport, media, lyrics, Brand Kit, recording, preview, and Cast Output ownership remain unchanged.

## Stage 9 handoff

Stage 9 can register a Shader Scene adapter against the stable runtime plugin lifecycle, compiled executor, Cinema-owned target/texture services, normalized frame input, and output node. It must render Shader scenes into provided targets rather than restoring Shader Pads canvas, context, or loop ownership.
