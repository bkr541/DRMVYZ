import { describe, expect, it } from 'vitest'
import {
  normalizeScopeSignalMode,
  normalizeScopeTimebase,
  normalizeScopeTrigger,
  normalizeSoundDrawingScopeState,
} from '../scopeStateNormalization'
import { DEFAULT_SOUND_DRAWING_SCOPE_STATE } from '../scopeTypes'

describe('scope signal mode migration', () => {
  it('migrates the legacy lissajous mode to the mono delay portrait', () => {
    // The pre-existing mode plotted one half of a mono buffer against the other,
    // which is a delayed mono portrait. Promoting it to true stereo would
    // silently change how every saved project looks.
    expect(normalizeScopeSignalMode('lissajous')).toBe('monoDelayXY')
  })

  it('preserves every known mode unchanged', () => {
    for (const mode of [
      'left', 'right', 'dualWaveform', 'stereoXY', 'midSideXY',
      'sumDifferenceXY', 'mono', 'monoDelayXY', 'bandSplitXY', 'proceduralFallback',
    ] as const) {
      expect(normalizeScopeSignalMode(mode)).toBe(mode)
    }
  })

  it('falls back to the default for unknown values', () => {
    expect(normalizeScopeSignalMode('nonsense')).toBe(DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalMode)
    expect(normalizeScopeSignalMode(undefined)).toBe(DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalMode)
    expect(normalizeScopeSignalMode(42)).toBe(DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalMode)
  })
})

describe('scope state normalization', () => {
  it('returns defaults for absent or malformed state', () => {
    expect(normalizeSoundDrawingScopeState(undefined)).toEqual(DEFAULT_SOUND_DRAWING_SCOPE_STATE)
    expect(normalizeSoundDrawingScopeState('broken')).toEqual(DEFAULT_SOUND_DRAWING_SCOPE_STATE)
    expect(normalizeSoundDrawingScopeState([])).toEqual(DEFAULT_SOUND_DRAWING_SCOPE_STATE)
  })

  it('clamps out-of-range numbers instead of trusting persisted input', () => {
    const trigger = normalizeScopeTrigger({ level: 99, hysteresis: -5, holdoffSeconds: 100 })
    expect(trigger.level).toBe(1)
    expect(trigger.hysteresis).toBe(0)
    expect(trigger.holdoffSeconds).toBe(0.5)
  })

  it('rejects NaN and infinity', () => {
    const trigger = normalizeScopeTrigger({ level: NaN, continuityWeight: Infinity })
    expect(Number.isFinite(trigger.level)).toBe(true)
    expect(Number.isFinite(trigger.continuityWeight)).toBe(true)
  })

  it('orders an inverted auto timebase range', () => {
    const timebase = normalizeScopeTimebase({ autoMinimumSeconds: 0.5, autoMaximumSeconds: 0.01 })
    expect(timebase.autoMinimumSeconds).toBeLessThanOrEqual(timebase.autoMaximumSeconds)
    expect(timebase.autoMinimumSeconds).toBeCloseTo(0.01, 6)
    expect(timebase.autoMaximumSeconds).toBeCloseTo(0.5, 6)
  })

  it('preserves a fully specified valid state', () => {
    const source = {
      version: 1,
      enabled: true,
      signalMode: 'midSideXY',
      signalConditioner: {
        coupling: 'ac', dcBlockHz: 30, gainX: 2, gainY: 3,
        offsetX: 0.1, offsetY: -0.1, invertX: true, invertY: false, swapAxes: true,
      },
      trigger: {
        mode: 'normal', source: 'left', slope: 'falling', level: 0.25, hysteresis: 0.05,
        holdoffSeconds: 0.01, searchWindowSeconds: 0.08, preTriggerRatio: 0.5,
        continuityWeight: 0.9, periodAssist: 0.2, autoFallbackSeconds: 1,
      },
      timebase: {
        mode: 'cycles', secondsPerDisplay: 0.05, horizontalPosition: -0.5, visibleCycles: 8,
        beatDivision: '1bar', autoMinimumSeconds: 0.002, autoMaximumSeconds: 0.2, smoothing: 0.5,
      },
      monoDelayMs: 5,
      presetId: 'scope-lab-green',
    }
    expect(normalizeSoundDrawingScopeState(source)).toEqual({ ...source, version: 1 })
  })

  it('always stamps the current version', () => {
    expect(normalizeSoundDrawingScopeState({ version: 99 }).version).toBe(1)
  })

  it('does not enable the professional core for legacy projects', () => {
    // Existing projects must keep rendering exactly as they did until the user
    // opts in.
    expect(normalizeSoundDrawingScopeState({}).enabled).toBe(false)
  })
})
