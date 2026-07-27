import { describe, expect, it } from 'vitest'
import {
  applyScopeChannelMatrix,
  computeChannelCorrelation,
  extractTriggerSource,
  midFromStereo,
  sideFromStereo,
} from '../ScopeChannelMatrix'
import type { ScopeSignalMode } from '../scopeTypes'
import {
  createMonoFrame,
  createStereoSineFrame,
  meanDistanceFromNegativeDiagonal,
  meanDistanceFromPositiveDiagonal,
  meanRadiusError,
  rms,
} from './scopeFixtures'

const LENGTH = 2048

function matrix(mode: ScopeSignalMode, frame: ReturnType<typeof createStereoSineFrame>, monoDelaySamples = 1) {
  const output = {
    x: new Float32Array(LENGTH),
    y: new Float32Array(LENGTH),
    secondaryY: new Float32Array(LENGTH),
  }
  const result = applyScopeChannelMatrix(
    {
      left: frame.left,
      right: frame.right,
      length: LENGTH,
      sourceOffset: 0,
      mode,
      monoDelaySamples,
    },
    output,
  )
  return { ...output, ...result }
}

describe('scope channel matrix — stereo X/Y geometry', () => {
  it('plots in-phase stereo as the positive diagonal', () => {
    const frame = createStereoSineFrame({ rightPhase: 0 })
    const { x, y, length } = matrix('stereoXY', frame)
    expect(length).toBe(LENGTH)
    expect(meanDistanceFromPositiveDiagonal(x, y, length)).toBeLessThan(1e-6)
  })

  it('plots anti-phase stereo as the negative diagonal', () => {
    const frame = createStereoSineFrame({ rightPhase: Math.PI })
    const { x, y, length } = matrix('stereoXY', frame)
    expect(meanDistanceFromNegativeDiagonal(x, y, length)).toBeLessThan(1e-6)
    // And explicitly not the positive diagonal, which is the failure the old
    // mono-split implementation could not distinguish.
    expect(meanDistanceFromPositiveDiagonal(x, y, length)).toBeGreaterThan(0.5)
  })

  it('plots a 90-degree phase shift as a unit circle', () => {
    const frame = createStereoSineFrame({ rightPhase: Math.PI / 2 })
    const { x, y, length } = matrix('stereoXY', frame)
    expect(meanRadiusError(x, y, length, 1)).toBeLessThan(1e-5)
  })

  it('compresses the diagonal when the right channel is quieter', () => {
    const frame = createStereoSineFrame({ leftGain: 1, rightGain: 0.5 })
    const { x, y, length } = matrix('stereoXY', frame)
    for (let i = 0; i < length; i++) {
      expect(Math.abs(y[i] - x[i] * 0.5)).toBeLessThan(1e-6)
    }
  })

  it('plots a genuinely mono source as the positive diagonal', () => {
    const frame = createMonoFrame()
    const { x, y, length } = matrix('stereoXY', frame)
    expect(frame.channelCount).toBe(1)
    expect(meanDistanceFromPositiveDiagonal(x, y, length)).toBeLessThan(1e-9)
  })
})

describe('scope channel matrix — mid/side and sum/difference', () => {
  it('uses energy-preserving mid/side conversion', () => {
    expect(midFromStereo(1, 1)).toBeCloseTo(Math.SQRT2, 10)
    expect(sideFromStereo(1, 1)).toBeCloseTo(0, 10)
    expect(sideFromStereo(1, -1)).toBeCloseTo(Math.SQRT2, 10)
  })

  it('collapses side to zero for identical channels', () => {
    const frame = createStereoSineFrame({ rightPhase: 0 })
    const { y, length } = matrix('midSideXY', frame)
    expect(rms(y, length)).toBeLessThan(1e-6)
  })

  it('collapses mid to zero for anti-phase channels', () => {
    const frame = createStereoSineFrame({ rightPhase: Math.PI })
    const { x, y, length } = matrix('midSideXY', frame)
    expect(rms(x, length)).toBeLessThan(1e-6)
    expect(rms(y, length)).toBeGreaterThan(0.5)
  })

  it('plots sum/difference without the mid/side normalisation factor', () => {
    const frame = createStereoSineFrame({ rightPhase: 0 })
    const { x, length } = matrix('sumDifferenceXY', frame)
    for (let i = 0; i < length; i++) {
      expect(x[i]).toBeCloseTo(frame.left[i] + frame.right[i], 6)
    }
  })
})

