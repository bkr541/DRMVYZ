import { clamp } from './ConstellationMath'

export const CONSTELLATION_BEAM_INSTANCE_FLOATS = 10
export const CONSTELLATION_BEAM_ENDPOINT_FLOATS = 6
export const CONSTELLATION_BEAM_MIN_LENGTH_SQUARED = 1e-8

function finite(value: number): boolean {
  return Number.isFinite(value)
}

/** Writes one endpoint pair into a reusable instance buffer without allocations. */
export function writeConstellationBeamInstance(
  target: Float32Array,
  targetOffset: number,
  historical: Float32Array,
  historicalOffset: number,
  current: Float32Array,
  currentOffset: number,
  fanAmount: number,
  alpha: number,
  widthScale: number,
  paletteMix: number,
  normalizedAge: number,
): boolean {
  const fan = clamp(Number.isFinite(fanAmount) ? fanAmount : 1, 0, 2)
  const ax = current[currentOffset] + (historical[historicalOffset] - current[currentOffset]) * fan
  const ay = current[currentOffset + 1] + (historical[historicalOffset + 1] - current[currentOffset + 1]) * fan
  const az = current[currentOffset + 2] + (historical[historicalOffset + 2] - current[currentOffset + 2]) * fan
  const bx = current[currentOffset + 3] + (historical[historicalOffset + 3] - current[currentOffset + 3]) * fan
  const by = current[currentOffset + 4] + (historical[historicalOffset + 4] - current[currentOffset + 4]) * fan
  const bz = current[currentOffset + 5] + (historical[historicalOffset + 5] - current[currentOffset + 5]) * fan
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const lengthSquared = dx * dx + dy * dy + dz * dz
  if (
    !finite(ax) || !finite(ay) || !finite(az)
    || !finite(bx) || !finite(by) || !finite(bz)
    || !finite(lengthSquared)
    || lengthSquared <= CONSTELLATION_BEAM_MIN_LENGTH_SQUARED
  ) {
    return false
  }

  target[targetOffset] = ax
  target[targetOffset + 1] = ay
  target[targetOffset + 2] = az
  target[targetOffset + 3] = bx
  target[targetOffset + 4] = by
  target[targetOffset + 5] = bz
  target[targetOffset + 6] = clamp(alpha, 0, 1)
  target[targetOffset + 7] = clamp(widthScale, 0.05, 4)
  target[targetOffset + 8] = clamp(paletteMix, 0, 1)
  target[targetOffset + 9] = clamp(normalizedAge, 0, 1)
  return true
}
