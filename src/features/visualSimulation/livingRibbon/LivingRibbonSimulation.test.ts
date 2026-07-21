import { describe, expect, it } from 'vitest'
import {
  LIVING_RIBBON_FIXED_TIMESTEP_SEC,
  LivingRibbonSimulation,
  livingRibbonStructuralSignature,
  type LivingRibbonConfigureInput,
  type LivingRibbonRuntimeControls,
  type LivingRibbonStructuralSettings,
} from './LivingRibbonSimulation'

const STRUCTURAL: LivingRibbonStructuralSettings = {
  pointCount: 96,
  totalLength: 8,
  baseSeed: 4815,
  initializationMode: 'wave',
  fieldScale: 0.45,
  boundarySize: 8,
  qualityTier: 'high',
}

const CONTROLS: LivingRibbonRuntimeControls = {
  drive: 0.25,
  turbulence: 0.2,
  tension: 0.7,
  damping: 0.55,
  spread: 0.55,
  centerAttraction: 0.2,
  widthTarget: 0.5,
  twist: 0.1,
  radialPressure: 0,
  collapseAmount: 0,
  releaseAmount: 0,
  directionalDrift: 0.08,
  heatDecay: 0.5,
}

function configured(patch: Partial<LivingRibbonConfigureInput> = {}): LivingRibbonSimulation {
  const simulation = new LivingRibbonSimulation()
  simulation.configure({
    structural: { ...STRUCTURAL, ...(patch.structural ?? {}) },
    controls: { ...CONTROLS, ...(patch.controls ?? {}) },
    mode: patch.mode ?? 'live',
  })
  return simulation
}

function run(simulation: LivingRibbonSimulation, frames = 120, delta = 1 / 60): void {
  for (let index = 0; index < frames; index += 1) simulation.update({ deltaTimeSec: delta })
}

function snapshot(simulation: LivingRibbonSimulation) {
  const view = simulation.getRenderView()
  return {
    positions: Array.from(view.positions),
    previous: Array.from(view.previousPositions),
    velocities: Array.from(view.velocities),
    heat: Array.from(view.heat),
    widths: Array.from(view.widths),
    time: view.simulationTimeSec,
  }
}

function maximumMagnitude(values: Float32Array): number {
  let maximum = 0
  for (let offset = 0; offset < values.length; offset += 3) {
    maximum = Math.max(maximum, Math.hypot(values[offset], values[offset + 1], values[offset + 2]))
  }
  return maximum
}

function expectFinite(values: Float32Array): void {
  expect(Array.from(values).every(Number.isFinite)).toBe(true)
}

