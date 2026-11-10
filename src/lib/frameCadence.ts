/** Limits presentation copies without changing the producer's animation clock. */
export class FrameCadence {
  private lastFrameAt: number | null = null

  constructor(private readonly fps: number) {}

  due(timestamp: number): boolean {
    if (!Number.isFinite(timestamp)) return false
    const interval = 1000 / this.fps
    if (this.lastFrameAt === null || timestamp < this.lastFrameAt) {
      this.lastFrameAt = timestamp
      return true
    }
    const elapsed = timestamp - this.lastFrameAt
    if (elapsed + 0.1 < interval) return false
    // Keep fractional cadence at 60/120 Hz, but never replay missed frames.
    const steps = Math.max(1, Math.floor((elapsed + 0.1) / interval))
    this.lastFrameAt = Math.min(timestamp, this.lastFrameAt + steps * interval)
    return true
  }
}
