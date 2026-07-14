import { describe, expect, it } from 'vitest'
import { analyzeTrackBuffer } from '../offlineTrackAnalyzer'

function makeBuffer(durationSec: number, sampleRate = 8_000): AudioBuffer {
  const length = Math.max(1, Math.round(durationSec * sampleRate))
  const channel = new Float32Array(length)
  for (let index = 0; index < length; index++) {
    channel[index] = Math.sin(2 * Math.PI * 110 * index / sampleRate) * 0.2
  }
  return {
    duration: durationSec,
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => channel,
  } as unknown as AudioBuffer
}

describe('offline loaded-audio analysis performance safety', () => {
  it('cooperatively aborts during the CPU feature pass', async () => {
    const controller = new AbortController()
    const pending = analyzeTrackBuffer(makeBuffer(16), {
      fftSize: 256,
      hopSize: 128,
      maxCurvePoints: 80,
      seed: { source: 'analysis', bpm: 120, bpmConfidence: 0.9 },
      signal: controller.signal,
    })
    setTimeout(() => controller.abort(), 0)

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('uses one shared feature pass and retains bounded-cadence diagnostics', async () => {
    const result = await analyzeTrackBuffer(makeBuffer(4), {
      fftSize: 256,
      hopSize: 128,
      maxCurvePoints: 80,
      seed: { source: 'analysis', bpm: 120, bpmConfidence: 0.9 },
    })
    const diagnostics = result.analysisDiagnostics

    expect(diagnostics?.featureExtractionPassCount).toBe(1)
    expect(diagnostics?.retainedFeaturePointCount).toBeGreaterThan(0)
    expect(diagnostics?.retainedFeaturePointCount).toBeLessThan(diagnostics?.featureFrameCount ?? 0)
    expect(diagnostics?.retainedChromaFrameCount).toBeLessThan(diagnostics?.retainedFeaturePointCount ?? 0)
    expect(diagnostics?.similarityMatrixBytes ?? 0).toBeLessThanOrEqual(512 * 512 * 4)
  })

  it('keeps very short silent audio usable with explicit warnings and fallback metadata', async () => {
    const silent = makeBuffer(1)
    silent.getChannelData(0).fill(0)

    const result = await analyzeTrackBuffer(silent, {
      fftSize: 256,
      hopSize: 128,
      maxCurvePoints: 40,
    })

    expect(result.analysisWarnings?.map(warning => warning.code)).toEqual(
      expect.arrayContaining(['short_track', 'silent_track']),
    )
    expect(result.sections.length).toBeGreaterThan(0)
    expect(result.analysisDiagnostics?.usedFallback).toBe(true)
    expect(result.errors).toEqual([])
  })

})
