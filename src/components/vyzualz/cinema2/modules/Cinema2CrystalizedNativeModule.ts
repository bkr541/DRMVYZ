import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2CrystalizedSceneController } from './crystalized/Cinema2CrystalizedSceneController'

export const CINEMA2_CRYSTALIZED_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('crystalized-native-render')
export const cinema2CrystalizedNativeModuleDefinition = createCinema2ThreeSceneModuleDefinition({
  typeId: CINEMA2_CRYSTALIZED_MODULE_TYPE_ID,
  resourceKey: 'crystalized:bridge',
  createModelController: library => new Cinema2CrystalizedSceneController(library),
})
