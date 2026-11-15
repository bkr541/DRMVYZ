import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyRuleManifest, type Cinema2EffectId, type Cinema2EffectManifest, type Cinema2LightId, type Cinema2ParameterId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'

const param = (name: string) => cinema2StableId<Cinema2ParameterId>(`neon-forest-${name.replace(/[A-Z]/g, x => '-' + x.toLowerCase())}`)
const ref = (name: string) => cinema2Ref(param(name))
export const NEON_FOREST_EFFECT_IDS = Object.fromEntries(['reflections', 'atmosphere', 'bloom', 'finish'].map(name => [name, cinema2StableId<Cinema2EffectId>(`neon-forest-${name}-effect`)])) as Record<'reflections' | 'atmosphere' | 'bloom' | 'finish', Cinema2EffectId>
export const NEON_FOREST_LIGHT_LEVELS = [
  ['neon-forest-fill', .09], ['neon-forest-moon', .22],
  ['neon-forest-grove-spill', .8], ['neon-forest-teal-spill', .7], ['neon-forest-amber-spill', .65], ['neon-forest-front-fill', .25],
  ['neon-forest-left-shaft', 1.25], ['neon-forest-right-shaft', 1.1],
] as const

export const NEON_FOREST_FINISHING_EFFECTS: readonly Cinema2EffectManifest[] = [
  { id: NEON_FOREST_EFFECT_IDS.reflections, typeId: cinema2StableId('reflective-floor'), version: 1, enabled: true, scope: 'output', order: 0,
    parameters: { mix: .3, floorY: -.04, reflectivity: .24, roughness: .65, fresnel: 2.1, albedo: .035, poolIntensity: .35, specular: .65, fadeDistance: 65, maxReflection: 28, thickness: .6, baseColor: [.018,.028,.04,1], skyColor: [.009,.004,.027,1], streak: .18, samplingStability: 1, edgeFallback: 0 },
    parameterBindings: { enabled: ref('reflectionsEnabled'), mix: ref('reflections'), baseColor: ref('groundColor'), skyColor: ref('backgroundColor') } },
  { id: NEON_FOREST_EFFECT_IDS.atmosphere, typeId: cinema2StableId('volumetric-atmosphere'), version: 1, enabled: true, scope: 'output', order: 1, config: { idleMotion: true },
    parameters: { mix: 1, density: .009, mistAmount: .08, mistHeight: 1.8, mistFloor: .05, floorY: 0, floorReflection: 0,
      ambientHaze: .13, ambientHeight: 6, beamIntensity: .65, anisotropy: .38, occlusion: .9,
      noiseScale: .22, noiseStrength: .9, drift: .07, maxDistance: 100, reactivity: 0, shafts: 0,
      smokeTexture: CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID, smokeContrast: 2.4, smokeWarp: .85, smokeStrength: 1,
      hazeColor: [.22, .42, .52, 1] },
    parameterBindings: { enabled: ref('atmosphereEnabled'), mistAmount: ref('mist'), mistHeight: ref('mistHeight'), beamIntensity: ref('shafts'), hazeColor: ref('atmosphereColor') } },
  { id: NEON_FOREST_EFFECT_IDS.bloom, typeId: cinema2StableId('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 2,
    parameters: { mix: .45, threshold: 1.1, knee: .35, intensity: 1, spread: .45, levels: 5, clampMax: 12 },
    parameterBindings: { enabled: ref('bloomEnabled'), mix: ref('bloom') } },
  { id: NEON_FOREST_EFFECT_IDS.finish, typeId: cinema2StableId('cinematic-finish'), version: 1, enabled: true, scope: 'output', order: 3,
    parameters: { mix: 1, toneMap: 1, exposure: .96, contrast: 1.08, saturation: 1.05, vignette: .18, vignetteSoftness: .8, grain: 0, aberration: 0 } },
]

/** Gates multiply authored domains, never add past ceilings. They run without
 * audio, so zero/OFF cannot be bypassed by Director or Auto Performance. */
export function neonForestFinishingRules(): readonly Cinema2ChoreographyRuleManifest[] {
  const targets = Object.values(NEON_FOREST_EFFECT_IDS).slice(0, 3).map(id => ({ kind: 'effect' as const, ref: cinema2Ref(id), property: 'mix' }))
  const gate = (name: string, parameter: string, target: typeof targets[number], scale = -1, offset = 1): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId(`neon-forest-${name.toLowerCase()}-gate`), priority: 1000,
    source: { signal: 'parameter', parameter: ref(parameter), scale, offset, clamp: [0, 1] },
    actions: [{ id: cinema2StableId(`neon-forest-${name.toLowerCase()}-multiply`), target, operation: 'multiply', value: 0 }],
  })
  return [
    ...targets.map((target, i) => gate(`effect-${i}-master`, 'master', target, -1 / .85)),
    ...['density', 'mistAmount'].map(property => gate(`fog-${property}`, 'fogDensity', { kind: 'effect', ref: cinema2Ref(NEON_FOREST_EFFECT_IDS.atmosphere), property })),
    ...NEON_FOREST_LIGHT_LEVELS.flatMap(([id]): Cinema2ChoreographyRuleManifest[] => {
      const target = { kind: 'light' as const, ref: cinema2Ref(cinema2StableId<Cinema2LightId>(id)), property: 'intensity' }
      return [
        { id: cinema2StableId(`${id}-strength`), priority: 100,
          source: { signal: 'parameter', parameter: ref('lightStrength'), scale: -1, offset: 1, clamp: [0, 1] },
          actions: [{ id: cinema2StableId(`${id}-strength-map`), target, operation: 'multiply', value: 0 }] },
        { id: cinema2StableId(`${id}-master`), priority: 1000,
          source: { signal: 'parameter', parameter: ref('master'), scale: -1, offset: 1, clamp: [0, 1] },
          actions: [{ id: cinema2StableId(`${id}-master-map`), target, operation: 'multiply', value: 0 }] },
        { id: cinema2StableId(`${id}-off`), priority: 1100,
          enabledWhen: [{ kind: 'parameter-equals', parameterId: param('lightsEnabled'), value: false }],
          source: { signal: 'parameter', parameter: ref('lightStrength'), scale: 0, offset: 1 },
          actions: [{ id: cinema2StableId(`${id}-off-map`), target, operation: 'multiply', value: 0 }] },
      ]
    }),
  ]
}

