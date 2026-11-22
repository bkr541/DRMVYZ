import {
  cinema2Ref, cinema2StableId, type Cinema2EffectId, type Cinema2EffectManifest, type Cinema2NativePresetManifest, type Cinema2ParameterId, type Cinema2RenderPassId,
  type Cinema2RenderPassManifest, type Cinema2RenderSlotId, type Cinema2RenderTargetId, type Cinema2RenderTargetManifest,
} from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID } from '../effects/Cinema2CinematicFinishEffect'
import { CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID } from '../effects/Cinema2DepthOfFieldEffect'
import { CINEMA2_GLARE_EFFECT_TYPE_ID } from '../effects/Cinema2GlareEffect'
import { CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID } from '../effects/Cinema2HdrBloomEffect'
import { CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID } from '../effects/Cinema2ReflectiveFloorEffect'
import { CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID } from '../effects/Cinema2VolumetricAtmosphereEffect'

/** The glossy floor sits just under the rails and the registration dots, so the corridor stands on it. */
export const PARALLAX_CIPHER_FLOOR_Y = -3
/** Camera-to-word distance at the reveal, where the focus holds. */
const FOCUS_DISTANCE = 13.4

/**
 * Paradox Weave's finishing chain (it replaces the shared crate finish for this preset only, so Glyph Sphere keeps its own):
 *
 *   scene → reflective floor → haze and light shafts → depth of field → bloom → glare → grade
 *
 * Every stage is a finishing effect over a scene that is already correct: the floor mirrors the plates, letters and dots; the haze gives the 22 units of
 * corridor an air to fade into and catches the cyan, magenta and red lights; the focus softens the near and far banks while the word's whole depth range stays
 * sharp (a Parallax Cipher must read from the reveal); bloom and glare carry the bright edges; the grade adds a cool shadow tint, a vignette, a little film
 * grain and a lens fringe. Each stage's strength is a control (`mix` of the effect, or the named parameter), so it can be taken to zero.
 */
