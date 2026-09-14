import type { Cinema2ElectricStormStrikeDescriptor } from './Cinema2ElectricStormStrikeGenerator'

export interface Cinema2ElectricStormThunderFrame {
  illumination: number
  active: boolean
}

export interface Cinema2ElectricStormThunderSettings {
  intensity: number
  duration: number
  decay: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
}

/** Preset-local thunder character. Strike timing remains owned by native
 * choreography and the Electric Storm strike generator. */
export class Cinema2ElectricStormThunderController {
  private elapsedSec = Number.POSITIVE_INFINITY
  private holdSec = 0
  private decaySec = 0
  private peak = 0
  private currentIllumination = 0
  private active = false
  private lastTriggerTimeSec: number | null = null
  private lastTriggerGroupId: number | null = null

  trigger(strike: Readonly<Cinema2ElectricStormStrikeDescriptor>, settings: Readonly<Cinema2ElectricStormThunderSettings>): void {
    if (strike.tier === 'micro') return
    // A grouped strike is one musical/thunder event rendered as multiple bolts.
    // Do not restart and crush the flash envelope for each bolt in the group.
    if (strike.groupId != null && strike.groupId === this.lastTriggerGroupId) return
    const weight = strike.tier === 'hero' ? 1 : strike.tier === 'strong' ? 0.82 : 0.5
    const intensity = Math.max(0, Math.min(1.5, Number.isFinite(settings.intensity) ? settings.intensity : 0.78))
    const duration = clamp01(settings.duration)
    const decay = clamp01(settings.decay)
    let holdSec = 0.035 + duration * 0.245
    let decaySec = 0.08 + decay * 0.82

    if (this.lastTriggerTimeSec != null) {
      const triggerGapSec = Math.max(0, strike.startedAtSec - this.lastTriggerTimeSec)
      const requestedEnvelopeSec = holdSec + decaySec
      const availableEnvelopeSec = Math.max(0.03, triggerGapSec * 0.92)
      if (triggerGapSec > 0 && requestedEnvelopeSec > availableEnvelopeSec) {
        const scale = availableEnvelopeSec / requestedEnvelopeSec
        holdSec *= scale
        decaySec *= scale
      }
    }

    this.peak = Math.max(this.currentIllumination, Math.min(1, strike.intensity * weight * intensity))
    this.holdSec = holdSec
    this.decaySec = decaySec
    this.elapsedSec = 0
    this.active = this.peak > 0
    this.lastTriggerTimeSec = strike.startedAtSec
    this.lastTriggerGroupId = strike.groupId
  }

  update(deltaTimeSec: number): Readonly<Cinema2ElectricStormThunderFrame> {
    if (!this.active) return Object.freeze({ illumination: 0, active: false })
    this.elapsedSec += Math.max(0, Math.min(0.25, Number.isFinite(deltaTimeSec) ? deltaTimeSec : 0))
    let illumination = this.peak
    if (this.elapsedSec > this.holdSec) {
      const progress = this.decaySec <= 0 ? 1 : (this.elapsedSec - this.holdSec) / this.decaySec
      illumination = progress >= 1 ? 0 : this.peak * Math.pow(1 - Math.max(0, progress), 2)
    }
    if (illumination <= 0) {
      illumination = 0
      this.active = false
    }
    this.currentIllumination = illumination
    return Object.freeze({ illumination, active: this.active })
  }

  reset(): void {
    this.elapsedSec = Number.POSITIVE_INFINITY
    this.holdSec = 0
    this.decaySec = 0
    this.peak = 0
    this.currentIllumination = 0
    this.active = false
    this.lastTriggerTimeSec = null
    this.lastTriggerGroupId = null
  }
}
