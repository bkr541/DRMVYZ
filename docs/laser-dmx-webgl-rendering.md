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
