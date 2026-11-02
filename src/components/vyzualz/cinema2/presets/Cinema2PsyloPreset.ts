import { PSYLO_MUSIC_DEFAULTS } from '../modules/psylo/Cinema2PsyloAudio'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { PSYLO_PATTERNS, PSYLO_CAMERA_MODES, PSYLO_CAMERA_RIGS, PSYLO_COLORS } from '../modules/psylo/Cinema2PsyloDomain'
import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2LayerId, type Cinema2ModuleId,
  type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2PresetId,
  type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
  type Cinema2SceneNodeId, type Cinema2ParameterManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_PSYLO_MODULE_TYPE_ID } from '../modules/Cinema2PsyloNativeModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_PSYLO_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.psylo')
export const psyloParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`psylo-${name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`)
const moduleId = cinema2StableId<Cinema2ModuleId>('psylo-forest')
const root = cinema2StableId<Cinema2SceneNodeId>('psylo-root')
const world = cinema2StableId<Cinema2SceneNodeId>('psylo-world')
const layer = cinema2StableId<Cinema2LayerId>('psylo-world-layer')
const camera = cinema2StableId<Cinema2CameraId>('psylo-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('psylo-scene-target')
const pass = cinema2StableId<Cinema2RenderPassId>('psylo-scene-pass')
const color = cinema2StableId<Cinema2RenderSlotId>('psylo-scene-color')
const ref = (name: string) => cinema2Ref(psyloParameterId(name))
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
const num = (name: string, label: string, value: number, min: number, max: number, group: string, parent: Cinema2ParameterManifest['designParentGroup'], order: number): Cinema2ParameterManifest => ({ ...base, id: psyloParameterId(name), label, type: 'float', defaultValue: value, min, max, step: .01, group, designParentGroup: parent, order })
const toggle = (name: string, label: string, value: boolean, group: string, parent: Cinema2ParameterManifest['designParentGroup'], order: number): Cinema2ParameterManifest => ({ ...base, id: psyloParameterId(name), label, type: 'boolean', defaultValue: value, group, designParentGroup: parent, order })
const moduleDefaults = { musicResponse: .8, master: .85, motion: true, amount: .5, speed: 1, bpmSync: true, pattern: 'mycelium-tide', patternChange: false, trigger: 'bar4', density: 1, scale: 1, emission: .6, spores: .6, ...PSYLO_COLORS }
const orbitOnly = [{ kind: 'parameter-equals', parameterId: psyloParameterId('cameraMode'), value: 'orbit' }] as const

/** Reference entry until all later controls, musical behavior and visual gates pass. */
export const CINEMA2_PSYLO_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_PSYLO_PRESET_ID, revision: 2,
  metadata: {
    name: 'PSYLO', author: 'DRMVYZ; attributed mushroom sources (CC BY 4.0)',
    description: 'A 3D mushroom forest with travel, grove orbit, canopy passage, eight rooted geometry programs and independent palette controls. Shared audio drives bounded forest response and musical Pattern changes. Atmospheric finishing and automatic performance remain pending.',
    tags: ['3d', 'mushrooms', 'bioluminescent', 'forest', 'review'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the prepared textured forest in the shared WebGL context.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve terrain, stems and overlapping canopies with real scene depth.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Continuous terrain and surrounding mushroom groves in world space.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Shared spline travel, grove orbit, elevated passage and fixed framing.' },
    ...([['audio.bands', 'Shared bass/high energy shapes bends and spores.'], ['audio.features', 'Shared energy and vocals shape motion and restraint.'], ['music.beat', 'Canonical beat and beat-multiple triggers.'], ['music.downbeat', 'Shared downbeat accents and triggers.'], ['music.rhythm-events', 'Shared kick and snare facts.'], ['music.bar', 'Canonical bar and multi-bar triggers.'], ['music.phrase', 'Shared phrase boundaries.'], ['music.build', 'Supported build progress gathers the grove.'], ['music.drop', 'Shared semantic drop releases an outward wave.'], ['music.vocal-presence', 'Supported vocals restrain movement and spore activity.']] as const).map(([id, purpose]) => ({ id, purpose, requirement: 'optional' as const })),
    { id: 'lighting', requirement: 'required', purpose: 'Readable PBR surfaces and baseline local light spill.' },
  ],
  parameters: [
    num('master', 'Master Intensity', .85, 0, 1, 'Performance', 'master-controls', 0),
    toggle('motion', 'Geometry Motion', true, 'Performance', 'master-controls', 1),
    num('amount', 'Motion Amount', .5, 0, 1, 'Performance', 'master-controls', 2),
    num('speed', 'Motion Speed', 1, 0, 2, 'Performance', 'master-controls', 3),
    toggle('bpmSync', 'BPM Sync', true, 'Performance', 'master-controls', 4),
    num('musicResponse', 'Music Response', .8, 0, 1, 'Performance', 'master-controls', 5),
    { ...base, id: psyloParameterId('pattern'), label: 'Pattern', type: 'enum', defaultValue: 'mycelium-tide', options: PSYLO_PATTERNS, designParentGroup: 'design', group: 'Pattern', order: 0 },
    toggle('patternChange', 'Pattern Change', false, 'Pattern', 'design', 1),
    { ...base, id: psyloParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4', options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: psyloParameterId('patternChange'), value: true }], designParentGroup: 'design', group: 'Pattern', order: 2,
      description: 'Advances the current program on a new shared musical event. Manual Pattern selection stays immediate and does not turn Pattern Change off.' },
    num('density', 'Forest Density', 1, 0, 1, 'Forest', 'design', 10),
    num('scale', 'Mushroom Scale', 1, .8, 1.1, 'Forest', 'design', 11),
    { ...base, id: psyloParameterId('cameraMode'), label: 'Camera Mode', type: 'enum', defaultValue: 'travel', options: PSYLO_CAMERA_MODES, designParentGroup: 'design', group: 'Camera', order: 20 },
    toggle('cameraMotion', 'Camera Motion', true, 'Camera', 'design', 21),
    num('cameraSpeed', 'Camera Speed', 1, 0, 2, 'Camera', 'design', 22),
    num('fov', 'Field of View', 58, 45, 75, 'Camera', 'design', 23),
    { ...num('radius', 'Orbit Radius', 18, 14, 22, 'Camera', 'design', 24), visibleWhen: orbitOnly },
    { ...num('heading', 'Orbit Heading', 0, -180, 180, 'Camera', 'design', 25), visibleWhen: orbitOnly },
    { ...num('elevation', 'Orbit Elevation', 45, 40, 60, 'Camera', 'design', 26), visibleWhen: orbitOnly },
    num('emission', 'Cap / Gill Emission', .6, 0, 1, 'Bioluminescence', 'effects', 0),
    num('spores', 'Spore Density', .6, 0, 1, 'Bioluminescence', 'effects', 1),
    ...Object.entries(PSYLO_COLORS).map(([key, defaultValue], order): Cinema2ParameterManifest => ({ ...base, id: psyloParameterId(key), label: { backgroundColor: 'Background', primaryColor: 'Cap Primary', secondaryColor: 'Cap Secondary', stemColor: 'Stems', gillColor: 'Gill Glow', myceliumColor: 'Mycelium', sporeColor: 'Spores' }[key]!, type: 'color', defaultValue, designParentGroup: 'palette', group: 'Forest Palette', order })),
    CINEMA2_QUALITY_MODE_PARAMETER,
  ],
  modules: [{ id: moduleId, typeId: CINEMA2_PSYLO_MODULE_TYPE_ID, version: 1, enabled: true,
    config: { asset: 'cinema2-psylo-static' }, parameters: { ...moduleDefaults, ...PSYLO_MUSIC_DEFAULTS },
    parameterBindings: Object.fromEntries(Object.keys(moduleDefaults).map(key => [key, ref(key)])),
  }],
  scene: { nodes: [
    { id: root, kind: 'group', coordinateSpace: 'world' },
    { id: world, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId) },
  ], roots: [cinema2Ref(root)] },
  layers: [{ id: layer, label: 'PSYLO Forest', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: camera, label: 'PSYLO Forest Camera', projection: 'perspective', fovDegrees: 58, minAspect: 1,
    near: .1, far: 180, target: [0, 3.5, -8], transform: { position: [0, 5.85, 18.9] },
    rig: PSYLO_CAMERA_RIGS.travel, rigVariants: PSYLO_CAMERA_RIGS,
    motion: { idleMotion: true, interpolation: 'spline', constantSpeed: true, tempo: { referenceBpm: 100, minRate: .5, maxRate: 2, flightSpeed: true } },
    controls: { rigMode: ref('cameraMode'), motionEnabled: ref('cameraMotion'), motionSpeed: ref('cameraSpeed'), tempoSync: ref('bpmSync'),
      fovDegrees: ref('fov'), orbitRadius: ref('radius'), orbitAzimuthDegrees: ref('heading'), orbitElevationDegrees: ref('elevation') },
    safety: { minPosition: [-50, 1.5, -60], maxPosition: [50, 50, 50], minFovDegrees: 45, maxFovDegrees: 75, minNear: .05, maxFar: 200 },
  }],
  lighting: { lights: [
    { id: cinema2StableId('psylo-fill'), type: 'ambient', color: [.4, .5, .7, 1], intensity: .38 },
    { id: cinema2StableId('psylo-moon'), type: 'directional', color: [.48, .66, 1, 1], intensity: .65, transform: { rotation: [-.85, -.6, 0] } },
    { id: cinema2StableId('psylo-grove-spill'), type: 'point', color: [.62, .22, 1, 1], intensity: .65, transform: { position: [0, 5, -8] }, config: { range: 22 } },
    { id: cinema2StableId('psylo-teal-spill'), type: 'point', color: [.12, 1, .7, 1], intensity: .6, transform: { position: [-9, 3, -12] }, config: { range: 19 } },
    { id: cinema2StableId('psylo-amber-spill'), type: 'point', color: [1, .47, .13, 1], intensity: .55, transform: { position: [9, 3, -15] }, config: { range: 19 } },
    { id: cinema2StableId('psylo-front-fill'), type: 'point', color: [.43, .69, .82, 1], intensity: .28, transform: { position: [0, 6, 11] }, config: { range: 30 } },
  ] },
  environment: { backgroundColor: PSYLO_COLORS.backgroundColor, exposure: 1, controls: { backgroundColor: ref('backgroundColor') } },
  effects: [],
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' }],
    passes: [{ id: pass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [
      { id: color, target: cinema2Ref(target), attachment: 'color' },
      { id: cinema2StableId<Cinema2RenderSlotId>('psylo-scene-depth'), target: cinema2Ref(target), attachment: 'depth' },
    ] }], outputPass: cinema2Ref(pass),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(pass), colorSpace: 'srgb', alphaMode: 'opaque' },
}