describe('LivingRibbonSimulation', () => {
  it('configures and resets deterministically', () => {
    const first = configured()
    const second = configured()
    expect(snapshot(first)).toEqual(snapshot(second))

    run(first, 30)
    first.deterministicReset(STRUCTURAL.baseSeed)
    second.deterministicReset(STRUCTURAL.baseSeed)
    expect(snapshot(first)).toEqual(snapshot(second))
  })

  it('produces identical states for identical seeds and inputs', () => {
    const first = configured()
    const second = configured()
    first.radialImpact({ identity: 'impact-a', strength: 1.2 })
    second.radialImpact({ identity: 'impact-a', strength: 1.2 })
    run(first, 180)
    run(second, 180)
    expect(snapshot(first)).toEqual(snapshot(second))
  })

  it('produces different states for different seeds', () => {
    const first = configured()
    const second = configured({ structural: { ...STRUCTURAL, baseSeed: STRUCTURAL.baseSeed + 1 } })
    expect(Array.from(first.getRenderView().positions)).not.toEqual(Array.from(second.getRenderView().positions))
  })

  it('uses a stable structural signature independent of object key order', () => {
    const reordered = {
      qualityTier: 'high' as const,
      boundarySize: 8,
      fieldScale: 0.45,
      initializationMode: 'wave' as const,
      baseSeed: 4815,
      totalLength: 8,
      pointCount: 96,
    }
    expect(livingRibbonStructuralSignature(STRUCTURAL)).toBe(livingRibbonStructuralSignature(reordered))
  })

  it('rebuilds only for structural changes', () => {
    const simulation = configured()
    const before = simulation.getRenderView()
    const positions = before.positions
    const signature = before.structuralSignature
    const parameterOnly = simulation.configure({
      structural: STRUCTURAL,
      controls: { ...CONTROLS, turbulence: 0.9 },
    })
    expect(parameterOnly.rebuilt).toBe(false)
    expect(parameterOnly.parameterOnlyUpdate).toBe(true)
    expect(simulation.getRenderView().positions).toBe(positions)
    expect(simulation.getRenderView().structuralSignature).toBe(signature)

    const structural = simulation.configure({
      structural: { ...STRUCTURAL, pointCount: 112 },
      controls: CONTROLS,
    })
    expect(structural.rebuilt).toBe(true)
    expect(simulation.getRenderView().positions).not.toBe(positions)
  })

  it('keeps spring lengths and bend energy stable after shocks', () => {
    const simulation = configured({ controls: { ...CONTROLS, tension: 0.9, damping: 0.7 } })
    simulation.lateralShock({ identity: 'shock', strength: 2, direction: [0, 1, 0] })
    simulation.twistImpulse({ identity: 'twist', strength: 1.5, direction: [1, 0, 0] })
    run(simulation, 600)
    const view = simulation.getRenderView()
    let averageLengthError = 0
    let averageBend = 0
    for (let index = 0; index < view.activePointCount - 1; index += 1) {
      const offset = index * 3
      const next = offset + 3
      const distance = Math.hypot(
        view.positions[next] - view.positions[offset],
        view.positions[next + 1] - view.positions[offset + 1],
        view.positions[next + 2] - view.positions[offset + 2],
      )
      averageLengthError += Math.abs(distance - view.restSpacing) / view.restSpacing
    }
    for (let index = 1; index < view.activePointCount - 1; index += 1) {
      const previous = (index - 1) * 3
      const offset = index * 3
      const next = (index + 1) * 3
      averageBend += Math.hypot(
        (view.positions[previous] + view.positions[next]) * 0.5 - view.positions[offset],
        (view.positions[previous + 1] + view.positions[next + 1]) * 0.5 - view.positions[offset + 1],
        (view.positions[previous + 2] + view.positions[next + 2]) * 0.5 - view.positions[offset + 2],
      )
    }
    averageLengthError /= Math.max(1, view.activePointCount - 1)
    averageBend /= Math.max(1, view.activePointCount - 2)
    expect(averageLengthError).toBeLessThan(0.35)
    expect(averageBend).toBeLessThan(view.restSpacing * 1.5)
  })

  it('bounds velocity and position under extreme clamped controls', () => {
    const simulation = configured({
      controls: {
        drive: 50,
        turbulence: 50,
        tension: 50,
        damping: -50,
        spread: 50,
        centerAttraction: 50,
        widthTarget: 50,
        twist: 50,
        radialPressure: 50,
        collapseAmount: 50,
        releaseAmount: 50,
        directionalDrift: 50,
        heatDecay: -50,
      },
    })
    simulation.releaseBurst({ identity: 'extreme-release', strength: 999 })
    simulation.twistImpulse({ identity: 'extreme-twist', strength: 999 })
    run(simulation, 300, 1 / 30)
    const view = simulation.getRenderView()
    expectFinite(view.positions)
    expectFinite(view.previousPositions)
    expectFinite(view.velocities)
    expectFinite(view.heat)
    expectFinite(view.widths)
    expect(maximumMagnitude(view.velocities)).toBeLessThanOrEqual(8.0001)
    expect(maximumMagnitude(view.positions)).toBeLessThanOrEqual(view.boundarySize + 0.001)
  })

  it('suppresses duplicate impulse identities and chooses deterministic directions', () => {
    const first = configured()
    const second = configured()
    expect(first.lateralShock({ identity: 'same', strength: 1 })).toBe(true)
    const once = Array.from(first.getRenderView().velocities)
    expect(first.lateralShock({ identity: 'same', strength: 1 })).toBe(false)
    expect(Array.from(first.getRenderView().velocities)).toEqual(once)
    expect(second.lateralShock({ identity: 'same', strength: 1 })).toBe(true)
    expect(Array.from(second.getRenderView().velocities)).toEqual(once)
  })

  it('supports every bounded physical impulse API', () => {
    const simulation = configured()
    expect(simulation.radialImpact({ identity: 1, strength: 1 })).toBe(true)
    expect(simulation.lateralShock({ identity: 2, strength: 1 })).toBe(true)
    expect(simulation.fineRipple({ identity: 3, strength: 1 })).toBe(true)
    expect(simulation.collapseImpulse({ identity: 4, strength: 1 })).toBe(true)
    expect(simulation.releaseBurst({ identity: 5, strength: 1 })).toBe(true)
    expect(simulation.twistImpulse({ identity: 6, strength: 1 })).toBe(true)
    expect(simulation.localizedImpulse({ identity: 7, strength: 1, location: 0.5, radius: 0.1 })).toBe(true)
    expectFinite(simulation.getRenderView().velocities)
  })

  it('pauses without advancing and resumes without a catch-up jump', () => {
    const simulation = configured()
    run(simulation, 30)
    simulation.pause()
    const paused = snapshot(simulation)
    expect(simulation.update({ deltaTimeSec: 30 })).toBe(0)
    expect(snapshot(simulation)).toEqual(paused)
    simulation.resume()
    expect(simulation.update({ deltaTimeSec: LIVING_RIBBON_FIXED_TIMESTEP_SEC })).toBe(1)
    expect(simulation.getRenderView().simulationTimeSec - paused.time).toBeCloseTo(LIVING_RIBBON_FIXED_TIMESTEP_SEC, 8)
  })

  it('synchronizes timing discontinuities, seeks, and loop wraps without runaway catch-up', () => {
    const simulation = configured()
    run(simulation, 10)
    const held = Array.from(simulation.getRenderView().positions)
    simulation.synchronizeTiming(8, 'discontinuity-1')
    expect(Array.from(simulation.getRenderView().previousPositions)).toEqual(held)
    expect(simulation.update({ deltaTimeSec: 30 })).toBe(8)

    simulation.seek(2, 'seek-1')
    const afterSeek = Array.from(simulation.getRenderView().positions)
    simulation.loopWrap(0, 'loop-1')
    simulation.loopWrap(0, 'loop-1')
    expect(Array.from(simulation.getRenderView().positions)).toEqual(afterSeek)
    expect(simulation.update({ deltaTimeSec: LIVING_RIBBON_FIXED_TIMESTEP_SEC })).toBe(1)
  })

  it('rebuilds deterministically on track replacement and clears incompatible impulse state', () => {
    const simulation = configured()
    simulation.radialImpact({ identity: 'reusable', strength: 1 })
    run(simulation, 20)
    simulation.replaceTrack(STRUCTURAL.baseSeed, 'track-b')
    const replaced = snapshot(simulation)
    const fresh = configured()
    expect(replaced.positions).toEqual(snapshot(fresh).positions)
    expect(simulation.radialImpact({ identity: 'reusable', strength: 1 })).toBe(true)
  })

  it('provides a bounded warm start', () => {
    const simulation = configured()
    expect(simulation.warmStart(10, 12)).toBe(12)
    expect(simulation.getRenderView().simulationTimeSec).toBeCloseTo(12 * LIVING_RIBBON_FIXED_TIMESTEP_SEC, 8)
  })

  it('applies quality and runtime-mode point-count limits', () => {
    const low = configured({ structural: { ...STRUCTURAL, pointCount: 10_000, qualityTier: 'low' } })
    const thumbnail = configured({ structural: { ...STRUCTURAL, pointCount: 10_000, qualityTier: 'high' }, mode: 'thumbnail' })
    const high = configured({ structural: { ...STRUCTURAL, pointCount: 10_000, qualityTier: 'high' } })
    expect(low.getRenderView().activePointCount).toBe(64)
    expect(thumbnail.getRenderView().activePointCount).toBe(64)
    expect(high.getRenderView().activePointCount).toBe(256)
  })

  it('keeps renderer instances isolated and releases lifecycle resources', () => {
    const first = configured()
    const second = configured()
    first.radialImpact({ identity: 'first-only', strength: 1 })
    expect(Array.from(first.getRenderView().velocities)).not.toEqual(Array.from(second.getRenderView().velocities))
    first.dispose()
    expect(first.getRenderView().activePointCount).toBe(0)
    expect(first.getRenderView().positions).toHaveLength(0)
    expect(second.getRenderView().activePointCount).toBe(96)
  })
})
