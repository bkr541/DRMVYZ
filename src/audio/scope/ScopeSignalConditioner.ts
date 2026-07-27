import {
  DEFAULT_SCOPE_SIGNAL_CONDITIONER,
  type ScopeSignalConditionerSettings,
} from './scopeTypes'

/** Per-frame smoothing coefficient for gain/offset changes. 0 = instant. */
const PARAMETER_SMOOTHING = 0.35

/**
 * Explicit conditioning stage: DC blocking, gain, offset, inversion, axis swap.
 *
 * Kept out of the individual draw routines on purpose. Ad-hoc cleanup inside a
 * renderer cannot hold filter state across frames, so an AC-coupled trace would
 * restart its high-pass every frame and produce a visible thump at each window
 * boundary.
 *
 * Operates in place on caller-owned buffers so the hot path allocates nothing.
 */
export class ScopeSignalConditioner {
  private settings: ScopeSignalConditionerSettings = { ...DEFAULT_SCOPE_SIGNAL_CONDITIONER }

  // Single-pole DC blocker state, one instance per axis.
  private dcPrevInX = 0
  private dcPrevOutX = 0
  private dcPrevInY = 0
  private dcPrevOutY = 0

  // Smoothed parameters — jumping these mid-trace shows up as a visible snap.
  private smoothedGainX = 1
  private smoothedGainY = 1
  private smoothedOffsetX = 0
  private smoothedOffsetY = 0
  private primed = false

  setSettings(settings: ScopeSignalConditionerSettings): void {
    this.settings = settings
    if (!this.primed) this.snapParameters()
  }

  /** Jumps smoothed parameters to their targets. Use after a deliberate reset. */
  snapParameters(): void {
    this.smoothedGainX = this.settings.gainX
    this.smoothedGainY = this.settings.gainY
    this.smoothedOffsetX = this.settings.offsetX
    this.smoothedOffsetY = this.settings.offsetY
    this.primed = true
  }

  /**
   * Clears filter history. Call only on a genuine discontinuity (seek, track
   * change, capture reset) — resetting every frame defeats the filter.
   */
  reset(): void {
    this.dcPrevInX = 0
    this.dcPrevOutX = 0
    this.dcPrevInY = 0
    this.dcPrevOutY = 0
    this.primed = false
  }

  /**
   * Conditions one frame's X/Y pair in place.
   *
   * Returns whether the axes were swapped, so callers can label the display
   * correctly without re-reading settings.
   */
  process(x: Float32Array, y: Float32Array, length: number, sampleRate: number): boolean {
    const s = this.settings

    this.smoothedGainX = smoothTowards(this.smoothedGainX, s.gainX)
    this.smoothedGainY = smoothTowards(this.smoothedGainY, s.gainY)
    this.smoothedOffsetX = smoothTowards(this.smoothedOffsetX, s.offsetX)
    this.smoothedOffsetY = smoothTowards(this.smoothedOffsetY, s.offsetY)

    if (s.coupling === 'ac') {
      const coefficient = dcBlockerCoefficient(s.dcBlockHz, sampleRate)
      this.applyDcBlockX(x, length, coefficient)
      this.applyDcBlockY(y, length, coefficient)
    }

    const gainX = this.smoothedGainX * (s.invertX ? -1 : 1)
    const gainY = this.smoothedGainY * (s.invertY ? -1 : 1)
    const offsetX = this.smoothedOffsetX
    const offsetY = this.smoothedOffsetY

    if (s.swapAxes) {
      for (let i = 0; i < length; i++) {
        const sourceX = x[i]
        const sourceY = y[i]
        x[i] = sanitize(sourceY * gainX + offsetX)
        y[i] = sanitize(sourceX * gainY + offsetY)
      }
      return true
    }

    for (let i = 0; i < length; i++) {
      x[i] = sanitize(x[i] * gainX + offsetX)
      y[i] = sanitize(y[i] * gainY + offsetY)
    }
    return false
  }

  /**
   * Conditions one or two value-axis traces for waveform modes.
   *
   * Waveform X carries a normalized time ramp, not signal, so gaining or
   * offsetting it would distort the time axis. Both traces therefore receive the
   * Y-axis gain, offset, and inversion — a dual L/R display must scale both
   * channels identically or their relative levels become a lie. `swapAxes` is
   * ignored here; there is no second signal axis to swap with.
   */
  processWaveform(
    primary: Float32Array,
    secondary: Float32Array | null,
    length: number,
    sampleRate: number,
  ): void {
    const s = this.settings

    this.smoothedGainY = smoothTowards(this.smoothedGainY, s.gainY)
    this.smoothedOffsetY = smoothTowards(this.smoothedOffsetY, s.offsetY)

    if (s.coupling === 'ac') {
      const coefficient = dcBlockerCoefficient(s.dcBlockHz, sampleRate)
      this.applyDcBlockX(primary, length, coefficient)
      if (secondary) this.applyDcBlockY(secondary, length, coefficient)
    }

    const gain = this.smoothedGainY * (s.invertY ? -1 : 1)
    const offset = this.smoothedOffsetY

    for (let i = 0; i < length; i++) {
      primary[i] = sanitize(primary[i] * gain + offset)
    }
    if (!secondary) return
    for (let i = 0; i < length; i++) {
      secondary[i] = sanitize(secondary[i] * gain + offset)
    }
  }

  private applyDcBlockX(buffer: Float32Array, length: number, coefficient: number): void {
    let prevIn = this.dcPrevInX
    let prevOut = this.dcPrevOutX
    for (let i = 0; i < length; i++) {
      const input = buffer[i]
      const output = input - prevIn + coefficient * prevOut
      prevIn = input
      prevOut = output
      buffer[i] = output
    }
    this.dcPrevInX = prevIn
    this.dcPrevOutX = prevOut
  }

  private applyDcBlockY(buffer: Float32Array, length: number, coefficient: number): void {
    let prevIn = this.dcPrevInY
    let prevOut = this.dcPrevOutY
    for (let i = 0; i < length; i++) {
      const input = buffer[i]
      const output = input - prevIn + coefficient * prevOut
      prevIn = input
      prevOut = output
      buffer[i] = output
    }
    this.dcPrevInY = prevIn
    this.dcPrevOutY = prevOut
  }
}

/**
 * Single-pole DC-blocker feedback coefficient for a given −3 dB cutoff.
 * Derived from sample rate rather than a magic constant so the cutoff means the
 * same thing at 44.1 kHz and 96 kHz.
 */
export function dcBlockerCoefficient(cutoffHz: number, sampleRate: number): number {
  if (!(sampleRate > 0)) return 0.995
  const cutoff = Math.max(0.1, Math.min(cutoffHz, sampleRate * 0.25))
  const coefficient = 1 - (2 * Math.PI * cutoff) / sampleRate
  return Math.max(0, Math.min(0.99999, coefficient))
}

function smoothTowards(current: number, target: number): number {
  if (!Number.isFinite(target)) return current
  return current + (target - current) * (1 - PARAMETER_SMOOTHING)
}

function sanitize(value: number): number {
  return Number.isFinite(value) ? value : 0
}
