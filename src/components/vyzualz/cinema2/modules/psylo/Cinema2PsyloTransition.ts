import { PSYLO_PATTERNS } from './Cinema2PsyloDomain'

/** Convex blends retain the existing displacement/clearance bound. Manual edits
 * snap immediately; automatic transitions preserve their current mixture even
 * when another trigger interrupts them. Pause and speed zero hold the blend. */
export class PsyloPatternTransition {
  private weights: number[] = PSYLO_PATTERNS.map((_, i) => i === 0 ? 1 : 0)
  private from = [...this.weights]
  private target = -1
  private elapsed = .35
  update(pattern: number, dt: number, immediate: boolean): readonly number[] {
    if (immediate || this.target < 0) {
      this.weights = this.weights.map((_, i) => i === pattern ? 1 : 0)
      this.from = [...this.weights]; this.elapsed = .35; this.target = pattern
      return this.weights
    }
    if (pattern !== this.target) { this.from = [...this.weights]; this.target = pattern; this.elapsed = 0 }
    this.elapsed = Math.min(.35, this.elapsed + Math.max(0, dt))
    const t = this.elapsed / .35, blend = t * t * (3 - 2 * t)
    this.weights = this.from.map((weight, i) => weight * (1 - blend) + (i === this.target ? blend : 0))
    return this.weights
  }
}
