# Preset Store: Phase 01 database schema and access policies

Phase 01, 2026-10-29, simplified the same day. Migration `supabase/migrations/0043_preset_store_marketplace_schema.sql`. Additive only: nothing in `presets`, `user_presets`, `preset_organization` or any earlier migration is altered, and the store never writes to `user_presets`.

**Scope change.** The first draft of 0043 also contained orders, prices, payment events, refund/dispute functions, immutable pack editions and a `user_presets` projection. All of that was removed on purpose: 0043 is now the free-only core (catalog, releases, free claims, favourites). Commerce arrives in a later migration, after the payment provider, refund policy and tax decisions in [OPEN_DECISIONS](OPEN_DECISIONS.md) are made. [PHASE_00_AUDIT](PHASE_00_AUDIT.md) still describes the larger blueprint; where they differ, this file is current.

## Status

| Gate | State |
| --- | --- |
| Migration, regression SQL, fixtures, rollback script, this document | Written. |
| Applied and tested on an **authorized local/test Supabase instance** | **Not done.** No Docker, `psql` or local Postgres exists on this machine and no instance was authorized. Phase 01 is **prepared, not accepted**. |
| Stand-in verification | Done on PGlite (real Postgres compiled to WASM, in memory) with a stub of the Supabase roles, `auth.uid()` and default privileges. It proves the SQL is valid and the policy logic behaves; it is not the Supabase stack. |
| Production | Nothing applied, linked or deployed. 0043 has not been applied anywhere, so it can still be edited in place. After it is applied anywhere, a change is a new migration. |

## Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/0043_preset_store_marketplace_schema.sql` | Tables, constraints, triggers, server functions, privileges and RLS. Re-runnable (`IF NOT EXISTS`, `OR REPLACE`, `DROP POLICY IF EXISTS`). |
| `supabase/tests/preset_store_schema_regression.sql` | 171 checks in one transaction that ends in `ROLLBACK`: privileges, RLS per role, constraints, release immutability, packs, products, free claims and revocation, the "`user_presets` is never written" rule, the favourite RPC. Also checks the fixtures when loaded. |
| `supabase/tests/preset_store_preservation_snapshot.sql` | Read-only fingerprint of `presets`, `user_presets`, `preset_organization` for before/after comparison. |
| `supabase/fixtures/preset_store_local_seed.sql` | Local/test catalog fixtures only: one free pack, one standalone free product, one overlapping standalone product. No grants or holdings. Opt-in and guarded. |
| `supabase/rollback/0043_preset_store_marketplace_schema.rollback.sql` | Guarded, non-automatic rollback for a disposable database. Lives outside `migrations/`. |

No client or Edge Function code changed, and `src/types/database.ts` was not regenerated: nothing consumes the new tables yet. Regenerate types when the service phase starts.

## Relationships

```
presets (0034, unchanged) ──┬────────────────────────────────────────┐
  id, engine_id, preset_key │ 1                                       │
                            ▼ *                                       │
preset_releases ◄──(id,preset_id)── preset_pack_items ──► preset_packs
  immutable content          │        pack_id, preset_id,        a named list
  hash, signing key, paths   │        release_id, position
        │ 1                  │                                      │ 1
        ▼ 1                  │                                      ▼ 1
preset_release_publications  │            store_products ◄── exactly one of preset_id | pack_id
  draft | published |        │             free for now             │ 1
  withdrawn (mutable)        │                  ▲                   ▼ *
                             └──────────────────┼────── preset_entitlement_grants ──► profiles (0001)
                                  current_release_id    (user, preset, release, product), revocable

user_preset_preferences  (own favourites; independent of everything above)
user_presets (0034)      untouched: legacy holdings, still read by the app
```

## Rules the schema enforces

**Identity.** `presets.id` stays canonical; `(engine_id, preset_key)` stays its natural key. A product points at a `presets` row. A preset has at most one standalone product and a pack at most one product. A listed or granted release must belong to the preset it is listed for (composite foreign keys on `(release_id, preset_id)`).

**Store presets are private.** A release can only be created for a preset with `scope = 'user'`. A `system` preset is shown to every account under SYSTEM and must never be sold or claimed. The publisher creates the `presets` row as `user`.

**Releases are immutable.** A `preset_releases` row cannot be updated, and cannot be deleted once it was ever published. Publication state is a separate row (`draft → published → withdrawn`, and withdrawn can be published again; never back to draft). Each release records its `format_version` and `signing_key_id` (they cannot be added to old rows later because rows are immutable). Manifest hashes are 64-char lowercase hex, versions are semver-shaped, storage paths cannot be absolute or contain `..`.

