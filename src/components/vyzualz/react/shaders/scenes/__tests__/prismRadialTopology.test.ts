import { describe, expect, it } from 'vitest'
import {
  PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT,
  PRISM_RADIAL_TOPOLOGY_GLSL,
  PRISM_RADIAL_TOPOLOGY_LIMITS,
  PrismRadialTopologyGenerator,
} from '../prismRadialTopology'

function snapshot(generator: PrismRadialTopologyGenerator, baseRadius: number, curvature: number) {
  const topology = generator.generate({ baseRadius, curvature })
  return {
    elementCount: topology.elementCount,
    baseRadius: topology.baseRadius,
    curvature: topology.curvature,
    elements: topology.elements.map(element => ({ ...element })),
  }
}

describe('PrismRadialTopologyGenerator', () => {
  it('generates deterministic topology from stable settings', () => {
    const first = snapshot(new PrismRadialTopologyGenerator(), 0.9, 0.6)
    const second = snapshot(new PrismRadialTopologyGenerator(), 0.9, 0.6)

    expect(second).toEqual(first)
    expect(first.elementCount).toBe(PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT)
  })

  it('keeps element identity and ordering stable across topology changes', () => {
    const generator = new PrismRadialTopologyGenerator()
    const before = snapshot(generator, 0.9, 0.6)
    const after = snapshot(generator, 1.4, 1.2)

    expect(after.elements.map(element => element.id)).toEqual(before.elements.map(element => element.id))
    expect(after.elements.map(element => element.index)).toEqual(before.elements.map(element => element.index))
    expect(after.elements.map(element => element.oppositeIndex)).toEqual(before.elements.map(element => element.oppositeIndex))
    expect(after.elements.every((element, index) => element.id === `prism-radial-element-${index}`)).toBe(true)
  })

  it('bounds topology inputs using the same limits authored by the Prism controls', () => {
    const generator = new PrismRadialTopologyGenerator()
    const minimum = snapshot(generator, -100, -100)
    const maximum = snapshot(generator, 100, 100)

    expect(minimum.baseRadius).toBe(PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.min)
    expect(minimum.curvature).toBe(PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.min)
    expect(maximum.baseRadius).toBe(PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.max)
    expect(maximum.curvature).toBe(PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.max)
  })

  it('publishes the stable element-count contract into the production GLSL topology helper', () => {
    expect(PRISM_RADIAL_TOPOLOGY_GLSL).toContain(`#define PRISM_TOPOLOGY_ELEMENT_COUNT ${PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT}`)
    expect(PRISM_RADIAL_TOPOLOGY_GLSL).toContain('PrismRadialElement prismTopologyAt')
  })
})
