import { describe, expect, it } from 'vitest'
import { ScopeSignalCore, resampleLinear, resolveScopeCaptureFrames } from '../ScopeSignalCore'
import { ScopeSignalConditioner, dcBlockerCoefficient } from '../ScopeSignalConditioner'
import { ScopePeriodEstimator } from '../ScopePeriodEstimator'
import { ScopeTimebase, resolveWindowStartOffset } from '../ScopeTimebase'
import {
  DEFAULT_SCOPE_SIGNAL_CONDITIONER,
  DEFAULT_SCOPE_TIMEBASE,
  DEFAULT_SCOPE_TRIGGER,
  DEFAULT_SOUND_DRAWING_SCOPE_STATE,
  type ScopeSignalMode,
  type SoundDrawingScopeState,
  type StereoScopeFrame,
} from '../scopeTypes'
import {
  FIXTURE_SAMPLE_RATE,
  createImpulseFrame,
  createMonoFrame,
  createNoiseFrame,
  createSilentFrame,
  createStereoSineFrame,
  createSweepFrame,
  meanDistanceFromNegativeDiagonal,
  meanDistanceFromPositiveDiagonal,
  meanRadiusError,
  rms,
} from './scopeFixtures'

function state(overrides: Partial<SoundDrawingScopeState> = {}): SoundDrawingScopeState {
  return {
    ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
    enabled: true,
    signalConditioner: { ...DEFAULT_SCOPE_SIGNAL_CONDITIONER },
    trigger: { ...DEFAULT_SCOPE_TRIGGER },
    timebase: { ...DEFAULT_SCOPE_TIMEBASE, mode: 'seconds', secondsPerDisplay: 0.02, smoothing: 0 },
    ...overrides,
  }
}

function run(
  core: ScopeSignalCore,
  frame: StereoScopeFrame | null,
  signalMode: ScopeSignalMode,
  overrides: Partial<SoundDrawingScopeState> = {},
) {
  return core.process({
    state: state({ signalMode, ...overrides }),
    frame,
    requestedPoints: 512,
    deltaSeconds: 1 / 60,
    bpm: 0,
    timingDiscontinuity: false,
  })
}

describe('scope signal core — trace geometry', () => {
  it('produces the positive diagonal for in-phase stereo', () => {
    const trace = run(new ScopeSignalCore(), createStereoSineFrame({ rightPhase: 0 }), 'stereoXY')
    expect(trace).not.toBeNull()
    expect(trace!.isXY).toBe(true)
    expect(meanDistanceFromPositiveDiagonal(trace!.x, trace!.y, trace!.length)).toBeLessThan(1e-5)
    expect(trace!.correlation).toBeCloseTo(1, 4)
  })

  it('produces the negative diagonal for anti-phase stereo', () => {
    const trace = run(new ScopeSignalCore(), createStereoSineFrame({ rightPhase: Math.PI }), 'stereoXY')
    expect(meanDistanceFromNegativeDiagonal(trace!.x, trace!.y, trace!.length)).toBeLessThan(1e-5)
    expect(trace!.correlation).toBeCloseTo(-1, 4)
  })

  it('produces a circle for a 90-degree phase shift', () => {
    const trace = run(new ScopeSignalCore(), createStereoSineFrame({ rightPhase: Math.PI / 2 }), 'stereoXY')
    // Tolerance covers linear resampling from the capture window down to the
    // display point count: chords across a curve read slightly inside the arc.
    expect(meanRadiusError(trace!.x, trace!.y, trace!.length, 1)).toBeLessThan(1e-3)
  })

  it('flags a genuinely mono source', () => {
    const trace = run(new ScopeSignalCore(), createMonoFrame(), 'stereoXY')
    expect(trace!.monoSource).toBe(true)
    expect(meanDistanceFromPositiveDiagonal(trace!.x, trace!.y, trace!.length)).toBeLessThan(1e-6)
  })

  it('does not flag a true stereo source as mono', () => {
    const trace = run(new ScopeSignalCore(), createStereoSineFrame({ rightPhase: 1 }), 'stereoXY')
    expect(trace!.monoSource).toBe(false)
  })

  it('emits a secondary trace only in dual-waveform mode', () => {
    const core = new ScopeSignalCore()
    const frame = createStereoSineFrame({ rightPhase: Math.PI })
    expect(run(core, frame, 'dualWaveform')!.hasSecondary).toBe(true)
    expect(run(new ScopeSignalCore(), frame, 'left')!.hasSecondary).toBe(false)
  })

  it('returns null rather than fabricating a trace when capture is unavailable', () => {
    expect(run(new ScopeSignalCore(), null, 'stereoXY')).toBeNull()
  })
})

