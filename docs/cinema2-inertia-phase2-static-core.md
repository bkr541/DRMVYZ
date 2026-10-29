# Inertia — Phase Two static visual core

Date: 2026-10-29  
Status: static implementation accepted by the user's “Approved. Continue.” instruction. [Phase Three controls and motion](cinema2-inertia-phase3-controls-motion.md) are now implemented for review. Inertia remains a **reference/review** preset, not a finished keeper. The report below records the accepted static checkpoint.

## Implemented

- Native WebGL2 point/segment renderer on the real Cinema 2.0 runtime, module registry, scene graph, orthographic camera, target resolver, and render graph.
- One centered spherical point surface; six ordered cube lattice surfaces with shared-border deduplication; eight distinct bright corner anchors; short comb-like ribs attached to lattice edges.
- Three static proof poses: coherent, rotated, and folded. The folded proof applies one shared deformation to cage points, anchors, and rib endpoints. These are hidden diagnostics, not the six future user-facing Patterns.
- Separate native color consumers for lattice, core, anchors, and ribs, plus the shared owned background surface. Color and intensity bindings are hidden at this milestone; no incomplete controls are advertised in the Inspector.
- Fixed camera at `(0,0,4)` aimed at the origin, orthographic height 2, near/far 0.1/10. Native clip-space fit compensates for the camera's vertical orthographic span on portrait targets so the shorter viewport side remains the composition basis. No camera motion or frame-dependent refitting.
- Premultiplied transparent point surfaces read depth without writing opaque shell depth. Cage and core remain mutually visible. Points are sorted back to front; ribs use antialiased screen-width triangles instead of hardware-dependent wide lines.
- Engine-managed renderer acquisition/disposal, GPU byte reporting, allocation-failure cleanup, and quality-dependent regular sampling. No external model/texture/image assets or local musical analysis.

## Static tuning against the reference

The Phase One dimensions were starting values for production-canvas review. Initial captures exposed weak core definition and insufficient cage weight. The static renderer was tuned before the final capture pass:

| Property | Initial proposal | Implemented static checkpoint |
| --- | --- | --- |
| Cage half-extent | 0.45 | 0.50; fills more of the frame while all three proof poses retain safe padding |
| Core radius | 0.26 | 0.26; remains approximately 26% of the shorter viewport dimension |
| Cage/core point diameter at DPR 1 | 1.1 / 0.9 logical pixels | 1.4 / 1.6 logical pixels for legibility through the layered cage |
| Core silhouette | Latitude/longitude samples | Same surface plus a sampled silhouette meridian; no opaque core fill |
| Anchors | Eight, 5px diameter | Unchanged |
| Camera pose | Fixed orthographic | Unchanged |
| Finishing | Restrained/off | No bloom, trails, atmosphere, lighting rig, or post effects |

Balanced topology: **6,138 lattice dots, 2,114 core dots, 8 anchors, and 384 rib segments**. Core count includes 128 silhouette samples. Low/high tiers preserve the same structural identity using different regular sampling counts.

The increased cage extent means Phase Three's Cage Size/deformation range must be fitted against this tuned geometry rather than reusing the original 0.45 radius calculation. Preserve the 0.92 world-space safety budget including sprite extent; do not silently allow the future 1.1 size multiplier to exceed it. All current static proof geometry remains below radius 0.9, with additional visible padding confirmed on the canvas.

The reconstruction intentionally authors six cube surfaces and eight corner anchors. The recording does not establish exact source topology. Point brightness/distribution and the folded proof are reviewable interpretations; this milestone does not claim pixel parity or accepted motion parity.

## Production evidence

The focused runner writes captures and `report.json` to `artifacts/inertia-phase2/` when invoked with that output directory. This folder is ignored by Git; captures remain local and are reproducible with the command below.

- [Baseline](../artifacts/inertia-phase2/baseline.png)
- [Rotated proof](../artifacts/inertia-phase2/rotated.png)
- [Folded proof](../artifacts/inertia-phase2/folded.png)
- [Isolated sphere](../artifacts/inertia-phase2/isolated-core.png)
- [Isolated cage](../artifacts/inertia-phase2/isolated-lattice.png)
- [Isolated anchors](../artifacts/inertia-phase2/isolated-anchors.png)
- [Isolated ribs](../artifacts/inertia-phase2/isolated-ribs.png)
- [Landscape](../artifacts/inertia-phase2/1280x720.png) / [portrait](../artifacts/inertia-phase2/720x1280.png)
- [Technical report](../artifacts/inertia-phase2/report.json)

Canvas coverage: hero visibility; all four isolated native parts; core centeredness and diameter; distinct rotated/folded geometry; fixed output across later RAF frames; zero-intensity black output; square/landscape/portrait bounds and proportions; deterministic fresh-runtime recreation after disposal; no module/effect/browser errors. Twelve captures include static-held, intensity-off, and recreated checkpoints. This proves static recreation, not the later full music/preset-switch lifecycle contract.

The author visually inspected the final baseline and folded production captures for core silhouette, ordered lattice rows, anchor visibility, composition, and deformation. The user's visual comparison/acceptance remains pending. No soundtrack BPM or recovered source audio mapping is claimed.

## Validation

Passed:

```sh
npx tsc --noEmit --pretty false
npx vitest run --config vitest.node.config.ts src/components/vyzualz/cinema2/__tests__/Cinema2InertiaStatic.test.ts
node scripts/run-cinema2-inertia-browser.mjs artifacts/inertia-phase2
```

The focused Vitest file has three tests: unique/bounded geometry for every proof pose and quality, balanced topology and folded structure, and compilable reference registration without later-phase behavior. Targeted ESLint passed for all newly added TypeScript/JavaScript, and `git diff --check` passed. Broad builds and repository-wide tests were not needed for this milestone.

The canvas checks used headless installed Chrome against Vite and the real runtime at balanced quality/DPR 1. Geometry invariants cover all quality tiers; rendered quality-tier/DPR variants and actual Inspector behavior belong to Phase Three and later acceptance. Frame-time snapshots are diagnostics, not a performance guarantee.

## Review and next scope

Review the baseline, rotated, and folded captures against `/Users/kodyrobinson/Desktop/Inertia.mov`. Once the static composition is accepted, Phase Three adds the six real Patterns, camera/framing acceptance, user-facing manual controls (including all required shared controls and palette), timing, and visible motion. Shared music, Choreography, Director, Auto Performance, and finishing remain in their separately approved phases.

No commit was requested or created. The new implementation, Phase One specification, this report, tests, and harness remain uncommitted. Existing presets are unchanged; the only shared source edits are additive native-module and reference-preset registrations.
