# Third-party notices

## Carbon icons

The application icons rendered by `src/components/shared/icons/AppIcon.tsx` use glyphs from the
IBM Carbon Design System icon set (also listed as "Carbon" on Streamline).

- Source: https://github.com/carbon-design-system/carbon/tree/main/packages/icons
- Copyright IBM Corp.
- License: Apache License, Version 2.0 — https://www.apache.org/licenses/LICENSE-2.0

The path data in `src/components/shared/icons/carbonGlyphs.ts` is Carbon's, with transparent helper
shapes removed and circles written as arc paths. No other changes were made to the glyph geometry.
The licence permits use, modification and distribution, provided this notice and the licence
reference are retained.

## Lyric Versions icon

The user-supplied Lyrics — Streamline Sharp Material artwork is used for the
Lyric Versions action on audio track cards. Source attribution supplied with
the SVG: https://streamlinehq.com. Its fill inherits the application icon color.

## VTracer model vectorization

The model generator ships the WASM binary and adapted wasm-bindgen JavaScript
loader from `@visioncortex/vtracer` **1.0.0-alpha.4** (package license:
MIT OR Apache-2.0; distributed here under MIT).

- Source: https://github.com/visioncortex/vtracer/tree/master/nodejs
- Copyright (c) 2024 TSANG, Hao Fung
- License: `src/features/models/trace/vendor/LICENSE-VTracer`, reproduced from
  https://github.com/visioncortex/vtracer/blob/master/LICENSE
- Modification: the Node filesystem initializer and CommonJS exports are replaced
  with an asynchronous, browser-safe initializer. The WASM bytes are unchanged.
- Reproduce with `node scripts/model-assets/sync-vtracer.mjs`; the exact package is
  pinned in package-lock.json and the binary SHA-256 is checked by the script.

## ORBITAL metal sphere

Abstract sphere by deecube1, supplied as `metal_sphere.glb`.
Embedded source: https://sketchfab.com/3d-models/abstract-sphere-a525fc48c1d245e2883241e344773aa4
Author: https://sketchfab.com/deecube1
License: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/
DRMVYZ converts the specular/glossiness material to metal/rough PBR, caps maps at
1024px, encodes WebP quality 95, and reuses the material maps on ORBITAL lettering.
Original meshes and animation are retained. The source hash and generated
attribution are recorded in the Cinema asset catalog.
