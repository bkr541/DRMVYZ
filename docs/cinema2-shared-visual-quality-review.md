# Cinema 2.0 SYS-04: visual quality review

Scope: the seven native presets explicitly identified by the supplied SYS-04 source anchors (COLOSSUS, EXOSKELETON, SERAPH, PARADOX, RELIC, MONOLITH and HONEY). The original review DOCX and recording were not supplied with the implementation archive. This is a source-derived inventory, not a finding that any particular scene fails visually. SYS-03 is present in the baseline (`docs/cinema2-shared-camera-pattern-authority.md`); this workflow does not change its authority. No production manifest, preset, Inspector, palette, camera, or renderer default is changed.

## Running the review

Install the repository's existing dependencies and Playwright Chromium (`npm ci`, `npm run playwright:install`), or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a compatible Chrome executable. From the repository root:

```sh
npm run visual:cinema2:quality-review -- capture --presets colossus,honey --modes authored,manual,auto
# Entire anchor inventory, optionally including portrait output:
npm run visual:cinema2:quality-review -- capture --aspects landscape,portrait
node --test scripts/cinema2-assets/quality-review-core.test.mjs
```

The isolated browser uses the real `Cinema2Runtime`, registry, shared Audio Intelligence bridge, Director, Mood and Choreography; no alternative detector, fake scene or illustration. It never opens a user's project or media library. Each preset/mode/aspect has a fresh page/runtime. Authored mode leaves reset defaults untouched, manual and auto modes only edit the isolated runtime's Auto Performance toggle. The serialized state is compared before/after each capture. The no-track reference and idle frames precede a deterministic 120 BPM test publication: 2 seconds of build, 2 of drop, 2 of breakdown, with onset and intermediate captures, 30 Hz fixture progression. This is a short representative sequence, not a recorded song or evidence of all musical transitions. Pattern vocabulary and camera definitions are extracted directly from the compiled manifest; active module inspections and Director snapshots accompany each capture. Alternate aspect is an explicit review of the output viewport, not an assumption that a camera changes its authored minimum aspect. Review each crop against scene intent.

Reports and numbered PNGs are saved under `artifacts/cinema2-quality-review/run-*/<preset>/<mode>/<aspect>/` (ignored by Git). Each report contains configuration, native metadata, scene-specific subject notes, capture hashes, per-frame diagnostics and CPU callback durations (not GPU benchmarks), and pending criteria. Uniform output, renderer/GL errors, failed passes/modules, known unready modules and parameter mutation are flagged. Low mean luminance alone is never a failure. Uniform intentional blackout requires investigation with adjacent frames; it is not eligible for thumbnails. Spatial variation alone does not prove a meaningful image. Read diagnostic flags and inspect actual captures. Asset readiness is bounded and diagnostics-dependent; if asset loading is slow or incomplete, rerun on a suitable machine. A nonzero capture exit indicates a technical failure or incomplete record, not a subjective design score.

## Scene-specific rubric

`quality-review-core.mjs` stores the signature subject, foreground, midground, background, silhouette, selective lighting and scene-specific caution in that order. Camera and pattern vocabulary are recorded from the production manifest rather than hardcoded. Use these notes against every criterion below; never impose the same coverage or brightness target on different scenes.

| Criterion | Evidence required |
| --- | --- |
| Subject legibility | Can the signature be identified in reference, idle, build and drop? COLOSSUS has four arms, EXOSKELETON a segmented shell, SERAPH six wings, PARADOX interwoven ribbons, RELIC a skull, MONOLITH radial trusses, HONEY beveled hex cavities. |
| Intentional negative space | Does the space support that silhouette or aperture? A model aperture or HONEY's dark cavity can be a deliberate compositional feature. |
| Depth/parallax | Separate the inventoried foreground, midground and background. Check camera and local motion across sequential frames, not just brightness differences. |
| Selective lighting | Highlight meaningful joints, seams, truss paths, sockets or bevels per inventory; retain shadow depth. |
| Pattern distinction | Compare visible structural action against named pattern and module diagnostics. If the short sequence does not expose the full library, use the existing preset-specific browser tests and cite those captures in the record. Do not pass on color-only changes. |
| Media fidelity | Confirm supplied assets retain material/aspect/alpha where supported. This fixture has no private media; mark not-applicable only with a reason and review supplied media separately before claiming fidelity. |
| No clipping | Check each focal silhouette and motion extremum; intentional repetition/cropping of HONEY tiles is not clipping of the focal subject. Check portrait independently if captured. |

## Before/after and catalog publication

Capture the baseline before the local preset changes and a candidate after, using identical fixture, preset, mode, viewport, quality and authored parameter values. Keep both run directories. For each preset/mode/aspect pair:

```sh
npm run visual:cinema2:quality-review -- compare /path/before/report.json /path/after/report.json /path/review.json
```

The comparison rejects mismatched configurations, metadata or authored values; it records paired frames, hashes and pixel diagnostics without awarding visual approval. For a redesign involving intentional metadata/default changes, document them and capture a matched configuration separately rather than treating unlike runs as an A/B. Review the paired PNGs in order, enter `pass` or `fail` for each criterion with evidence (frame names and observations) and reason. Only media fidelity may be marked `not-applicable`. Enter reviewer, ISO approval date and decision `approved` only after actual review; select `thumbnailFrame` from a nonblank candidate PNG. Failed/pending review is retained as evidence, not published. For deeper numerical pixel comparisons use the existing `visual:compare-captures` script. Compare timing arrays on equivalent hardware and quality; they are CPU submission/callback times, not validated GPU frame rate.

```sh
npm run visual:cinema2:quality-review -- publish-thumbnail /path/before/report.json /path/after/report.json /path/review.json
```

Publication verifies report and PNG hashes, matching conditions, complete error-free candidate, dated reviewer approval and all seven criteria. It accepts landscape captures only, writes the existing `public/preset-artwork/drmvyz.cinema2.<id>.webp` path consumed by `PresetBlueprintImage`, and does not automatically promote the preset or change registry metadata. Review the resulting card, then stage only the intended verified WebP. Existing runtime fallback remains unchanged. This tooling does not claim to have updated a thumbnail until publication actually occurs.

## Verification on supplied archive

- Dependency-free Node policy tests: 4 passed (dark/flat distinction, local signatures and phase coverage, comparison settings/metadata, approval guard).
- Offline npm installation failed (`ENOTCACHED`); online installation failed with DNS `EAI_AGAIN`. Typecheck/build attempted and blocked by missing `vite/client`. Vitest and production WebGL review cannot complete without installed dependencies. No verified baseline/candidate render, human visual score, GPU benchmark, private-media fidelity or thumbnail refresh is claimed. Run the above procedure in the actual development checkout before visual acceptance.
