# PHASE 07 — End-to-End Acceptance, Regression, Security and Release Handoff

## EXECUTE THIS PHASE IN CODE

You are Claude Code / Codex in the **current DRMVYZ repository**, performing **Phase 7 of 7** after the previous six implementation phases. Read `00_MASTER_OVERVIEW.md`, previous phase handoffs, `AGENTS.md`, `AI_IMPLEMENTATION_CONTRACT.md`, `DRMVYZ_Cinema_2_0_Preset_Creation_Contract.md` and existing CI/test conventions. **Do not simply write a checklist. Execute appropriate automated and real browser/Electron tests, fix phase-related defects, and produce a truthful release report.** Deploy cloud schema only with valid project access/authorization; never claim migration applied without verification.

## Goal

Prove the full user workflow is usable, secure, recoverable and stable:

**Existing user-owned PNG/SVG → Create 3D → Orbit/edit model → Save version to private Supabase → Reopen and edit → Load in six Cinema 2.0 placeholder presets → Save/restore preset → Return to Media Manager without regressions.**

## 1. Full workflow acceptance matrix

| Test ID | Required action | Required observation |
| --- | --- | --- |
| E2E-01 | Select existing transparent PNG logo; Create 3D | Actual extruded 3D mesh; silhouette and interior holes preserved |
| E2E-02 | Select SVG logo; Create 3D | Direct vector path route, correct aspect/holes/outline |
| E2E-03 | Upload opaque JPG; Create 3D | Foreground/background prep shown; user can correct ambiguity |
| E2E-04 | Drag to rotate, zoom, pan, reset, fit; resize window/collapse rails | Correct center stage behavior; no bad clipping/distortion |
| E2E-05 | Change bevel, depth, colors, chrome/gold/matte, emission | Preview actually changes; geometry/material stats reflect changes |
| E2E-06 | Save new model under authenticated user | Valid GLB/trace/source/thumbnail in private Storage and DB current version points to files |
| E2E-07 | Reload/log out/log in, reopen model | Same geometry/colors/recipe/name/collections restored |
| E2E-08 | Edit saved model, Save new version, reopen prior version | Both immutable versions exist; no accidental overwrite |
| E2E-09 | Download GLB and load externally with GLTFLoader | Valid mesh/materials, expected bounds and nonempty geometry |
| E2E-10 | Delete original image after model creation | Saved model preview/reedit still works via source snapshot |
| E2E-11 | Open Form/Shatter/Dust/Hologram/Slices/Voxel previews | Six individually selectable presets, each shows distinct user-model-informed scaffold |
| E2E-12 | For each of six presets: change Model, Pattern, Palette; save/reload | Selected model version and authored parameters restored; effect responds visually |
| E2E-13 | For each preset: verify 6 working patterns + Pattern Change + Trigger | No fake options; correct 11 shared triggers; fresh event switching |
| E2E-14 | Play representative audio with kick/downbeat/bar/phrase events; BPM Sync ON/OFF | Basic preview reactivity and timing path works; no independent beat analyzer |
| E2E-15 | Remove/deny a model or expire URL during Cinema 2.0 playback | Safe fallback and meaningful error, no app crash |
| E2E-16 | Switch models and presets repeatedly while monitoring memory/frame times | No persistent leak or unacceptable freezes under documented quality budgets |
| E2E-17 | Return to Media Manager image/video edit, drag/drop, crop, track preview | Existing media workflows unaffected |
| E2E-18 | Test on installed/packaged Electron and Vite browser development | VTracer WASM, GLB export and model preview function in supported products |

## 2. Security + data correctness

- Create two test identities A and B in a **local/staging** Supabase environment. A must not list/read/edit/delete B's model assets, model versions, model collection membership, or objects via signed URL generation or storage path tampering.
- Verify policies on **every** new table and on `storage.objects` for private `model-assets` bucket, including `WITH CHECK` for ownership-changing operations.
- Validate a malicious SVG containing `script`, event handlers, external hrefs and `foreignObject` is rejected or sanitized. Validate corrupt GLB and extreme/oversize geometry are rejected.
- Simulate lost network after blob upload but before DB publish; verify no false `ready` status and cleanup/reconciliation path.
- Confirm concurrent saves to same model version produce deterministic conflict + retry message, not silent lost updates.
- Verify signed URL expiry recovery, deleted storage object behavior and missing/source-deleted recovery.
- No service role keys in browser/renderer, no unauthenticated public bucket, and no arbitrary GLB URLs from user-supplied preset JSON.

## 3. Cinema 2.0 contract review

For each registered new first-party preset inspect **actual compiled schema and production canvas**, not just manifests. Verify:

