# Phase 04 — Model editing and versioned persistence

Implemented in the existing Media Manager. This supersedes Phase 03's disabled
model Save/Delete actions. Phase 05 integration has not been started.

## Controls and ownership

`ModelEditorInspector.tsx` supplies model-only Info/Edit/Output tabs using the
shared controls. `ModelCreateInspector.tsx` remains a compatibility export.

- Info: fixed Media Role, name, description, source link and snapshot dimensions/format,
  model bounds, triangle/vertex/material counts, active/latest version, owner,
  modified date, tags and owned collections. Use the model card to toggle a favorite.
- Edit: raster alpha/luminance threshold, inversion, foreground confirmation,
  smoothing, quality, depth, bevel width/thickness/segments, curve detail, pivot,
  uniform scale, X/Y/Z rotation, and independent front/cap and side PBR materials. Chrome, Black
  Chrome, Gold, Gloss, Matte, Clay and Holographic presets change real materials.
  Emissive color/intensity, clearcoat/roughness and alpha opacity export to GLB.
  SVG uses validated filled paths; raster foreground controls are hidden for SVG.
- Preview: neutral/studio environment illumination, lighting, background, grid,
  shadows and turntable. These remain draft settings until Save; environment,
  lights, helpers and camera are not baked into GLB. Turntable stops on viewport
  navigation. PNG export captures the current view; saved thumbnails fit the
  model and omit helper geometry.
- Toolbar: icon-only GLB and PNG downloads for imported and generated models.
- Output: immutable version selector, Save/Save New
  Version, and Save As with a distinct ID/history. Reset/Revert discards edits
  after confirmation. A conflict offers an explicit reload of the latest asset.

Geometry/material edits debounce for 300 ms. Styling reuses the sanitized trace;
trace/foreground changes prepare the source again. Cancellation tokens and
recipe identity reject stale results. Camera position/target survive model
replacement in one editor session. Failed regeneration keeps the last usable
model. Replaced groups, materials, renderer resources and capture buffers are
released. Draft blobs/Three objects are runtime-only, not persisted Zustand JSON.

## Save, retry and deletion

The production path uses `SupabaseModelAssetRepository`, existing auth and the
private `model-assets` bucket. Save captures a nonblank PNG from the real WebGL
canvas and publishes all four files: full-resolution source snapshot (normalized
PNG or sanitized SVG), sanitized trace SVG, binary GLB and PNG thumbnail. Stored
stats include GLB bytes, material count, bounds and source dimensions/type/size.
The complete recipe includes the generator and Three versions.

Publication uses Phase 01's operation UUID, immutable version paths and atomic
expected-current-version comparison. No old version is overwritten. Rename and
organization-only changes update metadata without uploading a new GLB. Geometry,
materials or preview-recipe changes create a new version; preview settings stay
in the recipe and PNG rather than the GLB scene.

Before marking the editor clean, Save independently downloads the published GLB
through a fresh signed URL and GLTFLoader. It checks triangles, bounds, material
colors, metalness, roughness, opacity, effective emissive output and clearcoat.
Then it saves metadata/organization. Navigation's Save action waits for this
completion; failed Save leaves the dialog and dirty draft intact.

A published-version checkpoint survives verification/metadata failure in the
current editor session. Retry verifies/completes that version instead of
publishing a duplicate. Failed uploads use durable cancellation/cleanup state
from Phase 01. Expired download URLs refresh once. Cancellation stops work between
uploads; the installed Storage SDK does not expose an upload AbortSignal, so an
in-flight upload finishes before cancellation cleans its staged files. A draft
row can remain after a failed/cancelled first save and is visible for deletion.
Closing/reloading the app loses unsaved editor memory; durable server operations
remain available through the repository's recovery APIs.

Delete confirms removal of all versions and warns about references. Cleanup
failure retains a visible deletion-pending record and Retry Delete action. A
missing/deleted model yields a readable unavailable-model stage and error instead
of a broken renderer. Project/preset model references are introduced in later
phases, so there is no reference-usage index to query in this phase.

