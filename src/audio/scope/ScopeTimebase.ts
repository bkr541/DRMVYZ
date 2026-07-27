import type { ScopeBeatDivision, ScopeTimebaseSettings } from './scopeTypes'

/** Beat multipliers for beat-relative windows. */
const BEAT_DIVISION_MULTIPLIER: Record<ScopeBeatDivision, number> = {
  '1/16': 0.25,
  '1/8': 0.5,
  '1/4': 1,
  '1/2': 2,
  '1beat': 1,
  '2beats': 2,
  '1bar': 4,
}

/** Absolute clamps. Below the first, a display shows less than one audio cycle
 *  at any musical frequency; above the second, individual cycles are unreadable. */
const MIN_WINDOW_SECONDS = 0.0005
const MAX_WINDOW_SECONDS = 2

export interface ScopeTimebaseInput {
  settings: ScopeTimebaseSettings
  sampleRate: number
  /** Estimated fundamental period in samples; 0 when unknown. */
  periodSamples: number
  /** 0..1 confidence in that period. */
  periodConfidence: number
  /** Canonical effective BPM, or 0 when unknown. Never substitute a default. */
  bpm: number
}

export interface ScopeTimebaseResult {
  /** Audio seconds spanned by the display. */
  windowSeconds: number
  /** Sample count spanned by the display, at least 2. */
  windowSamples: number
  /** True when the window is locked to detected cycles rather than fixed time. */
  cycleLocked: boolean
}

/**
 * Resolves how much audio time the display spans.
 *
 * Deliberately independent of path resolution: path resolution controls how many
 * points are drawn, the timebase controls how much audio those points cover.
 * Conflating them — which the pre-existing renderer did implicitly — means a user
 * asking for a smoother line silently also asks to see a different amount of
 * time.
 */
export class ScopeTimebase {
  private smoothedWindowSeconds = 0

  reset(): void {
    this.smoothedWindowSeconds = 0
  }

  resolve(input: ScopeTimebaseInput): ScopeTimebaseResult {
    const { settings, sampleRate } = input
    const rate = sampleRate > 0 ? sampleRate : 48_000

    const target = resolveTargetWindowSeconds(input, rate)

    if (this.smoothedWindowSeconds <= 0) {
      this.smoothedWindowSeconds = target.seconds
    } else {
      // Smoothing is expressed as "how much of the current window to keep", so a
      // higher value means a steadier display, matching the control's label.
      const keep = clamp01(settings.smoothing)
      this.smoothedWindowSeconds = this.smoothedWindowSeconds * keep + target.seconds * (1 - keep)
    }

    const windowSeconds = clampWindow(this.smoothedWindowSeconds)
    return {
      windowSeconds,
      windowSamples: Math.max(2, Math.round(windowSeconds * rate)),
      cycleLocked: target.cycleLocked,
    }
  }
}

function resolveTargetWindowSeconds(
  input: ScopeTimebaseInput,
  sampleRate: number,
): { seconds: number; cycleLocked: boolean } {
  const { settings, periodSamples, periodConfidence, bpm } = input

  switch (settings.mode) {
    case 'seconds':
      return { seconds: clampWindow(settings.secondsPerDisplay), cycleLocked: false }

    case 'cycles': {
      if (periodSamples > 1) {
        const cycles = Math.max(0.25, settings.visibleCycles)
        return { seconds: clampWindow((periodSamples * cycles) / sampleRate), cycleLocked: true }
      }
      // No period detected — fall back to fixed time rather than guessing one.
      return { seconds: clampWindow(settings.secondsPerDisplay), cycleLocked: false }
    }

    case 'beatRelative': {
      if (bpm > 0) {
        const beatSeconds = 60 / bpm
        const multiplier = BEAT_DIVISION_MULTIPLIER[settings.beatDivision] ?? 1
        return { seconds: clampWindow(beatSeconds * multiplier), cycleLocked: false }
      }
      // BPM unknown. Falling back to a hardcoded tempo would be a fabricated
      // musical claim, so use the fixed-time window instead.
      return { seconds: clampWindow(settings.secondsPerDisplay), cycleLocked: false }
    }

    case 'auto':
    default: {
      const minimum = clampWindow(Math.min(settings.autoMinimumSeconds, settings.autoMaximumSeconds))
      const maximum = clampWindow(Math.max(settings.autoMinimumSeconds, settings.autoMaximumSeconds))

      // Only trust the detected period when the estimator is reasonably sure.
      // Below that the display would re-scale on noise, which reads far worse
      // than a slightly wrong but stable window.
      if (periodSamples > 1 && periodConfidence >= 0.4) {
        const cycles = Math.max(0.25, settings.visibleCycles)
        const seconds = (periodSamples * cycles) / sampleRate
        return {
          seconds: Math.max(minimum, Math.min(maximum, seconds)),
          cycleLocked: true,
        }
      }

      const fallback = clampWindow(settings.secondsPerDisplay)
      return { seconds: Math.max(minimum, Math.min(maximum, fallback)), cycleLocked: false }
    }
  }
}

/**
 * Start offset of the display window within the captured buffer.
 *
 * Combines the trigger position, the pre-trigger ratio, and horizontal position
 * into one clamped read offset. Free-running (`triggerPosition < 0`) shows the
 * newest audio, which is what an untriggered scope does.
 */
export function resolveWindowStartOffset(
  triggerPosition: number,
  windowSamples: number,
  availableSamples: number,
  preTriggerRatio: number,
  horizontalPosition: number,
): number {
  const maxStart = Math.max(0, availableSamples - windowSamples)
  if (maxStart === 0) return 0

  const horizontalOffset = clampSigned(horizontalPosition) * windowSamples * 0.5

  if (triggerPosition < 0) {
    return Math.round(Math.max(0, Math.min(maxStart, maxStart - horizontalOffset)))
  }

  const preTrigger = clamp01(preTriggerRatio) * windowSamples
  const start = triggerPosition - preTrigger - horizontalOffset
  return Math.round(Math.max(0, Math.min(maxStart, start)))
}

function clampWindow(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0.02
  return Math.max(MIN_WINDOW_SECONDS, Math.min(MAX_WINDOW_SECONDS, seconds))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

function clampSigned(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < -1 ? -1 : value > 1 ? 1 : value
}
