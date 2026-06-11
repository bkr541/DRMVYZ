// Real-time rhythm analysis: spectral-flux onset detection with adaptive thresholding,
// and per-drum (kick/snare/hat) detection with cooldowns and confidence scoring.

import { EMAFilter, FeatureRingBuffer } from './featureSmoothing'
import type { BandAnalysisResult } from './bandAnalysis'

// ── Adaptive onset detector ───────────────────────────────────────────────────
// Maintains a sliding window of recent spectral flux values and fires when the
// current frame exceeds mean * multiplier. Adapts automatically to the song's
// dynamic range so it doesn't saturate on loud sections.

const ONSET_WINDOW      = 43    // ~0.7 s at 60 fps
const ONSET_MULTIPLIER  = 1.5   // threshold = window_mean * multiplier
const ONSET_MIN         = 0.002 // ignore near-silence (no false positives on silent audio)

class AdaptiveOnsetDetector {
  private readonly history     = new FeatureRingBuffer(ONSET_WINDOW)
  private prevFreqNorm: Float32Array | null = null

  update(freqBuf: Uint8Array<ArrayBuffer>): { flux: number; threshold: number } {
    const n = freqBuf.length
    let flux = 0

    if (this.prevFreqNorm && this.prevFreqNorm.length === n) {
      for (let i = 0; i < n; i++) {
        const delta = freqBuf[i] / 255 - this.prevFreqNorm[i]
        if (delta > 0) flux += delta
      }
      flux /= n
    }

    if (!this.prevFreqNorm || this.prevFreqNorm.length !== n) {
      this.prevFreqNorm = new Float32Array(n)
    }
    for (let i = 0; i < n; i++) this.prevFreqNorm[i] = freqBuf[i] / 255

    this.history.push(flux)
    const threshold = Math.max(ONSET_MIN, this.history.mean() * ONSET_MULTIPLIER)
    return { flux, threshold }
  }

  reset(): void {
    this.history.reset()
    this.prevFreqNorm = null
  }
}

// ── Per-drum onset detector ───────────────────────────────────────────────────
// Each drum type has its own EMA baseline, adaptive threshold, and cooldown.
// A "hit" fires once per onset and cannot re-fire during the cooldown window.

interface DrumHit {
  hit:        boolean
  strength:   number
  confidence: number
}

class DrumHitDetector {
  private readonly baseline = new EMAFilter()
  private cooldown          = 0

  constructor(
    private readonly cooldownFrames: number,
    private readonly hitThreshold:   number,
    private readonly presenceMin:    number = 0.03,
  ) {}

  update(signal: number, isPlaying: boolean): DrumHit {
    const baseline = this.baseline.update(signal, 0.08)  // medium EMA tracks local level
    const onset    = baseline > 0.005
      ? Math.max(0, (signal - baseline) / baseline)
      : 0
    const strength = Math.min(1, onset)

    if (this.cooldown > 0) this.cooldown--

    const hit = isPlaying &&
      strength  > this.hitThreshold &&
      signal    > this.presenceMin  &&
      this.cooldown === 0

    if (hit) this.cooldown = this.cooldownFrames

    return { hit, strength, confidence: Math.min(1, strength * 1.5) }
  }

  reset(): void {
    this.baseline.reset()
    this.cooldown = 0
  }
}

// ── Public rhythm analysis result ─────────────────────────────────────────────

export interface RhythmAnalysisResult {
  spectralFlux:        number
  adaptiveThreshold:   number
  transient:           number
  transientConfidence: number
  kickHit:             boolean
  kickStrength:        number
  kickConfidence:      number
  snareHit:            boolean
  snareStrength:       number
  snareConfidence:     number
  hatHit:              boolean
  hatStrength:         number
  hatConfidence:       number
}

// ── Rhythm analyzer (public) ──────────────────────────────────────────────────

export class RhythmAnalyzer {
  private readonly onsetDetector = new AdaptiveOnsetDetector()

  // Kick: 9-frame cooldown (~150 ms) prevents double-trigger on heavy low-end
  private readonly kickDetector  = new DrumHitDetector(9, 0.50, 0.04)
  // Snare: slightly higher threshold to distinguish body from bleed
  private readonly snareDetector = new DrumHitDetector(9, 0.55, 0.03)
  // Hat: 3-frame cooldown (~50 ms) allows 16th-note hats at 120+ BPM
  private readonly hatDetector   = new DrumHitDetector(3, 0.45, 0.02)

  analyze(
    freqBuf:   Uint8Array<ArrayBuffer>,
    bands:     BandAnalysisResult,
    isPlaying: boolean,
  ): RhythmAnalysisResult {
    const { flux, threshold } = this.onsetDetector.update(freqBuf)

    // Kick: dominant in sub + bass (20–250 Hz)
    const kickSignal  = bands.sub.raw  * 0.6 + bands.bass.raw * 0.4
    const kick        = this.kickDetector.update(kickSignal, isPlaying)

    // Snare: body in lowMid (250–1k Hz), presence in mid (1–4k Hz)
    const snareSignal = bands.lowMid.raw * 0.35 + bands.mid.raw * 0.65
    const snare       = this.snareDetector.update(snareSignal, isPlaying)

    // Hat: high (4–10k Hz) + air (10–20k Hz) transients
    const hatSignal   = bands.high.raw * 0.6 + bands.air.raw * 0.4
    const hat         = this.hatDetector.update(hatSignal, isPlaying)

    const transient = Math.min(1,
      kick.strength  * 0.5 +
      snare.strength * 0.3 +
      hat.strength   * 0.2
    )
    const transientConfidence = Math.min(1,
      kick.confidence  * 0.4 +
      snare.confidence * 0.3 +
      hat.confidence   * 0.3
    )

    return {
      spectralFlux:        flux,
      adaptiveThreshold:   threshold,
      transient,
      transientConfidence,
      kickHit:        kick.hit,
      kickStrength:   kick.strength,
      kickConfidence: kick.confidence,
      snareHit:       snare.hit,
      snareStrength:  snare.strength,
      snareConfidence: snare.confidence,
      hatHit:         hat.hit,
      hatStrength:    hat.strength,
      hatConfidence:  hat.confidence,
    }
  }

  reset(): void {
    this.onsetDetector.reset()
    this.kickDetector.reset()
    this.snareDetector.reset()
    this.hatDetector.reset()
  }
}
