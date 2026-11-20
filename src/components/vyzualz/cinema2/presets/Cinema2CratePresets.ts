import { withBeamLatticePerformance } from './Cinema2BeamLatticePerformance'
import { withBeamLatticeReferenceRendering } from './Cinema2BeamLatticeRendering'
import { CINEMA2_BEAM_LATTICE_MODULE_TYPE_ID } from '../modules/Cinema2BeamLatticeNativeModule'
import { CINEMA2_MOIRE_ORB_PRESET_MANIFEST } from './Cinema2MoireOrbPreset'
import { CINEMA2_BASS_SIGIL_PRESET_MANIFEST } from './Cinema2BassSigilPreset'
import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId, type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ModuleId, type Cinema2SceneNodeId, type Cinema2CameraId, type Cinema2Vector3, type Cinema2RenderTargetId, type Cinema2RenderPassId, type Cinema2RenderSlotId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID } from '../modules/Cinema2ThreeSceneModule'
import { CINEMA2_GLYPH_SPHERE_PRESET_MANIFEST } from './Cinema2GlyphSpherePreset'
import { CINEMA2_WIREFRAME_PORTAL_PRESET_MANIFEST } from './Cinema2WireframePortalPreset'
import { withCinema2ParallaxCipher } from './Cinema2ParallaxCipherPreset'

/** Crate assets and their original framing. Authored presentations use the same source GLBs. */
export const CINEMA2_CRATE_ARTIFACTS = [
  {
    "slug": "moire-orb",
    "name": "Moire Orb",
    "description": "Overlapping translucent spherical lattices.",
    "file": "geometry_texture_effect_spheres.glb",
    "camera": [
      1.1669712019108216,
      0.7760014076250956,
      6.468630304048275
    ],
    "target": [
      0.0026586353673277996,
      -0.0002069700705670252,
      0.00022715658441918585
    ],
    "far": 205.77278534477284
  },
  {
    "slug": "beam-lattice",
    "name": "Beam Lattice",
    "description": "Four banks of fine yellow laser lines.",
    "file": "lasers_-_vj.glb",
    "camera": [
      2.3526808504800956,
      1.7206332493401697,
      8.38922451613425
    ],
    "target": [
      0.9587293482696362,
      0.7913322478665301,
      0.6450495038539191
    ],
    "far": 246.3576289457333
  },
  {
    "slug": "wireframe-portal",
    "name": "Wireframe Portal",
    "description": "A thin geometric cube frame with chamfered corners.",
    "file": "lightweight.glb",
    "camera": [
      0.7419559891259828,
      0.4946373260839885,
      4.121977717366572
    ],
    "target": [
      0,
      0,
      0
    ],
    "far": 131.12831972511924
  },
  {
    "slug": "glyph-sphere",
    "name": "Glyph Sphere",
    "description": "A spherical shell of white segmented glyphs.",
    "file": "oyes.glb",
    "camera": [
      1.3016582560765078,
      0.835091132735367,
      7.2314337162106845
    ],
    "target": [
      2.086162567138672e-07,
      -0.032680898904800415,
      1.1920928955078125e-07
    ],
    "far": 230.04630344881596
  },
  {
    "slug": "paradox-weave",
    "name": "Paradox Weave",
    "description": "Interwoven angular planes forming a geometric knot.",
    "file": "paradox_abstract_art_of_python.glb",
    "camera": [
      1.303916823796199,
      0.8692778825307993,
      7.243982354423328
    ],
    "target": [
      0,
      0,
      0
    ],
    "far": 230.44550441209228
  },
  {
    "slug": "bass-sigil",
    "name": "Bass Sigil",
    "description": "A music wordmark inside a crystalline sphere and particle field.",
    "file": "skrillex_-_vj_-_flash_warning.glb",
    "camera": [
      31.73739968843347,
      23.639015350786092,
      176.21589565647346
    ],
    "target": [
      -0.5528165102005005,
      2.1122045516967773,
      -3.1741943359375
    ],
    "far": 5706.756001357308
  },
] as const

