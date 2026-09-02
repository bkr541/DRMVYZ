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
  kickEventId?: string
  dropEventId?: string
  transientEventId?: string
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
        kick: { active: kick, eventId: input.kickEventId ?? (kick ? `kick-${beatIndex}` : null) },
        dropStart: { active: drop, eventId: input.dropEventId ?? (drop ? `drop-${beatIndex}` : null) },
        transient: { active: transientActive, eventId: input.transientEventId ?? (transientActive ? `transient-${beatIndex}` : null) },
      },
    },
  } as unknown as CinematicFrameContext
}

describe('Electric Storm Stage 3 world', () => {
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

  it('implements Impact Shake and Zoom Punch as bounded shader-space UV transforms', () => {
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('clamp(uImpactShake, 0.0, 1.0) * impact * 0.012')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('clamp(uZoomPunch, 0.0, 1.0) * impact * 0.075')
    expect(ELECTRIC_STORM_FRAGMENT_SOURCE).toContain('uv = vec2(0.5) + (uv - vec2(0.5)) * zoomScale + shake;')
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
