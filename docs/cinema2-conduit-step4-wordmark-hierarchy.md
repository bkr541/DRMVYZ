# CONDUIT step 4 — wordmark foreground hierarchy

This is step 4 of the [production-match plan](cinema2-conduit-production-match-plan.md). It refines the wordmark's face, recessed depth, and local glow without changing the approved master-SVG contour, tube contacts, chamber balance, floor, LED pattern, or final post-processing grade.

## Changes

- The letter faces remain pearl-white, but use a slightly warmer tint, rougher surface, softer clearcoat, and less uniform studio reflection. The logo key is now slightly off-axis and lower in intensity, so it shapes the face instead of lighting every letter as one flat white plane. The existing ambient/environment response supplies a modest fill, including on low quality.
- The bronze letter sidewalls, outline, backing lip, and plate receive progressively less reflection. The small counters, lower sweeps, and four-point symbol therefore separate from the face without changing their geometry. The existing letter/sidewall shadow-caster and face/plate receiver assignments remain in place for the medium/high-quality key-light shadows.
- The inner gap emitter was narrowed from 0.028 to 0.020 world units and its peak phase reduced from 0.50 to 0.38. The separate outside-lip band and its 0.55 peak were not changed. At full energy this keeps the orange seam from visually adding width to the white strokes while retaining a connected luminous perimeter.
- Regenerated `conduit-wordmark.glb` and refreshed `Cinema2AssetManifest.generated.ts` so the shipped byte/triangle/GPU estimates match the current asset. This also resolves a stale generated-manifest check left by the earlier geometry regeneration.

## Verification

- The master-SVG/GLB native-resolution audit still passes with unchanged overlaps: full body **99.68%**, front face **99.25%**, outline ring **98.36%**. The wordmark and its four tube contacts did not move.
- Five Conduit geometry tests pass, including a new guard that the inner seam's glow peak stays below the stronger outer perimeter. The full asset suite passes **21 tests**; the Conduit and adjacent Three-scene suites pass **28 tests**. Targeted ESLint, `npm run assets:check`, and `git diff --check` pass.
- Browser renders were checked at 16:9 [steady](../artifacts/cinema2-conduit-baseline/run-hGuV5U/reference-16x9-high-steady-baseline.png) and [full-energy peak](../artifacts/cinema2-conduit-baseline/run-z8fk4f/reference-16x9-high-peak-baseline.png), at narrow Stage [steady](../artifacts/cinema2-conduit-baseline/run-h4AYTa/narrow-stage-high-steady-baseline.png) and [peak](../artifacts/cinema2-conduit-baseline/run-fVfvdK/narrow-stage-high-peak-baseline.png), and at [low quality](../artifacts/cinema2-conduit-baseline/run-QMO602/reference-16x9-low-steady-baseline.png). These captures are ignored local diagnostics and can be regenerated with `capture-conduit-baseline.mjs`.
- Repository-wide `npm run typecheck` continues to report unrelated pre-existing errors; no diagnostic names the changed Conduit files. Repository hygiene also fails on already-tracked `coverage/` and `node_modules/` files outside this step's scope; they were not modified or removed.

The wordmark is now more distinct from its backing at rest and at the controlled LED peak. Remaining LED-core/falloff work belongs to step 5, and the pale floor plus final grade belong to step 6. Stop here for requester review.
