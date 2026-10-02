# CONDUIT step 3 — chamber and tube tonal separation

This is step 3 of the [production-match plan](cinema2-conduit-production-match-plan.md). It changes the authored Conduit material and light balance in `Cinema2ConduitPreset.ts`; it does not change the master SVG, generated geometry, LED pattern/emission, floor effect, bloom, global exposure, or final grade.

## Changes

- Moved the raised `shell` and `hull` from pale cream toward midtone brushed metal. `steel` panel floors and the `iris` are darker and rougher, retaining the existing near-black `trim` tracks. Their environment-reflection shares are lower, so the front studio no longer lights each surface equally.
- Reduced broad reflection on the tube `pipe`, `coupler`, and `flange` materials while preserving a smooth metallic highlight on their curved surfaces. The LED windows and dark channels were not recolored.
- Narrowed and dimmed the two front-side studio panels, reduced the two half-wall washes and ambient fill, and retained the focused logo key. This lowers front-facing wash locally without lowering scene exposure.
- Reordered the non-ambient lights for the runtime's low-tier two-light limit: the logo key comes first, followed by a weak, symmetric broad wall fill. Medium/high add the paired half-wall washes and music-reactive energy lights. The centre fill is intentionally weaker than either side wash to avoid a central wall hotspot.
- Did not reassign chamber geometry materials: the existing `shell`/`hull`/`steel`/`iris` segmentation produced distinct raised and recessed values after the material and light correction.

## Verification

- `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Conduit.test.ts` passes nine tests, including light order, paired wall-wash symmetry, and raised/recessed material relationships.
- The adjacent Three-scene suite passes 18 tests; targeted ESLint and `git diff --check` pass. Repository-wide `npm run typecheck` still fails on pre-existing errors elsewhere in Cinema/Cinema 2.0/browser test files; none of its diagnostics name the changed Conduit preset or test after the local test type was corrected.
- Final locked-camera, steady-energy browser captures: [low](../artifacts/cinema2-conduit-baseline/run-XI3JF9/reference-16x9-low-steady-baseline.png), [medium](../artifacts/cinema2-conduit-baseline/run-BGYBzi/reference-16x9-medium-steady-baseline.png), [high](../artifacts/cinema2-conduit-baseline/run-y8PmrZ/reference-16x9-high-steady-baseline.png). These diagnostic artifacts are git-ignored and local; regenerate with `capture-conduit-baseline.mjs` if needed.
- The capture harness needed a 120-second readiness allowance for the high-quality software-browser render. One earlier combined run and one 60-second single-frame run timed out before readiness; the final separate high-quality capture completed and was visually checked.

The raised portal is still intentionally lighter than the recesses, but it no longer dominates every wall surface. The pale floor is unresolved by design and belongs to step 6. Letter-face material/foreground hierarchy remains step 4; LED core/falloff remains step 5. Review this step before changing either.
