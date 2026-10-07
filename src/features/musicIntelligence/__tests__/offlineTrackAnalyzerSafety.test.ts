import { describe, expect, it } from 'vitest'
import { analyzeTrackBuffer, detectAudioBufferMusicalKey } from '../offlineTrackAnalyzer'

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
  it('detects a focused upload-time musical key without full structural analysis', async () => {
    const sampleRate = 8_000
    const durationSec = 4
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
    const profileTotal = majorProfile.reduce((sum, weight) => sum + weight, 0)
    const channel = new Float32Array(sampleRate * durationSec)
    for (let index = 0; index < channel.length; index++) {
      channel[index] = majorProfile.reduce(
        (sum, weight, pitchClass) => sum
          + Math.sin(2 * Math.PI * (261.63 * 2 ** (pitchClass / 12)) * index / sampleRate) * weight / profileTotal,
        0,
      )
    }
    const buffer = {
      duration: durationSec,
      sampleRate,
      length: channel.length,
      numberOfChannels: 1,
      getChannelData: () => channel,
    } as unknown as AudioBuffer

    await expect(detectAudioBufferMusicalKey(buffer, { fftSize: 1024 })).resolves.toMatchObject({
      key: 'C',
      mode: 'major',
    })
  })

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
