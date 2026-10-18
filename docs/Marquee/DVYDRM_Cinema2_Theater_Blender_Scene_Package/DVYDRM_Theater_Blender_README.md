# DVYDRM | Cinema 2.0 Theater: Blender Scene Builder

## What this deliverable is

A **Blender-native editable scene generator** for the DVYDRM three-sided marquee theater. The complete source `.glb` is included in this package. The accompanying `.py` script imports the already-modeled theater, builds editable **native Blender FONT** letterforms on each marquee face, organizes its 3D objects, exposes emission controls, adds look-development lighting and five camera views, creates a timeline lighting demo, and **saves a real `.blend` file on your computer**.

**Why a `.py` builder rather than a pre-generated `.blend`?** Blender's executable/API was not available in the generation environment, so the `.blend` file could not be built or rendered-tested here. The builder Python source was syntax-checked; the underlying GLB geometry and required node identities were checked separately. Blender still needs to execute the builder on your system. No native `.blend` is falsely presented as pre-generated.

## Fastest path: generate your .blend in Blender

1. Extract the ZIP. Keep `DVYDRM_Cinema2_Theater_Blender_Builder.py` and `DVYDRM_Cinema2_Theater.glb` **in the same folder**.
2. Open Blender **3.6 LTS or 4.x** (4.x recommended).
3. Go to **Scripting > Open**, choose `DVYDRM_Cinema2_Theater_Blender_Builder.py`, then click **Run Script**.
4. Wait for the theater and lighting arrays to import; there are over **1,800 glTF scene nodes** and this may take a little time.
5. The script saves `DVYDRM_Cinema2_Theater_EDITABLE.blend` in the same folder. Open the saved file as usual.

Or use the terminal from the extracted directory (replace `blender` with your Blender executable path if necessary):

```bash
blender --background --python DVYDRM_Cinema2_Theater_Blender_Builder.py -- --output DVYDRM_Cinema2_Theater_EDITABLE.blend
```

To save the scene **and** render a PNG preview (slower):

```bash
blender --background --python DVYDRM_Cinema2_Theater_Blender_Builder.py -- --output DVYDRM_Cinema2_Theater_EDITABLE.blend --render
```

You can also use `--engine cycles --samples 64` for an optional Cycles render. Eevee is the default.

## Editing the three signs

In the Outliner, expand **`DVYDRM | CINEMA 2.0 THEATER` > `05 | LIVE BLENDER TEXT`**.

| Blender FONT object | Default | Corresponding sign geometry |
|---|---|---|
| `C2_TEXT_FRONT_EDITABLE` | `DVYDRM` | `marquee.front.TEXT_SURFACE` |
| `C2_TEXT_LEFT_EDITABLE` | `SHOWINGS` | `marquee.left.TEXT_SURFACE` |
| `C2_TEXT_RIGHT_EDITABLE` | `SHOWINGS` | `marquee.right.TEXT_SURFACE` |

Select a FONT object, press **Tab**, edit the text, and press **Tab** again. The letters are native Blender curves, not a flattened image texture. Each one is positioned and rotated using the original sign quad corners. For significantly longer words, adjust the FONT object's X scale and font size.

The source mesh for each sign is retained as a **separate blank letterboard plane** and keeps its exact Cinema 2.0 ID. Blender's FONT objects are for look development. In **Cinema 2.0 runtime**, put dynamic CanvasTexture/atlas-generated text onto those `*.TEXT_SURFACE` meshes instead of assuming a WebGL engine can edit Blender FONT data.

## Animated lighting controls

In **Scene Properties > Custom Properties**, adjust these values (the script creates them and connects driven emissive materials):

- `C2_MASTER`: global master gain
- `C2_CANOPY`: rows of marquee-underside bulbs
- `C2_MARQUEE_BULBS`: trim bulbs on three sign faces
- `C2_TOWER_BULBS`: side tower incandescent bulbs
- `C2_LED_LEFT` and `C2_LED_RIGHT`: separately controllable entrance LED grids
- `C2_NEON_RED`, `C2_NEON_BLUE`, and `C2_NEON_AMBER`: primary neon accents

The material controls adjust emission *appearance*, not individual real Blender point lights for every bulb. This helps keep the scene usable without thousands of shadow-casting lamps. You can inspect and animate fixture objects individually later.

The sample timeline covers 240 frames at 60 FPS, with markers for intro, kick, build, drop, and outro. It is **demonstration animation only**, not live audio analysis, and it is not a replacement for the Cinema 2.0 pattern/trigger architecture.

## Camera views

Five `C2 CAMERA` objects are created under `06 | CAMERAS`:

1. Front Hero (default)
2. Left Three-Quarter
3. Right Three-Quarter
4. Marquee Detail
5. Low Angle

You can choose a camera and press `Ctrl+Numpad0` to make it the active scene camera.

## Engine interoperability and limitations

- Blender imports the glTF **Y-up** scene into Blender **Z-up** coordinates; the theater faces **negative Y** in Blender. The builder derives the sign rotations from the imported quads, so the three independently editable letters follow the angled faces accurately.
- Underlying model is a **reference-guided procedural approximation**, not a surveyed replica or photogrammetry reconstruction.
- The project contains real geometry, UV-mapped materials, and separately named fixture nodes. It is not just the reference photo used as a texture.
- Emission and compositor glare will vary by Blender version and GPU. The builder includes fallback logic for Eevee/glow configuration, but the final appearance should be reviewed and tuned on your machine.
- **This script was not executed inside Blender during creation.** If a Blender version-specific issue arises, the editable source script is supplied for correction.
- The runtime semantics of Pattern Change, Trigger, Auto Performance, and Audio Intelligence belong in the eventual Cinema 2.0 host preset, not this offline Blender look-development asset.

## Package layout

```
DVYDRM_Cinema2_Theater_Blender_Builder.py   # builder, editable Blender Python
DVYDRM_Cinema2_Theater.glb                  # complete 3D geometry/material source
DVYDRM_Theater_Blender_README.md            # this file
Cinema2_Theater_Node_Manifest.json          # source naming, sign quads, routing hints
DVYDRM_Cinema2_Theater_Geometry_Blueprint.svg  # original blueprint
DVYDRM_Cinema2_Theater_Model_Preview.png    # preview of upstream GLB (not a Blender builder render)
reference/art_deco_theater_marquee_at_night.png  # approved cleaned image
```

No need to install a Python package in Blender. Blender's built-in glTF importer is used.
