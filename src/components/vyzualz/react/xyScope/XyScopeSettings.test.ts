import { describe, expect, it } from 'vitest'
import {
  applyXyScopePreset,
  DEFAULT_XY_SCOPE_SETTINGS,
  getXyScopeDefaultParameters,
  isXyScopeParameterVisible,
  normalizeXyScopeSettings,
  normalizeXyScopeText,
  resolveXyScopeParameters,
  XY_SCOPE_GROUP_LABELS,
  XY_SCOPE_GROUP_ORDER,
  XY_SCOPE_PARAMETERS,
  XY_SCOPE_PRESETS,
  XY_SCOPE_TEXT_MAX_LENGTH,
} from './XyScopeSettings'

describe('Sound Drawing XY inspector standard', () => {
  it('uses the four standard Design groups in order', () => {
    expect(XY_SCOPE_GROUP_ORDER).toEqual(['master-controls', 'design', 'react', 'palette'])
    expect(XY_SCOPE_GROUP_ORDER.map(group => XY_SCOPE_GROUP_LABELS[group])).toEqual(['Master Controls', 'Design', 'React', 'Palette'])
  })

  it('places every parameter under exactly one standard group, and every group has controls', () => {
    const ids = new Set<string>()
    for (const definition of XY_SCOPE_PARAMETERS) {
      expect(XY_SCOPE_GROUP_ORDER).toContain(definition.group)
      expect(ids.has(definition.id)).toBe(false)
      ids.add(definition.id)
      expect(definition.label.length).toBeGreaterThan(2)
      expect(definition.description.length).toBeGreaterThan(10)
    }
    for (const group of XY_SCOPE_GROUP_ORDER) {
      expect(XY_SCOPE_PARAMETERS.some(definition => definition.group === group)).toBe(true)
    }
  })

  it('provides a Palette with independent colours', () => {
    const colours = XY_SCOPE_PARAMETERS.filter(definition => definition.group === 'palette')
    expect(colours.map(definition => definition.kind)).toEqual(['color', 'color', 'color'])
  })
})

describe('Sound Drawing XY settings normalization', () => {
  it('returns the documented defaults for empty or corrupt input', () => {
    expect(normalizeXyScopeSettings(undefined)).toEqual(DEFAULT_XY_SCOPE_SETTINGS)
    expect(normalizeXyScopeSettings('nonsense')).toEqual(DEFAULT_XY_SCOPE_SETTINGS)
    expect(normalizeXyScopeSettings({ parameters: [] })).toEqual(DEFAULT_XY_SCOPE_SETTINGS)
  })

  it('clamps sliders, rejects bad enums, booleans and colours, and keeps valid values', () => {
    const settings = normalizeXyScopeSettings({
      parameters: { intensity: 99, audioReactivity: -4, trail: Number.NaN, phraseDissolve: 'yes', phraseLength: 'bar99', beamColor: 'teal', glowColor: '#FF8800', answerDelay: 60 },
    })
    expect(settings.parameters.intensity).toBe(2)
    expect(settings.parameters.audioReactivity).toBe(0)
    expect(settings.parameters.trail).toBe(110)
    expect(settings.parameters.phraseDissolve).toBe(true)
    expect(settings.parameters.phraseLength).toBe('bar4')
    expect(settings.parameters.beamColor).toBe('#96fff0')
    expect(settings.parameters.glowColor).toBe('#ff8800')
    expect(settings.parameters.answerDelay).toBe(60)
  })

  it('keeps text to one line of bounded length and an unknown preset falls back', () => {
    expect(normalizeXyScopeText('A\nB\tC')).toBe('A B C')
    expect(normalizeXyScopeText('X'.repeat(80))).toHaveLength(XY_SCOPE_TEXT_MAX_LENGTH)
    expect(normalizeXyScopeText(42)).toBe('DRMVYZ')
    expect(normalizeXyScopeSettings({ presetId: 'missing' }).presetId).toBe('conversation')
    expect(normalizeXyScopeSettings({ presetId: null }).presetId).toBeNull()
    expect(normalizeXyScopeSettings({ text: '' }).text).toBe('')
  })

  it('only accepts a non-empty font id', () => {
    expect(normalizeXyScopeSettings({ fontId: 'font-abc' }).fontId).toBe('font-abc')
    expect(normalizeXyScopeSettings({ fontId: '' }).fontId).toBeNull()
    expect(normalizeXyScopeSettings({ fontId: 7 }).fontId).toBeNull()
  })

  it('hides Phrase Length while Phrase Dissolve is off but keeps its value', () => {
    const length = XY_SCOPE_PARAMETERS.find(definition => definition.id === 'phraseLength')!
    const on = { ...getXyScopeDefaultParameters(), phraseDissolve: true }
    const off = { ...getXyScopeDefaultParameters(), phraseDissolve: false, phraseLength: 'bar16' }
    expect(isXyScopeParameterVisible(length, on)).toBe(true)
    expect(isXyScopeParameterVisible(length, off)).toBe(false)
    expect(normalizeXyScopeSettings({ parameters: off }).parameters.phraseLength).toBe('bar16')
  })
})

describe('Sound Drawing XY presets', () => {
  it('only set known, in-range parameters', () => {
    for (const preset of XY_SCOPE_PRESETS) {
      for (const [id, value] of Object.entries(preset.parameters)) {
        const definition = XY_SCOPE_PARAMETERS.find(candidate => candidate.id === id)
        expect(definition, `${preset.id}.${id}`).toBeDefined()
        const normalized = normalizeXyScopeSettings({ parameters: { [id]: value } }).parameters[id]
        expect(normalized, `${preset.id}.${id}`).toBe(value)
      }
    }
  })

  it('applies a preset without touching the word, the font or the palette', () => {
    const base = normalizeXyScopeSettings({ text: 'HELLO', fontId: 'font-1', parameters: { beamColor: '#ff0000' } })
    const next = applyXyScopePreset(base, 'storm')
    expect(next.presetId).toBe('storm')
    expect(next.text).toBe('HELLO')
    expect(next.fontId).toBe('font-1')
    expect(next.parameters.beamColor).toBe('#ff0000')
    expect(next.parameters.dissolveDepth).toBe(1.5)
    expect(applyXyScopePreset(base, 'unknown')).toBe(base)
  })

  it('resolves typed values for the runtime', () => {
    const resolved = resolveXyScopeParameters(DEFAULT_XY_SCOPE_SETTINGS)
    expect(resolved.trailMs).toBe(110)
    expect(resolved.answerDelayMs).toBe(45)
    expect(resolved.phraseLength).toBe('bar4')
    expect(resolved.beamColor).toBe('#96fff0')
  })
})
