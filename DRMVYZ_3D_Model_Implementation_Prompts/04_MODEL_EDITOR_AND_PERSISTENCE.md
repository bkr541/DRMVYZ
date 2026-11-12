# PHASE 04 — Model Styling, Color, Non-Destructive Edits and Real Cloud Saving

## EXECUTE THIS PHASE IN CODE

You are Claude Code / Codex. **Phase 4 of 7.** Read `00_MASTER_OVERVIEW.md`, the completed Phase 01–03 handoffs and current repository contracts before editing. Implement the entire model editing and persistence UX. Reuse the existing Media Manager inspector, model generator, and the Supabase model repository. Do not add a new standalone Model Manager.

## Goal

Users can **edit** real 3D models, **see every supported geometry/material change live**, **save** versions to their user-owned Media Manager library, **reopen** across sessions and **export** real GLB files. Ensure file storage + DB state accurately match what the canvas shows.

## Existing anchors

- `src/components/vyzualz/media/MediaManagerInspector.tsx`: `MediaInspectorTab = 'info'|'edit'|'output'`, right-side inspector and header actions.
- `src/components/vyzualz/media/MediaManagerStage.tsx`: center preview switch from Phase 03.
- `src/features/media/MediaManagerView.tsx`: selection / dirty guard / header save-delete wiring.
- `src/components/vyzualz/react/ReactControlRows` and shared app controls: use existing consistent sliders, color pickers, dropdowns, collapsibles and shared typography.
- `src/features/models/` modules from Phases 01–03 and `src/components/vyzualz/media/generateThumbnail.ts` for appropriate thumbnail conventions.

## 1. Inspector layout and complete V1 editing controls

Extend the existing right-hand Info/Edit/Output tabs for the active model; do not replace tabs across all media types.

| Tab | Required model-specific controls |
| --- | --- |
| **Info** | Name, description, favorite, source image link, source dimensions/format, model dimensions, version, geometry stats, ownership/modified date, tags and user collections |
| **Edit: Trace / Source** | Background/alpha preview, silhouette threshold, foreground inversion where meaningful, contour smoothing, trace detail, regenerate action, source integrity warnings |
| **Edit: Geometry** | Depth/extrusion, bevel width and segments, curve detail, center/pivot, uniform scale, geometry quality / triangle-budget mode; clamp invalid combinations |
| **Edit: Materials** | Primary/front and side colors; presets Chrome, Black Chrome, Gold, Gloss, Matte, Clay, Holographic-like; metalness, roughness, emissive color/intensity, clearcoat (if supported). Opaque/transparent modes only if exported correctly |
| **Edit: Preview** | Studio lighting, rotation/turntable, background/grid, shadows; identify preview-only options that do not export |
| **Output** | GLB download, model metadata/stats, active version and save-as-new-version, 2D preview image export if feasible |

- Every rendered control must have a **real consumer**. A material preset changes actual `MeshPhysicalMaterial` values; adjusting material persists to new GLB. Geometry settings regenerate geometry without disturbing the camera unnecessarily.
- Use typed versioned `GeneratorRecipe` state. Preview changes remain in draft until Save. Add Reset to saved version, Revert, and disable save on invalid state.
- Use sensible bounds for color/metalness/roughness/bevel and visibly display resource/performance warnings.
- Debounce expensive trace/geometry regeneration, cancel stale requests, retain most recent successful model while regenerating, and surface failures without losing the user's current draft.
- Avoid copying the entire SVG/XML/GLB into Zustand persistent JSON or Supabase `jsonb`. Store recipe references and actual binary assets in Storage.

## 2. Source/preview artifact persistence

- Capture and upload the **full-resolution source snapshot**, sanitized vector trace SVG, binary GLB, and PNG preview to user-owned versioned paths in the new `model-assets` bucket. Source media linkage remains optional so removal of original image does not break model edits.
- Use GPU canvas readback or a separate offscreen renderer to create an actual thumbnail, with graceful handling of tainted assets and WebGL failures. Never persist a blank/placeholder PNG as a successful thumbnail.
- Save correct metadata including GLB byte size, triangle count, material count, bounds, generator version, active source and complete editable recipe.
- A saved file must be round-trip loaded independently of in-memory scene state. After saving, reload it via a signed URL and compare visible/material outcomes.
- Store `id` and immutable `version` for each model; renaming is metadata-only. Do not overwrite old GLBs when modifying geometry or color.