describe('scope signal core — degenerate signals', () => {
  it('produces a stable centred trace for silence with no NaN', () => {
    const core = new ScopeSignalCore()
    for (let i = 0; i < 5; i++) {
      const trace = run(core, createSilentFrame(), 'stereoXY')
      expect(trace).not.toBeNull()
      expect(rms(trace!.x, trace!.length)).toBe(0)
      expect(rms(trace!.y, trace!.length)).toBe(0)
      for (let j = 0; j < trace!.length; j++) {
        expect(Number.isFinite(trace!.x[j])).toBe(true)
        expect(Number.isFinite(trace!.y[j])).toBe(true)
      }
    }
  })

  it('keeps an impulse bounded rather than producing runaway geometry', () => {
    const trace = run(new ScopeSignalCore(), createImpulseFrame(), 'left')
    expect(trace).not.toBeNull()
    for (let i = 0; i < trace!.length; i++) {
      expect(Math.abs(trace!.y[i])).toBeLessThanOrEqual(1.0001)
      expect(Number.isFinite(trace!.y[i])).toBe(true)
    }
  })

  it('produces finite geometry and low trigger confidence on noise', () => {
    const trace = run(new ScopeSignalCore(), createNoiseFrame(), 'stereoXY')
    expect(trace).not.toBeNull()
    for (let i = 0; i < trace!.length; i++) {
      expect(Number.isFinite(trace!.x[i])).toBe(true)
      expect(Number.isFinite(trace!.y[i])).toBe(true)
    }
    expect(Math.abs(trace!.correlation)).toBeLessThan(0.3)
  })

  it('survives a frequency sweep without invalid geometry', () => {
    const core = new ScopeSignalCore()
    for (let i = 0; i < 10; i++) {
      const trace = run(core, createSweepFrame(80, 4000), 'left', {
        timebase: { ...DEFAULT_SCOPE_TIMEBASE, mode: 'auto', smoothing: 0.85 },
      })
      expect(trace).not.toBeNull()
      expect(trace!.windowSeconds).toBeGreaterThan(0)
      expect(Number.isFinite(trace!.windowSeconds)).toBe(true)
    }
  })
})

describe('scope signal core — discontinuity handling', () => {
  it('resets stateful DSP when the capture sequence rewinds', () => {
    const core = new ScopeSignalCore()
    const first = createStereoSineFrame({ rightPhase: Math.PI / 2 })
    first.sequenceNumber = 10
    expect(run(core, first, 'stereoXY')).not.toBeNull()

    // A lower sequence number means the ring reset under us. The core must not
    // splice pre- and post-reset audio into one window.
    const rewound = createStereoSineFrame({ rightPhase: Math.PI / 2 })
    rewound.sequenceNumber = 1
    const trace = run(core, rewound, 'stereoXY')
    expect(trace).not.toBeNull()
    expect(meanRadiusError(trace!.x, trace!.y, trace!.length, 1)).toBeLessThan(1e-3)
  })

  it('accepts an explicit timing discontinuity without producing invalid output', () => {
    const core = new ScopeSignalCore()
    const frame = createStereoSineFrame()
    const trace = core.process({
      state: state({ signalMode: 'stereoXY' }),
      frame,
      requestedPoints: 512,
      deltaSeconds: 1 / 60,
      bpm: 0,
      timingDiscontinuity: true,
    })
    expect(trace).not.toBeNull()
    expect(Number.isFinite(trace!.windowSeconds)).toBe(true)
  })
})

