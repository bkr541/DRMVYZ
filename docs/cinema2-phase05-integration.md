# Cinema 2.0 Phase 05: integration checkpoint

This is an integration patch against the supplied Phase 04 source archive. It extends the existing six user-model preview preset identities, not a seventh engine or a second audio intelligence system. The four existing Design parent groups remain intact.

## Operator workflow

- Open Media Manager and use the normal upload workflow. Choose one model, or select a glTF and its local companion files together. The import inspector validates and measures the resulting GLB, attempts a thumbnail, and uses the existing immutable version repository to save it.
- In a user-model Cinema 2.0 preset, select the saved model and its pinned version. Model Details shows the original filename, geometry and image counts, bounds, canonical GLB size, approximate source buffer/texture GPU usage and warnings. The estimate excludes the representation geometry, render targets and driver overhead. Quality recommendations are advisory.
- Select the active representation and use its Effects subsection. The inspector hides inactive mode-specific controls; triggered destination controls remain available, and automatic musical representation direction exposes all six groups. Existing palette, Pattern, Trigger, BPM Sync, and Auto Performance remain authoritative.
- Material, lighting, optical, atmospheric and trail controls use the existing parameter graph. The optical pass has independent bypasses for symmetry, twist, melt and chromatic aberration. Bloom and trails retain their existing enable switches. Disable a pass to remove its contribution; the graph order is fixed because the atmosphere requires scene depth and trails require finished color. This is not an arbitrary effect graph editor, and there is no separate glare pass.
- In the Model subsection, select Manual or an authoritative musical event, a destination and whether the next event returns to the authored representation. The standard musical representation director has priority when selected. Existing transition duration/easing governs blending. The existing 12 audio assignment slots expose signal, target and intensity in their collapsible headers and keep persistent parameters separate from transient resolver contributions.
- Save using the existing preset/workspace workflow. New parameters have authored defaults; model bindings keep the exact asset ID and version. The existing fixed performance viewport/encoder geometry is unchanged. No changes to other engines or the database schema are required.

## Import support and constraints

| Format | Route | Constraints |
| --- | --- | --- |
| GLB | Existing validated binary import | Existing unsupported compression/extensions and URI restrictions; static playback; rigs rejected. |
| glTF 2.0 | Local JSON and buffer/image packaging into GLB | Select companions in one batch. Unique basenames, safe relative paths or supported base64 data. PNG/JPEG external images only. Remote URLs, traversal, missing or duplicate resources rejected. |
| FBX | Three FBXLoader then GLTFExporter | Static mesh conversion only; texture URLs rejected. Source-specific shaders and animation cannot be retained by the conversion. |
| OBJ | Three OBJLoader then GLTFExporter | Geometry-only; MTL libraries explicitly rejected, not silently dropped. |
| STL | Three STLLoader then GLTFExporter | Static triangle surfaces. |
| PLY | Three PLYLoader then GLTFExporter | Faces required; point clouds rejected. |

The canonical GLB budget stays at 64 MiB, 250,000 triangles, 1,000,000 vertices and 1,024 meshes. Existing texture budgets remain; the shared pre-decode runtime profile also checks metadata, material, node, accessor and embedded-image counts. Source format conversion remains synchronous during loader parsing and may allocate memory before post-decode checks; do not treat this as a fully hardened untrusted-model sandbox. GLB/glTF embedded animations can remain in the stored bytes, but are not played. FBX conversion warns about animations and non-PBR material conversion. The existing renderer handles fit/centering; source geometry is not destructively rescaled. No new dependency versions are required (the loaders are shipped with the existing Three dependency).

## Performance scope

The Phase 04 code already has quality tier hysteresis and mode-dependent geometry/particle/line/pass budgets. This patch reduces secondary debris on lower tiers, reuses a pivot vector and material color scratch values, and resolves repeated material numeric parameters once per update rather than per surface. It shares import/runtime preflight and releases temporary conversion geometry and materials. It does not implement a worker-based geometry compiler, arbitrary target-FPS controller, new cache architecture or measured GPU performance improvements. Those require profiling in a running installation.

## Verification and acceptance status

The original archive was used as the baseline. `npm ci --ignore-scripts --fetch-retries=0` could not fetch dependencies (registry DNS failure). The existing `verify:fast` command passed repository hygiene, legacy Cinema boundary and asset checks, then stopped at missing installed Three decoder files. `npm run typecheck` and `npm run build` stopped at missing `vite/client`; `npm run test` stopped at the missing Vitest module; `npm run test:e2e:smoke` could not start the project Playwright runner. These are environment blockers, not passing tests. TypeScript syntax transpilation and 22 direct Node checks of import routing, glTF packing, validation and pure output geometry were performed without project dependencies. Added Vitest cases cover import format routing and local packaging, unsafe/missing resources, malformed input and budgets, triggered transition deduplication and restoration, inspector projection and persisted model version/material/effect settings. They still need execution in a fully installed checkout.

The complete sports-car scenario (all twelve steps), real FBX/OBJ/STL/PLY loader conversion, browser inspector interactions, live GPU visual quality, actual GPU cleanup, authenticated model storage, preset save/reload in the running UI, and physical cast/record framing have **not** been validated here. This patch is an integration checkpoint, not a verified release-ready build. Do not infer live rendering success from pure geometry or syntax checks.

After applying, install project dependencies, run `npm run verify`, and test all six import formats with representative real models. Run the twelve-step acceptance scenario with a textured car or equivalent, including opening/closing both inspector panels while casting and recording. Check for missing texture or unsupported rig errors, stable frame times, disposal on repeated mounts, and restoration of the pinned model and all performance controls. Only mark Phase 05 release-ready after those checks pass.
