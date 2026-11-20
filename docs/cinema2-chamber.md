# CHAMBER source materials and viewer lighting

CHAMBER renders the original `public/cinema2/models/chamber.glb` with
`preserveMaterials: true`. Its 23 meshes, ten materials, embedded PNG, base colors,
roughness, metalness and original white/cyan/green emission remain authored by
the GLB. The asset file is unchanged and retains Rowan Design's CC BY 4.0 credit.
There are no palette, material, geometry or texture overrides, procedural glow,
particles, fog, depth-of-field or choreography.

The GLB's materials do not define the viewer's lighting and reflection environment.
The old bright white ambient/directional wash and studio illumination made the
room look silver-white and clipped its highlights. Revision 4 uses restrained
studio reflection strength, very low ambient fill, cyan practical spill, a neutral
white platform pool and a narrow rim. These viewer lights do not change surface
properties. A wider static interior camera includes both the apparatus and platform.

The render graph is scene → source-emission bloom → filmic tone mapping → output.
HDR intermediates retain bright emission and specular highlights, with an 8-bit
fallback. The finishing pass uses neutral exposure/contrast/saturation and no tint,
vignette, grain or lens fringing. Bloom reveals the GLB's original emissive parts;
it does not replace their emission with a generated color.

Focused tests verify compilation, module/effect validation, source asset properties,
material preservation, neutral finishing and removal of the broad white light.
Actual WebGL captures live under ignored `artifacts/cinema2-chamber-review/`.
