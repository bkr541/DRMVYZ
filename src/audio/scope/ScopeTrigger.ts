import type { ScopeTriggerResult, ScopeTriggerSettings } from './scopeTypes'

/** Maximum crossings examined per frame. Bounds cost on dense material. */
const MAX_CANDIDATES = 64

interface TriggerCandidate {
  /** Fractional sample index of the level crossing. */
  position: number
  /** |slope| at the crossing; strong edges make steadier locks. */
  strength: number
}

/**
 * Schmitt-style trigger with holdoff, sub-sample interpolation, and continuity.
 *
 * Without this stage the display starts at whatever sample the buffer happened
 * to begin with, so a steady tone slides horizontally frame to frame. The
 * hysteresis band prevents a noisy signal from re-triggering on the same edge,
 * holdoff prevents locking to a different crossing within one complex period,
 * and the continuity cost keeps the trace from hopping between equally valid
 * crossings — which is what separates a stable instrument from a correct but
 * restless one.
 */
export class ScopeTrigger {
  private armed = false
  private previousSample = 0
  private hasPreviousSample = false

  /** Trigger position within the previous window, in samples. −1 when none. */
  private lastTriggerPosition = -1
  /**
   * Trigger position in absolute capture-frame coordinates.
   *
   * Continuity must be judged in absolute terms: the capture window advances
   * every frame, so two equal within-window indices are different instants and
   * comparing them would make the trigger chase the window rather than the
   * signal.
   */
  private lastAbsolutePosition = -1
  private lastPeriodSamples = 0
  private confidence = 0
  private secondsSinceAcquisition = 0

  /** Set once a 'single' trigger has fired; blocks further acquisition. */
  private singleLatched = false

  reset(): void {
    this.armed = false
    this.previousSample = 0
    this.hasPreviousSample = false
    this.lastTriggerPosition = -1
    this.lastAbsolutePosition = -1
    this.lastPeriodSamples = 0
    this.confidence = 0
    this.secondsSinceAcquisition = 0
    this.singleLatched = false
  }

  /** Re-arms a latched 'single' trigger. */
  rearmSingle(): void {
    this.singleLatched = false
  }

  /**
   * Locates the trigger point in `samples[0..length)`.
   *
   * @param periodSamples Estimated fundamental period, or 0 when unknown.
   * @param periodConfidence 0..1 confidence in that estimate.
   * @param deltaSeconds Wall time since the previous call, for holdoff/fallback.
   * @param windowStartFrame Absolute capture-frame index of `samples[0]`.
   *        Required for cross-frame continuity; 0 is safe for a single call.
   */
  process(
    samples: Float32Array,
    length: number,
    sampleRate: number,
    settings: ScopeTriggerSettings,
    periodSamples: number,
    periodConfidence: number,
    deltaSeconds: number,
    windowStartFrame = 0,
  ): ScopeTriggerResult {
    this.secondsSinceAcquisition += Math.max(0, deltaSeconds)

    if (settings.mode === 'freeRun') {
      this.confidence = 0
      return this.freeRunResult(periodSamples)
    }
    if (settings.mode === 'single' && this.singleLatched) {
      // Hold the frozen position exactly; that is the point of single-shot.
      return {
        position: this.lastTriggerPosition,
        acquired: false,
        freeRunning: this.lastTriggerPosition < 0,
        confidence: this.confidence,
        periodSamples: this.lastPeriodSamples,
      }
    }

    const usable = Math.min(length, samples.length)
    if (usable < 4) return this.freeRunResult(periodSamples)

    const holdoffSamples = Math.max(0, settings.holdoffSeconds * sampleRate)
    const candidates = this.collectCandidates(samples, usable, settings, holdoffSamples)

    if (candidates.length === 0) {
      return this.handleAcquisitionFailure(settings, periodSamples)
    }

    const chosen = this.selectCandidate(
      candidates, settings, periodSamples, periodConfidence, usable, windowStartFrame,
    )

    this.lastPeriodSamples = periodSamples > 0 ? periodSamples : this.lastPeriodSamples
    this.lastTriggerPosition = chosen.position
    this.lastAbsolutePosition = windowStartFrame + chosen.position
    this.confidence = Math.max(0, Math.min(1, 0.5 + Math.min(0.5, chosen.strength * 4)))
    this.secondsSinceAcquisition = 0
    if (settings.mode === 'single') this.singleLatched = true

    return {
      position: chosen.position,
      acquired: true,
      freeRunning: false,
      confidence: this.confidence,
      periodSamples: this.lastPeriodSamples,
    }
  }

