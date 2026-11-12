# DRMVYZ — User-Created 3D Models: Master Implementation Plan

**Project:** DRMVYZ / VYZUALZ / Cinema 2.0  
**Based on:** Uploaded `DRMVYZ-main (2).zip` source snapshot (November 11, 2026) and the six 3D visualization modes observed in the Photism video.  
**Purpose:** A production-oriented, sequential implementation handoff for Claude Code or Codex.  
**Scope:** Media Manager image-to-3D generation, editing, preview, Supabase persistence, and SIX independently selectable Cinema 2.0 **placeholder/reference** presets. Advanced final audio-reactive choreography, production-grade fracture simulation, full character/image-to-3D AI, and the user's final authored stage environment are **out of scope**.

## 1. End-state user journey

1. Open **Media Manager** and select an existing user-owned PNG, SVG, JPG, or WebP image (or upload via the existing media upload flow).
2. Choose **Create 3D Model**; show a shape/foreground preparation step with background/alpha confirmation when necessary.
3. Convert the image to vector paths (SVG input bypasses raster tracing), clean the contours, then extrude those contours into an actual Three.js 3D mesh.
4. Display the mesh in the existing center workspace, with orbit/rotate, zoom, pan, fit-to-view, reset, and live material/geometry updates.
5. Edit the model's depth, bevel, smoothing/trace quality, surface/color and PBR material presets, front/side material regions, lighting and background preview. Save non-destructively.
6. Persist the **source snapshot**, **trace SVG**, **GLB**, **preview PNG**, **generator/edit recipe**, **geometry stats**, and **version** in user-owned Supabase Storage and database records. Show saved models in Media Manager alongside ordinary media, with a **Models** filter; keep existing image and video workflows stable.
7. Reopen a model, adjust it, save a NEW immutable version, and access it again after restart/sign-in. The saved GLB is also downloadable.
8. In Cinema 2.0, choose any of six individual **3D Model** placeholder presets: **Form, Shatter, Dust, Hologram, Slices, Voxel**. Each preset binds a user-created 3D model via stable asset identity, uses an intentionally replaceable base stage/environment, and renders a visibly distinguishable *preview scaffold*. It is not yet a finished Photism-equivalent effect.
9. The six presets preserve Cinema 2.0's standard **Master Controls, Design, React, Palette, Effects**, shared musical event pipeline, Pattern / Pattern Change / Trigger contract, persistence and runtime lifecycle. No second audio analyzer.

## 2. Architecture decision

**Keep Media Manager. Do not add a separate top-level Model Manager.** Add a model editing context to the current three-rail Media Manager:

| Existing UI area | New responsibility |
| --- | --- |
| Left `MediaLibraryBrowser` | '3D Models' filter; create from selected source; selectable model cards, thumbnails, names, last-edited date; model-safe search / collection behavior |
| Center `MediaManagerStage` | Model editing mode with dedicated Three.js canvas, orbit navigation, fit/reset, error/empty/loading states |
| Right `MediaManagerInspector` | Model-specific Info/Edit/Output controls: trace, geometry, style/materials, lighting preview, versioning, export |
| Header / navigation | Create, Save, Save As, Delete tied to the selected asset type; a unified unsaved-changes guard |
| Cinema 2.0 | Six separate native preset declarations, sharing a user-model runtime resolver and small base 3D stage |

**Separate data domains but unified UI:** Do NOT change `UploadedMedia.type: 'image' | 'video'` into `'model'` or blindly add `model` to `media_role`. Existing media editing/decks and Supabase `media_items.type` check expect images/videos. Introduce `ModelAsset` / `ModelAssetVersion` records in new tables and compose their previews into Media Manager through an explicit discriminated selection type.

**Model asset != preset:** One `model_asset.id` (with explicit pinned version for reproducibility) can be referenced by all six Cinema 2.0 presets; the model and its edit recipe belong to Media Manager, while environment, palette, animation and model placement belong to Cinema 2.0.

## 3. Confirmed current code integration seams

These paths were verified in the supplied source. Authors must re-open the live repository before editing; do not assume this snapshot matches a newer branch.

