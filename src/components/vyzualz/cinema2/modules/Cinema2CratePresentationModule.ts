import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2ThreeSceneModuleDefinition } from './Cinema2ThreeSceneModule'
import { Cinema2CratePresentation, CINEMA2_CRATE_PRESENTATIONS, isCinema2CratePresentationId, type Cinema2CratePresentationId } from './crate/Cinema2CratePresentation'
import { Cinema2ParallaxCipherScene } from './crate/Cinema2ParallaxCipherScene'

export const cinema2CratePresentationModuleId = (id: Cinema2CratePresentationId): Cinema2ModuleTypeId =>
  cinema2StableId<Cinema2ModuleTypeId>(`crate-${id}-presentation`)

export const CINEMA2_PARALLAX_CIPHER_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('crate-parallax-cipher-presentation')

export const cinema2CratePresentationModules = [
  ...Object.keys(CINEMA2_CRATE_PRESENTATIONS).filter(isCinema2CratePresentationId).map(id => createCinema2ThreeSceneModuleDefinition({
    typeId: cinema2CratePresentationModuleId(id),
    resourceKey: `crate-${id}:presentation`,
    createModelController: library => new Cinema2CratePresentation(library, id),
  })),
  createCinema2ThreeSceneModuleDefinition({
    typeId: CINEMA2_PARALLAX_CIPHER_MODULE_TYPE_ID,
    resourceKey: 'crate-parallax-cipher:presentation',
    createModelController: library => new Cinema2ParallaxCipherScene(library),
  }),
]
