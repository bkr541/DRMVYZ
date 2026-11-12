# Model assets — Phase 01 foundation

Phase 01 implements the independent model data layer. Generation, model UI,
Cinema runtime binding and the six presets remain in phases 02–06. No model type
has been added to `UploadedMedia` or `media_items`; no UI/store consumers change.

## Entry point and ownership

`src/features/models/data/modelAssetRepository.ts` exports the production
`modelAssetRepository` and replaceable `ModelAssetRepository` interface. The
`SupabaseModelAssetRepository` constructor accepts a typed `SupabaseClient<Database>`
and configuration flag for integration tests. It uses the app's existing client
by default; no extra credentials, client casts, renderer or persistent store.
Every public operation checks configuration and the authenticated user. RLS and
RPC ownership checks enforce the same boundary on the server.

| Method | Behavior |
| --- | --- |
| `list` | Owned models, literal name search, favorites, optional collection filter, stable timestamp/UUID cursor, 1–100 rows; deletion tombstones opt-in |
| `get` / `getVersion` | Validated asset or explicit immutable version; no implicit latest version |
| `createDraft` / `update` | Owned source image association; name, description and favorite metadata |
| `setCollectionMembership` | Idempotent add/remove; separate model join, both owners checked |
| `saveVersion` | Prepared Blob/ArrayBuffer artifacts; required caller-generated operation UUID and expected current version |
| `retryPublish` | Idempotent reconciliation after a lost publish response; files must already exist |
| `cancelSave` | Reconcile publication, otherwise durably cancel and remove planned files; retry cleanup on failure |
| `listPendingOperations` | Paginated upload/cleanup recovery records for the current user |
| `delete` | Tombstone, remove files for every operation, then finalize deletion; retry on failure |
| `signedUrl` | Fetch owned explicit version and issue a fresh 300-second artifact URL; never persist URLs |

Errors use `ModelAssetError.kind`: configuration, authorization, validation,
conflict, transport, cleanup_pending. Failed saves include their operation ID
once staging has been confirmed. Before staging, the caller still retains its
input operation ID. Unknown recipes or malformed rows fail explicitly.

## Durable interchange contract

`src/features/models/domain/modelAssetTypes.ts` owns `ModelAsset`,
`ModelAssetVersion`, `ModelSaveOperation`, `ModelGeneratorRecipe`,
`ModelGeometryStats`, the `MediaManagerSelection` discriminant and runtime parsers.
Recipe schema version 1 records generator/Three versions, foreground preparation,
trace settings, extrusion/bevel, named material regions, transform/pivot and
preview settings. Unsupported schema versions are rejected rather than guessed.

Limits: 64 MiB per artifact; 250,000 triangles; 1,000,000 vertices; 1,024 meshes;
64 material regions/colors; bounded finite geometry and preview parameters.
Phase 02 must add source pixel/contour budgets and content sanitization/validation.
This layer accepts prepared artifacts and checks size and role/MIME; it does not
claim to sanitize SVG or validate GLB geometry. Inputs/outputs are reconstructed
from validated JSON, not accepted through global unsafe casts.

## Migration 0047 and access controls

`supabase/migrations/0047_model_assets.sql` adds:

- `model_assets`: independent identity, owned optional source image FK with
  `ON DELETE SET NULL`, favorite, current version, draft/ready/deletion_pending.
- `model_asset_versions`: immutable parent/version and unique operation identity,
  artifact paths, recipe, geometry metadata and creation time.
- `model_version_operations`: durable staging, published, cleanup_pending or
  cancelled state, planned source extension/thumbnail and immutable save inputs.
- `model_collection_items`: existing collection to model join, no media FK coercion.
- Private `model-assets` bucket: 64 MiB; `model/gltf-binary`, `image/png`,
  `image/svg+xml`. No octet-stream fallback without evidence it is necessary.

Table policy names: `model_assets_select`, `model_assets_insert`,
`model_assets_update`, `model_versions_select`, `model_operations_select`,
`model_collections_select`, `model_collections_insert`, `model_collections_delete`.
Version/operation mutation and asset deletion/lifecycle are RPC-only; authenticated
clients have no direct write grant for those fields/tables. Anonymous table access
is revoked. Owners may update only name, description and favorite on assets.
Tags are deferred to avoid introducing a parallel tag vocabulary in this phase.

Triggers `model_asset_owner_guard` and `model_collection_owner_guard` enforce
source image ownership and matching collection/model owners, including privileged
writes. The asset trigger also preserves identity and updates timestamps.

RPCs: `begin_model_version`, `publish_model_version`, `cancel_model_version`,
`request_model_deletion`, `finalize_model_deletion`. Security-definer functions
have empty search paths, explicit ownership checks, and authenticated-only execute
grants. Internal lock/path/trigger helpers have no client execute grants.

Storage policies: `model_storage_select`, `model_storage_insert`,
`model_storage_update`, `model_storage_delete`. Each checks bucket and authenticated
user prefix. Writes additionally use `model_storage_write_allowed` to check the
exact planned artifact and lock its owned asset/operation against publication,
cancellation and deletion. Published objects cannot be overwritten, moved or
rollback-deleted by their owner; deletion is allowed after the model is tombstoned.

## Save and recovery protocol

Paths are `{userId}/{modelId}/{version}/{operationId}/{artifact}`. The extra
operation directory isolates two editors proposing the same next version.

1. Validate recipe, geometry stats and prepared artifact budgets/MIME.
2. `begin_model_version` locks the owned asset, checks expected current version,
   and durably records the exact operation and recipe before any uploads.
