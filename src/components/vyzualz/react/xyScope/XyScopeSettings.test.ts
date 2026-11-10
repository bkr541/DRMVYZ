import { describe, expect, it } from 'vitest'
import { CINEMA2_AFTERHOURS_TRIGGER_OPTIONS } from '../../cinema2/presets/Cinema2AfterhoursPreset'
import {
  applyXyScopePreset,
  DEFAULT_XY_SCOPE_SETTINGS,
  getXyScopeDefaultParameters,
  isXyScopeParameterVisible,
  normalizeXyScopeSettings,
  normalizeXyScopeText,
  resolveXyScopeParameters,
  XY_SCOPE_DESIGN_SUBGROUPS,
  XY_SCOPE_GROUP_LABELS,
  XY_SCOPE_GROUP_ORDER,
  XY_SCOPE_PARAMETERS,
  XY_SCOPE_PRESETS,
  XY_SCOPE_TEXT_MAX_LENGTH,
} from './XyScopeSettings'
import { XY_SCOPE_PATTERN_IDS } from './XyScopePatterns'

const definition = (id: string) => XY_SCOPE_PARAMETERS.find(candidate => candidate.id === id)!

describe('Sound Drawing XY inspector standard', () => {
  it('uses the four standard Design groups in order', () => {
    expect(XY_SCOPE_GROUP_ORDER).toEqual(['master-controls', 'design', 'react', 'palette'])
    expect(XY_SCOPE_GROUP_ORDER.map(group => XY_SCOPE_GROUP_LABELS[group])).toEqual(['Master Controls', 'Design', 'React', 'Palette'])
  })

  it('places every parameter under exactly one standard group, and every group has controls', () => {
    const ids = new Set<string>()
    for (const entry of XY_SCOPE_PARAMETERS) {
      expect(XY_SCOPE_GROUP_ORDER).toContain(entry.group)
      expect(ids.has(entry.id)).toBe(false)
      ids.add(entry.id)
      expect(entry.label.length).toBeGreaterThan(2)
      expect(entry.description.length).toBeGreaterThan(10)
    }
    for (const group of XY_SCOPE_GROUP_ORDER) {
      expect(XY_SCOPE_PARAMETERS.some(entry => entry.group === group)).toBe(true)
    }
  })

  it('nests controls only inside Design, in the declared subgroups', () => {
    for (const entry of XY_SCOPE_PARAMETERS) {
      if (entry.subgroup) {
        expect(entry.group).toBe('design')
        expect(XY_SCOPE_DESIGN_SUBGROUPS).toContain(entry.subgroup)
      }
    }
    for (const subgroup of XY_SCOPE_DESIGN_SUBGROUPS) expect(XY_SCOPE_PARAMETERS.some(entry => entry.subgroup === subgroup)).toBe(true)
  })

  it('provides a Palette with independent colours', () => {
    const colours = XY_SCOPE_PARAMETERS.filter(entry => entry.group === 'palette')
    expect(colours.map(entry => entry.kind)).toEqual(['color', 'color', 'color'])
  })
})

