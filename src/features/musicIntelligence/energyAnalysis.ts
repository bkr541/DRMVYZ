// Real-time energy analysis: RMS/peak, short/long-term energy smoothing,
// and heuristic music-intelligence metrics (buildProgress, dropImpact, tension, complexity).
// Integrates Meyda spectral features when available for improved accuracy.

import { EMAFilter, PeakFollower, FeatureRingBuffer } from './featureSmoothing'
import type { BandAnalysisResult } from './bandAnalysis'

// ── Smoothing constants (at 60 fps) ───────────────────────────────────────────
const ALPHA_MED   = 0.08   // ~12-frame smoothing (~200 ms)
const ALPHA_VSLOW = 0.002  // ~500-frame smoothing (~8 s)
const ENERGY_HISTORY = 300 // ~5 s ring buffer for percentile

// ── Meyda feature snapshot ────────────────────────────────────────────────────

export interface MeydaFeatureSnapshot {
  centroid: number  // Hz
  spread:   number
  rolloff:  number  // Hz
  flatness: number  // 0–1
}

// ── Energy analysis result ────────────────────────────────────────────────────

export interface EnergyAnalysisResult {
  instant:          number
  shortTerm:        number
  longTerm:         number
  peak:             number
  rms:              number
  crestFactor:      number
  spectralFlux:     number  // passed through from RhythmAnalyzer
  delta:            number  // instant - shortTerm
  percentile:       number  // 0–1 position in energy history
  buildProgress:    number
  dropImpact:       number
  tension:          number
  complexity:       number
  spectralCentroid: number  // normalized 0–1, 0 if Meyda unavailable
  spectralSpread:   number
  spectralRolloff:  number
  spectralFlatness: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRms(timeBuf: Uint8Array<ArrayBuffer> | null): number {
  if (!timeBuf || timeBuf.length === 0) return 0
  let sum = 0
  for (let i = 0; i < timeBuf.length; i++) {
    const s = (timeBuf[i] / 128) - 1
    sum += s * s
  }
  return Math.sqrt(sum / timeBuf.length)
}

function computePeak(timeBuf: Uint8Array<ArrayBuffer> | null): number {
  if (!timeBuf || timeBuf.length === 0) return 0
  let p = 0
  for (let i = 0; i < timeBuf.length; i++) {
    const s = Math.abs((timeBuf[i] / 128) - 1)
    if (s > p) p = s
  }
  return p
}

// ── Energy analyzer ───────────────────────────────────────────────────────────

export class EnergyAnalyzer {
  private readonly energyShort   = new EMAFilter()
  private readonly energyLong    = new EMAFilter()
  private readonly energyPeak    = new PeakFollower()
  private readonly energyHistory = new FeatureRingBuffer(ENERGY_HISTORY)
  private prevBuildProgress      = 0

  analyze(
    bands:        BandAnalysisResult,
    timeBuf:      Uint8Array<ArrayBuffer> | null,
    spectralFlux: number,
    meyda:        MeydaFeatureSnapshot | null,
    sampleRate:   number,
  ): EnergyAnalysisResult {
    const rms         = computeRms(timeBuf)
    const peak        = computePeak(timeBuf)
    const crestFactor = rms > 0.001 ? Math.min(20, peak / rms) : 1

    const instant   = bands.volume
    const shortTerm = this.energyShort.update(instant, ALPHA_MED)
    const longTerm  = this.energyLong.update(instant, ALPHA_VSLOW)
    const energyPk  = this.energyPeak.update(instant, 0.995)
    const delta     = instant - shortTerm

    this.energyHistory.push(instant)
    const percentile = this.energyHistory.percentile(instant)

    // High-frequency brightness (used for build/tension heuristics)
    const brightness = (bands.high.smooth + bands.air.smooth) * 0.5

    // buildProgress: energy rising above long-term + optional centroid rise
    const energyRatio     = longTerm > 0.01 ? Math.max(0, Math.min(1, (instant - longTerm) / longTerm)) : 0
    const brightnessRatio = longTerm > 0.01 ? Math.max(0, Math.min(1, brightness / Math.max(0.01, longTerm))) : 0

    let buildProgress: number
    if (meyda) {
      const nyq              = sampleRate / 2
      const normCentroid     = Math.min(1, meyda.centroid / Math.max(1, nyq * 0.3))
      buildProgress = 0.40 * energyRatio + 0.25 * brightnessRatio + 0.25 * normCentroid + 0.10 * spectralFlux * 5
    } else {
      buildProgress = 0.60 * energyRatio + 0.40 * brightnessRatio
    }
    buildProgress = Math.max(0, Math.min(1, buildProgress))
    this.prevBuildProgress = buildProgress

    // dropImpact: sudden energy spike above baseline, amplified by preceding build
    const dropImpact = longTerm > 0.01
      ? Math.max(0, Math.min(1,
          (instant - longTerm * 0.5) / Math.max(0.01, longTerm) * 0.7 +
          this.prevBuildProgress * 0.3,
        ))
      : 0

    // tension: spectral flux + energy delta + brightness (centroid if available)
    let tension: number
    if (meyda) {
      const nyq           = sampleRate / 2
      const normCentroid  = Math.min(1, meyda.centroid / Math.max(1, nyq * 0.5))
      tension = Math.min(1,
        0.35 * normCentroid +
        0.40 * Math.min(1, spectralFlux * 10) +
        0.25 * Math.max(0, delta * 5),
      )
    } else {
      tension = Math.min(1, spectralFlux * 10 + Math.max(0, delta * 5))
    }

    // complexity: spectral spread + tonal variety + high-frequency activity
    let complexity: number
    if (meyda) {
      const normSpread = Math.min(1, meyda.spread / Math.max(1, sampleRate / 8))
      complexity = Math.min(1,
        0.35 * normSpread +
        0.35 * Math.max(0, 1 - meyda.flatness) +
        0.30 * Math.min(1, brightness * 2),
      )
    } else {
      complexity = Math.min(1, spectralFlux * 15 + brightness)
    }

    // Normalize Meyda features to 0–1 for the frame
    let spectralCentroid = 0, spectralSpread = 0, spectralRolloff = 0, spectralFlatness = 0
    if (meyda) {
      const nyq = sampleRate / 2
      spectralCentroid  = Math.max(0, Math.min(1, meyda.centroid / Math.max(1, nyq)))
      spectralSpread    = Math.max(0, Math.min(1, meyda.spread   / Math.max(1, nyq)))
      spectralRolloff   = Math.max(0, Math.min(1, meyda.rolloff  / Math.max(1, nyq)))
      spectralFlatness  = Math.max(0, Math.min(1, meyda.flatness))
    }

    return {
      instant,
      shortTerm,
      longTerm,
      peak:          energyPk,
      rms,
      crestFactor,
      spectralFlux,
      delta,
      percentile,
      buildProgress,
      dropImpact,
      tension,
      complexity,
      spectralCentroid,
      spectralSpread,
      spectralRolloff,
      spectralFlatness,
    }
  }

  reset(): void {
    this.energyShort.reset()
    this.energyLong.reset()
    this.energyPeak.reset()
    this.energyHistory.reset()
    this.prevBuildProgress = 0
  }
}
