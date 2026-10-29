# Preset Store: Phase 01 database schema and access policies

Phase 01, 2026-10-29. Migration `supabase/migrations/0043_preset_store_marketplace_schema.sql`. Additive only: nothing in `presets`, `user_presets`, `preset_organization` or any earlier migration is altered.

## Status

| Gate | State |
| --- | --- |
| Migration, regression SQL, fixtures, rollback script, this document | Written. |
| Applied and tested on an **authorized local/test Supabase instance** | **Not done.** No Docker, `psql` or local Postgres exists on this machine and no instance was authorized (see [OPEN_DECISIONS](OPEN_DECISIONS.md)). Phase 01 is therefore **prepared, not accepted**. |
| Stand-in verification | Done on PGlite (real Postgres compiled to WASM, in memory) with a stub of the Supabase roles, `auth.uid()` and default privileges. Evidence is under [Verification](#verification). It proves the SQL is valid and the policy logic behaves; it is not the Supabase stack. |
| Production | Nothing applied, linked or deployed. Applying 0043 to production needs separate operator approval. |

## Files

| File | Purpose |
| --- | --- |
| `supabase/migrations/0043_preset_store_marketplace_schema.sql` | The schema, constraints, triggers, server functions, privileges and RLS. Re-runnable (`IF NOT EXISTS`, `OR REPLACE`, `DROP POLICY IF EXISTS`). |
| `supabase/tests/preset_store_schema_regression.sql` | 403 checks in one transaction that ends in `ROLLBACK`: privileges, RLS role matrix, constraints, immutability, editions, overlapping sources, refunds, the legacy-holding rule, the favourite RPC. Self-contained; also checks the fixtures when loaded. |
| `supabase/tests/preset_store_preservation_snapshot.sql` | Read-only fingerprint of `presets`, `user_presets`, `preset_organization` for before/after comparison. |
| `supabase/fixtures/preset_store_local_seed.sql` | Local/test catalog fixtures only: one free pack, one standalone product, one overlapping standalone product. No orders, grants or holdings. Opt-in and guarded. |
| `supabase/rollback/0043_preset_store_marketplace_schema.rollback.sql` | Guarded, non-automatic rollback for a disposable database. Lives outside `migrations/`. |

No client or Edge Function code changed, and `src/types/database.ts` was not regenerated: nothing consumes the new tables yet, and regenerating against an unapproved project is out of scope (Phase 00). Regenerate types when the service phase starts.

## Relationships

```
presets (0034, unchanged) ──┬──────────────────────────────────────────────────────────┐
  id, engine_id, preset_key │                                                           │
                            │ 1                                                         │
                            ▼ *                                                         │
preset_releases ◄──(id,preset_id)── preset_pack_items ──► preset_pack_editions ──► preset_packs
  immutable content          │  edition_id, preset_id,        (immutable snapshot)      stable pack identity
  hash, size, private paths  │  release_id, position              │ 1                         │ 1
        │ 1                  │                                    │                           │
        ▼ 1                  │                                    │ current_edition           │
preset_release_publications  │                                    ▼ *                        ▼ 1
  draft | published |        │                      store_products  ◄── exactly one of preset_id | pack_id
  withdrawn (mutable)        │                        │ 1    ▲ current_release (standalone)
                             │                        │      │
                             │                        ▼ *    │
                             │              store_product_prices ──► store_product_provider_refs (private)
                             │                  (immutable amount)
                             │                        ▲
profiles (0001) ◄── store_orders ──► store_order_items ┘   each line pins price snapshot + release | edition
  (SET NULL)   │      │                      │
               │      ▼                      ▼
               │  store_payment_events    preset_entitlement_grants ──► (user, preset, release)
               │   (private inbox)         source: purchase | free_claim | manual; revocable
               │                                  │ reconcile_preset_holding()
               ▼                                  ▼
        user_preset_preferences          user_presets (0034, unchanged) ◄── marketplace_holding_projections
        (own favourites)                   effective holdings; legacy read path       (marks rows the marketplace created)
```

## Rules the schema enforces

**Identity.** `presets.id` stays canonical; `(engine_id, preset_key)` stays its natural key. A product points at a `presets` row. `uq_store_products_preset` allows one standalone product per preset and `uq_store_products_pack` one per pack, so a preset has no duplicate paid identity. A pinned release must belong to the preset it is pinned for, enforced by composite foreign keys on `(release_id, preset_id)` in pack items, products, order lines and grants.

**Releases are immutable.** A `preset_releases` row cannot be updated, and cannot be deleted once it was ever published. Publication state is a separate row (`draft → published → withdrawn`, and withdrawn can be published again; never back to draft). Manifest hashes are 64-char lowercase hex, versions are semver-shaped, storage paths cannot be absolute or contain `..`.

**Pack editions.** A pack is a stable identity; an *edition* is an immutable, ordered snapshot of `(preset, release)` members. Members can only change while the edition is a draft (max 200); publishing requires at least one member and every member release published; a published or retired edition's membership can never change, and it cannot return to draft or be deleted.

**The rule for pack additions and version updates.** A purchase pins the edition and its member releases on the order line, and its grants carry that edition (`via_edition_id`). Adding a preset, or shipping a new release, creates a *new* edition or release and moves the product's `current_edition_id` / `current_release_id` forward for new sales. Earlier buyers keep exactly what they bought: nothing is added, upgraded or charged retroactively. `store_products.update_policy` is `'pinned'`, the only value the constraint allows; complimentary updates need an approved policy and their own migration (grant the new release explicitly).

**Prices.** Integer minor units (0 to 99,999,999) with an upper-case 3-letter currency and a `test`/`live` environment; one active price per product, currency and environment. A price row is immutable except `active → retired`, a new amount is a new row, and an order line references `(price_id, product_id, currency, amount)` through one composite foreign key, so a line cannot drift from its price. A free claim is an explicit zero price. Provider ids live only in `store_product_provider_refs`, never in a catalog table.

**Orders.** A zero-price claim is an `internal` order (total 0, no provider references); a provider order must charge more than 0. Unique per `(user_id, request_key)`, per provider checkout session and per payment intent. Identity and money are immutable after insert, provider references can be set once, a refunded order cannot reopen. At commit an order must have at least one line and `total_minor` must equal the exact sum of its lines (deferred constraint trigger). `user_id` is `ON DELETE SET NULL`, so deleting an account does not erase a payment record; retention is an operator decision.

**Payment events.** `UNIQUE (provider, environment, event_id)`: a redelivered event conflicts instead of duplicating, and the handler reads the first row's status. Payload must be a JSON object under 256 KiB.

**Grants.** One row per source and member (`UNIQUE (order_item_id, preset_id)` and `UNIQUE (user_id, preset_id, manual_reference)`), so replaying fulfilment or a webhook cannot create a second row. A guard trigger requires the grant to match its order line (same user, a standalone line's own release, or a member of the pinned edition; `free_claim` only from zero-total orders). After insert only `revoked_at` / `revoked_reason` may change. A user can hold the same preset through several active sources at once (a pack, a standalone purchase, a manual grant); effective entitlement is *any* active grant.

**Legacy holdings.** `user_presets` remains the effective read path, so the existing scope resolver and the 0034/0035 policies are untouched. When a grant becomes the first source for a (user, preset), `reconcile_preset_holding` inserts the `user_presets` row only if none exists and marks it in `marketplace_holding_projections`. A row that already existed (0036, 0040, 0041 and hand-recorded ones) is never marked and never removed. When the last active source is revoked, only a marked row is deleted. Per-pair `pg_advisory_xact_lock` serialises overlapping fulfilment and revocation. The migration creates no grants and no markers for existing holdings and does not change any old row.

**Refunds and disputes.** `revoke_store_order_item_entitlements(item, reason)` revokes only that line's grants, so a standalone refund leaves pack access intact and refunding one overlapping pack leaves the other intact. A dispute hold uses the reason `dispute_pending` and `restore_store_order_item_entitlements` lifts only that reason; a refund revocation is never restored. A late replay of fulfilment inserts nothing for an already-revoked line (`ON CONFLICT DO NOTHING`), and a refunded order cannot be fulfilled. Partial refunds are not modelled; they stay disabled until an item-level policy is approved.

**Favourites.** The durable source is `user_preset_preferences (user_id, preset_id, is_favorite)`, valid for system presets the user holds no row for. Read precedence: explicit preference row, else the holding's `is_favorite`, else false. The only client write that touches a holding's `is_favorite` is `set_preset_favorite(preset_id, flag)`: it uses `auth.uid()`, upserts the preference, updates the legacy flag only if the caller already has a holding, never inserts a holding, and rejects null/unknown input. Clients may also write their own preference rows (flag only), which never grants anything. Tags and collections stay in `preset_organization`; installed state is device-local and has no table.

## Privilege and RLS matrix

R = SELECT of the stated rows and columns. Dash = no privilege (REVOKEd; RLS adds a second wall). Supabase's default privileges grant new tables to `anon`/`authenticated`; the migration revokes them first, then grants back only what is listed. The service role bypasses RLS.

| Resource | anon | authenticated user A | A reading B's rows | service role |
| --- | --- | --- | --- | --- |
| `store_products` (all columns) | R `published` | R `published`, plus `archived` ones A has an order line for | same rule, B's lines don't count | R/W |
| `store_product_prices` | R active price of a published product | same | same | R/W |
| `preset_packs`, `preset_pack_editions`, `preset_pack_items` | R while a published product sells the pack; editions `published` and `retired` only; items of a visible edition | same | same | R/W (membership frozen once published) |
| `preset_release_publications` | R `published` rows | same | same | R/W |
| `preset_releases` | R columns `id, preset_id, version, min_app_version, created_at` of published releases. No hash, size, path, prefix, digest, license | same | same | R/W (immutable) |
| `store_product_provider_refs`, `store_payment_events`, `marketplace_holding_projections` | — | — | — | R/W |
| `store_orders` | — | R own rows, columns `id, user_id, currency, total_minor, status, paid_at, fulfilled_at, refunded_at, created_at` (no `request_key`, no provider ids) | — | R/W |
| `store_order_items` | — | R lines of own orders | — | R/W (lines immutable) |
| `preset_entitlement_grants` | — | R own rows, columns `id, user_id, preset_id, release_id, source_kind, order_item_id, via_edition_id, granted_at, revoked_at` (no `manual_reference`, `granted_by`, `revoked_reason`); no write | — | R/W via the functions below |
| `user_preset_preferences` | — | R/insert/delete own; UPDATE of `is_favorite` only | — | R/W |
| `presets` (0034/0035) | existing policy, unchanged | R | R | existing |
| `user_presets` (0034) | — | own R, no client write (unchanged) | — | via `reconcile_preset_holding` |
| `preset_organization` (0039) | — | own CRUD (unchanged) | — | existing |

| Function | anon | authenticated | service role |
| --- | --- | --- | --- |
| `set_preset_favorite(uuid, boolean)` | — | EXECUTE | EXECUTE |
| `fulfill_store_order_item`, `revoke_store_order_item_entitlements`, `restore_store_order_item_entitlements`, `grant_manual_preset_entitlement`, `revoke_manual_preset_entitlement`, `reconcile_preset_holding` | — | — | EXECUTE |

All seven are `SECURITY DEFINER` with `search_path = public, pg_temp`. Because the client cannot read `preset_releases` paths at all, a later download gateway (Phase 04) must authorize against an active grant and sign access itself; there is no client path to a paid object.

Client note: `select *` on `preset_releases`, `store_orders` and `preset_entitlement_grants` is denied by design. Name the columns that are granted.

## Server primitives

Called with the service role from the later checkout, webhook, claim and publishing services. Each takes the per-(user, preset) advisory lock, so concurrent calls for the same pair serialise.

| Function | Behaviour |
| --- | --- |
| `fulfill_store_order_item(item)` returns grants inserted | Order must be `paid`/`fulfilled`. Inserts one grant per member (one for a release, one per edition member) as `purchase` or `free_claim`, reconciles each holding, and marks the order `fulfilled` once every line has grants. Idempotent. |
| `revoke_store_order_item_entitlements(item, reason)` returns grants revoked | Revokes that line's active grants and reconciles holdings. The caller sets the order status (`refunded`, `disputed`) in the same transaction. Idempotent. |
| `restore_store_order_item_entitlements(item)` | Reinstates only grants revoked as `dispute_pending`. |
| `grant_manual_preset_entitlement(user, preset, release, reference, granted_by)` / `revoke_manual_preset_entitlement(user, preset, reference, reason)` | Operator grants through the same source and projection path. Any other writer of marketplace holdings must use these functions, or its row will be treated as marketplace-created. |
| `reconcile_preset_holding(user, preset)` | Internal: makes `user_presets` agree with the active grants as described above. |

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

# 4. Regression checks (one transaction, rolls back; expects: NOTICE  PRESET STORE REGRESSION: 403 checks passed)
psql "$LOCAL_TEST_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/preset_store_schema_regression.sql

# 5. Reset fresh and repeat 2-4 once more, as the acceptance gate asks
supabase db reset
```

The regression file uses `SET LOCAL ROLE anon | authenticated | service_role`, so the connecting role must be able to `SET ROLE` to all three (the `postgres` role of a Supabase stack should; not confirmed here) and it inserts two throwaway users into `auth.users` and `public.profiles` (rolled back). If your stack has a trigger that fills `profiles` from `auth.users`, the file tolerates it (`ON CONFLICT DO NOTHING`).

## Rollback and forward fix

* **Preferred, any shared database:** a forward fix, i.e. a new higher-numbered migration. 0043 is additive, so leaving it applied but unused is harmless.
* **Disposable database, or production where the store was never used:** `supabase/rollback/0043_preset_store_marketplace_schema.rollback.sql`. It does nothing unless `app.preset_store_rollback = 'confirmed'`; refuses while any customer-record table (orders, lines, payment events, grants, preferences, holding markers) has a row; refuses while catalog rows exist unless `app.preset_store_rollback_catalog = 'drop'`; drops only 0043's own objects, policies first; never touches an earlier table. Holdings the marketplace created stay in `user_presets` (they read as ordinary holdings afterwards, so nothing is lost).
* Nothing here is run automatically, and no `DROP` is part of any migration.

## Verification

All of it on PGlite with a stubbed Supabase layer (roles `anon`/`authenticated`/`service_role`, `auth.uid()` from the JWT setting, Supabase's default privileges). The real migration files 0034, 0035, 0036, 0039, 0040, 0041, 0043 were applied, with two accounts, a legacy favourite and a `preset_organization` row seeded first.

| Check | Result |
| --- | --- |
| Apply 0043 on a database with legacy holdings, favourites and organization | applies; fingerprints of `presets`, `user_presets`, `preset_organization` identical before and after |
| Apply 0043 a second time | no error, legacy fingerprints still identical |
| Fixtures: run twice, run without the opt-in | idempotent; refuses without the opt-in |
| Regression file with fixtures loaded | **403 checks passed**, ends in `ROLLBACK`, leaves no rows, legacy fingerprints unchanged |
| Mutation test: 12 deliberate defects (default privileges left on, executable server function, dropped uniqueness, legacy-deleting revoke, world-readable orders, unfrozen membership, readable release path, revoked-grant resurrection, readable drafts, holding-creating RPC, mutable price, non-unique events) | all 12 caught by the regression file |
| Rollback script: refusal paths, success path, re-apply, regression again | behaved as documented; no 0043 object left after rollback, legacy tables identical |

The regression suite also found two real defects during development, both fixed in 0043: a shared trigger function that read a column the other table lacks, and a revocation CHECK that let a NULL reason through.

## Not verified

* No authorized Supabase instance, so no `supabase db reset` run, no real PostgREST, no real `auth` schema, no Supabase-specific default privileges beyond the stub.
* Concurrency: the advisory-lock serialisation is by construction and was exercised sequentially only; no two-connection race test.
* Policy checks use `SET LOCAL ROLE` plus the JWT subject setting, not real JWTs through the API.
* Performance: indexes are in place for the listed access paths, with no data volume tested.

## Decisions to confirm (added to OPEN_DECISIONS)

1. Free claims are internal zero-total orders (uniform pinning, idempotency and refund path) rather than a separate claim table.
2. `store_orders.user_id` is `SET NULL` on account deletion (payment record retained); `CASCADE` would erase it.
3. Retired pack editions stay publicly readable while a published product sells the pack, so an owner can see what an old edition held; draft editions never are.
4. Price environment (`test`/`live`) is a column and clients can read both; the later service decides which one a client sees.
5. Caps chosen as sanity bounds, not policy: 200 members per edition, 16 tags, 99,999,999 minor units per price, 256 KiB per event payload.
6. `update_policy` allows only `'pinned'`.