describe('scope channel matrix — waveform modes', () => {
  it('writes a normalised time ramp into X', () => {
    const frame = createStereoSineFrame()
    const { x, length } = matrix('left', frame)
    expect(x[0]).toBeCloseTo(0, 10)
    expect(x[length - 1]).toBeCloseTo(1, 10)
  })

  it('emits both channels in dual-waveform mode', () => {
    const frame = createStereoSineFrame({ rightPhase: Math.PI })
    const { y, secondaryY, hasSecondary, length } = matrix('dualWaveform', frame)
    expect(hasSecondary).toBe(true)
    for (let i = 0; i < length; i++) {
      expect(y[i]).toBeCloseTo(frame.left[i], 6)
      expect(secondaryY[i]).toBeCloseTo(frame.right[i], 6)
    }
  })

  it('reports no secondary trace for single-channel modes', () => {
    const frame = createStereoSineFrame()
    expect(matrix('left', frame).hasSecondary).toBe(false)
    expect(matrix('stereoXY', frame).hasSecondary).toBe(false)
  })
})

describe('scope channel matrix — mono delay portrait', () => {
  it('plots the signal against a delayed copy of itself', () => {
    const frame = createStereoSineFrame({ rightPhase: 0, frequencyHz: 100 })
    const delay = 32
    const output = {
      x: new Float32Array(LENGTH),
      y: new Float32Array(LENGTH),
      secondaryY: new Float32Array(LENGTH),
    }
    applyScopeChannelMatrix(
      {
        left: frame.left,
        right: frame.right,
        length: LENGTH,
        sourceOffset: 256,
        mode: 'monoDelayXY',
        monoDelaySamples: delay,
      },
      output,
    )
    // Y at index i must equal the mono signal `delay` samples earlier, which is
    // X at index i - delay within the same window.
    for (let i = delay; i < LENGTH; i++) {
      expect(output.y[i]).toBeCloseTo(output.x[i - delay], 5)
    }
  })

  it('is a mono portrait: identical output for stereo and mono-summed input', () => {
    const stereo = createStereoSineFrame({ rightPhase: Math.PI / 2 })
    const a = matrix('monoDelayXY', stereo, 16)
    // Pre-summing to mono must not change the portrait, which is exactly why
    // this mode cannot be presented as a stereo measurement.
    const summed = createStereoSineFrame({ rightPhase: Math.PI / 2 })
    for (let i = 0; i < summed.left.length; i++) {
      const mono = (summed.left[i] + summed.right[i]) * 0.5
      summed.left[i] = mono
      summed.right[i] = mono
    }
    const b = matrix('monoDelayXY', summed, 16)
    for (let i = 0; i < a.length; i++) {
      expect(b.x[i]).toBeCloseTo(a.x[i], 5)
      expect(b.y[i]).toBeCloseTo(a.y[i], 5)
    }
  })
})

describe('scope channel correlation', () => {
  it('reports +1 for identical channels', () => {
    const frame = createStereoSineFrame({ rightPhase: 0 })
    expect(computeChannelCorrelation(frame.left, frame.right, LENGTH)).toBeCloseTo(1, 5)
  })

  it('reports -1 for anti-phase channels', () => {
    const frame = createStereoSineFrame({ rightPhase: Math.PI })
    expect(computeChannelCorrelation(frame.left, frame.right, LENGTH)).toBeCloseTo(-1, 5)
  })

  it('reports near zero for a quadrature pair', () => {
    const frame = createStereoSineFrame({ rightPhase: Math.PI / 2, frequencyHz: 480, length: 4800 })
    // 480 Hz at 48 kHz is exactly 100 samples per cycle, so 4800 samples is a
    // whole number of cycles and the correlation is analytically zero.
    expect(Math.abs(computeChannelCorrelation(frame.left, frame.right, 4800))).toBeLessThan(1e-6)
  })

  it('reports zero rather than NaN for silence', () => {
    const silent = new Float32Array(LENGTH)
    expect(computeChannelCorrelation(silent, silent, LENGTH)).toBe(0)
  })
})

describe('scope trigger source extraction', () => {
  it('derives each source from raw left and right', () => {
    const frame = createStereoSineFrame({ rightPhase: Math.PI / 3 })
    const out = new Float32Array(LENGTH)

    extractTriggerSource(frame.left, frame.right, LENGTH, 'left', out)
    expect(out[10]).toBeCloseTo(frame.left[10], 6)

    extractTriggerSource(frame.left, frame.right, LENGTH, 'right', out)
    expect(out[10]).toBeCloseTo(frame.right[10], 6)

    extractTriggerSource(frame.left, frame.right, LENGTH, 'mid', out)
    expect(out[10]).toBeCloseTo(midFromStereo(frame.left[10], frame.right[10]), 6)

    extractTriggerSource(frame.left, frame.right, LENGTH, 'side', out)
    expect(out[10]).toBeCloseTo(sideFromStereo(frame.left[10], frame.right[10]), 6)

    extractTriggerSource(frame.left, frame.right, LENGTH, 'difference', out)
    expect(out[10]).toBeCloseTo(frame.left[10] - frame.right[10], 6)
  })
})
