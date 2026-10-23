# BLOCKSHIFT — Six additional cubes

2026-10-22. The user's request to add six cubes supersedes the earlier nine-object limit. **Current field: fifteen permanent objects — fourteen Hallow Cubes and one Impossible Cube.** Preset revision 10; the normal application entry remains BLOCKSHIFT (Preview).

## Composition and implementation

Original identities `block-00` through `block-08` and their authored seed positions remain. New Hallow Cubes `block-09` through `block-14` occupy left/right forward space, upper/lower forward space and two rear-side positions. The default forward view now contains nine forward objects and six rear objects in the actual uploaded field; rear objects and close peripheral crops are intentional. Object sizes, the camera's position/lens/float controls and the surrounding-space concept are preserved. All new objects participate in the six motion patterns, transitions and existing shared audio reactions.

A fixed `CINEMA2_BLOCKSHIFT_BLOCK_COUNT` of 15 drives identities, module count validation, packing, renderer buffers and instance submissions. The original Impossible Cube remains index 4. The packed array is 180 floats; the Hallow batch contains fourteen records (168 floats), and the Impossible batch one (12 floats). Both material parts reuse the existing two GLB meshes, retaining **four draw calls**, with no duplicated geometry assets or per-object lights. Submitted triangle count is 8,112 (14 × 56 + 7,328).

The native geometry shader and audio routing behavior are unchanged. Existing transformed-box clearance, observer exclusion and 300-unit finite bounds remain in effect. Adding objects does not shrink blocks, change saved Size/Spread values or move the camera outside the field. There is no new count slider or Phase 6 automation.

## Validation and evidence

- **45/45 focused tests PASS:** BLOCKSHIFT Preset, Controls, Motion and Audio. They verify fifteen stable identities, four batches with fourteen Hallow instances, safe control extrema, six animated programs, all pattern-pair transition samples, maximal audio overlays and existing control/event authority.
- **Focused ESLint PASS** on affected source/tests/browser scripts. Scoped TypeScript reports **zero changed-file diagnostics**; the same nine unrelated dependency diagnostics remain. Known failing repository-wide checks were not repeated.
- **Fresh production browser PASS:** normal catalog entry and asset fetches, fifteen actual uploaded objects, wide/square/portrait output, finite surrounding positions, stable stopped pixels, four expected draw calls and balanced GPU resource disposal/re-entry. Camera control visibility, lens effect and persistence continue to pass.
- Actual Stage captures verify all six patterns move with a stationary camera, two transitions, bounded camera float, paused FOV editing, camera OFF and master zero behavior. Audio safety/routing was covered by the focused tests; the entire previous eleven-trigger browser matrix was not unnecessarily repeated for this count-only revision.
- Source/diff and the new normal-application capture were reviewed; `git diff --check` passed. Browser rendering uses Chromium ANGLE SwiftShader, so no hardware performance claim is made. Existing final human/music/release acceptance remains outstanding.

[Normal application view](evidence/fifteen-cubes/production-inspector.png) · [Wide output](evidence/fifteen-cubes/idle-bloom-off-16x9.png) · [Motion recording](evidence/fifteen-cubes/fifteen-cube-motion.webm) · [Acceptance JSON](evidence/fifteen-cubes/acceptance.json).

Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --expanded --p4`. Evidence logs are alongside the captures. Changes remain **uncommitted**, with no commit requested. Phase 6 has not begun. Earlier phase reports/captures remain historical records of the nine-object checkpoint; this revision is authoritative for the current count.
