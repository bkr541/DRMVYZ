import {
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2ModuleTypeId,
  type Cinema2NativePresetManifest,
  type Cinema2ParameterId,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_REFERENCE_TORUS_KNOT_ASSET_ID } from '../modules/three/Cinema2ThreeAssetManifest'
import { CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID, CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST } from './Cinema2AtmosphereReferencePreset'

export const CINEMA2_THREE_MODEL_REFERENCE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.three-model-reference')
export const CINEMA2_THREE_MODEL_REFERENCE_ROUGHNESS_ID = cinema2StableId<Cinema2ParameterId>('three-model-reference-roughness')
export const CINEMA2_THREE_MODEL_REFERENCE_ENVIRONMENT_ID = cinema2StableId<Cinema2ParameterId>('three-model-reference-environment')
const THREE_SCENE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('three-scene')

/** The Atmosphere Reference rig (spot beams, haze, wet floor, bloom, finish), with shipped glossy models in place of the extruded pillars. */
const base = CINEMA2_ATMOSPHERE_REFERENCE_PRESET_MANIFEST

function floatParameter(id: Cinema2ParameterId, label: string, description: string, defaultValue: number, min: number, max: number, order: number) {
  return Object.freeze({
    id, label, description, type: 'float' as const, defaultValue, min, max, step: 0.05,
    section: 'Design', group: 'Model', order, exposure: 'primary' as const, persistence: 'preset' as const,
    reset: 'authored-default' as const, modulatable: true, choreographable: true,
  })
}

const NODES = ['left', 'center', 'right', 'back'].map(name => `atmosphere-reference-object-${name}`)

/**
 * Reference preset for the `three-scene` module: the roadmap's #6 acceptance scene. It is tagged `internal` (hidden from the
 * preset list) and loads Three.js only when it is activated.
 */
export const CINEMA2_THREE_MODEL_REFERENCE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  ...base,
  id: CINEMA2_THREE_MODEL_REFERENCE_PRESET_ID,
  revision: 1,
  metadata: Object.freeze({
    name: 'Three Model Reference',
    description: 'Shipped glTF models lit by the shared Cinema 2.0 light rig, reflected in the wet floor and haze: the acceptance scene for the Three.js module.',
    tags: Object.freeze(['internal', 'reference', 'diagnostic', 'three']),
  }),
  parameters: Object.freeze([
    ...(base.parameters ?? []),
    floatParameter(CINEMA2_THREE_MODEL_REFERENCE_ROUGHNESS_ID, 'Model Roughness', 'How glossy the models are (0 = mirror, 1 = matte).', 0.28, 0, 1, 50),
    floatParameter(CINEMA2_THREE_MODEL_REFERENCE_ENVIRONMENT_ID, 'Environment Reflection', 'Strength of the studio environment reflected in the models.', 0.5, 0, 2, 51),
  ]),
  modules: Object.freeze([
    Object.freeze({
      id: CINEMA2_ATMOSPHERE_REFERENCE_OBJECT_MODULE_ID,
      typeId: THREE_SCENE_TYPE_ID,
      version: 1,
      enabled: true,
      parameters: Object.freeze({ roughness: 0.28, environmentIntensity: 0.5 }),
      parameterBindings: Object.freeze({
        roughness: cinema2Ref(CINEMA2_THREE_MODEL_REFERENCE_ROUGHNESS_ID),
        environmentIntensity: cinema2Ref(CINEMA2_THREE_MODEL_REFERENCE_ENVIRONMENT_ID),
      }),
      config: Object.freeze({
        instances: Object.freeze(NODES.map(node => Object.freeze({ asset: CINEMA2_REFERENCE_TORUS_KNOT_ASSET_ID, node }))),
      }),
    }),
  ]),
}) as Readonly<Cinema2NativePresetManifest>
