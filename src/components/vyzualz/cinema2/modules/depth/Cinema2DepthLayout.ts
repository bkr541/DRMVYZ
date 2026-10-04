export const CINEMA2_DEPTH_PROOF_PORTAL_COUNT = 10
export const CINEMA2_DEPTH_PROOF_APERTURE = 7.4
export const CINEMA2_DEPTH_PROOF_SPACING = 4.2
export const CINEMA2_DEPTH_INSTANCE_FLOATS = 12

export type Cinema2DepthInstanceKind = 'frame' | 'strip' | 'node' | 'rail' | 'center'

export interface Cinema2DepthInstance {
  kind: Cinema2DepthInstanceKind
  portalIndex: number
  sideIndex: number
  center: readonly [number, number, number]
  size: readonly [number, number, number]
  emission: number
  spill: number
}

export interface Cinema2DepthProofLayout {
  portalCount: number
  aperture: number
  spacing: number
  repeatDistance: number
  centerDepth: number
  instances: readonly Readonly<Cinema2DepthInstance>[]
}

const KIND_CODE: Readonly<Record<Cinema2DepthInstanceKind, number>> = Object.freeze({
  frame: 0,
  strip: 1,
  node: 2,
  rail: 3,
  center: 4,
})

/**
 * Step-1 visual proof: a fixed tunnel whose portal sides already carry a
 * deliberate reference-like lighting composition. Step 2 replaces those
 * fixed values with the user-selectable deterministic light programs.
 */
export function buildCinema2DepthProofLayout(options: {
  portalCount?: number
  aperture?: number
  spacing?: number
  frameThickness?: number
} = {}): Readonly<Cinema2DepthProofLayout> {
  const portalCount = integer(options.portalCount ?? CINEMA2_DEPTH_PROOF_PORTAL_COUNT, 8, 24)
  const aperture = finite(options.aperture, CINEMA2_DEPTH_PROOF_APERTURE, 4, 14)
  const spacing = finite(options.spacing, CINEMA2_DEPTH_PROOF_SPACING, 2.5, 8)
  const frameThickness = finite(options.frameThickness, 0.5, 0.2, 1.4)
  const frameDepth = Math.min(0.8, spacing * 0.18)
  const half = aperture * 0.5
  const outer = half + frameThickness * 0.5
  const instances: Cinema2DepthInstance[] = []

  for (let portalIndex = 0; portalIndex < portalCount; portalIndex += 1) {
    const z = -portalIndex * spacing
    const sideEmission = proofEmission(portalIndex)
    const ringSpill = Math.max(...sideEmission) * 0.72

    push(instances, 'frame', portalIndex, 0, [0, outer, z], [aperture + frameThickness * 2, frameThickness, frameDepth], 0, ringSpill)
    push(instances, 'frame', portalIndex, 1, [outer, 0, z], [frameThickness, aperture, frameDepth], 0, ringSpill)
    push(instances, 'frame', portalIndex, 2, [0, -outer, z], [aperture + frameThickness * 2, frameThickness, frameDepth], 0, ringSpill)
    push(instances, 'frame', portalIndex, 3, [-outer, 0, z], [frameThickness, aperture, frameDepth], 0, ringSpill)

    const stripDepth = 0.14
    const stripWidth = Math.max(0.09, frameThickness * 0.2)
    const stripLength = aperture * 0.92
    const stripZ = z + frameDepth * 0.52
    push(instances, 'strip', portalIndex, 0, [0, half, stripZ], [stripLength, stripWidth, stripDepth], sideEmission[0], sideEmission[0])
    push(instances, 'strip', portalIndex, 1, [half, 0, stripZ], [stripWidth, stripLength, stripDepth], sideEmission[1], sideEmission[1])
    push(instances, 'strip', portalIndex, 2, [0, -half, stripZ], [stripLength, stripWidth, stripDepth], sideEmission[2], sideEmission[2])
    push(instances, 'strip', portalIndex, 3, [-half, 0, stripZ], [stripWidth, stripLength, stripDepth], sideEmission[3], sideEmission[3])

    const nodeSize = frameThickness * 1.2
    for (const [sideIndex, x, y] of [[0, outer, outer], [1, outer, -outer], [2, -outer, -outer], [3, -outer, outer]] as const) {
      push(instances, 'node', portalIndex, sideIndex, [x, y, z + 0.02], [nodeSize, nodeSize, frameDepth * 1.08], 0, ringSpill * 0.65)
    }
  }

  const railDepth = Math.max(0.2, spacing - frameDepth)
  for (let portalIndex = 0; portalIndex < portalCount - 1; portalIndex += 1) {
    const z = -(portalIndex + 0.5) * spacing
    for (const [sideIndex, x, y] of [[0, outer, outer], [1, outer, -outer], [2, -outer, -outer], [3, -outer, outer]] as const) {
      push(instances, 'rail', portalIndex, sideIndex, [x, y, z], [0.13, 0.13, railDepth], 0, 0.16)
    }
  }

  const centerDepth = -(portalCount - 1) * spacing - spacing * 1.8
  push(instances, 'center', portalCount, -1, [0, 0, centerDepth], [0.55, 0.55, 0.4], 0.34, 0.34)

  return Object.freeze({
    portalCount,
    aperture,
    spacing,
    repeatDistance: portalCount * spacing,
    centerDepth,
    instances: Object.freeze(instances.map(instance => Object.freeze(instance))),
  })
}

/** Packs three vec4 instance attributes: center/sizeX, sizeYZ/kind/emission, and portal/side/spill. */
export function packCinema2DepthInstances(instances: readonly Readonly<Cinema2DepthInstance>[]): Float32Array {
  const packed = new Float32Array(instances.length * CINEMA2_DEPTH_INSTANCE_FLOATS)
  instances.forEach((instance, index) => {
    const offset = index * CINEMA2_DEPTH_INSTANCE_FLOATS
    packed.set([
      instance.center[0], instance.center[1], instance.center[2], instance.size[0],
      instance.size[1], instance.size[2], KIND_CODE[instance.kind], instance.emission,
      instance.portalIndex, instance.sideIndex, instance.spill, 0,
    ], offset)
  })
  return packed
}

function proofEmission(portalIndex: number): readonly [number, number, number, number] {
  if (portalIndex === 0) return [1, 1, 1, 1]
  const patterns: readonly (readonly [number, number, number, number])[] = [
    [0.08, 0.82, 0.08, 0.82],
    [0.76, 0.08, 0.76, 0.08],
    [0.68, 0.68, 0.08, 0.08],
    [0.08, 0.08, 0.62, 0.62],
    [0.42, 0.42, 0.42, 0.42],
  ]
  return patterns[(portalIndex - 1) % patterns.length]!
}

function push(
  instances: Cinema2DepthInstance[],
  kind: Cinema2DepthInstanceKind,
  portalIndex: number,
  sideIndex: number,
  center: readonly [number, number, number],
  size: readonly [number, number, number],
  emission: number,
  spill: number,
): void {
  instances.push({ kind, portalIndex, sideIndex, center: Object.freeze(center), size: Object.freeze(size), emission, spill })
}

function finite(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function integer(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)))
}
