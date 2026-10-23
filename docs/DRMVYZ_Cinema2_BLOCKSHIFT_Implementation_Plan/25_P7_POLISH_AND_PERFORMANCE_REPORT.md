# BLOCKSHIFT Phase 7 — Bloom, camera framing and performance hardening

2026-10-22. Preset revision 13; fifteen stable objects, fourteen Hallow Cubes and one Impossible Cube, retain the approved scale, spacing, manual authority and observer-centered composition. Branch `main`, base `9c2aa74831103c1589e589c8cedc5af5f94f1643`. All work is uncommitted; no commit was requested.

## Visible change

**Effects > Scene > Bloom** is now available, range 0–1, default 0.30. It controls the existing engine-owned HDR bloom intensity. A restrained halo lifts the cyan/violet frames while the matte faces and black space remain readable. The scene uses an HDR `rgba16f` color target with the engine's explicit `rgba8` fallback, then one bloom pass to output. Four small mip levels, threshold 0.18, knee 0.12 and spread 0.35 keep the glow local to bright frames. Bloom zero removes the glow exactly; Master Intensity zero remains dark, even with Bloom at maximum.

No atmosphere, grain, extra lights or tone curve were added: the approved empty surrounding space and authored colors already supply the intended depth. Geometry remains readable with Bloom off. Finishing never moves or scales the cubes, changes their hues or overrides a user control. Existing Auto Performance has no route to the Bloom parameter.

The approved float/orbit speeds, camera controls, lens range and framing are retained after validation. No outside camera or automatic fit of all fifteen objects was introduced. Large peripheral crops and rear objects remain intentional. Tests now cover a full camera turn at maximum float/speed, minimum/default/maximum FOV and three aspects, across all six patterns at tight spacing/maximum size; the eye and near plane remain outside the object envelopes. Camera Motion OFF still restores the forward base view.

## Performance and lifecycle work

The shared HDR bloom effect now bypasses mip-chain allocation/resizing when intensity is zero. An already warm chain stays available for reuse and is rebuilt on the next enabled render if dimensions change; disposal/context loss retires it. A new zero-bloom runtime does not allocate it. A focused test checks zero allocation, warm reuse, resize while zero, later rebuild and complete disposal. No private renderer, light stack, timer or musical detector was added.

The production browser probe tracks native batching, shader failures, all GPU object classes, allocation bytes including the effect's private mip surfaces, shared CPU/GPU timing and quality scaling. Repeated normal-app preset switches check disposal and stable object counts. Three fixture runtime recreations check all stable GPU classes and bound pending timer queries. Real `WEBGL_lose_context` loss/restoration must advance the generation, preserve saved controls, recreate native geometry/effects and reproduce the stopped canvas exactly.

## Validation

- **59 unique focused tests PASS**: the initial six-file run passed 58 tests; the expanded Motion/HDR suite passed 14 tests, including the additional full-turn/aspect/lens camera safety test. Existing Audio and Auto Performance authority tests remain included.
- **Focused ESLint PASS.** Scoped TypeScript: **zero changed-file diagnostics**, the same nine unrelated dependency diagnostics. No broad failing repository typecheck was repeated.
- **Fresh production build and focused browser PASS.** All eighteen pattern/aspect cases have visible native hero geometry with Bloom off and visibly different glow at default. Bloom min/default/max differ and zero restores exact pixels; GPU instance transforms/hues remain identical. FOV extremes with maximum float/orbit remain bounded; camera OFF and intensity zero remain authoritative. Three normal-app preset switches and three runtime recreations show stable GPU counts. All shaders compile; no GL/runtime/effect failures occurred. Real context loss/restoration advances generation 1→2 and reproduces the stopped authored scene exactly.

Reference hardware: **Apple M3 Pro**, Chromium **ANGLE Metal**, **1920×1080 / DPR 1**, Bloom 0.30, synthetic bass profile and active native motion. Each tier has 50 measured samples after ten warm-up samples. Shared GPU timer queries are available. These short local samples characterize this fixture; they are not an all-track, 4K or cross-device frame-rate guarantee.

| Mode | CPU median / p95 | GPU median / p95 | Estimated GPU allocations including bloom |
|---|---|---|---|
| Quality | 0.90 / 1.10 ms | 2.14 / 2.25 ms | 34.48 MiB |
| Balanced | 0.90 / 1.30 ms | 2.00 / 2.07 ms | 26.71 MiB |
| Performance | 0.90 / 1.20 ms | 1.91 / 2.04 ms | 21.40 MiB |

The measured RAF median was 8.3 ms on this host. Native geometry stays at **four instanced batches**, fifteen objects, **252,480 GPU bytes**; total GPU byte estimates include render targets, depth storage, geometry buffers and bloom mip surfaces, but exclude driver overhead. No steady-state buffer/VAO/program/shader/texture/framebuffer/renderbuffer allocations were observed. Live counts with Bloom on: 10 buffers, 4 VAOs, 5 programs, 0 retained shader objects, 9 textures, 9 framebuffers, 1 depth renderbuffer; pending timer queries remain bounded. An expanded lifecycle assertion initially treated fewer resources after retiring a warm zero-bloom chain as a failure. It now verifies no growth on first re-entry and identical counts on subsequent re-entries; the completed acceptance passed with the existing production build.

[18-case contact sheet](evidence/p7-polish/patterns-aspects-contact-sheet.png) · [Bloom comparison](evidence/p7-polish/bloom-comparison.png) · [Recording](evidence/p7-polish/phase7-polish.webm) · [Hardware/effects/recovery results](evidence/p7-polish/polish-acceptance.json) · [Normal workspace/lifecycle results](evidence/p7-polish/acceptance.json).

Source, working tree and the actual canvas captures were reviewed; `git diff --check` passed. **Gate P7: PASS for the scoped milestone and user review. STOP at Phase 7; Phase 8 has not begun.** No keeper/release promotion is claimed.

Reproduce with Node 22: `node scripts/run-cinema2-blockshift-browser.mjs --p7`. On this macOS reference host it requests Chromium ANGLE Metal; the recorded renderer identifies the actual device. `--software` selects the existing SwiftShader fallback for functional checks, without implying hardware performance. The browser uses the normal first-party catalog/Inspector and actual native runtime/rendering, with controlled-clock synthetic upstream audio for deterministic profiling.

## Files and remaining acceptance

Production changes: `Cinema2BlockshiftPreset.ts` exposes/binds Bloom and adds the HDR target/post pass; `Cinema2HdrBloomEffect.ts` avoids zero-intensity mip work. Validation changes: focused Bloom/Controls/Preset/Motion tests, browser fixture diagnostics/resize/quality access, `cinema2-blockshift-polish.mjs`, current-manifest expectations in existing browser helpers, the production browser runner and package command. Planning README/control/phase status and this evidence report are updated. Earlier reports/evidence remain historical; the root creation contract's existing user edits are preserved.

Phase 8 full production/regression acceptance, human visual approval and Phase 9 keeper/release sign-off remain outstanding. The preset stays **BLOCKSHIFT (Preview)**.
