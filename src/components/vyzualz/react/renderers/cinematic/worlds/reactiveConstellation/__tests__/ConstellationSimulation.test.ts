import { describe, expect, it } from 'vitest'
import {
  REACTIVE_CONSTELLATION_DEFAULTS,
  type ReactiveConstellationSettings,
} from '../../../../../CinematicWorldSettings'
import {
  CONSTELLATION_FIXED_TIMESTEP_SEC,
  CONSTELLATION_MAX_SUBSTEPS,
  ConstellationSimulation,
} from '../ConstellationSimulation'

function settings(patch: Partial<ReactiveConstellationSettings> = {}): ReactiveConstellationSettings {
  return { ...REACTIVE_CONSTELLATION_DEFAULTS, ...patch }
}

function configured(
  patch: Partial<ReactiveConstellationSettings> = {},
  seed = 48001,
  nodeCount = 42,
): ConstellationSimulation {
  const simulation = new ConstellationSimulation()
  simulation.configure({ seed, nodeCount, settings: settings(patch) })
  return simulation
}

function runFrames(simulation: ConstellationSimulation, count: number, deltaTimeSec: number, impact = 0): void {
  for (let frame = 0; frame < count; frame += 1) {
    simulation.update({ deltaTimeSec, isPlaying: true, motionScale: 0.8, impact })
  }
}

function expectFinite(values: Float32Array): void {
  expect(Array.from(values).every(Number.isFinite)).toBe(true)
}

function averageRadius(values: Float32Array): number {
  let radius = 0
  for (let offset = 0; offset < values.length; offset += 3) {
    radius += Math.hypot(values[offset], values[offset + 1], values[offset + 2])
  }
  return radius / Math.max(1, values.length / 3)
}

