import { lerpSimulationNumber, smoothSimulationProgress } from './math'

const UINT32_RANGE = 0x100000000
const FLOAT_BUFFER = new ArrayBuffer(8)
const FLOAT_VIEW = new DataView(FLOAT_BUFFER)

export function hashVisualSimulationString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function mixVisualSimulationHash(value: number): number {
  let hash = value >>> 0
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b)
  hash ^= hash >>> 16
  return hash >>> 0
}

/** Stable hash for integer or floating-point numbers, including -0 and infinities. */
export function hashVisualSimulationNumber(value: number, seed = 0): number {
  FLOAT_VIEW.setFloat64(0, value, true)
  const low = FLOAT_VIEW.getUint32(0, true)
  const high = FLOAT_VIEW.getUint32(4, true)
  return mixVisualSimulationHash(seed ^ low ^ Math.imul(high, 0x9e3779b1))
}

export function visualSimulationDeterministicUnit(seed: number, index = 0): number {
  return mixVisualSimulationHash(seed ^ Math.imul(index + 1, 0x9e3779b1)) / UINT32_RANGE
}

export function visualSimulationDeterministicSigned(seed: number, index = 0): number {
  return visualSimulationDeterministicUnit(seed, index) * 2 - 1
}

export function visualSimulationDeterministicRange(seed: number, index: number, minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) * visualSimulationDeterministicUnit(seed, index)
}

export class VisualSimulationRandom {
  private state: number

  constructor(seed: number | string) {
    const numericSeed = typeof seed === 'string' ? hashVisualSimulationString(seed) : hashVisualSimulationNumber(seed)
    this.state = numericSeed || 0x6d2b79f5
  }

  reset(seed: number | string): void {
    const numericSeed = typeof seed === 'string' ? hashVisualSimulationString(seed) : hashVisualSimulationNumber(seed)
    this.state = numericSeed || 0x6d2b79f5
  }

  nextUint(): number {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state
  }

  nextUnit(): number {
    return this.nextUint() / UINT32_RANGE
  }

  nextSigned(): number {
    return this.nextUnit() * 2 - 1
  }

  range(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.nextUnit()
  }

  getState(): number {
    return this.state
  }
}

function latticeValue(seed: number, x: number, y: number, z: number): number {
  let hash = seed >>> 0
  hash = mixVisualSimulationHash(hash ^ Math.imul(x, 0x1f123bb5))
  hash = mixVisualSimulationHash(hash ^ Math.imul(y, 0x5f356495))
  hash = mixVisualSimulationHash(hash ^ Math.imul(z, 0x6c8e9cf5))
  return hash / UINT32_RANGE * 2 - 1
}

/** Deterministic smooth scalar value noise in three dimensions. */
export function sampleVisualSimulationNoise3D(x: number, y: number, z: number, seed = 0): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const z0 = Math.floor(z)
  const tx = smoothSimulationProgress(x - x0)
  const ty = smoothSimulationProgress(y - y0)
  const tz = smoothSimulationProgress(z - z0)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const z1 = z0 + 1

  const c000 = latticeValue(seed, x0, y0, z0)
  const c100 = latticeValue(seed, x1, y0, z0)
  const c010 = latticeValue(seed, x0, y1, z0)
  const c110 = latticeValue(seed, x1, y1, z0)
  const c001 = latticeValue(seed, x0, y0, z1)
  const c101 = latticeValue(seed, x1, y0, z1)
  const c011 = latticeValue(seed, x0, y1, z1)
  const c111 = latticeValue(seed, x1, y1, z1)

  const xy0 = lerpSimulationNumber(
    lerpSimulationNumber(c000, c100, tx),
    lerpSimulationNumber(c010, c110, tx),
    ty,
  )
  const xy1 = lerpSimulationNumber(
    lerpSimulationNumber(c001, c101, tx),
    lerpSimulationNumber(c011, c111, tx),
    ty,
  )
  return lerpSimulationNumber(xy0, xy1, tz)
}

export function sampleVisualSimulationNoise1D(x: number, seed = 0): number {
  return sampleVisualSimulationNoise3D(x, 0, 0, seed)
}

/** Writes a deterministic two-component force-field sample without allocating. */
export function sampleVisualSimulationVectorNoise2D(
  x: number,
  y: number,
  seed: number,
  output: Float32Array | number[],
  offset = 0,
): void {
  output[offset] = sampleVisualSimulationNoise3D(x, y, 0.173, mixVisualSimulationHash(seed ^ 0xa511e9b3))
  output[offset + 1] = sampleVisualSimulationNoise3D(x, y, 7.913, mixVisualSimulationHash(seed ^ 0x63d83595))
}

/** Writes a deterministic three-component force-field sample without allocating. */
export function sampleVisualSimulationVectorNoise3D(
  x: number,
  y: number,
  z: number,
  seed: number,
  output: Float32Array | number[],
  offset = 0,
): void {
  output[offset] = sampleVisualSimulationNoise3D(x, y, z, mixVisualSimulationHash(seed ^ 0xa511e9b3))
  output[offset + 1] = sampleVisualSimulationNoise3D(x, y, z, mixVisualSimulationHash(seed ^ 0x63d83595))
  output[offset + 2] = sampleVisualSimulationNoise3D(x, y, z, mixVisualSimulationHash(seed ^ 0xc2b2ae35))
}
