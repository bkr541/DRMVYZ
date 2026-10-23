# 29. Phase 9 — Release sign-off and documentation

**2026-10-23: release review completed; decision NO SHIP.** The user explicitly approved the reviewed visuals and behavior during this phase. All release criteria now have recorded outcomes and evidence links in the [release gate](09_RELEASE_GATE.md). BLOCKSHIFT remains **Preview**, revision 17, registered as a reference. Release approval is incomplete because repository validation blockers and the final committed-candidate check remain open.

## Candidate and scope

Branch `main`; base commit `9c2aa74831103c1589e589c8cedc5af5f94f1643`; implementation and documentation remain uncommitted. The scoped source SHA-256 is `1712ae4c566e948d5a4b64bdb2e2839d938e6e52b269613b08d43709f6f17137`. Per-file hashes, included paths, contract hash and timestamp are in the [checkpoint](evidence/p9-signoff/checkpoint.json). This identifies the inspected filesystem candidate and is not a final Git commit.

Phase 9 changes documentation/sign-off records. Product source, revision/defaults, supplied models and visual behavior are unchanged from Phase 8. The user's root creation-contract edits were preserved.

## Completed deliverables

- Evaluated the 36 original criteria and three Phase 9 deliverables with PASS/FAIL/BLOCKED results and direct evidence links. Recorded human approval separately.
- Added a [user guide](30_BLOCKSHIFT_USER_GUIDE.md) covering all 29 visible controls, conditional UI, defaults/ranges, six patterns, LED/audio behavior, camera float/orbit, added spin, hard disables and Auto/manual authority.
- Added [candidate release notes](31_BLOCKSHIFT_RELEASE_NOTES.md), with implemented feature scope and the current release limitation.
- Replaced illustrative consumer names with actual bindings/evidence in [traceability](10_REQUIREMENTS_TRACEABILITY.md).
- Verified IDs, one catalog/module declaration each, required capabilities and resource disposal. Recorded the source digest and human approval.
- Updated current phase/index status and the path to final committed-candidate validation.

## Final focused verification

**11/11 tests PASS** in `Cinema2BlockshiftPreset.test.ts` using Node 22.23.3. Coverage includes compilation/authoring, registration, world/depth/effect graph, stable identities, geometry extrema/aspects, supplied GLB normalization, four material batches, bounded allocations, disposal, partial-construction cleanup and late-allocation cancellation. [Fresh log](evidence/p9-signoff/preset-disposal-validation.log).

```sh
/opt/homebrew/opt/node@22/bin/node node_modules/vitest/vitest.mjs run src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftPreset.test.ts
```

The audit confirms preset `drmvyz.cinema2.blockshift`, native type `blockshift-native`, instance `blockshift-sculpture`, one declaration per registry/catalog owner, and required capabilities `render.webgl2`, `render.depth`, `scene.3d`, `camera.world`. Optional capabilities cover HDR and shared audio/Director/transport/music inputs. Compiler/authoring tests validate the current manifest; unchanged Phase 8 browser evidence covers its consumers.

The **66 BLOCKSHIFT + 101 affected shared/neighboring tests**, full browser matrix, scoped lint and type results remain as recorded in [Phase 8](28_P8_PRODUCTION_ACCEPTANCE_REPORT.md). They are reused, not recounted as new Phase 9 runs. Product code did not change. Expensive browser builds/captures and unrelated failing broad checks were not repeated, per AGENTS.md. [Handoff validation](evidence/p9-signoff/documentation-validation.json) passes for documentation links, source digest, 39 evaluated criteria, 29 consumer bindings and whitespace; the diff was reviewed for scope.

## Human approval

The user answered **“Approve the reviewed visuals and behavior”** to the Phase 9 request covering composition, six patterns, rotation/camera movement, LED atmosphere and audio/build/drop behavior. This satisfies the creation contract §20 human-review requirement. It does not waive repository build/test failures. The [checkpoint](evidence/p9-signoff/checkpoint.json) records scope and timestamp.

## Evidence and performance

[Visual comparison](evidence/p8-acceptance/phase8-visual-review.png) · [filmstrips](evidence/p8-acceptance/six-pattern-filmstrips.png) · [Inspector](evidence/p8-acceptance/production-inspector.png) · [LED recording](evidence/p8-acceptance/led-bars.webm) · [Auto build/drop](evidence/p8-acceptance/phase6-performance.webm) · [float/orbit](evidence/p8-acceptance/orbit-camera.webm) · [current faster spin](evidence/p8-acceptance/size-atmosphere-rotation.webm).

Recorded Apple M3 Pro/Metal 1080p/DPR-1 CPU median/p95 values with atmosphere, bloom, spin and camera enabled: **10.8/11.9 ms Quality**, **7.6/12.0 ms Balanced**, **6.2/7.1 ms Performance**. The native module reports **722,040 GPU bytes**, fifteen instances and four batches. Re-entry/resource recovery stays bounded. These are local instrumented observations, not universal FPS or complete driver-memory guarantees.

Fresh GPU queries did not complete during those windows; GPU percentiles remain `null` and cached telemetry is excluded. [Raw profile/recovery report](evidence/p8-acceptance/polish-acceptance.json).

## Remaining requirements

1. **Repository quality disposition:** existing full typecheck failure blocks `npm run build`. The Phase 8 scoped dependency graph contains nine unrelated diagnostics; the broad Cinema2 suite has seventeen preexisting failing assertions after correcting the Inspector DOM environment. All original failing assertion identities reproduced on base source. They are classified, but there is no release waiver or successful repository-wide validation. [Comparison](evidence/p8-acceptance/baseline-comparison.json), [types](evidence/p8-acceptance/types.log), [full-command baseline](12_P0_CURRENT_SOURCE_AUDIT.md).
2. **Committed candidate:** no release commit was created while the gate remains unresolved. After resolving or explicitly disposing of the baseline blockers, identify a committed candidate and validate that exact revision. Today's scoped digest does not satisfy the final-commit requirement.

No additional feature work was started. GPU telemetry changes and repository-wide remediation are separate follow-up scope. No release notes were published and no production promotion occurred.

## Phase record

| Field | Result |
|---|---|
| Phase | P9 release sign-off/documentation |
| Created | This report; user guide; candidate notes; checkpoint/fresh test log |
| Updated | Release gate, phase/index status, actual consumer trace |
| Requirements | BS-R01 schema/registration validated, keeper promotion deferred; BS-R04–R19 linked; BS-R20 human approval recorded, final release validation open |
| Product changes | None in P9 |
| Validation | Fresh 11-test PASS; IDs/capabilities/source audit; documentation link/diff checks |
| Existing failures | Repository type/build/test blockers above; no implicit waiver |
| New preset failures | None in the final focused check |
| Commit | Uncommitted; no final release SHA |
| Gate | **FAIL / NO SHIP** until G35 and G39 are resolved |
| Next work | Release requirements above; no additional phase/features authorized |
