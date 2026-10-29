# Preset Store: requirement and acceptance map

Status: Phase 00 documentation complete and approved; existing baseline has one failing test. Phase 01 is prepared (migration 0043, regression SQL, fixtures, rollback script, [SCHEMA.md](SCHEMA.md)) and verified on an in-memory PGlite stand-in, but NOT accepted: its apply/test gate still needs an authorized local/test Supabase instance. No later implementation is complete or authorized by this checklist.

Only phases 00 and 01 were supplied. Labels 02–07 below are proposed scheduling groups for a future review, not additional approved phase prompts. Requirements remain binding even if later phase numbering changes.

| Phase/workstream | Planned output |
| --- | --- |
| 00 — audit | Current source/data map, routing/security decisions, checklist, operator questions and focused baseline. |
| 01 — database foundations | Additive numbered migration, SQL regression fixtures/checks, `SCHEMA.md` with relationship diagram, RLS matrix, authorized-local execution and rollback strategy. No application runtime/UI work. |
| Proposed 02 — catalog/services | Typed DTOs, published metadata/own holdings/free claim/download authorization boundaries and account request lifecycle. |
| Proposed 03 — middle Store UI | Middle navigation, catalog/detail/preview, accessible/responsive states with both original rails functional. |
| Proposed 04 — commerce | Server checkout, signature-verified webhook, order snapshots, idempotent fulfillment/refund/dispute reconciliation. |
| Proposed 05 — installation | Native trusted IPC, browser storage adapter, data-only validation, verified assets/receipts/offline leases. |
| Proposed 06 — library/downloads integration | My Downloads, real install states, reactive holdings/favorites/custom integration without side layout changes. |
| Proposed 07 — publishing/release acceptance | Operator publishing, content/license checks, targeted end-to-end/native/security evidence and separately approved deployment. |

## Phase 00 acceptance record

- [x] Inspect current tree and required architectural/UI/schema/native boundaries; map findings in audit.
- [x] Document canonical IDs, existing scope and holdings/favorite/custom behavior, immutable pack editions, overlap/refund rules and role/API boundaries.
- [x] Specify middle-only routing, preview isolation, recording/WebGL preservation, component ownership and narrow-width conflict.
- [x] Specify desktop/browser persistence, path validation, data-only module restrictions and proposed offline policy.
- [x] Record official sources and decisions requiring operator approval.
- [x] Run focused baseline: **8 pass, 1 fail**; preserve exact failure rather than fixing unrelated test/application code.
- [x] Typecheck: **pass**. Node **26.11.1** is outside the declared **22.x** baseline; later supported-runtime acceptance remains necessary.
- [x] Restrict patch to three requested documents plus documentation-index links; no SQL/cloud/runtime/UI/payment edits.
- [x] Operator approved Phase 00 before Phase 01 began.

## Cross-phase requirement traceability

