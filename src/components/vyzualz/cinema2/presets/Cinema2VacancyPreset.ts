import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2EffectId, type Cinema2EffectManifest, type Cinema2EffectTypeId, type Cinema2LayerId, type Cinema2LightId,
  type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest,
  type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2SceneNodeId, type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'
import { CINEMA2_VACANCY_MODULE_TYPE_ID } from '../modules/Cinema2VacancyNativeModule'
import { VACANCY_ASSET_ID, VACANCY_COLORS, VACANCY_DEFAULTS } from '../modules/vacancy/Cinema2VacancyDomain'

export const CINEMA2_VACANCY_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.vacancy')
export const CINEMA2_VACANCY_CAMERA_ID = cinema2StableId<Cinema2CameraId>('vacancy-reference-camera')
const ROOT = cinema2StableId<Cinema2SceneNodeId>('vacancy-root')
const MODEL = cinema2StableId<Cinema2SceneNodeId>('vacancy-room-and-tower')
const MODULE = cinema2StableId<Cinema2ModuleId>('vacancy-core')
const LAYER = cinema2StableId<Cinema2LayerId>('vacancy-world')
const TARGET = cinema2StableId<Cinema2RenderTargetId>('vacancy-scene-target')
const SCENE = cinema2StableId<Cinema2RenderPassId>('vacancy-scene')
const OUTPUT = cinema2StableId<Cinema2RenderPassId>('vacancy-output')
const COLOR = cinema2StableId<Cinema2RenderSlotId>('vacancy-color')
const DEPTH = cinema2StableId<Cinema2RenderSlotId>('vacancy-depth')
const vec = (x: number, y: number, z: number): Cinema2Vector3 => [x, y, z]

const parameter = (name: string) => cinema2StableId<Cinema2ParameterId>(`vacancy-${name}`)
export const CINEMA2_VACANCY_PARAMETER_IDS = {
  master: parameter('master-intensity'),
  roomVisibility: parameter('room-visibility'),
  backgroundColor: parameter('background-color'),
  screenColor: parameter('screen-color'),
} as const
const P = CINEMA2_VACANCY_PARAMETER_IDS
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const

const parameters: Cinema2ParameterManifest[] = [
  CINEMA2_QUALITY_MODE_PARAMETER,
  { ...base, id: P.master, label: 'Master Intensity', type: 'float', min: 0, max: 1, step: .01, defaultValue: VACANCY_DEFAULTS.master,
    designParentGroup: 'master-controls', group: 'Performance', order: 1,
    description: 'Overall brightness of the screens and the light they cast. Zero turns the room dark.' },
  { ...base, id: P.roomVisibility, label: 'Room Visibility', type: 'float', min: 0, max: 1, step: .01, defaultValue: VACANCY_DEFAULTS.roomVisibility,
    designParentGroup: 'effects', group: 'Room', order: 1,
    description: 'How much of the brick room shows beyond the screens\' glow. Zero is pure black; the default is a dark room whose walls, doorways and floor the glow reveals.' },
  { ...base, id: P.backgroundColor, label: 'Background', type: 'color', defaultValue: VACANCY_COLORS.background,
    designParentGroup: 'palette', group: 'Room Palette', order: 1, description: 'Tints the dark room, the background and the floor reflection.' },
  { ...base, id: P.screenColor, label: 'Screen', type: 'color', defaultValue: VACANCY_COLORS.screen,
    designParentGroup: 'palette', group: 'Room Palette', order: 2, description: 'Tint of the static on every screen and of the light it casts.' },
]

const EFFECTS = Object.fromEntries(['reflections', 'bloom'].map(name => [name, cinema2StableId<Cinema2EffectId>(`vacancy-${name}-effect`)])) as Record<'reflections' | 'bloom', Cinema2EffectId>

