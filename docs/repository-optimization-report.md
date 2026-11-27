# Repository optimization report — source archive (42)

Measured from the supplied ZIP, not the earlier historical estimate. All sizes in MiB (1,048,576 bytes); working-tree figures exclude `.git`, local dependencies and generated output. The optimized full archive below was measured with Git ZIP immediately before adding this report; the report is small and final export totals may differ by rounding. The uploaded ZIP uses a different archive producer, so compressed full-tree differences are approximate comparisons.

| Metric | Original | Optimized (before this report) |
|---|---:|---:|
| Files | 4,480 | 4,455 |
| Uncompressed tree | 626.87 | 597.10 |
| Compressed full tree | 383.17 | 366.80 |
| Net uncompressed reduction | | 29.77 (4.75%) |
| Permanently removed files (includes one unpacked documentation ZIP) | | 38 |
| Verified redundant files removed | | 14 |
| Byte-identical relocation/rename | | 13 |

## Directory breakdown

| Directory | Before files | Before MiB | After files | After MiB |
|---|---:|---:|---:|---:|
| `public` | 259 | 315.65 | 259 | 315.65 |
| `docs` | 399 | 194.14 | 370 | 49.89 |
| `scripts` | 292 | 45.97 | 295 | 45.94 |
| `src` | 3235 | 41.03 | 3237 | 41.51 |
| `3D Cinema 2.0 Crate` | 8 | 21.78 | 0 | 0.00 |
| `Sound Drawing` | 15 | 4.79 | 9 | 1.25 |
| `(root files)` | 25 | 1.19 | 25 | 1.20 |
| `electron` | 5 | 0.97 | 5 | 0.97 |
| `supabase` | 103 | 0.72 | 103 | 0.72 |
| `native` | 45 | 0.39 | 45 | 0.39 |
| `DRMVYZ_3D_Model_Implementation_Prompts` | 8 | 0.08 | 8 | 0.08 |
| `android-tv-receiver` | 23 | 0.07 | 23 | 0.07 |
| `User Guide Material` | 1 | 0.05 | 1 | 0.05 |
| `assets` | 59 | 0.05 | 60 | 0.06 |
| `.github` | 1 | 0.00 | 1 | 0.00 |
| `build` | 1 | 0.00 | 1 | 0.00 |
| `.claude` | 1 | 0.00 | 1 | 0.00 |
| `asset-sources` | 0 | 0.00 | 12 | 139.33 |

## Extension breakdown

| Extension | Before count | Before MiB | After count | After MiB |
|---|---:|---:|---:|---:|
| `.glb` | 96 | 479.16 | 86 | 458.39 |
| `.png` | 74 | 45.75 | 60 | 40.30 |
| `.ts` | 2519 | 27.40 | 2520 | 27.40 |
| `.wasm` | 4 | 13.72 | 4 | 13.72 |
| `.task` | 2 | 9.09 | 2 | 9.09 |
| `.jpg` | 29 | 8.99 | 20 | 5.51 |
| `.json` | 100 | 6.28 | 101 | 6.28 |
| `.tsx` | 529 | 5.94 | 529 | 5.94 |
| `.onnx` | 1 | 4.36 | 1 | 4.36 |
| `.webp` | 155 | 4.24 | 155 | 4.24 |
| `.md` | 303 | 3.85 | 309 | 3.99 |
| `.html` | 69 | 2.94 | 69 | 2.94 |
| `.mjs` | 245 | 2.45 | 250 | 2.46 |
| `.svg` | 64 | 2.34 | 61 | 2.28 |
| `.css` | 71 | 1.57 | 71 | 1.57 |
| `.otf` | 7 | 1.16 | 7 | 1.16 |
| `.wav` | 2 | 0.96 | 2 | 0.96 |
| `.hdr` | 7 | 0.96 | 7 | 0.96 |
| `.js` | 8 | 0.94 | 8 | 0.94 |
| `.gltf` | 2 | 0.91 | 2 | 0.91 |
| `.gz` | 3 | 0.75 | 3 | 0.75 |
| `.bin` | 2 | 0.73 | 2 | 0.73 |
| `.sql` | 82 | 0.55 | 82 | 0.55 |
| `.patch` | 4 | 0.54 | 4 | 0.54 |
| `.cjs` | 46 | 0.39 | 46 | 0.39 |
| `.tflite` | 1 | 0.24 | 1 | 0.24 |
| `.ttf` | 1 | 0.16 | 1 | 0.16 |
| `.mp4` | 1 | 0.14 | 0 | 0.00 |
| `.py` | 9 | 0.10 | 9 | 0.10 |
| `.txt` | 11 | 0.09 | 11 | 0.09 |
| `.kt` | 10 | 0.06 | 10 | 0.06 |
| `.zip` | 1 | 0.05 | 0 | 0.00 |
| `.woff2` | 1 | 0.04 | 1 | 0.04 |
| `.yml` | 1 | 0.00 | 1 | 0.00 |
| `.xml` | 5 | 0.00 | 5 | 0.00 |
| `.example` | 2 | 0.00 | 2 | 0.00 |
| `.webm` | 1 | 0.00 | 1 | 0.00 |
| `.command` | 1 | 0.00 | 1 | 0.00 |
| `(none)` | 4 | 0.00 | 4 | 0.00 |
| `.exr` | 1 | 0.00 | 1 | 0.00 |
| `.kts` | 3 | 0.00 | 3 | 0.00 |
| `.plist` | 1 | 0.00 | 1 | 0.00 |
| `.properties` | 1 | 0.00 | 1 | 0.00 |
| `.pro` | 1 | 0.00 | 1 | 0.00 |