3. Upload without upsert. Source snapshots are normalized PNG or sanitized SVG;
   the original media object is never the saved model's editable source of truth.
4. `publish_model_version` locks asset then operation, checks every required
   Storage object's existence, nonempty bounded size and MIME, then atomically
   inserts the version and advances the parent. Stale editors receive a conflict.
5. On failure, cancellation first reconciles whether publication committed.
   Published operations return their existing version and are never cleaned up.
   Otherwise cancellation disables new uploads before removing all planned paths.
   Interrupted cleanup stays recoverable in the operations table.

Keep the operation UUID when a response is lost. Use `retryPublish` if all uploads
completed, or `cancelSave` to abandon/clean up. After cancellation, retry the save
with a new operation UUID. Do not run two upload loops for the same operation.
Deletion first blocks new saves/uploads, removes all known attempt/version paths,
and finalizes only after the database confirms no Storage objects remain.
A failed deletion remains visible via `list({includeDeletionPending:true})`.
No background cleanup worker or UI recovery surface is introduced in Phase 01.

## Validation and deployment status

Local evidence:

- Full TypeScript check and focused ESLint pass. All 52 existing media workflow,
  atomic DB, pagination and collection editor tests pass. The existing jsdom
  canvas-not-implemented diagnostic is non-fatal; the workflow test passes.
- 27 domain/repository tests: complete recipe round-trip and invalid JSON; owned
  path identity; geometry/file budgets; successive versions; competing saves;
  upload failure; cleanup retry; lost publish response; account rejection;
  source deletion; fresh signing; query pagination; metadata/collections.
- Repository tests invoke the production repository through the real Supabase JS
  SDK with HTTP doubles. They simulate server responses; they do not prove RLS.
- `supabase/tests/model_assets_security.sql` applied and passed in PGlite using
  stubbed Supabase auth/storage schemas, roles, default grants and `auth.uid()`.
  It exercises the actual migration SQL and RLS: cross-user CRUD and RPC denial,
  source/collection guards, private object access, immutable versions/files,
  missing-file publication, CAS conflict, publish/cancel retries, PNG/SVG sources,
  thumbnails, source deletion and deletion finalization. Fixtures roll back.
- Actual Supabase migration application, Storage API uploads/MIME handling and
  signing with real JWTs remain unexecuted. The local Supabase CLI status probe
  failed on a sandbox-denied telemetry write; no target project was modified.
- PGlite is single-connection evidence, not proof of concurrent transactions or
  full compatibility with the deployed Supabase schemas/Storage service.

Focused verification commands (from repository root):

```sh
npx vitest run src/features/models/domain/modelAssetTypes.test.ts src/features/models/data/modelAssetRepository.test.ts
npx vitest run src/stores/mediaManagerWorkflows.test.ts src/lib/mediaDbAtomic.test.ts src/lib/mediaDbPagination.test.ts src/components/vyzualz/media/CollectionEditorModal.test.tsx
npx eslint src/features/models src/types/database.ts
npm run typecheck
```

Before accepting the cloud gate, inspect pending migrations on the intended test
project, apply 0047 through the normal migration process, then run on a disposable
Supabase database with all preceding migrations:

```sh
psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/model_assets_security.sql
```

Through the real Storage API, repeat with two authenticated test accounts: A must
not download/sign/overwrite/delete B's artifacts or attach B's source/collection;
upload actual GLB, PNG and sanitized SVG artifacts with the exact MIME types;
check missing files cannot publish; publish two versions; reject a stale save;
refresh signing after expiry; simulate partial upload/deletion and retry cleanup.
Use two client connections to verify simultaneous CAS and late upload/cancel
behavior. A previously issued signed URL remains a bearer URL until expiry.
Do not treat Phase 01's cloud acceptance gate as passed until these checks run.

## Phase 02 handoff

Import the recipe/stats types and parsers from `domain/modelAssetTypes`, and
`modelAssetRepository` from `data/modelAssetRepository`. Create a draft, generate
prepared GLB/source/trace/optional thumbnail artifacts, and call `saveVersion`
with the draft's currentVersion and a new UUID. Preserve exact saved version
identity for later Cinema bindings. Generation and SVG/GLB content validation
remain Phase 02 work; no generator or model viewport ships in this checkpoint.

## Changed file manifest

- `src/features/models/domain/modelAssetTypes.ts`: validated domain and recipe contracts.
- `src/features/models/domain/modelAssetTypes.test.ts`: serialization and validation cases.
- `src/features/models/data/modelAssetStorage.ts`: prepared uploads, cleanup and signing.
- `src/features/models/data/modelAssetRepository.ts`: production model persistence API.
- `src/features/models/data/modelAssetRepository.test.ts`: SDK-boundary lifecycle tests.
- `src/features/models/__tests__/modelAssetFixtures.ts`: shared test records and recipes.
- `src/types/database.ts`: typed model tables and RPCs.
- `supabase/migrations/0047_model_assets.sql`: additive schema, bucket, RLS and RPCs.
- `supabase/tests/model_assets_security.sql`: transactional SQL security/lifecycle checks.
- `docs/model-assets-phase01.md`: API, recovery, deployment and next-phase handoff.
- `docs/supabase-schema.md`: model schema and private bucket reference.
- `docs/documentation-index.md`: current subsystem documentation registration.

No commit was requested or created. Existing unrelated README/auth/style edits
were left untouched. No dependency or lockfile changes were made.
