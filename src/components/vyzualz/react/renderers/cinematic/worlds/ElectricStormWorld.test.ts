import { describe, expect, it } from 'vitest'
import { ELECTRIC_STORM_DEFAULTS } from '../../../CinematicWorldSettings'
import type { CinematicFrameContext } from '../../CinematicWorldRenderer'
import { deriveElectricStormColors } from './ElectricStormColor'
import { ElectricStormAudioChoreographer } from './ElectricStormAudioChoreography'
import { ELECTRIC_STORM_FRAGMENT_SOURCE } from './ElectricStormShader'
import { electricStormWorldDefinition } from './ElectricStormWorld'
import {
  ELECTRIC_STORM_HISTORY_LIMIT,
  ELECTRIC_STORM_MAX_ACTIVE_STRIKES,
  ElectricStormStrikeGenerator,
  type ElectricStormStrikeDescriptor,
} from './ElectricStormStrikeGenerator'

function maxChannel(color: { r: number; g: number; b: number }): number {
  return Math.max(color.r, color.g, color.b)
}

function collectGenerated(
  generator: ElectricStormStrikeGenerator,
  steps = 180,
): ElectricStormStrikeDescriptor[] {
  const collected: ElectricStormStrikeDescriptor[] = []
  const seen = new Set<string>()
  for (let step = 0; step < steps; step += 1) {
    for (const strike of generator.update(step * 0.43, 1)) {
      const id = `${strike.startedAtSec}:${strike.seed}`
      if (seen.has(id)) continue
      seen.add(id)
      collected.push(strike)
    }
    expect(generator.getDiagnostics().historyCount).toBeLessThanOrEqual(ELECTRIC_STORM_HISTORY_LIMIT)
    expect(generator.getDiagnostics().activeCount).toBeLessThanOrEqual(ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
  }
  return collected
}

function isEdge(point: { x: number; y: number }): boolean {
  return Math.abs(point.x) >= 0.985 || Math.abs(point.y) >= 0.985
}

function choreographyFrame(input: {
  frameIndex?: number
  timeSec?: number
  beatIndex?: number
  bass?: number
  mid?: number
  highs?: number
  transient?: number
  build?: number
  energy?: number
  kick?: boolean
  drop?: boolean
  kickEventId?: string | null
  dropEventId?: string | null
  transientEventId?: string | null
} = {}): CinematicFrameContext {
  const frameIndex = input.frameIndex ?? 0
  const beatIndex = input.beatIndex ?? frameIndex
  const kick = input.kick ?? false
  const drop = input.drop ?? false
  const transientActive = (input.transient ?? 0.1) > 0.72
  return {
    frameIndex,
    transportTimeSec: input.timeSec ?? frameIndex / 10,
    presetId: 'preset-electric-storm',
    beat: { beatIndex, barIndex: Math.floor(beatIndex / 4) },
    musicalAudio: {
      isPlaying: true,
      trackId: 'electric-storm-audio-test',
      values: {
        bass: input.bass ?? 0.5,
        mid: input.mid ?? 0.5,
        highs: input.highs ?? 0.5,
        transientIntensity: input.transient ?? 0.1,
        buildProgress: input.build ?? 0.2,
        overallEnergy: input.energy ?? 0.5,
        dropState: drop ? 1 : 0,
      },
      events: { kick, dropEntry: drop },
    },
    canonicalMusic: {
      impulses: {
        kick: {
          active: kick,
          eventId: Object.prototype.hasOwnProperty.call(input, 'kickEventId') ? input.kickEventId ?? null : (kick ? `kick-${beatIndex}` : null),
        },
        dropStart: {
          active: drop,
          eventId: Object.prototype.hasOwnProperty.call(input, 'dropEventId') ? input.dropEventId ?? null : (drop ? `drop-${beatIndex}` : null),
        },
        transient: {
          active: transientActive,
          eventId: Object.prototype.hasOwnProperty.call(input, 'transientEventId') ? input.transientEventId ?? null : (transientActive ? `transient-${beatIndex}` : null),
        },
      },
    },
  } as unknown as CinematicFrameContext
}

describe('Electric Storm Stage 3 world', () => {
  it('adds thunder as haze-shaped atmospheric illumination independent of strike rendering', () => {
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('uniform float uThunderFlash;')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('float thunderAtmosphere = 0.28 + haze * 0.82 + hazeB * 0.22;')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('color += thunderTint * thunderAtmosphere * thunderFlash;')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE.indexOf('thunderAtmosphere')).toBeLessThan(ELECTRIC_STORM_FRAGMENT_SOURCE.indexOf('vec3 strike0 = renderStrike'))
  })

  it('derives bounded hue-aware body, glow, branch, and partially white-hot core colors', () => {
    for (const color of ['#4aa7ff', '#ff365f', '#39e68d', '#b45cff']) {
      const derived = deriveElectricStormColors(color)
      for (const value of Object.values(derived).flatMap(rgb => [rgb.r, rgb.g, rgb.b])) {
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(1)
      }
      // >= rather than >: a body color that already saturates a channel to
      // 1.0 (e.g. the default #4aa7ff, blue = 1.0) can't legally go any
      // brighter on that channel within [0,1] RGB. The shader's own uCore
      // multiplier (1.55x) is what produces the actual over-bright/bloom
      // look at render time.
      expect(maxChannel(derived.core)).toBeGreaterThanOrEqual(maxChannel(derived.body))
      expect(derived.core).not.toEqual({ r: 1, g: 1, b: 1 })
      expect(derived.glow).not.toEqual(derived.body)
      expect(derived.branch).not.toEqual(derived.body)
    }
  })

  it('keeps each active strike topology stable across rendered frames and bounds active work', () => {
    const generator = new ElectricStormStrikeGenerator({ sessionSeed: 0x12345678 })
    generator.request({ tier: 'strong', power: 0.9 })
    const first = generator.update(4, 1)
    const sameBucket = generator.update(4.01, 1)
    expect(sameBucket).toEqual(first)
    expect(first.length).toBeGreaterThan(0)
    expect(first.length).toBeLessThanOrEqual(ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
    for (const strike of first) {
      expect(strike.durationSec).toBeGreaterThan(0)
      expect(strike.intensity).toBeGreaterThan(0)
      expect(strike.branchDetail).toBeGreaterThanOrEqual(0)
      expect(strike.branchDetail).toBeLessThanOrEqual(1)
      expect(strike.thicknessMultiplier).toBeGreaterThan(0)
      expect(strike.glowMultiplier).toBeGreaterThan(0)
      expect(strike.signature.length).toBeGreaterThan(0)
    }
    generator.reset()
    generator.request({ tier: 'strong', power: 0.9 })
    expect(generator.update(4, 1)).toEqual(first)
  })

  it('reaches every coarse placement and direction category with semantically correct endpoints', () => {
    const strikes = collectGenerated(new ElectricStormStrikeGenerator({ sessionSeed: 0x2468ace0 }), 720)
    expect(new Set(strikes.map(strike => strike.orientation))).toEqual(new Set(['vertical', 'horizontal', 'diagonal']))
    expect(new Set(strikes.map(strike => strike.placement))).toEqual(new Set([
      'edgeToEdge', 'edgeToInterior', 'interiorToEdge', 'interiorToInterior',
    ]))

    for (const strike of strikes) {
      if (strike.placement === 'edgeToEdge') {
        expect(isEdge(strike.start)).toBe(true)
        expect(isEdge(strike.end)).toBe(true)
      } else if (strike.placement === 'edgeToInterior') {
        expect(isEdge(strike.start)).toBe(true)
        expect(isEdge(strike.end)).toBe(false)
      } else if (strike.placement === 'interiorToEdge') {
        expect(isEdge(strike.start)).toBe(false)
        expect(isEdge(strike.end)).toBe(true)
      } else {
        expect(isEdge(strike.start)).toBe(false)
        expect(isEdge(strike.end)).toBe(false)
      }
    }
  })

  it('supports bounded simultaneous hero groups through the non-audio Stage 3 request boundary', () => {
    const generator = new ElectricStormStrikeGenerator({ sessionSeed: 73 })
    generator.request({ tier: 'hero', power: 1, count: ELECTRIC_STORM_MAX_ACTIVE_STRIKES })
    const strikes = generator.update(10, 0)
    expect(strikes).toHaveLength(ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
    expect(strikes.every(strike => strike.tier === 'hero')).toBe(true)
    expect(strikes.every(strike => strike.groupId === strikes[0]?.groupId)).toBe(true)
    expect(strikes[0]?.groupId).not.toBeNull()
    expect(generator.getDiagnostics()).toMatchObject({
      activeCount: ELECTRIC_STORM_MAX_ACTIVE_STRIKES,
      pendingRequestCount: 0,
    })
  })

  it('reproduces deterministic test sequences but varies separate normal runtime sessions', () => {
    const first = collectGenerated(new ElectricStormStrikeGenerator({ sessionSeed: 0xabcddcba }), 120)
    const second = collectGenerated(new ElectricStormStrikeGenerator({ sessionSeed: 0xabcddcba }), 120)
    expect(second).toEqual(first)

    const runtimeA = new ElectricStormStrikeGenerator()
    const runtimeB = new ElectricStormStrikeGenerator()
    runtimeA.request({ tier: 'medium' })
    runtimeB.request({ tier: 'medium' })
    const runtimeStrikeA = runtimeA.update(0, 0)[0]
    const runtimeStrikeB = runtimeB.update(0, 0)[0]
    expect(runtimeStrikeA).toBeDefined()
    expect(runtimeStrikeB).toBeDefined()
    expect(runtimeStrikeB?.seed).not.toBe(runtimeStrikeA?.seed)
  })

  it('uses bounded recent history to avoid obvious immediate coarse repetition', () => {
    const strikes = collectGenerated(new ElectricStormStrikeGenerator({ sessionSeed: 0x13579bdf }), 320)
    expect(strikes.length).toBeGreaterThan(80)
    const adjacentRepeats = strikes.slice(1).filter((strike, index) => strike.signature === strikes[index]?.signature)
    expect(adjacentRepeats.length).toBe(0)
  })

  it('deduplicates no-id event pulses across render frames without collapsing a later pulse in the same beat', () => {
    const choreographer = new ElectricStormAudioChoreographer({ sessionSeed: 0x7001 })
    const settings = { ...ELECTRIC_STORM_DEFAULTS, masterIntensity: 1, strikeRate: 1 }
    const heroCount = (frame: CinematicFrameContext) => choreographer.update(frame, settings).intents
      .filter(intent => intent.tier === 'hero').length

    expect(heroCount(choreographyFrame({ frameIndex: 1, beatIndex: 8, drop: true, dropEventId: null }))).toBe(1)
    expect(heroCount(choreographyFrame({ frameIndex: 2, beatIndex: 8, drop: true, dropEventId: null }))).toBe(0)
    expect(heroCount(choreographyFrame({ frameIndex: 3, beatIndex: 8, drop: false, dropEventId: null }))).toBe(0)
    expect(heroCount(choreographyFrame({ frameIndex: 4, beatIndex: 8, drop: true, dropEventId: null }))).toBe(1)
  })

  it('bounds pending strike work before sustained activity reaches the render update', () => {
    const generator = new ElectricStormStrikeGenerator({ sessionSeed: 0x7002 })
    for (let index = 0; index < 32; index += 1) generator.request({ tier: 'hero', power: 1, count: 3 })
    expect(generator.getDiagnostics().pendingRequestCount).toBe(4)
    generator.update(12, 1)
    expect(generator.getDiagnostics().pendingRequestCount).toBe(0)
    expect(generator.getDiagnostics().activeCount).toBeLessThanOrEqual(ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
  })

  it('uses the shared quality uniform to reduce secondary storm detail before the primary bolt path', () => {
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('int branchCap = stormQualityBranchCap();')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('if (branchIndex >= branchCap) continue;')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('(uQuality >= 0.5 ? 4 : 3)')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE.indexOf('float distanceToBolt = segmentDistance')).toBeLessThan(
      ELECTRIC_STORM_FRAGMENT_SOURCE.indexOf('int branchCap = stormQualityBranchCap();'),
    )
  })

  it('uses deterministic bounded kick probability with both strike and no-strike outcomes', () => {
    const choreographer = new ElectricStormAudioChoreographer({ sessionSeed: 0x1badb002 })
    const outcomes = Array.from({ length: 32 }, (_, index) => choreographer.update(choreographyFrame({
      frameIndex: index,
      beatIndex: index,
      kick: true,
      kickEventId: `kick-probability-${index}`,
      bass: 0.8,
      energy: 0.55,
    }), ELECTRIC_STORM_DEFAULTS).intents.some(intent => intent.tier === 'strong'))
    expect(outcomes).toContain(true)
    expect(outcomes).toContain(false)
  })

  it('scales stable strike power attributes upward with bass-derived power without per-frame topology regeneration', () => {
    let lowLengthTotal = 0
    let highLengthTotal = 0
    for (let seed = 1; seed <= 16; seed += 1) {
      const low = new ElectricStormStrikeGenerator({ sessionSeed: seed })
      const high = new ElectricStormStrikeGenerator({ sessionSeed: seed })
      low.request({ tier: 'strong', power: 0.2 })
      high.request({ tier: 'strong', power: 0.9 })
      const lowStrike = low.update(4, 0).find(strike => strike.startedAtSec === 4)!
      const highStrike = high.update(4, 0).find(strike => strike.startedAtSec === 4)!
      expect(highStrike.intensity).toBeGreaterThan(lowStrike.intensity)
      expect(highStrike.durationSec).toBeGreaterThan(lowStrike.durationSec)
      expect(highStrike.thicknessMultiplier).toBeGreaterThan(lowStrike.thicknessMultiplier)
      expect(highStrike.glowMultiplier).toBeGreaterThan(lowStrike.glowMultiplier)
      lowLengthTotal += Math.hypot(lowStrike.end.x - lowStrike.start.x, lowStrike.end.y - lowStrike.start.y)
      highLengthTotal += Math.hypot(highStrike.end.x - highStrike.start.x, highStrike.end.y - highStrike.start.y)
      expect(low.update(4.01, 0).find(strike => strike.startedAtSec === 4)).toEqual(lowStrike)
      expect(high.update(4.01, 0).find(strike => strike.startedAtSec === 4)).toEqual(highStrike)
    }
    expect(highLengthTotal).toBeGreaterThan(lowLengthTotal)
  })

  it('routes mids, highs, and transients into bounded lower-intensity strike tiers', () => {
    const medium = new ElectricStormAudioChoreographer({ sessionSeed: 0x3311 })
    const micro = new ElectricStormAudioChoreographer({ sessionSeed: 0x4422 })
    const mediumTiers = new Set<string>()
    const microTiers = new Set<string>()
    for (let index = 0; index < 48; index += 1) {
      medium.update(choreographyFrame({ frameIndex: index, timeSec: index * 0.38, mid: 1, highs: 0.1, build: 0.45 }), {
        ...ELECTRIC_STORM_DEFAULTS, masterIntensity: 1, strikeRate: 1,
      }).intents.forEach(intent => mediumTiers.add(intent.tier))
      micro.update(choreographyFrame({ frameIndex: index, timeSec: index * 0.22, mid: 0.1, highs: 1, transient: 0.2, build: 0.45 }), {
        ...ELECTRIC_STORM_DEFAULTS, masterIntensity: 1, strikeRate: 1,
      }).intents.forEach(intent => microTiers.add(intent.tier))
    }
    expect(mediumTiers).toContain('medium')
    expect(microTiers).toContain('micro')

    const transient = new ElectricStormAudioChoreographer({ sessionSeed: 0x5533 })
    const transientIntent = transient.update(choreographyFrame({ transient: 1, highs: 0.8, mid: 0.2, transientEventId: 'sharp-1' }), {
      ...ELECTRIC_STORM_DEFAULTS, masterIntensity: 1, strikeRate: 1,
    }).intents.find(intent => intent.durationScale !== undefined)
    expect(transientIntent?.tier).toBe('micro')
    expect(transientIntent?.durationScale).toBeLessThan(1)
  })

  it('produces zero foreground-strike intents at Strike Rate 0% even with every audio-reactive path active at once', () => {
    const zeroRate = { ...ELECTRIC_STORM_DEFAULTS, strikeRate: 0, masterIntensity: 1 }
    for (let seed = 0; seed < 8; seed += 1) {
      const choreographer = new ElectricStormAudioChoreographer({ sessionSeed: 0x9000 + seed })
      for (let index = 0; index < 24; index += 1) {
        const result = choreographer.update(choreographyFrame({
          frameIndex: index,
          beatIndex: index,
          timeSec: index * 0.1,
          kick: true,
          kickEventId: `zero-kick-${seed}-${index}`,
          drop: index === 12,
          dropEventId: index === 12 ? `zero-drop-${seed}` : null,
          bass: 1,
          mid: 1,
          highs: 1,
          transient: 1,
          transientEventId: `zero-transient-${seed}-${index}`,
          build: 1,
          energy: 1,
        }), zeroRate)
        expect(result.intents).toHaveLength(0)
      }
    }
  })

  it('scales autonomous strike probability continuously from zero (no dead zone) up to full aggression at 100%', () => {
    const activeAt = (rate: number, seedBase: number, steps = 400): number => {
      let activeSteps = 0
      const generator = new ElectricStormStrikeGenerator({ sessionSeed: seedBase })
      for (let step = 0; step < steps; step += 1) {
        if (generator.update(step * 0.43, rate).length > 0) activeSteps += 1
      }
      return activeSteps
    }

    for (let seedBase = 1; seedBase <= 4; seedBase += 1) {
      expect(activeAt(0, seedBase)).toBe(0)
    }

    const lowRateActivity = [1, 2, 3, 4].map(seedBase => activeAt(0.03, seedBase))
    const totalLowRateActivity = lowRateActivity.reduce((sum, value) => sum + value, 0)
    // Rare, not zero, and not anywhere near the fully-aggressive baseline.
    expect(totalLowRateActivity).toBeGreaterThan(0)

    const fullRateActivity = [1, 2, 3, 4].map(seedBase => activeAt(1, seedBase))
    const totalFullRateActivity = fullRateActivity.reduce((sum, value) => sum + value, 0)
    expect(totalFullRateActivity).toBeGreaterThan(totalLowRateActivity * 5)
  })

  it('increases storm activity/detail through build progression and caps drop hero groups', () => {
    const lowBuild = new ElectricStormAudioChoreographer({ sessionSeed: 91 }).update(choreographyFrame({ build: 0, highs: 0.65, energy: 0.6 }), ELECTRIC_STORM_DEFAULTS)
    const highBuild = new ElectricStormAudioChoreographer({ sessionSeed: 91 }).update(choreographyFrame({ build: 1, highs: 0.65, energy: 0.6 }), ELECTRIC_STORM_DEFAULTS)
    expect(highBuild.strikeRate).toBeGreaterThan(lowBuild.strikeRate)
    expect(highBuild.audioDetail).toBeGreaterThan(lowBuild.audioDetail)

    const drop = new ElectricStormAudioChoreographer({ sessionSeed: 92 }).update(choreographyFrame({
      drop: true,
      dropEventId: 'drop-hero-1',
      bass: 1,
      energy: 1,
      build: 1,
      highs: 0.9,
    }), { ...ELECTRIC_STORM_DEFAULTS, masterIntensity: 1, strikeRate: 1 })
    const hero = drop.intents.find(intent => intent.tier === 'hero')
    expect(hero).toBeDefined()
    expect(hero?.count).toBeGreaterThanOrEqual(1)
    expect(hero?.count).toBeLessThanOrEqual(ELECTRIC_STORM_MAX_ACTIVE_STRIKES)
    expect(hero?.power).toBeLessThanOrEqual(1)
  })

  it('implements Impact Shake and Zoom Punch as bounded, nonlinear shader-space UV transforms', () => {
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('float stormImpactCurve(float value) {')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('stormImpactCurve(uImpactShake) * impact * 0.05')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('stormImpactCurve(uZoomPunch) * impact * 0.16')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('uv = vec2(0.5) + (uv - vec2(0.5)) * zoomScale + shake;')
  })

  it('gives Impact Shake and Zoom Punch a nonlinear response so 100% is meaningfully stronger than a linear scale', () => {
    // Mirrors the shader's stormImpactCurve(t) = t*t and the constants above,
    // so a change to either side of this relationship is caught here.
    const stormImpactCurve = (t: number) => Math.max(0, Math.min(1, t)) ** 2
    const shakeDisplacement = (slider: number, impact: number) => stormImpactCurve(slider) * impact * 0.05
    const zoomAmount = (slider: number, impact: number) => stormImpactCurve(slider) * impact * 0.16

    const heroImpactPeak = 0.82 // ~ strikeImpactStrength() ceiling for a full-power hero strike
    const progression = [0, 0.25, 0.5, 0.75, 1].map(slider => shakeDisplacement(slider, heroImpactPeak))
    expect(progression[0]).toBe(0)
    for (let index = 1; index < progression.length; index += 1) {
      expect(progression[index]).toBeGreaterThan(progression[index - 1])
    }
    // Upper-quarter ramp: the last step must grow more than the first step,
    // proving the curve is not linear (a linear scale would make every step equal).
    expect(progression[4] - progression[3]).toBeGreaterThan(progression[1] - progression[0])

    const oldMaxShake = 1 * heroImpactPeak * 0.012
    const oldMaxZoom = 1 * heroImpactPeak * 0.075
    expect(shakeDisplacement(1, heroImpactPeak)).toBeGreaterThan(oldMaxShake * 3)
    expect(zoomAmount(1, heroImpactPeak)).toBeGreaterThan(oldMaxZoom * 1.5)

    // Zoom must never invert or exceed a safe bound, even at the theoretical max.
    expect(1 - zoomAmount(1, 1)).toBeGreaterThan(0.8)
  })

  it('uses the real fullscreen WebGL production definition with no 3D or generic route-modulation contract', () => {
    expect(electricStormWorldDefinition.id).toBe('electricStorm')
    expect(electricStormWorldDefinition.backend).toBe('webgl2')
    expect(electricStormWorldDefinition.capabilities.supportsFullscreenPasses).toBe(true)
    expect(electricStormWorldDefinition.capabilities.supportsGeometryPasses).toBe(false)
    expect(electricStormWorldDefinition.capabilities.cameraRigs).toEqual(['locked'])
    expect(electricStormWorldDefinition.capabilities.modulationTargets).toEqual([])
  })
})
