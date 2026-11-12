# Model generator — Phase 02

The independent engine converts filled SVGs and foreground-prepared PNG/JPEG/WebP
images into real extruded Three.js meshes and validated binary GLBs. Media Manager
UI, cloud-save UI, Cinema model binding and preset choreography remain later phases.
Phase 01's real-Supabase deployment/acceptance gate is unchanged.

## Phase 03 integration

Import `createDefaultModelRecipe`, `createModelArtifact`, `prepareModelInput`,
`VTracerVectorizer` and `MODEL_MATERIAL_PRESETS` from
`src/features/models/generator/createModelArtifact.ts`.

```ts
const model = await createModelArtifact({
  source: selectedImageBlob,
  recipe: createDefaultModelRecipe(),
  quality: 'normal', // draft | normal | high
  signal: abortController.signal,
})
// Mount model.group in the future viewport. Caller owns its lifetime.
// model.files can be passed to Phase 01's saveVersion prepared-file API.
// Persist model.recipe (effective settings), model.stats and explicit version.
// On regeneration, replacement or unmount:
model.dispose()
```

The result includes the group, validated effective recipe, triangle/vertex/mesh
stats and bounds, material count, dimensions, source snapshot, sanitized trace
SVG, GLB, prepared repository files, foreground preview and diagnostic warnings.
It never writes to Supabase or application stores. The effective quality tier is persisted as an optional version-1 recipe field
(older recipes default to Normal), so reopening preserves raster tracing resolution.
Both live and exported geometry
use the effective depth, safe bevel, transform, pivot and front/side materials.

Opaque input produces a previewable threshold mask and requires confirmation:
catch `ModelGenerationError` with code `foreground_confirmation_required` and show
its `preview` Blob. `prepareModelInput` also exposes the preview/confirmation state.
After user confirmation, call the engine with `foregroundConfirmed: true`. Opaque
alpha-mode input becomes luminance mode in the returned recipe. Empty/full-rectangle
masks fail with `empty_foreground`; do not silently confirm for the user.
Existing Media Manager background removal can supply a prepared alpha source;
its image loader is reused, and no second background-removal model is introduced.

## VTracer execution decision and reproduction

Pinned dev/build dependency: `@visioncortex/vtracer` **1.0.0-alpha.4**. Upstream
Node API: `convertBuffer`, `convertPixels`, `convertFile`, `convertFileSync`.
The published Node wrapper imports `fs`; it is never imported into the renderer.

The same upstream WASM binary works in a browser. The generated wasm-bindgen glue
is adapted by replacing only CommonJS exports and filesystem initialization with
an async `WebAssembly.instantiate` initializer. No Rust rebuild or replacement
tracing algorithm is used. The adapted API is `initialize(bytes)` and
`vectorize_rgba(rgba,width,height,options)`. A fixture spike and automated test
compare its contour output exactly with the official Node API.

```sh
node scripts/model-assets/sync-vtracer.mjs
```

The script verifies package version and binary SHA-256, regenerates the committed
browser loader/WASM, and copies the upstream MIT license to public assets.
Binary SHA-256: `63716b70497b7468ef97545b50f5f34b8bbb7acde2d7b00deb4eb40781446d45`.
The package declares MIT OR Apache-2.0; this distribution uses MIT with copyright
and license retained in the vendor directory, public assets and third-party notice.

`VTracerVectorizer.trace({pixels,width,height,options:{smoothing},signal})` owns a
module worker per trace. It copies and transfers pixels, fetches the bundled WASM,
traces actual binary foreground pixels, sanitizes output and terminates the worker
on success, failure, abort or a 30-second timeout. A failed trace never returns a
substitute mesh. The caller's pixel buffer is retained. Neither Node integration
nor new IPC/preload permissions are needed.

Vite emits a standalone lazy engine entry at `dist/assets/model-generator.js`,
a hashed module worker and a hashed WASM asset. Relative URLs work with HTTP and
Electron's existing `drmvyz-app` protocol. The engine is not imported by the app's
initial entry. Phase 03 can import the TypeScript module lazily in the normal app.

## Geometry, safety and supported scope

- Byte signatures and declared MIME are checked. Raster dimensions are inspected
  before decoding, then checked again. Limits: 16 MiB source, 4096 edge, 4,194,304
  pixels; SVG 1 MiB, 256 paths, 12,000 coordinate/command units, 6,000 sampled points.
- PNG alpha drives silhouettes and internal cutouts. Raster sources are preserved
  as normalized PNG snapshots; tracing uses quality-limited resolution.
- SVG stays vector. Only filled paths and basic shapes/groups are supported.
  ViewBox is validated; SVGLoader applies geometry transforms. Painted geometry
  is normalized to a longest XY edge of 2 units, Y flipped for a readable front,
  then centered or bottom-pivoted and transformed by the recipe.
- The r186 `ShapePath.toShapes()` API preserves fill rules, holes and nested
  islands; deprecated `SVGLoader.createShapes` is not used. Near-collinear points
  simplify deterministically; contours below normalized area 0.000001 are omitted.