describe('Sound Drawing XY choreography contract (Cinema 2.0 pacing)', () => {
  it('orders Pattern, Pattern Change, Trigger in the Design › Pattern group', () => {
    const pattern = XY_SCOPE_PARAMETERS.filter(entry => entry.subgroup === 'Pattern').map(entry => entry.id)
    expect(pattern.slice(0, 3)).toEqual(['pattern', 'patternChange', 'trigger'])
    expect(pattern).toContain('transitionLength')
  })

  it('makes Pattern Change a boolean toggle and Trigger visible only while it is on', () => {
    expect(definition('patternChange').kind).toBe('toggle')
    const trigger = definition('trigger')
    const on = { ...getXyScopeDefaultParameters(), patternChange: true }
    const off = { ...getXyScopeDefaultParameters(), patternChange: false, trigger: 'phrase' }
    expect(isXyScopeParameterVisible(trigger, on)).toBe(true)
    expect(isXyScopeParameterVisible(trigger, off)).toBe(false)
    // The authored value survives hiding.
    expect(normalizeXyScopeSettings({ parameters: off }).parameters.trigger).toBe('phrase')
  })

  it('uses the canonical eleven Cinema 2.0 Trigger options unchanged, in the same order', () => {
    const trigger = definition('trigger')
    expect(trigger.kind === 'select' && trigger.options).toBe(CINEMA2_AFTERHOURS_TRIGGER_OPTIONS)
    expect(trigger.kind === 'select' && trigger.options.map(option => option.value)).toEqual([
      'beat', 'kick', 'snare', 'downbeat', 'beat2', 'beat4', 'bar', 'bar4', 'bar8', 'phrase', 'drop',
    ])
  })

  it('offers every pattern, starting from the letters, and rejects an unknown pattern or trigger', () => {
    const pattern = definition('pattern')
    expect(pattern.kind === 'select' && pattern.options.map(option => option.value)).toEqual([...XY_SCOPE_PATTERN_IDS])
    expect(normalizeXyScopeSettings({ parameters: { pattern: 'spiral', trigger: 'every-second' } }).parameters).toMatchObject({ pattern: 'word', trigger: 'bar' })
  })

  it('offers Transition Length in beats as 0.5, 1, 2 and 4', () => {
    const length = definition('transitionLength')
    expect(length.kind === 'select' && length.options.map(option => option.value)).toEqual(['0.5', '1', '2', '4'])
    expect(resolveXyScopeParameters(normalizeXyScopeSettings({ parameters: { transitionLength: '4' } })).transitionBeats).toBe(4)
  })

  it('keeps the old whole-word dissolve controls out of the catalog', () => {
    for (const id of ['phraseDissolve', 'phraseLength', 'dropDissolve']) expect(XY_SCOPE_PARAMETERS.some(entry => entry.id === id)).toBe(false)
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
      parameters: { intensity: 99, audioReactivity: -4, trail: Number.NaN, patternChange: 'yes', trigger: 'bar99', beamColor: 'teal', glowColor: '#FF8800', answerDelay: 60 },
    })
    expect(settings.parameters.intensity).toBe(2)
    expect(settings.parameters.audioReactivity).toBe(0)
    expect(settings.parameters.trail).toBe(110)
    expect(settings.parameters.patternChange).toBe(true)
    expect(settings.parameters.trigger).toBe('bar')
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
})

describe('Sound Drawing XY presets', () => {
  it('only set known, in-range parameters', () => {
    for (const preset of XY_SCOPE_PRESETS) {
      for (const [id, value] of Object.entries(preset.parameters)) {
        expect(XY_SCOPE_PARAMETERS.find(candidate => candidate.id === id), `${preset.id}.${id}`).toBeDefined()
        expect(normalizeXyScopeSettings({ parameters: { [id]: value } }).parameters[id], `${preset.id}.${id}`).toBe(value)
      }
    }
  })

  it('performs by default, and Clean Scope holds the letters', () => {
    expect(DEFAULT_XY_SCOPE_SETTINGS.parameters.patternChange).toBe(true)
    const clean = XY_SCOPE_PRESETS.find(preset => preset.id === 'clean-scope')!
    expect(clean.parameters.patternChange).toBe(false)
    expect(clean.parameters.pattern).toBe('word')
  })

  it('applies a preset without touching the word, the font or the palette', () => {
    const base = normalizeXyScopeSettings({ text: 'HELLO', fontId: 'font-1', parameters: { beamColor: '#ff0000' } })
    const next = applyXyScopePreset(base, 'storm')
    expect(next.presetId).toBe('storm')
    expect(next.text).toBe('HELLO')
    expect(next.fontId).toBe('font-1')
    expect(next.parameters.beamColor).toBe('#ff0000')
    expect(next.parameters.dissolveDepth).toBe(1.5)
    expect(next.parameters.trigger).toBe('beat2')
    expect(applyXyScopePreset(base, 'unknown')).toBe(base)
  })

  it('resolves typed values for the runtime', () => {
    const resolved = resolveXyScopeParameters(DEFAULT_XY_SCOPE_SETTINGS)
    expect(resolved.trailMs).toBe(110)
    expect(resolved.answerDelayMs).toBe(45)
    expect(resolved.pattern).toBe('word')
    expect(resolved.patternChange).toBe(true)
    expect(resolved.trigger).toBe('bar')
    expect(resolved.transitionBeats).toBe(1)
    expect(resolved.bpmSync).toBe(true)
    expect(resolved.beamColor).toBe('#96fff0')
  })
})