**Packs.** A pack is a named, ordered list of `(preset, release)` (at most 200). The list can change over time. Publishing a pack product needs at least one item and every item's release published.

**Free claims.** `claim_free_store_product(user, product)` (service role only) checks the product is published and free, then writes one grant per deliverable preset, pinned to the release delivered at that moment: the product's current release for a standalone product, each item's release for a pack. It is all-or-nothing (one unpublished release stops the claim and writes nothing) and idempotent: a repeat inserts nothing. A grant that was revoked is not revived by a repeat claim. A preset added to a pack later is not granted automatically; a repeat claim of the pack picks up only what is new, and earlier grants keep their release.

**Grants.** One row per `(user, product, preset)`. After insert only `revoked_at` / `revoked_reason` can change, and a revoked grant cannot be restored. A preset can be held through several active grants at once (a standalone claim and a pack claim); `revoke_free_store_claim(user, product, reason)` revokes only that product's grants. Effective entitlement is *any* active grant. The only source today is `free_claim`; paid sources need their own migration.

**Holdings.** `user_presets` is never written by the store. The app treats a preset as held when the user has a `user_presets` row **or** an active grant. Legacy holdings (0036, 0040, 0041, hand-recorded) are therefore untouched and need no marker. Reading code that decides "is this preset held" must check both; that change belongs to the service/library phases.

**Price policy.** Every product is `free` (the only value the constraint allows). There are no price, order or payment tables yet.

**Favourites.** The durable source is `user_preset_preferences (user_id, preset_id, is_favorite)`, valid for presets the user holds no row for. Read precedence: the explicit preference row, else the holding's `is_favorite`, else false. The only client write that sets it is `set_preset_favorite(preset_id, flag)`: it uses `auth.uid()`, upserts the preference, never grants anything and never touches `user_presets`. Clients may also write their own preference rows (flag only). Tags and collections stay in `preset_organization`; installed state is device-local and has no table.

## Privilege and RLS matrix

R = SELECT of the stated rows and columns. Dash = no privilege (REVOKEd; RLS adds a second wall). Supabase's default privileges grant new tables to `anon`/`authenticated`; the migration revokes them first, then grants back only what is listed. The service role bypasses RLS.

| Resource | anon | authenticated user A | A reading B's rows | service role |
| --- | --- | --- | --- | --- |
| `store_products` (all columns) | R `published` | R `published`, plus `archived` ones A holds a grant from | same rule, B's grants don't count | R/W |
| `preset_packs`, `preset_pack_items` | R while a published product lists the pack | same | same | R/W |
| `preset_release_publications` | R `published` rows | same | same | R/W |
| `preset_releases` | R columns `id, preset_id, version, min_app_version, created_at` of published releases. No hash, signing key, size, path, prefix, digest, license | same | same | R/W (immutable) |
| `preset_entitlement_grants` | — | R own rows, columns `id, user_id, preset_id, release_id, source_kind, product_id, granted_at, revoked_at` (no `revoked_reason`); no write | — | R/W via the functions below |
| `user_preset_preferences` | — | R/insert/delete own; UPDATE of `is_favorite` only | — | R/W |
| `presets` (0034/0035) | existing policy, unchanged | R | R | existing |
| `user_presets` (0034) | — | own R, no client write (unchanged) | — | not written by the store |
| `preset_organization` (0039) | — | own CRUD (unchanged) | — | existing |

| Function | anon | authenticated | service role |
| --- | --- | --- | --- |
| `set_preset_favorite(uuid, boolean)` | — | EXECUTE | EXECUTE |
| `claim_free_store_product(uuid, uuid)`, `revoke_free_store_claim(uuid, uuid, text)` | — | — | EXECUTE |

The claim and revoke functions are `SECURITY DEFINER` with `search_path = public, pg_temp`. Because the client cannot read `preset_releases` paths at all, a later download gateway must authorize against an active grant and sign access itself; there is no client path to release content.

Client note: `select *` on `preset_releases` and `preset_entitlement_grants` is denied by design. Name the columns that are granted.

## Running it on an authorized local/test instance

Only against a disposable database you have explicitly authorized. Never against a linked or production project. Prerequisites: Docker, the Supabase CLI and `psql` (none are on this machine today).

