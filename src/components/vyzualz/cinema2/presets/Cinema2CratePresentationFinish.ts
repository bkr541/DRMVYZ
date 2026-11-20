import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import {
  cinema2Ref, cinema2StableId, type Cinema2EffectId, type Cinema2ParameterRef, type Cinema2NativePresetManifest, type Cinema2RenderPassManifest,
  type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId,
} from '../contracts/Cinema2NativePresetManifest'

/** Fixed optical treatment for the four crate environments. No parameter bindings or program state. */
/** `bloomIntensity` binds the bloom's intensity to a control; without it the bloom stays fixed. */
export function withCinema2CratePresentationFinish(manifest: Readonly<Cinema2NativePresetManifest>, prefix: string, bloomIntensity?: Cinema2ParameterRef): Readonly<Cinema2NativePresetManifest> {
  const original = manifest.render!
  const scene = original.passes[0]!
  const source = original.targets![0]!
  const bloom = cinema2StableId<Cinema2EffectId>(`${prefix}-light-bloom`)
  const finish = cinema2StableId<Cinema2EffectId>(`${prefix}-color-finish`)
  const bloomPass = cinema2StableId<Cinema2RenderPassId>(`${prefix}-light-pass`)
  const bloomTarget = cinema2StableId<Cinema2RenderTargetId>(`${prefix}-light-target`)
  const bloomColor = cinema2StableId<Cinema2RenderSlotId>(`${prefix}-light-color`)
  const finishPass = original.passes[1]!
  const passes: readonly Cinema2RenderPassManifest[] = [
    scene,
    {
      id: bloomPass, kind: 'fullscreen', effect: cinema2Ref(bloom), dependsOn: [cinema2Ref(scene.id)],
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>(`${prefix}-light-input`), source: { pass: cinema2Ref(scene.id), output: scene.outputs![0]!.id }, attachment: 'color' }],
      outputs: [{ id: bloomColor, target: cinema2Ref(bloomTarget), attachment: 'color' }],
    },
    {
      id: finishPass.id, kind: 'fullscreen', effect: cinema2Ref(finish), dependsOn: [cinema2Ref(bloomPass)],
      inputs: [{ id: finishPass.inputs![0]!.id, source: { pass: cinema2Ref(bloomPass), output: bloomColor }, attachment: 'color' }],
    },
  ]
  return {
    ...manifest,
    capabilities: [...(manifest.capabilities ?? []), { id: 'render.hdr', requirement: 'optional', purpose: 'Static bloom around the environment fixtures.' }],
    effects: [
      { id: bloom, typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1, enabled: true, parameters: { mix: 1, intensity: .31, threshold: .88, knee: .27, spread: .43, levels: 4 }, ...(bloomIntensity ? { parameterBindings: { intensity: bloomIntensity } } : {}) },
      { id: finish, typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1, enabled: true, parameters: { mix: 1, toneMap: 1, exposure: 1.18, contrast: 1.02, saturation: 1, vignette: .06, grain: 0, aberration: 0 } },
    ],
    render: {
      ...original, passes,
      targets: [
        { ...source, descriptor: { ...source.descriptor, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' } },
        { id: bloomTarget, descriptor: { size: { kind: 'viewport' }, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' } },
      ],
    },
  }
}
