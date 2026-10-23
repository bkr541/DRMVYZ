# P2 — Static native production-render gate

Date: 2026-10-22. Branch: `main`; base commit `9c2aa74831103c1589e589c8cedc5af5f94f1643` plus uncommitted P0–P2 changes. User authorized the next phase after reviewing the larger-block reference; this is recorded as approval to implement P2. No P3 controls, P4 patterns, audio, or automation have been implemented.

## Result / gate

**P2: PASS / GO for the static native render milestone.** Nine stable, opaque 3D cubes at the approved 1.35-unit default render on the actual Cinema 2.0 workspace canvas with no audio, motion, bloom, or other effects. Each cube has physical triangle-prism edges, readable shaded faces, and world-space depth. All nine silhouettes remain on canvas at 16:9, 1:1, and 9:16, and stopped frames have identical decoded pixels.

This is not a released keeper. Per P2 task 5, registration uses an explicitly test-only production-UI entry while required controls and subsequent phases are incomplete. The normal first-party preset catalog is unchanged; the module implementation is registered once in the native module registry. P3 may proceed when requested. **Overall release decision: NO SHIP until remaining phases and human production visual acceptance pass.**

## Implementation and ownership

| File / seam | Purpose |
|---|---|
| `modules/blockshift/Cinema2BlockshiftDomain.ts` | Nine immutable typed IDs, row/column addresses, edge groups, larger defaults, five material roles, and geometry-range validation. |
| `modules/blockshift/Cinema2BlockshiftLayout.ts` | Approved static phase-0 Stagger positions, finite bounded packing, clearance/framing checks, stable instance ordering. No six-pattern evaluator or motion controller yet. |
| `modules/blockshift/Cinema2BlockshiftRenderer.ts` | Native WebGL2 closed cube faces and twelve edge prisms; two indexed instanced draws, no frame-by-frame GPU allocation, cleanup including setup failure. |
| `modules/Cinema2BlockshiftNativeModule.ts` | `blockshift-native@1`, lazy host-owned renderer lease, final camera/depth requirements, GPU byte reporting, lifecycle and typed concrete inspection helper. No private RAF or audio processing. |
| `modules/Cinema2ModuleRegistry.ts` | One validated module registration using the existing fail-on-invalid convention. |
| `presets/Cinema2BlockshiftPreset.ts` | Minimal native schema-v1/revision-1 manifest, world scene/layer, standard perspective camera, scene color/depth target, static palette/background. |
| `__tests__/Cinema2BlockshiftPreset.test.ts` | Compiler/reference-authoring gate, identity/safety, projection, instancing, disposal, partial failure, and module lifecycle tests. |
| `src/test/browser/Cinema2BlockshiftProductionBrowserHarness.tsx`, `cinema2-blockshift-production.html` | Test-only registration followed by the real `VyzualzView` and `AudioEngineProvider`; no substitute scene renderer. |
| `scripts/run-cinema2-blockshift-browser.mjs`, `package.json` | Build/serve the production workspace entry, choose BLOCKSHIFT through its real preset card, capture three aspect ratios, verify pixels and GL calls/resources. |

Cinema2 paths in the table are relative to `src/components/vyzualz/cinema2/`. Public source files are not exported into an unfinished keeper catalog. There are no preset-specific Inspector/audio-bridge branches, imported models/textures, physical lights, floor, post effects, or backend changes.

## Actual production evidence

- [Full workspace and selected preset](evidence/p2/production-workspace.png)
- [1920 × 1080 / 16:9](evidence/p2/idle-bloom-off-16x9.png)
- [1080 × 1080 / 1:1](evidence/p2/idle-bloom-off-1x1.png)
- [1080 × 1920 / 9:16](evidence/p2/idle-bloom-off-9x16.png)
- [Machine-readable acceptance](evidence/p2/acceptance.json)
- [Production bundle and browser log](evidence/p2/browser-build-and-acceptance.txt)
- [Focused unit test output](evidence/p2/focused-tests.txt)
- [Focused type diagnostics](evidence/p2/focused-types.txt)

The browser entry mounts the actual application workspace. Its selector enters BLOCKSHIFT via `[data-cinema2-preset-id]`, and captures come from `[data-cinema2-output-canvas]`. For exact aspect captures, test CSS expands that same stage to the viewport; it does not replace its camera, renderer, render graph, or module. The full workspace screenshot is captured before this framing CSS is applied.

