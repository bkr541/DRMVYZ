# Cinema 2.0 rendering architecture upgrade

Status: implemented and validated on 2026-10-14. This is an **engine-level** upgrade. No existing preset file, manifest, default parameter, asset or
shader was changed; every new capability is opt-in and costs nothing for a preset that does not use it.

Contents: [1 Libraries](#1-installed-libraries) · [2 New capabilities](#2-newly-supported-rendering-capabilities) · [3 Preserved](#3-existing-capabilities-preserved) ·
[4 Components](#4-new-architecture-components) · [5 Effect integration](#5-rendering-effect-integration-points) · [6 Asset workflow](#6-asset-import-and-optimization-workflow) ·
[7 Materials](#7-material-and-texture-support) · [8 Animation](#8-animation-support) · [9 Quality profiles](#9-quality-profiles) · [10 Budgets](#10-performance-budgets) ·
[11 Flags](#11-feature-flags-and-opt-in-configuration) · [12 Fallbacks](#12-compatibility-and-fallback-behavior) · [13 Limitations](#13-known-limitations) ·
[14 Future presets](#14-instructions-for-future-preset-development) · [Capability matrix](#capability-matrix) · [Validation](#validation-record)

## 1. Installed libraries

Three.js stays at **0.186.1** (one copy, `npm ls three` shows a single version). Everything new is a **dev dependency**: nothing is added to the shipped
application bundle except first-party code and the bundled decoders in section 12.

| Package | Resolved | Purpose |
|---|---|---|
| `@gltf-transform/core` | 4.5.1 | Read, edit and write glTF/GLB documents in the asset tools. |
| `@gltf-transform/functions` | 4.5.1 | dedup, prune, weld, simplify, texture slot analysis. |
| `@gltf-transform/extensions` | 4.5.1 | Meshopt, Draco, KTX2, WebP and material extensions for the tools. |
| `@gltf-transform/cli` | 4.5.1 | The `gltf-transform` command (used for the optional KTX2 pass); required by the brief. |
| `gltf-validator` | 2.0.0-dev.3.10 | Khronos glTF 2.0 validation. |
| `sharp` | 0.35.5 | Texture resizing and re-encoding in `cinema2:asset:optimize` (a project script imports it directly, so it is a direct dependency). |
| `draco3dgltf` | 1.5.7 | Draco encoder/decoder for the Node asset tools (also a transitive dependency of the CLI; imported directly). |
| `meshoptimizer` | 1.2.0 | Meshopt encoder and simplifier for the asset tools. Pinned to `~1.2.0` so it de-duplicates with the CLI's copy. |

Not installed, deliberately: a second Three.js, `postprocessing`/`EffectComposer` stacks, a PBR material library, a stats/monitoring framework.
`ktx2-encoder` (MIT, Basis Universal encoder) was used **once, outside the repository**, to author the committed KTX2 test fixture; it is not a project
dependency (see section 6).

## 2. Newly supported rendering capabilities

| Capability | Where | One line |
|---|---|---|
| Draco model loading | `Cinema2ThreeAssetCache`, `Cinema2ThreeDecoders` | Detected from the GLB header; decoder fetched only for models that use it. |
| KTX2 / Basis Universal textures | same | GPU-format aware; falls back to RGBA when the GPU has no compressed format. |
| Animation clips and scene metadata on loaded assets | `Cinema2ThreeLoadedAsset.animations/.metadata` | Names, hierarchy, custom attributes, morph targets, skins, clips, glTF extras. |
| `AnimationMixer` controller | `Cinema2ThreeAnimation` | Timeline-driven (`sync`) or free-running; pause/resume/seek/speed; nothing starts automatically. |
| PBR material layer | `Cinema2ThreeMaterialKit` | Profile-based overrides for 20 property groups, color-space audit, UV transform, filtering, shared ownership. |
| Ambient occlusion | `effects/Cinema2AmbientOcclusionEffect` (`ambient-occlusion`) | Depth-based, depth-aware denoised, tier-scaled. |
| FXAA / SMAA | `effects/Cinema2AntiAliasingEffect` (`anti-aliasing`) | Three's own shaders adapted to the Render Graph. |
| EXR + HDR environment profiles, rotation, intensity, resolution by tier | `Cinema2ThreeEnvironmentProfiles` | PMREM cache per renderer. |
| Shadow profiles | `Cinema2ThreeShadowProfiles` | Map size, filter, bias, shadow-camera fit, cast/receive by name, cleanup. |
| Studio lighting rigs | `Cinema2ThreeLightingRigs` | Three-point, softbox, product, dramatic, industrial, colored accent. |
| LOD | `Cinema2ThreeLod` | `THREE.LOD` with tier-scaled distances and detail cap. |
| Instancing | `Cinema2ThreeInstancing` | `Cinema2InstancedBatch` (one draw call, per-instance color/transform). |
| Shared ownership | `Cinema2ThreeResourceLedger` | Ref-counted disposal of geometries, materials, textures. |
| Render-target pool | `runtime/Cinema2RenderTargetPool` | Reused intermediate targets, idle trimming, context-loss safe. |
| Diagnostics | `runtime/Cinema2RenderDiagnostics`, `Cinema2GlResourceTracker`, `Cinema2GpuTimerPool` | FPS, frame time, draws, triangles, textures, GPU bytes, shader compiles, passes, GPU timers. |
| Quality profiles + capability detection | `render/Cinema2RenderQualityProfiles` | One table for every tier-dependent setting; never throws. |
| Asset tools | `scripts/cinema2-assets/asset-tools/` | inspect, validate, optimize (safeguarded), report. |
| Validation scene | `src/test/browser/Cinema2RenderValidation*` | Developer-only; not in any registry. |

## 3. Existing capabilities preserved

Unchanged and untested-for-regression-by-pixels where noted in the [validation record](#validation-record): the Three.js scene bridge and its framebuffer
ownership (`setRenderTargetFramebuffer`, `Cinema2GlStateGuard`), meshopt loading, PMREM studio environments, `RectAreaLight` support, the bridge's own
selective shadows, custom Audio Intelligence shaders and uniforms, the Render Graph and executor, HDR bloom, glare, cinematic finish, volumetric
atmosphere, depth of field, quality tiers and asset budgets, the asset registry and `assets:check`.

Existing files that were **edited** (all additive, no behavior change for existing assets):

| File | Change |
|---|---|
| `modules/three/Cinema2ThreeAssetCache.ts` | Loaded assets also carry `animations` and `metadata`; the default loader reads the GLB header and leases Draco/KTX2 decoders only if declared. Meshopt is enabled when the header declares it (previously only when the record said so). |
| `modules/three/Cinema2ThreeRendererHost.ts` | Registers the renderer with the decoder module (KTX2 GPU-format detection). |
| `modules/three/Cinema2ThreeAssetRegistry.ts`, `Cinema2ThreeAssetManifest.ts`, `assets/Cinema2GeneratedAssetTypes.ts` | `compression` may be `draco`; optional `textureCompression: 'ktx2'`. |
| `effects/Cinema2EffectRegistry.ts` | Registers the two new effect types (registration allocates nothing). |
| `scripts/cinema2-assets/assets-core.mjs` | Draco/KTX2 records, required-extension check, EXR environments. |
| `src/main.tsx` | Development builds only: registers the diagnostics console global. |
| `package.json`, `package-lock.json` | Dev dependencies and npm scripts. |

## 4. New architecture components

```
src/components/vyzualz/cinema2/
  render/Cinema2RenderQualityProfiles.ts     tier table, capability detection, feature resolution, dynamic resolution
  runtime/Cinema2RenderTargetPool.ts         shared intermediate render targets (per GL context)
  runtime/Cinema2GlResourceTracker.ts        dev-only GL accounting (wraps draw/alloc calls while attached)
  runtime/Cinema2GpuTimerPool.ts             non-blocking EXT_disjoint_timer_query_webgl2 sections
  runtime/Cinema2RenderDiagnostics.ts        facade + `__CINEMA2_RENDER_DIAGNOSTICS__` (DEV only)
  effects/Cinema2AmbientOcclusionEffect.ts   `ambient-occlusion` v1
  effects/Cinema2AntiAliasingEffect.ts       `anti-aliasing` v1
  modules/three/Cinema2ThreeDecoders.ts      leased Draco/KTX2 loaders, GLB header inspection, EXR + SkeletonUtils lazy loaders
  modules/three/Cinema2ThreeAssetMetadata.ts model description (names, attributes, skins, clips, extras)
  modules/three/Cinema2ThreeAnimation.ts     clip description, skinned-safe clone, AnimationMixer controller
  modules/three/Cinema2ThreeMaterialKit.ts   material profiles, color spaces, UV/filtering, quality gates, ownership
  modules/three/Cinema2ThreeResourceLedger.ts ref-counted disposal
  modules/three/Cinema2ThreeEnvironmentProfiles.ts, ...ShadowProfiles.ts, ...LightingRigs.ts, ...Lod.ts, ...Instancing.ts
scripts/cinema2-assets/
  asset-tools/{io,inspect,validate,optimize,compare,report,cli}.mjs
  decoders.mjs, generate-render-validation-fixtures.mjs, accept-render-upgrade.mjs, compare-capture-runs.mjs
src/test/browser/Cinema2RenderValidation{Harness,Scene}.ts, cinema2-render-validation.html
src/test/fixtures/render-validation/*.glb, *.exr
public/cinema2/decoders/{draco,basis}/        bundled WASM decoders (not part of the asset budget)
```

## 5. Rendering effect integration points

**Why not `GTAOPass` / `SMAAPass` through `EffectComposer`.** `EffectComposer` allocates its own ping-pong targets and renders the scene again into
its own normal/depth targets. Cinema 2.0's Render Graph owns every framebuffer and already provides a sampleable `depth` attachment; a composer would
double the scene cost and fight the engine's framebuffer ownership and color management. So:

- **Ambient occlusion is a Cinema 2.0-native effect.** It reads the Render Graph's `depth` input (as depth of field does), reconstructs world position
  and normals from it, and needs **no extra scene pass** and no normal buffer. `GTAOPass` is therefore *not* used (documented, not deferred: the
  engine-native version is the compatible equivalent the brief asks for).
- **FXAA and SMAA use Three's own shader sources** (`FXAAShader`, `SMAAShader`, and the SMAA lookup tables from `SMAAPass`), adapted at load time to
  plain WebGL2 passes by string transformation (a gl_VertexID fullscreen triangle in place of the attribute-driven vertex shader). They are imported
  dynamically on first render, so Three stays out of the main bundle. If Three changes those shaders in a way the adaptation cannot handle, the effect
  throws a clear error (covered by a test) and the Render Graph marks only that effect failed.

**Ordering.** Effects are ordered by the existing `scope`/`order` rules. Recommended chain for a future preset:
`scene → ambient-occlusion → hdr-bloom → glare → volumetric/depth-of-field → cinematic-finish → anti-aliasing`.
Occlusion belongs before bloom (it darkens ambient light, bloom adds light); anti-aliasing belongs last, on the finished image. Neither effect applies
tone mapping or a gamma conversion: color stays display-encoded (gamma 2.2) exactly as the other effects expect. Occlusion is applied as a
linear-light multiplier on the encoded color (`pow(factor, 1/2.2)`), and pixels brighter than ~1 (emissives) are protected by `emissiveProtect`.

**Buffer contract.** `ambient-occlusion` needs a `depth` input and a final world camera. Without either (or on low quality) it only copies. The
intermediate buffers come from the shared `Cinema2RenderTargetPool`; they are acquired and released inside one `render()` call.

**Bypass.** `Cinema2EffectRuntime` already creates an effect instance only when `enabled`, `mix > 0` and the quality range allow it, and retires it
(disposing programs) otherwise. The new effects also compile their programs lazily on the first frame that needs them.

## 6. Asset import and optimization workflow

Commands (all documented by `--help`-style usage on error; the Node version must be 22.x, the repo requires `>=22.12 <23`):

```bash
npm run cinema2:asset:inspect  -- model.glb [--json]      # counts, memory, compression, custom attributes, animation, problems
npm run cinema2:asset:validate -- model.glb [--strict]    # Khronos validator + engine checks; non-zero exit on errors
npm run cinema2:asset:optimize -- model.glb --out /tmp/out --id my-model \
    [--tiers high,medium,low] [--geometry meshopt|draco|none] [--textures keep|webp|ktx2] \
    [--simplify[=medium=0.65,low=0.4]] [--max-texture medium=1024,low=512] [--force] [--keep-failed]
npm run cinema2:asset:report   -- model.glb [--out report.md] [--optimized /tmp/out]
npm run cinema2:decoders:sync | cinema2:decoders:check   # bundled Draco/Basis decoders vs the installed Three.js
```

**What `inspect` reports:** triangles, vertices, primitives (= draw calls), materials, textures with sizes/formats/slots, geometry and texture memory
estimates (textures with mips; KTX2 priced as block-compressed), compression (none/meshopt/draco), extensions used and required, custom vertex
attributes, animation clips (duration, channels, targets), skins and joints, scene bounds, and problems: missing normals, missing UVs, non-finite or
out-of-range geometry, degenerate triangles, unsupported required extensions (error) or used extensions (warning), oversized textures, over-budget
triangles or GPU memory per tier, excessive materials/meshes/draw calls/textures/nodes, duplicate or missing node names.

**What `optimize` does, per tier:** removes duplicate accessors and textures, prunes only unreferenced accessors and textures, optionally simplifies
(welded, border-locked, **opt-in**), caps texture size (high 2048 / medium 1024 / low 512), then compresses geometry. Meshopt is applied with the
extension directly — **not** glTF Transform's `meshopt()` helper, which also quantizes positions and rewrites node transforms (found by the safeguards
on the first run). Draco quantizes positions to 16 bits and generic attributes to 16 bits.

**Safeguards (all enforced, all tested):**
- The source file is never written. Output goes only to `--out`, which may not be inside `public/` or `assets/`, may not overwrite existing files
  without `--force`, and may not equal the source.
- Nothing is optimized automatically; no existing production model was touched.
- Every tier is re-read from the bytes that would ship and compared with the original (`compare.mjs`): node names, hierarchy and local transforms;
  mesh, primitive and material names; every vertex attribute (custom ones included, value-for-value unless simplified or Draco); node extras;
  animation clips and channel counts; skins and joints; overall size. A failing tier is **not written** (unless `--keep-failed`) and the command exits 1.
- Simplified tiers must keep every named part and may only lose triangles.
- The output includes `report.md`, `report.json` and `asset.draft.json`. The draft has a deliberately invalid license and origin, so
  `npm run assets:check` rejects it until a person fills them in. Registration is manual: copy the GLBs to `public/cinema2/models/`, copy the draft to
  `assets/cinema2/<id>/asset.json`, set license/attribution/origin, run `npm run assets:build && npm run assets:check`.

**Registry integration.** `assets-core.mjs` (the existing validator) now accepts `compression: "draco"` and `textureCompression: "ktx2"`, checks that
the record matches the extensions the file really uses, **rejects a model that requires an extension the loader lacks** (`ASSET_EXTENSION_UNSUPPORTED`,
with the extension name and what to do), and accepts OpenEXR environments. A unit test compares the supported-extension list with the installed
`GLTFLoader` so it cannot drift. The generated manifest and attribution list for existing assets are byte-identical to before.

**Texture compression to KTX2.** `--textures ktx2` shells out to glTF Transform's CLI, which needs KTX-Software's `toktx` on the PATH
(<https://github.com/KhronosGroup/KTX-Software/releases>). It was **not installed on the development machine**, so that path is untested here and the
command refuses with an actionable message when `toktx` is missing. To prove the runtime KTX2 path anyway, `fixture-ktx2.glb` was encoded with the
MIT-licensed Basis Universal encoder (`ktx2-encoder`, run from a scratch folder): ETC1S for the color map, UASTC for the normal map. Regenerate with
`node scripts/cinema2-assets/generate-render-validation-fixtures.mjs --ktx2-encoder <path>/dist/node/index.js`.

**Budgets.** No budget was changed to make anything pass. The installer budget remains 72 MB / 9 MB per file as left by the previous change (unchanged
in this task). Existing production models fail the Khronos validator in places (for example Mainframe has zero-length normals on a few vertices:
`ACCESSOR_VECTOR3_NON_UNIT`, and several models have degenerate triangles). These are **pre-existing** and were reported, not fixed; see
[Known limitations](#13-known-limitations).

## 7. Material and texture support

`Cinema2ThreeMaterialKit.applyCinema2MaterialProfile(THREE, material, profile, options)` changes only the properties a profile names:

| Group | Profile keys |
|---|---|
| Base color / albedo, metallic, roughness | `color`, `metalness`, `roughness` |
| Normal map, bump, AO map | `normalScale`, `bumpScale`, `aoMapIntensity` |
| Emissive | `emissive`, `emissiveIntensity` |
| Height / displacement | `displacementScale`, `displacementBias` |
| Alpha and transparency | `opacity`, `alphaMode` (`opaque`/`mask`/`blend`), `alphaCutoff`, `doubleSided` |
| Clearcoat | `clearcoat`, `clearcoatRoughness` |
| Transmission, IOR, thickness, volume | `transmission`, `ior`, `thickness`, `attenuationColor`, `attenuationDistance`, `dispersion` |
| Iridescence | `iridescence`, `iridescenceIOR`, `iridescenceThicknessRange` |
| Anisotropy | `anisotropy`, `anisotropyRotation` |
| Specular | `specularIntensity`, `specularColor` |
| Sheen | `sheen`, `sheenColor`, `sheenRoughness` |
| Environment reflection strength | `reflectionIntensity` (needs `options.environment`: Three applies `envMapIntensity` only to a material that holds its own `envMap`; the scene-wide strength is `scene.environmentIntensity`) |
| UV transforms | `uvTransform` per slot or `all`: offset, repeat, rotation, center |
| Filtering | `filtering`: anisotropy (clamped to the GPU), min/mag filter, mipmaps |

Rules: imported values are never reset; standard→physical promotion keeps name, `userData`, `customProgramCacheKey` and refuses (with a reason)
when the material has an `onBeforeCompile` hook; `ShaderMaterial`, `MeshBasicMaterial` and the Audio Intelligence emissive shaders are never
replaced (reported as skipped); color maps are sRGB and data maps stay `NoColorSpace` (`normalizeCinema2TextureColorSpaces` fixes and reports,
`auditCinema2Material` only reports); UV and filtering changes are made on a private clone of the texture (the clone shares the decoded image), so
other materials that share the texture are unaffected; `Cinema2ThreeMaterialLibrary` and `Cinema2ThreeResourceLedger` dispose a shared texture only
when its last holder releases it. Per-tier gates (`applyCinema2MaterialQualityGate`) switch transmission, iridescence and anisotropy off on lower
tiers and restore the authored value on a higher tier. Switching a feature across zero recompiles that material once; it does not happen per frame.

## 8. Animation support

A loaded asset carries `animations` and `metadata`; loading plays nothing. A scene creates a `Cinema2ThreeAnimationController(THREE, root, clips)`,
calls `play(name, { loop, weight, timeScale, startTime })` and drives it with **`sync(timelineSeconds)`** (pose is a pure function of the Cinema 2.0
timeline: seek, loop, pause and track replacement land on the right frame, captures are repeatable) or **`update(delta)`** (free-running, honours
`pause`/`resume`/`setSpeed`/`seek`). `cloneCinema2AssetScene` uses `SkeletonUtils.clone` only when a skinned mesh is present. `dispose()` stops all
actions and uncaches the mixer. Morph-target animation and skeletal animation are exercised by `fixture-animated.glb` (clips `spin`, `breathe`,
`bend`).

## 9. Quality profiles

`render/Cinema2RenderQualityProfiles.ts` is the single table. **Available settings, not defaults for presets.**

| Capability | Low | Medium | High |
|---|---|---|---|
| PBR advanced features | clearcoat, sheen | + transmission, anisotropy | + iridescence |
| Anti-aliasing (`auto`) | FXAA | SMAA (threshold 0.1) | SMAA (0.08) |
| Ambient occlusion | off | 8 samples, half resolution, 3-tap denoise | 16 samples, full resolution, 4-tap denoise |
| Shadow map / filter | 512 / basic | 1024 / PCF r2 | 2048 / PCF r3 (VSM available) |
| Environment source width | 512 | 1024 | 2048 |
| Texture anisotropy | 1× | 4× | 16× (clamped to the GPU) |
| Model detail | optimized (drops the finer half of LOD levels, switches sooner ×0.6) | balanced (drops the finest of 3+, ×1.0) | detailed (all levels, ×1.6) |

`detectCinema2RenderCapabilities(gl)` reads float targets, float filtering, timer queries, parallel shader compile, texture size, anisotropy and
compressed-texture families. `resolveCinema2RenderFeatures(tier, capabilities, request)` returns what the tier and GPU can actually do plus a list of
`downgrades` with reasons; it never throws. `Cinema2DynamicResolution` steers a render-target scale from frame times with quantized steps and
hysteresis (opt-in; the existing runtime's own scale policy is untouched).

## 10. Performance budgets

Measurements are in the [validation record](#validation-record). Budgets the code enforces or documents:

- Per-asset limits unchanged: 150,000 triangles, 2048 px textures, GPU bytes 19.2 / 32 / 51.2 MB per tier (low/medium/high).
- AO: exactly 3 passes (occlusion, blur, composite) on medium/high, 0 on low; occlusion buffer at the tier's resolution scale (rgba16f).
- SMAA: 3 passes (edges, weights, blend), two extra over the plain copy; FXAA: 1 pass (replaces the final copy).
- Pooled targets are deleted after 2 s idle; steady state allocates nothing per frame.
- Decoders: Draco ≈ 0.76 MB and Basis ≈ 0.58 MB on disk, fetched only by models that need them, idle loaders disposed after 15 s.

## 11. Feature flags and opt-in configuration

There is no global switch because nothing is on. A feature exists for a preset only if the preset says so:

| Feature | How a future preset enables it |
|---|---|
| Ambient occlusion | Add an effect `{ typeId: 'ambient-occlusion', version: 1, parameters: { mix: 1, radius, intensity, bias, power, maxDistance, denoise, emissiveProtect } }` (and a render pass that provides `depth`). |
| Anti-aliasing | Add `{ typeId: 'anti-aliasing', version: 1, parameters: { mix: 1, mode: 'auto'\|'off'\|'fxaa'\|'smaa', threshold } }` as the last output effect. |
| Material profile, environment profile, shadow profile, lighting rig, LOD, instancing, animation | Call the corresponding module from the preset's own module code. None are called by existing code. |
| Draco / KTX2 | Ship a model that uses them; nothing else is required (the header decides). Record it with `compression: 'draco'` / `textureCompression: 'ktx2'`. |
| Diagnostics | Development builds expose `__CINEMA2_RENDER_DIAGNOSTICS__.attach('canvas')`; or construct `Cinema2RenderDiagnostics` in a harness. |

## 12. Compatibility and fallback behavior

- **Decoders are local.** `public/cinema2/decoders/` is copied from the installed Three.js by `npm run cinema2:decoders:sync`; `:check` (part of
  `verify:fast`) fails if the copies drift from the installed version. Paths are root-relative like models, so they work in Vite dev, Vercel and the
  Electron app protocol. No CDN anywhere.
- **KTX2 support** is read from the shared renderer. With no renderer or no compressed-format support the loader transcodes to RGBA (works everywhere,
  larger in memory). `assets:check` prices KTX2 as block-compressed, so the reported GPU figure is the optimistic case.
- **Unsupported GPU features** step down with a recorded reason (`downgrades`), never an exception. Missing depth/camera makes AO a copy. A failed
  decoder or shader download surfaces as a typed error (`CINEMA2_DRACO_DECODER_UNAVAILABLE`, `CINEMA2_KTX2_DECODER_UNAVAILABLE`, or the anti-aliasing load
  error) that fails only that asset or effect; the existing degraded-module reporting applies.
- **Context loss.** Effects are retired by the existing `Cinema2EffectRuntime` and recreated lazily; the render-target pool forgets its handles on
  `webglcontextlost`; the diagnostics tracker clears its tables; the environment cache is keyed by renderer and so restarts with the host's new one;
  decoders hold no GL state. Validated by an actual lose/restore cycle (see the validation record).
- **Float targets** are used when available (`EXT_color_buffer_float`); otherwise 8-bit with a shorter denoise.

## 13. Known limitations

1. **GTAOPass is not used** (see section 5); the native AO is a single-scale depth-based hemisphere method, not horizon-based GTAO. It has no
   temporal accumulation (by design, no ghosting), so very fine noise is removed only by the spatial blur. Thin objects (< 1 pixel) can be missed.
2. **Anti-aliasing mid-frame order.** Placing `anti-aliasing` before bloom or on an HDR buffer works (edge detection is log-compressed) but SMAA
   blends unclamped HDR values, which can soften very small super-bright details; the documented position is last.
3. **`--textures ktx2` was not run** on this machine (`toktx` missing). The runtime KTX2 path *was* validated with an encoder-authored fixture.
4. **Transmission** materials use Three's built-in transmission pass (an extra scene render of opaque objects) on any tier that allows it; budget for it.
5. **Environment filtering resolution** follows the source width (PMREM derives its size from it); `maxSourceWidth` is applied by box downsampling.
6. **Shadow filters.** `PCFSoftShadowMap` no longer exists in Three r186; `pcf` is the soft filter. `vsm` is available but not the default on any tier.
7. **Diagnostics wrap GL methods** while attached (a small CPU cost) and only see resources created after attaching. GPU timing needs
   `EXT_disjoint_timer_query_webgl2`; it is unavailable in some headless/Safari configurations and then reported as unsupported. The pool's per-section timers
   cannot run beside `Cinema2PerformanceDiagnostics`'s whole-frame query on the same context (WebGL allows one active `TIME_ELAPSED` query).
8. **Pre-existing, not fixed:** the Cinema 2.0 suite already had 40 failing tests / 16 files and 103 `tsc` errors before this work (baseline recorded below),
   including the Conduit low-tier GPU budget test, and the Khronos validator reports errors on some shipped models (Mainframe normals).
9. The validation scene exercises the effects through the real effect instances and the real Three host, but not through a full `Cinema2Runtime`
   (which would need a harness-only preset manifest). The Render Graph and executor are unchanged, so their own tests still apply.

## 14. Instructions for future preset development

1. Load models through the asset registry (`assets/cinema2/<id>/asset.json`); author them in Blender, export GLB, run `cinema2:asset:inspect` and
   `:validate`, then `:optimize` into a scratch folder and read `report.md`. Name every part a preset must drive; keep one mesh per independently
   controlled part; add vertex attributes with a leading `_` (they survive every tool and arrive lower-cased, e.g. `_glow_phase`).
2. In the module: `const asset = await cache.acquire(library, id, tier)`; clone with `cloneCinema2AssetScene`; apply
   `applyCinema2MaterialProfile` only for the properties the preset changes; retain shared resources with `retainCinema2ObjectResources`.
3. Light with `buildCinema2LightingRig` (call `prepareCinema2LightingRig` if it uses area lights) and an environment profile; configure the shared
   renderer's shadow map each draw with `configureCinema2ShadowMap`.
4. For motion, create a `Cinema2ThreeAnimationController` and call `sync(timeline)` each frame.
5. Repeated objects: `Cinema2InstancedBatch`. Several detail levels: `createCinema2Lod`.
6. Post: add `ambient-occlusion` and/or `anti-aliasing` to the manifest in the recommended order, with a pass that exposes `depth`.
7. Take tier-dependent numbers from `CINEMA2_RENDER_QUALITY_PROFILES`; do not hard-code tiers.
8. Verify with `npm run visual:render-upgrade` and, for the preset itself, a deterministic capture script like the existing acceptance scripts.

## Capability matrix

| Feature | Status |
|---|---|
| GLB loading, Meshopt, PMREM studio environments, HDR (`.hdr`) | Previously supported |
| HDR bloom, glare, cinematic finish, depth of field, volumetric atmosphere | Previously supported (unchanged) |
| Quality tiers, asset budgets, asset registry and `assets:check` | Previously supported (extended, not replaced) |
| Draco model loading | Newly implemented (opt-in: a model must use it) |
| KTX2 / Basis texture loading | Newly implemented (opt-in) |
| Animation clips, metadata, mixer controller | Newly implemented (opt-in) |
| PBR material kit, shared ownership | Newly implemented (opt-in) |
| Ambient occlusion | Newly implemented, available but opt-in |
| FXAA, SMAA | Newly implemented, available but opt-in |
| EXR environments, environment profiles | Newly implemented (opt-in) |
| Shadow profiles, lighting rigs | Newly implemented (opt-in) |
| LOD, instancing | Newly implemented (opt-in) |
| Render-target pool, diagnostics, GPU timers | Newly implemented (dev/opt-in) |
| Asset inspect / validate / optimize / report | Newly implemented |
| Developer validation scene | Newly implemented (developer only) |
| `GTAOPass` | Deferred / not used: requires its own scene render and EffectComposer framebuffers (incompatible with framebuffer ownership); native AO provided instead |
| Three `SMAAPass`/`FXAAPass` as passes | Not used as passes (EffectComposer); their shaders are reused |
| KTX2 via `toktx` in `cinema2:asset:optimize` | Implemented, untested here (tool not installed) |
| `sharp` redundancy check | Used directly by `optimize.mjs` and the capture comparison, so installed as a direct dev dependency |

## Validation record

Machine: macOS (Darwin 25.6), Node 22.20.0 (`/usr/local/bin`; the default Homebrew Node 26 on this machine is broken, missing `libsimdjson`), Chrome headless with
its default GPU path. All numbers below were produced by the commands shown.

### Baseline (before any change, `HEAD` = `da095041`)

| Check | Result |
|---|---|
| `npx tsc --noEmit` | 103 errors (pre-existing: test files, `*BrowserHarness`, `Cinema2Interlock*` ...) |
| `npx vitest run src/components/vyzualz/cinema2` | 1015 tests, **40 failed in 16 files** (pre-existing; includes the Conduit low-tier GPU-budget test) |
| `npm run assets:check` | pass (19 assets, 70.05 MB) |
| `npm run repo:hygiene` | fails (the repository tracks `coverage/` and `node_modules/`): pre-existing |
| `npm run test:e2e:cinema-runtime` | **fails** on `legacyPortalPixel` (a Cinema 1 preset) at `HEAD` and after the change: pre-existing |
| Deterministic captures (ATL HOE, Mainframe, Conduit smoke) | saved for comparison |

### After the change

| Check | Result |
|---|---|
| TypeScript | **0 new errors** (diff of the sorted error list against the baseline is empty; the upgrade's own files, tests and harness type-check) |
| Cinema 2.0 vitest | **1097 tests, 40 failed in 16 files: the identical set as the baseline**; 82 new tests, all passing; no test that passed before fails now |
| New vitest files | quality profiles + pool + ledger (12), material kit (15), lighting/shadows/environment/LOD/instancing (17), animation + metadata (8), asset import through the real `GLTFLoader` + Meshopt, decoder pool, cache wiring (12), AO + AA effects (11), diagnostics (7) |
| `npm run test:assets` (node) | 60 pass: `assets-core` 20 (incl. Draco/KTX2/extension/EXR cases and a loader-extension cross-check), asset tools 10 (incl. safeguards and CLI) |
| `npm run assets:check`, `cinema2:decoders:check` | pass; the generated manifest and attributions are byte-identical |
| ESLint | clean on every new or changed file |
| Production build (`vite build`) | succeeds. Main `index` chunk **3,909,194 → 3,909,238 bytes (+44 B)**; Three.js stays a separate lazy chunk; `SMAAPass`, `KTX2Loader`, `DRACOLoader`, `EXRLoader` are new lazy chunks (49 vs 37 asset files). The diagnostics global, the validation scene and the fixtures are **absent** from `dist`; the decoders are present under `cinema2/decoders/`. (`npm run build` itself stops at the pre-existing `tsc` errors.) |
| `npm run test:e2e:cinema-runtime` | same single pre-existing failure as `HEAD`; nothing new |

### Existing presets unchanged

| Preset | Method | Result |
|---|---|---|
| ATL HOE | `visual:atl-hoe:production`, 15 deterministic captures (both viewports, six programs, medium/low tiers, emission off), compared pixel by pixel with `compare-capture-runs.mjs` | **15 of 15 identical** (0 differing pixels) |
| Conduit | smoke captures (steady, peak, no-studio, wordmark-only), compared with `compare-capture-runs.mjs` | Of the four captures, `steady` and `no-studio` were **pixel-identical** to the baseline, and `peak` differed by at most 3/255 (its drop state is time-dependent; not re-run on unmodified code to prove that). The fourth and the later full re-run could not complete: the capture script timed out waiting for its first page after the dependency cache was rebuilt by other runs on this machine. The owner then checked the Conduit preset by hand in the app and reported it looks correct. Treat the scripted Conduit comparison as **partial**. |
| Mainframe | 16 captures | The Mainframe acceptance harness is **not deterministic run to run**: two runs of unmodified `HEAD` differ in 9 of 16 captures (max channel delta up to 122) and two runs after the change differ in 9 of 16, with `rest`, `system-surge` and `quadrant-relay` identical in every run. Pixel comparison is therefore not a valid signal for this preset; the harness's own health assertions (no failed or degraded module, no failed effect) pass after the change. |

The code that existing presets run was touched in three places only: the asset cache (extra fields on the returned asset, header-driven decoder
leasing that is a no-op for files without those extensions), the renderer host (one registration call) and the effect registry (two new
definitions). Both new effects and every new module are never instantiated unless a preset names them.

### Rendering validation scene (real GPU, Chrome, 1600x900)

`npm run visual:render-upgrade` renders the developer-only scene through the shared Three host and the real effect instances, with three quality tiers,
and measures the images. Run `run-IMevyz`: **113 of 113 checks passed** (39 per tier). Highlights (high / medium / low where they differ):

| Area | Measured |
|---|---|
| Model encodings | uncompressed, Meshopt, Draco and KTX2 (Basis, `isCompressedTexture` true on this GPU) all load; the same textured sphere renders with mean absolute difference vs uncompressed of **0.00** (Meshopt), **0.03** (Draco), **0.71 / 0.74 / 1.25** (KTX2) on a 0-255 scale; custom `_glow_phase` survives all four; decoders were created lazily (1 Draco, 1 Basis loader) |
| Animation | clips `spin`, `breathe`, `bend` (rotation, morph target, skinned strip) preserved; pose at the same timeline time is bit-identical, different times differ |
| Ambient occlusion | crevice region mean luminance 0.531 → 0.507 / 0.484 on high / medium; **identical image on low**; background pixels untouched (delta 0); emissive peak preserved (1.000 → 1.000); occlusion buffer minimum 0.22 in crevices and exactly 1.0 on the background (no halos); 3 extra draws and exactly 3 shaders compiled on medium/high, 1 pass-through copy and 1 shader on low |
| Anti-aliasing | edge error against a 2x2 supersampled reference on the panel silhouette: off 19.7 → FXAA 8.5, SMAA 10.6 (high); FXAA adds 0 draws, SMAA 2; bright edges preserved (peak 1.0); background untouched; fine detail kept: SMAA ≥ 50 %, FXAA ≥ 30 % of a textured surface's high-frequency energy (FXAA is the softer filter) |
| Shadows | 3,400 floor pixels darkened under the objects; map size 2048 / 1024 / 512 by tier |
| Environments | chrome sphere mean luminance 0.12 (none) → 0.43 (HDR studio) / 0.27 (EXR); the EXR's HDR sun (value 40) is the hot highlight |
| Instancing / LOD | 96 instanced bolts = 1 draw call, 4,608 triangles; LOD level 0 at 4 units, 2 at 120 units |
| Resource stability | across 300 frames with everything on: **0 growth** in textures, framebuffers, buffers, renderbuffers, pooled targets and estimated GPU bytes; pooled targets released by the idle timer after the window (also after resizes to 1280x720, 1920x1080, 1000x1000) |
| Context loss | a real `WEBGL_lose_context` lose/restore cycle: rendering resumes with no errors; mean image difference before/after **0.35** (of 255) on every tier |
| Diagnostics | draw calls, triangles, textures, estimated GPU bytes, frame time, shader links, active passes and GPU timer availability all reported |

Performance on this machine (headless Chrome, diagnostics attached, every feature on, 300 frames, CPU time to submit a frame; **not** GPU time and not
representative of real GPUs): high **20.2 ms** average (p95 35.4), medium **13.0 ms**, low **9.2 ms**. Baseline scene: 70 draw calls and ~46k triangles;
with AO + SMAA + shadows: 98 draw calls and ~68k triangles (shadow pass included). Estimated GPU memory (tracked allocations): baseline 101.8 MB;
everything on 177.6 MB high, 140.1 MB medium, 113.8 MB low (of which the pooled AO/AA targets are 43.9 / 27.5 / 11.0 MB). `EXT_disjoint_timer_query_webgl2`
was available in this Chrome.

### Not done or not proven here

- Not run on Windows, Linux, Safari, Firefox or a discrete GPU; not run inside Electron.
- `cinema2:asset:optimize --textures ktx2` (needs `toktx`, not installed).
- A full `Cinema2Runtime` with a harness-only preset using the new effects (see Known limitations 9).
- Real-device GPU timings (the figures above are CPU submit times in a headless browser).
