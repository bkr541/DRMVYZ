# SYS-05: User media fidelity

## Source-path inventory (archive 9)

The canonical media slot runtime owns loading, straight-alpha RGBA uploads (no vertical flip), last-good-resource replacement, video updates and disposal. Pool selection remains event-driven; the source panel and slot manifest are unchanged. The shared capability list declares all seven slots below as pool-capable. No asset bytes are modified.

| Preset / slot | Native presentation | Exposure and colour path | Decision |
| --- | --- | --- | --- |
| Corridor / corridor-panel-media (image, video, SVG) | Per-bank orientation and aspect-preserving contain; up to three pool feeds | Raw WebGL HDR, linear source conversion, cinematic finish and bloom | Confirmed fixture gain and drop-ring bleed; fix source composition only. |
| Everywhere / everywhere-screen-media (image, video, SVG) | CRT curvature, repeat/wall/choreographed, contain/cover/stretch, source transforms and alpha | Linearized source with screen brightness, tint, CRT interference, power and glass; Three output colour conversion | Preserve native CRT treatment and existing controls. |
| Fracture / fracture-shard-media (image, video) | Rest-plane UVs on shard faces; contain/cover/fill; per-channel fade and opacity | sRGB decode, independent Media Brightness, Three colour conversion | No confirmed exposure coupling. |
| Refraction / refraction-prism-media (image, video) | Crop and prism distortion; contain/cover/fill (default cover); per-channel fade and opacity | sRGB decode, independent Media Brightness, optical material and Three colour conversion | Preserve native distortion. |
| Spectrum / spectrum-arena-media (image, video) | Instanced crop/channel attributes; contain/cover/fill, opacity and visibility | sRGB decode, independent Media Brightness, Three colour conversion | No confirmed exposure coupling. |
| Mosaic / mosaic-wall-media (image, video) | Instanced crop/channel attributes; contain/cover/fill, opacity and visibility | sRGB decode, independent Media Brightness, Three colour conversion | No confirmed exposure coupling. |
| Overdrive / overdrive-core-media (image, video, SVG) | Spherical front projection, contain, scale and rotation; Micro LED/Raster/Full Color | Display-referred RGB on Three's engine framebuffer; reactive machine gain, post bloom | Confirmed Full Color luminance multiplication, reactive exposure and top-down orientation mismatch. |

These are code-path findings, not full visual acceptance of every preset. No new fit options, source selectors, timers, or Inspector controls were introduced. The existing source reset and pool cadence (including the last-good frame during replacement) remain authoritative. Existing CRT, shard and optical shaders were not changed. Corridor's subsequent panel layout/pool work can still operate on the existing `mediaLane` and channel selection.

## Exposure authority

- Corridor: fixed linear source gain 1 on recruited panels; fixture selection remains a coverage mask at the activation edge. Source alpha composites over the actual fixture; native rim, neighbouring fixtures, mechanical response, distance haze and final grading remain. Contain padding is opaque black, as before. Panel Intensity (0–1.45, default 0.86) continues to control native light, not picture exposure.
- Overdrive: existing LED Intensity (0–2, default 1.1) is the Full Color exposure multiplier, with unity preserving source RGB before post-processing. Shared resolved parameter authority and Auto Performance lock remain intact; the explicit Blackout pattern retains its pose gain. Other modes retain their authored reactive intensity. Media UVs alone are flipped for canonical top-down uploads; generated text UVs are unchanged.
- Final bloom, grading, occlusion and geometry may still alter visible output. This is source-face fidelity, not a promise of display-calibrated RGB at the final framebuffer.

## Verification

`node scripts/verify-cinema2-media-readability.mjs` runs isolated production fragment shaders in Chromium with RGB/alpha, SVG, video, fit, exposure, missing-feed and reactive-style assertions. The script can emit standalone HTML using `--html path` for an offline Chromium runner. This is a fragment test, not a complete preset runtime or transport test. Existing Vitest coverage includes pool event deduplication, media slot failure/replacement and video resource disposal; an Overdrive gain-authority unit case is added.

During implementation, the original and updated fragment sources were compiled and rendered in an offscreen Mesa OpenGL ES 3.2 context using the same fixed face inputs (128 x 128, RGBA8 readback). The source sample [128,80,40] produced these RGB values before post effects:

| Preset | Baseline idle / build / drop | Patched idle / build / drop |
| --- | --- | --- |
| Corridor | [27,14,7] / [74,32,11] / [113,47,14] | [46,17,5] / [46,17,5] / [46,17,5] |
| Overdrive | [25,17,11] / [58,37,22] / [95,61,33] | [128,80,40] / [128,80,40] / [128,80,40] |

RGB primaries, opaque black, half alpha, and missing/native fallback were also sampled in this isolated GLES run; no GL errors were observed. Chromium refused WebGL context creation in the implementation environment. The browser SVG/video tests, full application playback, final bloom/grade visual comparison, thumbnails and performance benchmarking remain unverified. `npm run typecheck` and `npm run build` stopped on missing `vite/client`; dependency installation is unavailable (registry DNS failure). Vitest could not run without installed dependencies. The review DOCX was not supplied with this archive/prompt. No claim of full visual approval is made.
