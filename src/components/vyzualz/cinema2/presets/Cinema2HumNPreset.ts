import {
  CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  cinema2NamespacedId,
  cinema2Ref,
  cinema2StableId,
  type Cinema2LayerId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import {
  CINEMA2_HUMN_FRAGMENT_SOURCE,
  CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
  CINEMA2_HUMN_NATIVE_MODULE_VERSION,
} from '../modules/Cinema2HumNNativeModule'
import { CINEMA2_QUALITY_MODE_PARAMETER } from '../parameters/Cinema2PerformanceParameters'

export const CINEMA2_HUMN_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.hum-n')
export const CINEMA2_HUMN_MODULE_ID = cinema2StableId<Cinema2ModuleId>('hum-n-emergence')
export const CINEMA2_HUMN_ROOT_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hum-n-root')
export const CINEMA2_HUMN_MODULE_NODE_ID = cinema2StableId<Cinema2SceneNodeId>('hum-n-emergence-node')
export const CINEMA2_HUMN_LAYER_ID = cinema2StableId<Cinema2LayerId>('hum-n-emergence-layer')

/** Backward-compatible source export; the dedicated native HUM:N module owns it now. */
export const CINEMA2_HUMN_STATIC_FRAGMENT_SOURCE = CINEMA2_HUMN_FRAGMENT_SOURCE

export const CINEMA2_HUMN_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_HUMN_PRESET_ID,
  revision: 4,
  metadata: Object.freeze({
    name: 'HUM:N',
    description: 'A near-black sparse low-poly humanoid bust reconstructed from the approved fractured white wireframe silhouette with stronger facet hierarchy, faint emergence fragments, and a restrained technical grid.',
    tags: Object.freeze(['hum-n', 'native', 'humanoid', 'low-poly', 'wireframe', 'screen-space', 'keeper']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Deterministic screen-space native HUM:N topology rendering.' }),
  ]),
  parameters: Object.freeze([CINEMA2_QUALITY_MODE_PARAMETER]),
  modules: Object.freeze([Object.freeze({
    id: CINEMA2_HUMN_MODULE_ID,
    typeId: CINEMA2_HUMN_NATIVE_MODULE_TYPE_ID,
    version: CINEMA2_HUMN_NATIVE_MODULE_VERSION,
    enabled: true,
    config: Object.freeze({ label: 'HUM:N Sparse Wireframe Foundation' }),
  })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: CINEMA2_HUMN_ROOT_NODE_ID, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }),
      Object.freeze({ id: CINEMA2_HUMN_MODULE_NODE_ID, kind: 'module' as const, parent: cinema2Ref(CINEMA2_HUMN_ROOT_NODE_ID), module: cinema2Ref(CINEMA2_HUMN_MODULE_ID), visible: true }),
    ]),
  }),
  layers: Object.freeze([Object.freeze({
    id: CINEMA2_HUMN_LAYER_ID,
    label: 'HUM:N Emergence',
    source: cinema2Ref(CINEMA2_HUMN_ROOT_NODE_ID),
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  })]),
})