export function neonForestFinishingGraph(scene: Cinema2RenderPassId, color: Cinema2RenderSlotId, depth: Cinema2RenderSlotId) {
  let previous = scene, previousColor = color
  const targets = [], passes = []
  for (const name of ['reflections', 'atmosphere', 'bloom', 'finish'] as const) {
    const pass = cinema2StableId<Cinema2RenderPassId>(`neon-forest-${name}-pass`)
    const target = cinema2StableId<Cinema2RenderTargetId>(`neon-forest-${name}-target`)
    const slot = cinema2StableId<Cinema2RenderSlotId>(`neon-forest-${name}-color`)
    targets.push({ id: target, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba16f' as const }, ownership: 'transient' as const })
    passes.push({ id: pass, kind: 'fullscreen' as const, effect: cinema2Ref(NEON_FOREST_EFFECT_IDS[name]), dependsOn: [cinema2Ref(previous)],
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>(`neon-forest-${name}-source`), source: { pass: cinema2Ref(previous), output: previousColor }, attachment: 'color' as const },
        ...(['atmosphere', 'reflections'].includes(name) ? [{ id: cinema2StableId<Cinema2RenderSlotId>('neon-forest-atmosphere-depth'), source: { pass: cinema2Ref(scene), output: depth }, attachment: 'depth' as const }] : [])],
      outputs: [{ id: slot, target: cinema2Ref(target), attachment: 'color' as const }] })
    previous = pass; previousColor = slot
  }
  const output = cinema2StableId<Cinema2RenderPassId>('neon-forest-output')
  return { targets, passes: [...passes, { id: output, kind: 'output' as const, inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('neon-forest-final-color'), source: { pass: cinema2Ref(previous), output: previousColor }, attachment: 'color' as const }] }], output }
}