| Existing location | Purpose / intervention |
| --- | --- |
| `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, `Universal-Code-Change-Prompt-Template.md` | Repo-wide implementation, boundaries, validation, change discipline |
| `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` | Mandatory Cinema 2.0 behavior and authoring contract |
| `src/features/media/MediaManagerView.tsx` | Three-rail layout, selection, header actions, unsaved changes guard |
| `src/components/vyzualz/media/MediaLibraryBrowser.tsx` | Media library, filters, virtualized cards; currently `UploadedMedia[]` |
| `src/components/vyzualz/media/MediaManagerStage.tsx` | Current image/video/audio display surface |
| `src/components/vyzualz/media/MediaManagerInspector.tsx` | Current Info/Edit/Output tabs and save/delete ownership |
| `src/stores/mediaStore.ts` | `UploadedMedia` and existing upload lifecycle; **do not overload** |
| `src/stores/mediaEditStore.ts` | Existing image edit session/dirty guard; integrate model dirty state separately |
| `src/lib/mediaDb.ts`, `src/types/database.ts` | Supabase media database helpers and row types |
| `supabase/migrations/0001_initial_drmvyz_schema.sql` | `media_items.type` constrained to image/video; existing private storage |
| `supabase/migrations/0002_storage_policies_explicit.sql` | Explicit per-operation Storage RLS example |
| `supabase/migrations/0005_media_organization.sql` | `media_collections`, `media_collection_items`; models need their own collection join |
| `supabase/migrations/0012_add_svg_media_role.sql` | SVG is an image role, not a model type |
| `supabase/migrations/0046_cinema2_orbital_text_scenes.sql` | Last migration in provided snapshot; use **next available** migration number |
| `src/components/vyzualz/cinema2/modules/Cinema2ThreeSceneModule.ts` | Existing Three.js scene module and shipped model instance contract |
| `src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetRegistry.ts` | Shipped models require app-origin URLs; must remain intact |
| `src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetCache.ts` | Shared decoder/cache/release contract; extend with separate user model resolver |
| `src/components/vyzualz/cinema2/modules/three/Cinema2ThreeSceneBridge.ts` | 3D scene integration seam |
| `src/components/vyzualz/cinema2/presets/Cinema2ThreeModelReferencePreset.ts` | Existing shipped-model reference example |
| `src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts` | Existing authored 3D logo scene example |
| `src/components/vyzualz/cinema2/presets/Cinema2AfterhoursPreset.ts` | Canonical 11-item trigger dropdown `CINEMA2_AFTERHOURS_TRIGGER_OPTIONS` |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetAuthoring.ts` | First-party preset authoring/contract validation |
| `src/components/vyzualz/cinema2/presets/Cinema2FirstPartyPresetCatalog.ts` | First-party preset registration |
| `src/components/vyzualz/cinema2/runtime/Cinema2WorkspacePersistence.ts` | Persist/restore workspace/preset parameters; current schema version 1 |

**Dependencies observed:** `three: 0.186.1`, `@supabase/supabase-js: ^2.106.0`, React/TypeScript/Vite/Electron. Do not introduce another WebGL engine or a new audio intelligence system.

## 4. External libraries and tooling

| Tool | Use | Important decision |
| --- | --- | --- |
| Three.js (already installed) | `ExtrudeGeometry`, PBR materials, camera, GLTFLoader/GLTFExporter, previews | Keep pinned version compatible; use existing app renderer/resource conventions |
| VTracer (`visioncortex/vtracer`, MIT) | Trace raster graphics to vector paths | Official `@visioncortex/vtracer` npm build targets **Node.js WASM**. **Do not import into the browser renderer untested**. Prove a browser-compatible WASM build OR implement a constrained Electron main/worker + supported browser fallback; document the choice. |
| SVGLoader / SVG processing | Parse vector contours, holes and fill regions | Three.js `SVGLoader.createShapes` is deprecated in current docs; verify and test API behavior against pinned Three.js before depending on it |
| Supabase (already installed) | User-owned metadata, immutable model versions, private model file bucket | New migration with authenticated row + Storage RLS, no secret keys in client |
| Existing Media Manager image cleanup | Foreground/alpha preparation and source selection | Reuse rather than duplicate. Do not guess a silhouette for opaque JPGs without preview/confirmation |
| Existing Vitest/Playwright tools | Contract, geometry, data and end-to-end tests | Add focused tests in every phase and a final real-browser run |

Upstream references (for the coding agent to consult and check at execution):
- VTracer: https://github.com/visioncortex/vtracer ; https://www.npmjs.com/package/@visioncortex/vtracer
- Three.js SVGLoader: https://threejs.org/docs/pages/SVGLoader.html
- Three.js ExtrudeGeometry: https://threejs.org/docs/pages/ExtrudeGeometry.html
- Three.js GLTFExporter: https://threejs.org/docs/pages/GLTFExporter.html
- Supabase RLS: https://supabase.com/docs/guides/storage/security/access-control
- Private buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals

## 5. Storage / model domain contract (proposed)

New Supabase tables:

- `public.model_assets`: `id`, `user_id`, optional `source_media_id` (`ON DELETE SET NULL`), `name`, `description`, `favorite`, `tags` or appropriate normalized tags, `current_version` (integer), lifecycle/status, timestamps; ownership indexes.
- `public.model_asset_versions`: immutable `(model_asset_id, version)` records containing storage paths (`glb_path`, `source_snapshot_path`, `trace_svg_path`, `thumbnail_path`), `generator_recipe jsonb`, `material_recipe jsonb` if separate, `geometry_stats jsonb`, source info, created timestamp. Guard version access through parent asset's `user_id`.
- `public.model_collection_items`: join to existing `media_collections` and `model_assets`, with RLS verifying **both** are owned by the authenticated user; do not coerce model IDs into the existing `media_collection_items.media_item_id` FK.
- New private Supabase Storage bucket `model-assets`: objects under `{auth.uid()}/{model_id}/{version}/...`, allow only the current user's prefix via explicit SELECT/INSERT/UPDATE/DELETE policies. Use real MIME types, including GLB `model/gltf-binary` (with explicitly tested fallback), SVG and PNG.

Versioning and safety:
- Persist database paths/IDs, **never expiring signed URLs**; resolve signed URLs when displaying/using an asset. A saved Cinema preset should pin `modelAssetId` + `version` by default, with explicit **Use Latest** action if implemented.
- On save: validate auth, validate inputs, prepare blobs, upload versioned objects, then publish DB version through an owner-verified compare-and-swap. On failure, clean up files / mark for reconciliation; never claim success with missing GLB. Avoid silently overwriting previous versions.
- Preserve source snapshot in model storage even if the original media item is later deleted, enabling future re-editing.
- Enforce file/pixel/dimension/triangle count budgets, sanitize SVG XML (scripts, events, external links, `foreignObject`, dangerous references), and reject malformed/oversize GLBs.
- Users must never read, modify, delete, sign, or render another user's private model by supplying its ID or path.

Suggested naming for **new** source files (may adapt to conventions, but keep interfaces stable):

```text
src/features/models/domain/modelAssetTypes.ts
src/features/models/data/modelAssetRepository.ts
src/features/models/data/modelAssetStorage.ts
src/features/models/trace/traceImage.ts
src/features/models/geometry/createExtrudedModel.ts
src/features/models/export/exportGlb.ts
src/features/models/state/modelEditorStore.ts
src/components/vyzualz/media/ModelEditorStage.tsx
src/components/vyzualz/media/ModelEditorInspector.tsx
src/components/vyzualz/cinema2/model/Cinema2UserModelResolver.ts
src/components/vyzualz/cinema2/presets/Cinema2UserModelPresetFactory.ts
```

## 6. Six Cinema 2.0 **placeholder/reference** presets

Create individual, stably named preset IDs and selectable entries, preferably in one shared factory with per-effect manifests (no copy/pasted audio analyzers or six separate render hosts):

| Preset | Initial visual scaffold | Later full effect (NOT promised in this project) |
| --- | --- | --- |
| **3D Form** | Solid uploaded mesh, PBR material, minimal transforms | Complex model deformation and authored geometry behavior |
| **3D Shatter** | Lightweight, visibly separate proxy fragment/cluster presentation | True fracture, explosion and reconstruction |
| **3D Dust** | Basic model-derived particle proxy, light audio modulation | Detailed dissolution/reassembly and particle simulations |
| **3D Hologram** | Wireframe, transparency/emission and optional scan proxy | Multi-layer volumetric scanning hologram |
| **3D Slices** | Readable section-like proxy/plane offsets | Authentic geometry slicing and rebuild |
| **3D Voxel** | Lightweight cuboid/voxel proxy inspired by model footprint | Accurate volumetric voxelization and transformations |

The user will provide the final authored environment later. Provide a replaceable base environment configuration/seam and a safe neutral fallback environment now. **Do not claim complete effect parity**; mark prototypes/reference status in the catalog and UI where compatible with app conventions.