  /**
   * Walks the window collecting Schmitt-qualified level crossings.
   *
   * Arming is the Schmitt half of this: for a rising trigger the signal must
   * first fall below `level - hysteresis` before a crossing above
   * `level + hysteresis` counts. A signal hovering at the level therefore
   * produces one trigger, not one per sample of jitter.
   */
  private collectCandidates(
    samples: Float32Array,
    length: number,
    settings: ScopeTriggerSettings,
    holdoffSamples: number,
  ): TriggerCandidate[] {
    const level = settings.level
    const hysteresis = Math.max(0, settings.hysteresis)
    const upper = level + hysteresis
    const lower = level - hysteresis
    const slope = settings.slope

    const candidates: TriggerCandidate[] = []
    let lastAcceptedPosition = -Infinity

    // Per-frame arming state. Carrying arming across frames would let a stale
    // arm from a window the user has already scrolled past fire a trigger.
    let armedRising = false
    let armedFalling = false

    let previous = samples[0]
    for (let i = 1; i < length; i++) {
      const current = samples[i]

      if (previous < lower) armedRising = true
      if (previous > upper) armedFalling = true

      let crossed = false
      let crossingLevel = level

      if ((slope === 'rising' || slope === 'either') && armedRising && previous <= upper && current > upper) {
        crossed = true
        crossingLevel = upper
        armedRising = false
      } else if (
        (slope === 'falling' || slope === 'either') &&
        armedFalling &&
        previous >= lower &&
        current < lower
      ) {
        crossed = true
        crossingLevel = lower
        armedFalling = false
      }

      if (crossed) {
        const position = interpolateCrossing(previous, current, crossingLevel, i - 1)
        if (position - lastAcceptedPosition >= holdoffSamples) {
          candidates.push({ position, strength: Math.abs(current - previous) })
          lastAcceptedPosition = position
          if (candidates.length >= MAX_CANDIDATES) break
        }
      }

      previous = current
    }

    this.previousSample = previous
    this.hasPreviousSample = true
    this.armed = armedRising || armedFalling
    return candidates
  }

  /**
   * Scores candidates against phase continuity with the previous frame,
   * proximity within the current window, and raw edge strength.
   */
  private selectCandidate(
    candidates: TriggerCandidate[],
    settings: ScopeTriggerSettings,
    periodSamples: number,
    periodConfidence: number,
    windowLength: number,
    windowStartFrame: number,
  ): TriggerCandidate {
    if (candidates.length === 1) return candidates[0]

    const continuityWeight = clamp01(settings.continuityWeight)
    const periodWeight = clamp01(settings.periodAssist) * clamp01(periodConfidence)
    const hasHistory = this.lastAbsolutePosition >= 0
    const usePeriod = periodWeight > 0 && periodSamples > 1

    let best = candidates[0]
    let bestCost = Infinity

    for (const candidate of candidates) {
      // Edge strength is the tiebreaker, not the driver: the strongest crossing
      // in a window is frequently not the one that continues the trace.
      let cost = -candidate.strength * 0.5

      if (hasHistory && usePeriod) {
        // A candidate an integer number of periods from the last trigger shows
        // the waveform at an identical phase. This is the dominant term, since
        // it is precisely what stops the trace from sliding.
        const absolute = windowStartFrame + candidate.position
        const periodsAway = (absolute - this.lastAbsolutePosition) / periodSamples
        const phaseError = Math.abs(periodsAway - Math.round(periodsAway)) // 0..0.5
        cost += periodWeight * phaseError * 8
      }

      if (hasHistory && continuityWeight > 0 && this.lastTriggerPosition >= 0) {
        // Secondary preference for staying near the previous within-window
        // position, which keeps the display from hopping between distant
        // crossings when no period is known.
        const drift = Math.abs(candidate.position - this.lastTriggerPosition) / Math.max(1, windowLength)
        cost += continuityWeight * drift * 2
      }

      if (cost < bestCost) {
        bestCost = cost
        best = candidate
      }
    }

    return best
  }

  /**
   * Auto mode reuses the last good trigger briefly, decaying confidence, then
   * falls back to free-run. Normal mode holds the last trigger indefinitely,
   * which is the traditional behavior. Neither freezes on stale samples: the
   * position is reused, the audio drawn through it is always current.
   */
  private handleAcquisitionFailure(
    settings: ScopeTriggerSettings,
    periodSamples: number,
  ): ScopeTriggerResult {
    if (settings.mode === 'auto' && this.secondsSinceAcquisition >= settings.autoFallbackSeconds) {
      this.confidence = 0
      this.lastTriggerPosition = -1
      this.lastAbsolutePosition = -1
      return this.freeRunResult(periodSamples)
    }

    if (this.lastTriggerPosition < 0) {
      this.confidence = 0
      return this.freeRunResult(periodSamples)
    }

    this.confidence = Math.max(0, this.confidence - 0.12)
    return {
      position: this.lastTriggerPosition,
      acquired: false,
      freeRunning: false,
      confidence: this.confidence,
      periodSamples: this.lastPeriodSamples,
    }
  }

  private freeRunResult(periodSamples: number): ScopeTriggerResult {
    return {
      position: -1,
      acquired: false,
      freeRunning: true,
      confidence: 0,
      periodSamples: periodSamples > 0 ? periodSamples : this.lastPeriodSamples,
    }
  }

  /** Exposed for tests and diagnostics; not part of the render contract. */
  get diagnostics(): { armed: boolean; previousSample: number; hasPreviousSample: boolean } {
    return {
      armed: this.armed,
      previousSample: this.previousSample,
      hasPreviousSample: this.hasPreviousSample,
    }
  }
}

/**
 * Sub-sample crossing estimate by linear interpolation between the bracketing
 * samples. Without it the trace can only start on integer samples, which at a
 * short timebase is a visible one-pixel horizontal twitch every frame.
 */
export function interpolateCrossing(
  sampleA: number,
  sampleB: number,
  level: number,
  indexA: number,
): number {
  const delta = sampleB - sampleA
  if (Math.abs(delta) < 1e-12) return indexA
  const fraction = (level - sampleA) / delta
  return indexA + Math.max(0, Math.min(1, fraction))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}