describe('scope signal conditioner', () => {
  it('derives the DC-blocker coefficient from the sample rate', () => {
    const at48k = dcBlockerCoefficient(20, 48_000)
    const at96k = dcBlockerCoefficient(20, 96_000)
    expect(at48k).toBeLessThan(1)
    expect(at48k).toBeGreaterThan(0.99)
    // A higher sample rate needs a coefficient closer to 1 for the same cutoff.
    expect(at96k).toBeGreaterThan(at48k)
  })

  it('removes a DC offset when AC-coupled', () => {
    const conditioner = new ScopeSignalConditioner()
    conditioner.setSettings({ ...DEFAULT_SCOPE_SIGNAL_CONDITIONER, coupling: 'ac', dcBlockHz: 20 })
    const frame = createStereoSineFrame({ dcOffset: 0.5, frequencyHz: 1000, length: 8192 })
    const x = Float32Array.from(frame.left)
    const y = Float32Array.from(frame.right)
    conditioner.process(x, y, x.length, FIXTURE_SAMPLE_RATE)

    // Skip the filter's settling region before measuring the residual mean.
    let sum = 0
    for (let i = 4096; i < x.length; i++) sum += x[i]
    expect(Math.abs(sum / (x.length - 4096))).toBeLessThan(0.01)
  })

  it('leaves DC intact when DC-coupled', () => {
    const conditioner = new ScopeSignalConditioner()
    conditioner.setSettings({ ...DEFAULT_SCOPE_SIGNAL_CONDITIONER, coupling: 'dc' })
    // 480 Hz at 48 kHz is exactly 100 samples per cycle, so 4800 samples span a
    // whole number of cycles and the sine contributes exactly zero to the mean.
    const frame = createStereoSineFrame({ dcOffset: 0.5, frequencyHz: 480, length: 4800 })
    const x = Float32Array.from(frame.left)
    const y = Float32Array.from(frame.right)
    conditioner.process(x, y, x.length, FIXTURE_SAMPLE_RATE)

    let sum = 0
    for (let i = 0; i < x.length; i++) sum += x[i]
    expect(sum / x.length).toBeCloseTo(0.5, 4)
  })

  it('applies inversion and axis swap', () => {
    const conditioner = new ScopeSignalConditioner()
    conditioner.setSettings({ ...DEFAULT_SCOPE_SIGNAL_CONDITIONER, invertY: true })
    conditioner.snapParameters()
    const x = Float32Array.from([0.5, 0.25])
    const y = Float32Array.from([0.5, 0.25])
    conditioner.process(x, y, 2, FIXTURE_SAMPLE_RATE)
    expect(y[0]).toBeCloseTo(-0.5, 5)
    expect(x[0]).toBeCloseTo(0.5, 5)

    const swapper = new ScopeSignalConditioner()
    swapper.setSettings({ ...DEFAULT_SCOPE_SIGNAL_CONDITIONER, swapAxes: true })
    swapper.snapParameters()
    const sx = Float32Array.from([1, 0])
    const sy = Float32Array.from([0, 1])
    expect(swapper.process(sx, sy, 2, FIXTURE_SAMPLE_RATE)).toBe(true)
    expect(sx[0]).toBeCloseTo(0, 5)
    expect(sy[0]).toBeCloseTo(1, 5)
  })

  it('scales both channels identically in waveform mode', () => {
    const conditioner = new ScopeSignalConditioner()
    conditioner.setSettings({ ...DEFAULT_SCOPE_SIGNAL_CONDITIONER, gainY: 2 })
    conditioner.snapParameters()
    const primary = Float32Array.from([0.5, -0.25])
    const secondary = Float32Array.from([0.5, -0.25])
    conditioner.processWaveform(primary, secondary, 2, FIXTURE_SAMPLE_RATE)
    expect(primary[0]).toBeCloseTo(1, 5)
    expect(secondary[0]).toBeCloseTo(1, 5)
  })

  it('smooths gain changes instead of snapping mid-trace', () => {
    const conditioner = new ScopeSignalConditioner()
    conditioner.setSettings({ ...DEFAULT_SCOPE_SIGNAL_CONDITIONER, gainY: 1 })
    conditioner.snapParameters()

    conditioner.setSettings({ ...DEFAULT_SCOPE_SIGNAL_CONDITIONER, gainY: 4 })
    const primary = Float32Array.from([1])
    conditioner.processWaveform(primary, null, 1, FIXTURE_SAMPLE_RATE)
    expect(primary[0]).toBeGreaterThan(1)
    expect(primary[0]).toBeLessThan(4)
  })
})