Browser checks instrument the real WebGL2 API for observation only. Each static frame ends with body draw `(36 indices, 9 instances)` and edge draw `(432 indices, 9 instances)`. Pixel components identify nine disconnected rendered outlines at each aspect, with margins on all sides. Decoded RGB pixels remain identical across subsequent stopped frames. Buffer creation counts do not grow per frame. Preset exit/re-entry preserves total live buffer/VAO/program counts, and the page reports no captured errors or GL errors. Unit tests separately verify the actual engine resource scope releases the renderer exactly once.

Visual inspection covered all three saved aspect captures: solid faces, three-dimensional edges, nine readable cubes, no clipping. These are observed native output, not the P1 diagram. Human final aesthetic/motion approval is still a later gate.

## Validation actually performed

| Check | Outcome / limits |
|---|---|
| BLOCKSHIFT focused Vitest | **10/10 PASS** in the final focused run. |
| Neighboring Depth tests | **23 PASS** during the initial combined run; not repeatedly rerun after BLOCKSHIFT-only fixes. |
| TypeScript program rooted in the seven new BLOCKSHIFT source/test/harness files using project compiler options | **0 changed-file diagnostics**. Existing transitive dependency diagnostics remain; this is not a repository-wide typecheck pass. |
| Focused ESLint on the new TypeScript files, module registry, and browser script | **PASS**. |
| Production browser-entry Vite build | **PASS**, 2,128 modules transformed; existing large-chunk warning recorded. |
| Chromium production-UI acceptance | **PASS**, three aspect ratios, resize, static pixels, draw counts, no per-frame buffers, preset exit/re-entry. |
| `git diff --check`, new-file whitespace/link review | PASS at handoff. |
| Full `npm run typecheck` / `npm run build` | Not repeated: known pre-existing TypeScript baseline from P0 blocks the full build's `tsc` step. Harness bundling succeeding does not clear that baseline. |

Commands:

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH ./node_modules/.bin/vitest run \
  src/components/vyzualz/cinema2/__tests__/Cinema2BlockshiftPreset.test.ts --reporter=default
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run test:e2e:cinema2-blockshift:p2
```

Focused lint selects `modules/blockshift/*.ts`, `Cinema2BlockshiftNativeModule.ts`, `Cinema2ModuleRegistry.ts`, `Cinema2BlockshiftPreset.ts`, `Cinema2BlockshiftPreset.test.ts`, the production harness, and the browser script. Type checking used TypeScript's `createProgram` with those seven new TS/TSX files as roots and the repository's parsed tsconfig options; its saved output distinguishes new-file errors from transitive baseline errors.

## Calibrations and deviations

1. **Physical edge width:** increased from proposed 0.018 to 0.04 units per unit cube. Initial actual output had subpixel gaps; the wider closed prisms keep visible front outlines connected without bloom. Centers keep outward protrusion inside the conservative sphere envelope. The P1 specification records this calibration.
2. **Fixed P2 Quality baseline:** the minimal manifest contributes the existing engine quality parameter as a hidden runtime-only `quality` value. Auto Quality on SwiftShader changed render-target resolution and static rasterization during captures. No new quality engine was added. P3 will expose the existing shared control normally; auto/performance-tier visual hardening remains P7.
3. **Current UI:** the older Afterhours harness's engine-dropdown selector refers to a hidden control in the current workspace. This entry starts in Cinema 2.0 and selects the visible BLOCKSHIFT preset card directly.
4. **Environment:** Node 22.23.3, macOS arm64; Chromium 149.0.7827.55 with ANGLE SwiftShader. The initial sandbox denied the local server; the approved local server/browser execution succeeded. No automatic approval rejection remains.

## Performance, remaining work, and requirement coverage

The sculpture uses **2 draw calls**, **0 physical lights**, and **8,712 bytes of geometry/index/instance buffer storage** (shader/engine framebuffer storage excluded; runtime reports its actual renderer estimate). No performance timing claim is made from software-rendered acceptance. Hardware p50/p95, sustained memory, context-loss recovery, all six animated patterns, control-to-pixel tests, music fixtures, Auto Performance authority, and human final review belong to later phases.

BS-R01: manifest/module compilation verified, public keeper release intentionally pending. BS-R02/R03: static native world/depth rendering and stable identities verified. BS-R18: static engine camera and three aspects verified; effects deferred. BS-R19: P2 batching/resource/disposal checks verified; full P7 lifecycle/performance work pending. Remaining requirement IDs are not marked complete.

Files changed are limited to the implementation/test/harness seams listed above and the planning/evidence package. Existing P0/P1 documents and the larger-block revision remain uncommitted alongside P2. No commit was requested or created. No P3 implementation is included.
