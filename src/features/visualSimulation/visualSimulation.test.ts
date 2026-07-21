import { describe, expect, it, vi } from 'vitest'
import {
  FixedStepSimulationClock,
  VisualSimulationLifecycleController,
  VisualSimulationRandom,
  clampVisualSimulationResourceBudget,
  createVisualSimulationStructuralSignature,
  hashVisualSimulationNumber,
  hashVisualSimulationString,
  sampleVisualSimulationNoise3D,
  sampleVisualSimulationVectorNoise3D,
  type VisualSimulationDomainAdapter,
  type VisualSimulationRuntimeMode,
  type VisualSimulationTimingSynchronization,
} from '.'

describe('FixedStepSimulationClock', () => {
  it('accumulates fixed steps and reports interpolation alpha', () => {
    const clock = new FixedStepSimulationClock({ fixedTimestepSec: 0.1, maxFrameDeltaSec: 1, maxSubsteps: 8 })
    const steps: number[] = []
    const first = clock.advance(0.25, (dt, time) => steps.push(dt + time))
    expect(first.steps).toBe(2)
    expect(first.interpolationAlpha).toBeCloseTo(0.5)
    expect(clock.getSimulationTimeSec()).toBeCloseTo(0.2)
    expect(steps).toHaveLength(2)

    const second = clock.advance(0.05, () => undefined)
    expect(second.steps).toBe(1)
    expect(second.interpolationAlpha).toBeCloseTo(0)
  })

  it('clamps maximum substeps and drops runaway accumulator time', () => {
    const clock = new FixedStepSimulationClock({
      fixedTimestepSec: 0.01,
      maxFrameDeltaSec: 1,
      maxSubsteps: 3,
      maxAccumulatorSec: 1,
    })
    const result = clock.advance(0.2, () => undefined)
    expect(result.steps).toBe(3)
    expect(result.droppedTimeSec).toBeGreaterThan(0)
    expect(result.interpolationAlpha).toBe(0)
  })

  it('clamps accepted frame delta after tab-style suspension', () => {
    const clock = new FixedStepSimulationClock({ fixedTimestepSec: 0.01, maxFrameDeltaSec: 0.05, maxSubsteps: 8 })
    const result = clock.advance(5, () => undefined)
    expect(result.acceptedDeltaSec).toBe(0.05)
    expect(result.droppedTimeSec).toBeGreaterThan(4.9)
    expect(result.steps).toBeLessThanOrEqual(8)
  })

  it('pauses and resumes without giant catch-up steps', () => {
    const clock = new FixedStepSimulationClock({ fixedTimestepSec: 0.1, maxFrameDeltaSec: 1 })
    clock.advance(0.15, () => undefined)
    clock.pause()
    expect(clock.advance(10, () => undefined).steps).toBe(0)
    clock.resume()
    const resumed = clock.advance(0.05, () => undefined)
    expect(resumed.steps).toBe(0)
    expect(resumed.interpolationAlpha).toBeCloseTo(0.5)
  })

  it('synchronizes timing, seeks, loop wraps, and freezes without stepping', () => {
    const clock = new FixedStepSimulationClock({ fixedTimestepSec: 0.1, maxFrameDeltaSec: 1 })
    clock.advance(0.15, () => undefined)
    clock.synchronize('timingDiscontinuity', 4)
    expect(clock.getSimulationTimeSec()).toBe(4)
    expect(clock.getInterpolationAlpha()).toBe(1)
    expect(clock.advance(0.05, () => undefined).steps).toBe(0)

    clock.freeze()
    expect(clock.advance(1, () => undefined).steps).toBe(0)
    clock.unfreeze()
    clock.backwardSeek(2)
    expect(clock.getSimulationTimeSec()).toBe(2)
    clock.loopWrap(0.5)
    expect(clock.getSimulationTimeSec()).toBe(0.5)
    clock.replaceTrack()
    expect(clock.getSimulationTimeSec()).toBe(0)
  })
})

describe('visual simulation deterministic random and noise', () => {
  it('reproduces PRNG sequences for identical seeds', () => {
    const first = new VisualSimulationRandom('living-ribbon')
    const second = new VisualSimulationRandom('living-ribbon')
    expect([first.nextUnit(), first.nextUnit(), first.nextSigned()]).toEqual([
      second.nextUnit(), second.nextUnit(), second.nextSigned(),
    ])
    expect(hashVisualSimulationString('seed')).toBe(hashVisualSimulationString('seed'))
    expect(hashVisualSimulationNumber(12.5)).toBe(hashVisualSimulationNumber(12.5))
  })

  it('reproduces scalar and vector noise without allocating output objects', () => {
    const first = sampleVisualSimulationNoise3D(1.2, -3.4, 5.6, 42)
    const second = sampleVisualSimulationNoise3D(1.2, -3.4, 5.6, 42)
    const outputA = new Float32Array(3)
    const outputB = new Float32Array(3)
    sampleVisualSimulationVectorNoise3D(1, 2, 3, 42, outputA)
    sampleVisualSimulationVectorNoise3D(1, 2, 3, 42, outputB)
    expect(first).toBe(second)
    expect(outputA).toEqual(outputB)
  })

  it('produces different deterministic results for different seeds', () => {
    const first = new VisualSimulationRandom(1)
    const second = new VisualSimulationRandom(2)
    expect(first.nextUnit()).not.toBe(second.nextUnit())
    expect(sampleVisualSimulationNoise3D(1, 2, 3, 1)).not.toBe(sampleVisualSimulationNoise3D(1, 2, 3, 2))
  })
})

