# Phase 04 — Model editing and versioned persistence

Implemented in the existing Media Manager. This supersedes Phase 03's disabled
model Save/Delete actions. Phase 05 integration has not been started.

## Controls and ownership

`ModelEditorInspector.tsx` supplies model-only Info/Edit/Output tabs using the
shared controls. `ModelCreateInspector.tsx` remains a compatibility export.

- Info: name, description, favorite, source link and snapshot dimensions/format,
  model bounds, triangle/vertex/material counts, active/latest version, owner,
  modified date, tags and owned collections.
- Edit: raster alpha/luminance threshold, inversion, foreground confirmation,
  smoothing, quality, depth, bevel width/thickness/segments, curve detail, pivot,
  uniform scale, independent front/cap and side PBR materials. Chrome, Black
  Chrome, Gold, Gloss, Matte, Clay and Holographic presets change real materials.
  Emissive color/intensity, clearcoat/roughness and alpha opacity export to GLB.
  SVG uses validated filled paths; raster foreground controls are hidden for SVG.
- Preview: neutral/studio environment illumination, lighting, background, grid,
  shadows and turntable. These remain draft settings until Save; environment,
  lights, helpers and camera are not baked into GLB. Turntable stops on viewport
  navigation. PNG export captures the current view; saved thumbnails fit the
  model and omit helper geometry.
- Output: immutable version selector, GLB and PNG downloads, Save/Save New
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
iridescence, transmission/refraction, external textures, full-color layered
traces and imported arbitrary GLB editing are unsupported. Opacity uses glTF
alpha blending and can exhibit the usual transparent-surface sorting limits.
Preview-only lighting and rotation are not model animation exports. Physical
mobile touch hardware and full desktop installers were not retested in this
phase. Cloud deployment and acceptance are pending as described above.

No commit was requested or created. Earlier phase changes and unrelated existing
README/auth/style work remain uncommitted. Phase 05 should consume immutable
`(modelAssetId, version)` identities and handle unavailable/deleted references;
it must not store signed URLs as asset identity.
