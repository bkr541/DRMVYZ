import { describe, expect, it } from 'vitest'
import type { BandAnalysisResult, ExtendedBandStats } from '../bandAnalysis'
import { RhythmAnalyzer } from '../rhythmAnalysis'

function stat(raw: number): ExtendedBandStats {
  return {
    raw,
    smooth: raw,
    normalized: raw,
    noiseFloor: 0,
    gain: raw,
    rollingMin: raw,
    rollingMax: raw,
    rollingMean: raw,
    rollingPeak: raw,
  }
}

function bands(options: { kick?: number; snare?: number; hat?: number } = {}): BandAnalysisResult {
  const kick = options.kick ?? 0
  const snare = options.snare ?? 0
  const hat = options.hat ?? 0
  const sub = stat(kick)
  const bass = stat(kick)
  const lowMid = stat(snare)
  const mid = stat(snare)
  const high = stat(hat)
  const air = stat(hat)
  return {
    sampleRate: 48_000,
    sub,
    bass,
    lowMid,
    mid,
    high,
    air,
    volume: Math.max(kick, snare, hat),
    bands: {
      sub: sub.smooth,
      bass: bass.smooth,
      lowMid: lowMid.smooth,
      mid: mid.smooth,
      high: high.smooth,
      air: air.smooth,
      volume: Math.max(kick, snare, hat),
      normalizedSub: sub.normalized,
      normalizedBass: bass.normalized,
      normalizedLowMid: lowMid.normalized,
      normalizedMid: mid.normalized,
      normalizedHigh: high.normalized,
      normalizedAir: air.normalized,
    },
  }
}

const FFT = new Uint8Array(64) as Uint8Array<ArrayBuffer>

function analyze(analyzer: RhythmAnalyzer, options: { kick?: number; snare?: number; hat?: number }) {
  return analyzer.analyze(FFT, bands(options), true)
}

describe('RhythmAnalyzer drum trigger hardening', () => {
  it('does not fabricate kick or snare when silence transitions to a steady nonzero level', () => {
    const analyzer = new RhythmAnalyzer()

    for (let i = 0; i < 4; i++) {
      const silent = analyze(analyzer, { kick: 0, snare: 0 })
      expect(silent.kickHit).toBe(false)
      expect(silent.snareHit).toBe(false)
    }

    for (let i = 0; i < 16; i++) {
      const steady = analyze(analyzer, { kick: 0.18, snare: 0.16 })
      expect(steady.kickHit).toBe(false)
      expect(steady.snareHit).toBe(false)
    }
  })

  it('detects distinct kick and snare transients after baseline acquisition', () => {
    const kickAnalyzer = new RhythmAnalyzer()
    for (let i = 0; i < 5; i++) analyze(kickAnalyzer, { kick: 0.1, snare: 0.1 })
    const kick = analyze(kickAnalyzer, { kick: 0.42, snare: 0.1 })
    expect(kick.kickHit).toBe(true)
    expect(kick.snareHit).toBe(false)

    const snareAnalyzer = new RhythmAnalyzer()
    for (let i = 0; i < 5; i++) analyze(snareAnalyzer, { kick: 0.1, snare: 0.1 })
    const snare = analyze(snareAnalyzer, { kick: 0.1, snare: 0.42 })
    expect(snare.kickHit).toBe(false)
    expect(snare.snareHit).toBe(true)
  })

  it('re-arms after cooldown so multiple spaced kick and snare events remain repeatable', () => {
    const analyzer = new RhythmAnalyzer()
    for (let i = 0; i < 5; i++) analyze(analyzer, { kick: 0.1, snare: 0.1 })

    let kickHits = 0
    let snareHits = 0
    const first = analyze(analyzer, { kick: 0.42, snare: 0.42 })
    kickHits += Number(first.kickHit)
    snareHits += Number(first.snareHit)

    for (let i = 0; i < 12; i++) analyze(analyzer, { kick: 0.1, snare: 0.1 })

    const second = analyze(analyzer, { kick: 0.42, snare: 0.42 })
    kickHits += Number(second.kickHit)
    snareHits += Number(second.snareHit)

    expect(kickHits).toBe(2)
    expect(snareHits).toBe(2)
  })

  it('reset discards detector baseline/cooldown so the next nonzero frame is baseline acquisition, not a hit', () => {
    const analyzer = new RhythmAnalyzer()
    for (let i = 0; i < 5; i++) analyze(analyzer, { kick: 0.1, snare: 0.1 })
    expect(analyze(analyzer, { kick: 0.42, snare: 0.42 }).kickHit).toBe(true)

    analyzer.reset()
    const afterReset = analyze(analyzer, { kick: 0.42, snare: 0.42 })
    expect(afterReset.kickHit).toBe(false)
    expect(afterReset.snareHit).toBe(false)
  })
})