describe('scope period estimator', () => {
  it.each([110, 220, 440, 880])('estimates the period of a %i Hz tone', frequency => {
    const estimator = new ScopePeriodEstimator()
    const frame = createStereoSineFrame({ frequencyHz: frequency, length: 8192 })
    const result = estimator.estimateInstantaneous(frame.left, 8192, FIXTURE_SAMPLE_RATE)
    const expected = FIXTURE_SAMPLE_RATE / frequency
    expect(result.confidence).toBeGreaterThan(0.7)
    expect(Math.abs(result.periodSamples - expected) / expected).toBeLessThan(0.05)
  })

  it('reports no period for silence', () => {
    const estimator = new ScopePeriodEstimator()
    const result = estimator.estimateInstantaneous(new Float32Array(4096), 4096, FIXTURE_SAMPLE_RATE)
    expect(result.periodSamples).toBe(0)
    expect(result.confidence).toBe(0)
  })

  it('reports low confidence for noise', () => {
    const estimator = new ScopePeriodEstimator()
    const result = estimator.estimateInstantaneous(createNoiseFrame(8192).left, 8192, FIXTURE_SAMPLE_RATE)
    expect(result.confidence).toBeLessThan(0.7)
  })

  it('does not octave-jump when the estimate is smoothed', () => {
    const estimator = new ScopePeriodEstimator()
    const frame = createStereoSineFrame({ frequencyHz: 220, length: 8192 })
    const expected = FIXTURE_SAMPLE_RATE / 220

    let last = 0
    for (let i = 0; i < 20; i++) {
      last = estimator.estimate(frame.left, 8192, FIXTURE_SAMPLE_RATE).periodSamples
    }
    expect(Math.abs(last - expected) / expected).toBeLessThan(0.05)
  })
})

