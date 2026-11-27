# Marquee v2: Geometry Reconstruction Package

**Status:** Working, programmatically constructed 3D reconstruction; **not** a final photoreal / pixel-matched model. All 16 automated structural checks passed. The exported GLB and glTF were independently re-imported and rendered in an offscreen VTK viewer. **Blender itself was not available to execute the `.blend` scene builder.** Cinema 2.0 runtime integration, GPU material behavior, HDR/bloom, reflections, and reference-image acceptance remain unverified.

## First, the assets

| Artifact | Path | Use |
|---|---|---|
| Replacement GLB | `assets/DVYDRM_Marquee_HighFidelity_v2.glb` | Primary 3D runtime starting model, separate 3D scene nodes and embedded textures |
| Alternate glTF | `assets/gltf/model.gltf`, `assets/gltf/gltf_buffer.bin` | Editable/textual glTF scene reference; keep both together |
| Reproducible GLB builder | `source/build_marquee_hifi.py` | Rebuilds actual mesh geometry and original texture files using Python 3 |
| Blender setup builder | `source/Build_Marquee_v2_in_Blender.py` | Imports the new GLB, adds editable native Blender text, light rig/cameras, and saves a `.blend` after running it locally |
| New blueprint | `assets/Marquee_Geometry_Blueprint_v2.svg` | Current, model-aligned front/top technical construction diagram |
| Manifest | `assets/Marquee_Geometry_Manifest_v2.json` | Coordinates, three text planes, camera presets, fixture groups and mesh counts |
| Structural checks | `source/validate_geometry_v2.py` and `assets/Marquee_Structural_Validation_v2.json` | Re-run explicit structural acceptance checks on an exported GLB |
| Actual 3D preview | `previews/Marquee_v2_front_hero.png` | Offscreen glTF-imported GLB rendering; no Cinema 2.0 postprocessing |
| Other views | `previews/Marquee_v2_right_three_quarter.png`, `previews/Marquee_v2_low_canopy.png` | Scene depth inspection |
| Comparison | `previews/Marquee_v2_REFERENCE_COMPARISON.png` | Side-by-side reference and direct VTK GLB render |

## What has physically changed since the old GLB

1. **More pronounced projected canopy:** Real polygonal solid with a projection to `Z=+5.73` and an authored red/brass perimeter.
2. **Actual underside fixtures:** 27 full-length support/rib paths and hundreds of independently named suspended underside bulb meshes, with a longer radial/fan field across the trapezoidal projection.
3. **True three-sided marquee:** A left, front and right face with distinct surface normals, shell backing, separate text planes, rails, and individual lighting nodes.
4. **Layered Art Deco crown:** Six distinct arched 3D portal sweeps, textured columns and separately named red/amber/blue neon tube geometry.
5. **Curtain:** An actual wavy mesh of 164 × 30 divisions, a red velvet variation texture, and top valance geometry.
6. **Towers:** Substantial tower panel meshes, rounded outlines, incandescent-lens fixture geometry, border bulbs, and small upper-arc bulbs.
7. **Facade and entrance:** Textured brick bond, stone courses, window recesses and mullions, six separate glass-door assemblies, storefront display niches, local lamp props, detailed columns and pavement.

These are **real individual 3D surfaces and meshes**, not a source image pasted onto a quad. The scene is still an approximate reconstruction of one viewpoint, not a surveyed or fully photoreal asset.

## Independent Marquee text surfaces

- `marquee.front.TEXT_SURFACE`: default `DVYDRM`.
- `marquee.left.TEXT_SURFACE`: default `SHOWINGS`.
- `marquee.right.TEXT_SURFACE`: default `SHOWINGS`.

The GLB comes with independently replaceable default textured planes. The lettering is **not permanently baked into the structural backboards**. In Cinema 2.0, replace each sign's `TEXT_SURFACE` material or canvas texture using the application's existing user-parameter binding; do not change the text by mutating the GLB file and do not share a single texture object across all three faces. Retain the original textured plane as a default fallback if the runtime cannot generate a texture.

