import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId, cinema2Ref, cinema2StableId,
  type Cinema2CameraId, type Cinema2EffectId, type Cinema2LayerId,
  type Cinema2ModuleId, type Cinema2ModuleTypeId, type Cinema2NativePresetManifest,
  type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2PresetId,
  type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_WAR_OF_WORLDS_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.war-of-worlds')
export const warOfWorldsParameterId = (name: string) => cinema2StableId<Cinema2ParameterId>(`war-of-worlds-${name}`)
const moduleId = cinema2StableId<Cinema2ModuleId>('war-of-worlds-scene')
const root = cinema2StableId<Cinema2SceneNodeId>('war-of-worlds-root')
const model = cinema2StableId<Cinema2SceneNodeId>('war-of-worlds-model')
const layer = cinema2StableId<Cinema2LayerId>('war-of-worlds-world')
const camera = cinema2StableId<Cinema2CameraId>('war-of-worlds-camera')
const finish = cinema2StableId<Cinema2EffectId>('war-of-worlds-finish')
const target = cinema2StableId<Cinema2RenderTargetId>('war-of-worlds-scene-target')
const scenePass = cinema2StableId<Cinema2RenderPassId>('war-of-worlds-scene-pass')
const finishPass = cinema2StableId<Cinema2RenderPassId>('war-of-worlds-finish-pass')
const sceneColor = cinema2StableId<Cinema2RenderSlotId>('war-of-worlds-scene-color')
const input = cinema2StableId<Cinema2RenderSlotId>('war-of-worlds-finish-input')
const parameter = warOfWorldsParameterId
const ref = (name: string) => cinema2Ref(parameter(name))
const base = { section: 'Design', exposure: 'primary', persistence: 'preset', reset: 'authored-default' } as const
function number(name: string, label: string, group: Cinema2ParameterManifest['designParentGroup'], value: number, min: number, max: number, order: number): Cinema2ParameterManifest {
  return { ...base, id: parameter(name), label, type: 'float', defaultValue: value, min, max, step: .01, designParentGroup: group, order }
}

/** Static asset-review preset. No invented musical behavior or material replacement. */
export const CINEMA2_WAR_OF_WORLDS_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_WAR_OF_WORLDS_PRESET_ID, revision: 1,
  metadata: {
    name: 'War Of Worlds',
    description: 'The supplied War Of The Tripods scene, with its original geometry and textured materials. Static scene for framing and visual review.',
    author: 'DRMVYZ; WAR OF THE TRIPODS by pinguinoconpulgares (CC BY 4.0)',
    tags: ['3d', 'tripods', 'science-fiction', 'review'],
  },
  capabilities: [
    { id: 'render.webgl2', requirement: 'required', purpose: 'Render the supplied textured glTF scene.' },
    { id: 'render.depth', requirement: 'required', purpose: 'Resolve overlapping tripod and city surfaces.' },
    { id: 'scene.3d', requirement: 'required', purpose: 'Place both aligned model parts in one world-space scene.' },
    { id: 'camera.world', requirement: 'required', purpose: 'Frame and inspect the model using an adjustable static orbit camera.' },
    { id: 'lighting', requirement: 'required', purpose: 'Preserve imported unlit surfaces and provide ambient fill for lit materials.' },
  ],
  parameters: [
    number('exposure', 'Exposure', 'master-controls', 1, .1, 3, 0),
    number('distance', 'Camera Distance', 'design', 2.8, .8, 3.5, 10),
    number('heading', 'Camera Heading', 'design', 25, -180, 180, 11),
    number('elevation', 'Camera Elevation', 'design', 4, -5, 35, 12),
    number('contrast', 'Contrast', 'effects', 1, .5, 1.5, 20),
    number('saturation', 'Saturation', 'effects', 1, 0, 2, 21),
    number('temperature', 'Color Temperature', 'palette', 0, -1, 1, 30),
    number('tint', 'Color Tint', 'palette', 0, -1, 1, 31),
    CINEMA2_QUALITY_MODE_PARAMETER,
  ],
  modules: [{
    id: moduleId, typeId: cinema2StableId<Cinema2ModuleTypeId>('three-scene'), version: 1, enabled: true,
    config: { instances: [
      { asset: 'cinema2-war-of-worlds-a', node: model },
      { asset: 'cinema2-war-of-worlds-b', node: model },
    ] },
  }],
  scene: { nodes: [
    { id: root, kind: 'group', coordinateSpace: 'world' },
    // Source bounds: [-41.25636,-24.26057,-42.65258] to [36.84866,23.60479,35.45244].
    // Uniform scale and centering preserve the complete source scene and alignment.
    { id: model, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId),
      transform: { scale: [.18, .18, .18], position: [.396693, .0590202, .6480126] } },
  ], roots: [cinema2Ref(root)] },
  layers: [{ id: layer, label: 'War Of Worlds', source: cinema2Ref(root), role: 'world', depthPolicy: 'read-write', order: 0 }],
  cameras: [{
    id: camera, label: 'Scene Review', projection: 'perspective', fovDegrees: 45, minAspect: 16 / 9,
    near: .05, far: 100, target: [-.35, .25, -.65],
    rig: { kind: 'orbit', radius: 2.8, azimuthDegrees: 25, elevationDegrees: 4, angularVelocityDegreesPerSecond: 0 },
    controls: { orbitRadius: ref('distance'), orbitAzimuthDegrees: ref('heading'), orbitElevationDegrees: ref('elevation') },
  }],
  environment: { backgroundColor: [.012, .016, .022, 1] },
  lighting: { lights: [{ id: cinema2StableId('war-of-worlds-ambient'), type: 'ambient', color: [1, 1, 1, 1], intensity: 1 }] },
  effects: [{
    id: finish, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, order: 0, scope: 'output',
    // Neutral grade: maintain the model's baked colors for the initial acceptance pass.
    parameters: { mix: 1, toneMap: 0, exposure: 1, contrast: 1, saturation: 1, temperature: 0, tint: 0, vignette: 0, grain: 0, aberration: 0 },
    parameterBindings: { exposure: ref('exposure'), contrast: ref('contrast'), saturation: ref('saturation'), temperature: ref('temperature'), tint: ref('tint') },
  }],
  render: {
    targets: [{ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' }, ownership: 'transient' }],
    passes: [
      { id: scenePass, kind: 'scene', layers: [cinema2Ref(layer)], outputs: [{ id: sceneColor, target: cinema2Ref(target), attachment: 'color' }, { id: cinema2StableId<Cinema2RenderSlotId>('war-of-worlds-scene-depth'), target: cinema2Ref(target), attachment: 'depth' }] },
      { id: finishPass, kind: 'fullscreen', effect: cinema2Ref(finish), dependsOn: [cinema2Ref(scenePass)], inputs: [{ id: input, source: { pass: cinema2Ref(scenePass), output: sceneColor }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(finishPass),
  },
  defaults: { camera: cinema2Ref(camera) },
  output: { renderPass: cinema2Ref(finishPass), colorSpace: 'srgb', alphaMode: 'opaque' },
}