const effects: readonly Cinema2EffectManifest[] = [
  // The room's floor is the plane y = 0; this replaces it with dark, wet concrete that mirrors the screens.
  { id: EFFECTS.reflections, typeId: cinema2StableId<Cinema2EffectTypeId>('reflective-floor'), version: 1, enabled: true, scope: 'output', order: 0,
    parameters: { mix: .62, floorY: .004, reflectivity: .8, lowReflectivity: .35, mediumReflectivity: .55, roughness: .32, fresnel: 2.4,
      baseColor: [.012, .016, .024, 1], skyColor: [.012, .016, .024, 1], baseLift: 1, albedo: .04, poolIntensity: 0, specular: .2,
      maxReflection: 40, fadeDistance: 24, thickness: 2.5, grit: .12, gritScale: 4, streak: 0, samplingStability: 1, edgeFallback: .6,
      surfaceTexture: CINEMA2_WET_CONCRETE_TEXTURE_ASSET_ID, surfaceTextureScale: 4, surfaceTextureStrength: .3 },
    parameterBindings: { baseColor: cinema2Ref(P.backgroundColor), skyColor: cinema2Ref(P.backgroundColor) } },
  { id: EFFECTS.bloom, typeId: cinema2StableId<Cinema2EffectTypeId>('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 1,
    parameters: { mix: .8, threshold: .6, knee: .3, intensity: 1.8, spread: .7, levels: 6, clampMax: 8 } },
]

function finishingGraph() {
  let previousPass = SCENE, previousColor = COLOR
  const targets = [], passes = []
  for (const name of ['reflections', 'bloom'] as const) {
    const id = cinema2StableId<Cinema2RenderPassId>(`vacancy-${name}-pass`)
    const target = cinema2StableId<Cinema2RenderTargetId>(`vacancy-${name}-target`)
    const slot = cinema2StableId<Cinema2RenderSlotId>(`vacancy-${name}-color`)
    targets.push({ id: target, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba8' as const }, ownership: 'transient' as const })
    passes.push({ id, kind: 'fullscreen' as const, effect: cinema2Ref(EFFECTS[name]), dependsOn: [cinema2Ref(previousPass)],
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>(`vacancy-${name}-source`), attachment: 'color' as const, source: { pass: cinema2Ref(previousPass), output: previousColor } },
        ...(name === 'bloom' ? [] : [{ id: cinema2StableId<Cinema2RenderSlotId>(`vacancy-${name}-depth`), attachment: 'depth' as const, source: { pass: cinema2Ref(SCENE), output: DEPTH } }])],
      outputs: [{ id: slot, target: cinema2Ref(target), attachment: 'color' as const }] })
    previousPass = id; previousColor = slot
  }
  return { targets, passes, pass: previousPass, color: previousColor }
}
const finishing = finishingGraph()

/** VACANCY: a tower of stacked CRT televisions in an empty dark room, every screen glowing analog static. Static-composition stage. */
export const CINEMA2_VACANCY_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_VACANCY_PRESET_ID, revision: 1,
  metadata: {
    name: 'VACANCY',
    description: 'A pyramid of stacked CRT televisions in the middle of an empty, dark brick room. Every screen glows with analog static that lights the wet concrete floor and the room around it.',
    tags: ['keeper', 'vacancy', 'televisions', '3d'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Depth-tested world-space room, television tower and glowing screens.' },
  ],
  parameters,
  modules: [{
    id: MODULE, typeId: CINEMA2_VACANCY_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: { master: VACANCY_DEFAULTS.master, roomVisibility: VACANCY_DEFAULTS.roomVisibility, backgroundColor: VACANCY_COLORS.background, screenColor: VACANCY_COLORS.screen },
    parameterBindings: { master: cinema2Ref(P.master), roomVisibility: cinema2Ref(P.roomVisibility), backgroundColor: cinema2Ref(P.backgroundColor), screenColor: cinema2Ref(P.screenColor) },
    config: { asset: VACANCY_ASSET_ID },
  }],
  effects,
  scene: { nodes: [
    { id: ROOT, kind: 'group', coordinateSpace: 'world' },
    { id: MODEL, kind: 'module', parent: cinema2Ref(ROOT), module: cinema2Ref(MODULE) },
  ], roots: [cinema2Ref(ROOT)] },
  layers: [{ id: LAYER, label: 'VACANCY room and tower', source: cinema2Ref(ROOT), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: CINEMA2_VACANCY_CAMERA_ID, label: 'Pyramid hero', projection: 'perspective',
    fovDegrees: 40, minAspect: 1, near: 0.4, far: 24,
    transform: { position: vec(0.46, 1.28, 4.05) }, target: vec(0.46, 1.04, -0.1), rig: { kind: 'static' },
  }],
  defaults: { camera: cinema2Ref(CINEMA2_VACANCY_CAMERA_ID) },
  lighting: { lights: [
    { id: cinema2StableId<Cinema2LightId>('vacancy-ambient'), type: 'ambient', color: [0.05, 0.06, 0.09, 1], intensity: 0.004 },
  ] },
  environment: { backgroundColor: VACANCY_COLORS.background, exposure: 1, controls: { backgroundColor: cinema2Ref(P.backgroundColor) } },
  render: {
    targets: [{ id: TARGET, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' }, ...finishing.targets],
    passes: [
      { id: SCENE, kind: 'scene', layers: [cinema2Ref(LAYER)], outputs: [
        { id: COLOR, target: cinema2Ref(TARGET), attachment: 'color' },
        { id: DEPTH, target: cinema2Ref(TARGET), attachment: 'depth' },
      ] },
      ...finishing.passes,
      { id: OUTPUT, kind: 'output', inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('vacancy-final-color'), source: { pass: cinema2Ref(finishing.pass), output: finishing.color }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(OUTPUT),
  },
  output: { renderPass: cinema2Ref(OUTPUT), colorSpace: 'srgb', alphaMode: 'opaque' },
}
