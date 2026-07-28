import { describe, expect, it } from 'vitest'
import {
  buildScopeTracePoints,
  canRenderProfessionalScope,
  disposeScopeSignalCore,
  getScopeSignalCore,
  resolveScopeCaptureRequestFrames,
  toStereoScopeFrame,
} from '../soundDrawingScopeGeometry'
import {
  buildPerformanceOscillator,
  resolveAuthoredScopeTransitionAlpha,
  scopeModeForClassicMode,
} from '../SoundDrawingRenderer'
import { resolveSoundDrawingPerformanceFrame } from '../../soundDrawing/SoundDrawingPerformanceEngine'
import { DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS } from '../../soundDrawing/SoundDrawingPerformanceTypes'
import { DEFAULT_OSCILLATOR_SETTINGS, type OscillatorSettings } from '../../ReactTypes'
import type { ReactFrameContext } from '../reactRenderUtils'
import type { VectorBeamPoint } from '../../vectorBeam/VectorBeamTypes'

const SAMPLE_RATE = 48_000

function oscillator(overrides: Partial<OscillatorSettings> = {}): OscillatorSettings {
  return { ...DEFAULT_OSCILLATOR_SETTINGS, ...overrides }
}

function stereoCapture(rightPhase: number, length = 4096): NonNullable<ReactFrameContext['scopeStereo']> {
  const left = new Float32Array(length)
  const right = new Float32Array(length)
  const step = (Math.PI * 2 * 440) / SAMPLE_RATE
  for (let i = 0; i < length; i++) {
    left[i] = Math.sin(i * step)
    right[i] = Math.sin(i * step + rightPhase)
  }
  return {
    left,
    right,
    sampleRate: SAMPLE_RATE,
    startFrame: 0,
    sequenceNumber: 1,
    audioTimeSeconds: 0,
    channelCount: 2,
  }
}

function frameContext(scopeStereo: ReactFrameContext['scopeStereo']): ReactFrameContext {
  return {
    W: 1920,
    H: 1080,
    dpr: 1,
    t: 0,
    deltaTimeSec: 1 / 60,
    audioTime: 0,
    bpm: 0,
    beatPhase: 0,
    beatHit: false,
    isPlaying: true,
    audio: { bass: 0.2, mid: 0.2, high: 0.2, volume: 0.2 },
    freqData: null,
    timeDomainData: null,
    scopeStereo,
    musicIntelligence: null,
  }
}

describe('classic mode routing', () => {
  it('renders the migrated mono-delay name through the same draw path as the legacy value', () => {
    // The rename must not change a single pixel of an existing project.
    expect(scopeModeForClassicMode('monoDelayXY')).toBe(scopeModeForClassicMode('lissajous'))
  })

  it('routes the professional mode to the scope core', () => {
    expect(scopeModeForClassicMode('professionalScope')).toBe('professionalScope')
  })

  it('leaves the other classic modes untouched', () => {
    expect(scopeModeForClassicMode('waveform')).toBe('waveform')
    expect(scopeModeForClassicMode('radialScope')).toBe('radialScope')
    expect(scopeModeForClassicMode('spiralScope')).toBe('spiralScope')
    expect(scopeModeForClassicMode('sectionAuto')).toBe('waveform')
  })
})

