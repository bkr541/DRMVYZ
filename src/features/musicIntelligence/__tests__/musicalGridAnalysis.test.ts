import { describe, expect, it } from 'vitest'
import {
  aggregateBarFeatures,
  buildBarMarkers,
  buildBeatMarkers,
  resolveDownbeatPhase,
  resolveMusicalGrid,
  type MusicalFeatureCurves,
} from '../musicalGridAnalysis'
import type { BeatMarkerMI, FeatureCurve } from '../types'

function curve(durationSec: number, valueAt: (timeSec: number) => number, stepSec = 0.25): FeatureCurve {
  const points: FeatureCurve = []
  for (let timeSec = 0; timeSec <= durationSec + 1e-9; timeSec += stepSec) {
    points.push({ timeSec, value: valueAt(Number(timeSec.toFixed(6))) })
  }
  return points
}

function phaseEvidence(durationSec: number, peakBeatIndices: number[], bpm = 120) {
  const beatPeriod = 60 / bpm
  const peakTimes = peakBeatIndices.map(index => Number((index * beatPeriod).toFixed(6)))
  const peaks = curve(durationSec, timeSec => peakTimes.some(peakTime => Math.abs(timeSec - peakTime) <= 0.13) ? 1 : 0)
  const energy = curve(durationSec, timeSec => {
    for (const peakTime of peakTimes) {
      if (timeSec >= peakTime && timeSec <= peakTime + 0.25) return 0.9
    }
    return 0.05
  })
  return {
    energy,
    transient: peaks,
    lowFrequencyOnset: peaks,
    highFrequencyOnset: peaks,
  }
}

function flatFeatures(durationSec: number, value = 0): MusicalFeatureCurves {
  const flat = curve(durationSec, () => value)
  return {
    energy: flat,
    bass: flat,
    mid: flat,
    high: flat,
    spectralFlux: flat,
    spectralCentroid: flat,
    spectralComplexity: flat,
    transient: flat,
    lowFrequencyOnset: flat,
    midFrequencyOnset: flat,
    highFrequencyOnset: flat,
    silence: curve(durationSec, () => value === 0 ? 1 : 0),
  }
}

describe('analysis-v2 downbeat phase resolution', () => {
  it('evaluates all four 4/4 phases and selects the strongest repeated phase', () => {
    const beats = buildBeatMarkers(120, 0, 10)
    const result = resolveDownbeatPhase(beats, phaseEvidence(10, [2, 6, 10, 14, 18]), { bpm: 120 })

    expect(result.phaseScores).toHaveLength(4)
    expect(result.phase).toBe(2)
    expect(result.phaseScores[2]).toBeGreaterThan(result.phaseScores[0])
    expect(result.fallbackReason).toBeNull()
  })

  it('keeps imported downbeats authoritative even when acoustic evidence favors another phase', () => {
    const beats = buildBeatMarkers(120, 0, 8)
    const importedDownbeats: BeatMarkerMI[] = [3, 7, 11].map(index => ({
      timeSec: beats[index]!.timeSec,
      confidence: 1,
      isDownbeat: true,
    }))
    const result = resolveDownbeatPhase(beats, phaseEvidence(8, [1, 5, 9, 13]), {
      bpm: 120,
      authoritativeDownbeats: importedDownbeats,
    })

    expect(result.phase).toBe(3)
    expect(result.authoritative).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
  })

  it('marks a deterministic phase-zero fallback when confidence is too low', () => {
    const beats = buildBeatMarkers(120, 0, 8)
    const features = phaseEvidence(8, [])
    const result = resolveDownbeatPhase(beats, features, { bpm: 120 })

    expect(result.phase).toBe(0)
    expect(result.fallbackReason).toBe('downbeat_phase_low_confidence')
    expect(result.confidence).toBeLessThan(0.42)
  })

  it('handles a first audible beat that is not beat one', () => {
    const beats = buildBeatMarkers(140, 0, 12)
    const result = resolveDownbeatPhase(beats, phaseEvidence(12, [2, 6, 10, 14, 18, 22], 140), { bpm: 140 })

    expect(result.phase).toBe(2)
  })
})