Reopening retrieves the saved GLB plus recipe, source and trace, then reconstructs
the editable scene. Missing source preserves a viewable GLB and metadata editing;
geometry editing/Save As are disabled. Missing trace keeps the GLB and allows
regeneration from the source with a warning. Asset/version are cache identity;
URLs are obtained afresh. Version publication invalidates library cards and
thumbnails. Model tags and collection joins are separate from image/video joins.

## Schema and deployment

Apply existing migrations in order, including **0047** and new
**0048_model_organization.sql**, before using the UI. 0048 depends on existing
`media_tags` and `media_collections`, adds RLS-protected `model_asset_tags`, an
owner-matching trigger, and authenticated `get_model_organization` /
`update_model_metadata` RPCs. The metadata RPC locks the owned model, checks its
current version, validates collection ownership and replaces tags/membership in
one transaction. Direct client tag-join mutation and anonymous RPC execution are
revoked. Published version rows and prior files are unchanged.

**No migration has been deployed to a real Supabase project. Authenticated cloud
end-to-end acceptance remains pending.** Local HTTP fixtures do not establish
real Storage quota, signed URL, network cancellation or deployed RLS behavior.
Before deployment acceptance, apply 0047/0048 to a disposable Supabase project,
run both SQL scripts, then exercise save/relogin/reopen, denied upload and two-user
isolation through the actual Auth/Storage/PostgREST services.

## Validation and evidence

- Focused engine/domain/SDK/store/Media Manager/upload/navigation suite: 145
  relevant tests pass across the full pass and the subsequent debounce regression.
  Three previously documented unrelated baseline assertions are excluded (the
  two audio-loader argument assertions and lyric-dialog expectation).
- `supabase/tests/model_assets_security.sql` and new
  `supabase/tests/model_organization_security.sql` pass against PostgreSQL in the
  cached PGlite fixture after 0047/0048. This checks SQL logic, privileges, RLS,
  metadata rollback, ownership and version conflicts, not real Supabase services.
- `scripts/model-assets/verify-editor.mjs`: nine browser scenarios use the real
  workspace, generator, WebGL, PNG capture, GLB export and independent loader.
  Only remote persistence is replaced with a local HTTP fixture. Covers live
  styling/clearcoat/transparency, four artifact uploads, restart and organization,
  distinct versions, binary download, denied save/retry, Save As, guarded Save
  navigation and confirmed deletion. No browser page errors. Portaled dropdown
  typography is checked against the shared 11px role.
- `npm run typecheck`, focused ESLint and `npm run build` pass. Generated build
  artifacts are not part of the source change.
- Screenshots and machine-readable results are under
  `artifacts/model-editor-phase04/`: styled draft, saved Info, versioned Output,
  library after deletion and control typography. These are ignored local evidence.

Run browser verification with Node 22 and an installed Playwright Chromium:

```sh
node scripts/model-assets/verify-editor.mjs
```

The two sanitized illustrative DB records are in
[model-editor-phase04.examples.json](model-editor-phase04.examples.json). Paths
show IDs/versions/operation identity; no signed URLs or credentials are persisted.

## Limits and handoff

Holographic is a colored/emissive transparent PBR approximation. Spectral
iridescence, transmission/refraction, user-uploaded replacement textures and
full-color layered traces are unsupported. Opacity uses glTF
alpha blending and can exhibit the usual transparent-surface sorting limits.
Preview-only lighting and rotation are not model animation exports. Physical
mobile touch hardware and full desktop installers were not retested in this
phase. Cloud deployment and acceptance are pending as described above.

No commit was requested or created. Earlier phase changes and unrelated existing
README/auth/style work remain uncommitted. Phase 05 should consume immutable
`(modelAssetId, version)` identities and handle unavailable/deleted references;
it must not store signed URLs as asset identity.

## Starter textures

