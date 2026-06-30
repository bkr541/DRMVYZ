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

describe('ConstellationSimulation', () => {
  it('uses deterministic fixed steps independent of render-frame grouping', () => {
    const singleSteps = configured()
    const doubleSteps = configured()

    runFrames(singleSteps, 120, CONSTELLATION_FIXED_TIMESTEP_SEC)
    runFrames(doubleSteps, 60, CONSTELLATION_FIXED_TIMESTEP_SEC * 2)

    expect(singleSteps.getState().simulationTimeSec).toBeCloseTo(1, 8)
    expect(doubleSteps.getState().simulationTimeSec).toBeCloseTo(1, 8)
    expect(Array.from(singleSteps.getState().positions)).toEqual(Array.from(doubleSteps.getState().positions))
    expect(Array.from(singleSteps.getState().velocities)).toEqual(Array.from(doubleSteps.getState().velocities))
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
  })
})