describe('scope timebase', () => {
  it('spans the requested audio time in seconds mode', () => {
    const timebase = new ScopeTimebase()
    const result = timebase.resolve({
      settings: { ...DEFAULT_SCOPE_TIMEBASE, mode: 'seconds', secondsPerDisplay: 0.01, smoothing: 0 },
      sampleRate: FIXTURE_SAMPLE_RATE,
      periodSamples: 0,
      periodConfidence: 0,
      bpm: 0,
    })
    expect(result.windowSeconds).toBeCloseTo(0.01, 6)
    expect(result.windowSamples).toBe(480)
    expect(result.cycleLocked).toBe(false)
  })

  it('locks to detected cycles in cycles mode', () => {
    const timebase = new ScopeTimebase()
    const periodSamples = FIXTURE_SAMPLE_RATE / 440
    const result = timebase.resolve({
      settings: { ...DEFAULT_SCOPE_TIMEBASE, mode: 'cycles', visibleCycles: 4, smoothing: 0 },
      sampleRate: FIXTURE_SAMPLE_RATE,
      periodSamples,
      periodConfidence: 0.9,
      bpm: 0,
    })
    expect(result.cycleLocked).toBe(true)
    expect(result.windowSamples).toBe(Math.round(periodSamples * 4))
  })

  it('uses the beat grid in beat-relative mode when BPM is known', () => {
    const timebase = new ScopeTimebase()
    const result = timebase.resolve({
      settings: { ...DEFAULT_SCOPE_TIMEBASE, mode: 'beatRelative', beatDivision: '1beat', smoothing: 0 },
      sampleRate: FIXTURE_SAMPLE_RATE,
      periodSamples: 0,
      periodConfidence: 0,
      bpm: 120,
    })
    expect(result.windowSeconds).toBeCloseTo(0.5, 6)
  })

  it('falls back to fixed time rather than assuming a tempo when BPM is unknown', () => {
    const timebase = new ScopeTimebase()
    const result = timebase.resolve({
      settings: {
        ...DEFAULT_SCOPE_TIMEBASE, mode: 'beatRelative', secondsPerDisplay: 0.03, smoothing: 0,
      },
      sampleRate: FIXTURE_SAMPLE_RATE,
      periodSamples: 0,
      periodConfidence: 0,
      bpm: 0,
    })
    expect(result.windowSeconds).toBeCloseTo(0.03, 6)
  })

  it('ignores a detected period in auto mode when confidence is low', () => {
    const timebase = new ScopeTimebase()
    const result = timebase.resolve({
      settings: { ...DEFAULT_SCOPE_TIMEBASE, mode: 'auto', secondsPerDisplay: 0.02, smoothing: 0 },
      sampleRate: FIXTURE_SAMPLE_RATE,
      periodSamples: FIXTURE_SAMPLE_RATE / 60,
      periodConfidence: 0.1,
      bpm: 0,
    })
    expect(result.cycleLocked).toBe(false)
  })

  it('smooths window changes instead of jumping', () => {
    const timebase = new ScopeTimebase()
    const base = { ...DEFAULT_SCOPE_TIMEBASE, mode: 'seconds' as const, smoothing: 0.85 }
    const first = timebase.resolve({
      settings: { ...base, secondsPerDisplay: 0.01 },
      sampleRate: FIXTURE_SAMPLE_RATE, periodSamples: 0, periodConfidence: 0, bpm: 0,
    })
    const second = timebase.resolve({
      settings: { ...base, secondsPerDisplay: 0.1 },
      sampleRate: FIXTURE_SAMPLE_RATE, periodSamples: 0, periodConfidence: 0, bpm: 0,
    })
    expect(first.windowSeconds).toBeCloseTo(0.01, 6)
    expect(second.windowSeconds).toBeGreaterThan(0.01)
    expect(second.windowSeconds).toBeLessThan(0.1)
  })
})

describe('window start offset', () => {
  it('shows the newest audio when free-running', () => {
    expect(resolveWindowStartOffset(-1, 100, 1000, 0, 0)).toBe(900)
  })

  it('starts at the trigger point with no pre-trigger', () => {
    expect(resolveWindowStartOffset(250, 100, 1000, 0, 0)).toBe(250)
  })

  it('reserves pre-trigger samples ahead of the trigger point', () => {
    expect(resolveWindowStartOffset(250, 100, 1000, 0.5, 0)).toBe(200)
  })

  it('clamps to the available buffer', () => {
    expect(resolveWindowStartOffset(990, 100, 1000, 0, 0)).toBe(900)
    expect(resolveWindowStartOffset(10, 100, 1000, 1, 0)).toBe(0)
  })
})

describe('capture sizing and resampling', () => {
  it('requests capture headroom beyond the display window', () => {
    const frames = resolveScopeCaptureFrames(0.02, 0.05, FIXTURE_SAMPLE_RATE)
    expect(frames).toBeGreaterThan(0.02 * FIXTURE_SAMPLE_RATE)
    expect(frames).toBeGreaterThanOrEqual(Math.ceil(0.07 * FIXTURE_SAMPLE_RATE))
  })

  it('resamples linearly and preserves endpoints', () => {
    const source = Float32Array.from([0, 1, 2, 3])
    const target = new Float32Array(7)
    resampleLinear(source, 4, target, 7)
    expect(target[0]).toBeCloseTo(0, 6)
    expect(target[6]).toBeCloseTo(3, 6)
    expect(target[3]).toBeCloseTo(1.5, 6)
  })

  it('replaces non-finite samples with zero rather than propagating NaN', () => {
    const source = Float32Array.from([0, NaN, 2])
    const target = new Float32Array(3)
    resampleLinear(source, 3, target, 3)
    for (let i = 0; i < 3; i++) expect(Number.isFinite(target[i])).toBe(true)
  })
})
