import type { Cinema2CameraPathPointManifest, Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
export const ELEVHATE_PITCH = 12
export const ELEVHATE_PATTERNS = [
  { value: 'crossgrid', label: 'Crossgrid' }, { value: 'nested-bays', label: 'Nested Bays' },
  { value: 'crossroads', label: 'Crossroads' }, { value: 'terraced-stacks', label: 'Terraced Stacks' },
  { value: 'offset-blocks', label: 'Offset Blocks' }, { value: 'split-frames', label: 'Split Frames' },
] as const
export type ElevhatePattern = typeof ELEVHATE_PATTERNS[number]['value']
export const ELEVHATE_ROUTE: readonly Cinema2Vector3[] = [
  [0, 0, 0], [0, 0, -24], [0, 12, -24], [-24, 12, -24], [-24, 12, -48], [-24, 0, -48],
  [0, 0, -48], [0, -12, -48], [24, -12, -48], [24, -12, -24], [24, 0, -24], [24, 0, 0],
]
const sub = (a: Cinema2Vector3, b: Cinema2Vector3): Cinema2Vector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const unit = (v: Cinema2Vector3): Cinema2Vector3 => { const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n] }

/** Rounded junction anchors for the existing constant-speed shared camera spline.
 * Elevator legs retain a horizontal gaze, exposing the old and new levels. */
export function buildElevhateFlight(): readonly Cinema2CameraPathPointManifest[] {
  const result: Cinema2CameraPathPointManifest[] = []
  const count = ELEVHATE_ROUTE.length, trim = 1.2
  for (let i = 0; i < count; i++) {
    const p = ELEVHATE_ROUTE[i], incoming = unit(sub(p, ELEVHATE_ROUTE[(i + count - 1) % count]))
    const outgoing = unit(sub(ELEVHATE_ROUTE[(i + 1) % count], p))
    const entry = p.map((x, axis) => x - incoming[axis] * trim) as unknown as Cinema2Vector3
    const exit = p.map((x, axis) => x + outgoing[axis] * trim) as unknown as Cinema2Vector3
    const horizontal = (step: number): Cinema2Vector3 => {
      for (let j = 0; j < count; j++) {
        const a = (i + j * step + count * 2) % count
        const dir = unit(sub(ELEVHATE_ROUTE[(a + 1) % count], ELEVHATE_ROUTE[a]))
        if (Math.abs(dir[1]) < .5) return dir
      }
      return [0, 0, -1]
    }
    const from = Math.abs(incoming[1]) < .5 ? incoming : horizontal(-1)
    const to = Math.abs(outgoing[1]) < .5 ? outgoing : horizontal(1)
    for (const t of [0, .25, .5, .75, 1]) {
      const position = p.map((x, axis) => (1 - t) ** 2 * entry[axis] + 2 * t * (1 - t) * x + t * t * exit[axis]) as unknown as Cinema2Vector3
      const gaze = unit([from[0] * (1 - t) + to[0] * t, 0, from[2] * (1 - t) + to[2] * t])
      result.push({ position, target: [position[0] + gaze[0] * 18, position[1] + .7, position[2] + gaze[2] * 18], fovDegrees: 80, rollDegrees: 0 })
    }
  }
  // Uniformly densify straight runs as well as corners. Unevenly spaced spline
  // knots otherwise overshoot the tiny turn fillets and briefly reverse travel.
  const dense: Cinema2CameraPathPointManifest[] = []
  for (let i = 0; i < result.length; i++) {
    const a = result[i], b = result[(i + 1) % result.length]
    const steps = Math.max(1, Math.ceil(Math.hypot(...sub(b.position, a.position)) / .35))
    for (let j = 0; j < steps; j++) {
      const t = j / steps
      const mix = (x: Cinema2Vector3, y: Cinema2Vector3) => x.map((v, axis) => v + (y[axis] - v) * t) as unknown as Cinema2Vector3
      dense.push({ position: mix(a.position, b.position), target: mix(a.target!, b.target!), fovDegrees: 80, rollDegrees: 0 })
    }
  }
  return dense
}

/** Four floats per instance: canonical cell offset, then mass/collar kind.
 * Collars sit mid-bay, away from the six-way junction's reserved travel volume. */
export function buildElevhateInstances(radius = 7, collarRadius = 2): Float32Array {
  const data: number[] = []
  for (let x = -radius; x <= radius; x++) for (let y = -radius; y <= radius; y++) for (let z = -radius; z <= radius; z++) data.push(x, y, z, 0)
  for (let x = -collarRadius; x <= collarRadius; x++) for (let y = -collarRadius; y <= collarRadius; y++) for (let z = -collarRadius; z <= collarRadius; z++) {
    for (let kind = 1; kind <= 24; kind++) data.push(x, y, z, kind)
  }
  return new Float32Array(data)
}
