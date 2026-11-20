import { CINEMA2_GLYPH_SPHERE_MODULE_TYPE_ID, GLYPH_SPHERE_BACKGROUND, GLYPH_SPHERE_PALETTE } from '../modules/Cinema2GlyphSphereNativeModule'
import { withCinema2CratePresentationFinish } from './Cinema2CratePresentationFinish'
import { glyphSpherePerformance } from './Cinema2GlyphSpherePerformance'
import { withCinema2MoodDrives } from './Cinema2MoodConductorAuthoring'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2EffectId, type Cinema2LightId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId,
  type Cinema2ParameterManifest, type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
  type Cinema2SceneNodeId, type Cinema2Vector3,
} from '../contracts/Cinema2NativePresetManifest'

export const CINEMA2_GLYPH_SPHERE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.crate-glyph-sphere')
export const GLYPH_SPHERE_MODULE_ID = cinema2StableId<Cinema2ModuleId>('glyph-sphere-core')
export const glyphSphereParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`glyph-sphere-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
/** Same prefix the crate finish used, so the bloom and tone-finish effect ids carry over from revision 2. */
const FINISH_PREFIX = 'crate-glyph-sphere'

const root = cinema2StableId<Cinema2SceneNodeId>('glyph-sphere-root')
const model = cinema2StableId<Cinema2SceneNodeId>('glyph-sphere-model')
const camera = cinema2StableId<Cinema2CameraId>('glyph-sphere-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('glyph-sphere-target')
const scenePass = cinema2StableId<Cinema2RenderPassId>('glyph-sphere-scene')
const color = cinema2StableId<Cinema2RenderSlotId>('glyph-sphere-color')
const output = cinema2StableId<Cinema2RenderPassId>('glyph-sphere-output')

const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const bind = (name: string) => cinema2Ref(glyphSphereParameterId(name))
type Parent = Cinema2ParameterManifest['designParentGroup']
const number = (name: string, label: string, parent: Parent, value: number, min: number, max: number, order: number, group?: string, description?: string): Cinema2ParameterManifest => ({
  ...base, id: glyphSphereParameterId(name), label, type: 'float', defaultValue: value, min, max, designParentGroup: parent, order, ...(group ? { group } : {}), ...(description ? { description } : {}),
})
const toggle = (name: string, label: string, parent: Parent, value: boolean, order: number, group?: string, description?: string): Cinema2ParameterManifest => ({
  ...base, id: glyphSphereParameterId(name), label, type: 'boolean', defaultValue: value, designParentGroup: parent, order, ...(group ? { group } : {}), ...(description ? { description } : {}),
})
const manual = [{ kind: 'parameter-equals' as const, parameterId: glyphSphereParameterId('cameraMode'), value: 'manual' }]

const PALETTE_LABELS = { coreColor: 'Core', innerColor: 'Inner Band', middleColor: 'Middle Band', outerColor: 'Outer Band', frameColor: 'Frames' } as Record<string, string>

export const GLYPH_SPHERE_PARAMETERS: readonly Cinema2ParameterManifest[] = [
  toggle('bpmSync', 'BPM Sync', 'master-controls', true, 0, undefined, 'Locks band motion, tick chases and the camera to the track\'s detected tempo.'),
  number('intensity', 'Intensity', 'master-controls', 1, 0, 2, 1),
  number('reactivity', 'Audio Reactivity', 'master-controls', .65, 0, 1, 2, undefined, 'Strength of the bass, energy, vocal and beat reactions. Zero restores the authored motion.'),
  toggle('autoPerformance', 'Auto Performance', 'master-controls', false, 3, undefined, 'The shared Mood Conductor moves the sphere with the passage of the track.'),
  number('coreScale', 'Core Scale', 'design', 1, .7, 1.3, 1, 'Core'),
  number('coreGlow', 'Core Glow', 'design', 1, 0, 2, 2, 'Core', 'Brightness of the white glyph core and the light it casts on the frames.'),
  number('coreBreath', 'Core Breath', 'design', .35, 0, 1, 3, 'Core', 'How far the glyph slats ripple through the model\'s own morph targets.'),
  number('motionRate', 'Band Spin', 'design', 1, 0, 2, 1, 'Bands', 'Turn rate of the glyph bands, counted in beats.'),
  number('bandSpread', 'Band Spread', 'design', 1, .8, 1.25, 2, 'Bands', 'Pushes the three rings outward from the core.'),
  number('bandWobble', 'Band Wobble', 'design', .35, 0, 1, 3, 'Bands', 'How much each ring rocks on its tilt.'),
  number('bandLighting', 'Band Lighting', 'design', 1, 0, 2, 4, 'Bands'),
  number('frameLighting', 'Frame Glow', 'design', 1, 0, 1.5, 1, 'Frames'),
  number('tickLighting', 'Index Ticks', 'design', 1, 0, 1.5, 2, 'Frames', 'The ruled ticks along each frame. A bright pulse circles each ring with the beat.'),
  number('jointLighting', 'Joint Lights', 'design', 1, 0, 1.5, 3, 'Frames', 'The vertical clamp bars and the beacons at the long ticks.'),
  {
    ...base, id: glyphSphereParameterId('cameraMode'), label: 'Camera Mode', type: 'enum', defaultValue: 'omnidirectional', designParentGroup: 'design', group: 'Camera', order: 0,
    options: [{ value: 'manual', label: 'Manual Orbit' }, { value: 'horizontal', label: 'Horizontal Orbit' }, { value: 'omnidirectional', label: 'Omnidirectional Orbit' }],
  },
  toggle('cameraMotion', 'Camera Motion', 'design', true, 1, 'Camera'),
  toggle('cameraKickZoom', 'Kick Zoom', 'design', true, 2, 'Camera', 'A quick zoom-in on every kick.'),
  number('cameraSpeed', 'Camera Speed', 'design', 1, 0, 2, 3, 'Camera'),
  { ...number('cameraHeading', 'Camera Heading', 'design', 28, -180, 180, 4, 'Camera'), visibleWhen: manual },
  { ...number('cameraElevation', 'Camera Elevation', 'design', 14, -89.9, 89.9, 5, 'Camera'), visibleWhen: manual },
  { ...number('cameraDistance', 'Camera Distance', 'design', 15, 9, 26, 6, 'Camera'), visibleWhen: manual },
  number('cameraFov', 'Camera Field of View', 'design', 46, 30, 65, 7, 'Camera'),
  number('halo', 'Core Halo', 'effects', .6, 0, 1.2, 0, undefined, 'The soft light around the core.'),
  number('bloom', 'Bloom', 'effects', .31, 0, .8, 1),
  number('starfield', 'Starfield', 'effects', .6, 0, 1, 2, undefined, 'Two drifting layers of points behind the rings. Off on the low quality tier.'),
  number('finishMix', 'Tone Finish', 'effects', 1, 0, 1, 3),
  { ...base, id: glyphSphereParameterId('background'), label: 'Background', type: 'color', defaultValue: [...GLYPH_SPHERE_BACKGROUND], designParentGroup: 'palette', order: 0 },
  ...Object.entries(GLYPH_SPHERE_PALETTE).map(([name, value], index): Cinema2ParameterManifest => ({
    ...base, id: glyphSphereParameterId(name), label: PALETTE_LABELS[name]!, type: 'color', defaultValue: [...value], designParentGroup: 'palette', order: index + 1,
  })),
]

/** Every parameter the module reads, by name. The camera, bloom, finish and background are bound elsewhere in the manifest. */
export const GLYPH_SPHERE_MODULE_PARAMETERS = [
  'bpmSync', 'intensity', 'reactivity', 'autoPerformance', 'coreScale', 'coreGlow', 'coreBreath', 'motionRate', 'bandSpread', 'bandWobble', 'bandLighting',
  'frameLighting', 'tickLighting', 'jointLighting', 'halo', 'starfield', 'background', ...Object.keys(GLYPH_SPHERE_PALETTE),
] as const

const DISTANCE = 15
const orbitPoints = Array.from({ length: 16 }, (_, index) => {
  const azimuth = index * Math.PI / 8
  const elevation = Math.sin(azimuth * 2) * 62 * Math.PI / 180
  return {
    position: [Math.sin(azimuth) * Math.cos(elevation) * DISTANCE, Math.sin(elevation) * DISTANCE, Math.cos(azimuth) * Math.cos(elevation) * DISTANCE] as Cinema2Vector3,
    target: [0, 0, 0] as Cinema2Vector3,
  }
})

const authored: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_GLYPH_SPHERE_PRESET_ID, revision: 3,
  metadata: {
    name: 'Glyph Sphere',
    description: 'Glyph Armillary: the original glyph sphere as a glowing core inside three tilted glyph bands, ruled ring frames with beat-chased index ticks, a drifting starfield and an omnidirectional camera.',
    tags: ['reference', 'crate', 'armillary', '3d'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the glyph core, bands and ring frames.' },
    { id: 'render.depth', requirement: 'required', purpose: 'True depth between the nested bands and the core.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'World-space composition viewed from every direction.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Orbit and path travel around the armillary.' },
    { id: 'lighting', requirement: 'required', purpose: 'Read the metal ring frames in the core\'s light.' },
    ...(['audio.transport', 'audio.bands', 'audio.features', 'music.rhythm-events', 'music.drop', 'music.vocal-presence', 'visual-director.significance'] as const)
      .map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical facts and broad performance meaning.' })),
  ],
  parameters: GLYPH_SPHERE_PARAMETERS,
  modules: [{
    id: GLYPH_SPHERE_MODULE_ID, typeId: CINEMA2_GLYPH_SPHERE_MODULE_TYPE_ID, version: 1,
    parameters: Object.fromEntries(GLYPH_SPHERE_MODULE_PARAMETERS.map(name => [name, GLYPH_SPHERE_PARAMETERS.find(p => p.id === glyphSphereParameterId(name))!.defaultValue!])),
    parameterBindings: Object.fromEntries(GLYPH_SPHERE_MODULE_PARAMETERS.map(name => [name, bind(name)])),
    config: { hdr: true, instances: [{ asset: 'cinema2-crate-glyph-sphere', node: model, preserveMaterials: true, spin: false }] },
  }],
  scene: { nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: model, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(GLYPH_SPHERE_MODULE_ID) }], roots: [cinema2Ref(root)] },
  choreography: { tempoSyncParameter: bind('bpmSync'), rules: glyphSpherePerformance(GLYPH_SPHERE_MODULE_ID, glyphSphereParameterId).rules },
  cameras: [{
    id: camera, label: 'Armillary orbit', projection: 'perspective', fovDegrees: 46, minAspect: 16 / 9, minAspectAnchor: 0, near: .1, far: 130, target: [0, 0, 0],
    rig: { kind: 'path', points: orbitPoints, durationSeconds: 44, loop: true },
    rigVariants: {
      manual: { kind: 'orbit', radius: DISTANCE, azimuthDegrees: 28, elevationDegrees: 14, angularVelocityDegreesPerSecond: 0 },
      horizontal: { kind: 'orbit', radius: DISTANCE, azimuthDegrees: 28, elevationDegrees: 14, angularVelocityDegreesPerSecond: 8 },
      omnidirectional: { kind: 'path', points: orbitPoints, durationSeconds: 44, loop: true },
    },
    motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 120, flightSpeed: true, punch: 1.2 } },
    controls: {
      rigMode: bind('cameraMode'), motionEnabled: bind('cameraMotion'), motionSpeed: bind('cameraSpeed'), tempoSync: bind('bpmSync'), kickZoom: bind('cameraKickZoom'),
      orbitRadius: bind('cameraDistance'), orbitAzimuthDegrees: bind('cameraHeading'), orbitElevationDegrees: bind('cameraElevation'), fovDegrees: bind('cameraFov'),
    },
  }],
  defaults: { camera: cinema2Ref(camera) },
  environment: { backgroundColor: [...GLYPH_SPHERE_BACKGROUND], exposure: 1, controls: { backgroundColor: bind('background') } },
  lighting: {
    lights: [
      { id: cinema2StableId<Cinema2LightId>('glyph-sphere-fill'), type: 'ambient', color: [.8, .85, 1, 1], intensity: .5 },
      { id: cinema2StableId<Cinema2LightId>('glyph-sphere-key'), type: 'directional', color: [.9, .92, 1, 1], intensity: .7, transform: { position: [-4, 7, 8] }, targetNode: cinema2Ref(model) },
    ],
  },
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', depthFormat: 'depth24' } }],
    passes: [
      { id: scenePass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] },
      { id: output, kind: 'output', inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('glyph-sphere-input'), source: { pass: cinema2Ref(scenePass), output: color }, attachment: 'color' }] },
    ],
    outputPass: cinema2Ref(output),
  },
  output: { renderPass: cinema2Ref(output), colorSpace: 'srgb', alphaMode: 'opaque' },
}

const finished = withCinema2CratePresentationFinish(authored, FINISH_PREFIX, bind('bloom'))
const bloomEffect = cinema2StableId<Cinema2EffectId>(`${FINISH_PREFIX}-light-bloom`)
const finishEffect = cinema2StableId<Cinema2EffectId>(`${FINISH_PREFIX}-color-finish`)
const withFinishMix: Readonly<Cinema2NativePresetManifest> = {
  ...finished,
  effects: finished.effects!.map(effect => effect.id === finishEffect ? { ...effect, parameterBindings: { mix: bind('finishMix') } } : effect),
}

const performance = glyphSpherePerformance(GLYPH_SPHERE_MODULE_ID, glyphSphereParameterId)
export const CINEMA2_GLYPH_SPHERE_PRESET_MANIFEST = withCinema2MoodDrives(withFinishMix, {
  idPrefix: 'glyph-sphere', enabledParameter: glyphSphereParameterId('autoPerformance'), strengthParameter: glyphSphereParameterId('reactivity'),
  drives: [
    ...performance.drives,
    { id: 'peak-bloom', target: { kind: 'effect', ref: cinema2Ref(bloomEffect), property: 'intensity' }, source: 'mood.peak', operation: 'multiply', value: 1.3 },
    { id: 'silence-bloom', target: { kind: 'effect', ref: cinema2Ref(bloomEffect), property: 'intensity' }, source: 'mood.silence', operation: 'multiply', value: .1 },
  ],
})
