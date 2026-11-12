# Model migrations and live account acceptance

The owner reports migrations **0047/0048 already pushed**. This phase did not
reapply them, create real users, or independently verify the linked cloud
project. The owner will test using their existing account.

## Schema and rollout

For another environment, first reconcile its migration history with this
repository. Apply only missing migrations, in order, through the project's
normal Supabase deployment process. Do not replay the historical migration set.

1. `supabase/migrations/0047_model_assets.sql` creates `model_assets`, immutable
   `model_asset_versions`, `model_version_operations`, `model_collection_items`,
   the private `model-assets` bucket and its owner-scoped Storage policies. Its
   RPCs reserve, publish, cancel and delete versions with expected-version checks.
2. `supabase/migrations/0048_model_organization.sql` adds `model_asset_tags` and
   owner-checked organization/metadata RPCs. It requires the earlier media tags
   and collections schema.

Use the SQL Editor for missing migration files or the already linked project's
normal migration CLI workflow. The migrations configure the bucket themselves;
do not create a public bucket or add a permissive Storage policy in the dashboard.
The renderer needs the existing Supabase URL and public anon/publishable key,
with the user's authenticated session. It never needs a service-role key.

After deployment, execute `supabase/tests/model_release_preflight.sql` as the
database owner in the SQL Editor. It runs in a read-only transaction and checks
table RLS, bucket configuration, policy presence and RPC/table privileges. It
creates no users or data. Passing this catalog preflight is not proof of live
Storage API behavior or cross-account isolation.

Check the dashboard for a **private** `model-assets` bucket, a **67,108,864-byte**
file limit and GLB/PNG/SVG MIME allowances. Object paths and permissions are
reserved by the model repository; arbitrary uploads into published version paths
are deliberately rejected.

## Executed local security checks

`scripts/model-assets/verify-sql-fixture.mjs` applies the actual migrations and
runs the preflight plus `model_assets_security.sql` and
`model_organization_security.sql` in disposable PGlite PostgreSQL. It accepts an
existing PGlite module via `DRMVYZ_MODEL_PGLITE_MODULE`; PGlite is not a production
dependency. The fixture supplies minimal Supabase-shaped auth, media and Storage
tables. Its synthetic identities are transaction-local database rows, not real
Supabase accounts. These scripts cover ownership, immutable versions, conflicts,
organization isolation and staged cleanup. They do not exercise the GoTrue,
PostgREST or Storage HTTP services, or a complete copy of the deployed schema.

Do not run the data-mutating security fixtures against the owner's live project.
Full live two-account isolation remains unverified because no additional accounts
are to be created for this implementation.

## Owner's acceptance session

1. Sign in with your existing account. Generate a transparent PNG and an SVG in
   Media Manager; check interior holes, orbit, pan, zoom, fit/reset and rail resize.
   Try an opaque JPG and confirm its prepared foreground.
2. Change depth/bevel and front/side materials, name, tags and collections. Save.
   In the dashboard verify the published version references all four private
   objects: GLB, normalized source snapshot, trace SVG and PNG thumbnail.
3. Reload and sign out/in. Reopen the same asset; verify its recipe and metadata.
   Save another version, reopen both versions and download the GLB. Test Save As.
4. Open all six Cinema Preview presets. Select the model/version, change Pattern
   and Palette, save the workspace and reload. Play your music and verify the
   shared triggers and BPM Sync. Return to Media Manager and check image/video
   editing, crop, drag/drop and track preview.
5. Delete an original image only when you intend to remove it; verify its saved
   model remains editable. To test missing-model fallback, use a model copy you
   intend to delete. Confirm the Cinema scene falls back with a readable message.
6. Report any failing action and its error. Network interruption, actual signed
   URL expiry, concurrent saves and cross-account Storage attacks still need
   service-level acceptance; local coverage does not replace those checks.

## Recovery and rollback

Keep the migrations additive. If the feature needs to be withdrawn, roll the
application back while retaining private model tables, bucket and saved files.
Do not drop the bucket or revert model tables with user data present. There is no
automated destructive down migration. A schema/data removal requires a separate,
reviewed export and cleanup plan. The repository's cancel/delete operations keep
failed cleanup paths durable and permit retries; inspect pending operations
instead of manually deleting objects referenced by published versions.

The release report is [model-release-phase07.md](model-release-phase07.md).