`assets/Marquee_Geometry_Manifest_v2.json` defines the panel endpoint pairs in X/Z, outward normals, text Y bounds, and offsets.

## Frame and cameras

Right-handed scene coordinates: **X right, Y up, +Z toward camera**. Units are **artistic scene units**. The default hero camera is intentionally lower than the old camera to expose the underside of the marquee rather than looking straight at a flat sign. The camera should be created from `camera_presets.front_hero` rather than inheriting the old GLB's camera.

- Front hero: `[0,1.6,19]` looking at `[0,5.15,0.30]`, vertical FOV 42°.
- Left and right three-quarter angles and a low-canopy inspection shot are in the manifest.

## Blender use

With Blender **4.x** installed, unpack the ZIP preserving folders and run:

```sh
blender --background --python source/Build_Marquee_v2_in_Blender.py -- --render
```

This should import `assets/DVYDRM_Marquee_HighFidelity_v2.glb`, organize collections, create genuine Blender FONT objects over the three sign surfaces, install stage lighting and cameras, and save `assets/DVYDRM_Marquee_HighFidelity_v2_EDITABLE.blend`. This builder has been Python syntax-checked but **has not been executed or rendered in Blender in this environment**, so Blender-version-specific errors remain possible. The base `.glb` has been independently reloaded and rendered.

For a headless render with the builder, run `--render`, or omit that flag to save only the editable scene. Rendering defaults to Cycles with 48 samples.

## Rebuild model outside Blender

```sh
pip install trimesh numpy pillow shapely svgwrite vtk cairosvg
python source/build_marquee_hifi.py
python source/validate_geometry_v2.py
python source/render_validation.py
```

The runtime-importable GLB and model manifest are regenerated by the first command. The offscreen VTK preview script requires VTK and a working rendering backend.

## Strict guidance for Claude Code / Cinema 2.0

1. **Back up the old `.glb`; do not blindly overwrite app assets.** Replace the old Marquee scene only in the new Marquee preset and retain rollback until approved.
2. **Map material/node names from the new manifest.** Mesh counts/IDs, material names, extents and camera coordinates differ from the original source; old hardcoded offsets will be wrong.
3. Preserve all three `*.TEXT_SURFACE` nodes, support separate user-editable text values, do not bake arbitrary text into the sign backboard.
4. Batch/instance bulbs in the production renderer. Preserve authored node IDs in an addressable fixture map, but do not retain 1,200 separate draw calls if performance suffers.
5. Separate material base brightness from emission, bloom, tone mapping, and reflected light. The GLB's materials are modestly emissive; the standalone VTK previews deliberately omit Cinema 2.0 HDR/bloom and therefore show a darker scene than the intended night-theater render.
6. First prove *production static visual parity* against `previews/Marquee_v2_REFERENCE_COMPARISON.png` and the clean reference image. Correct geometry if it still looks wrong. Only then add Audio Intelligence, motion and pattern changes.
7. Run production visual tests from camera angles including low-canopy and both angled sign faces. An all-green structural report is **not** visual acceptance.
8. Respect the full Cinema 2.0 creation contract for shared Audio Intelligence, user authority, 6+ genuine patterns, Pattern Change/Trigger, 4+ independent Palette colors and BPM Sync. These behaviors are **not implemented by a static GLB**.

## Remaining limitations / honest acceptance status

- This is a **substantially more modeled and parameterized reconstruction**, but still stylized. Architectural accuracy, brick realism, glass transparency/refraction, lobby, curtain appearance, metal microdetail, curved ornament refinement, lens brightness and cinematic reflections still require a real Blender and Cinema 2.0 look-development pass.
- The original approved image cannot uniquely define hidden depth, facade sections, lens geometry or physical dimensions. The missing dimensions are authored estimates and must be approved visually.
- Offscreen GLB previews were generated with VTK, not Cycles, Eevee, or the application renderer. They prove geometry projection and node loading, not the final real-time lighting appearance.
- The v2 GLB fixes major modeling deficiencies, but it does **not yet satisfy human photo-match acceptance**. No claim of pixel-perfect or production-final rendering is made.
