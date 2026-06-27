import { describe, expect, it } from 'vitest'
import type { ReactPerformancePadTransition, ReactPresetControlValues } from '../../ReactTypes'
import { resolvePerformancePadTransition } from '../reactPresetTransition'

const from: ReactPresetControlValues = {
  intensity: 0,
  motion: 0.2,
  glow: 0.4,
  bassReactivity: 0.6,
  trailDecay: 0.1,
  fogDensity: 0.3,
  particleDensity: 0.5,
}

const to: ReactPresetControlValues = {
  intensity: 1,
  motion: 0.8,
  glow: 0.6,
  bassReactivity: 1,
  trailDecay: 0.9,
  fogDensity: 0.7,
  particleDensity: 0.1,
}

const transition: ReactPerformancePadTransition = {
  startedAtMs: 1000,
  durationMs: 400,
  from,
  to,
}

describe('resolvePerformancePadTransition', () => {
  it('returns the starting controls at the transition start', () => {
    expect(resolvePerformancePadTransition(to, transition, 1000)).toEqual(from)
  })

  it('interpolates every visible global control', () => {
    const result = resolvePerformancePadTransition(to, transition, 1200)
    expect(result.intensity).toBeCloseTo(0.5)
    expect(result.motion).toBeCloseTo(0.5)
    expect(result.glow).toBeCloseTo(0.5)
    expect(result.bassReactivity).toBeCloseTo(0.8)
    expect(result.trailDecay).toBeCloseTo(0.5)
    expect(result.fogDensity).toBeCloseTo(0.5)
    expect(result.particleDensity).toBeCloseTo(0.3)
  })

  it('returns the selected preset snapshot after the transition completes', () => {
    expect(resolvePerformancePadTransition(to, transition, 1400)).toEqual(to)
    expect(resolvePerformancePadTransition(to, transition, 2000)).toEqual(to)
  })
})