- One native `three-scene` integration and proper resource lifetime; no overlay renderer or second audio-intelligence pipeline.
- Canonical hierarchy: Design > Master Controls / Design / Effects / Palette.
- BPM Sync has meaningful runtime timing consequence.
- Four Palette controls affect four distinct roles; no unused sliders.
- Pattern, Pattern Change, Trigger in the required order and parent group.
- Six genuinely different working patterns per preset (36 working variations total), not aliases.
- Exactly eleven canonical Trigger options; Trigger conditional visibility; Pattern Change default OFF.
- Manual pattern overrides while Pattern Change ON act immediately and stay until a **new** selected musical event. Auto Performance authority, if implemented, never permanently mutates user's authored pattern.
- Audio behavior is labeled an **early basic reactive scaffold**, not final advanced geometric choreography.
- Reference/preview role maintained until the user's later visual/musical acceptance.

## 4. Performance/regression tooling

1. Run focused model domain, trace, extrusion, GLB round-trip, storage, Media Manager DOM, Cinema native compiler, module/cache/choreography tests.
2. Run `npm run typecheck`, `npm run lint`, `npm run build` and `npm run repo:hygiene`; report actual exit codes. Follow `AGENTS.md` advice about proportional validation; do not waste time on repeated known unrelated failing tests.
3. Execute relevant Playwright smoke tests, *including new real WebGL interactions*, with screenshots/artifacts. Do not treat mocked 2D canvas screenshots as proof that actual 3D renders.
4. Verify Electron `npm run electron:dev` and an appropriate packaging smoke test for packaged WASM/assets; check bundle/installer size delta and any packaging threshold already documented by the project.
5. Repeatedly: generate → change material → rotate → save → reopen → switch model → switch preset → close. Track renderer/context count, Three resource ledger, decoded GLB cache, object URLs and memory. Keep original models and new editor isolated.
6. Verify local/staging SQL migrations against a copy of current schema (not production data), then document rollout/rollback and required Supabase dashboard steps. **Do not reapply previous migrations** or change historical migration files.

## 5. Fix blockers and create deployable handoff

- Fix implementation-introduced test/type/runtime failures. Do not alter unrelated architecture just to silence tests.
- Write/update relevant README/user guidance: how to make a 3D model, supported formats, difference between silhouette extrusion and AI photo reconstruction, how private cloud storage works, how to edit versions, the six **Preview** effects' limitations, and where to later insert the user's authored 3D environment.
- Update third-party notices for VTracer and any additional packages with license/version details.
- Provide a **migration execution guide** indicating exactly how to apply the new `model-assets` bucket/tables/RLS and how to verify they are live. If Supabase credentials are not provided, create the migration and verification scripts but mark deployment pending.
- Produce a compact release matrix separating **Implemented and verified**, **Implemented but needs live validation**, **Deferred (future advanced choreography)**, **Blocked**.

## Final project acceptance checklist

- [ ] Media Manager uses existing user's uploaded images to generate actual 3D models.
- [ ] A properly authenticated user can save/reopen/modify/version/export own 3D models in Supabase.
- [ ] Media Manager center viewer supports rotate/orbit, pan, zoom, fit/reset and safe resource handling.
- [ ] Editing style/color/depth/bevel changes both preview and saved artifact.
- [ ] Six individually selectable Cinema 2.0 reference presets exist and show a real bound model with effect-specific preview appearances.
- [ ] Each registered preset complies with native authoring/inspector/Pattern/Trigger/Palette contract.
- [ ] End-to-end and security checks are shown with execution evidence, not asserted.
- [ ] Existing media manager and Cinema 2.0 keeper presets have no introduced regression.
- [ ] Release handoff accurately labels full advanced audio-reactive geometry effects as **future work**.

## Final report template (fill with actual facts)

```text
IMPLEMENTATION STATUS
- Phase completion: [01 .. 07]
- Repo branch / commit(s): [...]
- Files changed: [group by database / generator / media UI / Cinema2 / tests]
- Supabase migrations: [file names] | applied to [local/staging/prod/not applied]
- Security/RLS verification: [test commands + results]
- Tests: [command] -> [PASS/FAIL/SKIPPED + reason]
- Browser 3D interaction test: [...]
- Electron packaging/WASM test: [...]
- 3D generation fixture results: [...]
- Six preset contract results: [...]
- Performance/resource checks: [...]
- Known limitations / unresolved blockers: [...]
- Future non-scope items: full Shatter/Dust/Hologram/Slices/Voxel choreography, user-authored base environment, AI photo-to-3D
- Exact next steps before declaring production-ready: [...]
```

**If any mandatory gate fails or is untested, report incomplete rather than claiming successful implementation.**
