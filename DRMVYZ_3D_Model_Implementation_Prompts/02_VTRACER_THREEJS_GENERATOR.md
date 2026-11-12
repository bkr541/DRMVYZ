# PHASE 02 — VTracer + Three.js Image-to-3D Generation Engine

## EXECUTE THIS PHASE IN CODE

You are Claude Code / Codex. Read `00_MASTER_OVERVIEW.md`, completed Phase 01 diff and handoff, then `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md` and relevant tests. **Phase 2 of 7**: deliver a real, tested logo-to-3D engine, not a GUI and not an outline of an engine. Preserve image/video workflows. Use the real project dependencies and account for Electron **and** normal Vite/browser development.

## Goal

Turn a supported SVG, transparent PNG, or background-prepared raster input into a valid, customizable **actual 3D mesh** and exportable **GLB**. Preserve holes and avoid visually destructive path overlaps. Keep the engine independent from React, Supabase, Media Manager, and Cinema 2.0 so these can reuse it.

## Existing code and library anchors

- Existing Three.js in `package.json`: `three: 0.186.1` in supplied snapshot.
- `src/features/media/backgroundRemoval/` and `src/features/media/edit/`: existing background/alpha processing; inspect and reuse.
- `src/components/vyzualz/cinema2/modules/three/`: established Three.js loaders/decoders, resource ledger and rendering idioms.
- `src/components/vyzualz/media/generateThumbnail.ts`: current thumbnail patterns.
- VTracer official: https://github.com/visioncortex/vtracer ; npm `@visioncortex/vtracer` **targets Node.js WASM**, so renderer compatibility is not guaranteed. Do a small execution spike and record exact package version, API surface, license and bundle/installer size changes.
- Three.js `SVGLoader`, `ExtrudeGeometry`, `MeshPhysicalMaterial`, `GLTFExporter`: https://threejs.org/docs/pages/SVGLoader.html , https://threejs.org/docs/pages/GLTFExporter.html . Confirm deprecated APIs against installed version and provide tests.

## Implement independent source modules

Suggested new paths (adapt naming if codebase already has equivalents):

```text
src/features/models/trace/imageInput.ts
src/features/models/trace/svgSanitize.ts
src/features/models/trace/traceImage.ts
src/features/models/trace/traceImageWorker.ts   (if browser worker is supported)
src/features/models/geometry/extractContours.ts
src/features/models/geometry/createExtrudedModel.ts
src/features/models/geometry/modelQualityBudget.ts
src/features/models/materials/modelMaterials.ts
src/features/models/export/exportGlb.ts
src/features/models/generator/createModelArtifact.ts
```

### A. Input/source preparation

- Accept SVG, PNG, JPG and WebP from existing user media or a direct file input. Validate MIME **and sniff actual bytes** where practical; never execute untrusted SVG content.
- For SVG: sanitize scripts/handlers/`foreignObject`/remote resources, resolve viewBox/transforms, supported fills, compound contours/holes. Do **not** rasterize clean SVG needlessly.
- For alpha PNG: default to alpha-based silhouette with explicit threshold; handle transparent holes, disconnected islands, lettering cutouts, thin-line edge cases.
- For JPG/opaque raster: offer/produce previewable foreground extraction (background-removal reuse, corner-color removal, or thresholding); do **not** blindly extrude the entire rectangle. Flag ambiguous input for UI confirmation in Phase 03.
- Add pixel/dimension caps, input size guards, minimum contour area and tracing simplification. Return structured diagnostics/warnings instead of crashing.

### B. VTracer integration and execution environments

