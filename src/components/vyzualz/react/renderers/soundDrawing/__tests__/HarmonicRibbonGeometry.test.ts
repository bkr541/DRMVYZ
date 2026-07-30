import { describe, expect, it } from 'vitest'
import {
  HARMONIC_RIBBON_BAND_LAYOUT,
  buildHarmonicRibbonSignalBands,
  resolveHarmonicRibbonHistoryPresentationAlpha,
  resolveHarmonicRibbonTraceOffsets,
} from '../HarmonicRibbonGeometry'
import { resolveSoundDrawingPrimaryTraceCount } from '../../../soundDrawing/SoundDrawingPerformanceEngine'
import { SOUND_DRAWING_PERFORMANCE_SHOWS } from '../../../soundDrawing/SoundDrawingPerformanceShows'

function totalVariation(signal: Float32Array): number {
  let variation = 0
  for (let i = 1; i < signal.length; i++) variation += Math.abs((signal[i] ?? 0) - (signal[i - 1] ?? 0))
  return variation
}

function syntheticCapture(length = 512): Uint8Array<ArrayBuffer> {
  const values = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    const phase = (i / length) * Math.PI * 2
    const sample =
      Math.sin(phase * 2) * 0.46 +
      Math.sin(phase * 9) * 0.24 +
      Math.sin(phase * 31) * 0.12
    values[i] = Math.max(0, Math.min(255, Math.round(128 + sample * 120)))
  }
  return values
}

describe('Harmonic Ribbon geometry', () => {
  it('keeps all three band envelopes separated by visible black space', () => {
    for (let i = 1; i < HARMONIC_RIBBON_BAND_LAYOUT.length; i++) {
      const previous = HARMONIC_RIBBON_BAND_LAYOUT[i - 1]
      const current = HARMONIC_RIBBON_BAND_LAYOUT[i]
      const gap = current.centerRatio - current.amplitudeRatio - (previous.centerRatio + previous.amplitudeRatio)
      expect(gap).toBeGreaterThan(0.05)
    }
  })

  it('produces phase-coherent bands with progressively smoother detail', () => {
    const bands = buildHarmonicRibbonSignalBands(syntheticCapture())
    expect(bands.high).toHaveLength(256)
    expect(bands.mid).toHaveLength(256)
    expect(bands.low).toHaveLength(256)
    expect(totalVariation(bands.high)).toBeGreaterThan(totalVariation(bands.mid))
    expect(totalVariation(bands.mid)).toBeGreaterThan(totalVariation(bands.low))
    for (const band of [bands.high, bands.mid, bands.low]) {
      expect([...band].every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1)).toBe(true)
    }
  })

  it('does not amplify silence into visible noise', () => {
    const silence = new Uint8Array(512).fill(128)
    const bands = buildHarmonicRibbonSignalBands(silence)
    expect([...bands.high, ...bands.mid, ...bands.low].every(sample => sample === 0)).toBe(true)
  })

  it('returns the exact requested number of simultaneous, symmetric traces', () => {
    for (let count = 1; count <= 6; count++) {
      const offsets = resolveHarmonicRibbonTraceOffsets(count)
      expect(offsets).toHaveLength(count)
      expect(offsets.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 10)
    }
  })

  it('keeps history subordinate to current geometry', () => {
    expect(resolveHarmonicRibbonHistoryPresentationAlpha(0)).toBe(0)
    expect(resolveHarmonicRibbonHistoryPresentationAlpha(0.24)).toBeCloseTo(0.216)
    expect(resolveHarmonicRibbonHistoryPresentationAlpha(1)).toBe(0.38)
  })

  it('preserves section-authored trace density while Complexity scales within it', () => {
    expect(resolveSoundDrawingPrimaryTraceCount('harmonicRibbon', 2, 5, 1)).toBe(2)
    expect(resolveSoundDrawingPrimaryTraceCount('harmonicRibbon', 4, 5, 1)).toBe(4)
    expect(resolveSoundDrawingPrimaryTraceCount('harmonicRibbon', 5, 5, 1)).toBe(5)
    expect(resolveSoundDrawingPrimaryTraceCount('harmonicRibbon', 4, 5, 0)).toBe(1)
  })

  it('authors Harmonic Ribbon as one uncluttered primary system in every base scene', () => {
    const show = SOUND_DRAWING_PERFORMANCE_SHOWS.find(candidate => candidate.id === 'harmonicRibbonReactor')
    expect(show).toBeDefined()
    for (const candidate of show!.program.scenes) {
      const sceneAction = candidate.actions?.find(action => action.type === 'scene')
      expect(sceneAction?.type).toBe('scene')
      if (sceneAction?.type !== 'scene') continue
      expect(sceneAction.layers).toHaveLength(1)
      expect(sceneAction.layers[0]?.role).toBe('primaryMotif')
      expect(sceneAction.layers[0]?.generator).toBe('harmonicRibbon')
      expect(sceneAction.layers[0]?.trailPersistence ?? 0).toBeLessThanOrEqual(0.22)
    }
  })
})