export const CINEMA2_CRATE_PRESET_MANIFESTS: readonly Readonly<Cinema2NativePresetManifest>[] = CINEMA2_CRATE_ARTIFACTS.map((artifact): Readonly<Cinema2NativePresetManifest> => {
  if (artifact.slug === 'moire-orb') return CINEMA2_MOIRE_ORB_PRESET_MANIFEST
  if (artifact.slug === 'bass-sigil') return CINEMA2_BASS_SIGIL_PRESET_MANIFEST
  if (artifact.slug === 'glyph-sphere') return CINEMA2_GLYPH_SPHERE_PRESET_MANIFEST
  if (artifact.slug === 'wireframe-portal') return CINEMA2_WIREFRAME_PORTAL_PRESET_MANIFEST
  const animated = artifact.slug === 'beam-lattice'
  const prefix = `crate-${artifact.slug}`
  const moduleId = cinema2StableId<Cinema2ModuleId>(`${prefix}-scene`)
  const root = cinema2StableId<Cinema2SceneNodeId>(`${prefix}-root`)
  const node = cinema2StableId<Cinema2SceneNodeId>(`${prefix}-artifact`)
  const camera = cinema2StableId<Cinema2CameraId>(`${prefix}-camera`)
  const target = cinema2StableId<Cinema2RenderTargetId>(`${prefix}-target`), pass = cinema2StableId<Cinema2RenderPassId>(`${prefix}-pass`), color = cinema2StableId<Cinema2RenderSlotId>(`${prefix}-color`), output = cinema2StableId<Cinema2RenderPassId>(`${prefix}-output`)
  const manifest: Readonly<Cinema2NativePresetManifest> = {
    schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
    id: cinema2NamespacedId<Cinema2PresetId>(`drmvyz.cinema2.${prefix}`), revision: 1,
    metadata: { name: artifact.name, description: `${artifact.description} ${animated ? 'Original GLB scene and authored animation.' : 'Static original artifact preview; enhancements pending.'}`, tags: ['reference', 'crate', animated ? 'animated' : 'static', '3d'] },
    capabilities: [{ id: 'render.webgl2', requirement: 'required', purpose: 'Render the original glTF artifact.' }, { id: 'scene.3d', requirement: 'required', purpose: 'Place the original scene without changing its transforms.' }, { id: 'camera.world', requirement: 'required', purpose: 'Fixed artifact framing.' }, { id: 'lighting', requirement: 'required', purpose: 'Neutral lighting for authored materials.' }, { id: 'render.depth', requirement: 'required', purpose: 'Preserve depth between artifact surfaces.' }],
    scene: { nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: node, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) }], roots: [cinema2Ref(root)] },
    cameras: [{ id: camera, label: 'Artifact view', projection: 'perspective', fovDegrees: 40, near: .001, far: artifact.far, transform: { position: artifact.camera as Cinema2Vector3 }, target: artifact.target as Cinema2Vector3, rig: { kind: 'static' } }],
    defaults: { camera: cinema2Ref(camera) },
    lighting: { lights: [{ id: cinema2StableId(`${prefix}-ambient`), type: 'ambient', color: [1, 1, 1, 1], intensity: 1 }, { id: cinema2StableId(`${prefix}-key`), type: 'directional', color: [1, 1, 1, 1], intensity: 2, transform: { position: artifact.camera as Cinema2Vector3 }, targetNode: cinema2Ref(node) }] },
    environment: { backgroundColor: [.025, .035, .045, 1], exposure: 1 },
    parameters: [],
    modules: [{ id: moduleId, typeId: animated ? CINEMA2_BEAM_LATTICE_MODULE_TYPE_ID : CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1, config: { instances: [{ asset: `cinema2-crate-${artifact.slug}`, node, preserveMaterials: true, spin: false }] } }],
    render: { targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }], passes: [{ id: pass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] }, { id: output, kind: 'output', inputs: [{ id: cinema2StableId(`${prefix}-input`), source: { pass: cinema2Ref(pass), output: color }, attachment: 'color' }] }], outputPass: cinema2Ref(output) },
    output: { renderPass: cinema2Ref(output), colorSpace: 'srgb', alphaMode: 'opaque' },
  }
  if (artifact.slug === 'paradox-weave') return withCinema2ParallaxCipher(manifest, prefix)
  return animated ? withBeamLatticePerformance(withBeamLatticeReferenceRendering(manifest)) : manifest
})