## Removal categories

| Category | Files | Removed MiB |
|---|---:|---:|
| duplicate GLB | 10 | 20.76 |
| historical screenshot | 22 | 7.75 |
| duplicate reference | 2 | 1.20 |
| development recording | 1 | 0.14 |
| duplicate vector source | 2 | 0.05 |
| documentation ZIP wrapper (written contents preserved) | 1 | 0.05 |

The original archive already lacked most historical screenshots and recordings mentioned in the task. The actual removed records and canonical paths follow. The Sound Drawing engineering ZIP was unpacked into five readable Markdown files, so its written contents survive (trailing blank lines normalized).

| Removed path | MiB | Category / canonical path |
|---|---:|---|
| `3D Cinema 2.0 Crate/geometry_texture_effect_spheres.glb` | 9.07 | `public/cinema2/models/crate/geometry_texture_effect_spheres.glb` |
| `3D Cinema 2.0 Crate/stroboscopic_glitch_-_photosensitivity_warning.glb` | 5.82 | `public/cinema2/models/crate/stroboscopic_glitch_-_photosensitivity_warning.glb` |
| `3D Cinema 2.0 Crate/pulse_cubed.glb` | 2.13 | `public/cinema2/models/crate/pulse_cubed.glb` |
| `3D Cinema 2.0 Crate/lightweight.glb` | 1.63 | `public/cinema2/models/crate/lightweight.glb` |
| `docs/Marquee/Marquee_v2_REFERENCE_COMPARISON (1).png` | 1.19 | `docs/Marquee/Marquee_Reconstruction_v2/previews/Marquee_v2_REFERENCE_COMPARISON.png` |
| `docs/Marquee/DVYDRM_Cinema2_Theater.glb` | 1.16 | `docs/Marquee/DVYDRM_Cinema2_Theater_Blender_Scene_Package/DVYDRM_Cinema2_Theater.glb` |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step7-max.png` | 0.66 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_4_closer_stills.jpg` | 0.65 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_4_overview.jpg` | 0.58 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_1_overview.jpg` | 0.50 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-final.png` | 0.48 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-static-core.png` | 0.45 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_6_closer_stills.jpg` | 0.42 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_2_overview.jpg` | 0.42 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-larger-room.png` | 0.39 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_1_closer_stills.jpg` | 0.37 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_6_overview.jpg` | 0.36 | historical screenshot |
| `docs/BLOCKSHIFT/impossible_cube.glb` | 0.35 | `public/cinema2/models/blockshift-impossible-cube.glb` |
| `docs/NIGHTSHIFT/NIGHTSHIFT-final-square.png` | 0.31 | historical screenshot |
| `3D Cinema 2.0 Crate/paradox_abstract_art_of_python.glb` | 0.27 | `public/cinema2/models/crate/paradox_abstract_art_of_python.glb` |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step2-default.png` | 0.26 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step4-transition.png` | 0.26 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step6-drop.png` | 0.25 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step7-off.png` | 0.25 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step3-groove.png` | 0.24 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-final-portrait.png` | 0.24 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step5-impact.png` | 0.23 | historical screenshot |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step2-diamond-ripple.png` | 0.23 | historical screenshot |
| `3D Cinema 2.0 Crate/oyes.glb` | 0.22 | `public/cinema2/models/crate/oyes.glb` |
| `Sound Drawing/Sound_Drawing_Instructional_Package/video_inspection/Sound_Drawing_2_closer_stills.jpg` | 0.16 | historical screenshot |
| `Sound Drawing/Sound_Drawing_Instructional_Package/examples/Sound_Drawing_Triangle_XY_Preview.mp4` | 0.14 | development recording |
| `3D Cinema 2.0 Crate/lasers_-_vj.glb` | 0.10 | `public/cinema2/models/crate/lasers_-_vj.glb` |
| `Sound Drawing/DRMVYZ_SOUND_DRAWING_ENGINEERING_PACKAGE.zip` | 0.05 | documentation ZIP wrapper (written contents preserved) |
| `scripts/cinema2-assets/sources/dvydrm-logo-master.svg` | 0.03 | `src/assets/dvydrm_cloud_logo_clean_master.svg` |
| `scripts/cinema2-assets/sources/dvydrm-wordmark-master.svg` | 0.02 | `src/assets/dvydrm_wordmark_clean_master.svg` |
| `Sound Drawing/Sound_Drawing_Instructional_Package/examples/Sound_Drawing_Triangle_XY_Preview.jpg` | 0.01 | historical screenshot |
| `docs/BLOCKSHIFT/hallow_cube.glb` | 0.01 | `public/cinema2/models/blockshift-hallow-cube.glb` |
| `docs/Marquee/Marquee_Geometry_Blueprint_v2.svg` | 0.01 | `docs/Marquee/Marquee_Reconstruction_v2/assets/Marquee_Geometry_Blueprint_v2.svg` |

## Preserved originals and fixture

No original owner model was discarded without a verified identical canonical copy. These files were moved byte-for-byte, not converted or recreated. Preserve `asset-sources/` until external backups have been verified by SHA-256. The regression screenshot remains a real fixture.

| Prior path | New path | MiB | SHA-256 |
|---|---|---:|---|
| `3D Cinema 2.0 Crate/cdj_player.glb` | `asset-sources/crate/cdj_player.glb` | 2.54 | `bb353cbdeb3cf6ef558c6b0104620ff946fd047cc845c752a7d8f8a47c29bd75` |
| `docs/NIGHTSHIFT/NIGHTSHIFT-step7-default.png` | `src/test/fixtures/cinema2/nightshift-approved.png` | 0.48 | `2c2b1b067c7adbd42e23dc4f43c3a9ac16b9382d39840d2df759f00a20f4f0ee` |
| `docs/Vacancy/tv_set.glb` | `asset-sources/vacancy/tv_set.glb` | 9.90 | `f5bb67e610ca765fcded9591c65d8cdb1b1c1abd1876c771b37f588b97c02af6` |
| `docs/Vacancy/old_school_tv.glb` | `asset-sources/vacancy/old_school_tv.glb` | 25.42 | `be2cfe31717f8c4f2500d94c3648189f1ed645064ea5d06b9557ffe47b14899b` |
| `docs/Vacancy/sony_pvm-14l2_crt_tv.glb` | `asset-sources/vacancy/sony_pvm-14l2_crt_tv.glb` | 67.35 | `372c6e902e15affadfe6dc2df14973869e5086c50fa392f53ff423535d7d06ba` |
| `docs/Vacancy/abandoned_brick_room.glb` | `asset-sources/vacancy/abandoned_brick_room.glb` | 2.82 | `cd8fc0867f15440d7b5a795e6ce93341bcdde5e36303e2c401225ed1f727c706` |
| `docs/Vacancy/old_tv2.glb` | `asset-sources/vacancy/old_tv2.glb` | 0.66 | `e5a0fe697a8899d6543ab66c07ef301178b65ca13698fb98e4b0f380ebe1f21a` |
| `docs/Vacancy/vintage_tv4.glb` | `asset-sources/vacancy/vintage_tv4.glb` | 11.59 | `ddb8c4f793f61b5bff9013a0f4c26a05bd614533967d24d53b949e89472941e1` |
| `docs/Vacancy/tv__old_tv__retro_tv.glb` | `asset-sources/vacancy/tv__old_tv__retro_tv.glb` | 8.45 | `7962862740599535e548d70a1a37b4f0e50a5077c1f381d328e4105dca576e55` |
| `docs/NIGHTSHIFT/animated_dance_floor_neon_lights.glb` | `asset-sources/nightshift/animated_dance_floor_neon_lights.glb` | 2.51 | `242009912bb811fe3e5ff32f9361a6c2d05d26aca6f3531c2edcf4011947bbe4` |
| `docs/NIGHTSHIFT/pretty_simple_discoball.glb` | `asset-sources/nightshift/pretty_simple_discoball.glb` | 2.01 | `b4378a2ac2aaf35e04191f3007257cdb954b99f8a4ee6a0b726e98498b406d0a` |
| `docs/NIGHTSHIFT/disco_ball__dance_floor.glb` | `asset-sources/nightshift/disco_ball__dance_floor.glb` | 3.03 | `2bc72683fca30c53c991d993e934345d089b884776322b5bb3ae4ec83da6c031` |
| `docs/NIGHTSHIFT/disco_ball__dance_floor (1).glb` | `asset-sources/nightshift/disco_ball__dance_floor (1).glb` | 3.05 | `b5fe0ea81dab3caab433d499e6211b5c97c9fa9df45e4a5786ff6e89c6be0e02` |

## Remaining assets and rationale

- All 292 pre-existing files in `public/`, `src/assets/`, and `electron/assets/` except the updated attribution JSON were checked by SHA-256; none changed. All 56 GLB headers and JSON chunks in those paths parsed; geometry/material bytes are unchanged. Sixteen exact embedded texture groups were observed across/within runtime GLBs; repacking GLBs could change loader behavior, geometry/material identities, and budgets, so no texture repacking was attempted. Runtime artwork URL aliases are deliberately retained because their individual public identities may be referenced dynamically or externally. Remaining duplicate groups are reported by the audit, not automatically deleted.
- MARQUEE v2 outstanding visual approval evidence and source packages, BWC unique sources and reference artwork, and NIGHTSHIFT original reference were preserved pending approval/dependency review. The MARQUEE model rollback is distinct from the current shipped model. PSYLO and NEON FOREST source binaries remain in their source directories for current automated source-hash tests; builders also accept an external root. The original archive already lacks `docs/PSYLO/PSYLO-asset-report.json` and `docs/NEON_FOREST/NEON_FOREST-asset-report.json`; the builders now recreate report directories. Regenerating these reports requires installed tooling and may also regenerate runtime models, so do it in a separate checkout and review hashes before accepting changes. Do not treat their absence as passing validation.
- No production preset registration, rendering module, shader, pattern, choreography, audio-intelligence, mood, camera, pack, Supabase migration or user data was changed. `public/cinema2/attributions.json` and asset-record origin strings reflect historical paths and relocated sources; licenses and attribution are preserved. Electron packages `dist`, `electron`, `native` and package metadata, not the new source archive or docs. Existing media/audio/font DB storage uses Supabase buckets; Electron profiles use userData. No source-tree write issue requiring a user-storage migration was verified. Full end-to-end user media/casting/GPU execution was not performed.

## Governance and developer tools

See `docs/repository-asset-governance.md` for export/audit commands, ignore rules, CI enforcement, optional source configuration, privacy limitations and the production finalization gate. The standard export includes normal runtime and test inputs available in this upload, with all omitted binary paths and hashes recorded. It excludes the preserved original sources and retained documentation/educational binaries. `--full-assets` includes the latter, not preserved originals. `--source-only` is intentionally not runnable. The current upload has incomplete historical report inputs, so no mode can recover them automatically.

| Development ZIP mode | Measured compressed size before report |
|---|---:|
| `STAGELESS-Studio-Development.zip` | 201.54 MiB |
| `STAGELESS-Studio-Development-full-assets.zip` | 237.75 MiB |
| `STAGELESS-Studio-Development-source-only.zip` | 19.76 MiB |

## Validation

- `npm run test:asset-governance`: 3/3 passed, including working-tree selection, native output path safety, deterministic ZIP and external source resolution. `npm run audit:assets -- --check` passed (0 policy issues); `npm run repo:hygiene` passed.
- All three export modes generated, ZIP CRC checks passed, repository-relative paths and native casting source checked. Each excluded preserved original has a SHA-256 in the export inventory. ZIP determinism tested with an independently generated fixture.
- `npm run assets:check`: passed (55 asset records, 278.61 MiB shipped). `npm run test:cinema2:release-policy`: 37/37 passed.
- `npm run test:native`: 138/140 passed; the two failures in `native/diagnostics/preloadDiagnostics.test.cjs` also fail on the unchanged baseline (`undefined.includes`). `npm run test:assets`: 78/85 passed on both baseline and modified tree; seven failures caused by unavailable dependencies (`three`, glTF tooling, etc.).
- `npm ci --offline --ignore-scripts` failed with ENOTCACHED (missing `zustand` package); typecheck and production build were attempted and failed on missing `vite/client`. The focused Vitest preset tests, real rendering and Electron GPU validation were not executed. No claims of full build, render or visual acceptance are made. Install dependencies and run `npm ci`, `npm run typecheck`, `npm run test`, `npm run test:assets`, `npm run assets:check`, `npm run build`, `npm run test:native`, and preset-specific visual acceptance with the existing GPU environment. Resolve the pre-existing missing report files before claiming the full asset test suite passes.
- Patch is generated from the original snapshot with full Git object indexes, binary deletion payloads and exact renames; verify with `git apply --check` before applying. The delivery step checks and applies the final patch in an independent baseline working tree. Do not apply to a diverged checkout without reviewing the check output.
