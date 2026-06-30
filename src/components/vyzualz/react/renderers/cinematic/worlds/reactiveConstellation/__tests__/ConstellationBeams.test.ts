import { describe, expect, it } from 'vitest'
import {
  CONSTELLATION_BEAM_INSTANCE_FLOATS,
  writeConstellationBeamInstance,
} from '../ConstellationBeamGeometry'
import {
  CONSTELLATION_QUALITY_BUDGETS,
  clampConstellationEdgeCount,
  clampConstellationNodeCount,
  clampConstellationTrailSamples,
  constellationQualityBudget,
} from '../ConstellationQuality'
import {
  REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE,
} from '../ConstellationShaders'

describe('Reactive Constellation beam safety and quality', () => {
  it('clamps node, edge, trail, history, and glow budgets by quality tier', () => {
    const tiers = ['low', 'medium', 'high', 'ultra'] as const
    const nodeCaps = tiers.map(tier => constellationQualityBudget(tier).nodeCountCap)
    const edgeCaps = tiers.map(tier => constellationQualityBudget(tier).edgeCountCap)
    const trailCaps = tiers.map(tier => constellationQualityBudget(tier).trailSampleCap)
    expect(nodeCaps).toEqual([...nodeCaps].sort((a, b) => a - b))
    expect(edgeCaps).toEqual([...edgeCaps].sort((a, b) => a - b))
    expect(trailCaps).toEqual([...trailCaps].sort((a, b) => a - b))
    expect(clampConstellationNodeCount(999, CONSTELLATION_QUALITY_BUDGETS.low)).toBe(28)
    expect(clampConstellationEdgeCount(999, CONSTELLATION_QUALITY_BUDGETS.medium)).toBe(112)
    expect(clampConstellationTrailSamples(999, CONSTELLATION_QUALITY_BUDGETS.high)).toBe(16)
    expect(CONSTELLATION_QUALITY_BUDGETS.low.historicalDrawCount).toBeGreaterThan(0)
    expect(CONSTELLATION_QUALITY_BUDGETS.low.glowPassComplexity).toBeGreaterThan(0)
    expect(CONSTELLATION_QUALITY_BUDGETS.auto.nodeCountCap).toBeLessThan(CONSTELLATION_QUALITY_BUDGETS.ultra.nodeCountCap)
    expect(CONSTELLATION_QUALITY_BUDGETS.auto.historicalDrawCount).toBeLessThan(CONSTELLATION_QUALITY_BUDGETS.ultra.historicalDrawCount)
  })

  it('rejects zero-length and non-finite edges without poisoning the instance buffer', () => {
    const target = new Float32Array(CONSTELLATION_BEAM_INSTANCE_FLOATS).fill(7)
    const current = new Float32Array([1, 2, 3, 1, 2, 3])
    expect(writeConstellationBeamInstance(target, 0, current, 0, current, 0, 1, 1, 1, 0.5, 0)).toBe(false)
    expect(Array.from(target)).toEqual(new Array(CONSTELLATION_BEAM_INSTANCE_FLOATS).fill(7))

    const invalid = new Float32Array([0, 0, 0, Number.NaN, 1, 1])
    expect(writeConstellationBeamInstance(target, 0, invalid, 0, invalid, 0, 1, 1, 1, 0.5, 0)).toBe(false)
  })

  it('writes finite fan-expanded endpoints and bounded visual attributes', () => {
    const target = new Float32Array(CONSTELLATION_BEAM_INSTANCE_FLOATS)
    const current = new Float32Array([0, 0, 0, 1, 0, 0])
    const history = new Float32Array([0, 1, 0, 1, 1, 0])
    expect(writeConstellationBeamInstance(target, 0, history, 0, current, 0, 1.5, 2, 8, -2, 4)).toBe(true)
    expect(Array.from(target).every(Number.isFinite)).toBe(true)
    expect(target[1]).toBeCloseTo(1.5)
    expect(target[4]).toBeCloseTo(1.5)
    expect(target[6]).toBe(1)
    expect(target[7]).toBe(4)
    expect(target[8]).toBe(0)
    expect(target[9]).toBe(1)
  })

  it('clips ribbons against the near plane and guards projected degeneracy in the vertex shader', () => {
    expect(REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE).toContain('clipA.z + clipA.w')
    expect(REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE).toContain('projectedLength < 0.001')
    expect(REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE).toContain('uViewport')
    expect(REACTIVE_CONSTELLATION_BEAM_VERTEX_SOURCE).toContain('uBeamWidthPx')
  })
})
