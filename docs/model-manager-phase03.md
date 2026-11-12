# Media Manager models — Phase 03

Phase 03 integrates the Phase 01 model repository and Phase 02 generator into the
existing Media Manager. It adds model discovery, source preparation, real 3D
preview and independent draft/navigation ownership. Full model editing, saving,
version-management UI and deletion remain Phase 04. No SQL migration or dependency
is introduced by this phase. Earlier cloud deployment gates remain pending.

## User workflow

Select a successfully uploaded image and choose **Create 3D Model**, or choose
**Import Image for 3D** to use the existing upload dialog. The upload callback
matches completed canonical records to the queue's operation IDs, including
reconciled uploads; unrelated library arrivals cannot become the source.
The source loader fetches original bytes through the existing signed-media path,
refreshes an expired URL once and never substitutes a thumbnail.

The right rail exposes a checkerboard foreground/cutout preview, alpha/threshold
preparation, inversion, silhouette tracing, smoothing and Draft/Normal/High quality.
Opaque raster preparation requires explicit confirmation. Generation is disabled
until the current preview is prepared. Loading/generation can be cancelled, errors
are inline and retryable, and stale async results are discarded and disposed.
The generator is the real `createModelArtifact` API from Phase 02.

The stage displays **Draft / Unsaved** for generated models. Saved models load an
explicit published version through fresh private signed URLs. Persisted draft
records without GLB versions are labeled accordingly and show an actionable error.
Model Save/Delete header actions are disabled and explain that those operations
are not available yet. No save is simulated and no model draft is put in local
storage or `UploadedMedia`.

## Library behavior and performance

Only manager context with the `models` capability and model selection callback
can browse models. Models appear in **3D Models**, **All Visuals** and **Favorites**;
React, CANVAS and deck image/video consumers retain their existing type boundaries.
Model cards support grid/list, name search, selection, private thumbnails, favorite
updates and explicit loading/empty/error/retry states. Missing thumbnails use a
model/type fallback. Active in-memory drafts are identified as unsaved.

All/Favorites use two explicitly labeled sections: **3D Models** and
**Images & Videos**, each newest-first with independent server pagination. There
is no misleading global interleaved order or invented total count: models report
loaded count and `+` when more pages exist. Model pages are bounded at 50 rows,
virtualized using the extracted shared media-window calculation, and fetched with
stable server cursors via Load More. Only mounted thumbnails are signed. Search
and account identity guard async responses; stale responses cannot replace the
current query. Image virtualization accounts for the model section's scroll offset.
Model IDs never enter image collection FKs or media-only card adapters. Model
collection browsing remains deferred; existing image/video collections are unchanged.

## Viewport and lifetime

`ModelEditorStage` is lazy-loaded into the existing center rail. It owns a Three.js
renderer, studio environment, directional/hemisphere lights, shadows, grid, world
axes and OrbitControls. It borrows the session model group; the editor store owns
and disposes that group's geometry/materials. The viewport cleans up its own
renderer/context, controls, observers, PMREM environment, shadow target, grid,
floor and axes. Preview Blob URLs are revoked on replacement/unmount.

Gestures: left drag/one finger orbit; right drag/two fingers pan; wheel/pinch zoom.
**Fit model** and **Reset camera** frame the model around its actual bounds/pivot.
ResizeObserver follows rail/window changes, DPI is capped at 2, and rendering is
requested on changes rather than through a continuous animation loop. Hidden or
non-intersecting views suppress drawing. Context-loss events show an inline notice;
restoration rebuilds the studio environment and redraws. Retry remounts a failed
viewport. No turntable mode competes with manual navigation.

## Selection and draft safety

`MediaManagerView` now owns the explicit `{kind,id}` discriminant for media, track,
font and model. Same-looking IDs from different domains do not share selection or
header actions. Header callbacks are scoped to the selection identity so a stale
image inspector cannot save/delete an active model.

`useModelEditorStore` owns source bytes, recipe, generation/loaded group, GLB artifact,
preview, confirmation, cancellation and dirty state. It never modifies image-edit
state to represent model changes. The independent snapshot survives removal of the
original library item. Both selection changes and app-workspace navigation use the
canonical confirmation dialog: Cancel retains the draft; Discard disposes it and
continues; Save is explicitly gated. Closing/reloading also guards unsaved work.
Account changes clear pending navigation and the editor session.

