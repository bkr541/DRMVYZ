# Preset Store: operator decisions

Phase 00 proposals, 2026-10-29. No payment provider, license, offline policy or publishing administrator has been configured. Approval of the architecture is distinct from permission to apply production migrations or configure live billing.

| Decision | Proposed default | Approval/blocking boundary |
| --- | --- | --- |
| Phase progression | Review Phase 00 audit/checklist, then explicitly approve Phase 01. | Required by the supplied phase gates. Earlier Inertia approvals do not approve this new marketplace audit. |
| Local/test database | Disposable local Supabase with two synthetic users and isolated fixtures; repeat a fresh reset once. | Operator must identify/authorize the local/test instance before any apply/reset. CLI exists but Docker/psql were not found on PATH. Schema preparation can follow Phase 00 approval; Phase 01 acceptance cannot be claimed without the database. Never infer a target from linked credentials. |
| Production operations | Separate reviewed migration, backup and deploy steps after test evidence. | Explicit operator approval required for each production migration, billing configuration or deployment. None authorized by this audit. |
| Payment provider | Stripe hosted Checkout, one-time purchases, server-only provider references, test mode first. | Confirm provider/account, merchant responsibility and access before payment integration. Provider-neutral schema can be prepared first. No keys/accounts assumed. |
| Pricing, currency, tax and regions | Explicit integer minor-unit prices per ISO currency; no automatic conversion. Free claims bypass paid checkout but retain server grants. | Operator supplies currency, prices, selling regions and tax/refund disclosures before real checkout/publishing. No invented live prices or tax treatment. |
| Refunds and disputes | Full standalone refund revokes that purchase source; full pack refund revokes that edition's source grants; overlapping/legacy access survives. Suspend disputed source pending resolution, reconcile final outcome. | Must approve customer policy and refund/dispute mapping before live commerce. Partial refunds remain disabled until item-level allocation/rules are defined. |
| Pack editions and future updates | Purchase pins immutable edition/member releases. New members/new content form a new edition; old buyers retain purchased edition. No automatic paid upgrade or retroactive additions. | Approve before Phase 01 schema lock. If complimentary future updates are desired, model explicit additional grants; do not mutate history. |
| Duplicate ownership | Allow overlaps with clear “already owned” disclosure; never charge for a standalone already-owned release by default. No automatic proration for partly owned packs. | Confirm bundle pricing/checkout behavior before commerce UI. Grants remain source-aware regardless of chosen discount policy. |
| Offline access | Seven-day signed entitlement lease for verified installed content; five-minute download URLs; no new offline purchases/claims/downloads. Fail closed on invalid lease/clock rollback. | Requires explicit approval and vetted verifier/clock implementation before marketplace offline activation. Until then expose unavailable state; do not treat cached auth as ownership. Revocation cannot instantly reach disconnected copies. |
| Content licenses | Publish only assets/presets with verified rights for paid redistribution, customer use and promotional previews. Track license/attribution with immutable releases. | Cannot safely assume. Operator/content owner confirms actual rights before any real content is published. Placeholder test fixtures carry no paid production ownership. |
| Administrative publishing | Operator CLI/server path with explicit allowlisted admin authorization and separate server secret handling. No new client admin UI initially. | Name authorized operators and server authorization source before publisher deployment. Do not grant admin to oldest profile, client metadata or a renderer flag. |
| Storage limits and retention | Bounded manifests/assets/previews, checksum validation, private content bucket; retain purchase/edition history, isolate per-account device cache. | Approve actual size quotas, event/audit retention and deletion/export policy before production. No arbitrary size limits or legal retention claims implied by this plan. |
| Visual references | Preserve existing rails/header and build all Store views in middle; use existing tokens and typography. | `references/` is missing. Supply reference images before UI visual acceptance; does not block additive schema preparation. |
| Engine support | Cinema 2.0 data-only subset using shipped module/config allowlist, no downloaded shader/JS/module code. | Architectural default. New engine/module support requires a separately reviewed application release, not a marketplace download. |

Resolved architectural decisions are in [PHASE_00_AUDIT.md](PHASE_00_AUDIT.md). Approval should identify any policy changes so Phase 01 does not encode an undocumented assumption. See [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) for proposed later workstreams; only Phase 00 and Phase 01 prompts have been supplied.

## Phase 01 schema decisions awaiting confirmation

Encoded in migration 0043 as stated in [SCHEMA.md](SCHEMA.md). 0043 has not been applied anywhere, so each is still an in-place edit. The authorized local/test instance for Phase 01 acceptance is **still unidentified** (Docker, `psql` and Postgres are not installed here).

| Decision | Encoded default |
| --- | --- |
| Scope of 0043 | Free-only core: catalog, releases, free claims, favourites. Orders, prices, payments, refunds and disputes move to a later migration, after the provider, refund and tax decisions above. |
| Pack editions | Dropped. A pack is a mutable list; each claim writes grants pinned to the releases delivered then. A preset added later is granted only when the user claims the pack again. |
| Holdings | The store never writes `user_presets`. The app treats a preset as held with a `user_presets` row or an active grant. |
| Store presets | Must be `scope = 'user'`; a release for a `system` preset is rejected. |
| Release signing | Each release stores `format_version` and `signing_key_id`. |
| Sanity caps | 200 presets per pack, 16 tags. Not policy; adjust freely. |