describe('professional scope availability', () => {
  it('uses deterministic cue-relative crossfades for authored scope transitions', () => {
    expect(resolveAuthoredScopeTransitionAlpha(12, 12, 0.5)).toBe(0)
    expect(resolveAuthoredScopeTransitionAlpha(12.25, 12, 0.5)).toBe(0.5)
    expect(resolveAuthoredScopeTransitionAlpha(13, 12, 0.5)).toBe(1)
    expect(resolveAuthoredScopeTransitionAlpha(13, null, 0.5)).toBe(1)
  })

  it('routes an authored layer through the same synchronized stereo scope contract', () => {
    const frame = {
      ...frameContext(stereoCapture(Math.PI / 3)),
      timeSec: 1,
      elapsedTimeSec: 1,
      trackKey: 'scope-test',
    }
    const performance = resolveSoundDrawingPerformanceFrame({
      frame,
      settings: {
        ...DEFAULT_SOUND_DRAWING_PERFORMANCE_SETTINGS,
        autoPerformance: true,
        selectedShowId: 'stereoPulseStudy',
        performanceSource: 'generatedVisual',
      },
      manualOscillator: DEFAULT_OSCILLATOR_SETTINGS,
    })!
    const layer = performance.layers.find((candidate) => candidate.generator === 'professionalScope')!
    const effective = buildPerformanceOscillator(DEFAULT_OSCILLATOR_SETTINGS, layer, 1)
    expect(effective.classicMode).toBe('professionalScope')
    expect(effective.scope).toBe(layer.professionalScope?.state)
    expect(canRenderProfessionalScope(effective, frame)).toBe(true)
  })

  it('requires both the professional mode and actual stereo capture', () => {
    const withCapture = frameContext(stereoCapture(0))
    const withoutCapture = frameContext(null)

    expect(canRenderProfessionalScope(oscillator({ classicMode: 'professionalScope' }), withCapture)).toBe(true)
    // Selecting a stereo mode does not make stereo data exist.
    expect(canRenderProfessionalScope(oscillator({ classicMode: 'professionalScope' }), withoutCapture)).toBe(false)
    expect(canRenderProfessionalScope(oscillator({ classicMode: 'waveform' }), withCapture)).toBe(false)
    expect(canRenderProfessionalScope(oscillator({ sourceType: 'text', classicMode: 'professionalScope' }), withCapture)).toBe(false)
  })

  it('requests no capture frames unless the professional path is selected', () => {
    expect(resolveScopeCaptureRequestFrames(oscillator({ classicMode: 'waveform' }), SAMPLE_RATE)).toBe(0)
    expect(resolveScopeCaptureRequestFrames(oscillator({ sourceType: 'text' }), SAMPLE_RATE)).toBe(0)
    expect(
      resolveScopeCaptureRequestFrames(oscillator({ classicMode: 'professionalScope' }), SAMPLE_RATE),
    ).toBeGreaterThan(0)
  })
})

