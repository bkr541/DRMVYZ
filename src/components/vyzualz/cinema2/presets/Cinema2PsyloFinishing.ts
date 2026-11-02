import { cinema2Ref, cinema2StableId, type Cinema2ChoreographyRuleManifest, type Cinema2EffectId, type Cinema2EffectManifest, type Cinema2LightId, type Cinema2ParameterId, type Cinema2RenderPassId, type Cinema2RenderSlotId, type Cinema2RenderTargetId } from '../contracts/Cinema2NativePresetManifest'
import { CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID } from '../assets/Cinema2TextureAssetManifest'

const param = (name: string) => cinema2StableId<Cinema2ParameterId>(`psylo-${name.replace(/[A-Z]/g, x => '-' + x.toLowerCase())}`)
const ref = (name: string) => cinema2Ref(param(name))
export const PSYLO_EFFECT_IDS = Object.fromEntries(['atmosphere', 'bloom', 'finish'].map(name => [name, cinema2StableId<Cinema2EffectId>(`psylo-${name}-effect`)])) as Record<'atmosphere' | 'bloom' | 'finish', Cinema2EffectId>
export const PSYLO_LIGHT_LEVELS = [
  ['psylo-grove-spill', .8], ['psylo-teal-spill', .7], ['psylo-amber-spill', .65], ['psylo-front-fill', .25],
  ['psylo-left-shaft', 1.25], ['psylo-right-shaft', 1.1],
] as const

export const PSYLO_FINISHING_EFFECTS: readonly Cinema2EffectManifest[] = [
  { id: PSYLO_EFFECT_IDS.atmosphere, typeId: cinema2StableId('volumetric-atmosphere'), version: 1, enabled: true, scope: 'output', order: 0, config: { idleMotion: true },
    parameters: { mix: 1, density: .009, mistAmount: .08, mistHeight: 1.8, mistFloor: .05, floorY: 0, floorReflection: 0,
      ambientHaze: .13, ambientHeight: 6, beamIntensity: .65, anisotropy: .38, occlusion: .9,
      noiseScale: .22, noiseStrength: .9, drift: .07, maxDistance: 100, reactivity: 0, shafts: 0,
      smokeTexture: CINEMA2_SMOKE_VOLUME_TEXTURE_ASSET_ID, smokeContrast: 2.4, smokeWarp: .85, smokeStrength: 1,
      hazeColor: [.22, .42, .52, 1] },
    parameterBindings: { enabled: ref('atmosphereEnabled'), mistAmount: ref('mist'), mistHeight: ref('mistHeight'), beamIntensity: ref('shafts'), hazeColor: ref('atmosphereColor') } },
  { id: PSYLO_EFFECT_IDS.bloom, typeId: cinema2StableId('hdr-bloom'), version: 1, enabled: true, scope: 'output', order: 1,
    parameters: { mix: .45, threshold: 1.1, knee: .35, intensity: 1, spread: .45, levels: 5, clampMax: 12 },
    parameterBindings: { enabled: ref('bloomEnabled'), mix: ref('bloom') } },
  { id: PSYLO_EFFECT_IDS.finish, typeId: cinema2StableId('cinematic-finish'), version: 1, enabled: true, scope: 'output', order: 2,
    parameters: { mix: 1, toneMap: 1, exposure: .96, contrast: 1.08, saturation: 1.05, vignette: .18, vignetteSoftness: .8, grain: 0, aberration: 0 } },
]

/** Gates multiply authored domains, never add past ceilings. They run without
 * audio, so zero/OFF cannot be bypassed by Director or Auto Performance. */
export function psyloFinishingRules(): readonly Cinema2ChoreographyRuleManifest[] {
  const targets = Object.values(PSYLO_EFFECT_IDS).slice(0, 2).map(id => ({ kind: 'effect' as const, ref: cinema2Ref(id), property: 'mix' }))
  const gate = (name: string, parameter: string, target: typeof targets[number], scale = -1, offset = 1): Cinema2ChoreographyRuleManifest => ({
    id: cinema2StableId(`psylo-${name.toLowerCase()}-gate`), priority: 1000,
    source: { signal: 'parameter', parameter: ref(parameter), scale, offset, clamp: [0, 1] },
    actions: [{ id: cinema2StableId(`psylo-${name.toLowerCase()}-multiply`), target, operation: 'multiply', value: 0 }],
  })
  return [
    ...targets.map((target, i) => gate(`effect-${i}-master`, 'master', target, -1 / .85)),
    ...['density', 'mistAmount'].map(property => gate(`fog-${property}`, 'fogDensity', { kind: 'effect', ref: cinema2Ref(PSYLO_EFFECT_IDS.atmosphere), property })),
    ...PSYLO_LIGHT_LEVELS.flatMap(([id]): Cinema2ChoreographyRuleManifest[] => {
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

export function psyloFinishingGraph(scene: Cinema2RenderPassId, color: Cinema2RenderSlotId, depth: Cinema2RenderSlotId) {
  let previous = scene, previousColor = color
  const targets = [], passes = []
  for (const name of ['atmosphere', 'bloom', 'finish'] as const) {
    const pass = cinema2StableId<Cinema2RenderPassId>(`psylo-${name}-pass`)
    const target = cinema2StableId<Cinema2RenderTargetId>(`psylo-${name}-target`)
    const slot = cinema2StableId<Cinema2RenderSlotId>(`psylo-${name}-color`)
    targets.push({ id: target, descriptor: { size: { kind: 'viewport' as const }, colorFormat: 'rgba16f' as const }, ownership: 'transient' as const })
    passes.push({ id: pass, kind: 'fullscreen' as const, effect: cinema2Ref(PSYLO_EFFECT_IDS[name]), dependsOn: [cinema2Ref(previous)],
      inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>(`psylo-${name}-source`), source: { pass: cinema2Ref(previous), output: previousColor }, attachment: 'color' as const },
        ...(name === 'atmosphere' ? [{ id: cinema2StableId<Cinema2RenderSlotId>('psylo-atmosphere-depth'), source: { pass: cinema2Ref(scene), output: depth }, attachment: 'depth' as const }] : [])],
      outputs: [{ id: slot, target: cinema2Ref(target), attachment: 'color' as const }] })
    previous = pass; previousColor = slot
  }
  const output = cinema2StableId<Cinema2RenderPassId>('psylo-output')
  return { targets, passes: [...passes, { id: output, kind: 'output' as const, inputs: [{ id: cinema2StableId<Cinema2RenderSlotId>('psylo-final-color'), source: { pass: cinema2Ref(previous), output: previousColor }, attachment: 'color' as const }] }], output }
}
