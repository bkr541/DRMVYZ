# ORBITAL

ORBITAL appears under Cinema 2.0 → Presets → System. One or two lines of extruded 3D lettering float in front of a rigged brass gyroscope, with docking markers, orbiting debris, and a violet planetary horizon.

- **Master Controls** provides Motion Amount, BPM Sync, Auto Performance, and Motion Safety. Lock Off holds the geometry in place.
- **Design** provides Line Mode, Line 1, optional Line 2, alignment, tracking, line spacing, glyph scale, and letter depth. The default Gyroscope Brass finish samples the model’s brass and engraved trim along with its metallic, roughness, and normal maps. Polished Brass and Amethyst are also available. Orbital Assembly controls adjust the rig size, ring travel, planetary horizon, and debris.
- **Effects** provides Pattern, Pattern Change, Trigger, and the standard post controls. Pattern Change is off by default. It uses the shared 11 trigger choices and defaults to Every 4 Bars when enabled. Pattern changes use the musical event’s identity, so a repeated publication of the same event advances once.
- **Palette** provides Space Tint, Letter Tint, and Inlay Color. Source and Pool use the shared Text Scenes library. Text supports printable Basic Latin, with up to 12 characters per line and 20 total.

| Pattern | Geometric choreography |
| --- | --- |
| Gyroscopic Drift | Slow letter drift and independent ring tilts |
| Apsis Pulse | Bass pushes the letters forward and expands the rig and docking markers |
| Counter Orbit | Opposing ring rotations and staggered glyph travel |
| Meridian Sweep | A wave of tilts moves through the rings and lettering |
| Resonant Lock | Midrange movement tightens toward alignment on the beat |
| Eclipse Rise | Letters and the gyroscope lift as the rings roll and the docking markers sweep |

Cinema’s audio routes drive bass expansion, midrange articulation, and high-frequency debris and marker accents. Phrase and drop events add bounded camera moves. Audio and automatic pattern changes leave authored values intact.

The bundled model is [Magical gyroscope by reddification](https://sketchfab.com/3d-models/magical-gyroscope-a3f110c0d2944a2dbff78709eb8f3984), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The original model’s rig, clips, and texture atlas are retained. The shipped copy normalizes invalid animation accessor metadata and zero-weight vertices, then compresses geometry and textures losslessly. Attribution also ships in `public/cinema2/attributions.json`.

Apply `supabase/migrations/0046_cinema2_orbital_text_scenes.sql` after the preceding Text Scenes migrations to enable ORBITAL account sync. The preset renderer uses the bundled GLB directly.

Run `node scripts/verify-cinema2-orbital.mjs` for deterministic WebGL checks and captures under `artifacts/cinema2-orbital/`.
