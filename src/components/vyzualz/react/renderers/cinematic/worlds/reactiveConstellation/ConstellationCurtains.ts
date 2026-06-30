import {
  CONSTELLATION_BEAM_INSTANCE_FLOATS,
} from './ConstellationBeamGeometry'
import { hashSeed, seededUnit } from './ConstellationMath'

export const CONSTELLATION_MAX_CURTAINS = 24

export interface ConstellationCurtainInput {
  seed: number
  count: number
  spread: number
  depthSpread: number
  timeSec: number
  intensity: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function writeConstellationCurtainInstances(
  target: Float32Array,
  input: ConstellationCurtainInput,
): number {
  const capacity = Math.floor(target.length / CONSTELLATION_BEAM_INSTANCE_FLOATS)
  const count = Math.min(CONSTELLATION_MAX_CURTAINS, capacity, Math.max(0, Math.floor(input.count)))
  const intensity = clamp(input.intensity, 0, 1)
  if (count <= 0 || intensity <= 0) return 0

  const spread = clamp(input.spread, 0.45, 2.4)
  const depth = clamp(input.depthSpread, 0.08, 1.8)
  const time = Number.isFinite(input.timeSec) ? input.timeSec : 0
  for (let index = 0; index < count; index += 1) {
    const offset = index * CONSTELLATION_BEAM_INSTANCE_FLOATS
    const unit = count <= 1 ? 0.5 : index / (count - 1)
    const jitter = seededUnit(hashSeed(input.seed, index + 1103)) - 0.5
    const phase = seededUnit(hashSeed(input.seed, index + 2081)) * Math.PI * 2
    const depthUnit = seededUnit(hashSeed(input.seed, index + 3001))
    const palette = seededUnit(hashSeed(input.seed, index + 4001))
    const x = (unit * 2 - 1) * spread * 1.34 + jitter * spread * 0.18
    const z = -0.9 - depthUnit * (1.15 + depth * 1.45)
    const sway = Math.sin(time * (0.08 + depthUnit * 0.08) + phase) * (0.04 + spread * 0.035)
    const height = 1.25 + spread * 0.55 + depthUnit * 0.3

    target[offset] = x + sway
    target[offset + 1] = -height
    target[offset + 2] = z
    target[offset + 3] = x - sway * 0.45 + jitter * 0.12
    target[offset + 4] = height
    target[offset + 5] = z - 0.12 - depthUnit * 0.28
    target[offset + 6] = intensity * (0.08 + depthUnit * 0.16)
    target[offset + 7] = 0.75 + depthUnit * 1.6
    target[offset + 8] = palette
    target[offset + 9] = 0.72 + depthUnit * 0.28
  }
  return count
}
