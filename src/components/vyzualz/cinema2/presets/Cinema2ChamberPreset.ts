import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2EffectId, type Cinema2ModuleId, type Cinema2NativePresetManifest,
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
const bloom = cinema2StableId<Cinema2EffectId>('chamber-source-bloom')
const finish = cinema2StableId<Cinema2EffectId>('chamber-source-finish')
const bloomPass = cinema2StableId<Cinema2RenderPassId>('chamber-bloom-pass')
const bloomTarget = cinema2StableId<Cinema2RenderTargetId>('chamber-bloom-target')
const bloomColor = cinema2StableId<Cinema2RenderSlotId>('chamber-bloom-color')
const finishPass = cinema2StableId<Cinema2RenderPassId>('chamber-finish-pass')
const finishTarget = cinema2StableId<Cinema2RenderTargetId>('chamber-finish-target')
const finishColor = cinema2StableId<Cinema2RenderSlotId>('chamber-finish-color')
const lightTarget = cinema2StableId<Cinema2SceneNodeId>('chamber-light-target')
const floorTarget = cinema2StableId<Cinema2SceneNodeId>('chamber-floor-target')

export const CINEMA2_CHAMBER_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_CHAMBER_PRESET_ID,
  revision: 4,
  metadata: {
    name: 'CHAMBER',
    description: 'A static interior view of Rowan Design’s Darkspore Editor Chamber.',
    author: 'DRMVYZ. Original model by Rowan Design (CC BY 4.0).',
    tags: ['reference', 'static', '3d', 'scene-preview'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the original chamber model and texture.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve overlapping surfaces inside the chamber.' },
    { id: 'render.hdr', requirement: 'optional', purpose: 'Retain the source emission and metal highlights before neutral tone mapping.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Place the imported chamber in world space.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Frame the chamber with a fixed interior camera.' },
    { id: 'lighting', requirement: 'required', purpose: 'Provide static illumination for the imported materials.' },
  ],
  scene: {
    roots: [cinema2Ref(root)],
    nodes: [
      { id: root, kind: 'group', coordinateSpace: 'world' },
      { id: lightTarget, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, 5.8, 0] } },
      { id: floorTarget, kind: 'group', parent: cinema2Ref(root), transform: { position: [0, .8, 0] } },
      {
        id: room, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId),
        // Cancel the source scene’s large export offset and put the chamber floor near Y = 0.
        transform: { position: [0, 438.02, -446.92] },
      },
    ],
  },
  modules: [{
    id: moduleId, typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1,
    // Render the GLB as authored: no palette, roughness, emission, geometry or texture overrides.
    config: { instances: [{ asset: 'cinema2-chamber', node: room, preserveMaterials: true, spin: false }], hdr: true },
    // Viewer reflection strength, not an override of any GLB material property.
    parameters: { environmentIntensity: .015 },
  }],
  cameras: [{
    id: camera, label: 'Chamber Interior', projection: 'perspective',
    fovDegrees: 56, minAspect: 16 / 9, near: 0.05, far: 100,
    transform: { position: [0, 3.6, 8] },
    target: [0, 3.8, -.3],
    rig: { kind: 'static' },
  }],
  defaults: { camera: cinema2Ref(camera) },
  environment: { backgroundColor: [.002, .006, .008, 1], exposure: 1 },
  lighting: { lights: [
    // Low quality keeps the neutral platform pool and device accent. Cyan spill
    // stays below the platform, leaving its top lit by the original white lamp.
    { id: cinema2StableId('chamber-floor-pool'), type: 'spot', color: [.9, .94, 1, 1], intensity: .22, transform: { position: [0, 5.25, 0] }, targetNode: cinema2Ref(floorTarget), config: { coneAngleDegrees: 24, penumbra: .8, range: 7 } },
    { id: cinema2StableId('chamber-device'), type: 'point', color: [.04, .85, 1, 1], intensity: .025, transform: { position: [0, 6.3, 1.2] }, config: { range: 7 } },
    { id: cinema2StableId('chamber-platform'), type: 'point', color: [0, .92, .72, 1], intensity: .05, transform: { position: [0, .65, 0] }, config: { range: 7 } },
    { id: cinema2StableId('chamber-left-spill'), type: 'point', color: [0, .65, .9, 1], intensity: .22, transform: { position: [-6, 2.8, -7] }, config: { range: 9 } },
    { id: cinema2StableId('chamber-rim'), type: 'spot', color: [.62, .72, .8, 1], intensity: .08, transform: { position: [3.8, 7.8, -2] }, targetNode: cinema2Ref(lightTarget), config: { coneAngleDegrees: 35, penumbra: .7, range: 12 } },
    { id: cinema2StableId('chamber-fill'), type: 'ambient', color: [.45, .55, .65, 1], intensity: .025 },
  ] },
  effects: [
    // These expose the GLB's own emission; no replacement glow or recoloring.
    { id: bloom, typeId: cinema2StableId('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 0,
      parameters: { mix: .8, threshold: .8, knee: .2, intensity: 1, spread: .6, levels: 6 } },
    { id: finish, typeId: cinema2StableId('cinematic-finish'), version: 1, enabled: true, scope: 'output', order: 1,
      parameters: { mix: 1, toneMap: 1, exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, tintAmount: 0, vignette: 0, grain: 0, aberration: 0 } },
  ],
  render: {
    targets: [
      { id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8', depthFormat: 'depth24' } },
      ...[bloomTarget, finishTarget].map(id => ({ id, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba16f' as const, fallbackColorFormat: 'rgba8' as const }, ownership: 'transient' as const })),
    ],
    passes: [
      { id: scenePass, kind: 'scene', scene: cinema2Ref(root), outputs: [{ id: color, target: cinema2Ref(target), attachment: 'color' }] },
      { id: bloomPass, kind: 'fullscreen', effect: cinema2Ref(bloom), dependsOn: [cinema2Ref(scenePass)], inputs: [{ id: cinema2StableId('chamber-bloom-input'), source: { pass: cinema2Ref(scenePass), output: color }, attachment: 'color' }], outputs: [{ id: bloomColor, target: cinema2Ref(bloomTarget), attachment: 'color' }] },
      { id: finishPass, kind: 'fullscreen', effect: cinema2Ref(finish), dependsOn: [cinema2Ref(bloomPass)], inputs: [{ id: cinema2StableId('chamber-finish-input'), source: { pass: cinema2Ref(bloomPass), output: bloomColor }, attachment: 'color' }], outputs: [{ id: finishColor, target: cinema2Ref(finishTarget), attachment: 'color' }] },
      { id: outputPass, kind: 'output', inputs: [{ id: cinema2StableId('chamber-input'), source: { pass: cinema2Ref(finishPass), output: finishColor }, attachment: 'color' }] },
    ],
    outputPass: cinema2Ref(outputPass),
  },
  output: { renderPass: cinema2Ref(outputPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}