In Media Manager, open **Media Details → Edit → Materials** and choose a **Base color texture**. The picker shows swatches for 12 built-in textures, packaged with the app. Generated models can use separate textures for **Front / Caps** and **Sides**. Choose **None** to remove a generated model's texture. The base color tints the texture, and the metalness and roughness controls remain available.

For an imported GLB, choose the material slot first. **Original** restores the base color texture from the version you opened. A mesh without primary UV coordinates uses automatic planar mapping. The preview shows the new texture, and saved or downloaded GLBs embed it so they can be opened without the starter library.

## Imported GLB models

A `.glb` you made elsewhere can be uploaded from **New Media** (or dropped on the Media Library) and is stored in the 3D Models library as an **imported** model.

- **Entry points.** The New Media picker and the library drop zone accept `.glb`. GLBs go to their own import queue (like fonts), not the media upload queue, so a batch of GLBs is checked and imported one by one with a result per file. A GLB cannot be mixed with images, video, audio or fonts in one batch.
- **Checks before upload** (`src/features/models/import/`). The container is read first (GLB 2.0, complete, self-contained; Draco, Meshopt and KTX2 are refused by name because the viewer has no decoder for them), and every embedded PNG/JPEG is sized from its header so an oversized texture is refused before the browser decodes it (8192 px per side, about 768 MiB decoded in total). The file is then decoded for real and held to the existing budgets (64 MiB, 250,000 triangles, 1,000,000 vertices, 1,024 meshes, 128 materials); WebP textures, whose size the header scan cannot read, are measured after decoding. A thumbnail is drawn with the viewport's lighting and framing; if WebGL cannot draw one the model still imports with a placeholder card.
- **Storage.** `supabase/migrations/0058_imported_models.sql` adds `kind` (`generated` or `imported`) to `model_assets` and to version operations. An imported version stores the original GLB bytes, an optional thumbnail and the measured stats (including the original file name and texture size); its source snapshot, trace and recipe are null, and a check keeps the three together. Versions stay immutable, private and published only through `begin_model_version` / `publish_model_version`; the storage write policy reads the same `model_operation_paths` function, which now knows an imported operation has only `model.glb` and an optional `thumbnail.png`. The kind is chosen when the draft is created and cannot change afterwards.
- **Opening and editing.** An imported model opens its saved GLB directly. The Edit tab offers uniform scale, rotation, and base color, base color texture, metalness and roughness per material. Edits are baked into the GLB.
  - **Save New Version** exports the edited model to a GLB (`exportModelGlb`), runs it through the same checks and budgets as an import (`inspectGlbFile`, which also draws the new thumbnail), and publishes it as the next immutable version. The earlier version stays as it was and can be reopened from the version list. If the version saves but the title, tags and collections do not, the editor says so.
  - **Save As New Model** does the same into a separate imported model (version 1) and copies the current title, description, tags and collections; with no edits it copies the stored original GLB. The original model is untouched.
  - **Metadata** saves (title, description, favorite, tags, collections) change nothing about the version.
  - **Restore Original** (toolbar) and **Revert to Saved Version** discard edits. Unsaved edits count as unsaved changes for the navigation guard. **Download Edited GLB** exports the current edits without saving; with no edits the button downloads the stored original.
  - The edit session is the one built-in models use (`builtinEdit` in the editor store, despite the name), so the viewport, panel and toolbar are shared.
  - Round trip, measured in Chromium on real GLBs: triangles, vertices, meshes, materials and texture sizes are unchanged and clearcoat, IOR, metalness and roughness survive; the file is re-encoded and grows by roughly 10 to 40 percent.
- **Cleanup.** Closing a preview, cancelling an import or removing a queued file disposes geometry, materials and textures (`disposeModelGroup` now releases textures and closes their image bitmaps). A failed import removes its half-made record.
- **Other limits.** Imported pivot changes and per-mesh edits are unavailable. Imported animations are kept in the original file, and the editor does not play them. Check animations after exporting edits.
