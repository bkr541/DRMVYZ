// Sound Drawing XY: moves the word between patterns. Every letter holds a weight per pattern that eases toward
// its target, so the change travels across the word letter by letter (Answer Delay) and an interrupted change
// never pops: a new target simply redirects the weights from wherever they are.

import { XY_SCOPE_PATTERN_IDS, xyScopePatternIndex, type XyScopePattern } from './XyScopePatterns'

interface PendingTarget { at: number; glyph: number; pattern: XyScopePattern }

const MAX_PENDING = 256
const PATTERN_COUNT = XY_SCOPE_PATTERN_IDS.length

export class XyScopeBlender {
  /** weights[glyph][patternIndex], each row sums to 1. */
  readonly weights: Float32Array[] = []
  private targets: XyScopePattern[] = []
  private pending: PendingTarget[] = []

  reset(glyphCount: number, pattern: XyScopePattern): void {
    this.pending = []
    this.weights.length = 0
    this.targets = []
    for (let g = 0; g < glyphCount; g += 1) {
      this.weights.push(this.oneHot(pattern))
      this.targets.push(pattern)
    }
  }

  /**
   * Sends the word to `pattern`: left to right, each letter `delayMs` after its neighbour. `snap` skips the move
   * (Motion Amount zero, or a track change) and lands every letter on the pattern at once.
   */
  setTarget(pattern: XyScopePattern, nowSec: number, delayMs: number, snap: boolean): void {
    if (snap) {
      this.pending = []
      for (let g = 0; g < this.weights.length; g += 1) {
        this.weights[g] = this.oneHot(pattern)
        this.targets[g] = pattern
      }
      return
    }
    const delay = Math.max(0, delayMs) / 1000
    // A new target replaces anything not yet applied for the same letter.
    this.pending = this.pending.filter(item => item.at <= nowSec)
    for (let g = 0; g < this.weights.length; g += 1) this.pending.push({ at: nowSec + g * delay, glyph: g, pattern })
    if (this.pending.length > MAX_PENDING) this.pending.splice(0, this.pending.length - MAX_PENDING)
  }

  /** Applies due targets, then eases every weight toward its target over about `durationSec`. */
  update(dtSec: number, nowSec: number, durationSec: number): void {
    if (this.pending.length > 0) {
      const keep: PendingTarget[] = []
      for (const item of this.pending) {
        if (item.at > nowSec) keep.push(item)
        else if (this.targets[item.glyph] !== undefined) this.targets[item.glyph] = item.pattern
      }
      this.pending = keep
    }
    const tau = Math.max(0.03, durationSec / 3)
    const k = 1 - Math.exp(-Math.max(0, dtSec) / tau)
    for (let g = 0; g < this.weights.length; g += 1) {
      const row = this.weights[g]
      const target = xyScopePatternIndex(this.targets[g])
      let sum = 0
      for (let p = 0; p < PATTERN_COUNT; p += 1) {
        row[p] += ((p === target ? 1 : 0) - row[p]) * k
        if (row[p] < 0.002) row[p] = 0
        sum += row[p]
      }
      // Keep each row a proper mix after the small-value clamp.
      if (sum > 0 && Math.abs(sum - 1) > 1e-6) for (let p = 0; p < PATTERN_COUNT; p += 1) row[p] /= sum
    }
  }

  /** The pattern a letter is moving to (its target), not necessarily where it is yet. */
  targetOf(glyph: number): XyScopePattern | null {
    return this.targets[glyph] ?? null
  }

  private oneHot(pattern: XyScopePattern): Float32Array {
    const row = new Float32Array(PATTERN_COUNT)
    row[xyScopePatternIndex(pattern)] = 1
    return row
  }
}
