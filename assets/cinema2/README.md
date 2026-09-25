# Cinema 2.0 shipped assets

Every 3D model or texture the app ships for Cinema 2.0 is described here by `assets/cinema2/<id>/asset.json`. Users never upload 3D assets; everything is authored offline and ships with the app.

`npm run assets:check` (part of `verify:fast`) validates each record; `npm run assets:build` regenerates the TypeScript manifest
(`src/components/vyzualz/cinema2/assets/Cinema2AssetManifest.generated.ts`) and `public/cinema2/attributions.json` from them. Both files are committed.

## asset.json

| Field | Meaning |
|---|---|
| `id` | Lowercase letters, digits and dashes; must equal the folder name. Presets reference assets by this id, never by URL. |
| `kind` | `model` (binary glTF, embedded textures only) or `texture`. |
| `layout` | Textures only: `surface-normal-crack-roughness` (RG normal xy, B crack mask, A roughness) or `color`. Data layouts must not be lossy-compressed. |
| `compression` | Models only: `none` or `meshopt`. |
| `license` | One of `CC0`, `CC-BY-4.0`, `CC-BY-3.0`, `MIT`, `Apache-2.0`, `generated-in-house`. Licenses other than CC0 and in-house also need `attribution`. |
| `attribution` | Author, title and source text shown in the attribution list. |
| `origin` | Where the file came from (URL, or the generator script for in-house assets). |
| `files` | `high` (required), optionally `medium` and `low`: paths under `public/cinema2/`. A tier without a file uses the next better one. |

## What `assets:check` fails on

Missing or unreadable `asset.json`; unknown kind/layout/compression; missing license, license not on the allowlist, missing attribution or origin;
missing, invalid or shared files; a file over the per-file budget; a texture over the size limit; a model over the triangle limit; an asset whose estimated GPU
memory on any quality tier is over the asset budget; total shipped size over the installer budget; a stale generated manifest or attribution list.
The limits live in `scripts/cinema2-assets/assets-core.mjs` (`DEFAULT_BUDGETS`) and can be overridden per project in `assets/cinema2/budgets.json`.
The first-wave installer budget defaults to 50 MB; change it there once the owner decides.

## Adding an asset

1. Put the shipped file(s) under `public/cinema2/models/` or `public/cinema2/textures/` (models: meshopt-compressed GLB with textures embedded; data textures: lossless WebP or PNG).
2. Add `assets/cinema2/<id>/asset.json`, run `npm run assets:build`, then `npm run assets:check`.
3. Register nothing by hand: the model and texture registries are filled from the generated manifest. Reference the id from a preset (`three-scene` instance `asset`, or the reflective floor's `surfaceTexture`).
