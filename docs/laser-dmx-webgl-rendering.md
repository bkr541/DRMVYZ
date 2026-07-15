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

Patch 4 adds depth-aware volumetric haze and light transport through the invisible air zones. Scanner history, final HDR bloom/exposure/tone mapping, chromatic glare, optical instability, nonlaser fixture materials, and broad Performance Show migrations remain deferred to their later patches.

## Patch 4 depth-aware atmosphere

Patch 4 replaces the WebGL path's flat fog concept with a separate reduced-resolution atmosphere graph. The sharp laser renderer remains full resolution and is split into rear and front light targets. A beam-aligned 2.5D scatter pass renders broad atmospheric ribbons through deterministic layered 3D noise, an optional sparse foreground veil contributes alpha only where coherent haze pockets exist, and a final composite applies stronger veiling to rear light than to front light. Empty pixels remain black because neither scatter nor veil is emitted without illuminated air. No room, wall, floor, ceiling, audience, truss, stage, or visible depth plane is created.

The atmosphere compiler consumes the continuous Z model from Patch 2. Mid-air beams receive the strongest volume lift, front beams retain dominance through the separate sharp target, and rear beams receive softer scatter plus greater foreground occlusion. Beam intersections and neighboring rays naturally brighten the atmosphere through additive accumulation. Projector apertures are also rendered into the atmospheric target at reduced resolution so active sources light nearby haze without softening their full-resolution aperture identity.

A subtle baseline density is compiled whenever active beams exist, even when authored fog is disabled, so legacy rigs remain readable without adding a haze fixture to every preset. Show Director haze fixtures become bounded local density sources with position, depth, direction, spread, dissipation, color, enabled state, and brightness-derived density. Master dimmer, blackout, cue resolution, and transient Performance Program fixture modulation are reapplied to those sources when the final scene output is resolved. Authored Beam Matrix fog controls continue to govern global density, opacity, scatter, turbulence, noise scale, drift, diffusion, dissipation, and color absorption.

Atmosphere quality is persisted independently from sharp-beam quality. Low uses quarter resolution, two density samples, simplified noise, and minimal foreground haze. Medium uses half resolution and three samples. High uses roughly two-thirds resolution and five samples. Ultra uses a bounded 0.78 scale and six samples. Auto uses a balanced half-resolution policy. Every tier caps atmosphere beams and haze sources independently while the primary laser geometry remains at the normal WebGL backing resolution.

Atmospheric time comes only from canonical transport time plus a stable track-derived seed. It does not use a free-running frame accumulator, so pausing freezes the density field and returning to the same seek or loop position recreates the same large and medium haze structures. GPU programs, instance buffers, three reusable framebuffer targets, and uniform arrays are retained across frames, resized only when required, recreated after context restoration, and explicitly disposed. Float light targets are used only when the required renderability and filtering support is present; otherwise the runtime falls back to RGBA8 targets before falling back to Canvas2D.

The legacy `LaserDmxFogRenderer` remains the Canvas2D compatibility renderer only. The WebGL branch never uploads or samples its flat fog texture. Patch 5 remains responsible for HDR light accumulation, bloom, exposure, and tone mapping around the new sharp and atmospheric targets.

## Patch 5 HDR photographic response

Patch 5 turns the Patch 4 sharp-light and atmosphere graph into a photographic concert-light pipeline. LaserDMX now probes `RGBA16F` framebuffer renderability, accumulates unclamped rear light, front light, haze illumination, apertures, and intersections into floating-point targets when supported, and exposes a nonintrusive `hdr-rgba16f` or `ldr-rgba8-fallback` diagnostic. It never requests `RGBA32F`, and Canvas2D remains the renderer-boundary fallback rather than becoming part of the WebGL post graph.

A one-to-four-level quality-scaled bloom pyramid extracts only highlights above a soft threshold, downsamples and blurs the extracted signal, then recombines it with the untouched full-resolution sharp scene. A bounded deterministic exposure controller responds quickly to transport-phased strobe visibility and blinder intensity, releases gradually, resets across timing discontinuities, and recovers rapidly from blackouts without ordinary beat-level pumping. The final pass applies restrained high-threshold glare, near-subpixel chromatic separation, minimal spectral edging, ACES-fitted tone mapping, controlled saturation, highlight desaturation, black clipping, and display gamma. Edit mode sharply attenuates optical glare so authoring interaction remains readable.

All HDR, bloom, blur, and final-post resources are LaserDMX-owned, reusable, resize-aware, context-restorable, and explicitly disposable. Detailed target, quality, exposure, optics, fallback, and lifecycle notes are in [LaserDMX WebGL HDR and Photographic Post-Processing](./laser-dmx-webgl-hdr-post-processing.md). Patch 6 remains responsible for distinct fixture-specific optical materials and geometry.
