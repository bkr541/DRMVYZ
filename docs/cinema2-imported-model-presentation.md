# Cinema 2.0 SYS-02: imported-model presentation

## Ownership and saved state

The model resolver authorizes the exact pinned asset/version, checks its runtime GLB and geometry metadata, decodes it with GLTFLoader and the existing Meshopt/Draco/KTX2 decoders, then normalizes the longest side to two world units. The shared model cache owns geometry and source textures; the bridge owns instance material clones and its tiered texture copies. The preset still owns fitting, camera, motion, palette, choreography and post-processing. The Source tab already uses Cinema2ActiveSource with the pinned-model panel (SYS-01); no second selector or state store is introduced.

| Control | Saved values | Default | Authority and visible target |
| --- | --- | --- | --- |
| Chamber / Bass Sigil: Model Presentation (Design > Model) | `original`, `integrated` | `original` | User-authored enum, not a modulation or choreography target; standard Auto Performance Design lock applies. The bridge selects imported-only neutral reflection fill or scene lighting. |
| Colossus / Exoskeleton / Monument: Model Presentation (existing Design > Hero material-mode ID) | `original`, `integrated`, `brushed`, `edge` | `original` | Same existing material mode key. Original supplies model-only fill, Scene Integrated uses scene lighting; Brushed Metal and Emissive Edge retain the native controller's explicit treatment. The neutral fill is only for the selected private model, not native fallback geometry or Monument text. |
| Legacy userModelPalette | existing boolean | false | Explicit true keeps its pre-existing tint authority and scene lighting. No old tint selection is discarded. |
| User-model preview representations | existing controls | unchanged | Existing Form, Dust, Shatter, Hologram, Slices and Voxel representation controllers and lighting remain authoritative; no new conflicting presentation control. |

The new enums have no units or numeric ranges. Existing `brushed` and `edge` values are unchanged; no schema revision or destructive migration is needed. Missing/unknown presentation values resolve to Original. Existing `original` values now use the intended neutral material presentation. Switching model versions does not rewrite saved controls. No new audio clock, pattern policy or Auto Performance targets were added.

## Rendering inventory and policy

The editor renders authored materials with its RoomEnvironment PMREM, directional/hemisphere lights and adjustable studio intensity. Cinema uses the shared Three renderer with NoToneMapping and sRGB output and preset-controlled scene light/exposure plus downstream cinematic finishing. Chamber, Bass Sigil, Colossus, Exoskeleton and Monument use the shared bridge and their existing model-specific placement. The 3D previews also use it, with their own representation and light controls. The editor and Cinema may therefore differ in camera, lighting, exposure and post effects even when asset/version matches. This change does not alter the loader, saved asset, normalization or native scene grade.

Original keeps authored material/alpha state and uses the existing cached neutral studio PMREM as a **per-material** environment on imported PBR meshes lacking an authored map. This supplies diffuse and specular environment fill even if Chamber's environment intensity is .015. The intensity is 0.85 times finite scene exposure clamped to 0–1.5 (0–1.275 effective); it does not lift the set's exposure or add another scene-wide light. Authored explicit envMap and its intensity win. Scene Integrated retains authored materials but uses the scene environment; native stylized modes keep their existing metal/emission choices and scene lighting. Existing colored direct lights and post effects still influence the final image. The new policy is a starting point for visual tuning, not a guarantee of pixel parity with the editor.

Private materials do not receive named native part shader hooks, shadow flags, visibility masks or physical replacement. Keep authored visibility, base color, opacity, alpha test, blending, depth write, physical extensions and maps. Low quality retains private normal/AO maps and existing texture-size/memory caps; native low-tier material optimization is unchanged. Non-PBR clones are also disposed on removal. Asset geometry and original textures stay owned by the cache. Replacement clears old pending texture uploads and invalidates a previous shader compilation completion while retaining shared environment ownership.

## Verification matrix

`Cinema2ThreePbr.test.ts` uses procedural distinct colors, tall/wide shapes, a multicolor multi-material mesh, sRGB texture, normal map, transparent/emissive physical material, explicit reflection map and unlit material. Tests cover presentation switches, exposure bound, quality change, native-part name collision, disposal/reselection and legacy palette tint. These are renderer-host mock tests, not measured rendered pixels. Existing loader and source-panel tests remain relevant for pinned/missing versions.

On a dependency-equipped checkout run:

```sh
npm run typecheck
npx vitest run src/components/vyzualz/cinema2/__tests__/Cinema2ThreeScene.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2ThreePbr.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2Chamber.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2BassSigil.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2ColossusPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2ExoskeletonPreset.test.ts src/components/vyzualz/cinema2/__tests__/Cinema2MonumentPreset.test.ts
npm run build
npm run test:e2e:chamber-model
```

Then compare the same pinned versions in the editor and each compatible preset: opaque colored and textured GLB, metallic, emissive, alpha-blended/masked, physical and multi-material, tall and wide. Hold viewport, quality, exposure, track and settings constant, and exercise Original/Scene Integrated/explicit styles, palette edits, save/reload, removal/reselection, missing assets, no track, playback/build/drop, manual/Auto, low/high quality, clipping, GPU memory and frame time. Compare captured pixels with human review; keep native fallback unchanged. Check all 3D previews' intentionally stylized representations. Original recording and review DOCX were not supplied for this change; visual parity, GLB render captures and performance benchmarking remain unverified.