Critical viewport, source and model-library notices use the existing inline
`NoticeCard`. `DrawerNotice` would route those states into a closed notification
drawer inside the real page provider, obscuring recovery. Existing unrelated
notification behavior is unchanged. New controls reuse shared typography and
control components, including portaled dropdowns.

## Validation evidence

- **125 relevant tests passed across focused runs**, including 21 new model/store,
  model selection/guard, paging/favorite/search and verified-upload cases. Existing
  image crop/video stage, inspector, media library, font upload and image navigation
  checks are included. Full typechecking via `npm run build`, production build and
  focused ESLint pass under Node 22.23.3.
- Three existing stale assertions were reproduced against original Git source in
  an isolated Vite test config, then excluded from subsequent focused runs:
  `MediaLibraryBrowser.test.tsx` audio-loading tests expect `addTrackUrls` without
  the existing `{notifyOnBlocked:false}` argument; the lyric navigation test in
  `VyzualzViewMediaGuard.test.tsx` expects no `.dv-confirm-dialog` even though the
  existing lyric guard now uses that canonical dialog. These failures are not
  introduced by model integration and were left unchanged.
- `scripts/model-assets/verify-manager.mjs` mounts the real workspace, store,
  source inspector, generator, viewport, library and upload dialog in Chromium
  with WebGL/SwiftShader. External cloud services are fixture-backed; the real
  generation engine, canvas decoder, worker, OrbitControls and renderers execute.
- Browser coverage: SVG/PNG creation and depth/cutout screenshots, saved-model
  identity collision with an image ID, model category/list/search/favorites,
  orbit/zoom/pan/reset, rail resize, model Cancel/Discard and app navigation,
  opaque JPEG confirmation, the existing upload queue/dialog handoff, actual
  context loss/restoration and portaled option-text typography.
- Artifacts: `artifacts/model-manager-phase03/result.json` and screenshots
  `00-all-library.png`, `01-svg-model.png`, `02-collapsed-model.png`,
  `03-png-model.png`, `04-foreground-confirmation.png`, `05-upload-model.png`,
  `06-control-typography.png`. The result file is the browser-run outcome.
- Real signed cloud reads/writes still require applying and validating Phase 01's
  migration against the intended Supabase project. No deployment was attempted.
  Physical touch hardware and a packaged full-app installer were not tested in
  this phase; touch bindings use OrbitControls' standard controls.

```sh
node scripts/model-assets/verify-manager.mjs
npm run build
```

The browser script supplies only local cloud-service fixtures and writes evidence
under artifacts; it does not upload to a real account. The production UI uses the
actual Phase 01 repository and existing upload/signing APIs.

## Changed files and Phase 04 handoff

New: `ModelLibraryCards.tsx` and its test; `ModelCreateInspector.tsx`;
`ModelEditorStage.tsx`; `UnsavedModelChangesDialog.tsx`; `mediaLibraryWindow.ts`
under `src/components/vyzualz/media`; `src/features/models/state/modelEditorStore.ts`
and its tests; `src/features/models/data/loadModelPreview.ts`;
`src/features/media/MediaManagerModels.test.tsx`; the browser verification script.

Modified: `MediaManagerView.tsx` and its header test; `MediaLibraryBrowser.tsx`;
`mediaLibraryCapabilities.ts`; `MediaUploadModal.tsx` and its completion test;
`VyzualzView.tsx` and its navigation test; `src/styles/mediaManager.css`;
shared roles in `src/styles/typography.css`; the current documentation index.
The existing unrelated README/auth/style edits and earlier phase changes remain.
No commit was requested or created.

Phase 04 should extend `useModelEditorStore` and `ModelCreateInspector` instead of
creating another editor. The current artifact's `files`, `recipe` and `stats` are
ready for Phase 01's prepared save API. Recipe changes can leave the prior model
visible until regeneration; a future Save must ensure artifact and edited recipe
agree. Preserve snapshots even when `sourceMediaId` is no longer a live media row.
Only enable Save/Discard-and-Save navigation after actual persistence succeeds.
