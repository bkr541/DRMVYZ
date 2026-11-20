import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2ModuleId, type Cinema2NativePresetManifest,
  type Cinema2PresetId, type Cinema2RenderPassId, type Cinema2RenderSlotId,
  type Cinema2RenderTargetId, type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID } from '../modules/Cinema2ThreeSceneModule'

export const CINEMA2_CHAMBER_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.chamber')

const root = cinema2StableId<Cinema2SceneNodeId>('chamber-root')
const room = cinema2StableId<Cinema2SceneNodeId>('chamber-room')
const moduleId = cinema2StableId<Cinema2ModuleId>('chamber-scene')
const camera = cinema2StableId<Cinema2CameraId>('chamber-camera')
const target = cinema2StableId<Cinema2RenderTargetId>('chamber-target')
const scenePass = cinema2StableId<Cinema2RenderPassId>('chamber-world')
const color = cinema2StableId<Cinema2RenderSlotId>('chamber-world-color')
const outputPass = cinema2StableId<Cinema2RenderPassId>('chamber-output')

export const CINEMA2_CHAMBER_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_CHAMBER_PRESET_ID,
  revision: 1,
  metadata: {
    name: 'CHAMBER',
    description: 'A static interior view of Rowan Design’s Darkspore Editor Chamber.',
    author: 'DRMVYZ. Original model by Rowan Design (CC BY 4.0).',
    tags: ['reference', 'static', '3d', 'scene-preview'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the original chamber model and texture.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve overlapping surfaces inside the chamber.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Place the imported chamber in world space.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Frame the chamber with a fixed interior camera.' },
    { id: 'lighting', requirement: 'required', purpose: 'Provide static illumination for the imported materials.' },
  ],
  scene: {
    roots: [cinema2Ref(root)],
    nodes: [
      { id: root, kind: 'group', coordinateSpace: 'world' },
      {
        id: room, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId),
        // Cancel the source scene’s large export offset and put the chamber floor near Y = 0.
        transform: { position: [0, 438.02, -446.92] },
      },
    ],
  },
  modules: [{
    id: moduleId, typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1,
    config: { instances: [{ asset: 'cinema2-chamber', node: room, preserveMaterials: true, spin: false }] },
  }],
  cameras: [{
    id: camera, label: 'Chamber Interior', projection: 'perspective',
    fovDegrees: 60, near: 0.05, far: 100,
    transform: { position: [-2.9, 3.5, 6.3] },
    target: [0, 3.3, -0.3],
    rig: { kind: 'static' },
  }],
  defaults: { camera: cinema2Ref(camera) },
  environment: { backgroundColor: [0.012, 0.017, 0.024, 1] },
  lighting: { lights: [
    { id: cinema2StableId('chamber-fill'), type: 'ambient', color: [0.84, 0.9, 1, 1], intensity: 0.62 },
    { id: cinema2StableId('chamber-key'), type: 'directional', color: [1, 0.96, 0.9, 1], intensity: 0.85, transform: { position: [-4.8, 5.6, 7.4] }, targetNode: cinema2Ref(root) },
  ] },
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }],
    passes: [
      { id: scenePass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] },
      { id: outputPass, kind: 'output', inputs: [{ id: cinema2StableId('chamber-input'), source: { pass: cinema2Ref(scenePass), output: color }, attachment: 'color' }] },
    ],
    outputPass: cinema2Ref(outputPass),
  },
  output: { renderPass: cinema2Ref(outputPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}
