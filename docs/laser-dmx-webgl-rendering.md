# LaserDMX Show Director WebGL rendering program

## Patch 1 foundation

Patch 1 introduces a renderer-neutral boundary without changing Show Director's authoritative choreography or production-output safety rules.

The runtime order is now:

1. Music Intelligence and Track Map timing build the deterministic performance context.
2. The active Performance Program resolves a transient Show Director rig.
3. `LaserDmxSceneFrame` captures continuous Show Director fixture, target, and depth values before the compatibility compiler rounds them into the 15 × 10 Beam Matrix.
4. The existing Show Director and production cue runtime still evaluates through Beam Matrix so cue precedence, seek/loop reconstruction, beam budgets, blackout authority, and production behavior remain unchanged.
5. Evaluated dimmer, color, fog, and blackout state is layered back onto the scene frame without replacing its continuous geometry.
6. The dedicated LaserDMX WebGL2 runtime may render that frame directly. Canvas2D remains the compatibility and failure fallback.

The WebGL runtime owns its own offscreen WebGL2 canvas and composites the completed GPU frame into the existing live output canvas. It never samples, screenshots, or uploads the Canvas2D Beam Matrix result as a texture. The initial pass intentionally renders only diagnostic direct-data beams and emitter points. Volumetric haze, HDR accumulation, bloom, tone mapping, scanner persistence, optical instability, and fixture-specific materials remain deferred.

## Presentation modes

- **Edit** keeps the complete Show Director authoring overlay.
- **Hybrid** keeps the live renderer visible and limits authoring graphics to selected fixtures and targets.
- **Live** mounts no Show Director authoring overlay.
- **Capture** uses the same clean visualizer output boundary as Live and suppresses diagnostic authoring overlays.

Legacy projects normalize to **Edit** plus **Canvas2D**. Users can explicitly select WebGL2 or Auto with Canvas2D fallback. WebGL quality and render scale use the shared canvas-resolution policy and are persisted as preferences; GPU handles and runtime resources are never persisted.

## Patch 2 spatial foundation

Patch 2 keeps the authored view front-facing while giving WebGL a continuous three-dimensional lighting volume. `frontLocked` is the only presentation camera. It uses an orthographic-depth projection with restrained vertical depth parallax, a fixed centered/elevated pose, fixed clipping bounds, and permanently disabled pan, orbit, roll, animation, and preset overrides. No camera control or camera preset is exposed in Show Director.

Show Director fixtures and beam targets now normalize optional depth-layer metadata and continuous Z coordinates. Fan, cross, mirror, sweep, and audio-reactive ray patterns are expanded directly in the continuous scene frame instead of borrowing quantized matrix cells. The WebGL scene consumes continuous X/Y/Z geometry before Beam Matrix compilation; the 15 × 10 matrix remains a snapping, cue-evaluation, legacy-output, and Canvas2D compatibility layer. The editor stays a 2D authoring surface and offers only compact advanced fixture and target depth-layer selectors.

The engine-neutral frame includes fixture orientation, target points, normalized beam direction, three-dimensional beam length, start/end depth, depth bounds, stable front-to-back/back-to-front ordering, and invisible reference zones: Camera-Facing Air, Front Air, Mid Air, Deep Air, Upper Air, and Lower Air. Every zone is data-only and explicitly non-visible. No wall, floor, ceiling, audience, truss, stage, or venue mesh is generated.

Depth inference is deterministic. Semantic roles such as rear diamonds, ceiling canopies, low rakes, audience-facing rakes, mirrored corridors, cages, tunnels, and static fans select coherent air volumes. Fixture kinds provide stable fallbacks for moving heads, LED surfaces, strobes, blinders, washes, haze, CO2, and video walls. Cross and mirror targets alternate through stable depth planes using fixture identity rather than playback time, so seek, loop, occurrence, phrase, and section reconstruction cannot reshuffle depth.

Legacy schema versions normalize to automatic depth. Existing zero-valued Z fields are treated as legacy two-dimensional defaults, preserving existing screen composition while allowing inference. Explicit nonzero Z coordinates and explicit depth layers take precedence; an explicit Mid Air layer represents an intentional zero-depth plane. Canvas2D and Beam Matrix output remain unchanged.

Full volumetric haze, final laser materials, HDR accumulation, bloom and tone mapping, scanner persistence, optical instability, and broad Performance Show spatial rewrites remain deferred to later patches.

## Patch 3 high-fidelity laser pass

Patch 3 replaces the diagnostic `gl.LINES` output with a batched optical renderer. Every active beam is represented by one instanced, camera-facing ribbon whose quad is generated from the continuous projected origin and target in the vertex shader. The fragment shader resolves four optical regions inside that ribbon: a dim atmospheric envelope, saturated color body, narrow pale core, and an intensity-gated white-hot center. Widths are authored in CSS-pixel space and converted to backing pixels in the shader, so device-pixel ratio, WebGL quality, and render scale do not make beams visibly inflate or collapse.

The scene frame now carries source identity, fixture kind, authored/evaluated width, divergence, scatter-envelope width, opacity, core intensity, visual priority, deterministic phase, ray index/count, spacing curve, fan/bank structure, center direction, and shared source energy. Generated fans use deterministic symmetric spacing. Narrow fan, wide fan, parallel bank, mirrored fan, cross bank, and layered fan semantics can pass through the renderer without changing the locked front-center camera or quantizing continuous coordinates.

Beam and aperture energy accumulates additively into one offscreen light target. The runtime prefers an `RGBA16F` framebuffer when `EXT_color_buffer_float` is available and falls back to `RGBA8` safely. Intersections brighten naturally through accumulated energy rather than per-crossing sprites. Same-color overlaps gain the pale core contribution; mixed bright colors accumulate toward white when the display target clamps the light buffer. Final exposure, bloom, and tone mapping remain intentionally absent.

All rays from one fixture share one instanced projector aperture. Active beam energy is grouped by source and converted into a tight center, saturated ring, soft halo, and a restrained directional-glare placeholder. Aperture size and intensity therefore respond to total emitted energy instead of drawing one unrelated dot per beam.

The existing 300-beam authority remains intact. Scene generation and the Beam Matrix compatibility compiler now share deterministic ray-index selection at the partial-allocation edge, preserving fan edges and center rather than chopping one side. Performance priority still protects hero impacts and primary architecture before secondary fans, lattice detail, and decorative accents. WebGL quality first reduces envelope complexity, then deterministically thins support rays while retaining hero/primary beams and source identity. Canvas2D receives the same bounded beam list and otherwise remains unchanged.

Patch 4 remains responsible for true depth-aware volumetric haze and light transport through the invisible air zones. Scanner history, final HDR bloom/exposure/tone mapping, chromatic glare, optical instability, nonlaser fixture materials, and broad Performance Show migrations remain deferred to their later patches.
