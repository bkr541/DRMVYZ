# PHASE 01 — Model Asset Domain, Supabase Tables, Storage and Security

## EXECUTE THIS PHASE IN CODE

You are Claude Code / Codex operating on the **current DRMVYZ repository**, not summarizing it. Implement this phase completely, write tests, run focused verification, and report actual outcomes. This is **Phase 1 of 7**. Read `00_MASTER_OVERVIEW.md`, then repository `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, `Universal-Code-Change-Prompt-Template.md` as applicable, and `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md`. Preserve existing media and Cinema 2.0 behavior. Do not advance into later phases.

## Goal

Create the independent user-owned **3D model asset system** that supports future generation, preview, editing, private cloud storage, versioned saves, and Cinema 2.0 reuse. The system must be functional at the data/domain layer, even before the generator UI exists. **Do not change `UploadedMedia.type` or the existing `media_items` constraint.**

## Verified existing anchors

- `src/stores/mediaStore.ts` → `UploadedMedia` is image/video and has significant upload lifecycle logic.
- `src/lib/mediaDb.ts`, `src/types/database.ts` → typed DB/storage adapters.
- `supabase/migrations/0001_initial_drmvyz_schema.sql`, `0002_storage_policies_explicit.sql` → media tables, private buckets and Storage RLS patterns.
- `supabase/migrations/0005_media_organization.sql` → `media_collections` and existing `media_collection_items` FK to `media_items`.
- `supabase/migrations/0046_cinema2_orbital_text_scenes.sql` is last migration in supplied snapshot. Use next *available* number (likely `0047_model_assets.sql`), after checking checkout.
- `src/lib/supabase.ts` → existing auth/configuration patterns. Never introduce an embedded service-role token.

## Implementation requirements

### A. Data contract

Create strongly typed, runtime-validated model records. Suggested files:

- `src/features/models/domain/modelAssetTypes.ts`
- `src/features/models/data/modelAssetRepository.ts`
- `src/features/models/data/modelAssetStorage.ts`
- `src/features/models/state/modelAssetStore.ts` (only if consistent with existing Zustand patterns)
- Extend `src/types/database.ts` or its canonical generator/schema source without unsafe global casts.

Minimum model domain:

```ts
interface ModelAsset {
  id: string
  userId: string
  sourceMediaId: string | null
  name: string
  description: string | null
  favorite: boolean
  currentVersion: number
  createdAt: string
  updatedAt: string
}
interface ModelAssetVersion {
  id: string
  modelAssetId: string
  version: number
  glbPath: string
  sourceSnapshotPath: string
  traceSvgPath: string
  thumbnailPath: string | null
  generatorRecipe: Record<string, unknown> // replace with versioned validated schema
  geometryStats: Record<string, unknown> // replace with typed validated schema
  createdAt: string
}
```

Also define a discriminated UI selection type for later work, e.g. `{kind:'media'|'track'|'font'|'model'; id:string}`, rather than forcing model data into `UploadedMedia`. Do not over-refactor current consumers in this phase.

**Recipe must be versioned** (`schemaVersion` and generator engine metadata). Plan for foreground mode, trace thresholds, depth, bevel, per-region materials, transform/pivot and preview settings. Validate unknown JSON values when reading persisted data. Future phases must be able to round-trip the recipe.

### B. Supabase migration

New **additive** migration creating:

1. `public.model_assets` with `id uuid`, non-null `user_id uuid`, nullable `source_media_id uuid references public.media_items(id) on delete set null`, `name`, optional `description`, `favorite`, `tags` (if feasible; avoid conflicting existing tags semantics), `current_version integer not null default 0`, `status` if needed, timestamps, and useful indexes.
   **Cross-owner FK guard:** a foreign key to `media_items` does not by itself guarantee that `source_media_id` belongs to the same `user_id`. Add a database-enforced owner-match check (validated write RPC / trigger) so an authenticated user cannot reference somebody else's image even if they know its ID. The collection join must likewise enforce matching owners.
2. `public.model_asset_versions` with immutable `(model_asset_id, version)` unique identity, GLB/source/trace/thumbnail Storage paths, versioned JSON recipe, geometry stats and immutable timestamps. Use an owner-checked parent association and prevent clients from changing historical records accidentally. Consider application-level immutability enforced in DB policies/trigger.
3. `public.model_collection_items` mapping model IDs to existing user-owned `public.media_collections`, with FK and RLS verifying ownership **on both sides**.
4. A **private** Supabase Storage bucket `model-assets` with explicit allowed MIME types and file-size limit. Planned objects: `{user_id}/{model_id}/{version}/model.glb`, `source.png|svg`, `trace.svg`, `thumbnail.png`. Include `model/gltf-binary`, `application/octet-stream` only if needed by real tested upload clients, plus PNG/SVG MIME.
5. Explicit Storage `SELECT`, `INSERT`, `UPDATE`, `DELETE` RLS per operation, scoped to `authenticated` and path prefix from `storage.foldername(name)[1]`. Table policies for select/insert/update/delete; do not add permissive `USING(true)` or unrestricted anonymous reads.
6. If introducing `publish_model_version` RPC or similar, use a documented transaction/compare-and-swap strategy with expected current version and verified ownership. Prevent two editors from simultaneously claiming the same next version. A `SECURITY DEFINER` function requires minimal grants, secure search path, and explicit owner check; prefer invoker patterns if adequate.

**Important:** New Storage files and DB rows cannot commit in a single SQL transaction. Design a recoverable save workflow: unique versioned paths, upload-validation-finalization steps, retry/cancel, cleanup of failed uploads, and a visible error state. Never create a 'successful' model pointing to nonexistent GLB. Do not modify applied historical migrations.

### C. Repository functionality

Implement and test:

- List/paginate/search owned models; optionally filter favorites and collection membership.
- Fetch one asset and an explicit version; retrieve immutable recipe/metadata.
- Create draft asset, save/publish version from prepared `Blob`/`ArrayBuffer`, update name/favorite/collections and delete (or deletion-pending) the model with safe file cleanup.
- Create signed URLs *on demand* for private files. Do not store signed URLs in database or saved presets. Refresh expired signed URLs on access; never leak private paths to the wrong user.
- Basic `ModelAssetRepository` interface that can be replaced with a fake for unit tests and extended for Cinema 2.0 in Phase 05.
- Support missing Supabase configuration and logged-out sessions with explicit errors; no silent successful local-only saves when the UI promises cloud persistence.
- Preserve `sourceSnapshotPath` even if the linked original `media_items` row is later deleted.

### D. Security tests

Add automated tests for serialization, recipe validation, storage path creation, race/conflict handling, delete/retry behavior, and unauthorized access error handling. Include a **manual/local Supabase SQL security test script or document** proving user A cannot SELECT/INSERT/UPDATE/DELETE user B models or use B's model storage path, and that user A cannot attach B's media or collection IDs. If local Supabase is unavailable, clearly label DB RLS tests unexecuted.

## Acceptance tests

- [ ] Additive migration applies on an existing schema without modifying image/video records.
- [ ] No model record can be fetched, mutated, stored or signed by an unrelated user.
- [ ] One model supports multiple distinct saved versions, with prior versions retrievable.
- [ ] A simulated failed GLB upload never produces a published 'ready' version.
- [ ] A simulated stale edit conflicts rather than overwriting a newer version.
- [ ] Deleted source media does not invalidate a saved model's independent source snapshot.
- [ ] Existing media store and collections tests still pass.
- [ ] Typecheck and applicable focused DB/domain tests pass; migration rollout is explicitly documented.

## Expected handoff

List exact source/migration paths, schema/table and RLS policy names, domain methods, test results, and migration application status. State what Phase 02 should import/use. **Do not claim cloud deployment if not deployed.**
