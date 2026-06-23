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

// ── 7: Signed peaks ───────────────────────────────────────────────────────────

describe('analyzeRgbWaveform — signed peaks', () => {
  it('half-wave rectified signal has positive peaks significantly greater than negative peaks', async () => {
    // Half-wave: positive half-cycles pass through, negative half-cycles are clamped to 0.
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.max(0, Math.sin(2 * Math.PI * 440 * i / 44100)),
    })
    const result = await analyzeRgbWaveform(buf)
    const posAvg = result.positivePeaks.reduce((s, v) => s + v, 0) / result.positivePeaks.length
    const negAvg = result.negativePeaks.reduce((s, v) => s + v, 0) / result.negativePeaks.length
    // Positive side carries the full amplitude; negative side is near-zero.
    expect(posAvg).toBeGreaterThan(negAvg * 4)
  })

  it('all-positive (full-wave rectified) signal has near-zero negative peaks', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.abs(Math.sin(2 * Math.PI * 440 * i / 44100)) * 0.8,
    })
    const result = await analyzeRgbWaveform(buf)
    const negMax = Math.max(...Array.from(result.negativePeaks))
    expect(negMax).toBeLessThan(0.05)
  })

  it('symmetric sine wave has matched positive and negative peaks', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 440 * i / 44100) * 0.8,
    })
    const result = await analyzeRgbWaveform(buf)
    const posAvg = result.positivePeaks.reduce((s, v) => s + v, 0) / result.positivePeaks.length
    const negAvg = result.negativePeaks.reduce((s, v) => s + v, 0) / result.negativePeaks.length
    // Both sides should be within 10% of each other for a symmetric signal.
    expect(Math.abs(posAvg - negAvg)).toBeLessThan(0.10)
  })
})

// ── 8: Peak and RMS smoothing ─────────────────────────────────────────────────

describe('analyzeRgbWaveform — peak and RMS smoothing', () => {
  it('smoothed peaks stay within [0, 1] after smoothing', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => Math.sin(2 * Math.PI * 440 * i / 44100),
    })
    const result = await analyzeRgbWaveform(buf)
    for (let i = 0; i < result.positivePeaks.length; i++) {
      expect(result.positivePeaks[i]).toBeGreaterThanOrEqual(0)
      expect(result.positivePeaks[i]).toBeLessThanOrEqual(1.001)
      expect(result.negativePeaks[i]).toBeGreaterThanOrEqual(0)
      expect(result.negativePeaks[i]).toBeLessThanOrEqual(1.001)
    }
  })

  it('smoothed RMS has no isolated single-bin spikes above its neighbors', async () => {
    // Impulse signal: a single loud sample per bin, otherwise silent.
    // After smoothing, no bin should be drastically higher than its neighbors.
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => i % 441 === 0 ? 1.0 : 0.0,
    })
    const result = await analyzeRgbWaveform(buf)
    let maxRatio = 0
    for (let i = 1; i < result.rms.length - 1; i++) {
      const neighbors = Math.max(result.rms[i - 1], result.rms[i + 1])
      if (neighbors > 0.001) {
        const ratio = result.rms[i] / neighbors
        if (ratio > maxRatio) maxRatio = ratio
      }
    }
    // After smoothing, no bin should be more than 3× its neighbors.
    expect(maxRatio).toBeLessThan(3.0)
  })
})

// ── 9: Peak normalization with asymmetric / one-sided signals ─────────────────
//
// These tests verify that the peakRef is derived from BOTH positive and negative
// magnitude distributions so that neither side is over-clipped when the other
// side dominates.

describe('analyzeRgbWaveform — peak normalization with negative-dominant audio', () => {
  it('negative-dominant: negativePeaks >> positivePeaks (asymmetry preserved)', async () => {
    // Asymmetric sine: positive half attenuated 9×, negative half at full amplitude.
    // This is the canonical case the old code mishandled.
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => {
        const s = Math.sin(2 * Math.PI * 440 * i / 44100)
        return s > 0 ? s * 0.1 : s * 0.9
      },
    })
    const result = await analyzeRgbWaveform(buf)
    const posAvg = result.positivePeaks.reduce((s, v) => s + v, 0) / result.positivePeaks.length
    const negAvg = result.negativePeaks.reduce((s, v) => s + v, 0) / result.negativePeaks.length
    // Negative side carries 9× the amplitude of positive side.
    expect(negAvg).toBeGreaterThan(posAvg * 3)
  })

  it('negative-dominant: positivePeaks are NOT uniformly clipped to 1 when negative peaks dominate', async () => {
    // With the old (broken) code, peakRef ≈ 0.1, so negativePeaks would all be 9/0.1=90 → clamped to 1.
    // With the fix, peakRef = max(0.1, 0.9) = 0.9, so positivePeaks ≈ 0.1/0.9 ≈ 0.11.
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => {
        const s = Math.sin(2 * Math.PI * 440 * i / 44100)
        return s > 0 ? s * 0.1 : s * 0.9
      },
    })
    const result = await analyzeRgbWaveform(buf)
    const posMax = Math.max(...Array.from(result.positivePeaks))
    // positivePeaks must be well below 1 — old code produced posMax ≈ 1.0 (wrong)
    expect(posMax).toBeLessThan(0.5)
  })

  it('negative-dominant: all peak values remain in [0, 1]', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => {
        const s = Math.sin(2 * Math.PI * 440 * i / 44100)
        return s > 0 ? s * 0.1 : s * 0.9
      },
    })
    const result = await analyzeRgbWaveform(buf)
    for (let i = 0; i < result.positivePeaks.length; i++) {
      expect(result.positivePeaks[i]).toBeGreaterThanOrEqual(0)
      expect(result.positivePeaks[i]).toBeLessThanOrEqual(1.001)
      expect(result.negativePeaks[i]).toBeGreaterThanOrEqual(0)
      expect(result.negativePeaks[i]).toBeLessThanOrEqual(1.001)
    }
  })
})

