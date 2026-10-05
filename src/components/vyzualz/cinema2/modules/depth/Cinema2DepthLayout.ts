export const CINEMA2_DEPTH_LAYOUT_CONFIG = Object.freeze({
  portalCount: 8,
  aperture: 8.2,
  spacing: 6,
  frameThickness: 0.65,
  lapCopies: 3,
})
export const CINEMA2_DEPTH_PROOF_PORTAL_COUNT = CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount
export const CINEMA2_DEPTH_PROOF_APERTURE = CINEMA2_DEPTH_LAYOUT_CONFIG.aperture
export const CINEMA2_DEPTH_PROOF_SPACING = CINEMA2_DEPTH_LAYOUT_CONFIG.spacing
export const CINEMA2_DEPTH_REPEAT_DISTANCE = CINEMA2_DEPTH_LAYOUT_CONFIG.portalCount * CINEMA2_DEPTH_LAYOUT_CONFIG.spacing
export const CINEMA2_DEPTH_REPEAT_ORIGIN_Z = CINEMA2_DEPTH_LAYOUT_CONFIG.spacing * 2
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
  lapCopies: number
  aperture: number
  spacing: number
  repeatDistance: number
  centerDepth: number
  boxInstanceCount: number
  sphereInstanceCount: number
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
 * deliberate reference-like fallback composition. The Step-2 renderer
 * replaces those packed light values each frame with deterministic programs.
 */
