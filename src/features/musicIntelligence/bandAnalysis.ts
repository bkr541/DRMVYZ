// Real-time multi-band audio analysis.
// Provides configurable frequency ranges, attack/release smoothing, rolling statistics,
// noise-floor estimation, and running-max normalization per band.

import { AttackReleaseFilter, RunningMax, PeakFollower, FeatureRingBuffer } from './featureSmoothing'
import type { CurveType } from './featureSmoothing'
import type { MIBands } from './types'

// ── Band configuration ────────────────────────────────────────────────────────

export interface BandConfig {
  name:          string
  loHz:          number
  hiHz:          number
  attackAlpha?:  number   // rise speed (0–1, higher = faster)
  releaseAlpha?: number   // fall speed (0–1, lower = slower decay)
  sensitivity?:  CurveType
}

// Chunk 2 band ranges: high/air split at 10 kHz for better detail in the upper spectrum
export const DEFAULT_BAND_CONFIGS: BandConfig[] = [
  { name: 'sub',    loHz:    20, hiHz:    60, attackAlpha: 0.70, releaseAlpha: 0.12 },
  { name: 'bass',   loHz:    60, hiHz:   250, attackAlpha: 0.60, releaseAlpha: 0.15 },
  { name: 'lowMid', loHz:   250, hiHz:  1000, attackAlpha: 0.50, releaseAlpha: 0.18 },
  { name: 'mid',    loHz:  1000, hiHz:  4000, attackAlpha: 0.45, releaseAlpha: 0.20 },
  { name: 'high',   loHz:  4000, hiHz: 10000, attackAlpha: 0.40, releaseAlpha: 0.22 },
  { name: 'air',    loHz: 10000, hiHz: 20000, attackAlpha: 0.35, releaseAlpha: 0.25 },
]

const ROLLING_WINDOW = 120  // ~2 s at 60 fps

// ── Extended per-band statistics ──────────────────────────────────────────────

export interface ExtendedBandStats {
  raw:          number  // direct FFT extraction, no smoothing
  smooth:       number  // attack/release smoothed
  normalized:   number  // smooth / running max, 0–1
  noiseFloor:   number  // slowly-tracked ambient minimum
  gain:         number  // (smooth - noiseFloor) / (1 - noiseFloor), 0–1
  rollingMin:   number  // minimum over last ~2 s
  rollingMax:   number  // maximum over last ~2 s
  rollingMean:  number  // mean over last ~2 s
  rollingPeak:  number  // peak follower with slow decay
}

// ── Band analysis result ──────────────────────────────────────────────────────

export interface BandAnalysisResult {
  sampleRate: number
  sub:    ExtendedBandStats
  bass:   ExtendedBandStats
  lowMid: ExtendedBandStats
  mid:    ExtendedBandStats
  high:   ExtendedBandStats
  air:    ExtendedBandStats
  volume: number
  bands:  MIBands  // MusicIntelligenceFrame-compatible output
}

// ── FFT band extraction ───────────────────────────────────────────────────────

export function getBandAvg(
  buf: Uint8Array<ArrayBuffer>,
  sampleRate: number,
  loHz: number,
  hiHz: number,
): number {
  const n   = buf.length
  const nyq = sampleRate / 2
  const lb  = Math.max(0, Math.floor((loHz / nyq) * n))
  const hb  = Math.min(n - 1, Math.ceil((hiHz / nyq) * n))
  if (hb <= lb) return 0
  let sum = 0
  for (let i = lb; i <= hb; i++) sum += buf[i]
  return sum / ((hb - lb + 1) * 255)
}

// ── Single-band analyzer ──────────────────────────────────────────────────────

class BandAnalyzer {
  private readonly ar      = new AttackReleaseFilter()
  private readonly runMax  = new RunningMax()
  private readonly peak    = new PeakFollower()
  private readonly history = new FeatureRingBuffer(ROLLING_WINDOW)
  private noiseFloor       = 0.001

  constructor(private readonly config: Required<BandConfig>) {}

  analyze(buf: Uint8Array<ArrayBuffer>, sampleRate: number): ExtendedBandStats {
    const raw    = getBandAvg(buf, sampleRate, this.config.loHz, this.config.hiHz)
    const smooth = this.ar.update(raw, this.config.attackAlpha, this.config.releaseAlpha)

    this.runMax.update(smooth)
    const normalized = this.runMax.normalize(smooth)

    // Slow noise-floor tracking: only update toward lower values
    if (smooth < this.noiseFloor * 1.5) {
      this.noiseFloor = this.noiseFloor * 0.9998 + smooth * 0.0002
    } else {
      this.noiseFloor *= 0.99998
    }
    const nf   = this.noiseFloor
    const gain = Math.max(0, Math.min(1, (smooth - nf) / Math.max(0.001, 1 - nf)))

    this.history.push(smooth)
    this.peak.update(smooth, 0.9990)

    return {
      raw,
      smooth,
      normalized,
      noiseFloor:  nf,
      gain,
      rollingMin:  this.history.min(),
      rollingMax:  this.history.max(),
      rollingMean: this.history.mean(),
      rollingPeak: this.peak.current,
    }
  }

  reset(): void {
    this.ar.reset()
    this.runMax.reset()
    this.peak.reset()
    this.history.reset()
    this.noiseFloor = 0.001
  }
}

// ── Multi-band analyzer (public) ──────────────────────────────────────────────

export class MultiBandAnalyzer {
  private readonly analyzers: BandAnalyzer[]

  constructor(configs: BandConfig[] = DEFAULT_BAND_CONFIGS) {
    this.analyzers = configs.map(c => new BandAnalyzer({
      name:         c.name,
      loHz:         c.loHz,
      hiHz:         c.hiHz,
      attackAlpha:  c.attackAlpha  ?? 0.5,
      releaseAlpha: c.releaseAlpha ?? 0.18,
      sensitivity:  c.sensitivity  ?? 'linear',
    }))
  }

  analyze(buf: Uint8Array<ArrayBuffer>, sampleRate: number): BandAnalysisResult {
    if (this.analyzers.length < 6) {
      throw new Error('MultiBandAnalyzer requires at least 6 band configs')
    }
    const [sub, bass, lowMid, mid, high, air] = this.analyzers.map(a => a.analyze(buf, sampleRate))

    const volume = Math.min(1, (
      sub.smooth    * 1.3 +
      bass.smooth   * 1.1 +
      lowMid.smooth * 0.9 +
      mid.smooth    * 0.7 +
      high.smooth   * 0.5 +
      air.smooth    * 0.3
    ) / 2.0)

    const bands: MIBands = {
      sub:    sub.smooth,
      bass:   bass.smooth,
      lowMid: lowMid.smooth,
      mid:    mid.smooth,
      high:   high.smooth,
      air:    air.smooth,
      volume,
      normalizedSub:    sub.normalized,
      normalizedBass:   bass.normalized,
      normalizedLowMid: lowMid.normalized,
      normalizedMid:    mid.normalized,
      normalizedHigh:   high.normalized,
      normalizedAir:    air.normalized,
    }

    return { sampleRate, sub, bass, lowMid, mid, high, air, volume, bands }
  }

  reset(): void {
    for (const a of this.analyzers) a.reset()
  }
}
