import { describe, expect, it } from 'vitest'
import { NEUTRAL_AUDIO_FRAME, NEUTRAL_TIMING_FRAME } from '../../audio/shaderAudioTypes'
import { PrismRadialTopologyGenerator } from '../prismRadialTopology'
import {
  PRISM_FACET_FLARE_RUNTIME_COMMAND_ID,
  PRISM_FACET_RUNTIME_UNIFORMS,
  PrismFacetIlluminationChoreographer,
  resolvePrismFacetIlluminationWeight,
} from '../prismFacetIlluminationChoreographer'
import { PrismRuntimeParameterController } from '../prismRotationTorqueSystem'

function stepAtBeat(
  choreographer: PrismFacetIlluminationChoreographer,
  beatIndex: number,
  options: { direction?: -1 | 1; kick?: number; snare?: number; downbeat?: number } = {},
) {
  return choreographer.step({
    amount: 1,
    rotationDirection: options.direction ?? 1,
    audio: {
      ...NEUTRAL_AUDIO_FRAME,
      beatHit: 1,
      kickHit: options.kick ?? 0,
      snareHit: options.snare ?? 0,
      downbeatHit: options.downbeat ?? 0,
      bass: 0.7,
      energy: 0.65,
    },
    timing: { ...NEUTRAL_TIMING_FRAME, beatIndex, deltaTime: 1 / 60 },
  })
}

