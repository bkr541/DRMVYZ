import type { Cinema2ElectricStormStrikeDescriptor } from './Cinema2ElectricStormStrikeGenerator'

export interface Cinema2ElectricStormThunderFrame {
  illumination: number
  active: boolean
}

/** Preset-local thunder character only. Musical trigger authority and authored
 * shared event envelopes intentionally remain reserved for Stage 14B. */
export class Cinema2ElectricStormThunderController {
  private elapsedSec = Number.POSITIVE_INFINITY
  private holdSec = 0
  private decaySec = 0
  private peak = 0
  private active = false

  trigger(strike: Readonly<Cinema2ElectricStormStrikeDescriptor>): void {
    if (strike.tier === 'micro') return
    const weight = strike.tier === 'hero' ? 1 : strike.tier === 'strong' ? 0.82 : 0.5
    this.peak = Math.max(this.peak, Math.min(1, strike.intensity * weight))
    this.holdSec = strike.tier === 'hero' ? 0.12 : strike.tier === 'strong' ? 0.08 : 0.045
    this.decaySec = strike.tier === 'hero' ? 0.58 : strike.tier === 'strong' ? 0.4 : 0.24
    this.elapsedSec = 0
    this.active = true
  }

  update(deltaTimeSec: number): Readonly<Cinema2ElectricStormThunderFrame> {
    if (!this.active) return Object.freeze({ illumination: 0, active: false })
    this.elapsedSec += Math.max(0, Math.min(0.25, Number.isFinite(deltaTimeSec) ? deltaTimeSec : 0))
    let illumination = this.peak
    if (this.elapsedSec > this.holdSec) {
      const progress = this.decaySec <= 0 ? 1 : (this.elapsedSec - this.holdSec) / this.decaySec
      illumination = progress >= 1 ? 0 : this.peak * Math.pow(1 - Math.max(0, progress), 2)
    }
    if (illumination <= 0) this.active = false
    return Object.freeze({ illumination, active: this.active })
  }

  reset(): void {
    this.elapsedSec = Number.POSITIVE_INFINITY
    this.holdSec = 0
    this.decaySec = 0
    this.peak = 0
    this.active = false
  }
}
