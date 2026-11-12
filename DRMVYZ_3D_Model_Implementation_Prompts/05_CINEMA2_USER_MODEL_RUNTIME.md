# PHASE 05 — Cinema 2.0 Private User Model Loading and Preset Binding

## EXECUTE THIS PHASE IN CODE

You are Claude Code / Codex implementing **Phase 5 of 7** in the current DRMVYZ repository. First read `00_MASTER_OVERVIEW.md`, completed Phase 01–04 handoffs, `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, and the full `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`. This phase builds safe **model loading and binding infrastructure** only; Phase 06 will register the six individual placeholder presets. Do not rewrite existing Cinema 2.0 rendering or create a second audio intelligence engine.

## Goal

Allow a Cinema 2.0 native preset to select an authenticated user's saved **GLB model** by `modelAssetId + immutable version`, load it into a stable 3D scene environment and render it using existing Cinema 2.0 Three.js infrastructure. Switching models must preserve environment/camera/control state and release old GPU resources correctly.

## Verified source integration anchors

```text
src/components/vyzualz/cinema2/modules/Cinema2ThreeSceneModule.ts
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetRegistry.ts
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetCache.ts
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeSceneBridge.ts
src/components/vyzualz/cinema2/modules/three/Cinema2ThreeResourceLedger.ts
src/components/vyzualz/cinema2/presets/Cinema2ThreeModelReferencePreset.ts
src/components/vyzualz/cinema2/presets/Cinema2GoToPreset.ts
src/components/vyzualz/cinema2/runtime/Cinema2WorkspacePersistence.ts
src/components/vyzualz/cinema2/media/Cinema2MediaSlotRuntime.ts
src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts
src/components/vyzualz/cinema2/parameters/Cinema2ParameterSchema.ts
```

**Important discoveries:** `Cinema2ThreeAssetRegistry` currently restricts shipped asset URLs to app-origin paths starting with `/`; its existing cache loads **shipped assets**. The existing `Cinema2MediaKind` / `Cinema2MediaSlotRuntime` handle `image | video | svg`, **not** glTF model scenes. Do not bypass the registry with arbitrary signed external URLs, and do not pretend a GLB is an image media slot.

## 1. User model resolver and loading contract

Introduce dedicated, testable resolver/adaptor modules, e.g.:

```text
src/components/vyzualz/cinema2/model/Cinema2UserModelResolver.ts
src/components/vyzualz/cinema2/model/Cinema2UserModelCache.ts
src/components/vyzualz/cinema2/model/Cinema2ModelBinding.ts
src/components/vyzualz/cinema2/model/Cinema2ModelPlaceholder.ts
```

Implement:

- Typed binding `UserModelBinding = { kind: 'user-model'; modelAssetId: string; version: number } | { kind: 'default-model' }`. Add optional explicit **Use Latest** semantics only if tested and clearly documented; default to pinned version for reproducible shows.
- Resolver asks Phase 01 data service for an authorized version, receives its storage path, and uses a fresh signed URL or authenticated binary fetch. Prefer parsing an `ArrayBuffer` with the existing GLTFLoader decoder infrastructure so private storage authentication and cross-origin behavior are controlled; **never store signed URL in persisted scene/preset JSON**.
- Cache key `{userId, modelAssetId, version}` (plus quality tier if variants) rather than signed URL. Preserve cloned instance ownership and reference-counted disposal equivalent to existing shipped asset cache.
- Validate GLB MIME and byte length, reject unsupported external URLs/dependencies, malformed assets and excessive triangles/textures before full live-stage attachment. Expose `loading`, `ready`, `error`, `missing`, `unauthorized` states.
- Abort/ignore stale async loads when users switch quickly; release temporary buffers and previous GPU resources. On failure, keep the last valid model if safe or show a neutral placeholder with an informative warning.
- Normalize models into a standard size/center/orientation using saved model metadata, preserving per-preset transforms and scene placement. A different-looking logo should not suddenly move off-camera.
- Ensure renderer WebGL context loss/recovery rebinds the same model ID and version. No hard-coded remote URL and no changes to shipped model license records.

## 2. Integrate with existing `three-scene` ownership

- Add a **dynamic user-model instance/slot** in existing Three.js scene path, not a second canvas overlaid on Cinema 2.0.
- Keep authored environment geometry, lights, atmosphere, camera, render passes and palette bindings independent of selected user model.
- Reuse `Cinema2ThreeSceneModule` / `Cinema2ThreeSceneBridge` render/resource lifecycle; minimal, backwards-compatible extensions (prefer new adaptor injected into existing module). Keep current `config.instances` semantics for shipped static models and existing tests intact.
- Allow one dynamic model per placeholder preset initially. Bound version changes must update only the model subtree; avoid reloading entire preset/environment to change one logo.
- Model-owned material colors can either be preserved or overridden from Cinema Palette, with an explicit documented default and reset strategy; no accidental destruction of saved GLB material data.

## 3. Cinema inspector model selection

- Place **Model** selector under `Design > Design` in the native preset inspector. Source records come from Phase 01 model asset library; show thumbnail/name/version and current selection, search and an empty state linking to Media Manager creation.
- Prefer a generic schema-driven selector extension using existing `Cinema2ParameterManifest.metadata` (e.g. `metadata: { editor: 'user-model-selector' }`) or a small dedicated companion binding. Keep the shared inspector generic and **do not special-case six preset names**. Avoid broad schema engine changes where an existing typed `string` parameter + validated binding is enough.
- Persist `modelAssetId` and version as canonical preset parameter/binding state. Handle missing user asset at restore, deleted model, revoked permission and stale ID without corrupting workspace document.
- Validate chosen model ownership before loading, not merely by hiding unauthorized models from dropdown.
- Do not conflate Cinema 2.0 `media` parameter (2D texture media slot) with a model binding.

## 4. Base environment seam

The user will supply a custom base 3D stage later. Create a small **neutral** environment with default lighting, camera, floor/background and focal transform, with a clearly documented insertion hook/asset-config module so the authored environment can replace it without touching model binding, generated assets or the six effect declarations.

Suggested:

```text
src/components/vyzualz/cinema2/model/Cinema2UserModelBaseEnvironment.ts
```

Use an authored configuration, not hard-coded magic scene fragments repeated across presets. The neutral environment must render a safe built-in model placeholder before a user asset is selected.

## 5. Integration tests

- Unit test authorized user-owned GLB load (mock signed/binary fetch), GLTFLoader parse and successful scene attachment.
- Test unauthorized/missing/deleted/invalid/expired signed URL cases with user-facing error status and no crash.
- Test model switch A→B→A while holding environment constant; ensure no old model remains and no memory/resource count drift.
- Test two presets referencing the same model version and resource reference counting; releasing one must not break the other.
- Test restore of saved model binding after reload/seek/preset reentry; pinned version must remain pinned when a newer model version exists.
- Test existing shipped `Cinema2ThreeAssetRegistry`, `Cinema2ThreeAssetCache`, scene modules and legacy native presets to confirm zero regression.
- Run `npm run typecheck`, focused module tests and build. Include a real WebGL render test where supported.

## Acceptance gate

- [ ] A new **test native scene/reference harness** can resolve and display a saved private user GLB using actual Cinema 2.0 stage renderer.
- [ ] Switch model without resetting atmosphere, camera or environment.
- [ ] Saved selection survives workspace persistence and recreates same pinned version.
- [ ] Bad/unauthorized/missing assets fall back safely with explicit diagnostics.
- [ ] Model load and cleanup stay inside shared Cinema 2.0 lifecycle and context-loss recovery.
- [ ] Existing shipped-asset registry rules and previous presets remain intact.

## Completion report

List changed runtime source files, model selection parameter strategy, persistence compatibility decision (schema increment only if proven necessary), model replacement/memory test results, and any blockers Phase 06 must respect. Do **not** promote the harness to a keeper preset or claim six effects are implemented here.
