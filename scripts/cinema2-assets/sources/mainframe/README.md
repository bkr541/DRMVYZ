# Mainframe source masters

These files are immutable source inputs for the Cinema 2.0 Mainframe preset. They were supplied by the project owner on 2026-10-07 and are retained here so asset generation never depends on a Downloads or temporary directory.

| Repository file | Original artifact | SHA-256 |
|---|---|---|
| `pass1-geometry.svg` | `Mainframe_Pass1_Master_Geometry_Master.svg` | `c4713bf88b929a05fc5a807c7bf56083b89a5179894a09648cc3808f7509eedf` |
| `pass1-manifest.json` | `Mainframe_Pass1_Master_Manifest.json` | `5f29d957e6fc484e19a6ed8bf7978bcb658a9c2945b556e0b5d794cf7ed2d0a9` |
| `pass2-depth.svg` | `Mainframe_Pass2_Master_Depth_Master.svg` | `03e8ca92c7b98d41f964efdb6ddd0bfc902f447a12006516db97f014f4b38766` |
| `pass2-manifest.json` | `Mainframe_Pass2_Master_Manifest.json` | `dfc5ea99803d1087865955450e543ec8fd5abc7ef49f7fa46f69aa44cbb7be20` |
| `pass3-visualizer.svg` | `Mainframe_Pass3_Visualizer_Master.svg` | `52bd56cf079950eeae65a1a7d430b4b78baa33aa83476e763ddc366ea5d5cc53` |
| `pass3-reactivity.json` | `Mainframe_Pass3_Pass3_Reactivity_Map.json` | `fd569073423b87e2d8702b6627ec43ad49b5e228a6e4451c81dc9323b25e16f0` |
| `concept-reference.png` | Owner-supplied target still | `9cca0af0f6ec0ccb32c6922ff4535019e094f7c263ba1d1c22a4606f326068eb` |
| `extended-circuitboard.svg` | `Extended_circuitboard.svg` | `d2842448642446133d7c25bc211964382ecdd438eb17ebaab1abcec06bc0d1fb` |

The SVG and JSON files are geometry/reactivity data, not executable instructions. `concept-reference.png` is a perceptual target only and must not be shipped as a rendered scene texture.

Run the Stage 1 audit with:

```sh
node scripts/cinema2-assets/audit-mainframe-sources.mjs
```

The audit verifies the immutable hashes, exact cross-pass logo geometry, route coordinates and metadata, authored component counts, and complete bank/region coverage. If the owner intentionally replaces a master, update the checksum only after reviewing the source diff and the resulting audit.

Generate and validate the Stage 2 model with:

```sh
node scripts/cinema2-assets/generate-mainframe.mjs
node --test scripts/cinema2-assets/mainframe-source-contract.test.mjs scripts/cinema2-assets/mainframe-geometry.test.mjs
npm run assets:build
npm run assets:check
```

Capture the neutral-light approval views with:

```sh
node scripts/cinema2-assets/capture-mainframe-model.mjs
```

The generator currently emits one shared high-tier model. Its 149,932 triangles and 7.81 MiB file fit the repository budgets, so Stage 2 does not add unmeasured medium/low variants. The model preserves the exact central master, imports the owner-authored 2× extension's 356 routes, 30 plates, 16 radar modules, eight chips, and 584 reactive terminal elements, and retains a 2.5× substrate for guaranteed coverage at the 0.45 Scale position. Four secondary daughterboards fill the north/south outer bays with distinct controller and power-distribution hardware while remaining governed by the Chip toggle. Four larger symmetric power-regulation nodes fill the inner extension bays, with independently reactive inductor rings, corner lamps, and connector pads; their face-plane dimensions are enlarged 80% from the initial layout. Its custom attributes retain system, route, bank, region, and centre-out phase identities for the native renderer.

Capture the production renderer at 16:9, embedded portrait, ultrawide, component-toggle, and deepest 0.45 Scale states with:

```sh
node scripts/cinema2-assets/capture-mainframe-production.mjs
```

The capture runs the real Cinema 2.0 runtime and requires deterministic duplicate screenshots. It writes the approval images, runtime diagnostics, hashes, whole-frame luminance metrics, and top/bottom edge-coverage metrics under `artifacts/cinema2-mainframe-stage3/`.

Stage 5 runtime validation is focused with:

```sh
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2MainframePreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MainframeReactivity.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MainframePatternController.test.ts
```

The focused suite covers the typed Pass 3 contract, all six deterministic programs, both clock modes, continuous system coverage, event deduplication, pause hold, seek reset, the complete four-parent Inspector contract, persistence/history restore, and deterministic no-repeat switching for all eleven canonical Afterhours trigger choices.
