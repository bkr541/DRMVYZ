# Cinema Stage 16: Layer Compositor, Masks, Effects, and Transitions

Stage 16 makes layered composition a native Cinema graph capability while preserving the single visible canvas, WebGL2 context, animation loop, render-target pool, texture graph, and diagnostics runtime established by earlier stages.

## Production path

`ReactView` selects the `cinema` engine, `CinemaWorkspace` resolves canonical Cinema state, and `CinemaCanvas` supplies the active composition and normalized frame to `CinemaRuntime`. `CinemaGraphExecutor` compiles the graph against `CINEMA_PRODUCTION_RUNTIME_REGISTRY`, leases Cinema-owned targets, resolves texture inputs, and invokes the registered mixer, mask, effect, transition, and output nodes. No Stage 16 node owns a canvas, WebGL context, animation loop, or persisted GPU object.

The built-in `stage16-compositor-reference` composition proves the production graph shape with a Cinematic World, logo, generated mask, timed lyrics, procedural test generator, per-layer effects, a composition transition, master tone mapping, and one output node.

## Mixer and mask nodes

Stable mixer types implement normal alpha, add, screen, multiply, lighten, darken, difference, and overlay. The masked-composite node accepts background, foreground, and mask textures. Mask sampling is explicit and deterministic:

- Alpha mode uses the mask texture alpha channel.
- Luminance mode unpremultiplies the normalized linear sample and applies Rec. 709 luminance weights.
- Inversion is applied after sampling.
- Missing foreground or background inputs resolve to transparent black.

A source node with authored opacity `0` publishes a cleared transparent target without invoking its renderer and without marking the graph as a failed safe-output frame.

## Alpha and color convention

Layered rendering uses linear-sRGB, premultiplied alpha internally. Every compositor shader normalizes incoming texture descriptors at the node boundary:

1. Opaque inputs receive alpha `1`.
2. Straight-alpha inputs are premultiplied after color conversion.
3. Premultiplied inputs are unpremultiplied for conversion, then premultiplied again.
4. sRGB and display-P3-tagged inputs are converted to linear light before blending.

The output node performs the explicit inverse boundary to an sRGB premultiplied canvas sample. Transparent RGB is forced through alpha-aware math so colored fringes do not appear around logos, text, or lyric masks.

## Reusable effects

Stage 16 registers reusable bloom, blur, feedback, refraction/displacement, pixelation, chromatic aberration, color grading, kaleidoscope, edge detection, strobe, grain, vignette, and tone-mapping nodes. Bloom, feedback, chromatic aberration, grain, vignette, and tone mapping preserve the semantics of the existing Cinematic post stack while moving execution into neutral Cinema-owned passes. Effects can be placed after a source, between mixers, or before the final output.

Feedback uses the graph compiler's explicit feedback contract and the existing render-target pool. One-frame history is runtime-only, cleared on seek/reset/context recovery, and released on graph replacement or disposal.

## Composition transitions

`drmvyz.cinema.transition.composition` accepts `from` and `to` textures and supports crossfade, wipe, radial, dissolve, slide, and zoom modes. Crossfade, radial-wipe, and noise-dissolve semantics are adapted from the verified Shader transition family, but its renderer/program ownership is deliberately not reused because it targets the legacy screen path. Manual progress is schema-controlled. Automatic progress uses a runtime-only deterministic clock keyed by a stable transition token. If a new token interrupts an active transition, the new transition begins from the sampled progress instead of snapping to an endpoint.

## Persistence and compatibility

Stage 16 adds built-in definitions and one built-in reference composition without changing the persisted representation, so the Cinema store and composition schema remain at version 3. Reconciliation adds or refreshes Stage 16 built-ins while preserving user-authored compositions, instances, collections, bindings, and active selection. Runtime textures, history targets, shader programs, clocks, and diagnostics remain excluded from persistence.

Shader Pads and Cinematic Worlds stay selectable and retain their standalone rendering paths. Sound Drawing, CANVAS, LaserDMX, PixGrid, preview, recording, and Cast Output policy are unchanged.

## Stage 17 handoff

Stage 17 can consume the stable mixer/mask family, reusable effect definitions, explicit feedback target ownership, transition clock, and enforced alpha/color descriptors for graph-aware quality, diagnostics, and recovery hardening. Stage 16 intentionally does not add the final layer editor or graph editor UI.
