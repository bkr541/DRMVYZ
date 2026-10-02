# CONDUIT step 2 — master-SVG wordmark geometry

This step changes only the SVG-to-GLB wordmark geometry and its reproducible audit. It does not change Conduit's materials, lights, bloom, floor, or camera. It follows [step 2 of the production-match plan](cinema2-conduit-production-match-plan.md).

## Authority and method

The supplied `wordmark_clean_master.svg` and the repository's `scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg` have the same SHA-256: `0ac33e757c07ed5e13b04b72d8c5f90403628531adb4632973729fd05df566f9`. The master was not redrawn or replaced.

`scripts/cinema2-assets/audit-conduit-wordmark.mjs` projects the **shipped GLB's actual indexed triangles** straight onto the master's native 2006 × 585 canvas. It renders the eight master body paths and even-odd outer ring as browser `Path2D` masks, separately from the GLB letter faces, letter sidewalls, and frame. This is an unlit, orthographic, front-on geometry comparison: no perspective, shadows, environment, emission, bloom, or color grade. The overlay is gray where masks agree, magenta where only the SVG exists, and cyan where only the model exists. It also compares the flattened cubic curves path by path, so a Bézier sampling problem can be distinguished from a bevel/mesh problem.

Run the acceptance audit from the repository root:

```sh
node scripts/cinema2-assets/audit-conduit-wordmark.mjs --assert
```

It creates a new ignored `artifacts/cinema2-conduit-wordmark-audit/run-*` directory with PNG overlays, raw metrics, and an index. The `--assert` check pins the master hash and checks native-resolution body, front-face, frame, and individual-path overlap thresholds. The baseline local review run is `run-rEmTyH`. The final `run-CFZT1D` was made with `--master=` pointing directly to the supplied Desktop SVG and passed the same thresholds.

## What the overlay found and what changed

| Native-resolution mask | Before | After | Interpretation |
| --- | ---: | ---: | --- |
| SVG cubic curves vs flattened body contours | 99.55% | 99.75% | Replaced fixed 8–9 samples per curve with adaptive subdivision bounded to 0.35 master-SVG pixel. |
| Master body vs projected 3D letters and sidewalls | 96.11% | **99.68%** | Reduced the letter bevel from 0.042 to 0.008 world units. This removed the visible triangular protrusions at tight cusps, counters, lower sweeps, and the four-point symbol without moving the source outline. |
| Master body vs white front faces and bevel | 95.65% | **99.25%** | The remaining slight inset is the intentional front bevel; the full visible body silhouette above is the contour fidelity gate. |
| Master even-odd ring vs projected frame | 96.74% | **98.36%** | Reduced the frame bevel from 0.006 to 0.0035 units, retaining a narrow dimensional edge without fattening or erasing the source ring. |

These are binary-mask intersection-over-union scores, not a perceptual production-image score. Residual differences are mostly subpixel rasterization along long curves and the retained bevel; the final overlay no longer shows the former large cyan corner spikes. Every body path's independent sampled-contour overlap exceeds 99.6%. The ring is only about ten native pixels thick in many places, so a one-pixel antialiasing difference has a larger effect on its percentage than on the broad letter bodies. The dark backing lip and glow band intentionally sit outside the SVG's ring and are **not** counted as part of the SVG contour; their brightness and hierarchy belong to later visual steps.

The generator now records its source-space bounds and curve tolerance in `scripts/cinema2-assets/conduit-layout.json`. This keeps the audit's orthographic alignment exact and makes the source-to-world transform reviewable. The shipped `public/cinema2/models/conduit-wordmark.glb` was regenerated. `generate-conduit-tubes.mjs` was rerun against the layout; the four attachment coordinates and resulting tube GLB remained byte-identical, so the sockets did not need repositioning. The chamber asset was untouched.

## Review refinement: pointed inner hook

The requester spotted an amber wedge in the small pointed opening of `left-inner-body`. The unlit body overlay showed that the **opening itself is in the approved SVG** and that the white face and 3D sidewalls still match it; changing the letter contour would have damaged source fidelity. A separate front-on `rim` footprint exposed the actual issue: the old polygon-with-hole glow-band extrusion had a long triangulation bridge across the tight notch. That filled much of the negative space with emissive geometry and made its apparent inner edge far thicker than its neighbors.

The glow band is now assembled from short, paired contour quads. Its triangles cannot span a letter opening, including at that sharp hook; the existing contour, letter extrusion depth, bevel, and outer outline remain unchanged. The regenerated GLB preserves the body/face/ring overlaps of **99.68% / 99.25% / 98.36%**. The `rim-mask.png` diagnostic in `artifacts/cinema2-conduit-wordmark-audit/run-ivq6h9/` shows a narrow band around the hook rather than a filled wedge. The actual 16:9 high-quality scene and isolated-wordmark captures are in `artifacts/cinema2-conduit-baseline/run-xKvDOY/` for visual review. This correction remains within step 2; later lighting, material, and floor work remains deferred.

## Validation and review boundary

- `node --test scripts/cinema2-assets/conduit-geometry.test.mjs`: approved master hash, adaptive source bounds/even-odd ring, all four tube contacts, outer glow, and local-rim-triangle checks pass.
- `node scripts/cinema2-assets/audit-conduit-wordmark.mjs --assert`: native-resolution SVG/GLB masks pass.
- `npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2Conduit.test.ts`: eight Conduit tests pass.
- A real Cinema 2.0 browser capture was reviewed at 16:9 and square Stage sizes after regeneration; all four tube couplers still meet the perimeter without covering the white letter faces. The local capture is `artifacts/cinema2-conduit-baseline/run-JMTa8b/`.

This step is ready for requester review. The white face may now look flatter/brighter because less of it is consumed by bevel; its lighting and material hierarchy are deliberately left for steps 3–5. The floor remains untouched for step 6.
