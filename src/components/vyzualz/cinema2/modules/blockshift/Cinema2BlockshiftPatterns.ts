import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import { CINEMA2_BLOCKSHIFT_BLOCKS, type Cinema2BlockshiftInstance, type Cinema2BlockshiftPattern } from './Cinema2BlockshiftDomain'

// Preserve the original nine poses; six added Hallow Cubes fill the side/upper/lower and rear field.
const FIELD = [[-12, 8, -13], [7, 4, -21], [-6, -4, -22], [12, -8, -12],
  [0, 1, -36], [-12, 9, 14], [12, 9, 14], [-12, -9, 14], [12, -9, 14],
  [-26, 0, -24], [26, 0, -24], [0, 22, -24], [0, -22, -24], [-26, 0, 22], [26, 0, 22]] as const

/** Raw authored trajectories; the shared layout constraint is applied after evaluation. */
export function evaluateCinema2BlockshiftPattern(pattern: Cinema2BlockshiftPattern, phase: number, size: number, depth: number, rotationRange: number): readonly Cinema2BlockshiftInstance[] {
  return CINEMA2_BLOCKSHIFT_BLOCKS.map(block => {
    const i = block.index
    let [x, y, z]: number[] = [...FIELD[i]!]
    // All six poses surround the same observer, rather than rearranging a distant 3x3 display.
    if (pattern === 'stack') {
      y *= 1.3; x *= 0.85; z += i === 4 ? -8 : (i % 2 ? 3 : -3)
    } else if (pattern === 'orbit') {
      const angle = 0.32, oldX = x
      x = x * Math.cos(angle) + z * Math.sin(angle); z = -oldX * Math.sin(angle) + z * Math.cos(angle)
    } else if (pattern === 'split') {
      x *= 1.3; y *= 0.8; z += i === 4 ? 0 : (x < 0 ? -4 : 4)
    } else if (pattern === 'wave') {
      y += 3 * Math.sin(i * 0.8); z += 4 * Math.cos(i * 0.7)
    } else if (pattern === 'collapse') {
      x *= 0.85; y *= 0.85; z *= 0.8
    } else {
      x += i === 4 ? 0 : (i % 2 ? 1.5 : -1.5)
      y += i === 4 ? 0 : 1.5 * Math.sin(i)
      z += i === 4 ? 0 : 3 * Math.sin(i * 1.7)
    }
    z *= 0.8 + depth * 0.65
    // Each program has its own trajectory; offset subtraction preserves the approved phase-zero pose.
    const angle = phase * Math.PI * 2
    const wave = (offset: number) => Math.sin(angle + offset) - Math.sin(offset)
    if (pattern === 'stack') {
      x += 0.7 * wave(block.column); y += 1.8 * wave(block.column * 0.7); z += 0.8 * wave(block.row * 0.8)
    } else if (pattern === 'orbit') {
      const oldX = x
      x = x * Math.cos(angle) + z * Math.sin(angle); z = -oldX * Math.sin(angle) + z * Math.cos(angle)
      y *= 1 + 0.08 * Math.sin(angle)
    } else if (pattern === 'split') {
      x *= 1 + 0.15 * Math.sin(angle); z += Math.sign(x) * 2.3 * (1 - Math.cos(angle)); y += 0.35 * wave(i * 0.5)
    } else if (pattern === 'wave') {
      y += 2.2 * wave(i * 0.7); z += 2.6 * wave(i * 0.9); x += 0.4 * wave(i * 0.4)
    } else if (pattern === 'collapse') {
      const compression = 1 - 0.08 * (1 - Math.cos(angle))
      x *= compression; y *= compression; z *= compression
      z += (i % 2 ? 0.5 : -0.5) * wave(i * 0.5)
    } else {
      x += 1.4 * wave(i * 0.85); y += 0.7 * wave(i * 0.45); z += 1.6 * wave(i * 1.1)
    }
    const yaw = rotationRange * Math.PI / 180 * 0.35 * 0.55 * Math.sin(0.6 * i + phase * Math.PI * 2)
    const rotation: Cinema2Vector3 = [rotationRange * Math.PI / 180 * 0.2 * wave(i * 0.35), yaw + (pattern === 'orbit' ? angle : 0), rotationRange * Math.PI / 180 * 0.12 * wave(i * 0.55)]
    return { ...block, position: [x, y, z] as Cinema2Vector3, size, rotation }
  })
}