describe('professional scope screen geometry', () => {
  it('maps in-phase stereo to a positive-slope line on screen', () => {
    const osc = oscillator({
      classicMode: 'professionalScope',
      scope: { ...DEFAULT_OSCILLATOR_SETTINGS.scope, enabled: true, signalMode: 'stereoXY' },
    })
    const frame = frameContext(stereoCapture(0))
    const ctx = {} as CanvasRenderingContext2D
    const core = getScopeSignalCore(ctx)

    const trace = core.process({
      state: osc.scope,
      frame: toStereoScopeFrame(frame)!,
      requestedPoints: 256,
      deltaSeconds: 1 / 60,
      bpm: 0,
      timingDiscontinuity: false,
    })!
    expect(trace).not.toBeNull()

    const points: VectorBeamPoint[] = []
    const count = buildScopeTracePoints(trace, trace.y, {
      W: 1920, H: 1080, scalePx: 400, centerX: 960, centerY: 540, secondaryOffsetPx: 0,
    }, points)

    expect(count).toBe(trace.length)
    for (let i = 0; i < count; i++) {
      // Canvas Y grows downward while the core works positive-up, so an
      // in-phase pair must plot as a *negative* screen slope through centre.
      const dx = points[i].x - 960
      const dy = points[i].y - 540
      expect(Math.abs(dy + dx)).toBeLessThan(1)
    }
    disposeScopeSignalCore(ctx)
  })

  it('inverts Y so anti-phase stereo does not read as in-phase', () => {
    const osc = oscillator({
      classicMode: 'professionalScope',
      scope: { ...DEFAULT_OSCILLATOR_SETTINGS.scope, enabled: true, signalMode: 'stereoXY' },
    })
    const ctx = {} as CanvasRenderingContext2D
    const core = getScopeSignalCore(ctx)
    const trace = core.process({
      state: osc.scope,
      frame: toStereoScopeFrame(frameContext(stereoCapture(Math.PI)))!,
      requestedPoints: 256,
      deltaSeconds: 1 / 60,
      bpm: 0,
      timingDiscontinuity: false,
    })!

    const points: VectorBeamPoint[] = []
    const count = buildScopeTracePoints(trace, trace.y, {
      W: 1920, H: 1080, scalePx: 400, centerX: 960, centerY: 540, secondaryOffsetPx: 0,
    }, points)

    for (let i = 0; i < count; i++) {
      const dx = points[i].x - 960
      const dy = points[i].y - 540
      // Anti-phase plots as a positive screen slope — the opposite diagonal.
      expect(Math.abs(dy - dx)).toBeLessThan(1)
    }
    disposeScopeSignalCore(ctx)
  })

  it('spreads waveform modes across the full display width', () => {
    const osc = oscillator({
      classicMode: 'professionalScope',
      scope: { ...DEFAULT_OSCILLATOR_SETTINGS.scope, enabled: true, signalMode: 'left' },
    })
    const ctx = {} as CanvasRenderingContext2D
    const core = getScopeSignalCore(ctx)
    const trace = core.process({
      state: osc.scope,
      frame: toStereoScopeFrame(frameContext(stereoCapture(0)))!,
      requestedPoints: 256,
      deltaSeconds: 1 / 60,
      bpm: 0,
      timingDiscontinuity: false,
    })!

    const points: VectorBeamPoint[] = []
    const count = buildScopeTracePoints(trace, trace.y, {
      W: 1920, H: 1080, scalePx: 400, centerX: 960, centerY: 540, secondaryOffsetPx: 0,
    }, points)

    expect(points[0].x).toBeCloseTo(0, 3)
    expect(points[count - 1].x).toBeCloseTo(1920, 3)
    disposeScopeSignalCore(ctx)
  })

  it('separates the two dual-channel traces symmetrically about centre', () => {
    const osc = oscillator({
      classicMode: 'professionalScope',
      scope: { ...DEFAULT_OSCILLATOR_SETTINGS.scope, enabled: true, signalMode: 'dualWaveform' },
    })
    const ctx = {} as CanvasRenderingContext2D
    const core = getScopeSignalCore(ctx)
    // Identical channels, so any vertical difference between the traces is the
    // separation offset alone rather than a difference in signal.
    const trace = core.process({
      state: osc.scope,
      frame: toStereoScopeFrame(frameContext(stereoCapture(0)))!,
      requestedPoints: 256,
      deltaSeconds: 1 / 60,
      bpm: 0,
      timingDiscontinuity: false,
    })!
    expect(trace.hasSecondary).toBe(true)

    const geometry = { W: 1920, H: 1080, scalePx: 400, centerX: 960, centerY: 540, secondaryOffsetPx: 190 }
    const upper: VectorBeamPoint[] = []
    const lower: VectorBeamPoint[] = []
    buildScopeTracePoints(trace, trace.y, geometry, upper, -geometry.secondaryOffsetPx)
    buildScopeTracePoints(trace, trace.secondaryY!, geometry, lower, geometry.secondaryOffsetPx)

    for (let i = 0; i < trace.length; i++) {
      expect(lower[i].y - upper[i].y).toBeCloseTo(geometry.secondaryOffsetPx * 2, 3)
      // Centred as a pair: the midpoint sits on the display centre line.
      expect((upper[i].y + lower[i].y) / 2).toBeCloseTo(geometry.centerY - trace.y[i] * geometry.scalePx, 3)
    }
    disposeScopeSignalCore(ctx)
  })

  it('reuses its point array across frames rather than reallocating', () => {
    const osc = oscillator({
      classicMode: 'professionalScope',
      scope: { ...DEFAULT_OSCILLATOR_SETTINGS.scope, enabled: true, signalMode: 'stereoXY' },
    })
    const ctx = {} as CanvasRenderingContext2D
    const core = getScopeSignalCore(ctx)
    const points: VectorBeamPoint[] = []
    const geometry = { W: 1920, H: 1080, scalePx: 400, centerX: 960, centerY: 540, secondaryOffsetPx: 0 }

    const first = core.process({
      state: osc.scope, frame: toStereoScopeFrame(frameContext(stereoCapture(0)))!,
      requestedPoints: 256, deltaSeconds: 1 / 60, bpm: 0, timingDiscontinuity: false,
    })!
    buildScopeTracePoints(first, first.y, geometry, points)
    const firstPointObject = points[0]

    const second = core.process({
      state: osc.scope, frame: toStereoScopeFrame(frameContext(stereoCapture(0.5)))!,
      requestedPoints: 256, deltaSeconds: 1 / 60, bpm: 0, timingDiscontinuity: false,
    })!
    buildScopeTracePoints(second, second.y, geometry, points)

    expect(points[0]).toBe(firstPointObject)
    disposeScopeSignalCore(ctx)
  })
})

describe('scope core lifecycle', () => {
  it('gives each canvas its own core and releases it on disposal', () => {
    const a = {} as CanvasRenderingContext2D
    const b = {} as CanvasRenderingContext2D

    const coreA = getScopeSignalCore(a)
    expect(getScopeSignalCore(a)).toBe(coreA)
    expect(getScopeSignalCore(b)).not.toBe(coreA)

    disposeScopeSignalCore(a)
    // A fresh core after disposal — stale trigger and filter history must not
    // carry into whatever renders next on that canvas.
    expect(getScopeSignalCore(a)).not.toBe(coreA)
    disposeScopeSignalCore(a)
    disposeScopeSignalCore(b)
  })
})
