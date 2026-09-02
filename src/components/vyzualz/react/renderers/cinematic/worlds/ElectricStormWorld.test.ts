import { describe, expect, it } from 'vitest'
import { deriveElectricStormColors } from './ElectricStormColor'
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

describe('Electric Storm Stage 2 world', () => {
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

  it('uses the real fullscreen WebGL production definition with no 3D or audio modulation contract', () => {
    expect(electricStormWorldDefinition.id).toBe('electricStorm')
    expect(electricStormWorldDefinition.backend).toBe('webgl2')
    expect(electricStormWorldDefinition.capabilities.supportsFullscreenPasses).toBe(true)
    expect(electricStormWorldDefinition.capabilities.supportsGeometryPasses).toBe(false)
    expect(electricStormWorldDefinition.capabilities.cameraRigs).toEqual(['locked'])
    expect(electricStormWorldDefinition.capabilities.modulationTargets).toEqual([])
  })
})
