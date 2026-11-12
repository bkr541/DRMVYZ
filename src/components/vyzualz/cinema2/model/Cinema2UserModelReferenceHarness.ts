import { CINEMA2_NATIVE_PRESET_SCHEMA_ID, CINEMA2_NATIVE_PRESET_SCHEMA_VERSION, cinema2NamespacedId, cinema2StableId, cinema2Ref, type Cinema2ModuleId, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2PresetId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_THREE_SCENE_MODULE_TYPE_ID } from '../modules/Cinema2ThreeSceneModule'
import { createCinema2UserModelBaseEnvironment, createCinema2UserModelParameter } from './Cinema2UserModelBaseEnvironment'
export const CINEMA2_USER_MODEL_REFERENCE_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.user-model-reference')
export const CINEMA2_USER_MODEL_PARAMETER_ID = cinema2StableId<Cinema2ParameterId>('user-model-reference-binding')
export const CINEMA2_USER_MODEL_PALETTE_ID = cinema2StableId<Cinema2ParameterId>('user-model-reference-palette')
export const CINEMA2_USER_MODEL_TINT_ID = cinema2StableId<Cinema2ParameterId>('user-model-reference-tint')
const moduleId = cinema2StableId<Cinema2ModuleId>('user-model-reference-scene')
const base = createCinema2UserModelBaseEnvironment(moduleId, 'user-model-reference')
/** Test/reference declaration only. Intentionally absent from the native/first-party preset registries. */
export const CINEMA2_USER_MODEL_REFERENCE_MANIFEST: Cinema2NativePresetManifest = {
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID, schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_USER_MODEL_REFERENCE_ID, revision: 1,
  metadata: { name: 'Private Model Runtime Reference', tags: ['internal', 'reference', 'unregistered'] },
  ...base.authored,
  parameters: [createCinema2UserModelParameter(CINEMA2_USER_MODEL_PARAMETER_ID),
    { id: CINEMA2_USER_MODEL_PALETTE_ID, label: 'Tint model from Palette', type: 'boolean', defaultValue: false, section: 'Design', designParentGroup: 'design', persistence: 'preset', modulatable: false, automatable: false, choreographable: false },
    { id: CINEMA2_USER_MODEL_TINT_ID, label: 'Model tint', type: 'color', defaultValue: [1, 1, 1, 1], section: 'Design', designParentGroup: 'palette', persistence: 'preset', enabledWhen: [{ kind: 'parameter-equals', parameterId: CINEMA2_USER_MODEL_PALETTE_ID, value: true }] }],
  modules: [{ id: moduleId, typeId: CINEMA2_THREE_SCENE_MODULE_TYPE_ID, version: 1, parameters: { userModel: 'default-model', userModelPalette: false, color: [1, 1, 1, 1] }, parameterBindings: { userModel: cinema2Ref(CINEMA2_USER_MODEL_PARAMETER_ID), userModelPalette: cinema2Ref(CINEMA2_USER_MODEL_PALETTE_ID), color: cinema2Ref(CINEMA2_USER_MODEL_TINT_ID) }, config: base.moduleConfig }],
  render: {
    targets: [{ id: cinema2StableId('user-model-reference-target'), descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba8', depthFormat: 'depth24' } }],
    passes: [
      { id: cinema2StableId('user-model-reference-pass'), kind: 'scene', scene: cinema2Ref(base.root), outputs: [{ id: cinema2StableId('user-model-reference-color'), target: cinema2Ref(cinema2StableId('user-model-reference-target')), attachment: 'color' }] },
      { id: cinema2StableId('user-model-reference-output'), kind: 'output', inputs: [{ id: cinema2StableId('user-model-reference-input'), source: { pass: cinema2Ref(cinema2StableId('user-model-reference-pass')), output: cinema2StableId('user-model-reference-color') }, attachment: 'color' }] },
    ], outputPass: cinema2Ref(cinema2StableId('user-model-reference-output')),
  },
  output: { renderPass: cinema2Ref(cinema2StableId('user-model-reference-output')), colorSpace: 'srgb', alphaMode: 'opaque' },
}
