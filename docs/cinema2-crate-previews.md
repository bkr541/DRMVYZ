# Cinema 2.0 crate previews

Eight visible first-party reference presets expose the owner's `3D Cinema 2.0 Crate` files for inspection and planning. Each is the original GLB, copied byte-for-byte into `public/cinema2/models/crate/`, with its own fixed camera and neutral lighting. Meshes, hierarchy, textures, transforms and material settings remain authored. Embedded animation clips are retained in the files but never played. No audio response, choreography, effects, user controls or enhanced stage has been added.

| Preset | Source GLB | Appearance |
| --- | --- | --- |
| Moire Orb | `geometry_texture_effect_spheres.glb` | Overlapping translucent spherical lattices |
| Beam Lattice | `lasers_-_vj.glb` | Four banks of yellow laser lines |
| Wireframe Portal | `lightweight.glb` | Thin chamfered cube frame |
| Glyph Sphere | `oyes.glb` | White segmented marks wrapped around a sphere |
| Paradox Weave | `paradox_abstract_art_of_python.glb` | Interwoven angular planes and a red inner detail |
| Nested Pulse | `pulse_cubed.glb` | Nested translucent square frames |
| Bass Sigil | `skrillex_-_vj_-_flash_warning.glb` | Music wordmark inside a crystalline sphere and particle field |
| Glitch Array | `stroboscopic_glitch_-_photosensitivity_warning.glb` | A floor array of dark beveled cubes |

The stable preset IDs are `drmvyz.cinema2.crate-<slug>`; definitions and framing live in `Cinema2CratePresets.ts`. The stock Three scene module now accepts `preserveMaterials: true` for shipped instances, using the same material-preservation path as its existing neutral model floor. Spin is explicitly off. No model normalization or mesh edits are applied.

The Paradox file requires the older `KHR_materials_pbrSpecularGlossiness` extension. A small GLTFLoader plugin maps its diffuse/specular/gloss factors to physical material properties during decoding, avoiding the loader's white fallback. This supports factor-based legacy materials; specular/glossiness textures remain rejected by both the asset validator and loader. Source bytes remain untouched.

Every source embeds CC BY 4.0 author, title and source metadata. Credits are retained in the asset records and generated `public/cinema2/attributions.json`. The installer asset budget increases from 132 to 160 MiB to accommodate the supplied files without compression or quality substitutions; the complete shipped asset inventory is 152.15 MiB. Individual file, triangle, texture and GPU limits are unchanged.

Validation: the three new crate tests verify native compilation/registration, the absence of controls and choreography, byte-for-byte file hashes, and legacy diffuse/gloss decoding. The eighteen shared Three scene tests, asset pipeline tests, TypeScript, focused ESLint and asset inventory check passed. All eight thumbnails were generated through the production runtime and visually reviewed in ignored `artifacts/cinema2-crate/production.png`. Thumbnails live in `public/preset-artwork/`.

The fixed view is an inspection baseline, not a recreation of Sketchfab's viewer settings: these GLBs contain no cameras, and external viewer lighting/post-processing is not embedded in them. Later camera controls, animation, audio mapping and stage enhancements are intentionally left for a separate phase.
