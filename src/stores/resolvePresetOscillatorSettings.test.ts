import { describe, it, expect } from 'vitest'
import { resolvePresetOscillatorSettings } from './reactStore'
import {
  DEFAULT_OSCILLATOR_SETTINGS,
  DEFAULT_REACT_PRESETS,
} from '../components/vyzualz/react/ReactTypes'
import type { ReactPreset, OscillatorSettings } from '../components/vyzualz/react/ReactTypes'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const textSettings: OscillatorSettings = {
  ...DEFAULT_OSCILLATOR_SETTINGS,
  sourceType: 'text',
  text: 'HELLO',
}

// A legacy oscilloscope preset with no oscillatorSettings defined
const LEGACY_OSC_PRESET = DEFAULT_REACT_PRESETS.find(
  p => p.engine === 'oscilloscope' && !p.oscillatorSettings,
)

// An enhanced oscilloscope preset that carries oscillatorSettings
const ENHANCED_OSC_PRESET = DEFAULT_REACT_PRESETS.find(
  p => p.engine === 'oscilloscope' && p.oscillatorSettings != null,
)

// A non-oscilloscope preset (shaderPads or cinematicPortal)
const NON_OSC_PRESET = DEFAULT_REACT_PRESETS.find(
  p => p.engine !== 'oscilloscope',
)

// ── resolvePresetOscillatorSettings ──────────────────────────────────────────

describe('resolvePresetOscillatorSettings', () => {
  // Issue 1 — core fix
  it('resets to DEFAULT when selecting a legacy oscilloscope preset with no oscillatorSettings', () => {
    if (!LEGACY_OSC_PRESET) return  // skip if no legacy preset exists in test data

    const result = resolvePresetOscillatorSettings(LEGACY_OSC_PRESET, textSettings)

    expect(result.sourceType).toBe('classic')
    expect(result).toEqual(DEFAULT_OSCILLATOR_SETTINGS)
  })

  it('loses the previous text sourceType when selecting a legacy oscilloscope preset', () => {
    if (!LEGACY_OSC_PRESET) return

    const result = resolvePresetOscillatorSettings(LEGACY_OSC_PRESET, textSettings)
    expect(result.sourceType).not.toBe('text')
  })

  it('defaults classicMode to sectionAuto for legacy oscilloscope presets', () => {
    if (!LEGACY_OSC_PRESET) return

    const result = resolvePresetOscillatorSettings(LEGACY_OSC_PRESET, textSettings)
    expect(result.classicMode).toBe('sectionAuto')
  })

  it('applies preset oscillatorSettings on top of DEFAULT for enhanced presets', () => {
    if (!ENHANCED_OSC_PRESET) return

    const result = resolvePresetOscillatorSettings(ENHANCED_OSC_PRESET, textSettings)

    // Enhanced preset overrides should be present
    for (const [key, val] of Object.entries(ENHANCED_OSC_PRESET.oscillatorSettings!)) {
      expect(result[key as keyof OscillatorSettings]).toBe(val)
    }
  })

  it('always starts from DEFAULT for enhanced oscilloscope presets (no leftover text state)', () => {
    if (!ENHANCED_OSC_PRESET) return

    // Enhanced preset does not override sourceType → should land on DEFAULT sourceType
    if (!ENHANCED_OSC_PRESET.oscillatorSettings?.sourceType) {
      const result = resolvePresetOscillatorSettings(ENHANCED_OSC_PRESET, textSettings)
      expect(result.sourceType).toBe(DEFAULT_OSCILLATOR_SETTINGS.sourceType)
    }
  })

  it('leaves oscillatorSettings unchanged for non-oscilloscope presets', () => {
    if (!NON_OSC_PRESET) return

    const result = resolvePresetOscillatorSettings(NON_OSC_PRESET, textSettings)
    expect(result).toBe(textSettings)  // exact same reference — no new object
  })

  it('returns DEFAULT_OSCILLATOR_SETTINGS for a minimal oscilloscope preset with no overrides', () => {
    const base = DEFAULT_REACT_PRESETS[0]
    const minimalPreset: ReactPreset = {
      ...base,
      id:     'test-legacy',
      engine: 'oscilloscope',
      name:   'Legacy',
      oscillatorSettings: undefined,
    }
    expect(resolvePresetOscillatorSettings(minimalPreset, textSettings)).toEqual(DEFAULT_OSCILLATOR_SETTINGS)
  })

  it('merges a single override onto DEFAULT for a custom oscilloscope preset', () => {
    const base = DEFAULT_REACT_PRESETS[0]
    const presetWithOverride: ReactPreset = {
      ...base,
      id:                 'test-enhanced',
      engine:             'oscilloscope',
      name:               'Enhanced',
      oscillatorSettings: { sourceType: 'text', text: 'HI' },
    }
    const result = resolvePresetOscillatorSettings(presetWithOverride, textSettings)
    expect(result.sourceType).toBe('text')
    expect(result.text).toBe('HI')
    // Unspecified fields stay at DEFAULT
    expect(result.pathResolution).toBe(DEFAULT_OSCILLATOR_SETTINGS.pathResolution)
    expect(result.classicMode).toBe(DEFAULT_OSCILLATOR_SETTINGS.classicMode)
  })

  it('is idempotent — calling twice with the same preset produces equal results', () => {
    if (!LEGACY_OSC_PRESET) return
    const a = resolvePresetOscillatorSettings(LEGACY_OSC_PRESET, textSettings)
    const b = resolvePresetOscillatorSettings(LEGACY_OSC_PRESET, textSettings)
    expect(a).toEqual(b)
  })

  it('shaderPads preset: returns currentSettings reference unchanged', () => {
    const shaderPreset = DEFAULT_REACT_PRESETS.find(p => p.engine === 'shaderPads')
    if (!shaderPreset) return
    const result = resolvePresetOscillatorSettings(shaderPreset, textSettings)
    expect(result).toBe(textSettings)
  })

  it('cinematicPortal preset: returns currentSettings reference unchanged', () => {
    const cinPreset = DEFAULT_REACT_PRESETS.find(p => p.engine === 'cinematicPortal')
    if (!cinPreset) return
    const result = resolvePresetOscillatorSettings(cinPreset, textSettings)
    expect(result).toBe(textSettings)
  })
})
