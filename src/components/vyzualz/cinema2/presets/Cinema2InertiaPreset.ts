import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2PresetId, type Cinema2ModuleId, type Cinema2ParameterId, type Cinema2SceneNodeId,
  type Cinema2LayerId, type Cinema2CameraId, type Cinema2RenderTargetId, type Cinema2RenderPassId,
  type Cinema2RenderSlotId, type Cinema2NativePresetManifest, type Cinema2ParameterManifest,
  type Cinema2EffectId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_INERTIA_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2InertiaNativeModule'
import { INERTIA_PARTS, INERTIA_PROOF_POSES } from '../modules/inertia/Cinema2InertiaGeometry'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from './Cinema2AfterhoursPreset'
import { INERTIA_PATTERNS } from '../modules/inertia/Cinema2InertiaMotion'
import { INERTIA_AUDIO_CHANNELS, inertiaAudioRoutes } from './Cinema2InertiaAudioRoutes'
import { CINEMA2_BLOOM_EFFECT_TYPE_ID, CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID } from '../effects/Cinema2BuiltinEffects'

export const CINEMA2_INERTIA_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.inertia')
export const CINEMA2_INERTIA_MODULE_ID = cinema2StableId<Cinema2ModuleId>('inertia-sculpture')
const root = cinema2StableId<Cinema2SceneNodeId>('inertia-root')
const node = cinema2StableId<Cinema2SceneNodeId>('inertia-node')
const layer = cinema2StableId<Cinema2LayerId>('inertia-layer')
const camera = cinema2StableId<Cinema2CameraId>('inertia-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('inertia-scene-target')
const pass = cinema2StableId<Cinema2RenderPassId>('inertia-scene-pass')
const output = cinema2StableId<Cinema2RenderSlotId>('inertia-scene-color')
const depth = cinema2StableId<Cinema2RenderSlotId>('inertia-scene-depth')
const trailsEffect = cinema2StableId<Cinema2EffectId>('inertia-trails')
const bloomEffect = cinema2StableId<Cinema2EffectId>('inertia-bloom')
const trailsTarget = cinema2StableId<Cinema2RenderTargetId>('inertia-trails-target')
const trailsPass = cinema2StableId<Cinema2RenderPassId>('inertia-trails-pass')
const bloomPass = cinema2StableId<Cinema2RenderPassId>('inertia-bloom-pass')
const trailsOutput = cinema2StableId<Cinema2RenderSlotId>('inertia-trails-color')
export const inertiaParameterId = (key: string) => cinema2StableId<Cinema2ParameterId>(`inertia-${key}`)

const palette = [
  ['background', 'Background', 0], ['lattice', 'Lattice', 176 / 255], ['core', 'Core', 208 / 255],
  ['anchor', 'Anchors', 1], ['rib', 'Ribs', 192 / 255],
] as const
const hidden = { section: 'Design', exposure: 'hidden' as const, persistence: 'preset' as const, reset: 'authored-default' as const }
const primary = { ...hidden, exposure: 'primary' as const }
export const INERTIA_NUMBER_CONTROLS = [
  ['motion-speed', 'motionSpeed', 'Motion Speed', 0.25, 1, 2, 'master-controls'],
  ['motion-amount', 'motionAmount', 'Motion Amount', 0, 0.65, 1, 'master-controls'],
  ['cage-size', 'cageSize', 'Cage Size', 0.65, 1, 1.1, 'design'],
  ['core-size', 'coreSize', 'Core Size', 0.65, 1, 1.4, 'design'],
  ['lattice-density', 'latticeDensity', 'Lattice Density', 0.35, 0.8, 1, 'design'],
  ['point-size', 'pointSize', 'Point Size', 0.5, 1, 2, 'design'],
  ['anchor-size', 'anchorSize', 'Anchor Size', 0.4, 1, 1.6, 'design'],
  ['deformation', 'deformation', 'Deformation', 0, 0.45, 1, 'design'],
  ['damping', 'damping', 'Damping', 0, 0.65, 1, 'design'],
] as const
const parameters: Cinema2ParameterManifest[] = [
  CINEMA2_QUALITY_MODE_PARAMETER,
  ...palette.map(([key, label, value], order): Cinema2ParameterManifest => ({
    ...primary, id: inertiaParameterId(`${key}-color`), label, type: 'color',
    defaultValue: [value, value, value, 1], group: 'Palette', designParentGroup: 'palette', order,
  })),
  { ...primary, id: inertiaParameterId('intensity'), label: 'Intensity', type: 'float', defaultValue: 0.7,
    min: 0, max: 1, step: 0.01, group: 'Master', designParentGroup: 'master-controls', order: 0 },
  { ...primary, id: inertiaParameterId('bpm-sync'), label: 'BPM Sync', type: 'boolean', defaultValue: true,
    description: 'Locks native motion to shared timing when host Sync is also enabled. OFF uses authored seconds. Missing timing uses an unsynchronized visual fallback.',
    group: 'Master', designParentGroup: 'master-controls', order: 1 },
  { ...primary, id: inertiaParameterId('audio-response'), label: 'Audio Response', type: 'float', defaultValue: 0.65,
    min: 0, max: 1, step: 0.01, group: 'Master', designParentGroup: 'master-controls', order: 2,
    description: 'Strength of shared musical displacement, pressure, shear and sparkle. Zero restores native motion; Pattern Change remains independent.' },
  { ...primary, id: inertiaParameterId('auto-performance'), label: 'Auto Performance', type: 'boolean', defaultValue: false,
    group: 'Master', designParentGroup: 'master-controls', order: 3,
    description: 'Allows temporary build/drop patterns. Manual Pattern edits take effect immediately and leave Pattern Change enabled. The maintained base resumes afterward.' },
  ...(['bloom', 'trails'] as const).flatMap((key, i): Cinema2ParameterManifest[] => [
    { ...primary, id: inertiaParameterId(`${key}-enabled`), label: key === 'bloom' ? 'Bloom' : 'Trails', type: 'boolean', defaultValue: false,
      group: key === 'bloom' ? 'Bloom' : 'Trails', designParentGroup: 'effects', order: i * 2 },
    { ...primary, id: inertiaParameterId(`${key}-amount`), label: key === 'bloom' ? 'Bloom Amount' : 'Trails Amount', type: 'float',
      defaultValue: key === 'bloom' ? 0.08 : 0.06, min: 0, max: key === 'bloom' ? 0.35 : 0.2, step: 0.01,
      visibleWhen: [{ kind: 'parameter-equals', parameterId: inertiaParameterId(`${key}-enabled`), value: true }],
      group: key === 'bloom' ? 'Bloom' : 'Trails', designParentGroup: 'effects', order: i * 2 + 1 },
  ]),
  ...INERTIA_NUMBER_CONTROLS.map(([key, , label, min, defaultValue, max, designParentGroup], i): Cinema2ParameterManifest => ({
    ...primary, id: inertiaParameterId(key), label, type: 'float', min, max, defaultValue, step: 0.01,
    designParentGroup, group: designParentGroup === 'design' ? 'Geometry' : 'Master', order: 10 + i,
  })),
  { ...primary, id: inertiaParameterId('pattern'), label: 'Pattern', type: 'enum', defaultValue: 'reference-cycle',
    options: INERTIA_PATTERNS.map(([value, label]) => ({ value, label })), group: 'Pattern', designParentGroup: 'design', order: 0 },
  { ...primary, id: inertiaParameterId('pattern-change'), label: 'Pattern Change', type: 'boolean', defaultValue: false,
    description: 'Advance on fresh shared musical events when available. Manual Pattern selection keeps this enabled.',
    group: 'Pattern', designParentGroup: 'design', order: 1 },
  { ...primary, id: inertiaParameterId('trigger'), label: 'Trigger', type: 'enum', defaultValue: 'bar4',
    options: CINEMA2_AFTERHOURS_TRIGGER_OPTIONS, visibleWhen: [{ kind: 'parameter-equals', parameterId: inertiaParameterId('pattern-change'), value: true }],
    group: 'Pattern', designParentGroup: 'design', order: 2 },
  { ...hidden, id: inertiaParameterId('proof-pose'), label: 'Static Proof Pose', type: 'enum', defaultValue: 'coherent',
    options: INERTIA_PROOF_POSES.map(value => ({ value, label: value })), group: 'Proof', designParentGroup: 'design', order: 0 },
  { ...hidden, id: inertiaParameterId('proof-part'), label: 'Static Proof Part', type: 'enum', defaultValue: 'all',
    options: INERTIA_PARTS.map(value => ({ value, label: value })), group: 'Proof', designParentGroup: 'design', order: 1 },
]

/** User-approved first-party Inertia preset. */
export const CINEMA2_INERTIA_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_INERTIA_PRESET_ID, revision: 6,
  metadata: { name: 'Inertia', description: 'A dotted spherical core inside a folding lattice, with musical inertia, temporary automatic performances and restrained finishing.', tags: ['inertia', 'geometric', 'audio-reactive'] },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Native ordered point and rib rendering.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Shared world target with transparent depth-read geometry.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Centered world-space sculpture.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Fixed orthographic world camera.' },
    { id: 'audio.transport', requirement: 'optional', purpose: 'Native motion follows shared transport and tempo; no local analysis.' },
    { id: 'visual-director.significance', requirement: 'optional', purpose: 'Bounded shared intensity, momentum, build and impact shaping.' },
    { id: 'render.history', requirement: 'required', purpose: 'User-authorized finite feedback trails; off by default.' },
    ...(['audio.features', 'audio.bands', 'music.build', 'music.vocal-presence', 'music.beat', 'music.rhythm-events', 'music.downbeat', 'music.bar', 'music.phrase', 'music.drop'] as const).map(id => ({ id, requirement: 'optional' as const, purpose: 'Shared musical facts and canonical events for bounded Inertia performance.' })),
  ],
  parameters,
  modules: [{
    id: CINEMA2_INERTIA_MODULE_ID, typeId: CINEMA2_INERTIA_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true,
    parameters: {
      proofPose: 'coherent', proofPart: 'all', intensity: 0.7,
      bpmSync: true, pattern: 'reference-cycle', patternChange: false, trigger: 'bar4',
      autoPerformance: false, performancePattern: 'reference-cycle',
      audioResponse: 0.65, ...INERTIA_AUDIO_CHANNELS,
      ...Object.fromEntries(INERTIA_NUMBER_CONTROLS.map(([, property, , , value]) => [property, value])),
      ...Object.fromEntries(palette.filter(([key]) => key !== 'background').map(([key, , value]) => [`${key}Color`, [value, value, value, 1]])),
    },
    parameterBindings: {
      proofPose: cinema2Ref(inertiaParameterId('proof-pose')), proofPart: cinema2Ref(inertiaParameterId('proof-part')),
      intensity: cinema2Ref(inertiaParameterId('intensity')),
      audioResponse: cinema2Ref(inertiaParameterId('audio-response')),
      autoPerformance: cinema2Ref(inertiaParameterId('auto-performance')),
      bpmSync: cinema2Ref(inertiaParameterId('bpm-sync')), pattern: cinema2Ref(inertiaParameterId('pattern')),
      patternChange: cinema2Ref(inertiaParameterId('pattern-change')), trigger: cinema2Ref(inertiaParameterId('trigger')),
      ...Object.fromEntries(INERTIA_NUMBER_CONTROLS.map(([key, property]) => [property, cinema2Ref(inertiaParameterId(key))])),
      ...Object.fromEntries(palette.filter(([key]) => key !== 'background').map(([key]) => [`${key}Color`, cinema2Ref(inertiaParameterId(`${key}-color`))])),
    },
  }],
  scene: {
    nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: node, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(CINEMA2_INERTIA_MODULE_ID) }],
    roots: [cinema2Ref(root)],
  },
  layers: [{ id: layer, label: 'Inertia Sculpture', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-only', order: 0 }],
  cameras: [{
    id: camera, label: 'Inertia Fixed Camera', projection: 'orthographic', orthographicHeight: 2,
    transform: { position: [0, 0, 4] }, target: [0, 0, 0], near: 0.1, far: 10,
    rig: { kind: 'static' }, smoothingMs: 0,
  }],
  environment: { backgroundColor: [0, 0, 0, 1], exposure: 1, controls: { backgroundColor: cinema2Ref(inertiaParameterId('background-color')) } },
  choreography: { rules: inertiaAudioRoutes(CINEMA2_INERTIA_MODULE_ID) },
  effects: [
    { id: trailsEffect, typeId: CINEMA2_FEEDBACK_TRAILS_EFFECT_TYPE_ID, version: 1, enabled: false, order: 0, scope: 'output',
      parameters: { mix: 0.06, persistence: 0.7, drift: 0, transportAware: true },
      parameterBindings: { enabled: cinema2Ref(inertiaParameterId('trails-enabled')), mix: cinema2Ref(inertiaParameterId('trails-amount')) } },
    { id: bloomEffect, typeId: CINEMA2_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: false, order: 1, scope: 'output',
      parameters: { mix: 0.08, threshold: 0.12, radius: 1.4, intensity: 0.7 },
      parameterBindings: { enabled: cinema2Ref(inertiaParameterId('bloom-enabled')), mix: cinema2Ref(inertiaParameterId('bloom-amount')) } },
  ],
  render: {
    targets: [
      { id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' },
      { id: trailsTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'none' }, ownership: 'transient' },
    ],
    passes: [{ id: pass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [
      { id: output, target: cinema2Ref(target), attachment: 'color' },
      { id: depth, target: cinema2Ref(target), attachment: 'depth' },
    ] },
    { id: trailsPass, kind: 'fullscreen', effect: cinema2Ref(trailsEffect),
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('inertia-trails-input'), source: { pass: cinema2Ref(pass), output } }],
      outputs: [{ id: trailsOutput, target: cinema2Ref(trailsTarget), attachment: 'color' }] },
    { id: bloomPass, kind: 'fullscreen', effect: cinema2Ref(bloomEffect),
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('inertia-bloom-input'), source: { pass: cinema2Ref(trailsPass), output: trailsOutput } }] },
    ],
    outputPass: cinema2Ref(bloomPass),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(bloomPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}
