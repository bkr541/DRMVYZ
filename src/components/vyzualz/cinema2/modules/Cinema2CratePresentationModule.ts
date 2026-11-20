import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2ParallaxCipherScene } from './crate/Cinema2ParallaxCipherScene'

export const CINEMA2_PARALLAX_CIPHER_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('crate-parallax-cipher-presentation')

/** Crate environments that still use the shared scene module with a preset-owned controller. The others have their own native modules. */
export const cinema2CratePresentationModules = [
  createCinema2ThreeSceneModuleDefinition({
    typeId: CINEMA2_PARALLAX_CIPHER_MODULE_TYPE_ID,
    resourceKey: 'crate-parallax-cipher:presentation',
    createModelController: library => new Cinema2ParallaxCipherScene(library),
  }),
]