| ID | Requirement | Delivery phase | Specific acceptance evidence |
| --- | --- | --- | --- |
| R01 | Preserve complete left library, right Info/Design/React/Output/customization and global nav/header. | 03, 06 | DOM identity/state tests across every middle route; browser captures of unchanged rails/header and functional controls. No duplicate local header. |
| R02 | Visualizer/Store/My Downloads and Store Discover/Presets/Packs/Owned, standalone and edition detail. | 03, 06 | Route/reducer tests cover all views, back restoration, filters/pagination/scroll and separate live selection. Downloads has actual receipt state, not decorative buttons. |
| R03 | Browsing/preview never activates or mutates live preset. | 03 | Spy on live activation actions and compare workspace snapshots before/after card, detail, preview, search and back; zero activation calls and no workspace changes. Left explicit library activation still works. |
| R04 | Keep live Inspector and recording working in Store. | 03, 05, 07 | Same stage/canvas/runtime identity across middle navigation; edit a live parameter in right Inspector while Store visible; record frames before/during/after navigation and verify valid continuous capture. Preview creates no extra WebGL context or global audio source. |
| R05 | Preview uses real promotional media and stays inside middle. | 02, 03 | Missing/error/loading media states, one active player, muted start, user-gesture sound, pause on navigation/account switch, focus restoration; no remote HTML/eval. |
| R06 | Keep canonical UUID and `(engine_id,preset_key)` mapping; no duplicate paid identity. | 01, 02, 05 | Unique/FK and release-to-preset mismatch assertions; product duplicate rejection; installed registry collision tests; manager organization key unchanged. |
| R07 | Preserve existing SYSTEM/USER scope and old holdings/organization/favorites. | 01, 06 | Pre/post exact row snapshots in disposable DB including existing favorites; same scope resolver outcomes; marketplace grants project into legacy read path without hiding bundled system presets. |
| R08 | Separate owned/installed/favorite/custom state without forged ownership. | 01, 05, 06 | Uninstall retains access; owned uninstalled/installed revoked/evicted bytes represented honestly. Own preferences/organization insert does not create holdings. Narrow favorite RPC changes only own existing favorite field; no client holdings INSERT. |
| R09 | Durable favorite/custom behavior uses existing persistence where possible. | 01, 06 | Favorite reload/account switch; fallback precedence from old favorite, preference for system preset without holding; tags/collections round trip using existing keys. Custom remains explicit empty/unsupported until real authored records exist. |
| R10 | Cinema 2.0 data-only releases using shipped modules only. | 02, 05, 07 | Reject unknown type/version, JS/function/import/shader source, invalid compiler/module refs and malicious/oversized configs. Compatible fixture renders using existing compiler/runtime. No executable install path. |
| R11 | Verified native asset/cache installation. | 05 | Traversal, symlink, malicious sender, arbitrary path/URL, external model dependency, hash/size/MIME mismatch and cancellation tests; atomic update preserves previous working release. Device receipt only after complete verified commit. |
| R12 | Browser fallback with truthful persistence/quota states. | 05 | IndexedDB/blob round trip, restart verification, eviction/quota denial, unsupported storage and interrupted update; no fabricated installation or native path API. |
| R13 | Account-bound online/offline access and race safety. | 02, 05, 06 | User A request completing after B login is discarded; sign-out clears active views/leases. Expiry/revocation/rollback checks; cached user ID alone cannot authorize purchase/download/activation. Use approved lease duration only. |
| R14 | Additive migration numbering, constraints, indexes and timestamps. | 01 | Recheck latest number (currently 0042); new migration only; duplicate IDs, invalid enums/hashes/currency/amount/array bounds/FKs/order tested. Old migration files and existing rows unchanged. |
| R15 | Products, prices/provider mapping, releases, packs/editions/items, orders/items/events/grants. | 01 | Schema relationship and constrained inserts cover standalone plus free pack sharing a member, immutable release/version/edition, pinned checkout lines and unique source grants/payment references. |
| R16 | Immutable pack snapshots and explicit update rule. | 01, 04 | Buy edition 1; publish edition 2 with extra member; edition 1 order and entitlement member list unchanged. Published membership mutation rejected, upgrade requires an explicit new grant/purchase policy. |
| R17 | Multiple ownership sources/refunds/revoked grants. | 01, 04 | Standalone + two overlapping packs + legacy holding; revoke each source in turn; only final market-only source removal removes marketplace-created compatibility row, never pre-existing row. Duplicate revoke/fulfill and concurrent overlap serialize correctly. |
| R18 | RLS/privileges: published metadata only, own account reads/preferences, service-only business writes. | 01, 02 | anon/A/B/service role matrix, draft/private payload/provider path denial, own-vs-other order/grant reads, forged payment/grant/product/holding writes rejected; favorite RPC cannot grant ownership. Verify SQL grants and function EXECUTE as well as RLS. |
| R19 | Private paid assets; no secret/full manifest leak via catalog. | 01, 02, 05 | Public catalog DTO/schema inspection; unentitled signing denied; own authorized release gets scoped expiring URL/hash, arbitrary path/other-user/revoked request denied; no public content bucket or service secret in client bundle. |
| R20 | Server-authoritative free claim and checkout. | 02, 04 | Tampered amount/user/currency/product ignored/rejected; invalid zero-price claim denied; duplicate request is idempotent; pending/failed/canceled checkout grants nothing. Provider errors display real retry states. |
| R21 | Signature verification, payment idempotency, delayed/out-of-order events. | 01, 04 | Invalid signature rejected; same event or payment delivered repeatedly yields one order/source; failure between event receipt and fulfillment can retry; refund-before-success reconciliation does not restore revoked source. Browser redirect never creates entitlement. |
| R22 | Safe Electron content/navigation and publishing authority. | 05, 07 | Main validates trusted sender/frame, narrow IPC arguments, trusted protocol containment; remote page cannot invoke installer. Unknown publisher denied; immutable licensed artifact publish succeeds through authorized server path only. |
| R23 | Shared design tokens/typography and accessibility. | 03, 06 | Existing control/header role typography across variants, placeholders and portaled menus; tab/arrow/Home/End/Enter/Escape, focus return, labelled empty/error/loading/disabled states and keyboard scrolling. No outer rail restyling. |
| R24 | Independent scrolling, 16:9 and narrow layouts. | 03 | Browser review at 1600x900, 1280x720, <=900px and narrower; expanded/collapsed rail combinations, long content, keyboard-only navigation; Store center remains accessible despite existing <=900 stage-hide CSS. |
| R25 | Safe local fixtures and repeatable database acceptance. | 01 | Explicitly authorized disposable DB only; fresh migration run, regression queries, reset fresh and repeat; capture old row snapshots unchanged. Fixtures free pack/standalone overlap/two users; no fake paid production holdings. |
| R26 | Rollback, operations and documentation. | 01, 07 | `SCHEMA.md` relationship diagram, RLS matrix, local commands and non-destructive rollback/forward-fix strategy. No automatic production DROP/apply/deploy; operator approval recorded separately. |
| R27 | Honest user states; no fabricated purchase/install/custom functionality. | 02–06 | Real empty/loading/unavailable/error/retry/canceled/revoked states; actual server order and device receipt drive success. Unsupported controls disabled with clear reason. |
| R28 | Focused validation and clean handoff per phase. | All | Relevant checks once after changes, typecheck when reasonable, exact known failure disclosure, docs/index updated, reviewed diff/status and actual commit status. Do not repeat unrelated failing broad suites. |

## Phase 01 execution gate

1. Obtain approval of [audit](PHASE_00_AUDIT.md) and schema-affecting [decisions](OPEN_DECISIONS.md). Reinspect current migrations/tree before edits.
2. Implement only additive schema, regression SQL/local-only fixtures and `SCHEMA.md`; keep runtime and UI untouched.
3. Identify and obtain authorization for a disposable local/test instance before any start/reset/apply. Do not use inferred production credentials or a linked remote project.
4. Run migration/role/constraint/overlap/preservation checks there, fresh twice as requested. If tooling or authorization prevents this, report Phase 01 as prepared but untested/incomplete, not accepted.
5. Review diff/status, document commands/results/rollback and stop at Phase 01 handoff. Further proposed workstreams require their own scope/approval.
