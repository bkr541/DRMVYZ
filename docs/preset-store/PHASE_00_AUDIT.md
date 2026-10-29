# Preset Store: Phase 00 audit and implementation blueprint

Audit date: 2026-10-29. Repository: `/Users/kodyrobinson/Development/DRMVYZ`.
Baseline commit: `2f5679d1d7f1e5febc6d502d2a394643699fc138` on `main`; working tree was clean before this documentation change.

## Status and scope

Phase 00 is a repository audit and proposed implementation contract. No marketplace UI, SQL, runtime, payment, credentials, or deployment changes have been made. Existing behavior described below is observed source behavior; future behavior is a design decision, not a delivered feature. Phase 01 requires review and approval of this handoff. Its application/test gate additionally requires an explicitly authorized local/test Supabase instance.

Instructions reviewed: root `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, `docs/documentation-index.md`, current architecture/recording/schema documentation, and both supplied phase prompts. The current tree, rather than the uploaded snapshot, governs this plan. The first supplied prompt explicitly says “Execute this phase alone” and “Stop after the documents and audit handoff.”

`references/` is absent in this checkout. No screenshot was available to inspect, so this audit makes no claim of screenshot or pixel agreement. The requested Store, pack/detail/preview and My Downloads views are additions to the current middle visualizer; they are not implemented reference features. Any screenshot that suggests replacing either outer rail or the global header conflicts with the locked layout rule. Obtain the reference images before visual acceptance of the UI phase.

## Current source map and boundaries

Paths in this table are relative to the repository root.

| Source | Observed responsibility | Implementation boundary |
| --- | --- | --- |
| `src/components/vyzualz/presetManager/PresetManagerView.tsx` | Three surfaces; left Presets/Favorites/Custom, center Cinema2Stage or selection summary, right Info/Design/React/Output. Left selection invokes live engine actions. Center owns stage callbacks and recorder canvas. | Add middle navigation/content here through child components; preserve both rail instances, their collapse state, inspector panels, live runtime and global header. Store cards must never call the existing live activation handler. |
| `src/components/vyzualz/presetManager/presetManagerCatalog.ts` | Static catalog from shipped registries; namespaced manager IDs, engine source IDs, activation metadata, capabilities and source data. | Adapt public marketplace DTOs separately. Never reuse full `sourceData` as a public paid-product response. |
| `src/components/vyzualz/presetManager/PresetManagerView.test.tsx` | Nine existing DOM tests for shell, rails, catalog, search, favorites/custom and live selection. | Extend focused tests for middle routes and no live mutation in the UI phase. DOM tests cannot prove GPU or recording continuity. |
| `src/styles/presetManager.css`, `src/main.tsx`, `src/styles/reactView.css` | Manager CSS globally imported by main; shared React View styling also used by the component. Floating route scopes and independent scrollers already exist. | Scope new CSS to middle content; reuse existing surfaces, rail components, control tokens and typography roles from `src/styles/typography.css`. |
| `src/features/presetCatalog/presetCatalogStore.ts`, `presetScope.ts` | Fetch `presets(id,engine_id,preset_key,scope)` and own `user_presets(preset_id)`; resolve SYSTEM/USER visibility. Auth subscription reloads catalog. | Preserve semantics, add effective marketplace holdings through server-controlled compatibility rows, and guard future async account changes. |
| `src/features/presetOrganization/presetOrganizationStore.ts`, `presetOrganizationDb.ts` | Tags and collection IDs, optimistic upsert to own `preset_organization`; component loads records once. | Preserve keys and styling. Add account reset/request guards when this state is integrated; no ownership inferred from tags or collections. |
| `src/components/vyzualz/cinema2/contracts/Cinema2NativePresetManifest.ts` | Typed native preset data contract. | First store release accepts a strictly validated data-only subset; a TypeScript type alone is not an untrusted-input validator. |
| `src/components/vyzualz/cinema2/presets/Cinema2PresetRegistry.ts`, `Cinema2FirstPartyPresetCatalog.ts`, `Cinema2PresetCompiler.ts` | First-party declarations, compilation/diagnostics, registration and identity. | Reuse compiler and registry. Add an installation adapter, not an alternative engine or module loader. Reject collisions with shipped preset identities. |
| `src/components/vyzualz/cinema2/modules/Cinema2ModuleRegistry.ts`, `Cinema2FullscreenShaderModule.ts` | Compiled module definitions keyed by type/version; unknown versions fail validation. Fullscreen shader configuration can contain `fragmentSource`. | Allow only shipped, reviewed module versions/configuration. Reject downloaded shader source as well as JS/functions, dynamic imports and executable templates. JSON alone does not guarantee data-only safety. |
| `src/components/vyzualz/cinema2/assets/Cinema2AssetTextureService.ts`, `Cinema2TextureAssetRegistry.ts`, `Cinema2TextureAssetManifest.ts`, `Cinema2AssetManifest.generated.ts` | Texture metadata, packaged asset resolution and loading. | Add explicit verified release-asset resolution through this boundary; no arbitrary remote URL or filesystem path from a manifest. |
| `src/components/vyzualz/cinema2/modules/three/Cinema2ThreeAssetRegistry.ts`, `Cinema2ThreeAssetManifest.ts`, `Cinema2ThreeAssetMetadata.ts` | Three.js asset definitions and metadata. | Permit approved model/media formats and bounded decoders; reject external model dependencies escaping the installed asset map. |
| `src/stores/reactStore.ts`, `src/components/vyzualz/react/Cinema2Stage.tsx` | Live workspace selection/state and renderer lifecycle; stage supplies canvas/runtime/snapshot/retiring callbacks. | Marketplace routing must not invoke activation, replace the stage key, publish preview state, or retire the live renderer. |
| `src/hooks/useRecorder.ts`, `docs/react-recording-and-output.md` | Recorder captures an explicitly supplied canvas; manager starts video from its stage canvas. Hook also has fallback canvas discovery for some exports. | Keep exact live canvas ownership; Store previews use video, not another discoverable canvas. Verify actual capture continuity in a later browser/native test. |
| `electron/main.cjs`, `native/rekordbox/preloadRekordboxBridge.cjs` | Sandboxed/context-isolated window; trusted app protocol/dev origin, navigation guards, frozen narrow native bridge and known IPC handlers. | Extend narrow trusted IPC for installation in a later phase. No marketplace filesystem bridge exists today; do not expose generic path writes or load Store web pages as privileged renderer content. |
| `src/lib/supabase.ts`, `src/lib/authSessionStorage.ts`, `src/lib/offlineSessionFallback.ts`, `src/App.tsx` | Configured anon client; app auth gate and auth transitions; network-failure fallback can retain a cached user ID. | Cached identity is not proof of entitlement. All purchase/claim/download actions require server-verified identity; clear marketplace user data and cancel stale requests at account transitions. |
| `supabase/functions/lyric-transcription/index.ts`, `supabase/functions/_shared/` | Existing Deno function convention, server environment values, bearer verification with `auth.getUser`, bounded requests, private assets and errors. | Reuse conventions, not transcription business logic. New storefront services remain independently testable and authorized. Never put service or payment secrets in Vite variables. |
| `src/types/database.ts`, `docs/supabase-schema.md`, `package.json`, `docs/verification.md` | Client database typing, schema documentation, test/typecheck commands and Node baseline. | Update targeted types/docs with schema work; no blind regeneration against an unapproved project. Use supported Node 22 for later CI. |

## Existing data, scope and authority

| Existing migration/contract | Observed behavior | Preservation rule |
| --- | --- | --- |
| `0034_preset_catalog_and_user_presets.sql` | Canonical `presets` UUID, unique `(engine_id,preset_key)`, name/scope; `user_presets` primary key `(user_id,preset_id)` with `is_favorite`; timestamps and `set_updated_at` convention. Own holdings SELECT policy, no client holdings write policies. | Keep identities, rows, favorites, foreign keys and read contract. No paid duplicate catalog row for an existing preset. |
| `0035_preset_catalog_readable_by_users.sql` | Broadens catalog SELECT to authenticated users, independent of scope. | Catalog rows are not secret paid content. Leave this contract intact; paid manifests and asset paths belong in restricted new tables/storage. |
| `0039_preset_organization.sql` | Own CRUD for `(user_id,preset_key)`, bounded tags/collection arrays and indexes. | Organization does not grant ownership. Keep existing string keys and rows. |
| `0036`, `0040`, `0041` preset migrations | Register selected scoped presets and grant to the oldest profile. | Preserve historical holdings. Never reuse the oldest-profile heuristic to select a store admin or seed purchaser. |
| `0042_lyric_transcription_guards.sql` | Latest numbered migration; unrelated transcription guards. | Do not modify. Candidate next marketplace migration is `0043`; recheck immediately before Phase 01 writes. |
| `0001_initial_drmvyz_schema.sql`, `0019_audio_transcription_assets.sql` | Existing private audio/media/export buckets and owner-path storage policies. | Add a separate marketplace private bucket when the asset-service phase needs it. Do not make existing buckets public or reuse personal upload policies for commerce. |

Use `engine_id = cinema2`, `preset_key = manifest.id`, and the canonical `presets.id` UUID as the identity join. A manager item ID is `cinema2:<manifest.id>`; keep that organization key. UUID identity, manager key, release UUID and product UUID have different purposes and must not be interchanged.

Current scope resolver: missing catalog row or `scope=system` means SYSTEM; a catalog `scope=user` row means USER only when its UUID is held, otherwise hidden. A held system preset remains SYSTEM. Fetch failure/unconfigured catalog falls back to the empty catalog and therefore shipped presets appear system-visible. In this manager, the scope helper currently labels Info; the left static catalog does not apply it as a visibility filter. These are UX rules for code already shipped to clients, not paid-asset authorization. Bundled manifests/assets cannot become secret through a UI filter.

Manager favorites are component-local (including an initial favorite); Custom is an empty list rather than a saved custom-preset backend. `user_presets.is_favorite` exists but is not the manager's durable favorite source. Tags/collections are database-backed, with optimistic writes; the organization store lacks an auth reset subscription. The catalog store's loading guard is not an account request epoch. New account-bound queries must discard stale responses and clear orders/grants/preferences/install views on sign-out or account switch.

Owned means an active server entitlement or preserved legacy holding; installed means verified release bytes committed on this device. Neither implies the other. Downloaded, queued, installed, update available, failed, revoked and offline unavailable must remain distinct states.

## Locked middle routing and component ownership

Use one manager-local reducer/store for middle navigation, independent of `useReactStore` live selection. No new top-level application router is needed. Proposed components live beside the existing manager, with business state under `src/features/presetStore/` in later phases (a proposed new directory, absent today).

| Middle state | Local child/view | State and transitions |
| --- | --- | --- |
| `Visualizer` | Existing live-stage host | Default. Returning here preserves canvas/runtime, selected library preset and Inspector state. |
| `Store` + `Discover`, `Presets`, `Packs`, `Owned` | Store navigation and catalog list | Independent query, filter, pagination and scroll state per view. Owned displays active entitlements, not local files. |
| `Store` + `{ kind: preset, productId, presetId }` | Standalone detail | Load public metadata by product UUID; Back restores originating list/scroll/focus. Never activate a live preset on detail entry. |
| `Store` + `{ kind: pack, productId, editionId }` | Pack detail | Explicit edition/membership and overlap disclosure. Product and edition are separate immutable references. |
| Store preview state | Middle-contained video player/dialog | One promotional preview at a time, muted by default; sound requires user gesture. Stop on close/navigation/account change; restore focus. No global preset/audio/recorder state writes. |
| `My Downloads` | Install list/details | Account-scoped entitlements joined to verified local receipts; retry/remove/update report actual device state. Ownership survives uninstall. |

Retain the live Cinema2Stage mounted with stable identity while Store/My Downloads cover its middle host. Hide only its presentation, without suspending its renderer or changing drawing-buffer dimensions during recording. The native renderer remains the single live runtime consumed by the right Inspector. Store preview is a trusted promotional video, not a second WebGL context or interactive engine. If the browser/native capture path cannot maintain the canvas while hidden, fix the host lifecycle before shipping; never silently stop recording. Left library selection remains an explicit live action under existing lifecycle rules; browsing Store does not make that selection for the user.

The left library, customization and all right Inspector tabs remain functional while Store is visible. Reuse WorkspaceRail, RailWindowHeader, RailTabs and shared controls. Do not display Store-selected paid manifest fields in the live Inspector. Preserve global navigation and header exactly. Only narrow reactive holdings/favorite/custom data integration may touch the outer rails.

Keyboard: semantic tabs with arrow/Home/End navigation, Enter/Space activation, labelled buttons, visible focus, Escape closes preview/detail where appropriate, focus restored to its invoking card, and no modal focus trap outside a true dialog. Maintain independent middle/list/detail scrolling with `min-height: 0`; never transfer Store scrolling to the page or side panels. Keep filters usable without requiring hover.

Existing CSS at width <=900px hides `.pmv-stage`. A Store mounted there would be inaccessible. The later UI phase must make center marketplace content accessible at narrow browser widths while preserving existing rail collapse controls and positions; scope any necessary grid correction to this workspace. Do not leave Store hidden or move it into a rail. Validate 1600x900 and 1280x720 browser views plus 900px/narrow widths, expanded/collapsed rails, long names, empty/error states, keyboard scrolling and portaled controls. Electron currently enforces 1180x760 minimum; narrow browser behavior still matters. Use established tokens and role typography, not workspace font overrides.

## Cinema 2.0 installation contract

First release supports Cinema 2.0 data-only manifests with an explicit supported module/configuration allowlist. Do not advertise other engine installs until their own loader contracts exist. A brand-new module needs a reviewed, compiled app release: module registry entries contain actual implementation code and are resolved by type/version. Downloading a new implementation, arbitrary shader, JS, eval payload, import or remote HTML is outside this system.

Validation sequence: bounded JSON/asset sizes and nesting; allowed fields; canonical identity/release/hash; supported app/module versions; compiler and module validation; configuration restrictions (including shader source); allowlisted asset IDs and formats; runtime resource budgets. Reject unknown types, duplicate IDs, traversal, external URI dependencies, invalid parameter references, hash mismatch or unsupported versions before registration. Retain the last valid installed release on failed update. Existing shipped identities must resolve consistently without duplicate registry registration or replacement of bundled code.

Desktop installer belongs to Electron main with an allowlisted IPC command set, validated sender frame/origin and arguments. Root: `app.getPath('userData')/preset-store/accounts/<opaque-account-key>/releases/<release-uuid>/`. Main constructs filenames from verified IDs/hashes, never user/manifest paths; resolve and check root containment, reject traversal/symlinks and arbitrary protocol URLs, use bounded downloads and staging plus atomic commit. Validate manifest and each asset checksum/size, then write a device receipt. Scope asset serving to validated installed IDs; do not extend the existing dist protocol into a generic filesystem reader. Never execute downloaded data.

Browser fallback: IndexedDB for account-scoped receipts/metadata and verified blob storage with explicit quota/eviction failures. Mark installed only after all bytes persist and validate. If durable storage is unavailable, show unsupported/unavailable; do not fake a desktop install or expose native paths. Browser persistence may be evicted and must be revalidated on startup.

Proposed offline policy: already verified installed releases can run for a server-signed, account/release-bound lease of seven days from the last successful entitlement check; five-minute signed download URLs for online retrieval. These durations require operator approval before activation. No new offline claim/purchase/download. Cached auth ID or mutable local ownership flag cannot mint a lease. Require a vetted signature verifier/trusted clock strategy; clock rollback/expired lease fails closed for marketplace activation. Sign-out clears active leases and in-memory access, isolates remaining files, and stops playback under the existing auth lifecycle. Refund/revocation takes effect online immediately and offline no later than lease expiry. Copied media cannot be made uncopyable; this is access control, not an absolute DRM promise. Keep existing bundled/offline app behavior separate.

## Additive database blueprint for Phase 01

Logical names below may be refined with explicit rationale in Phase 01 `SCHEMA.md`. Do not modify existing migration files or rewrite existing holdings/organization during migration.

| Structure | Keys and invariant |
| --- | --- |
| `preset_releases` | UUID, canonical preset FK, unique preset/version, immutable manifest SHA-256 and asset version/digest, app/module compatibility. Sensitive manifest/storage records service-only. An immutable content row is separate from mutable publication status. |
| `preset_packs`, `preset_pack_editions`, `preset_pack_items` | Stable pack UUID; immutable edition UUID/version; ordered, unique preset/release membership within edition. Composite constraints enforce release belongs to preset. Publish validates all members; published membership never changes. |
| `store_products` | Stable product UUID; exactly one standalone canonical preset or pack target, with unique target/type rules preventing duplicate paid identity. Public title/description/cover/promotional preview/status only; bounded metadata. |
| `store_product_prices`, private provider mapping | Immutable price UUID, product FK, integer minor amount >=0, explicit ISO currency, mode/environment; private provider/price IDs and secrets are never part of catalog DTOs. Zero-price claim is still server-verified. |
| `store_orders`, `store_order_items` | User FK, amount/currency and fulfillment status; line snapshot pins price and release or pack edition at checkout. Unique provider checkout/payment references, exact monetary checks; no floating-point currency. |
| Payment event inbox | Unique `(provider,event_id)` with bounded payload/retention, processing status/error and payment references. Service-only. Event receipt and entitlement fulfillment transaction/retry are idempotent, not a browser success flag. |
| `preset_entitlement_grants` | User, preset, release access, source kind/source ID/order line, grant/revocation timestamps and reason. Unique per source/member; check exclusive source references and FK integrity. Effective entitlement is existence of any active valid source. |
| Compatibility provenance | Server-only marker for marketplace-created `user_presets` projection rows. Legacy rows remain independent valid sources; migration creates no fake orders/grants for historical holdings and does not change old data. |
| User preferences | Own favorite state keyed by user and canonical preset; warranted because existing manager favorites are ephemeral and system presets need not have holding rows. Tags/collections stay in existing organization. Installation receipts are device-local authority; do not add a cloud boolean pretending to prove bytes exist. |

`user_presets` remains the effective read compatibility path. Later server transactions add a projection row on first marketplace grant only if absent, recording that the marketplace created it. On revocation, remove only a marketplace-created row with no remaining active marketplace or recorded legacy/manual source; never remove a pre-existing holding. Concurrent overlapping fulfillment/revocation must serialize per user/preset and reconcile transactionally. Other future manual-grant writers must use the same source/projection transaction so an independent grant cannot be lost. Phase 01 must define/test these server primitives; no client writes may synthesize holdings.

Keep `is_favorite` editable through a narrow own-row RPC that accepts only preset UUID and favorite boolean, verifies `auth.uid()`, and updates only that field on an existing holding. A separate own-preference row supports system presets and survives uninstall; preference synchronization must never insert holdings. Preserve existing `is_favorite` values and document source precedence/backfill before wiring the UI: prefer an explicit new preference, otherwise existing holding favorite, otherwise false. Do not broaden client UPDATE grants to ownership columns.

Buying a pack pins its edition and member releases in the order snapshot. Later additions create a new edition; previous buyers retain the purchased edition. No silent retroactive additions, upgrades, removals or charges. A full pack refund revokes that source's member grants only. A standalone refund leaves pack access intact; refunding one overlapping pack leaves the other intact. Partial refunds require an explicit item/line policy before enabling them. New release upgrades require a declared product/update policy; do not infer ownership of future content.

Index product publication/type, pack edition/ordering, price product/currency, orders user/time and provider identifiers, grant user/preset/active/source and all frequently joined FKs. Bound text/array/JSON sizes, status values, currencies, hashes, versions and ordering. Reuse UUID/timestamp conventions and `public.set_updated_at` only for mutable rows. Enforce immutable published content at the database layer, including service-write validation; do not rely only on UI controls.

### Intended role matrix

R = SELECT of the stated projection; W = constrained write; dash = denied. Users A and B are separate authenticated accounts.

| Resource | anon | user A | user B requesting A | authorized server/service |
| --- | --- | --- | --- | --- |
| Published products, public prices and pack membership metadata | R | R | R (public metadata only) | R/W with publishing rules |
| Draft catalog/private provider mapping/payment events | — | — | — | R/W |
| Full releases/manifests/paid asset paths | — | — (download gateway only) | — | R/W immutable releases; gateway verifies entitlement |
| A's orders and safe entitlement summary | — | R | — | R/W transactionally |
| A's preferences | — | R/W own bounded fields | — | R/W |
| Existing catalog `presets` | Existing policy unchanged | R per 0035 | R per 0035 | Existing write authority |
| A's `user_presets` | — | R + narrow favorite RPC only | — | Projection/source transactions |
| A's `preset_organization` | — | Existing own CRUD | — | Existing authority |
| Private marketplace storage objects | — | — (short-lived gateway URL only) | — | Authorized upload/sign only |

RLS is row filtering, not secret-column masking. Separate public projections from private payload/provider tables; explicit column grants or security-invoker views must not bypass restrictions. Revoke default/public function execution for privileged RPCs, set fixed safe search paths, validate identity inside definer functions, and grant only required roles. No client order/payment/grant/catalog/holding INSERT. Published metadata visibility must also exclude unpublished child editions/prices. Service credentials never enter renderer/preload bundles.

Phase 01 regression SQL must test anon, A, B and service roles, foreign-account access, client forgery attempts (including favorite RPC), drafts, private releases/storage paths, constraints, duplicate events/orders/grants, pack overlaps and source revocation. On an authorized disposable database: apply all migrations fresh, run fixtures and assertions, reset fresh and repeat once, and compare pre/post snapshots of old catalog identities, holdings/favorites and organization. Local fixtures include a free pack, one standalone preset overlapping a pack item, two users and clearly test-only payments; never seed ownership into a linked production project. Supply rollback strategy preserving data, not an automatically executed destructive down migration.

## Service and publishing boundaries for later phases

Proposed interfaces are contracts to implement, not existing endpoints:

| Boundary | Trusted behavior |
| --- | --- |
| Catalog list/detail | Bounded pagination/search; public metadata DTO only, published joins, no full manifest/private path/provider reference. Owned overlay is a separate authenticated response. |
| Own library/downloads | Verified JWT, own grants and device receipts, explicit loading/empty/error/offline/revoked states. Reject stale account responses. |
| Free claim | Authenticated POST, server checks current zero price/product/edition, idempotent transaction grants source and reconciles holdings. |
| Checkout | Authenticated POST of product/price reference and request key; server resolves trusted amount/currency/edition/provider mapping, records order snapshot and creates hosted checkout. Never accept amount or user ID as authority. Open provider through trusted external browser flow. |
| Payment webhook | Verify raw body signature; unique event/payment keys, retry-safe transaction, paid-state verification and out-of-order refund/dispute reconciliation. Return/redirect page polls server order state; never grants locally. |
| Download authorization | Verify JWT + active source/release access, issue narrowly scoped short-lived URLs/lease and expected hashes/sizes; no arbitrary storage path signing or credential return. |
| Installer | Trusted bounded native/browser adapter validates bytes and commits receipt; cancellation, quota/network/hash failure retains previous valid installation. |
| Publisher | Explicit operator-authenticated server/CLI path validates licenses, identities, compiler/module/asset budgets and preview safety, uploads private immutable content then atomically publishes metadata/price/edition. No oldest-user or client role flag authorization. |

Provider failure cannot create a successful purchase; pending checkout is not ownership. Duplicate clicks/events cannot double-charge or duplicate grants. Refund/dispute events update the relevant source, preserving other grants. Never embed arbitrary remote Store HTML in Electron; renderer only consumes validated DTO/media and uses the existing trusted app surface.

Official references checked during this audit: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [private/public storage](https://supabase.com/docs/guides/storage/buckets/fundamentals) support the policy/storage separation above. A private object can use authenticated access or a limited-life signed URL; a public bucket exposes retrieval to anyone with the URL. Recheck [Supabase views](https://supabase.com/docs/guides/database/views), [storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [local development](https://supabase.com/docs/guides/local-development/overview) before SQL/service implementation. No remote credentials or deployed policy state were inspected.

Stripe is a proposed provider, not configured. [Stripe webhooks](https://docs.stripe.com/webhooks) documents signature verification, retries and event handling. Before payment code, verify the selected [Checkout fulfillment variant](https://docs.stripe.com/checkout/fulfillment), [idempotent requests](https://docs.stripe.com/api/idempotent_requests), [refunds](https://docs.stripe.com/refunds) and [disputes](https://docs.stripe.com/disputes). The source-revocation model above is our proposed application policy, not a policy chosen by Stripe.

## Baseline evidence and limitations

| Check | Result |
| --- | --- |
| `git status --short` before edits; `git log -1 --format='%H'` | Clean tree; baseline commit recorded above. |
| `npx vitest run --config vitest.dom.config.ts src/components/vyzualz/presetManager/PresetManagerView.test.tsx` | **FAIL: 8 passed, 1 failed, 9 total** (Vitest 3.2.6). Failure: `scopes floating layout rules to the Preset Manager route without clipping the rail grips`, line 74, expected empty string to contain `[data-workspace-layout='floating'][data-app-workspace='presetManager']`. Raw CSS import/assertion receives empty scoped text; actual stylesheet has the marker at line 192 and scoped rules. Root cause was not established or repaired. |
| `npm run typecheck` | **PASS**, `tsc --noEmit`, exit 0. |
| `node --version` | `v26.11.1`; outside package engine `>=22.12 <23`. Results are this environment's baseline, not a supported-Node CI certification. |
| Tool availability only | Supabase CLI at `/opt/homebrew/bin/supabase`; Docker and psql not found on PATH. No authorized local/test database supplied. No database was started, linked, reset or migrated. |
| Source layout/security review | Verified the three-surface ownership, current selection actions, registry/compiler boundaries, scope/RLS history and trusted Electron entry points. No browser capture, live WebGL/recording test or payment integration test performed. |

The focused test was repeated once to recover an unavailable terminal result; it was not repaired or repeatedly retried after its failure was known. The eight passing cases cover shell/rail identity, catalog exclusion/names/capabilities, searchable metadata, favorite/custom tabs and matching live Inspector selection. They do not prove future Store behavior. No regression tests were added because Phase 00 changes documentation only.

See [implementation checklist](IMPLEMENTATION_CHECKLIST.md) for every requirement's delivery/test gate and [operator decisions](OPEN_DECISIONS.md) for unresolved approvals. Phase 01 must not assume production credentials or claim SQL acceptance without the authorized disposable database evidence.
