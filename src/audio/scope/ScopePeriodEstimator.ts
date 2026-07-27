/**
 * Fundamental-period estimation for trigger assistance and cycle-locked timebase.
 *
 * Uses the normalized square difference function (NSDF), the same family as
 * McLeod pitch tracking: it is bounded to −1..1, its peak height is directly
 * usable as a confidence value, and it is markedly less octave-prone than raw
 * autocorrelation, which is the failure that would show up as a scope trace
 * flipping between one and two visible cycles on sustained bass.
 *
 * Existing repository DSP was evaluated first, per the dependency policy:
 * `fftMagnitudes` in features/musicIntelligence/offlineTrackAnalyzer.ts returns
 * magnitudes only (no inverse transform for FFT-based autocorrelation) and
 * allocates three Float32Arrays per call, which is unsuitable for a per-frame
 * path. Music Intelligence exposes BPM and band energy, not a per-frame audio
 * period. So this estimator is local, allocation-free after construction, and
 * adds no dependency.
 */

const MIN_FREQUENCY_HZ = 20
const MAX_FREQUENCY_HZ = 2000

/** Target working length. Decimation keeps cost roughly constant per frame. */
const TARGET_ANALYSIS_SAMPLES = 1024

export interface ScopePeriodEstimate {
  /** Estimated period in samples at the original sample rate. 0 when unresolved. */
  periodSamples: number
  /** 0..1 confidence from the NSDF peak height. */
  confidence: number
}

export class ScopePeriodEstimator {
  private readonly work: Float32Array
  private readonly nsdf: Float32Array

  private smoothedPeriod = 0
  private smoothedConfidence = 0

  constructor(maxAnalysisSamples = TARGET_ANALYSIS_SAMPLES) {
    const size = Math.max(256, maxAnalysisSamples)
    this.work = new Float32Array(size)
    this.nsdf = new Float32Array(size >> 1)
  }

  reset(): void {
    this.smoothedPeriod = 0
    this.smoothedConfidence = 0
  }

  /**
   * Estimates the fundamental period of `samples[0..length)`.
   *
   * The returned value is temporally smoothed: a scope that re-picks its period
   * every frame produces a display whose visible cycle count flickers, which
   * reads as instability even when each individual estimate is defensible.
   */
  estimate(samples: Float32Array, length: number, sampleRate: number): ScopePeriodEstimate {
    const raw = this.estimateInstantaneous(samples, length, sampleRate)

    if (raw.confidence <= 0) {
      // Decay rather than snap to zero so a momentary dropout does not collapse
      // a cycle-locked timebase.
      this.smoothedConfidence *= 0.6
      if (this.smoothedConfidence < 0.05) {
        this.smoothedConfidence = 0
        this.smoothedPeriod = 0
      }
      return { periodSamples: this.smoothedPeriod, confidence: this.smoothedConfidence }
    }

    if (this.smoothedPeriod <= 0) {
      this.smoothedPeriod = raw.periodSamples
      this.smoothedConfidence = raw.confidence
      return { ...raw }
    }

    // Octave guard: prefer the candidate closest to the established period when
    // its half or double is an equally good explanation of the signal.
    const candidates = [raw.periodSamples, raw.periodSamples * 2, raw.periodSamples * 0.5]
    let best = raw.periodSamples
    let bestDistance = Infinity
    for (const candidate of candidates) {
      const distance = Math.abs(Math.log2(candidate / this.smoothedPeriod))
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }
    // Only accept an octave substitution when it is a genuinely close match;
    // otherwise the signal really did change and the raw estimate should win.
    const chosen = bestDistance < 0.12 ? best : raw.periodSamples

    const blend = 0.25 + raw.confidence * 0.35
    this.smoothedPeriod += (chosen - this.smoothedPeriod) * blend
    this.smoothedConfidence += (raw.confidence - this.smoothedConfidence) * 0.35

    return { periodSamples: this.smoothedPeriod, confidence: this.smoothedConfidence }
  }

  /** Unsmoothed single-window estimate. Exposed for deterministic testing. */
  estimateInstantaneous(
    samples: Float32Array,
    length: number,
    sampleRate: number,
  ): ScopePeriodEstimate {
    const usable = Math.min(length, samples.length)
    if (usable < 64 || !(sampleRate > 0)) return { periodSamples: 0, confidence: 0 }

    const decimation = Math.max(1, Math.floor(usable / this.work.length))
    const workLength = Math.min(this.work.length, Math.floor(usable / decimation))
    if (workLength < 64) return { periodSamples: 0, confidence: 0 }

    // Decimate and remove the mean; a DC offset otherwise dominates the NSDF.
    let sum = 0
    for (let i = 0; i < workLength; i++) {
      const value = samples[i * decimation]
      this.work[i] = value
      sum += value
    }
    const mean = sum / workLength
    let energy = 0
    for (let i = 0; i < workLength; i++) {
      this.work[i] -= mean
      energy += this.work[i] * this.work[i]
    }
    // Below this the window is silence or dither, and any "period" found is noise.
    if (energy / workLength < 1e-7) return { periodSamples: 0, confidence: 0 }

    const workSampleRate = sampleRate / decimation
    const minLag = Math.max(2, Math.floor(workSampleRate / MAX_FREQUENCY_HZ))
    const maxLag = Math.min(workLength >> 1, Math.floor(workSampleRate / MIN_FREQUENCY_HZ))
    if (maxLag <= minLag) return { periodSamples: 0, confidence: 0 }

    // NSDF: 2*r(tau) / m(tau), where r is autocorrelation and m is the summed
    // squared energy of both compared windows.
    for (let lag = minLag; lag <= maxLag; lag++) {
      let correlation = 0
      let magnitude = 0
      const limit = workLength - lag
      for (let i = 0; i < limit; i++) {
        const a = this.work[i]
        const b = this.work[i + lag]
        correlation += a * b
        magnitude += a * a + b * b
      }
      this.nsdf[lag] = magnitude > 1e-12 ? (2 * correlation) / magnitude : 0
    }

    // First peak above a fraction of the global maximum — the standard McLeod
    // pick, which avoids reporting an octave-down harmonic that happens to
    // correlate slightly better.
    let globalMax = 0
    for (let lag = minLag; lag <= maxLag; lag++) {
      if (this.nsdf[lag] > globalMax) globalMax = this.nsdf[lag]
    }
    if (globalMax <= 0.2) return { periodSamples: 0, confidence: 0 }

    const threshold = globalMax * 0.9
    let chosenLag = -1
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      const value = this.nsdf[lag]
      if (value > this.nsdf[lag - 1] && value >= this.nsdf[lag + 1] && value >= threshold) {
        chosenLag = lag
        break
      }
    }
    if (chosenLag < 0) return { periodSamples: 0, confidence: 0 }

    // Parabolic interpolation around the peak for sub-sample lag resolution.
    const previous = this.nsdf[chosenLag - 1]
    const current = this.nsdf[chosenLag]
    const next = this.nsdf[chosenLag + 1]
    const denominator = previous - 2 * current + next
    const offset = Math.abs(denominator) > 1e-12 ? (0.5 * (previous - next)) / denominator : 0
    const refinedLag = chosenLag + Math.max(-1, Math.min(1, offset))

    return {
      periodSamples: refinedLag * decimation,
      confidence: Math.max(0, Math.min(1, current)),
    }
  }
}
