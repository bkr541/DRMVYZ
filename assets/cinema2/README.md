# Cinema 2.0 shipped assets

Every 3D model or texture the app ships for Cinema 2.0 is described here by `assets/cinema2/<id>/asset.json`. Users never upload 3D assets; everything is authored offline and ships with the app.

`npm run assets:check` (part of `verify:fast`) validates each record; `npm run assets:build` regenerates the TypeScript manifest
(`src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts`) and `public/cinema2/attributions.json` from them. Both files are committed.

## asset.json

| Field | Meaning |
|---|---|
| `id` | Lowercase letters, digits and dashes; must equal the folder name. Presets reference assets by this id, never by URL. |
| `kind` | `model` (binary glTF, embedded textures only), `texture` or `environment` (an equirectangular 2:1 Radiance `.hdr` or OpenEXR `.exr` for image-based lighting; GPU cost is the filtered cube map built from it, not its size). |
| `layout` | Textures only: `surface-normal-crack-roughness` (RG normal xy, B crack mask, A roughness), `noise-volume-rgba` (a tileable 3D noise volume stored as one image `width` wide and `width * depth` tall: R puffs, G strands, B fine puffs, A patchiness; uploaded as a 3D texture) `sprite-sheet-rgba` (a grid of billboard sprites: RGB shading, A density) or `color`. Data layouts must not be lossy-compressed. |
| `compression` | Models only: `none`, `meshopt` or `draco` (geometry). A model that uses Draco must say `draco` and one that does not must not (checked against the file). |
| `textureCompression` | Models only, optional: `ktx2` when the embedded textures are KTX2 / Basis Universal (`KHR_texture_basisu`). Omit for PNG/JPEG/WebP. Checked against the file. |
| `license` | One of `CC0`, `CC-BY-4.0`, `CC-BY-3.0`, `MIT`, `Apache-2.0`, `OFL-1.1`, `generated-in-house`. Licenses other than CC0 and in-house also need `attribution`. |
| `attribution` | Author, title and source text shown in the attribution list. |
| `origin` | Where the file came from (URL, or the generator script for in-house assets). |
| `files` | `high` (required), optionally `medium` and `low`: paths under `public/cinema2/`. A tier without a file uses the next better one. |

## What `assets:check` fails on

Missing or unreadable `asset.json`; unknown kind/layout/compression; missing license, license not on the allowlist, missing attribution or origin;
missing, invalid or shared files; a file over the per-file budget; a texture over the size limit (volumes: edge over 128 texels, or an image that is not a whole number of square slices; environments: not a 2:1 Radiance `.hdr`, or wider than 2048 px); a model over the triangle limit; an asset whose estimated GPU
memory on any quality tier is over the asset budget; total shipped size over the installer budget; a stale generated manifest or attribution list.
The limits live in `scripts/cinema2-assets/assets-core.mjs` (`DEFAULT_BUDGETS`) and can be overridden per project in `assets/cinema2/budgets.json`.
The project overrides allow 128 MiB of installed assets, 16 MiB per file, 250,000 triangles per model, and 4096 px 2D textures. Per-asset GPU limits are 32 MiB on low, 48 MiB on medium, and 80 MiB on high. Volume textures remain limited to a 128-texel edge and environment maps remain limited to 2048 px wide.

A model that **requires** a glTF extension the runtime loader does not support is rejected with `ASSET_EXTENSION_UNSUPPORTED` (the supported list is `SUPPORTED_GLTF_EXTENSIONS` in `assets-core.mjs`, checked against the installed Three.js by a test).

## Importing a new model (Blender and other tools)

Use the model tools before registering anything: `npm run cinema2:asset:inspect | validate | optimize | report -- <model.glb>`. `optimize` writes quality-tier variants, a report and an `asset.draft.json` into a scratch folder (never into `public/` or `assets/`, never over the source) and refuses any tier that lost a named part, a custom vertex attribute, an animation clip or a transform. See `docs/cinema2-rendering-architecture-upgrade.md`, section 6.

## Adding an asset

1. Put the shipped file(s) under `public/cinema2/models/` or `public/cinema2/textures/` (models: meshopt-compressed GLB with textures embedded; data textures: lossless WebP or PNG).
2. Add `assets/cinema2/<id>/asset.json`, run `npm run assets:build`, then `npm run assets:check`.
3. Register nothing by hand: the model and texture registries are filled from the generated manifest. Reference the id from a preset (`three-scene` instance `asset`, or the reflective floor's `surfaceTexture`).