```bash
supabase start                                  # local stack; note the DB URL, e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres
export LOCAL_TEST_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# 1. Fresh database with every migration through 0043 (local reset only; this deletes the local data)
supabase db reset

# 2. Fingerprint the legacy tables, then confirm a re-run of 0043 changes nothing
psql "$LOCAL_TEST_DB_URL" -At -f supabase/tests/preset_store_preservation_snapshot.sql > /tmp/before.txt
psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0043_preset_store_marketplace_schema.sql
psql "$LOCAL_TEST_DB_URL" -At -f supabase/tests/preset_store_preservation_snapshot.sql | diff /tmp/before.txt - && echo "legacy tables unchanged"

# 3. Optional fixtures (guarded: refuses without the opt-in)
psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
SET app.preset_store_local_fixtures = 'local-test';
\i supabase/fixtures/preset_store_local_seed.sql
SQL

# 4. Regression checks (one transaction, rolls back; expects: NOTICE  PRESET STORE REGRESSION: 171 checks passed)
psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/preset_store_schema_regression.sql

# 5. Reset fresh and repeat 2-4 once more, as the acceptance gate asks
supabase db reset
```

The regression file uses `SET LOCAL ROLE anon | authenticated | service_role`, so the connecting role must be able to `SET ROLE` to all three (the `postgres` role of a Supabase stack should; not confirmed here) and it inserts throwaway users into `auth.users` and `public.profiles` (rolled back). If your stack has a trigger that fills `profiles` from `auth.users`, the file tolerates it (`ON CONFLICT DO NOTHING`).

## Rollback and forward fix

* **Preferred, any shared database:** a forward fix, i.e. a new higher-numbered migration. 0043 is additive, so leaving it applied but unused is harmless.
* **Disposable database, or production where the store was never used:** `supabase/rollback/0043_preset_store_marketplace_schema.rollback.sql`. It does nothing unless `app.preset_store_rollback = 'confirmed'`; refuses while any customer-record table (grants, preferences) has a row; refuses while catalog rows exist unless `app.preset_store_rollback_catalog = 'drop'`; drops only 0043's own objects, policies first; never touches an earlier table.
* Nothing here is run automatically, and no `DROP` is part of any migration.

## Verification

All of it on PGlite with a stubbed Supabase layer (roles `anon`/`authenticated`/`service_role`, `auth.uid()` from the JWT setting, Supabase's default privileges). The real migration files 0034, 0035, 0036, 0039, 0040, 0041, 0043 were applied, with two accounts, a legacy favourite and a `preset_organization` row seeded first.

| Check | Result |
| --- | --- |
| Apply 0043 on a database with legacy holdings, favourites and organization | applies; fingerprints of `presets`, `user_presets`, `preset_organization` identical before and after |
| Apply 0043 a second time | no error, legacy fingerprints still identical |
| Fixtures: run twice, run without the opt-in | idempotent; refuses without the opt-in |
| Regression file with fixtures loaded | **171 checks passed**, ends in `ROLLBACK`, leaves no rows, legacy fingerprints unchanged |
| Mutation test: 22 deliberate defects (default privileges left on, executable claim function, dropped uniqueness, unpublished release claimable, world-readable grants, revoked grant restorable, readable release path, repeat claim reviving a grant, readable drafts, favourite RPC or claim writing `user_presets`, system-preset release allowed, mutable releases, missing pack bound, unchecked publish, paid policy allowed, missing release foreign key, archived product visible to all, unlisted pack items visible, readable revocation reason, non-unique claim, writable other-user preference) | all 22 caught by the regression file |
| Rollback script: refusal paths, success path, re-apply, regression again | behaved as documented; no 0043 object left after rollback, legacy tables identical |

## Not verified

* No authorized Supabase instance, so no `supabase db reset` run, no real PostgREST, no real `auth` schema, no Supabase-specific default privileges beyond the stub.
* Concurrency: the advisory lock serialises a user's claims of one product by construction and was exercised sequentially only; no two-connection race test.
* Policy checks use `SET LOCAL ROLE` plus the JWT subject setting, not real JWTs through the API.
* Performance: indexes are in place for the listed access paths, with no data volume tested.

## Decisions to confirm (see OPEN_DECISIONS)

1. Free-only core now; orders, prices, payments, refunds and disputes in a later migration.
2. No pack editions: a pack is a mutable list, and each claim records exactly what was granted.
3. The store never writes `user_presets`; the app reads holdings from `user_presets` plus active grants.
4. Store presets must be `scope = 'user'`.
5. Caps chosen as sanity bounds, not policy: 200 presets per pack, 16 tags.
