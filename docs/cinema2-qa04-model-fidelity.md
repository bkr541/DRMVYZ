# QA-04: imported model material fidelity (partial implementation, visual gate pending)

## Audit and scope

QA-01/02 already require a ready pinned binding, localized source contribution, hidden-source negative control where supported and native fallback. The confirmed coverage gap is that a visible, incorrectly colored, opaque or untextured mesh can satisfy the visibility predicate. No rendered production material defect has been reproduced in this environment. This patch intentionally changes no authored lighting, camera, postprocessing, source capabilities, saved state or choreography. The only production addition is read-only diagnostics of the actual instance-local PBR materials. It does not expose mutable objects or add a render pass.

The release inventory preflight now emits registered manifest model selectors and fixed instances, module types/configuration/bindings and lighting/environment. Source audit:

| Preset | Binding / fallback | Presentation |
| --- | --- | --- |
| Chamber | Shared Three Scene module and Chamber controller; shipped dark-chamber remains, private model is optional | Original, Integrated |
| Colossus | Native module, Three bridge, ColossusScene; procedural emblem | Original, Integrated, Brushed, Edge |
| Exoskeleton | Native module, Three bridge, ExoskeletonScene; procedural core | Original, Integrated, Brushed, Edge |
| Monument | Native module, Three bridge, MonumentScene; saved typography and content mode | Original, Integrated, Brushed, Edge |
| Bass Sigil (outside reviewed matrix) | Shared bridge and fixed crate mesh, optional user replacement | Original, Integrated |
| Form, Dust, Shatter, Hologram, Slices, Voxel (outside reviewed matrix) | Shared Three bridge and representation controllers; model-driven preview, not a native hero replacement contract | Representation-specific controls, no new presentation enum |
| Seraph / Relic | Artifact-native procedural sources; no private selector | Not applicable |

Fixed authored assets are inventoried from compiled module instances; these are not interchangeable private slots. Some procedural modules own their assets internally, so the preflight is a manifest-level inventory, not an exhaustive inventory of every internal geometry or asset. Do not add selectors to fixed presets or treat stylized representations as Original parity.

## Evidence

Browser fixtures use named PBR patches (red rough, green metallic, blue emissive, checker, blend with red substrate, double-sided alpha mask) and wide/tall/thick variants. The fixture exports GLBs, runs `inspectGlbFile` (real import inspection including decode), and stubs only account and repository reads/signed URLs. Real pinned resolver, cache and native bridge own rendering. Library advertises version 2 while v1 stays pinned. The actual ModelEditorStage is mounted for separate reference captures with guides off; no alternate renderer. Editor and production captures record identity, stats/diagnostics and PNGs. The editor uses its normal fitted camera and studio light; camera/exposure are not pixel matched to Cinema. Within each path, A/A repeats estimate noise and negative fixtures preserve geometry and change a single surface feature. Cinema also intersects with a native-source difference mask. Local RGB dominance, red-to-green control, translucent substrate, MASK cutout and checker-edge tests reject missing evidence. Thresholds are provisional conservative tripwires, not empirically calibrated artistic tolerances. Diagnostic comparison checks named decoded versus actual bound material channels, alpha, maps and transforms, roughness, metalness and emission; explicit environments are reported on the bridge, but GLB does not have a standard portable environment-map material field. An actual explicit environment-map rendering control is still pending. The previous PBR tests cover that path at material level.

Release scenario also checks Original/Integrated/Brushed/Edge as supported on the live bound instance, restoration of authored material channels, serialized v1 reentry, explicit v2 binding, replacement/removal, failed-load fallback, cache lease retirement and existing Monument saved typography. Existing manual/Auto and portrait checks are unchanged; the new fixture has not been tested under each camera, portrait, quality and Auto combination. Dedicated geometry clearance, actual visible projected proportions, physically calibrated response and shared simultaneous-holder GPU checks remain required. No fixed-source geometry-specific fidelity capture or non-reviewed preview render was added. Report schema/fixture identity changed to prevent old acceptance comparisons. No approval is inferred from unit tests.

## Verification in implementation environment

Linux x64, Node 22.16.0, npm 10.9.2. No installed dependency tree in supplied ZIP. `npm ci --offline --ignore-scripts --no-audit --no-fund` exited 1 (`ENOTCACHED`, zustand tarball); online install attempt was stopped without a usable dependency tree. Actual commands:

- `node --test scripts/cinema2-assets/model-fidelity-evidence.test.mjs scripts/cinema2-assets/release-acceptance-core.test.mjs`: 20 passed, 0 failed (synthetic pixels and policy only).
- `npm exec --offline -- vitest run Cinema2UserModelImportedProfile Cinema2UserModelRuntime Cinema2UserModelPreparation Cinema2Chamber Cinema2MonumentPreset Cinema2ColossusPreset Cinema2ExoskeletonPreset`: exit 1, Vitest not cached; no test executed.
- `npm run typecheck`, `npm run build`: exit 2, missing `vite/client` types; no successful compilation.
- `npm run test:e2e:chamber-model`: exit 1, missing Playwright package; no browser started.
- `npm run test:e2e:cinema2-release -- --presets colossus,chamber,exoskeleton,monument`: exit 1, missing Playwright package; report records all four as not-run.

On dependency-equipped checkout, run the same commands (omit `--offline`), plus `npm run test:e2e:cinema2-release` for reviewed inventory. Inspect captured reference/production pairs and calibrate thresholds on known-good repeats; correct only demonstrated rendering defects at their owning layer. Review fixed sources, Bass Sigil and six model representations separately. Hardware GPU, Electron preview/fullscreen, casting and human review are all pending. This is not a completed visual acceptance signoff.
