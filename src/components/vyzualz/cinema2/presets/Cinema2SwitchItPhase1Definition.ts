import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2StableId, cinema2Ref,
  type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ParameterId,
  type Cinema2ModuleId, type Cinema2SceneNodeId, type Cinema2LayerId,
  type Cinema2CameraId, type Cinema2RenderTargetId, type Cinema2RenderPassId, type Cinema2RenderSlotId,
} from '../contracts/Cinema2NativePresetManifest'
import { cinema2SwitchItPhase1Module, SWITCH_IT_PHASE1_MODULE_TYPE } from '../modules/switchIt/Cinema2SwitchItPhase1Module'
import { SWITCH_IT_STATIC_STATES } from '../modules/switchIt/Cinema2SwitchItGeometry'

export const SWITCH_IT_PHASE1_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.switch-it.phase1')
export const SWITCH_IT_PREVIEW_STATE_ID = cinema2StableId<Cinema2ParameterId>('switch-it-preview-state')
const moduleId = cinema2StableId<Cinema2ModuleId>('switch-it-study')
const node = cinema2StableId<Cinema2SceneNodeId>('switch-it-subject')
const layer = cinema2StableId<Cinema2LayerId>('switch-it-world')
const camera = cinema2StableId<Cinema2CameraId>('switch-it-frontal-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('switch-it-scene-target')
const pass = cinema2StableId<Cinema2RenderPassId>('switch-it-scene-pass')
const color = cinema2StableId<Cinema2RenderSlotId>('switch-it-color')
const depth = cinema2StableId<Cinema2RenderSlotId>('switch-it-depth')

/** Development study only. Never registered in the first-party preset catalog. */
export const SWITCH_IT_PHASE1_MANIFEST: Cinema2NativePresetManifest = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: SWITCH_IT_PHASE1_ID, revision: 1,
  metadata: { name: 'Switch It — Phase 1 Study', description: 'Static geometry and framing review; not a production preset.', tags: ['internal', 'diagnostic'] },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Native geometry rendering.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Depth-tested subject.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Real faceted bust and skull geometry.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Fixed frontal composition.' },
  ],
  parameters: [{
    id: SWITCH_IT_PREVIEW_STATE_ID, label: 'Static Review State', type: 'enum', defaultValue: 'human',
    options: SWITCH_IT_STATIC_STATES.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
    section: 'Diagnostics', group: 'Phase 1', exposure: 'diagnostic',
    modulatable: false, choreographable: false, automatable: false, persistence: 'preset', reset: 'authored-default',
  }],
  modules: [{ id: moduleId, typeId: SWITCH_IT_PHASE1_MODULE_TYPE, version: 1, enabled: true,
    parameters: { previewState: 'human' }, parameterBindings: { previewState: cinema2Ref(SWITCH_IT_PREVIEW_STATE_ID) } }],
  scene: { nodes: [{ id: node, kind: 'module', module: cinema2Ref(moduleId) }] },
  layers: [{ id: layer, label: 'Static subject', source: cinema2Ref(node), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{ id: camera, label: 'Frontal study', projection: 'orthographic', orthographicHeight: 2.8,
    near: .1, far: 20, transform: { position: [0, 0, 5] }, target: [0, 0, 0], rig: { kind: 'static' } }],
  environment: { backgroundColor: [.001, .002, .005, 1], exposure: 1 },
  effects: [], choreography: { rules: [] },
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' }],
    passes: [{ id: pass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [
      { id: color, target: cinema2Ref(target), attachment: 'color' },
      { id: depth, target: cinema2Ref(target), attachment: 'depth' },
    ] }], outputPass: cinema2Ref(pass),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(pass), colorSpace: 'srgb', alphaMode: 'opaque' },
}