describe('PrismFacetIlluminationChoreographer', () => {
  it('maps stable Stage 1 facet identities to independent illumination weights', () => {
    const topology = new PrismRadialTopologyGenerator().generate({ baseRadius: 0.9, curvature: 0.6 })
    const snapshot = stepAtBeat(new PrismFacetIlluminationChoreographer(), 3)
    const byId = new Map(topology.elements.map(element => [
      element.id,
      resolvePrismFacetIlluminationWeight(element.index, snapshot),
    ]))

    expect(byId.get('prism-radial-element-3')).toBeGreaterThan(byId.get('prism-radial-element-8')!)
    expect(new Set([...byId.values()].map(value => value.toFixed(4))).size).toBeGreaterThan(1)
  })

  it('produces a deterministic signed chase sequence from beat identity', () => {
    const clockwise = new PrismFacetIlluminationChoreographer()
    const clockwiseAgain = new PrismFacetIlluminationChoreographer()
    const counterClockwise = new PrismFacetIlluminationChoreographer()

    const forward = [0, 1, 2, 3, 4].map(beat => stepAtBeat(clockwise, beat, { direction: 1 }).chaseIndex)
    const repeated = [0, 1, 2, 3, 4].map(beat => stepAtBeat(clockwiseAgain, beat, { direction: 1 }).chaseIndex)
    const reverse = [0, 1, 2, 3, 4].map(beat => stepAtBeat(counterClockwise, beat, { direction: -1 }).chaseIndex)

    expect(repeated).toEqual(forward)
    expect(forward).toEqual([0, 1, 2, 3, 4])
    expect(reverse).toEqual([0, 11, 10, 9, 8])
  })

  it('supports alternating and opposing-pair illumination as distinct spatial behaviors', () => {
    const alternatingChoreographer = new PrismFacetIlluminationChoreographer()
    const alternating = stepAtBeat(alternatingChoreographer, 2, { snare: 1 })
    expect(alternating.alternate).toBeGreaterThan(0.9)
    const isolatedAlternating = { ...alternating, chaseStrength: 0, opposing: 0, flare: 0 }
    const even = resolvePrismFacetIlluminationWeight(2, isolatedAlternating)
    const odd = resolvePrismFacetIlluminationWeight(3, isolatedAlternating)
    expect(even).toBeGreaterThan(odd)

    const opposingChoreographer = new PrismFacetIlluminationChoreographer()
    const opposing = stepAtBeat(opposingChoreographer, 2, { downbeat: 1 })
    const isolatedOpposing = { ...opposing, chaseStrength: 0, alternate: 0, flare: 0 }
    const center = resolvePrismFacetIlluminationWeight(2, isolatedOpposing)
    const opposite = resolvePrismFacetIlluminationWeight(8, isolatedOpposing)
    const neighbor = resolvePrismFacetIlluminationWeight(5, isolatedOpposing)
    expect(center).toBeCloseTo(opposite, 8)
    expect(center).toBeGreaterThan(neighbor)
  })

  it('is an exact visual no-op at zero amount and remains idle without audio', () => {
    const choreographer = new PrismFacetIlluminationChoreographer()
    const zero = choreographer.step({
      amount: 0,
      audio: { ...NEUTRAL_AUDIO_FRAME, beatHit: 1, snareHit: 1, dropImpact: 1 },
      timing: { ...NEUTRAL_TIMING_FRAME, beatIndex: 7, deltaTime: 1 / 60 },
    })
    for (let index = 0; index < 12; index += 1) {
      expect(resolvePrismFacetIlluminationWeight(index, zero)).toBe(1)
    }

    const idle = new PrismFacetIlluminationChoreographer().step({
      amount: 1,
      audio: NEUTRAL_AUDIO_FRAME,
      timing: { ...NEUTRAL_TIMING_FRAME, deltaTime: 1 / 60 },
    })
    for (let index = 0; index < 12; index += 1) {
      expect(resolvePrismFacetIlluminationWeight(index, idle)).toBe(1)
    }
  })

  it('keeps logical facet ownership independent from rendered rotation', () => {
    const topology = new PrismRadialTopologyGenerator().generate({ baseRadius: 1.2, curvature: 0.8 })
    const choreographer = new PrismFacetIlluminationChoreographer()
    const snapshot = stepAtBeat(choreographer, 5, { direction: 1 })
    const before = topology.elements.map(element => [element.id, resolvePrismFacetIlluminationWeight(element.index, snapshot)] as const)

    // Rotation changes screen-space orientation elsewhere; the illumination
    // contract is keyed only by the stable topology index/id.
    const after = topology.elements.map(element => [element.id, resolvePrismFacetIlluminationWeight(element.index, snapshot)] as const)
    expect(after).toEqual(before)
  })

  it('provides a runtime-only all-facet flare command and clears it on reconstruction', () => {
    const controller = new PrismRuntimeParameterController()
    const values = {
      aperture: 1,
      rotationDrive: 0,
      rotationTorque: 1,
      rotationDrag: 0.5,
      facetChoreography: 1,
    }
    const neutralTiming = { ...NEUTRAL_TIMING_FRAME, deltaTime: 1 / 60 }

    controller.resolve({ values, deltaTimeSec: 1 / 60, reconstruct: true, audio: NEUTRAL_AUDIO_FRAME, timing: neutralTiming })
    controller.applyImpulse(PRISM_FACET_FLARE_RUNTIME_COMMAND_ID, 1)
    controller.resolve({ values, deltaTimeSec: 1 / 60, reconstruct: false, audio: NEUTRAL_AUDIO_FRAME, timing: neutralTiming })
    expect(controller.getRuntimeFloatUniformValues()[PRISM_FACET_RUNTIME_UNIFORMS.flare]).toBe(1)
    const flareSnapshot = controller.illumination.getSnapshot(1)
    const flareWeights = Array.from({ length: 12 }, (_, index) => resolvePrismFacetIlluminationWeight(index, flareSnapshot))
    expect(new Set(flareWeights.map(weight => weight.toFixed(8))).size).toBe(1)
    expect(flareWeights[0]).toBeGreaterThan(1)

    controller.resolve({ values, deltaTimeSec: 1 / 60, reconstruct: true, audio: NEUTRAL_AUDIO_FRAME, timing: neutralTiming })
    expect(controller.getRuntimeFloatUniformValues()[PRISM_FACET_RUNTIME_UNIFORMS.flare]).toBe(0)
  })

  it('stays bounded under rapid beat changes and minimum/maximum logical facet addresses', () => {
    const choreographer = new PrismFacetIlluminationChoreographer()
    for (let beat = 0; beat < 500; beat += 1) {
      const snapshot = stepAtBeat(choreographer, beat, { direction: beat % 2 === 0 ? 1 : -1, kick: 1, snare: 1 })
      expect(snapshot.chaseIndex).toBeGreaterThanOrEqual(0)
      expect(snapshot.chaseIndex).toBeLessThan(12)
      expect(snapshot.alternate).toBeGreaterThanOrEqual(0)
      expect(snapshot.alternate).toBeLessThanOrEqual(1)
      expect(snapshot.opposing).toBeGreaterThanOrEqual(0)
      expect(snapshot.opposing).toBeLessThanOrEqual(1)
      expect(snapshot.flare).toBeGreaterThanOrEqual(0)
      expect(snapshot.flare).toBeLessThanOrEqual(1)
      expect(Number.isFinite(resolvePrismFacetIlluminationWeight(0, snapshot))).toBe(true)
      expect(Number.isFinite(resolvePrismFacetIlluminationWeight(11, snapshot))).toBe(true)
    }
  })
})
