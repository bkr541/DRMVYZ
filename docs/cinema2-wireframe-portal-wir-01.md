# Wireframe Portal WIR-01

The supplied archive contains the SYS-04 quality-review and SYS-06 release harnesses. The review DOCX and original recording were not supplied. This implementation is based on the WIR-01 prompt and source, not an approved visual reference.

## Visual design and authority

The original 28 cells, truss mesh, connecting topology, six programs and shared beat/Pattern/Mood/Choreography logic remain. Primary bays now occupy a staggered formation, with smaller, deterministic satellite trusses interleaved across the foreground, shoulders and receding tiers. The original core/edge lighting is retained, with additional diagonal brace detail driven by the existing Edge Runs/high-band channel. Satellites follow the same program at a reduced travel/rotation amplitude. A 4.2 world-unit cap on primary combined pattern/drop translation keeps the strongest simultaneous cues bounded. The three instance batches reuse the existing rail, joint and bar geometries and are disposed by the existing scene owner. No new local musical detector, clock, asset or dependency is introduced.

| Design > Structure control | Default | Range and units | Ownership / effect |
|---|---:|---|---|
| Spatial Spread | 1 | 0.95–1.2, dimensionless | User-owned; changes X/Y spacing of primary and satellite trusses without scaling the individual boxes |
| Structural Density | 1 | 0–1, fraction of tier budget | User-owned; changes active secondary truss count (0–16 high, 0–8 medium, 0–4 low); zero retains all 28 original primary bays |
| Depth Distribution | 1 | 0.95–1.2, dimensionless | User-owned; changes Z spacing about the fixed formation centre independently of X/Y |

Existing camera distance and FOV ranges and IDs are preserved; new/reset defaults are 23 world units and 52 degrees (formerly 14.5/44). Existing explicitly saved values continue to apply. Director and Flythrough now use wider orbits and elevated grazing lanes instead of flights through occupied cells; this is an authored change in camera composition. Kick FOV punch is reduced from 1.4 to 0.8 degrees. Near-eye bays, satellites and connecting segments are omitted to avoid extreme foreground clipping; this is not a full geometry collision solver. Depth focus is broadened to preserve layered structural detail. High/medium/low beam budgets are 10/6/4 with azimuth-distributed fixture selection, versus 12/8/4; the 12 fixture IDs remain. Three satellite batches add at most three draw calls when nonempty, before render-pass multiplication; the low tier omits braces. This is an architectural bound, not a measured GPU benchmark. Existing parameter IDs, ranges, manifest revision, source asset and pattern IDs are unchanged; new settings use authored defaults when absent.

## Verification and remaining acceptance

Source-derived numerical checks using transpiled production functions: primary centre extents (X/Y/Z) increased from 9.92/4.96/9.92 to 13.78/7.06/13.56 world units; with high-tier satellites, the resting centre extents are 20.1/12.6/19.6. Minimum resting satellite-to-primary centre separation is 3.75 units at default layout. All six original pose signatures differ and Detonate still expands and contracts. These measurements are centre coordinates, not projected screen coverage, collision guarantees or rendered results. TypeScript transpilation syntax checks passed for modified TS files; the existing dependency-free release policy tests passed (5 tests).

Dependency installation was blocked (`EAI_AGAIN` online registry DNS, `ENOTCACHED` offline). `npm run typecheck` and `npm run build` stop at missing `vite/client`; the targeted Vitest invocation cannot resolve Vitest; the production release harness cannot import `@playwright/test`. No baseline/after WebGL capture, timed GPU measurement, Electron run, thumbnail update or human visual approval was performed. The patch adds regression tests for layout controls, tier counts, near-eye visibility and satellite program/paused transforms, and extends the existing production browser control sweep for all three new sliders specifically for this preset.

After installing dependencies on the development machine, run:

```sh
npm run typecheck
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2WireframePortal.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2WireframePortalPerformance.test.ts
npm run build
npm run test:e2e:cinema2-release -- --presets crate-wireframe-portal
```

Capture the same release fixture on the unmodified baseline and patched checkout. Review idle/build/drop silhouette, all six patterns, each tier, max spread/depth/density, manual camera at the existing range limits and saved legacy camera values. Check spline travel and near-eye culling for popping or intersections during maximum Detonate/blast, compare frame timings and GPU memory on equivalent hardware, and use the verified actual render for catalog artwork only after approval. Do not treat the numerical checks as visual acceptance.
