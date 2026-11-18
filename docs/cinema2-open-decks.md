# OPEN DECKS (Cinema 2.0, preview only)

A 3D model of a CDJ, textured with a reference photograph. It is a **preview-only reference preset** like War Of Worlds: a static scene for framing and visual review, with no musical behaviour of its own. Preset id `drmvyz.cinema2.open-decks`; catalog role `reference`.

## What it is

The reference photograph (`scripts/cinema2-assets/sources/open-decks-cdj-reference.png`, 1080 x 800) is a straight-on view of the top of a CDJ. Each part of the hardware is measured off it in photo pixels (`PARTS` in `scripts/cinema2-assets/generate-open-decks.mjs`) and built as a real volume:

- the **chassis plate** and the **raised screen housing** (0.17 units above the plate's back, 0.08 above its front), with the **glass set back** inside the housing opening, so the bezel stands proud of the screen;
- six **soft keys** on the housing, eight **hot-cue pads**, the browse cluster with its **rotary** and **knob**, the in/out/loop buttons, the vinyl-speed knob, delete/memory/arrow buttons, the time-mode knob and the smaller keys, each raised by its own height.

The **tops** of the parts are mapped to the photograph by a planar projection from the front, so from the front the model reads exactly as photographed (screen content, labels, colours and brushed-metal texture included), and from the side it has parallax, steps and edges. The **sides** of the parts are a plain dark brushed metal instead of the stretched photo. The glass is dark and glossy and lights itself with the photograph's own screen.

The model has three meshes: `cdj` (two primitives: the photographed tops and the metal sides), `screen` (the glass) and `backdrop` (a dark wall, 16 x 10 units so no camera angle sees its edge, hanging 0.15 units behind the chassis back plane: the gap the device's shadow falls across). It is about 2,600 triangles with the photograph embedded once as a JPEG, 0.14 MiB meshopt-compressed (`public/cinema2/models/open-decks.glb`, asset `cinema2-open-decks`). Regenerate with `node scripts/cinema2-assets/generate-open-decks.mjs`; the part table, heights and wall are at the top of that file.

## The preset

- **Scene:** one `three-scene` module with the model, facing the camera head on (an orbit camera at 0° heading and 0° elevation, radius 2.9). It is lifted off its background the way MAINFRAME is: a physically lit scene with shadows. A shadow-casting key spot from above left, a cool rim spot from the right and a low fill (MAINFRAME's rig at this scene's size) light it under the shared neutral studio environment, with a light edge vignette. `config.shadows` makes the raised parts shadow the plate and glass beneath them and the device shadow the wall. Shadows are medium and high quality only, so on the low tier the wall is lit flat.
- **Controls:** Master Controls: Exposure and Auto Performance (there is no BPM Sync: nothing in the scene moves on the beat, the same as War Of Worlds); Design: Camera Distance, Camera Heading and Camera Elevation (both default to 0, head on); Effects: Contrast, Saturation; Palette: Color Temperature, Color Tint; Quality / Performance.
- **Revision 3.** A saved parameter state only restores when its revision matches, so a workspace that saved an earlier framing restores these defaults instead of the old angle.
- **Auto Performance** (off by default, like every preset) is the only choreography: with it on, the music directs only the camera and exposure (a slow push-in as a build charges, an exposure lift before a drop, a push-in and flash on each drop, a gentle push every fourth bar). The model and your framing, exposure and colour controls are never changed.

## Verification

`npm run test:e2e:cinema2-open-decks` runs the preset through the production Cinema 2.0 runtime in Chromium at high and low quality and at desktop and narrow widths: no failed modules, passes or effects, a non-blank frame (taken after the photograph has loaded), a visible palette edit and clean disposal. Frames are written to `artifacts/cinema2-open-decks/`.

## Limits

- The photograph is 1080 px wide, so on a large stage the texture is magnified and softer than a native-resolution render. A larger photograph of the same view (the part positions are measured in its pixels, so a scaled copy works with the table scaled to match) would sharpen it.
- The jog wheel is cropped at the bottom of the photograph, so it is flat and the model ends there.
- The photograph is a manufacturer's product image showing a rekordbox screen with a real track's details. Replace it with your own artwork before the preset is shown publicly.

## Installer budget

The model did not fit the 131 MiB Cinema 2.0 installer budget (about 30 KB of headroom was left), so the budget in `assets/cinema2/budgets.json` was raised by 1 MiB to 132 MiB (0.9 MiB of headroom after this model).
