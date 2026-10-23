import type { Cinema2Vector3 } from '../../contracts/Cinema2NativePresetManifest'
import type { Cinema2BlockshiftInstance } from './Cinema2BlockshiftDomain'
import { constrainCinema2BlockshiftLayout } from './Cinema2BlockshiftLayout'

/** Additive per-cube orientation from the existing performance beat delta, never a second clock. */
export class Cinema2BlockshiftRotation {
  private angles = new Float64Array(45)
  update(input: { reset: boolean; enabled: boolean; active: boolean; deltaBeats: number; motionAmount: number; motionRate: number }): void {
    if (input.reset) this.reset()
    if (!input.enabled || !input.active || input.motionAmount === 0) return
    const advance = Math.max(0, input.deltaBeats) * input.motionAmount * input.motionRate * 3
    for (let i = 0; i < 15; i++) {
      const main = i % 3, secondary = (main + 1) % 3, sign = i % 2 ? -1 : 1
      this.angles[i * 3 + main]! += advance * (0.065 + i % 5 * 0.013) * sign
      this.angles[i * 3 + secondary]! += advance * 0.025 * (i % 4 < 2 ? 1 : -1)
      for (let a = 0; a < 3; a++) this.angles[i * 3 + a] %= Math.PI * 2
    }
  }
  apply(base: readonly Readonly<Cinema2BlockshiftInstance>[]): readonly Readonly<Cinema2BlockshiftInstance>[] {
    if (this.angles.every(n => n === 0)) return base
    return constrainCinema2BlockshiftLayout(base.map(block => ({ ...block, rotation: block.rotation.map((n, a) => n + this.angles[block.index * 3 + a]!) as unknown as Cinema2Vector3 })))
  }
  reset(): void { this.angles.fill(0) }
}
