import { describe, expect, it } from 'vitest'
import {
  normalizeScopeSignalMode,
  normalizeScopeTimebase,
  normalizeScopeTrigger,
  normalizeSoundDrawingScopeState,
} from '../scopeStateNormalization'
import { DEFAULT_SCOPE_MUSIC_MAPPING } from '../scopeMusicMapping'
import {
  DEFAULT_SCOPE_BEAM,
  DEFAULT_SCOPE_CRT,
  DEFAULT_SCOPE_PHOSPHOR,
  DEFAULT_SOUND_DRAWING_SCOPE_STATE,
  SOUND_DRAWING_SCOPE_STATE_VERSION,
} from '../scopeTypes'

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
      version: SOUND_DRAWING_SCOPE_STATE_VERSION,
      crt: DEFAULT_SCOPE_CRT,
      beam: DEFAULT_SCOPE_BEAM,
      phosphor: DEFAULT_SCOPE_PHOSPHOR,
      music: DEFAULT_SCOPE_MUSIC_MAPPING,
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
    expect(normalizeSoundDrawingScopeState(source))
      .toEqual({ ...source, version: SOUND_DRAWING_SCOPE_STATE_VERSION })
  })

  it('always stamps the current version', () => {
    expect(normalizeSoundDrawingScopeState({ version: 99 }).version)
      .toBe(SOUND_DRAWING_SCOPE_STATE_VERSION)
  })

  it('migrates a v1 project forward without switching on a look it never chose', () => {
    // A project saved before the CRT layer existed has no `crt` key at all. It
    // must render exactly as it did, so the migrated settings arrive disabled.
    const migrated = normalizeSoundDrawingScopeState({
      version: 1, enabled: true, signalMode: 'stereoXY',
    })
    expect(migrated.version).toBe(SOUND_DRAWING_SCOPE_STATE_VERSION)
    expect(migrated.crt).toEqual(DEFAULT_SCOPE_CRT)
    expect(migrated.crt.enabled).toBe(false)
    // And the settings it did have survive.
    expect(migrated.signalMode).toBe('stereoXY')
    expect(migrated.enabled).toBe(true)
  })

  it('migrates a v2 project to v3 with the values that were previously compiled in', () => {
    // Beam and phosphor were hardcoded before v3. Their defaults reproduce those
    // values exactly, so a v2 project looks identical after migration — the
    // controls become adjustable, not different.
    const migrated = normalizeSoundDrawingScopeState({ version: 2, crt: DEFAULT_SCOPE_CRT })
    expect(migrated.version).toBe(SOUND_DRAWING_SCOPE_STATE_VERSION)
    expect(migrated.beam).toEqual(DEFAULT_SCOPE_BEAM)
    expect(migrated.phosphor).toEqual(DEFAULT_SCOPE_PHOSPHOR)
  })

  it('migrates a v3 project to v4 with music mapping neutral', () => {
    // Every music amount defaults to zero, which is the identity mapping, so the
    // feature arrives switched on but changing nothing.
    const migrated = normalizeSoundDrawingScopeState({ version: 3 })
    expect(migrated.version).toBe(SOUND_DRAWING_SCOPE_STATE_VERSION)
    expect(migrated.music).toEqual(DEFAULT_SCOPE_MUSIC_MAPPING)
  })

  it('repairs corrupted beam and phosphor blocks', () => {
    const migrated = normalizeSoundDrawingScopeState({
      beam: { coreWidthPx: -5, haloScale: 'wide' },
      phosphor: { persistenceSeconds: 1e9, whiteHot: Number.NaN },
    })
    expect(migrated.beam.coreWidthPx).toBeGreaterThan(0)
    expect(migrated.beam.haloScale).toBe(DEFAULT_SCOPE_BEAM.haloScale)
    expect(migrated.phosphor.persistenceSeconds).toBeLessThanOrEqual(4)
    expect(Number.isFinite(migrated.phosphor.whiteHot)).toBe(true)
  })

  it('repairs a corrupted CRT block rather than trusting it', () => {
    const migrated = normalizeSoundDrawingScopeState({
      crt: { phosphorModel: 'nonsense', scanlineStrength: 99, customPhosphorColor: 'drop table' },
    })
    expect(migrated.crt.phosphorModel).toBe(DEFAULT_SCOPE_CRT.phosphorModel)
    expect(migrated.crt.scanlineStrength).toBe(1)
    expect(migrated.crt.customPhosphorColor).toBe(DEFAULT_SCOPE_CRT.customPhosphorColor)
  })

  it('ships no animated CRT artifact, so photosensitivity risk is off by construction', () => {
    // Flicker, vertical roll, and horizontal jitter are absent from the settings
    // shape entirely rather than present-and-zeroed.
    const keys = Object.keys(normalizeSoundDrawingScopeState({}).crt)
    for (const risky of ['flicker', 'verticalRoll', 'horizontalJitter']) {
      expect(keys).not.toContain(risky)
    }
  })

  it('does not enable the professional core for legacy projects', () => {
    // Existing projects must keep rendering exactly as they did until the user
    // opts in.
    expect(normalizeSoundDrawingScopeState({}).enabled).toBe(false)
  })
})