export function finishParallaxCipher(manifest: Readonly<Cinema2NativePresetManifest>, prefix: string, pid: (name: string) => Cinema2ParameterId): Readonly<Cinema2NativePresetManifest> {
  const ref = (name: string) => cinema2Ref(pid(name))
  const eid = (name: string) => cinema2StableId<Cinema2EffectId>(`${prefix}-${name}`)
  const original = manifest.render!
  const scenePass = original.passes[0]!
  const sceneTarget = original.targets![0]!
  const sceneDepth = cinema2StableId<Cinema2RenderSlotId>(`${prefix}-depth`)
  const withDepth = new Set<string>()
  const effects: Cinema2EffectManifest[] = [
    {
      id: eid('floor'), typeId: CINEMA2_REFLECTIVE_FLOOR_EFFECT_TYPE_ID, version: 1,
      parameters: {
        mix: 1, floorY: PARALLAX_CIPHER_FLOOR_Y, reflectivity: .4, lowReflectivity: .12, mediumReflectivity: .24, roughness: .5, fresnel: 2.2, albedo: .18, poolIntensity: 1.2,
        specular: 1.4, fadeDistance: 48, maxReflection: 36, thickness: 1.5, skyColor: [.02, .026, .05, 1], baseColor: [.028, .034, .056, 1], streak: .22, samplingStability: 1, edgeFallback: .5, grit: 0, gritScale: 6,
      },
      parameterBindings: { mix: ref('floorReflection') },
    },
    {
      id: eid('haze'), typeId: CINEMA2_VOLUMETRIC_ATMOSPHERE_EFFECT_TYPE_ID, version: 1,
      parameters: {
        mix: 1, density: .016, beamIntensity: 1, anisotropy: .6, occlusion: .5, ambientHaze: .025, mistAmount: .55, mistHeight: .9, mistFloor: PARALLAX_CIPHER_FLOOR_Y, floorY: PARALLAX_CIPHER_FLOOR_Y,
        floorReflection: .3, noiseScale: .3, noiseStrength: .5, drift: .05, maxDistance: 46, reactivity: .6,
      },
      parameterBindings: { mix: ref('haze') },
    },
    {
      id: eid('focus'), typeId: CINEMA2_DEPTH_OF_FIELD_EFFECT_TYPE_ID, version: 1,
      // The word's letters stand between about 8.8 and 18.6 units from the reveal camera, so the sharp range covers all of them.
      parameters: { mix: .5, focusDistance: FOCUS_DISTANCE, focusCameraTarget: true, focusRange: 6.5, falloff: 9, nearBlur: 6, farBlur: 7 },
      parameterBindings: { mix: ref('depthFocus') },
    },
    {
      id: eid('light-bloom'), typeId: CINEMA2_HDR_BLOOM_EFFECT_TYPE_ID, version: 1,
      parameters: { mix: 1, intensity: .31, threshold: 1, knee: .27, spread: .45, levels: 5 },
      parameterBindings: { intensity: ref('bloom') },
    },
    {
      id: eid('flares'), typeId: CINEMA2_GLARE_EFFECT_TYPE_ID, version: 1,
      parameters: { mix: .35, intensity: .8, threshold: 1.2, length: .05, streaks: 4 },
      parameterBindings: { mix: ref('lightFlares') },
    },
    {
      id: eid('color-finish'), typeId: CINEMA2_CINEMATIC_FINISH_EFFECT_TYPE_ID, version: 1,
      parameters: {
        mix: 1, toneMap: 1, exposure: 1.18, contrast: 1.06, saturation: 1.08, vignette: .22, vignetteSoftness: .6, grain: .07, grainSize: 1.3, aberration: .05,
        tintAmount: .25, shadowTint: [.45, .52, .78], highlightTint: [1, .9, .95],
      },
      parameterBindings: { vignette: ref('vignette'), grain: ref('filmGrain'), aberration: ref('lensFringe') },
    },
  ]
  withDepth.add(String(eid('floor'))); withDepth.add(String(eid('haze'))); withDepth.add(String(eid('focus')))

  const passes: Cinema2RenderPassManifest[] = [{ ...scenePass, outputs: [...scenePass.outputs!, { id: sceneDepth, target: cinema2Ref(sceneTarget.id), attachment: 'depth' as const }] }]
  const targets: Cinema2RenderTargetManifest[] = [{ ...sceneTarget, descriptor: { ...sceneTarget.descriptor, colorFormat: 'rgba16f', fallbackColorFormat: 'rgba8' } }]
  let previous = scenePass.id
  let output = scenePass.outputs![0]!.id
  for (const effect of effects) {
    const name = String(effect.id)
    const pass = cinema2StableId<Cinema2RenderPassId>(`${name}-pass`)
    const target = cinema2StableId<Cinema2RenderTargetId>(`${name}-target`)
    const slot = cinema2StableId<Cinema2RenderSlotId>(`${name}-color`)
    const last = effect.id === effects[effects.length - 1]!.id
    // The last pass is the screen's: the grade writes 8-bit like the rest of the app's finishes, the others stay in float.
    targets.push({ id: target, descriptor: { size: { kind: 'viewport' }, colorFormat: last ? 'rgba8' : 'rgba16f', fallbackColorFormat: 'rgba8' } })
    passes.push({
      id: pass, kind: 'fullscreen', dependsOn: [cinema2Ref(previous)], effect: cinema2Ref(effect.id),
      inputs: [
        { id: cinema2StableId<Cinema2RenderSlotId>(`${name}-input`), source: { pass: cinema2Ref(previous), output }, attachment: 'color' },
        ...(withDepth.has(name) ? [{ id: cinema2StableId<Cinema2RenderSlotId>(`${name}-depth`), source: { pass: cinema2Ref(scenePass.id), output: sceneDepth }, attachment: 'depth' as const }] : []),
      ],
      outputs: [{ id: slot, target: cinema2Ref(target), attachment: 'color' }],
    })
    previous = pass
    output = slot
  }
  return {
    ...manifest,
    capabilities: [...(manifest.capabilities ?? []), { id: 'render.hdr', requirement: 'optional', purpose: 'Bloom, glare and haze over the glowing lines.' }],
    effects,
    render: { targets, passes, outputPass: cinema2Ref(previous) },
    output: { renderPass: cinema2Ref(previous), colorSpace: 'srgb', alphaMode: 'opaque' },
  }
}
