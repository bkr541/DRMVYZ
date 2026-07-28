import { describe, expect, it } from 'vitest'
import {
  SCOPE_PRESETS,
  SCOPE_PRESETS_BY_ID,
  applyScopePreset,
  resolveScopePresetState,
  violatesMeasurementDiscipline,
} from '../scopePresets'
import { normalizeSoundDrawingScopeState } from '../scopeStateNormalization'
import {
  DEFAULT_SOUND_DRAWING_SCOPE_STATE,
  SOUND_DRAWING_SCOPE_STATE_VERSION,
  isScopeStereoMeasurementMode,
} from '../scopeTypes'

describe('preset catalogue', () => {
  it('has unique ids', () => {
    const ids = SCOPE_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a name and a description for every preset', () => {
    for (const preset of SCOPE_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0)
      // The description is what a user picks from, so it has to say something.
      expect(preset.description.length).toBeGreaterThan(20)
    }
  })

  it('covers all three groups', () => {
    const groups = new Set(SCOPE_PRESETS.map(p => p.group))
    expect(groups).toEqual(new Set(['measurement', 'analog', 'signature']))
  })

  it('is indexed consistently', () => {
    expect(SCOPE_PRESETS_BY_ID.size).toBe(SCOPE_PRESETS.length)
    for (const preset of SCOPE_PRESETS) {
      expect(SCOPE_PRESETS_BY_ID.get(preset.id)).toBe(preset)
    }
  })
})

describe('measurement discipline', () => {
  it('no measurement preset applies treatment that misrepresents the signal', () => {
    // A measurement display must not change thickness with the music or bend the
    // geometry it is reading. Asserted rather than left to review.
    for (const preset of SCOPE_PRESETS) {
      expect({ id: preset.id, violates: violatesMeasurementDiscipline(preset) })
        .toEqual({ id: preset.id, violates: false })
    }
  })

  it('every measurement preset resolves to a genuine measurement signal mode', () => {
    for (const preset of SCOPE_PRESETS.filter(p => p.group === 'measurement')) {
      const state = resolveScopePresetState(preset.id)
      expect(state.signalMode).not.toBe('monoDelayXY')
      expect(state.signalMode).not.toBe('proceduralFallback')
    }
  })

  it('pairs the vectorscope graticule only with modes it describes', () => {
    // Concentric rings and 45-degree correlation diagonals mean something for an
    // X/Y stereo relationship and nothing for a time-domain waveform.
    for (const preset of SCOPE_PRESETS) {
      const state = resolveScopePresetState(preset.id)
      if (state.crt.graticuleStyle !== 'vectorscope') continue
      expect(
        isScopeStereoMeasurementMode(state.signalMode) || state.signalMode === 'monoDelayXY',
      ).toBe(true)
    }
  })

  it('detects a violation when one is introduced', () => {
    // Guards the guard: the check must actually be capable of failing.
    expect(violatesMeasurementDiscipline({
      id: 'x', name: 'x', description: 'x', group: 'measurement',
      state: { beam: { bassWidthResponse: 1 } },
    })).toBe(true)
    expect(violatesMeasurementDiscipline({
      id: 'x', name: 'x', description: 'x', group: 'analog',
      state: { beam: { bassWidthResponse: 1 } },
    })).toBe(false)
  })
})

describe('applying a preset', () => {
  it('produces a complete, valid state', () => {
    for (const preset of SCOPE_PRESETS) {
      const state = resolveScopePresetState(preset.id)
      // Round-tripping through normalization must be a no-op: a preset that
      // needed repairing would be shipping out-of-range values.
      expect(normalizeSoundDrawingScopeState(state)).toEqual(state)
      expect(state.version).toBe(SOUND_DRAWING_SCOPE_STATE_VERSION)
    }
  })

  it('records which preset is active', () => {
    expect(resolveScopePresetState('scope-stereo-phase').presetId).toBe('scope-stereo-phase')
  })

  it('layers rather than replaces, so unrelated settings survive', () => {
    const base = {
      ...DEFAULT_SOUND_DRAWING_SCOPE_STATE,
      signalConditioner: { ...DEFAULT_SOUND_DRAWING_SCOPE_STATE.signalConditioner, gainY: 3.5 },
    }
    // Stereo Phase says nothing about conditioning, so the user's gain stands.
    const applied = applyScopePreset(base, 'scope-stereo-phase')
    expect(applied.signalConditioner.gainY).toBe(3.5)
    expect(applied.signalMode).toBe('stereoXY')
  })

  it('returns the base unchanged for an unknown preset', () => {
    const base = DEFAULT_SOUND_DRAWING_SCOPE_STATE
    expect(applyScopePreset(base, 'no-such-preset')).toBe(base)
  })

  it('gives measurably different results across presets', () => {
    // Presets that resolve to the same state would be padding the list.
    const fingerprints = SCOPE_PRESETS.map(preset => {
      const s = resolveScopePresetState(preset.id)
      return JSON.stringify([
        s.signalMode, s.trigger.mode, s.timebase.mode,
        s.beam.coreWidthPx, s.beam.haloScale, s.beam.cornerDwell,
        s.phosphor.persistenceSeconds, s.phosphor.whiteHot,
        s.crt.enabled, s.crt.phosphorModel, s.crt.graticuleStyle,
      ])
    })
    expect(new Set(fingerprints).size).toBe(SCOPE_PRESETS.length)
  })

  it('spans a wide persistence range, so the bank is not one look retuned', () => {
    const persistences = SCOPE_PRESETS.map(p => resolveScopePresetState(p.id).phosphor.persistenceSeconds)
    expect(Math.min(...persistences)).toBeLessThan(0.2)
    expect(Math.max(...persistences)).toBeGreaterThan(2)
  })
})
