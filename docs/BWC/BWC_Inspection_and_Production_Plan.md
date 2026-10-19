# BWC Cinema 2.0: Asset Inspection & Production Plan

**Input assets inspected:** `energy_banks.glb`, `sci-fi_assembly_line.glb`, `DRMVYZ-main (2)(4).zip`  
**Type of review:** GLB binary metadata, geometry and embedded-texture inspection plus source-code inspection. This is **not** an in-app render test or completed implementation.

## Verified source asset findings

| Asset | Geometry | Textures | Animation | What can be reused |
|---|---|---|---|---|
| `energy_banks.glb` | 2 separately addressable can meshes, 4,784 triangles total | 1 embedded 2048x2048 PNG | None | White/plain can plus branded white Monster Ultra can; use as instanced objects along new BWC conveyor. Label texture is currently black/silver/cyan, not the target bright green. |
| `sci-fi_assembly_line.glb` | 33 meshes, 22,996 triangles | 4 embedded 2048x2048 PNGs, 14 materials | 1 clip (5 channels, key times approx 0.042–10s) | A futuristic apparatus/chamber, glass components, mechanical details and emissive material families; not a complete multi-line beverage factory. Requires placement, selective reuse and green recoloring. |

GLB metadata identifies both files as **CC BY 4.0**: the can is titled *energy banks*, credited to **igor.rizaev00** (`https://sketchfab.com/3d-models/energy-banks-119bf6e735414700913cb45a1af86ec1`); the apparatus is titled *Sci-fi Assembly Line*, credited to **meeww** (`https://sketchfab.com/3d-models/sci-fi-assembly-line-d30366ad73af49f6b7279923fe89faee`). Preserve credit/license/source and note modifications when distributing. Monster marks may carry separate trademark considerations.

The source apparatus has `KHR_materials_transmission` in `extensionsUsed`, for transparent/glass material support. Renderer-specific transmission, emissive exposure, bloom and tone-mapping must be checked in DRMVYZ.

## Verified current BWC implementation

- `src/components/vyzualz/cinema2/modules/bwc/Cinema2BwcRenderer.ts`: draws one raymarched GLSL fullscreen scene (SDF cylinders, boxes, tori, materials); five fixed-position procedural cans and a static portal; fixed camera; no GLB meshes.
- `src/components/vyzualz/cinema2/modules/Cinema2BwcNativeModule.ts`: passes preset parameters to shader renderer; module lifecycle update is empty.
- `src/components/vyzualz/cinema2/presets/Cinema2BwcPreset.ts`: exposes brightness, portal/can/conveyor sizing, LED strength and five palette colors. It defines no choreography/effects and is labeled static.
- `src/components/vyzualz/cinema2/__tests__/Cinema2BwcPreset.test.ts`: currently asserts static, non-choreographed BWC. Tests will need updating rather than blindly retaining the static requirement.
- Cinema 2.0 already has `Cinema2ThreeAssetCache`, `Cinema2ThreeSceneBridge`, `Cinema2ThreeAnimation`, `Cinema2ThreeSceneModule`, `Cinema2ThreeAssetRegistry`, GLTFLoader integration and model asset manifests. Mainframe and Marquee demonstrate 3D integration routes.
- The preset creation contract requires BPM Sync, at least four palette colors, 6+ native Pattern choices and Pattern Change / Trigger under Design > Design, with the shared 11 Trigger choices. Existing BWC does not implement the required pattern controls or BPM Sync.

## Recommended artifact production (order matters)

### Phase A: Asset-ready technical package
1. `BWC_GLB_Asset_Audit.md`: source assets, reusable parts, material and animation caveats.
2. `BWC_GLTF_Node_Material_Manifest.json`: mesh IDs, nodes, triangle counts, materials, original animation targets.
3. `BWC_License_Attribution.md`: both CC BY credits, original links, edit notes, license compliance checklist.
4. `BWC_Import_Transforms.json`: normalized axes, scale, camera/world positions, named role mapping, source-object preservation.

### Phase B: Reference-locked geometry and look development
5. `BWC_Hero_Target.png` plus front/side/top and reactor/detail views: the required art direction, prioritizing source reference #2.
6. `BWC_Geometry_Blueprint.svg` plus `BWC_Reactor_Blueprint.svg`: scaled layouts/part positions.
7. `BWC_Factory_Extensions.glb`: new modeled conveyor, rollers, rails, catwalks, framework, ducts, reactor shell, pipes, LED groups and assembly-line extensions. Preserve separately addressable nodes.
8. `BWC_Cans_Clean.glb` (optional transformation of the source): separate plain and branded can meshes normalized for GPU-efficient instancing, plus green-branding texture variation, without assuming the branding is a baked mesh.
9. `BWC_Texture_Material_Library/`: stylized industrial metal, surface wear, transparent pipes, green emissive channels and can decal variants.
10. `BWC_Blender_Builder.py`: reproducible scene assembly from original models + new objects; `.blend` itself requires running Blender, which is not available in this execution environment.

### Phase C: Runtime choreography and implementation
11. `BWC_Browser_Preview/`: browser-loadable scene/viewer with selectable camera perspectives and isolated material/illumination checks.
12. `BWC_Audio_Routing.json`: map shared Audio Intelligence kick/sub/beat/snare/bar/phrase/build/drop signals to mesh family effects, smoothing, gain limits.
13. `BWC_Pattern_Library.json`: 6+ BWC-specific patterns, behavior, transitions and existing 11-value trigger configuration; manual selection and auto override precedence.
14. `BWC_Camera_Lighting_Spec.json`: target shots, camera profiles, emission, haze, bloom, tone mapping and cel-shading/outlines approach.
15. `BWC_Integration_Spec.md`: changes to asset registry, preset manifest, module, renderer, resources, camera, effects and scene graph. Preserve BWC preset ID and migrate authored values where possible.
16. `BWC_Codex_Claude_Prompts.md`: separate gated prompts for asset import, geometry/layout, materials/lighting, motion, audio, controls, tests.
17. `BWC_Visual_Validation.md` plus capture matrix and tests: reference comparison, runtime audio test, lifecycle/cache/GPU budgets, render screenshot baselines, no-audio graceful state, pause/seek/trigger sequencing, regression checks.

## Critical implementation decisions

1. **Retire/replace the BWC fullscreen raymarch renderer** behind the existing BWC preset identity. Do not try to place GLB geometry inside its fullscreen SDF shader.
2. **Treat Sketchfab apparatus as a component, not the whole factory.** Its cyan/white glass emissives should be adapted to the green industrial reactor palette; build the missing production hall, pipes, secondary conveyors and staging details separately.
3. **Use instancing for cans** and preserve separately addressable scene nodes for revolving equipment, LEDs, rings and glass energy surfaces.
4. **Prefer a deliberate render style.** The second user image features stylized illustrated outlines and a brighter blue-gray industrial hall, not just photorealistic PBR. Geometry alone will not reproduce this; lighting, tone mapping, outlines and shadows matter.
5. **Validate the 10-second embedded animation** and decide whether to keep, suppress, retime or replace each moving assembly in a BPM-synchronized way; loading a GLB does not automatically start its animation in Cinema 2.0.
6. **Follow the Cinema 2.0 contract.** Pattern, Pattern Change, Trigger (shared 11 options), BPM Sync, authority hierarchy and audio routing are required for a fully upgraded preset.

## Limitations of this audit

This report establishes mesh structure, materials, animation metadata and code integration paths. It does not establish exact final appearance in the running application, frame rates on user hardware or guaranteed reproduction of the reference. Those need implementation and rendered validation.
