import type {
  Cinema2AtlHoePacked4,
  Cinema2AtlHoePatternId,
  Cinema2AtlHoePatternSignals,
  Cinema2AtlHoePerformanceStage,
} from './Cinema2AtlHoePatternEngine'

/** GPU-ready city choreography. Hero order: Bank of America, Westin, Truist, Georgia-Pacific. */
export interface Cinema2AtlHoeCityLightingFrame {
  readonly heroVerticalFronts: Cinema2AtlHoePacked4
  readonly heroHorizontalFronts: Cinema2AtlHoePacked4
  readonly heroVerticalWidths: Cinema2AtlHoePacked4
  readonly heroHorizontalWidths: Cinema2AtlHoePacked4
  readonly heroGains: Cinema2AtlHoePacked4
  readonly streetlightFront: number
  readonly streetlightWidth: number
  readonly streetlightGain: number
  readonly roadFront: number
  readonly roadWidth: number
  readonly roadGain: number
  readonly crownFront: number
  readonly crownWidth: number
  readonly crownGain: number
  readonly lowFacadeGain: number
  readonly windowSparkle: number
  readonly foliageThreshold: number
  readonly foliageGain: number
  /** Fixed, pooled light rig that turns emissive choreography into light on nearby geometry. */
  readonly environment: Readonly<{
    readonly signSpill: number
    /** Left, center and right skyline pools. */
    readonly citySpills: readonly [number, number, number]
    /** Left and right road pools. */
    readonly roadPools: readonly [number, number]
    readonly crownFlash: number
    readonly foliageRim: number
    readonly fogGain: number
    /** Long tail after a drop; intentionally remains non-zero during recovery. */
    readonly dropAfterglow: number
  }>
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
const fract = (value: number) => value - Math.floor(value)
const packed = (values: readonly number[]): Cinema2AtlHoePacked4 => Object.freeze(values.map(clamp01).slice(0, 4) as unknown as Cinema2AtlHoePacked4)
const mix = (a: number, b: number, amount: number) => a + (b - a) * amount

/**
 * Maps musical responsibilities onto resolvable city surfaces. Broad fronts are
 * intentional: the motion must remain legible in the embedded Stage, not only 4K.
 */
export function resolveCinema2AtlHoeCityLighting(
  pattern: Cinema2AtlHoePatternId,
  beats: number,
  stage: Cinema2AtlHoePerformanceStage,
  signals: Readonly<Cinema2AtlHoePatternSignals>,
): Readonly<Cinema2AtlHoeCityLightingFrame> {
  const active = stage === 'rest' ? 0 : stage === 'drop' ? 1 : stage === 'buildup' ? 0.65 + 0.35 * signals.build : 0.48
  const speed = pattern === 'interstate-flow' ? 2.2 : pattern === 'skyline-rise' ? 0.72 : pattern === 'neon-brownout' ? 0.55 : 1
  const travel = beats * speed
  let vertical = packed([fract(travel / 8), fract(1.18 - travel / 7), fract(travel / 6 + 0.33), fract(1.4 - travel / 9)])
  let horizontal = packed([fract(travel / 5 + 0.12), fract(1.1 - travel / 6), fract(travel / 4.5 + 0.48), fract(1.35 - travel / 7)])
  let verticalWidths = packed([0.18, 0.16, 0.18, 0.2])
  let horizontalWidths = packed([0.16, 0.18, 0.15, 0.2])
  let heroGains = packed([
    0.34 + 0.44 * signals.mid + 0.22 * signals.bass + 0.16 * signals.vocal,
    0.3 + 0.46 * signals.mid + 0.22 * signals.flux + 0.15 * signals.significance,
    0.32 + 0.55 * signals.mid + 0.22 * signals.snare,
    0.26 + 0.38 * signals.mid + 0.22 * signals.phrase + 0.14 * signals.section,
  ])
  let streetlightFront = fract(beats / 4)
  let streetlightWidth = 0.15
  let streetlightGain = 0.32 + 0.46 * signals.kick + 0.2 * signals.beat + 0.2 * signals.bass
  let roadFront = fract(beats / 6)
  let roadWidth = 0.2
  let roadGain = 0.4 + 0.45 * Math.max(signals.sub, signals.bass) + 0.16 * signals.bar
  let crownFront = fract(beats / 5)
  let crownWidth = 0.2
  let crownGain = 0.32 + 0.48 * signals.high + 0.48 * signals.flux
  let lowFacadeGain = 0.34 + 0.58 * Math.max(signals.sub, signals.bass)
  let windowSparkle = 0.18 + 0.58 * signals.high + 0.38 * signals.flux
  let foliageThreshold = 0.9 - 0.36 * Math.max(signals.flux, signals.snare, signals.transient)
  let foliageGain = 0.12 + 0.72 * Math.max(signals.flux, signals.snare, signals.transient)

  if (pattern === 'waffle-marquee') {
    streetlightFront = fract(beats / 3.5 + 0.18)
    roadFront = fract(streetlightFront + 0.16)
    heroGains = packed(heroGains.map((gain, index) => gain * (0.58 + 0.16 * index + 0.45 * signals.phrase)))
    horizontalWidths = packed([0.13, 0.15, 0.14, 0.17])
  } else if (pattern === 'interstate-flow') {
    streetlightFront = fract(beats / 2.25)
    streetlightWidth = 0.2
    streetlightGain = 0.62 + 0.38 * active + 0.32 * signals.kick
    roadFront = fract(beats / 2.8 + 0.08)
    roadWidth = 0.27
    roadGain = 0.72 + 0.28 * active + 0.28 * signals.bass
    vertical = packed(vertical.map((front, index) => fract(front + 0.1 * index + signals.phrase * 0.18)))
  } else if (pattern === 'skyline-rise') {
    verticalWidths = packed([0.24, 0.22, 0.2, 0.24])
    horizontalWidths = packed([0.2, 0.22, 0.18, 0.21])
    heroGains = packed(heroGains.map(gain => gain + 0.35 * active + 0.25 * signals.build))
    crownGain += 0.34 * Math.max(signals.high, signals.downbeat)
    crownWidth = 0.28
  } else if (pattern === 'neon-brownout') {
    verticalWidths = packed([0.12, 0.15, 0.13, 0.16])
    horizontalWidths = packed([0.14, 0.11, 0.15, 0.12])
    heroGains = packed(heroGains.map((gain, index) => gain * (index % 2 === Math.floor(beats * 2) % 2 ? 0.42 : 0.88)))
    streetlightGain *= 0.62
    roadGain *= 0.7
  } else if (pattern === 'storm-takeover') {
    const strike = clamp01(Math.max(signals.drop, signals.transient * 0.7, signals.downbeat * 0.5, signals.impact * 0.7))
    crownGain = 0.28 + 0.72 * strike + 0.3 * signals.high
    crownWidth = 0.34
    windowSparkle = 0.08 + 0.92 * strike
    foliageThreshold = 0.94 - 0.54 * strike
    foliageGain = 0.16 + 0.84 * strike
    heroGains = packed(heroGains.map(gain => gain * (0.5 + 0.7 * strike)))
  }

  if (stage === 'drop') {
    // Staged city lift: stronger routes and wider readable fronts, not a uniform full-frame flash.
    heroGains = packed(heroGains.map((gain, index) => gain + signals.drop * (0.18 + index * 0.035)))
    streetlightWidth += 0.08 * signals.drop
    roadWidth += 0.1 * signals.drop
    crownWidth += 0.06 * signals.drop
  }

  const dropAfterglow = stage === 'drop' ? 1 : stage === 'recovery' ? clamp01(signals.drop * 1.35) : 0
  const signSpill = clamp01(0.18 + 0.58 * signals.bass + 0.36 * signals.kick + 0.24 * dropAfterglow)
  const citySpills = Object.freeze([
    clamp01(heroGains[0] * (0.58 + 0.42 * signals.mid) + 0.16 * dropAfterglow),
    clamp01(Math.max(heroGains[1], heroGains[2]) * (0.56 + 0.44 * signals.energy) + 0.2 * dropAfterglow),
    clamp01(heroGains[3] * (0.58 + 0.42 * signals.high) + 0.16 * dropAfterglow),
  ] as const)
  const roadPools = Object.freeze([
    clamp01(roadGain * (0.58 + 0.42 * signals.sub) + 0.16 * signals.kick + 0.12 * dropAfterglow),
    clamp01(roadGain * (0.58 + 0.42 * signals.bass) + 0.12 * signals.kick + 0.16 * dropAfterglow),
  ] as const)
  const crownFlash = clamp01(Math.max(crownGain, signals.downbeat * 0.72, signals.drop) + 0.12 * dropAfterglow)
  const foliageRim = clamp01(foliageGain * (0.5 + 0.5 * Math.max(signals.transient, signals.snare)) + 0.16 * dropAfterglow)
  const fogGain = clamp01(0.22 + 0.38 * signals.energy + 0.28 * signals.build + 0.18 * signals.momentum + 0.35 * dropAfterglow)

  return Object.freeze({
    heroVerticalFronts: vertical,
    heroHorizontalFronts: horizontal,
    heroVerticalWidths: verticalWidths,
    heroHorizontalWidths: horizontalWidths,
    heroGains,
    streetlightFront: clamp01(streetlightFront), streetlightWidth: clamp01(streetlightWidth), streetlightGain: clamp01(streetlightGain),
    roadFront: clamp01(roadFront), roadWidth: clamp01(roadWidth), roadGain: clamp01(roadGain),
    crownFront: clamp01(crownFront), crownWidth: clamp01(crownWidth), crownGain: clamp01(crownGain),
    lowFacadeGain: clamp01(lowFacadeGain), windowSparkle: clamp01(windowSparkle),
    foliageThreshold: clamp01(foliageThreshold), foliageGain: clamp01(foliageGain),
    environment: Object.freeze({ signSpill, citySpills, roadPools, crownFlash, foliageRim, fogGain, dropAfterglow }),
  })
}

export function blendCinema2AtlHoeCityLighting(
  outgoing: Readonly<Cinema2AtlHoeCityLightingFrame>,
  incoming: Readonly<Cinema2AtlHoeCityLightingFrame>,
  amount: number,
): Readonly<Cinema2AtlHoeCityLightingFrame> {
  const t = clamp01(amount)
  const tuple = (a: Cinema2AtlHoePacked4, b: Cinema2AtlHoePacked4) => packed(a.map((value, index) => mix(value, b[index], t)))
  return Object.freeze({
    heroVerticalFronts: tuple(outgoing.heroVerticalFronts, incoming.heroVerticalFronts),
    heroHorizontalFronts: tuple(outgoing.heroHorizontalFronts, incoming.heroHorizontalFronts),
    heroVerticalWidths: tuple(outgoing.heroVerticalWidths, incoming.heroVerticalWidths),
    heroHorizontalWidths: tuple(outgoing.heroHorizontalWidths, incoming.heroHorizontalWidths),
    heroGains: tuple(outgoing.heroGains, incoming.heroGains),
    streetlightFront: mix(outgoing.streetlightFront, incoming.streetlightFront, t),
    streetlightWidth: mix(outgoing.streetlightWidth, incoming.streetlightWidth, t),
    streetlightGain: mix(outgoing.streetlightGain, incoming.streetlightGain, t),
    roadFront: mix(outgoing.roadFront, incoming.roadFront, t), roadWidth: mix(outgoing.roadWidth, incoming.roadWidth, t),
    roadGain: mix(outgoing.roadGain, incoming.roadGain, t), crownFront: mix(outgoing.crownFront, incoming.crownFront, t),
    crownWidth: mix(outgoing.crownWidth, incoming.crownWidth, t), crownGain: mix(outgoing.crownGain, incoming.crownGain, t),
    lowFacadeGain: mix(outgoing.lowFacadeGain, incoming.lowFacadeGain, t),
    windowSparkle: mix(outgoing.windowSparkle, incoming.windowSparkle, t),
    foliageThreshold: mix(outgoing.foliageThreshold, incoming.foliageThreshold, t),
    foliageGain: mix(outgoing.foliageGain, incoming.foliageGain, t),
    environment: Object.freeze({
      signSpill: mix(outgoing.environment.signSpill, incoming.environment.signSpill, t),
      citySpills: Object.freeze(outgoing.environment.citySpills.map((value, index) => mix(value, incoming.environment.citySpills[index]!, t)) as [number, number, number]),
      roadPools: Object.freeze(outgoing.environment.roadPools.map((value, index) => mix(value, incoming.environment.roadPools[index]!, t)) as [number, number]),
      crownFlash: mix(outgoing.environment.crownFlash, incoming.environment.crownFlash, t),
      foliageRim: mix(outgoing.environment.foliageRim, incoming.environment.foliageRim, t),
      fogGain: mix(outgoing.environment.fogGain, incoming.environment.fogGain, t),
      dropAfterglow: mix(outgoing.environment.dropAfterglow, incoming.environment.dropAfterglow, t),
    }),
  })
}