describe('analyzeRgbWaveform — peak normalization with positive-dominant audio', () => {
  it('positive-dominant: positivePeaks >> negativePeaks', async () => {
    // Mirror image: negative half attenuated 9×, positive at full amplitude.
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => {
        const s = Math.sin(2 * Math.PI * 440 * i / 44100)
        return s > 0 ? s * 0.9 : s * 0.1
      },
    })
    const result = await analyzeRgbWaveform(buf)
    const posAvg = result.positivePeaks.reduce((s, v) => s + v, 0) / result.positivePeaks.length
    const negAvg = result.negativePeaks.reduce((s, v) => s + v, 0) / result.negativePeaks.length
    expect(posAvg).toBeGreaterThan(negAvg * 3)
  })

  it('positive-dominant: negativePeaks are not clipped when positive peaks dominate', async () => {
    // peakRef = max(0.9_pos, 0.1_neg) = 0.9 → negativePeaks ≈ 0.1/0.9 ≈ 0.11
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => {
        const s = Math.sin(2 * Math.PI * 440 * i / 44100)
        return s > 0 ? s * 0.9 : s * 0.1
      },
    })
    const result = await analyzeRgbWaveform(buf)
    const negMax = Math.max(...Array.from(result.negativePeaks))
    expect(negMax).toBeLessThan(0.5)
  })
})

describe('analyzeRgbWaveform — peak normalization with mixed asymmetric audio', () => {
  it('DC-biased sine preserves asymmetry: larger side has higher normalised peaks', async () => {
    // DC offset of -0.3: signal swings from -1.0 to 0.4.
    // Negative peak magnitude ≈ 1.0, positive peak magnitude ≈ 0.4.
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => -0.3 + Math.sin(2 * Math.PI * 440 * i / 44100) * 0.7,
    })
    const result = await analyzeRgbWaveform(buf)
    const posAvg = result.positivePeaks.reduce((s, v) => s + v, 0) / result.positivePeaks.length
    const negAvg = result.negativePeaks.reduce((s, v) => s + v, 0) / result.negativePeaks.length
    // Negative peaks are larger in this biased signal.
    expect(negAvg).toBeGreaterThan(posAvg)
  })

  it('mixed asymmetric: both sides produce meaningful (non-zero) normalised peaks', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => -0.3 + Math.sin(2 * Math.PI * 440 * i / 44100) * 0.7,
    })
    const result = await analyzeRgbWaveform(buf)
    const posMax = Math.max(...Array.from(result.positivePeaks))
    const negMax = Math.max(...Array.from(result.negativePeaks))
    // Both sides must produce visible peaks.
    expect(posMax).toBeGreaterThan(0.05)
    expect(negMax).toBeGreaterThan(0.05)
  })

  it('mixed asymmetric: all peak values remain in [0, 1]', async () => {
    const buf = makeSynthBuffer({
      durationSec: 3,
      fillFn: (_ch, i) => -0.3 + Math.sin(2 * Math.PI * 440 * i / 44100) * 0.7,
    })
    const result = await analyzeRgbWaveform(buf)
    for (let i = 0; i < result.positivePeaks.length; i++) {
      expect(result.positivePeaks[i]).toBeGreaterThanOrEqual(0)
      expect(result.positivePeaks[i]).toBeLessThanOrEqual(1.001)
      expect(result.negativePeaks[i]).toBeGreaterThanOrEqual(0)
      expect(result.negativePeaks[i]).toBeLessThanOrEqual(1.001)
    }
  })
})

describe('analyzeRgbWaveform — peak normalization with silence', () => {
  it('silence: both positivePeaks and negativePeaks are zero', async () => {
    const buf    = makeSynthBuffer({ durationSec: 2 })  // default fillFn → zeros
    const result = await analyzeRgbWaveform(buf)
    const posMax = Math.max(...Array.from(result.positivePeaks))
    const negMax = Math.max(...Array.from(result.negativePeaks))
    expect(posMax).toBe(0)
    expect(negMax).toBe(0)
  })

  it('silence: normalization reference falls back to 1 (no division by zero)', async () => {
    // If sortedPercentile returns 1 for all-zero input and we take max(1, 1),
    // the result is still 1 — no NaN or Infinity in output.
    const buf    = makeSynthBuffer({ durationSec: 2 })
    const result = await analyzeRgbWaveform(buf)
    for (let i = 0; i < result.positivePeaks.length; i++) {
      expect(isFinite(result.positivePeaks[i])).toBe(true)
      expect(isFinite(result.negativePeaks[i])).toBe(true)
    }
  })
})

// ── 10: AbortSignal ───────────────────────────────────────────────────────────

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
