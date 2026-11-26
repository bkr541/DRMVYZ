/** Forward-only, preset-local spatial integration. Musical time is supplied by
 * Cinema2BeatClock; this class does not detect tempo, beats or sections. */
export class PurityFlight {
  travel = 0
  velocity = 0

  reset(): void { this.travel = this.velocity = 0 }

  advance(dt: number, beatDelta: number, speedPerBeat: number, active: boolean): number {
    if (!active || speedPerBeat <= 0) { this.velocity = 0; return 0 }
    if (!Number.isFinite(dt) || dt <= 0) return 0
    const target = Math.max(0, beatDelta) / dt * speedPerBeat
    // Integrate the exponential exactly, not a frame-dependent lerp. Eased
    // acceleration/release never changes the sign of forward displacement.
    const tau = target > this.velocity ? .42 : .65
    const blend = -Math.expm1(-dt / tau)
    const distance = Math.max(0, target * dt + (this.velocity - target) * tau * blend)
    this.velocity += (target - this.velocity) * blend
    this.travel += distance
    return distance
  }
}
