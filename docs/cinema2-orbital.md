# ORBITAL

ORBITAL now uses the supplied `metal_sphere.glb` (Abstract sphere by deecube1).
The old gyroscope, docking markers and violet planet have been removed. Stars
and a small neutral debris field remain. One or two lines of extruded lettering
orbit the sphere on a horizontal ring just outside its surface, each letter
facing outward, so the text travels in front of the sphere, round its side and
behind it. **Orbit Period** is the time for one trip round the ring (default 16
seconds at 120 BPM; BPM Sync follows the detected tempo). The angle is
accumulated from the beats that pass, so Auto Performance changing the period
changes the speed smoothly. Pause freezes it; Lock Off, Motion at 0 and Reduced
Motion hold it in front, stop it or slow it.

**Design → Layout → Position** replaces Alignment and has two options, offered only
while **Line Mode** is Two Lines. **Stacked** keeps the two lines one above the
other, as authored, on the same arc. **Linear** puts both lines on one row,
opposite each other on the ring: one in front of the sphere while the other is
behind it, swapping as they orbit. One Line has no Position control. Glyph
metrics and the shared text layout are unchanged; each glyph's line is read
from its id (`glyph-<line * 12 + index>`).

Inside the lattice sits an **inner core**: the supplied `texture1.glb` ("Sphere" by
Cyril43, CC BY 4.0; asset `cinema2-orbital-core`). It shows through the gaps of the
bands, scales with Sphere Size, tilts with the lattice and plays its own animation
on the shared musical time. Its loose solid-red emissive part is removed, its
material made opaque and its metalness lowered so the engraved panels keep their
colour. It is optional: if it cannot load, ORBITAL runs without it. Prepare it with
`node scripts/cinema2-assets/prepare-orbital-core.mjs /path/to/texture1.glb`, then
`npm run assets:build`. The derived GLB is about 1.3 MB (Meshopt geometry, WebP
quality 85 maps), which leaves the catalog at 159.6 of 160.0 MB.

The default **Sphere Material** finish clones the imported physical material,
including its color, normal, roughness, metalness and specular maps. Glyph UVs
are reprojected across those same textures. The authored finish is a dark gunmetal
(Letter Tint, low Roughness, strong reflections, a defined highlight sweep and a
soft bloom) so the weathered texture and the highlights read as cinematic metal,
not a flat grey. Letter Tint and Roughness remain editable.
`/Users/kodyrobinson/Downloads/texture2.glb` is byte-for-byte the same file as
`metal_sphere.glb` (same SHA-256), so the lettering already uses that texture.
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
Text scenes saved before Position replaced Alignment still apply: the retired
Alignment value is ignored and Position takes its default (Stacked).
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
