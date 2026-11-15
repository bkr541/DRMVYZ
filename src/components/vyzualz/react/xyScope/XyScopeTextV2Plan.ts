import type { SharedPerformanceContext } from '../../../../features/performanceCore'
import { textV2Unit as unit } from './XyScopeTextV2Settings'

export interface TextV2Plan {
  id: string
  intent: 'depart' | 'redirect' | 'hold' | 'reform'
  holdBeats: number
  ratioX: number
  ratioY: number
  petals: number
  skew: number
  centerX: number
  centerY: number
  spread: number
  field: number
  grouping: number
  drift: number
  /** Stable choices per musical event, never random noise per vertex or animation frame. */
  choices: readonly number[]
}
export const TEXT_V2_IDLE_PLAN: Readonly<TextV2Plan> = Object.freeze({
  id: 'idle', intent: 'hold', holdBeats: 1, ratioX: 1, ratioY: 2, petals: 3, skew: .5,
  centerX: 0, centerY: 0, spread: .7, field: .55, grouping: .5, drift: .4,
  choices: Object.freeze(Array<number>(24).fill(.5)),
})

/** Musical structure and transients seed a repeatable, feature-biased performance decision. */
export function createTextV2Plan(c: SharedPerformanceContext | null, id: string): TextV2Plan {
  let seed = (c?.deterministicVariationSeed ?? 0) | 0
  const identity = `${c?.trackIdentity ?? 'signal'}:${id}`
  for (let i = 0; i < identity.length; i++) seed = Math.imul(seed ^ identity.charCodeAt(i), 16777619)
  const choices = Array.from({ length: 24 }, () => {
    seed += 0x6D2B79F5
    let n = Math.imul(seed ^ seed >>> 15, seed | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  })
  const energy = unit(c?.energy ?? .5), flux = unit(c?.spectralFlux ?? 0)
  const build = unit(c?.buildProgress ?? 0), impact = unit(c?.dropImpact ?? 0)
  const release = (c?.energyTrend ?? 0) < -.12
  return {
    id,
    intent: release || energy < .12 ? 'reform' : impact > .65 || build > .55 ? 'depart'
      : choices[0] < .24 ? 'reform' : choices[0] < .55 ? 'redirect' : choices[0] < .8 ? 'depart' : 'hold',
    holdBeats: .6 + choices[1] * (1.2 + build * 3),
    ratioX: 1 + Math.floor(choices[2] * (2 + unit(c?.complexity ?? 0) * 2)),
    ratioY: 1 + Math.floor(choices[3] * 4), petals: 2 + Math.floor(choices[4] * 5),
    skew: choices[5] * Math.PI * 2,
    centerX: (choices[6] - .5) * .3, centerY: (choices[7] - .5) * .34,
    spread: .45 + choices[8] * .35 + energy * .2,
    field: .25 + energy * .3 + flux * .25 + choices[9] * .2,
    grouping: choices[10] < .35 ? 0 : choices[10] > .65 ? 1 : choices[10],
    drift: .12 + choices[11] * .7,
    choices,
  }
}
