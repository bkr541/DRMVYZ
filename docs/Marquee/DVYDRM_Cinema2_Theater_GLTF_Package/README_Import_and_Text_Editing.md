# DVYDRM Theater · Cinema 2.0 3D Model

**Export:** glTF 2.0 (`.gltf` plus `.bin` plus local `textures/`) and a self-contained `.glb`.

This is an actual 3D geometric reconstruction using the approved geometry blueprint, **not a reference image on a plane**. It is a visually representative procedural scene at *prototype modeling scale*, not a dimensionally surveyed photogrammetry model.

## Import

- Easiest: open `DVYDRM_Theater.glb` in Blender, Three.js `GLTFLoader`, or another glTF 2.0 viewer.
- Editable source layout: keep `DVYDRM_Theater.gltf`, `DVYDRM_Theater.bin`, and the `textures/` folder together in their original relative paths.
- Front of theater is **+Z**, up is **+Y** and right is **+X**, matching the blueprint.

## Editable signs

The **three** sign faces are independently textured surfaces, not lettering permanently fused to the 3D geometry:

| Sign | Exact mesh node | Independent material | Default texture |
|---|---|---|---|
| Front | `marquee.front.TEXT_SURFACE` | `TEXT_SWAP · marquee.front` | `textures/marquee_front_DVYDRM.png` |
| Left | `marquee.left.TEXT_SURFACE` | `TEXT_SWAP · marquee.left` | `textures/marquee_left_SHOWINGS.png` |
| Right | `marquee.right.TEXT_SURFACE` | `TEXT_SWAP · marquee.right` | `textures/marquee_right_SHOWINGS.png` |

**Runtime behavior:** Find the mesh by exact node name; give each surface its own material/texture instance; replace its `map` with a CanvasTexture generated from user input. The geometry itself remains unchanged. The supplied PNGs are *default presentation assets*, not the required runtime source of text. `marquee_blank_for_runtime_text.png` provides a blank background for replacement textures. For correct appearance, canvas textures should be 2048 × 440 pixels and use the glTF UV layout. In Three.js, canvas-origin textures generally require `flipY=false` when used directly on a glTF UV-mapped mesh. Confirm orientation in the host renderer.

## Independently addressable groups

`bulbs.marquee`, `bulbs.canopy`, `bulbs.tower`, `leds.left`, `leds.right`, `neon.red`, `neon.blue`, `neon.amber`, `facade`, `curtain`, `entrance`, `pavement`. Individual bulb nodes have stable names in these groups. Material emission provides visible glow but **bloom requires postprocessing**; individual incandescent meshes do not automatically cast real-time light across the building. A preview fill-light rig is included as `KHR_lights_punctual`.

## Cinema 2.0 wiring

The model contains geometry, node names, materials, textures, and light sources. It does **not** embed preset audio intelligence, Pattern Change, Trigger dropdown, or WebGL UI. Attach those behaviors via Cinema 2.0 after loading the scene.

The separate `Cinema2_Theater_Node_Manifest.json` maps the sign planes, node names, textures, and suggested audio signal routing. See the SVG blueprint for source-derived dimensions and additional construction notes.