## 3. Save workflow and failure handling

- Use Phase 01 `modelAssetRepository`/`modelAssetStorage` with authenticated owner. On a new model: create a pending asset, prepare blobs, upload version #1, publish as ready only when assets exist. On editing existing model: optimistic concurrency on expected current version, write version #N+1, and publish atomically at the database layer.
- Handle cancellation, insufficient storage, upload failure, stale version conflict, expired auth/signed URLs, incomplete thumbnail, network retry and DB insert failures. Clean up orphaned uploads or record a cleanup job for retry; never silently mark Save complete.
- Deleting a model confirms if it is used in projects/presets; do not strand active references with a broken renderer. At minimum provide a deterministic missing-model placeholder/fallback and error; prefer warning and recoverable soft-deletion if existing app patterns support it.
- `Save` and `Save As New Model` must be distinct. A new model copied from an existing one receives its own model ID, source snapshot and version history.
- Ensure model collection memberships and favorites persist through log-out/log-in and don't interfere with image/video collection joins.
- Correctly integrate both **model dirty state** and existing `useMediaEditStore` dirty guard into header actions, rail selection changes and beforeunload navigation.

## 4. Export, disposal and asset lifecycle

- GLB download uses `GLTFExporter` (or saved verified GLB blob), named safely, with correct binary MIME/extension; exported model must load in an independent GLTFLoader test.
- Preview and editor must release replaced Three.js geometry/materials/GPU buffers on repeated edits and tab switches. Do not dispose shared cached resources owned by another component.
- Add cache invalidation by `(modelAssetId, version)`. Signed URL expiry is not asset identity.
- When re-entering the editor, retrieve **source snapshot + recipe** and regenerate, and load the corresponding saved GLB for verification/fallback. Preserve visual equivalence across sessions; missing trace should yield a readable warning and GLB preview rather than a crash.

## Concrete modifications

- `src/components/vyzualz/media/MediaManagerInspector.tsx` and a new `ModelEditorInspector.tsx` to keep old inspector manageable.
- `src/components/vyzualz/media/ModelEditorStage.tsx` and Phase 03 viewport model events.
- `src/features/media/MediaManagerView.tsx` for Save, Save As, Delete, dirty state, model version selection and loading.
- `src/features/models/state/modelEditorStore.ts` for controlled draft/last-saved recipe with revision/progress/error and request-cancellation.
- Phase 01 repository/storage modules and Phase 02 generator/export modules for actual persistence and geometry/material regeneration.
- Focused tests under existing media / models tests; avoid changing current image/video editor semantics.

## Acceptance gates (manual + automated)

- [ ] Upload transparent PNG or SVG; generate 3D, set depth, bevel, gold and side color; save to Supabase.
- [ ] Reload app, find model in Media Manager, orbit it, inspect its stats; settings and appearance are restored correctly.
- [ ] Change depth/material, Save => new immutable version; load version #1 and #2 separately, each showing its original appearance.
- [ ] Change preview-only lighting => no claim that the lighting is baked into exported GLB.
- [ ] Download GLB, inspect/reparse it, confirm genuine mesh and material data.
- [ ] Save failure/denied Storage upload leaves the draft and previous committed version intact with visible explanation.
- [ ] Unsaved selection/navigation confirmation works; rapid control changes do not apply stale generation results.
- [ ] User B cannot view/edit user A's assets; model cards/collections/favorite state survive restart.
- [ ] Existing image/video editing, filters and upload behavior remain regression-clean.
- [ ] `npm run typecheck`, relevant DOM/engine/data tests, build, and one real browser interaction test pass.

## Required handoff

Include source/migration dependencies, new UI controls, version concurrency handling, Supabase deployment state, two example saved record structures (omit credentials/private signed URLs), screenshots or test results, and any unsupported material/export settings. **If no authenticated Supabase project was available, mark cloud end-to-end validation pending, not passed.**