export function buildCinema2DepthProofLayout(options: {
  portalCount?: number
  aperture?: number
  spacing?: number
  frameThickness?: number
  lapCopies?: number
} = {}): Readonly<Cinema2DepthProofLayout> {
  const portalCount = integer(options.portalCount ?? CINEMA2_DEPTH_PROOF_PORTAL_COUNT, 6, 24)
  const aperture = finite(options.aperture, CINEMA2_DEPTH_PROOF_APERTURE, 4, 14)
  const spacing = finite(options.spacing, CINEMA2_DEPTH_PROOF_SPACING, 2.5, 8)
  const frameThickness = finite(options.frameThickness, CINEMA2_DEPTH_LAYOUT_CONFIG.frameThickness, 0.2, 1.4)
  const lapCopyRadius = Math.floor(integer(options.lapCopies ?? CINEMA2_DEPTH_LAYOUT_CONFIG.lapCopies, 1, 5) / 2)
  const lapCopies = lapCopyRadius * 2 + 1
  const frameDepth = Math.min(1.1, spacing * 0.16)
  const half = aperture * 0.5
  const outer = half + frameThickness * 0.5
  const boxes: Cinema2DepthInstance[] = []
  const spheres: Cinema2DepthInstance[] = []

  for (let portalIndex = 0; portalIndex < portalCount; portalIndex += 1) {
    const z = -portalIndex * spacing
    const sideEmission = proofEmission(portalIndex)

    push(boxes, 'frame', portalIndex, 0, [0, outer, z], [aperture + frameThickness * 2, frameThickness, frameDepth], 0, sideEmission[0] * 0.34)
    push(boxes, 'frame', portalIndex, 1, [outer, 0, z], [frameThickness, aperture, frameDepth], 0, sideEmission[1] * 0.34)
    push(boxes, 'frame', portalIndex, 2, [0, -outer, z], [aperture + frameThickness * 2, frameThickness, frameDepth], 0, sideEmission[2] * 0.34)
    push(boxes, 'frame', portalIndex, 3, [-outer, 0, z], [frameThickness, aperture, frameDepth], 0, sideEmission[3] * 0.34)

    const stripDepth = 0.14
    const stripWidth = Math.max(0.09, frameThickness * 0.2)
    // Let the four physical fixtures overlap by one strip width at each
    // corner. Their emission is still addressed independently, but an
    // inactive side can no longer disappear as a geometric gap in the gate.
    const stripLength = aperture + stripWidth
    const stripZ = z + frameDepth * 0.52
    push(boxes, 'strip', portalIndex, 0, [0, half, stripZ], [stripLength, stripWidth, stripDepth], sideEmission[0], sideEmission[0])
    push(boxes, 'strip', portalIndex, 1, [half, 0, stripZ], [stripWidth, stripLength, stripDepth], sideEmission[1], sideEmission[1])
    push(boxes, 'strip', portalIndex, 2, [0, -half, stripZ], [stripLength, stripWidth, stripDepth], sideEmission[2], sideEmission[2])
    push(boxes, 'strip', portalIndex, 3, [-half, 0, stripZ], [stripWidth, stripLength, stripDepth], sideEmission[3], sideEmission[3])

    const nodeSize = frameThickness * 1.2
    for (const [sideIndex, x, y] of [[0, outer, outer], [1, outer, -outer], [2, -outer, -outer], [3, -outer, outer]] as const) {
      const cornerSpill = Math.max(sideEmission[sideIndex], sideEmission[(sideIndex + 1) % 4]) * 0.22
      push(spheres, 'node', portalIndex, sideIndex, [x, y, z + 0.02], [nodeSize, nodeSize, nodeSize], 0, cornerSpill)
    }
  }

  const railDepth = Math.max(0.2, spacing - frameDepth)
  for (let portalIndex = 0; portalIndex < portalCount - 1; portalIndex += 1) {
    const z = -(portalIndex + 0.5) * spacing
    for (const [sideIndex, x, y] of [[0, outer, outer], [1, outer, -outer], [2, -outer, -outer], [3, -outer, outer]] as const) {
      const railWidth = Math.max(0.16, frameThickness * 0.28)
      push(boxes, 'rail', portalIndex, sideIndex, [x, y, z], [railWidth, railWidth, railDepth], 0, 0)
    }
  }

  const centerDepth = -(portalCount - 1) * spacing - spacing * 1.8
  push(spheres, 'center', portalCount, -1, [0, 0, centerDepth], [0.9, 0.9, 0.9], 0.7, 0)

  const repeatDistance = portalCount * spacing
  let instances: Cinema2DepthInstance[]
  if (lapCopies > 1) {
    const repeatedBoxes: Cinema2DepthInstance[] = []
    const repeatedNodes: Cinema2DepthInstance[] = []
    for (let lap = -lapCopyRadius; lap <= lapCopyRadius; lap += 1) {
      appendLap(repeatedBoxes, boxes, lap, repeatDistance)
      appendLap(repeatedNodes, spheres.filter(instance => instance.kind === 'node'), lap, repeatDistance)
    }
    const center = spheres.find(instance => instance.kind === 'center')
    instances = [...repeatedBoxes, ...repeatedNodes, ...(center ? [center] : [])]
  } else {
    instances = [...boxes, ...spheres]
  }

  const boxInstanceCount = instances.findIndex(instance => instance.kind === 'node' || instance.kind === 'center')

  return Object.freeze({
    portalCount,
    lapCopies,
    aperture,
    spacing,
    repeatDistance,
    centerDepth,
    boxInstanceCount: boxInstanceCount < 0 ? instances.length : boxInstanceCount,
    sphereInstanceCount: boxInstanceCount < 0 ? 0 : instances.length - boxInstanceCount,
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
  if (portalIndex === 0) return [1, 0, 0, 0]
  if (portalIndex === 2) return [0, 0.82, 0, 0]
  if (portalIndex === 4) return [0, 0, 0, 0.76]
  if (portalIndex === 6) return [0, 0, 0.68, 0]
  return [0, 0, 0, 0]
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

function appendLap(
  output: Cinema2DepthInstance[],
  source: readonly Cinema2DepthInstance[],
  lap: number,
  repeatDistance: number,
): void {
  for (const instance of source) {
    push(
      output,
      instance.kind,
      instance.portalIndex,
      instance.sideIndex,
      [instance.center[0], instance.center[1], instance.center[2] - lap * repeatDistance],
      instance.size,
      instance.emission,
      instance.spill,
    )
  }
}

function finite(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

function integer(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)))
}
