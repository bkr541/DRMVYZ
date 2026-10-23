# BLOCKSHIFT — Supplied GLB object integration

2026-10-22. Scope: replace the preview's procedural objects with the two user-supplied GLBs. This is a revision of the visual core, not the start of full P4 animation or later audio/effects work.

## Object assignment and rendering

- Stable center `block-04`: `docs/BLOCKSHIFT/impossible_cube.glb` (7,328 triangles).
- Eight surrounding IDs: `docs/BLOCKSHIFT/hallow_cube.glb` (56 triangles per instance).
- All nine retain their existing identity, formation targets, size/spread/depth/rotation controls and basic clock behavior.
- Authored node transforms are baked from the decoded scene; the complete model is centered and uniformly scaled to a unit bounding box. The original huge FBX-space coordinates of Impossible Cube therefore cannot displace or enlarge the installation unexpectedly. Existing sphere clearance remains conservative.
- Both models' full triangle geometry and normals are used, including the Hallow Cube's six dark panel meshes. No procedural cube or rod fallback remains. Missing/invalid models produce module diagnostics; late loading after preset disposal cannot allocate GPU resources.
- Dark source materials map to Block Body. Colored/emissive source materials map to Primary Edge, Secondary Edge or Impact Accent according to stable object identity. Background remains engine owned. Original textures are absent in both supplied files. Material colors are deliberately remapped; source PBR material settings are not reproduced by the native shader.
- The native renderer shares model geometry between instances: **four material batches** (Hallow body/frame ×8, Impossible body/frame ×1), **7,776 triangles** per frame. Each model group has a retained instance buffer. The renderer uses the engine camera/depth target and existing resource scope; Three is used only for the shared GLB decode/bake, not as another renderer or animation loop.
- Static camera position moves from `[10,7,24]` to `[8,5.6,19.2]` at the same angle/FOV to improve apparent size. This is modest framing adjustment, not final visual approval.

## Assets and attribution

Byte-identical shipped copies live in `public/cinema2/models/blockshift-*-cube.glb`. Original supplied files remain unchanged. `assets/cinema2/cinema2-blockshift-*/asset.json` feeds the existing generated asset manifest/registry and shipped attribution list.

Metadata embedded in the supplied files identifies Hallow Cube by Jovian Blaze and Impossible Cube by tomciomalina as CC BY 4.0. Attribution, source links, license links and runtime normalization/material changes are recorded in the asset records and `public/cinema2/attributions.json`.

## Focused verification

- Asset pipeline build: **PASS**, generated manifest and attributions contain both models.
- Focused BLOCKSHIFT Vitest: **17/17 PASS**. Tests decode the actual GLBs, compare shipped bytes to originals, check triangle counts/centered unit bounds/normalized normals, retain geometry/parameter/camera checks, verify all four actual draw batches, GPU cleanup, model failure diagnostics and disposal during pending load.
- Focused TypeScript: **0 changed-file diagnostics**, **4 existing dependency diagnostics** for the BLOCKSHIFT source/test roots. Full repository typecheck/build remains blocked by the recorded baseline and was not repeated.
- Focused ESLint: **PASS** for changed BLOCKSHIFT source/tests and browser scripts.
- Browser: **PASS** on the normal production preset chooser/canvas: both GLBs fetched successfully, four actual material batches, all nine model regions visible and framed at 16:9/1:1/9:16, static pixels stable, GPU objects balanced on re-entry, six formations, geometry/intensity controls, all five independent palette roles, saved settings and BPM/pause/zero-motion behavior. The existing Vite bundle was reused after changing only the acceptance script to suit the new mesh topology. The updated acceptance projects actual uploaded instance bounds with the actual camera and requires visible pixels in all nine regions. A connected bright-component count is no longer a valid object-count oracle because Impossible Cube has disconnected fine trim. GPU batch/instance counts independently verify eight plus one models.

Evidence is preserved in [evidence/glb-models](evidence/glb-models/), including [the actual workspace](evidence/glb-models/production-workspace.png), [wide output](evidence/glb-models/idle-bloom-off-16x9.png) and [acceptance JSON](evidence/glb-models/acceptance.json). Reproduce with Node 22: `npm run test:e2e:cinema2-blockshift:models`. Working tree/integration diff and `git diff --check` reviewed. The preview remains a reference preset; user visual acceptance and the later movement/audio/automation/effect phases remain outstanding. No commit requested; all implementation changes are uncommitted.