describe('analysis-v2 grid and bar foundations', () => {
  it('builds monotonic in-range beat and bar markers with explicit indices', () => {
    const beatGrid = buildBeatMarkers(128, 1.1, 12, { downbeatPhase: 2 })
    const bars = buildBarMarkers(beatGrid, 12, 'automatic', 0.8)

    expect(beatGrid.length).toBeGreaterThan(4)
    for (let index = 0; index < beatGrid.length; index++) {
      const beat = beatGrid[index]!
      expect(Number.isFinite(beat.timeSec)).toBe(true)
      expect(beat.timeSec).toBeGreaterThanOrEqual(0)
      expect(beat.timeSec).toBeLessThanOrEqual(12)
      expect(beat.beatIndex).toBe(index)
      if (index > 0) expect(beat.timeSec).toBeGreaterThan(beatGrid[index - 1]!.timeSec)
    }
    for (let index = 0; index < bars.length; index++) {
      expect(bars[index]!.endSec).toBeGreaterThan(bars[index]!.startSec)
      if (index > 0) expect(bars[index]!.startSec).toBeGreaterThanOrEqual(bars[index - 1]!.endSec - 1e-9)
    }
  })

  it('aggregates deterministic per-bar musical features without a second audio pass', () => {
    const durationSec = 4
    const beatGrid = buildBeatMarkers(120, 0, durationSec)
    const bars = buildBarMarkers(beatGrid, durationSec, 'automatic', 0.9)
    const features = flatFeatures(durationSec)
    features.energy = curve(durationSec, time => time < 2 ? time / 2 : 1 - (time - 2) / 2)
    features.bass = curve(durationSec, time => time < 2 ? 0.8 : 0.2)
    features.mid = curve(durationSec, () => 0.4)
    features.high = curve(durationSec, () => 0.3)
    features.spectralFlux = curve(durationSec, time => time === 0 || time === 2 ? 1 : 0)
    features.transient = features.spectralFlux
    features.lowFrequencyOnset = features.spectralFlux
    features.chromaFrames = [
      { timeSec: 0.5, values: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { timeSec: 2.5, values: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0] },
    ]

    const result = aggregateBarFeatures(bars, features, durationSec)

    expect(result).toHaveLength(2)
    expect(result[0]!.source).toBe('bar_grid')
    expect(result[0]!.meanEnergy).toBeGreaterThan(0)
    expect(result[0]!.peakEnergy).toBeGreaterThanOrEqual(result[0]!.meanEnergy)
    expect(result[0]!.bassAverage).toBeGreaterThan(result[1]!.bassAverage)
    expect(result[1]!.harmonicChange).toBeGreaterThan(0.9)
  })

  it('uses bounded time-window features for short tracks when no grid exists', () => {
    const features = flatFeatures(1.2, 0.2)
    const result = aggregateBarFeatures([], features, 1.2)

    expect(result.length).toBeGreaterThan(0)
    expect(result.every(feature => feature.source === 'time_window_fallback')).toBe(true)
    expect(result[result.length - 1]!.endSec).toBeCloseTo(1.2)
  })

  it('keeps silent tracks analyzable with an explicit legacy fallback', () => {
    const features = flatFeatures(6)
    const grid = resolveMusicalGrid({
      durationSec: 6,
      bpm: null,
      bpmConfidence: null,
      beatPhaseConfidence: null,
      beatOffsetSec: null,
      source: 'automatic',
      features,
    })
    const bars = aggregateBarFeatures(grid.bars, features, 6)

    expect(grid.info.source).toBe('legacy_fallback')
    expect(grid.info.fallbackReason).toBe('tempo_unavailable')
    expect(bars.every(feature => feature.silenceRatio === 1)).toBe(true)
  })
})
