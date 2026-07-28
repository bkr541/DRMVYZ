# Cross-Engine Control Scopes

## LaserDMX

- **Authored Show Dimmer**: persisted Beam Matrix/show-program content.
- **Preview Output Trim**: React-wide virtual-monitor trim applied equally to WebGL and Canvas2D.
- **Safety Clamp**: final output-domain limit with authority over preview and hardware-safe scene values.
- **Authored Show Glow**: persisted global show glow, separate from per-beam glow.
- **Preview Glow Trim**: virtual-monitor presentation trim. It is excluded from production hardware values.
- **Blackout, shutters, gates, and strobes**: final authorities after authored programming.

The canonical resolver exposes both the resolved preview product and the hardware-safe product. Backend selection consumes the already-resolved presentation scene, so context loss cannot change control meaning.

## Shader Pads

Shared masters are enabled per scene only when their GLSL uniform is referenced by executable shader code. Stored shared values survive scene switching. Scene-local parameters remain independent unless renderer sensitivity tests prove equivalence.

## CANVAS

- **Canvas Output Opacity**: final engine compositing alpha.
- **Dry Source Mix**: untreated source-layer contribution only.
- **Per-layer opacity**: authored layer alpha.
- **Transition opacity**: runtime transition envelope.
- **Visual Intensity**: coordinated recipe/effect-strength macro, not a substitute for individual effects or output alpha.

Schema version 2 migrates legacy `sourceVisibility` to `drySourceMix` once and retains the alias for round-trip compatibility. Existing projects enter `legacyComposite` mode so their former dry-plus-processed product remains materially equivalent. Newly authored recipes use `dryOnly`.

## Cinematic Worlds

**Camera Mode** is the single persisted source of truth. Auto Director is a selectable camera rig, not a second enable flag. Supported-rig restrictions remain world-specific.


## Preset provenance

LaserDMX, Shader Pads, CANVAS, and Cinematic Worlds retain stable source preset IDs after manual edits. Engine-native adapters use the centralized exact-versus-modified comparator introduced by Patch 2. Restoring all preset-owned values returns exact status; Track Map and automation application remain deterministic because IDs are not cleared on edits.
