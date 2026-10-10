import wordmarkSvgSource from '../../../../assets/dvydrm_wordmark_clean_master.svg?raw'
import cloudLogoSvgSource from '../../../../assets/dvydrm_cloud_logo_clean_master.svg?raw'
import { cinema2StableId, type Cinema2ModuleTypeId } from '../contracts/Cinema2NativePresetManifest'
import { createCinema2EchoformModuleDefinition } from './Cinema2EchoformNativeModule'
import type { Cinema2EchoformGeometryOptions } from './echoform/Cinema2EchoformGeometry'

export const CINEMA2_ECHOWAVE_NATIVE_MODULE_TYPE_ID = cinema2StableId<Cinema2ModuleTypeId>('echowave-native-render')

/**
 * How the DVYDRM wordmark master reads into the Echoform point and wire cloud. Every path is plain white in the master, so tone is authored here:
 * the outline ring is the brightest (cyan-white rim), the letter bodies are dark mass (the magenta stipple), the sweeps are mid blue, and the
 * four-point symbol is the focal glow that ignites first, the way the eyes do on the bulldog.
 */
export const CINEMA2_ECHOWAVE_GEOMETRY: Readonly<Cinema2EchoformGeometryOptions> = Object.freeze({
  size: 3.4,
  contourBoost: 1.9,
  toneById: Object.freeze({
    'outer-outline-ring': 0.95,
    'left-primary-body': 0.22,
    'central-interlock-body': 0.22,
    'left-inner-body': 0.3,
    'right-primary-body': 0.22,
    'right-interlock-and-sweep': 0.5,
    'left-lower-sweep': 0.55,
    'center-lower-sweep': 0.55,
    'four-point-symbol': 1,
  }),
  focalIds: Object.freeze(['four-point-symbol']),
})

/**
 * The DVYDRM cloud logo the wordmark's particles disperse into. Its outline ring is the cyan-white rim, the cloud body is the dark mass with the
 * magenta stipple, and the lower star is the focal glow.
 */
export const CINEMA2_ECHOWAVE_CLOUD_LOGO_GEOMETRY: Readonly<Cinema2EchoformGeometryOptions> = Object.freeze({
  size: 2.6,
  contourBoost: 1.6,
  toneById: Object.freeze({ 'outer-outline': 0.95, 'cloud-body': 0.25, 'lower-star': 1 }),
  focalIds: Object.freeze(['lower-star']),
})

/** Echowave: the same Echoform renderer and Mainframe orchestration, on the DVYDRM wordmark. */
export const cinema2EchowaveNativeModuleDefinition = createCinema2EchoformModuleDefinition({
  typeId: CINEMA2_ECHOWAVE_NATIVE_MODULE_TYPE_ID,
  svgSource: wordmarkSvgSource,
  geometry: CINEMA2_ECHOWAVE_GEOMETRY,
  secondary: { svgSource: cloudLogoSvgSource, geometry: CINEMA2_ECHOWAVE_CLOUD_LOGO_GEOMETRY },
  resourceKey: 'echowave:wordmark-and-cloud-renderer:v1',
})
