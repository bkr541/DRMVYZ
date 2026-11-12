# ORBITAL

ORBITAL now uses the supplied `metal_sphere.glb` (Abstract sphere by deecube1).
The old gyroscope, docking markers and violet planet have been removed. Stars
and a small neutral debris field remain. One or two lines of extruded lettering
follow a shallow cylindrical arc across the sphere's front; individual glyphs
turn with that curve while retaining their musical movement.

The default **Sphere Material** finish clones the imported physical material,
including its color, normal, roughness, metalness and specular maps. Glyph UVs
are reprojected across those same textures. Letter Tint and Roughness remain
editable; their new authored defaults preserve the sphere's imported appearance.
Polished Silver and Brushed Silver are available as manual alternatives. Lighting
is neutral and restrained to preserve metallic detail. The old purple outline
is removed from rendering.

**Design → Orbital Assembly** provides Letter Depth, Sphere Size, Sphere Motion
and Orbital Debris. Sphere Motion drives the original three-part animation using
shared musical time. The six existing pattern IDs and shared trigger controller
are retained, with bounded sphere/letter transforms. Pause freezes the geometry;
Motion Safety and Lock Off retain their existing authority. No new clock,
analyzer, renderer or canvas is introduced.

Source/Pool still use the shared Text Scenes library and existing migration 0046.
No additional migration is required. Legacy parameter IDs (`gyroscope-size`,
`ring-travel`, `planet`, material enum values) are retained for saved-scene
compatibility. Removed planet/outline settings are hidden and cannot restore the
removed objects. The legacy asset ID `cinema2-orbital-gyroscope` now resolves to
`/cinema2/models/orbital-metal-sphere.glb`; the old shipped GLB is removed.

## Source and preparation

The input was `/Users/kodyrobinson/Downloads/metal_sphere.glb`. Its embedded
metadata credits [Abstract sphere by deecube1](https://sketchfab.com/3d-models/abstract-sphere-a525fc48c1d245e2883241e344773aa4),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution is retained
in the asset record and generated `public/cinema2/attributions.json`.

The original uses unsupported `KHR_materials_pbrSpecularGlossiness`. Preparation
converts that material to supported metal/rough, IOR and specular extensions,
retaining all three meshes and the original animation. Maps are capped at 1024px
and encoded as WebP quality 95. The source file is unchanged; the shipped derived
GLB is 946,776 bytes. Cinema assets total 128.85 MiB, within the 129 MiB budget.
The source SHA-256 is recorded in the asset record.

```bash
node scripts/cinema2-assets/prepare-orbital-sphere.mjs /path/to/metal_sphere.glb
npm run assets:build
node scripts/verify-cinema2-orbital.mjs
```

The browser review exercises the actual registered asset, text edits, source
material versus polished finish, sphere size, six patterns, audio, pause,
portrait framing and context restoration. Evidence is written to
`artifacts/cinema2-orbital/`. Source texture resolution is intentionally capped
for the existing package budget; visual acceptance remains with the owner.

This revision passed 4 focused ORBITAL tests, 19 rendered WebGL comparisons,
TypeScript, focused ESLint and the asset catalog check. The baseline capture was
visually reviewed. Changes remain uncommitted.