describe('ConstellationSimulation', () => {
  it('initializes simulated nodes near the center while preserving full authored anchors', () => {
    const initialExpansion = 0.06
    const simulation = configured({
      initialExpansion,
      driftAmount: 0,
      turbulence: 0,
      orbitAmount: 0,
      centralGravity: 0,
    }, 4822, 24)
    const state = simulation.getState()

    expect(state.meanExpansionProgress).toBeCloseTo(initialExpansion, 6)
    expect(state.expansionElapsedSec).toBe(0)
    for (let index = 0; index < state.graph.nodes.length; index += 1) {
      const offset = index * 3
      const authored = state.graph.nodes[index].position
      expect(state.anchors[offset]).toBeCloseTo(authored.x, 6)
      expect(state.anchors[offset + 1]).toBeCloseTo(authored.y, 6)
      expect(state.anchors[offset + 2]).toBeCloseTo(authored.z, 6)
      expect(state.positions[offset]).toBeCloseTo(state.anchors[offset] * initialExpansion, 6)
      expect(state.positions[offset + 1]).toBeCloseTo(state.anchors[offset + 1] * initialExpansion, 6)
      expect(state.positions[offset + 2]).toBeCloseTo(state.anchors[offset + 2] * initialExpansion, 6)
    }
    expect(averageRadius(state.positions)).toBeLessThan(averageRadius(state.anchors) * 0.08)
  })

  it('expands outward toward the authored full-spread anchors', () => {
    const simulation = configured({
      initialExpansion: 0.05,
      expansionTarget: 1,
      radialStaggerSec: 0.12,
      driftAmount: 0,
      turbulence: 0,
      orbitAmount: 0,
      centralGravity: 0,
      collapseAmount: 0,
    })
    const initial = averageRadius(simulation.getState().positions)

    runFrames(simulation, 60, 1 / 60)
    const expanded = simulation.getState()

    expect(expanded.meanExpansionProgress).toBeGreaterThan(0.95)
    expect(averageRadius(expanded.positions)).toBeGreaterThan(initial * 8)
    expect(averageRadius(expanded.positions)).toBeLessThan(averageRadius(expanded.anchors) * 1.3)
  })

  it('compresses toward a live build target and launches from that compressed state on drop entry', () => {
    const simulation = configured({
      initialExpansion: 0.1,
      expansionTarget: 1.08,
      expansionAttackSec: 0.22,
      expansionReleaseSec: 0.5,
      expansionSpringStrength: 1.6,
      expansionDamping: 0.34,
      expansionOvershoot: 0.5,
      radialStaggerSec: 0,
      expansionBurstImpulse: 0,
      driftAmount: 0,
      turbulence: 0,
      orbitAmount: 0,
      centralGravity: 0,
      collapseAmount: 0,
    }, 49001, 26)

    for (let frame = 0; frame < 120; frame += 1) {
      simulation.update({ deltaTimeSec: 1 / 60, isPlaying: true, motionScale: 0, expansionTarget: 1.08 })
    }
    const open = simulation.getState().meanExpansionProgress

    for (let frame = 0; frame < 90; frame += 1) {
      simulation.update({ deltaTimeSec: 1 / 60, isPlaying: true, motionScale: 0, expansionTarget: 0.16 })
    }
    const compressed = simulation.getState().meanExpansionProgress

    simulation.update({
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      motionScale: 0,
      expansionTarget: 1.08,
      radialBurstImpulse: 1.9,
      burstSequence: 1,
    })
    const launchVelocity = simulation.getState().meanExpansionVelocity
    for (let frame = 0; frame < 24; frame += 1) {
      simulation.update({ deltaTimeSec: 1 / 60, isPlaying: true, motionScale: 0, expansionTarget: 1.08 })
    }
    const launched = simulation.getState()

    expect(open).toBeGreaterThan(0.95)
    expect(compressed).toBeLessThan(0.28)
    expect(launched.meanExpansionProgress).toBeGreaterThan(compressed + 0.5)
    expect(launched.lastBurstSequence).toBe(1)
    expect(launchVelocity).toBeGreaterThan(0)
  })

  it('supports bounded radial overshoot and settles elastically at the target', () => {
    const simulation = configured({
      initialExpansion: 0.05,
      expansionTarget: 1,
      expansionAttackSec: 0.25,
      expansionReleaseSec: 0.4,
      expansionSpringStrength: 2,
      expansionDamping: 0.05,
      expansionOvershoot: 0.4,
      radialStaggerSec: 0,
      expansionBurstImpulse: 1.2,
      driftAmount: 0,
      turbulence: 0,
      orbitAmount: 0,
      centralGravity: 0,
      collapseAmount: 0,
    })
    let maximumProgress = simulation.getState().meanExpansionProgress

    for (let frame = 0; frame < 360; frame += 1) {
      simulation.update({ deltaTimeSec: 1 / 60, isPlaying: true, motionScale: 0, impact: 0 })
      maximumProgress = Math.max(maximumProgress, simulation.getState().meanExpansionProgress)
    }
    const settled = simulation.getState()

    expect(maximumProgress).toBeGreaterThan(1.02)
    expect(maximumProgress).toBeLessThanOrEqual(1.4)
    expect(settled.meanExpansionProgress).toBeCloseTo(1, 4)
    expect(settled.meanExpansionVelocity).toBeCloseTo(0, 4)
  })

  it('uses deterministic seeded radial staggering that survives resets', () => {
    const first = configured({
      initialExpansion: 0.06,
      radialStaggerSec: 0.6,
      expansionBurstImpulse: 0.2,
      driftAmount: 0,
      turbulence: 0,
      orbitAmount: 0,
      centralGravity: 0,
    }, 8112, 36)
    const second = configured({
      initialExpansion: 0.06,
      radialStaggerSec: 0.6,
      expansionBurstImpulse: 0.2,
      driftAmount: 0,
      turbulence: 0,
      orbitAmount: 0,
      centralGravity: 0,
    }, 8112, 36)
    const otherSeed = configured({ radialStaggerSec: 0.6 }, 8113, 36)
    const originalStagger = Array.from(first.getState().radialStagger)

    expect(Array.from(second.getState().radialStagger)).toEqual(originalStagger)
    expect(Array.from(otherSeed.getState().radialStagger)).not.toEqual(originalStagger)
    runFrames(first, 6, 1 / 60)
    runFrames(second, 6, 1 / 60)
    const launched = Array.from(first.getState().expansionProgress)
      .filter(value => value > 0.0601).length
    expect(launched).toBeGreaterThan(0)
    expect(launched).toBeLessThan(first.getState().graph.nodes.length)
    expect(Array.from(first.getState().expansionProgress)).toEqual(Array.from(second.getState().expansionProgress))

    first.resetExpansion()
    expect(Array.from(first.getState().radialStagger)).toEqual(originalStagger)
    expect(Array.from(first.getState().expansionProgress).every(value => Math.abs(value - 0.06) < 0.00001)).toBe(true)
  })

  it('applies each sequenced radial burst exactly once', () => {
    const simulation = configured({ radialStaggerSec: 1, expansionBurstImpulse: 0 })

    expect(simulation.update({
      deltaTimeSec: 0,
      isPlaying: true,
      burstImpulse: 1.2,
      burstSequence: 7,
    })).toBe(0)
    const firstImpulse = Array.from(simulation.getState().velocities)
    const firstExpansionImpulse = Array.from(simulation.getState().expansionVelocity)
    expect(simulation.getState().lastBurstSequence).toBe(7)
    simulation.update({ deltaTimeSec: 0, isPlaying: true, burstImpulse: 1.2, burstSequence: 7 })
    expect(Array.from(simulation.getState().velocities)).toEqual(firstImpulse)
    expect(Array.from(simulation.getState().expansionVelocity)).toEqual(firstExpansionImpulse)
    simulation.update({ deltaTimeSec: 0, isPlaying: true, burstImpulse: 1.2, burstSequence: 8 })
    expect(Array.from(simulation.getState().velocities)).not.toEqual(firstImpulse)
    expect(simulation.getState().lastBurstSequence).toBe(8)
  })

  it('restores the deterministic compressed expansion state on reset', () => {
    const simulation = configured({ initialExpansion: 0.09, radialStaggerSec: 0.5 }, 9217, 30)
    const stagger = Array.from(simulation.getState().radialStagger)
    simulation.applyRadialBurst(1, 4)
    runFrames(simulation, 90, 1 / 60, 0.5)
    expect(simulation.getState().meanExpansionProgress).toBeGreaterThan(0.5)

    simulation.resetExpansion()
    const reset = simulation.getState()
    expect(reset.simulationTimeSec).toBe(0)
    expect(reset.expansionElapsedSec).toBe(0)
    expect(reset.lastBurstSequence).toBeNull()
    expect(reset.meanExpansionProgress).toBeCloseTo(0.09, 6)
    expect(reset.meanExpansionVelocity).toBe(0)
    expect(Array.from(reset.radialStagger)).toEqual(stagger)
    expect(Array.from(reset.velocities).every(value => value === 0)).toBe(true)
    for (let offset = 0; offset < reset.positions.length; offset += 1) {
      expect(reset.positions[offset]).toBeCloseTo(reset.anchors[offset] * 0.09, 6)
    }
  })

  it('uses deterministic fixed steps independent of render-frame grouping', () => {
    const singleSteps = configured()
    const doubleSteps = configured()

    runFrames(singleSteps, 120, CONSTELLATION_FIXED_TIMESTEP_SEC)
    runFrames(doubleSteps, 60, CONSTELLATION_FIXED_TIMESTEP_SEC * 2)

    expect(singleSteps.getState().simulationTimeSec).toBeCloseTo(1, 8)
    expect(doubleSteps.getState().simulationTimeSec).toBeCloseTo(1, 8)
    expect(Array.from(singleSteps.getState().positions)).toEqual(Array.from(doubleSteps.getState().positions))
    expect(Array.from(singleSteps.getState().velocities)).toEqual(Array.from(doubleSteps.getState().velocities))
    expect(Array.from(singleSteps.getState().expansionProgress)).toEqual(Array.from(doubleSteps.getState().expansionProgress))
    expect(Array.from(singleSteps.getState().expansionVelocity)).toEqual(Array.from(doubleSteps.getState().expansionVelocity))
  })

  it('remains frame-rate independent within tolerance for common render rates', () => {
    const at60Hz = configured({ driftAmount: 0.2, turbulence: 0.1, orbitAmount: 0.1 }, 789)
    const at144Hz = configured({ driftAmount: 0.2, turbulence: 0.1, orbitAmount: 0.1 }, 789)

    runFrames(at60Hz, 120, 1 / 60, 0.1)
    runFrames(at144Hz, 288, 1 / 144, 0.1)
    const first = at60Hz.getState()
    const second = at144Hz.getState()

    expect(Math.abs(first.simulationTimeSec - second.simulationTimeSec)).toBeLessThanOrEqual(CONSTELLATION_FIXED_TIMESTEP_SEC + 0.000001)
    expect(first.meanExpansionProgress).toBeCloseTo(second.meanExpansionProgress, 5)
    let maximumPositionDelta = 0
    for (let index = 0; index < first.positions.length; index += 1) {
      maximumPositionDelta = Math.max(maximumPositionDelta, Math.abs(first.positions[index] - second.positions[index]))
    }
    expect(maximumPositionDelta).toBeLessThan(0.002)
  })

  it('bounds catch-up work and ignores suspension-sized deltas without explosive recovery', () => {
    const simulation = configured()
    const steps = simulation.update({ deltaTimeSec: 30, isPlaying: true, motionScale: 1, impact: 2 })

    expect(steps).toBe(CONSTELLATION_MAX_SUBSTEPS)
    expect(simulation.getState().simulationTimeSec).toBeCloseTo(
      CONSTELLATION_FIXED_TIMESTEP_SEC * CONSTELLATION_MAX_SUBSTEPS,
      8,
    )
    expectFinite(simulation.getState().positions)

    const held = Array.from(simulation.getState().positions)
    expect(simulation.update({
      deltaTimeSec: 30,
      isPlaying: true,
      timingDiscontinuity: true,
      motionScale: 1,
      impact: 2,
    })).toBe(0)
    expect(Array.from(simulation.getState().positions)).toEqual(held)
    expect(simulation.update({
      deltaTimeSec: CONSTELLATION_FIXED_TIMESTEP_SEC,
      isPlaying: true,
      motionScale: 1,
      impact: 0,
    })).toBe(1)
  })

  it('holds the exact physical frame while transport is paused', () => {
    const simulation = configured({ driftAmount: 0.8, turbulence: 0.7, orbitAmount: 0.6 })
    runFrames(simulation, 30, 1 / 60, 0.4)
    const before = simulation.getState()
    const snapshot = {
      positions: Array.from(before.positions),
      previousPositions: Array.from(before.previousPositions),
      velocities: Array.from(before.velocities),
      rotations: Array.from(before.rotations),
      scales: Array.from(before.scaleVariations),
      time: before.simulationTimeSec,
      randomState: before.randomState,
      interpolationAlpha: before.interpolationAlpha,
    }

    for (let frame = 0; frame < 120; frame += 1) {
      expect(simulation.update({ deltaTimeSec: 1, isPlaying: false, motionScale: 2, impact: 2 })).toBe(0)
    }
    const after = simulation.getState()
    expect(Array.from(after.positions)).toEqual(snapshot.positions)
    expect(Array.from(after.previousPositions)).toEqual(snapshot.previousPositions)
    expect(Array.from(after.velocities)).toEqual(snapshot.velocities)
    expect(Array.from(after.rotations)).toEqual(snapshot.rotations)
    expect(Array.from(after.scaleVariations)).toEqual(snapshot.scales)
    expect(after.simulationTimeSec).toBe(snapshot.time)
    expect(after.randomState).toBe(snapshot.randomState)
    expect(after.interpolationAlpha).toBe(snapshot.interpolationAlpha)
  })

  it('keeps every value finite and displacement bounded under extreme live settings', () => {
    const simulation = configured({
      networkSpread: 2.4,
      nodeScale: 0.28,
      springStrength: 2,
      damping: 0,
      driftAmount: 1.5,
      turbulence: 1.5,
      orbitAmount: 1.5,
      elasticity: 1,
      topologyStability: 0,
      centralGravity: 1,
      collapseAmount: 1.5,
      burstStrength: 2.5,
    }, 9981, 64)

    simulation.applyRadialBurst(4)
    runFrames(simulation, 240, 1 / 30, 2)
    simulation.applyCollapseImpulse(4)
    runFrames(simulation, 120, 1 / 30, 1)

    const state = simulation.getState()
    for (const values of [
      state.positions,
      state.previousPositions,
      state.anchors,
      state.velocities,
      state.rotations,
      state.angularVelocities,
      state.scaleVariations,
      state.expansionProgress,
      state.expansionVelocity,
      state.radialStagger,
    ]) expectFinite(values)

    const maximumDisplacement = 0.55 + 2.4
    for (let index = 0; index < state.graph.nodes.length; index += 1) {
      const offset = index * 3
      const displacement = Math.hypot(
        state.positions[offset] - state.anchors[offset],
        state.positions[offset + 1] - state.anchors[offset + 1],
        state.positions[offset + 2] - state.anchors[offset + 2],
      )
      expect(displacement).toBeLessThanOrEqual(maximumDisplacement + 0.001)
    }
  })

  it('applies deterministic bounded musical runtime targets without rebuilding the graph', () => {
    const first = configured()
    const second = configured()
    const firstGraph = first.getState().graph
    const runtime = {
      deltaTimeSec: 1 / 60,
      isPlaying: true,
      motionScale: 1.2,
      networkSpreadScale: 1.65,
      nodeScaleMultiplier: 1.4,
      nodeSpinOffset: 0.6,
      springTension: 1.4,
      collapseForce: 0.35,
      burstImpulse: 0.8,
      topologyMorph: 0.55,
    }

    for (let frame = 0; frame < 120; frame += 1) {
      first.update(runtime)
      second.update(runtime)
    }

    expect(first.getState().graph).toBe(firstGraph)
    expect(Array.from(first.getState().positions)).toEqual(Array.from(second.getState().positions))
    expect(Array.from(first.getState().scaleVariations)).toEqual(Array.from(second.getState().scaleVariations))
    expectFinite(first.getState().positions)
    expectFinite(first.getState().rotations)
    expectFinite(first.getState().scaleVariations)
  })

  it('rebuilds structural edits but applies motion settings live without discarding state', () => {
    const simulation = configured()
    runFrames(simulation, 20, 1 / 60)
    const initial = simulation.getState()
    const initialRevision = initial.structureRevision
    const positions = initial.positions

    const live = simulation.configure({
      seed: 48001,
      nodeCount: 42,
      settings: settings({ driftAmount: 1.1, damping: 0.2, springStrength: 1.4 }),
    })
    expect(live.rebuilt).toBe(false)
    expect(live.structureRevision).toBe(initialRevision)
    expect(simulation.getState().positions).toBe(positions)

    const structuralChanges = [
      { seed: 48002, nodeCount: 42, settings: settings() },
      { seed: 48002, nodeCount: 48, settings: settings() },
      { seed: 48002, nodeCount: 48, settings: settings({ topologyStyle: 'ring' }) },
      { seed: 48002, nodeCount: 48, settings: settings({ topologyStyle: 'ring', neighborCount: 6 }) },
    ]
    let previousRevision = initialRevision
    for (const change of structuralChanges) {
      const result = simulation.configure(change)
      expect(result.rebuilt).toBe(true)
      expect(result.structureRevision).toBeGreaterThan(previousRevision)
      previousRevision = result.structureRevision
    }
  })

  it('restarts from the compressed core when a quality-tier node budget rebuilds the graph', () => {
    const initialExpansion = 0.07
    const simulation = configured({ initialExpansion }, 48001, 64)
    runFrames(simulation, 90, 1 / 60)
    expect(simulation.getState().meanExpansionProgress).toBeGreaterThan(0.9)

    const rebuilt = simulation.configure({
      seed: 48001,
      nodeCount: 24,
      settings: settings({ initialExpansion }),
    })
    const state = simulation.getState()

    expect(rebuilt.rebuilt).toBe(true)
    expect(state.graph.nodes).toHaveLength(24)
    expect(state.meanExpansionProgress).toBeCloseTo(initialExpansion, 6)
    for (let offset = 0; offset < state.positions.length; offset += 1) {
      expect(state.positions[offset]).toBeCloseTo(state.anchors[offset] * initialExpansion, 6)
    }
  })

  it('supports deterministic burst, collapse, freeze, reset, and reseed commands', () => {
    const first = configured({ driftAmount: 0.4, turbulence: 0.3 })
    const second = configured({ driftAmount: 0.4, turbulence: 0.3 })

    first.applyRadialBurst(1.2)
    expect(Array.from(first.getState().velocities).some(value => Math.abs(value) > 0)).toBe(true)
    first.resetToAnchors()
    first.applyCollapseImpulse(0.8)
    const collapseState = first.getState()
    const radialVelocity = collapseState.positions.reduce((sum, position, index) => (
      sum + position * collapseState.velocities[index]
    ), 0)
    expect(radialVelocity).toBeLessThan(0)

    first.freeze()
    const frozen = Array.from(first.getState().positions)
    runFrames(first, 20, 1 / 60, 1)
    expect(Array.from(first.getState().positions)).toEqual(frozen)
    first.unfreeze()
    runFrames(first, 1, 1 / 60, 0)
    expect(Array.from(first.getState().positions)).not.toEqual(frozen)

    first.resetToAnchors()
    second.resetToAnchors()
    runFrames(first, 60, 1 / 60, 0.2)
    runFrames(second, 60, 1 / 60, 0.2)
    expect(Array.from(first.getState().positions)).toEqual(Array.from(second.getState().positions))

    const firstSeed = first.reseed()
    const secondSeed = second.reseed()
    expect(firstSeed).toBe(secondSeed)
    expect(Array.from(first.getState().positions)).toEqual(Array.from(second.getState().positions))
    expect(first.reseed(777)).toBe(777)
    expect(second.reseed(777)).toBe(777)
    expect(Array.from(first.getState().positions)).toEqual(Array.from(second.getState().positions))
  })

  it('preserves graph rest lengths and keeps spring strain bounded after impulses', () => {
    const simulation = configured({
      topologyStyle: 'triangulated',
      springStrength: 1.5,
      topologyStability: 0.8,
      damping: 0.55,
      elasticity: 0.7,
    }, 6151, 56)
    const initial = simulation.getState()
    for (const edge of initial.graph.edges) {
      const a = edge.a * 3
      const b = edge.b * 3
      expect(Math.hypot(
        initial.anchors[b] - initial.anchors[a],
        initial.anchors[b + 1] - initial.anchors[a + 1],
        initial.anchors[b + 2] - initial.anchors[a + 2],
      )).toBeCloseTo(edge.distance, 5)
    }

    simulation.applyRadialBurst(1.6)
    runFrames(simulation, 360, 1 / 60)
    const settled = simulation.getState()
    const averageStrain = settled.graph.edges.reduce((sum, edge) => {
      const a = edge.a * 3
      const b = edge.b * 3
      const distance = Math.hypot(
        settled.positions[b] - settled.positions[a],
        settled.positions[b + 1] - settled.positions[a + 1],
        settled.positions[b + 2] - settled.positions[a + 2],
      )
      return sum + Math.abs(distance - edge.distance) / edge.distance
    }, 0) / settled.graph.edges.length
    expect(averageStrain).toBeLessThan(0.35)
  })

  it('reuses all transient buffers during repeated non-structural updates', () => {
    const simulation = configured({ topologyStyle: 'branching' }, 1234, 48)
    const before = simulation.getState()
    const references = {
      state: before,
      graph: before.graph,
      positions: before.positions,
      previousPositions: before.previousPositions,
      anchors: before.anchors,
      velocities: before.velocities,
      rotations: before.rotations,
      angularVelocities: before.angularVelocities,
      scaleVariations: before.scaleVariations,
      expansionProgress: before.expansionProgress,
      expansionVelocity: before.expansionVelocity,
      radialStagger: before.radialStagger,
    }

    runFrames(simulation, 240, 1 / 60, 0.35)
    const after = simulation.getState()
    expect(after).toBe(references.state)
    expect(after.graph).toBe(references.graph)
    expect(after.positions).toBe(references.positions)
    expect(after.previousPositions).toBe(references.previousPositions)
    expect(after.anchors).toBe(references.anchors)
    expect(after.velocities).toBe(references.velocities)
    expect(after.rotations).toBe(references.rotations)
    expect(after.angularVelocities).toBe(references.angularVelocities)
    expect(after.scaleVariations).toBe(references.scaleVariations)
    expect(after.expansionProgress).toBe(references.expansionProgress)
    expect(after.expansionVelocity).toBe(references.expansionVelocity)
    expect(after.radialStagger).toBe(references.radialStagger)
  })
})
