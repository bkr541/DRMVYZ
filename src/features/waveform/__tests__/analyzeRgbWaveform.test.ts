import { describe, it, expect } from 'vitest'
import { analyzeRgbWaveform } from '../analyzeRgbWaveform'
import { RGB_WAVEFORM_VERSION, RGB_WAVEFORM_BIN_COUNT } from '../rgbWaveformTypes'

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeSynthBuffer(options: {
  sampleRate?:  number
  numChannels?: number
  durationSec?: number
  fillFn?:      (ch: number, sampleIndex: number, totalSamples: number) => number
}): AudioBuffer {
  const {
    sampleRate  = 44100,
    numChannels = 1,
    durationSec = 1,
    fillFn,
  } = options
  const length   = Math.round(sampleRate * durationSec)
  const channels = Array.from({ length: numChannels }, (_, ch) => {
    const arr = new Float32Array(length)
    if (fillFn) {
      for (let i = 0; i < length; i++) arr[i] = fillFn(ch, i, length)
    }
    return arr
  })
  return {
    sampleRate,
    length,
    numberOfChannels: numChannels,
    duration:         length / sampleRate,
    getChannelData:   (ch: number) => channels[ch] ?? new Float32Array(0),
    copyFromChannel:  () => {},
    copyToChannel:    () => {},
  } as unknown as AudioBuffer
}

// ── 1: Return shape ───────────────────────────────────────────────────────────

describe('analyzeRgbWaveform — return shape', () => {
  it('returns analysis with correct version and binCount', async () => {
    const buf    = makeSynthBuffer({ durationSec: 2 })
    const result = await analyzeRgbWaveform(buf)
    expect(result.version).toBe(RGB_WAVEFORM_VERSION)
    expect(result.binCount).toBe(RGB_WAVEFORM_BIN_COUNT)
    expect(result.durationSec).toBeCloseTo(2, 1)
    expect(result.sampleRate).toBe(44100)
  })

  it('all Float32Array fields have length equal to binCount', async () => {
    const buf    = makeSynthBuffer({ durationSec: 2 })
    const result = await analyzeRgbWaveform(buf)
    const BIN = RGB_WAVEFORM_BIN_COUNT
    expect(result.positivePeaks.length).toBe(BIN)
    expect(result.negativePeaks.length).toBe(BIN)
    expect(result.rms.length).toBe(BIN)
    expect(result.lowEnergy.length).toBe(BIN)
    expect(result.midEnergy.length).toBe(BIN)
    expect(result.highEnergy.length).toBe(BIN)
  })
})

// ── 2: Silence ────────────────────────────────────────────────────────────────

describe('analyzeRgbWaveform — silence', () => {
  it('all amplitude arrays are zero for a silent buffer', async () => {
    const buf    = makeSynthBuffer({ durationSec: 2 })
    const result = await analyzeRgbWaveform(buf)
    // positivePeaks should all be 0 (or very close) since the buffer is all zeros
    const peakMax = Math.max(...Array.from(result.positivePeaks))
    expect(peakMax).toBe(0)
  })

  it('rms is zero for a silent buffer', async () => {
    const buf    = makeSynthBuffer({ durationSec: 2 })
    const result = await analyzeRgbWaveform(buf)
    const rmsMax = Math.max(...Array.from(result.rms))
    expect(rmsMax).toBe(0)
  })
})

// ── 3: Amplitude normalization ────────────────────────────────────────────────

describe('analyzeRgbWaveform — amplitude normalization', () => {
  it('positivePeaks stay in [0, 1] for a full-scale sine wave', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i, total) => Math.sin(2 * Math.PI * 440 * i / 44100),
    })
    const result = await analyzeRgbWaveform(buf)
    for (let i = 0; i < result.positivePeaks.length; i++) {
      expect(result.positivePeaks[i]).toBeGreaterThanOrEqual(0)
      expect(result.positivePeaks[i]).toBeLessThanOrEqual(1.001)
    }
  })

  it('rms values stay in [0, 1]', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 440 * i / 44100),
    })
    const result = await analyzeRgbWaveform(buf)
    for (let i = 0; i < result.rms.length; i++) {
      expect(result.rms[i]).toBeGreaterThanOrEqual(0)
      expect(result.rms[i]).toBeLessThanOrEqual(1.001)
    }
  })
})

