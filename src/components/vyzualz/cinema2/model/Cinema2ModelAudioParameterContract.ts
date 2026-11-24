import type { Cinema2NativePresetManifest, Cinema2ParameterId } from '../contracts/Cinema2NativePresetManifest'
import { isCinema2UserModelPreview, type Cinema2UserModelPreviewKind } from './Cinema2UserModelPreviewPatterns'

export const MODEL_AUDIO_SLOT_COUNT = 12
export const modelAudioSlotKey = (i: number, name: string) => `audioMap${i + 1}${name}`
export const modelAudioParameterId = (kind: Cinema2UserModelPreviewKind, key: string) => `user-model-${kind}-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}` as Cinema2ParameterId

// Only configuration read directly by Cinema2ModelAudioChoreography is eligible.
// Visual targets still require their ordinary module/camera/effect bindings.
const DIRECT_KEYS = ['audioMappingsEnabled', 'audioPhraseMaterial', 'audioRepresentationDirector', 'audioTransitionTrigger', 'audioTransitionDestination', 'audioTransitionReturn'] as const
const SLOT_KEYS = ['Enabled', 'Source', 'Target', 'Intensity', 'Min', 'Max', 'Curve', 'Attack', 'Release', 'Smoothing', 'Invert', 'Quantize'] as const

export function modelAudioConsumerParameterIds(kind: Cinema2UserModelPreviewKind): readonly Cinema2ParameterId[] {
  return [...DIRECT_KEYS, ...Array.from({ length: MODEL_AUDIO_SLOT_COUNT }, (_, i) => SLOT_KEYS.map(key => modelAudioSlotKey(i, key))).flat()].map(key => modelAudioParameterId(kind, key))
}

/** Resolve the same preview kind used by the runtime, without allocating state. */
export function resolveCinema2ModelAudioKind(manifest: Readonly<Cinema2NativePresetManifest>): Cinema2UserModelPreviewKind | null {
  const kind = manifest.modules?.find(m => isCinema2UserModelPreview(m?.config?.userModelPreview))?.config?.userModelPreview
  return isCinema2UserModelPreview(kind) ? kind : null
}
