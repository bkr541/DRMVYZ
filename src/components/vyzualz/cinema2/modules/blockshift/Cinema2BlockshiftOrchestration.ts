import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2BlockshiftInstance, Cinema2BlockshiftPattern } from './Cinema2BlockshiftDomain'
import { constrainCinema2BlockshiftLayout } from './Cinema2BlockshiftLayout'

const turn = Math.PI * 2
const shortAngle = (value: number) => ((value + Math.PI) % turn + turn) % turn - Math.PI

/** Coherent azimuth paths go around the observer; straight Cartesian blends could pass through them.
 * A common turn direction prevents the upper/lower or front/rear banks taking opposite routes at 180 degrees.
 */
export function blendCinema2BlockshiftPoses(from: readonly Readonly<Cinema2BlockshiftInstance>[], to: readonly Readonly<Cinema2BlockshiftInstance>[], progress: number): readonly Readonly<Cinema2BlockshiftInstance>[] {
  if (progress <= 0) return from
  if (progress >= 1) return to
  const reference = shortAngle(Math.atan2(to[0]!.position[0], to[0]!.position[2]) - Math.atan2(from[0]!.position[0], from[0]!.position[2]))
  const lerp = (a: number, b: number) => a + (b - a) * progress
  const pose = to.map((block, index) => {
    const before = from[index]!
    const a = Math.atan2(before.position[0], before.position[2]), b = Math.atan2(block.position[0], block.position[2])
    let delta = shortAngle(b - a)
    if (delta - reference > Math.PI) delta -= turn
    else if (delta - reference < -Math.PI) delta += turn
    const azimuth = a + delta * progress
    const radius = lerp(Math.hypot(before.position[0], before.position[2]), Math.hypot(block.position[0], block.position[2]))
    const position: Cinema2Vector3 = [Math.sin(azimuth) * radius, lerp(before.position[1], block.position[1]), Math.cos(azimuth) * radius]
    const rotation = block.rotation.map((value, axis) => before.rotation[axis]! + shortAngle(value - before.rotation[axis]!) * progress) as unknown as Cinema2Vector3
    return { ...block, position, rotation, size: lerp(before.size, block.size) }
  })
  return constrainCinema2BlockshiftLayout(pose)
}

interface Input {
  target: readonly Readonly<Cinema2BlockshiftInstance>[]
  pattern: Cinema2BlockshiftPattern
  geometryKey: string
  deltaBeats: number
  deltaSeconds: number
  durationBeats: number
  active: boolean
  frozen: boolean
  snap?: boolean
  reset?: boolean
}

/** Runtime-only transitions. A new selection retargets from the last fully evaluated visible pose. */
export class Cinema2BlockshiftOrchestration {
  private visible: readonly Readonly<Cinema2BlockshiftInstance>[] | null = null
  private from: readonly Readonly<Cinema2BlockshiftInstance>[] | null = null
  private pattern: Cinema2BlockshiftPattern | null = null
  private geometryKey = ''
  private elapsed = 0
  private duration = 1
  private progress = 1

  update(input: Input): readonly Readonly<Cinema2BlockshiftInstance>[] {
    if (!this.visible || input.reset || input.snap || input.geometryKey !== this.geometryKey) {
      this.visible = input.target; this.from = null; this.pattern = input.pattern; this.geometryKey = input.geometryKey; this.progress = 1
      return this.visible
    }
    let started = false
    if (input.pattern !== this.pattern) {
      this.from = this.visible; this.pattern = input.pattern; this.elapsed = 0; this.duration = input.durationBeats; started = true
    }
    if (this.from) {
      // Changing duration preserves the current progress instead of restarting or jumping the transition.
      if (this.duration !== input.durationBeats) { this.elapsed *= input.durationBeats / this.duration; this.duration = input.durationBeats }
      if (!input.frozen && !started) this.elapsed += input.active ? Math.max(0, input.deltaBeats) : Math.min(Math.max(input.deltaSeconds, 0), 0.25) * 2
      this.progress = Math.min(1, this.elapsed / this.duration)
      const eased = this.progress * this.progress * (3 - 2 * this.progress)
      this.visible = blendCinema2BlockshiftPoses(this.from, input.target, eased)
      if (this.progress >= 1) this.from = null
    } else if (!input.frozen) this.visible = input.target
    return this.visible
  }

  getProgress(): number { return this.progress }
  reset(): void { this.visible = null; this.from = null; this.pattern = null; this.geometryKey = ''; this.elapsed = 0; this.progress = 1 }
}