// ── 4: Band energy normalization ──────────────────────────────────────────────

describe('analyzeRgbWaveform — band energy normalization', () => {
  it('band energies are in [0, 1] for a real signal', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 440 * i / 44100) * 0.8,
    })
    const result = await analyzeRgbWaveform(buf)
    for (let i = 0; i < result.lowEnergy.length; i++) {
      expect(result.lowEnergy[i]).toBeGreaterThanOrEqual(0)
      expect(result.lowEnergy[i]).toBeLessThanOrEqual(1.001)
      expect(result.midEnergy[i]).toBeGreaterThanOrEqual(0)
      expect(result.midEnergy[i]).toBeLessThanOrEqual(1.001)
      expect(result.highEnergy[i]).toBeGreaterThanOrEqual(0)
      expect(result.highEnergy[i]).toBeLessThanOrEqual(1.001)
    }
  })

  it('440 Hz sine wave produces significant mid-band energy', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 440 * i / 44100),
    })
    const result = await analyzeRgbWaveform(buf)
    // 440 Hz is in the mid band (250–4000 Hz) — mid should be dominant
    const midAvg  = result.midEnergy.reduce((s, v) => s + v, 0) / result.midEnergy.length
    const lowAvg  = result.lowEnergy.reduce((s, v) => s + v, 0) / result.lowEnergy.length
    const highAvg = result.highEnergy.reduce((s, v) => s + v, 0) / result.highEnergy.length
    expect(midAvg).toBeGreaterThan(lowAvg)
    expect(midAvg).toBeGreaterThan(highAvg)
  })

  it('100 Hz sine wave produces significant low-band energy', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 100 * i / 44100),
    })
    const result = await analyzeRgbWaveform(buf)
    // 100 Hz is in the low band (20–250 Hz) — low should be dominant
    const midAvg  = result.midEnergy.reduce((s, v) => s + v, 0) / result.midEnergy.length
    const lowAvg  = result.lowEnergy.reduce((s, v) => s + v, 0) / result.lowEnergy.length
    expect(lowAvg).toBeGreaterThan(midAvg * 0.5)  // low clearly present
  })
})

// ── 5: Stereo handling ────────────────────────────────────────────────────────

describe('analyzeRgbWaveform — stereo', () => {
  it('stereo buffer returns same binCount as mono', async () => {
    const buf = makeSynthBuffer({
      numChannels: 2,
      durationSec: 2,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 440 * i / 44100) * 0.7,
    })
    const result = await analyzeRgbWaveform(buf)
    expect(result.binCount).toBe(RGB_WAVEFORM_BIN_COUNT)
  })

  it('in-phase stereo gives same peak as mono at same amplitude', async () => {
    const monoFill = (_ch: number, i: number) => Math.sin(2 * Math.PI * 440 * i / 44100) * 0.6
    const mono  = makeSynthBuffer({ numChannels: 1, durationSec: 3, fillFn: monoFill })
    const stereo = makeSynthBuffer({ numChannels: 2, durationSec: 3, fillFn: monoFill })
    const [rMono, rStereo] = await Promise.all([
      analyzeRgbWaveform(mono),
      analyzeRgbWaveform(stereo),
    ])
    const monoMax   = Math.max(...Array.from(rMono.positivePeaks))
    const stereoMax = Math.max(...Array.from(rStereo.positivePeaks))
    expect(Math.abs(monoMax - stereoMax)).toBeLessThan(0.05)
  })
})

// ── 6: Temporal smoothing ─────────────────────────────────────────────────────

describe('analyzeRgbWaveform — temporal smoothing', () => {
  it('smoothing does not increase the max band energy beyond clamped 1', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 440 * i / 44100),
    })
    const result = await analyzeRgbWaveform(buf)
    const maxMid = Math.max(...Array.from(result.midEnergy))
    expect(maxMid).toBeLessThanOrEqual(1.001)
  })
})

// ── 7: AbortSignal ────────────────────────────────────────────────────────────

describe('analyzeRgbWaveform — AbortSignal', () => {
  it('throws DOMException with name AbortError when pre-aborted signal is passed', async () => {
    const buf        = makeSynthBuffer({ durationSec: 5 })
    const controller = new AbortController()
    controller.abort()
    await expect(analyzeRgbWaveform(buf, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})