**Important Cinema 2.0 contract tension:** The repository's preset contract requires **at least SIX real, visually distinct working Pattern options within EACH newly created first-party preset**, the three `Pattern` / `Pattern Change` / `Trigger` controls, exactly 11 shared triggers, BPM Sync, four independently effective Palette colors, and the Design inspector's four top-level groups. Therefore, placeholder does **not** mean an empty non-functional registered preset. Either (preferred) implement six modest, genuinely functional variations for each placeholder scaffold, or keep a noncompliant draft unregistered until fixed. Do not satisfy this requirement with fake dropdown options. Keep these reference presets distinct from promotion to keeper.

Use the existing shared audio-intelligence bridge and choreography/runtime target authority. In this release, implement basic tested beat/energy responsive transforms for the previews, **not** fully featured music-reactive 3D geometric choreography. Do not advertise the latter as complete.

## 7. Sequential phase files

Execute one complete phase per coding-agent session/checkpoint and carry forward its tested source changes:

1. `01_FOUNDATION_SUPABASE_AND_ASSET_DOMAIN.md` — Schema, private Storage RLS, model domain APIs, version safety, fixture tests.
2. `02_VTRACER_THREEJS_GENERATOR.md` — Image processing/vector trace, safe extrusion/materials, GLB export and engine tests.
3. `03_MEDIA_MANAGER_LIBRARY_AND_3D_VIEWPORT.md` — Library integration, Create 3D workflow, real orbitable viewport and selection safety.
4. `04_MODEL_EDITOR_AND_PERSISTENCE.md` — Live editing, materials, save/reopen/new version, thumbnails, source preservation, cleanup.
5. `05_CINEMA2_USER_MODEL_RUNTIME.md` — Dynamic private user model resolver, runtime asset slot, stable versioned preset state.
6. `06_SIX_CINEMA2_PLACEHOLDER_PRESETS.md` — Six individually selectable effect scaffolds following Cinema 2.0 contracts.
7. `07_END_TO_END_RELEASE_VALIDATION.md` — Automated/human acceptance, regression, security, packaging, migration rollout, handoff.

## 8. Universal phase execution rules

All seven phase prompts expect the coding agent to:

1. Work in the **current repository checkout**, not an archived extracted copy. Read `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` and relevant tests before editing.
2. Implement real source changes and tests. Do **not** answer merely with a plan, pseudocode, mockups, or migration suggestions.
3. Limit changes to the phase's defined scope; do not restructure unrelated UI, break existing presets, or bypass shared data/audio/rendering infrastructure.
4. Preserve existing Media Manager layout and Cinema 2.0 parameter contract. Respect Electron renderer isolation and existing bundle/package constraints.
5. Use strict TypeScript and explicit domain contracts. Never use unguarded `any`, service-role keys in the browser, arbitrary remote model URLs, or insecure unrestricted Storage policies.
6. Before saying complete, list changed files, DB migrations, tests run/results, known gaps, and whether deployment/manual verification is required. Never claim a Supabase migration deployed unless actually verified against the target project.
7. If a blocker exists (e.g. unable to run Supabase or test browser WASM), complete and test the independent pieces, clearly isolate the blocked requirement, and **do not describe the overall phase as passed**.

## 9. Definition of done (entire project)

- [ ] User selects an existing image or uploads one, generates actual 3D mesh and previews it.
- [ ] SVG holes/internal cutouts survive; transparent PNG silhouettes work; opaque images have foreground/background prep.
- [ ] Center Media Manager viewport supports rotate/orbit, pan, zoom, fit, reset and responsive resizing.
- [ ] Edits to geometry/color/finish visibly update and appear in saved/reopened GLB.
- [ ] Authenticated user saves, reopens, versions, lists, exports and deletes own 3D models; no cross-user access; collection and tags behavior is consistent.
- [ ] Private Supabase Storage + DB RLS validated; expired signed URLs refresh safely; no orphan objects after handled failures.
- [ ] Six distinct Cinema 2.0 model effect **placeholder/reference** presets exist, load the selected model and show clearly different prototype output.
- [ ] Every *registered* new Cinema preset satisfies actual preset authoring rules, including six working patterns each, all standard controls and shared trigger semantics.
- [ ] Existing Media Manager image/video use, existing Cinema 2.0 presets, save/reload, and Electron/Vite builds remain functional.
- [ ] Documentation explicitly labels placeholders and future advanced choreography as incomplete work, not shipped functionality.

## 10. Deployment distinction

This document bundle is an **implementation specification and sequential prompts**, not completed DRMVYZ code. A coding agent executing the phases still needs repo access, install/build/test tooling, and permission to deploy the SQL migration to the real Supabase project. Verify migration status separately before testing cloud save on real accounts.
