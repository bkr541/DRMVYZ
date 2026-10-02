# CONDUIT step 1 — capture baseline and lighting diagnosis

This is the first, diagnostic step of the [production-match plan](cinema2-conduit-production-match-plan.md). It does **not** change the Conduit preset, its GLBs, or production rendering. The capture page clones the current first-party manifest into an isolated registry and runs it through the normal Cinema 2.0 renderer.

## Repeat the captures

From the repository root:

```sh
node scripts/cinema2-assets/capture-conduit-baseline.mjs
```

The default run captures the 16:9 reference frame and a square Stage frame, all three quality tiers, and both steady and high-energy states. It also captures the high-quality 16:9 isolation views. For a shorter validation run, use `--smoke`; to select specific cases, use `--only=reference-16x9-high-steady-baseline,reference-16x9-high-steady-no-floor`. Every run writes a new, git-ignored directory under `artifacts/cinema2-conduit-baseline/`, containing labeled PNGs, `manifest.json`, and a linked `index.md`. It never overwrites an earlier run. Chromium via Playwright must be installed locally, and the script needs permission to start a loopback Vite server.

The capture fixes camera movement at zero, kick zoom off, auto performance off, pattern to Pulse, flicker to zero, device pixel ratio to one, and Energy Color to the preset default RGB `(1, 0.38, 0.08)`. The steady state sets Master Intensity to zero; the preset's fixed segment level remains. The peak state sets it to one and injects synthetic maximum-energy audio followed by a drop transition. These are controlled diagnostic states, not samples from a real song. Each case waits for loaded 3D assets and at least 45 rendered frames. Animation phase and timing are not frame-perfect deterministic, so use the numeric measurements for broad attribution, not fine color matching.

The variants isolate causes without changing production values:

| Variant | What it removes or isolates |
| --- | --- |
| `baseline` | Unmodified first-party manifest. |
| `scene-only` | All output effects; this also changes tone mapping, so it is a raw-scene inspection, not a fair final-image comparison. |
| `no-floor`, `no-haze`, `no-bloom` | One output effect at a time. |
| `no-studio` | Studio environment response and area panels. Other scene lights remain. |
| `no-led` | Segment emission and the Energy Lights group. It does not disable every warm light in the scene. |
| `chamber-only`, `tubes-only`, `wordmark-only` | One GLB asset at a time; the floor is off for these views. |

The image metrics sample broad rectangular regions, not semantic masks. In particular, “wordmark area” includes some backing/chamber, and “floor” includes some reflections. This step provides **asset-isolation views and an LED-on/off difference**, not per-material letter/frame masks. Later geometry work must not treat these region metrics as proof of SVG contour fidelity.

The first baseline was captured in four selected batches; together their manifests cover all **21 unique cases** in the default matrix (12 viewport/quality/state combinations and 9 isolation views). Every case resolved its requested quality and reported zero failed 3D modules. The local run indexes are `run-tAKe64`, `run-w8YJLz`, `run-FA1zNz`, and `run-HQqvUL` under the artifact directory. A subsequent `run-ExdmZz` rechecked the final harness and recorded the actual controls (including RGBA Energy Color `(1, 0.38, 0.08, 1)`) in its manifest. These PNGs are local review evidence, not committed reference fixtures.

## Observations from the initial captures

The representative high-quality 16:9 steady capture has a wordmark-area median sRGB luminance of **0.606**, an upper-chamber median of **0.792**, and a floor median of **0.704**. The frame has very few pixels with all three channels at or above 250/255, so the “blown out” impression is mainly broad pale surfaces and low local contrast, not widespread literal RGB clipping. At the synthetic peak, the wordmark area rises to **0.704** and the upper chamber to **0.835**; the already bright floor rises to **0.728**.

At the same high-quality 16:9 steady setting, removing the floor effect moves the floor-region median from **0.704 to 0.154**, while the wordmark area stays around **0.606**. This strongly implicates the reflective-floor pass in the oversized bright foreground. Removing bloom leaves the floor at **0.703** and moves the wordmark area to **0.582**, so bloom is not the main floor cause. Removing haze leaves the floor at **0.706** and wordmark area at **0.604**, also a small change in these regions. Removing studio reflections/panels drops the wordmark-area median to **0.442**, but the floor stays high at **0.691**. Disabling LED segments and energy lights drops the wordmark-area median to **0.417**, while the floor still measures **0.680**. These paired passes suggest separate workstreams: floor effect for foreground brightness, studio/material/light balance for the wall and logo, and compact LED contrast for the emitters. None of these isolation settings is itself the intended production look.

The low-quality steady wordmark-area median is **0.532**, versus **0.593** on medium and **0.606** on high, while floor medians remain **0.670–0.704**. This is consistent with the preset's low-tier light limit omitting its logo key light; it should be checked when steps 3–4 adjust the lighting, without changing low-quality behavior in step 1. The square Stage remains legible and keeps all four sockets visible, but the centered wordmark occupies less of the frame than in 16:9. Composition decisions must therefore be checked separately at both sizes.

These are browser measurements of the current render, **not** a numeric score against the desired production image. The supplied reference uses a different capture pipeline and animation state. No claim of color, material, or shape parity follows from this baseline. The next step, only after review, is the master-SVG/3D-silhouette comparison described in step 2 of the plan.
