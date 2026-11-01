# War Of Worlds — initial asset preset

Cinema 2.0 preset `drmvyz.cinema2.war-of-worlds` appears as **War Of Worlds**. This first phase presents the supplied scene for visual review; animation and audio choreography have not been added.

Source: `/Users/kodyrobinson/Downloads/warofworlds.glb` (the supplied `/downloads/warofworlds/glb` directory did not exist). The file identifies itself as **WAR OF THE TRIPODS** by pinguinoconpulgares, CC BY 4.0. Credits are recorded with both assets and in the generated public attribution list.

All 381,715 triangles remain intact. The scene is partitioned into two aligned model files, each below the existing 250,000-triangle per-asset limit. Meshopt compresses geometry losslessly. High/medium use 512px texture maps; low uses 256px. Original UVs, textures, unlit material treatment, city, dome, tripods, and beam are retained. Total shipped Cinema 2.0 assets remain inside the existing installer and per-asset GPU budgets.

The camera starts inside the supplied dome, looking across the city at both tripods. The imported scene is centered and uniformly scaled; both model parts share the same placement. Narrow stages preserve the composition's horizontal view.

| Standard Design parent | Controls |
| --- | --- |
| Master Controls | Exposure |
| Design | Camera Distance, Camera Heading, Camera Elevation |
| Effects | Contrast, Saturation |
| Palette | Color Temperature, Color Tint |

Palette changes operate in the final grade because the supplied model uses baked, unlit materials. Defaults preserve its colors. The shared Quality / Performance control is also available. There are no placeholder music toggles or preset-specific Inspector changes.

Validation:

- Focused preset tests cover native compilation, registration, all four Design parents, control consumption, both aligned instances, conserved geometry, attribution, and quality assets.
- `npm run assets:check` verifies generated records and the unchanged project budgets.
- `npm run test:e2e:cinema2-war-of-worlds` renders the production runtime in Chromium at high and low quality, at 1280×720 and a narrow 800×720 stage. It checks nonblank frames, palette response, zero module/effect/render failures, and released resources after disposal.
- Browser screenshots and the runtime report are written to `artifacts/cinema2-war-of-worlds/`. These were visually inspected; final aesthetic acceptance remains with the user. Browser rendering does not establish a target hardware frame rate.

Regenerate the model files with `node scripts/cinema2-assets/prepare-war-of-worlds.mjs /path/to/warofworlds.glb`, then `npm run assets:build`. The source file is never modified.