describe('visual simulation lifecycle and budgets', () => {
  it('keeps structural signatures stable across object key order', () => {
    const first = createVisualSimulationStructuralSignature({ count: 10, layout: { depth: 2, width: 4 } })
    const second = createVisualSimulationStructuralSignature({ layout: { width: 4, depth: 2 }, count: 10 })
    const changed = createVisualSimulationStructuralSignature({ count: 11, layout: { depth: 2, width: 4 } })
    expect(first).toBe(second)
    expect(changed).not.toBe(first)
  })

  it('distinguishes structural rebuilds from parameter-only updates', () => {
    interface Structure { count: number }
    interface Parameters { strength: number }
    const rebuild = vi.fn()
    const updateParameters = vi.fn()
    const adapter: VisualSimulationDomainAdapter<Structure, Parameters> = {
      rebuild,
      updateParameters,
      reset: vi.fn(),
      synchronizeTiming: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      releaseResources: vi.fn(),
    }
    const lifecycle = new VisualSimulationLifecycleController(adapter)
    const initial = lifecycle.configure({ structural: { count: 12 }, parameters: { strength: 0.4 } })
    const parameterOnly = lifecycle.configure({ structural: { count: 12 }, parameters: { strength: 0.8 } })
    const rebuilt = lifecycle.configure({ structural: { count: 16 }, parameters: { strength: 0.8 } })

    expect(initial.rebuilt).toBe(true)
    expect(parameterOnly.parameterOnlyUpdate).toBe(true)
    expect(rebuilt.rebuilt).toBe(true)
    expect(rebuild).toHaveBeenCalledTimes(2)
    expect(updateParameters).toHaveBeenCalledTimes(1)
  })

  it('forwards lifecycle timing, runtime-mode, pause, resume, and deterministic reset contracts', () => {
    const timing: VisualSimulationTimingSynchronization[] = []
    const modes: VisualSimulationRuntimeMode[] = []
    const adapter: VisualSimulationDomainAdapter<{ count: number }, { strength: number }> = {
      rebuild: vi.fn(),
      updateParameters: vi.fn(),
      reset: vi.fn(),
      synchronizeTiming: input => timing.push(input),
      pause: vi.fn(),
      resume: vi.fn(),
      setRuntimeMode: mode => modes.push(mode),
      releaseResources: vi.fn(),
    }
    const lifecycle = new VisualSimulationLifecycleController(adapter)
    lifecycle.configure({ structural: { count: 4 }, parameters: { strength: 1 }, mode: 'preview' })
    lifecycle.reset({ seed: 42, identity: 'preset-a' })
    lifecycle.seek(8, 'seek-1')
    lifecycle.backwardSeek(2, 'seek-2')
    lifecycle.loopWrap(0, 'loop-1')
    lifecycle.replaceTrack(0, 'track-b')
    lifecycle.pause()
    lifecycle.resume()
    lifecycle.setRuntimeMode('thumbnail')

    expect(adapter.reset).toHaveBeenCalledWith({ seed: 42, identity: 'preset-a' })
    expect(timing.map(item => item.reason)).toEqual(['seek', 'backwardSeek', 'loopWrap', 'trackReplacement'])
    expect(adapter.pause).toHaveBeenCalledTimes(1)
    expect(adapter.resume).toHaveBeenCalledTimes(1)
    expect(modes).toEqual(['preview', 'thumbnail'])
  })

  it('clamps generic quality resources to tier budgets', () => {
    const budget = clampVisualSimulationResourceBudget({
      simulationPointCount: 1_000_000,
      particleCount: -10,
      trailSampleCount: 99,
      substepCount: 99,
      auxiliaryEffectCount: 99,
      eventStateCount: 0,
    }, 'low')
    expect(budget).toEqual({
      simulationPointCount: 1_024,
      particleCount: 0,
      trailSampleCount: 8,
      substepCount: 4,
      auxiliaryEffectCount: 4,
      eventStateCount: 1,
    })
  })

  it('disposes renderer-owned typed arrays and buffers exactly once', () => {
    let points = new Float32Array(12)
    let particles = new Float32Array(8)
    const releaseResources = vi.fn(() => {
      points = new Float32Array(0)
      particles = new Float32Array(0)
    })
    const adapter: VisualSimulationDomainAdapter<{ count: number }, { strength: number }> = {
      rebuild: vi.fn(),
      updateParameters: vi.fn(),
      reset: vi.fn(),
      synchronizeTiming: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      releaseResources,
    }
    const lifecycle = new VisualSimulationLifecycleController(adapter)
    lifecycle.configure({ structural: { count: 4 }, parameters: { strength: 1 } })
    lifecycle.dispose()
    lifecycle.dispose()

    expect(releaseResources).toHaveBeenCalledTimes(1)
    expect(points.length).toBe(0)
    expect(particles.length).toBe(0)
  })
})
