import { describe, expect, it } from 'vitest'
import { sortPresetsByName } from './presetOrder'

describe('Presets tab order', () => {
  it('is alphabetical by name, ignoring case and accents, with numbers in number order and ties kept in shipped order', () => {
    const presets = ['pulse 10', 'Échelon', 'Afterhours', 'Pulse 2', 'beam', 'Depth', 'depth'].map((name, index) => ({ name, index }))
    expect(sortPresetsByName(presets, preset => preset.name).map(preset => preset.name)).toEqual(['Afterhours', 'beam', 'Depth', 'depth', 'Échelon', 'Pulse 2', 'pulse 10'])
  })
})
