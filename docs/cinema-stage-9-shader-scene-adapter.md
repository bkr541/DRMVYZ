# Cinema Stage 9: Shader Scene Adapter

Stage 9 adapts the active Shader Pads registry into Cinema render nodes without transferring legacy canvas, WebGL context, or animation-loop ownership into Cinema.

## Production path

```text
React engine selection / persisted Cinema restore
→ CinemaWorkspace
→ canonical Cinema persisted state and built-in reconciliation
→ Cinema graph validation and compilation
→ CinemaRuntime with the production node registry
→ ShaderSceneNodeAdapter render node
→ Cinema render-target pool and texture graph
→ foundation output node
→ the single visible Cinema canvas
```

The standalone Shader Pads engine remains selectable and continues to use its existing runtime. The adapter reuses registry definitions and low-level shader compiler/pass/program utilities only.

## Stable adapter contracts

Each active Shader registry scene receives:

- a stable namespaced Cinema node type ID and renderer plugin ID;
- a persisted Cinema node definition with the source scene ID and adapter version;
- stable parameter IDs, including mapped Shader scene parameters and Cinema master bindings;
- one premultiplied-alpha color output port;
- optional ports for declared external textures and declared Brand Kit logo, texture, or background samplers;
- pass metadata preserving fragment and custom vertex sources, geometry draw declarations, dependencies, target format/filter/wrap settings, persistence, ping-pong feedback, and history declarations.

`createCinemaShaderSceneComposition` creates a graph containing one adapted Shader node and one authorized Cinema output node. Stage 9 persists one reference composition for the default active Shader scene and selects it for fresh/reset Cinema state, so the production workspace visibly exercises the adapter. Recognized Stage 8 state keeps its existing active composition. The stage does not expose every scene as a built-in library composition.

## Runtime ownership

The adapter never constructs `ReactShaderCanvas` or `ShaderWebGLRuntime`. It receives Cinema's existing WebGL2 service and final target from `CinemaGraphExecutor`.

Intermediate pass targets use Cinema target leases:

- frame-local passes release their leases after the node render;
- persistent passes retain one Cinema persistent lease;
- feedback passes retain one Cinema ping-pong lease and read the previous side before swapping to the next write side;
- the final pass writes directly into the target supplied by Cinema.

Node-local programs, buffers, audio textures, gradient textures, and a one-pixel neutral fallback texture are recreated after context restoration and deleted during disposal. They are runtime-only and never enter persisted state.

## Frame, media, Brand Kit, and commands

The adapter translates the immutable `CinemaFrameContext` into the legacy Shader uniform vocabulary. It does not poll React, audio, media, Brand Kit, Music Intelligence, lyrics, or performance stores.

Unavailable analyser, music, lyric, harmonic, semantic, media, or Brand Kit inputs receive explicit availability uniforms and neutral values. Missing required texture inputs report a structured Cinema asset diagnostic and bind the adapter's neutral texture rather than throwing or creating an alternate runtime.

Reset actions and frame discontinuities clear every persistent and ping-pong target. Stateful scenes therefore use the declared `reset-at-position` seek policy. Context restoration disposes and reconstructs adapter resources through the existing Cinema executor lifecycle.

## Compatibility and handoff

Persist middleware version 2 reconciles canonical Stage 9 built-ins into recognized Stage 8 foundation state while preserving the active composition, custom definitions, custom compositions, instances, collections, and unrelated metadata. The Cinema persisted schema version does not change because no authored record shape changed.

This stage leaves the following Stage 10 extension points stable:

- Cinema-compatible low-level renderer services;
- one adapter bundle covering every active Shader registry definition;
- stable texture and parameter ports;
- explicit reset, seek, disposal, and context-restoration hooks.

Stage 9 does not retire Shader Pads, create library entries for every Shader scene, rewrite shaders as native Cinema definitions, or add a second rendering owner.
