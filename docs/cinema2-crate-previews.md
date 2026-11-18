# Cinema 2.0 crate previews

Six static previews, the Bass Sigil native performance and Moire Orb’s Resonance Reactor expose the owner’s `3D Cinema 2.0 Crate` files for inspection and development. All source GLBs remain byte-for-byte copies in `public/cinema2/models/crate/`. The six static previews retain fixed framing, authored hierarchy/materials and no added motion or controls. Bass Sigil and Moire Orb animate private instances of their original artifacts; their implementation and review status are described below.

| Preset | Source GLB | Appearance |
| --- | --- | --- |
| Moire Orb | `geometry_texture_effect_spheres.glb` | Original translucent core in Resonance Reactor, with 48 ring segments and 12 moving fixtures |
| Beam Lattice | `lasers_-_vj.glb` | Four banks of yellow laser lines |
| Wireframe Portal | `lightweight.glb` | Thin chamfered cube frame |
| Glyph Sphere | `oyes.glb` | White segmented marks wrapped around a sphere |
| Paradox Weave | `paradox_abstract_art_of_python.glb` | Interwoven angular planes and a red inner detail |
| Nested Pulse | `pulse_cubed.glb` | Nested translucent square frames |
| Bass Sigil | `skrillex_-_vj_-_flash_warning.glb` | Original wordmark, red core, cellular sphere and particle meshes with eight native programs, musical choreography and shared Auto Performance |
| Glitch Array | `stroboscopic_glitch_-_photosensitivity_warning.glb` | A floor array of dark beveled cubes |

The stable preset IDs are `drmvyz.cinema2.crate-<slug>`; definitions and framing live in `Cinema2CratePresets.ts`. The stock Three scene module now accepts `preserveMaterials: true` for shipped instances, using the same material-preservation path as its existing neutral model floor. Spin is explicitly off. The six static previews have no model normalization or mesh edits. Bass Sigil’s controller normalizes presentation and animates private source-mesh instances, leaving its source GLB intact.

The Paradox file requires the older `KHR_materials_pbrSpecularGlossiness` extension. A small GLTFLoader plugin maps its diffuse/specular/gloss factors to physical material properties during decoding, avoiding the loader's white fallback. This supports factor-based legacy materials; specular/glossiness textures remain rejected by both the asset validator and loader. Source bytes remain untouched.

Every source embeds CC BY 4.0 author, title and source metadata. Credits are retained in the asset records and generated `public/cinema2/attributions.json`. The installer asset budget increases from 132 to 160 MiB to accommodate the supplied files without compression or quality substitutions; the complete shipped asset inventory is 152.15 MiB. Individual file, triangle, texture and GPU limits are unchanged.

Validation: the three new crate tests verify native compilation/registration, the absence of controls and choreography, byte-for-byte file hashes, and legacy diffuse/gloss decoding. The eighteen shared Three scene tests, asset pipeline tests, TypeScript, focused ESLint and asset inventory check passed. All eight thumbnails were generated through the production runtime and visually reviewed in ignored `artifacts/cinema2-crate/production.png`. Thumbnails live in `public/preset-artwork/`.

The fixed view is an inspection baseline, not a recreation of Sketchfab's viewer settings: these GLBs contain no cameras, and external viewer lighting/post-processing is not embedded in them. Later camera controls, animation, audio mapping and stage enhancements are intentionally left for a separate phase.

## Bass Sigil original-environment checkpoint

Bass Sigil retains its existing identity and now uses `Cinema2BassSigilPreset.ts` with a dedicated native controller acting on the **original** `cinema2-crate-bass-sigil` asset. All original meshes/textures remain supplied; no replacement environment or derived asset is shipped. The withdrawn P1 substitution is documented only as history. P2 adds manual controls, six palette roles, shared-tempo motion, canonical Pattern controls and eight native programs, P3 subsequently adds basic bounded Audio Intelligence response routes; P4–P7 add scored geometry, shared Director/Mood policy, bounded build/drop programs and depth-aware finishing. The final captures have user visual-direction approval; representative musicality review remains outstanding. See the [performance and acceptance report](BASS_SIGIL/P4-P8-performance-and-acceptance.md). See the [P2 report](BASS_SIGIL/P2-original-environment-and-native-motion.md). Other crate references remain static.

Bass Sigil’s current basic audio mapping, playback checks and shared target-limit correction are documented in the [P3 report](BASS_SIGIL/P3-audio-reactivity-report.md).


## Moire Orb — Resonance Reactor

The existing Moire Orb entry now retains its original five meshes inside a complete 3D reactor chamber, with omnidirectional/manual/horizontal camera modes, six native programs, shared musical performance and five independent palette roles. Revision 2 enlarges and details the orb, builds recessed mechanical bays and deck machinery, and provides **240 addressable light cells** (48 ring segments, 48 electrodes and 144 chamber cells) with **12** detailed moving fixture rigs. Global wash and haze are reduced. See the [implementation and acceptance record](MOIRE_ORB/resonance-reactor.md). Other undeveloped crate previews remain static. The user rejected the first draft for insufficient depth/detail and excessive light. The user approved revision 2’s visual direction ("Looks right"). The user authorized marking Resonance Reactor complete. No separate representative whole-song musicality review was performed; this limitation remains documented in the acceptance record.
