# PHASE 03 — Media Manager 3D Creation Entry, Model Library, Interactive Viewport

## EXECUTE THIS PHASE IN CODE

You are Claude Code / Codex. Implement a functional Phase **3 of 7** in the actual DRMVYZ checkout, after Phases 01 and 02 are merged and tested. Read the master overview, prior phase handoffs, `AGENTS.md` and relevant UI tests. Maintain existing Media Manager visual language, typography and three-rail proportions. Do not create a new top-level Model Manager page.

## Goal

Make users able to select **their existing images/media**, invoke the real generation engine, see resulting 3D geometry in the **center Media Manager stage**, and rotate/orbit, pan, zoom, fit and reset the viewport. Models appear in the **same Media Manager workspace** as a first-class category, without being disguised as image/video entries. This phase wires the flow and preview; the complete settings/save/edit system follows in Phase 04.

## Verified existing files / ownership

- `src/features/media/MediaManagerView.tsx`: selection state (`selectedMediaId`, track, font), `commitSelection` / `requestSelection`, pending unsaved confirmation, header buttons and 3 work areas.
- `src/components/vyzualz/media/MediaLibraryBrowser.tsx`: reused browser across contexts with `MediaLibraryFilter`, `VirtualizedMediaCards` typed to `UploadedMedia[]`, sorting and separate `context="manager"` behavior.
- `src/components/vyzualz/media/MediaManagerStage.tsx`: existing image/video/audio preview and editing, which must remain intact.
- `src/components/vyzualz/media/MediaManagerInspector.tsx`: Info/Edit/Output tabs, `MediaHeaderActions` callback.
- `src/stores/mediaStore.ts`, `src/stores/mediaEditStore.ts`: existing media edit session and guard.
- `src/components/vyzualz/media/mediaLibraryCapabilities.ts`: context-based capabilities; do not expose model creation in unrelated picker contexts.
- `src/styles/typography.css` and relevant Media Manager stylesheet: honor shared type and spacing conventions.

## Implement the user journey

### 1. Media Manager model discovery

- Add a visible **3D Models** category/filter to Media Manager only, with model thumbnail cards, names, list/grid views, search, selection, favorite and empty/loading/error states. Include saved 3D models in Manager's `All` view with a clear 3D type icon and stable ID; ordinary media pickers/decks still show images/videos only.
- Introduce `MediaManagerSelection` as a discriminated union such as `{kind:'media'|'track'|'font'|'model', id}`. Treat IDs with explicit kind even when they happen to have the same UUID representation.
- Do NOT push model records through the existing `VirtualizedMediaCards(items: UploadedMedia[])` blindly. Either create an explicitly discriminated card/item adapter or implement a parallel manager-only model card view plus a safe merge/pagination for `All` view. Address large-library performance; search/count/sort results must stay correct.
- Optionally show models in existing user collections using Phase 01's `model_collection_items`. Do not write model IDs into `media_collection_items.media_item_id`.

### 2. Creation from existing media

- On a selected image/logo/SVG in Media Manager expose **Create 3D Model** near the existing actions or source inspector; do not require reupload.
- Provide a **Create 3D Model** entry for new upload via the **existing** import path; after verified upload select the uploaded source and open creation mode.
- Use the original image bytes (authorized fetch, not a blurry thumbnail); handle expired signed URLs and missing source cleanly.
- Provide source preparation UI: alpha preview on checkerboard, SVG/hole integrity preview, foreground/background controls where relevant, VTracer trace mode (silhouette default), simplification/threshold/quality as supported by Phase 02; show actionable warnings for opaque/low-contrast images.
- Run Phase 02 generator asynchronously, show progress/cancel/repair states, then put the resulting actual mesh into the viewport. Distinguish **Draft / Unsaved** from an already saved cloud model.
- Preserve source image reference and an independent source snapshot so the model can later be edited if original media is removed.

### 3. Center visualizer viewport

Create `src/components/vyzualz/media/ModelEditorStage.tsx` (or equivalent) using Three.js inside the existing center stage via a conditional content switch. Requirements:

- Display the true generated/loaded geometry with studio lighting and shadow/background/grid preview; no fake CSS transform of a flat image.
- Mouse/touch orbit rotation, scroll/pinch zoom, pointer pan, fit selection / frame model, reset camera and an orientation indicator when appropriate. Keep intuitive camera bounds and pivot from normalized model coordinates.
- Smooth resizing (ResizeObserver), DPI handling, responsive collapse/expand, WebGL context loss/recovery, and pause/no-change rendering on hidden/inactive view to protect GPU usage.
- Support a turntable mode toggle **only** if it will not fight user rotation. Make 3D navigation explicit via on-screen icons/help text.
- Loading, no-model, invalid model, expired URL and unavailable WebGL states have user-readable outcomes.
- Dispose owned geometries, textures, controls, renderer resources and object URLs during mode switches/unmount; preserve shared resources owned by loaders.

### 4. Selection / dirty guard / navigation

- Changing from a newly generated unsaved model to image/video/track/font/model must use a real **Save / Discard / Cancel** confirmation path. Reuse the existing guard visual language, but do not mutate existing image-edit state just to fake dirty status.
- The header Save/Delete actions must follow the active selection's type; do not save or delete a different item because the inspector has a stale action handler.
- Preserve existing `MediaManagerStage` interactions (video playback, drop points, crop edit, audio preview), media filters, collection editing, upload and header actions.
- Prefer a model-specific editor session store that Phase 04 will extend; don't tie it to `UploadedMedia` editing transforms.

## Suggested file additions / modifications

**Modify:**

```text
src/features/media/MediaManagerView.tsx
src/components/vyzualz/media/MediaLibraryBrowser.tsx
src/components/vyzualz/media/MediaManagerStage.tsx
src/components/vyzualz/media/MediaManagerInspector.tsx
src/components/vyzualz/media/mediaLibraryCapabilities.ts
```

**Add (suggested):**

```text
src/components/vyzualz/media/ModelLibraryCards.tsx
src/components/vyzualz/media/ModelCreateDialog.tsx
src/components/vyzualz/media/ModelEditorStage.tsx
src/features/models/state/modelEditorStore.ts
```

Use Phase 01 repository and Phase 02 generator interfaces, not second implementations.

## Focused tests and actual browser validation

- [ ] Select previously uploaded PNG/SVG -> Create 3D -> actual mesh appears in center, with visible depth.
- [ ] New upload -> Create 3D -> actual mesh appears without a second manual upload.
- [ ] Mouse rotate, scroll zoom, pan, reset/fit all work in actual rendered browser view; model responds correctly when rails collapse or window resizes.
- [ ] Opaque JPG foreground extraction must be confirmed; no silent rectangular block without a visible warning.
- [ ] Model cards appear in Models and All, but not in React/media-deck image/video-only consumers.
- [ ] Dirty model draft prompts on selection change; Cancel restores editor; Discard switches; Save uses real persistence or is explicitly gated until Phase 04 (do not claim to have saved if not).
- [ ] Existing image crop/video player/media search and selection tests pass.
- [ ] Focused DOM tests, `npm run typecheck`, `npm run build` and meaningful Playwright/WebGL screenshot/interaction evidence recorded.

## Completion report

List changed components, screenshots/test paths, supported pointer gestures, generator route used, and any feature gated until Phase 04. Do not call the model "saved" if it only exists in memory.