- Scripts, events, entities, foreignObject, external resources, CSS URLs and
  unsupported visual features fail before geometry. Convert text, strokes,
  gradients, references, masks and clipping to supported filled outlines first.
- Overlapping separate fills and self-crossing sampled contours fail explicitly;
  this release does not provide CAD boolean union/repair. Full-color layered
  geometry is intentionally unsupported and rejected.
- Draft/Normal/High cap tracing edges at 256/768/1024, curve segments at 4/12/24,
  bevel segments at 1/3/6 and triangles at 20,000/80,000/200,000. Preflight checks
  avoid oversized extrusion, and actual output counts are verified.
- Bevel is clamped by depth and measured detail separation. Complex contours use
  a sharp fallback rather than guessing safe bevel clearance. Warnings record
  clamps, sharp fallback and trace downsampling. Depth and transform are in model units.
- Chrome, Black Chrome, Gold, Holographic, Gloss, Matte and Clay are real physical
  material recipes. Front/caps and side regions differ; metalness, roughness,
  emissive and opacity persist in GLB. Holographic is a material treatment.
  Viewer-only background/environment lighting is not baked into exported reflections.
- Export uses GLTFExporter binary mode and parses the result through GLTFLoader,
  checking header, nonempty finite geometry, bounds and PBR materials. Validation
  scenes are disposed; failed/cancelled generation disposes the generated group.

## Verification

All final commands used Node **22.23.3**, within the repository baseline. The initial
npm dependency fetch used the host's Node 26 and emitted its engine warning;
subsequent build and verification use Node 22. VTracer is a dev/build dependency;
only the adapted runtime assets ship.

- **20 engine tests passed**: committed SVG/icon/donut/islands, actual VTracer PNG
  tracing, Node/browser-glue equivalence, open-hole ray intersections, aspect,
  transforms, material groups, depth, quality, deterministic geometry, unsafe SVG,
  budgets, cancellation and resource disposal.
- **27 Phase 01 domain/repository tests passed** after adding optional quality metadata.
- **16 existing media tests passed**: background-removal and edit-pipeline tests.
- **16 runtime assertions passed in each of three modes**: Vite + Chromium,
  production output + Chromium, and Electron **43.1.0** with a real ASAR-packaged
  fixture (`app.isPackaged === true`), sandbox, context isolation and app protocol.
  They exercise real worker/WASM tracing, SVG bypass, PNG/JPEG/WebP decoding,
  preview confirmation, material retention in GLB, source-file handoff, disposal
  and worker cancellation. The fixture uses emitted assets, not dev-server imports.
- TypeScript via `npm run build`, focused ESLint and production build passed.
  Vite reports the repository's large-chunk advisory; the build succeeds.
- Committed fixture sources include solid, donut, islands, hostile and malformed
  SVG, plus transparent and opaque PNG. JPEG/WebP runtime fixtures are encoded
  from the committed opaque PNG through the real browser canvas.

```sh
npx vitest run src/features/models/generator/modelGenerator.test.ts src/features/media/backgroundRemoval/removeImageBackground.test.ts src/features/media/edit/mediaEditPipeline.test.ts
npx eslint src/features/models/generator src/features/models/geometry src/features/models/materials src/features/models/export src/features/models/trace/*.ts scripts/model-assets vite.config.ts
npm run build
node scripts/model-assets/verify-generator.mjs
DRMVYZ_MODEL_ELECTRON_PACKAGE_DIR=/absolute/path/to/disposable/Electron.app node scripts/model-assets/verify-generator.mjs electron
```

The Electron command modifies only that disposable extracted app bundle. It creates
an ASAR test package and a renamed test executable; do not point it at an installed
application. A cached Electron 43.1.0 archive was used; no Electron download or
application installation was needed. The full DRMVYZ signed/notarized installer,
Windows/Linux runtime and cloud persistence were not validated in this phase.

## Size impact and changed files

The upstream package unpacks to 692,673 bytes as a build dependency. New production
artifacts: WASM **668,378 bytes** (278.69 kB gzip), worker **7.15 kB**, engine entry
**86.03 kB** (28.52 kB gzip), MIT license **1,057 bytes**. The engine also references
existing shared Three/GLTF/media-rendering chunks. These are emitted asset sizes,
not a measured total installer delta; no full installer was built.

New source modules are under `src/features/models/{trace,geometry,materials,export,generator}`;
fixtures are under `src/features/models/__tests__/fixtures`. `scripts/model-assets`
contains the reproducible WASM adapter and runtime checks. `package.json` and lock
pin the build dependency; `vite.config.ts` emits the engine entry. The vendor MIT
license is copied into `public/models/vtracer`; `THIRD_PARTY_NOTICES.md` and the
current documentation index describe it. The Phase 01 recipe type/parser gain backward-compatible optional quality metadata;
its existing persistence tests remain valid. Unrelated existing
README/auth/style edits are preserved. No commit was requested or created.
