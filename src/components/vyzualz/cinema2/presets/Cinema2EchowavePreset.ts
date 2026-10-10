import {
  cinema2NamespacedId,
  type Cinema2ModuleId,
  type Cinema2NativePresetManifest,
  type Cinema2PresetId,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_ECHOWAVE_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2EchowaveNativeModule'
import {
  CINEMA2_ECHOFORM_MODULE_ID,
  CINEMA2_ECHOFORM_PRESET_ID,
  CINEMA2_ECHOFORM_PRESET_MANIFEST,
} from './Cinema2EchoformPreset'
import { CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID } from '../modules/Cinema2EchoformNativeModule'

/**
 * ECHOWAVE: Echoform on the DVYDRM wordmark. It is the same preset as Echoform in every control, default, choreography rule, camera, effect and render
 * pass, with only the artwork (and so the native module that reads it) and the names changed. It is derived from Echoform's manifest rather than
 * copied, so the two cannot drift apart: a change to Echoform's controls or choreography is a change to Echowave's.
 */
export const CINEMA2_ECHOWAVE_PRESET_ID = cinema2NamespacedId<Cinema2PresetId>('drmvyz.cinema2.echowave')
export const CINEMA2_ECHOWAVE_MODULE_ID = 'echowave-figure' as Cinema2ModuleId

/** Words that describe the bulldog and need to describe the wordmark instead. Everything else is shared text. */
const WORDING: readonly (readonly [RegExp, string])[] = [
  [/Echoform GOONZ SVG Figure/g, 'Echowave DVYDRM Wordmark'],
  [/the complete bulldog and headphone figure/g, 'the complete wordmark'],
  [/the complete bulldog/g, 'the complete wordmark'],
  [/the bulldog silhouette/g, 'the wordmark silhouette'],
  [/silver highlights, eyes and reconstructed topology/g, 'highlights, the four-point symbol and reconstructed topology'],
  [/focal features \(the eyes\)/g, 'focal feature (the four-point symbol)'],
  [/Echoform/g, 'Echowave'],
]

function rewrite(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value === CINEMA2_ECHOFORM_PRESET_ID) return CINEMA2_ECHOWAVE_PRESET_ID
    if (value === CINEMA2_ECHOFORM_NATIVE_MODULE_TYPE_ID) return CINEMA2_ECHOWAVE_NATIVE_MODULE_TYPE_ID
    if (value === CINEMA2_ECHOFORM_MODULE_ID) return CINEMA2_ECHOWAVE_MODULE_ID
    if (value.startsWith('echoform-')) return `echowave-${value.slice('echoform-'.length)}`
    return WORDING.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
  }
  if (Array.isArray(value)) return Object.freeze(value.map(rewrite))
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)])))
  }
  return value
}

const derived = rewrite(CINEMA2_ECHOFORM_PRESET_MANIFEST) as Cinema2NativePresetManifest

export const CINEMA2_ECHOWAVE_PRESET_MANIFEST: Readonly<Cinema2NativePresetManifest> = Object.freeze({
  ...derived,
  metadata: Object.freeze({
    name: 'Echowave',
    description: 'The DVYDRM wordmark rebuilt from its own vector outlines as a scanned point cloud: a cyan outline ring, blue wire contours and a triangulated mesh with bright nodes, a magenta stipple through the letter bodies and the four-point symbol glowing as the focal point, with every shape at its own depth. It runs Mainframe’s six lighting programs and musical orchestration over the wordmark’s geometry, and on the musical clock it assembles, holds, thins to its outline and disperses into dust, then merges into the DVYDRM cloud logo and disperses again, alternating every 8 beats.',
    tags: Object.freeze(['echowave', 'dvydrm', 'wordmark', 'native', 'svg', 'particles', 'topology', 'audio-reactive', 'keeper']),
  }),
})
