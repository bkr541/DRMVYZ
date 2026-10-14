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
  type Cinema2RenderPassId,
  type Cinema2SceneNodeId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BOSS_BATTLE_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2BossBattleNativeModule'

export const CINEMA2_BOSS_BATTLE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.boss-battle')

const ROOT = cinema2StableId<Cinema2SceneNodeId>('boss-battle-root')
const NODE = cinema2StableId<Cinema2SceneNodeId>('boss-battle-environment-node')
const MODULE = cinema2StableId<Cinema2ModuleId>('boss-battle-environment')
const LAYER = cinema2StableId<Cinema2LayerId>('boss-battle-layer')
const PASS = cinema2StableId<Cinema2RenderPassId>('boss-battle-output')

/** Exact, locked-off presentation of the supplied Boss Battle environment artwork. */
export const CINEMA2_BOSS_BATTLE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  schemaId: CINEMA2_NATIVE_PRESET_SCHEMA_ID,
  schemaVersion: CINEMA2_NATIVE_PRESET_SCHEMA_VERSION,
  id: CINEMA2_BOSS_BATTLE_PRESET_ID,
  revision: 2,
  metadata: Object.freeze({
    name: 'Boss Battle',
    description: 'The supplied skeletal warlord arena artwork, presented exactly as a locked-off environment.',
    tags: Object.freeze(['keeper', 'boss', 'gothic', 'skeletal', 'stationary', 'cyan', 'crimson']),
  }),
  capabilities: Object.freeze([
    Object.freeze({ id: 'render.webgl2' as const, requirement: 'required' as const, purpose: 'Present the supplied environment artwork on the Cinema 2.0 Stage.' }),
  ]),
  parameters: Object.freeze([]),
  modules: Object.freeze([Object.freeze({ id: MODULE, typeId: CINEMA2_BOSS_BATTLE_NATIVE_MODULE_TYPE_ID, version: 1, enabled: true })]),
  scene: Object.freeze({
    nodes: Object.freeze([
      Object.freeze({ id: ROOT, kind: 'group' as const, coordinateSpace: 'normalized-screen' as const, visible: true }),
      Object.freeze({ id: NODE, kind: 'module' as const, parent: cinema2Ref(ROOT), module: cinema2Ref(MODULE), visible: true }),
    ]),
    roots: Object.freeze([cinema2Ref(ROOT)]),
  }),
  layers: Object.freeze([Object.freeze({
    id: LAYER,
    label: 'Boss Battle Environment',
    source: cinema2Ref(ROOT),
    visible: true,
    opacity: 1,
    blendMode: 'normal' as const,
    depthPolicy: 'disabled' as const,
    order: 0,
  })]),
  render: Object.freeze({
    passes: Object.freeze([Object.freeze({ id: PASS, kind: 'scene' as const, layers: Object.freeze([cinema2Ref(LAYER)]) })]),
    outputPass: cinema2Ref(PASS),
  }),
  output: Object.freeze({ renderPass: cinema2Ref(PASS), colorSpace: 'srgb' as const, alphaMode: 'opaque' as const }),
})