- Implement a `RasterVectorizer` interface with an async `trace({pixels,width,height,options,signal})` returning a sanitized SVG/path result.
- **Decide execution support explicitly:** official npm package is documented for Node WASM. Test whether a compatible **browser-safe** WASM artifact can run in Vite, Web Worker and packaged Electron. If not, implement a tested browser-compatible VTracer wasm build (with build documentation) or an isolated Electron IPC worker plus an explicit, tested browser equivalent/fallback. An untested import of a Node-only package into the React renderer is unacceptable.
- For Electron IPC, use safe preload APIs, path/content validation, no general-purpose code execution, no unchecked user file access. For browser worker, transfer image buffers and support cancellation; avoid blocking the main UI thread.
- Keep the chosen package version pinned and record required WASM file bundling for Vite/Electron. Include third-party notice update if new dependency is packaged.
- Prove real pixels are traced to real contours. Never fake a generated model when trace fails.

### C. Contour extraction and geometry

- For silhouette mode: create shapes with holes, nested rings, separated components, correct winding and transforms; triangulate/extrude with Three.js. Handle font interiors (O/B/A), thin bridges, concave contours, non-square aspect ratios and zero-size geometry.
- For color/layer mode: treat full-color vectorization as **optional/experimental**. If included, avoid z-fighting from overlapping VTracer regions using compositing/order-aware layered geometry. Default safe path is a solid silhouette with selected uniform color/material.
- Geometry recipe options: depth, bevel thickness, bevel segments, curve segments, simplification/smoothing, scale, pivot/center, face/side material controls. Clamp bevel relative to smallest shape detail to prevent self-intersection; keep a sharp-edge fallback.
- Normalize a deterministic bounding box/origin/pivot, preserve front orientation and aspect ratio. Expose triangle/vertex/material counts, max dimensions and warnings.
- Implement geometry budgets and a deterministic quality selector (Draft/Normal/High) that limits triangle counts rather than freezing the renderer.

### D. Materials, outputs, round trip

- Produce physically based real materials: color, metalness, roughness, emissive, opacity/transmission where supported, preset variants (Chrome/Black Chrome/Gold/Holographic/Gloss/Matte/Clay). Distinguish model material from **viewer-only** environment lighting; do not falsely promise reflections baked into GLB.
- Produce `THREE.Group`/scene plus versioned generator recipe, validated vector trace SVG, model bounds/stats and warnings.
- Export binary `.glb` using Three.js `GLTFExporter`, parse it back using GLTFLoader, and assert nonempty geometry, bounds and material retention. Export should fail loudly if empty or invalid.
- Provide a small fixture set under tests (a single solid icon, donut/O with hole, multi-island logo, transparent PNG, opaque image, malformed SVG, giant/hostile input). Use source fixtures committed with the tests.
- Dispose transient geometry/materials/textures after regeneration, errors and cancellation.

## Test suite and acceptance gate

- [ ] Real SVG with hole yields extruded mesh with correctly open hole.
- [ ] Transparent PNG with an internal cutout is correctly traced by **actual VTracer** and extruded.
- [ ] JPG/opaque cases show a warning/foreground prep instead of an unreviewed solid rectangular block.
- [ ] Depth/bevel/quality/material controls affect generated geometry or actual saved material.
- [ ] Equivalent recipe and source generate equivalent normalized geometry (within numeric tolerances).
- [ ] Generated GLB round-trips through GLTFLoader and retains nonempty mesh/materials.
- [ ] SVG sanitization blocks scripts and external references.
- [ ] Generated geometry stays within documented performance budgets; cancellation and failures release resources.
- [ ] **Both Vite/browser and packaged Electron** can load required WASM/runtime assets; explicitly record tested modes.
- [ ] `npm run typecheck`, focused tests, `npm run build` succeed (or disclose exact real blockers).

## Out of scope

No cloud save UI, no AI image-to-3D, no sculpting, no boolean CAD editing, no animation choreography, no full multi-color semantic separation. This engine should be callable from Phase 03 and produce blobs consumed by Phase 01's model asset repository.

## Required handoff

State chosen VTracer execution mode, exact pinned version, integration APIs, exported generator function(s), geometry test counts, bundle-size impact and any unsupported formats. A nonworking browser trace path is **not** a passed phase unless the product formally scopes browser out and the project owner explicitly approves that change.
