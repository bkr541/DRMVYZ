import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'

/**
 * Conduit's dedicated module keeps the proven Three scene/PBR loader while
 * owning canonical choreography delivery and the topology-aware LED runtime.
 */
export const CINEMA2_CONDUIT_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('conduit-native-render')
export const CINEMA2_CONDUIT_NATIVE_MODULE_VERSION = 1 as const

export const cinema2ConduitNativeModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_CONDUIT_NATIVE_MODULE_TYPE_ID,
  version: CINEMA2_CONDUIT_NATIVE_MODULE_VERSION,
  resourceKey: 'conduit:three-bridge',
  acceptSegmentCues: true,
})
