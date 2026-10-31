import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2StableId, cinema2Ref,
  type Cinema2NativePresetManifest, type Cinema2PresetId, type Cinema2ParameterId,
  type Cinema2ModuleId, type Cinema2RenderPassId, type Cinema2SceneNodeId, type Cinema2LayerId, type Cinema2CameraId, type Cinema2RenderTargetId, type Cinema2RenderSlotId,
} from '../contracts/Cinema2NativePresetManifest'
import { cinema2GlassfallPhase1Module, GLASSFALL_PHASE1_MODULE_TYPE } from '../modules/glassfall/Cinema2GlassfallNativeModule'

export const GLASSFALL_PHASE1_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.glassfall.phase1')
const moduleId = cinema2StableId<Cinema2ModuleId>('glassfall-field')
export const GLASSFALL_REVIEW_DEPTH_ID = cinema2StableId<Cinema2ParameterId>('glassfall-review-depth')
export const GLASSFALL_REVIEW_OBLIQUE_ID = cinema2StableId<Cinema2ParameterId>('glassfall-review-oblique')
const node = cinema2StableId<Cinema2SceneNodeId>('glassfall-field-node')
const layer = cinema2StableId<Cinema2LayerId>('glassfall-world')
const camera = cinema2StableId<Cinema2CameraId>('glassfall-fixed-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('glassfall-scene-target')
const color = cinema2StableId<Cinema2RenderSlotId>('glassfall-color')
const depth = cinema2StableId<Cinema2RenderSlotId>('glassfall-depth')
const pass = cinema2StableId<Cinema2RenderPassId>('glassfall-static-pass')

/** Private study only: deliberately absent from the finished first-party catalog. */
export const GLASSFALL_PHASE1_MANIFEST: Cinema2NativePresetManifest = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: GLASSFALL_PHASE1_ID, revision: 2,
  metadata: { name: 'GLASSFALL — Phase 1 Study', description: 'Raised GLB triangle composition for review; not a completed preset.', tags: ['internal', 'diagnostic'] },
  capabilities: (['render.webgl2', 'render.depth', 'scene.3d', 'camera.world'] as const).map(id => ({ id, requirement: 'required' as const, purpose: 'Raised meshes, depth-tested panels, shadows and a separate rear surface.' })),
  parameters: [...[{ id: GLASSFALL_REVIEW_DEPTH_ID, label: 'Review Depth', defaultValue: true }, { id: GLASSFALL_REVIEW_OBLIQUE_ID, label: 'Review Oblique View', defaultValue: false }].map(value => ({ ...value, type: 'boolean' as const, section: 'Diagnostics', group: 'Phase 1', exposure: 'diagnostic' as const, persistence: 'preset' as const, reset: 'authored-default' as const, modulatable: false, choreographable: false, automatable: false }))],
  modules: [{ id: moduleId, typeId: GLASSFALL_PHASE1_MODULE_TYPE, version: 1, enabled: true,
    parameters: { reviewDepth: true, reviewOblique: false }, parameterBindings: { reviewDepth: cinema2Ref(GLASSFALL_REVIEW_DEPTH_ID), reviewOblique: cinema2Ref(GLASSFALL_REVIEW_OBLIQUE_ID) } }],
  effects: [], choreography: { rules: [] },
  scene: { nodes: [{ id: node, kind: 'module', module: cinema2Ref(moduleId), coordinateSpace: 'world' }] },
  layers: [{ id: layer, label: 'Raised GLASSFALL installation', source: cinema2Ref(node), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{ id: camera, label: 'Fixed reference framing', projection: 'perspective', fovDegrees: 2 * Math.atan(3.1 / 12) * 180 / Math.PI, near: .1, far: 30, transform: { position: [.18, -.12, 6] }, target: [0, 0, 0], rig: { kind: 'static' } }],
  defaults: { camera: cinema2Ref(camera) },
  render: { targets: [{ id: target, ownership: 'transient', descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }], passes: [{ id: pass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }, { id: depth, target: cinema2Ref(target), attachment: 'depth' }] }], outputPass: cinema2Ref(pass) },
  output: { renderPass: cinema2Ref(pass), colorSpace: 'srgb', alphaMode: 'opaque' },
}
