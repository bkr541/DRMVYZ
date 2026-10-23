import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyActionId, type Cinema2ChoreographyRuleId, type Cinema2ChoreographyRuleManifest, type Cinema2EffectId, type Cinema2EffectManifest, type Cinema2EffectTypeId, type Cinema2ParameterId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'

export const NIGHTSHIFT_EFFECT_DEFAULTS = { bloom: .35, haze: .35, reflections: .25 } as const
export const NIGHTSHIFT_EFFECT_IDS = Object.fromEntries(['reflections', 'haze', 'bloom'].map(name => [name, cinema2StableId<Cinema2EffectId>(`nightshift-${name}-effect`)])) as Record<keyof typeof NIGHTSHIFT_EFFECT_DEFAULTS, Cinema2EffectId>
type Controls = Record<keyof typeof NIGHTSHIFT_EFFECT_DEFAULTS | 'master' | 'floor' | 'coverage' | 'cyanColor' | 'backgroundColor', Cinema2ParameterId>

export function nightshiftFinishingEffects(p: Controls): readonly Cinema2EffectManifest[] {
  return [
    { id: NIGHTSHIFT_EFFECT_IDS.reflections, typeId: cinema2StableId<Cinema2EffectTypeId>('reflective-floor'), version: 1, enabled: true, scope: 'output', order: 0,
      parameters: { mix: .25, floorY: -.16, reflectivity: .22, lowReflectivity: .08, mediumReflectivity: .14, roughness: .35, fresnel: 1.8,
        baseColor: [.006, .008, .02, 1], skyColor: [.008, .016, .067, 1], baseLift: 1, albedo: .05, poolIntensity: .06, specular: .15,
        maxReflection: 24, fadeDistance: 30, thickness: .6, streak: .3, samplingStability: 1, edgeFallback: 0, grit: 0 },
      parameterBindings: { mix: cinema2Ref(p.reflections), skyColor: cinema2Ref(p.backgroundColor) } },
    { id: NIGHTSHIFT_EFFECT_IDS.haze, typeId: cinema2StableId<Cinema2EffectTypeId>('volumetric-atmosphere'), version: 1, enabled: true, scope: 'output', order: 1,
      parameters: { mix: .35, density: .004, beamIntensity: .35, mistAmount: .35, mistHeight: 1.5, mistFloor: .08, floorY: -.16, floorReflection: 0,
        ambientHaze: .8, ambientHeight: 1.8, anisotropy: .25, occlusion: .85, noiseScale: .3, noiseStrength: 1, drift: .16,
        smokeTexture: CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID, smokeContrast: 2.8, smokeWarp: 1.1, smokeStrength: 1,
        maxDistance: 26, reactivity: 0, shafts: 0, hazeColor: [25 / 255, 237 / 255, 1, 1] },
      parameterBindings: { mix: cinema2Ref(p.haze), mistAmount: cinema2Ref(p.haze), hazeColor: cinema2Ref(p.cyanColor) } },
    { id: NIGHTSHIFT_EFFECT_IDS.bloom, typeId: cinema2StableId<Cinema2EffectTypeId>('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 2,
      parameters: { mix: .35, threshold: .7, knee: .25, intensity: 1.5, spread: .6, levels: 6, clampMax: 8 },
      parameterBindings: { mix: cinema2Ref(p.bloom) } },
  ]
}

/** Deterministic user-authority gates run even with no audio. At authored caps
 * the effect level is unchanged; zero cannot manufacture light from shared rigs. */
export function nightshiftFinishingRules(p: Controls): readonly Cinema2ChoreographyRuleManifest[] {
  const gates = [
    ...Object.values(NIGHTSHIFT_EFFECT_IDS).map(effect => ({ effect, parameter: p.master, cap: .85, name: `${effect}-master` })),
    { effect: NIGHTSHIFT_EFFECT_IDS.reflections, parameter: p.floor, cap: .8, name: 'nightshift-reflections-floor' },
    { effect: NIGHTSHIFT_EFFECT_IDS.reflections, parameter: p.coverage, cap: .75, name: 'nightshift-reflections-coverage' },
  ]
  return gates.map(({ effect, parameter, cap, name }, index) => ({
    id: cinema2StableId<Cinema2ChoreographyRuleId>(`${name}-gate`), priority: 100 + index,
    source: { signal: 'parameter', parameter: cinema2Ref(parameter), scale: -1 / cap, offset: 1, clamp: [0, 1] },
    actions: [{ id: cinema2StableId<Cinema2ChoreographyActionId>(`${name}-gate-map`), target: { kind: 'effect', ref: cinema2Ref(effect), property: 'mix' }, operation: 'multiply', value: 0 }],
  }))
}

export function nightshiftFinishingGraph(scene: Cinema2RenderPassId, color: Cinema2RenderSlotId, depth: Cinema2RenderSlotId) {
  let previousPass = scene, previousColor = color
  const targets = [], passes = []
  for (const name of ['reflections', 'haze', 'bloom'] as const) {
    const id = cinema2StableId<Cinema2RenderPassId>(`nightshift-${name}-pass`)
    const target = cinema2StableId<Cinema2RenderTargetId>(`nightshift-${name}-target`)
    const slot = cinema2StableId<Cinema2RenderSlotId>(`nightshift-${name}-color`)
    targets.push({ id: target, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba8' as const }, ownership: 'transient' as const })
    passes.push({ id, kind: 'fullscreen' as const, effect: cinema2Ref(NIGHTSHIFT_EFFECT_IDS[name]), dependsOn: [cinema2Ref(previousPass)],
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>(`nightshift-${name}-source`), attachment: 'color' as const, source: { pass: cinema2Ref(previousPass), output: previousColor } },
        ...(name === 'bloom' ? [] : [{ id: cinema2StableId<Cinema2RenderSlotId>(`nightshift-${name}-depth`), attachment: 'depth' as const, source: { pass: cinema2Ref(scene), output: depth } }])],
      outputs: [{ id: slot, target: cinema2Ref(target), attachment: 'color' as const }] })
    previousPass = id; previousColor = slot
  }
  return { targets, passes, pass: previousPass, color: previousColor }
}
