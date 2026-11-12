import { cinema2Ref, cinema2StableId, type Cinema2CameraId, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2ParameterManifest, type Cinema2SceneNodeId } from '../contracts/Cinema2NativePresetManifest'
/** Replace these authored scene/camera/light/environment fields when the custom stage arrives; the dynamic slot stays unchanged. */
export function createCinema2UserModelBaseEnvironment(moduleId: Cinema2ModuleId, prefix: string) {
  const root = cinema2StableId<Cinema2SceneNodeId>(`${prefix}-root`), node = cinema2StableId<Cinema2SceneNodeId>(`${prefix}-model`), camera = cinema2StableId<Cinema2CameraId>(`${prefix}-camera`)
  const authored: Pick<Cinema2NativePresetManifest, 'scene' | 'cameras' | 'defaults' | 'lighting' | 'environment'> = {
    scene: { nodes: [{ id: root, kind: 'group', coordinateSpace: 'world' }, { id: node, kind: 'module', parent: cinema2Ref(root), module: cinema2Ref(moduleId), transform: { position: [0, 1.1, 0] } }], roots: [cinema2Ref(root)] },
    cameras: [{ id: camera, label: 'Neutral Model Stage', projection: 'perspective', fovDegrees: 38, near: 0.05, far: 60, transform: { position: [3, 2.4, 5] }, target: [0, 1.1, 0], rig: { kind: 'static' } }],
    defaults: { camera: cinema2Ref(camera) },
    lighting: { lights: [{ id: cinema2StableId(`${prefix}-ambient`), type: 'ambient', color: [1, 1, 1, 1], intensity: 0.4 }, { id: cinema2StableId(`${prefix}-key`), type: 'directional', color: [1, 0.96, 0.9, 1], intensity: 1.2, transform: { position: [3, 6, 4] }, targetNode: cinema2Ref(node) }] },
    environment: { backgroundColor: [0.025, 0.035, 0.045, 1], exposure: 1, fog: { mode: 'exponential', color: [0.025, 0.035, 0.045, 1], density: 0.012 } },
  }
  return { authored, root, node, moduleConfig: { userModel: { node, neutralFloor: true, spin: false } } }
}
export function createCinema2UserModelParameter(id: Cinema2ParameterId): Cinema2ParameterManifest {
  return { id, label: 'Model', type: 'string', defaultValue: 'default-model', section: 'Design', designParentGroup: 'design', exposure: 'primary', persistence: 'preset', reset: 'authored-default', modulatable: false, automatable: false, choreographable: false, metadata: { editor: 'user-model-selector' } }
}
