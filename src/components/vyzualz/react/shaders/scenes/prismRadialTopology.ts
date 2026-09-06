/**
 * Prism Tunnel's canonical radial-structure contract.
 *
 * The preset keeps its legacy persisted parameter ids, but its visible structure
 * is a center-anchored radial field. This module owns the stable element identity
 * and the matching GLSL topology helper used by the production shader.
 */

export const PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT = 12 as const

export const PRISM_RADIAL_TOPOLOGY_LIMITS = Object.freeze({
  baseRadius: Object.freeze({ min: 0.3, max: 2.0, default: 0.9 }),
  curvature: Object.freeze({ min: 0.0, max: 2.0, default: 0.6 }),
})

export interface PrismRadialTopologySettings {
  baseRadius: number
  curvature: number
}

export interface PrismRadialTopologyElement {
  readonly id: string
  readonly index: number
  readonly oppositeIndex: number
  readonly groupIndex: number
  angle: number
  normalizedAngle: number
  baseRadius: number
  innerRadius: number
  outerRadius: number
  curvature: number
  variation: number
}

export interface PrismRadialTopology {
  readonly elementCount: typeof PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT
  baseRadius: number
  curvature: number
  readonly elements: readonly PrismRadialTopologyElement[]
}

/**
 * Reusable CPU descriptor generator for later Prism mini-systems that need to
 * address facets without allocating a new object graph every frame.
 */
export class PrismRadialTopologyGenerator {
  private readonly mutableElements: PrismRadialTopologyElement[]
  private readonly topology: PrismRadialTopology

  constructor() {
    const count = PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT
    this.mutableElements = Array.from({ length: count }, (_, index) => ({
      id: `prism-radial-element-${index}`,
      index,
      oppositeIndex: (index + count / 2) % count,
      groupIndex: index % 2,
      angle: 0,
      normalizedAngle: 0,
      baseRadius: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.default,
      innerRadius: 0,
      outerRadius: 0,
      curvature: 0,
      variation: 0,
    }))
    this.topology = {
      elementCount: count,
      baseRadius: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.default,
      curvature: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.default,
      elements: this.mutableElements,
    }
    this.generate({
      baseRadius: PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.default,
      curvature: PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.default,
    })
  }

  generate(settings: PrismRadialTopologySettings): Readonly<PrismRadialTopology> {
    const baseRadius = clamp(
      settings.baseRadius,
      PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.min,
      PRISM_RADIAL_TOPOLOGY_LIMITS.baseRadius.max,
    )
    const curvature = clamp(
      settings.curvature,
      PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.min,
      PRISM_RADIAL_TOPOLOGY_LIMITS.curvature.max,
    )
    const count = PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT
    const sectorAngle = (Math.PI * 2) / count

    this.topology.baseRadius = baseRadius
    this.topology.curvature = curvature

    for (let index = 0; index < count; index += 1) {
      const element = this.mutableElements[index]
      const variation = prismElementVariation(index)
      element.angle = -Math.PI + (index + 0.5) * sectorAngle
      element.normalizedAngle = (index + 0.5) / count
      element.baseRadius = baseRadius
      element.innerRadius = baseRadius * (0.16 + variation * 0.01)
      element.outerRadius = baseRadius * (1.16 + variation * 0.06)
      element.curvature = variation * curvature
      element.variation = variation
    }

    return this.topology
  }
}

export function prismElementVariation(index: number): number {
  return fract(Math.sin((index + 1) * 12.9898) * 43758.5453) * 2 - 1
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * Shader-side form of the same topology contract. Element identity is derived
 * directly from polar sector index, so it stays stable across animation frames.
 */
export const PRISM_RADIAL_TOPOLOGY_GLSL = `
#define PRISM_TOPOLOGY_ELEMENT_COUNT ${PRISM_RADIAL_TOPOLOGY_ELEMENT_COUNT}
#define PRISM_TOPOLOGY_TAU 6.283185307179586
#define PRISM_TOPOLOGY_PI 3.141592653589793

struct PrismRadialElement {
  float index;
  float normalizedIndex;
  float angle;
  float localAngle;
  float oppositeIndex;
  float groupIndex;
  float variation;
  float curvature;
  float innerRadius;
  float outerRadius;
};

float prismElementVariation(float index) {
  return fract(sin((index + 1.0) * 12.9898) * 43758.5453) * 2.0 - 1.0;
}

PrismRadialElement prismTopologyAt(vec2 point, float baseRadius, float curvatureAmount) {
  float angle = atan(point.y, point.x);
  float sectorAngle = PRISM_TOPOLOGY_TAU / float(PRISM_TOPOLOGY_ELEMENT_COUNT);
  float wrapped = mod(angle + PRISM_TOPOLOGY_PI, PRISM_TOPOLOGY_TAU);
  float index = floor(wrapped / sectorAngle);
  float centerAngle = -PRISM_TOPOLOGY_PI + (index + 0.5) * sectorAngle;
  float localAngle = atan(sin(angle - centerAngle), cos(angle - centerAngle));
  float variation = prismElementVariation(index);

  PrismRadialElement element;
  element.index = index;
  element.normalizedIndex = (index + 0.5) / float(PRISM_TOPOLOGY_ELEMENT_COUNT);
  element.angle = centerAngle;
  element.localAngle = localAngle;
  element.oppositeIndex = mod(index + float(PRISM_TOPOLOGY_ELEMENT_COUNT) * 0.5, float(PRISM_TOPOLOGY_ELEMENT_COUNT));
  element.groupIndex = mod(index, 2.0);
  element.variation = variation;
  element.curvature = variation * curvatureAmount;
  element.innerRadius = baseRadius * (0.16 + variation * 0.01);
  element.outerRadius = baseRadius * (1.16 + variation * 0.06);
  return element;
}
`
