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
